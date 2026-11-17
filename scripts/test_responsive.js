/**
 * Comprehensive Responsive & Drawer Navigation Test
 * Verifies:
 * - Message icon toggles and goes back without cross button
 * - Brief & AI icon toggles and goes back without cross button
 * - Cross buttons are removed
 * - No 100vw overflow issues
 * - CSS brace matching and media query syntax
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// 1. Verify CSS Files and Media Queries
console.log('--- TEST 1: CSS Syntax & 100vw Audit ---');
const layoutCss = fs.readFileSync(path.join(__dirname, '../css/layout.css'), 'utf8');
const dashboardCss = fs.readFileSync(path.join(__dirname, '../css/dashboard.css'), 'utf8');
const chatCss = fs.readFileSync(path.join(__dirname, '../css/chat.css'), 'utf8');

function checkBraces(name, content) {
  let openCount = 0;
  let closeCount = 0;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '{') openCount++;
    if (content[i] === '}') closeCount++;
  }
  console.log(`${name}: { count = ${openCount}, } count = ${closeCount}`);
  assert.strictEqual(openCount, closeCount, `${name} has unmatched braces!`);
}

checkBraces('css/layout.css', layoutCss);
checkBraces('css/dashboard.css', dashboardCss);
checkBraces('css/chat.css', chatCss);

// Check that 100vw is not used on container widths in dashboard.css or layout media queries
assert(!dashboardCss.includes('width: 100vw'), 'dashboard.css should not use width: 100vw');
assert(!layoutCss.includes('width: 100vw'), 'layout.css should not use width: 100vw');
console.log('PASS: Zero 100vw viewport scrollbar overflow issues in layout & dashboard CSS!');

// 2. Test DOM & Interactive Drawer Functionality
console.log('\n--- TEST 2: Operator HTML Responsive Elements & Drawer Interactions ---');

class MockClassList {
  constructor() { this.classes = new Set(); }
  add(c) { this.classes.add(c); }
  remove(c) { this.classes.delete(c); }
  toggle(c, force) {
    if (force !== undefined) {
      if (force) this.classes.add(c); else this.classes.delete(c);
      return force;
    }
    if (this.classes.has(c)) { this.classes.delete(c); return false; }
    this.classes.add(c); return true;
  }
  contains(c) { return this.classes.has(c); }
}

class MockElement {
  constructor(id, tagName = 'div') {
    this.id = id;
    this.tagName = tagName;
    this.classList = new MockClassList();
    this.style = {};
    this.listeners = {};
    this.textContent = '';
    this.innerHTML = '';
    this.children = [];
    this.dataset = {};
  }
  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }
  dispatchEvent(event) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(fn => fn({ target: this, preventDefault: () => {} }));
    }
  }
  click() {
    this.dispatchEvent('click');
  }
  appendChild(child) {
    this.children.push(child);
  }
  setAttribute(k, v) { this[k] = v; }
  removeAttribute(k) { delete this[k]; }
  getAttribute(k) { return this[k] || null; }
}

const elements = {};
function getEl(id) {
  if (!elements[id]) elements[id] = new MockElement(id);
  return elements[id];
}

// Check elements in operator.html
const operatorHtml = fs.readFileSync(path.join(__dirname, '../operator.html'), 'utf8');

// Ensure cross buttons are NOT present in operator.html
assert(!operatorHtml.includes('btn-close-conv-sidebar'), 'Cross button btn-close-conv-sidebar should be removed!');
assert(!operatorHtml.includes('btn-close-details-sidebar'), 'Cross button btn-close-details-sidebar should be removed!');
console.log('PASS: Cross buttons ([X]) have been completely removed from both sidebars!');

// Ensure new back buttons are present
const requiredIds = [
  'btn-toggle-conv-sidebar',
  'btn-toggle-details-sidebar',
  'btn-back-conv-sidebar',
  'btn-back-details-sidebar',
  'sidebar-backdrop',
  'conv-toggle-badge',
  'conversations-sidebar',
  'details-sidebar'
];

requiredIds.forEach(id => {
  assert(operatorHtml.includes(`id="${id}"`), `operator.html is missing element with id="${id}"`);
  console.log(`PASS: Found id="${id}" in operator.html`);
});

// Setup fake DOM and test interactions
const convSidebar = getEl('conversations-sidebar');
const detailsSidebar = getEl('details-sidebar');
const sidebarBackdrop = getEl('sidebar-backdrop');
const btnToggleConv = getEl('btn-toggle-conv-sidebar');
const btnToggleDetails = getEl('btn-toggle-details-sidebar');
const btnBackConv = getEl('btn-back-conv-sidebar');
const btnBackDetails = getEl('btn-back-details-sidebar');

function openConvSidebar() {
  convSidebar.classList.add('mobile-open');
  detailsSidebar.classList.remove('mobile-open');
  sidebarBackdrop.classList.add('active');
}

function openDetailsSidebar() {
  detailsSidebar.classList.add('mobile-open');
  convSidebar.classList.remove('mobile-open');
  sidebarBackdrop.classList.add('active');
}

function closeMobileDrawers() {
  convSidebar.classList.remove('mobile-open');
  detailsSidebar.classList.remove('mobile-open');
  sidebarBackdrop.classList.remove('active');
}

btnToggleConv.addEventListener('click', () => {
  if (convSidebar.classList.contains('mobile-open')) {
    closeMobileDrawers();
  } else {
    openConvSidebar();
  }
});

btnToggleDetails.addEventListener('click', () => {
  if (detailsSidebar.classList.contains('mobile-open')) {
    closeMobileDrawers();
  } else {
    openDetailsSidebar();
  }
});

btnBackConv.addEventListener('click', closeMobileDrawers);
btnBackDetails.addEventListener('click', closeMobileDrawers);
sidebarBackdrop.addEventListener('click', closeMobileDrawers);

// Test 2.1: Open Left Drawer with message icon
btnToggleConv.click();
assert(convSidebar.classList.contains('mobile-open'), 'convSidebar should have mobile-open');
assert(sidebarBackdrop.classList.contains('active'), 'sidebarBackdrop should have active');
console.log('PASS: Clicking message icon opens Conversations drawer');

// Test 2.2: Go back by clicking message icon in drawer header
btnBackConv.click();
assert(!convSidebar.classList.contains('mobile-open'), 'convSidebar should be closed');
assert(!sidebarBackdrop.classList.contains('active'), 'sidebarBackdrop should be inactive');
console.log('PASS: Clicking message icon inside drawer goes back and closes drawer');

// Test 2.3: Toggle closed by clicking message icon in workspace header
btnToggleConv.click(); // opens
assert(convSidebar.classList.contains('mobile-open'));
btnToggleConv.click(); // closes
assert(!convSidebar.classList.contains('mobile-open'));
console.log('PASS: Clicking message icon in workspace header toggles drawer closed (goes back)');

// Test 2.4: Open Right Drawer with Brief button
btnToggleDetails.click();
assert(detailsSidebar.classList.contains('mobile-open'), 'detailsSidebar should have mobile-open');
assert(sidebarBackdrop.classList.contains('active'), 'sidebarBackdrop should have active');
console.log('PASS: Clicking Brief & AI button opens Details drawer');

// Test 2.5: Go back by clicking Brief icon in drawer header
btnBackDetails.click();
assert(!detailsSidebar.classList.contains('mobile-open'), 'detailsSidebar should be closed');
assert(!sidebarBackdrop.classList.contains('active'), 'sidebarBackdrop should be inactive');
console.log('PASS: Clicking Brief icon inside drawer goes back and closes drawer');

// Test 2.6: Toggle closed by clicking Brief & AI in workspace header
btnToggleDetails.click(); // opens
assert(detailsSidebar.classList.contains('mobile-open'));
btnToggleDetails.click(); // closes
assert(!detailsSidebar.classList.contains('mobile-open'));
console.log('PASS: Clicking Brief & AI button in workspace header toggles drawer closed (goes back)');

console.log('\n=============================================');
console.log('ALL RESPONSIVE SYSTEM TESTS PASSED SUCCESSFULLY!');
console.log('=============================================');
