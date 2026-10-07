//go:build !linux && !darwin

package box

func scanProcs(marks ...string) ([]proc, error) { return nil, errNoProcs }
