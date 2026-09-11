#!/bin/sh
set -eu

image=${1:?usage: verify-image-policy.sh IMAGE}
configured_user=$(docker image inspect --format '{{.Config.User}}' "$image")
if [ -z "$configured_user" ] || [ "$configured_user" = "root" ] || [ "$configured_user" = "0" ]; then
  echo "Image must declare a non-root USER." >&2
  exit 1
fi

docker run --rm --entrypoint sh "$image" -ec '
  test "$(id -u)" -ne 0
  for forbidden in /app/.git /app/.data /app/tests; do
    test ! -e "$forbidden"
  done
  if find /app -name ".env*" -print -quit | grep -q .; then
    echo "Image contains an environment file." >&2
    exit 1
  fi
  if find /app -type f \( -name "*.sqlite" -o -name "*.sqlite3" -o -name "*.db" -o -name "*-wal" -o -name "*-shm" \) -print -quit | grep -q .; then
    echo "Image contains SQLite data or sidecar files." >&2
    exit 1
  fi
'

echo "Image policy verified: $image"
