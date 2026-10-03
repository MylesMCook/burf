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

# The desktop app bundles berth as a Tauri sidecar, berth-cli (named for the
# target triple; "berth" is the app's own executable), and the Linux daemons
# as resources for `add ssh`. tauri.bundle.conf.json adds them to release
# builds only, so `pnpm tauri dev` and `cargo check` work without them; in
# dev the app starts the agent from bin/berth.
#
# make app-build builds Berth.app and a dmg for this Mac. Releases build
# APP_TARGET=universal-apple-darwin, one app for Apple silicon and Intel, with
# berth-cli made universal by lipo (scripts/mac-release.sh). With VERSION set
# the app carries that version (the in-app updater compares it); with
# TAURI_SIGNING_PRIVATE_KEY set it also writes the signed updater archive
# (tauri.updater.conf.json); with APPLE_SIGNING_IDENTITY set it signs.
TRIPLE := $(shell rustc -vV 2>/dev/null | sed -n 's/^host: //p')
APP_TARGET ?= $(TRIPLE)
SIDECAR := app/src-tauri/binaries
APP_VERSION := $(if $(filter dev,$(VERSION)),,$(patsubst v%,%,$(VERSION)))
APP_GOARCH := $(if $(findstring aarch64,$(APP_TARGET)),arm64,$(if $(findstring x86_64,$(APP_TARGET)),amd64))

.PHONY: app-binaries app-dev app-build
app-binaries: daemons
	mkdir -p $(SIDECAR)
ifeq ($(APP_TARGET),universal-apple-darwin)
	GOOS=darwin GOARCH=arm64 $(GO) build -trimpath -ldflags="$(LDFLAGS)" -o $(SIDECAR)/berth-cli-aarch64-apple-darwin ./cmd/berth
	GOOS=darwin GOARCH=amd64 $(GO) build -trimpath -ldflags="$(LDFLAGS)" -o $(SIDECAR)/berth-cli-x86_64-apple-darwin ./cmd/berth
	lipo -create -output $(SIDECAR)/berth-cli-universal-apple-darwin $(SIDECAR)/berth-cli-aarch64-apple-darwin $(SIDECAR)/berth-cli-x86_64-apple-darwin
else
	$(if $(APP_GOARCH),GOARCH=$(APP_GOARCH)) $(GO) build -trimpath -ldflags="$(LDFLAGS)" -o $(SIDECAR)/berth-cli-$(APP_TARGET) ./cmd/berth
endif
	cp $(BIN)/berthd-linux-amd64 $(BIN)/berthd-linux-arm64 $(SIDECAR)/

app-dev: all
	cd app && pnpm tauri dev

app-build: app-binaries
	cd app && pnpm tauri build --config src-tauri/tauri.bundle.conf.json \
		$(if $(APP_VERSION),--config '{"version":"$(APP_VERSION)"}') \
		$(if $(filter $(TRIPLE),$(APP_TARGET)),,--target $(APP_TARGET)) \
		$$([ -z "$$TAURI_SIGNING_PRIVATE_KEY" ] || echo --config src-tauri/tauri.updater.conf.json)

# release builds the archives a GitHub release carries, and checksums.txt,
# into dist/: berthd and berth for linux and darwin, amd64 and arm64. The
# release workflow (.github/workflows/release.yml) runs it on a v* tag;
# site/install.sh downloads from it.
DIST := dist

.PHONY: release
release:
	GO=$(GO) scripts/build-release.sh $(STAMP)

# publish releases VERSION from this Mac: the signed, notarized app, its
# updater archive and the latest.json feed installed apps update from; the
# tag it pushes has CI add the CLI and daemons. See scripts/publish.sh.
.PHONY: publish
publish:
	VERSION=$(VERSION) NOTES="$(NOTES)" scripts/publish.sh
