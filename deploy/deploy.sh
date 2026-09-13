#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/opt/sentinel-flash"
REPO="$ROOT/repo"
RELEASES="$ROOT/releases"
SHARED_ENV="$ROOT/shared/.env"
DEPLOYED_REVISION="$ROOT/.deployed-revision"
NODE_BIN="/opt/node22/bin"
BRANCH="master"
ORIGIN="https://github.com/ArnavBansal01/Sentinel.git"

exec 9>"$ROOT/.deploy.lock"
flock -n 9 || exit 0

export PATH="$NODE_BIN:$PATH"
mkdir -p "$RELEASES" "$ROOT/shared" "$ROOT/data"

if [[ ! -d "$REPO/.git" ]]; then
  git clone --branch "$BRANCH" --single-branch "$ORIGIN" "$REPO"
fi

git -C "$REPO" fetch origin "$BRANCH"
REVISION="$(git -C "$REPO" rev-parse "origin/$BRANCH")"
CURRENT_REVISION="$(cat "$DEPLOYED_REVISION" 2>/dev/null || true)"

if [[ "$REVISION" == "$CURRENT_REVISION" ]] && curl -fsS http://127.0.0.1:8787/api/health >/dev/null && curl -fsS http://127.0.0.1:3000/login >/dev/null; then
  exit 0
fi

if [[ ! -f "$SHARED_ENV" ]]; then
  echo "Missing $SHARED_ENV" >&2
  exit 1
fi

RELEASE="$RELEASES/$REVISION"
PREVIOUS="$(readlink -f "$ROOT/current" 2>/dev/null || true)"

if [[ ! -d "$RELEASE" ]]; then
  git clone --no-hardlinks "$REPO" "$RELEASE"
  git -C "$RELEASE" checkout --detach "$REVISION"
fi

ln -sfn "$SHARED_ENV" "$RELEASE/.env"
cd "$RELEASE"
corepack pnpm install --frozen-lockfile
NITRO_PRESET=node-server VITE_API_BASE_URL=https://sentinelflash.space corepack pnpm run build

ln -sfn "$RELEASE" "$ROOT/current"
install -m 644 "$RELEASE/deploy/ecosystem.config.cjs" "$ROOT/ecosystem.config.cjs"
pm2 startOrReload "$ROOT/ecosystem.config.cjs" --update-env

if ! curl --retry 8 --retry-delay 2 --retry-connrefused -fsS http://127.0.0.1:8787/api/health >/dev/null || \
   ! curl --retry 8 --retry-delay 2 --retry-connrefused -fsS http://127.0.0.1:3000/login >/dev/null; then
  if [[ -n "$PREVIOUS" && -d "$PREVIOUS" ]]; then
    ln -sfn "$PREVIOUS" "$ROOT/current"
    pm2 startOrReload "$ROOT/ecosystem.config.cjs" --update-env
  fi
  echo "Deployment health check failed for $REVISION" >&2
  exit 1
fi

printf '%s\n' "$REVISION" > "$DEPLOYED_REVISION"
install -m 755 "$RELEASE/deploy/deploy.sh" "$ROOT/deploy.sh"
pm2 save
echo "Deployed $REVISION"
