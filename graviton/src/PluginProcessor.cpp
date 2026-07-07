#include "PluginProcessor.h"
#include "PluginEditor.h"

namespace
{
    constexpr float kTwoPi = juce::MathConstants<float>::twoPi;

    juce::AudioProcessorValueTreeState::ParameterLayout makeLayout()
    {
        using P = juce::AudioParameterFloat;
        std::vector<std::unique_ptr<juce::RangedAudioParameter>> params;

        const auto pct = juce::AudioParameterFloatAttributes().withStringFromValueFunction (
            [] (float v, int) { return juce::String (juce::roundToInt (v * 100.0f)) + " %"; });
        const auto hz = juce::AudioParameterFloatAttributes().withStringFromValueFunction (
            [] (float v, int) { return juce::String (juce::roundToInt (v)) + " Hz"; });

        params.push_back (std::make_unique<P> (
            juce::ParameterID { "gravity", 1 }, "Gravity",
            juce::NormalisableRange<float> (-1.0f, 1.0f, 0.0f), 0.4f, pct));

        params.push_back (std::make_unique<P> (
            juce::ParameterID { "mass", 1 }, "Mass",
            juce::NormalisableRange<float> (0.0f, 1.0f, 0.0f), 0.5f, pct));

        params.push_back (std::make_unique<P> (
            juce::ParameterID { "orbit", 1 }, "Orbit",
            juce::NormalisableRange<float> (0.0f, 1.0f, 0.0f), 0.5f, pct));

        params.push_back (std::make_unique<P> (
            juce::ParameterID { "restore", 1 }, "Restore",
            juce::NormalisableRange<float> (0.0f, 1.0f, 0.0f), 0.35f, pct));

        params.push_back (std::make_unique<P> (
            juce::ParameterID { "anchor", 1 }, "Anchor",
            juce::NormalisableRange<float> (20.0f, 1000.0f, 0.0f, 0.35f), 110.0f, hz));

        params.push_back (std::make_unique<P> (
            juce::ParameterID { "mix", 1 }, "Mix",
            juce::NormalisableRange<float> (0.0f, 1.0f, 0.0f), 1.0f, pct));

        return { params.begin(), params.end() };
    }
}

//==============================================================================
GravitonProcessor::GravitonProcessor()
    : AudioProcessor (BusesProperties()
                          .withInput ("Input", juce::AudioChannelSet::stereo(), true)
                          .withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      apvts (*this, nullptr, "GravitonState", makeLayout())
{
    pGravity = apvts.getRawParameterValue ("gravity");
    pMass    = apvts.getRawParameterValue ("mass");
    pOrbit   = apvts.getRawParameterValue ("orbit");
    pRestore = apvts.getRawParameterValue ("restore");
    pAnchor  = apvts.getRawParameterValue ("anchor");
    pMix     = apvts.getRawParameterValue ("mix");

    for (int n = 0; n < fftSize; ++n)
        window[(size_t) n] = 0.5f - 0.5f * std::cos (kTwoPi * (float) n / (float) fftSize);

    for (int k = 0; k < numBins; ++k)
    {
        pos[k] = (float) k;
        vizFrame.pos[k] = (float) k;
    }
}

bool GravitonProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    const auto in  = layouts.getMainInputChannelSet();
    const auto out = layouts.getMainOutputChannelSet();
    if (in != out)
        return false;
    return in == juce::AudioChannelSet::mono() || in == juce::AudioChannelSet::stereo();
}

void GravitonProcessor::prepareToPlay (double sampleRate, int)
{
    currentSampleRate = sampleRate;
    setLatencySamples (fftSize);

    for (int ch = 0; ch < 2; ++ch)
    {
        std::fill (std::begin (inputFifo[ch]),  std::end (inputFifo[ch]),  0.0f);
        std::fill (std::begin (outputFifo[ch]), std::end (outputFifo[ch]), 0.0f);
        dryDelay[ch].assign ((size_t) fftSize, 0.0f);
    }
    fifoPos = 0;
    hopCounter = 0;
    dryPos = 0;

    for (int k = 0; k < numBins; ++k)
    {
        pos[k] = (float) k;
        vel[k] = 0.0f;
        massSm[k] = 0.0f;
        phaseOff[k] = 0.0f;
    }
}

//==============================================================================
void GravitonProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer&)
{
    juce::ScopedNoDenormals noDenormals;

    const int numCh = juce::jmin (2, buffer.getNumChannels());
    const int numSamples = buffer.getNumSamples();
    const float mix = pMix->load();

    for (int i = 0; i < numSamples; ++i)
    {
        for (int ch = 0; ch < numCh; ++ch)
        {
            const float x = buffer.getSample (ch, i);

            inputFifo[ch][fifoPos] = x;
            const float wet = outputFifo[ch][fifoPos];
            outputFifo[ch][fifoPos] = 0.0f;

            const float dry = dryDelay[ch][(size_t) dryPos];
            dryDelay[ch][(size_t) dryPos] = x;

            buffer.setSample (ch, i, dry + (wet - dry) * mix);
        }

        if (++dryPos >= fftSize)  dryPos = 0;
        if (++fifoPos >= fftSize) fifoPos = 0;

        if (++hopCounter >= hopSize)
        {
            hopCounter = 0;
            processFrame (numCh);
        }
    }
}

