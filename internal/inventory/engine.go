package inventory

import (
	"context"
	"errors"
	"sync"
	"time"
)

// Engine coalesces inventory refreshes and stops every collector on shutdown.
// A nil collection means the collector already imported an authoritative snapshot.
type Engine struct {
	Store    *Store
	Collect  func(context.Context, Machine) ([]Collection, error)
	Prepare  func(context.Context) error
	ctx      context.Context
	cancel   context.CancelFunc
	mu       sync.Mutex
	jobs     map[string]*inventoryJob
	next     map[string]time.Time
	failures map[string]int
	capacity chan struct{}
	wg       sync.WaitGroup
	started  bool
	wake     chan struct{}
}

type inventoryJob struct {
	done chan struct{}
	err  error
}

func NewEngine(ctx context.Context, store *Store, collect func(context.Context, Machine) ([]Collection, error)) *Engine {
	ctx, cancel := context.WithCancel(ctx)
	return &Engine{Store: store, Collect: collect, ctx: ctx, cancel: cancel, jobs: map[string]*inventoryJob{}, next: map[string]time.Time{}, failures: map[string]int{}, capacity: make(chan struct{}, 4), wake: make(chan struct{}, 1)}
}

func (e *Engine) Close() { e.cancel(); e.mu.Lock(); e.mu.Unlock(); e.wg.Wait() }

func (e *Engine) Refresh(ctx context.Context, id string) (Snapshot, error) {
	j, err := e.start(id)
	if err != nil {
		return Snapshot{}, err
	}
	select {
	case <-ctx.Done():
		return Snapshot{}, ctx.Err()
	case <-j.done:
		if j.err != nil {
			return Snapshot{}, j.err
		}
		return e.Store.Snapshot(ctx, id)
	}
}

func (e *Engine) start(id string) (*inventoryJob, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.ctx.Err() != nil {
		return nil, e.ctx.Err()
	}
	j := e.jobs[id]
	if j == nil {
		j = &inventoryJob{done: make(chan struct{})}
		e.jobs[id] = j
		e.wg.Add(1)
		go e.refresh(id, j)
	}
	return j, nil
}

func (e *Engine) refresh(id string, j *inventoryJob) {
	defer e.wg.Done()
	ctx, cancel := context.WithTimeout(e.ctx, 45*time.Second)
	defer cancel()
	select {
	case e.capacity <- struct{}{}:
		defer func() { <-e.capacity }()
	case <-ctx.Done():
		e.finish(id, j, ctx.Err(), true)
		return
	}
	m, err := e.Store.Machine(ctx, id)
	var collections []Collection
	if err == nil {
		collections, err = e.Collect(ctx, m)
	}
	failed := err != nil
	for _, c := range collections {
		if c.State == "error" {
			failed = true
		}
	}
	if err != nil && !errors.Is(err, ErrNotFound) && e.ctx.Err() == nil {
		persistCtx, stop := context.WithTimeout(e.ctx, 2*time.Second)
		defer stop()
		ctx = persistCtx
		// An unreachable machine leaves every previous source visibly stale.
		snapshot, readErr := e.Store.Snapshot(ctx, id)
		if readErr == nil {
			for _, c := range snapshot.Coverage {
				if c.Source == "connection" {
					continue
				}
				collections = append(collections, Collection{Coverage: Coverage{Source: c.Source, State: "error", Error: "Collection failed; check the machine connection and access.", At: time.Now().UTC()}})
			}
			collections = append(collections, Collection{Coverage: Coverage{Source: "connection", State: "error", Error: "Collection failed; check the machine connection and access.", At: time.Now().UTC()}})
			err = nil
		}
	}
	if err == nil && collections != nil {
		err = e.Store.Apply(ctx, id, collections, time.Now().UTC())
	}
	e.finish(id, j, err, failed || err != nil)
}

func (e *Engine) finish(id string, j *inventoryJob, err error, failed bool) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if failed {
		e.failures[id]++
	} else {
		e.failures[id] = 0
	}
	delay := time.Minute * time.Duration(1<<min(e.failures[id], 4))
	e.next[id] = time.Now().Add(delay)
	j.err = err
	delete(e.jobs, id)
	close(j.done)
	select {
	case e.wake <- struct{}{}:
	default:
	}
}

// Run polls while the existing owning process runs. It creates no supervisor.
func (e *Engine) Start() {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.ctx.Err() != nil {
		return
	}
	if e.started {
		return
	}
	e.started = true
	e.wg.Add(1)
	go func() { defer e.wg.Done(); e.run() }()
}

func (e *Engine) run() {
	for {
		if e.Prepare != nil {
			_ = e.Prepare(e.ctx)
		}
		machines, err := e.Store.Machines(e.ctx)
		delay := time.Minute
		if err == nil {
			for _, m := range machines {
				e.mu.Lock()
				next := e.next[m.ID]
				running := e.jobs[m.ID] != nil
				e.mu.Unlock()
				if !running && !time.Now().Before(next) {
					_, _ = e.start(m.ID)
				} else if !running {
					delay = min(delay, max(time.Millisecond, time.Until(next)))
				}
			}
		}
		timer := time.NewTimer(delay)
		select {
		case <-e.ctx.Done():
			timer.Stop()
			return
		case <-e.wake:
			timer.Stop()
		case <-timer.C:
		}
	}
}
