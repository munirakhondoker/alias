const fs = require('fs');

let code = fs.readFileSync('js/handoff.js', 'utf8');

// 1. In setReviewDelay
code = code.replace(
  `  setReviewDelay(seconds) {
    const sec = parseInt(seconds, 10);
    AliasState.update(state => {
      state.aiReviewDelaySeconds = sec;
      return state;
    });
    AliasState.addAuditLog('system', \`AI pre-send review window set to \${sec > 0 ? sec + ' seconds' : 'Disabled (Instant Auto-Send)'}.\`);
  },`,
  `  setReviewDelay(seconds) {
    const sec = parseInt(seconds, 10) || 15;
    AliasState.update(state => {
      state.aiReviewDelaySeconds = sec;
      // If any active Away mode draft is running, dynamically update its countdown
      Object.keys(state.conversations || {}).forEach(cid => {
        const c = state.conversations[cid];
        if (c && c.mode === 'away' && c.pendingAutoSend && !c.pendingAutoSend.noTimer && !c.pendingAutoSend.isPaused) {
          c.pendingAutoSend.totalDelay = sec;
          c.pendingAutoSend.remainingSeconds = sec;
          c.pendingAutoSend.expiresAt = Date.now() + (sec * 1000);
        }
      });
      return state;
    });
    AliasState.addAuditLog('system', \`AI Away mode auto-send delay set to \${sec}s.\`);
  },`
);

// 2. In startAutoSendReview
code = code.replace(
  `    } else if (mode === 'away') {
      // Away Mode: Operator is away. AI auto-replies autonomously after a natural delay (5s)
      const delay = 5;`,
  `    } else if (mode === 'away') {
      // Away Mode: Operator is away. AI auto-replies autonomously after configured delay
      const delay = (state.aiReviewDelaySeconds !== undefined) ? state.aiReviewDelaySeconds : 15;`
);

// 3. In setUnifiedMode away branch
code = code.replace(
  `        // In Away mode: draft auto-sends after 5s natural delay
        if (conv.pendingAutoSend) {
          conv.pendingAutoSend.noTimer = false;
          conv.pendingAutoSend.isPaused = false;
          conv.pendingAutoSend.totalDelay = 5;
          conv.pendingAutoSend.remainingSeconds = 5;
          conv.pendingAutoSend.expiresAt = Date.now() + 5000;
        }`,
  `        // In Away mode: draft auto-sends after configured delay
        if (conv.pendingAutoSend) {
          const awayDelay = (state.aiReviewDelaySeconds !== undefined) ? state.aiReviewDelaySeconds : 15;
          conv.pendingAutoSend.noTimer = false;
          conv.pendingAutoSend.isPaused = false;
          conv.pendingAutoSend.totalDelay = awayDelay;
          conv.pendingAutoSend.remainingSeconds = awayDelay;
          conv.pendingAutoSend.expiresAt = Date.now() + (awayDelay * 1000);
        }`
);

fs.writeFileSync('js/handoff.js', code, 'utf8');
console.log('Successfully updated js/handoff.js');
