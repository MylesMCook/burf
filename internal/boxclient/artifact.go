package boxclient

import (
	"time"
)

// What agents make for a person to look at, and the visual diffs among them,
// as the box answers and the CLI prints them.

// Artifact is one artifact and the versions kept of it.
type Artifact struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Kind     string `json:"kind"`
	Format   string `json:"format"`
	Location string `json:"location"`
	Worktree string `json:"worktree"`
	// Path is the worktree's folder; Source the file it was registered
	// from, and File that file relative to the worktree when it's in it.
	Path    string     `json:"path"`
	Source  string     `json:"source,omitempty"`
	File    string     `json:"file,omitempty"`
	By      ArtifactBy `json:"by"`
	Created time.Time  `json:"created"`
	Updated time.Time  `json:"updated"`
	// Watched: a rewrite of Source becomes a new version.
	Watched bool `json:"watched,omitempty"`
	// Key makes a re-run a new version of this artifact rather than a new
	// one: a visual diff's is visualdiff:<base>.
	Key string `json:"key,omitempty"`
	// Problem is why the source's latest rewrite wasn't taken (it didn't
	// parse, grew too big, looked like a secret); cleared by the next
	// version.
	Problem  string            `json:"problem,omitempty"`
	Versions []ArtifactVersion `json:"versions"`
}

// ArtifactBy is who made an artifact: the berth session (and its agent)
// the command ran in, and a helper's name when a helper said it.
type ArtifactBy struct {
	Session string `json:"session,omitempty"`
	Agent   string `json:"agent,omitempty"`
	Helper  string `json:"helper,omitempty"`
}

// ArtifactVersion is one version kept.
type ArtifactVersion struct {
	N      int       `json:"n"`
	At     time.Time `json:"at"`
	Size   int       `json:"size"`
	SHA256 string    `json:"sha256"`
	Note   string    `json:"note,omitempty"`
}

// Latest is the newest version kept.
func (a Artifact) Latest() ArtifactVersion {
	if len(a.Versions) == 0 {
		return ArtifactVersion{}
	}
	return a.Versions[len(a.Versions)-1]
}

// AddArtifactResult is what an add answers.
type AddArtifactResult struct {
	Artifact Artifact `json:"artifact"`
	// Changed: the content was new (a new version), not a retitle.
	Changed bool `json:"changed"`
	// Added: a new artifact, not a version of one.
	Added bool `json:"added"`
}

// ShotsRequest is what `berthd shots compare` asks for; empty fields come
// from the repository's "shots" config, then the defaults.
type ShotsRequest struct {
	Pages []string `json:"pages,omitempty"`
	Sizes []int    `json:"sizes,omitempty"`
	Mask  []string `json:"mask,omitempty"`
	// Base is main (the default), turn-start, accepted, or a baseline's
	// name.
	Base        string `json:"base,omitempty"`
	ColorScheme string `json:"color_scheme,omitempty"`
	Session     string `json:"session,omitempty"`
	Agent       string `json:"agent,omitempty"`
	Title       string `json:"title,omitempty"`
	Note        string `json:"note,omitempty"`
	New         bool   `json:"new,omitempty"` // a new visual diff, not a new version
	// Save, for `shots baseline`: shoot the worktree only and keep it as
	// this baseline.
	Save string `json:"save,omitempty"`
}

// ShotsResult is the text an agent reads, and where the result is.
type ShotsResult struct {
	Text     string `json:"text"`
	Artifact string `json:"artifact,omitempty"`
	Version  int    `json:"version,omitempty"`
	Dir      string `json:"dir,omitempty"`
}
