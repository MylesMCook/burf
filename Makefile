GO ?= go
LDFLAGS := -s -w
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

# release builds every asset install.sh can fetch, plus their checksums, into
# dist/. Upload the whole directory to a GitHub release.
DIST := dist
PLATFORMS := linux/amd64 linux/arm64 darwin/amd64 darwin/arm64

.PHONY: release
release:
	rm -rf $(DIST) && mkdir -p $(DIST)
	for p in $(PLATFORMS); do \
		os=$${p%/*}; arch=$${p#*/}; \
		CGO_ENABLED=0 GOOS=$$os GOARCH=$$arch $(GO) build -trimpath -ldflags="$(LDFLAGS)" -o $(DIST)/berth-$$os-$$arch ./cmd/berth || exit 1; \
	done
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GO) build -trimpath -ldflags="$(LDFLAGS)" -o $(DIST)/berthd-linux-amd64 ./cmd/berthd
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 $(GO) build -trimpath -ldflags="$(LDFLAGS)" -o $(DIST)/berthd-linux-arm64 ./cmd/berthd
	cd $(DIST) && shasum -a 256 berth-* berthd-* > SHA256SUMS

# publish releases VERSION from this Mac: signed app update, CLI, daemons and
# the latest.json feed installed apps update from. See scripts/publish.sh.
.PHONY: publish
publish:
	VERSION=$(VERSION) NOTES="$(NOTES)" scripts/publish.sh
