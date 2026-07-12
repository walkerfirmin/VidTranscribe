import fs from 'node:fs';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { Command } from 'commander';
import OpenAI from 'openai';

const execFileAsync = promisify(execFile);

async function assertFileExists(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
  } catch {
    throw new Error(`File not found or not readable: ${filePath}`);
  }
}

async function assertCommandExists(command) {
  try {
    await execFileAsync('/bin/bash', ['-lc', `command -v ${command} >/dev/null 2>&1`]);
  } catch {
    throw new Error(`Required command not found on PATH: ${command}`);
  }
}

function deriveMlxOutput({ audioPath, outPath }) {
  if (outPath) {
    const dir = path.dirname(outPath);
    const base = path.basename(outPath, path.extname(outPath));
    return { outputDir: dir, outputName: base, expectedSrtPath: path.join(dir, `${base}.srt`) };
  }

  const dir = path.dirname(audioPath);
  const base = path.basename(audioPath, path.extname(audioPath));
  return { outputDir: dir, outputName: base, expectedSrtPath: path.join(dir, `${base}.srt`) };
}

async function getAudioTracks(videoPath) {
  await assertCommandExists('ffprobe');

  const args = [
    '-v',
    'error',
    '-select_streams',
    'a',
    '-show_entries',
    'stream=index,codec_name,channels,channel_layout:stream_tags=language,title',
    '-of',
    'json',
    videoPath,
  ];

  const { stdout } = await execFileAsync('ffprobe', args);
  const parsed = JSON.parse(stdout);
  const streams = Array.isArray(parsed?.streams) ? parsed.streams : [];

  return streams.map((s, audioIndex) => {
    const tags = s?.tags ?? {};
    return {
      audioIndex,
      streamIndex: s?.index,
      codec: s?.codec_name,
      channels: s?.channels,
      channelLayout: s?.channel_layout,
      language: tags?.language,
      title: tags?.title,
    };
  });
}

function defaultExtractOutputPath(videoPath, audioIndex, format) {
  const dir = path.dirname(videoPath);
  const base = path.basename(videoPath, path.extname(videoPath));
  return path.join(dir, `${base}.a${audioIndex}.${format}`);
}

function safeLangTag(value) {
  const lang = String(value ?? '').trim();
  if (!lang) return 'und';
  return lang.replace(/[^A-Za-z0-9-]+/g, '_');
}

function defaultExtractOutputPathInDir({ videoPath, audioIndex, lang, format, outDir }) {
  const base = path.basename(videoPath, path.extname(videoPath));
  const safeLang = safeLangTag(lang);
  return path.join(outDir, `${base}.a${audioIndex}.${safeLang}.${format}`);
}

function parseTracksList(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('Invalid --tracks value. Example: --tracks 0,2,3');
  }

  const parts = value
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const indices = parts.map((p) => Number(p));
  for (const [i, n] of indices.entries()) {
    if (!Number.isInteger(n) || n < 0) {
      throw new Error(`Invalid track index at position ${i + 1}: ${parts[i]}`);
    }
  }

  return [...new Set(indices)];
}

function deriveTranscriptPath({ engine, outDir, videoPath, audioIndex, lang }) {
  const base = path.basename(videoPath, path.extname(videoPath));
  const ext = engine === 'mlx' ? 'srt' : 'txt';
  const safeLang = safeLangTag(lang);
  return path.join(outDir, `${base}.a${audioIndex}.${safeLang}.${ext}`);
}

async function extractAudio({ videoPath, audioIndex, outPath, format }) {
  await assertCommandExists('ffmpeg');

  const outputFormat = (format ?? 'wav').toLowerCase();

  if (outputFormat !== 'wav' && outputFormat !== 'm4a') {
    throw new Error(`Unsupported format: ${format}. Use wav or m4a.`);
  }

  const finalOut = outPath ?? defaultExtractOutputPath(videoPath, audioIndex, outputFormat);

  const args = ['-y', '-i', videoPath, '-map', `0:a:${audioIndex}`, '-vn'];

  if (outputFormat === 'wav') {
    args.push('-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1');
  } else {
    args.push('-c:a', 'aac');
  }

  args.push(finalOut);

  await execFileAsync('ffmpeg', args);
  return finalOut;
}

