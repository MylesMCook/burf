package teamtest

import (
	"bufio"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

// A copy of the importing test binary is the fake gh on every platform.
func init() {
	if strings.TrimSuffix(filepath.Base(os.Args[0]), ".exe") == "gh" && os.Getenv("GH_FAKE_ROOT") != "" {
		os.Exit(runFakeGH(os.Args[1:]))
	}
}

var errNotFound = errors.New("gh: Not Found (HTTP 404)")

func runFakeGH(args []string) int {
	if path := os.Getenv("GH_FAKE_LOG"); path != "" {
		f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			return 1
		}
		fmt.Fprintln(f, strings.Join(args, " "))
		f.Close()
	}
	root := os.Getenv("GH_FAKE_ROOT")
	auth := filepath.Join(root, ".auth")
	readLogin := func() string { b, _ := os.ReadFile(auth); return strings.TrimSpace(string(b)) }
	if len(args) == 0 || args[0] == "--version" || args[0] == "version" {
		fmt.Println("gh version 2.99.0 (fake, for tests)")
		return 0
	}
	if args[0] == "auth" && len(args) > 1 {
		switch args[1] {
		case "status":
			who := readLogin()
			if who == "" {
				fmt.Fprintln(os.Stderr, "You are not logged into any GitHub hosts. To log in, run: gh auth login")
				return 1
			}
			fmt.Fprintln(os.Stderr, "github.com\n  Logged in to github.com account "+who+" (fake)")
			return 0
		case "login":
			fmt.Println("! First copy your one-time code: 4F2A-9C1E")
			fmt.Print("Press Enter to open github.com in your browser... ")
			bufio.NewReader(os.Stdin).ReadString('\n')
			fmt.Println("! Failed opening a web browser at https://github.com/login/device")
			delay := 0.5
			if v, err := strconv.ParseFloat(os.Getenv("GH_FAKE_LOGIN_DELAY"), 64); err == nil {
				delay = v
			}
			time.Sleep(time.Duration(delay * float64(time.Second)))
			who := os.Getenv("GH_FAKE_LOGIN")
			if who == "" {
				who = "engineer"
			}
			if err := os.WriteFile(auth, []byte(who), 0o600); err != nil {
				fmt.Fprintln(os.Stderr, err)
				return 1
			}
			fmt.Println("Authentication complete.\nLogged in as " + who)
			return 0
		case "setup-git":
			return 0
		case "token":
			if readLogin() == "" {
				return 1
			}
			fmt.Println("gho_fake")
			return 0
		}
	}
	if args[0] == "api" && len(args) > 1 {
		path := ""
		for _, a := range args[1:] {
			if !strings.HasPrefix(a, "-") {
				path = a
				break
			}
		}
		value, err := fakeAPI(root, path, readLogin())
		if err != nil {
			if errors.Is(err, errNotFound) {
				json.NewEncoder(os.Stdout).Encode(map[string]string{"message": "Not Found", "status": "404"})
			}
			fmt.Fprintln(os.Stderr, err)
			return 1
		}
		json.NewEncoder(os.Stdout).Encode(value)
		return 0
	}
	fmt.Fprintln(os.Stderr, "fake gh: unknown command: "+strings.Join(args, " "))
	return 2
}

func fakeGit(repo string, args ...string) ([]byte, error) {
	cmd := exec.Command("git", append([]string{"--git-dir", repo}, args...)...)
	cmd.Env = append(os.Environ(), "GIT_CONFIG_GLOBAL="+os.DevNull, "GIT_CONFIG_SYSTEM="+os.DevNull)
	return cmd.Output()
}

func fakeBranch(repo string) string {
	b, err := fakeGit(repo, "symbolic-ref", "HEAD")
	if err != nil {
		return "main"
	}
	return strings.TrimPrefix(strings.TrimSpace(string(b)), "refs/heads/")
}

