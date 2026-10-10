//go:build !unix

package uibundle

import "os"

func openDiskAsset(root *os.Root, name string) (*os.File, error) { return root.Open(name) }
