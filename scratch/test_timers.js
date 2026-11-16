/**
 * Verification test for ALIAS timer and handoff logic
 */
const fs = require('fs');
const path = require('path');

// Mock localStorage and window
const store = {};
global.localStorage = {
  getItem: (key) => store[key] || null,
  setItem: (key, val) => { store[key] = String(val); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};

global.window = {
  dispatchEvent: (event) => {},
  addEventListener: (name, cb) => {},
  removeEventListener: (name, cb) => {}
};
global.CustomEvent = class CustomEvent {
  constructor(name, opts) {
    this.name = name;
    this.detail = opts ? opts.detail : null;
  }
};

// Load modules
require('../js/state.js');
require('../js/mockAI.js');
require('../js/handoff.js');

const AliasState = global.window.AliasState;
const HandoffManager = global.window.HandoffManager;

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL: ' + message);
    process.exit(1);
  }
  console.log('PASS: ' + message);
}

console.log('--- Testing Timer System ---');

// 1. Reset state
AliasState.reset();
const initial = AliasState.get();
assert(initial.conversations['demo-001'] !== undefined, 'Initial state loaded');

// 2. Start pre-send review
const mockResult = {
  responseMessage: {
    id: 'test-msg-1',
    sender: 'ai',
    senderLabel: 'Alias AI Assistant',
    timestamp: '11:00 PM',
    type: 'text',
    content: 'Test AI response message'
  },
  nextStepIndex: 1
};

HandoffManager.startAutoSendReview('demo-001', mockResult, 'Customer input');
let state = AliasState.get();
let conv = state.conversations['demo-001'];
assert(conv.pendingAutoSend !== null, 'pendingAutoSend is populated');
assert(conv.pendingAutoSend.isPaused === false, 'draft is not paused');
assert(conv.pendingAutoSend.expiresAt > Date.now(), 'expiresAt is in future');
assert(conv.pendingAutoSend.totalDelay === 15, 'totalDelay is 15s');

// 3. Pause & Take Over
HandoffManager.holdAutoResponse('demo-001');
state = AliasState.get();
conv = state.conversations['demo-001'];
assert(conv.mode === 'human', 'Conversation mode switched to human');
assert(conv.pendingAutoSend.isPaused === true, 'draft is marked isPaused = true');
assert(conv.pendingAutoSend.pausedRemainingSeconds > 0, 'pausedRemainingSeconds preserved');
console.log('Paused remaining seconds:', conv.pendingAutoSend.pausedRemainingSeconds);

// 4. Resume Auto-Send
HandoffManager.resumeAutoReview('demo-001');
state = AliasState.get();
conv = state.conversations['demo-001'];
assert(conv.mode === 'auto', 'Conversation mode returned to auto');
assert(conv.pendingAutoSend.isPaused === false, 'draft is unpaused');
assert(conv.pendingAutoSend.expiresAt > Date.now(), 'draft expiresAt re-established');

// 5. Test tick auto-dispatch when expiresAt has passed
conv.pendingAutoSend.expiresAt = Date.now() - 500;
AliasState.save(state);

HandoffManager.tickTimers();
state = AliasState.get();
conv = state.conversations['demo-001'];
assert(conv.pendingAutoSend === null, 'draft auto-dispatched and cleared');
const lastMsg = conv.messages[conv.messages.length - 1];
assert(lastMsg.content === 'Test AI response message', 'response message appended to conversation messages');

// 6. Test Edit & Send Corrected
HandoffManager.startAutoSendReview('demo-001', mockResult, 'Second customer message');
HandoffManager.pauseAutoReviewForEdit('demo-001');
state = AliasState.get();
conv = state.conversations['demo-001'];
assert(conv.pendingAutoSend.isPaused === true, 'Paused for edit');
assert(conv.pendingAutoSend.isEditing === true, 'isEditing is true');

HandoffManager.sendEditedAutoResponse('demo-001', 'Edited response by human');
state = AliasState.get();
conv = state.conversations['demo-001'];
assert(conv.pendingAutoSend === null, 'Edited response cleared draft');
const editedMsg = conv.messages[conv.messages.length - 1];
assert(editedMsg.content === 'Edited response by human', 'Edited response delivered to customer');
assert(editedMsg.senderLabel === 'Human-Edited AI Response', 'Correct label applied');

// 7. Test automatic takeover timer in human mode
conv.mode = 'human';
AliasState.save(state);
HandoffManager.scheduleTakeoverCheck('demo-001');
state = AliasState.get();
conv = state.conversations['demo-001'];
assert(conv.status === 'Waiting for Human', 'Conversation status Waiting for Human');
assert(conv.takeoverTimerStartedAt > 0, 'takeoverTimerStartedAt is set');

// Simulate timeout expiration
conv.takeoverTimerStartedAt = Date.now() - 20000;
AliasState.save(state);

HandoffManager.tickTimers();
state = AliasState.get();
conv = state.conversations['demo-001'];
assert(conv.mode === 'auto', 'AI automatically took over');
assert(conv.status === 'AI Active', 'Status switched back to AI Active');
assert(conv.takeoverTimerStartedAt === null, 'takeoverTimerStartedAt cleared');

console.log('ALL TIMER & HANDOFF TESTS PASSED SUCCESSFULLY!');
