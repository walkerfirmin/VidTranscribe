example:
```
mlx_whisper "The Simpsons_S33E21_Poorhouse Rock.wav" \
  --model "mlx-community/whisper-large-v3-mlx" \
  --task transcribe \
  --temperature 0 \
  --condition-on-previous-text False \
  --compression-ratio-threshold 2.0 \
  --logprob-threshold -0.7 \
  --fp16 True \
  --output-format srt

```

For a multilingual, SRT-focused wrapper over `mlx_whisper`, the most useful approach is to expose a small set of “quality vs speed vs stability” knobs while keeping the output predictable (`--output-format srt`, naming, and optional word timestamps). `mlx_whisper` supports all of the flags below directly. 

## Core wrapper flags (always relevant)
- `--model`: Accept either a local path or a Hugging Face repo so you can swap models without changing your tool (defaults to a tiny model otherwise). 
- `--task {transcribe,translate}`: For multilingual *transcription*, default to `transcribe` so you keep the original language(s) instead of translating. 
- `--output-format srt` plus `--output-dir` and `--output-name`: Make SRT the default output, and let callers control where files go and what they’re named. 
- `audio [audio ...]`: Support multiple input files per invocation (batch mode). 

## Multilingual-focused flags
- `--language <code>`: If the user knows the language for a file, passing it can avoid detection mistakes; otherwise omit the flag to let language auto-detect happen. 
- `--initial-prompt`: Extremely useful in multilingual contexts to lock in spelling, names, and domain vocabulary (and to discourage unwanted translation). 

## Accuracy “preset” knobs
Expose these as either raw passthrough flags or as wrapper presets like `--quality high|balanced|fast` that map to them:
- `--temperature` (default 0): Keep `0` for maximum determinism/accuracy; allow override for edge cases. 
- `--best-of`, `--patience`, `--length-penalty`: Advanced decoding controls; useful to surface for power users, but can be hidden behind an “advanced” switch. 
- `--condition-on-previous-text`: Usually keep `True` for coherent long-form content; optionally allow disabling if the model “loops” or repeats. 

## SRT readability/timestamp options
If subtitles are the primary artifact, these are the most practical:
- `--word-timestamps True`: Enables word-level timing refinement; optionally also enable `--highlight-words` for VTT/SRT styling if desired. 
- `--max-line-width`, `--max-line-count`, `--max-words-per-line`: Great wrapper-level options to enforce subtitle formatting constraints. 
- `--prepend-punctuations` / `--append-punctuations`: Keep defaults, but allow override if you see punctuation attaching oddly in certain languages. 

## Robustness / “avoid garbage output”
These help when audio has long silence, music, or noisy segments:
- `--compression-ratio-threshold`, `--logprob-threshold`, `--no-speech-threshold`: Useful to tune hallucination filtering and silence handling; good to expose as advanced flags or via a `--strict` preset. 
- `--hallucination-silence-threshold`: Only applies with `--word-timestamps True`, but can be valuable for skipping suspicious silent spans. 

## Practical presets to implement
- **High accuracy (default)**: large multilingual model + `--temperature 0` + `--task transcribe` + omit `--language` unless provided + `--output-format srt`. 
- **Known-language accuracy**: same as above, but require/encourage `--language xx` per file. 
- **Subtitle formatting**: add `--word-timestamps True` + `--max-line-width/--max-line-count` to keep SRT readable. 

If the wrapper will process mixed-language *within the same file* (code-switching), or mostly “one language per file,” that affects whether `--language` should be encouraged or discouraged by default.

Sources


