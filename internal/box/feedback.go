package box

import "github.com/MylesMCook/burf/internal/boxclient"

// CheckFeedback trims a check's output to the lines that say what failed,
// followed by its last lines, bounded by limit.
func CheckFeedback(out string, limit int) string { return boxclient.CheckFeedback(out, limit) }
