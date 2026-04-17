#!/usr/bin/env bash
# Sync local repo with GitHub.
# Fetches all remotes, rebases the current branch onto its upstream if one
# exists, and prints the final status so you can see exactly where you are.
#
# Usage:
#   ./scripts/sync.sh              # sync current branch
#   ./scripts/sync.sh main         # switch to main and sync it

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

target_branch="${1:-}"
if [[ -n "$target_branch" ]]; then
  echo "→ switching to $target_branch"
  git checkout "$target_branch"
fi

current=$(git branch --show-current)
echo "→ fetching origin"
git fetch origin --prune

# Only rebase if this branch tracks a remote
upstream=$(git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>/dev/null || echo "")

if [[ -z "$upstream" ]]; then
  echo "ℹ branch '$current' has no upstream — nothing to pull."
else
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "⚠ working tree is dirty — stashing before pull"
    git stash push -u -m "sync.sh auto-stash $(date -u +%FT%TZ)"
    stashed=1
  else
    stashed=0
  fi

  echo "→ pulling $upstream with rebase"
  git pull --rebase

  if [[ "$stashed" == "1" ]]; then
    echo "→ re-applying stashed changes"
    git stash pop || {
      echo "✗ stash pop conflicted — resolve manually with 'git status'"
      exit 1
    }
  fi
fi

echo
echo "── status ──"
git status -sb
echo
echo "── last 5 commits ──"
git log --oneline -5
