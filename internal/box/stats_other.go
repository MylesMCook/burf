//go:build !darwin

package box

func nativeStats() (Stats, bool) { return Stats{}, false }
