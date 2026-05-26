const fs = require('fs');

// Test with us_locations_fast.json which seems to be flat
const rawData = JSON.parse(fs.readFileSync('us_locations_fast.json', 'utf8'));
console.log('✅ Loaded data, type:', typeof rawData);
console.log('   Keys:', Object.keys(rawData).slice(0, 5));

// Check if it's wrapped in a structure
let data = Array.isArray(rawData) ? rawData : rawData.locations || rawData.data || Object.values(rawData).flat();

console.log('   Processed to:', data.length || 'N/A', 'items');


// Test calculation function
const calcDist = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

// Filter for California only
const caData = data.filter(loc => loc.state === 'CA' || loc.state === 'California');
console.log('\n📍 California locations:', caData.length);

// Look for Santa Ana and LA
const santaAna = caData.filter(loc => loc.name && loc.name.toLowerCase().includes('santa ana'));
const la = caData.filter(loc => loc.name && loc.name.toLowerCase().includes('los angeles'));

console.log('\n🔍 Santa Ana locations found:', santaAna.length);
console.log('🔍 Los Angeles locations found:', la.length);

if (santaAna.length > 0) {
  console.log('\nSanta Ana samples:');
  santaAna.slice(0, 3).forEach(loc => {
    console.log('  -', loc.name, '(' + loc.type + ')', 'at', loc.lat.toFixed(4), ',', loc.lon.toFixed(4));
  });
}

if (la.length > 0) {
  console.log('\nLos Angeles samples:');
  la.slice(0, 3).forEach(loc => {
    console.log('  -', loc.name, '(' + loc.type + ')', 'at', loc.lat.toFixed(4), ',', loc.lon.toFixed(4));
  });
}

// User coordinates - Santa Ana area
const userLat = 33.7454;
const userLon = -117.8677;
console.log('\n📍 User location (Santa Ana):', userLat, userLon);

// Find closest 5 cities to user
let allDistances = caData.map(loc => ({
  name: loc.name,
  type: loc.type,
  lat: loc.lat,
  lon: loc.lon,
  dist: calcDist(userLat, userLon, loc.lat, loc.lon)
}));

const closest = allDistances.sort((a, b) => a.dist - b.dist).slice(0, 10);
console.log('\nClosest 10 locations to user:');
closest.forEach(loc => {
  console.log('  ' + (loc.dist < 5 ? '🔴' : '🟡'), loc.dist.toFixed(2) + ' km -', loc.name, '(' + loc.type + ')');
});
