(async () => {
  try {
    const zones = ['zone-A','zone-B','zone-C','global'];
    const total = 200;
    for (let i = 1; i <= total; i++) {
      const zone = zones[Math.floor(Math.random()*zones.length)];
      const likes = Math.floor(Math.random()*1000);
      const ts = Date.now() - Math.floor(Math.random()*7*24*60*60*1000);
      const post = {
        zoneId: zone,
        content: `Sample seeded post #${i} (${zone})`,
        timestamp: ts,
        likes: likes
      };
      try {
        const resp = await fetch('http://localhost:5001/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(post)
        });
        const json = await resp.json();
        if (!resp.ok) console.error('failed', i, json);
        if (i % 20 === 0) console.log(`seeded ${i}/${total}`);
      } catch (e) {
        console.error('request error', e.message);
      }
      // small pause
      await new Promise(r => setTimeout(r, 50));
    }
    console.log('seeding complete');
    process.exit(0);
  } catch (e) {
    console.error('fatal', e);
    process.exit(1);
  }
})();
