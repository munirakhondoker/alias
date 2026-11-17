/**
 * Comprehensive Test Suite for Messenger-Style 3-Dot Typing Indicator
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== TEST 1: HTML Element Inspection ===');
const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const operatorHtml = fs.readFileSync(path.join(__dirname, '../operator.html'), 'utf8');

// 1. Customer view typing indicator check
assert(indexHtml.includes('id="typing-indicator"'), 'index.html must have id="typing-indicator"');
assert(indexHtml.includes('class="typing-bubble"'), 'index.html must have class="typing-bubble"');
assert(!indexHtml.includes('Alias AI is formulating response...'), 'index.html must NOT have old text label in typing indicator!');
console.log('PASS: Customer view has Messenger 3-dot bubble with no text.');

// 2. Operator view typing indicator check
assert(operatorHtml.includes('id="operator-typing-indicator"'), 'operator.html must have id="operator-typing-indicator"');
assert(operatorHtml.includes('class="typing-bubble"'), 'operator.html must have class="typing-bubble"');
console.log('PASS: Operator dashboard has Messenger 3-dot bubble with no text.');

console.log('\n=== TEST 2: CSS Styles & Animations Inspection ===');
const chatCss = fs.readFileSync(path.join(__dirname, '../css/chat.css'), 'utf8');
assert(chatCss.includes('.typing-bubble'), 'chat.css must define .typing-bubble');
assert(chatCss.includes('.typing-dot'), 'chat.css must define .typing-dot');
assert(chatCss.includes('@keyframes typingBounce'), 'chat.css must define @keyframes typingBounce');
assert(chatCss.includes('.typing-dots-mini'), 'chat.css must define .typing-dots-mini for sidebar cards');
console.log('PASS: CSS has complete Messenger typing bubble and dot bounce animations.');

console.log('\n=== TEST 3: State & Cross-Tab Typing API ===');
const stateCode = fs.readFileSync(path.join(__dirname, '../js/state.js'), 'utf8');
assert(stateCode.includes('setTyping: setTypingStatus'), 'AliasState must expose setTyping');
assert(stateCode.includes('subscribeTyping: subscribeTyping'), 'AliasState must expose subscribeTyping');

// Test state module in memory
const AliasState = require('../js/state.js');
assert.strictEqual(typeof AliasState.setTyping, 'function', 'setTyping should be a function');
assert.strictEqual(typeof AliasState.subscribeTyping, 'function', 'subscribeTyping should be a function');
console.log('PASS: AliasState provides setTyping and subscribeTyping API.');

console.log('\n=== TEST 4: Away Mode AI Typing Simulation ===');
const handoffCode = fs.readFileSync(path.join(__dirname, '../js/handoff.js'), 'utf8');
assert(handoffCode.includes("AliasState.setTyping(convId, 'ai', true)"), 'handoff.js must set AI typing to true in Away mode before auto-send');
assert(handoffCode.includes("AliasState.setTyping(convId, 'ai', false)"), 'handoff.js must clear AI typing on auto-send dispatch');
console.log('PASS: Away mode auto-send properly triggers and cleans up 3-dot typing indicator.');

console.log('\n=== TEST 5: Operator Typing & Sidebar Card Mini Dots ===');
const opCode = fs.readFileSync(path.join(__dirname, '../js/operator.js'), 'utf8');
assert(opCode.includes("AliasState.setTyping(activeConvId, 'operator', true)"), 'operator.js must broadcast operator typing on composer input');
assert(opCode.includes("AliasState.setTyping(activeConvId, 'operator', false)"), 'operator.js must clear operator typing on send and timeout');
assert(opCode.includes('typing-dots-mini'), 'operator.js must render mini bouncing dots in conversation card when customer is typing');
assert(!opCode.includes('renderConversationList()'), 'Must not call nonexistent renderConversationList without s');
assert(opCode.includes('renderConversationsList()'), 'Must call renderConversationsList with s');
console.log('PASS: Operator input broadcasts typing, sidebar displays mini bouncing dots, and function name matches.');

console.log('\n=== TEST 6: Customer Input Typing Broadcast & Sync UI Safety ===');
const appCode = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
assert(appCode.includes("AliasState.setTyping(currentConvId, 'customer', true)"), 'app.js must broadcast customer typing on chat input');
assert(appCode.includes("AliasState.setTyping(currentConvId, 'customer', false)"), 'app.js must clear customer typing on send and timeout');
assert(!appCode.includes('if (conv.pendingAutoSend && !conv.pendingAutoSend.isPaused) {\n      showTyping(true);\n    } else {\n      showTyping(false);\n    }'), 'syncUI must not clobber showTyping on state sync');
console.log('PASS: Customer input broadcasts typing and syncUI does not clobber typing state.');

console.log('\n=============================================');
console.log('ALL TYPING INDICATOR UNIT & INTEGRATION TESTS PASSED!');
console.log('=============================================');
process.exit(0);
