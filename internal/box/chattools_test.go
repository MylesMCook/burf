package box

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/MylesMCook/burf/internal/localchat"
)

func startedServers(t *testing.T, f *browserFixture) map[string]struct {
	Command  string   `json:"command"`
	Args     []string `json:"args"`
	Approval string   `json:"default_tools_approval_mode"`
} {
	t.Helper()
	var params struct {
		Config struct {
			Servers map[string]struct {
				Command  string   `json:"command"`
				Args     []string `json:"args"`
				Approval string   `json:"default_tools_approval_mode"`
			} `json:"mcp_servers"`
		} `json:"config"`
	}
	if err := json.Unmarshal(<-f.started, &params); err != nil {
		t.Fatal(err)
	}
	return params.Config.Servers
}

func startChatAt(t *testing.T, f *browserFixture, body string) Chat {
	t.Helper()
	w := chatRequest(f.h, "POST", "/v1/chats", body)
	var s Chat
	if err := json.Unmarshal(w.Body.Bytes(), &s); err != nil || w.Code != 201 {
		t.Fatalf("start: %d %s", w.Code, w.Body)
	}
	return s
}

func TestEveryChatOnABoxWithItsSocketHasBurfsToolsForThatChatOnly(t *testing.T) {
	f := newBrowserFixture(t)
	if !slices.Contains(f.box.Capabilities(), "chat.tools") {
		t.Fatal("a box with a socket does not advertise chat.tools")
	}
	s := startChatAt(t, f, `{"location":"project"}`)
	servers := startedServers(t, f)
	tools, ok := servers[localchat.ToolServer]
	// This daemon's own executable, told its socket and the chat outright:
	// the provider starts it with a bare environment.
	if !ok || len(servers) != 1 || !filepath.IsAbs(tools.Command) || strings.Join(tools.Args, " ") != "mcp --socket "+f.box.Socket+" --chat "+s.ID || tools.Approval != "approve" {
		t.Fatalf("plain chat's servers: %+v", servers)
	}
	// A chat with a browser has both, each for itself.
	other := startChatAt(t, f, browserStart)
	servers = startedServers(t, f)
	if len(servers) != 2 || servers[localchat.ToolServer].Args[4] != other.ID || servers[localchat.BrowserServer].Args[0] != "browser-mcp" {
		t.Fatalf("browser chat's servers: %+v", servers)
	}

	// Without its socket the box has nothing for a tool to reach.
	f.box.Socket = ""
	if slices.Contains(f.box.Capabilities(), "chat.tools") {
		t.Fatal("a box without a socket advertises chat.tools")
	}
	startChatAt(t, f, `{"location":"project"}`)
	if params := <-f.started; strings.Contains(string(params), "config") {
		t.Fatalf("a chat was given a server that cannot reach the box: %s", params)
	}
}

