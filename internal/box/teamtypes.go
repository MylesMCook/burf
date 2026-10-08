package box

import "github.com/MylesMCook/burf/internal/boxclient"

// TeamBundle is a team setup on its way to a box: what the laptop read
// through its own gh at the commit the engineer reviewed, so the box needs
// no GitHub access for .berth itself. Repositories the box clones with its
// own gh sign-in (the "github" step).
type TeamBundle = boxclient.TeamBundle

// TeamProjectPlan is one repository to clone and set up.
type TeamProjectPlan = boxclient.TeamProjectPlan

// Team step and project states.
const (
	TeamTodo      = boxclient.TeamTodo
	TeamRunning   = boxclient.TeamRunning
	TeamWaiting   = boxclient.TeamWaiting
	TeamDone      = boxclient.TeamDone
	TeamSkipped   = boxclient.TeamSkipped
	TeamFailed    = boxclient.TeamFailed
	TeamQueued    = boxclient.TeamQueued
	TeamCloning   = boxclient.TeamCloning
	TeamSettingUp = boxclient.TeamSettingUp
	TeamReady     = boxclient.TeamReady
)

// TeamStatus is how a team setup stands on a box.
type TeamStatus = boxclient.TeamStatus

type TeamStepStatus = boxclient.TeamStepStatus

type TeamProjectStatus = boxclient.TeamProjectStatus
