#!/bin/bash
# PreToolUse(Bash) guardrail for Claude's Bash tool.
#
# Policy: the agent may do normal, reversible development work — commit,
# rebase, push, open and comment on PRs. It may not destroy local state that
# git cannot give back (uncommitted work, unreachable commits, other
# worktrees), and it may not merge a PR: that stays with a person.
#
# What may happen on GitHub depends on the token. In the dev container it is a
# PAT scoped to this repository without Administration, Secrets, Actions or
# Workflows permissions; a ruleset protects main and the production
# environment needs a reviewer, and those hold whatever command the agent
# writes. On the host, gh and git use your own login, which reaches every repo
# you can — so there this hook also blocks publishing that is hard to undo.
# See docs/10-dev-container.md.
#
# This gates the agent only. Humans are unaffected and can run anything.
#
# Fails CLOSED: if the command cannot be parsed, the call is blocked rather
# than allowed. A guardrail that silently no-ops is worse than none.

set -uo pipefail

INPUT=$(cat)

# The dev container's base image has no jq, so fall back to node before giving up.
if command -v jq >/dev/null 2>&1; then
  COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')
elif command -v node >/dev/null 2>&1; then
  COMMAND=$(printf '%s' "$INPUT" | node -e \
    'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).tool_input?.command??"")}catch{process.exit(3)}})')
else
  echo "BLOCKED: git guardrail cannot parse tool input (no jq or node available)." >&2
  exit 2
fi

# Empty command means the payload shape changed or parsing failed -> fail closed.
if [[ -z "$COMMAND" ]]; then
  echo "BLOCKED: git guardrail could not read the command; refusing to run it." >&2
  exit 2
fi

