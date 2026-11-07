# OpenKita AI — product pitch (deck + ~3 min video)

Everything for the pitch lives in this folder. Nothing here touches the app code (`frontend/`, `backend/`, `docs/`).

> **Status:** v0.1 in progress — foundation built (app shell, health checks, Ollama connection test); AI features in development. The idea is **not yet validated**.
> The demo (slides 5–6) is an **illustrative mock-up with fictional data**, not a screenshot of working software.
> All prices (test installation €1,000–€3,000, OpenKita Box tiers) are **hypotheses to validate, not market rates**.
> Turkish and Arabic are **experimental — native review required**; the demo translations were written for illustration and have not been reviewed by native speakers.

## Contents

| Path | What |
|---|---|
| `openkita-ai-pitch.mp4` | Final video, 1920×1080, H.264 + AAC, ~3:05, soft English subtitle track (Git LFS, see below) |
| `openkita-ai-pitch.srt` | Subtitles (sentence timings from the TTS run; about 20 characters/s at most (worst cue 20.4, speech is fast there); normal spelling) |
| `slides/openkita-ai-pitch.pptx` | 13-slide 16:9 deck, native editable shapes and text, speaker notes = narration, language tags de-DE / tr-TR / ar-SA on the translations |
| `slides/png/slide-01.png … slide-13.png` | 1920×1080 renders used for the video (source of truth for the visuals) |
| `narration.md`, `narration/slide-XX.txt` | English narration script (462 words); the `.txt` files are the source |
| `audio/slide-XX.flac` | One voice-over file per slide (24 kHz mono, 16-bit, raw TTS output; Git LFS) |
| `audio/durations.json`, `audio/timings.json` | Per-slide durations and per-sentence timings |
| `src/` | Build scripts (see below) |

The loudness-normalised full track (`narration-full.wav`) is regenerated into `build/` and is not a deliverable.

Slides: 1 Title / promise / status · 2 Problem · 3 What it is and is not · 4 Three planned capabilities · 5 Mock-up: summer party · 6 Translations (DE/EN/TR/AR) and human approval · 7 Privacy-first (v0.1 design vs planned v0.3) · 8 Open source and tech stack · 9 Business model (services) · 10 OpenKita Box · 11 Validation plan and honest status · 12 Roadmap (incl. planned Privacy Gateway) · 13 Call to action (interview ask, repository link and QR code).

## Voice-over model

