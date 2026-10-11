package box

import (
	"encoding/binary"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"testing"
	"time"
)

func vmStatFixture(pageSize uint64) string {
	return fmt.Sprintf(`Mach Virtual Memory Statistics: (page size of %d bytes)
Pages free:                                  30.
Pages active:                                99.
Pages inactive:                              70.
Pages speculative:                           10.
Pages wired down:                            20.
Pages purgeable:                             10.
File-backed pages:                           80.
Anonymous pages:                            100.
Pages stored in compressor:                 300.
Pages occupied by compressor:                40.
`, pageSize)
}

func TestReadDarwinStats(t *testing.T) {
	t.Parallel()
	now := time.Unix(20000, 0)
	failed := errors.New("native read failed")
	cases := []struct {
		name string
		fail string
		boot time.Time
	}{
		{name: "native counters", boot: now.Add(-3600 * time.Second)},
		{name: "missing memory total", fail: "memory", boot: now.Add(-3600 * time.Second)},
		{name: "missing page counts", fail: "vm", boot: now.Add(-3600 * time.Second)},
		{name: "missing load", fail: "vm.loadavg", boot: now.Add(-3600 * time.Second)},
		{name: "missing swap", fail: "vm.swapusage", boot: now.Add(-3600 * time.Second)},
		{name: "missing boot", fail: "boot"},
		{name: "future boot", boot: now.Add(time.Second)},
		{name: "zero boot"},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			vmReads := 0
			source := darwinStatsSource{
				memsize: func() (uint64, error) {
					if tt.fail == "memory" {
						return 0, failed
					}
					return 1000 * 4096, nil
				},
				raw: func(name string) ([]byte, error) {
					if tt.fail == name {
						return nil, failed
					}
					if name == "vm.loadavg" {
						return loadFixture(), nil
					}
					return swapFixture(1000, 200), nil
				},
				boot: func() (time.Time, error) {
					if tt.fail == "boot" {
						return time.Time{}, failed
					}
					return tt.boot, nil
				},
				vm: func() ([]byte, error) {
					vmReads++
					if tt.fail == "vm" {
						return nil, failed
					}
					return []byte(vmStatFixture(4096)), nil
				},
			}
			got := readDarwinStats(source, now)
			wantMemory := Usage{Total: 1000 * 4096, Used: 150 * 4096}
			if tt.fail == "memory" || tt.fail == "vm" {
				wantMemory = Usage{}
			}
			if got.Memory != wantMemory {
				t.Errorf("memory = %+v, want %+v", got.Memory, wantMemory)
			}
			if tt.fail == "memory" && vmReads != 0 {
				t.Error("read VM pages without a physical memory total")
			}
			wantSwap := Usage{Total: 1000, Used: 200}
			if tt.fail == "vm.swapusage" {
				wantSwap = Usage{}
			}
			if got.Swap != wantSwap {
				t.Errorf("swap = %+v, want %+v", got.Swap, wantSwap)
			}
			if tt.fail == "vm.loadavg" {
				if got.Load != nil {
					t.Errorf("unavailable load = %v, want nil", got.Load)
				}
			} else if !reflect.DeepEqual(got.Load, []float64{0.5, 1.25, 2}) {
				t.Errorf("load = %v", got.Load)
			}
			wantUptime := int64(3600)
			if tt.fail == "boot" || tt.boot.IsZero() || tt.boot.After(now) {
				wantUptime = 0
			}
			if got.Uptime != wantUptime {
				t.Errorf("uptime = %d, want %d", got.Uptime, wantUptime)
			}
		})
	}
}

