package desktop

import "os"

type cliLink struct {
	Link    string  `json:"link"`
	Bundled *string `json:"bundled"`
	Blocked *string `json:"blocked"`
	State   string  `json:"state"`
	Target  *string `json:"target"`
}

func privateStateReason() *string {
	if os.Getenv("BERTH_HOME") == "" {
		return nil
	}
	why := "This copy of Burf keeps its state in a folder of its own (BERTH_HOME), so a burf command in a terminal would not reach it."
	return &why
}
