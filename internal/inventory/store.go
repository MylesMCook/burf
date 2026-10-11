package inventory

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"sort"
	"strings"
	"time"
	"unicode"

	"github.com/MylesMCook/burf/internal/statefile"
	_ "modernc.org/sqlite"
)

var ErrNotFound = errors.New("inventory machine not found")

// Store owns one connection, serializing transactions while WAL permits other readers.
type Store struct {
	db   *sql.DB
	path string
}

// Open refuses damaged or newer databases; it never replaces existing data.
func Open(ctx context.Context, path string) (*Store, error) {
	if !filepath.IsAbs(path) {
		return nil, fmt.Errorf("inventory database path must be absolute")
	}
	uriPath := filepath.ToSlash(path)
	if runtime.GOOS == "windows" {
		if strings.HasPrefix(uriPath, "//") {
			return nil, fmt.Errorf("inventory database must be on a local filesystem")
		}
		uriPath = "/" + uriPath
	}
	dir := filepath.Dir(path)
	if err := statefile.EnsurePrivateDir(dir); err != nil {
		return nil, err
	}
	if info, err := os.Lstat(dir); err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return nil, fmt.Errorf("inventory directory must be a plain directory")
	}
	if err := os.Chmod(dir, 0700); err != nil {
		return nil, err
	}
	info, err := os.Lstat(path)
	if errors.Is(err, os.ErrNotExist) {
		f, e := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_RDWR, 0600)
		if e != nil {
			return nil, e
		}
		if e = f.Close(); e != nil {
			return nil, e
		}
	} else if err != nil {
		return nil, err
	} else if !info.Mode().IsRegular() {
		return nil, fmt.Errorf("inventory database must be a plain file")
	}
	if err := statefile.Private(path); err != nil {
		return nil, err
	}
	u := url.URL{Scheme: "file", Path: uriPath}
	q := url.Values{}
	q.Add("_pragma", "foreign_keys(1)")
	q.Add("_pragma", "busy_timeout(5000)")
	q.Set("_txlock", "immediate")
	u.RawQuery = q.Encode()
	db, err := sql.Open("sqlite", u.String())
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(0)
	db.SetConnMaxIdleTime(0)
	s := &Store{db: db, path: path}
	failed := true
	defer func() {
		if failed {
			db.Close()
		}
	}()
	var check string
	if err := db.QueryRowContext(ctx, "PRAGMA quick_check").Scan(&check); err != nil {
		return nil, fmt.Errorf("inventory database check: %w", err)
	}
	if check != "ok" {
		return nil, fmt.Errorf("inventory database damaged: %s", check)
	}
	var version int
	if err := db.QueryRowContext(ctx, "PRAGMA user_version").Scan(&version); err != nil {
		return nil, err
	}
	if version > 1 {
		return nil, fmt.Errorf("inventory database schema %d is newer than supported version 1", version)
	}
	if version == 0 {
		var count int
		if err := db.QueryRowContext(ctx, "SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").Scan(&count); err != nil {
			return nil, err
		}
		if count != 0 {
			return nil, fmt.Errorf("inventory database has an unrecognized unversioned schema")
		}
		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			return nil, err
		}
		defer tx.Rollback()
		for _, statement := range schemaV1 {
			if _, err := tx.ExecContext(ctx, statement); err != nil {
				return nil, fmt.Errorf("inventory schema migration: %w", err)
			}
		}
		if err := tx.Commit(); err != nil {
			return nil, err
		}
	}
	if _, err := db.ExecContext(ctx, "PRAGMA journal_mode=WAL"); err != nil {
		return nil, err
	}
	if _, err := db.ExecContext(ctx, "PRAGMA synchronous=FULL"); err != nil {
		return nil, err
	}
	for _, sidecar := range []string{path + "-wal", path + "-shm"} {
		if _, err := os.Stat(sidecar); err == nil {
			if err := statefile.Private(sidecar); err != nil {
				return nil, err
			}
		}
	}
	failed = false
	return s, nil
}