# Subcommands the rules below guard. A guarded word straight after a token
# the shell expands (`G=git; $G reset`, `${G} reset`, `/usr/bin/gi? clean`)
# is refused: what would run cannot be known from the text.
GUARDED='reset|clean|checkout|restore|switch|branch|stash|update-ref|filter-branch|reflog|worktree|gc|prune|symbolic-ref|fetch|push|pr|api|release|repo|secret|workflow'
if printf '%s' "$COMMAND" | tr -d '"'"'"'' | awk -v words="^($GUARDED)\$" '
  { for (i = 2; i <= NF; i++) if ($i ~ words && $(i - 1) ~ /[$\\(){}*?[]/) found = 1 }
  END { exit !found }'; then
  echo "BLOCKED: '$COMMAND' runs git or gh through a shell expansion the guardrail cannot check." >&2
  echo "Spell the command out: git <subcommand> ..., gh pr ...." >&2
  exit 2
fi

# Quoting, backslash escapes and shell nesting would otherwise hide a command
# from the patterns: `bash -c "git reset --hard"`, `g\it reset`, `$(...)`.
# normalize() returns a copy with those undone and shell metacharacters turned
# into spaces, and with git's and gh's global options (`git -C . reset`,
# `/usr/bin/git -c x=y clean`, `gh -R o/r pr merge`) dropped, so the
# subcommand sits right after the program.
normalize() {
  printf '%s' "$1" | tr -d '"'"'"'`\\' | tr '(){};&|<>' '          ' | awk '{
    n = split($0, t, /[[:space:]]+/); out = ""; i = 1
    while (i <= n) {
      base = t[i]; sub(/^.*\//, "", base)
      if (base == "git" || base == "gh") {
        out = out " " base; i++
        while (i <= n && t[i] ~ /^-/) {
          opt = t[i]; i++
          if (opt ~ /^(-C|-c|--git-dir|--work-tree|--namespace|--config-env|--super-prefix|-R|--repo)$/) i++
        }
        continue
      }
      out = out " " t[i]; i++
    }
    print out
  }'
}
NORMALIZED=$(normalize "$COMMAND")

DANGEROUS_PATTERNS=(
  # --- Local state git cannot give back (not recoverable from reflog) ---
  'git[[:space:]]+reset[[:space:]]+--hard'
  'git[[:space:]]+clean[[:space:]]+-[a-z]*f'
  'git[[:space:]]+checkout[[:space:]]+\.'
  'git[[:space:]]+restore[[:space:]]+\.'
  'git[[:space:]]+branch[[:space:]]+-[a-z]*d'
  'git[[:space:]]+stash[[:space:]]+(drop|clear)'
  'git[[:space:]]+update-ref'
  'git[[:space:]]+filter-branch'
  'git[[:space:]]+reflog[[:space:]]+(delete|expire)'
  'git[[:space:]]+worktree[[:space:]]+remove'
  # In a worktree-based container only the current worktree is mounted at its
  # host path, so every OTHER worktree looks prunable. Pruning or gc'ing here
  # would delete their admin dirs and break them on the host.
  'git[[:space:]]+worktree[[:space:]]+prune'
  'git[[:space:]]+gc([[:space:]]|$)'
  'git[[:space:]]+prune([[:space:]]|$)'
  # An alias can rename any of the above (`git r --hard`), and config passed
  # through the environment, another config file or an include can define one.
  'git[[:space:]].*alias\.'
  'GIT_CONFIG_(COUNT|KEY|VALUE|PARAMETERS|GLOBAL|SYSTEM)'
  '(-c[[:space:]]*|--config-env[[:space:]=]+)include'
  'git[[:space:]]+config[[:space:]].*include'

  # --- Merging stays with a person ---
  # Rulesets cannot require a review here: the PAT acts as the repo owner, who
  # cannot approve their own PR. So the agent opens PRs and does not merge
  # them, by any route: gh, the REST merge endpoints, or GraphQL.
  'gh[[:space:]]+pr[[:space:]]+merge'
  'gh[[:space:]]+api[[:space:]].*pulls/[^[:space:]]*/merge'
  'gh[[:space:]]+api[[:space:]].*/merges([[:space:]]|$)'
  'gh[[:space:]]+api[[:space:]].*(mergePullRequest|enablePullRequestAutoMerge|mergeBranch)'
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  # -i: case-insensitive, so `GIT RESET --HARD` cannot slip past.
  if printf '%s' "$COMMAND"    | grep -qEi -- "$pattern" ||
     printf '%s' "$NORMALIZED" | grep -qEi -- "$pattern"; then
    echo "BLOCKED: '$COMMAND' matches protected pattern '$pattern'." >&2
    echo "This operation is destructive or hard to undo, and you do not have authority to run it. Ask the user to run it themselves." >&2
    exit 2
  fi
done

# --- Host only: publishing that is hard to undo. Here gh and git use your own
# login, not the container's scoped PAT, so GitHub's limits on that PAT do not
# apply. Not airtight — it matches text — but it stops the accidents.
if [[ -z "${MENAMI_DEVCONTAINER:-}" ]]; then
  HOST_PATTERNS=(
    # Force-push in any spelling, including a `+` refspec.
    'push[[:space:]].*--force'
    'push[[:space:]]+(.*[[:space:]]+)?-f([[:space:]]|$)'
    '--force-with-lease'
    'git[[:space:]]+push[[:space:]].*[[:space:]:]\+[^[:space:]]'
    # Push to the default branch: `main`, `HEAD:main`, `refs/heads/main`.
    'git[[:space:]]+push[[:space:]].*[[:space:]:/+](main|master)([[:space:]]|$)'
    # Tags (a `v*` tag deploys production), every branch, or deletions.
    'git[[:space:]]+push[[:space:]].*--(mirror|all|branches|prune|tags|follow-tags|delete)'
    'git[[:space:]]+push[[:space:]].*refs/tags/'
    'git[[:space:]]+push[[:space:]].*[[:space:]:+]v[0-9]'
    'git[[:space:]]+push[[:space:]].*[[:space:]]-[a-zA-Z]*d([[:space:]]|$)'
    'git[[:space:]]+push[[:space:]].*[[:space:]]:[^[:space:]]'
    # gh: irreversible, or outside this repo's code.
    'gh[[:space:]]+pr[[:space:]]+close'
    'gh[[:space:]]+release[[:space:]]+(create|delete|edit|upload)'
    'gh[[:space:]]+repo[[:space:]]+(delete|edit|rename|archive|sync)'
    'gh[[:space:]]+workflow[[:space:]]+(run|disable|enable)'
    'gh[[:space:]]+secret[[:space:]]'
    'gh[[:space:]]+auth[[:space:]]+(login|logout|refresh)'
  )
  for pattern in "${HOST_PATTERNS[@]}"; do
    if printf '%s' "$COMMAND"    | grep -qEi -- "$pattern" ||
       printf '%s' "$NORMALIZED" | grep -qEi -- "$pattern"; then
      echo "BLOCKED: '$COMMAND' matches protected pattern '$pattern'." >&2
      echo "On the host gh and git use your own login; ask the user to run this themselves." >&2
      exit 2
    fi
  done

  # `gh api` writes (an explicit method, or -f/-F/--field/--input, which make
  # it POST) are refused except PR review conversation: replying to a review
  # comment, and replying to or resolving a review thread over GraphQL. Reads
  # stay allowed. Each call in a chain is judged on its own, so an allowed
  # reply cannot carry a second write past the check.
  API_WRITE='gh[[:space:]]+api[[:space:]].*((-X|--method)[[:space:]=]*(POST|PUT|PATCH|DELETE)|[[:space:]](-f|-F|--field|--raw-field|--input)([[:space:]=]|$))'
  while IFS= read -r segment; do
    seg_norm=$(normalize "$segment")
    printf '%s' "$seg_norm" | grep -qEi "$API_WRITE" || continue
    allowed=0
    if printf '%s' "$seg_norm" | grep -qEi 'gh[[:space:]]+api[[:space:]]+(-X[[:space:]]+POST[[:space:]]+)?/?repos/[^[:space:]]+/pulls/[0-9]+/comments/[0-9]+/replies([[:space:]]|$)'; then
      allowed=1
    elif printf '%s' "$seg_norm" | grep -qEi 'gh[[:space:]]+api[[:space:]]+graphql([[:space:]]|$)'; then
      if printf '%s' "$segment" | grep -qE '=@|--input|\$|`'; then
        allowed=0   # read from a file, stdin or the shell: cannot be checked
      elif ! printf '%s' "$segment" | grep -qi 'mutation'; then
        allowed=1   # a query
      else
        # Every field called with `(input:` must be one of the three.
        others=$(printf '%s' "$segment" | grep -oE '[A-Za-z]+[[:space:]]*\([[:space:]]*input' |
          grep -vE '^(addPullRequestReviewThreadReply|resolveReviewThread|unresolveReviewThread)[[:space:]]*\(')
        [[ -z "$others" ]] && allowed=1
      fi
    fi
    if [[ "$allowed" -ne 1 ]]; then
      echo "BLOCKED: '$segment' writes through the GitHub API with your own login." >&2
      echo "On the host only PR comment replies and review-thread resolution are allowed; ask the user for anything else." >&2
      exit 2
    fi
  done < <(printf '%s\n' "$COMMAND" | tr ';&|' '\n\n\n')
  exit 0
fi

# --- Dev container only: confine the agent to the branch the container was
# created on, so it cannot commit onto another local branch in the .git it
# shares with the host. MENAMI_DEVCONTAINER comes from devcontainer.json, so it
# is in the environment Claude Code runs this hook with, and nothing the agent
# runs can unset it. post-create.sh writes the pin root-owned and read-only.
BRANCH_PIN_FILE=/etc/devcontainer-allowed-branch
MENTIONS_GIT='(^|[[:space:]])(git|gh)([[:space:]]|$)'
if [[ ! -f "$BRANCH_PIN_FILE" ]]; then
  # Fail closed: a container without its pin is not confined to anything.
  if printf '%s' "$NORMALIZED" | grep -qEi "$MENTIONS_GIT"; then
    echo "BLOCKED: $BRANCH_PIN_FILE is missing, so git and gh are disabled in this dev container." >&2
    echo "Rebuild the container so post-create.sh writes it." >&2
    exit 2
  fi
  exit 0
fi

PINNED=$(tr -d '[:space:]' < "$BRANCH_PIN_FILE")
REPO="${CLAUDE_PROJECT_DIR:-$PWD}"

# Operations that write refs other than the current branch.
CONTAINER_PATTERNS=(
  # branch create / move / rename / copy (`--list`, `-a`, `-v` stay allowed)
  'git[[:space:]]+branch[[:space:]]+(-[a-z]*(f|m|c)([[:space:]]|$)|--force|--move|--copy)'
  # fetch/pull with a refspec writes local refs directly (origin main:main)
  'git[[:space:]]+(fetch|pull)[[:space:]].*[[:space:]][^[:space:]-][^[:space:]]*:[^[:space:]]'
  'git[[:space:]]+worktree[[:space:]]+(add|move)'
  'git[[:space:]]+symbolic-ref'
)
for pattern in "${CONTAINER_PATTERNS[@]}"; do
  if printf '%s' "$COMMAND"    | grep -qEi -- "$pattern" ||
     printf '%s' "$NORMALIZED" | grep -qEi -- "$pattern"; then
    echo "BLOCKED: '$COMMAND' matches protected pattern '$pattern'." >&2
    echo "This dev container is confined to branch '$PINNED' and may not alter other branches." >&2
    exit 2
  fi
done

# Leaving the pinned branch would let the agent commit onto another branch.
# Only ref arguments are blocked; `git checkout -- file` / a path stays fine.
if printf '%s' "$NORMALIZED" | grep -qEi '(^|[[:space:]])git[[:space:]]+(checkout|switch)([[:space:]]|$)'; then
  if printf '%s' "$NORMALIZED" | grep -qEi '[[:space:]]-[bBcC]([[:space:]]|$)'; then
    echo "BLOCKED: creating a branch is not allowed; this dev container is confined to '$PINNED'." >&2
    exit 2
  fi
  # A lone `-` is the previously checked-out branch, not an option.
  if printf '%s' "$NORMALIZED" | grep -qE '(checkout|switch)[[:space:]](.*[[:space:]])?-([[:space:]]|$)'; then
    echo "BLOCKED: switching to the previous branch is not allowed; this dev container is confined to '$PINNED'." >&2
    exit 2
  fi
  REF=$(printf '%s' "$NORMALIZED" | awk '
    { for (i = 1; i <= NF; i++) if ($i == "checkout" || $i == "switch") { start = i + 1; break } }
    start { for (i = start; i <= NF; i++) { if ($i == "--") exit; if ($i ~ /^-/) continue; print $i; exit } }')
  # A ref that resolves to a commit and is not also an existing path means a
  # real branch switch, rather than `git checkout <file>`.
  if [[ -n "$REF" && "$REF" != "$PINNED" && ! -e "$REPO/$REF" ]] &&
     git -C "$REPO" rev-parse --verify --quiet "${REF}^{commit}" >/dev/null 2>&1; then
    echo "BLOCKED: switching to '$REF' is not allowed; this dev container is confined to '$PINNED'." >&2
    exit 2
  fi
fi

exit 0