func TestDarwinMemory(t *testing.T) {
	t.Parallel()
	for _, pageSize := range []uint64{4096, 16384} {
		t.Run(fmt.Sprintf("%d-byte pages", pageSize), func(t *testing.T) {
			t.Parallel()
			got := darwinMemory(1000*pageSize, vmStatFixture(pageSize))
			want := Usage{Total: 1000 * pageSize, Used: 150 * pageSize}
			if got != want {
				t.Fatalf("memory = %+v, want %+v; cache and uncompressed pages are excluded", got, want)
			}
		})
	}
	valid := vmStatFixture(4096)
	cases := []struct {
		name   string
		total  uint64
		output string
	}{
		{name: "zero total", output: valid},
		{name: "empty output", total: 1000 * 4096},
		{name: "missing size", total: 1000 * 4096, output: strings.Replace(valid, "(page size of 4096 bytes)", "", 1)},
		{name: "zero size", total: 1000 * 4096, output: vmStatFixture(0)},
		{name: "missing anonymous", total: 1000 * 4096, output: strings.Replace(valid, "Anonymous pages:", "Unknown:", 1)},
		{name: "invalid pages", total: 1000 * 4096, output: strings.Replace(valid, "100.", "unknown.", 1)},
		{name: "negative pages", total: 1000 * 4096, output: strings.Replace(valid, "100.", "-1.", 1)},
		{name: "overflow pages", total: 1000 * 4096, output: strings.Replace(valid, "100.", "18446744073709551615.", 1)},
		{name: "duplicate field", total: 1000 * 4096, output: valid + "Anonymous pages: 100.\n"},
		{name: "purgeable exceeds anonymous", total: 1000 * 4096, output: strings.Replace(valid, "100.", "1.", 1)},
		{name: "usage exceeds total", total: 149 * 4096, output: valid},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := darwinMemory(tt.total, tt.output); got != (Usage{}) {
				t.Fatalf("invalid reading reported %+v, want unavailable", got)
			}
		})
	}
}

func swapFixture(total, used uint64) []byte {
	raw := make([]byte, 32)
	binary.NativeEndian.PutUint64(raw[:8], total)
	binary.NativeEndian.PutUint64(raw[8:16], total-used)
	binary.NativeEndian.PutUint64(raw[16:24], used)
	binary.NativeEndian.PutUint32(raw[24:28], 16384)
	return raw
}

func TestDarwinSwap(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name string
		raw  []byte
		want Usage
	}{
		{name: "byte counts", raw: swapFixture(3<<30, 1<<30), want: Usage{Total: 3 << 30, Used: 1 << 30}},
		{name: "no allocated swap", raw: swapFixture(0, 0)},
		{name: "short reading", raw: []byte{0}},
		{name: "changed layout", raw: make([]byte, 40)},
		{name: "used exceeds total", raw: swapFixture(1, 2)},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := darwinSwap(tt.raw); got != tt.want {
				t.Fatalf("swap = %+v, want %+v", got, tt.want)
			}
		})
	}
}

func loadFixture() []byte {
	raw := make([]byte, 24)
	for i, fixed := range []uint32{1024, 2560, 4096} {
		binary.NativeEndian.PutUint32(raw[i*4:i*4+4], fixed)
	}
	binary.NativeEndian.PutUint64(raw[16:24], 2048)
	return raw
}

func TestDarwinLoad(t *testing.T) {
	t.Parallel()
	negativeScale := loadFixture()
	binary.NativeEndian.PutUint64(negativeScale[16:24], 1<<63)
	cases := []struct {
		name string
		raw  []byte
		want []float64
	}{
		{name: "kernel scaling", raw: loadFixture(), want: []float64{0.5, 1.25, 2}},
		{name: "zero loads", raw: append(make([]byte, 16), loadFixture()[16:]...), want: []float64{0, 0, 0}},
		{name: "zero scale", raw: make([]byte, 24)},
		{name: "negative scale", raw: negativeScale},
		{name: "short reading", raw: []byte{0}},
		{name: "changed layout", raw: make([]byte, 32)},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := darwinLoad(tt.raw); !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("load = %v, want %v", got, tt.want)
			}
		})
	}
}