async function transcribeWithWhisperOpenAI({ audioPath, outPath, language, prompt, verbose = false }) {
  if (verbose) {
    process.stderr.write(`[vidtranscribe] Selected engine: openai\n`);
    process.stderr.write(`[vidtranscribe] Checking if OPENAI_API_KEY is set...\n`);
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set. Set it to use Whisper transcription.');
  }

  if (verbose) {
    process.stderr.write(`[vidtranscribe] Reading audio file: ${audioPath}\n`);
  }
  const client = new OpenAI({ apiKey });

  if (verbose) {
    process.stderr.write(`[vidtranscribe] Sending transcription request to OpenAI (model: whisper-1)...\n`);
    if (language) process.stderr.write(`[vidtranscribe] Language hint: ${language}\n`);
    if (prompt) process.stderr.write(`[vidtranscribe] Prompt hint: ${prompt}\n`);
  }

  const response = await client.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: 'whisper-1',
    response_format: 'text',
    ...(language ? { language } : {}),
    ...(prompt ? { prompt } : {}),
  });

  const text = typeof response === 'string' ? response : String(response);

  if (outPath) {
    if (verbose) {
      process.stderr.write(`[vidtranscribe] Writing transcript text to file: ${outPath}\n`);
    }
    await fs.promises.writeFile(outPath, text, 'utf8');
  } else {
    if (verbose) {
      process.stderr.write(`[vidtranscribe] Writing transcript text to stdout...\n`);
    }
    process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
  }

  if (verbose) {
    process.stderr.write(`[vidtranscribe] Transcription complete.\n`);
  }

  return text;
}

