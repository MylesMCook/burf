//go:build !linux && !darwin

package box

const snapHasPercent = true

func snapshotProcs() ([]procStat, error) { return nil, errNoProcs }
