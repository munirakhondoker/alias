// Test multi-customer switching & bidirectional interaction in Node.js

// Mock browser globals
class MockLocalStorage {
  constructor() { this.store = {}; }
  getItem(k) { return this.store[k] || null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
}

global.localStorage = new MockLocalStorage();
global.window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.CustomEvent = class CustomEvent { constructor(type, detail) { this.type = type; this.detail = detail; } };

const fs = require('fs');
const path = require('path');

// Evaluate state, campaign, mockAI, handoff, aiControl
eval(fs.readFileSync(path.join(__dirname, '../js/state.js'), 'utf8'));
global.AliasState = global.window.AliasState;
eval(fs.readFileSync(path.join(__dirname, '../js/campaign.js'), 'utf8'));
global.CampaignManager = global.window.CampaignManager;
eval(fs.readFileSync(path.join(__dirname, '../js/mockAI.js'), 'utf8'));
global.MockAIEngine = global.window.MockAIEngine;
eval(fs.readFileSync(path.join(__dirname, '../js/handoff.js'), 'utf8'));
global.HandoffManager = global.window.HandoffManager;
eval(fs.readFileSync(path.join(__dirname, '../js/aiControl.js'), 'utf8'));
global.AIControlCenter = global.window.AIControlCenter;

console.log("=== Testing 4 Customers in State ===");
const state = AliasState.get();
const convKeys = Object.keys(state.conversations);
console.log("Found conversations:", convKeys);
if (convKeys.length !== 4) {
  console.error("FAIL: Expected 4 conversations, got", convKeys.length);
  process.exit(1);
}

convKeys.forEach(id => {
  const c = state.conversations[id];
  console.log(`- ${id}: ${c.customerName} (${c.businessName}), Mode: ${c.mode}, Status: ${c.status}`);
});

console.log("\n=== Testing Customer 2 (Farhan Karim - Copilot Mode) ===");
const farhanMsg = {
  id: 'msg-cust-test-1',
  sender: 'customer',
  senderLabel: 'Farhan Karim',
  timestamp: '10:45 AM',
  type: 'text',
  content: 'What is the optimal video duration for LinkedIn ads?',
  status: 'sent'
};
AliasState.update(s => {
  s.conversations['demo-002'].messages.push(farhanMsg);
  return s;
});
const draft = MockAIEngine.generateCopilotDraft(farhanMsg, AliasState.get().conversations['demo-002']);
console.log("Copilot generated draft:", draft.text);
AliasState.update(s => {
  s.conversations['demo-002'].pendingDraft = draft;
  return s;
});

// Operator approves draft
AIControlCenter.sendDraftAsGenerated('demo-002');
const updatedFarhan = AliasState.get().conversations['demo-002'];
console.log("Farhan messages count after operator approval:", updatedFarhan.messages.length);
console.log("Last message content:", updatedFarhan.messages[updatedFarhan.messages.length - 1].content);
if (!updatedFarhan.messages[updatedFarhan.messages.length - 1].content.includes('days')) {
  console.error("FAIL: Expected approved draft message in Farhan's chat");
  process.exit(1);
}

console.log("\n=== Testing Customer 3 (Nusrat Jahan - Human Mode) ===");
const nusratMsg = {
  id: 'msg-cust-test-2',
  sender: 'customer',
  senderLabel: 'Nusrat Jahan',
  timestamp: '10:46 AM',
  type: 'text',
  content: 'Can someone check my budget?',
  status: 'sent'
};
AliasState.update(s => {
  s.conversations['demo-003'].messages.push(nusratMsg);
  s.conversations['demo-003'].unreadCount = 1;
  return s;
});

// Operator sends manual reply
const opMsg = {
  id: 'msg-op-test',
  sender: 'human',
  senderLabel: 'Human Operator (Sarah K.)',
  timestamp: '10:47 AM',
  type: 'text',
  content: 'Hello Nusrat! 60,000 BDT for 15 days is well positioned to get 12,000+ targeted views in Dhaka and Sylhet.',
  status: 'delivered'
};
AliasState.update(s => {
  s.conversations['demo-003'].messages.push(opMsg);
  s.conversations['demo-003'].status = 'Human Active';
  s.conversations['demo-003'].unreadCount = 0;
  return s;
});
const updatedNusrat = AliasState.get().conversations['demo-003'];
console.log("Nusrat status now:", updatedNusrat.status);
console.log("Nusrat messages count:", updatedNusrat.messages.length);
if (updatedNusrat.status !== 'Human Active') {
  console.error("FAIL: Expected Human Active status for Nusrat");
  process.exit(1);
}

console.log("\n=== Testing Customer 4 (Arif Chowdhury - Completed Brief) ===");
const arif = AliasState.get().conversations['demo-004'];
const arifProg = CampaignManager.calculateProgress(arif.campaign);
console.log(`Arif Campaign Progress: ${arifProg.percentage}%, Confirmed: ${arif.campaign.confirmed}`);
if (!arif.campaign.confirmed || arifProg.percentage !== 100) {
  console.error("FAIL: Expected Arif to have 100% completed brief");
  process.exit(1);
}

console.log("\n=== ALL LOGIC TESTS PASSED SUCCESSFULLY! ===");
