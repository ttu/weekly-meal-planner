#!/usr/bin/env bash
# Tests for .claude/hooks/block-dangerous-git.sh: `pnpm run test:guardrail`.
# Runs inside a throwaway container, because the dev-container cases need a
# root-owned pin file in /etc.
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

  # Ordinary work, GitHub included: what may happen on GitHub is decided by
  # the PAT's permissions and the rulesets, not by this hook.
  expect 0 'git status'
  expect 0 'git commit -m "reset the clean branch"'
  expect 0 'git push'
  expect 0 'git push -u origin feat/pinned'
  expect 0 'git -C . log --oneline'
  expect 0 'GIT_EDITOR=true git rebase --continue'
  expect 0 'pnpm run test'
  expect 0 'gh pr create --fill'
  expect 0 'gh pr comment 2 --body "x"'
  expect 0 'gh pr review 2 --comment --body "x"'
  expect 0 'gh api repos/o/r/pulls/2/comments/1/replies -f body=x'
  expect 0 "gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: \"x\"}) { thread { id } } }'"

  # Local state that git cannot give back.
  expect 2 'git reset --hard'
  expect 2 'git clean -fd'
  expect 2 'git checkout .'
  expect 2 'git restore .'
  expect 2 'git branch -D other'
  expect 2 'git stash drop'
  expect 2 'git update-ref -d refs/heads/other'
  expect 2 'git filter-branch'
  expect 2 'git reflog expire --all'
  expect 2 'git worktree remove x'
  expect 2 'git worktree prune'
  expect 2 'git gc'
  expect 2 'git prune'
  # ...behind global options, quoting, escapes or a shell expansion.
  expect 2 'git -C . reset --hard'
  expect 2 'bash -c "git reset --hard"'
  expect 2 'g\it reset --hard'
  expect 2 'G=git; $G reset --hard'
  expect 2 '/usr/bin/gi? clean -fd'
  # ...or renamed by an alias.
  expect 2 'git -c alias.r=reset r --hard'
  expect 2 'git config alias.r reset'
  expect 2 'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=alias.r GIT_CONFIG_VALUE_0=reset git r --hard'
  expect 2 'GIT_CONFIG_GLOBAL=/tmp/x git r --hard'
  expect 2 'git -c include.path=/tmp/x r --hard'

  # Merging stays with a person.
  expect 2 'gh pr merge 2'
  expect 2 'gh -R ttu/weekly-meal-planner pr merge 2'
  expect 2 'H=gh; $H pr merge 2'
  # ...whichever API spells the merge.
  expect 2 'gh api -X PUT repos/o/r/pulls/2/merge'
  expect 2 'gh api repos/o/r/merges -f base=main -f head=x'
  expect 2 'gh api graphql -f query="mutation { mergePullRequest(input:{pullRequestId:\"x\"}) { clientMutationId } }"'
  expect 2 'gh api graphql -f query="mutation { enablePullRequestAutoMerge(input:{pullRequestId:\"x\"}) { clientMutationId } }"'
  expect 2 'gh api graphql -f query="mutation { mergeBranch(input:{}) { clientMutationId } }"'
  expect 0 'gh api repos/o/r/pulls/2'
done

