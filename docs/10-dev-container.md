# 10 — Dev container

Optional. A container for running Claude Code (or yourself) against one branch,
with a token that can reach this repository and nothing else.

Open a **worktree** (not the main checkout — see Worktrees) in VS Code and
choose **Reopen in Container**. `pnpm install`,
the Playwright browser, the Claude Code plugins and a guardrail self-test all
run on creation; a failure stops the build with the reason.

## What is in it

| Piece                     | Source                                                              |
| ------------------------- | ------------------------------------------------------------------- |
| Base image                | `mcr.microsoft.com/playwright:v1.63.0-noble` — bump with Playwright |
| Node 24.9.0, pnpm 10.33.0 | devcontainer `node` feature — bump with `.tool-versions`            |
| Claude Code CLI           | Anthropic feature; latest at build — rebuild to update              |
| superpowers               | `obra/superpowers-marketplace` plugin                               |
| plannotator               | `plannotator.ai` binary + `backnotprop/plannotator` plugin          |
| gh, jq                    | apt, in `post-create.sh`                                            |

Claude's config and plugins live in a per-container volume, so they survive a
rebuild. Forwarded ports: 8081 (Expo web), 6006 (Storybook), 9323 (Playwright
report), 19432 (plannotator's review UI — it runs in remote mode on a fixed
port so VS Code can forward it).

## Host environment

Export these on the host before opening the container:

| Variable                  | What                                                        |
| ------------------------- | ----------------------------------------------------------- |
| `GH_MENAMI_TOKEN`         | Fine-grained PAT, see below                                 |
| `CLAUDE_CODE_OAUTH_TOKEN` | From `claude setup-token`; skips the login in the container |

### The PAT

GitHub → Settings → Developer settings → Fine-grained tokens:

- **Repository access:** only `ttu/weekly-meal-planner`
- **Permissions:** Contents read and write, Pull requests read and write,
  Issues read and write. Metadata read is added automatically. Nothing else —
  in particular not Administration, Secrets, Actions or Workflows: their
  absence is what stops the agent changing settings, secrets or CI.

Inside the container it becomes `GH_TOKEN`, which `gh` reads, and `gh` is set
as git's credential helper. SSH remotes are rewritten to HTTPS in the
container's own `~/.gitconfig`, so git never uses your SSH key there. The host
name is repo-specific so it cannot collide with another project's container.
`post-create.sh` proves the token with a `push --dry-run`.

## What the agent may do on GitHub

In the container, GitHub decides, not a hook: these hold whatever command the
agent writes, including a raw API call. (On the host the agent uses your own
login, so the hook keeps GitHub rules there — see Guardrail.) The agent can push branches, open PRs, comment,
reply to and resolve review threads, and open issues. Three settings, in the
repository on GitHub, bound the rest:

- **The PAT's permissions** (above): no settings, secrets, Actions or
  workflow changes.
- **A ruleset on `main`**, with no bypass actors — the PAT acts as you, so a
  bypass for your role is a bypass for the agent: restrict deletions, block
  force pushes, require a pull request, require the `validate` checks.
- **The `production` environment with you as required reviewer.** A `v*` tag
  deploys production, and the PAT can push tags; the deployment then waits
  for an approval the PAT has no permission to give.

Without the ruleset, the agent can push to `main`. Without the environment
rule, it can deploy production.

## Guardrail

`.claude/hooks/block-dangerous-git.sh` is a `PreToolUse` hook on Claude's Bash
tool, active on the host as well. It covers what GitHub cannot see:

- **Local state git cannot give back** — `reset --hard`, `clean -f`,
  `checkout .`, `restore .`, `branch -D`, `stash drop`, `update-ref`,
  `filter-branch`, `reflog expire`, `worktree remove`, and `gc` /
  `worktree prune` / `prune`, which in a container would delete the other
  worktrees' admin dirs on the host. Aliases that rename these, and
  `GIT_CONFIG_*`, are refused too.
- **Merging** — `gh pr merge`, the REST merge endpoints and the GraphQL
  merge mutations. A ruleset cannot require a review here: the PAT acts as
  you, and you cannot approve your own PR. So the agent opens PRs and you
  merge them.
- **On the host only, publishing that is hard to undo.** There `gh` and git
  use your own login, which reaches every repo you can, so the PAT's limits do
  not apply: force-pushes, pushes to `main`, tag pushes (by flag, by name, or
  through `push.followTags` / `remote.*.push` config), branch-deleting pushes,
  `gh release`/`repo`/`secret`/`workflow` changes, and `gh api` writes are
  refused. Two `gh api` writes are allowed, and only in an exact shape:
  replying to a review comment through REST
  (`gh api repos/<o>/<r>/pulls/<n>/comments/<id>/replies -f body=...`) and
  resolving or unresolving a review thread through GraphQL
  (`gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: "<id>"}) { thread { isResolved } } }'`,
  single-quoted). A field or method flag with its value attached
  (`-ftitle=x`, `-XDELETE`) counts as a write too. The hook checks the call's arguments as the shell would split
  them, so nothing can be added beside the allowed ones. Read-only
  `gh api` calls, `gh pr comment` and `gh pr review --comment` work as usual.

