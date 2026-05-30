#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

const MAJOR_CITIES = [
  { name: 'New York', country: 'USA', lat: 40.7128, lon: -74.0060 },
  { name: 'Los Angeles', country: 'USA', lat: 34.0522, lon: -118.2437 },
  { name: 'Chicago', country: 'USA', lat: 41.8781, lon: -87.6298 },
  { name: 'London', country: 'UK', lat: 51.5074, lon: -0.1278 },
  { name: 'Paris', country: 'France', lat: 48.8566, lon: 2.3522 },
  { name: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503 },
  { name: 'Sydney', country: 'Australia', lat: -33.8688, lon: 151.2093 },
  { name: 'Singapore', country: 'Singapore', lat: 1.3521, lon: 103.8198 },
  { name: 'Dubai', country: 'UAE', lat: 25.2048, lon: 55.2708 },
  { name: 'Toronto', country: 'Canada', lat: 43.6532, lon: -79.3832 },
];

const QUERIES = [
  { name: 'Food', query: `(node["amenity"~"restaurant|cafe|bar|pub|fast_food"];way["amenity"~"restaurant|cafe|bar|pub|fast_food"];);` },
  { name: 'Retail', query: `(node["shop"~"supermarket|mall|clothes|electronics"];way["shop"~"supermarket|mall|clothes|electronics"];);` },
  { name: 'Entertainment', query: `(node["amenity"~"cinema"|"leisure"~"gym|park|museum|library"];way["amenity"~"cinema"|"leisure"~"gym|park|museum|library"];);` },
  { name: 'Services', query: `(node["amenity"~"bank|hospital|clinic|post_office"];way["amenity"~"bank|hospital|clinic|post_office"];);` },
  { name: 'Education', query: `(node["amenity"~"school|college|library"];way["amenity"~"school|college|library"];);` },
];

function queryOverpass(bbox, query) {
  return new Promise((resolve, reject) => {
    const [south, west, north, east] = bbox;
    const overpassQuery = `[bbox:${south},${west},${north},${east}];[timeout:30];${query}out geom;`;
    const data = new URLSearchParams({ data: overpassQuery });
    
    const options = {
      hostname: 'overpass-api.de',
      port: 443,
      path: '/api/interpreter',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': data.toString().length,
      },
      timeout: 35000,
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.abort(); reject(new Error('TIMEOUT')); });
    req.write(data.toString());
    req.end();
  });
}

function getCityBbox(lat, lon, radiusKm = 12) {
  const latDelta = radiusKm / 111.0;
  const lonDelta = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));
  return [lat - latDelta, lon - lonDelta, lat + latDelta, lon + lonDelta];
}

function extractPOIs(response) {
  if (!response.elements) return [];
  const categoryMap = {
    'restaurant': { emoji: '🍽️', name: 'Restaurant' },
    'cafe': { emoji: '☕', name: 'Cafe' },
    'bar': { emoji: '🍺', name: 'Bar' },
    'supermarket': { emoji: '🛒', name: 'Supermarket' },
    'bank': { emoji: '🏦', name: 'Bank' },
    'hospital': { emoji: '🏥', name: 'Hospital' },
    'school': { emoji: '🎓', name: 'School' },
    'park': { emoji: '🌳', name: 'Park' },
  };

  return response.elements.filter(el => el.lat && el.lon).map(el => {
    const type = el.tags?.amenity || el.tags?.shop || el.tags?.leisure || 'unknown';
    const cat = categoryMap[type] || { emoji: '📍', name: type };
    return {
      name: el.tags?.name || `${cat.name}`,
      lat: el.lat,
      lon: el.lon,
      category: cat.name,
      type: type,
      emoji: cat.emoji,
    };
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWorldwidePOI() {
  const database = {
    version: '2.0',
    timestamp: new Date().toISOString(),
    source: 'OpenStreetMap',
    totalPOIs: 0,
    cities: {},
  };

  for (let i = 0; i < MAJOR_CITIES.length; i++) {
    const city = MAJOR_CITIES[i];
    console.log(`\n📍 [${i + 1}/${MAJOR_CITIES.length}] ${city.name}`);

    const cityPOIs = [];
    const bbox = getCityBbox(city.lat, city.lon, 12);

    for (const q of QUERIES) {
      try {
        console.log(`   ⏳ ${q.name}...`);
        const response = await queryOverpass(bbox, q.query);
        const pois = extractPOIs(response);
        console.log(`   ✅ ${pois.length} POIs`);
        cityPOIs.push(...pois);
        await sleep(2000);
      } catch (error) {
        console.log(`   ⚠️  ${error.message}`);
        await sleep(3000);
      }
    }

    if (cityPOIs.length > 0) {
      const uniquePOIs = [];
      const seen = new Set();
      cityPOIs.forEach(poi => {
        const key = `${poi.lat.toFixed(5)},${poi.lon.toFixed(5)}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniquePOIs.push(poi);
        }
      });

      database.cities[city.name] = {
        country: city.country,
        lat: city.lat,
        lon: city.lon,
        poiCount: uniquePOIs.length,
        pois: uniquePOIs,
      };
      database.totalPOIs += uniquePOIs.length;

      fs.writeFileSync(path.join(__dirname, 'poi_database_worldwide.json'), JSON.stringify(database, null, 2));
    }
  }

  console.log(`\n✅ Done! Cities: ${Object.keys(database.cities).length}, Total POIs: ${database.totalPOIs}`);
}

console.log('🌍 Fetching worldwide POI data...\n');
fetchWorldwidePOI().catch(error => { console.error('❌ Error:', error); process.exit(1); });
