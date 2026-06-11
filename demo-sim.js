// Demo driver for veo_wificontent_tablet_reference.html
// Safe: client-only, no network calls, reversible

(function(){
  const grid = document.getElementById('grid');
  let demoTimerHandles = [];
  let demoRunning = false;
  const seed = [
    {id:'p1',title:'Community Yard Sale',body:'Garage sale this weekend',likes:5,badge:'1st'},
    {id:'p2',title:'Lost Dog',body:'Small brown terrier near park',likes:3},
    {id:'p3',title:'Free Plants',body:'Pick up today',likes:2}
  ];

  function createPostEl(post){
    const el = document.createElement('div'); el.className='post'; el.dataset.id=post.id;
    const badge = document.createElement('div'); badge.className='badge'; badge.textContent = post.badge||''; if(!post.badge) badge.classList.add('hidden');
    const title = document.createElement('div'); title.className='title'; title.textContent = post.title;
    const body = document.createElement('div'); body.className='body'; body.textContent = post.body;
    const meta = document.createElement('div'); meta.className='meta';
    const likes = document.createElement('div'); likes.className='likes'; likes.textContent = `+${post.likes||0}`;
    meta.appendChild(likes);
    el.appendChild(badge);
    el.appendChild(title);
    el.appendChild(body);
    el.appendChild(meta);
    return el;
  }

  function renderInitial(){
    grid.innerHTML='';
    seed.forEach(p=> grid.appendChild(createPostEl(p)));
  }

  function flipReorder(newOrderIds){
    // GSAP Flip reflow: capture state, reorder DOM, flip
    const state = Flip.getState('.post');
    // reorder DOM according to newOrderIds
    newOrderIds.forEach(id => {
      const el = grid.querySelector(`.post[data-id="${id}"]`);
      if (el) grid.appendChild(el);
    });
    Flip.from(state, {duration:0.6, ease:'power2.inOut', stagger:0.03});
  }

  function zoomBadge(id){
    const el = grid.querySelector(`.post[data-id="${id}"] .badge`);
    if(!el) return;
    el.classList.remove('hidden');
    gsap.fromTo(el, {scale:0.8, boxShadow:'0 0 0 rgba(0,0,0,0)'}, {scale:1.35, duration:0.28, ease:'back.out(2)', onComplete:()=>{
      gsap.to(el, {scale:1, duration:0.25, ease:'power2.out'});
    }});
  }

  function changeLikes(id, delta){
    const el = grid.querySelector(`.post[data-id="${id}"] .likes`);
    if(!el) return;
    const cur = parseInt(el.textContent.replace(/[^0-9-]/g,''))||0;
    el.textContent = `+${cur + delta}`;
  }

  function addPost(post){
    const el = createPostEl(post);
    grid.appendChild(el);
    // simple entrance animation
    gsap.fromTo(el, {y:30,opacity:0,scale:0.98}, {y:0,opacity:1,scale:1,duration:0.5,ease:'power2.out'});
  }

  function sequence(){
    demoRunning = true;
    renderInitial();
    // timeline
    // t+2s: add new post (p4)
    demoTimerHandles.push(setTimeout(()=>{
      addPost({id:'p4',title:'New: Local Coffee',body:'Try our new roast',likes:0});
    },2000));

    // t+4s: like p4 repeatedly, then promote to top
    demoTimerHandles.push(setTimeout(()=>{
      changeLikes('p4',3);
      zoomBadge('p4');
      // reorder: bring p4 to front
      flipReorder(['p4','p1','p2','p3']);
    },4200));

    // t+7s: p1 loses badge
    demoTimerHandles.push(setTimeout(()=>{
      const b = grid.querySelector('.post[data-id="p1"] .badge'); if(b) { gsap.to(b, {scale:0.6,opacity:0,duration:0.35,onComplete:()=>b.classList.add('hidden')}); }
    },7000));

    // t+9s: add another post and reflow
    demoTimerHandles.push(setTimeout(()=>{
      addPost({id:'p5',title:'Event: Park Cleanup',body:'Join Saturday',likes:1,badge:'new'});
      flipReorder(['p4','p1','p2','p3','p5']);
      zoomBadge('p5');
    },9000));

    // t+12s: final badge zoom on top
    demoTimerHandles.push(setTimeout(()=>{
      zoomBadge('p4');
    },12000));

    // t+15s: stop demo
    demoTimerHandles.push(setTimeout(()=>{ demoRunning=false; },15000));
  }

  function stopAll(){ demoTimerHandles.forEach(t=>clearTimeout(t)); demoTimerHandles=[]; demoRunning=false; }

  // expose control APIs
  window.startDemoSequence = function(){ if(demoRunning) return; sequence(); };
  window.stopDemoSequence = function(){ stopAll(); renderInitial(); };

  // Auto-start if demo query param present
  try{ if(location.search.includes('demo=1')) setTimeout(()=>window.startDemoSequence(),800); }catch(e){}

})();
