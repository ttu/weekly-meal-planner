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

# A backslash-newline is no break to the shell (`git reset \<newline>--hard`
# is one command), so undo it before anything reads the text line by line.
COMMAND=${COMMAND//$'\\\n'/}

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
          if (opt ~ /^(-C|-c|--git-dir|--work-tree|--namespace|--config-env|--super-prefix|--attr-source|-R|--repo)$/) i++
        }
        continue
      }
      out = out " " t[i]; i++
    }
    print out
  }'
}
NORMALIZED=$(normalize "$COMMAND")

# A subcommand the shell globs or expands (`git re?et`) is whatever file
# matches, not what the text says.
if printf '%s' "$NORMALIZED" | awk '
  { for (i = 1; i < NF; i++) if (($i == "git" || $i == "gh") && $(i + 1) ~ /[*?[$]/) found = 1 }
  END { exit !found }'; then
  echo "BLOCKED: '$COMMAND' runs a git or gh subcommand the shell expands; spell it out." >&2
  exit 2
fi

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
  # help.autocorrect runs the closest match to a typo (`git rest --hard`).
  'git[[:space:]].*autocorrect'
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
    'git[[:space:]]+push[[:space:]].*[[:space:]:+/](refs/)?tags/'
    'git[[:space:]]+push[[:space:]].*[[:space:]:+/]v[0-9]'
    # ...or config that changes what a later push sends or where: any
    # remote.* or push.* key, stored or passed with -c / --config-env.
    '(git[[:space:]]+config[[:space:]].*|-c[[:space:]]*|--config-env[[:space:]=]+)(remote|push)\.'
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
  # it POST, also with the value attached or among combined short flags:
  # `-ftitle=x`, `-iXDELETE`) are refused unless the whole call, on its own, is one of two
  # fixed shapes. Matching a template rather than parsing GraphQL: a parser
  # written in regexes misses commas, comments and repeated fields.
  #   - a reply to a PR review comment (REST; the only place free text goes):
  #       gh api [-X POST] repos/<o>/<r>/pulls/<n>/comments/<id>/replies -f body=<text>
  #   - resolving or unresolving a review thread (GraphQL; arguments only):
  #       gh api graphql -f query='mutation { resolveReviewThread(input: {...}) { ... } }' [--jq <expr>]
  # Read-only GraphQL (no `mutation` anywhere in the call, no file or stdin
  # input) stays allowed. Each call in a chain is judged on its own: the
  # command is split on ; & | and newlines outside quotes, so quoted text
  # stays with its call.
  API_WRITE='gh[[:space:]]+api[[:space:]].*((-[A-Za-z]*X|--method)[[:space:]=]*(POST|PUT|PATCH|DELETE)|[[:space:]](-[A-Za-z]*[fF]|--field|--raw-field|--input)([^[:space:]]*)([[:space:]]|$))'
  # The value of query= after shell unquoting; arguments only, one field.
  RESOLVE_QUERY='^mutation[[:space:]]*\{[[:space:]]*(resolveReviewThread|unresolveReviewThread)[[:space:]]*\([[:space:]]*input:[[:space:]]*\{[[:space:]]*threadId:[[:space:]]*"[A-Za-z0-9_-]+"[[:space:]]*\}[[:space:]]*\)[[:space:]]*\{[A-Za-z_[:space:]{}]*\}[[:space:]]*\}$'
  REPLY_PATH='^/?repos/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+/pulls/[0-9]+/comments/[0-9]+/replies$'
  # allowed_api_write <segment>: split it into argv as the shell would (xargs
  # follows the same quoting; an unbalanced quote fails), then require one of
  # the two shapes exactly, plus an optional `--jq <expr>` and nothing else.
  allowed_api_write() {
    local -a argv=()
    local tok
    while IFS= read -r -d '' tok; do argv+=("$tok"); done < <(printf '%s' "$1" | xargs printf '%s\0' 2>/dev/null)
    local n=${#argv[@]}
    if (( n >= 2 )) && [[ "${argv[n-2]}" == "--jq" || "${argv[n-2]}" == "-q" ]]; then n=$((n - 2)); fi
    [[ "${argv[0]:-}" == "gh" && "${argv[1]:-}" == "api" ]] || return 1
    if (( n == 5 )) && [[ "${argv[2]}" == "graphql" && "${argv[3]}" == "-f" && "${argv[4]}" == query=* ]]; then
      printf '%s' "${argv[4]#query=}" | grep -qE "$RESOLVE_QUERY" && return 0
      return 1
    fi
    local i=2
    if (( n == 7 )) && [[ "${argv[2]}" == "-X" || "${argv[2]}" == "--method" ]] && [[ "${argv[3]}" == "POST" ]]; then i=4
    elif (( n != 5 )); then return 1; fi
    printf '%s' "${argv[i]}" | grep -qE "$REPLY_PATH" &&
      [[ "${argv[i+1]}" == "-f" || "${argv[i+1]}" == "--raw-field" ]] &&
      [[ "${argv[i+2]}" == body=* ]]
  }
  while IFS= read -r segment; do
    seg_norm=$(normalize "$segment")
    printf '%s' "$seg_norm" | grep -qEi "$API_WRITE" || continue
    trimmed=$(printf '%s' "$segment" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')
    if printf '%s' "$trimmed" | grep -qE '[$`]|<\(|>\('; then
      allowed=0   # built by the shell: what runs cannot be read from the text
    elif allowed_api_write "$trimmed"; then
      allowed=1
    elif printf '%s' "$seg_norm" | grep -qEi '^[[:space:]]*gh[[:space:]]+api[[:space:]]+graphql([[:space:]]|$)' &&
         ! printf '%s' "$trimmed" | grep -qiE 'mutation|@|--input' &&
         ! printf '%s' "$trimmed" | grep -qE '[[:space:]]-[A-Za-z]*F'; then
      allowed=1   # a query
    else
      allowed=0
    fi
    if [[ "$allowed" -ne 1 ]]; then
      echo "BLOCKED: '$segment' writes through the GitHub API with your own login." >&2
      echo "On the host only PR comment replies (REST) and resolving review threads are allowed; ask the user for anything else." >&2
      exit 2
    fi
  done < <(printf '%s' "$COMMAND" | awk 'BEGIN { RS = "\001" } {
    # Split on ; & | and newlines that are outside single and double quotes.
    out = ""; sq = 0; dq = 0
    for (i = 1; i <= length($0); i++) {
      c = substr($0, i, 1)
      if (c == "\\" && !sq) { out = out c substr($0, i + 1, 1); i++; continue }
      if (c == "\047" && !dq) sq = !sq
      else if (c == "\"" && !sq) dq = !dq
      if (!sq && !dq && (c == ";" || c == "&" || c == "|" || c == "\n")) { print out; out = ""; continue }
      out = out c
    }
    print out
  }')
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
  # creates and checks out a new branch
  'git[[:space:]]+stash[[:space:]]+branch'
  # moves every branch that points into the rebased range
  'git[[:space:]].*update-?refs'
)
for pattern in "${CONTAINER_PATTERNS[@]}"; do
  if printf '%s' "$COMMAND"    | grep -qEi -- "$pattern" ||
     printf '%s' "$NORMALIZED" | grep -qEi -- "$pattern"; then
    echo "BLOCKED: '$COMMAND' matches protected pattern '$pattern'." >&2
    echo "This dev container is confined to branch '$PINNED' and may not alter other branches." >&2
    exit 2
  fi
done

# Leaving the pinned branch would let the agent commit onto another branch,
# and `git rebase <upstream> <branch>` (or `--root <branch>`) rewrites
# <branch>. Every `git checkout|switch|rebase` call in the command is judged
# on its own, up to the next `git`. Git accepts any unambiguous prefix of a
# long option, so `--cr` is `--create` and `--update-r` is `--update-refs`.
# The scan prints one verdict per call:
#   create | previous | updaterefs | expansion | ref <name> | switchto <name> | rebase <branch>
# normalize() turns braces into spaces and drops backticks, so brace
# expansion (`{-q,other}`) and command substitution are refused on the raw
# text, before it is normalized.
# The word itself is looked for with quotes and backslashes removed (`che"ck"out`).
if printf '%s' "$COMMAND" | tr -d '"'"'"'\\' | grep -qEi '(^|[^[:alnum:]_-])(checkout|switch|rebase)([^[:alnum:]_-]|$)' &&
   printf '%s' "$COMMAND" | grep -q '[`{}$]'; then
  echo "BLOCKED: a checkout, switch or rebase with a name built by the shell cannot be checked; this dev container is confined to '$PINNED'." >&2
  exit 2
fi
VERDICTS=$(printf '%s' "$NORMALIZED" | awk '{
  for (i = 1; i < NF; i++) {
    if (tolower($i) != "git") continue
    cmd = tolower($(i + 1)); n = 0; root = 0
    if (cmd == "checkout" || cmd == "switch") {
      # Options only before `--`, where paths start; `git checkout -- file` stays fine.
      for (j = i + 2; j <= NF && tolower($j) != "git" && $j != "--"; j++) {
        if ($j ~ /[$*?[]|^~/) print "expansion"   # the shell decides what git sees
        if ($j ~ /^(-[A-Za-z]*[bBcC]|--(cr|force-c|or))/) print "create"
        else if ($j == "-") print "previous"   # the previously checked-out branch
        # Every word, not only the first: an option taking a value
        # (`--conflict merge other`) would shift which one names the branch.
        else if ($j !~ /^-/) print (cmd == "switch" ? "switchto " : "ref ") $j   # switch takes no paths
      }
    } else if (cmd == "rebase") {
      for (j = i + 2; j <= NF && tolower($j) != "git"; j++) {
        if ($j ~ /[$*?[]|^~/) print "expansion"
        if ($j ~ /^--u/) print "updaterefs"
        if ($j ~ /^(--onto|-s|--strategy|-X|--strategy-option|-x|--exec)$/) { j++; continue }
        if ($j ~ /^--ro/) root = 1   # `--ro` is `--root` to git
        if ($j !~ /^-/) pos[++n] = $j
      }
      # Past the upstream every word must be the pinned branch: an option that
      # takes a value this list misses (`--whitespace x`, `--ont`) shifts the
      # words, so all of them are checked rather than the second alone.
      for (k = root ? 1 : 2; k <= n; k++) print "rebase " pos[k]
    }
  }
}')
while read -r verdict name; do
  case "$verdict" in
    create)     reason="creating a branch is not allowed" ;;
    previous)   reason="switching to the previous branch is not allowed" ;;
    updaterefs) reason="'git rebase --update-refs' moves other branches" ;;
    expansion)  reason="a branch name built by the shell cannot be checked" ;;
    rebase)     [[ "$name" == "$PINNED" ]] && continue
                reason="rebasing '$name' is not allowed" ;;
    switchto)   [[ "$name" == "$PINNED" ]] && continue
                reason="switching to '$name' is not allowed" ;;
    ref)        # Before `--` git reads a name as a ref first, even when a path
                # has the same name, and creates a local branch from a remote
                # one of that name. A name that is neither stays a path.
                [[ "$name" == "$PINNED" ]] && continue
                git -C "$REPO" rev-parse --verify --quiet "${name}^{commit}" >/dev/null 2>&1 ||
                  [[ -n $(git -C "$REPO" for-each-ref --count=1 "refs/remotes/*/$name" 2>/dev/null) ]] ||
                  continue
                reason="switching to '$name' is not allowed" ;;
    *)          continue ;;
  esac
  echo "BLOCKED: $reason; this dev container is confined to '$PINNED'." >&2
  exit 2
done <<< "$VERDICTS"

exit 0
