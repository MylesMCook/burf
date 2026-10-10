package localchat

// Only the app-server's public summary string array enters the transcript.
// Raw reasoning content, encrypted content and raw-content deltas are not parsed.
func publicSummary(parts []string) []string {
	result := make([]string, 0, min(len(parts), 256))
	left := maxText
	for _, part := range parts {
		if left <= 0 || len(result) == 256 {
			break
		}
		if len(part) > left {
			part = part[:left]
		}
		result = append(result, part)
		left -= len(part) + 2
	}
	return result
}
