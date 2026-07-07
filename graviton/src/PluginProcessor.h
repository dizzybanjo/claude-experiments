#pragma once

#include <juce_audio_utils/juce_audio_utils.h>
#include <juce_dsp/juce_dsp.h>

//==============================================================================
// GRAVITON — a self-gravitating spectrum.
//
// Every STFT bin is a particle whose mass is derived from its (smoothed)
// magnitude. Loud partials become "stars"; every particle feels Newtonian
// attraction toward every star, carries velocity between frames, and is
// resynthesised at its displaced frequency with a phase-coherent per-bin
// frequency shift. The spectrum collapses into resonant clusters, orbits,
// or (with negative gravity) blows itself apart. All modulation is emergent
// from the dynamics of the input itself — there is no LFO anywhere.
//==============================================================================

class GravitonProcessor : public juce::AudioProcessor
{
public:
    static constexpr int fftOrder = 11;
    static constexpr int fftSize  = 1 << fftOrder;      // 2048
    static constexpr int hopSize  = fftSize / 4;        // 512
    static constexpr int numBins  = fftSize / 2 + 1;    // 1025
    static constexpr int maxStars = 24;

    // Snapshot of the particle system for the editor's visualiser.
    struct VizFrame
    {
        float  pos [numBins] {};   // current position of each particle, in bins
        float  mag [numBins] {};   // normalised mass 0..1
        int    starBin [maxStars] {};
        int    numStars = 0;
        double sampleRate = 44100.0;
    };

    GravitonProcessor();
    ~GravitonProcessor() override = default;

    //==========================================================================
    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override {}
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    //==========================================================================
    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override                        { return true; }
    const juce::String getName() const override            { return "Graviton"; }
    bool acceptsMidi() const override                      { return false; }
    bool producesMidi() const override                     { return false; }
    bool isMidiEffect() const override                     { return false; }
    double getTailLengthSeconds() const override           { return 0.1; }

    int getNumPrograms() override                          { return 1; }
    int getCurrentProgram() override                       { return 0; }
    void setCurrentProgram (int) override                  {}
    const juce::String getProgramName (int) override       { return {}; }
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock&) override;
    void setStateInformation (const void*, int) override;

    //==========================================================================
    juce::AudioProcessorValueTreeState& getState()         { return apvts; }

    // Editor calls this from its timer; returns false if the audio thread
    // was mid-write and the previous frame should be kept.
    bool copyVizFrame (VizFrame& dest);

private:
    void processFrame (int numChannels);

    juce::AudioProcessorValueTreeState apvts;

    juce::dsp::FFT fft { fftOrder };
    std::array<float, fftSize> window {};

    // Streaming STFT state
    float inputFifo  [2][fftSize] {};
    float outputFifo [2][fftSize] {};
    float fftData    [2][2 * fftSize] {};
    float outSpec    [2][2 * fftSize] {};
    int   fifoPos = 0;
    int   hopCounter = 0;

    // Dry path, delayed to stay aligned with the wet path
    std::vector<float> dryDelay[2];
    int dryPos = 0;

    // Particle system (shared across channels so stereo stays coherent)
    float pos      [numBins] {};
    float vel      [numBins] {};
    float massSm   [numBins] {};
    float weight   [numBins] {};
    float phaseOff [numBins] {};

    double currentSampleRate = 44100.0;
    float  energyGain = 1.0f;

    // Visualiser exchange
    juce::SpinLock vizLock;
    VizFrame vizFrame;

    // Cached parameter pointers
    std::atomic<float>* pGravity = nullptr;
    std::atomic<float>* pMass    = nullptr;
    std::atomic<float>* pOrbit   = nullptr;
    std::atomic<float>* pRestore = nullptr;
    std::atomic<float>* pAnchor  = nullptr;
    std::atomic<float>* pMix     = nullptr;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (GravitonProcessor)
};
