/**
 * ALIAS Human-AI Collaboration & Handoff Management Module
 * Implements Mode switching, Human Takeover, AI Return,
 * Pre-Send Review Window (Grace Period), and automatic AI takeover timers
 * with universal wall-clock countdowns and cross-tab heartbeat synchronization.
 */

const HandoffManager = {
  activeTimers: {},
  reviewTimers: {},
  _heartbeatInterval: null,

  /**
   * Universal Heartbeat Ticker:
   * Runs in all open tabs every 300ms. Computes remaining time using wall-clock
   * absolute timestamps (expiresAt) rather than fragile local setInterval counters.
   * Completely immune to tab backgrounding, throttling, page refreshes, or multi-tab drift.
   */
  initHeartbeat() {
    if (this._heartbeatInterval) return;

    this._heartbeatInterval = setInterval(() => {
      this.tickTimers();
    }, 300);
  },

  /**
   * Heartbeat Tick:
   * Checks for expired review windows or human takeover timeouts.
   */
  tickTimers() {
    if (typeof AliasState === 'undefined') return;
    const state = AliasState.get();
    if (!state || !state.conversations) return;
    const now = Date.now();

    Object.keys(state.conversations).forEach(convId => {
      const conv = state.conversations[convId];
      if (!conv) return;

      // 1. Away Mode Autonomous Auto-Send Countdown Check (noTimer must be false!)
      if (conv.pendingAutoSend && !conv.pendingAutoSend.isPaused && !conv.pendingAutoSend.noTimer) {
        const draft = conv.pendingAutoSend;
        if (!draft.expiresAt) {
          // Initialize expiresAt if missing
          draft.expiresAt = now + ((draft.remainingSeconds || 5) * 1000);
        }

        const remainingMs = draft.expiresAt - now;

        // Realistic typing state: display Messenger 3-dot bubble during final 2 seconds before auto-sending
        if (remainingMs <= 2000 && remainingMs > 0 && !draft._aiTypingActive) {
          draft._aiTypingActive = true;
          AliasState.setTyping(convId, 'ai', true);
        }

        if (now >= draft.expiresAt) {
          // Grace period elapsed! Dispatch automatically to customer
          AliasState.setTyping(convId, 'ai', false);
          this.dispatchAutoResponse(convId, true);
        }
      }

      // 2. Automatic AI Takeover Timer Check (Human mode waiting for response)
      if (conv.mode === 'human' && conv.takeoverTimerStartedAt && state.globalAiEnabled) {
        const delay = (state.takeoverDelaySeconds || 15) * 1000;
        const expiresAt = conv.takeoverTimerStartedAt + delay;
        if (now >= expiresAt) {
          this.executeAutomaticTakeover(convId);
        }
      }
    });

    // Broadcast tick event for silky-smooth in-place DOM updates (badges, progress bars)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('alias:timer_tick', { detail: { now } }));
    }
  },

  /**
   * Sets operator presence: 'present' (At Desk - Review Mode) or 'away' (Unattended)
   */
  setOperatorPresence(presence) {
    AliasState.update(state => {
      state.operatorPresence = presence;
      return state;
    });
    AliasState.addAuditLog('system', `Operator presence changed to ${presence === 'present' ? 'AT DESK (Pre-Send Review Active)' : 'AWAY (Unattended - Immediate Auto-Send Active)'}.`);
  },

  /**
   * Sets AI pre-send review delay in seconds
   */
  setReviewDelay(seconds) {
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
    AliasState.addAuditLog('system', `AI Away mode auto-send delay set to ${sec}s.`);
  },

  /**
   * Generates AI response according to active mode:
   * - At Desk: Generates draft and awaits operator approval (NO TIMER)
   * - Away: Generates draft and dispatches autonomously after natural delay (5s)
   * - Human: Does not generate AI text; waits for operator
   */
  startAutoSendReview(convId, result, customerSnippet = '') {
    if (!result || !result.responseMessage) return;

    this.cancelReviewTimer(convId);

    const state = AliasState.get();
    const conv = state.conversations[convId];
    if (!conv) return;

    const mode = conv.mode || state.operatorMode || 'at_desk';
    const now = Date.now();

    if (mode === 'at_desk') {
      // At Desk Mode: AI drafts a reply and waits indefinitely for operator approval (NO TIMER)
      const autoDraft = {
        id: 'draft-' + now,
        generatedAt: MockAIEngine.getCurrentTime(),
        customerMessageSnippet: customerSnippet || '',
        responseMessage: result.responseMessage,
        nextStepIndex: result.nextStepIndex,
        noTimer: true,
        isPaused: true,
        expiresAt: null,
        totalDelay: null,
        remainingSeconds: null,
        isEditing: false,
        editedContent: result.responseMessage.content
      };

      AliasState.update(s => {
        const c = s.conversations[convId];
        if (c) c.pendingAutoSend = autoDraft;
        return s;
      });

      AliasState.addAuditLog('ai', `AI generated draft for ${convId} (At Desk Mode: awaiting human approval without timer).`);

    } else if (mode === 'away') {
      // Away Mode: Operator is away. AI auto-replies autonomously after configured delay
      const delay = (state.aiReviewDelaySeconds !== undefined) ? state.aiReviewDelaySeconds : 15;
      const autoDraft = {
        id: 'auto-draft-' + now,
        generatedAt: MockAIEngine.getCurrentTime(),
        customerMessageSnippet: customerSnippet || '',
        responseMessage: result.responseMessage,
        nextStepIndex: result.nextStepIndex,
        noTimer: false,
        isPaused: false,
        totalDelay: delay,
        remainingSeconds: delay,
        expiresAt: now + (delay * 1000),
        isEditing: false,
        editedContent: result.responseMessage.content
      };

      AliasState.update(s => {
        const c = s.conversations[convId];
        if (c) c.pendingAutoSend = autoDraft;
        return s;
      });

      AliasState.addAuditLog('ai', `AI generated autonomous response for ${convId} (Away Mode: auto-dispatching in ${delay}s).`);

    } else {
      // Human Mode: Full manual control (AI does not generate responses)
      AliasState.update(s => {
        const c = s.conversations[convId];
        if (c) c.pendingAutoSend = null;
        return s;
      });
      AliasState.addAuditLog('human', `Customer message received in ${convId} (Human Mode: awaiting operator response).`);
    }
  },

  /**
   * Dispatches an AI response immediately without review delay
   */
  dispatchImmediate(convId, message, nextStepIndex) {
    if (!message) return;
    AliasState.update(s => {
      const c = s.conversations[convId];
      if (c) {
        c.messages.push(message);
        if (nextStepIndex !== null && nextStepIndex !== undefined) c.stepIndex = nextStepIndex;
        c.pendingAutoSend = null;
      }
      return s;
    });
    AliasState.addAuditLog('ai', `AI response for ${convId} automatically dispatched to customer (Immediate send).`);
  },

  /**
   * Cancels active review timer (legacy / cleanup helper)
   */
  cancelReviewTimer(convId) {
    if (this.reviewTimers[convId]) {
      clearInterval(this.reviewTimers[convId]);
      delete this.reviewTimers[convId];
    }
  },

  /**
   * Dispatches the AI response to customer (either on countdown expiry or manual Send Now)
   */
  dispatchAutoResponse(convId, isAutoTimeout = false) {
    this.cancelReviewTimer(convId);
    if (typeof AliasState !== 'undefined' && AliasState.setTyping) {
      AliasState.setTyping(convId, 'ai', false);
    }

    const state = AliasState.get();
    const conv = state.conversations[convId];
    if (!conv || !conv.pendingAutoSend) return;

    const draft = conv.pendingAutoSend;
    const finalMsg = draft.responseMessage;

    AliasState.update(s => {
      const c = s.conversations[convId];
      if (!c || !c.pendingAutoSend) return s;
      c.messages.push(finalMsg);
      if (draft.nextStepIndex !== null && draft.nextStepIndex !== undefined) {
        c.stepIndex = draft.nextStepIndex;
      }
      c.pendingAutoSend = null;
      return s;
    });

    if (isAutoTimeout) {
      AliasState.addAuditLog('ai', `AI response for ${convId} automatically dispatched to customer (Review timer expired without manual correction).`);
    } else {
      AliasState.addAuditLog('human', `Operator manually approved and expedited AI message in ${convId}.`);
    }
  },

  /**
   * Pauses the auto-send timer so the operator can inspect and edit the response
   */
  pauseAutoReviewForEdit(convId) {
    this.cancelReviewTimer(convId);
    if (typeof AliasState !== 'undefined' && AliasState.setTyping) {
      AliasState.setTyping(convId, 'ai', false);
    }

    AliasState.update(s => {
      const c = s.conversations[convId];
      if (c && c.pendingAutoSend) {
        const now = Date.now();
        const rem = Math.max(0, Math.ceil(((c.pendingAutoSend.expiresAt || now) - now) / 1000));
        c.pendingAutoSend.isPaused = true;
        c.pendingAutoSend.isEditing = true;
        c.pendingAutoSend.pausedRemainingSeconds = rem > 0 ? rem : (c.pendingAutoSend.remainingSeconds || 5);
        if (!c.pendingAutoSend.editedContent) {
          c.pendingAutoSend.editedContent = c.pendingAutoSend.responseMessage.content;
        }
      }
      return s;
    });

    AliasState.addAuditLog('human', `Operator paused auto-send in ${convId} to make corrections.`);
  },

  /**
   * Resumes the countdown timer
   */
  resumeAutoReview(convId) {
    this.cancelReviewTimer(convId);

    AliasState.update(s => {
      const c = s.conversations[convId];
      if (c) {
        c.mode = 'auto';
        c.handler = 'ai';
        c.status = 'AI Active';
        c.aiEnabled = true;

        if (c.pendingAutoSend) {
          c.pendingAutoSend.isPaused = false;
          c.pendingAutoSend.isEditing = false;
          const sec = c.pendingAutoSend.pausedRemainingSeconds || c.pendingAutoSend.remainingSeconds || 5;
          c.pendingAutoSend.remainingSeconds = sec;
          c.pendingAutoSend.expiresAt = Date.now() + (sec * 1000);
        }
      }
      return s;
    });

    AliasState.addAuditLog('human', `Operator resumed auto-send countdown for ${convId}.`);
  },

  /**
   * Sends the operator-modified AI message
   */
  sendEditedAutoResponse(convId, correctedText) {
    this.cancelReviewTimer(convId);

    const state = AliasState.get();
    const conv = state.conversations[convId];
    if (!conv || !conv.pendingAutoSend) return;

    const draft = conv.pendingAutoSend;
    const msg = { ...draft.responseMessage };
    msg.content = correctedText;
    msg.senderLabel = 'Human-Edited AI Response';

    AliasState.update(s => {
      const c = s.conversations[convId];
      if (!c || !c.pendingAutoSend) return s;
      c.messages.push(msg);
      if (draft.nextStepIndex !== null && draft.nextStepIndex !== undefined) {
        c.stepIndex = draft.nextStepIndex;
      }
      c.pendingAutoSend = null;
      return s;
    });

    AliasState.addAuditLog('human', `Operator corrected and dispatched AI response in ${convId}.`);
  },

  /**
   * Pauses auto-send and takes over the conversation
   */
  holdAutoResponse(convId) {
    this.cancelReviewTimer(convId);
    if (typeof AliasState !== 'undefined' && AliasState.setTyping) {
      AliasState.setTyping(convId, 'ai', false);
    }

    AliasState.update(s => {
      const c = s.conversations[convId];
      if (c && c.pendingAutoSend) {
        const now = Date.now();
        const rem = Math.max(0, Math.ceil(((c.pendingAutoSend.expiresAt || now) - now) / 1000));
        c.pendingAutoSend.isPaused = true;
        c.pendingAutoSend.pausedRemainingSeconds = rem > 0 ? rem : (c.pendingAutoSend.remainingSeconds || 5);
      }
      return s;
    });

    this.takeOver(convId);
    AliasState.addAuditLog('human', `Operator intercepted AI response and took over conversation ${convId}. Auto-send paused.`);
  },

  /**
   * Discards the pending AI auto-send draft
   */
  discardAutoResponse(convId) {
    this.cancelReviewTimer(convId);
    if (typeof AliasState !== 'undefined' && AliasState.setTyping) {
      AliasState.setTyping(convId, 'ai', false);
    }
    AliasState.update(s => {
      const c = s.conversations[convId];
      if (c) c.pendingAutoSend = null;
      return s;
    });
    AliasState.addAuditLog('human', `Operator discarded AI auto-response draft for ${convId}.`);
  },

  /**
   * Unified Mode Switcher:
   * 'at_desk' (AI drafts, no timer, awaits approval)
   * 'away' (AI auto-replies after 5s natural delay)
   * 'human' (Full manual control; AI generates nothing)
   */
  setUnifiedMode(convId, newMode) {
    AliasState.update(state => {
      state.operatorMode = newMode;
      const conv = state.conversations[convId];
      if (!conv) return state;

      conv.mode = newMode;

      if (newMode === 'at_desk') {
        conv.status = 'At Desk';
        conv.handler = 'ai';
        conv.aiEnabled = true;
        conv.takeoverTimerStartedAt = null;

        // In At Desk mode: draft sits waiting for operator approval (no timer!)
        if (conv.pendingAutoSend) {
          conv.pendingAutoSend.noTimer = true;
          conv.pendingAutoSend.isPaused = true;
          conv.pendingAutoSend.expiresAt = null;
        }
      } else if (newMode === 'away') {
        conv.status = 'Away';
        conv.handler = 'ai';
        conv.aiEnabled = true;
        conv.takeoverTimerStartedAt = null;

        // In Away mode: draft auto-sends after configured delay
        if (conv.pendingAutoSend) {
          const awayDelay = (state.aiReviewDelaySeconds !== undefined) ? state.aiReviewDelaySeconds : 15;
          conv.pendingAutoSend.noTimer = false;
          conv.pendingAutoSend.isPaused = false;
          conv.pendingAutoSend.totalDelay = awayDelay;
          conv.pendingAutoSend.remainingSeconds = awayDelay;
          conv.pendingAutoSend.expiresAt = Date.now() + (awayDelay * 1000);
        }
      } else if (newMode === 'human') {
        conv.status = 'Human';
        conv.handler = 'human';
        conv.aiEnabled = false;
        conv.takeoverTimerStartedAt = null;

        // In Human mode: clear any pending AI auto-send draft
        conv.pendingAutoSend = null;
      }

      return state;
    });

    const label = newMode === 'at_desk' ? 'AT DESK (Supervised - No Timer)' : (newMode === 'away' ? 'AWAY (Autonomous AI)' : 'HUMAN (Manual Only)');
    AliasState.addAuditLog('system', `Conversation ${convId} mode switched to ${label}.`);
  },

  /**
   * Switches operating mode for a conversation (legacy compatibility)
   */
  setMode(convId, newMode) {
    let mapped = newMode;
    if (newMode === 'auto') mapped = 'at_desk';
    else if (newMode === 'copilot') mapped = 'at_desk';
    this.setUnifiedMode(convId, mapped);
  },

  /**
   * Human operator manually takes over conversation from AI (switches to Human mode)
   */
  takeOver(convId, operatorName = 'Human Operator (Sarah K.)') {
    this.cancelTakeoverTimer(convId);
    this.setUnifiedMode(convId, 'human');
    AliasState.addAuditLog('human', `${operatorName} manually took over conversation ${convId}. Full manual control enabled.`);
  },

  /**
   * Human operator returns conversation to AI (switches to At Desk mode)
   */
  returnToAI(convId) {
    this.cancelTakeoverTimer(convId);
    this.setUnifiedMode(convId, 'at_desk');
    AliasState.addAuditLog('ai', `Control returned to AI for conversation ${convId}. At Desk supervised mode active.`);

    const curr = AliasState.get().conversations[convId];
    if (!curr || !curr.pendingAutoSend) {
      this.checkAndResumeAI(convId);
    }
  },

  /**
   * Checks if AI should respond to an unaddressed customer message after resuming
   */
  checkAndResumeAI(convId) {
    setTimeout(() => {
      const state = AliasState.get();
      const conv = state.conversations[convId];
      if (!conv || conv.mode !== 'auto' || !state.globalAiEnabled) return;

      const lastMsg = conv.messages[conv.messages.length - 1];
      if (lastMsg && lastMsg.sender === 'customer') {
        const result = MockAIEngine.processCustomerMessage(convId, lastMsg.content);
        if (result && result.responseMessage) {
          AliasState.update(s => {
            const c = s.conversations[convId];
            if (c) {
              c.messages.push(result.responseMessage);
              if (result.nextStepIndex !== null && result.nextStepIndex !== undefined) {
                c.stepIndex = result.nextStepIndex;
              }
            }
            return s;
          });
          AliasState.addAuditLog('ai', `AI resumed conversation ${convId} and answered customer query.`);
        }
      }
    }, 1000);
  },

  /**
   * Starts automatic takeover timer if message is waiting for human response
   */
  scheduleTakeoverCheck(convId) {
    const state = AliasState.get();
    const conv = state.conversations[convId];
    if (!conv) return;

    if (conv.mode === 'human' && state.globalAiEnabled) {
      AliasState.update(s => {
        const c = s.conversations[convId];
        if (c) {
          c.status = 'Waiting for Human';
          c.takeoverTimerStartedAt = Date.now();
        }
        return s;
      });
      AliasState.addAuditLog('system', `Waiting for human response in ${convId}. Automatic takeover timer started.`);
    }
  },

  /**
   * Cancels any active takeover timer for a conversation
   */
  cancelTakeoverTimer(convId) {
    if (this.activeTimers[convId]) {
      clearTimeout(this.activeTimers[convId]);
      delete this.activeTimers[convId];
    }
    AliasState.update(state => {
      const conv = state.conversations[convId];
      if (conv && conv.takeoverTimerStartedAt) {
        conv.takeoverTimerStartedAt = null;
        if (conv.status === 'Waiting for Human' || conv.status === 'Human Requested') {
          conv.status = 'Human Active';
        }
      }
      return state;
    });
  },

  /**
   * AI takes over automatically after human operator did not respond within configured waiting period
   */
  executeAutomaticTakeover(convId) {
    if (this.activeTimers[convId]) {
      clearTimeout(this.activeTimers[convId]);
      delete this.activeTimers[convId];
    }

    const state = AliasState.get();
    const conv = state.conversations[convId];
    if (!conv || conv.mode !== 'human' || !conv.takeoverTimerStartedAt) return;

    AliasState.update(s => {
      const c = s.conversations[convId];
      if (!c || c.mode !== 'human' || !c.takeoverTimerStartedAt) return s;
      c.mode = 'auto';
      c.handler = 'ai';
      c.status = 'AI Active';
      c.takeoverTimerStartedAt = null;
      return s;
    });

    AliasState.addAuditLog('ai', `Automatic AI Takeover triggered for ${convId} (Human waiting period expired).`);

    const lastMsg = conv.messages[conv.messages.length - 1];
    const customerText = (lastMsg && lastMsg.sender === 'customer') ? lastMsg.content : '';

    const takeoverNotice = {
      id: 'msg-takeover-' + Date.now(),
      sender: 'ai',
      senderLabel: 'Alias AI Assistant',
      timestamp: MockAIEngine.getCurrentTime(),
      type: 'text',
      content: "Hello! Our human team is currently assisting other accounts. I have stepped in to continue your campaign brief so we don't lose momentum.",
      status: 'delivered'
    };

    AliasState.update(s => {
      if (s.conversations[convId]) {
        s.conversations[convId].messages.push(takeoverNotice);
      }
      return s;
    });

    setTimeout(() => {
      const result = MockAIEngine.processCustomerMessage(convId, customerText);
      if (result && result.responseMessage) {
        AliasState.update(s => {
          const c = s.conversations[convId];
          if (c) {
            c.messages.push(result.responseMessage);
            if (result.nextStepIndex !== null && result.nextStepIndex !== undefined) {
              c.stepIndex = result.nextStepIndex;
            }
          }
          return s;
        });
      }
    }, 1200);
  }
};

if (typeof window !== 'undefined') {
  window.HandoffManager = HandoffManager;
  // Automatically start heartbeat in all tabs
  HandoffManager.initHeartbeat();
}
if (typeof global !== 'undefined') {
  global.HandoffManager = HandoffManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HandoffManager;
}
