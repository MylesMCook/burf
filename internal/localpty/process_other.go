//go:build !windows

package localpty

type Process struct{}

func Start(string, []string, string, []string, int, int) (*Process, error) {
	return nil, ErrUnsupported
}
func (*Process) Read([]byte) (int, error)  { return 0, ErrUnsupported }
func (*Process) Write([]byte) (int, error) { return 0, ErrUnsupported }
func (*Process) Resize(int, int) error     { return ErrUnsupported }
func (*Process) Wait() error               { return ErrUnsupported }
func (*Process) Close() error              { return nil }
func (*Process) PID() int                  { return 0 }
