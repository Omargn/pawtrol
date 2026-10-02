#!/usr/bin/env bash
# Fails when tracked files mention terms from the private project this one was
# derived from. Generic terms live here; identifiers that would themselves leak
# (a project ref, a bundle ID) come from the LEAK_GUARD_EXTRA_PATTERNS secret
# in CI, as a `|`-separated extended regex, and never get committed.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

patterns='gym|booking|credit|promo|kinetic'
if [[ -n "${LEAK_GUARD_EXTRA_PATTERNS:-}" ]]; then
  patterns="${patterns}|${LEAK_GUARD_EXTRA_PATTERNS}"
fi

# Tracked and staged files, minus this script and lockfiles (third-party
# package names are not ours to police).
matches=$(git ls-files --cached --others --exclude-standard -z \
  | grep -zv -e '^scripts/check-leaks.sh$' -e 'package-lock.json$' \
  | xargs -0 grep -I -n -i -E "$patterns" -- 2>/dev/null || true)

if [[ -n "$matches" ]]; then
  echo "Leak guard: these lines mention terms from the private source project:" >&2
  echo "$matches" >&2
  exit 1
fi

echo "Leak guard: clean."
