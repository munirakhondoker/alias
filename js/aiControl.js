/**
 * ALIAS AI Control Center & Policy Engine
 * Provides methods for global AI toggles, scheduled availability,
 * takeover delays, and Copilot draft workflows.
 */

const AIControlCenter = {
  /**
   * Toggles Master AI switch
   */
  setGlobalAI(enabled) {
    AliasState.update(state => {
      state.globalAiEnabled = enabled;
      return state;
    });
    AliasState.addAuditLog('system', `Global AI Automatic Responses set to ${enabled ? 'ENABLED' : 'DISABLED'}.`);
  },

  /**
   * Toggles Global Copilot switch
   */
  setGlobalCopilot(enabled) {
    AliasState.update(state => {
      state.globalCopilotEnabled = enabled;
      return state;
    });
    AliasState.addAuditLog('system', `Global AI Copilot Mode set to ${enabled ? 'ENABLED' : 'DISABLED'}.`);
  },

  /**
   * Toggles Scheduled AI Availability
   */
  setScheduledMode(enabled) {
    AliasState.update(state => {
      state.scheduledModeEnabled = enabled;
      return state;
    });
    AliasState.addAuditLog('system', `Scheduled AI Availability schedule ${enabled ? 'ACTIVATED' : 'DEACTIVATED'}.`);
  },

  /**
   * Sets automatic takeover delay in seconds
   */
  setTakeoverDelay(seconds) {
    AliasState.update(state => {
      state.takeoverDelaySeconds = parseInt(seconds, 10);
      return state;
    });
    const label = seconds < 60 ? `${seconds} seconds (Demo Mode)` : `${seconds / 60} minutes`;
    AliasState.addAuditLog('system', `Automatic AI Takeover waiting period configured to ${label}.`);
  },

  /**
   * Updates schedule settings
   */
  updateScheduleSettings(newSettings) {
    AliasState.update(state => {
      state.scheduleSettings = { ...state.scheduleSettings, ...newSettings };
      return state;
    });
    AliasState.addAuditLog('system', `Operating hours schedule updated.`);
  },

  /**
   * Handles Copilot Draft: Send as Generated
   */
  sendDraftAsGenerated(convId) {
    const state = AliasState.get();
    const conv = state.conversations[convId];
    if (!conv || !conv.pendingDraft) return;

    const draftText = conv.pendingDraft.text;

    const message = {
      id: 'msg-copilot-' + Date.now(),
      sender: 'ai',
      senderLabel: 'AI Draft (Operator Approved)',
      timestamp: MockAIEngine.getCurrentTime(),
      type: 'text',
      content: draftText,
      status: 'delivered'
    };

    AliasState.update(s => {
      const c = s.conversations[convId];
      c.messages.push(message);
      c.pendingDraft = null;
      return s;
    });

    AliasState.addAuditLog('human', `Operator approved and sent AI Copilot draft in ${convId}.`);
  },

  /**
   * Handles Copilot Draft: Edit and Send
   */
  sendEditedDraft(convId, editedText) {
    if (!editedText || !editedText.trim()) return;

    const message = {
      id: 'msg-edited-' + Date.now(),
      sender: 'human',
      senderLabel: 'Human-Edited AI Response',
      timestamp: MockAIEngine.getCurrentTime(),
      type: 'text',
      content: editedText.trim(),
      status: 'delivered'
    };

    AliasState.update(s => {
      const c = s.conversations[convId];
      c.messages.push(message);
      c.pendingDraft = null;
      return s;
    });

    AliasState.addAuditLog('human', `Operator modified and sent AI Copilot draft in ${convId}.`);
  },

  /**
   * Handles Copilot Draft: Regenerate
   */
  regenerateDraft(convId) {
    const state = AliasState.get();
    const conv = state.conversations[convId];
    if (!conv) return;

    const lastCustomerMsg = conv.messages.slice().reverse().find(m => m.sender === 'customer') || { content: '' };
    const newDraft = MockAIEngine.generateCopilotDraft(lastCustomerMsg, conv);
    newDraft.text = "[Regenerated Alternative] " + newDraft.text;

    AliasState.update(s => {
      s.conversations[convId].pendingDraft = newDraft;
      return s;
    });

    AliasState.addAuditLog('ai', `AI Copilot draft regenerated for ${convId}.`);
  },

  /**
   * Handles Copilot Draft: Discard
   */
  discardDraft(convId) {
    AliasState.update(s => {
      s.conversations[convId].pendingDraft = null;
      return s;
    });
    AliasState.addAuditLog('human', `Operator discarded AI Copilot draft in ${convId}.`);
  }
};

window.AIControlCenter = AIControlCenter;

