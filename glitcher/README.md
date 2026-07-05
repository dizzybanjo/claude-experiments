# 6117CH3R

Stochastic glitch sequence synthesizer — Aphex Twin / Autechre / Ryoji Ikeda inspired.
Pure Web Audio, zero dependencies. Open `index.html` in any modern browser.

## What it does

Generates seeded, deterministic glitch percussion sequences from fourteen
synthesized voice types (clicks, sine blips, filtered noise, hiss, sub drops,
zaps, FM metal, stutter ratchets, vinyl crackle, bitcrush tones, tape-stop
plunges, databend buffer corruption, modem FSK chatter, overdriven grind),
weighted by four palettes:

- **V01D** — minimal high-sine blips, clicks, crackle, subs
- **4C1D** — subs, zaps, acid stutters, FM hits, grind
- **M3T4L** — FM metal, bitcrush, granular stutter, noise, databend
- **D4T4** — databend, modem chatter, tape stops, crush — maximum mosh

## Controls

| Control | Function |
| --- | --- |
| GENERATE | new random seed → new sequence |
| SEED | hex seed, editable — same seed + params = identical audio |
| BPM | 20–999 |
| BARS | 1 / 2 / 4 / 8 (16 steps per bar) |
| DENSITY | event probability per step |
| CHAOS | timing jitter, ratchets, param extremes, doubled hits |
| B34T R3P34T | beat-repeat amount: slices of the pattern get echoed forward as plain repeats, pitched (rising/diving) repeats, or halving-length rolls |
| DR1V3 | master-bus distortion (level-compensated tanh stage, pre-limiter; live control, also baked into exports) |
| SAMPLE RATE | 44.1 kHz or 48 kHz (live + export) |
| EXPORT WAV | offline-renders the sequence to stereo 16-bit PCM WAV |

Keyboard: `SPACE` play/stop · `G` generate · `E` export.

## Audio safety

Master chain: gain → drive (compensated tanh) → compressor (20:1, −6 dB
threshold, 2 ms attack) → tanh soft-clip → brickwall clamp at ±0.97
(≈ −0.26 dBFS), 4× oversampled.
Nothing reaching your ears or the WAV file can exceed full scale.

## Export

WAV files are rendered offline (OfflineAudioContext) from the same event list
the live player uses, so what you export is exactly what you heard.
Filename encodes seed, BPM and sample rate: `6117ch3r_<SEED>_<BPM>bpm_<SR>k.wav`.
