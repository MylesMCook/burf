package agent

import (
	"errors"
	"os"
	"unsafe"

	"golang.org/x/sys/windows"
)

func openClientUIFile(root *os.Root, name string) (*os.File, error) {
	info, err := root.Lstat(name)
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() {
		return nil, errors.New("desktop state must be a regular file")
	}
	return clientUINativeFile(root, name, windows.FILE_GENERIC_READ|windows.FILE_READ_ATTRIBUTES, windows.FILE_OPEN, nil)
}

func createClientUIFile(root *os.Root, name string) (*os.File, error) {
	user, err := windows.GetCurrentProcessToken().GetTokenUser()
	if err != nil {
		return nil, err
	}
	sd, err := windows.SecurityDescriptorFromString("O:" + user.User.Sid.String() + "D:P(A;;FA;;;SY)(A;;FA;;;" + user.User.Sid.String() + ")")
	if err != nil {
		return nil, err
	}
	// Supply the private ACL at creation, before any bytes reach the file.
	return clientUINativeFile(root, name, windows.FILE_GENERIC_WRITE, windows.FILE_CREATE, sd)
}

func clientUINativeFile(root *os.Root, name string, access, disposition uint32, sd *windows.SECURITY_DESCRIPTOR) (*os.File, error) {
	dir, err := root.Open(".")
	if err != nil {
		return nil, err
	}
	defer dir.Close()
	path, err := windows.NewNTUnicodeString(name)
	if err != nil {
		return nil, err
	}
	attributes := &windows.OBJECT_ATTRIBUTES{
		Length:        uint32(unsafe.Sizeof(windows.OBJECT_ATTRIBUTES{})),
		RootDirectory: windows.Handle(dir.Fd()), ObjectName: path,
		Attributes:         windows.OBJ_CASE_INSENSITIVE | windows.OBJ_DONT_REPARSE,
		SecurityDescriptor: sd,
	}
	var handle windows.Handle
	var result windows.IO_STATUS_BLOCK
	err = windows.NtCreateFile(&handle, access,
		attributes, &result, nil, windows.FILE_ATTRIBUTE_NORMAL,
		windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE,
		disposition, windows.FILE_NON_DIRECTORY_FILE|windows.FILE_SYNCHRONOUS_IO_NONALERT|windows.FILE_OPEN_REPARSE_POINT, 0, 0)
	if err != nil {
		return nil, errors.New("could not open regular desktop state file")
	}
	return os.NewFile(uintptr(handle), name), nil
}

func clientUIOwner(file *os.File) error {
	user, err := windows.GetCurrentProcessToken().GetTokenUser()
	if err != nil {
		return err
	}
	sd, err := windows.GetSecurityInfo(windows.Handle(file.Fd()), windows.SE_FILE_OBJECT, windows.OWNER_SECURITY_INFORMATION|windows.DACL_SECURITY_INFORMATION)
	if err != nil {
		return err
	}
	owner, _, err := sd.Owner()
	if err != nil {
		return err
	}
	if !owner.Equals(user.User.Sid) {
		return errors.New("desktop state must belong to this account")
	}
	info, err := file.Stat()
	if err != nil {
		return err
	}
	if !info.IsDir() {
		return clientUIPrivateACL(sd, user.User.Sid)
	}
	return nil
}

func clientUIPrivateACL(sd *windows.SECURITY_DESCRIPTOR, owner *windows.SID) error {
	dacl, _, err := sd.DACL()
	if err != nil || dacl == nil {
		return errors.New("desktop state must have a private ACL")
	}
	for index := uint32(0); index < uint32(dacl.AceCount); index++ {
		var ace *windows.ACCESS_ALLOWED_ACE
		if err := windows.GetAce(dacl, index, &ace); err != nil {
			return err
		}
		if ace.Header.AceType == windows.ACCESS_DENIED_ACE_TYPE {
			continue
		}
		if ace.Header.AceType != windows.ACCESS_ALLOWED_ACE_TYPE {
			return errors.New("desktop state has an unsupported ACL")
		}
		sid := (*windows.SID)(unsafe.Pointer(&ace.SidStart))
		if ace.Mask != 0 && !sid.Equals(owner) && !sid.IsWellKnown(windows.WinLocalSystemSid) {
			return errors.New("desktop state must be private to this account")
		}
	}
	return nil
}
