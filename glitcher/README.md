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
| B4SSL1N3 | squelchy acid bassline generator — scale-degree walk (root-heavy) of long sawtooth notes (2–4.5 steps) through a high-resonance lowpass that snaps open and squelches shut, sub-octave layer, occasional slides; always in key, never beat-repeated |
| P4D | pad generator — tertian chord stacks (triad + optional 7th/9th) from the mode, detuned dual oscillators per note, slow attack, heavy reverb send |
| B34T R3P34T | beat-repeat amount: slices of the pattern get echoed forward as plain repeats, pitched (rising/diving) repeats, or halving-length rolls |
| K1CK | kick-drum amount — pitch-drop sine kicks on the quarter-note grid (never jittered, never beat-repeated) to keep the pulse legible |
| 3V0LV3 ∞ | reseeds and regenerates the pattern at every loop boundary — endless mutation |
| V01C3 M4TR1X | per-voice LVL (level ×0–2), PIT (pitch ×0.25–4), DEC (decay/time ×0.25–4), WGT (probability weight ×0–3) for all 16 voices; LVL/PIT/DEC apply instantly, WGT regenerates; double-click any slider to reset |
| F1LT3R CH40S | stereo pair of resonant lowpass filters on the master bus; seeded jumps locked to pattern-event positions yank each channel's cutoff (120 Hz–9 kHz, Q 3–16) then glide it back open — snap cuts and dive-sweeps, L/R/both |
| R3V3RB S3ND | random per-event sends to a dark digital reverb (2.8 s damped noise-tail convolution — HF decays faster than lows, lowpassed return) |
| P1NG-P0NG S3ND | random per-event sends to a tempo-synced ping-pong delay (dotted-eighth hops, hard-panned, dark filtered cross-feedback) |
| T4P3 S4T | tape saturation — gentle compensated tanh plus head-rolloff lowpass (13 kHz→7 kHz) |
| H1-SH3LF CUT | high-shelf at 4.5 kHz, 0 to −24 dB — tames the harsh top end |
| M4ST3R V0L | output level after the entire mastering chain (post-limiter, defaults 40%) — scales volume without changing the tone; capped at unity so output still can't exceed full scale |
| SAMPLE RATE | 44.1 kHz or 48 kHz (live + export) |
| EXPORT WAV | offline-renders the sequence to stereo 16-bit PCM WAV |

Keyboard: `SPACE` play/stop · `G` generate · `E` export.

## Spectral smear

Two always-on spectral smearing units sit on dedicated buses — one on
the pads, one on the drum/percussion bus. Each splits its input into
six narrow ringing bandpass bands feeding modulated feedback delays,
panned across the field; slow inharmonic LFOs wobble each band's delay
time (pitch/time smear), and seeded pattern-locked jumps snap band
frequency, delay time and feedback to new values as the sequence runs.
Smear returns re-enter the master inside the safety stages, and all
jumps come from the pattern seed, so exports match playback.

## Audio safety

Master chain: gain → chaos LPF pair (L/R) →
tape saturation (compensated tanh + rolloff) → high shelf →
safety compressor (20:1, −6 dB threshold, 2 ms attack) →
unity-gain tanh soft-clip (soft ceiling ≈ 0.7) → brickwall clamp at
±0.97 (≈ −0.26 dBFS), 4× oversampled → master volume (capped at unity).
The saturation stage is loudness-compensated so adding it changes
character, not level.
Reverb and delay returns re-enter at the tape stage — inside the
safety stages, so no setting can push the output past full scale.
Nothing reaching your ears or the WAV file can exceed full scale.

## Export

WAV files are rendered offline (OfflineAudioContext) from the same event list
the live player uses, so what you export is exactly what you heard.
Filename encodes seed, BPM and sample rate: `6117ch3r_<SEED>_<BPM>bpm_<SR>k.wav`.
