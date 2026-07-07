// Offline verification for Graviton: no host required.
//  1. With gravity = 0 and mix = 1 the STFT chain must reconstruct the input
//     transparently (unity gain, latency exactly fftSize samples).
//  2. With extreme settings the output must stay finite and bounded.
//  3. With gravity engaged the spectrum must actually move (the effect does
//     something), and partials must migrate toward the loudest partial.

#include "../src/PluginProcessor.h"
#include <cstdio>

static int failures = 0;

static void check (bool ok, const char* what)
{
    std::printf ("%s  %s\n", ok ? "[PASS]" : "[FAIL]", what);
    if (! ok)
        ++failures;
}

static void setParam (GravitonProcessor& p, const char* id, float value)
{
    auto* param = p.getState().getParameter (id);
    param->setValueNotifyingHost (param->convertTo0to1 (value));
}

// Runs stereo audio through the processor in 512-sample blocks.
static juce::AudioBuffer<float> run (GravitonProcessor& p, const juce::AudioBuffer<float>& in)
{
    const int block = 512;
    juce::AudioBuffer<float> out (2, in.getNumSamples());
    juce::MidiBuffer midi;

    for (int start = 0; start < in.getNumSamples(); start += block)
    {
        const int n = juce::jmin (block, in.getNumSamples() - start);
        juce::AudioBuffer<float> chunk (2, n);
        for (int ch = 0; ch < 2; ++ch)
            chunk.copyFrom (ch, 0, in, ch, start, n);
        p.processBlock (chunk, midi);
        for (int ch = 0; ch < 2; ++ch)
            out.copyFrom (ch, start, chunk, ch, 0, n);
    }
    return out;
}

static juce::AudioBuffer<float> makeSine (double sr, int numSamples, float hz, float amp)
{
    juce::AudioBuffer<float> buf (2, numSamples);
    for (int i = 0; i < numSamples; ++i)
    {
        const float v = amp * std::sin (juce::MathConstants<float>::twoPi * hz * (float) i / (float) sr);
        buf.setSample (0, i, v);
        buf.setSample (1, i, v);
    }
    return buf;
}

static float rms (const juce::AudioBuffer<float>& b, int from, int len)
{
    double acc = 0.0;
    for (int i = from; i < from + len; ++i)
    {
        const float v = b.getSample (0, i);
        acc += (double) v * v;
    }
    return (float) std::sqrt (acc / len);
}

// Detected frequency via zero crossings over a window (good enough for sines)
static float zeroCrossFreq (const juce::AudioBuffer<float>& b, double sr, int from, int len)
{
    int crossings = 0;
    for (int i = from + 1; i < from + len; ++i)
        if (b.getSample (0, i - 1) < 0.0f && b.getSample (0, i) >= 0.0f)
            ++crossings;
    return (float) crossings * (float) sr / (float) len;
}

// A short additive "pluck chord" phrase: rich, decaying partials give the
// gravity field something musical to act on.
static juce::AudioBuffer<float> makeDemoInput (double sr)
{
    const int N = (int) (sr * 8.0);
    juce::AudioBuffer<float> buf (2, N);
    buf.clear();

    const float chordHz[] = { 110.0f, 165.0f, 220.0f, 277.18f, 330.0f };
    const double noteEvery = 1.6;

    for (int note = 0; note < 5; ++note)
    {
        const int start = (int) (sr * noteEvery * note);
        const float f0 = chordHz[note];
        for (int h = 1; h <= 12; ++h)
        {
            const float hz = f0 * (float) h;
            if (hz > (float) sr * 0.45f)
                break;
            const float amp = 0.22f / (float) h;
            const float pan = 0.5f + 0.35f * std::sin ((float) (note * 3 + h));
            for (int i = start; i < N; ++i)
            {
                const float t = (float) (i - start) / (float) sr;
                const float env = std::exp (-t * (0.55f + 0.25f * (float) h));
                const float v = amp * env
                    * std::sin (juce::MathConstants<float>::twoPi * hz * t);
                buf.addSample (0, i, v * (1.0f - pan));
                buf.addSample (1, i, v * pan);
            }
        }
    }
    return buf;
}

static void writeWav (const juce::AudioBuffer<float>& buf, double sr, const juce::File& file)
{
    file.deleteFile();
    juce::WavAudioFormat fmt;
    if (auto stream = file.createOutputStream())
    {
        if (auto* writer = fmt.createWriterFor (stream.release(), sr, 2, 16, {}, 0))
        {
            std::unique_ptr<juce::AudioFormatWriter> w (writer);
            w->writeFromAudioSampleBuffer (buf, 0, buf.getNumSamples());
        }
    }
    std::printf ("wrote %s\n", file.getFullPathName().toRawUTF8());
}

