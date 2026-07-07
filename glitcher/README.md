# 6117CH3R

Stochastic glitch sequence synthesizer.
Pure Web Audio, zero dependencies. Open `index.html` in any modern browser.

## What it does

Generates seeded, deterministic glitch sequences from sixteen synthesized
voice types (kick drum, bassline, pad chords, clicks, sine blips, filtered
noise, hiss, sub drops, filter dives, FM metal, stutter ratchets, crackle,
bitcrush tones, tape-stop plunges, databend buffer corruption, overdriven
grind). The sound design leans IDM — sine and filtered-noise percussion,
inharmonic FM, buffer corruption — rather than chip/console square waves,
with the top end kept dark and controlled. Percussion voices are weighted
by four palettes:

- **V01D** — minimal clicks, sine blips, crackle, subs
- **4C1D** — subs, filter dives, acid stutters, FM hits, grind
- **M3T4L** — FM metal, bitcrush, granular stutter, noise, databend
- **D4T4** — databend, tape stops, crush, stutter — maximum mosh

## Controls

| Control | Function |
| --- | --- |
| GENERATE | new random seed → new sequence |
| SEED | hex seed, editable — same seed + params = identical audio |
| BPM | 20–999 |
| BARS | 1 / 2 / 4 / 8 (16 steps per bar) |
| DENSITY | event probability per step |
| CHAOS | timing jitter, ratchets, param extremes, doubled hits |
| K3Y / M0D3 | tonal center for bass + pads: 12 keys × 8 modes (the 7 church modes + harmonic minor) |
| B4SSL1N3 | acid-style bassline generator — scale-degree walk (root-heavy) with resonant filter plucks, sub-octave layer, and occasional slides; always in key, never beat-repeated |
| P4D | pad generator — tertian chord stacks (triad + optional 7th/9th) from the mode, detuned dual oscillators per note, slow attack, heavy reverb send |
| B34T R3P34T | beat-repeat amount: slices of the pattern get echoed forward as plain repeats, pitched (rising/diving) repeats, or halving-length rolls |
| DR1V3 | master-bus distortion (level-compensated tanh stage, pre-limiter; live control, also baked into exports) |
| K1CK | kick-drum amount — pitch-drop sine kicks on the quarter-note grid (never jittered, never beat-repeated) to keep the pulse legible |
| 3V0LV3 ∞ | reseeds and regenerates the pattern at every loop boundary — endless mutation |
| V01C3 M4TR1X | per-voice LVL (level ×0–2), PIT (pitch ×0.25–4), DEC (decay/time ×0.25–4), WGT (probability weight ×0–3) for all 16 voices; LVL/PIT/DEC apply instantly, WGT regenerates; double-click any slider to reset |
| F1LT3R CH40S | stereo pair of resonant lowpass filters on the master bus; seeded jumps locked to pattern-event positions yank each channel's cutoff (120 Hz–9 kHz, Q 3–16) then glide it back open — snap cuts and dive-sweeps, L/R/both |
| R3V3RB S3ND | random per-event sends to a dark digital reverb (2.8 s damped noise-tail convolution — HF decays faster than lows, lowpassed return) |
| P1NG-P0NG S3ND | random per-event sends to a tempo-synced ping-pong delay (dotted-eighth hops, hard-panned, dark filtered cross-feedback) |
| BUS C0MP | master glue compressor (4:1, 10 ms/150 ms) — amount deepens threshold −2→−24 dB with auto makeup |
| T4P3 S4T | tape saturation — gentle compensated tanh plus head-rolloff lowpass (13 kHz→7 kHz) |
| H1-SH3LF CUT | high-shelf at 4.5 kHz, 0 to −24 dB — tames the harsh top end |
| SAMPLE RATE | 44.1 kHz or 48 kHz (live + export) |
| EXPORT WAV | offline-renders the sequence to stereo 16-bit PCM WAV |

Keyboard: `SPACE` play/stop · `G` generate · `E` export.

## Audio safety

Master chain: gain → drive (compensated tanh) → chaos LPF pair (L/R) →
glue compressor (4:1) → tape saturation (compensated tanh + rolloff) →
high shelf → safety compressor (20:1, −6 dB threshold, 2 ms attack) →
tanh soft-clip → brickwall clamp at ±0.97 (≈ −0.26 dBFS), 4× oversampled.
Reverb and delay returns re-enter at the glue compressor — inside the
safety stages, so no setting can push the output past full scale.
Nothing reaching your ears or the WAV file can exceed full scale.

## Export

WAV files are rendered offline (OfflineAudioContext) from the same event list
the live player uses, so what you export is exactly what you heard.
Filename encodes seed, BPM and sample rate: `6117ch3r_<SEED>_<BPM>bpm_<SR>k.wav`.
