"""Check a render against the beat grid, and make a contact sheet.

  python scripts/check.py [out/berth-launch.mp4]

1. Cuts: every scene change is a downbeat. The outgoing scene is gone, and
   the incoming one not yet in, exactly at the bar line, so the frame with
   the least "ink" above the harbour marks the cut. It should be the
   downbeat's own frame (within one frame).
2. Sync: the mp4's audio against .cache/music.wav (cross-correlation of
   onset envelopes), in milliseconds.
3. Contact sheet: one frame a beat and a half after each bar line, labelled with its
   bar and time, at out/contact-sheet.png; and the frame at each cut and on
   either side of it, at out/cuts.png.
"""

import json
import os
import subprocess
import sys
import warnings

import numpy as np

warnings.filterwarnings("ignore")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MP4 = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "out", "berth-launch.mp4")
BEATS = json.load(open(os.path.join(ROOT, "src", "beats.json")))
FONT = os.path.join(os.path.dirname(ROOT), "site", "assets", "fonts", "jetbrains-mono-latin-wght.woff2")
CUT_BARS = [2, 4, 6, 8, 10, 12, 14]


def probe(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate,nb_frames", "-of", "json", path])
    s = json.loads(out)["streams"][0]
    num, den = map(int, s["r_frame_rate"].split("/"))
    return s["width"], s["height"], num / den


def frames_gray(path, w, h):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={w}:{h}:flags=area,format=gray", "-f", "rawvideo", "-"])
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)


def main():
    W, H, fps = probe(MP4)
    w, h = 240, int(240 * H / W)
    fr = frames_gray(MP4, w, h)
    # Ink above the harbour (the top 72% of the frame): pixels clearly
    # brighter than the ground.
    top = fr[:, : int(h * 0.72), :]
    ground = np.median(top[0])
    ink = (top > ground + 14).mean(axis=(1, 2))
    print(f"{os.path.basename(MP4)}: {W}x{H} @ {fps:g} fps, {len(fr)} frames ({len(fr) / fps:.3f}s)")
    worst = 0
    rows = []
    for b in CUT_BARS:
        t = BEATS["downbeats"][b]
        f0 = int(round(t * fps))
        lo, hi = f0 - int(0.2 * fps), f0 + int(0.2 * fps)
        k = lo + int(np.argmin(ink[lo:hi]))
        # The empty stretch can be a few frames long; take its middle.
        flat = [i for i in range(lo, hi) if ink[i] <= ink[k] + 1e-4]
        mid = flat[len(flat) // 2] if flat else k
        first = flat[0] if flat else k
        last = flat[-1] if flat else k
        d = 0 if first <= f0 <= last + 1 else min(abs(f0 - first), abs(f0 - last))
        worst = max(worst, d)
        rows.append((b, t, f0, first, last, d))
        print(f"  cut at bar {b:2d}  beat {t:7.3f}s = frame {f0:4d}   empty frames {first}-{last}   off by {d} frame(s)")
    print(f"cuts: worst {worst} frame(s) from the downbeat {'OK' if worst <= 1 else 'LATE/EARLY'}")

    # Audio sync.
    try:
        import librosa
        wav = os.path.join(ROOT, ".cache", "check-audio.wav")
        subprocess.check_call(["ffmpeg", "-v", "error", "-y", "-i", MP4, "-t", "14", "-ac", "1", "-ar", "22050", wav])
        a, sr = librosa.load(wav, sr=22050, mono=True)
        m, _ = librosa.load(os.path.join(ROOT, ".cache", "music.wav"), sr=22050, mono=True, duration=14)
        ea = librosa.onset.onset_strength(y=a, sr=sr, hop_length=64)
        em = librosa.onset.onset_strength(y=m, sr=sr, hop_length=64)
        n = min(len(ea), len(em))
        c = np.correlate(ea[:n] - ea[:n].mean(), em[:n] - em[:n].mean(), "full")
        lag = (np.argmax(c) - (n - 1)) * 64 / sr
        print(f"audio vs music.wav: {lag * 1000:+.1f} ms {'OK' if abs(lag) < 1 / fps else 'OFF'}")
    except Exception as e:  # librosa missing: skip
        print("audio check skipped:", e)

    out = os.path.dirname(MP4)
    tag = os.path.splitext(os.path.basename(MP4))[0]
    # Contact sheet: a beat and a half into every bar.
    times = [min(BEATS["duration"] - 0.05, max(0, d) + BEATS["beat"] * 1.5) for d in BEATS["downbeats"] if d < BEATS["duration"] - 0.3]
    sheet([int(round(t * fps)) for t in times], fps, 4, 640 if W >= H else 360, os.path.join(out, f"{tag}-contact-sheet.png"))
    # Cuts: 8 frames before each downbeat, on it, 8 after, and half a second in.
    picks = []
    for b, t, f0, *_ in rows:
        picks += [f0 - 8, f0, f0 + 8, f0 + int(0.5 * fps)]
    sheet(picks, fps, 4, 480 if W >= H else 270, os.path.join(out, f"{tag}-cuts.png"))
    print("sheets:", os.path.join(out, f"{tag}-contact-sheet.png"), os.path.join(out, f"{tag}-cuts.png"))


def sheet(frames, fps, cols, tw, path):
    from PIL import Image, ImageDraw, ImageFont
    tmp = os.path.join(ROOT, ".cache", "sheet")
    os.makedirs(tmp, exist_ok=True)
    for f in os.listdir(tmp):
        os.remove(os.path.join(tmp, f))
    sel = "+".join(f"eq(n\\,{f})" for f in sorted(set(frames)))
    subprocess.check_call(["ffmpeg", "-v", "error", "-y", "-i", MP4, "-vf", f"select='{sel}',scale={tw}:-1", "-fps_mode", "passthrough", os.path.join(tmp, "%04d.png")])
    files = sorted(os.listdir(tmp))
    by = dict(zip(sorted(set(frames)), files))
    ims = [Image.open(os.path.join(tmp, by[f])) for f in frames]
    th = ims[0].height
    rows_n = int(np.ceil(len(ims) / cols))
    pad = 6
    S = Image.new("RGB", (cols * (tw + pad) + pad, rows_n * (th + pad) + pad), (58, 59, 66))
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", max(12, tw // 34))
    except Exception:
        font = ImageFont.load_default()
    d = ImageDraw.Draw(S)
    for i, (f, im) in enumerate(zip(frames, ims)):
        x, y = pad + (i % cols) * (tw + pad), pad + (i // cols) * (th + pad)
        S.paste(im, (x, y))
        t = f / fps
        k = (t - BEATS["downbeats"][0]) / BEATS["beat"]
        txt = f"{t:6.3f}s  bar {int(k // 4)} beat {k % 4 + 1:.2f}"
        d.rectangle([x + 6, y + 6, x + 12 + d.textlength(txt, font=font), y + 10 + font.size], fill=(0, 0, 0))
        d.text((x + 9, y + 7), txt, fill=(235, 235, 235), font=font)
    S.save(path)


if __name__ == "__main__":
    main()
