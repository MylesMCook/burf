package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/sean-brydon/berthd/internal/agent"
	"github.com/sean-brydon/berthd/internal/wire"
)

// Prompts for boxes that are away wait in the laptop agent's queue
// (docs/guides/offline-queue.mdx). session send --queue puts one there when the box
// cannot be reached; berth queue shows and manages them.

// queueFor returns the hook session send --queue calls for a prompt to box.
// Only a send that never reached the box is queued: one that failed later
// may have arrived, and queueing it could type it twice.
func queueFor(l laptop, boxName string) func(ctx context.Context, session, text string, enter bool, cause error) (string, error) {
	return func(ctx context.Context, session, text string, enter bool, cause error) (string, error) {
		if !wire.Unsent(cause) {
			return "", cause
		}
		c, err := ensureAgent(l)
		if err != nil {
			return "", fmt.Errorf("%v; and the prompt could not be queued: %w", cause, err)
		}
		var it agent.QueueItem
		req := map[string]any{"box": boxName, "session": session, "text": text, "enter": enter}
		if err := c.Call(ctx, http.MethodPost, "/v1/queue", req, &it); err != nil {
			return "", fmt.Errorf("%v; and the prompt could not be queued: %w", cause, err)
		}
		return it.ID, nil
	}
}

const queueUsage = `usage: berth queue [--json]       Prompts waiting for their box
       berth queue rm ID          Discard one
       berth queue retry ID       Put a failed one back in line
       berth queue send ID        Send one now, without waiting for the agent's turn to end`

func queueCmd(l laptop, args []string) error {
	sub := "list"
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		sub, args = args[0], args[1:]
	}
	_, asJSON, err := flags("queue", args, nil)
	if err != nil {
		return errors.New(queueUsage)
	}
	pos := positional(args)
	c, err := ensureAgent(l)
	if err != nil {
		return err
	}
	ctx := context.Background()
	switch sub {
	case "list", "ls":
		var items []agent.QueueItem
		if err := c.Call(ctx, http.MethodGet, "/v1/queue", nil, &items); err != nil {
			return err
		}
		if asJSON {
			return printJSON(items)
		}
		if len(items) == 0 {
			fmt.Println("Nothing queued. berth session send BOX/NAME TEXT --queue queues a prompt when its box is away.")
			return nil
		}
		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "ID\tTO\tAGE\tSTATE\tPROMPT")
		for _, it := range items {
			state := it.State
			if it.Blocked {
				state += " (behind a failed one)"
			}
			fmt.Fprintf(w, "%s\t%s/%s\t%s\t%s\t%s\n", it.ID, it.Box, it.Session, age(time.Since(it.Created)), state, preview(it.Text, 48))
		}
		w.Flush()
		for _, it := range items {
			if it.Error != "" {
				fmt.Printf("\n%s: %s", it.ID, it.Error)
			}
		}
		if hasError(items) {
			fmt.Println()
		}
		return nil
	case "rm", "remove", "discard":
		if len(pos) != 1 {
			return errors.New(queueUsage)
		}
		var it agent.QueueItem
		if err := c.Call(ctx, http.MethodDelete, "/v1/queue/"+url.PathEscape(pos[0]), nil, &it); err != nil {
			return err
		}
		fmt.Printf("Discarded the prompt for %s/%s\n", it.Box, it.Session)
		return nil
	case "retry":
		if len(pos) != 1 {
			return errors.New(queueUsage)
		}
		var it agent.QueueItem
		if err := c.Call(ctx, http.MethodPost, "/v1/queue/"+url.PathEscape(pos[0])+"/retry", nil, &it); err != nil {
			return err
		}
		fmt.Printf("Back in line for %s/%s\n", it.Box, it.Session)
		return nil
	case "send":
		if len(pos) != 1 {
			return errors.New(queueUsage)
		}
		var it agent.QueueItem
		if err := c.Call(ctx, http.MethodPost, "/v1/queue/"+url.PathEscape(pos[0])+"/send", nil, &it); err != nil {
			return err
		}
		if asJSON {
			return printJSON(it)
		}
		switch it.State {
		case agent.QueueDelivered:
			fmt.Printf("Sent to %s/%s\n", it.Box, it.Session)
		case agent.QueueFailed:
			return errors.New(it.Error)
		default:
			fmt.Printf("%s could not be reached; it stays queued\n", it.Box)
		}
		return nil
	}
	return errors.New(queueUsage)
}

// positional drops flags (none of queue's take values).
func positional(args []string) []string {
	var out []string
	for _, a := range args {
		if !strings.HasPrefix(a, "-") {
			out = append(out, a)
		}
	}
	return out
}

func hasError(items []agent.QueueItem) bool {
	for _, it := range items {
		if it.Error != "" {
			return true
		}
	}
	return false
}

func preview(s string, n int) string {
	s = strings.Join(strings.Fields(s), " ")
	if r := []rune(s); len(r) > n {
		return string(r[:n-1]) + "…"
	}
	return s
}

func age(d time.Duration) string {
	switch {
	case d < time.Minute:
		return "just now"
	case d < time.Hour:
		return fmt.Sprintf("%dm", int(d.Minutes()))
	case d < 48*time.Hour:
		return fmt.Sprintf("%dh", int(d.Hours()))
	}
	return fmt.Sprintf("%dd", int(d.Hours()/24))
}
