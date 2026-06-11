// demo-driver.js — dependency-free deterministic demo driver
(() => {
  const feed = document.getElementById('feed');
  const debug = document.getElementById('debugTs');
  let timers = [];
  let running = false;
  let startT = 0;
  let seq = null;

  function qs(id){return document.querySelector('[data-id="'+id+'"]');}

  function createPostEl(post){
    const el = document.createElement('div'); el.className='post'; el.dataset.id = post.id;
    el.style.willChange='transform,opacity';
    const thumb = document.createElement('div'); thumb.className='thumb';
    const img = document.createElement('img'); img.src = post.image||'assets/post-1.png'; img.style.width='100%'; img.style.height='100%'; img.style.objectFit='cover'; img.alt='';
    thumb.appendChild(img);
    const content = document.createElement('div'); content.className='content';
    const title = document.createElement('div'); title.className='title'; title.textContent = post.title;
    const body = document.createElement('div'); body.className='body'; body.textContent = post.body;
    const meta = document.createElement('div'); meta.className='meta';
    const like = document.createElement('div'); like.className='badge-like'; like.dataset.role='likes'; like.textContent = String(post.likes||0);
    const area = document.createElement('div'); area.className='area'; area.textContent = post.areaTag||'';
    meta.appendChild(like); meta.appendChild(area);
    content.appendChild(title); content.appendChild(body); content.appendChild(meta);
    el.appendChild(thumb); el.appendChild(content);
    // crown placeholder
    if(post.crown){ const sv = document.createElementNS('http://www.w3.org/2000/svg','svg'); sv.setAttribute('class','crown'); sv.setAttribute('viewBox','0 0 24 24'); sv.innerHTML='<path fill="#ffd54a" d="M12 2l2.4 6.4L21 9l-5 3.6L17.8 21 12 17.8 6.2 21 7 12.6 2 9l6.6-0.6z"/>'; el.appendChild(sv);} 
    return el;
  }

  // FLIP helpers
  function measurePositions(els){ const rects = new Map(); els.forEach(el => rects.set(el, el.getBoundingClientRect())); return rects; }
  function applyInversion(rects){ rects.forEach((r,el)=>{ el.dataset._flipTop=r.top; el.dataset._flipLeft=r.left; }); }
  function animateFLIP(duration=420){
    const els = Array.from(feed.children);
    const last = measurePositions(els);
    const prev = new Map(); els.forEach(el=>{ prev.set(el,{top: Number(el.dataset._flipTop||0), left: Number(el.dataset._flipLeft||0)}); });
    els.forEach(el=>{
      const p = prev.get(el) || {top:0,left:0}; const l = last.get(el);
      const dy = (p.top - l.top); const dx = (p.left - l.left);
      if(Math.abs(dy)>0.5 || Math.abs(dx)>0.5){ el.style.transition='none'; el.style.transform = `translate(${dx}px,${dy}px)`; requestAnimationFrame(()=>{ el.style.transition=`transform ${duration}ms cubic-bezier(.22,.9,.3,1)`; el.style.transform='translate(0,0)'; }); }
    });
    // clear stored firsts
    els.forEach(el=>{ delete el.dataset._flipTop; delete el.dataset._flipLeft; });
  }

  function addPost(post){ const first = Array.from(feed.children); const firstRects = measurePositions(first); applyInversion(firstRects);
    const el = createPostEl(post); el.style.opacity='0'; el.classList.add('animate-in'); feed.appendChild(el);
    // entrance
    requestAnimationFrame(()=>{ el.style.transition='transform 420ms,opacity 320ms'; el.style.transform='translateY(0)'; el.style.opacity='1'; });
    // animate reflow
    setTimeout(()=> animateFLIP(420), 60);
  }

  function removePost(postId){ const el = qs(postId); if(!el) return; el.style.transition='opacity 240ms,transform 320ms'; el.style.opacity='0'; el.style.transform='scale(0.98)'; setTimeout(()=>el.remove(),320); }

  function likePost(postId, delta=1){ const el = qs(postId); if(!el) return; const like = el.querySelector('[data-role="likes"]'); const cur = Number(like.textContent||0); like.textContent = String(cur + delta); // small pulse
    like.animate([{transform:'scale(1)'},{transform:'scale(1.2)'},{transform:'scale(1)'}],{duration:320,easing:'ease-out'});
  }

  function promotePost(postId){ const el = qs(postId); if(!el) return; const children = Array.from(feed.children); const idx = children.indexOf(el); if(idx<=0) return; const firstRects = measurePositions(children); applyInversion(firstRects);
    feed.removeChild(el); feed.insertBefore(el, feed.firstChild);
    animateFLIP(480);
  }

  function addBadge(postId,badgeType){ const el = qs(postId); if(!el) return; const b = document.createElement('div'); b.className='badge-glow'; b.style.position='absolute'; b.style.right='14px'; b.style.top='10px'; b.style.padding='6px 8px'; b.style.borderRadius='6px'; b.style.background='rgba(255,214,74,0.12)'; b.style.color='#ffd54a'; b.textContent = badgeType; b.dataset.badge = badgeType; el.style.position='relative'; el.appendChild(b); // zoom
    b.animate([{transform:'scale(.6)',opacity:0},{transform:'scale(1.12)',opacity:1},{transform:'scale(1)'}],{duration:420});
  }

  function removeBadge(postId,badgeType){ const el = qs(postId); if(!el) return; const b = el.querySelector(`[data-badge="${badgeType}"]`); if(!b) return; b.animate([{transform:'scale(1)'},{transform:'scale(.7)',opacity:0}],{duration:320}); setTimeout(()=>b.remove(),340);
  }

  function zoomBadge(postId){ const el = qs(postId); if(!el) return; const b = el.querySelector('[data-badge]'); if(!b) return; b.animate([{transform:'scale(1)'},{transform:'scale(1.6)'},{transform:'scale(1)'}],{duration:520,easing:'cubic-bezier(.22,.9,.3,1)'});
  }

  function runSequenceFromObject(sequence){ seq = sequence; // schedule events
    const maxT = Math.max(...sequence.map(e=>e.t||0)) + 1200; startT = performance.now(); running = true; debug.textContent = 'ts: 0ms';
    sequence.forEach(ev => {
      const id = setTimeout(()=>{ if(!running) return; debug.textContent = 'ts: '+Math.round(performance.now()-startT)+'ms'; handleEvent(ev); }, ev.t);
      timers.push(id);
    });
    // auto-stop after max
    timers.push(setTimeout(()=> stopDemoSequence(), maxT));
  }

  async function runSequenceFromFetch(){ try{ const res = await fetch('demo-sequence.json', {cache:'no-store'}); if(!res.ok) throw new Error('no seq'); const data = await res.json(); runSequenceFromObject(data); }catch(e){ if(window.demoSequenceFallback) runSequenceFromObject(window.demoSequenceFallback); }
  }

  function handleEvent(ev){ if(!ev || !ev.type) return; const post = ev.post || {}; switch(ev.type){
      case 'addPost': addPost(post); break;
      case 'removePost': removePost(post.id); break;
      case 'like': likePost(post.id, ev.delta||1); break;
      case 'promote': promotePost(post.id); break;
      case 'addBadge': addBadge(post.id, ev.badgeType||'badge'); break;
      case 'removeBadge': removeBadge(post.id, ev.badgeType||'badge'); break;
      case 'zoomBadge': zoomBadge(post.id); break;
      case 'wait': break;
    }
  }

  function startDemoSequence(){ if(running) return; // idempotent
    // seed initial posts if feed empty
    if(feed.children.length===0){ addPost({id:'p1',title:'Community Garden',body:'Local planting event',likes:2,areaTag:'Zone A',image:'assets/post-1.png'}); addPost({id:'p2',title:'Free Coffee',body:'Morning meetup',likes:1,areaTag:'Zone A',image:'assets/post-2.png'}); addPost({id:'p3',title:'Lost Dog',body:'Help find Rufus',likes:0,areaTag:'Zone B',image:'assets/post-3.png'}); }
    // start sequence from JSON
    runSequenceFromFetch();
  }

  function stopDemoSequence(){ running=false; timers.forEach(id=>clearTimeout(id)); timers=[]; seq=null; debug.textContent = 'ts: stopped'; }

  // expose API
  window.startDemoSequence = startDemoSequence; window.stopDemoSequence = stopDemoSequence;
  window.demoDriver = { addPost, removePost, likePost, promotePost, addBadge, removeBadge, zoomBadge };

  // fallback demo sequence (used if fetch fails)
  window.demoSequenceFallback = [
    {"t":2000,"type":"addPost","post":{"id":"p4","title":"Garage Sale","body":"Saturday 9am","likes":0,"areaTag":"Zone A","image":"assets/post-4.png"}},
    {"t":4000,"type":"like","post":{"id":"p4"},"delta":1},
    {"t":5200,"type":"like","post":{"id":"p4"},"delta":1},
    {"t":6800,"type":"promote","post":{"id":"p4"}},
    {"t":8400,"type":"addBadge","post":{"id":"p4"},"badgeType":"crown"},
    {"t":9800,"type":"zoomBadge","post":{"id":"p4"}},
    {"t":13000,"type":"removeBadge","post":{"id":"p2"},"badgeType":"old"},
    {"t":15000,"type":"addPost","post":{"id":"p5","title":"New Cafe","body":"Now open","likes":0,"areaTag":"Zone A","image":"assets/post-2.png"}},
    {"t":18000,"type":"like","post":{"id":"p5"},"delta":2},
    {"t":21000,"type":"promote","post":{"id":"p5"}},
    {"t":26000,"type":"zoomBadge","post":{"id":"p5"}}
  ];

})();
