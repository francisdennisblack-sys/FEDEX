# Demo scaffold — VEO WiFi Content (tablet)

This folder contains a deterministic scaffold for producing a tablet demo video. It is safe, static, and requires no network access.

How to run locally

1. Serve the repository root (any static server). Example with Python 3:

```bash
python -m http.server 5000
# then open: http://localhost:5000/veo_wificontent_tablet_reference.html?demo=1
```

2. Start the demo manually (if needed):

Open the page and run in console:

```js
window.startDemoSequence();
```

3. Deterministic capture

Use the Playwright recorder script included in `scripts/record_demo_playwright.js` or any headless Chromium capture tool configured for 1280x800 @ 30fps. The `demo-metadata.json` file contains capture specs.

Files

- `veo_wificontent_tablet_reference.html` — static tablet UI mock.
- `demo-driver.js` — deterministic sequence runner (dependency-free).
- `demo-sequence.json` — timeline of events (ms-accurate).
- `demo-metadata.json` — capture specs and camera crop.
- `assets/*` — placeholder assets used by the mock (local only).

Safety

- No external requests. All images referenced are local.
- The demo driver does not write to any database or local storage.
- To abort: `window.stopDemoSequence()` and reload the page.

Editing timings

Edit `demo-sequence.json` to adjust timings and actions. The Playwright recorder will pick changes on next run.
