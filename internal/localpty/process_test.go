package localpty

import "testing"

func TestTerminalDimensions(t *testing.T) {
	for _, size := range [][2]int{{0, 24}, {80, 0}, {-1, 24}, {1001, 24}, {80, 1001}} {
		if validSize(size[0], size[1]) == nil {
			t.Errorf("accepted %v", size)
		}
	}
	for _, size := range [][2]int{{1, 1}, {80, 24}, {1000, 1000}} {
		if err := validSize(size[0], size[1]); err != nil {
			t.Errorf("rejected %v: %v", size, err)
		}
	}
}