```
mlx_whisper --help                                  
usage: mlx_whisper [-h] [--model MODEL] [--output-name OUTPUT_NAME] [--output-dir OUTPUT_DIR] [--output-format {txt,vtt,srt,tsv,json,all}] [--verbose VERBOSE] [--task {transcribe,translate}]
                   [--language {af,am,ar,as,az,ba,be,bg,bn,bo,br,bs,ca,cs,cy,da,de,el,en,es,et,eu,fa,fi,fo,fr,gl,gu,ha,haw,he,hi,hr,ht,hu,hy,id,is,it,ja,jw,ka,kk,km,kn,ko,la,lb,ln,lo,lt,lv,mg,mi,mk,ml,mn,mr,ms,mt,my,ne,nl,nn,no,oc,pa,pl,ps,pt,ro,ru,sa,sd,si,sk,sl,sn,so,sq,sr,su,sv,sw,ta,te,tg,th,tk,tl,tr,tt,uk,ur,uz,vi,yi,yo,yue,zh,Afrikaans,Albanian,Amharic,Arabic,Armenian,Assamese,Azerbaijani,Bashkir,Basque,Belarusian,Bengali,Bosnian,Breton,Bulgarian,Burmese,Cantonese,Castilian,Catalan,Chinese,Croatian,Czech,Danish,Dutch,English,Estonian,Faroese,Finnish,Flemish,French,Galician,Georgian,German,Greek,Gujarati,Haitian,Haitian Creole,Hausa,Hawaiian,Hebrew,Hindi,Hungarian,Icelandic,Indonesian,Italian,Japanese,Javanese,Kannada,Kazakh,Khmer,Korean,Lao,Latin,Latvian,Letzeburgesch,Lingala,Lithuanian,Luxembourgish,Macedonian,Malagasy,Malay,Malayalam,Maltese,Mandarin,Maori,Marathi,Moldavian,Moldovan,Mongolian,Myanmar,Nepali,Norwegian,Nynorsk,Occitan,Panjabi,Pashto,Persian,Polish,Portuguese,Punjabi,Pushto,Romanian,Russian,Sanskrit,Serbian,Shona,Sindhi,Sinhala,Sinhalese,Slovak,Slovenian,Somali,Spanish,Sundanese,Swahili,Swedish,Tagalog,Tajik,Tamil,Tatar,Telugu,Thai,Tibetan,Turkish,Turkmen,Ukrainian,Urdu,Uzbek,Valencian,Vietnamese,Welsh,Yiddish,Yoruba}]
                   [--temperature TEMPERATURE] [--best-of BEST_OF] [--patience PATIENCE] [--length-penalty LENGTH_PENALTY] [--suppress-tokens SUPPRESS_TOKENS] [--initial-prompt INITIAL_PROMPT]
                   [--condition-on-previous-text CONDITION_ON_PREVIOUS_TEXT] [--fp16 FP16] [--compression-ratio-threshold COMPRESSION_RATIO_THRESHOLD] [--logprob-threshold LOGPROB_THRESHOLD]
                   [--no-speech-threshold NO_SPEECH_THRESHOLD] [--word-timestamps WORD_TIMESTAMPS] [--prepend-punctuations PREPEND_PUNCTUATIONS] [--append-punctuations APPEND_PUNCTUATIONS]
                   [--highlight-words HIGHLIGHT_WORDS] [--max-line-width MAX_LINE_WIDTH] [--max-line-count MAX_LINE_COUNT] [--max-words-per-line MAX_WORDS_PER_LINE]
                   [--hallucination-silence-threshold HALLUCINATION_SILENCE_THRESHOLD] [--clip-timestamps CLIP_TIMESTAMPS]
                   audio [audio ...]

positional arguments:
  audio                 Audio file(s) to transcribe

options:
  -h, --help            show this help message and exit
  --model MODEL         The model directory or hugging face repo (default: mlx-community/whisper-tiny)
  --output-name OUTPUT_NAME
                        The name of transcription/translation output files before --output-format extensions (default: None)
  --output-dir OUTPUT_DIR, -o OUTPUT_DIR
                        Directory to save the outputs (default: .)
  --output-format {txt,vtt,srt,tsv,json,all}, -f {txt,vtt,srt,tsv,json,all}
                        Format of the output file (default: txt)
  --verbose VERBOSE     Whether to print out progress and debug messages (default: True)
  --task {transcribe,translate}
                        Perform speech recognition ('transcribe') or speech translation ('translate') (default: transcribe)
  --language {af,am,ar,as,az,ba,be,bg,bn,bo,br,bs,ca,cs,cy,da,de,el,en,es,et,eu,fa,fi,fo,fr,gl,gu,ha,haw,he,hi,hr,ht,hu,hy,id,is,it,ja,jw,ka,kk,km,kn,ko,la,lb,ln,lo,lt,lv,mg,mi,mk,ml,mn,mr,ms,mt,my,ne,nl,nn,no,oc,pa,pl,ps,pt,ro,ru,sa,sd,si,sk,sl,sn,so,sq,sr,su,sv,sw,ta,te,tg,th,tk,tl,tr,tt,uk,ur,uz,vi,yi,yo,yue,zh,Afrikaans,Albanian,Amharic,Arabic,Armenian,Assamese,Azerbaijani,Bashkir,Basque,Belarusian,Bengali,Bosnian,Breton,Bulgarian,Burmese,Cantonese,Castilian,Catalan,Chinese,Croatian,Czech,Danish,Dutch,English,Estonian,Faroese,Finnish,Flemish,French,Galician,Georgian,German,Greek,Gujarati,Haitian,Haitian Creole,Hausa,Hawaiian,Hebrew,Hindi,Hungarian,Icelandic,Indonesian,Italian,Japanese,Javanese,Kannada,Kazakh,Khmer,Korean,Lao,Latin,Latvian,Letzeburgesch,Lingala,Lithuanian,Luxembourgish,Macedonian,Malagasy,Malay,Malayalam,Maltese,Mandarin,Maori,Marathi,Moldavian,Moldovan,Mongolian,Myanmar,Nepali,Norwegian,Nynorsk,Occitan,Panjabi,Pashto,Persian,Polish,Portuguese,Punjabi,Pushto,Romanian,Russian,Sanskrit,Serbian,Shona,Sindhi,Sinhala,Sinhalese,Slovak,Slovenian,Somali,Spanish,Sundanese,Swahili,Swedish,Tagalog,Tajik,Tamil,Tatar,Telugu,Thai,Tibetan,Turkish,Turkmen,Ukrainian,Urdu,Uzbek,Valencian,Vietnamese,Welsh,Yiddish,Yoruba}
                        Language spoken in the audio, specify None to auto-detect (default: None)
  --temperature TEMPERATURE
                        Temperature for sampling (default: 0)
  --best-of BEST_OF     Number of candidates when sampling with non-zero temperature (default: 5)
  --patience PATIENCE   Optional patience value to use in beam decoding, as in https://arxiv.org/abs/2204.05424, the default (1.0) is equivalent to conventional beam search (default: None)
  --length-penalty LENGTH_PENALTY
                        Optional token length penalty coefficient (alpha) as in https://arxiv.org/abs/1609.08144, uses simple length normalization by default. (default: None)
  --suppress-tokens SUPPRESS_TOKENS
                        Comma-separated list of token ids to suppress during sampling; '-1' will suppress most special characters except common punctuations (default: -1)
  --initial-prompt INITIAL_PROMPT
                        Optional text to provide as a prompt for the first window. (default: None)
  --condition-on-previous-text CONDITION_ON_PREVIOUS_TEXT
                        If True, provide the previous output of the model as a prompt for the next window; disabling may make the text inconsistent across windows, but the model becomes less
                        prone to getting stuck in a failure loop (default: True)
  --fp16 FP16           Whether to perform inference in fp16 (default: True)
  --compression-ratio-threshold COMPRESSION_RATIO_THRESHOLD
                        if the gzip compression ratio is higher than this value, treat the decoding as failed (default: 2.4)
  --logprob-threshold LOGPROB_THRESHOLD
                        If the average log probability is lower than this value, treat the decoding as failed (default: -1.0)
  --no-speech-threshold NO_SPEECH_THRESHOLD
                        If the probability of the token is higher than this value the decoding has failed due to `logprob_threshold`, consider the segment as silence (default: 0.6)
  --word-timestamps WORD_TIMESTAMPS
                        Extract word-level timestamps and refine the results based on them (default: False)
  --prepend-punctuations PREPEND_PUNCTUATIONS
                        If word-timestamps is True, merge these punctuation symbols with the next word (default: "'“¿([{-)
  --append-punctuations APPEND_PUNCTUATIONS
                        If word_timestamps is True, merge these punctuation symbols with the previous word (default: "'.。,，!！?？:：”)]}、)
  --highlight-words HIGHLIGHT_WORDS
                        (requires --word_timestamps True) underline each word as it is spoken in srt and vtt (default: False)
  --max-line-width MAX_LINE_WIDTH
                        (requires --word_timestamps True) the maximum number of characters in a line before breaking the line (default: None)
  --max-line-count MAX_LINE_COUNT
                        (requires --word_timestamps True) the maximum number of lines in a segment (default: None)
  --max-words-per-line MAX_WORDS_PER_LINE
                        (requires --word_timestamps True, no effect with --max_line_width) the maximum number of words in a segment (default: None)
  --hallucination-silence-threshold HALLUCINATION_SILENCE_THRESHOLD
                        (requires --word_timestamps True) skip silent periods longer than this threshold (in seconds) when a possible hallucination is detected (default: None)
  --clip-timestamps CLIP_TIMESTAMPS
                        Comma-separated list start,end,start,end,... timestamps (in seconds) of clips to process, where the last end timestamp defaults to the end of the file (default: 0)
```