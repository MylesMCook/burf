"""Cut the launch video's music and write its beat grid.

The track is "Love Love Love" by HoliznaCC0 (CC0, see ../MUSIC.md). It is a
115 BPM loop of F - C - Dm - Bb, one chord a bar, in four-bar phrases, with a
pad-only intro and breakdown and a final F chord that rings out. The edit
keeps every splice on a phrase-safe bar line, so the chords run on:

  out bars  0-11  source bars  0-11   pad intro (4 bars), then the groove (8)
  out bars 12-13  source bars 24-25   the breakdown's F and C, pads only
  out bar  14-    source bar  80-     the final F, faded out

and the C of bar 13 resolves to the final F (V - I).

Beats are detected in the source (librosa), the grid's tempo and phase are
fitted to them, downbeats are found from where the chords change, and each
splice is placed just before the downbeat's transient. The edited audio is
analysed again, and src/beats.json gets the grid, the detected beats and
onsets, and how far detection lands from the grid.

  python scripts/music.py            # needs .cache/love-love-love.mp3
  python scripts/music.py --fetch    # downloads the collection zip first
"""

import hashlib
import io
import json
import os
import sys
import urllib.request
import warnings
import zipfile

import librosa
import numpy as np
import soundfile as sf

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache")
SRC = os.path.join(CACHE, "love-love-love.mp3")
OUT_WAV = os.path.join(CACHE, "music.wav")
OUT_JSON = os.path.join(ROOT, "src", "beats.json")

ZIP_URL = "https://opengameart.org/sites/default/files/happy_electronic.zip"
ZIP_MEMBER = "Happy Electronic/11 HoliznaCC0 - Love Love Love.mp3"
MP3_SHA256 = "8f579ae23d50513c073ad914eb6bcd93d6abe33b53130c1dcf493c5c2c114322"

SR = 44100
# (source first bar, number of bars); None = to the end of the file.
EDIT = [(0, 12), (24, 2), (80, None)]
TAIL = 4.3  # seconds kept of the final chord
FADE = 1.9  # its fade out
XFADE = 0.006  # splice crossfade, seconds, ending just before the transient
PRE = 0.004  # splice this long before the detected transient


def fetch():
    os.makedirs(CACHE, exist_ok=True)
    print("fetching", ZIP_URL)
    data = urllib.request.urlopen(ZIP_URL).read()
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        mp3 = z.read(ZIP_MEMBER)
    open(SRC, "wb").write(mp3)


def sha256(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def fit_grid(y, sr):
    """Tempo and phase of a steady grid, from librosa's beats."""
    oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=256)
    _, frames = librosa.beat.beat_track(onset_envelope=oenv, sr=sr, hop_length=256, start_bpm=115, tightness=400)
    beats = librosa.frames_to_time(frames, sr=sr, hop_length=256)
    # Least squares on beat index (detection skips nothing inside the groove,
    # so index by rounding against the median interval).
    ibi = np.median(np.diff(beats))
    idx = np.round((beats - beats[0]) / ibi)
    period, offset = np.polyfit(idx, beats, 1)
    return beats, period, offset


def downbeat_phase(y, sr, grid):
    """Which beat of four the chords change on (harmonic novelty)."""
    h = librosa.effects.harmonic(y)
    C = librosa.feature.chroma_cqt(y=h, sr=sr, hop_length=512)
    t = librosa.times_like(C, sr=sr, hop_length=512)
    nov = np.r_[0, np.linalg.norm(np.diff(C, axis=1), axis=0)]
    def at(x):
        k = np.searchsorted(t, x)
        return nov[max(0, k - 3) : k + 4].max() if k < len(nov) else 0
    score = [np.mean([at(x) for x in grid[p::4]]) for p in range(4)]
    return int(np.argmax(score)), score


