# GRAVITON — spectral n-body collapse

A VST3/AU audio effect in which the spectrum of your sound is a **self-gravitating
n-body system**.

## The idea

Every STFT bin is a particle. Its **mass** is derived from its smoothed magnitude —
loud partials are heavy. The heaviest local maxima become **stars**, and every
particle feels Newtonian attraction toward every star:

```
a_k = Σ_s  G · M_s · d / (d² + ε)^{3/2}        d = pos_s − pos_k
```

Particles carry **velocity between frames**, so quiet partials don't just get
filtered — they *fall*. They accelerate toward loud partials, overshoot, orbit,
get captured, or slingshot away. Each particle's energy is resynthesised at its
current position using a per-bin phase-coherent frequency shift
(`Δφ_k += 2π·hop·(pos_k − k)/N`), which makes the chain **bit-transparent when
gravity is zero** and glissando-smooth when it isn't.

There is no LFO anywhere in the plugin. All modulation is emergent: the wobble,
the sidebands, the glissandi are the orbital mechanics of your own sound. A
sustained chord slowly collapses into its loudest partial like a star system
falling into a black hole. Negative gravity blows the spectrum apart — every
loud partial repels the energy around it.

## Parameters

| Knob | What it does physically |
|---|---|
| **GRAVITY** | Signed gravitational constant. Positive = collapse, negative = explosion. |
| **MASS** | Exponent on the magnitude→mass curve. High values make loud partials utterly dominant (winner-takes-all black holes). |
| **ORBIT** | Inertia/damping. Low = overdamped infall (smooth pitch-drag). High = particles keep their momentum and orbit the stars (emergent, signal-derived vibrato and sidebands). |
| **RESTORE** | Spring pulling every particle back to its home frequency. Sets whether capture is temporary (elastic wobble) or permanent (full collapse / drone-ification at 0). |
| **ANCHOR** | Frequencies below this are exempt from gravity — keeps your low end intact. |
| **MIX** | Dry/wet. Dry path is latency-compensated. |

The UI shows the particle system live: cyan dots are resting partials, they turn
orange as they're displaced, white glows are the current stars, and the faint
tethers show how far each particle has fallen from home.

## Build

Requires macOS command-line tools, CMake ≥ 3.22, and a JUCE 8 checkout:

```sh
git clone --depth 1 --branch 8.0.4 https://github.com/juce-framework/JUCE.git /tmp/juce
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DJUCE_PATH=/tmp/juce
cmake --build build --target Graviton_VST3 Graviton_AU Graviton_Standalone -j 8
```

Built plugins are copied to `~/Library/Audio/Plug-Ins/{VST3,Components}`
automatically.

## Verification

`GravitonTest` is an offline harness that runs signals through the processor
without a host and asserts:

- unity-gain reconstruction and exact 2048-sample latency at gravity = 0
- that a quiet 900 Hz partial is actually captured by a loud 500 Hz star
  (its band energy falls below 2% of the star's — measured: ~0.00004%)
- finite, bounded output under full repulsion + max inertia + loud noise

```sh
cmake --build build --target GravitonTest && ./build/GravitonTest_artefacts/Release/GravitonTest
```

## DSP notes

- STFT: 2048-point FFT, 512 hop, Hann/Hann, 75% overlap (COLA-normalised).
- The n-body step runs per hop over ~1k particles × ≤24 stars — negligible CPU.
- Particle state is shared between channels so stereo imaging stays coherent.
- Latency: 2048 samples, reported to the host; the dry path is delay-matched.
