# audiolength

A Pure Data abstraction that looks up the duration of an audio file by filename and returns it in milliseconds.

## Files

- `test_audio/audiolength.pd` — the main Pd abstraction
- `index_audio.py` — Python script that scans an audio folder and generates `audio_lengths.txt`
- `test.pd` — example patch demonstrating usage

## Setup

### 1. Generate the index file

Run the Python script on your folder of audio files:

```bash
python3 index_audio.py /path/to/your/audio/folder
```

This scans for `.wav`, `.aif`, `.aiff`, `.flac`, `.ogg`, and `.mp3` files and writes `audio_lengths.txt` into the same folder. Each line is formatted as:

```
1 filename.wav 10500.0;
2 filename.aif 2000.0;
```

**Requirements:**

```bash
pip install soundfile mutagen
```

### 2. Place the abstraction

Copy `audiolength.pd` into your audio folder (next to `audio_lengths.txt`), or put it somewhere on your Pd search path.

### 3. Use in Pure Data

In your patch, declare the path to your audio folder and use `audiolength` as an object:

```
[declare -path /path/to/audio/folder]

[symbol filename(
|
[audiolength]
|
[floatatom]   <- duration in milliseconds
```

Send the filename (without path) as a symbol to the inlet. The outlet returns the duration in milliseconds as a float.

## Notes

- The abstraction loads `audio_lengths.txt` automatically on patch load via `loadbang`.
- Re-run `index_audio.py` any time you add or remove files from the folder, then reload your patch.
- Filenames are case-sensitive.