def transient(y, sr, near, win=0.05):
    """The sharpest rise in the onset envelope near a time (high resolution)."""
    hop = 64
    a = max(0, int((near - win) * sr))
    b = int((near + win) * sr)
    env = librosa.onset.onset_strength(y=y[a:b], sr=sr, hop_length=hop)
    k = int(np.argmax(env))
    return a / sr + librosa.frames_to_time(k, sr=sr, hop_length=hop)


def main():
    if "--fetch" in sys.argv or not os.path.exists(SRC):
        fetch()
    got = sha256(SRC)
    if got != MP3_SHA256:
        sys.exit(f"{SRC}: sha256 {got} is not the expected {MP3_SHA256}")

    stereo, sr = librosa.load(SRC, sr=SR, mono=False)
    mono = librosa.to_mono(stereo)
    dur = mono.shape[0] / sr

    beats, period, offset = fit_grid(mono, sr)
    bpm = 60 / period
    grid = offset + period * np.arange(-int(offset / period) - 1, int((dur - offset) / period) + 1)
    grid = grid[(grid >= -1e-3) & (grid < dur)]
    phase, score = downbeat_phase(mono, sr, grid)
    down = grid[phase::4]
    bar = 4 * period
    # Bar n of the source starts at down0 + n * bar; the first bar line at or
    # after zero is bar 0 (the intro's first chord).
    down0 = down[0] - bar * np.floor((down[0] + 0.05) / bar)
    resid = beats - (offset + period * np.round((beats - offset) / period))
    print(f"source: {dur:.2f}s, {bpm:.3f} BPM, bar {bar:.4f}s, bar 0 at {down0:.4f}s, downbeat phase {phase} {np.round(score, 3)}")
    print(f"source beats vs fitted grid: median {np.median(np.abs(resid)) * 1000:.1f} ms, p95 {np.percentile(np.abs(resid), 95) * 1000:.1f} ms")

    # Splice points: just before the transient at each segment's first
    # downbeat (bar 0 starts at the top of the file).
    def bar_time(n):
        return down0 + n * bar

    pieces = []
    out_t = 0.0
    edit_map = []
    for i, (b0, nb) in enumerate(EDIT):
        # A piece starts just before its first downbeat's transient (or on
        # the grid, where pads have no transient near it) and runs a whole
        # number of bars, so every later bar line stays on the grid.
        if b0 == 0:
            start = 0.0
        else:
            g = bar_time(b0)
            d = transient(mono, sr, g) - g
            start = g + (d if abs(d) < 0.015 else 0.0) - PRE
        end = start + (TAIL if nb is None else nb * bar)
        pieces.append((start, end))
        edit_map.append({"sourceBar": b0, "bars": nb, "sourceStart": round(start, 4), "sourceEnd": round(end, 4), "outStart": round(out_t, 4)})
        out_t += end - start

    n_x = int(XFADE * sr)
    out = None
    for start, end in pieces:
        a, b = int(round(start * sr)), int(round(end * sr))
        seg = stereo[:, max(0, a - n_x) : b].copy() if out is not None else stereo[:, a:b].copy()
        if out is None:
            out = seg
            continue
        # Equal-power crossfade over the n_x samples before the splice.
        ramp = np.linspace(0, np.pi / 2, n_x)
        tail = out[:, -n_x:] * np.cos(ramp)
        head = seg[:, :n_x] * np.sin(ramp)
        out = np.concatenate([out[:, :-n_x], tail + head, seg[:, n_x:]], axis=1)
    # The final chord fades out; a short fade in keeps the first sample clean.
    nf = int(FADE * sr)
    out[:, -nf:] *= np.cos(np.linspace(0, np.pi / 2, nf)) ** 1.5
    ni = int(0.01 * sr)
    out[:, :ni] *= np.linspace(0, 1, ni)
    # Peak-normalise to -1 dBFS; loudness is set when muxing.
    out *= 10 ** (-1 / 20) / np.abs(out).max()
    os.makedirs(CACHE, exist_ok=True)
    sf.write(OUT_WAV, out.T, sr, subtype="PCM_24")
    out_dur = out.shape[1] / sr

    # The grid of the edit: every splice sits on a bar line, so the edit runs
    # on one steady grid from bar 0. Its bar lines are where the pieces start.
    starts = [m["outStart"] for m in edit_map]
    out_down0 = down0  # bar 0 keeps the source's offset
    n_bars = int(np.ceil((out_dur - out_down0) / bar))
    downbeats = [round(out_down0 + k * bar, 4) for k in range(n_bars)]
    grid_beats = [round(out_down0 + k * period, 4) for k in range(n_bars * 4) if out_down0 + k * period < out_dur]

    # Analyse the edit itself and compare with the grid.
    m_out = librosa.to_mono(out)
    oenv = librosa.onset.onset_strength(y=m_out, sr=sr, hop_length=256)
    _, f = librosa.beat.beat_track(onset_envelope=oenv, sr=sr, hop_length=256, start_bpm=bpm, tightness=400)
    det = librosa.frames_to_time(f, sr=sr, hop_length=256)
    gb = np.array(grid_beats)
    dev = np.array([np.min(np.abs(gb - d)) for d in det])
    onsets = librosa.onset.onset_detect(onset_envelope=oenv, sr=sr, hop_length=256, units="time", backtrack=False)
    strength = oenv[librosa.time_to_frames(onsets, sr=sr, hop_length=256)]
    strong = onsets[strength > np.percentile(strength, 70)]
    # The grid against the transients themselves (finer than beat frames):
    # for each grid beat in the groove, the nearest sharp onset.
    hi = librosa.onset.onset_detect(y=m_out, sr=sr, hop_length=64, units="time", backtrack=False)
    groove = [b for b in grid_beats if starts[0] + 4 * bar - 0.01 <= b < starts[1] - 0.01]
    tdev = np.array([np.min(np.abs(hi - b)) for b in groove])
    splice_dev = [round(float(min(abs(s - d) for d in downbeats)) * 1000, 2) for s in starts]
    print(f"edit: {out_dur:.3f}s, {len(downbeats)} bars; detected beats vs grid: median {np.median(dev) * 1000:.1f} ms, max {dev.max() * 1000:.1f} ms ({len(det)} beats)")
    print("splices vs grid downbeats (ms):", splice_dev)
    print(f"groove grid beats vs transients: median {np.median(tdev) * 1000:.1f} ms, max {tdev.max() * 1000:.1f} ms")

    sections = [
        {"name": "intro", "fromBar": 0, "toBar": 4, "feel": "pads, no drums"},
        {"name": "groove", "fromBar": 4, "toBar": 12, "feel": "drums in on bar 4"},
        {"name": "breakdown", "fromBar": 12, "toBar": 14, "feel": "pads, no drums"},
        {"name": "final", "fromBar": 14, "toBar": None, "feel": "the last F rings out, fading"},
    ]
    data = {
        "track": "Love Love Love — HoliznaCC0 (CC0)",
        "sampleRate": sr,
        "duration": round(out_dur, 4),
        "bpm": round(bpm, 4),
        "beat": round(period, 6),
        "bar": round(bar, 6),
        "chords": ["F", "C", "Dm", "Bb"],
        "downbeats": downbeats,
        "beats": grid_beats,
        "detectedBeats": [round(x, 4) for x in det],
        "detectedVsGridMs": {"median": round(float(np.median(dev) * 1000), 2), "max": round(float(dev.max() * 1000), 2)},
        "strongOnsets": [round(x, 4) for x in strong],
        "sections": sections,
        "edit": edit_map,
        "spliceVsGridMs": splice_dev,
        "grooveGridVsTransientsMs": {"median": round(float(np.median(tdev) * 1000), 2), "max": round(float(tdev.max() * 1000), 2)},
    }
    json.dump(data, open(OUT_JSON, "w"), indent=1)
    print("wrote", OUT_WAV, "and", OUT_JSON)


if __name__ == "__main__":
    main()
