#!/usr/bin/env python3
"""Generate one FLAC per slide with Kokoro-82M (ONNX, Apache-2.0 weights), fully offline.

Usage: python src/tts.py [--speed 1.18] [--voice af_heart] [--gap 0.25]
Writes audio/slide-XX.flac (24 kHz mono, 16-bit), audio/durations.json and audio/timings.json.

Pronunciation respellings live ONLY in PRON below (TTS input). The narration text on disk, the
subtitles and the speaker notes keep the normal spelling (AI, GDPR, PostgreSQL, ...).
"""
import argparse, json, re, pathlib
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = pathlib.Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument("--speed", type=float, default=1.18)
ap.add_argument("--voice", default="af_heart")
ap.add_argument("--gap", type=float, default=0.25, help="silence between sentences (s)")
args = ap.parse_args()

MIN_DURATION = {"06": 14.5}   # slide 6 (translations) must stay on screen >= 14 s
FINAL_TAIL = 1.5              # extra silence after the last slide so the fade-out completes

# TTS-only pronunciation map (applied in order)
PRON = [
    (r"\bOpenKita AI\b", "Open Kee-tah A. I."),
    (r"\bOpenKita\b", "Open Kee-tah"),
    (r"\bKitaLux\b", "Kee-tah Lux"),
    (r"\bKitas\b", "Kee-tahs"),
    (r"\bKita's\b", "Kee-tah's"),
    (r"\bKita\b", "Kee-tah"),
    (r"\bTräger\b", "Tray-ger"),
    (r"\bOllama\b", "Oh-lah-ma"),
    (r"\bPostgreSQL\b", "Postgres"),
    (r"Next\.js", "Next J S"),
    (r"FastAPI", "Fast A-P-I"),
    (r"\bAPI\b", "A-P-I"),
    (r"\bGDPR\b", "G D P R"),
    (r"\bDPIA\b", "D P I A"),
    (r"\bMVP\b", "M V P"),
    (r"\bPDF\b", "P D F"),
    (r"\bAI\b", "A. I."),
    (r"Apache 2\.0", "Apache two point oh"),
    (r"\b0\.(\d)\b", lambda m: "zero point " + ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"][int(m.group(1))]),
    (r"\b1\.0\b", "one point oh"),
]
def tts_text(t: str) -> str:
    for pat, rep in PRON:
        t = re.sub(pat, rep, t)
    return t

kokoro = Kokoro(str(ROOT / "models/kokoro-v1.0.onnx"), str(ROOT / "models/voices-v1.0.bin"))
(ROOT / "audio").mkdir(exist_ok=True)

def trim(samples, thr=0.004):
    idx = np.where(np.abs(samples) > thr)[0]
    return samples[idx[0]: idx[-1] + 1] if len(idx) else samples

def sentences(t):
    return [x.strip() for x in re.split(r"(?<=[.!?:])\s+", t.strip()) if x.strip()]

HEAD, TAIL, GAP = 0.10, 0.30, args.gap
files = sorted((ROOT / "narration").glob("slide-*.txt"))
durations, timings = {}, {}
for f in files:
    n = f.stem.split("-")[1]
    text = f.read_text().strip()
    parts, cues, t = [], [], HEAD
    sr = 24000
    for sent in sentences(text):
        smp, sr = kokoro.create(tts_text(sent), voice=args.voice, speed=args.speed, lang="en-us")
        smp = trim(smp)
        d = len(smp) / sr
        cues.append({"text": sent, "start": round(t, 3), "end": round(t + d, 3)})
        parts += [smp, np.zeros(int(sr * GAP), dtype=smp.dtype)]
        t += d + GAP
    tail = TAIL + (FINAL_TAIL if f is files[-1] else 0)
    body = np.concatenate([np.zeros(int(sr * HEAD), dtype=np.float32)] + parts[:-1])
    need = MIN_DURATION.get(n, 0) - len(body) / sr - tail
    tail += max(0.0, need)
    samples = np.concatenate([body, np.zeros(int(sr * tail), dtype=np.float32)])
    sf.write(ROOT / f"audio/slide-{n}.flac", samples, sr, subtype="PCM_16")
    durations[n] = round(len(samples) / sr, 3)
    timings[n] = cues
    print(n, durations[n], "s", len(text.split()), "words")
total = round(sum(durations.values()), 2)
durations["_total"] = total
(ROOT / "audio/durations.json").write_text(json.dumps(durations, indent=2))
(ROOT / "audio/timings.json").write_text(json.dumps(timings, indent=2, ensure_ascii=False))
print("TOTAL", total, "s")
