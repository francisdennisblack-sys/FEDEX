#!/usr/bin/env node

/**
 * Split 1.5M locations into manageable chunks (< 100MB each)
 */

const fs = require('fs');

console.log('📦 Splitting 1.5M locations into chunks...\n');

try {
  const locData = JSON.parse(fs.readFileSync('./mega_master_locations_global.json', 'utf8'));
  console.log(`✅ Loaded ${locData.data.length.toLocaleString()} locations`);
  
  const chunkSize = 250000; // 250K locations per chunk (~80-100MB each)
  const chunks = [];
  
  for (let i = 0; i < locData.data.length; i += chunkSize) {
    chunks.push(locData.data.slice(i, i + chunkSize));
  }
  
  console.log(`📝 Creating ${chunks.length} chunks...\n`);
  
  const manifest = {
    version: '8.0',
    timestamp: new Date().toISOString(),
    source: 'Mega Location Builder',
    description: 'Location database split into chunks',
    totalLocations: locData.data.length,
    chunks: chunks.length,
    chunkSize: chunkSize,
    files: []
  };
  
  // Write each chunk
  chunks.forEach((chunk, idx) => {
    const filename = `mega_master_locations_chunk_${(idx + 1).toString().padStart(2, '0')}.json`;
    const chunkData = {
      version: '8.0',
      timestamp: new Date().toISOString(),
      chunkNumber: idx + 1,
      totalChunks: chunks.length,
      locationCount: chunk.length,
      data: chunk
    };
    
    fs.writeFileSync(filename, JSON.stringify(chunkData, null, 2));
    console.log(`✅ ${filename} - ${chunk.length.toLocaleString()} locations`);
    
    manifest.files.push({
      filename: filename,
      chunkNumber: idx + 1,
      locationCount: chunk.length
    });
  });
  
  // Write manifest
  fs.writeFileSync('mega_master_locations_manifest.json', JSON.stringify(manifest, null, 2));
  console.log(`\n✅ mega_master_locations_manifest.json - Manifest file`);
  
  console.log(`\n✨ SPLIT COMPLETE!`);
  console.log(`   📦 Total chunks: ${chunks.length}`);
  console.log(`   🏘️  Total locations: ${locData.data.length.toLocaleString()}`);
  console.log(`   📄 Files created: ${chunks.length + 1}\n`);
  
  // Delete original
  fs.unlinkSync('./mega_master_locations_global.json');
  console.log(`🗑️ Removed original mega_master_locations_global.json`);
  
} catch (error) {
  console.error('❌ Error splitting locations:', error);
  process.exit(1);
}
