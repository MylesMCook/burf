#!/bin/bash
# The runner's job-started hook (ACTIONS_RUNNER_HOOK_JOB_STARTED): it runs
# before every job's first step, from the image rather than the workflow, so
# a workflow file cannot change it. A job that is not the owner's push to
# main or to a v* tag of $BERTH_RUNNER_REPO fails here, before checkout.
set -u

repo=${BERTH_RUNNER_REPO:-}
owner=${repo%%/*}

refuse() {
	echo "::error::This self-hosted runner only runs the owner's pushes to main and v* tags of ${repo:-?}: $*"
	exit 1
}

[ -n "$repo" ] || refuse "BERTH_RUNNER_REPO is not set"
[ "${GITHUB_REPOSITORY:-}" = "$repo" ] || refuse "repository is ${GITHUB_REPOSITORY:-unset}"
[ "${GITHUB_EVENT_NAME:-}" = push ] || refuse "event is ${GITHUB_EVENT_NAME:-unset}"
[ "${GITHUB_ACTOR:-}" = "$owner" ] || refuse "actor is ${GITHUB_ACTOR:-unset}"
# A re-run's triggering actor is whoever re-ran it.
[ "${GITHUB_TRIGGERING_ACTOR:-${GITHUB_ACTOR:-}}" = "$owner" ] || refuse "triggering actor is ${GITHUB_TRIGGERING_ACTOR:-unset}"
case "${GITHUB_REF:-}" in
refs/heads/main | refs/tags/v*) ;;
*) refuse "ref is ${GITHUB_REF:-unset}" ;;
esac

echo "Allowed: $GITHUB_EVENT_NAME to $GITHUB_REF by $GITHUB_ACTOR on $(hostname)"