func TestOnlyTheBoxItselfMayAskAChatsPersonAndTheirAnswerDecides(t *testing.T) {
	f := newBrowserFixture(t)
	s := f.startBrowserChat(t)
	path := "/v1/chats/" + s.ID + "/tools/approve"
	// A paired client can answer, never ask as a tool.
	if w := chatRequest(f.h, "POST", path, `{"tool":"berth_exec","detail":"$ make deploy"}`); w.Code != 403 {
		t.Fatalf("paired client asked: %d %s", w.Code, w.Body)
	}
	if got, _ := f.box.Chats.Get(s.ID); len(got.Approvals) != 0 {
		t.Fatalf("a refused request left a question: %+v", got.Approvals)
	}

	asked := func() chan error {
		done := make(chan error, 1)
		go func() {
			done <- f.local.Call(context.Background(), "POST", path, map[string]string{"tool": "berth_exec", "detail": "location: project\n$ make deploy"}, nil)
		}()
		waitUntil(t, "the question shows in the chat", 3*time.Second, func() bool { got, _ := f.box.Chats.Get(s.ID); return len(got.Approvals) == 1 })
		return done
	}
	answer := func(decision string) int {
		got, _ := f.box.Chats.Get(s.ID)
		return chatRequest(f.h, "POST", "/v1/chats/"+s.ID+"/approvals", `{"id":"`+got.Approvals[0].ID+`","decision":"`+decision+`"}`).Code
	}
	done := asked()
	// The chat's clients see what would run, and that a tool asks.
	var shown Chat
	_ = json.Unmarshal(chatRequest(f.h, "GET", "/v1/chats/"+s.ID, "").Body.Bytes(), &shown)
	if shown.State != "waiting" || shown.Approvals[0].Kind != "tool" || shown.Approvals[0].Detail != "berth_exec\nlocation: project\n$ make deploy" {
		t.Fatalf("shown: %+v", shown.Approvals)
	}
	if code := answer("accept"); code != 200 {
		t.Fatalf("allow: %d", code)
	}
	if err := <-done; err != nil {
		t.Fatalf("an allowed tool was refused: %v", err)
	}
	done = asked()
	if code := answer("decline"); code != 200 {
		t.Fatalf("deny: %d", code)
	}
	if err := <-done; err == nil || !strings.Contains(err.Error(), "declined") {
		t.Fatalf("a denied tool went ahead: %v", err)
	}

	// Strict requests, and no question for a chat that is not in a turn.
	for _, body := range []string{`{"tool":"berth_exec","detail":"x","extra":1}`, `{"tool":""}`, `not json`} {
		var raw any = json.RawMessage(body)
		if body == "not json" {
			raw = "not json"
		}
		if err := f.local.Call(context.Background(), "POST", path, raw, nil); err == nil {
			t.Fatalf("accepted %s", body)
		}
	}
	idle := startChatAt(t, f, `{"location":"project"}`)
	if err := f.local.Call(context.Background(), "POST", "/v1/chats/"+idle.ID+"/tools/approve", map[string]string{"tool": "berth_exec"}, nil); err == nil || !strings.Contains(err.Error(), "during a turn") {
		t.Fatalf("idle chat: %v", err)
	}
	if err := f.local.Call(context.Background(), "POST", "/v1/chats/missing/tools/approve", map[string]string{"tool": "berth_exec"}, nil); err == nil {
		t.Fatal("unknown chat")
	}
}

func TestWorkAChatStartsNamesTheChatSoItHearsBack(t *testing.T) {
	f := newBrowserFixture(t, func(b *Box, add func(string, func(http.ResponseWriter, *http.Request) error)) {
		// Stands in for the routes that start work (tasks, send, runs).
		add("POST /v1/test/work/{run}", func(w http.ResponseWriter, r *http.Request) error {
			b.watchCaller(r, Watch{Kind: "run", Run: r.PathValue("run")})
			writeJSON(w, map[string]bool{"ok": true})
			return nil
		})
	})
	f.box.Reports = &Notifier{Path: filepath.Join(t.TempDir(), "notify.json")}
	s := startChatAt(t, f, `{"location":"project"}`)
	start := func(c *Client, run string) {
		t.Helper()
		if err := c.Call(context.Background(), "POST", "/v1/test/work/"+run, nil, nil); err != nil {
			t.Fatal(err)
		}
	}
	start(f.local.WithCaller(chatCaller+s.ID), "r_1")
	watches := f.box.Reports.Watches()
	if len(watches) != 1 || watches[0].Parent != chatCaller+s.ID || watches[0].ID != "run:r_1" {
		t.Fatalf("watches: %+v", watches)
	}
	// Not for a chat that does not exist, nor one that has stopped.
	start(f.local.WithCaller(chatCaller+"0123456789abcdef0123456789abcdef"), "r_2")
	if err := f.box.Chats.Stop(s.ID); err != nil {
		t.Fatal(err)
	}
	start(f.local.WithCaller(chatCaller+s.ID), "r_3")
	if got := f.box.Reports.Watches(); len(got) != 1 {
		t.Fatalf("a chat that cannot hear back was given a watch: %+v", got)
	}
	// Only the box's own socket names a caller: a paired client cannot make
	// a chat hear about work it did not start.
	live := startChatAt(t, f, `{"location":"project"}`)
	r := chatRequestWith(f.h, "POST", "/v1/test/work/r_4", "", CallerHeader, chatCaller+live.ID)
	if r.Code != 200 || len(f.box.Reports.Watches()) != 1 {
		t.Fatalf("a paired client named a chat as caller: %d %+v", r.Code, f.box.Reports.Watches())
	}
}