static int renderDemos (const juce::File& outDir)
{
    const double sr = 44100.0;
    auto in = makeDemoInput (sr);
    outDir.createDirectory();
    writeWav (in, sr, outDir.getChildFile ("graviton-1-dry.wav"));

    struct Preset { const char* name; float gravity, mass, orbit, restore, anchor; };
    const Preset presets[] = {
        { "graviton-2-collapse.wav",   0.75f, 0.65f, 0.25f, 0.08f, 90.0f },
        { "graviton-3-orbital.wav",    0.55f, 0.50f, 0.95f, 0.45f, 90.0f },
        { "graviton-4-antigravity.wav", -0.8f, 0.55f, 0.60f, 0.20f, 90.0f },
    };

    for (auto& pr : presets)
    {
        GravitonProcessor p;
        setParam (p, "gravity", pr.gravity);
        setParam (p, "mass", pr.mass);
        setParam (p, "orbit", pr.orbit);
        setParam (p, "restore", pr.restore);
        setParam (p, "anchor", pr.anchor);
        setParam (p, "mix", 1.0f);
        p.prepareToPlay (sr, 512);
        auto out = run (p, in);
        writeWav (out, sr, outDir.getChildFile (pr.name));
    }

    // offscreen UI snapshot, with the particle field mid-collapse
    {
        GravitonProcessor p;
        setParam (p, "gravity", 0.7f);
        setParam (p, "orbit", 0.8f);
        setParam (p, "restore", 0.2f);
        p.prepareToPlay (sr, 512);
        juce::AudioBuffer<float> head (2, (int) (sr * 3.0));
        for (int ch = 0; ch < 2; ++ch)
            head.copyFrom (ch, 0, in, ch, 0, head.getNumSamples());
        run (p, head);

        std::unique_ptr<juce::AudioProcessorEditor> ed (p.createEditor());
        ed->setOpaque (true);
        // let the editor's timer fire so it pulls a visualiser frame
        juce::MessageManager::getInstance()->runDispatchLoopUntil (250);
        auto img = ed->createComponentSnapshot (ed->getLocalBounds(), true);
        juce::PNGImageFormat png;
        auto f = outDir.getChildFile ("graviton-ui.png");
        f.deleteFile();
        if (auto stream = f.createOutputStream())
            png.writeImageToStream (img, *stream);
        std::printf ("wrote %s\n", f.getFullPathName().toRawUTF8());
    }
    return 0;
}