Before matching it undoes quoting and backslash escapes and drops git's and
gh's global options (`git -C . reset`, `gh -R o/r pr merge`), and it refuses a
guarded subcommand straight after a shell expansion (`G=git; $G reset`). It
fails closed if it cannot parse the command. It gates the agent only; you can
run anything yourself.

Inside the container (`MENAMI_DEVCONTAINER=1`) it also confines the agent to
the branch the container was created on, so it cannot commit onto another
local branch in the `.git` it shares with the host: no switching to, creating
or rewriting another branch (`checkout -b`/`--orphan`, `switch -c`,
`stash branch`, `rebase <upstream> <other>`, `rebase --update-refs`, also
with abbreviated long options and in every call of a chain). The pin is `/etc/devcontainer-allowed-branch`,
root-owned and read-only; if it is missing, all git and gh commands are
refused. `post-create.sh` ends by removing the passwordless sudo rule, so
nothing in the container can change the pin afterwards. To install something
later, rebuild, or `docker exec -u root` from the host.

The container shares the host's `.git`, and much of it decides what host git
runs: hooks fire on your next commit, the config can name an fsmonitor, pager
or filter, and a worktree's `.git` file and its `commondir` say which config
that is. So the shared `.git` is mounted **read-only**, except for what
commits, fetches and pushes write — `objects/`, `refs/`, `logs/` and this
worktree's admin dir (`.git/worktrees/<name>`), whose `commondir` and `gitdir`
stay read-only. The worktree's `.git` file and `.husky/` (where
`core.hooksPath` points) are read-only too, and `HUSKY=0` stops
`pnpm install` regenerating hooks. So are `.claude/` — the hook and its
settings, which Claude's Edit and Write tools could otherwise change — and
`.devcontainer/`, whose `initialize.sh` runs on the host each time the
container opens. Consequences:

- The container opens worktrees only; `initialize.sh` refuses the main
  checkout, which has no admin dir of its own to make writable.
- Run `pnpm install` on the host once in a new worktree before opening the
  container, or `post-create.sh` stops and says so.
- Changes to git hooks, the guardrail or the container are made from the
  host.
- `git push -u` cannot record an upstream (the shared config is read-only);
  `initialize.sh` sets the branch's upstream on the host before the container
  starts, so a bare `git push` works.

`pnpm run test:guardrail` runs the hook's cases in a throwaway container.

### Limits

The hook matches command text. It stops accidents and the obvious detours,
not a determined agent — which is why nothing on GitHub depends on it. Shell
spelling is open-ended (line continuations, globs, brace expansion, git's
abbreviated options and autocorrect); the hook refuses the ones it knows and
anything the shell would build, but the list is never complete. Claude's
Edit and Write tools are not Bash: they can write a git config file (an alias,
or `help.autocorrect`) that the hook never sees, in the container too, and on
the host they can edit the hook itself.

`refs/` has to stay writable for commits, and git cannot narrow that to one
branch, so the container can move any local branch ref, `main` included, in
the shared `.git`. The ruleset stops it reaching GitHub, and the reflog on the
host recovers it.

The read-only mounts keep the container from planting anything git runs on its
own. They cannot protect code you run yourself: the worktree is shared, so
`package.json` scripts, test and config files the agent changed run on the
host the next time you run `pnpm` there. Review the diff before running
anything from a container's worktree on the host.

## Worktrees

One container per worktree — the main checkout is refused (see Guardrail):

```bash
git worktree add .worktrees/<slug> -b feat/<slug>
cd .worktrees/<slug> && pnpm install   # generates the husky hooks
code .                                 # then: Reopen in Container
```

A worktree's `.git` is a file pointing at an absolute host path, so
`initialize.sh` runs on the host first and writes those paths to
`.devcontainer/.env` (gitignored); docker-compose mounts them at the same
paths. The repo's other worktrees are not mounted and would look
prunable, so automatic gc is off and `git gc` / `git worktree prune` are
blocked — run those from the host.

`node_modules` is a per-container volume (the macOS bind mount breaks pnpm's
install churn); Playwright browsers are one shared `menami-playwright-browsers`
volume. pnpm's store gets its own volume too: by default pnpm would create it
on the bind mount, inside your host checkout.

## Supabase

Tests run on pglite and need nothing. For manual work run `supabase start` on
the host. The browser reaches it at `127.0.0.1:54421` as usual; scripts run in
the container (`catalogue:sync`, `db:seed`) need `.env` to point at
`http://host.docker.internal:54421` instead.
