//go:build !windows

package localpty

import (
	"errors"
	"testing"
)

func TestUnsupportedPlatform(t *testing.T) {
	if _, err := Start("unused", nil, "", nil, 80, 24); !errors.Is(err, ErrUnsupported) {
		t.Fatalf("got %v", err)
	}
}
