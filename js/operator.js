/**
 * ALIAS Human Operator Dashboard Controller (operator.html)
 * Manages 3-panel workspace, conversation switching, master AI switch,
 * 3 operating modes (At Desk, Away, Human), docked composer AI drafts,
 * dynamic AI suggestion cards, 3-way campaign brief filtering with
 * AI missing-field questions, and functional timers.
 */

document.addEventListener('DOMContentLoaded', () => {
  function resolveOperatorConvId() {
    const urlParams = new URLSearchParams(window.location.search);
    const convParam = urlParams.get('conv');
    const validIds = ['demo-001', 'demo-002', 'demo-003', 'demo-004'];
    if (convParam && validIds.includes(convParam)) {
      return convParam;
    }
    const stored = localStorage.getItem('alias_operator_active_conv');
    if (stored && validIds.includes(stored)) {
      return stored;
    }
    return 'demo-001';
  }

  let activeConvId = resolveOperatorConvId();
  let currentFilter = 'all';
  let searchQuery = '';
  let currentBriefFilter = 'all'; // 'all' | 'completed' | 'incomplete'

  // Popstate listener for back/forward navigation
  window.addEventListener('popstate', () => {
    const target = resolveOperatorConvId();
    if (target !== activeConvId) {
      activeConvId = target;
      renderUI();
    }
  });

  // DOM Elements - Left Sidebar
  const convListContainer = document.getElementById('conv-list-container');
  const searchInput = document.getElementById('operator-search');
  const filterChips = document.querySelectorAll('.filter-chip');

  // DOM Elements - Center Workspace Header
  const wsCustomerName = document.getElementById('ws-customer-name');
  const wsBusinessName = document.getElementById('ws-business-name');
  const wsCustomerAvatar = document.getElementById('ws-customer-avatar');
  const wsOpenCustomerView = document.getElementById('ws-open-customer-view');
  const navLinkCustomer = document.getElementById('nav-link-customer');

  // Master AI Switch & Mode Controls
  const masterAiToggle = document.getElementById('master-ai-toggle');
  const masterAiLabel = document.getElementById('master-ai-label');
  const modeBtnAtDesk = document.getElementById('mode-btn-at-desk');
  const modeBtnAway = document.getElementById('mode-btn-away');

  // Workspace Banner & Timeline
  const wsBanner = document.getElementById('ws-banner');
  const wsBannerText = document.getElementById('ws-banner-text');
  const wsBannerAction = document.getElementById('ws-banner-action');
  const wsChatMessages = document.getElementById('ws-chat-messages');
  const operatorTypingIndicator = document.getElementById('operator-typing-indicator');
  const operatorTypingAvatar = document.getElementById('operator-typing-avatar');
  const wsTypingPill = document.getElementById('ws-typing-pill');

  // Customer Typing Tracking
  const activeTypingConversations = new Set();
  const customerTypingTimers = {};

  function showCustomerTyping(show) {
    const state = AliasState.get();
    const conv = state && state.conversations ? state.conversations[activeConvId] : null;

    if (operatorTypingAvatar && conv && conv.customerName) {
      const initials = conv.customerName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      operatorTypingAvatar.textContent = initials;
    }

    if (operatorTypingIndicator) {
      operatorTypingIndicator.style.display = show ? 'flex' : 'none';
      if (show && wsChatMessages) {
        wsChatMessages.scrollTop = wsChatMessages.scrollHeight;
      }
    }

    if (wsTypingPill) {
      if (show) {
        wsTypingPill.style.display = 'inline-flex';
        wsTypingPill.textContent = 'typing...';
      } else if (activeTypingConversations.size > 0) {
        const otherId = Array.from(activeTypingConversations)[0];
        const otherConv = state && state.conversations ? state.conversations[otherId] : null;
        if (otherConv) {
          wsTypingPill.style.display = 'inline-flex';
          wsTypingPill.textContent = `${otherConv.customerName} typing...`;
        } else {
          wsTypingPill.style.display = 'none';
        }
      } else {
        wsTypingPill.style.display = 'none';
      }
    }
  }

  // Docked Composer AI Draft Toolbar
  const composerDraftToolbar = document.getElementById('composer-draft-toolbar');
  const composerDraftBadge = document.getElementById('composer-draft-badge');
  const composerDraftStatus = document.getElementById('composer-draft-status');
  const btnComposerDraftDiscard = document.getElementById('btn-composer-draft-discard');
  const btnComposerDraftRegen = document.getElementById('btn-composer-draft-regen');
  const btnComposerDraftHold = document.getElementById('btn-composer-draft-hold');
  const btnComposerDraftSend = document.getElementById('btn-composer-draft-send');

  // Composer Input & Attachments
  const composerInput = document.getElementById('operator-composer-input');
  const btnOperatorSend = document.getElementById('btn-operator-send');
  const btnOperatorAttach = document.getElementById('btn-operator-attach');
  const operatorFileInput = document.getElementById('operator-file-input');
  const operatorAttachmentPreviewContainer = document.getElementById('operator-attachment-preview-container');
  let operatorAttachedFiles = [];

  // Right Panel Tabs
  const tabBtnCampaign = document.getElementById('tab-btn-campaign');
  const tabBtnSuggestions = document.getElementById('tab-btn-suggestions');
  const tabBtnAIControl = document.getElementById('tab-btn-aicontrol');
  const panelCampaign = document.getElementById('panel-campaign');
  const panelSuggestions = document.getElementById('panel-suggestions');
  const panelAIControl = document.getElementById('panel-aicontrol');

  // Campaign Brief Progress & 3-Way Filter Elements
  const campaignProgressBar = document.getElementById('operator-progress-bar');
  const campaignProgressPercent = document.getElementById('operator-progress-percent');
  const briefFilterAll = document.getElementById('brief-filter-all');
  const briefFilterCompleted = document.getElementById('brief-filter-completed');
  const briefFilterIncomplete = document.getElementById('brief-filter-incomplete');
  const briefCountCompleted = document.getElementById('brief-count-completed');
  const briefCountIncomplete = document.getElementById('brief-count-incomplete');
  const campaignSectionsContainer = document.getElementById('campaign-sections-container');
  const btnOpenBriefModal = document.getElementById('btn-open-brief-modal');

  // AI Suggestions Container
  const suggestionsContainer = document.getElementById('suggestions-container');

  // AI Control Center Settings
  const selectTakeoverDelay = document.getElementById('select-takeover-delay');
  const selectReviewDelay = document.getElementById('select-review-delay');

  // Brief Modal
  const briefModal = document.getElementById('brief-modal');
  const briefModalContent = document.getElementById('brief-modal-content');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnModalConfirm = document.getElementById('btn-modal-confirm');
  const btnModalCloseAction = document.getElementById('btn-modal-close-action');

  // Toast container
  const toastContainer = document.getElementById('toast-container');

  function showToast(message, type = 'info') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.remove) {
          toast.remove();
        } else if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 250);
    }, 3000);
  }

  // -------------------------------------------------------------
  // Responsive Mobile & Half-Screen Sidebars Controller
  // -------------------------------------------------------------
  const convSidebar = document.getElementById('conversations-sidebar');
  const detailsSidebar = document.getElementById('details-sidebar');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const btnToggleConv = document.getElementById('btn-toggle-conv-sidebar');
  const btnToggleDetails = document.getElementById('btn-toggle-details-sidebar');
  const btnBackConv = document.getElementById('btn-back-conv-sidebar');
  const btnBackDetails = document.getElementById('btn-back-details-sidebar');
  const btnCloseConv = document.getElementById('btn-close-conv-sidebar');
  const btnCloseDetails = document.getElementById('btn-close-details-sidebar');
  const convToggleBadge = document.getElementById('conv-toggle-badge');
  const detailsToggleBadge = document.getElementById('details-toggle-badge');

  function openConvSidebar() {
    if (convSidebar) convSidebar.classList.add('mobile-open');
    if (detailsSidebar) detailsSidebar.classList.remove('mobile-open');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
  }

  function openDetailsSidebar() {
    if (detailsSidebar) detailsSidebar.classList.add('mobile-open');
    if (convSidebar) convSidebar.classList.remove('mobile-open');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
  }

  function closeMobileDrawers() {
    if (convSidebar) convSidebar.classList.remove('mobile-open');
    if (detailsSidebar) detailsSidebar.classList.remove('mobile-open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
  }

  if (btnToggleConv) {
    btnToggleConv.addEventListener('click', () => {
      if (convSidebar && convSidebar.classList.contains('mobile-open')) {
        closeMobileDrawers();
      } else {
        openConvSidebar();
      }
    });
  }

  if (btnToggleDetails) {
    btnToggleDetails.addEventListener('click', () => {
      if (detailsSidebar && detailsSidebar.classList.contains('mobile-open')) {
        closeMobileDrawers();
      } else {
        openDetailsSidebar();
      }
    });
  }

  if (btnBackConv) btnBackConv.addEventListener('click', closeMobileDrawers);
  if (btnBackDetails) btnBackDetails.addEventListener('click', closeMobileDrawers);
  if (btnCloseConv) btnCloseConv.addEventListener('click', closeMobileDrawers);
  if (btnCloseDetails) btnCloseDetails.addEventListener('click', closeMobileDrawers);
  if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeMobileDrawers);

  // -------------------------------------------------------------
  // 1. Right Sidebar Tab Navigation
  // -------------------------------------------------------------
  let activeTabName = 'campaign';
  function switchTab(tabName) {
    activeTabName = tabName;
    const tabs = [
      { name: 'campaign', btn: tabBtnCampaign, panel: panelCampaign },
      { name: 'suggestions', btn: tabBtnSuggestions, panel: panelSuggestions },
      { name: 'aicontrol', btn: tabBtnAIControl, panel: panelAIControl }
    ];

    tabs.forEach(t => {
      if (t.btn) t.btn.classList.toggle('active', t.name === tabName);
      if (t.panel) {
        t.panel.classList.toggle('active', t.name === tabName);
        t.panel.style.display = (t.name === tabName) ? 'flex' : 'none';
      }
    });

    if (tabName === 'suggestions') {
      renderSuggestionsPanel();
    } else if (tabName === 'campaign') {
      renderCampaignProgress();
    } else if (tabName === 'aicontrol') {
      renderAIControls();
    }
  }

  if (tabBtnCampaign) tabBtnCampaign.addEventListener('click', () => switchTab('campaign'));
  if (tabBtnSuggestions) tabBtnSuggestions.addEventListener('click', () => switchTab('suggestions'));
  if (tabBtnAIControl) tabBtnAIControl.addEventListener('click', () => switchTab('aicontrol'));

  // -------------------------------------------------------------
  // 2. Master AI Toggle & Mode Segment Interlocking
  // -------------------------------------------------------------
  function updateMasterAiUI(enabled) {
    if (masterAiToggle) masterAiToggle.checked = enabled;
    if (masterAiLabel) {
      masterAiLabel.textContent = enabled ? 'AI Active' : 'AI Inactive';
      masterAiLabel.classList.toggle('disabled', !enabled);
    }

    if (!enabled) {
      if (modeBtnAtDesk) {
        modeBtnAtDesk.classList.add('disabled');
        modeBtnAtDesk.classList.remove('active');
        modeBtnAtDesk.setAttribute('disabled', 'true');
      }
      if (modeBtnAway) {
        modeBtnAway.classList.add('disabled');
        modeBtnAway.classList.remove('active');
        modeBtnAway.setAttribute('disabled', 'true');
      }
    } else {
      if (modeBtnAtDesk) {
        modeBtnAtDesk.classList.remove('disabled');
        modeBtnAtDesk.removeAttribute('disabled');
      }
      if (modeBtnAway) {
        modeBtnAway.classList.remove('disabled');
        modeBtnAway.removeAttribute('disabled');
      }
    }
  }

  if (masterAiToggle) {
    masterAiToggle.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      AIControlCenter.setGlobalAI(isEnabled);

      if (!isEnabled) {
        // Automatically shift to Human mode
        HandoffManager.setUnifiedMode(activeConvId, 'human');
        showToast('AI turned OFF. At Desk and Away disabled. Shifted to Human mode.', 'warning');
      } else {
        // Automatically shift to At Desk mode when AI is enabled
        HandoffManager.setUnifiedMode(activeConvId, 'at_desk');
        showToast('AI turned ON. Shifted to At Desk mode.', 'success');
      }

      renderUI();
    });
  }

  function updateModeButtons(mode) {
    if (modeBtnAtDesk) modeBtnAtDesk.classList.toggle('active', mode === 'at_desk');
    if (modeBtnAway) modeBtnAway.classList.toggle('active', mode === 'away');
  }

  if (modeBtnAtDesk) {
    modeBtnAtDesk.addEventListener('click', () => {
      const state = AliasState.get();
      if (!state.globalAiEnabled) {
        showToast('Turn on AI toggle to enable At Desk mode.', 'warning');
        return;
      }
      HandoffManager.setUnifiedMode(activeConvId, 'at_desk');
      updateModeButtons('at_desk');
      renderWorkspace();
      renderConversationsList();
      showToast('Switched to At Desk mode: AI drafts await approval (No timer).', 'info');
    });
  }

  if (modeBtnAway) {
    modeBtnAway.addEventListener('click', () => {
      const state = AliasState.get();
      if (!state.globalAiEnabled) {
        showToast('Turn on AI toggle to enable Away mode.', 'warning');
        return;
      }
      HandoffManager.setUnifiedMode(activeConvId, 'away');
      updateModeButtons('away');
      renderWorkspace();
      renderConversationsList();
      const delay = state.aiReviewDelaySeconds || 15;
      showToast(`Switched to Away mode: AI handles inquiries autonomously after ${delay}s.`, 'warning');
    });
  }

  // -------------------------------------------------------------
  // 3. Conversation Sidebar Filtering & Rendering
  // -------------------------------------------------------------
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.getAttribute('data-filter') || 'all';
      renderConversationsList();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderConversationsList();
    });
  }

  function renderConversationsList() {
    if (!convListContainer) return;
    const state = AliasState.get();
    const convs = Object.values(state.conversations || {});

    const filtered = convs.filter(c => {
      const matchSearch = !searchQuery ||
        c.customerName.toLowerCase().includes(searchQuery) ||
        c.businessName.toLowerCase().includes(searchQuery);
      return matchSearch;
    });

    if (convToggleBadge) convToggleBadge.textContent = filtered.length;
    const convCountBadge = document.getElementById('conv-count-badge');
    if (convCountBadge) convCountBadge.textContent = `${filtered.length} Active`;

    convListContainer.innerHTML = '';

    if (filtered.length === 0) {
      convListContainer.innerHTML = `
        <div style="padding:2rem 1rem; text-align:center; color:#94a3b8; font-size:13px;">
          No conversations found matching "${searchQuery}".
        </div>
      `;
      return;
    }

    filtered.forEach(c => {
      const card = document.createElement('div');
      card.className = `conversation-card ${c.id === activeConvId ? 'active' : ''}`;

      const lastMsg = (c.messages && c.messages.length) ? c.messages[c.messages.length - 1] : { content: 'No messages yet', timestamp: '' };

      let badgeClass = 'badge-ai';
      if (c.status === 'Human Active' || c.status === 'Human') badgeClass = 'badge-human';
      else if (c.status === 'Waiting for Human' || c.status === 'Human Requested') badgeClass = 'badge-warning';

      const isCustomerTyping = activeTypingConversations.has(c.id);
      const lastMessageSnippet = isCustomerTyping
        ? `<span class="typing-dots-mini" title="${c.customerName} is typing..."><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></span>`
        : (lastMsg.content || '').replace(/\\*\\*/g, '').replace(/\\n/g, ' ');

      card.innerHTML = `
        <div class="conv-card-top">
          <span class="conv-customer-name">${c.customerName}</span>
          <span class="conv-time">${lastMsg.timestamp || ''}</span>
        </div>
        <div class="conv-business-name">${c.businessName}</div>
        <div class="conv-last-message ${isCustomerTyping ? 'typing-active' : ''}">${lastMessageSnippet}</div>
        <div class="conv-card-bottom">
          <div class="conv-badges">
            <span class="badge ${badgeClass}">${c.status}</span>
            ${c.pendingAutoSend ? `<span class="badge badge-copilot" title="AI Draft in Message Bar">AI Draft</span>` : ''}
          </div>
          ${(c.unreadCount > 0) ? `<span class="unread-badge">${c.unreadCount}</span>` : ''}
        </div>
      `;

      card.addEventListener('click', () => {
        activeConvId = c.id;
        localStorage.setItem('alias_operator_active_conv', c.id);
        localStorage.setItem('alias_customer_active_conv', c.id);
        localStorage.setItem('alias_active_conv', c.id);
        const url = new URL(window.location);
        url.searchParams.set('conv', c.id);
        window.history.replaceState({}, '', url);

        AliasState.update(s => {
          s.activeConversationId = c.id;
          if (s.conversations[c.id]) s.conversations[c.id].unreadCount = 0;
          return s;
        });
        closeMobileDrawers();
        showCustomerTyping(activeTypingConversations.has(c.id));
        renderUI();
      });

      convListContainer.appendChild(card);
    });
  }

  // -------------------------------------------------------------
  // 4. Center Workspace Rendering & Docked Composer Draft
  // -------------------------------------------------------------
  function renderWorkspace() {
    const state = AliasState.get();
    const conv = state.conversations[activeConvId];
    if (!conv) return;

    // Header info
    if (wsCustomerName) wsCustomerName.textContent = conv.customerName;
    if (wsBusinessName) wsBusinessName.textContent = `${conv.businessName} • ID: ${conv.id}`;

    if (wsCustomerAvatar && conv.customerName) {
      const initials = conv.customerName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      wsCustomerAvatar.textContent = initials;
    }

    if (wsOpenCustomerView) {
      wsOpenCustomerView.href = `index.html?conv=${activeConvId}`;
      wsOpenCustomerView.title = `Switch Customer View to ${conv.customerName} (${conv.businessName})`;
      wsOpenCustomerView.onclick = () => {
        localStorage.setItem('alias_customer_active_conv', activeConvId);
      };
    }

    if (navLinkCustomer) {
      navLinkCustomer.href = `index.html?conv=${activeConvId}`;
      navLinkCustomer.onclick = () => {
        localStorage.setItem('alias_customer_active_conv', activeConvId);
      };
    }

    // Master AI switch & mode buttons
    updateMasterAiUI(Boolean(state.globalAiEnabled));

    let curMode = conv.mode || 'at_desk';
    if (!state.globalAiEnabled) {
      curMode = 'human';
      conv.mode = 'human';
    } else if (curMode === 'auto' || curMode === 'copilot') {
      curMode = 'at_desk';
      conv.mode = 'at_desk';
    }
    updateModeButtons(curMode);

    // Status Banner
    renderStatusBanner(conv, state);

    // Timeline Messages
    ChatRenderer.renderMessages(conv.messages, wsChatMessages, true);

    // Sync Customer typing indicator state
    showCustomerTyping(activeTypingConversations.has(activeConvId));

    // Docked Composer AI Draft
    renderComposerDraft(conv, state);

    // Update suggestions if visible
    if (activeTabName === 'suggestions') {
      renderSuggestionsPanel();
    }
  }

  function renderStatusBanner(conv, state) {
    if (!wsBanner) return;
    wsBanner.className = 'workspace-status-banner';

    const prog = CampaignManager.calculateProgress(conv.campaign || {});
    const isCompleted = prog.isComplete || (conv.campaign && conv.campaign.confirmed);
    if (isCompleted) {
      wsBanner.classList.add('banner-completed');
      wsBannerText.innerHTML = `✅ <strong>Campaign Brief Completed:</strong> Intake verified and finalized for this account.`;
      wsBannerAction.innerHTML = `
        <button class="btn btn-secondary btn-xs" id="banner-view-brief-btn">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          View Full Brief
        </button>
      `;
      setTimeout(() => {
        const btn = document.getElementById('banner-view-brief-btn');
        if (btn) btn.onclick = openBriefModal;
      }, 30);
      return;
    }

    const curMode = conv.mode || 'at_desk';

    if (curMode === 'human') {
      wsBanner.classList.add('banner-human');
      if (conv.takeoverTimerStartedAt && state.globalAiEnabled) {
        const delay = (state.takeoverDelaySeconds || 15) * 1000;
        const rem = Math.max(0, Math.ceil(((conv.takeoverTimerStartedAt + delay) - Date.now()) / 1000));
        wsBannerText.innerHTML = `<strong>Human Mode Active:</strong> Awaiting operator reply. AI will auto-assist in <span id="ws-banner-takeover-countdown">${rem}s</span> if unanswered.`;
      } else {
        wsBannerText.innerHTML = `<strong>Human Mode Active:</strong> Full manual control. Only human operator communicates with customer.`;
      }
      wsBannerAction.innerHTML = `
        <button class="btn btn-secondary btn-xs" id="banner-switch-atdesk-btn">Turn On AI</button>
      `;
      setTimeout(() => {
        const btn = document.getElementById('banner-switch-atdesk-btn');
        if (btn) btn.onclick = () => {
          if (masterAiToggle) {
            masterAiToggle.checked = true;
            masterAiToggle.dispatchEvent(new Event('change'));
          }
        };
      }, 30);
      return;
    }

    if (curMode === 'away') {
      wsBanner.classList.add('banner-ai');
      const delay = state.aiReviewDelaySeconds || 15;
      wsBannerText.innerHTML = `<strong>Away Mode Active:</strong> AI responds autonomously after natural delay (${delay}s).`;
      wsBannerAction.innerHTML = `
        <button class="btn btn-secondary btn-xs" id="banner-switch-atdesk-btn">I am Back (At Desk)</button>
      `;
      setTimeout(() => {
        const btn = document.getElementById('banner-switch-atdesk-btn');
        if (btn) btn.onclick = () => {
          HandoffManager.setUnifiedMode(activeConvId, 'at_desk');
          showToast('Welcome back! Switched to At Desk mode.', 'info');
        };
      }, 30);
      return;
    }

    // At Desk Mode
    wsBanner.classList.add('banner-copilot');
    if (conv.pendingAutoSend) {
      wsBannerText.innerHTML = `🟢 <strong>AI Draft Ready in Message Bar:</strong> Review, edit, or approve the suggested response below. (No timer)`;
    } else {
      wsBannerText.innerHTML = `<strong>At Desk Mode Active:</strong> AI suggests responses directly in your message bar for review. (No timer)`;
    }
    wsBannerAction.innerHTML = '';
  }

  // -------------------------------------------------------------
  // 5. Docked Inline AI Draft in Message Composer Bar
  // -------------------------------------------------------------
  function renderComposerDraft(conv, state) {
    if (!composerDraftToolbar || !composerInput) return;

    const draft = conv.pendingAutoSend;
    const isAtDesk = conv.mode === 'at_desk';
    const isAway = conv.mode === 'away';

    if (draft && (isAtDesk || isAway)) {
      composerDraftToolbar.style.display = 'flex';

      if (isAtDesk) {
        composerDraftToolbar.classList.remove('away-mode');
        composerInput.classList.add('has-ai-draft');
        composerInput.classList.remove('away-mode');

        if (composerDraftBadge) composerDraftBadge.textContent = '✨ AI Suggested Draft (At Desk)';
        if (composerDraftStatus) {
          composerDraftStatus.textContent = '🟢 Awaiting Approval • No Timer';
          composerDraftStatus.className = 'draft-toolbar-status';
        }

        if (btnComposerDraftHold) btnComposerDraftHold.style.display = 'none';
        if (btnComposerDraftRegen) btnComposerDraftRegen.style.display = 'inline-flex';
        if (btnComposerDraftDiscard) btnComposerDraftDiscard.style.display = 'inline-flex';
        if (btnComposerDraftSend) {
          btnComposerDraftSend.style.display = 'inline-flex';
          btnComposerDraftSend.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Send to Customer
          `;
        }
      } else if (isAway) {
        composerDraftToolbar.classList.add('away-mode');
        composerInput.classList.add('has-ai-draft');
        composerInput.classList.add('away-mode');

        if (composerDraftBadge) composerDraftBadge.textContent = '🤖 AI Response (Away Mode)';
        if (btnComposerDraftRegen) btnComposerDraftRegen.style.display = 'none';
        if (btnComposerDraftHold) btnComposerDraftHold.style.display = 'inline-flex';
        if (btnComposerDraftDiscard) btnComposerDraftDiscard.style.display = 'inline-flex';
        if (btnComposerDraftSend) {
          btnComposerDraftSend.style.display = 'inline-flex';
          btnComposerDraftSend.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Send Now
          `;
        }

        const now = Date.now();
        if (draft.isPaused) {
          const sec = draft.pausedRemainingSeconds !== undefined ? draft.pausedRemainingSeconds : (draft.remainingSeconds || 0);
          if (composerDraftStatus) {
            composerDraftStatus.textContent = `⏸️ Countdown Paused (${sec}s)`;
            composerDraftStatus.className = 'draft-toolbar-status';
          }
          if (btnComposerDraftHold) btnComposerDraftHold.textContent = 'Resume Countdown';
        } else {
          const exp = draft.expiresAt || (now + ((draft.remainingSeconds || 15) * 1000));
          const rem = Math.max(0, Math.ceil((exp - now) / 1000));
          if (composerDraftStatus) {
            composerDraftStatus.textContent = `⏱️ Auto-sending in ${rem}s...`;
            composerDraftStatus.className = 'draft-toolbar-status';
          }
          if (btnComposerDraftHold) btnComposerDraftHold.textContent = 'Pause & Edit';
        }
      }

      // Pre-fill composer input with the AI draft content if not already loaded
      const currentDraftId = composerInput.getAttribute('data-draft-id');
      if (currentDraftId !== draft.id) {
        composerInput.setAttribute('data-draft-id', draft.id);
        composerInput.value = draft.editedContent || draft.responseMessage.content || '';
        composerInput.style.height = 'auto';
        composerInput.style.height = Math.min(composerInput.scrollHeight, 140) + 'px';
      }
    } else {
      composerDraftToolbar.style.display = 'none';
      composerInput.classList.remove('has-ai-draft', 'away-mode');
      if (composerInput.hasAttribute('data-draft-id')) {
        composerInput.removeAttribute('data-draft-id');
        composerInput.value = '';
        composerInput.style.height = 'auto';
      }
    }
  }

  // Hook Draft Toolbar Actions
  if (btnComposerDraftDiscard) {
    btnComposerDraftDiscard.addEventListener('click', () => {
      HandoffManager.discardAutoResponse(activeConvId);
      composerInput.value = '';
      composerInput.removeAttribute('data-draft-id');
      composerInput.style.height = 'auto';
      composerDraftToolbar.style.display = 'none';
      composerInput.classList.remove('has-ai-draft', 'away-mode');
      showToast('AI draft discarded.', 'info');
    });
  }

  if (btnComposerDraftRegen) {
    btnComposerDraftRegen.addEventListener('click', () => {
      const state = AliasState.get();
      const conv = state.conversations[activeConvId];
      if (!conv || !conv.pendingAutoSend) return;

      const altDraft = MockAIEngine.generateCopilotDraft(conv);
      if (altDraft && altDraft.text) {
        conv.pendingAutoSend.editedContent = altDraft.text;
        conv.pendingAutoSend.responseMessage.content = altDraft.text;
        composerInput.value = altDraft.text;
        composerInput.style.height = 'auto';
        composerInput.style.height = Math.min(composerInput.scrollHeight, 140) + 'px';
        AliasState.update(s => s);
        showToast('Generated alternative draft.', 'info');
      }
    });
  }

  if (btnComposerDraftHold) {
    btnComposerDraftHold.addEventListener('click', () => {
      const state = AliasState.get();
      const conv = state.conversations[activeConvId];
      if (!conv || !conv.pendingAutoSend) return;

      if (conv.pendingAutoSend.isPaused) {
        HandoffManager.resumeAutoReview(activeConvId);
        showToast('Auto-send countdown resumed.', 'info');
      } else {
        HandoffManager.pauseAutoReviewForEdit(activeConvId);
        showToast('Auto-send countdown paused for editing.', 'warning');
      }
      renderWorkspace();
    });
  }

  if (btnComposerDraftSend) {
    btnComposerDraftSend.addEventListener('click', () => {
      const text = composerInput.value.trim();
      if (!text) return;
      HandoffManager.sendEditedAutoResponse(activeConvId, text);
      if (operatorTypingTimeout) {
        clearTimeout(operatorTypingTimeout);
        operatorTypingTimeout = null;
      }
      AliasState.setTyping(activeConvId, 'operator', false);
      composerInput.value = '';
      composerInput.removeAttribute('data-draft-id');
      composerInput.style.height = 'auto';
      composerDraftToolbar.style.display = 'none';
      composerInput.classList.remove('has-ai-draft', 'away-mode');
      showToast('Response sent to customer.', 'success');
    });
  }

  // If operator types in composer while Away mode draft is active, auto-pause the timer
  let operatorTypingTimeout = null;
  function notifyOperatorTyping() {
    if (composerInput.value.trim().length > 0) {
      AliasState.setTyping(activeConvId, 'operator', true);
      if (operatorTypingTimeout) clearTimeout(operatorTypingTimeout);
      operatorTypingTimeout = setTimeout(() => {
        AliasState.setTyping(activeConvId, 'operator', false);
      }, 2500);
    } else {
      if (operatorTypingTimeout) clearTimeout(operatorTypingTimeout);
      AliasState.setTyping(activeConvId, 'operator', false);
    }
  }

  if (composerInput) {
    composerInput.addEventListener('input', () => {
      composerInput.style.height = 'auto';
      composerInput.style.height = Math.min(composerInput.scrollHeight, 140) + 'px';

      const state = AliasState.get();
      const conv = state.conversations[activeConvId];
      if (conv && conv.pendingAutoSend) {
        conv.pendingAutoSend.editedContent = composerInput.value;
        if (conv.mode === 'away' && !conv.pendingAutoSend.isPaused) {
          HandoffManager.pauseAutoReviewForEdit(activeConvId);
        }
      }

      notifyOperatorTyping();
    });

    composerInput.addEventListener('keyup', (e) => {
      if (e.key !== 'Enter') notifyOperatorTyping();
    });
  }

  // Cross-tab Active Conversation Synchronizer
  window.addEventListener('storage', (e) => {
    if (e.key === 'alias_active_conv' && e.newValue && e.newValue !== activeConvId) {
      activeConvId = e.newValue;
      renderUI();
    }
  });

  // Cross-tab Typing Listener: receives Customer typing events
  AliasState.subscribeTyping((event) => {
    if (event.role === 'customer') {
      if (event.isTyping) {
        activeTypingConversations.add(event.convId);
        if (customerTypingTimers[event.convId]) clearTimeout(customerTypingTimers[event.convId]);
        customerTypingTimers[event.convId] = setTimeout(() => {
          activeTypingConversations.delete(event.convId);
          if (event.convId === activeConvId) showCustomerTyping(false);
          renderConversationsList();
        }, 3500);

        if (event.convId === activeConvId) {
          showCustomerTyping(true);
        }
      } else {
        activeTypingConversations.delete(event.convId);
        if (customerTypingTimers[event.convId]) clearTimeout(customerTypingTimers[event.convId]);
        if (event.convId === activeConvId) {
          showCustomerTyping(false);
        }
      }
      renderConversationsList();
    }
  });

  window.addEventListener('beforeunload', () => {
    AliasState.setTyping(activeConvId, 'operator', false);
  });

  // -------------------------------------------------------------
  // 6. Manual Message Sending & Attachments
  // -------------------------------------------------------------
  function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function renderOperatorAttachmentPreviews() {
    if (!operatorAttachmentPreviewContainer) return;
    operatorAttachmentPreviewContainer.innerHTML = '';
    operatorAttachedFiles.forEach((file, index) => {
      const chip = document.createElement('div');
      chip.className = 'attachment-preview-chip';
      chip.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
        <span>${file.name}</span>
        <span style="opacity:0.75; font-size:10px;">(${file.size})</span>
        <button class="attachment-remove-btn" title="Remove file">✕</button>
      `;
      chip.querySelector('.attachment-remove-btn').addEventListener('click', () => {
        operatorAttachedFiles.splice(index, 1);
        renderOperatorAttachmentPreviews();
      });
      operatorAttachmentPreviewContainer.appendChild(chip);
    });
  }

  if (btnOperatorAttach && operatorFileInput) {
    btnOperatorAttach.addEventListener('click', () => operatorFileInput.click());
    operatorFileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      files.forEach(f => {
        operatorAttachedFiles.push({
          name: f.name,
          size: formatFileSize(f.size),
          type: f.type
        });
      });
      renderOperatorAttachmentPreviews();
      showToast(`Attached ${files.length} file(s).`, 'info');
      operatorFileInput.value = '';
    });
  }

  function sendOperatorMessage() {
    let text = composerInput.value.trim();
    if (!text && operatorAttachedFiles.length === 0) return;

    if (!text && operatorAttachedFiles.length > 0) {
      text = "Attached file: " + operatorAttachedFiles.map(f => f.name).join(', ');
    }

    const currentFiles = [...operatorAttachedFiles];
    operatorAttachedFiles = [];
    renderOperatorAttachmentPreviews();

    // If there was a pending draft, sending clears it
    const state = AliasState.get();
    const conv = state.conversations[activeConvId];
    if (conv && conv.pendingAutoSend) {
      conv.pendingAutoSend = null;
    }

    composerInput.value = '';
    composerInput.removeAttribute('data-draft-id');
    composerInput.style.height = 'auto';
    if (composerDraftToolbar) composerDraftToolbar.style.display = 'none';
    composerInput.classList.remove('has-ai-draft', 'away-mode');

    if (operatorTypingTimeout) {
      clearTimeout(operatorTypingTimeout);
      operatorTypingTimeout = null;
    }
    AliasState.setTyping(activeConvId, 'operator', false);

    const timeStr = MockAIEngine.getCurrentTime();
    const msg = {
      id: 'msg-op-' + Date.now(),
      sender: 'human',
      senderLabel: 'Human Operator (Sarah K.)',
      timestamp: timeStr,
      type: 'text',
      content: text,
      attachments: currentFiles,
      status: 'delivered'
    };

    AliasState.update(s => {
      const c = s.conversations[activeConvId];
      c.messages.push(msg);
      c.pendingAutoSend = null;
      if (c.status === 'Waiting for Human' || c.status === 'Human Requested') {
        c.status = 'Human Active';
      }
      return s;
    });

    HandoffManager.cancelTakeoverTimer(activeConvId);
    AliasState.addAuditLog('human', `Operator sent message to ${activeConvId}.`);
    showToast('Message sent to customer.', 'success');
  }

  if (btnOperatorSend) btnOperatorSend.addEventListener('click', sendOperatorMessage);
  if (composerInput) {
    composerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendOperatorMessage();
      }
    });
  }

  // -------------------------------------------------------------
  // 7. Right Panel: Dynamic AI Suggestions Tab
  // -------------------------------------------------------------
  function renderSuggestionsPanel() {
    if (!suggestionsContainer) return;
    suggestionsContainer.innerHTML = '';

    const state = AliasState.get();
    const conv = state.conversations[activeConvId];
    if (!conv) return;

    const data = MockAIEngine.generateSuggestions(conv);
    if (!data || !data.questions || data.questions.length === 0) {
      suggestionsContainer.innerHTML = `
        <div style="padding:2rem 1rem; text-align:center; color:#64748b; font-size:13px;">
          No AI suggestions currently available for this stage.
        </div>
      `;
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '0.75rem';

    wrapper.innerHTML = `
      <div class="suggestion-header-banner">
        <div class="suggestion-header-stage">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
          <span>${data.stage}</span>
        </div>
        <span style="font-size:11px; color:#64748b; font-weight:500;">${data.questions.length} Dynamic Questions</span>
      </div>
    `;

    data.questions.forEach((q, idx) => {
      const card = document.createElement('div');
      card.className = 'suggestion-question-card';
      card.innerHTML = `
        <div class="suggestion-question-header">
          <span class="suggestion-card-badge">${q.tag}</span>
          <span class="suggestion-question-title">${q.title}</span>
        </div>
        <div class="suggestion-question-text">"${q.text}"</div>
        <div class="suggestion-card-actions">
          <button class="btn btn-secondary btn-xs btn-insert-sug-q" data-idx="${idx}" title="Insert into composer to edit before sending">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Insert into Composer
          </button>
          <button class="btn btn-primary btn-xs btn-send-sug-q" data-idx="${idx}" title="Send directly to customer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Send Directly
          </button>
        </div>
      `;

      const btnInsertQ = card.querySelector('.btn-insert-sug-q');
      const btnSendQ = card.querySelector('.btn-send-sug-q');

      if (btnInsertQ) {
        btnInsertQ.addEventListener('click', () => {
          composerInput.value = q.text;
          composerInput.removeAttribute('data-draft-id');
          composerInput.focus();
          composerInput.style.height = 'auto';
          composerInput.style.height = Math.min(composerInput.scrollHeight, 140) + 'px';
          showToast('Question inserted into composer.', 'info');
        });
      }

      if (btnSendQ) {
        btnSendQ.addEventListener('click', () => {
          composerInput.value = q.text;
          sendOperatorMessage();
        });
      }

      wrapper.appendChild(card);
    });

    suggestionsContainer.appendChild(wrapper);
  }

  // -------------------------------------------------------------
  // 8. Right Panel: Campaign Brief Progress & 3-Way Filtering
  // -------------------------------------------------------------
  if (briefFilterAll) {
    briefFilterAll.addEventListener('click', () => {
      currentBriefFilter = 'all';
      renderCampaignProgress();
    });
  }
  if (briefFilterCompleted) {
    briefFilterCompleted.addEventListener('click', () => {
      currentBriefFilter = 'completed';
      renderCampaignProgress();
    });
  }
  if (briefFilterIncomplete) {
    briefFilterIncomplete.addEventListener('click', () => {
      currentBriefFilter = 'incomplete';
      renderCampaignProgress();
    });
  }

  function renderCampaignProgress() {
    const state = AliasState.get();
    const conv = state.conversations[activeConvId];
    if (!conv) return;

    const prog = CampaignManager.calculateProgress(conv.campaign);

    if (campaignProgressBar) campaignProgressBar.style.width = `${prog.percentage}%`;
    if (campaignProgressPercent) campaignProgressPercent.textContent = `${prog.percentage}%`;
    if (detailsToggleBadge) detailsToggleBadge.textContent = `${prog.percentage}%`;

    const camp = conv.campaign || {};
    const b = camp.business || {};
    const obj = camp.objective || {};
    const aud = camp.audience || {};
    const plats = camp.platforms || [];
    const formats = camp.contentFormats || [];
    const sch = camp.schedule || {};
    const bg = camp.budget || {};

    const secData = [
      {
        num: 1,
        key: 'business',
        title: 'Business Information',
        status: prog.sections.business.status,
        missing: prog.sections.business.missing,
        fields: [
          { label: 'Business Name', val: b.name },
          { label: 'Industry', val: b.industry },
          { label: 'Product Name', val: b.productName },
          { label: 'USP', val: b.usp || b.productDescription || b.description },
          { label: 'Website', val: b.websiteUrl }
        ]
      },
      {
        num: 2,
        key: 'objective',
        title: 'Marketing Objectives',
        status: prog.sections.objective.status,
        missing: prog.sections.objective.missing,
        fields: [
          { label: 'Primary Objective', val: obj.primary },
          { label: 'Secondary Objectives', val: (obj.secondary && obj.secondary.length) ? obj.secondary.join(', ') : null },
          { label: 'Sales/Conversion Point', val: obj.salesLocation || obj.leadDefinition }
        ]
      },
      {
        num: 3,
        key: 'audience',
        title: 'Target Audience',
        status: prog.sections.audience.status,
        missing: prog.sections.audience.missing,
        fields: [
          { label: 'Age Range', val: aud.ageRange },
          { label: 'Gender', val: aud.gender },
          { label: 'Target Locations', val: Array.isArray(aud.location) ? aud.location.join(', ') : aud.location },
          { label: 'Interests', val: Array.isArray(aud.interests) ? aud.interests.join(', ') : aud.interests }
        ]
      },
      {
        num: 4,
        key: 'platforms',
        title: 'Advertising Platforms',
        status: prog.sections.platforms.status,
        missing: prog.sections.platforms.missing,
        fields: [
          { label: 'Platforms', val: (plats && plats.length) ? plats.join(', ') : null },
          { label: 'Creative Formats', val: (formats && formats.length) ? formats.join(', ') : null }
        ]
      },
      {
        num: 5,
        key: 'schedule',
        title: 'Campaign Schedule',
        status: prog.sections.schedule.status,
        missing: prog.sections.schedule.missing,
        fields: [
          { label: 'Start Date', val: sch.startDate },
          { label: 'End Date', val: sch.endDate },
          { label: 'Calculated Duration', val: sch.durationDays ? `${sch.durationDays} Days` : null }
        ]
      },
      {
        num: 6,
        key: 'budget',
        title: 'Campaign Budget',
        status: prog.sections.budget.status,
        missing: prog.sections.budget.missing,
        fields: [
          { label: 'Total Budget', val: bg.total ? `${Number(bg.total).toLocaleString()} ${bg.currency || 'BDT'}` : null },
          { label: 'Avg Daily Spend', val: bg.calculatedAvgDaily ? `${Number(bg.calculatedAvgDaily).toLocaleString()} ${bg.currency || 'BDT'}/day` : null },
          { label: 'Max Daily Cap', val: bg.maximumDaily ? `${Number(bg.maximumDaily).toLocaleString()} ${bg.currency || 'BDT'}` : null }
        ]
      }
    ];

    // Compute counts
    const completedCount = secData.filter(s => s.status === 'completed').length;
    const incompleteCount = secData.filter(s => s.status !== 'completed').length;

    if (briefCountCompleted) briefCountCompleted.textContent = completedCount;
    if (briefCountIncomplete) briefCountIncomplete.textContent = incompleteCount;

    if (briefFilterAll) briefFilterAll.classList.toggle('active', currentBriefFilter === 'all');
    if (briefFilterCompleted) briefFilterCompleted.classList.toggle('active', currentBriefFilter === 'completed');
    if (briefFilterIncomplete) briefFilterIncomplete.classList.toggle('active', currentBriefFilter === 'incomplete');

    if (!campaignSectionsContainer) return;
    campaignSectionsContainer.innerHTML = '';

    // Filter according to 3-way toggle
    let filteredSecs = secData;
    if (currentBriefFilter === 'completed') {
      filteredSecs = secData.filter(s => s.status === 'completed');
    } else if (currentBriefFilter === 'incomplete') {
      filteredSecs = secData.filter(s => s.status !== 'completed');
    }

    if (filteredSecs.length === 0) {
      campaignSectionsContainer.innerHTML = `
        <div style="padding:2rem 1rem; text-align:center; color:#64748b; font-size:13px; background:#f8fafc; border-radius:6px; border:1px solid #e2e8f0;">
          ${currentBriefFilter === 'incomplete' ? '🎉 All 6 intake sections are fully completed!' : 'No completed sections yet.'}
        </div>
      `;
      return;
    }

    filteredSecs.forEach(sec => {
      const card = document.createElement('div');
      card.className = 'info-section';

      let statusBadge = `<span class="badge badge-neutral">Incomplete</span>`;
      if (sec.status === 'completed') {
        statusBadge = `<span class="badge badge-success">Completed</span>`;
      } else if (sec.status === 'in_progress') {
        statusBadge = `<span class="badge badge-warning">In Progress</span>`;
      }

      const isIncomplete = sec.status !== 'completed';
      let aiPromptBoxHtml = '';

      if (isIncomplete) {
        const aiQuestion = MockAIEngine.generateMissingFieldQuestion(sec.key, sec.missing, conv.businessName);
        aiPromptBoxHtml = `
          <div class="incomplete-ai-prompt-box">
            <div class="incomplete-ai-prompt-title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><rect width="18" height="12" x="3" y="6" rx="2"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/></svg>
              <span>AI Question to Collect Missing Info:</span>
            </div>
            <div class="incomplete-ai-prompt-text">"${aiQuestion}"</div>
            <div class="incomplete-ai-actions">
              <button class="btn btn-secondary btn-xs btn-edit-brief-q" data-question="${encodeURIComponent(aiQuestion)}" title="Edit in message composer">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit in Composer
              </button>
              <button class="btn btn-primary btn-xs btn-send-brief-q" data-question="${encodeURIComponent(aiQuestion)}" title="Send question directly to customer">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Send to Customer
              </button>
            </div>
          </div>
        `;
      }

      // Filter fields: when viewing Incomplete, only show incomplete fields (no need to show complete questions!)
      const displayFields = (currentBriefFilter === 'incomplete')
        ? sec.fields.filter(f => !f.val || f.val === 'Not yet collected')
        : (currentBriefFilter === 'completed'
            ? sec.fields.filter(f => f.val && f.val !== 'Not yet collected')
            : sec.fields);

      card.innerHTML = `
        <div class="info-section-header">
          <span>${sec.num}. ${sec.title}</span>
          ${statusBadge}
        </div>
        ${sec.missing && sec.missing.length > 0 ? `
          <div style="font-size:11px; color:#d97706; font-weight:500;">Missing: ${sec.missing.join(', ')}</div>
        ` : ''}
        <div style="display:flex; flex-direction:column; gap:0.35rem; margin-top:0.25rem;">
          ${displayFields.map(f => `
            <div class="info-field-row">
              <span class="info-field-title">${f.label}:</span>
              <span class="info-field-data ${!f.val ? 'empty' : ''}">${f.val || 'Not yet collected'}</span>
            </div>
          `).join('')}
        </div>
        ${aiPromptBoxHtml}
      `;

      // Hook AI question buttons in incomplete sections
      const btnEditQ = card.querySelector('.btn-edit-brief-q');
      const btnSendQ = card.querySelector('.btn-send-brief-q');

      if (btnEditQ) {
        btnEditQ.addEventListener('click', () => {
          const qText = decodeURIComponent(btnEditQ.getAttribute('data-question'));
          composerInput.value = qText;
          composerInput.removeAttribute('data-draft-id');
          composerInput.focus();
          composerInput.style.height = 'auto';
          composerInput.style.height = Math.min(composerInput.scrollHeight, 140) + 'px';
          showToast('Question inserted into composer. You can edit before sending.', 'info');
        });
      }

      if (btnSendQ) {
        btnSendQ.addEventListener('click', () => {
          const qText = decodeURIComponent(btnSendQ.getAttribute('data-question'));
          composerInput.value = qText;
          sendOperatorMessage();
        });
      }

      campaignSectionsContainer.appendChild(card);
    });

    if (btnOpenBriefModal) {
      btnOpenBriefModal.disabled = !prog.isComplete && !conv.campaign.confirmed;
      btnOpenBriefModal.innerHTML = conv.campaign.confirmed ? 'View Confirmed Brief' : 'Review & Confirm Final Brief';
    }
  }

  // -------------------------------------------------------------
  // 9. AI Control Center Timers Configuration
  // -------------------------------------------------------------
  function renderAIControls() {
    const state = AliasState.get();
    if (selectTakeoverDelay) selectTakeoverDelay.value = state.takeoverDelaySeconds || 15;
    if (selectReviewDelay) selectReviewDelay.value = (state.aiReviewDelaySeconds !== undefined) ? state.aiReviewDelaySeconds : 15;
  }

  if (selectTakeoverDelay) {
    selectTakeoverDelay.addEventListener('change', (e) => {
      AIControlCenter.setTakeoverDelay(e.target.value);
      showToast(`Automatic AI takeover delay set to ${e.target.value}s.`);
    });
  }

  if (selectReviewDelay) {
    selectReviewDelay.addEventListener('change', (e) => {
      HandoffManager.setReviewDelay(e.target.value);
      showToast(`AI Away Mode response delay set to ${e.target.value}s.`);
    });
  }

  // -------------------------------------------------------------
  // 10. Final Campaign Brief Modal Handling
  // -------------------------------------------------------------
  function openBriefModal() {
    const state = AliasState.get();
    const conv = state.conversations[activeConvId];
    if (!conv) return;

    const brief = CampaignManager.generateBriefSummary(conv.campaign);

    briefModalContent.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
        <div>
          <h3 style="font-size:16px; font-weight:700; color:#0f172a;">${brief.campaignName}</h3>
          <p style="font-size:12px; color:#64748b;">Intake review conducted by Alias Agent 1</p>
        </div>
        <span class="badge ${brief.isConfirmed ? 'badge-success' : 'badge-copilot'}">
          ${brief.isConfirmed ? 'Confirmed' : 'Draft Ready'}
        </span>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; font-size:13px;">
        <div class="card" style="padding:0.75rem;">
          <div style="font-weight:600; color:#1e293b; margin-bottom:0.35rem;">Business & Offering</div>
          <div><strong>Brand:</strong> ${brief.business.name}</div>
          <div><strong>Industry:</strong> ${brief.business.industry}</div>
          <div><strong>Product:</strong> ${brief.product.name}</div>
          <div><strong>USP:</strong> ${brief.business.usp}</div>
          <div><strong>Website:</strong> ${brief.business.website}</div>
        </div>

        <div class="card" style="padding:0.75rem;">
          <div style="font-weight:600; color:#1e293b; margin-bottom:0.35rem;">Objectives & Strategy</div>
          <div><strong>Primary:</strong> ${brief.objectives.primary}</div>
          <div><strong>Secondary:</strong> ${brief.objectives.secondary}</div>
          <div><strong>Conversion Destination:</strong> ${brief.objectives.followUpNote}</div>
        </div>

        <div class="card" style="padding:0.75rem;">
          <div style="font-weight:600; color:#1e293b; margin-bottom:0.35rem;">Audience Targeting</div>
          <div><strong>Age Range:</strong> ${brief.audience.ageRange}</div>
          <div><strong>Gender:</strong> ${brief.audience.gender}</div>
          <div><strong>Location:</strong> ${brief.audience.location}</div>
          <div><strong>Interests:</strong> ${brief.audience.interests}</div>
        </div>

        <div class="card" style="padding:0.75rem;">
          <div style="font-weight:600; color:#1e293b; margin-bottom:0.35rem;">Media & Financials</div>
          <div><strong>Platforms:</strong> ${brief.mediaChannels.platforms}</div>
          <div><strong>Formats:</strong> ${brief.mediaChannels.contentFormats}</div>
          <div><strong>Schedule:</strong> ${brief.schedule.startDate} to ${brief.schedule.endDate} (${brief.schedule.durationDays})</div>
          <div><strong>Total Budget:</strong> ${brief.budget.total}</div>
          <div><strong>Avg Daily Spend:</strong> ${brief.budget.calculatedAvgDaily}</div>
        </div>
      </div>

      <div style="margin-top:1.25rem; padding:0.75rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; font-size:12px; color:#475569;">
        <strong>Important Notice:</strong> Confirming the campaign brief is NOT authorization to publish advertisements or spend money. This stage confirms the intake requirements collected by Agent 1.
      </div>

      ${brief.isConfirmed ? `
        <div style="margin-top:0.75rem; padding:0.75rem; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:6px; font-size:13px; color:#065f46; font-weight:500;">
          Your campaign brief has been successfully completed and is ready for the Product Intelligence and Research stage.
        </div>
      ` : ''}
    `;

    if (btnModalConfirm) {
      btnModalConfirm.style.display = brief.isConfirmed ? 'none' : 'inline-flex';
    }

    briefModal.classList.add('open');
  }

  function closeBriefModal() {
    briefModal.classList.remove('open');
  }

  if (btnOpenBriefModal) btnOpenBriefModal.addEventListener('click', openBriefModal);
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeBriefModal);
  if (btnModalCloseAction) btnModalCloseAction.addEventListener('click', closeBriefModal);

  if (btnModalConfirm) {
    btnModalConfirm.addEventListener('click', () => {
      AliasState.update(s => {
        const c = s.conversations[activeConvId];
        c.campaign.status = 'confirmed';
        c.campaign.confirmed = true;
        c.messages.push({
          id: 'msg-conf-' + Date.now(),
          sender: 'ai',
          senderLabel: 'Alias AI Assistant',
          timestamp: MockAIEngine.getCurrentTime(),
          type: 'text',
          content: "✅ **Campaign Brief Confirmed!**\\n\\nYour campaign brief has been successfully completed and is ready for the Product Intelligence and Research stage.",
          status: 'delivered'
        });
        return s;
      });
      AliasState.addAuditLog('system', `Campaign brief for ${activeConvId} formally confirmed by operator.`);
      showToast('Campaign brief confirmed.', 'success');
      closeBriefModal();
    });
  }

  // -------------------------------------------------------------
  // 11. Combined Render & Subscription
  // -------------------------------------------------------------
  function renderUI() {
    renderConversationsList();
    renderWorkspace();
    renderCampaignProgress();
    renderAIControls();
  }

  AliasState.subscribe(() => {
    renderUI();
  });

  // Universal heartbeat timer tick listener (300ms)
  window.addEventListener('alias:timer_tick', (e) => {
    const now = (e.detail && e.detail.now) || Date.now();
    const state = AliasState.get();
    if (!state || !state.conversations) return;
    const conv = state.conversations[activeConvId];
    if (!conv) return;

    // 1. Live Countdown for Docked Away Mode Draft Toolbar
    if (conv.pendingAutoSend && conv.mode === 'away' && !conv.pendingAutoSend.noTimer) {
      const draft = conv.pendingAutoSend;
      if (composerDraftStatus) {
        if (draft.isPaused) {
          const sec = draft.pausedRemainingSeconds !== undefined ? draft.pausedRemainingSeconds : (draft.remainingSeconds || 0);
          composerDraftStatus.textContent = `⏸️ Countdown Paused (${sec}s)`;
        } else {
          const expiresAt = draft.expiresAt || (now + ((draft.remainingSeconds || 15) * 1000));
          const rem = Math.max(0, Math.ceil((expiresAt - now) / 1000));
          composerDraftStatus.textContent = `⏱️ Auto-sending in ${rem}s...`;
        }
      }
    }

    // 2. Live Countdown for Takeover Timer in Status Banner
    const takeoverCountdownEl = document.getElementById('ws-banner-takeover-countdown');
    if (takeoverCountdownEl && conv.mode === 'human' && conv.takeoverTimerStartedAt) {
      const delay = (state.takeoverDelaySeconds || 15) * 1000;
      const expiresAt = conv.takeoverTimerStartedAt + delay;
      const rem = Math.max(0, Math.ceil((expiresAt - now) / 1000));
      takeoverCountdownEl.textContent = `${rem}s`;
    }
  });

  // Initial render
  renderUI();
});