//==============================================================================
void GravitonProcessor::processFrame (int numCh)
{
    const int mask = fftSize - 1;

    // ---- analysis -----------------------------------------------------------
    for (int ch = 0; ch < numCh; ++ch)
    {
        for (int n = 0; n < fftSize; ++n)
            fftData[ch][n] = inputFifo[ch][(fifoPos + n) & mask] * window[(size_t) n];

        std::fill (fftData[ch] + fftSize, fftData[ch] + 2 * fftSize, 0.0f);
        fft.performRealOnlyForwardTransform (fftData[ch]);
    }

    // ---- masses -------------------------------------------------------------
    float frameMax = 0.0f;
    for (int k = 0; k < numBins; ++k)
    {
        float mag = 0.0f;
        for (int ch = 0; ch < numCh; ++ch)
        {
            const float re = fftData[ch][2 * k];
            const float im = fftData[ch][2 * k + 1];
            mag += std::sqrt (re * re + im * im);
        }
        mag /= (float) numCh;

        // fast attack, slow release — partials keep their gravity for a moment
        const float coeff = mag > massSm[k] ? 0.6f : 0.12f;
        massSm[k] += (mag - massSm[k]) * coeff;
        frameMax = juce::jmax (frameMax, massSm[k]);
    }

    // ---- parameters → physics constants -------------------------------------
    const float gravP   = pGravity->load();
    const float G       = 12.0f * gravP * std::abs (gravP);        // signed, squared taper
    const float massExp = 0.5f + 2.0f * pMass->load();
    const float damp    = juce::jmap (pOrbit->load(), 0.55f, 0.985f);
    const float restoreP = pRestore->load();
    const float spring  = 0.05f * restoreP * restoreP;
    const float anchorHz = pAnchor->load();
    const int   anchorBin = juce::jlimit (1, numBins - 4,
                        (int) std::ceil (anchorHz * (float) fftSize / (float) currentSampleRate));

    int   starBin [maxStars];
    float starMass[maxStars];
    int   numStars = 0;

    const bool haveSignal = frameMax > 1.0e-7f;

    if (haveSignal)
    {
        const float invMax = 1.0f / frameMax;
        for (int k = 0; k < numBins; ++k)
        {
            const float m = massSm[k] * invMax;
            weight[k] = m > 1.0e-6f ? std::pow (m, massExp) : 0.0f;
        }

        // ---- find stars: strongest local maxima of the mass field -----------
        for (int k = juce::jmax (2, anchorBin); k < numBins - 2; ++k)
        {
            const float w = weight[k];
            if (w < 0.02f || w <= weight[k - 1] || w < weight[k + 1])
                continue;

            // integrated mass of the peak (its immediate neighbourhood)
            const float M = weight[k - 1] + w + weight[k + 1];

            // insertion into top-N list, sorted descending by mass
            int at = numStars < maxStars ? numStars : -1;
            for (int s = 0; s < numStars; ++s)
                if (M > starMass[s]) { at = s; break; }
            if (at < 0)
                continue;
            const int last = juce::jmin (numStars, maxStars - 1);
            for (int s = last; s > at; --s)
            {
                starBin[s]  = starBin[s - 1];
                starMass[s] = starMass[s - 1];
            }
            starBin[at]  = k;
            starMass[at] = M;
            numStars = juce::jmin (numStars + 1, maxStars);
        }
    }

    // ---- physics step --------------------------------------------------------
    constexpr float soft = 4.0f;          // softening length² (bins²)
    constexpr float maxVel = 6.0f;        // bins per hop

    for (int k = 1; k < numBins - 1; ++k)
    {
        if (k < anchorBin)
        {
            pos[k] = (float) k;
            vel[k] = 0.0f;
            phaseOff[k] = 0.0f;
            continue;
        }

        float a = spring * ((float) k - pos[k]);

        if (haveSignal && G != 0.0f)
        {
            for (int s = 0; s < numStars; ++s)
            {
                if (starBin[s] == k)
                    continue;
                const float d = pos[starBin[s]] - pos[k];
                const float d2 = d * d + soft;
                a += G * starMass[s] * d / (d2 * std::sqrt (d2));
            }
        }

        vel[k] = juce::jlimit (-maxVel, maxVel, vel[k] * damp + a);
        pos[k] += vel[k];

        if (pos[k] < (float) anchorBin) { pos[k] = (float) anchorBin; vel[k] = 0.0f; }
        if (pos[k] > (float) (numBins - 2)) { pos[k] = (float) (numBins - 2); vel[k] = 0.0f; }
    }

    // ---- resynthesis: move each bin's energy to its particle position --------
    for (int ch = 0; ch < numCh; ++ch)
        std::fill (outSpec[ch], outSpec[ch] + 2 * fftSize, 0.0f);

    for (int k = 0; k < numBins; ++k)
    {
        const bool fixed = k < anchorBin || k == 0 || k >= numBins - 1;

        if (fixed)
        {
            for (int ch = 0; ch < numCh; ++ch)
            {
                outSpec[ch][2 * k]     += fftData[ch][2 * k];
                outSpec[ch][2 * k + 1] += fftData[ch][2 * k + 1];
            }
            continue;
        }

        // phase offset accumulates the per-bin frequency shift; when the
        // particle sits at home (pos == k) this is a bit-exact passthrough
        float ph = phaseOff[k] + kTwoPi * (float) hopSize * (pos[k] - (float) k) / (float) fftSize;
        ph = ph - kTwoPi * std::floor (ph / kTwoPi + 0.5f);
        phaseOff[k] = ph;

        const float c = std::cos (ph);
        const float s = std::sin (ph);

        const float t   = pos[k];
        const int   i0  = (int) t;
        const float fr  = t - (float) i0;
        const int   i1  = juce::jmin (i0 + 1, numBins - 1);

        for (int ch = 0; ch < numCh; ++ch)
        {
            const float re = fftData[ch][2 * k];
            const float im = fftData[ch][2 * k + 1];
            const float rr = re * c - im * s;
            const float ri = re * s + im * c;

            outSpec[ch][2 * i0]     += rr * (1.0f - fr);
            outSpec[ch][2 * i0 + 1] += ri * (1.0f - fr);
            outSpec[ch][2 * i1]     += rr * fr;
            outSpec[ch][2 * i1 + 1] += ri * fr;
        }
    }

    // ---- energy conservation ---------------------------------------------------
    // Collapsing many bins onto one frequency sums their phases incoherently and
    // loses energy ("gravitational binding energy"). Restore it with a smoothed
    // per-frame makeup gain; identical spectra (gravity = 0) give exactly 1.
    {
        double eIn = 0.0, eOut = 0.0;
        for (int ch = 0; ch < numCh; ++ch)
        {
            for (int k = 0; k < numBins; ++k)
            {
                eIn  += (double) fftData[ch][2 * k] * fftData[ch][2 * k]
                      + (double) fftData[ch][2 * k + 1] * fftData[ch][2 * k + 1];
                eOut += (double) outSpec[ch][2 * k] * outSpec[ch][2 * k]
                      + (double) outSpec[ch][2 * k + 1] * outSpec[ch][2 * k + 1];
            }
        }
        const float target = eOut > 1.0e-12
            ? juce::jlimit (0.25f, 4.0f, (float) std::sqrt (eIn / eOut))
            : 1.0f;
        energyGain += (target - energyGain) * 0.5f;

        for (int ch = 0; ch < numCh; ++ch)
            juce::FloatVectorOperations::multiply (outSpec[ch], energyGain, 2 * fftSize);
    }

    // ---- synthesis ------------------------------------------------------------
    // Hann analysis * Hann synthesis at 75% overlap sums to 1.5
    const float norm = 1.0f / 1.5f;

    for (int ch = 0; ch < numCh; ++ch)
    {
        outSpec[ch][1] = 0.0f;                       // DC must stay real
        outSpec[ch][2 * (fftSize / 2) + 1] = 0.0f;   // Nyquist must stay real

        fft.performRealOnlyInverseTransform (outSpec[ch]);

        for (int n = 0; n < fftSize; ++n)
            outputFifo[ch][(fifoPos + n) & mask] += outSpec[ch][n] * window[(size_t) n] * norm;
    }

    // ---- visualiser snapshot ---------------------------------------------------
    if (vizLock.tryEnter())
    {
        const float invMax = haveSignal ? 1.0f / frameMax : 0.0f;
        for (int k = 0; k < numBins; ++k)
        {
            vizFrame.pos[k] = pos[k];
            vizFrame.mag[k] = massSm[k] * invMax;
        }
        vizFrame.numStars = numStars;
        for (int s = 0; s < numStars; ++s)
            vizFrame.starBin[s] = starBin[s];
        vizFrame.sampleRate = currentSampleRate;
        vizLock.exit();
    }
}

//==============================================================================
bool GravitonProcessor::copyVizFrame (VizFrame& dest)
{
    if (! vizLock.tryEnter())
        return false;
    dest = vizFrame;
    vizLock.exit();
    return true;
}

void GravitonProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    if (auto xml = apvts.copyState().createXml())
        copyXmlToBinary (*xml, destData);
}

void GravitonProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    if (auto xml = getXmlFromBinary (data, sizeInBytes))
        apvts.replaceState (juce::ValueTree::fromXml (*xml));
}

juce::AudioProcessorEditor* GravitonProcessor::createEditor()
{
    return new GravitonEditor (*this);
}

// This creates new instances of the plugin
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new GravitonProcessor();
}