func TestAReportGoesIntoAnIdleChatAsBurfsOwnMessage(t *testing.T) {
	f := newBrowserFixture(t)
	f.box.Sessions = testSessions(t)
	h := &boxNotifyHost{f.box}
	ctx := context.Background()
	s := startChatAt(t, f, `{"location":"project"}`)
	parent := chatCaller + s.ID

	live, err := h.sessions(ctx)
	if err != nil || !live[parent].Agent || live[parent].Exited {
		t.Fatalf("a live chat is not someone to report to: %v %+v", err, live)
	}
	if !h.ready(parent) {
		t.Fatal("an idle chat is not ready")
	}
	// The text the notifier writes, so the card is read from the real form.
	text := NotificationText([]Report{{Key: "k", Kind: "task", Session: "shop-fix-claude", Worktree: "shop/fix", Status: "finished", Answer: "The checkout test passes now."}}, 0)
	if err = h.deliver(ctx, parent, text); err != nil {
		t.Fatal(err)
	}
	got, _ := f.box.Chats.Get(s.ID)
	if len(got.Items) != 1 || got.Items[0].Kind != "report" || got.Items[0].Text != text {
		t.Fatalf("items: %+v", got.Items)
	}
	// Clients get the work it reports on, to draw as a card.
	var shown Chat
	_ = json.Unmarshal(chatRequest(f.h, "GET", "/v1/chats/"+s.ID, "").Body.Bytes(), &shown)
	cards := shown.Reports[got.Items[0].ID]
	if len(cards) != 1 || cards[0].Session != "shop-fix-claude" || cards[0].Status != "finished" || cards[0].Worktree != "shop/fix" || !strings.Contains(cards[0].Answer, "checkout test passes") {
		t.Fatalf("report cards: %+v", shown.Reports)
	}
	// It started a turn: the next report waits for it to end.
	if h.ready(parent) {
		t.Fatal("a chat in a turn is ready for a report")
	}
	if err = h.deliver(ctx, parent, "another"); err == nil || errors.Is(err, ErrSessionExited) || errors.Is(err, ErrUnknownSession) {
		t.Fatalf("a report interrupted a turn, or the chat was given up on: %v", err)
	}

	// A stopped chat is gone for good; one that never was, too.
	if err = f.box.Chats.Stop(s.ID); err != nil {
		t.Fatal(err)
	}
	if live, _ = h.sessions(ctx); !live[parent].Exited {
		t.Fatalf("a stopped chat still counts as live: %+v", live[parent])
	}
	if err = h.deliver(ctx, parent, text); !errors.Is(err, ErrSessionExited) {
		t.Fatalf("stopped chat: %v", err)
	}
	if err = h.deliver(ctx, chatCaller+"0123456789abcdef0123456789abcdef", text); !errors.Is(err, ErrUnknownSession) {
		t.Fatalf("unknown chat: %v", err)
	}
}

func chatRequestWith(h http.Handler, method, path, body, header, value string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	r.Header.Set(header, value)
	h.ServeHTTP(w, r)
	return w
}

