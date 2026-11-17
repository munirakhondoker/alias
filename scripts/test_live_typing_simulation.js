/**
 * End-to-end multi-tab typing simulation
 */
const assert = require('assert');

// Polyfill BroadcastChannel and localStorage
class MockBroadcastChannel {
  constructor(name) {
    this.name = name;
    if (!MockBroadcastChannel.channels[name]) {
      MockBroadcastChannel.channels[name] = new Set();
    }
    MockBroadcastChannel.channels[name].add(this);
    this.listeners = [];
  }
  postMessage(data) {
    const list = MockBroadcastChannel.channels[this.name] || [];
    list.forEach(ch => {
      if (ch !== this) {
        ch.listeners.forEach(fn => fn({ data }));
      }
    });
  }
  addEventListener(evt, fn) {
    if (evt === 'message') this.listeners.push(fn);
  }
  removeEventListener(evt, fn) {
    this.listeners = this.listeners.filter(f => f !== fn);
  }
}
MockBroadcastChannel.channels = {};
global.BroadcastChannel = MockBroadcastChannel;

const storageStore = {};
global.localStorage = {
  getItem: (k) => storageStore[k] || null,
  setItem: (k, v) => { storageStore[k] = String(v); },
  removeItem: (k) => { delete storageStore[k]; }
};

class MockCustomEvent {
  constructor(name, opts) {
    this.type = name;
    this.detail = opts ? opts.detail : null;
  }
}
global.CustomEvent = MockCustomEvent;

const windowListeners = {};
global.window = {
  addEventListener: (name, fn) => {
    if (!windowListeners[name]) windowListeners[name] = [];
    windowListeners[name].push(fn);
  },
  removeEventListener: (name, fn) => {
    if (windowListeners[name]) {
      windowListeners[name] = windowListeners[name].filter(f => f !== fn);
    }
  },
  dispatchEvent: (evt) => {
    const list = windowListeners[evt.type] || [];
    list.forEach(fn => fn(evt));
  }
};

const AliasState = require('../js/state.js');

console.log('--- TEST: Cross-tab typing broadcast via BroadcastChannel ---');

let receivedByTab2 = null;
const unsubTab2 = AliasState.subscribeTyping(payload => {
  receivedByTab2 = payload;
});

// Tab 1 broadcasts typing
AliasState.setTyping('demo-001', 'customer', true);

assert(receivedByTab2 !== null, 'Tab 2 should receive typing event');
assert.strictEqual(receivedByTab2.convId, 'demo-001');
assert.strictEqual(receivedByTab2.role, 'customer');
assert.strictEqual(receivedByTab2.isTyping, true);
console.log('PASS: Tab 2 received customer typing = true');

// Tab 1 stops typing
AliasState.setTyping('demo-001', 'customer', false);
assert.strictEqual(receivedByTab2.isTyping, false);
console.log('PASS: Tab 2 received customer typing = false');

// Tab 2 broadcasts operator typing
let receivedByTab1 = null;
const unsubTab1 = AliasState.subscribeTyping(payload => {
  if (payload.role === 'operator') receivedByTab1 = payload;
});

AliasState.setTyping('demo-001', 'operator', true);
assert(receivedByTab1 !== null, 'Tab 1 should receive operator typing event');
assert.strictEqual(receivedByTab1.role, 'operator');
assert.strictEqual(receivedByTab1.isTyping, true);
console.log('PASS: Tab 1 received operator typing = true');

AliasState.setTyping('demo-001', 'operator', false);
assert.strictEqual(receivedByTab1.isTyping, false);
console.log('PASS: Tab 1 received operator typing = false');

console.log('ALL CROSS-TAB TYPING SIMULATION CHECKS PASSED!');
process.exit(0);
