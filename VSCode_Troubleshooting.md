VS Code Troubleshooting and Stability Tips
=========================================

If VS Code is crashing or becoming unresponsive while working on this repo, follow these steps:

1) Use the included workspace settings
- The repo contains `.vscode/settings.json` which excludes large folders like `node_modules`, `osmdata`, and `.safety_backups` from the file watcher and search. This reduces OS file-notify load.

2) Install Postgres tools off-machine
- Long-running imports (osm PBF -> PostGIS) should be run on a dedicated backend server. Avoid storing large PBFs in the workspace.

3) Disable heavy extensions
- Temporarily disable language servers or indexing extensions (large TypeScript/JS/HTML projects can cause high memory). In VS Code: Extensions pane → disable for workspace.

4) Increase editor memory for large files (if needed)
- If you must open very large files, increase `files.maxMemoryForLargeFilesMB` in workspace settings or open them in an external tool.

5) If crashes persist
- Run VS Code from terminal to capture logs:

  macOS / Linux:
  ```bash
  code --verbose > ~/vscode-log.txt 2>&1
  ```

  Attach `~/vscode-log.txt` when requesting help.

6) Revert problematic changes
- If a single file caused the crash (large `index.html` edits), consider temporarily moving the file out of the workspace while editing other files.

If you want, I can (a) add a small script to move large assets to `data/` outside the workspace, or (b) create a lightweight dev branch with only essential files to avoid indexing the whole repo.

Script: Move large files out of workspace
- There's a script at `scripts/move_large_files_outside_workspace.sh` that will move files larger than a configurable threshold (default 50MB) and a few known large directories out to `$HOME/Fedex_archives` (or a location set via the `ARCHIVE_DIR` env var).

Example usage:
```bash
# dry-run: run with a high threshold to inspect (not implemented dry-run mode yet)
./scripts/move_large_files_outside_workspace.sh /path/to/repo 100

# default: move files >50MB
./scripts/move_large_files_outside_workspace.sh

# override archive dir
ARCHIVE_DIR=/Volumes/BigDrive/Fedex_archives ./scripts/move_large_files_outside_workspace.sh
```

After running the script, restart VS Code.
