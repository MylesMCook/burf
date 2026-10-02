package box

import (
	"testing"
	"time"
)

func TestCronParsesAndFindsTheNextRun(t *testing.T) {
	at := func(s string) time.Time {
		v, err := time.ParseInLocation("2006-01-02 15:04 Mon", s, time.UTC)
		if err != nil {
			t.Fatal(err)
		}
		return v
	}
	for _, tc := range []struct{ expr, from, want string }{
		{"@daily", "2026-10-02 20:13 Fri", "2026-10-03 00:00 Sat"},
		{"@hourly", "2026-10-02 20:13 Fri", "2026-10-02 21:00 Fri"},
		{"0 2 * * *", "2026-10-02 02:00 Fri", "2026-10-03 02:00 Sat"},
		{"*/15 9-17 * * 1-5", "2026-10-02 17:50 Fri", "2026-10-05 09:00 Mon"},
		{"30 8 * * 7", "2026-10-02 20:00 Fri", "2026-10-04 08:30 Sun"},
		{"0 0 1,15 * *", "2026-10-02 00:00 Fri", "2026-10-15 00:00 Thu"},
		{"0 12 13 * 5", "2026-10-02 13:00 Fri", "2026-10-09 12:00 Fri"}, // either day field
		{"5 4 * 2 *", "2026-10-02 00:00 Fri", "2027-02-01 04:05 Mon"},
	} {
		c, err := ParseCron(tc.expr)
		if err != nil {
			t.Fatalf("%s: %v", tc.expr, err)
		}
		if got := c.Next(at(tc.from)); !got.Equal(at(tc.want)) {
			t.Errorf("%s after %s = %s, want %s", tc.expr, tc.from, got.Format("2006-01-02 15:04 Mon"), tc.want)
		}
	}
	if c, _ := ParseCron("0 0 30 2 *"); !c.Next(at("2026-10-02 00:00 Fri")).IsZero() {
		t.Error("30 February should never run")
	}
	for _, bad := range []string{"", "* * * *", "60 * * * *", "* 24 * * *", "* * 0 * *", "*/0 * * * *", "a * * * *", "5-1 * * * *"} {
		if _, err := ParseCron(bad); err == nil {
			t.Errorf("%q parsed", bad)
		}
	}
}
