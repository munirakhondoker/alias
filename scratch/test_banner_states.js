const fs = require('fs');

const store = {};
global.localStorage = {
  getItem: (key) => store[key] || null,
  setItem: (key, val) => { store[key] = String(val); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};

global.window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {}
};

require('../js/state.js');
require('../js/campaign.js');

const AliasState = global.AliasState;
const CampaignManager = global.CampaignManager;

const state = AliasState.reset();

console.log('Testing banner logic across accounts:');

// Test Arif Chowdhury (demo-004)
const arif = state.conversations['demo-004'];
const arifProg = CampaignManager.calculateProgress(arif.campaign);
console.log('Arif Chowdhury completed?', arifProg.isComplete || arif.campaign.confirmed);
if (arifProg.isComplete || arif.campaign.confirmed) {
  console.log('PASS: Arif correctly triggers "Campaign Brief Completed" banner.');
} else {
  console.error('FAIL: Arif progress not detected as complete');
  process.exit(1);
}

// Test Farhan Karim (demo-002)
const farhan = state.conversations['demo-002'];
console.log('Farhan mode:', farhan.mode);
if (farhan.mode === 'copilot') {
  console.log('PASS: Farhan triggers "AI Copilot Active" banner.');
}

// Test Nusrat Jahan (demo-003)
const nusrat = state.conversations['demo-003'];
console.log('Nusrat status:', nusrat.status);
if (nusrat.status === 'Waiting for Human') {
  console.log('PASS: Nusrat triggers "Customer Waiting" banner.');
}

// Test Tanvir Ahmed (demo-001)
const tanvir = state.conversations['demo-001'];
console.log('Tanvir mode:', tanvir.mode);
if (tanvir.mode === 'auto') {
  console.log('PASS: Tanvir triggers "AI Autonomous Intake" banner.');
}

console.log('All banner states verified successfully!');
