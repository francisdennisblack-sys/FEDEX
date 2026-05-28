#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

// Comprehensive worldwide city list with coordinates
const CITIES = [
  // North America (20 cities)
  { name: 'New York', country: 'USA', lat: 40.7128, lon: -74.0060 },
  { name: 'Los Angeles', country: 'USA', lat: 34.0522, lon: -118.2437 },
  { name: 'Chicago', country: 'USA', lat: 41.8781, lon: -87.6298 },
  { name: 'Houston', country: 'USA', lat: 29.7604, lon: -95.3698 },
  { name: 'Phoenix', country: 'USA', lat: 33.4484, lon: -112.0742 },
  { name: 'Philadelphia', country: 'USA', lat: 39.9526, lon: -75.1652 },
  { name: 'San Antonio', country: 'USA', lat: 29.4241, lon: -98.4936 },
  { name: 'San Diego', country: 'USA', lat: 32.7157, lon: -117.1611 },
  { name: 'Dallas', country: 'USA', lat: 32.7767, lon: -96.7970 },
  { name: 'San Jose', country: 'USA', lat: 37.3382, lon: -121.8863 },
  { name: 'Austin', country: 'USA', lat: 30.2672, lon: -97.7431 },
  { name: 'Denver', country: 'USA', lat: 39.7392, lon: -104.9903 },
  { name: 'Seattle', country: 'USA', lat: 47.6062, lon: -122.3321 },
  { name: 'Boston', country: 'USA', lat: 42.3601, lon: -71.0589 },
  { name: 'Miami', country: 'USA', lat: 25.7617, lon: -80.1918 },
  { name: 'Atlanta', country: 'USA', lat: 33.7490, lon: -84.3880 },
  { name: 'Portland', country: 'USA', lat: 45.5152, lon: -122.6784 },
  { name: 'Las Vegas', country: 'USA', lat: 36.1699, lon: -115.1398 },
  { name: 'Toronto', country: 'Canada', lat: 43.6532, lon: -79.3832 },
  { name: 'Vancouver', country: 'Canada', lat: 49.2827, lon: -123.1207 },

  // Europe (25 cities)
  { name: 'London', country: 'UK', lat: 51.5074, lon: -0.1278 },
  { name: 'Paris', country: 'France', lat: 48.8566, lon: 2.3522 },
  { name: 'Berlin', country: 'Germany', lat: 52.5200, lon: 13.4050 },
  { name: 'Madrid', country: 'Spain', lat: 40.4168, lon: -3.7038 },
  { name: 'Rome', country: 'Italy', lat: 41.9028, lon: 12.4964 },
  { name: 'Amsterdam', country: 'Netherlands', lat: 52.3676, lon: 4.9041 },
  { name: 'Barcelona', country: 'Spain', lat: 41.3851, lon: 2.1734 },
  { name: 'Vienna', country: 'Austria', lat: 48.2082, lon: 16.3738 },
  { name: 'Prague', country: 'Czech Republic', lat: 50.0755, lon: 14.4378 },
  { name: 'Budapest', country: 'Hungary', lat: 47.4979, lon: 19.0402 },
  { name: 'Warsaw', country: 'Poland', lat: 52.2297, lon: 21.0122 },
  { name: 'Krakow', country: 'Poland', lat: 50.0647, lon: 19.9450 },
  { name: 'Athens', country: 'Greece', lat: 37.9838, lon: 23.7275 },
  { name: 'Lisbon', country: 'Portugal', lat: 38.7223, lon: -9.1393 },
  { name: 'Brussels', country: 'Belgium', lat: 50.8503, lon: 4.3517 },
  { name: 'Dublin', country: 'Ireland', lat: 53.3498, lon: -6.2603 },
  { name: 'Stockholm', country: 'Sweden', lat: 59.3293, lon: 18.0686 },
  { name: 'Copenhagen', country: 'Denmark', lat: 55.6761, lon: 12.5683 },
  { name: 'Helsinki', country: 'Finland', lat: 60.1695, lon: 24.9354 },
  { name: 'Munich', country: 'Germany', lat: 48.1351, lon: 11.5820 },
  { name: 'Milan', country: 'Italy', lat: 45.4642, lon: 9.1900 },
  { name: 'Venice', country: 'Italy', lat: 45.4408, lon: 12.3155 },
  { name: 'Florence', country: 'Italy', lat: 43.7696, lon: 11.2558 },
  { name: 'Istanbul', country: 'Turkey', lat: 41.0082, lon: 28.9784 },
  { name: 'Zurich', country: 'Switzerland', lat: 47.3769, lon: 8.5472 },

  // Asia (30 cities)
  { name: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503 },
  { name: 'Shanghai', country: 'China', lat: 31.2304, lon: 121.4737 },
  { name: 'Beijing', country: 'China', lat: 39.9042, lon: 116.4074 },
  { name: 'Shenzhen', country: 'China', lat: 22.5431, lon: 114.0579 },
  { name: 'Hong Kong', country: 'Hong Kong', lat: 22.3193, lon: 114.1694 },
  { name: 'Bangkok', country: 'Thailand', lat: 13.7563, lon: 100.5018 },
  { name: 'Singapore', country: 'Singapore', lat: 1.3521, lon: 103.8198 },
  { name: 'Kuala Lumpur', country: 'Malaysia', lat: 3.1390, lon: 101.6869 },
  { name: 'Jakarta', country: 'Indonesia', lat: -6.2088, lon: 106.8456 },
  { name: 'Manila', country: 'Philippines', lat: 14.5995, lon: 120.9842 },
  { name: 'Seoul', country: 'South Korea', lat: 37.5665, lon: 126.9780 },
  { name: 'Busan', country: 'South Korea', lat: 35.1796, lon: 129.0756 },
  { name: 'Taipei', country: 'Taiwan', lat: 25.0330, lon: 121.5654 },
  { name: 'Ho Chi Minh City', country: 'Vietnam', lat: 10.8231, lon: 106.6297 },
  { name: 'Hanoi', country: 'Vietnam', lat: 21.0285, lon: 105.8542 },
  { name: 'Dhaka', country: 'Bangladesh', lat: 23.8103, lon: 90.4125 },
  { name: 'Kolkata', country: 'India', lat: 22.5726, lon: 88.3639 },
  { name: 'Mumbai', country: 'India', lat: 19.0760, lon: 72.8777 },
  { name: 'Delhi', country: 'India', lat: 28.7041, lon: 77.1025 },
  { name: 'Bangalore', country: 'India', lat: 12.9716, lon: 77.5946 },
  { name: 'Lahore', country: 'Pakistan', lat: 31.5204, lon: 74.3587 },
  { name: 'Karachi', country: 'Pakistan', lat: 24.8607, lon: 67.0011 },
  { name: 'Dubai', country: 'UAE', lat: 25.2048, lon: 55.2708 },
  { name: 'Abu Dhabi', country: 'UAE', lat: 24.4539, lon: 54.3773 },
  { name: 'Tel Aviv', country: 'Israel', lat: 32.0853, lon: 34.7818 },
  { name: 'Bangkok', country: 'Thailand', lat: 13.7563, lon: 100.5018 },
  { name: 'Riyadh', country: 'Saudi Arabia', lat: 24.7136, lon: 46.6753 },
  { name: 'Cairo', country: 'Egypt', lat: 30.0444, lon: 31.2357 },
  { name: 'Tehran', country: 'Iran', lat: 35.6892, lon: 51.3890 },
  { name: 'Beirut', country: 'Lebanon', lat: 33.8740, lon: 35.4890 },

  // South America (12 cities)
  { name: 'São Paulo', country: 'Brazil', lat: -23.5505, lon: -46.6333 },
  { name: 'Rio de Janeiro', country: 'Brazil', lat: -22.9068, lon: -43.1729 },
  { name: 'Buenos Aires', country: 'Argentina', lat: -34.6037, lon: -58.3816 },
  { name: 'Lima', country: 'Peru', lat: -12.0464, lon: -77.0428 },
  { name: 'Bogotá', country: 'Colombia', lat: 4.7110, lon: -74.0721 },
  { name: 'Caracas', country: 'Venezuela', lat: 10.4806, lon: -66.9036 },
  { name: 'Santiago', country: 'Chile', lat: -33.8688, lon: -51.2093 },
  { name: 'Brasília', country: 'Brazil', lat: -15.8267, lon: -47.8615 },
  { name: 'Quito', country: 'Ecuador', lat: -0.2299, lon: -78.5099 },
  { name: 'La Paz', country: 'Bolivia', lat: -16.4897, lon: -68.1527 },
  { name: 'Asunción', country: 'Paraguay', lat: -25.2637, lon: -57.5759 },
  { name: 'Paramaribo', country: 'Suriname', lat: 5.8520, lon: -55.2038 },

  // Africa (12 cities)
  { name: 'Lagos', country: 'Nigeria', lat: 6.5244, lon: 3.3792 },
  { name: 'Cairo', country: 'Egypt', lat: 30.0444, lon: 31.2357 },
  { name: 'Johannesburg', country: 'South Africa', lat: -26.1925, lon: 28.0456 },
  { name: 'Cape Town', country: 'South Africa', lat: -33.9249, lon: 18.4241 },
  { name: 'Nairobi', country: 'Kenya', lat: -1.2921, lon: 36.8219 },
  { name: 'Addis Ababa', country: 'Ethiopia', lat: 9.0320, lon: 38.7469 },
  { name: 'Accra', country: 'Ghana', lat: 5.6037, lon: -0.1870 },
  { name: 'Casablanca', country: 'Morocco', lat: 33.5731, lon: -7.5898 },
  { name: 'Algiers', country: 'Algeria', lat: 36.7372, lon: 3.0868 },
  { name: 'Tunis', country: 'Tunisia', lat: 36.8065, lon: 10.1686 },
  { name: 'Khartoum', country: 'Sudan', lat: 15.5007, lon: 32.5599 },
  { name: 'Dar es Salaam', country: 'Tanzania', lat: -6.8000, lon: 39.2833 },

  // Oceania (6 cities)
  { name: 'Sydney', country: 'Australia', lat: -33.8688, lon: 151.2093 },
  { name: 'Melbourne', country: 'Australia', lat: -37.8136, lon: 144.9631 },
  { name: 'Brisbane', country: 'Australia', lat: -27.4698, lon: 153.0251 },
  { name: 'Perth', country: 'Australia', lat: -31.9505, lon: 115.8605 },
  { name: 'Auckland', country: 'New Zealand', lat: -37.0882, lon: 174.8860 },
  { name: 'Wellington', country: 'New Zealand', lat: -41.2865, lon: 174.7762 }
];

