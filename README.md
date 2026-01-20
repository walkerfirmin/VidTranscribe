# VidTranscribe

A small Node.js CLI (Commander) that:
- Takes a path to a video file
- Lists audio tracks in the video
- Extracts a chosen audio track to an audio file using `ffmpeg`
- Transcribes an audio file using Whisper (OpenAI Whisper API)


## Prereqs

- Node.js >= 18
- Python >= 3.8 (for local Whisper/MLX workflows)
- `ffmpeg` + `ffprobe` installed (macOS: `brew install ffmpeg`)
- For OpenAI transcription: set `OPENAI_API_KEY`

### Python dependencies (for local Whisper/MLX)

If you want to use local Whisper/MLX (e.g., `mlx_whisper`), set up a Python virtual environment and install dependencies:

```bash
# Create and activate a virtual environment (recommended)
python3 -m venv .venv
source .venv/bin/activate

# Upgrade pip and install requirements
pip install --upgrade pip
pip install mlx-whisper
# Or, for other local Whisper tools, install as needed
# pip install openai-whisper
```

If you use a system-wide Python, you may need to use `pip3` instead of `pip`.

## Install

```bash
npm install
npm link
```

## Usage

### List audio tracks

```bash
vidtranscribe tracks /path/to/video.mp4
```

### Extract an audio track

```bash
# track is the 0-based audio track index shown by `tracks`
vidtranscribe extract /path/to/video.mp4 --track 0 --out audio.wav
```

### Extract multiple tracks + auto-transcribe

```bash
# Extract tracks 0 and 2 to ./out, then transcribe each
vidtranscribe extract /path/to/video.mp4 --tracks 0,2 --out-dir ./out --transcribe --engine mlx

# Same, but using OpenAI Whisper (writes .txt transcripts)
export OPENAI_API_KEY=...
vidtranscribe extract /path/to/video.mp4 --tracks 0,2 --out-dir ./out --transcribe --engine openai --language en
```

### Batch: create subtitles for all tracks

Creates subtitles for every audio track in one or more videos using the local `mlx_whisper` engine.

For each input video, output is written to a folder created next to the video file, named after the video filename without its extension.

```bash
# Writes .srt files into: /path/to/The Simpsons_S33E19_Marge the Meanie/
vidtranscribe batch "/path/to/The Simpsons_S33E19_Marge the Meanie.mp4"

# Process multiple videos
vidtranscribe batch /path/to/ep1.mp4 /path/to/ep2.mp4

# If provided, --language is used for transcription AND appended to the subtitle filename
vidtranscribe batch /path/to/video.mp4 --language en
```

Note: `mlx_whisper` supports a fixed set of Whisper language codes/names (mostly 2-letter codes). Run `mlx_whisper --help` and check the `--language { ... }` list.

### Transcribe an audio file

```bash
export OPENAI_API_KEY=... 
vidtranscribe transcribe ./audio.wav --out transcript.txt
```

### Transcribe with mlx_whisper (local)

Requires `mlx_whisper` on your PATH.

```bash
# Writes an SRT next to the audio by default
vidtranscribe transcribe ./audio.wav --engine mlx

# Or choose output path (will still write .srt)
vidtranscribe transcribe ./audio.wav --engine mlx --out ./subs/my_subs.srt
```

## Notes

- `extract` defaults to producing a mono 16kHz WAV suitable for Whisper.
- If you prefer, you can extract to AAC/M4A: `--format m4a`.
