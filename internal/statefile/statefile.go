// Package statefile reads and writes berth's private state: keys, trust
// stores, and pending pairing codes.
package statefile

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
)

// Home returns the state directory: BERTH_HOME when set, otherwise the OS
// user config directory plus "berth".
func Home() (string, error) {
	if dir := os.Getenv("BERTH_HOME"); dir != "" {
		if !filepath.IsAbs(dir) {
			return "", fmt.Errorf("BERTH_HOME must be an absolute path")
		}
		return dir, nil
	}
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, "berth"), nil
}

// UserDir is where people keep what they write for berth by hand: hooks,
// themes, task templates, and plugins. BERTH_USER_DIR overrides ~/.berth.
func UserDir() (string, error) {
	if dir := os.Getenv("BERTH_USER_DIR"); dir != "" {
		if !filepath.IsAbs(dir) {
			return "", fmt.Errorf("BERTH_USER_DIR must be an absolute path")
		}
		return dir, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".berth"), nil
}

// Write replaces path atomically, so a crash or a concurrent reader never
// observes a partial file. Files are private to the owner.
func Write(path string, data []byte) error {
	dir := filepath.Dir(path)
	if err := makePrivateDirs(dir); err != nil {
		return err
	}
	f, err := createPrivateTemp(dir, "."+filepath.Base(path)+"-")
	if err != nil {
		return err
	}
	tmp := f.Name()
	defer os.Remove(tmp)
	if err = f.Chmod(0o600); err == nil {
		_, err = f.Write(data)
	}
	if err == nil {
		err = f.Sync()
	}
	if closeErr := f.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		return err
	}
	return replaceFile(tmp, path)
}

// WriteWithBackup keeps the previous contents at path+".bak" whenever they
// change. Trust stores are the only record of who may connect; a bad write
// must stay recoverable.
func WriteWithBackup(path string, data []byte) error {
	previous, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	if len(previous) > 0 && !bytes.Equal(previous, data) {
		if err := Write(path+".bak", previous); err != nil {
			return err
		}
	}
	return Write(path, data)
}

// Lock takes an exclusive lock shared by every process using path, so a
// read-modify-write by the daemon and the CLI cannot interleave.
func Lock(path string) (unlock func(), err error) {
	unlock, _, err = lock(path, false)
	return unlock, err
}

// TryLock takes the same lock as Lock without waiting for another process.
// A held lock returns acquired=false; filesystem errors remain errors.
func TryLock(path string) (unlock func(), acquired bool, err error) {
	return lock(path, true)
}

func lock(path string, nonblocking bool) (func(), bool, error) {
	if err := makePrivateDirs(filepath.Dir(path)); err != nil {
		return nil, false, err
	}
	f, err := os.OpenFile(path+".lock", os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return nil, false, err
	}
	unlock, acquired, err := lockFile(f, nonblocking)
	if err != nil || !acquired {
		f.Close()
		return nil, acquired, err
	}
	return func() { unlock(); f.Close() }, true, nil
}

// EnsurePrivateDir secures an application-owned directory. It must not be
// used on shared parents such as the user's home or config directory.
func EnsurePrivateDir(dir string) error {
	if err := makePrivateDirs(dir); err != nil {
		return err
	}
	return privateDir(dir)
}

// Private restricts an application-owned file or socket to its owner.
func Private(path string) error { return privateFile(path) }
