#!/usr/bin/env python3
"""Merge a platform's entries into the app's update feed, latest.json.

    scripts/merge-feed.py FEED FRAGMENT [--assets NAMES_FILE] > merged.json

FEED is the release's latest.json as the Mac job wrote it
(scripts/mac-release.sh): version, notes, pub_date and the darwin platforms.
FRAGMENT is another job's entries for the same version, such as the Linux
app's latest-linux.json (scripts/linux-release.sh): {"version", "platforms"}.

The merged feed keeps everything FEED has, in its order, and sets the
fragment's platforms after it (replacing the same platforms from an earlier
run). It refuses, and writes nothing, when the two are for different
versions, when the fragment would replace a Mac platform (darwin-*), or,
given --assets (the release's asset names, one per line), when an entry
points at an asset the release does not have: a feed must never announce an
archive that is not there. Merging again (a re-run) gives the same feed.
"""

import json
import sys
from urllib.parse import urlparse


def die(msg):
    print(f"merge-feed: {msg}", file=sys.stderr)
    sys.exit(1)


def merge(feed, fragment, assets=None):
    version = feed.get("version")
    if not version:
        die("the feed has no version")
    if fragment.get("version") != version:
        die(f"the feed is for {version} but the fragment for {fragment.get('version')}")
    platforms = fragment.get("platforms") or {}
    if not platforms:
        die("the fragment has no platforms")
    for name, entry in platforms.items():
        if name.startswith("darwin-"):
            die(f"the fragment would replace {name}, which the Mac job writes")
        if not entry.get("signature") or not entry.get("url"):
            die(f"{name} has no signature or url")
        if assets is not None:
            asset = urlparse(entry["url"]).path.rsplit("/", 1)[-1]
            if asset not in assets:
                die(f"{name} points at {asset}, which the release does not have (yet)")
    merged = dict(feed)
    merged["platforms"] = {k: v for k, v in feed.get("platforms", {}).items() if k not in platforms}
    merged["platforms"].update(platforms)
    return merged


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    assets = None
    if "--assets" in argv:
        i = argv.index("--assets")
        if i + 1 >= len(argv):
            die("--assets needs a file")
        with open(argv[i + 1]) as f:
            assets = {line.strip() for line in f if line.strip()}
        args = [a for a in args if a != argv[i + 1]]
    if len(args) != 2:
        die("usage: merge-feed.py FEED FRAGMENT [--assets NAMES_FILE]")
    with open(args[0]) as f:
        feed = json.load(f)
    with open(args[1]) as f:
        fragment = json.load(f)
    json.dump(merge(feed, fragment, assets), sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main(sys.argv[1:])
