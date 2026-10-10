package desktop

import (
	"encoding/json"
	"fmt"
	"runtime"
	"strconv"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type shortcut struct {
	ID    string `json:"id"`
	Group string `json:"group"`
	Label string `json:"label"`
	Accel string `json:"accel"`
	Count int    `json:"count"`
	Sep   bool   `json:"sep"`
}

// SetMenu reads the same source table as the frontend. Linux leaves keyboard
// handling in the page so GTK's menu does not consume terminal shortcuts.
func SetMenu(app *application.App, s *Service, table []byte) error {
	if runtime.GOOS == "linux" {
		return nil
	}
	var data struct {
		Shortcuts []shortcut `json:"shortcuts"`
	}
	if err := json.Unmarshal(table, &data); err != nil {
		return err
	}
	menu := application.NewMenu()
	if runtime.GOOS == "darwin" {
		menu.AddRole(application.AppMenu)
	}
	for _, group := range []string{"File", "Edit", "View", "Go", "Window", "Help"} {
		if group == "Edit" {
			menu.AddRole(application.EditMenu)
			continue
		}
		if group == "Window" {
			menu.AddRole(application.WindowMenu)
			windowMenu := menu.FindByRole(application.WindowMenu).GetSubmenu()
			windowMenu.Add("Close window").OnClick(func(*application.Context) { s.main.Close() })
			continue
		}
		var sub *application.Menu
		if group == "Help" && runtime.GOOS == "darwin" {
			menu.AddRole(application.HelpMenu)
			sub = menu.FindByRole(application.HelpMenu).GetSubmenu()
			// The SDK's stock Learn More action navigates the privileged
			// application window to wails.io. Burf's main page stays local.
			sub.Clear()
		} else {
			sub = menu.AddSubmenu(group)
		}
		first := true
		for _, item := range data.Shortcuts {
			if item.Group != group || item.Accel == "" {
				continue
			}
			if item.Sep && !first {
				sub.AddSeparator()
			}
			first = false
			count := item.Count
			if count == 0 {
				count = 1
			}
			for n := 1; n <= count; n++ {
				id, label, accel := item.ID, item.Label, item.Accel
				if item.Count > 0 {
					id += "-" + strconv.Itoa(n)
					label = strings.ReplaceAll(label, "{n}", strconv.Itoa(n))
					accel = strings.ReplaceAll(accel, "{n}", strconv.Itoa(n))
				}
				for _, reserved := range []string{"CmdOrCtrl+C", "CmdOrCtrl+V", "CmdOrCtrl+A", "CmdOrCtrl+F", "CmdOrCtrl+Q", "CmdOrCtrl+H", "CmdOrCtrl+M"} {
					if accel == reserved {
						return fmt.Errorf("shortcut %s takes a reserved native key", id)
					}
				}
				sub.Add(label).SetAccelerator(accel).OnClick(func(*application.Context) { s.emit("berth://menu", id) })
			}
		}
		if group == "View" && runtime.GOOS == "darwin" {
			sub.AddSeparator()
			sub.AddRole(application.ToggleFullscreen)
		}
		if group == "File" && runtime.GOOS != "darwin" {
			sub.AddSeparator()
			sub.AddRole(application.Quit)
		}
		if group == "Help" && runtime.GOOS != "darwin" {
			sub.AddRole(application.About)
		}
	}
	app.Menu.Set(menu)
	return nil
}
