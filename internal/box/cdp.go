package box

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sync"
)

// A Chrome DevTools Protocol client over --remote-debugging-pipe: Chromium
// reads commands on fd 3 and writes replies and events on fd 4, each a JSON
// message ended by a NUL. Over a pipe there is no debugging port for any
// other process on the box (an agent included) to attach to: berthd holds
// the only handle, and every output an agent sees goes through its caps.

type cdpConn struct {
	w io.WriteCloser
	r *bufio.Reader

	mu      sync.Mutex
	next    int64
	pending map[int64]chan cdpReply
	onEvent func(method, session string, params json.RawMessage)
	closed  chan struct{}
	err     error
}

type cdpReply struct {
	Result json.RawMessage
	Err    error
}

type cdpMessage struct {
	ID        int64           `json:"id,omitempty"`
	Method    string          `json:"method,omitempty"`
	SessionID string          `json:"sessionId,omitempty"`
	Params    json.RawMessage `json:"params,omitempty"`
	Result    json.RawMessage `json:"result,omitempty"`
	Error     *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func newCDP(w io.WriteCloser, r io.Reader, onEvent func(method, session string, params json.RawMessage)) *cdpConn {
	c := &cdpConn{w: w, r: bufio.NewReaderSize(r, 1<<16), pending: map[int64]chan cdpReply{}, onEvent: onEvent, closed: make(chan struct{})}
	go c.readLoop()
	return c
}

// maxCDPMessage bounds one message read (a full-page screenshot is large).
const maxCDPMessage = 64 << 20

func (c *cdpConn) readLoop() {
	defer func() {
		c.mu.Lock()
		if c.err == nil {
			c.err = errors.New("the browser closed")
		}
		for id, ch := range c.pending {
			ch <- cdpReply{Err: c.err}
			delete(c.pending, id)
		}
		c.mu.Unlock()
		close(c.closed)
	}()
	for {
		raw, err := c.r.ReadBytes(0)
		if err != nil {
			return
		}
		if len(raw) > maxCDPMessage {
			continue
		}
		raw = raw[:len(raw)-1]
		var m cdpMessage
		if json.Unmarshal(raw, &m) != nil {
			continue
		}
		if m.ID != 0 {
			c.mu.Lock()
			ch := c.pending[m.ID]
			delete(c.pending, m.ID)
			c.mu.Unlock()
			if ch != nil {
				r := cdpReply{Result: m.Result}
				if m.Error != nil {
					r.Err = fmt.Errorf("%s", m.Error.Message)
				}
				ch <- r
			}
			continue
		}
		if m.Method != "" && c.onEvent != nil {
			c.onEvent(m.Method, m.SessionID, m.Params)
		}
	}
}

// call sends a command (to session, or the browser when "") and waits for
// its reply, or ctx.
func (c *cdpConn) call(ctx context.Context, session, method string, params any, out any) error {
	ch := make(chan cdpReply, 1)
	c.mu.Lock()
	if c.err != nil {
		err := c.err
		c.mu.Unlock()
		return err
	}
	c.next++
	id := c.next
	c.pending[id] = ch
	msg := map[string]any{"id": id, "method": method}
	if params != nil {
		msg["params"] = params
	}
	if session != "" {
		msg["sessionId"] = session
	}
	b, _ := json.Marshal(msg)
	_, err := c.w.Write(append(b, 0))
	c.mu.Unlock()
	if err != nil {
		return err
	}
	select {
	case r := <-ch:
		if r.Err != nil {
			return fmt.Errorf("%s: %w", method, r.Err)
		}
		if out != nil && len(r.Result) > 0 {
			return json.Unmarshal(r.Result, out)
		}
		return nil
	case <-ctx.Done():
		c.mu.Lock()
		delete(c.pending, id)
		c.mu.Unlock()
		return ctx.Err()
	case <-c.closed:
		return errors.New("the browser closed")
	}
}

func (c *cdpConn) close() {
	c.mu.Lock()
	if c.err == nil {
		c.err = errors.New("closed")
	}
	c.mu.Unlock()
	c.w.Close()
}
