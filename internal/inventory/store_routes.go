package inventory

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"time"
)

func routeOwner(ctx context.Context, q queryer, r Route) (string, error) {
	var id string
	err := q.QueryRowContext(ctx, "SELECT machine_id FROM machine_routes WHERE kind=? AND target=?", r.Kind, r.Target).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return id, err
}
func checkRoutes(ctx context.Context, tx *sql.Tx, id string, routes []Route) error {
	for _, r := range routes {
		owner, err := routeOwner(ctx, tx, r)
		if err != nil {
			return err
		}
		if owner != "" && owner != id {
			return fmt.Errorf("route already belongs to machine %s; explicitly attach it to the selected machine", owner)
		}
	}
	return nil
}
func replaceRoutes(ctx context.Context, tx *sql.Tx, id string, routes []Route) error {
	if _, err := tx.ExecContext(ctx, "DELETE FROM machine_routes WHERE machine_id=?", id); err != nil {
		return err
	}
	for _, r := range routes {
		if _, err := tx.ExecContext(ctx, "INSERT INTO machine_routes(machine_id,kind,target) VALUES(?,?,?)", id, r.Kind, r.Target); err != nil {
			return err
		}
	}
	return nil
}
func saveMachineRoutes(ctx context.Context, tx *sql.Tx, m Machine, routes []Route) error {
	m.Routes = append([]Route{}, routes...)
	m.UpdatedAt = time.Now().UTC()
	data, err := json.Marshal(m)
	if err != nil {
		return err
	}
	if err := replaceRoutes(ctx, tx, m.ID, routes); err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, "UPDATE machines SET data=? WHERE id=?", string(data), m.ID)
	return err
}

// AttachRoutes is an explicit ownership transfer of exact route identities.
// Owners left without routes merge into the selected machine in the same transaction.
// routes is the selected machine's complete desired route set.
func (s *Store) AttachRoutes(ctx context.Context, id string, routes []Route) error {
	if err := validateRoutes(routes); err != nil {
		return err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	target, err := machine(ctx, tx, id)
	if err != nil {
		return err
	}
	owners := map[string]Machine{}
	moving := map[Route]bool{}
	for _, r := range routes {
		owner, err := routeOwner(ctx, tx, r)
		if err != nil {
			return err
		}
		if owner == "" || owner == id {
			continue
		}
		moving[r] = true
		if _, ok := owners[owner]; !ok {
			m, err := machine(ctx, tx, owner)
			if err != nil {
				return err
			}
			owners[owner] = m
		}
	}
	ownerIDs := make([]string, 0, len(owners))
	for owner := range owners {
		ownerIDs = append(ownerIDs, owner)
	}
	sort.Strings(ownerIDs)
	for _, owner := range ownerIDs {
		m := owners[owner]
		remaining := []Route{}
		for _, r := range m.Routes {
			if !moving[r] {
				remaining = append(remaining, r)
			}
		}
		if err := saveMachineRoutes(ctx, tx, m, remaining); err != nil {
			return err
		}
		if len(remaining) == 0 {
			if err := mergeMachine(ctx, tx, id, owner); err != nil {
				return err
			}
		}
	}
	if err := saveMachineRoutes(ctx, tx, target, routes); err != nil {
		return err
	}
	return tx.Commit()
}
func mergeMachine(ctx context.Context, tx *sql.Tx, target, owner string) error {
	cached, err := services(ctx, tx, owner)
	if err != nil {
		return err
	}
	latest, err := services(ctx, tx, target)
	if err != nil {
		return err
	}
	existing := map[string]Service{}
	for _, v := range latest {
		existing[v.ID] = v
	}
	for _, v := range cached {
		v = normalizeService(v, target, v.ObservedAt)
		if current, ok := existing[v.ID]; ok && !v.ObservedAt.After(current.ObservedAt) {
			continue
		}
		if err := putService(ctx, tx, v); err != nil {
			return err
		}
		existing[v.ID] = v
	}
	cachedCoverage, err := coverages(ctx, tx, owner)
	if err != nil {
		return err
	}
	latestCoverage, err := coverages(ctx, tx, target)
	if err != nil {
		return err
	}
	prior := map[string]Coverage{}
	for _, v := range latestCoverage {
		prior[v.Source] = v
	}
	for _, v := range cachedCoverage {
		if current, ok := prior[v.Source]; ok && !v.At.After(current.At) {
			continue
		}
		if err := putCoverage(ctx, tx, target, v); err != nil {
			return err
		}
		prior[v.Source] = v
	}
	rows, err := tx.QueryContext(ctx, "SELECT data,origin,remote_id FROM changes WHERE machine_id=? ORDER BY id", owner)
	if err != nil {
		return err
	}
	type storedChange struct {
		change   Change
		origin   sql.NullString
		remoteID sql.NullInt64
	}
	history := []storedChange{}
	for rows.Next() {
		var c storedChange
		var data string
		if err := rows.Scan(&data, &c.origin, &c.remoteID); err != nil {
			rows.Close()
			return err
		}
		if err := json.Unmarshal([]byte(data), &c.change); err != nil {
			rows.Close()
			return err
		}
		history = append(history, c)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	for _, stored := range history {
		c := stored.change
		c.ID = 0
		c.MachineID = target
		c.After = normalizeService(c.After, target, c.After.ObservedAt)
		c.ServiceID = c.After.ID
		if c.Before != nil {
			before := normalizeService(*c.Before, target, c.Before.ObservedAt)
			c.Before = &before
		}
		data, err := json.Marshal(c)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO changes(machine_id,service_id,at,data,origin,remote_id) VALUES(?,?,?,?,?,?) ON CONFLICT(machine_id,origin,remote_id) DO NOTHING`, target, c.ServiceID, c.At.UnixMilli(), string(data), stored.origin, stored.remoteID); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO cursors(machine_id,origin,sequence) SELECT ?,origin,sequence FROM cursors WHERE machine_id=? ON CONFLICT(machine_id,origin) DO UPDATE SET sequence=max(cursors.sequence,excluded.sequence)`, target, owner); err != nil {
		return err
	}
	for _, table := range []string{"services", "coverage", "changes", "cursors"} {
		// These table names are a fixed internal list, never caller input.
		if _, err := tx.ExecContext(ctx, "DELETE FROM "+table+" WHERE machine_id=?", owner); err != nil {
			return err
		}
	}
	_, err = tx.ExecContext(ctx, "DELETE FROM machines WHERE id=?", owner)
	return err
}
