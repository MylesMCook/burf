GO ?= go
# Release builds stamp their version (berthd version); a build from a
# checkout is "dev". VERSION=1.2.3 and VERSION=v1.2.3 both stamp v1.2.3.
VERSION ?= dev
STAMP := $(if $(filter dev,$(VERSION)),dev,v$(patsubst v%,%,$(VERSION)))
LDFLAGS := -s -w -X github.com/MylesMCook/burf/internal/version.Version=$(STAMP)
BIN := bin

.PHONY: all build daemons test clean

# berth for this machine, plus berthd for every box platform, side by side
# in bin/ so `burf add ssh` can find the right daemon to upload, and Burf's
# own static tmux for Linux boxes (tmux-linux-amd64, -arm64), which it
# uploads to a box that has none.
all: build daemons

build:
	$(GO) build -trimpath -ldflags="$(LDFLAGS)" -o $(BIN)/ ./cmd/burf ./cmd/burfd
	@# Legacy names are used by existing hooks and daemon discovery.
	cp $(BIN)/burf$(APP_EXE) $(BIN)/berth$(APP_EXE)
	cp $(BIN)/burfd$(APP_EXE) $(BIN)/berthd$(APP_EXE)

# TMUX=0 leaves Burf's tmux out. It is built once (scripts/build-tmux.sh,
# pinned sources in a pinned Alpine container, so it needs Docker) and kept
# in bin/; without Docker, make says so and goes on, and burf add ssh then
# installs tmux with the box's package manager instead.
TMUX ?= 1

daemons:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GO) build -trimpath -ldflags="$(LDFLAGS)" -o $(BIN)/berthd-linux-amd64 ./cmd/burfd
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 $(GO) build -trimpath -ldflags="$(LDFLAGS)" -o $(BIN)/berthd-linux-arm64 ./cmd/burfd
ifneq ($(TMUX),0)
	@scripts/build-tmux.sh $(BIN) || echo "make daemons: Burf's tmux was not built (above says why); burf add ssh installs tmux with the box's package manager instead"
endif

test:
	$(GO) vet ./...
	$(GO) test -race ./...

clean:
	rm -rf $(BIN) $(DIST)

# Native shells are Go/Wails. The frontend still uses its locked pnpm toolchain.
# Outputs are staged under dist/native; nothing here installs or launches them.
# APP_TARGET retains the old universal release spelling for existing callers.
APP_GOOS ?= $(shell $(GO) env GOOS)
APP_GOARCH ?= $(if $(filter universal-apple-darwin,$(APP_TARGET)),universal,$(shell $(GO) env GOARCH))
APP_EXE := $(if $(filter windows,$(shell $(GO) env GOOS)),.exe,)

.PHONY: app-binaries app-dev app-build app-bindings app-build-windows
app-binaries:
	GO=$(GO) scripts/native-build.sh $(APP_GOOS) $(APP_GOARCH) $(VERSION) --sidecars-only

app-bindings:
	node scripts/native-prepare.mjs bindings
	node scripts/wails-cli.mjs generate bindings -ts -names -d ../bindings .

# Edit-to-see stays in Vite; native shell compilation is an explicit build.
app-dev:
	cd app && pnpm dev

ifeq ($(APP_GOOS),windows)
app-build:
	powershell.exe -NoProfile -File scripts/windows-build.ps1 -Version $(VERSION) -Architecture $(APP_GOARCH)
else
app-build:
	GO=$(GO) scripts/native-build.sh $(APP_GOOS) $(APP_GOARCH) $(VERSION)
endif

app-build-windows:
	powershell.exe -NoProfile -File scripts/windows-build.ps1 -Version $(VERSION) -Architecture $(if $(filter arm64,$(APP_GOARCH)),arm64,amd64)

# release builds the archives a GitHub release carries, and checksums.txt,
# into dist/: berthd and berth for linux and darwin, amd64 and arm64. The
# release workflow (.github/workflows/release.yml) runs it on a v* tag;
# site/install.sh downloads from it.
DIST := dist

.PHONY: release
release:
	GO=$(GO) scripts/build-release.sh $(STAMP)

# Publishing remains an explicit command. The updater stays disabled.
.PHONY: publish
publish:
	VERSION=$(VERSION) NOTES="$(NOTES)" scripts/publish.sh

# release-check runs the full release tests, by hand, now and then (they
# are not part of releasing): the app's first run on this Mac from its dmg,
# a fresh Linux box in Docker, and upgrading from the last release, each
# isolated from this machine's own Burf (scripts/release-check.sh).
# It builds everything from HEAD as committed (REF=sha for another commit,
# DIRTY=1 for this checkout's uncommitted changes) in a clean checkout under
# dist/release-test/; on a Mac that includes the app (UNIVERSAL=1 for both
# architectures, as releases are). DMG=path tests that dmg instead, which
# must be built from the same commit. FROM=vX.Y.Z upgrades from that release.
.PHONY: release-check
release-check:
	scripts/release-check.sh $(if $(DMG),--dmg $(DMG)) $(if $(FROM),--from $(FROM)) $(if $(UNIVERSAL),--universal) $(if $(REF),--ref $(REF)) $(if $(DIRTY),--dirty) --version $(STAMP)
