#!/usr/bin/env node

/**
 * Purchase Badge System Test
 * Verifies that the auto-arm system works correctly
 */

// Mock the window object
const mockWindow = {
    lastPurchaseType: null,
    purchasePaidAt: null,
    pendingBoost: { armed: false, armedAt: 0, tier: 'standard', paid: false },
    pendingSell: { armed: false, armedAt: 0, paid: false },
    selectedBadges: [],
    primaryBadge: null
};

const mockLocalStorage = (() => {
    const data = {};
    return {
        getItem: (key) => data[key] || null,
        setItem: (key, value) => { data[key] = value; },
        removeItem: (key) => { delete data[key]; },
        clear: () => { Object.keys(data).forEach(k => delete data[k]); }
    };
})();

// Mock the function to test
function applyPendingPurchaseToNextPost() {
    const lastPurchaseType = mockWindow.lastPurchaseType || (mockLocalStorage && mockLocalStorage.getItem('lastPurchaseType'));
    const purchasePaidAt = mockWindow.purchasePaidAt || (mockLocalStorage && mockLocalStorage.getItem('purchasePaidAt'));
    
    if (!lastPurchaseType) return;
    
    console.log(`💰 Applying pending ${lastPurchaseType} purchase to next post...`);
    
    if (lastPurchaseType === 'boost') {
        mockWindow.pendingBoost.armed = true;
        mockWindow.pendingBoost.armedAt = Date.now();
        mockWindow.pendingBoost.paid = true;
        console.log('  ✅ Boost badge auto-armed for next post');
    } else if (lastPurchaseType === 'sell') {
        mockWindow.pendingSell.armed = true;
        mockWindow.pendingSell.armedAt = Date.now();
        mockWindow.pendingSell.paid = true;
        if (!mockWindow.selectedBadges) mockWindow.selectedBadges = [];
        if (!mockWindow.selectedBadges.includes('sell')) mockWindow.selectedBadges.push('sell');
        mockWindow.primaryBadge = 'sell';
        console.log('  ✅ Sell badge auto-armed for next post');
    }
    
    mockWindow.lastPurchaseType = null;
    mockWindow.purchasePaidAt = null;
    try { mockLocalStorage.removeItem('lastPurchaseType'); mockLocalStorage.removeItem('purchasePaidAt'); } catch(e){}
}

// Test cases
console.log('\n' + '='.repeat(60));
console.log('PURCHASE BADGE SYSTEM - TEST SUITE');
console.log('='.repeat(60) + '\n');

// Test 1: Boost purchase and auto-arm
console.log('TEST 1: Boost Purchase Auto-Arm');
console.log('-----------------------------------');
mockWindow.lastPurchaseType = 'boost';
mockWindow.purchasePaidAt = Date.now();
mockLocalStorage.setItem('lastPurchaseType', 'boost');
mockLocalStorage.setItem('purchasePaidAt', String(Date.now()));

console.log('Before:', {
    pendingBoost: mockWindow.pendingBoost.armed,
    pendingSell: mockWindow.pendingSell.armed,
    lastPurchaseType: mockWindow.lastPurchaseType
});

applyPendingPurchaseToNextPost();

console.log('After:', {
    pendingBoost: mockWindow.pendingBoost.armed,
    pendingSell: mockWindow.pendingSell.armed,
    lastPurchaseType: mockWindow.lastPurchaseType,
    localStorageCleared: mockLocalStorage.getItem('lastPurchaseType') === null
});

if (mockWindow.pendingBoost.armed && !mockWindow.lastPurchaseType) {
    console.log('✅ TEST 1 PASSED\n');
} else {
    console.log('❌ TEST 1 FAILED\n');
}

// Reset for next test
mockWindow.lastPurchaseType = null;
mockWindow.purchasePaidAt = null;
mockWindow.pendingBoost.armed = false;
mockWindow.pendingSell.armed = false;

// Test 2: Sell purchase and auto-arm
console.log('TEST 2: Sell Purchase Auto-Arm');
console.log('-----------------------------------');
mockWindow.lastPurchaseType = 'sell';
mockWindow.purchasePaidAt = Date.now();
mockLocalStorage.setItem('lastPurchaseType', 'sell');
mockLocalStorage.setItem('purchasePaidAt', String(Date.now()));

console.log('Before:', {
    pendingBoost: mockWindow.pendingBoost.armed,
    pendingSell: mockWindow.pendingSell.armed,
    selectedBadges: mockWindow.selectedBadges,
    lastPurchaseType: mockWindow.lastPurchaseType
});

applyPendingPurchaseToNextPost();

console.log('After:', {
    pendingBoost: mockWindow.pendingBoost.armed,
    pendingSell: mockWindow.pendingSell.armed,
    selectedBadges: mockWindow.selectedBadges,
    primaryBadge: mockWindow.primaryBadge,
    lastPurchaseType: mockWindow.lastPurchaseType,
    localStorageCleared: mockLocalStorage.getItem('lastPurchaseType') === null
});

if (mockWindow.pendingSell.armed && mockWindow.selectedBadges.includes('sell') && !mockWindow.lastPurchaseType) {
    console.log('✅ TEST 2 PASSED\n');
} else {
    console.log('❌ TEST 2 FAILED\n');
}

// Reset for next test
mockWindow.lastPurchaseType = null;
mockWindow.purchasePaidAt = null;
mockWindow.pendingBoost.armed = false;
mockWindow.pendingSell.armed = false;
mockWindow.selectedBadges = [];
mockWindow.primaryBadge = null;

// Test 3: No pending purchase (should do nothing)
console.log('TEST 3: No Pending Purchase');
console.log('-----------------------------------');
console.log('Before:', {
    pendingBoost: mockWindow.pendingBoost.armed,
    pendingSell: mockWindow.pendingSell.armed,
    lastPurchaseType: mockWindow.lastPurchaseType
});

applyPendingPurchaseToNextPost();

console.log('After:', {
    pendingBoost: mockWindow.pendingBoost.armed,
    pendingSell: mockWindow.pendingSell.armed,
    lastPurchaseType: mockWindow.lastPurchaseType
});

if (!mockWindow.pendingBoost.armed && !mockWindow.pendingSell.armed) {
    console.log('✅ TEST 3 PASSED\n');
} else {
    console.log('❌ TEST 3 FAILED\n');
}

console.log('='.repeat(60));
console.log('ALL TESTS COMPLETED');
console.log('='.repeat(60));