func TestManyLongReportsGoAsSeveralMessagesAndNoneIsLost(t *testing.T) {
	var reps []Report
	for i := range maxPendingReports {
		files := []ReviewFile{}
		for j := range filesListed {
			files = append(files, ReviewFile{Path: strings.Repeat("d", 240) + "/" + string(rune('a'+j)) + ".go", Code: "M", Added: 1})
		}
		reps = append(reps, Report{Key: "k" + string(rune('a'+i)), Kind: "task", Session: "s" + string(rune('a'+i)), Status: "finished", Answer: strings.Repeat("a", answerLimit), Needs: strings.Repeat("n", needsLimit), Error: strings.Repeat("e", 800), Files: files})
	}
	// Everything a parent can hold is more than one chat message takes.
	if all := len(NotificationText(reps, 0)); all <= 64<<10 {
		t.Skipf("the largest batch fits a message (%d bytes)", all)
	}
	sent := 0
	for left := reps; len(left) > 0; {
		batch := fitReports(left, 0)
		if len(batch) == 0 || len(NotificationText(batch, 0)) > maxNotificationText {
			t.Fatalf("a batch of %d is %d bytes", len(batch), len(NotificationText(batch, 0)))
		}
		// Oldest first, in order, none skipped.
		for i := range batch {
			if batch[i].Key != left[i].Key {
				t.Fatalf("batch is out of order at %d", i)
			}
		}
		sent += len(batch)
		left = left[len(batch):]
	}
	if sent != len(reps) {
		t.Fatalf("sent %d of %d", sent, len(reps))
	}
	// One report always goes, however long.
	if got := fitReports(reps[:1], 0); len(got) != 1 {
		t.Fatal("a single report was held back")
	}
}

func TestOneOverlongReportIsTrimmedAndNeverCostsAChatItsReports(t *testing.T) {
	// A run may be given a title of any length; the notification holds a short one.
	long := Report{Key: "k", Kind: "run", Run: "r_1", Template: "exec", Title: strings.Repeat("t", 70<<10), Status: "failed", Error: strings.Repeat("e", 70<<10)}
	text := NotificationText([]Report{long}, 0)
	if len(text) > maxNotificationText {
		t.Fatalf("one report is %d bytes", len(text))
	}
	if strings.Contains(text, strings.Repeat("t", 4096)) || strings.Contains(text, strings.Repeat("e", 4096)) {
		t.Fatalf("a title or an error went through whole (%d bytes)", len(text))
	}
	if !strings.Contains(text, strings.Repeat("t", titleLimit)) {
		t.Fatal("the title is gone, not trimmed")
	}

	// Whatever a report holds, a chat is handed a message it can take.
	f := newBrowserFixture(t)
	h := &boxNotifyHost{f.box}
	s := startChatAt(t, f, `{"location":"project"}`)
	if err := h.deliver(context.Background(), chatCaller+s.ID, "<berth-notification>\n"+strings.Repeat("x", 70<<10)+"\n</berth-notification>"); err != nil {
		t.Fatalf("an overlong report failed the delivery: %v", err)
	}
	got, _ := f.box.Chats.Get(s.ID)
	if len(got.Items) != 1 || got.Items[0].Kind != "report" || !strings.Contains(got.Items[0].Text, "too long to pass on in full") || !strings.HasPrefix(got.Items[0].Text, "<berth-notification>") {
		t.Fatalf("items: %+v", got.Items)
	}
}

