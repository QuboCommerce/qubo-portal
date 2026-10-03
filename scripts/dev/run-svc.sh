#!/usr/bin/env bash
# Runs inside a screen window, started by `qd up` as: bash --noprofile --norc run-svc.sh <svc|hub>
# No rc files are read, so .zshrc/.bashrc (neofetch, cd, prompts) can't interfere.
# After the service exits it waits for [r]estart / [q]uit / [l]og, so the window never vanishes silently.
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SVC="${1:?usage: run-svc.sh <svc|hub>}"
STATE="$ROOT/.private/dev/state/$SVC"
LOG="$ROOT/.private/dev/logs/$SVC.log"
QD=(node "$ROOT/scripts/dev/qd.mjs")
cd "$ROOT" || exit 1
# The screen session keeps the PATH it was created with; prefer the user's bun over a stale /usr/bin one.
[ -x "$HOME/.bun/bin/bun" ] && export PATH="$HOME/.bun/bin:$PATH"
mkdir -p "$(dirname "$STATE")"

if [ "$SVC" = hub ]; then
  printf '\033kqubo hub\033\\'
  while :; do "${QD[@]}" status --watch; sleep 2; done
fi

while :; do
  echo "running" >"$STATE"
  printf '\n\033[1m▶ %s\033[0m  %s\n' "$SVC" "$(date '+%F %T')"
  "${QD[@]}" exec "$SVC"
  code=$?
  echo "exited $code" >"$STATE"
  printf '\n\033[1;33m■ %s exited (code %s) at %s\033[0m\n' "$SVC" "$code" "$(date +%T)"
  while :; do
    read -r -n1 -p $'[r]estart  [q]uit window  [l]og tail > ' key
    echo
    case "$key" in
      r|R) break ;;
      q|Q) rm -f "$STATE"; exit "$code" ;;
      l|L) tail -n 40 "$LOG" 2>/dev/null || echo "(no log)" ;;
    esac
  done
done
