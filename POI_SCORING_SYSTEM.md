# POI Scoring System - Complete Documentation

## Overview

The POI (Point of Interest) scoring system intelligently determines when to use POI area tags over location database tags. It's based on **POI size, user proximity, and confidence scoring**.

---

## 1. POI Categorization System

### POI Tier Structure

**TIER 1: MAJOR INFRASTRUCTURE (Size 5)**
- Universities, Airports, Large Parks, Hospitals
- Radius: 1.5-2.0 km (very large influence zones)
- Confidence: 0.92-0.95
- Priority: 95-100
- **Use Case**: Users 2km away should get "At the Airport" tags

**TIER 2: LARGE PUBLIC FACILITIES (Size 4)**
- Museums, Train Stations, Sports Facilities, Libraries
- Radius: 1.1-1.3 km (large influence zones)
- Confidence: 0.86-0.90
- Priority: 86-90
- **Use Case**: Users within 1.3km should get facility tags

**TIER 3: MEDIUM BUSINESSES (Size 3)**
- Restaurants, Hotels, Supermarkets, Offices
- Radius: 0.8 km (medium influence zones)
- Confidence: 0.75-0.82
- Priority: 75-82
- **Use Case**: Users in business districts

**TIER 4: SMALL BUSINESSES (Size 2)**
- Gyms, Pharmacies, Banks, Electronics Stores
- Radius: 0.5-0.6 km (small influence zones)
- Confidence: 0.70-0.75
- Priority: 70-75
- **Use Case**: Users specifically near the business

**TIER 5: TINY LOCAL (Size 1)**
- Coffee Shops, Bars, Salons
- Radius: 0.15-0.20 km (very small influence zones)
- Confidence: 0.50-0.55
- Priority: 50-55
- **Use Case**: Only when directly at/very close to the POI

---

## 2. Scoring Algorithm

### Multi-Factor Scoring Formula

```
POI Score = (Distance Score × Size Factor × Confidence) + Proximity Bonus
```

#### Components:

**Distance Score** (0 to 1)
- Calculated: `1 - (userDistance / influenceRadius)`
- At radius edge: 0 (minimum)
- At POI center: 1 (maximum)
- Linear decay from center

**Size Factor** (0.5 to 1.0)
- Formula: `0.5 + (size * 0.1)`
- Size 1 (tiny): 0.6x multiplier
- Size 5 (major): 1.0x multiplier
- Larger POIs are more reliable

**Confidence** (0.50 to 0.95)
- POI type confidence rating
- Major infrastructure: 0.92-0.95
- Small businesses: 0.70-0.75
- Tiny local: 0.50-0.55

**Proximity Bonus**
- Within 50m: +0.30 points (very strong signal)
- Within 100m: +0.20 points (good signal)
- Within 200m: +0.10 points (weak signal)
- Rewards being VERY close to POI

**Final Score** (normalized to 0-100)
- `(baseScore + proximityBonus) × 100`
- Minimum viable: 40 (configurable threshold)

### Example Calculations

**Example 1: Large Hospital, 200m away**
- Distance Score: 1 - (0.2/1.5) = 0.867
- Size Factor: 0.5 + (5 × 0.1) = 1.0
- Confidence: 0.93
- Proximity Bonus: 0.1
- Score: (0.867 × 1.0 × 0.93) + 0.1 = **90.6**
- Decision: ✅ USE POI

**Example 2: Coffee Shop, 150m away**
- Distance Score: 1 - (0.15/0.15) = 0 (outside radius!)
- Would not score well
- Decision: ❌ USE LOCATION

**Example 3: Coffee Shop, 50m away**
- Distance Score: 1 - (0.05/0.15) = 0.667
- Size Factor: 0.5 + (1 × 0.1) = 0.6
- Confidence: 0.50
- Proximity Bonus: 0.30 (very close!)
- Score: (0.667 × 0.6 × 0.50) + 0.30 = **50.0**
- Decision: ✅ USE POI (at threshold)

---

## 3. POI Decision Engine

### Threshold Logic

1. **Minimum Score Check**
   - POI must score ≥ 40 to be considered
   - Low scores indicate weak signal/far distance

2. **Location Score Comparison**
   - If location available, compare scores
   - POI needs 20% higher score to win: `POI_Score / Location_Score ≥ 1.2`
   - Prevents flip-flopping between POI/Location

3. **Final Decision**
   - If both checks pass: **Use POI**
   - Otherwise: **Use Location Database**

### Decision Matrix

| Scenario | Score | Decision | Reason |
|----------|-------|----------|--------|
| Near major hospital | 85+ | POI | Size + proximity |
| Edge of coffee shop radius | 38 | Location | Below threshold |
| Very close to coffee shop | 52 | POI | Proximity bonus |
| In restaurant district | 60 | POI | Business zone |
| Outside all POI zones | N/A | Location | No POI found |

---

## 4. Console Output Examples

