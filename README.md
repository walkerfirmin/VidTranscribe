# VidTranscribe

A small Node.js CLI (Commander) that:
- Takes a path to a video file
- Lists audio tracks in the video
- Extracts a chosen audio track to an audio file using `ffmpeg`
- Transcribes an audio file using Whisper (OpenAI Whisper API)

## Prereqs

- Node.js >= 18
- `ffmpeg` + `ffprobe` installed (macOS: `brew install ffmpeg`)
- For transcription: set `OPENAI_API_KEY`

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
