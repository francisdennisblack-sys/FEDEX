
#!/usr/bin/env bash
set -euo pipefail

# Move large files and selected large directories out of the workspace into an archive directory
# Usage:
#   ./scripts/move_large_files_outside_workspace.sh [workspace_root] [threshold_mb] [--dry-run]
# Defaults:
#   workspace_root = current working directory
#   threshold_mb = 50
# Environment:
#   ARCHIVE_DIR can be set to override the default archive location ($HOME/Fedex_archives)

# Simple flag parsing: allow `--dry-run` as first arg
DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=true
  shift
fi

WORKSPACE_ROOT="${1:-$(pwd)}"
THRESHOLD_MB="${2:-50}"
ARCHIVE_DIR="${ARCHIVE_DIR:-$HOME/Fedex_archives}"

echo "Workspace: $WORKSPACE_ROOT"
echo "Threshold: ${THRESHOLD_MB}MB"
echo "Archive dir: $ARCHIVE_DIR"
echo "Dry run: $DRY_RUN"

mkdir -p "$ARCHIVE_DIR"

# Helper to move a file preserving relative path under archive dir and avoid collisions
move_file() {
  local file="$1"
  # compute relative path (simple prefix strip)
  local rel
  case "$file" in
    "$WORKSPACE_ROOT"/*) rel="${file#${WORKSPACE_ROOT}/}" ;;
    *) rel="$(basename "$file")" ;;
  esac

  local dest_dir="$ARCHIVE_DIR/$(dirname "$rel")"
  local dest
  if [ "$DRY_RUN" = true ]; then
    echo "DRY RUN: would move: $file -> $dest_dir/$(basename "$file")"
    return 0
  fi
  mkdir -p "$dest_dir"
  dest="$dest_dir/$(basename "$file")"
  if [ -e "$dest" ]; then
    dest="$dest-$(date +%Y%m%d%H%M%S)"
  fi
  echo "Moving: $file -> $dest"
  mv "$file" "$dest"
}

echo "Finding large files..."

# Exclude common repo directories from the find traversal
EXCLUDE_PATHS=("$WORKSPACE_ROOT/.git" "$WORKSPACE_ROOT/node_modules" "$WORKSPACE_ROOT/osmdata" "$WORKSPACE_ROOT/.safety_backups" "$WORKSPACE_ROOT/.vscode")

# Build find exclude expression
find_args=()
for ex in "${EXCLUDE_PATHS[@]}"; do
  find_args+=( -path "$ex" -prune -o )
done

# Use -print0 and a safe while-read loop
find "$WORKSPACE_ROOT" "${find_args[@]}" -type f -size +${THRESHOLD_MB}M -print0 2>/dev/null | while IFS= read -r -d '' file; do
  move_file "$file"
done

echo "Checking and moving known large directories..."
for d in ".safety_backups" "osmdata" "pois/osm"; do
  src="$WORKSPACE_ROOT/$d"
  if [ -d "$src" ]; then
    dest_dir="$ARCHIVE_DIR/$d-$(date +%Y%m%d%H%M%S)"
    if [ "$DRY_RUN" = true ]; then
      echo "DRY RUN: would move directory $src -> $dest_dir"
    else
      echo "Moving directory: $src -> $dest_dir"
      mkdir -p "$(dirname "$dest_dir")"
      mv "$src" "$dest_dir"
    fi
  fi
done

echo "Update .gitignore suggestion: add the following line to ignore your archive folder:"
echo "$ARCHIVE_DIR"

echo "Done. Archive location: $ARCHIVE_DIR"