var schemaV1 = []string{
	`CREATE TABLE machines (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
	`CREATE TABLE machine_routes (machine_id TEXT NOT NULL REFERENCES machines(id), kind TEXT NOT NULL, target TEXT NOT NULL, PRIMARY KEY(kind,target))`,
	`CREATE TABLE services (machine_id TEXT NOT NULL REFERENCES machines(id), id TEXT NOT NULL, source TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(machine_id,id))`,
	`CREATE TABLE coverage (machine_id TEXT NOT NULL REFERENCES machines(id), source TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(machine_id,source))`,
	`CREATE TABLE changes (id INTEGER PRIMARY KEY AUTOINCREMENT, machine_id TEXT NOT NULL REFERENCES machines(id), service_id TEXT NOT NULL, at INTEGER NOT NULL, data TEXT NOT NULL, origin TEXT, remote_id INTEGER, UNIQUE(machine_id,origin,remote_id))`,
	`CREATE INDEX changes_machine_sequence ON changes(machine_id,id)`,
	`CREATE INDEX changes_service_sequence ON changes(machine_id,service_id,id)`,
	`CREATE INDEX changes_time ON changes(at)`,
	`CREATE TABLE cursors (machine_id TEXT NOT NULL REFERENCES machines(id), origin TEXT NOT NULL, sequence INTEGER NOT NULL, PRIMARY KEY(machine_id,origin))`,
	`PRAGMA user_version=1`,
}

func (s *Store) Close() error { return s.db.Close() }

func validText(value string, max int) bool {
	if len(value) > max {
		return false
	}
	for _, r := range value {
		if unicode.IsControl(r) {
			return false
		}
	}
	return true
}
func validateRoutes(routes []Route) error {
	if len(routes) > 16 {
		return fmt.Errorf("too many machine routes")
	}
	seen := map[Route]bool{}
	for _, r := range routes {
		if !validText(r.Target, 512) {
			return fmt.Errorf("invalid route target")
		}
		switch r.Kind {
		case "local":
			if r.Target != "" {
				return fmt.Errorf("local route has a target")
			}
		case "paired":
			if strings.TrimSpace(r.Target) == "" {
				return fmt.Errorf("paired route needs a target")
			}
		case "ssh":
			if err := ValidateSSHTarget(r.Target); err != nil {
				return err
			}
		default:
			return fmt.Errorf("invalid machine route kind")
		}
		if seen[r] {
			return fmt.Errorf("duplicate machine route")
		}
		seen[r] = true
	}
	return nil
}
func validateMachine(m Machine) error {
	if strings.TrimSpace(m.Name) == "" || !validText(m.Name, 256) || !validText(m.ID, 256) || !validText(m.OS, 32) {
		return fmt.Errorf("invalid inventory machine")
	}
	switch m.OS {
	case "", "linux", "darwin", "windows":
	default:
		return fmt.Errorf("unsupported inventory machine OS")
	}
	return validateRoutes(m.Routes)
}
func (s *Store) Register(ctx context.Context, m Machine) (Machine, error) {
	if err := validateMachine(m); err != nil {
		return Machine{}, err
	}
	if m.ID == "" {
		var b [16]byte
		if _, err := rand.Read(b[:]); err != nil {
			return Machine{}, err
		}
		b[6] = (b[6] & 0x0f) | 0x40
		b[8] = (b[8] & 0x3f) | 0x80
		m.ID = fmt.Sprintf("%x-%x-%x-%x-%x", b[:4], b[4:6], b[6:8], b[8:10], b[10:])
	}
	m.UpdatedAt = time.Now().UTC()
	if m.Routes == nil {
		m.Routes = []Route{}
	}
	data, err := json.Marshal(m)
	if err != nil {
		return Machine{}, err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Machine{}, err
	}
	defer tx.Rollback()
	if err := checkRoutes(ctx, tx, m.ID, m.Routes); err != nil {
		return Machine{}, err
	}
	if _, err := tx.ExecContext(ctx, "INSERT INTO machines(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data", m.ID, string(data)); err != nil {
		return Machine{}, err
	}
	if err := replaceRoutes(ctx, tx, m.ID, m.Routes); err != nil {
		return Machine{}, err
	}
	if err := tx.Commit(); err != nil {
		return Machine{}, err
	}
	return m, nil
}

type queryer interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func machine(ctx context.Context, q queryer, id string) (Machine, error) {
	var data string
	err := q.QueryRowContext(ctx, "SELECT data FROM machines WHERE id=?", id).Scan(&data)
	if errors.Is(err, sql.ErrNoRows) {
		return Machine{}, ErrNotFound
	}
	if err != nil {
		return Machine{}, err
	}
	var m Machine
	err = json.Unmarshal([]byte(data), &m)
	return m, err
}
func (s *Store) Machine(ctx context.Context, id string) (Machine, error) {
	return machine(ctx, s.db, id)
}
func (s *Store) Machines(ctx context.Context) ([]Machine, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT data FROM machines ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Machine{}
	for rows.Next() {
		var data string
		if err := rows.Scan(&data); err != nil {
			return nil, err
		}
		var m Machine
		if err := json.Unmarshal([]byte(data), &m); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}
func (s *Store) SetRoutes(ctx context.Context, id string, routes []Route) error {
	if err := validateRoutes(routes); err != nil {
		return err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	m, err := machine(ctx, tx, id)
	if err != nil {
		return err
	}
	if err := checkRoutes(ctx, tx, id, routes); err != nil {
		return err
	}
	if err := saveMachineRoutes(ctx, tx, m, routes); err != nil {
		return err
	}
	return tx.Commit()
}
func serviceID(machine, source, key string) string {
	hash := sha256.Sum256([]byte(machine + "\x00" + source + "\x00" + key))
	return hex.EncodeToString(hash[:16])
}
func validateService(v Service) error {
	if v.Key == "" || v.Source == "" || strings.TrimSpace(v.Name) == "" || !validText(v.Key, 512) || !validText(v.Source, 64) || !validText(v.Name, 512) || !validText(v.Health, 64) || !validText(v.ProcessStarted, 128) || !validText(v.Location, 4096) || !validText(v.Worktree, 4096) || v.PID < 0 || len(v.Ports) > 128 {
		return fmt.Errorf("invalid inventory service")
	}
	switch v.State {
	case "running", "stopped", "failed", "disappeared", "unknown":
	default:
		return fmt.Errorf("invalid service state %q", v.State)
	}
	for _, p := range v.Ports {
		if p < 1 || p > 65535 {
			return fmt.Errorf("invalid service port")
		}
	}
	return nil
}
func normalizeService(v Service, id string, at time.Time) Service {
	v.ID = serviceID(id, v.Source, v.Key)
	v.MachineID = id
	v.ObservedAt = at.UTC()
	v.Ports = append([]int{}, v.Ports...)
	sort.Ints(v.Ports)
	v.Ports = uniquePorts(v.Ports)
	return v
}
func uniquePorts(ports []int) []int {
	out := ports[:0]
	for _, p := range ports {
		if len(out) == 0 || out[len(out)-1] != p {
			out = append(out, p)
		}
	}
	return out
}
func validateCoverage(c Coverage) error {
	if c.Source == "" || !validText(c.Source, 64) || !validText(c.Error, 1024) {
		return fmt.Errorf("invalid collector coverage")
	}
	switch c.State {
	case "ok", "partial", "unavailable", "error":
		return nil
	default:
		return fmt.Errorf("invalid collector state")
	}
}
func services(ctx context.Context, q queryer, id string) ([]Service, error) {
	rows, err := q.QueryContext(ctx, "SELECT data FROM services WHERE machine_id=? ORDER BY source,id", id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Service{}
	for rows.Next() {
		var data string
		if err := rows.Scan(&data); err != nil {
			return nil, err
		}
		var v Service
		if err := json.Unmarshal([]byte(data), &v); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
func coverages(ctx context.Context, q queryer, id string) ([]Coverage, error) {
	rows, err := q.QueryContext(ctx, "SELECT data FROM coverage WHERE machine_id=? ORDER BY source", id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Coverage{}
	for rows.Next() {
		var data string
		if err := rows.Scan(&data); err != nil {
			return nil, err
		}
		var v Coverage
		if err := json.Unmarshal([]byte(data), &v); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
func putService(ctx context.Context, tx *sql.Tx, v Service) error {
	data, err := json.Marshal(v)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO services(machine_id,id,source,data) VALUES(?,?,?,?) ON CONFLICT(machine_id,id) DO UPDATE SET data=excluded.data`, v.MachineID, v.ID, v.Source, string(data))
	return err
}
func putCoverage(ctx context.Context, tx *sql.Tx, id string, c Coverage) error {
	data, err := json.Marshal(c)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO coverage(machine_id,source,data) VALUES(?,?,?) ON CONFLICT(machine_id,source) DO UPDATE SET data=excluded.data`, id, c.Source, string(data))
	return err
}
func putChange(ctx context.Context, tx *sql.Tx, c Change, origin any, remoteID any) error {
	c.ID = 0
	data, err := json.Marshal(c)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO changes(machine_id,service_id,at,data,origin,remote_id) VALUES(?,?,?,?,?,?)`, c.MachineID, c.ServiceID, c.At.UnixMilli(), string(data), origin, remoteID)
	return err
}
func sameService(a, b Service) bool {
	a.ObservedAt = time.Time{}
	b.ObservedAt = time.Time{}
	return reflect.DeepEqual(a, b)
}

