package pairing

import (
	"crypto/rand"
	"encoding/base64"
	"net/url"
	"reflect"
	"strings"
	"testing"
	"time"
)

func testInvite(t *testing.T) Invite {
	t.Helper()
	inv := Invite{From: "seans-macbook", Expires: time.Unix(1_900_000_000, 0).UTC()}
	for _, b := range []InviteBox{
		{Name: "devl", Addresses: []string{"100.64.0.4:7444", "devl.example.ts.net:7444"}},
		{Name: "omarchy", Addresses: []string{"[fd7a:115c:a1e0::1]:7444"}, Network: "personal", Tailnet: "sean@github"},
	} {
		rand.Read(b.Fingerprint[:])
		rand.Read(b.Code[:])
		inv.Boxes = append(inv.Boxes, b)
	}
	return inv
}

func TestInviteRoundTrip(t *testing.T) {
	inv := testInvite(t)
	link := inv.String()
	if !strings.HasPrefix(link, "berth://join?") {
		t.Fatalf("link %q", link)
	}
	got, err := ParseInvite(link)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, inv) {
		t.Fatalf("round trip changed the invite:\n got %+v\nwant %+v", got, inv)
	}
	// Two boxes fit comfortably in a QR code.
	if len(link) > 400 {
		t.Fatalf("link is %d characters", len(link))
	}
}

func TestFindJoinLinkInPastedText(t *testing.T) {
	link := testInvite(t).String()
	for _, text := range []string{
		link,
		"  " + link + "\n",
		"On the other computer:  berth join '" + link + "'",
		"here you go: " + link + ".",
	} {
		if got := FindJoinLink(text); got != link {
			t.Errorf("FindJoinLink(%q) = %q", text, got)
		}
	}
	if FindJoinLink("berth://100.64.0.1:7444?code=x&fp=y") != "" {
		t.Error("a pairing link was taken for a join link")
	}
}

func TestParseInviteRejectsMalformedLinks(t *testing.T) {
	inv := testInvite(t)
	good := inv.String()
	u, _ := url.Parse(good)
	payload, _ := base64.RawURLEncoding.DecodeString(u.Query().Get("d"))
	with := func(b []byte) string {
		return "berth://join?v=1&d=" + base64.RawURLEncoding.EncodeToString(b)
	}
	bad := map[string]string{
		"empty":          "",
		"pairing link":   "berth://100.64.0.1:7444?code=x&fp=y",
		"other scheme":   strings.Replace(good, "berth://", "https://", 1),
		"newer version":  strings.Replace(good, "v=1", "v=2", 1),
		"no payload":     "berth://join?v=1",
		"not base64":     "berth://join?v=1&d=***",
		"truncated":      with(payload[:len(payload)-3]),
		"trailing bytes": with(append(append([]byte{}, payload...), 0)),
	}
	noBoxes := append([]byte{}, payload...)
	noBoxes[4+1+len(inv.From)] = 0
	bad["no boxes"] = with(noBoxes)

	evil := testInvite(t)
	evil.Boxes[0].Name = "../etc"
	bad["unsafe name"] = evil.String()
	evil = testInvite(t)
	evil.Boxes[1].Network = "-rf"
	bad["unsafe network"] = evil.String()
	evil = testInvite(t)
	evil.Boxes[0].Addresses = []string{"100.64.0.4"}
	bad["address without port"] = evil.String()
	evil = testInvite(t)
	evil.Boxes[0].Addresses = nil
	bad["no address"] = evil.String()
	evil = testInvite(t)
	evil.From = "mac\x1b[31m"
	bad["control characters"] = evil.String()

	for name, link := range bad {
		if _, err := ParseInvite(link); err == nil {
			t.Errorf("%s: accepted %q", name, link)
		}
	}
}

func TestInviteValidBoundsTheLink(t *testing.T) {
	inv := testInvite(t)
	if err := inv.Valid(); err != nil {
		t.Fatal(err)
	}
	for len(inv.Boxes) <= MaxInviteBoxes {
		inv.Boxes = append(inv.Boxes, inv.Boxes[0])
	}
	if inv.Valid() == nil {
		t.Fatal("an invite over the box limit is valid")
	}
}
