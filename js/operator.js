/**
 * ALIAS Human Operator Dashboard Controller (operator.html)
 * Manages 3-panel workspace, conversation switching, filter chips,
 * mode handoffs, Copilot draft approval/editing, manual replies,
 * campaign progress inspection, and AI control center.
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

  // Popstate listener for back/forward navigation
  window.addEventListener('popstate', () => {
    const target = resolveOperatorConvId();
    if (target !== activeConvId) {
      activeConvId = target;
      renderUI();
    }
  });

  // DOM Elements
  const convListContainer = document.getElementById('conv-list-container');
  const searchInput = document.getElementById('operator-search');
  const filterChips = document.querySelectorAll('.filter-chip');
  
  // Center workspace
  const wsCustomerName = document.getElementById('ws-customer-name');
  const wsBusinessName = document.getElementById('ws-business-name');
  const wsStatusBadge = document.getElementById('ws-status-badge');
  const wsBanner = document.getElementById('ws-banner');
  const wsBannerText = document.getElementById('ws-banner-text');
  const wsBannerAction = document.getElementById('ws-banner-action');
  const wsChatMessages = document.getElementById('ws-chat-messages');
  const copilotDraftContainer = document.getElementById('copilot-draft-container');
  const autoReviewContainer = document.getElementById('auto-review-container');
  const presenceBtnPresent = document.getElementById('presence-btn-present');
  const presenceBtnAway = document.getElementById('presence-btn-away');
  const selectReviewDelay = document.getElementById('select-review-delay');
  const composerInput = document.getElementById('operator-composer-input');
  const btnOperatorSend = document.getElementById('btn-operator-send');
  const modeAutoBtn = document.getElementById('mode-btn-auto');
  const modeHumanBtn = document.getElementById('mode-btn-human');
  const modeCopilotBtn = document.getElementById('mode-btn-copilot');
  const btnTakeOver = document.getElementById('btn-takeover');
  const btnReturnAI = document.getElementById('btn-return-ai');

  // Right sidebar tabs
  const tabBtnCampaign = document.getElementById('tab-btn-campaign');
  const tabBtnAIControl = document.getElementById('tab-btn-aicontrol');
  const panelCampaign = document.getElementById('panel-campaign');
  const panelAIControl = document.getElementById('panel-aicontrol');
  const campaignProgressBar = document.getElementById('operator-progress-bar');
  const campaignProgressPercent = document.getElementById('operator-progress-percent');
  const campaignSectionsContainer = document.getElementById('campaign-sections-container');
  const btnOpenBriefModal = document.getElementById('btn-open-brief-modal');

  // AI Controls in Right panel
  const toggleGlobalAI = document.getElementById('toggle-global-ai');
  const toggleGlobalCopilot = document.getElementById('toggle-global-copilot');
  const selectTakeoverDelay = document.getElementById('select-takeover-delay');

  // Modal
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
      setTimeout(() => toast.remove(), 250);
    }, 3000);
  }

  // Tab switching (Campaign vs AI Control)
  if (tabBtnCampaign && tabBtnAIControl) {
    tabBtnCampaign.addEventListener('click', () => {
      tabBtnCampaign.classList.add('active');
      tabBtnAIControl.classList.remove('active');
      panelCampaign.classList.add('active');
      panelAIControl.classList.remove('active');
    });

    tabBtnAIControl.addEventListener('click', () => {
      tabBtnAIControl.classList.add('active');
      tabBtnCampaign.classList.remove('active');
      panelAIControl.classList.add('active');
      panelCampaign.classList.remove('active');
    });
  }

  // Filter chips click handling
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.getAttribute('data-filter') || 'all';
      renderConversationsList();
    });
  });

  // Search input
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderConversationsList();
    });
  }

  // Render Conversation List (Left Panel)
  function renderConversationsList() {
    if (!convListContainer) return;
    const state = AliasState.get();
    const convs = Object.values(state.conversations || {});

    // Filter conversations
    const filtered = convs.filter(c => {
      // Search
      const matchSearch = !searchQuery ||
        c.customerName.toLowerCase().includes(searchQuery) ||
        c.businessName.toLowerCase().includes(searchQuery);

      if (!matchSearch) return false;

      // Filter category
      if (currentFilter === 'all') return true;
      if (currentFilter === 'ai_active') return c.status === 'AI Active';
      if (currentFilter === 'human_active') return c.status === 'Human Active';
      if (currentFilter === 'copilot') return c.mode === 'copilot';
      if (currentFilter === 'waiting') return c.status === 'Waiting for Human' || c.status === 'Human Requested';
      if (currentFilter === 'unread') return (c.unreadCount || 0) > 0;
      if (currentFilter === 'drafts') return Boolean(c.pendingDraft);
      return true;
    });

    convListContainer.innerHTML = '';

    if (filtered.length === 0) {
      convListContainer.innerHTML = `
        <div style="padding:2rem 1rem; text-align:center; color:#94a3b8; font-size:13px;">
          No conversations found matching "${currentFilter}".
        </div>
      `;
      return;
    }

    filtered.forEach(c => {
      const card = document.createElement('div');
      card.className = `conversation-card ${c.id === activeConvId ? 'active' : ''}`;

      const lastMsg = (c.messages && c.messages.length) ? c.messages[c.messages.length - 1] : { content: 'No messages yet', timestamp: '' };

      let badgeClass = 'badge-ai';
      if (c.status === 'Human Active') badgeClass = 'badge-human';
      else if (c.mode === 'copilot') badgeClass = 'badge-copilot';
      else if (c.status === 'Waiting for Human' || c.status === 'Human Requested') badgeClass = 'badge-warning';

      card.innerHTML = `
        <div class="conv-card-top">
          <span class="conv-customer-name">${c.customerName}</span>
          <span class="conv-time">${lastMsg.timestamp || ''}</span>
        </div>
        <div class="conv-business-name">${c.businessName}</div>
        <div class="conv-last-message">${(lastMsg.content || '').replace(/\*\*/g, '').replace(/\n/g, ' ')}</div>
        <div class="conv-card-bottom">
          <div class="conv-badges">
            <span class="badge ${badgeClass}">${c.status}</span>
            ${c.pendingDraft ? `<span class="badge badge-copilot" title="AI Draft Available">Draft Ready</span>` : ''}
          </div>
          ${(c.unreadCount > 0) ? `<span class="unread-badge">${c.unreadCount}</span>` : ''}
        </div>
      `;

      card.addEventListener('click', () => {
        activeConvId = c.id;
        localStorage.setItem('alias_operator_active_conv', c.id);
        const url = new URL(window.location);
        url.searchParams.set('conv', c.id);
        window.history.replaceState({}, '', url);

        // Clear unread
        AliasState.update(s => {
          if (s.conversations[c.id]) s.conversations[c.id].unreadCount = 0;
          return s;
        });
        renderUI();
      });

      convListContainer.appendChild(card);
    });
  }

  // Render Center Workspace
  function renderWorkspace() {
    const state = AliasState.get();
    const conv = state.conversations[activeConvId];
    if (!conv) return;

    // Header info
    if (wsCustomerName) wsCustomerName.textContent = conv.customerName;
    if (wsBusinessName) wsBusinessName.textContent = `${conv.businessName} • ID: ${conv.id}`;

    // Customer Avatar Initials
    const wsCustomerAvatar = document.getElementById('ws-customer-avatar');
    if (wsCustomerAvatar && conv.customerName) {
      const initials = conv.customerName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      wsCustomerAvatar.textContent = initials;
    }

    // Direct link to open Customer View for this exact customer
    const wsOpenCustomerView = document.getElementById('ws-open-customer-view');
    if (wsOpenCustomerView) {
      wsOpenCustomerView.href = `index.html?conv=${activeConvId}`;
      wsOpenCustomerView.title = `Switch Customer View to ${conv.customerName} (${conv.businessName})`;
      wsOpenCustomerView.onclick = () => {
        localStorage.setItem('alias_customer_active_conv', activeConvId);
      };
    }

    // Top Navigation link to Customer View
    const navLinkCustomer = document.getElementById('nav-link-customer');
    if (navLinkCustomer) {
      navLinkCustomer.href = `index.html?conv=${activeConvId}`;
      navLinkCustomer.onclick = () => {
        localStorage.setItem('alias_customer_active_conv', activeConvId);
      };
    }

    // Mode buttons
    if (modeAutoBtn) modeAutoBtn.classList.toggle('active', conv.mode === 'auto');
    if (modeHumanBtn) modeHumanBtn.classList.toggle('active', conv.mode === 'human');
    if (modeCopilotBtn) modeCopilotBtn.classList.toggle('active', conv.mode === 'copilot');

    // Takeover / Return AI buttons
    if (btnTakeOver && btnReturnAI) {
      if (conv.handler === 'human') {
        btnTakeOver.style.display = 'none';
        btnReturnAI.style.display = 'inline-flex';
      } else {
        btnTakeOver.style.display = 'inline-flex';
        btnReturnAI.style.display = 'none';
      }
    }

    // Status Banner & Takeover Timer
    renderStatusBanner(conv, state);

    // AI Pre-Send Review Card (for AI Auto mode with countdown & editing)
    renderAutoReviewCard(conv, state);

    // Messages
    ChatRenderer.renderMessages(conv.messages, wsChatMessages, true);

    // Copilot Draft Card
    renderCopilotDraft(conv);
  }

  // Status Banner showing context-aware operational status
  function renderStatusBanner(conv, state) {
    if (!wsBanner) return;

    wsBanner.className = 'workspace-status-banner';

    // 1. Check if campaign brief is completed & confirmed
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

    // 2. Customer waiting for human response with live takeover countdown
    if (conv.status === 'Waiting for Human' || conv.status === 'Human Requested') {
      wsBanner.classList.add('banner-waiting');
      const delay = state.takeoverDelaySeconds || 15;
      const started = conv.takeoverTimerStartedAt || Date.now();
      const expiresAt = started + (delay * 1000);
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));

      wsBannerText.innerHTML = `⚠️ <strong>Customer Waiting:</strong> Operator response requested. Automatic AI takeover in <span id="ws-banner-takeover-countdown" style="font-weight:700;">${remaining}s</span>...`;
      wsBannerAction.innerHTML = `
        <button class="btn btn-primary btn-xs" id="banner-takeover-btn">Take Over Now</button>
      `;
      setTimeout(() => {
        const btn = document.getElementById('banner-takeover-btn');
        if (btn) btn.onclick = () => HandoffManager.takeOver(activeConvId);
      }, 30);
      return;
    }

    // 3. Active Pre-send Review in progress (message waiting on review card)
    if (conv.pendingAutoSend) {
      wsBanner.classList.add('banner-review');
      if (conv.pendingAutoSend.isPaused) {
        wsBannerText.innerHTML = `⏸️ <strong>Auto-Send Paused:</strong> Operator in manual control of generated message.`;
      } else {
        wsBannerText.innerHTML = `⏱️ <strong>Pre-Send Review Active:</strong> Inspect generated message below before automatic dispatch.`;
      }
      wsBannerAction.innerHTML = '';
      return;
    }

    // 4. Copilot Mode
    if (conv.mode === 'copilot') {
      wsBanner.classList.add('banner-copilot');
      wsBannerText.innerHTML = `<strong>AI Copilot Active:</strong> AI generates response drafts for human operator review and approval.`;
      wsBannerAction.innerHTML = '';
      return;
    }

    // 5. Human Mode
    if (conv.mode === 'human') {
      wsBanner.classList.add('banner-human');
      wsBannerText.innerHTML = `<strong>Human Controlled:</strong> Operator in full control. AI automatic responses paused.`;
      wsBannerAction.innerHTML = `
        <button class="btn btn-secondary btn-xs" id="banner-return-ai-btn">Return to AI</button>
      `;
      setTimeout(() => {
        const btn = document.getElementById('banner-return-ai-btn');
        if (btn) btn.onclick = () => HandoffManager.returnToAI(activeConvId);
      }, 30);
      return;
    }

    // 6. Default: Autonomous AI Intake Mode
    wsBanner.classList.add('banner-ai');
    wsBannerText.innerHTML = `<strong>AI Autonomous Intake:</strong> AI conducts intake conversation with customer.`;
    wsBannerAction.innerHTML = `
      <button class="btn btn-secondary btn-xs" id="banner-takeover-ai-btn">Take Over</button>
    `;
    setTimeout(() => {
      const btn = document.getElementById('banner-takeover-ai-btn');
      if (btn) btn.onclick = () => HandoffManager.takeOver(activeConvId);
    }, 30);
  }

  // Render Copilot Draft Card
  function renderCopilotDraft(conv) {
    if (!copilotDraftContainer) return;
    copilotDraftContainer.innerHTML = '';

    if (!conv.pendingDraft) return;

    const draft = conv.pendingDraft;
    const card = document.createElement('div');
    card.className = 'copilot-draft-card';
    card.innerHTML = `
      <div class="draft-header">
        <span class="draft-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><rect width="18" height="12" x="3" y="6" rx="2"/></svg>
          AI Suggested Response Draft (${draft.generatedAt})
        </span>
        <span style="font-size:11px; color:#64748b;">Requires Operator Approval</span>
      </div>
      <textarea class="draft-textarea" id="draft-edit-textarea">${draft.text}</textarea>
      <div class="draft-actions">
        <button class="btn btn-ghost btn-sm" id="btn-draft-discard">Discard</button>
        <button class="btn btn-secondary btn-sm" id="btn-draft-regen">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>
          Regenerate
        </button>
        <button class="btn btn-primary btn-sm" id="btn-draft-send">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Send as Generated
        </button>
      </div>
    `;

    setTimeout(() => {
      const editArea = card.querySelector('#draft-edit-textarea');
      const btnSend = card.querySelector('#btn-draft-send');
      const btnRegen = card.querySelector('#btn-draft-regen');
      const btnDiscard = card.querySelector('#btn-draft-discard');

      // Detect if edited
      editArea.addEventListener('input', () => {
        if (editArea.value.trim() !== draft.originalText) {
          btnSend.innerHTML = `
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Send Edited Response
          `;
        } else {
          btnSend.innerHTML = `
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Send as Generated
          `;
        }
      });

      btnSend.addEventListener('click', () => {
        const val = editArea.value.trim();
        if (val === draft.originalText) {
          AIControlCenter.sendDraftAsGenerated(activeConvId);
        } else {
          AIControlCenter.sendEditedDraft(activeConvId, val);
        }
        showToast('Response sent to customer.', 'success');
      });

      btnRegen.addEventListener('click', () => {
        AIControlCenter.regenerateDraft(activeConvId);
        showToast('New draft generated.', 'info');
      });

      btnDiscard.addEventListener('click', () => {
        AIControlCenter.discardDraft(activeConvId);
        showToast('Draft discarded.', 'info');
      });
    }, 50);

    copilotDraftContainer.appendChild(card);
  }

  // Render AI Pre-Send Review Card (for AI Auto mode with countdown & editing)
  function renderAutoReviewCard(conv, state) {
    if (!autoReviewContainer) return;
    autoReviewContainer.innerHTML = '';

    if (!conv.pendingAutoSend) return;

    const draft = conv.pendingAutoSend;
    const card = document.createElement('div');
    card.className = 'auto-review-card';
    card.id = 'active-auto-review-card';
    card.setAttribute('data-conv-id', conv.id);

    const now = Date.now();
    let remaining = 0;
    if (draft.isPaused) {
      remaining = draft.pausedRemainingSeconds !== undefined ? draft.pausedRemainingSeconds : (draft.remainingSeconds || 0);
    } else {
      if (!draft.expiresAt) {
        const sec = draft.remainingSeconds || 15;
        draft.expiresAt = now + (sec * 1000);
      }
      remaining = Math.max(0, Math.ceil((draft.expiresAt - now) / 1000));
    }
    const total = draft.totalDelay || 15;
    const percent = Math.min(100, Math.max(0, (remaining / total) * 100));

    let timerText = '';
    if (draft.isPaused) {
      if (draft.isEditing) {
        timerText = '⏸️ Auto-Send Paused (Editing)';
      } else {
        timerText = `⏸️ Auto-Send Paused (${remaining}s remaining)`;
      }
    } else {
      timerText = `⏱️ Auto-sending in ${remaining}s`;
    }

    card.innerHTML = `
      <div class="auto-review-header">
        <span class="auto-review-badge">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><rect width="18" height="12" x="3" y="6" rx="2"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/></svg>
          AI Generated Response (${draft.generatedAt})
        </span>
        <span class="auto-review-timer-badge ${draft.isPaused ? 'paused' : ''}" id="auto-review-timer-badge">
          ${timerText}
        </span>
      </div>

      <div class="auto-review-progress-track">
        <div class="auto-review-progress-fill ${draft.isPaused ? 'paused' : ''}" id="auto-review-progress-fill" style="width: ${percent}%;"></div>
      </div>

      ${draft.isEditing ? `
        <div style="font-size:12px; color:#64748b; margin-top:2px;">
          Edit the message below before it goes to the customer:
        </div>
        <textarea class="auto-review-editor" id="auto-review-text-input">${draft.editedContent || draft.responseMessage.content}</textarea>
        <div class="auto-review-actions">
          <button class="btn btn-ghost btn-sm" id="btn-auto-review-discard">Discard Message</button>
          <div class="auto-review-actions-right">
            <button class="btn btn-secondary btn-sm" id="btn-auto-review-resume" title="Cancel edits and resume countdown">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Resume Countdown
            </button>
            <button class="btn btn-primary btn-sm" id="btn-auto-review-send-edited">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Send Corrected Response
            </button>
          </div>
        </div>
      ` : `
        <div class="auto-review-preview">
          <div>${ChatRenderer.formatContent(draft.responseMessage.content)}</div>
        </div>
        <div class="auto-review-actions">
          <button class="btn btn-ghost btn-sm" id="btn-auto-review-discard">Discard</button>
          <div class="auto-review-actions-right">
            ${draft.isPaused ? `
              <button class="btn btn-secondary btn-sm" id="btn-auto-review-resume" title="Resume auto-send countdown">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Resume Auto-Send
              </button>
            ` : `
              <button class="btn btn-secondary btn-sm" id="btn-auto-review-hold" title="Stop auto-sending and take manual control">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>
                Pause & Take Over
              </button>
            `}
            <button class="btn btn-secondary btn-sm" id="btn-auto-review-edit" title="Pause countdown and edit text">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit Message
            </button>
            <button class="btn btn-primary btn-sm" id="btn-auto-review-send-now" title="Bypass timer and send immediately">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Send Now
            </button>
          </div>
        </div>
      `}
    `;

    setTimeout(() => {
      const btnSendNow = card.querySelector('#btn-auto-review-send-now');
      const btnEdit = card.querySelector('#btn-auto-review-edit');
      const btnHold = card.querySelector('#btn-auto-review-hold');
      const btnDiscard = card.querySelector('#btn-auto-review-discard');
      const btnSendEdited = card.querySelector('#btn-auto-review-send-edited');
      const btnResume = card.querySelector('#btn-auto-review-resume');
      const editInput = card.querySelector('#auto-review-text-input');

      if (btnSendNow) {
        btnSendNow.addEventListener('click', () => {
          HandoffManager.dispatchAutoResponse(activeConvId, false);
          showToast('AI message sent immediately to customer.', 'success');
        });
      }

      if (btnEdit) {
        btnEdit.addEventListener('click', () => {
          HandoffManager.pauseAutoReviewForEdit(activeConvId);
        });
      }

      if (btnHold) {
        btnHold.addEventListener('click', () => {
          HandoffManager.holdAutoResponse(activeConvId);
          showToast('Auto-send paused. You now have manual control.', 'warning');
        });
      }

      if (btnDiscard) {
        btnDiscard.addEventListener('click', () => {
          HandoffManager.discardAutoResponse(activeConvId);
          showToast('AI message discarded.', 'info');
        });
      }

      if (btnSendEdited && editInput) {
        btnSendEdited.addEventListener('click', () => {
          const val = editInput.value.trim();
          if (val) {
            HandoffManager.sendEditedAutoResponse(activeConvId, val);
            showToast('Corrected response sent to customer.', 'success');
          }
        });
      }

      if (btnResume) {
        btnResume.addEventListener('click', () => {
          HandoffManager.resumeAutoReview(activeConvId);
          showToast('Auto-send countdown resumed.', 'info');
        });
      }
    }, 30);

    autoReviewContainer.appendChild(card);
  }

  const btnOperatorAttach = document.getElementById('btn-operator-attach');
  const operatorFileInput = document.getElementById('operator-file-input');
  const operatorAttachmentPreviewContainer = document.getElementById('operator-attachment-preview-container');
  let operatorAttachedFiles = [];

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
    btnOperatorAttach.addEventListener('click', () => {
      operatorFileInput.click();
    });

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

  // Operator manual reply sending
  function sendOperatorMessage() {
    let text = composerInput.value.trim();
    if (!text && operatorAttachedFiles.length === 0) return;

    if (!text && operatorAttachedFiles.length > 0) {
      text = "Attached file: " + operatorAttachedFiles.map(f => f.name).join(', ');
    }

    const currentFiles = [...operatorAttachedFiles];
    operatorAttachedFiles = [];
    renderOperatorAttachmentPreviews();

    composerInput.value = '';
    composerInput.style.height = 'auto';

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

    AliasState.update(state => {
      const conv = state.conversations[activeConvId];
      conv.messages.push(msg);
      // If was waiting for human, mark active
      if (conv.status === 'Waiting for Human' || conv.status === 'Human Requested') {
        conv.status = 'Human Active';
      }
      return state;
    });

    // Invalidate takeover timer since operator answered!
    HandoffManager.cancelTakeoverTimer(activeConvId);
    AliasState.addAuditLog('human', `Operator sent manual message to ${activeConvId}.`);
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
    composerInput.addEventListener('input', () => {
      composerInput.style.height = 'auto';
      composerInput.style.height = Math.min(composerInput.scrollHeight, 120) + 'px';
    });
  }

  // Mode segmented control clicks
  if (modeAutoBtn) modeAutoBtn.addEventListener('click', () => HandoffManager.setMode(activeConvId, 'auto'));
  if (modeHumanBtn) modeHumanBtn.addEventListener('click', () => HandoffManager.setMode(activeConvId, 'human'));
  if (modeCopilotBtn) modeCopilotBtn.addEventListener('click', () => HandoffManager.setMode(activeConvId, 'copilot'));

  // Header Takeover & Return buttons
  if (btnTakeOver) btnTakeOver.addEventListener('click', () => HandoffManager.takeOver(activeConvId));
  if (btnReturnAI) btnReturnAI.addEventListener('click', () => HandoffManager.returnToAI(activeConvId));

  // Render Right Panel: Campaign Progress & Sections
  function renderCampaignProgress() {
    const state = AliasState.get();
    const conv = state.conversations[activeConvId];
    if (!conv) return;

    const prog = CampaignManager.calculateProgress(conv.campaign);

    if (campaignProgressBar) campaignProgressBar.style.width = `${prog.percentage}%`;
    if (campaignProgressPercent) campaignProgressPercent.textContent = `${prog.percentage}%`;

    if (!campaignSectionsContainer) return;
    campaignSectionsContainer.innerHTML = '';

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
        title: 'Business Information',
        status: prog.sections.business.status,
        missing: prog.sections.business.missing,
        fields: [
          { label: 'Business Name', val: b.name },
          { label: 'Industry', val: b.industry },
          { label: 'Product Name', val: b.productName },
          { label: 'USP', val: b.usp },
          { label: 'Website', val: b.websiteUrl }
        ]
      },
      {
        num: 2,
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
        title: 'Advertising Platforms',
        status: prog.sections.platforms.status,
        missing: prog.sections.platforms.missing,
        fields: [
          { label: 'Platforms', val: plats.join(', ') },
          { label: 'Creative Formats', val: formats.join(', ') }
        ]
      },
      {
        num: 5,
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

    secData.forEach(sec => {
      const card = document.createElement('div');
      card.className = 'info-section';

      let statusBadge = `<span class="badge badge-neutral">Incomplete</span>`;
      if (sec.status === 'completed') {
        statusBadge = `<span class="badge badge-success">Completed</span>`;
      } else if (sec.status === 'in_progress') {
        statusBadge = `<span class="badge badge-warning">In Progress</span>`;
      }

      card.innerHTML = `
        <div class="info-section-header">
          <span>${sec.num}. ${sec.title}</span>
          ${statusBadge}
        </div>
        ${sec.missing && sec.missing.length > 0 ? `
          <div style="font-size:11px; color:#d97706;">Missing: ${sec.missing.join(', ')}</div>
        ` : ''}
        <div style="display:flex; flex-direction:column; gap:0.35rem; margin-top:0.25rem;">
          ${sec.fields.map(f => `
            <div class="info-field-row">
              <span class="info-field-title">${f.label}:</span>
              <span class="info-field-data ${!f.val ? 'empty' : ''}">${f.val || 'Not yet collected'}</span>
            </div>
          `).join('')}
        </div>
      `;
      campaignSectionsContainer.appendChild(card);
    });

    if (btnOpenBriefModal) {
      btnOpenBriefModal.disabled = !prog.isComplete && !conv.campaign.confirmed;
      btnOpenBriefModal.innerHTML = conv.campaign.confirmed ? 'View Confirmed Brief' : 'Review & Confirm Final Brief';
    }
  }

  // Render Right Panel: AI Control Center
  function renderAIControls() {
    const state = AliasState.get();

    if (toggleGlobalAI) toggleGlobalAI.checked = Boolean(state.globalAiEnabled);
    if (toggleGlobalCopilot) toggleGlobalCopilot.checked = Boolean(state.globalCopilotEnabled);
    if (selectTakeoverDelay) selectTakeoverDelay.value = state.takeoverDelaySeconds || 15;
    if (selectReviewDelay) selectReviewDelay.value = (state.aiReviewDelaySeconds !== undefined) ? state.aiReviewDelaySeconds : 15;

    // Presence buttons
    if (presenceBtnPresent && presenceBtnAway) {
      const isPresent = (state.operatorPresence || 'present') === 'present';
      presenceBtnPresent.classList.toggle('active', isPresent);
      presenceBtnAway.classList.toggle('active', !isPresent);
    }
  }

  // Hook AI control toggle changes
  if (toggleGlobalAI) {
    toggleGlobalAI.addEventListener('change', (e) => {
      AIControlCenter.setGlobalAI(e.target.checked);
      showToast(`Global AI responses ${e.target.checked ? 'enabled' : 'disabled'}.`);
    });
  }

  if (toggleGlobalCopilot) {
    toggleGlobalCopilot.addEventListener('change', (e) => {
      AIControlCenter.setGlobalCopilot(e.target.checked);
      showToast(`Global Copilot mode ${e.target.checked ? 'enabled' : 'disabled'}.`);
    });
  }

  if (selectTakeoverDelay) {
    selectTakeoverDelay.addEventListener('change', (e) => {
      AIControlCenter.setTakeoverDelay(e.target.value);
      showToast('Takeover delay period updated.');
    });
  }

  if (selectReviewDelay) {
    selectReviewDelay.addEventListener('change', (e) => {
      HandoffManager.setReviewDelay(e.target.value);
      showToast('AI Pre-Send Review Window updated.');
    });
  }

  if (presenceBtnPresent && presenceBtnAway) {
    presenceBtnPresent.addEventListener('click', () => {
      HandoffManager.setOperatorPresence('present');
      presenceBtnPresent.classList.add('active');
      presenceBtnAway.classList.remove('active');
      showToast('Operator Presence: At Desk (Pre-Send Review Active)', 'info');
    });

    presenceBtnAway.addEventListener('click', () => {
      HandoffManager.setOperatorPresence('away');
      presenceBtnAway.classList.add('active');
      presenceBtnPresent.classList.remove('active');
      showToast('Operator Presence: Away (Immediate Auto-Send Active)', 'warning');
    });
  }

  // Brief Modal Handling
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
          content: "✅ **Campaign Brief Confirmed!**\n\nYour campaign brief has been successfully completed and is ready for the Product Intelligence and Research stage.",
          status: 'delivered'
        });
        return s;
      });
      AliasState.addAuditLog('system', `Campaign brief for ${activeConvId} formally confirmed by operator.`);
      showToast('Campaign brief confirmed.', 'success');
      closeBriefModal();
    });
  }

  // Combined render function
  function renderUI() {
    renderConversationsList();
    renderWorkspace();
    renderCampaignProgress();
    renderAIControls();
  }

  // Subscribe to state updates (both same tab and cross-tab from index.html!)
  AliasState.subscribe(() => {
    renderUI();
  });

  // Live ticker listener for smooth sub-second updates without re-rendering entire UI
  window.addEventListener('alias:timer_tick', (e) => {
    const now = (e.detail && e.detail.now) || Date.now();
    const state = AliasState.get();
    if (!state || !state.conversations) return;
    const conv = state.conversations[activeConvId];
    if (!conv) return;

    // 1. Live update for Auto-Review Card
    const card = document.getElementById('active-auto-review-card');
    const timerBadge = document.getElementById('auto-review-timer-badge');
    const progressFill = document.getElementById('auto-review-progress-fill');

    if (card && timerBadge && progressFill && conv.pendingAutoSend) {
      const draft = conv.pendingAutoSend;
      if (draft.isPaused) {
        const sec = draft.pausedRemainingSeconds !== undefined ? draft.pausedRemainingSeconds : (draft.remainingSeconds || 0);
        timerBadge.textContent = draft.isEditing ? '⏸️ Auto-Send Paused (Editing)' : `⏸️ Auto-Send Paused (${sec}s remaining)`;
        timerBadge.classList.add('paused');
        progressFill.classList.add('paused');
      } else {
        const expiresAt = draft.expiresAt || (now + ((draft.remainingSeconds || 15) * 1000));
        const rem = Math.max(0, Math.ceil((expiresAt - now) / 1000));
        const total = draft.totalDelay || 15;
        const percent = Math.min(100, Math.max(0, (rem / total) * 100));

        timerBadge.textContent = `⏱️ Auto-sending in ${rem}s`;
        timerBadge.classList.remove('paused');
        progressFill.classList.remove('paused');
        progressFill.style.width = percent + '%';
      }
    }

    // 2. Live update for Takeover Countdown in Status Banner
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