func fakeRepoJSON(owner, name, repo string) map[string]any {
	desc, _ := os.ReadFile(filepath.Join(repo, "description"))
	description := strings.TrimSpace(string(desc))
	if strings.HasPrefix(description, "Unnamed repository") {
		description = ""
	}
	pushed, _ := fakeGit(repo, "log", "-1", "--format=%cI", fakeBranch(repo))
	var size int64
	filepath.WalkDir(repo, func(path string, d fs.DirEntry, err error) error {
		if err == nil && !d.IsDir() {
			if info, err := d.Info(); err == nil {
				size += info.Size()
			}
		}
		return nil
	})
	_, private := os.Stat(filepath.Join(repo, "berth-private"))
	return map[string]any{
		"name": name, "full_name": owner + "/" + name, "owner": map[string]string{"login": owner},
		"private": private == nil, "default_branch": fakeBranch(repo), "html_url": "https://github.com/" + owner + "/" + name,
		"description": description, "pushed_at": strings.TrimSpace(string(pushed)), "size": max(int64(1), size/1024),
		"permissions": map[string]bool{"pull": true},
	}
}

func fakeCommit(repo, ref string) (any, error) {
	b, err := fakeGit(repo, "rev-parse", "--verify", "--quiet", ref+"^{commit}")
	if err != nil {
		return nil, errNotFound
	}
	sha := strings.TrimSpace(string(b))
	b, err = fakeGit(repo, "log", "-1", "--format=%an%x00%ae%x00%aI%x00%T%x00%B", sha)
	if err != nil {
		return nil, errNotFound
	}
	f := strings.Split(string(b), "\x00")
	if len(f) != 5 {
		return nil, fmt.Errorf("unexpected commit metadata: %q", b)
	}
	who := strings.Split(f[1], "@")[0]
	if who == "" {
		who = f[0]
	}
	return map[string]any{"sha": sha,
		"commit": map[string]any{"message": strings.TrimSpace(f[4]), "author": map[string]string{"name": f[0], "email": f[1], "date": f[2]}, "tree": map[string]string{"sha": f[3]}},
		"author": map[string]string{"login": who, "avatar_url": "https://avatars.githubusercontent.com/" + who}}, nil
}

