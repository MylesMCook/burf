package box

import (
	"context"
	"net/http"
	"net/url"
	"strconv"
)

// WithCaller is c making its calls for session: work they start reports
// back to it. An empty session is c as it is.
func (c *Client) WithCaller(session string) *Client {
	if session == "" {
		return c
	}
	cc := *c
	cc.Caller = session
	return &cc
}

// Forget drops the caller's watch on a turn, run or session: it saw the
// work end itself, so it need not be told.
func (c *Client) Forget(ctx context.Context, id string) error {
	if c.Caller == "" {
		return nil
	}
	return c.call(ctx, http.MethodDelete, "/v1/notify/"+url.PathEscape(id), nil, nil)
}

// Watches lists who hears back about what.
func (c *Client) Watches(ctx context.Context) (out []Watch, err error) {
	return out, c.call(ctx, http.MethodGet, "/v1/notify", nil, &out)
}

// SessionOfPid names the berth session whose pane runs pid or one of its
// ancestors, or "" for none.
func (c *Client) SessionOfPid(ctx context.Context, pid int) (string, error) {
	var out struct {
		Session string `json:"session"`
	}
	err := c.call(ctx, http.MethodGet, "/v1/notify/caller?pid="+strconv.Itoa(pid), nil, &out)
	return out.Session, err
}
