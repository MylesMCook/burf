//go:build !unix

package debugserver

const (
	self     = 0
	children = 1
)

func cpuSeconds(int) float64 { return 0 }
