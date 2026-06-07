const { JSDOM } = require('jsdom');
const fs = require('fs');

(async function(){
  try{
    const html = fs.readFileSync('./index.html','utf8');
    // Find the script block containing startDemoMVP
    const idx = html.indexOf('window.startDemoMVP');
    if(idx === -1) throw new Error('startDemoMVP not found in index.html');

    // find the opening <script ...> before idx
    const before = html.lastIndexOf('<script', idx);
    if(before === -1) throw new Error('Enclosing <script> not found');
    const startTagEnd = html.indexOf('>', before);
    const scriptEnd = html.indexOf('</script>', idx);
    if(startTagEnd === -1 || scriptEnd === -1) throw new Error('Malformed <script> block');
    const scriptContent = html.slice(startTagEnd+1, scriptEnd);

    // Provide minimal DOM nodes used by demo helpers (grid + view modal)
    const minimal = `<!doctype html><html><body>
      <div id="grid"></div>
      <div class="view-modal" id="viewModal" style="display:none;">
        <div class="view-modal-content">
          <div id="viewMedia"></div>
          <div id="viewText"></div>
        </div>
      </div>
      <script>/* metric stubs to be wrapped by app */
        window._impressionCalls = [];
        window._clickCalls = [];
        window.sendPostImpressionMetric = function(id){ window._impressionCalls.push(id); };
        window.sendPostClickMetric = function(id){ window._clickCalls.push(id); };
      </script>
      <script>${scriptContent}</script>
    </body></html>`;

    const dom = new JSDOM(minimal, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true });
    // Give inline script a moment to run
    await new Promise(res => setTimeout(res, 600));
    const win = dom.window;

    // Start demo if available
    if(typeof win.forceStartDemo === 'function'){
      try{ win.forceStartDemo(); } catch(e){ /* ignore */ }
    }

    await new Promise(res => setTimeout(res, 300));

    let output = null;
    if(typeof win.runDemoSmokeTests === 'function'){
      try{ output = win.runDemoSmokeTests(); } catch(e){ output = { error: String(e) }; }
    } else {
      output = { error: 'runDemoSmokeTests not defined' };
    }

      // Attempt autofix via smoke tests
      if(output && !output.ok && typeof win.runDemoSmokeTests === 'function'){
        try{ const fixed = win.runDemoSmokeTests({fix:true}); output.fixed = fixed; } catch(e){ output.fixError = String(e); }
      }

      // Verify metric suppression: try calling impression/click on a demo id
      try{
        const demoId = (output && output.demoPostIds && output.demoPostIds[0]) || 'demo-0';
        // Call the (possibly wrapped) metric functions
        try{ win.sendPostImpressionMetric(demoId); }catch(e){}
        try{ win.sendPostClickMetric(demoId); }catch(e){}
        // Read whether original stubs were invoked
        output._impressionCalls = Array.isArray(win._impressionCalls) ? win._impressionCalls.slice() : null;
        output._clickCalls = Array.isArray(win._clickCalls) ? win._clickCalls.slice() : null;
        // If suppression worked, these arrays should be empty
        output.metricsSuppressed = (output._impressionCalls && output._impressionCalls.length === 0) && (output._clickCalls && output._clickCalls.length === 0);
      }catch(e){ output.metricsCheckError = String(e); }

      // Verify modal opens for a demo post
      try{
        const demoId = (output && output.demoPostIds && output.demoPostIds[1]) || 'demo-1';
        const p = win.postCache && win.postCache[demoId];
        if(p && typeof win.openDemoMediaModal === 'function'){
          try{ win.openDemoMediaModal(p); } catch(e){}
          await new Promise(res => setTimeout(res, 50));
          const vm = win.document.getElementById('viewModal');
          const vmDisplay = vm ? vm.style.display : null;
          output.modalOpened = (vmDisplay === 'flex' || vmDisplay === 'block');
        } else {
          output.modalOpened = false;
        }
      }catch(e){ output.modalCheckError = String(e); }

    console.log('SMOKE_TEST_OUTPUT_START');
    console.log(JSON.stringify(output, null, 2));
    console.log('SMOKE_TEST_OUTPUT_END');

    try{
      const sc = win.gridScroller;
      if(sc){
        const items = Array.isArray(sc.items) ? sc.items.slice(0,6).map(i=> i && i.id) : (sc.getVisibleItems ? sc.getVisibleItems().map(i=>i && i.id) : null);
        console.log('SCROLLER_TOP_ITEMS:', items);
      } else {
        console.log('SCROLLER_TOP_ITEMS: null');
      }
    }catch(e){ console.log('SCROLLER_TOP_ITEMS_ERROR', String(e)); }

    dom.window.close();
  }catch(err){
    console.error('ERROR', err.stack || err);
    process.exit(1);
  }
})();
