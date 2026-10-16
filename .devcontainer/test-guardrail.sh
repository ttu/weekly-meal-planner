#!/usr/bin/env bash
# Tests for .claude/hooks/block-dangerous-git.sh: `pnpm run test:guardrail`.
# Runs inside a throwaway container, because the dev-container cases need a
# root-owned pin file in /etc. It lives here rather than next to the hook
# because the hook refuses any command that names its own directory.
set -uo pipefail

HOOK="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.claude/hooks/block-dangerous-git.sh"
PIN=/etc/devcontainer-allowed-branch

if [[ ! -f /.dockerenv || $(id -u) -ne 0 ]]; then
  echo "run this as root in a throwaway container: pnpm run test:guardrail" >&2
  exit 1
fi

REPO=$(mktemp -d)
git -C "$REPO" init -q -b feat/pinned
git -C "$REPO" -c user.name=t -c user.email=t@t commit -q --allow-empty -m init
git -C "$REPO" branch other
export CLAUDE_PROJECT_DIR="$REPO"

failures=0
# expect <exit code> <command>
expect() {
  local want=$1 cmd=$2 got
  got=$(jq -cn --arg c "$cmd" '{tool_input:{command:$c}}' | bash "$HOOK" >/dev/null 2>&1; echo $?)
  if [[ "$got" != "$want" ]]; then
    echo "FAIL [$MODE] want $want got $got: $cmd"
    failures=$((failures + 1))
  fi
}

command -v jq >/dev/null || { apt-get update -qq && apt-get install -y -qq jq >/dev/null; }

for MODE in host container; do
  if [[ $MODE == container ]]; then
    export MENAMI_DEVCONTAINER=1
    printf 'feat/pinned\n' > "$PIN"
    chmod 444 "$PIN"
  else
    unset MENAMI_DEVCONTAINER
    rm -f "$PIN"
  fi

  # Ordinary work.
  expect 0 'git status'
  expect 0 'git commit -m "x"'
  # Container pushes need an explicit destination (see below); host ones don't.
  if [[ $MODE == host ]]; then
    expect 0 'git push origin feat/pinned'
    expect 0 'git push -u origin feat/pinned'
  fi
  expect 0 'git push origin HEAD:refs/heads/feat/pinned'
  expect 0 'git -C . log --oneline'
  expect 0 'gh pr create --fill'
  # Words in a message are not commands.
  expect 0 'git commit -m "push the api pr fix"'
  expect 0 'gh pr create --title "add api docs" --body "push later"'
  expect 0 'pnpm run test'

  # Pushes to main, in any spelling.
  expect 2 'git push origin main'
  expect 2 'git push origin +main'
  expect 2 'git push origin HEAD:refs/heads/main'
  expect 2 'git -C . push origin main'
  expect 2 '/usr/bin/git -c x=y push origin main'
  expect 2 'git --git-dir=.git push origin HEAD:main'
  # Force, and flags that push or delete more than one branch.
  expect 2 'git push --force'
  expect 2 'git -C . push -f origin feat/pinned'
  expect 2 'git push origin +feat/pinned'
  for flag in --mirror --all --prune --tags --follow-tags; do
    expect 2 "git push $flag origin"
  done
  # Targets that cannot be read from the text.
  expect 2 'git push origin $BRANCH'
  expect 2 'git push origin "$(git rev-parse --abbrev-ref HEAD)"'
  # gh behind its global flags.
  expect 2 'gh -R ttu/weekly-meal-planner pr merge 1'
  expect 2 'gh --repo ttu/weekly-meal-planner release create v1'
  # Aliases and config injection that rename a blocked command.
  expect 2 'git -c alias.p=push p origin main'
  expect 2 'git config alias.p push'
  expect 2 'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=alias.p GIT_CONFIG_VALUE_0=push git p'
  expect 2 'git -c core.hooksPath=/tmp/h commit -m x'
  # Things that would switch the guardrail off or run code on the host.
  expect 2 'echo "#!/bin/sh" > .git/hooks/pre-commit'
  expect 2 'sed -i s/x/y/ .git/config'
  expect 2 'printf x >> .husky/_/pre-commit'
  expect 2 'printf x >> .husky/pre-commit'
  # Config that redirects a push, given on the command line or stored.
  expect 2 'git -c remote.origin.push=HEAD:refs/heads/main push'
  expect 2 'git --config-env=push.default=X push'
  expect 2 'git -c url.x.pushInsteadOf=y push origin feat/pinned'
  expect 2 'git config --global remote.origin.push HEAD:main'
  expect 2 'git config branch.feat/pinned.merge refs/heads/main'
  # The program hidden from the patterns.
  expect 2 'g\it push origin main'
  expect 2 'G=git; $G push origin main'
  expect 2 'git status; $G push origin main'
  expect 2 'H=gh; $H pr merge 1'
  expect 2 'H=gh; $H api -X POST /x'
  expect 2 'rm .claude/hooks/block-dangerous-git.sh'
  expect 2 'cat /dev/null > .claude/settings.json'
  expect 2 'sudo rm /etc/devcontainer-allowed-branch'
done

# Container only: confined to the pinned branch.
MODE=container
export MENAMI_DEVCONTAINER=1
printf 'feat/pinned\n' > "$PIN"
expect 2 'git push origin other'
expect 2 'git push origin feat/pinned other'
expect 2 'git push origin feat/pinned HEAD:other'
expect 2 'git push origin v1.0.0'
expect 2 'git -C . checkout other'
expect 2 'git switch -c new'
expect 2 'git remote set-url origin x'
expect 2 'git push -u origin feat/pinned'
# Without an explicit destination, remote.<name>.push in some config decides
# where it goes, so only `src:dst` with dst the pinned branch is allowed.
expect 2 'git push'
expect 2 'git push origin'
expect 2 'git push origin feat/pinned'
expect 0 'git push origin HEAD:feat/pinned'
expect 0 'git push origin feat/pinned:refs/heads/feat/pinned'
expect 0 'git checkout -- README.md'

# Container with the pin gone: every git and gh command is refused.
MODE=container-unpinned
rm -f "$PIN"
expect 2 'git status'
expect 2 'gh pr list'
expect 0 'pnpm run test'

if [[ $failures -gt 0 ]]; then
  echo "$failures failure(s)"
  exit 1
fi
echo "all guardrail cases pass"