| | |
|---|---|
| **Model** | **Kokoro-82M v1.0** (82 M parameters, StyleTTS 2 + ISTFTNet architecture), run locally on CPU through **kokoro-onnx 0.6.1** (ONNX Runtime) |
| **Voice** | `af_heart` (American English, female), `speed=1.2`, 0.25 s between sentences |
| **Model licence** | **Apache License 2.0**, declared in the model card metadata (`license: apache-2.0`) of <https://huggingface.co/hexgrad/Kokoro-82M>. Per the model card, it was trained on permissive/non-copyrighted audio (public domain, Apache/MIT-licensed, synthetic) plus CC BY data listed there: Koniwa `tnc` (CC BY 3.0) and SIWIS (CC BY 4.0). |
| **Weights used** | `kokoro-v1.0.onnx` and `voices-v1.0.bin` from the kokoro-onnx release <https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0> (SHA-256 in `src/models.sha256`, verified by `src/get_models.sh`) |
| **Inference code licence** | kokoro-onnx: **MIT** (<https://github.com/thewh1teagle/kokoro-onnx>) |
| **Phonemisers** | `espeak-ng` (GPL-3.0) via `espeakng-loader`, and `phonemizer` (GPL-3.0-or-later). Both are run-time tool dependencies only; they are not redistributed in this folder and their licences do not apply to the generated audio. |
| **Source** | Model: <https://huggingface.co/hexgrad/Kokoro-82M> · GitHub: <https://github.com/hexgrad/kokoro> |

Not used for the final voice: macOS `say`, paid APIs or cloud TTS. Everything ran offline once the weights were downloaded.

**Model-weight licences are separate from the OpenKita AI application code.** The app is licensed under Apache 2.0; model weights (here Kokoro for the voice, and whichever LLM a Kita runs through Ollama) carry their own licences, documented separately.

Open points: no separate per-voice licence file was found; the voices ship as part of the Apache-2.0 Kokoro release and are treated as such.

### Pronunciation and ASR check

Respellings exist **only** in the TTS-input map in `src/tts.py` (`PRON`): e.g. "OpenKita AI" → "Open Kee-tah A. I.", "Träger" → "Tray-ger", "Ollama" → "Oh-lah-ma", "PostgreSQL" → "Postgres", "GDPR" → "G D P R". The narration text, subtitles and speaker notes keep the normal spelling.

The final track was transcribed locally with faster-whisper `small.en` (optional QA step, not part of the build). Results:

- Intelligible end to end; all sentences were recognised, including "version 0.1 … 0.3", "Apache 2.0", "GDPR", "Postgres", "API", "AI-generated" (as "A. I. generated").
- "OpenKita AI" was transcribed as "OpenKita.ai"/"OpenKita AI"; "AI" elsewhere as "AI".
- "Kita" is not an English word, so the recogniser is unreliable for it: it wrote "Kita" in short tests but "keto" / "key-top" in the full pass. The respelling "Kee-tah" was the best of nine variants tried, and the pronunciation was **not** confirmed by a human listener.
- "Träger" was heard as "trader" and "Ollama" as "Olama" — close, not exact. "FastAPI" was heard as "fast API".
- The repository URL is not spoken (it was unintelligible in tests); it is on slide 13 together with a QR code.

Please give the audio a quick listen before external use.

## How it was made

1. **Slides** — one slide spec (`src/slides.mjs`, with a small layout DSL in `src/lib.mjs`) is rendered twice: to HTML → PNG with Chrome via `playwright-core` (also reporting text overflow), and to a native `.pptx` with `pptxgenjs`. Icons are rendered from `react-icons` (Font Awesome 6) with `sharp`; the QR code is generated locally with `qrcode`. Fonts: Georgia (headings) and Arial (body). The `.pptx` was checked with an external OOXML validator (passed) and rendered through Keynote to confirm it matches the PNGs; PowerPoint was not available.
2. **Narration** — written per slide in `narration/slide-XX.txt`.
3. **Voice-over** — `src/tts.py` synthesises each sentence with Kokoro, trims silence, joins sentences with short pauses and writes one FLAC per slide plus timing files. Slide 6 is padded to at least 14.5 s; 1.5 s of silence is added after the last slide so the fade-out completes.
4. **Video** — `src/make_video.py`: concatenates the audio, normalises loudness (ffmpeg `loudnorm`), builds the SRT (long sentences split at commas, cue ends extended into pauses to keep reading speed near 20 characters/s) and renders the MP4 with ffmpeg (0.35 s dissolve between slides, fade in/out, x264 CRF 18, AAC 192 kbit/s, soft `mov_text` subtitles). Each slide stays on screen for its narration duration.

## Regenerate

Requires Node 20+, Python 3.12, ffmpeg/ffprobe and Google Chrome (or set `CHROME_PATH` to any Chrome/Chromium binary).

```bash
cd pitch

# one-off setup (venv, node_modules and models are git-ignored)
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
npm install
./src/get_models.sh                     # ~350 MB Kokoro-82M ONNX weights -> models/ (checksum-verified)

# deck: HTML -> slides/png/*.png and slides/openkita-ai-pitch.pptx
node src/build.mjs                      # CHROME_PATH=/path/to/chrome node src/build.mjs
python src/make_pdf.py                  # slides/png/slide-*.png -> openkita-ai-pitch.pdf (16:9, one slide per page)

# voice-over, narration.md, video
python src/tts.py --voice af_heart --speed 1.2 --gap 0.25   # -> audio/*.flac (~1 min on Apple Silicon)
python src/narration_md.py                                  # -> narration.md
python src/make_video.py                                    # -> openkita-ai-pitch.{mp4,srt}
```

To change the length, edit `narration/slide-XX.txt` and/or `--speed`, then re-run the commands from `tts.py` on (and `node src/build.mjs` again, because the narration also feeds the speaker notes). The video length equals the sum of the per-slide audio durations.

## Git LFS

`.gitattributes` in this folder routes `*.mp4` and `*.flac` to Git LFS. **git-lfs must be installed** (`git lfs install` once per machine) before committing these files; the repository owner decides when to enable it. The `.pptx` and PNGs are small and stay in normal Git. The venv, `node_modules`, model weights and `build/` are git-ignored.

## Credits

- Icons: **Font Awesome Free** (via `react-icons`), licensed **CC BY 4.0** — <https://fontawesome.com/license/free>. Attribution is also on the last slide.
- Voice: Kokoro-82M (Apache 2.0), see above.
- Fonts used in the deck (Georgia, Arial) are system fonts and not bundled; SIL OFL fonts could replace them if a fully open font stack is wanted.

## Verification summary

- `ffprobe`: 1920×1080 @ 30 fps H.264, AAC 48 kHz mono, one `mov_text` subtitle stream.
- Audio: integrated loudness ≈ −16 LUFS, true peak ≈ −1.4 dBFS (no clipping).
- Every slide PNG was visually inspected (no overflow; German `ä ö ü ß`, Turkish `ç ş ğ ı` and right-to-left Arabic render correctly).
