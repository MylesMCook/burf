package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"

	"github.com/MylesMCook/burf/app/native/desktop"
	"github.com/MylesMCook/burf/internal/agent"
	"github.com/MylesMCook/burf/internal/proxy"
	"github.com/MylesMCook/burf/internal/statefile"
	"github.com/MylesMCook/burf/internal/uibundle"
	"github.com/MylesMCook/burf/internal/uicontract"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"github.com/MylesMCook/burf/app/native/internal/nativefeedback"
)

// Populated from app/dist by the repository's existing frontend build.
//
//go:embed all:assets
var embedded embed.FS

// Generated from app/src/lib/shortcuts.json before building or development.
//
//go:embed shortcuts.json
var shortcuts []byte

var version = "0.3.12"

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "burf:", err)
		os.Exit(1)
	}
}

func run() error {
	if len(os.Args) == 2 && os.Args[1] == "--remove-cli-path" {
		return desktop.RemoveInstallerCLIPath()
	}
	home, err := statefile.Home()
	if err != nil {
		return err
	}
	builtin, err := fs.Sub(embedded, "assets")
	if err != nil {
		return err
	}
	assets, info, err := uibundle.Select(builtin, filepath.Join(home, "ui/current"), os.Getenv("BERTH_UI_BUILTIN") != "", uicontract.Shell(), version)
	if err != nil {
		return err
	}
	slog.Info("Burf interface", "source", info.Source, "version", info.Version, "reason", info.Reason)
	service := desktop.New(desktop.Config{
		Version: version, StateHome: home, Interface: info,
		DevtoolsScript: proxy.DevtoolsScript(),
		UIState:        func() (any, error) { return agent.LoadClientUIState(filepath.Join(home, "client")) },
	})
	identity := "dev.myles.burf"
	if runtime.GOOS == "windows" {
		identity = "dev.myles.berth.windows"
	}
	feedbackBridge, feedbackErr := nativefeedback.Start(nativefeedback.Config{CompanionURL: os.Getenv("WAILS_FEEDBACK_COMPANION_URL")})
	if feedbackErr != nil {
		return feedbackErr
	}
	defer nativefeedback.Stop(feedbackBridge)
	app := application.New(application.Options{
		Name:        "Burf",
		Description: "Coding agents on your own computers",
		LogLevel:    slog.LevelInfo, // SDK debug logging includes binding results, including the UI token.
		Services:    nativefeedback.Services(feedbackBridge, []application.Service{application.NewService(service)}),
		Assets: application.AssetOptions{
			Handler:        application.BundledAssetFileServer(assets),
			Middleware:     desktop.AssetMiddleware,
			DisableLogging: true,
		},
		Mac:     application.MacOptions{ApplicationShouldTerminateAfterLastWindowClosed: true},
		Windows: application.WindowsOptions{WebviewUserDataPath: filepath.Join(home, "client", "wails")},
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID:               nativefeedback.InstanceID(feedbackBridge, identity),
			OnSecondInstanceLaunch: func(data application.SecondInstanceData) { desktop.ReceiveLinks(service, data.Args) },
		},
		PostShutdown: func() {
			if err := desktop.AfterShutdown(service); err != nil {
				slog.Error("Restart Burf", "error", err)
			}
		},
	})
	window := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name: "main", Title: "Burf", URL: "/", Width: 1400, Height: 900,
		MinWidth: 900, MinHeight: 560, UseApplicationMenu: runtime.GOOS != "linux",
		Mac: application.MacWindow{TitleBar: application.MacTitleBarHidden},
	})
	nativefeedback.Attach(feedbackBridge, window)
	desktop.Attach(service, app, window)
	if err := desktop.SetMenu(app, service, shortcuts); err != nil {
		return err
	}
	app.Event.OnApplicationEvent(events.Common.ApplicationLaunchedWithUrl, func(event *application.ApplicationEvent) {
		desktop.ReceiveLinks(service, []string{event.Context().URL()})
	})
	window.OnWindowEvent(events.Common.WindowRuntimeReady, func(*application.WindowEvent) {
		desktop.ReceiveLinks(service, os.Args[1:])
	})
	return app.Run()
}
