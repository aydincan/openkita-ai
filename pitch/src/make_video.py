#!/usr/bin/env python3
"""Assemble narration track, subtitles (.srt) and the final MP4 from slide PNGs + per-slide WAVs.

Needs ffmpeg/ffprobe on PATH. Reads audio/durations.json + audio/timings.json (written by tts.py).
"""
import json, pathlib, re, subprocess, wave

ROOT = pathlib.Path(__file__).resolve().parent.parent
FADE = 0.35  # cross-dissolve between slides (s)
dur = json.loads((ROOT / "audio/durations.json").read_text())
timings = json.loads((ROOT / "audio/timings.json").read_text())
ids = sorted(k for k in dur if k != "_total")

# ---- 1. full narration track (concatenate, then loudness-normalise) ----
lst = ROOT / "build/audio_concat.txt"
lst.parent.mkdir(exist_ok=True)
lst.write_text("".join(f"file '{ROOT}/audio/slide-{i}.flac'\n" for i in ids))
raw = ROOT / "build/narration_raw.wav"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c:a", "pcm_s16le", str(raw)], check=True)
subprocess.run([
    "ffmpeg", "-y", "-loglevel", "error", "-i", str(raw),
    "-af", "loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000",
    "-ac", "1", "-c:a", "pcm_s16le", str(ROOT / "build/narration-full.wav"),
], check=True)

# ---- 2. subtitles: sentence timings, long sentences split at commas ----
def ts(t):
    h, rem = divmod(t, 3600); m, s = divmod(rem, 60)
    return f"{int(h):02}:{int(m):02}:{int(s):02},{int(round((s - int(s)) * 1000)):03}"

def chunks(text, limit=86):
    if len(text) <= limit:
        return [text]
    parts = re.split(r"(?<=,)\s+", text)
    out, cur = [], ""
    for p in parts:
        if cur and len(cur) + 1 + len(p) > limit:
            out.append(cur); cur = p
        else:
            cur = (cur + " " + p).strip()
    out.append(cur)
    final = []
    for c in out:  # still too long -> split at a space near the middle
        if len(c) > limit * 1.25:
            mid = c.rfind(" ", 0, len(c) // 2 + 10)
            final += [c[:mid], c[mid + 1:]]
        else:
            final.append(c)
    return final

def wrap2(t, width=44):
    if len(t) <= width:
        return t
    mid = t.rfind(" ", 0, len(t) // 2 + 8)
    return t[:mid] + "\n" + t[mid + 1:]

def merged(cues):
    out = []
    for c in cues:  # a cue ending in ":" reads better together with the next one
        if out and out[-1]["text"].endswith(":"):
            out[-1] = {"text": out[-1]["text"] + " " + c["text"], "start": out[-1]["start"], "end": c["end"]}
        else:
            out.append(dict(c))
    return out

items, offset = [], 0.0
for i in ids:
    for cue in merged(timings[i]):
        cs = chunks(cue["text"])
        total_chars = sum(len(c) for c in cs)
        t0 = offset + cue["start"]
        span = cue["end"] - cue["start"]
        for c in cs:
            t1 = t0 + span * len(c) / total_chars
            items.append([t0, t1, c])
            t0 = t1
    offset += dur[i]
end_all = offset
# keep reading speed <= 20 chars/s by extending cue ends into the following pause
MAX_CPS = 19.0
for k, it in enumerate(items):
    nxt = items[k + 1][0] if k + 1 < len(items) else end_all
    need = len(it[2].replace("\n", " ")) / MAX_CPS
    if it[1] - it[0] < need:
        it[1] = min(it[0] + need, nxt - 0.04)
srt, worst = [], 0.0
for k, (t0, t1, c) in enumerate(items, 1):
    srt.append(f"{k}\n{ts(t0)} --> {ts(t1)}\n{wrap2(c)}\n")
    worst = max(worst, len(c) / (t1 - t0))
(ROOT / "openkita-ai-pitch.srt").write_text("\n".join(srt))
print(f"subtitles: {len(items)} cues, worst reading speed {worst:.1f} chars/s")

# ---- 3. video: PNG per slide, dissolve transitions, narration track ----
n = len(ids)
inputs, fchain = [], []
for k, i in enumerate(ids):
    L = dur[i] + (FADE if k < n - 1 else 0)
    inputs += ["-loop", "1", "-framerate", "30", "-t", f"{L:.3f}", "-i", str(ROOT / f"slides/png/slide-{i}.png")]
    fchain.append(f"[{k}:v]scale=1920:1080,setsar=1,format=yuv420p[v{k}]")
prev, acc = "v0", 0.0
for k in range(1, n):
    acc += dur[ids[k - 1]]
    out = f"x{k}"
    fchain.append(f"[{prev}][v{k}]xfade=transition=fade:duration={FADE}:offset={acc:.3f}[{out}]")
    prev = out
total = sum(dur[i] for i in ids)
fchain.append(f"[{prev}]fade=t=in:st=0:d=0.5,fade=t=out:st={total - 0.8:.3f}:d=0.8[vout]")
cmd = ["ffmpeg", "-y", "-loglevel", "error", *inputs,
       "-i", str(ROOT / "build/narration-full.wav"),
       "-i", str(ROOT / "openkita-ai-pitch.srt"),
       "-filter_complex", ";".join(fchain),
       "-map", "[vout]", "-map", f"{n}:a", "-map", f"{n + 1}:s",
       "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30",
       "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
       "-c:s", "mov_text", "-metadata:s:s:0", "language=eng", "-metadata:s:a:0", "language=eng",
       "-movflags", "+faststart",
       str(ROOT / "openkita-ai-pitch.mp4")]
subprocess.run(cmd, check=True)
print("video written, expected duration ~", round(total, 2), "s")