const QUERIES = [
  { name: 'Food', query: `(node["amenity"~"restaurant|cafe|bar|pub|fast_food"];way["amenity"~"restaurant|cafe|bar|pub|fast_food"];);` },
  { name: 'Retail', query: `(node["shop"~"supermarket|mall|clothes|electronics|department"];way["shop"~"supermarket|mall|clothes|electronics|department"];);` },
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
    'mall': { emoji: '🛍️', name: 'Mall' },
    'bank': { emoji: '🏦', name: 'Bank' },
    'hospital': { emoji: '🏥', name: 'Hospital' },
    'clinic': { emoji: '⚕️', name: 'Clinic' },
    'school': { emoji: '🎓', name: 'School' },
    'college': { emoji: '🎓', name: 'College' },
    'library': { emoji: '📚', name: 'Library' },
    'gym': { emoji: '💪', name: 'Gym' },
    'park': { emoji: '🌳', name: 'Park' },
    'museum': { emoji: '🏛️', name: 'Museum' },
    'cinema': { emoji: '🎬', name: 'Cinema' },
    'fast_food': { emoji: '🍔', name: 'Fast Food' },
    'pub': { emoji: '🍻', name: 'Pub' },
    'post_office': { emoji: '📬', name: 'Post Office' },
    'department': { emoji: '🏪', name: 'Department Store' }
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

async function expandPOIDatabase() {
  const database = {
    version: '3.0',
    timestamp: new Date().toISOString(),
    source: 'OpenStreetMap (Overpass API)',
    totalPOIs: 0,
    totalCities: 0,
    cities: {},
  };

  console.log(`🌍 Expanding POI Database - ${CITIES.length} cities worldwide\n`);

  for (let i = 0; i < CITIES.length; i++) {
    const city = CITIES[i];
    const progress = `[${i + 1}/${CITIES.length}]`;
    console.log(`📍 ${progress} ${city.name}, ${city.country}`);

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
      database.totalCities = Object.keys(database.cities).length;

      // Save progress every city
      fs.writeFileSync(
        path.join(__dirname, 'poi_database_expanded.json'),
        JSON.stringify(database, null, 2)
      );

      console.log(`\n💾 Progress saved - Cities: ${database.totalCities}, Total POIs: ${database.totalPOIs}\n`);
    }
  }

  console.log(`\n✅ COMPLETE! Final Database:`);
  console.log(`   Cities: ${database.totalCities}`);
  console.log(`   Total POIs: ${database.totalPOIs}`);
  console.log(`   Average POIs per city: ${Math.round(database.totalPOIs / database.totalCities)}`);
  console.log(`   File: poi_database_expanded.json`);
}

console.log('🌍 POI Database Expansion Tool\n');
expandPOIDatabase().catch(error => { console.error('❌ Error:', error); process.exit(1); });
