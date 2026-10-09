package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"text/tabwriter"
	"time"

	"github.com/MylesMCook/burf/internal/agent"
)

// A browser extension pairs with this computer's Burf through a one-time
// code, and gets a credential that opens only chats and their browser tools
// (internal/agent/browserpair.go).

const browserUsage = `usage: burf browser pair         Print a one-time code to type into the browser extension
       burf browser list [--json] The browsers paired with this computer
       burf browser revoke ID     End a paired browser's access`

func browserCmd(l laptop, args []string) error {
	if len(args) == 0 {
		return errors.New(browserUsage)
	}
	c, err := ensureAgent(l)
	if err != nil {
		return err
	}
	ctx := context.Background()
	switch {
	case args[0] == "pair" && len(args) == 1:
		var out struct {
			Code      string    `json:"code"`
			ExpiresAt time.Time `json:"expires_at"`
		}
		if err := c.Call(ctx, http.MethodPost, "/v1/browser/pairing", nil, &out); err != nil {
			return err
		}
		fmt.Printf("%s\n\nType this code into the Burf browser extension. It works once, until %s.\n", out.Code, out.ExpiresAt.Local().Format("15:04"))
		return nil
	case args[0] == "list" && (len(args) == 1 || len(args) == 2 && args[1] == "--json"):
		var out struct {
			Pairings []agent.BrowserPairing `json:"pairings"`
		}
		if err := c.Call(ctx, http.MethodGet, "/v1/browser/pairings", nil, &out); err != nil {
			return err
		}
		if len(args) == 2 {
			return json.NewEncoder(os.Stdout).Encode(out.Pairings)
		}
		if len(out.Pairings) == 0 {
			fmt.Println("No browser is paired. Run: burf browser pair")
			return nil
		}
		w := tabwriter.NewWriter(os.Stdout, 0, 4, 2, ' ', 0)
		fmt.Fprintln(w, "ID\tNAME\tPAIRED\tEXTENSION")
		for _, p := range out.Pairings {
			fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", p.ID, p.Name, p.Created.Local().Format("2006-01-02 15:04"), p.Origin)
		}
		return w.Flush()
	case args[0] == "revoke" && len(args) == 2:
		if err := c.Call(ctx, http.MethodDelete, "/v1/browser/pairings/"+url.PathEscape(args[1]), nil, nil); err != nil {
			return err
		}
		fmt.Println("Revoked. That browser can no longer reach Burf.")
		return nil
	}
	return errors.New(browserUsage)
}
