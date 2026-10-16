#!/bin/bash
# PreToolUse(Bash) guardrail for Claude's Bash tool.
#
# Policy: the agent may do normal, reversible development work — commit, push a
# feature branch, rebase, merge, open a PR. It may not do things that are
# destructive or hard to undo: force-pushing, pushing to main, discarding
# working-tree state, rewriting history, or releasing.
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

# Quoting and shell nesting would otherwise hide a command from the patterns
# below: `bash -c "git push --force"`, `$(git push --force)`, `eval 'git...'`.
# Scanning a copy with quotes stripped and shell metacharacters turned into
# spaces makes those forms match the same patterns as the plain command.
NORMALIZED=$(printf '%s' "$COMMAND" | tr -d '"'"'"'`\\' | tr '(){};&|<>' '          ')

# The program can also be hidden outright: `G=git; $G push`, `${G} push`,
# `$(echo git) push`. A push/pr/api word straight after a token built by the
# shell is refused, since what runs cannot be known from the text. (Backslash
# escapes — `g\it push` — are already undone above.)
if printf '%s' "$COMMAND" | tr -d '"'"'"'' | awk '
  { for (i = 2; i <= NF; i++) if ($i ~ /^(push|pr|api)$/ && $(i - 1) ~ /[$\\(){}]/) found = 1 }
  END { exit !found }'; then
  echo "BLOCKED: '$COMMAND' runs git or gh through a shell expansion the guardrail cannot check." >&2
  echo "Spell the command out: git push ..., gh pr ..., gh api ...." >&2
  exit 2
fi

# Global options between `git`/`gh` and the subcommand would hide it too:
# `git -C . push origin main`, `/usr/bin/git -c x=y push`, `gh -R o/r pr merge`.
# Drop them (and their values) so the subcommand sits right after the program.
NORMALIZED=$(printf '%s' "$NORMALIZED" | awk '{
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
}')

