#include "PluginEditor.h"

namespace
{
    const char* kParamIds[]  = { "gravity", "mass", "orbit", "restore", "anchor", "mix" };
    const char* kParamNames[] = { "GRAVITY", "MASS", "ORBIT", "RESTORE", "ANCHOR", "MIX" };

    const juce::Colour kBg        { 0xff05070f };
    const juce::Colour kPanel     { 0xff0b0e1a };
    const juce::Colour kAccent    { 0xff5ec8ff };
    const juce::Colour kHot       { 0xffff9a3c };
    const juce::Colour kText      { 0xffb8c4d8 };
}

GravitonEditor::GravitonEditor (GravitonProcessor& p)
    : AudioProcessorEditor (p), processor (p)
{
    for (int i = 0; i < numKnobs; ++i)
    {
        auto& k = knobs[i];
        k.slider.setSliderStyle (juce::Slider::RotaryHorizontalVerticalDrag);
        k.slider.setTextBoxStyle (juce::Slider::TextBoxBelow, false, 68, 16);
        k.slider.setColour (juce::Slider::rotarySliderFillColourId, kAccent);
        k.slider.setColour (juce::Slider::rotarySliderOutlineColourId, juce::Colour (0xff1c2338));
        k.slider.setColour (juce::Slider::thumbColourId, kHot);
        k.slider.setColour (juce::Slider::textBoxTextColourId, kText);
        k.slider.setColour (juce::Slider::textBoxOutlineColourId, juce::Colours::transparentBlack);
        addAndMakeVisible (k.slider);

        k.label.setText (kParamNames[i], juce::dontSendNotification);
        k.label.setJustificationType (juce::Justification::centred);
        k.label.setFont (juce::FontOptions (12.0f, juce::Font::bold));
        k.label.setColour (juce::Label::textColourId, kText);
        addAndMakeVisible (k.label);

        k.attach = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment> (
            processor.getState(), kParamIds[i], k.slider);
    }

    setSize (760, 480);
    startTimerHz (30);
}

void GravitonEditor::timerCallback()
{
    processor.copyVizFrame (viz);
    repaint();
}

float GravitonEditor::freqToX (float hz, juce::Rectangle<float> area) const
{
    const float lo = std::log (30.0f);
    const float hi = std::log ((float) viz.sampleRate * 0.5f);
    const float t = (std::log (juce::jmax (hz, 30.0f)) - lo) / (hi - lo);
    return area.getX() + juce::jlimit (0.0f, 1.0f, t) * area.getWidth();
}

void GravitonEditor::paintSpace (juce::Graphics& g, juce::Rectangle<float> area)
{
    g.setColour (kPanel);
    g.fillRoundedRectangle (area, 8.0f);

    const float binHz = (float) viz.sampleRate / (float) GravitonProcessor::fftSize;

    // frequency grid
    g.setColour (juce::Colour (0x14ffffff));
    for (float hz : { 100.0f, 1000.0f, 10000.0f })
    {
        const float x = freqToX (hz, area);
        g.drawVerticalLine ((int) x, area.getY() + 4.0f, area.getBottom() - 4.0f);
    }
    g.setColour (juce::Colour (0x50ffffff));
    g.setFont (juce::FontOptions (10.0f));
    g.drawText ("100", (int) freqToX (100.0f, area) + 3, (int) area.getBottom() - 16, 40, 12,
                juce::Justification::left);
    g.drawText ("1k", (int) freqToX (1000.0f, area) + 3, (int) area.getBottom() - 16, 40, 12,
                juce::Justification::left);
    g.drawText ("10k", (int) freqToX (10000.0f, area) + 3, (int) area.getBottom() - 16, 40, 12,
                juce::Justification::left);

    // particles
    for (int k = 2; k < GravitonProcessor::numBins - 1; k += 1)
    {
        const float m = viz.mag[k];
        if (m < 0.004f)
            continue;

        const float bright = std::pow (m, 0.35f);
        const float homeHz = (float) k * binHz;
        const float nowHz  = viz.pos[k] * binHz;
        const float x0 = freqToX (homeHz, area);
        const float x1 = freqToX (nowHz, area);
        const float y  = area.getBottom() - 20.0f - bright * (area.getHeight() - 44.0f);

        const float disp = juce::jlimit (0.0f, 1.0f, std::abs (viz.pos[k] - (float) k) / 40.0f);

        // tether from home position: shows how far the particle has fallen
        if (std::abs (x1 - x0) > 1.5f)
        {
            g.setColour (kHot.withAlpha (0.10f + 0.15f * disp));
            g.drawLine (x0, y, x1, y, 1.0f);
        }

        g.setColour (kAccent.interpolatedWith (kHot, disp).withAlpha (0.25f + 0.75f * bright));
        const float r = 1.2f + 2.6f * bright;
        g.fillEllipse (x1 - r, y - r, 2.0f * r, 2.0f * r);
    }

    // stars: the current gravity wells
    for (int s = 0; s < viz.numStars; ++s)
    {
        const int k = viz.starBin[s];
        const float m = viz.mag[k];
        const float bright = std::pow (juce::jmax (m, 0.0f), 0.35f);
        const float x = freqToX (viz.pos[k] * binHz, area);
        const float y = area.getBottom() - 20.0f - bright * (area.getHeight() - 44.0f);
        const float r = 5.0f + 6.0f * bright;

        g.setColour (juce::Colours::white.withAlpha (0.08f));
        g.fillEllipse (x - r * 1.8f, y - r * 1.8f, r * 3.6f, r * 3.6f);
        g.setColour (juce::Colours::white.withAlpha (0.85f * bright + 0.1f));
        g.fillEllipse (x - r * 0.45f, y - r * 0.45f, r * 0.9f, r * 0.9f);
    }
}

void GravitonEditor::paint (juce::Graphics& g)
{
    g.fillAll (kBg);

    auto bounds = getLocalBounds().toFloat().reduced (14.0f);

    auto header = bounds.removeFromTop (34.0f);
    g.setColour (juce::Colours::white);
    g.setFont (juce::FontOptions (22.0f, juce::Font::bold));
    g.drawText ("GRAVITON", header.removeFromLeft (200.0f), juce::Justification::centredLeft);
    g.setColour (kText.withAlpha (0.6f));
    g.setFont (juce::FontOptions (12.0f));
    g.drawText ("spectral n-body collapse", header, juce::Justification::centredRight);

    bounds.removeFromBottom (130.0f); // knob strip handled in resized()
    paintSpace (g, bounds.reduced (0.0f, 6.0f));
}

void GravitonEditor::resized()
{
    auto strip = getLocalBounds().reduced (14).removeFromBottom (122);
    const int w = strip.getWidth() / numKnobs;

    for (int i = 0; i < numKnobs; ++i)
    {
        auto cell = strip.removeFromLeft (w).reduced (6, 0);
        knobs[i].label.setBounds (cell.removeFromTop (18));
        knobs[i].slider.setBounds (cell);
    }
}
