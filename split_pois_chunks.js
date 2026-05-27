#!/usr/bin/env node

/**
 * Split 1.4M POIs into manageable 50MB chunks
 * This avoids GitHub's 100MB file size limit
 */

const fs = require('fs');
const path = require('path');

console.log('📦 Splitting POI database into 50MB chunks...\n');

try {
  // Read the massive POI file
  const poiData = JSON.parse(fs.readFileSync('./ultra_master_pois_global.json', 'utf8'));
  console.log(`✅ Loaded ${poiData.data.length.toLocaleString()} POIs`);
  
  const chunkSize = 100000; // POIs per file (~50MB each)
  const chunks = [];
  
  for (let i = 0; i < poiData.data.length; i += chunkSize) {
    chunks.push(poiData.data.slice(i, i + chunkSize));
  }
  
  console.log(`📝 Creating ${chunks.length} chunks...\n`);
  
  // Create a manifest file
  const manifest = {
    version: '7.0',
    timestamp: new Date().toISOString(),
    source: 'Global Ultra Comprehensive Database',
    description: 'POI database split into chunks',
    totalPOIs: poiData.data.length,
    chunks: chunks.length,
    chunkSize: chunkSize,
    categories: poiData.categories,
    files: []
  };
  
  // Write each chunk
  chunks.forEach((chunk, idx) => {
    const filename = `ultra_master_pois_chunk_${(idx + 1).toString().padStart(3, '0')}.json`;
    const chunkData = {
      version: '7.0',
      timestamp: new Date().toISOString(),
      chunkNumber: idx + 1,
      totalChunks: chunks.length,
      poiCount: chunk.length,
      data: chunk
    };
    
    fs.writeFileSync(filename, JSON.stringify(chunkData, null, 2));
    console.log(`✅ ${filename} - ${chunk.length.toLocaleString()} POIs`);
    
    manifest.files.push({
      filename: filename,
      chunkNumber: idx + 1,
      poiCount: chunk.length
    });
  });
  
  // Write manifest
  fs.writeFileSync('ultra_master_pois_manifest.json', JSON.stringify(manifest, null, 2));
  console.log(`\n✅ ultra_master_pois_manifest.json - Manifest file`);
  
  console.log(`\n✨ SPLIT COMPLETE!`);
  console.log(`   📦 Total chunks: ${chunks.length}`);
  console.log(`   🏢 Total POIs: ${poiData.data.length.toLocaleString()}`);
  console.log(`   📄 Files created: ${chunks.length + 1} (chunks + manifest)\n`);
  
  // Delete the original massive file
  fs.unlinkSync('./ultra_master_pois_global.json');
  console.log(`🗑️ Removed original ultra_master_pois_global.json (too large for GitHub)`);
  
} catch (error) {
  console.error('❌ Error splitting POI database:', error);
  process.exit(1);
}