### POI Selected Example
```
🔍 AREA TAG GENERATION:
   📍 User: 40.7500, -73.9800

   STEP 1: Checking nearby POIs with influence zones...
✨ POI AREA TAG SELECTED: "Madison Square Garden"
   🏢 Type: entertainment (Size: 4/5)
   📍 Distance: 0.250km | Influence: 1.300km
   📊 Score: 76.8 (Size(4) × Distance(0.81) × Confidence(0.87) + Proximity(0.20))
   ⏱️  Search: 2.3ms

📝 POST CREATION - AREA TAG CONFIRMED:
   📍 User Location: 40.7500, -73.9800
   🏘️  Area Tag: "Madison Square Garden"
   📊 Source: poi | POIs: 8,500 | Locations: 724,870
   💾 SAVING WITH AREA TAG: "Madison Square Garden"
```

### POI Rejected Example
```
🔍 AREA TAG GENERATION:
   📍 User: 40.7500, -73.9800

   STEP 1: Checking nearby POIs with influence zones...
   ℹ️  POI NOT SELECTED: "Blue Bottle Coffee"
   📊 Score: 35.2 - POI score too low (35.2 < 40)

   STEP 2: Not near POI - checking location database...
   ✅ USING LOCATION: "Manhattan District 12" (neighborhood, 0.234 km, 1.2ms)
```

---

## 5. System Behavior

### When POIs Are Used (Priority Order)

1. **User inside major infrastructure** (university, airport, hospital)
   - POI always used
   - Large areas dominate

2. **User near large facilities** (museums, parks, stations)
   - POI used if within influence radius
   - Medium-confidence scenarios

3. **User in business districts** (restaurants, hotels, offices)
   - POI used if within zone AND confident
   - Might defer to location if buildings packed

4. **User near small businesses** (gym, pharmacy, bank)
   - POI used only if very close
   - High proximity bonus needed

5. **User near tiny local** (coffee shop, bar, salon)
   - Rarely used unless DIRECTLY at POI (< 50m)
   - Proximity bonus critical

### Fallback Chain

```
Check POI (scoring) 
  → If score ≥ 40 
    → Check location score
      → If POI > Location (by 20%) 
        → USE POI ✨
      → Else 
        → USE LOCATION 📍
  → If score < 40 
    → USE LOCATION 📍
```

---

## 6. Performance

- **POI Search Time**: 0.5-3ms (8,500 POIs)
- **Scoring Time**: < 0.1ms per POI
- **Total Area Tag Time**: 1-5ms
- **Early Exit**: At 50m (very close POI found)

---

## 7. Configuration Tuning

### Adjust Influence Radius
Edit `POI_CATEGORIES` in index.html:
```javascript
'cafe': { radius: 0.15, size: 1, confidence: 0.50, ... }
//       Change 0.15 to 0.25 for larger coffee shop zones
```

### Adjust Confidence Scores
```javascript
'hospital': { ..., confidence: 0.93, ... }
//           Lower = harder to use, Higher = easier to use
```

### Adjust Minimum Score Threshold
In `shouldUsePOI()`:
```javascript
if (poiScore.score < 40) { // Change 40 to 50 for stricter
```

### Adjust Win Ratio
```javascript
const minimumWinRatio = 1.2; // Change to 1.5 for stricter POI wins
```

---

## 8. Real-World Examples

### Scenario 1: Tourist at Times Square
- User: 40.758, -73.986
- Nearby POIs:
  - McDonald's (fast_food, 0.05km)
  - Times Square Theater (entertainment, 0.15km)
  - Starbucks (cafe, 0.08km)
- Best POI: Times Square Theater
  - Score: ~78 (large area, close, good confidence)
  - Result: ✅ "At Times Square Theater"

### Scenario 2: Office Worker in Downtown
- User: 40.752, -73.983
- Nearby POIs:
  - Office building (0.02km)
  - Chase Bank (0.15km)
  - Various restaurants (0.3-0.8km)
- Best POI: Office (if in database)
  - Score depends on office size/type
  - Result: Location database preferred (neighborhoods more relevant)

### Scenario 3: Commuter at Transit Hub
- User: 40.750, -73.990
- Nearby POIs:
  - Grand Central Terminal (train_station, 0.2km)
  - Various shops (0.1-0.3km)
- Best POI: Grand Central Terminal
  - Score: ~85 (large area, medium distance, high confidence)
  - Result: ✅ "At Grand Central Terminal"

---

## 9. Testing Checklist

- [ ] POI near major infrastructure selected
- [ ] Coffee shop only selected when very close (< 50m)
- [ ] Score calculation matches formula
- [ ] Proximity bonus applied correctly
- [ ] Location database used as fallback
- [ ] Console logging shows detailed scoring
- [ ] Early exit works (< 50m to POI)
- [ ] Edge cases handled (no POI, no location)

---

## Summary

This robust POI system intelligently balances:
- **POI Size**: Larger areas get higher priority
- **User Proximity**: Closer = higher score
- **Type Confidence**: Different categories have different reliability
- **Location Fallback**: Uses location database when POI weak

Result: **Hyperlocal, contextually relevant area tags** 🎯
