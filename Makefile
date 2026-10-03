GO ?= go
# Release builds stamp their version (berthd version); a build from a
# checkout is "dev". VERSION=1.2.3 and VERSION=v1.2.3 both stamp v1.2.3.
VERSION ?= dev
STAMP := $(if $(filter dev,$(VERSION)),dev,v$(patsubst v%,%,$(VERSION)))
LDFLAGS := -s -w -X github.com/sean-brydon/berthd/internal/version.Version=$(STAMP)
BIN := bin

.PHONY: all build daemons test clean

# berth for this machine, plus berthd for every box platform, side by side
# in bin/ so `berth add ssh` can find the right daemon to upload.
all: build daemons

build:
	$(GO) build -trimpath -ldflags="$(LDFLAGS)" -o $(BIN)/ ./cmd/berth ./cmd/berthd

daemons:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GO) build -trimpath -ldflags="$(LDFLAGS)" -o $(BIN)/berthd-linux-amd64 ./cmd/berthd
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 $(GO) build -trimpath -ldflags="$(LDFLAGS)" -o $(BIN)/berthd-linux-arm64 ./cmd/berthd

test:
	$(GO) vet ./...
	$(GO) test -race ./...

clean:
	rm -rf $(BIN) $(DIST)

# The desktop app bundles berth as a Tauri sidecar (named for the host's
# target triple) and the Linux daemons as resources for `add ssh`.
TRIPLE := $(shell rustc -vV 2>/dev/null | sed -n 's/^host: //p')
SIDECAR := app/src-tauri/binaries

.PHONY: app-binaries app-dev app-build
app-binaries: daemons
	mkdir -p $(SIDECAR)
	$(GO) build -trimpath -ldflags="$(LDFLAGS)" -o $(SIDECAR)/berth-$(TRIPLE) ./cmd/berth
	cp $(BIN)/berthd-linux-amd64 $(BIN)/berthd-linux-arm64 $(SIDECAR)/

app-dev: app-binaries
	cd app && pnpm tauri dev

app-build: app-binaries
	cd app && pnpm tauri build

# release builds the archives a GitHub release carries, and checksums.txt,
# into dist/: berthd and berth for linux and darwin, amd64 and arm64. The
# release workflow (.github/workflows/release.yml) runs it on a v* tag;
# site/install.sh downloads from it.
DIST := dist

.PHONY: release
release:
	GO=$(GO) scripts/build-release.sh $(STAMP)

# publish releases VERSION from this Mac: signed app update, CLI, daemons and
# the latest.json feed installed apps update from. See scripts/publish.sh.
.PHONY: publish
publish:
	VERSION=$(VERSION) NOTES="$(NOTES)" scripts/publish.sh