async function transcribeWithMlxWhisper({ audioPath, outPath, language, prompt, verbose = false }) {
  if (verbose) {
    process.stderr.write(`[vidtranscribe] Selected engine: mlx\n`);
    process.stderr.write(`[vidtranscribe] Checking if mlx_whisper command is available...\n`);
  }
  await assertCommandExists('mlx_whisper');

  const { outputDir, outputName, expectedSrtPath } = deriveMlxOutput({
    audioPath,
    outPath,
  });

  if (verbose) {
    process.stderr.write(`[vidtranscribe] Deriving MLX output settings...\n`);
    process.stderr.write(`[vidtranscribe] Output directory: ${outputDir}\n`);
    process.stderr.write(`[vidtranscribe] Output name: ${outputName}\n`);
    process.stderr.write(`[vidtranscribe] Expected SRT path: ${expectedSrtPath}\n`);
  }

  const args = [
    audioPath,
    '--model',
    'mlx-community/whisper-large-v3-mlx',
    '--task',
    'transcribe',
    ...(language ? ['--language', String(language)] : []),
    '--temperature',
    '0',
    '--verbose',
    'True',
    ...(prompt ? ['--initial-prompt', String(prompt)] : []),
    '--condition-on-previous-text',
    'False',
    '--compression-ratio-threshold',
    '2.0',
    '--logprob-threshold',
    '-0.7',
    '--fp16',
    'True',
    '--output-format',
    'srt',
    '--output-dir',
    outputDir,
    '--output-name',
    outputName,
  ];

  if (verbose) {
    process.stderr.write(`[vidtranscribe] Running mlx_whisper command...\n`);
    process.stderr.write(`[vidtranscribe] Command arguments: mlx_whisper ${args.join(' ')}\n`);
    
    await new Promise((resolve, reject) => {
      const child = spawn('mlx_whisper', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      child.stdout.on('data', (data) => {
        process.stderr.write(data);
      });
      child.stderr.on('data', (data) => {
        process.stderr.write(data);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`mlx_whisper failed with exit code ${code}`));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  } else {
    await execFileAsync('mlx_whisper', args);
  }

  if (verbose) {
    process.stderr.write(`[vidtranscribe] Transcription complete.\n`);
  }

  return expectedSrtPath;
}

function printTracks(tracks) {
  if (tracks.length === 0) {
    process.stdout.write('No audio tracks found.\n');
    return;
  }

  for (const t of tracks) {
    const parts = [
      `track=${t.audioIndex}`,
      `stream=${t.streamIndex}`,
      t.codec ? `codec=${t.codec}` : null,
      t.channels ? `channels=${t.channels}` : null,
      t.channelLayout ? `layout=${t.channelLayout}` : null,
      t.language ? `lang=${t.language}` : null,
      t.title ? `title=${t.title}` : null,
    ].filter(Boolean);

    process.stdout.write(`${parts.join(' | ')}\n`);
  }
}

export async function main(argv) {
  const program = new Command();

  program
    .name('vidtranscribe')
    .description('List/extract multi-track audio from video and transcribe with Whisper.')
    .version('0.1.0');

  program
    .command('tracks')
    .description('List audio tracks in a video file')
    .argument('<video>', 'path to video file')
    .action(async (video) => {
      await assertFileExists(video);
      const tracks = await getAudioTracks(video);
      printTracks(tracks);
    });

  program
    .command('batch')
    .description(
      'Create subtitles (.srt) for all audio tracks in one or more video files (mlx engine). Writes to a sibling folder named after the video.'
    )
    .argument('<videos...>', 'one or more video file paths')
    .option('--format <wav|m4a>', 'intermediate extracted audio format', 'wav')
    .option('--language <code>', 'Language code for mlx_whisper (e.g., en). See `mlx_whisper --help` for supported values.')
    .option('--prompt <text>', 'optional prompt to guide transcription')
    .action(async (videos, options) => {
      const format = String(options.format ?? 'wav').toLowerCase();
      if (format !== 'wav' && format !== 'm4a') {
        throw new Error(`Unsupported format: ${options.format}. Use wav or m4a.`);
      }

      for (const inputVideo of videos) {
        const video = path.resolve(String(inputVideo));
        await assertFileExists(video);

        const outDir = path.join(path.dirname(video), path.basename(video, path.extname(video)));
        await fs.promises.mkdir(outDir, { recursive: true });

        const tracks = await getAudioTracks(video);
        if (tracks.length === 0) {
          process.stdout.write(`${video}: no audio tracks found\n`);
          continue;
        }

        for (const t of tracks) {
          const audioIndex = t.audioIndex;
          const lang = t.language;

          const audioOutPath = defaultExtractOutputPathInDir({
            videoPath: video,
            audioIndex,
            lang,
            format,
            outDir,
          });

          const extractedAudioPath = await extractAudio({
            videoPath: video,
            audioIndex,
            outPath: audioOutPath,
            format,
          });

          const transcriptPath = deriveTranscriptPath({
            engine: 'mlx',
            outDir,
            videoPath: video,
            audioIndex,
            lang: options.language ?? lang,
          });

          const srtPath = await transcribeWithMlxWhisper({
            audioPath: extractedAudioPath,
            outPath: transcriptPath,
            language: options.language,
            prompt: options.prompt,
          });

          process.stdout.write(`${srtPath}\n`);
        }
      }
    });

  program
    .command('extract')
    .description('Extract a specific audio track from a video using ffmpeg')
    .argument('<video>', 'path to video file')
    .option('--track <number>', '0-based audio track index (from `tracks`)')
    .option('--tracks <list>', 'comma-separated audio track indices (e.g., 0,2,3)')
    .option('--out <path>', 'output audio file path')
    .option('--out-dir <path>', 'output directory (recommended for multi-track)')
    .option('--format <wav|m4a>', 'output format', 'wav')
    .option('--transcribe', 'after extracting, automatically transcribe each extracted track')
    .option('--engine <openai|mlx>', 'transcription engine for --transcribe (openai uses OPENAI_API_KEY; mlx uses local mlx_whisper)', 'openai')
    .option('--language <code>', 'language code hint (e.g., en)')
    .option('--prompt <text>', 'prompt for --engine openai to guide transcription')
    .action(async (video, options) => {
      await assertFileExists(video);

      const tracks = await getAudioTracks(video);

      const selectedTracks = options.tracks
        ? parseTracksList(options.tracks)
        : options.track != null
          ? [Number(options.track)]
          : null;

      if (!selectedTracks || selectedTracks.length === 0) {
        throw new Error('Provide either --track <n> or --tracks <n1,n2,...>.');
      }

      for (const idx of selectedTracks) {
        if (!Number.isInteger(idx) || idx < 0) {
          throw new Error(`Invalid track index: ${idx}`);
        }
        if (idx >= tracks.length) {
          throw new Error(`Track ${idx} out of range. Use \`vidtranscribe tracks\` to list available tracks.`);
        }
      }

      const engine = String(options.engine ?? 'openai').toLowerCase();
      if (options.transcribe) {
        if (engine !== 'openai' && engine !== 'mlx') {
          throw new Error(`Unknown --engine: ${options.engine}. Use openai or mlx.`);
        }
      }

      const outDir = options.outDir ? path.resolve(options.outDir) : path.dirname(video);
      await fs.promises.mkdir(outDir, { recursive: true });

      if (selectedTracks.length > 1 && options.out) {
        throw new Error('When using --tracks (multiple), use --out-dir instead of --out.');
      }

      for (const audioIndex of selectedTracks) {
        const lang = tracks?.[audioIndex]?.language;
        const audioOutPath = options.out
          ? options.out
          : defaultExtractOutputPathInDir({
              videoPath: video,
              audioIndex,
              lang,
              format: options.format,
              outDir,
            });

        const out = await extractAudio({
          videoPath: video,
          audioIndex,
          outPath: audioOutPath,
          format: options.format,
        });

        process.stdout.write(`${out}\n`);

        if (options.transcribe) {
          const transcriptPath = deriveTranscriptPath({
            engine,
            outDir,
            videoPath: video,
            audioIndex,
            lang,
          });

          if (engine === 'mlx') {
            const srtPath = await transcribeWithMlxWhisper({
              audioPath: out,
              outPath: transcriptPath,
              language: options.language,
              prompt: options.prompt,
            });
            process.stdout.write(`${srtPath}\n`);
          } else {
            await transcribeWithWhisperOpenAI({
              audioPath: out,
              outPath: transcriptPath,
              language: options.language,
              prompt: options.prompt,
            });
            process.stdout.write(`${transcriptPath}\n`);
          }
        }
      }
    });

  program
    .command('transcribe')
    .description('Transcribe an audio file using Whisper (OpenAI API)')
    .argument('<audio>', 'path to audio file (wav/m4a/mp3, etc.)')
    .option('--out <path>', 'write transcript to a file instead of stdout')
    .option('--engine <openai|mlx>', 'transcription engine (openai uses OPENAI_API_KEY; mlx uses local mlx_whisper)', 'openai')
    .option('--language <code>', 'language code hint (e.g., en). For mlx, see `mlx_whisper --help` for supported values.')
    .option('--prompt <text>', 'optional prompt to guide transcription')
    .option('-v, --verbose', 'detailed output / progress messages')
    .action(async (audio, options) => {
      await assertFileExists(audio);

      const engine = String(options.engine ?? 'openai').toLowerCase();
      const verbose = !!options.verbose;

      if (verbose) {
        process.stderr.write(`[vidtranscribe] Starting transcription for audio file: ${audio}\n`);
      }

      if (engine === 'mlx') {
        const srtPath = await transcribeWithMlxWhisper({
          audioPath: audio,
          outPath: options.out,
          language: options.language,
          prompt: options.prompt,
          verbose,
        });
        process.stdout.write(`${srtPath}\n`);
        return;
      }

      if (engine !== 'openai') {
        throw new Error(`Unknown --engine: ${options.engine}. Use openai or mlx.`);
      }

      await transcribeWithWhisperOpenAI({
        audioPath: audio,
        outPath: options.out,
        language: options.language,
        prompt: options.prompt,
        verbose,
      });
    });

  await program.parseAsync(argv);
}
