package box

import "github.com/MylesMCook/burf/internal/boxclient"

type Doer = boxclient.Doer
type Client = boxclient.Client
type RemoveOptions = boxclient.RemoveOptions

func NewClient(d Doer) *Client { return boxclient.NewClient(d) }
