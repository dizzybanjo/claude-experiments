#!/usr/bin/env python3
"""
index_audio.py — scans a directory for audio files and writes a coll-formatted
index of durations in milliseconds, saved as audio_lengths.txt next to the audio files.

Usage:
    python3 index_audio.py /path/to/audio/folder

Requires:
    pip install mutagen soundfile
"""

import sys
import os
import soundfile as sf

SUPPORTED_EXTS = {".wav", ".aif", ".aiff", ".flac", ".ogg", ".mp3"}


def get_duration_ms(filepath):
    ext = os.path.splitext(filepath)[1].lower()
    if ext == ".mp3":
        from mutagen.mp3 import MP3
        audio = MP3(filepath)
        return audio.info.length * 1000.0
    else:
        info = sf.info(filepath)
        return (info.frames / info.samplerate) * 1000.0


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 index_audio.py /path/to/audio/folder")
        sys.exit(1)

    folder = sys.argv[1]
    if not os.path.isdir(folder):
        print(f"Error: '{folder}' is not a directory.")
        sys.exit(1)

    entries = []
    errors = []

    for fname in sorted(os.listdir(folder)):
        ext = os.path.splitext(fname)[1].lower()
        if ext not in SUPPORTED_EXTS:
            continue
        fpath = os.path.join(folder, fname)
        try:
            ms = get_duration_ms(fpath)
            entries.append((fname, round(ms, 3)))
        except Exception as e:
            errors.append((fname, str(e)))

    out_path = os.path.join(folder, "audio_lengths.txt")
    with open(out_path, "w") as f:
        for i, (fname, ms) in enumerate(entries, start=1):
            # Pd [coll] format: id filename duration;
            f.write(f"{i} {fname} {ms};\n")

    print(f"Indexed {len(entries)} file(s) → {out_path}")
    if errors:
        print("Errors:")
        for fname, err in errors:
            print(f"  {fname}: {err}")


if __name__ == "__main__":
    main()
