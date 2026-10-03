package agent

import "testing"

func TestKitLinksWithoutASchemeAreWebLinks(t *testing.T) {
	cases := map[string]string{
		"github.com/sean-brydon/berth-kit-calcom":         "https://github.com/sean-brydon/berth-kit-calcom",
		"gist.github.com/me/abc123":                       "https://gist.github.com/me/abc123",
		"https://github.com/sean-brydon/berth-kit-calcom": "https://github.com/sean-brydon/berth-kit-calcom",
		"/Users/me/kits/cal":                              "/Users/me/kits/cal",
		"~/kits/cal":                                      "~/kits/cal",
		"git@github.com:me/kit.git":                       "git@github.com:me/kit.git",
	}
	for in, want := range cases {
		if got := withScheme(in); got != want {
			t.Errorf("withScheme(%q) = %q, want %q", in, got, want)
		}
	}
}
