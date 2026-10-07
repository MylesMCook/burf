package agent

import (
	"math/rand/v2"
	"time"
)

// backoff is how long to wait before the attempt-th retry (1 is the first):
// base doubling to at most limit, then ±20% at random, so boxes (and
// laptops) that lost the network together don't all knock at once when it
// comes back.
func backoff(attempt int, base, limit time.Duration) time.Duration {
	if attempt < 1 {
		attempt = 1
	}
	d := base
	for i := 1; i < attempt && d < limit; i++ {
		d *= 2
	}
	d = min(d, limit)
	return jitter(d)
}

// jitter is d give or take 20%.
func jitter(d time.Duration) time.Duration {
	if d <= 0 {
		return d
	}
	spread := int64(d) * 2 / 5
	return time.Duration(int64(d) - spread/2 + rand.Int64N(spread+1))
}
