package integrations

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"unsafe"

	"golang.org/x/sys/windows"
)

func openNoFollow(root *os.Root, name string, perm fs.FileMode) (*os.File, error) {
	f, err := openAccountFile(root, name, windows.FILE_GENERIC_WRITE|windows.FILE_READ_ATTRIBUTES, windows.FILE_OPEN_IF)
	if err != nil {
		return nil, err
	}
	if err := f.Truncate(0); err != nil {
		f.Close()
		return nil, err
	}
	return f, nil
}

func readNoFollow(root *os.Root, name string) (*os.File, error) {
	return openAccountFile(root, name, windows.FILE_GENERIC_READ|windows.FILE_READ_ATTRIBUTES, windows.FILE_OPEN)
}

// Open relative to the trusted root without traversing reparse points.
func openAccountFile(root *os.Root, name string, access, disposition uint32) (*os.File, error) {
	dir, err := root.Open(".")
	if err != nil {
		return nil, err
	}
	defer dir.Close()
	path, err := windows.NewNTUnicodeString(filepath.FromSlash(name))
	if err != nil {
		return nil, err
	}
	oa := &windows.OBJECT_ATTRIBUTES{
		Length:        uint32(unsafe.Sizeof(windows.OBJECT_ATTRIBUTES{})),
		RootDirectory: windows.Handle(dir.Fd()),
		ObjectName:    path,
		Attributes:    windows.OBJ_CASE_INSENSITIVE | windows.OBJ_DONT_REPARSE,
	}
	var handle windows.Handle
	var iosb windows.IO_STATUS_BLOCK
	// Resolve relative to the opened root and reject every reparse point.
	// Open without truncating until the handle is known to be a regular file.
	err = windows.NtCreateFile(&handle, access,
		oa, &iosb, nil, windows.FILE_ATTRIBUTE_NORMAL,
		windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE,
		disposition, windows.FILE_NON_DIRECTORY_FILE|windows.FILE_SYNCHRONOUS_IO_NONALERT|windows.FILE_OPEN_REPARSE_POINT, 0, 0)
	if err != nil {
		// NtCreateFile returns NTSTATUS, which os.IsNotExist does not
		// recognize. Optional account files must retain that contract.
		if status, ok := err.(windows.NTStatus); ok {
			err = status.Errno()
		}
		return nil, &os.PathError{Op: "open", Path: filepath.Join(root.Name(), name), Err: err}
	}
	f := os.NewFile(uintptr(handle), filepath.Join(root.Name(), name))
	info, err := f.Stat()
	if err != nil || !info.Mode().IsRegular() {
		f.Close()
		if err != nil {
			return nil, err
		}
		return nil, fmt.Errorf("%s is not a regular file", name)
	}
	return f, nil
}
