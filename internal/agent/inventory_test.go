package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	"github.com/MylesMCook/burf/internal/boxclient"
	"github.com/MylesMCook/burf/internal/inventory"
	"github.com/MylesMCook/burf/internal/trust"
)

func TestInventoryAPIMachineRegistrationHistoryAndOfflineState(t *testing.T) {
	ctx := context.Background()
	s, err := inventory.Open(ctx, filepath.Join(t.TempDir(), "inventory.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	a := &Agent{boxes: trust.NewStore(filepath.Join(t.TempDir(), "boxes.json")), inventory: &machineInventory{store: s}}
	a.inventory.engine = inventory.NewEngine(ctx, s, func(context.Context, inventory.Machine) ([]inventory.Collection, error) {
		return []inventory.Collection{{Coverage: inventory.Coverage{Source: "docker", State: "error", Error: "Machine unavailable.", At: time.Now()}}}, nil
	})
	defer a.inventory.engine.Close()
	mux := http.NewServeMux()
	a.inventoryRoutes(mux)
	call := func(method, path, body string) *httptest.ResponseRecorder {
		t.Helper()
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, httptest.NewRequest(method, path, bytes.NewBufferString(body)))
		return rec
	}
	create := call("POST", "/v1/machines", `{"name":"Lab","os":"linux","routes":[{"kind":"ssh","target":"lab"}]}`)
	if create.Code != 200 {
		t.Fatal(create.Body.String())
	}
	var m inventory.Machine
	if err = json.Unmarshal(create.Body.Bytes(), &m); err != nil {
		t.Fatal(err)
	}
	before := time.Now().UTC().Add(-time.Minute)
	err = s.Apply(ctx, m.ID, []inventory.Collection{{Coverage: inventory.Coverage{Source: "docker", State: "ok", At: before}, Services: []inventory.Service{{Key: "container-one", Source: "docker", Name: "Web", State: "running", Ports: []int{3000}}}}}, before)
	if err != nil {
		t.Fatal(err)
	}
	refresh := call("POST", "/v1/machines/"+m.ID+"/refresh", `{}`)
	if refresh.Code != 200 {
		t.Fatal(refresh.Body.String())
	}
	var snapshot inventory.Snapshot
	if err = json.Unmarshal(refresh.Body.Bytes(), &snapshot); err != nil {
		t.Fatal(err)
	}
	if len(snapshot.Services) != 1 || snapshot.Services[0].State != "running" || !snapshot.Services[0].ObservedAt.Equal(before) {
		t.Fatal(snapshot)
	}
	history := call("GET", "/v1/machines/"+m.ID+"/history?service="+snapshot.Services[0].ID, "")
	var changes []inventory.Change
	if history.Code != 200 || json.Unmarshal(history.Body.Bytes(), &changes) != nil || len(changes) != 1 {
		t.Fatal(history.Body.String())
	}
	if call("GET", "/v1/machines/"+m.ID+"/history?after=-1", "").Code != 400 {
		t.Fatal("negative cursor accepted")
	}
	if call("POST", "/v1/machines", `{"name":"Bad","routes":[{"kind":"ssh","target":"lab;echo secret"}]}`).Code != 400 {
		t.Fatal("unsafe target accepted")
	}
	if call("POST", "/v1/machines", `{"name":"Lab","routes":[{"kind":"local"}]}`).Code != 400 {
		t.Fatal("local authority accepted")
	}
	if call("GET", "/v1/machines/missing/inventory", "").Code != 404 {
		t.Fatal("missing machine not 404")
	}
}

type inventoryTestDoer struct{ handler http.Handler }

func (d inventoryTestDoer) DoWithHeader(ctx context.Context, method, path string, body io.Reader, header http.Header) (*http.Response, error) {
	r := httptest.NewRequest(method, path, body).WithContext(ctx)
	r.Header = header
	w := httptest.NewRecorder()
	d.handler.ServeHTTP(w, r)
	return w.Result(), nil
}

func TestInventoryRemoteHistoryBacklogMakesBoundedProgress(t *testing.T) {
	ctx := context.Background()
	s, err := inventory.Open(ctx, filepath.Join(t.TempDir(), "inventory.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	m, err := s.Register(ctx, inventory.Machine{Name: "Lab", Routes: []inventory.Route{{Kind: "paired", Target: "fingerprint-one"}}})
	if err != nil {
		t.Fatal(err)
	}
	a := &Agent{inventory: &machineInventory{store: s}}
	now := time.Now().UTC()
	row := inventory.Service{Key: "container-one", Source: "docker", Name: "Web", State: "running", Ports: []int{3000}, ObservedAt: now}
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1/inventory" {
			json.NewEncoder(w).Encode(inventory.Snapshot{Machine: inventory.Machine{Name: "Lab", OS: "linux"}, At: now, Services: []inventory.Service{row}, Coverage: []inventory.Coverage{{Source: "docker", State: "ok", At: now}}})
			return
		}
		after, _ := strconv.ParseInt(r.URL.Query().Get("after"), 10, 64)
		batch := []inventory.Change{}
		for id := after + 1; id <= min(after+500, 12001); id++ {
			batch = append(batch, inventory.Change{ID: id, At: now.Add(-time.Duration(12002-id) * time.Millisecond), After: row})
		}
		json.NewEncoder(w).Encode(batch)
	})
	c := boxclient.NewClient(inventoryTestDoer{handler: handler})
	if err = a.importMachineInventory(ctx, m, c, "fingerprint-one"); err != nil {
		t.Fatal(err)
	}
	known, err := s.Machine(ctx, m.ID)
	if err != nil || known.OS != "linux" {
		t.Fatal("remote platform not retained", known, err)
	}
	cursor, err := s.Cursor(ctx, m.ID, "fingerprint-one")
	if err != nil || cursor != 10000 {
		t.Fatal(cursor, err)
	}
	snap, _ := s.Snapshot(ctx, m.ID)
	pending := false
	for _, coverage := range snap.Coverage {
		if coverage.Source == "history" {
			pending = coverage.State == "partial"
		}
	}
	if !pending {
		t.Fatal("backlog not visible")
	}
	if err = a.importMachineInventory(ctx, m, c, "fingerprint-one"); err != nil {
		t.Fatal(err)
	}
	cursor, err = s.Cursor(ctx, m.ID, "fingerprint-one")
	if err != nil || cursor != 12001 {
		t.Fatal(cursor, err)
	}
	if err = a.importMachineInventory(ctx, m, c, "fingerprint-one"); err != nil {
		t.Fatal(err)
	}
	changes, err := s.History(ctx, m.ID, "", 12000, 100)
	if err != nil || len(changes) != 1 {
		t.Fatal("remote changes duplicated", len(changes), err)
	}
}

func TestInventoryFailureDoesNotRemoveEstablishedAPI(t *testing.T) {
	a := &Agent{}
	mux := http.NewServeMux()
	a.inventoryRoutes(mux)
	mux.HandleFunc("GET /existing", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(200) })
	for path, want := range map[string]int{"/v1/machines": 503, "/existing": 200} {
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, httptest.NewRequest("GET", path, nil))
		if rec.Code != want {
			t.Fatal(path, rec.Code)
		}
	}
}
