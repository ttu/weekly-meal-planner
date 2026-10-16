# 10 — Dev container

Optional. A container for running Claude Code (or yourself) against one branch,
with a token that can reach this repository and nothing else.

Open the folder in VS Code and choose **Reopen in Container**. `pnpm install`,
the Playwright browser, the Claude Code plugins and a guardrail self-test all
run on creation; a failure stops the build with the reason.

## What is in it

| Piece                     | Source                                                              |
| ------------------------- | ------------------------------------------------------------------- |
| Base image                | `mcr.microsoft.com/playwright:v1.63.0-noble` — bump with Playwright |
| Node 24.9.0, pnpm 10.33.0 | devcontainer `node` feature — bump with `.tool-versions`            |
| Claude Code CLI           | Anthropic feature; updated on every container start                 |
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
feature branch, open a PR — and blocks force-pushes, pushes to `main`,
`reset --hard`, `clean -f`, `branch -D`, `gh pr merge`, mutating `gh api`
calls and similar. It fails closed if it cannot parse the command. It gates the
agent only; you can run anything yourself.

Inside the container it also confines the agent to the branch the container
was created on: no pushing, switching to or rewriting any other branch, and no
repointing remotes.

The hook matches command text, so it stops accidents, not a determined agent:
the token is in the environment and `curl` can reach the GitHub API directly.
The real boundary is on GitHub — a ruleset on `main` that blocks direct pushes,
force-pushes and deletion, which the PAT cannot bypass. Until that exists
(`TODO.md`), treat the PAT as able to write `main`.

## Worktrees

One container per worktree. A worktree's `.git` is a file pointing at an
absolute host path, so `initialize.sh` runs on the host first and writes those
paths to `.devcontainer/.env` (gitignored); docker-compose mounts them at the
same paths. The repo's other worktrees are not mounted and would look
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
