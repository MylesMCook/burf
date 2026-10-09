package agent

import "testing"

func TestNewerRelease(t *testing.T) {
	for _, c := range []struct {
		a, b string
		want bool
	}{
		{"v0.2.0", "v0.1.9", true},
		{"v0.10.0", "v0.9.0", true},
		{"v1.0.0", "v1.0.0", false},
		{"v0.1.0", "v0.2.0", false},
		{"dev", "v0.1.0", false},
		{"v0.1.0", "dev", false},
		{"v0.1", "v0.0.1", false},
	} {
		if got := newerRelease(c.a, c.b); got != c.want {
			t.Errorf("newerRelease(%q, %q) = %v", c.a, c.b, got)
		}
	}
}
