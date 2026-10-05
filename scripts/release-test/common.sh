# shellcheck shell=bash
# Shared by the release tests (scripts/fresh-user-test.sh,
# scripts/linux-box-test.sh, scripts/upgrade-test.sh): steps, the report,
# waiting, and reading JSON. Sourced by bash.

# shellcheck disable=SC2034 # the scripts that source this read these
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
	c_bold=$'\033[1m' c_dim=$'\033[2m' c_red=$'\033[31m' c_green=$'\033[32m' c_yellow=$'\033[33m' c_reset=$'\033[0m'
else
	c_bold='' c_dim='' c_red='' c_green='' c_yellow='' c_reset=''
fi

# rt_init NAME OUT: start a report called NAME in folder OUT.
rt_init() {
	RT_NAME=$1
	RT_OUT=$2
	mkdir -p "$RT_OUT"
	RT_REPORT="$RT_OUT/report.md"
	RT_LOG="$RT_OUT/test.log"
	RT_FAILED=0
	RT_PASSED=0
	RT_STEP=0
	RT_CURRENT=""
	RT_STARTED=$(date +%s)
	: >"$RT_LOG"
	{
		echo "# $RT_NAME"
		echo
		echo "Started $(date '+%Y-%m-%d %H:%M:%S %Z') on $(uname -sm)."
		echo
		echo "| # | Step | Result | Time | Detail |"
		echo "| --- | --- | --- | --- | --- |"
	} >"$RT_REPORT"
}

log() { printf '%s %s\n' "$(date +%H:%M:%S)" "$*" >>"$RT_LOG"; }
say() {
	printf '%s\n' "$*"
	log "$*"
}
note() {
	printf '  %s%s%s\n' "$c_dim" "$*" "$c_reset"
	log "  $*"
}

# step NAME FUNCTION [ARGS…]: run FUNCTION as one step of the report, in
# this shell (so what it sets, later steps see), with its output in the
# log. A step fails when FUNCTION returns non-zero, so steps check each
# command with || fail "…" rather than relying on set -e. What it last said
# with detail goes in the report. Later steps still run, unless the step was
# critical (RT_CRITICAL=1 step …): then the test stops there. A step that
# returns 2 was skipped: it doesn't apply, and says why with detail.
step() {
	local name=$1
	shift
	RT_STEP=$((RT_STEP + 1))
	RT_CURRENT=$name
	RT_DETAIL=""
	local t0 rc
	t0=$(date +%s)
	printf '%s[%02d]%s %s… ' "$c_bold" "$RT_STEP" "$c_reset" "$name"
	log "== [$RT_STEP] $name"
	rc=0
	"$@" >>"$RT_LOG" 2>&1 || rc=$?
	local dt=$(($(date +%s) - t0))
	local shot=""
	if declare -F rt_screenshot >/dev/null; then
		shot=$(rt_screenshot "$(printf '%02d' "$RT_STEP")-$(echo "$name" | tr 'A-Z' 'a-z' | tr -cs 'a-z0-9' '-' | sed 's/-*$//')" 2>>"$RT_LOG" || true)
	fi
	local cell
	cell=$(printf '%s' "$RT_DETAIL" | tr '\n|' ' /' | cut -c1-300)
	[ -z "$shot" ] || cell="$cell ![]($(basename "$shot"))"
	if [ $rc -eq 2 ]; then
		# skip: the step doesn't apply (it says why).
		printf '%sskipped%s\n' "$c_yellow" "$c_reset"
		[ -z "$RT_DETAIL" ] || note "$RT_DETAIL"
		echo "| $RT_STEP | $name | skipped | ${dt}s | $cell |" >>"$RT_REPORT"
	elif [ $rc -eq 0 ]; then
		RT_PASSED=$((RT_PASSED + 1))
		printf '%sok%s %s(%ss)%s\n' "$c_green" "$c_reset" "$c_dim" "$dt" "$c_reset"
		[ -z "$RT_DETAIL" ] || note "$RT_DETAIL"
		echo "| $RT_STEP | $name | pass | ${dt}s | $cell |" >>"$RT_REPORT"
	else
		RT_FAILED=$((RT_FAILED + 1))
		printf '%sFAILED%s %s(%ss)%s\n' "$c_red" "$c_reset" "$c_dim" "$dt" "$c_reset"
		[ -z "$RT_DETAIL" ] || printf '  %s%s%s\n' "$c_red" "$RT_DETAIL" "$c_reset"
		# The last lines this step logged say why.
		awk -v n="[$RT_STEP]" 'index($0, "== " n) {p=1} p' "$RT_LOG" | tail -n 12 | sed 's/^/    /'
		echo "| $RT_STEP | $name | **FAIL** | ${dt}s | $cell |" >>"$RT_REPORT"
		if [ "${RT_CRITICAL:-0}" = 1 ]; then
			say "${c_red}A step later ones depend on failed; stopping.${c_reset}"
			rt_finish
		fi
	fi
	return 0
}

# detail TEXT: what the current step found, for the report.
detail() {
	RT_DETAIL=$*
	log "detail: $*"
}

# fail TEXT: end the current step as failed, saying why.
fail() {
	detail "$*"
	echo "FAIL: $*" >&2
	return 1
}

# rt_finish: write the report's end and exit 0 if every step passed.
rt_finish() {
	local dt=$(($(date +%s) - RT_STARTED))
	{
		echo
		if [ "$RT_FAILED" = 0 ]; then
			echo "**Passed**: $RT_PASSED steps in ${dt}s."
		else
			echo "**Failed**: $RT_FAILED of $((RT_PASSED + RT_FAILED)) steps, in ${dt}s. The log is test.log."
		fi
	} >>"$RT_REPORT"
	echo
	if [ "$RT_FAILED" = 0 ]; then
		say "${c_green}${c_bold}$RT_NAME: passed${c_reset} ($RT_PASSED steps, ${dt}s). Report: $RT_REPORT"
		exit 0
	fi
	say "${c_red}${c_bold}$RT_NAME: $RT_FAILED step(s) failed${c_reset} of $((RT_PASSED + RT_FAILED)). Report: $RT_REPORT"
	exit 1
}

# until_ok TIMEOUT COMMAND…: run COMMAND every second until it succeeds or
# TIMEOUT seconds pass.
until_ok() {
	local end=$(($(date +%s) + $1))
	shift
	while true; do
		if "$@" >/dev/null 2>&1; then return 0; fi
		[ "$(date +%s)" -lt "$end" ] || return 1
		sleep 1
	done
}

# jq_py EXPR: evaluate a Python expression over the JSON on stdin, bound to
# j; prints strings bare and everything else as JSON. Exits 1 on None/False.
jq_py() {
	python3 -c '
import json, sys
j = json.load(sys.stdin)
v = eval(sys.argv[1], {"j": j, "any": any, "all": all, "len": len, "sorted": sorted})
if v is None or v is False:
    sys.exit(1)
print(v if isinstance(v, str) else json.dumps(v))
' "$1"
}

# free_port FIRST: the first port from FIRST up that nothing listens on.
free_port() {
	local p=$1
	while [ "$p" -lt $(($1 + 200)) ]; do
		if ! (exec 3<>"/dev/tcp/127.0.0.1/$p") 2>/dev/null; then
			echo "$p"
			return 0
		fi
		p=$((p + 1))
	done
	return 1
}
