cmake_minimum_required(VERSION 3.22)
project(Graviton VERSION 0.1.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_OSX_DEPLOYMENT_TARGET "10.13" CACHE STRING "")

# Path to a JUCE checkout (https://github.com/juce-framework/JUCE, tag 8.0.4)
set(JUCE_PATH "" CACHE PATH "Path to JUCE source tree")
if(NOT JUCE_PATH)
    message(FATAL_ERROR "Pass -DJUCE_PATH=/path/to/JUCE")
endif()
add_subdirectory(${JUCE_PATH} juce EXCLUDE_FROM_ALL)

juce_add_plugin(Graviton
    COMPANY_NAME "DizzyBanjo"
    PLUGIN_MANUFACTURER_CODE Dzbj
    PLUGIN_CODE Grvt
    FORMATS VST3 AU Standalone
    PRODUCT_NAME "Graviton"
    IS_SYNTH FALSE
    NEEDS_MIDI_INPUT FALSE
    NEEDS_MIDI_OUTPUT FALSE
    COPY_PLUGIN_AFTER_BUILD TRUE
    VST3_CATEGORIES Fx Filter
    AU_MAIN_TYPE kAudioUnitType_Effect)

target_sources(Graviton PRIVATE
    src/PluginProcessor.cpp
    src/PluginEditor.cpp)

target_compile_definitions(Graviton PUBLIC
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
    JUCE_VST3_CAN_REPLACE_VST2=0
    JUCE_DISPLAY_SPLASH_SCREEN=0)

target_link_libraries(Graviton
    PRIVATE juce::juce_audio_utils juce::juce_dsp
    PUBLIC juce::juce_recommended_config_flags juce::juce_recommended_warning_flags)

# Offline verification harness: runs signals through the processor and checks
# reconstruction, latency and numerical stability without a host.
juce_add_console_app(GravitonTest PRODUCT_NAME "GravitonTest")
target_sources(GravitonTest PRIVATE
    test/GravitonTest.cpp
    src/PluginProcessor.cpp
    src/PluginEditor.cpp)
target_compile_definitions(GravitonTest PRIVATE
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
    JUCE_STANDALONE_APPLICATION=1
    JUCE_MODAL_LOOPS_PERMITTED=1)
target_link_libraries(GravitonTest
    PRIVATE juce::juce_audio_utils juce::juce_dsp
    PUBLIC juce::juce_recommended_config_flags)