DANGEROUS_PATTERNS=(
  # --- Destructive to working tree or history (not recoverable from reflog) ---
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

  # --- Publishing that is hard to undo ---
  # Force-push in any spelling.
  'push[[:space:]].*--force'
  'push[[:space:]]+(.*[[:space:]]+)?-f([[:space:]]|$)'
  '--force-with-lease'
  # A `+` refspec is a force-push too (`git push origin +branch`).
  'git[[:space:]]+push[[:space:]].*[[:space:]:]\+[^[:space:]]'
  # Push that targets the default branch, in any spelling: `main`, `+main`,
  # `HEAD:main`, `refs/heads/main`.
  'git[[:space:]]+push[[:space:]].*[[:space:]:/+](main|master)([[:space:]]|$)'
  # Pushes of more than the branch at hand: every branch, deletions of
  # branches gone locally, and tags (a tag deploys production).
  'git[[:space:]]+push[[:space:]].*--(mirror|all|branches|prune|tags|follow-tags)'
  # A target built at run time (`$BRANCH`, `$(...)`) cannot be checked here.
  'git[[:space:]]+push[[:space:]].*\$'
  # Deleting a remote branch.
  'git[[:space:]]+push[[:space:]].*--delete'
  'git[[:space:]]+push[[:space:]].*[[:space:]]-[a-zA-Z]*d([[:space:]]|$)'
  'git[[:space:]]+push[[:space:]].*[[:space:]]:[^[:space:]]'

  # --- Renaming a blocked command, or running code outside the agent ---
  # An alias turns `git p` into `git push --force`; config injected through
  # the environment can define one, or point git at a different config file.
  'git[[:space:]].*alias\.'
  'GIT_CONFIG_(COUNT|KEY|VALUE|PARAMETERS|GLOBAL|SYSTEM)'
  # Hooks run on the host as well: the container shares the host's .git and
  # the husky hooks in the checkout. (The container also mounts both read-only.)
  'core\.hookspath'
  '\.git/(hooks|config)'
  '\.husky/'
  # Config that decides where a push goes or what git runs, whether passed
  # with -c / --config-env or stored with `git config` (use `git remote -v`
  # to read the remote).
  '(-c[[:space:]]*|--config-env[[:space:]=]+)(remote|push|branch|url|alias|core)\.'
  'git[[:space:]]+config[[:space:]].*(remote|push|branch|url)\.'
  # This guardrail itself, and the container's branch pin.
  '\.claude/(hooks|settings)'
  'devcontainer-allowed-branch'

  # --- gh: irreversible, or bypasses review ---
  'gh[[:space:]]+pr[[:space:]]+(merge|close)'
  'gh[[:space:]]+release[[:space:]]+(create|delete|edit|upload)'
  'gh[[:space:]]+repo[[:space:]]+(delete|edit|rename|archive|sync)'
  'gh[[:space:]]+workflow[[:space:]]+(run|disable|enable)'
  'gh[[:space:]]+secret[[:space:]]'
  'gh[[:space:]]+auth[[:space:]]+(login|logout|refresh)'
  # Generic API escape hatch: any mutating method, and the -f/-F/--field/--input
  # forms which make `gh api` POST implicitly. `gh api /path` (GET) stays allowed.
  'gh[[:space:]]+api[[:space:]].*(-X|--method)[[:space:]=]*(POST|PUT|PATCH|DELETE)'
  'gh[[:space:]]+api[[:space:]].*[[:space:]](-f|-F|--field|--raw-field|--input)[[:space:]=]'
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  # -i: case-insensitive, so `-X post` / `GIT PUSH --FORCE` cannot slip past.
  if printf '%s' "$COMMAND"    | grep -qEi -- "$pattern" ||
     printf '%s' "$NORMALIZED" | grep -qEi -- "$pattern"; then
    echo "BLOCKED: '$COMMAND' matches protected pattern '$pattern'." >&2
    echo "This operation is destructive or hard to undo, and you do not have authority to run it. Ask the user to run it themselves." >&2
    exit 2
  fi
done

# --- Dev container only: confine the agent to the branch the container was
# created on. MENAMI_DEVCONTAINER comes from devcontainer.json, so it is in
# the environment Claude Code runs this hook with, and nothing the agent runs
# can unset it. post-create.sh writes the pin root-owned and read-only.
[[ -n "${MENAMI_DEVCONTAINER:-}" ]] || exit 0

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

# Operations that write refs other than the current branch. Blocking the push
# target alone is not enough: these alter other branches locally.
CONTAINER_PATTERNS=(
  # branch create / move / rename / copy (`--list`, `-a`, `-v` stay allowed)
  'git[[:space:]]+branch[[:space:]]+(-[a-z]*(f|m|c)([[:space:]]|$)|--force|--move|--copy)'
  # fetch/pull with a refspec writes local refs directly (origin main:main)
  'git[[:space:]]+(fetch|pull)[[:space:]].*[[:space:]][^[:space:]-][^[:space:]]*:[^[:space:]]'
  'git[[:space:]]+worktree[[:space:]]+(add|move)'
  'git[[:space:]]+symbolic-ref'
  'git[[:space:]]+remote[[:space:]]+(add|remove|rm|set-url|rename)'
  # The shared git config is read-only here, so -u cannot record an upstream;
  # initialize.sh set it on the host already.
  'git[[:space:]]+push[[:space:]](.*[[:space:]])?(-u|--set-upstream)([[:space:]]|$)'
)
for pattern in "${CONTAINER_PATTERNS[@]}"; do
  if printf '%s' "$COMMAND"    | grep -qEi -- "$pattern" ||
     printf '%s' "$NORMALIZED" | grep -qEi -- "$pattern"; then
    echo "BLOCKED: '$COMMAND' matches protected pattern '$pattern'." >&2
    echo "This dev container is confined to branch '$PINNED' and may not alter other branches or remotes." >&2
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

# Every refspec of a push must be `src:dst` with dst the pinned branch: drop
# `git push`, drop flags, drop the remote, check each of what is left. A bare
# `git push`, or a refspec without `:`, is refused: its destination then comes
# from remote.<name>.push in whatever config git reads, not from the text.
if printf '%s' "$NORMALIZED" | grep -qEi '(^|[[:space:]])git[[:space:]]+push([[:space:]]|$)'; then
  # Strip redirections (2>&1, >/dev/null, <file, ...) first. NORMALIZED turned
  # their operators into spaces, so a trailing `2>&1` would otherwise look like
  # extra refspecs.
  PUSH_SOURCE=$(printf '%s' "$COMMAND" | sed -E 's/[0-9]*(>>?&?[0-9]*|<)[^[:space:]]*//g')
  PUSH_NORMALIZED=$(printf '%s' "$PUSH_SOURCE" | tr -d '"'"'"'`' | tr '(){};&|<>' '          ')
  # Flag values (`-o x`, `--repo x`) are counted as refspecs and so refused:
  # failing closed costs a retry, failing open costs a branch.
  REFSPECS=$(printf '%s' "$PUSH_NORMALIZED" | awk '
    { for (i = 1; i <= NF; i++) if ($i == "push") { start = i + 1; break } }
    start {
      n = 0
      for (i = start; i <= NF; i++) {
        if ($i ~ /^-/) continue
        if (++n == 1) continue      # remote name
        print $i
      }
    }')
  if [[ -z "$REFSPECS" ]]; then
    echo "BLOCKED: name the destination explicitly in this dev container: git push origin HEAD:$PINNED" >&2
    exit 2
  fi

  while IFS= read -r refspec; do
    if [[ "$refspec" != *:* ]]; then
      echo "BLOCKED: '$refspec' has no destination; use git push origin HEAD:$PINNED" >&2
      exit 2
    fi
    # src:dst -> dst; `+x` and `refs/heads/x` name the branch x.
    target=${refspec##*:}
    target=${target#+}
    target=${target#refs/heads/}
    if [[ "$target" != "$PINNED" ]]; then
      echo "BLOCKED: this dev container may only push to '$PINNED', but the command targets '${target:-<unknown>}'." >&2
      echo "Ask the user to push other branches from the host." >&2
      exit 2
    fi
  done <<< "$REFSPECS"
fi

exit 0