int main (int argc, char* argv[])
{
    const double sr = 44100.0;
    juce::ScopedJuceInitialiser_GUI juceInit;

    if (argc > 2 && juce::String (argv[1]) == "render")
        return renderDemos (juce::File (juce::String (argv[2])));

    // ---- 1: transparency at gravity = 0 -------------------------------------
    {
        GravitonProcessor p;
        setParam (p, "gravity", 0.0f);
        setParam (p, "mix", 1.0f);
        setParam (p, "anchor", 20.0f);
        p.prepareToPlay (sr, 512);

        check (p.getLatencySamples() == GravitonProcessor::fftSize, "latency reported as fftSize");

        // measure latency with noise: unlike a sine, its autocorrelation has a
        // single unambiguous peak
        {
            juce::Random rng (7);
            const int M = (int) sr;
            juce::AudioBuffer<float> noise (2, M);
            for (int ch = 0; ch < 2; ++ch)
                for (int i = 0; i < M; ++i)
                    noise.setSample (ch, i, rng.nextFloat() - 0.5f);

            auto noiseOut = run (p, noise);

            int bestLag = -1;
            double bestCorr = -1.0e30;
            for (int lag = 0; lag <= 4096; ++lag)
            {
                double corr = 0.0;
                for (int i = 0; i < 2048; ++i)
                    corr += (double) noise.getSample (0, 8192 + i) * noiseOut.getSample (0, 8192 + i + lag);
                if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
            }
            std::printf ("       measured latency: %d samples (reported %d)\n", bestLag, p.getLatencySamples());
            check (std::abs (bestLag - p.getLatencySamples()) <= 1, "measured latency matches reported");
        }

        p.prepareToPlay (sr, 512);   // reset state after the noise run

        const int N = (int) sr * 2;
        auto in  = makeSine (sr, N, 440.0f, 0.5f);
        auto out = run (p, in);

        const float rIn  = rms (in,  N / 2, 22050);
        const float rOut = rms (out, N / 2, 22050);
        const float dB = 20.0f * std::log10 (rOut / rIn);
        std::printf ("       reconstruction gain: %+.3f dB\n", dB);
        check (std::abs (dB) < 0.5f, "unity-gain reconstruction at gravity=0 (within 0.5 dB)");

        const float f = zeroCrossFreq (out, sr, N / 2, 22050);
        std::printf ("       output frequency: %.1f Hz\n", f);
        check (std::abs (f - 440.0f) < 5.0f, "sine frequency preserved at gravity=0");
    }

    // ---- 2: gravity actually pulls partials together -------------------------
    {
        GravitonProcessor p;
        setParam (p, "gravity", 1.0f);
        setParam (p, "mass", 0.6f);
        setParam (p, "orbit", 0.1f);      // overdamped: pure infall, no orbiting
        setParam (p, "restore", 0.0f);    // nothing pulls particles home
        setParam (p, "anchor", 20.0f);
        setParam (p, "mix", 1.0f);
        p.prepareToPlay (sr, 512);

        // loud star at 500 Hz + quiet test partial at 900 Hz
        const int N = (int) sr * 3;
        juce::AudioBuffer<float> in (2, N);
        for (int i = 0; i < N; ++i)
        {
            const float t = (float) i / (float) sr;
            const float v = 0.5f  * std::sin (juce::MathConstants<float>::twoPi * 500.0f * t)
                          + 0.05f * std::sin (juce::MathConstants<float>::twoPi * 900.0f * t);
            in.setSample (0, i, v);
            in.setSample (1, i, v);
        }
        auto out = run (p, in);

        // after 2.5 s, energy near 900 Hz should have migrated toward 500 Hz
        juce::dsp::FFT fft (12);
        const int W = 4096;
        std::vector<float> buf (2 * W, 0.0f);
        for (int i = 0; i < W; ++i)
            buf[(size_t) i] = out.getSample (0, N - W - 100 + i)
                              * (0.5f - 0.5f * std::cos (juce::MathConstants<float>::twoPi * i / (float) W));
        fft.performRealOnlyForwardTransform (buf.data());

        auto bandEnergy = [&] (float lo, float hi)
        {
            const int k0 = (int) (lo * W / sr), k1 = (int) (hi * W / sr);
            double e = 0.0;
            for (int k = k0; k <= k1; ++k)
                e += (double) buf[2 * k] * buf[2 * k] + (double) buf[2 * k + 1] * buf[2 * k + 1];
            return e;
        };

        const double eNear900 = bandEnergy (850.0f, 950.0f);
        const double eNear500 = bandEnergy (450.0f, 550.0f);
        std::printf ("       energy 850-950 Hz vs 450-550 Hz: %.3e / %.3e\n", eNear900, eNear500);
        check (eNear900 < 0.02 * eNear500, "quiet partial captured by the 500 Hz star");
        check (out.getMagnitude (0, 0, N) < 4.0f, "output bounded with full gravity");
    }

    // ---- 3: numerical stability at hostile settings ---------------------------
    {
        GravitonProcessor p;
        setParam (p, "gravity", -1.0f);   // full repulsion
        setParam (p, "mass", 1.0f);
        setParam (p, "orbit", 1.0f);      // maximum inertia
        setParam (p, "restore", 1.0f);
        setParam (p, "anchor", 1000.0f);
        setParam (p, "mix", 1.0f);
        p.prepareToPlay (sr, 512);

        juce::Random rng (42);
        const int N = (int) sr * 3;
        juce::AudioBuffer<float> in (2, N);
        for (int ch = 0; ch < 2; ++ch)
            for (int i = 0; i < N; ++i)
                in.setSample (ch, i, rng.nextFloat() * 1.6f - 0.8f);   // loud noise

        auto out = run (p, in);

        bool finite = true;
        for (int ch = 0; ch < 2 && finite; ++ch)
            for (int i = 0; i < N; ++i)
                if (! std::isfinite (out.getSample (ch, i))) { finite = false; break; }

        check (finite, "output finite under repulsion + max inertia + loud noise");
        check (out.getMagnitude (0, 0, N) < 8.0f, "output bounded under hostile settings");
    }

    std::printf ("\n%s (%d failure%s)\n", failures == 0 ? "ALL TESTS PASSED" : "TESTS FAILED",
                 failures, failures == 1 ? "" : "s");
    return failures == 0 ? 0 : 1;
}