# Host only: gh and git use your own login there, which reaches every repo you
# can, so the GitHub rules stay. Comments, replies and resolving still work.
MODE=host
unset MENAMI_DEVCONTAINER
rm -f "$PIN"
expect 2 'git push --force'
expect 2 'git push origin +feat/pinned'
expect 2 'git push origin main'
expect 2 'git push origin HEAD:refs/heads/main'
expect 2 'git -C . push origin main'
expect 2 'git push --tags'
expect 2 'git push origin --delete feat/pinned'
expect 2 'gh release create v1'
expect 2 'gh repo delete o/r'
expect 2 'gh secret set X'
expect 2 'gh workflow run deploy'
expect 2 'gh api -X DELETE repos/o/r'
expect 2 'gh api repos/o/r/issues -f title=x'
expect 2 'gh api graphql -f query="mutation { deleteRef(input:{refId:\"x\"}) { clientMutationId } }"'
expect 0 'gh api graphql -f query="query { viewer { login } }"'
# Each gh api call is judged on its own; an allowed one does not cover the next.
expect 2 'gh api repos/o/r/pulls/2/comments/1/replies -f body=x; gh api -X DELETE repos/o/r'
expect 2 'gh api repos/o/r/pulls/2/comments/1/replies -f body=x && gh api repos/o/r/issues -f title=y'
# A query the hook cannot read is treated as a write.
expect 2 'gh api graphql -F query=@q.graphql'
expect 2 'gh api graphql --input q.json'
expect 2 'gh api graphql -f query="$(cat q.graphql)"'
# Tags by name, and includes stored in config.
expect 2 'git push origin v1.2.0'
expect 2 'git push origin refs/tags/v1.2.0'
expect 2 'git push origin HEAD:tags/v1'
expect 2 'git config push.followTags true'
expect 2 'git -c push.followTags=true push'
expect 2 'git config remote.origin.push refs/tags/*'
expect 2 'git config remote.origin.mirror true'
expect 2 'git -c push.default=matching push'
expect 2 'git config push.pushOption x'
expect 2 'git config --global include.path /tmp/x'
expect 0 'git push origin feat/pinned'
expect 0 'git commit -m "bump v2 docs"'
# Free text goes through the REST reply endpoint; GraphQL only resolves.
expect 2 'gh api graphql -f query="mutation { addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:\"x\", body:\"y\"}) { comment { id } } }"'
expect 0 "gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: \"PRRT_x\"}) { thread { isResolved } } }' --jq .data"
expect 0 "gh api -X POST repos/o/r/pulls/2/comments/1/replies -f body='Fixed in abc123; see the test.'"
# Anything beside the one allowed field, however it is separated, is refused.
expect 2 'gh api graphql -f query="mutation { resolveReviewThread(input:{threadId:\"x\"}) { thread { id } }, deleteRef(input:{refId:\"y\"}) { clientMutationId } }"'
expect 2 'gh api graphql -f query="mutation { resolveReviewThread(input:{threadId:\"x\"}) { thread { id } } # c
deleteRef(input:{refId:\"y\"}) { clientMutationId } }"'
expect 2 "gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: \"x\"}) { thread { id } } }' -f query='mutation { deleteRef(input: {refId: \"y\"}) { clientMutationId } }'"
expect 2 'gh api repos/o/r/pulls/2/comments/1/replies -f body="$(gh api -X DELETE repos/o/r)"'
expect 2 'gh api repos/o/r/pulls/2/comments/1/replies -f body=x -X DELETE'
# A quote inside the query closing the shell string to add arguments.
expect 2 'gh api graphql -f query="mutation { resolveReviewThread(input: {threadId: "" -F query=@x ""}) { thread { id } } }"'
expect 2 "gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: '' -F query=@x ''}) { thread { id } } }'"
expect 2 "gh api repos/o/r/pulls/2/comments/1/replies -f body='x' -F body=@secret"
expect 2 'gh api graphql -f query="mutation { resolveReviewThread(input: {threadId: \"x\", other: 1}) { thread { id } } }"'
# A field or method flag with its value attached, or among combined short flags.
expect 2 'gh api repos/o/r/issues -ftitle=x'
expect 2 'gh api repos/o/r/issues -if title=x'
expect 2 'gh api repos/o/r/issues --field=title=x'
expect 2 'gh api repos/o/r/issues -Ftitle=x'
expect 2 "gh api graphql -fquery='mutation { deleteRef(input:{refId:\"x\"}) { clientMutationId } }'"
expect 2 'gh api -XDELETE repos/o/r'
expect 2 'gh api -iXDELETE repos/o/r'
expect 0 "gh api graphql -fquery='query { viewer { login } }'"

# Container: the scoped PAT is in use, and GitHub's own limits decide.
MODE=container
export MENAMI_DEVCONTAINER=1
printf 'feat/pinned\n' > "$PIN"
expect 0 'git push origin HEAD:refs/heads/feat/pinned'
expect 0 'git push --tags'
expect 0 'gh api repos/o/r/issues -f title=x'

# Container only: confined to the pinned branch locally.
MODE=container
export MENAMI_DEVCONTAINER=1
printf 'feat/pinned\n' > "$PIN"
expect 2 'git -C . checkout other'
expect 2 'git switch other'
expect 2 'git switch -c new'
expect 2 'git checkout -'
expect 2 'git switch -'
expect 2 'git branch -f other HEAD'
expect 2 'git fetch origin main:main'
expect 2 'git worktree add ../x'
expect 2 'git symbolic-ref HEAD refs/heads/other'
# ...whatever spelling creates the branch.
expect 2 'git switch --create new'
expect 2 'git switch --force-create other'
expect 2 'git switch -cnew'
expect 2 'git checkout -bnew'
expect 2 'git checkout -fb new'
expect 2 'git checkout --orphan x'
expect 2 'git switch --orphan=x'
expect 2 'git stash branch x'
expect 0 'git checkout -- --orphan'
# A rebase rewrites only the pinned branch.
expect 2 'git rebase main other'
expect 2 'git rebase --onto main x other'
expect 2 'git rebase -X theirs main other'
expect 2 'git rebase --root other'
expect 2 'git rebase --update-refs main'
expect 2 'git -c rebase.updateRefs=true rebase main'
expect 0 'git rebase main'
expect 0 'git rebase -i main'
expect 0 'git rebase -X theirs main'
expect 0 'git rebase --onto main x'
expect 0 'git rebase main feat/pinned'
expect 0 'git stash list'
# Every call in a chain is checked, and git's abbreviated long options too.
expect 2 'git checkout -- README.md; git checkout -b new'
expect 2 'git checkout -- README.md && git switch other'
expect 2 'git status; git switch -'
expect 2 'git rebase main; git rebase main other'
expect 2 'git switch --cr new'
expect 2 'git switch --force-c other'
expect 2 'git checkout --orph x'
expect 2 'git rebase --update-r main'
expect 0 'git checkout -- README.md; git rebase main'
expect 0 'git checkout -- README.md'
expect 0 'git branch --list'

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