func fakeAPI(root, request, login string) (any, error) {
	u, err := url.Parse(request)
	if err != nil {
		return nil, err
	}
	p := strings.Split(strings.Trim(u.Path, "/"), "/")
	if len(p) == 1 && p[0] == "user" {
		if login == "" {
			return nil, errors.New("gh: Requires authentication (HTTP 401)")
		}
		return map[string]string{"login": login, "name": login, "avatar_url": "https://avatars.githubusercontent.com/" + login}, nil
	}
	if len(p) >= 2 && (p[0] == "orgs" || p[0] == "users") {
		dir := filepath.Join(root, p[1])
		if info, err := os.Stat(dir); err != nil || !info.IsDir() {
			return nil, errNotFound
		}
		if len(p) == 2 {
			if p[0] == "orgs" {
				b, err := os.ReadFile(filepath.Join(dir, "org.json"))
				if err != nil {
					return nil, errNotFound
				}
				var v map[string]any
				if err := json.Unmarshal(b, &v); err != nil {
					return nil, err
				}
				v["type"], v["html_url"] = "Organization", "https://github.com/"+p[1]
				return v, nil
			}
			return map[string]string{"login": p[1], "name": p[1], "type": "User", "avatar_url": "https://avatars.githubusercontent.com/" + p[1], "html_url": "https://github.com/" + p[1]}, nil
		}
		if len(p) == 3 && p[2] == "repos" {
			entries, _ := os.ReadDir(dir)
			repos := []map[string]any{}
			for _, e := range entries {
				if e.IsDir() && strings.HasSuffix(e.Name(), ".git") {
					repo := filepath.Join(dir, e.Name())
					if _, err := os.Stat(filepath.Join(repo, "berth-noaccess")); err != nil {
						repos = append(repos, fakeRepoJSON(p[1], strings.TrimSuffix(e.Name(), ".git"), repo))
					}
				}
			}
			sort.SliceStable(repos, func(i, j int) bool { return repos[i]["pushed_at"].(string) > repos[j]["pushed_at"].(string) })
			return repos, nil
		}
	}
	if len(p) < 3 || p[0] != "repos" {
		return nil, errNotFound
	}
	repo := filepath.Join(root, p[1], p[2]+".git")
	if info, err := os.Stat(repo); err != nil || !info.IsDir() {
		return nil, errNotFound
	}
	if _, err := os.Stat(filepath.Join(repo, "berth-noaccess")); err == nil {
		return nil, errNotFound
	}
	if len(p) == 3 {
		return fakeRepoJSON(p[1], p[2], repo), nil
	}
	q, rest := u.Query(), p[3:]
	switch rest[0] {
	case "branches":
		b, err := fakeGit(repo, "rev-parse", "--verify", "--quiet", "refs/heads/"+strings.Join(rest[1:], "/"))
		if err == nil {
			return map[string]any{"name": strings.Join(rest[1:], "/"), "commit": map[string]string{"sha": strings.TrimSpace(string(b))}}, nil
		}
	case "commits":
		if len(rest) == 2 {
			return fakeCommit(repo, rest[1])
		}
	case "git":
		if len(rest) != 3 {
			break
		}
		if rest[1] == "blobs" {
			b, err := fakeGit(repo, "cat-file", "blob", rest[2])
			if err == nil {
				return map[string]any{"sha": rest[2], "size": len(b), "encoding": "base64", "content": base64.StdEncoding.EncodeToString(b)}, nil
			}
		}
		if rest[1] == "trees" {
			b, err := fakeGit(repo, "rev-parse", "--verify", "--quiet", rest[2]+"^{tree}")
			if err != nil {
				break
			}
			tree := strings.TrimSpace(string(b))
			args := []string{"ls-tree", "-l"}
			if q.Get("recursive") != "" {
				args = append(args, "-r")
			}
			b, err = fakeGit(repo, append(args, tree)...)
			if err != nil {
				break
			}
			entries := []map[string]any{}
			for _, line := range strings.Split(strings.TrimSpace(string(b)), "\n") {
				if line == "" {
					continue
				}
				meta, path, ok := strings.Cut(line, "\t")
				f := strings.Fields(meta)
				if !ok || len(f) != 4 {
					return nil, fmt.Errorf("unexpected tree entry: %q", line)
				}
				e := map[string]any{"path": path, "mode": f[0], "type": f[1], "sha": f[2]}
				if f[1] == "blob" {
					e["size"], _ = strconv.Atoi(f[3])
				}
				entries = append(entries, e)
			}
			return map[string]any{"sha": tree, "tree": entries, "truncated": false}, nil
		}
	case "contents":
		ref := q.Get("ref")
		if ref == "" {
			ref = fakeBranch(repo)
		}
		path := strings.Join(rest[1:], "/")
		sha, err := fakeGit(repo, "rev-parse", "--verify", "--quiet", ref+":"+path)
		b, readErr := fakeGit(repo, "show", ref+":"+path)
		if err == nil && readErr == nil {
			return map[string]any{"type": "file", "path": path, "sha": strings.TrimSpace(string(sha)), "size": len(b), "encoding": "base64", "content": base64.StdEncoding.EncodeToString(b)}, nil
		}
	case "compare":
		if len(rest) == 2 {
			a, b, ok := strings.Cut(rest[1], "...")
			if ok {
				v, err := fakeGit(repo, "rev-list", "--count", a+".."+b)
				if err == nil {
					n, _ := strconv.Atoi(strings.TrimSpace(string(v)))
					return map[string]any{"total_commits": n, "status": "ahead"}, nil
				}
			}
		}
	}
	return nil, errNotFound
}
