package inventory

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

func cursor(ctx context.Context, q queryer, id, origin string) (int64, error) {
	var seq int64
	err := q.QueryRowContext(ctx, "SELECT sequence FROM cursors WHERE machine_id=? AND origin=?", id, origin).Scan(&seq)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil
	}
	return seq, err
}

// Cursor is the last remote sequence committed alongside a cached snapshot.
func (s *Store) Cursor(ctx context.Context, id, origin string) (int64, error) {
	if origin == "" || !validText(origin, 256) {
		return 0, fmt.Errorf("invalid inventory origin")
	}
	if _, err := s.Machine(ctx, id); err != nil {
		return 0, err
	}
	return cursor(ctx, s.db, id, origin)
}

// Import commits remote history and latest data without inventing duplicate transitions.
// Callers fetch all history pages through the snapshot before importing its latest data.
func (s *Store) Import(ctx context.Context, id, origin string, snapshot Snapshot, changes []Change) error {
	if origin == "" || !validText(origin, 256) || snapshot.At.IsZero() || len(snapshot.Services) > 10000 || len(snapshot.Coverage) > 64 || len(changes) > 10000 {
		return fmt.Errorf("invalid remote inventory")
	}
	seen := map[string]bool{}
	for _, v := range snapshot.Services {
		if err := validateService(v); err != nil {
			return err
		}
		key := serviceID(id, v.Source, v.Key)
		if seen[key] || v.ObservedAt.IsZero() {
			return fmt.Errorf("duplicate or undated remote service")
		}
		seen[key] = true
	}
	seen = map[string]bool{}
	for _, c := range snapshot.Coverage {
		if err := validateCoverage(c); err != nil {
			return err
		}
		if c.At.IsZero() || seen[c.Source] {
			return fmt.Errorf("duplicate or undated remote coverage")
		}
		seen[c.Source] = true
	}
	var previousSeq int64
	for _, c := range changes {
		if c.ID <= previousSeq || c.At.IsZero() {
			return fmt.Errorf("remote history must have increasing positive sequences and observation times")
		}
		previousSeq = c.ID
		if err := validateService(c.After); err != nil {
			return err
		}
		if c.Before != nil {
			if err := validateService(*c.Before); err != nil {
				return err
			}
			if c.Before.Source != c.After.Source || c.Before.Key != c.After.Key {
				return fmt.Errorf("remote change altered service identity")
			}
		}
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
	if snapshot.Machine.OS != "" && snapshot.Machine.OS != m.OS {
		m.OS = snapshot.Machine.OS
		if err := validateMachine(m); err != nil {
			return err
		}
		m.UpdatedAt = time.Now().UTC()
		data, err := json.Marshal(m)
		if err != nil {
			return err
		}
		if _, err = tx.ExecContext(ctx, "UPDATE machines SET data=? WHERE id=?", string(data), id); err != nil {
			return err
		}
	}
	seq, err := cursor(ctx, tx, id, origin)
	if err != nil {
		return err
	}
	for _, c := range changes {
		if c.ID <= seq {
			continue
		}
		remoteID := c.ID
		c.MachineID = id
		c.After = normalizeService(c.After, id, c.At)
		c.ServiceID = c.After.ID
		c.At = c.At.UTC()
		if c.Before != nil {
			before := normalizeService(*c.Before, id, c.Before.ObservedAt)
			c.Before = &before
		}
		if err := putChange(ctx, tx, c, origin, remoteID); err != nil {
			return err
		}
		seq = remoteID
	}
	oldServices, err := services(ctx, tx, id)
	if err != nil {
		return err
	}
	old := map[string]Service{}
	for _, v := range oldServices {
		old[v.ID] = v
	}
	for _, v := range snapshot.Services {
		v = normalizeService(v, id, v.ObservedAt)
		if before, ok := old[v.ID]; ok && v.ObservedAt.Before(before.ObservedAt) {
			continue
		}
		if err := putService(ctx, tx, v); err != nil {
			return err
		}
	}
	oldCoverage, err := coverages(ctx, tx, id)
	if err != nil {
		return err
	}
	prior := map[string]Coverage{}
	for _, c := range oldCoverage {
		prior[c.Source] = c
	}
	for _, c := range snapshot.Coverage {
		c.At = c.At.UTC()
		if before, ok := prior[c.Source]; ok && c.At.Before(before.At) {
			continue
		}
		if err := putCoverage(ctx, tx, id, c); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO cursors(machine_id,origin,sequence) VALUES(?,?,?) ON CONFLICT(machine_id,origin) DO UPDATE SET sequence=excluded.sequence`, id, origin, seq); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM changes WHERE at < ?", time.Now().UTC().Add(-30*24*time.Hour).UnixMilli()); err != nil {
		return err
	}
	return tx.Commit()
}
