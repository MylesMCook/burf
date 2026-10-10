//go:build !darwin

package desktop

func signedLike(_, _ string) bool { return true }
