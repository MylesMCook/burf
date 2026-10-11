package box

import (
	"testing"

	"github.com/MylesMCook/burf/internal/inventory"
)

func TestInventoryManagedUnitMatchesPlatformIdentity(t *testing.T) {
	unit := serviceUnit("shop", "checkout", "web")
	for _, sourceKey := range [][2]string{{"systemd-user", unit + ".service"}, {"launchd-user", unit}, {"windows-tasks", `\Berth-abc123-` + unit}} {
		if !matchesInventoryUnit(inventory.Service{Source: sourceKey[0], Key: sourceKey[1]}, unit, `\Berth-abc123-`) {
			t.Fatal(sourceKey)
		}
	}
	for _, sourceKey := range [][2]string{{"docker", unit}, {"systemd-system", unit + ".service"}, {"listeners", unit}} {
		if matchesInventoryUnit(inventory.Service{Source: sourceKey[0], Key: sourceKey[1], Name: unit}, unit, `\Berth-abc123-`) {
			t.Fatal("unrelated service claimed", sourceKey)
		}
	}
	if matchesInventoryUnit(inventory.Service{Source: "windows-tasks", Key: `\Berth-other-user-` + unit}, unit, `\Berth-abc123-`) {
		t.Fatal("claimed another account's task")
	}
}

func TestInventoryDevServerUsesExistingDirectoryOwnership(t *testing.T) {
	collections := []inventory.Collection{{Coverage: inventory.Coverage{Source: "listeners"}, Services: []inventory.Service{{Source: "listeners", Key: "stable", Name: "node", PID: 42, Ports: []int{3000}}}}}
	locations := []Location{{Name: "shop", Repo: true, Path: "/work/shop", Worktrees: []Worktree{{Name: "checkout", Path: "/work/shop-checkout", Port: 8000}}}}
	associateInventoryProjects(collections, []Port{{PID: 42, Port: 3000, Dir: "/work/shop-checkout/apps/web"}}, locations)
	row := collections[0].Services[0]
	if row.Location != "shop" || row.Worktree != "checkout" {
		t.Fatal(row)
	}
}
