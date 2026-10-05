#!/bin/sh
# Cuts the page's section loops (site/assets/loops/) from the launch film's
# sources: the app's recorded footage (60 fps 2560x1600 JPEG frames, one
# folder per shot). The night ("It keeps going") is the hero's own loop,
# assets/film/hero-loop.mp4, so it costs nothing more. Each loop is a
# muted H.264 MP4 at 1600x1000, 30 fps, about 4-8 s, whose end crossfades
# into its start, so it loops without a seam. The posters (the loop's first
# frame, as WebP) are made by site/scripts/posters.mjs.
#
#   FOOTAGE=/path/to/film/footage sh site/scripts/loops.sh
#
# Needs ffmpeg with libx264.
set -eu
: "${FOOTAGE:?FOOTAGE is the footage folder of the film (s02, s04, ...)}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/assets/loops"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"
X=0.5 # the crossfade from the end back into the start, in seconds
ENC="-c:v libx264 -preset slower -crf 25 -tune animation -pix_fmt yuv420p -movflags +faststart -an"

# seam IN OUT: plays IN from X, and crossfades its last X seconds into its
# first X, so the loop's last frame leads into its first.
seam() {
  len=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$1")
  ffmpeg -v error -y -i "$1" -filter_complex \
    "[0:v]split[a][b];[a]trim=start=$X,setpts=PTS-STARTPTS[body];[b]trim=0:$X,setpts=PTS-STARTPTS[head];[body][head]xfade=transition=fade:duration=$X:offset=$(echo "$len - 2*$X" | bc)" \
    $ENC "$2"
}

# frames SHOT FIRST COUNT OUT: a run of a shot's frames, at 30 fps, 1600x1000.
frames() {
  ffmpeg -v error -y -framerate 60 -start_number "$2" -i "$FOOTAGE/$1/f%05d.jpg" -frames:v "$3" \
    -vf "fps=30,scale=1600:1000:flags=lanczos" -c:v libx264 -preset fast -crf 12 -pix_fmt yuv420p -an "$4"
}

# Start: ⌘N, one line, Start, and the agent's workspace opens.
frames s02 0 492 "$TMP/start.mp4" && seam "$TMP/start.mp4" "$OUT/start.mp4"
# Watch it work: steps then a diff; Claude's questions answered in place; artifacts.
frames s04 0 516 "$TMP/steps.mp4" && seam "$TMP/steps.mp4" "$OUT/steps.mp4"
frames s05 0 480 "$TMP/ask.mp4" && seam "$TMP/ask.mp4" "$OUT/ask.mp4"
frames s06 0 360 "$TMP/artifacts.mp4" && seam "$TMP/artifacts.mp4" "$OUT/artifacts.mp4"
# Side by side: two worktrees as tab groups, split into one tab.
frames s07 0 432 "$TMP/groups.mp4" && seam "$TMP/groups.mp4" "$OUT/groups.mp4"
# Make it yours: four themes, 1.4 s each, then a chat background.
for t in berth-dark dracula catppuccin-latte tokyo-night; do frames "s09-$t" 0 84 "$TMP/t-$t.mp4"; done
frames s09-bg 60 156 "$TMP/t-bg.mp4"
printf "file '%s'\n" "$TMP/t-berth-dark.mp4" "$TMP/t-dracula.mp4" "$TMP/t-catppuccin-latte.mp4" "$TMP/t-tokyo-night.mp4" "$TMP/t-bg.mp4" > "$TMP/themes.txt"
ffmpeg -v error -y -f concat -safe 0 -i "$TMP/themes.txt" -c copy "$TMP/themes.mp4"
seam "$TMP/themes.mp4" "$OUT/themes.mp4"
ls -l "$OUT"
