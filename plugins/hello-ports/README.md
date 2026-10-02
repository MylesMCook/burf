# Hello ports

An example Berth plugin: a status bar count of dev servers, and a screen
listing every one on every box with a button to open it.

```sh
pnpm install && pnpm build
mkdir -p ~/.berth/plugins && ln -s "$PWD" ~/.berth/plugins/hello-ports
```

Then Settings → Plugins → Reload in the app.
