#!/usr/bin/env python3
"""Compile narration/slide-XX.txt (+ audio/durations.json if present) into narration.md."""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
titles = ["Title / promise", "The problem", "What OpenKita AI is (and is not)", "Three capabilities", "Mock-up: the summer party",
          "Translations and human approval", "Privacy-first architecture", "Fully open source and tech stack", "Business model (services)",
          "OpenKita Box (hardware idea)", "Validation plan and honesty", "Roadmap", "Call to action"]
dur = json.loads((ROOT / "audio/durations.json").read_text()) if (ROOT / "audio/durations.json").exists() else {}
files = sorted((ROOT / "narration").glob("slide-*.txt"))
words = sum(len(f.read_text().split()) for f in files)
out = ["# OpenKita AI — narration script (English)", "",
       f"Target length ~3:00. Spoken text: **{words} words**."
       + (f" Rendered audio: **{dur['_total']:.1f} s** (incl. short pauses)." if dur else ""),
       "", "The narration is the source for the voice-over (`audio/`), the subtitles (`openkita-ai-pitch.srt`) and the speaker notes in the deck.",
       "Prices and the hardware bundle are hypotheses to validate; the idea is not yet validated.", ""]
for i, f in enumerate(files):
    n = f.stem.split("-")[1]
    t = f"{dur[n]:.1f} s" if n in dur else ""
    out += [f"## Slide {int(n)} — {titles[i]}" + (f"  _({t})_" if t else ""), "", f.read_text().strip(), ""]
(ROOT / "narration.md").write_text("\n".join(out))
print("narration.md:", words, "words")
