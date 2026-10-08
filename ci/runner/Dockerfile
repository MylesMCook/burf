# The self-hosted GitHub Actions runner for MylesMCook/burf: Ubuntu 24.04,
# like GitHub's ubuntu-latest, with the tools the CI and release jobs use.
# Build and run it with install.sh / update.sh; see README.md.
FROM ubuntu:24.04

# The runner is pinned and its download checked. To update: take the version
# and the linux-x64 sha256 from https://github.com/actions/runner/releases,
# change both here, then run update.sh.
ARG RUNNER_VERSION=2.337.0
ARG RUNNER_SHA256=70920811a4f8ad4328818682bca5c6469c1c942fab52448868071d0063816613

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    RUNNER_VERSION=${RUNNER_VERSION}

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git jq build-essential unzip zip xz-utils zstd \
      gnupg sudo python3 tmux shellcheck dash tzdata procps iproute2 \
      lsof openssh-client rsync file less util-linux \
      # Playwright's system dependencies for Chromium on Ubuntu 24.04 (what
      # `playwright install-deps chromium` installs), so its --with-deps
      # step finds them already there.
      libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 libatspi2.0-0t64 \
      libcairo2 libcups2t64 libdbus-1-3 libdrm2 libgbm1 libglib2.0-0t64 \
      libnspr4 libnss3 libpango-1.0-0 libx11-6 libxcb1 libxcomposite1 \
      libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2 xvfb \
      fonts-liberation fonts-noto-color-emoji fonts-unifont libfontconfig1 \
      libfreetype6 xfonts-cyrillic xfonts-scalable fonts-ipafont-gothic \
      fonts-wqy-zenhei fonts-tlwg-loma-otf fonts-freefont-ttf \
 && install -d -m 0755 /etc/apt/keyrings \
 # gh, for the release job (ubuntu-latest has it).
 && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /etc/apt/keyrings/githubcli.gpg \
 && echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/githubcli.gpg] https://cli.github.com/packages stable main" >/etc/apt/sources.list.d/github-cli.list \
 # A real Chrome for the browser test (ubuntu-latest has one; Ubuntu's own
 # chromium package is a snap, which a container cannot run).
 && curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /etc/apt/keyrings/google-chrome.gpg \
 && echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" >/etc/apt/sources.list.d/google-chrome.list \
 && apt-get update && apt-get install -y --no-install-recommends gh google-chrome-stable \
 && rm -rf /var/lib/apt/lists/*

# Several jobs share this container and workflows run `sudo apt-get`: one
# apt at a time, the others wait instead of failing on dpkg's lock.
RUN printf '#!/bin/sh\nexec flock -w 900 /var/lock/berth-apt /usr/bin/apt-get "$@"\n' >/usr/local/sbin/apt-get \
 && chmod 0755 /usr/local/sbin/apt-get

# The runner user, uid 1001 as on GitHub's images, with passwordless sudo
# inside this container only (workflows `sudo apt-get install`).
RUN userdel -r ubuntu 2>/dev/null || true; \
    useradd -m -u 1001 -s /bin/bash runner \
 && echo 'runner ALL=(ALL) NOPASSWD:ALL' >/etc/sudoers.d/runner \
 && chmod 0440 /etc/sudoers.d/runner

RUN mkdir -p /opt/actions-runner && cd /opt/actions-runner \
 && curl -fsSL -o runner.tar.gz "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" \
 && echo "${RUNNER_SHA256}  runner.tar.gz" | sha256sum -c - \
 && tar -xzf runner.tar.gz && rm runner.tar.gz \
 && ./bin/installdependencies.sh \
 && rm -rf /var/lib/apt/lists/* \
 && chown -R runner:runner /opt/actions-runner

COPY --chmod=0755 entrypoint.sh job-started.sh /opt/berth-runner/

# The runners' copies, their registrations, work dirs and tool caches live
# in the named volume mounted here.
RUN mkdir -p /runner && chown runner:runner /runner
VOLUME /runner

USER runner
WORKDIR /home/runner
# Run with `docker run --init` (common.sh): Docker's init reaps orphans.
# Ubuntu's tini package as PID 1 instead left tmux panes' exit statuses
# unread (internal/box's Ctrl-C service test failed every time).
ENTRYPOINT ["/opt/berth-runner/entrypoint.sh"]
