//go:build burf_inventory_proof

package inventory

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// TestInventoryLiveProof is explicitly opt-in and never manages services.
// It prints only coverage and counts, keeping resource details local.
func TestInventoryLiveProof(t *testing.T) {
	if os.Getenv("BURF_INVENTORY_PROOF") != "1" {
		t.Skip("set BURF_INVENTORY_PROOF=1 for read-only collection proof")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 40*time.Second)
	defer cancel()
	goos, target := os.Getenv("BURF_INVENTORY_OS"), os.Getenv("BURF_INVENTORY_SSH")
	collections := Collect(ctx, goos, target)
	s, err := Open(ctx, filepath.Join(t.TempDir(), "inventory.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	m, err := s.Register(ctx, Machine{Name: "Read-only proof", OS: goos, Routes: []Route{{Kind: "local"}}})
	if err != nil {
		t.Fatal(err)
	}
	if err = s.Apply(ctx, m.ID, collections, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
	ok := false
	for _, c := range collections {
		t.Logf("source=%s coverage=%s services=%d", c.Source, c.State, len(c.Services))
		if c.State == "ok" {
			ok = true
		}
	}
	if !ok {
		t.Fatal("no collector established complete coverage")
	}
}
