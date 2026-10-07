package box

import (
	"context"
	"io"
	"net"
	"net/http"
)

// Local reaches berthd on the box through its Unix socket.
type Local struct{ http *http.Client }

func NewLocal(socket string) *Local {
	return &Local{http: &http.Client{Transport: &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, "unix", socket)
		},
	}}}
}

func (l *Local) DoWithHeader(ctx context.Context, method, path string, body io.Reader, header http.Header) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, "http://berthd"+path, body)
	if err != nil {
		return nil, err
	}
	for k, v := range header {
		req.Header[k] = v
	}
	return l.http.Do(req)
}