// Apply commits a scan, its coverage and any observed changes together.
func (s *Store) Apply(ctx context.Context, id string, collections []Collection, at time.Time) error {
	if at.IsZero() || len(collections) > 64 {
		return fmt.Errorf("invalid inventory scan")
	}
	at = at.UTC()
	sources := map[string]bool{}
	total := 0
	for _, c := range collections {
		if err := validateCoverage(c.Coverage); err != nil {
			return err
		}
		total += len(c.Services)
		if sources[c.Source] || total > 10000 {
			return fmt.Errorf("invalid duplicate or oversized collector")
		}
		sources[c.Source] = true
		seen := map[string]bool{}
		for _, v := range c.Services {
			if err := validateService(v); err != nil {
				return err
			}
			if v.Source != c.Source || seen[v.Key] {
				return fmt.Errorf("duplicate or mismatched service source")
			}
			seen[v.Key] = true
		}
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := machine(ctx, tx, id); err != nil {
		return err
	}
	previous, err := services(ctx, tx, id)
	if err != nil {
		return err
	}
	coverage, err := coverages(ctx, tx, id)
	if err != nil {
		return err
	}
	old := map[string]Service{}
	for _, v := range previous {
		old[v.ID] = v
	}
	prior := map[string]Coverage{}
	for _, c := range coverage {
		prior[c.Source] = c
	}
	for _, c := range collections {
		beforeCoverage, hasCoverage := prior[c.Source]
		if hasCoverage && at.Before(beforeCoverage.At) {
			continue
		}
		gap := hasCoverage && (beforeCoverage.State != "ok" || at.Sub(beforeCoverage.At) > 3*time.Minute)
		observed := map[string]bool{}
		record := func(v Service) error {
			before, exists := old[v.ID]
			if exists && v.ObservedAt.Before(before.ObservedAt) {
				return nil
			}
			if !exists || !sameService(before, v) {
				change := Change{MachineID: id, ServiceID: v.ID, At: at, After: v, Gap: gap}
				if exists {
					change.Before = &before
				}
				if err := putChange(ctx, tx, change, nil, nil); err != nil {
					return err
				}
			}
			return putService(ctx, tx, v)
		}
		// Error/unavailable collectors cannot refresh resource freshness from an incomplete response.
		if c.State == "ok" || c.State == "partial" {
			for _, v := range c.Services {
				v = normalizeService(v, id, at)
				observed[v.ID] = true
				if err := record(v); err != nil {
					return err
				}
			}
		}
		if c.State == "ok" {
			for _, v := range previous {
				if v.Source != c.Source || observed[v.ID] || v.State == "disappeared" {
					continue
				}
				v.State = "disappeared"
				v.Health = ""
				v.ObservedAt = at
				if err := record(v); err != nil {
					return err
				}
			}
		}
		c.Coverage.At = at
		if err := putCoverage(ctx, tx, id, c.Coverage); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM changes WHERE at < ?", at.Add(-30*24*time.Hour).UnixMilli()); err != nil {
		return err
	}
	return tx.Commit()
}
func (s *Store) Snapshot(ctx context.Context, id string) (Snapshot, error) {
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return Snapshot{}, err
	}
	defer tx.Rollback()
	m, err := machine(ctx, tx, id)
	if err != nil {
		return Snapshot{}, err
	}
	v, err := services(ctx, tx, id)
	if err != nil {
		return Snapshot{}, err
	}
	c, err := coverages(ctx, tx, id)
	if err != nil {
		return Snapshot{}, err
	}
	out := Snapshot{Machine: m, Services: v, Coverage: c}
	for _, coverage := range c {
		if coverage.At.After(out.At) {
			out.At = coverage.At
		}
	}
	if err := tx.Commit(); err != nil {
		return Snapshot{}, err
	}
	return out, nil
}
func (s *Store) History(ctx context.Context, id, service string, after int64, limit int) ([]Change, error) {
	if after < 0 {
		return nil, fmt.Errorf("invalid history cursor")
	}
	if limit <= 0 {
		limit = 100
	}
	if limit > 500 {
		limit = 500
	}
	if _, err := s.Machine(ctx, id); err != nil {
		return nil, err
	}
	rows, err := s.db.QueryContext(ctx, `SELECT id,data FROM changes WHERE machine_id=? AND id>? AND (?='' OR service_id=?) ORDER BY id LIMIT ?`, id, after, service, service, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Change{}
	for rows.Next() {
		var seq int64
		var data string
		if err := rows.Scan(&seq, &data); err != nil {
			return nil, err
		}
		var c Change
		if err := json.Unmarshal([]byte(data), &c); err != nil {
			return nil, err
		}
		c.ID = seq
		out = append(out, c)
	}
	return out, rows.Err()
}

// Backup creates a consistent SQLite snapshot without copying live WAL bytes.
func (s *Store) Backup(ctx context.Context, destination string) error {
	if !filepath.IsAbs(destination) || destination == s.path {
		return fmt.Errorf("invalid inventory backup destination")
	}
	if err := statefile.EnsurePrivateDir(filepath.Dir(destination)); err != nil {
		return err
	}
	f, err := os.OpenFile(destination, os.O_CREATE|os.O_EXCL|os.O_RDWR, 0600)
	if err != nil {
		return err
	}
	if err := f.Close(); err != nil {
		os.Remove(destination)
		return err
	}
	if err := statefile.Private(destination); err != nil {
		os.Remove(destination)
		return err
	}
	if _, err := s.db.ExecContext(ctx, "VACUUM INTO ?", destination); err != nil {
		os.Remove(destination)
		return fmt.Errorf("inventory backup: %w", err)
	}
	return nil
}
