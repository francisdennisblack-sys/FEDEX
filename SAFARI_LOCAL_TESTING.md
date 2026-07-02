# Safari-Like Local Testing

Use this when Safari behaves differently from Chrome during local testing.

## 1) One-time setup

Run:

```bash
./scripts/setup_safari_local_profile.sh
```

If prompted in output, add this hosts entry manually:

```bash
echo '127.0.0.1 wificontent.local' | sudo tee -a /etc/hosts
```

## 2) Start Safari-like local profile

Run:

```bash
./scripts/run_safari_like_local.sh
```

This does the following:

- Starts `node server.js` on `http://127.0.0.1:5001` if needed.
- Starts an HTTPS proxy on `https://wificontent.local:5443` (or `https://localhost:5443` fallback).
- Opens Safari at the HTTPS local URL.

## 3) Private window test

In Safari, open a Private Window and load the same URL.

## 4) Stop local profile

Run:

```bash
./scripts/stop_safari_like_local.sh
```
