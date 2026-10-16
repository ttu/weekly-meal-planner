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
  Issues read and write. Metadata read is added automatically. Nothing else.

Inside the container it becomes `GH_TOKEN`, which `gh` reads, and `gh` is set
as git's credential helper. SSH remotes are rewritten to HTTPS in the
container's own `~/.gitconfig`, so git never uses your SSH key there. The host
name is repo-specific so it cannot collide with another project's container.
`post-create.sh` proves the token with a `push --dry-run`.

## Guardrail

`.claude/hooks/block-dangerous-git.sh` is a `PreToolUse` hook on Claude's Bash
tool, active on the host as well. It allows reversible work — commit, push a
feature branch, open a PR — and blocks force-pushes, pushes to `main`, pushes
of tags or of more than one branch (`--all`, `--mirror`, `--prune`),
`reset --hard`, `clean -f`, `branch -D`, `gh pr merge`, mutating `gh api`
calls and similar. It gates the agent only; you can run anything yourself.

It fails closed rather than guess. Before matching it undoes quoting and
backslash escapes and drops git's and gh's global options (`git -C . push`,
`gh -R o/r pr merge`). It refuses what it cannot read: a push whose target is
built at run time (`$BRANCH`), or a `push`/`pr`/`api` word straight after a
shell expansion (`G=git; $G push`). It refuses what would redirect or rename a
command: git aliases, `GIT_CONFIG_*`, `-c`/`--config-env`/`git config` on
`remote.*`, `push.*`, `branch.*`, `url.*`, `core.*` or `include*` (read the
remote with `git remote -v`), and `HOME`, `XDG_CONFIG_HOME` or `GIT_DIR`-style
overrides that make git read another config. Brace, glob and tilde expansion
in a push (`HEAD:{main,x}`) is refused for the same reason. And it refuses anything naming `.git/hooks`, `.git/config`,
`.husky/`, `.claude/hooks`, `.claude/settings` or the container's branch pin —
reads included; use the Read tool.

Inside the container (`MENAMI_DEVCONTAINER=1`) it also confines the agent to
the branch the container was created on. A push must name its destination —
`git push origin HEAD:<branch>` — because a bare `git push`, or a bare branch
name, goes wherever `remote.<name>.push` in some config says. No switching to,
creating or rewriting another branch, and no repointing remotes. The pin is
`/etc/devcontainer-allowed-branch`, root-owned and read-only; if it is missing,
all git and gh commands are refused. `post-create.sh` ends by removing the
passwordless sudo rule, so nothing in the container can change the pin
afterwards. To install something later, rebuild, or `docker exec -u root` from
the host.

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
- `git push -u` cannot record an upstream; `initialize.sh` sets the branch's
  upstream on the host before the container starts.

`pnpm run test:guardrail` runs the hook's cases in a throwaway container.

### Limits

The hook matches command text. It stops accidents and the obvious detours, not
a determined agent: the token is in the environment, `curl` can reach the
GitHub API, and Claude's Edit and Write tools are not Bash — they can edit
the hook itself. The real boundary is on GitHub — a ruleset on `main` that
blocks direct pushes, force-pushes and deletion, which the PAT cannot bypass.
Without it, treat the PAT as able to write `main`.

`refs/` has to stay writable for commits, and git cannot narrow that to one
branch, so the container can move any local branch ref, `main` included, in
the shared `.git`. It cannot push it (see above), and the reflog on the host
recovers it.

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
