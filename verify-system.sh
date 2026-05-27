#!/bin/bash

# VERIFICATION CHECKLIST - Run this to verify system is ready

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                   SYSTEM VERIFICATION                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check 1: Essential files exist
echo "✓ Checking essential files..."
FILES=(
  "index.html"
  "server.js"
  "service-worker.js"
  "firebase-config.js"
  "firebase-db.js"
  "firebase-rules.json"
  "package.json"
  "README.md"
  "PRODUCTION_DEBUGGING_GUIDE.md"
)

ALL_EXIST=true
for FILE in "${FILES[@]}"; do
  if [ -f "$FILE" ]; then
    echo "  ✅ $FILE"
  else
    echo "  ❌ $FILE (MISSING)"
    ALL_EXIST=false
  fi
done

echo ""

# Check 2: No build artifacts
echo "✓ Checking for removed files..."
REMOVED=(
  "build_*.js"
  "expand_*.js"
  "pois/"
  "test_*.html"
)

for PATTERN in "${REMOVED[@]}"; do
  COUNT=$(find . -name "$PATTERN" -o -path "./.*" 2>/dev/null | wc -l)
  if [ $COUNT -eq 0 ]; then
    echo "  ✅ No '$PATTERN' found"
  else
    echo "  ⚠️  Found $COUNT files matching '$PATTERN'"
  fi
done

echo ""

# Check 3: Server can start
echo "✓ Checking if server starts..."
if command -v npm &> /dev/null; then
  echo "  ✅ npm installed"
  if [ -f "package.json" ]; then
    echo "  ✅ package.json exists"
  else
    echo "  ❌ package.json missing"
  fi
else
  echo "  ❌ npm not installed"
fi

echo ""

# Check 4: Git status
echo "✓ Checking git history..."
COMMITS=$(git log --oneline 2>/dev/null | head -7)
if [ -n "$COMMITS" ]; then
  echo "  ✅ Last 7 commits:"
  git log --oneline -7 | sed 's/^/    /'
else
  echo "  ❌ No git history"
fi

echo ""

# Check 5: File sizes
echo "✓ Checking file sizes..."
if [ -f "index.html" ]; then
  SIZE=$(du -h index.html | cut -f1)
  echo "  ✅ index.html: $SIZE"
fi

if [ -f "server.js" ]; then
  SIZE=$(du -h server.js | cut -f1)
  echo "  ✅ server.js: $SIZE"
fi

if [ -f "service-worker.js" ]; then
  SIZE=$(du -h service-worker.js | cut -f1)
  echo "  ✅ service-worker.js: $SIZE"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                   VERIFICATION COMPLETE                       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

if [ "$ALL_EXIST" = true ]; then
  echo "✅ All essential files present - SYSTEM READY FOR DEPLOYMENT"
  echo ""
  echo "Next steps:"
  echo "  1. npm start          # Start local server"
  echo "  2. http://localhost:3000  # Open in browser"
  echo "  3. Press F12 and try: quickStatus()"
  echo ""
else
  echo "❌ Some files are missing - check above for details"
  echo ""
fi
