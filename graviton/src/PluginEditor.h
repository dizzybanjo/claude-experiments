#pragma once

#include "PluginProcessor.h"

class GravitonEditor : public juce::AudioProcessorEditor,
                       private juce::Timer
{
public:
    explicit GravitonEditor (GravitonProcessor&);
    ~GravitonEditor() override = default;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    void timerCallback() override;
    void paintSpace (juce::Graphics&, juce::Rectangle<float> area);
    float freqToX (float hz, juce::Rectangle<float> area) const;

    GravitonProcessor& processor;
    GravitonProcessor::VizFrame viz;

    struct Knob
    {
        juce::Slider slider;
        juce::Label  label;
        std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment> attach;
    };
    static constexpr int numKnobs = 6;
    Knob knobs[numKnobs];

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (GravitonEditor)
};
