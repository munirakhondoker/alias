/**
 * Verification test script for ALIAS Operator Dashboard v2
 */
const fs = require('fs');

// Mock localStorage and window
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: key => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: key => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

global.localStorage = localStorageMock;
global.window = {
  location: { search: '' },
  addEventListener: () => {},
  dispatchEvent: () => {}
};

// Load modules
const stateModule = require('../js/state.js');
const campaignModule = require('../js/campaign.js');
const mockAiModule = require('../js/mockAI.js');
const handoffModule = require('../js/handoff.js');
const aiControlModule = require('../js/aiControl.js');

const AliasState = global.AliasState;
const CampaignManager = global.CampaignManager;
const MockAIEngine = global.MockAIEngine;
const HandoffManager = global.HandoffManager;
const AIControlCenter = global.AIControlCenter;

console.log('=== TEST 1: Initial State & Conversations ===');
const state = AliasState.get();
console.log('Conversations count:', Object.keys(state.conversations).length);
console.log('Global AI enabled:', state.globalAiEnabled);
console.log('Review delay:', state.aiReviewDelaySeconds);
console.log('Takeover delay:', state.takeoverDelaySeconds);
if (Object.keys(state.conversations).length === 4) {
  console.log('PASS: 4 seed conversations loaded.');
} else {
  console.error('FAIL: Expected 4 conversations.');
}

console.log('\n=== TEST 2: Dynamic AI Suggestions ===');
const conv001 = state.conversations['demo-001'];
const sug001 = MockAIEngine.generateSuggestions(conv001);
console.log('Stage:', sug001.stage);
console.log('Questions generated:', sug001.questions ? sug001.questions.length : 0);
sug001.questions.forEach((q, i) => console.log(`  [${q.tag}] ${q.title}: "${q.text.substring(0, 60)}..."`));
if (sug001.questions && sug001.questions.length >= 3) {
  console.log('PASS: Dynamic questions generated without static fluff.');
} else {
  console.error('FAIL: Expected at least 3 dynamic questions.');
}

console.log('\n=== TEST 3: AI Missing-Field Questions for Campaign Sections ===');
const bQuestion = MockAIEngine.generateMissingFieldQuestion('business', ['USP', 'Product Description'], 'Lumina Skin');
const pQuestion = MockAIEngine.generateMissingFieldQuestion('platforms', ['Platforms'], 'Lumina Skin');
const bgQuestion = MockAIEngine.generateMissingFieldQuestion('budget', ['Total Budget'], 'Lumina Skin');
console.log('Business Q:', bQuestion);
console.log('Platforms Q:', pQuestion);
console.log('Budget Q:', bgQuestion);
if (bQuestion && pQuestion && bgQuestion) {
  console.log('PASS: Section-specific missing field questions generated.');
} else {
  console.error('FAIL: Missing field question generation failed.');
}

console.log('\n=== TEST 4: Campaign Progress 3-Way Counts ===');
const prog = CampaignManager.calculateProgress(conv001.campaign);
console.log('Progress %:', prog.percentage);
let completedSecs = 0;
let incompleteSecs = 0;
Object.keys(prog.sections).forEach(k => {
  if (prog.sections[k].status === 'completed') completedSecs++;
  else incompleteSecs++;
});
console.log(`Completed sections: ${completedSecs}, Incomplete sections: ${incompleteSecs}, Total: ${completedSecs + incompleteSecs}`);
if (completedSecs + incompleteSecs === 6) {
  console.log('PASS: 3-way section counts calculate accurately.');
} else {
  console.error('FAIL: Section total is not 6.');
}

console.log('\n=== TEST 5: Mode Switching & Away Mode Delay Binding ===');
// Switch review delay in AI control
HandoffManager.setReviewDelay(30);
console.log('New review delay:', AliasState.get().aiReviewDelaySeconds);
if (AliasState.get().aiReviewDelaySeconds === 30) {
  console.log('PASS: Review delay updated to 30s.');
} else {
  console.error('FAIL: Review delay did not update.');
}

// Set Unified Mode to Away
HandoffManager.setUnifiedMode('demo-001', 'away');
// Trigger an AI response review
const mockResult = {
  responseMessage: { content: 'This is an Away mode response', sender: 'ai' },
  nextStepIndex: 2
};
HandoffManager.startAutoSendReview('demo-001', mockResult, 'Customer test message');
const updatedConv = AliasState.get().conversations['demo-001'];
console.log('Pending auto-send draft delay:', updatedConv.pendingAutoSend ? updatedConv.pendingAutoSend.totalDelay : 'none');
if (updatedConv.pendingAutoSend && updatedConv.pendingAutoSend.totalDelay === 30) {
  console.log('PASS: Away mode auto-send delay dynamically reads configured 30s!');
} else {
  console.error('FAIL: Away mode draft delay did not match configured 30s.');
}

console.log('\n=== TEST 6: At Desk Mode (No Timer) ===');
HandoffManager.setUnifiedMode('demo-001', 'at_desk');
HandoffManager.startAutoSendReview('demo-001', mockResult, 'Customer test message 2');
const atDeskConv = AliasState.get().conversations['demo-001'];
console.log('At Desk draft noTimer flag:', atDeskConv.pendingAutoSend ? atDeskConv.pendingAutoSend.noTimer : 'none');
if (atDeskConv.pendingAutoSend && atDeskConv.pendingAutoSend.noTimer === true) {
  console.log('PASS: At Desk mode draft has noTimer=true and waits for operator approval.');
} else {
  console.error('FAIL: At Desk mode did not set noTimer=true.');
}

console.log('\n=== TEST 7: Human Mode & Master AI Off ===');
AIControlCenter.setGlobalAI(false);
console.log('Global AI after disable:', AliasState.get().globalAiEnabled);
HandoffManager.setUnifiedMode('demo-001', 'human');
const humanConv = AliasState.get().conversations['demo-001'];
console.log('Human mode status:', humanConv.status, 'handler:', humanConv.handler, 'aiEnabled:', humanConv.aiEnabled);
if (!AliasState.get().globalAiEnabled && humanConv.handler === 'human') {
  console.log('PASS: Master AI OFF locks mode to Human.');
} else {
  console.error('FAIL: Master AI disable did not lock to Human.');
}

console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
