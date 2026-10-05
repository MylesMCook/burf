package proxy

import (
	"net"
	"net/url"
	"strconv"
)

// Dev servers believe they run on localhost:<port>. Requests are rewritten to
// match that belief, and redirects back to the URL the browser is really on,
// so apps need no configuration to work behind the proxy.

func upstreamOrigin(port int) string { return "http://localhost:" + strconv.Itoa(port) }

// toUpstream maps a browser-side Origin or Referer onto the app's own origin.
func toUpstream(value, publicHost string, port int) string {
	u, err := url.Parse(value)
	if err != nil || u.Host != publicHost {
		return value
	}
	u.Scheme = "http"
	u.Host = "localhost:" + strconv.Itoa(port)
	return u.String()
}

// toPublic maps a Location the app generated for itself back onto the public
// host. A redirect to another port on the box's loopback (an auth server on
// localhost:4000, say) goes to that port's own name, PORT.BOX.localhost, as
// "localhost" on the box is the box, never this laptop. Other hosts are left
// alone: an app redirecting to an OAuth provider must keep doing so.
func toPublic(location, publicHost string, port int, box string) string {
	u, err := url.Parse(location)
	if err != nil || u.Host == "" {
		return location
	}
	host, p, err := net.SplitHostPort(u.Host)
	if err != nil {
		return location
	}
	if host != "localhost" && host != "127.0.0.1" && host != "::1" {
		return location
	}
	u.Scheme = "http"
	if p == strconv.Itoa(port) {
		u.Host = publicHost
		return u.String()
	}
	other, err := strconv.Atoi(p)
	if err != nil || other < 1 || other > 65535 || box == "" {
		return location
	}
	u.Host = p + "." + box + ".localhost"
	if _, proxyPort, err := net.SplitHostPort(publicHost); err == nil {
		u.Host += ":" + proxyPort
	}
	return u.String()
}
