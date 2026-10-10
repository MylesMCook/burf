//go:build !dev || !wailsfeedback || production

package nativefeedback

import "testing"

func TestDisabledRegardlessOfRuntimeAndConfig(t *testing.T) {
	t.Setenv("WAILS_FEEDBACK", "1")
	bridge, err := Start(Config{CompanionURL: "invalid"})
	if bridge != nil || err != nil {
		t.Fatal("ordinary or production build enabled feedback")
	}
	if got := Services(bridge, nil); got != nil {
		t.Fatal("disabled bridge registered service")
	}
	Attach(bridge, nil)
	Stop(bridge)
	if got := InstanceID(bridge, "original"); got != "original" {
		t.Fatal("release identity changed")
	}
}