func TestTheWatchNeverReadsOutsideItsWorktree(t *testing.T) {
	s, _ := newArtifactStore(t)
	clock := time.Now()
	s.Now = func() time.Time { return clock }
	wt := t.TempDir()
	outside := t.TempDir()
	secret := filepath.Join(outside, "notes.md")
	os.WriteFile(secret, []byte("# Not this worktree's\n"), 0o644)
	os.MkdirAll(filepath.Join(wt, "notes"), 0o755)
	src := filepath.Join(wt, "notes", "notes.md")
	os.WriteFile(src, []byte("# Plan\n"), 0o644)
	a, _, err := s.Add("shop", "fix", wt, ArtifactInput{Title: "Plan", Name: "notes.md", Source: src, Watch: true, Content: []byte("# Plan\n")})
	if err != nil {
		t.Fatal(err)
	}
	settle := func() {
		s.Poll()
		clock = clock.Add(artifactSettle + time.Millisecond)
		s.Poll()
		clock = clock.Add(artifactSettle + time.Millisecond)
		s.Poll()
	}
	settle()
	latest := func() string {
		got, _ := s.Get(a.ID, wt)
		_, _, body, _ := s.Content(a.ID, wt, got.Latest().N)
		return string(body)
	}
	// An ordinary rewrite is still taken.
	writeLater(t, src, "# Plan, revised\n")
	settle()
	if latest() != "# Plan, revised\n" {
		t.Fatalf("an ordinary rewrite was not taken: %q", latest())
	}
	// A link out of the worktree put in the file's place is never read.
	os.Remove(src)
	if err = os.Symlink(secret, src); err != nil {
		t.Skip("no symlinks here")
	}
	settle()
	if strings.Contains(latest(), "Not this") {
		t.Fatal("the watch followed a link put in the file's place")
	}
	// And it says so, rather than going stale in silence.
	if got, _ := s.Get(a.ID, wt); !strings.Contains(got.Problem, "not followed") {
		t.Fatalf("problem: %q", got.Problem)
	}
	// Nor one put in the folder's place, with a file of the same name behind it.
	os.Remove(src)
	os.Remove(filepath.Join(wt, "notes"))
	if err = os.Symlink(outside, filepath.Join(wt, "notes")); err != nil {
		t.Fatal(err)
	}
	writeLater(t, secret, "# Not this worktree's, rewritten\n")
	settle()
	if strings.Contains(latest(), "Not this") {
		t.Fatal("the watch followed a link put in the folder's place")
	}
	// A watched update keeps nothing that would let it follow one later.
	if got, _ := s.Get(a.ID, wt); got.Source != src {
		t.Fatalf("the artifact's source changed: %q", got.Source)
	}
	// The file back where it was is watched again.
	os.Remove(filepath.Join(wt, "notes"))
	os.MkdirAll(filepath.Join(wt, "notes"), 0o755)
	os.WriteFile(src, []byte("# Plan, back\n"), 0o644)
	settle()
	writeLater(t, src, "# Plan, once more\n")
	settle()
	if latest() != "# Plan, once more\n" {
		t.Fatalf("the file put back was not watched again: %q", latest())
	}
	if got, _ := s.Get(a.ID, wt); got.Problem != "" {
		t.Fatalf("the problem outlived the next version: %q", got.Problem)
	}
	// A pipe put there does not hold the watch.
	os.Remove(src)
	if syscall.Mkfifo(src, 0o644) == nil {
		done := make(chan struct{})
		go func() { _, _ = readSource(wt, src); close(done) }()
		select {
		case <-done:
		case <-time.After(3 * time.Second):
			t.Fatal("a pipe held the watch")
		}
	}
}

// As for the chat's own tool: the folder on the way is swapped for a link
// out of the worktree and back while the source is read over and over.
func TestSwappingAFolderForALinkWhileTheWatchReadsNeverReadsOutside(t *testing.T) {
	wt, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	outside := t.TempDir()
	os.MkdirAll(filepath.Join(wt, "real"), 0o755)
	os.WriteFile(filepath.Join(wt, "real", "notes.md"), []byte("inside"), 0o644)
	os.WriteFile(filepath.Join(outside, "notes.md"), []byte("OUTSIDE"), 0o644)
	notes := filepath.Join(wt, "notes")
	if err = os.Symlink("real", notes); err != nil {
		t.Skip("no symlinks here")
	}
	stop, swapped := make(chan struct{}), make(chan struct{})
	go func() {
		defer close(swapped)
		tmp := filepath.Join(wt, "swap")
		for i := 0; ; i++ {
			select {
			case <-stop:
				return
			default:
			}
			target := "real"
			if i%2 == 0 {
				target = outside
			}
			os.Remove(tmp)
			os.Symlink(target, tmp)
			os.Rename(tmp, notes)
		}
	}()
	read, refused := 0, 0
	for range 20000 {
		got, err := readSource(wt, filepath.Join(notes, "notes.md"))
		switch {
		case err != nil:
			refused++
		case string(got) == "inside":
			read++
		default:
			close(stop)
			<-swapped
			t.Fatalf("the watch read outside its worktree: %q", got)
		}
	}
	close(stop)
	<-swapped
	if read == 0 || refused == 0 {
		t.Skipf("the swap never raced the read (read %d, refused %d)", read, refused)
	}
}
