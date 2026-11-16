/**
 * ALIAS Customer Conversation Application Controller (index.html)
 * Controls chat interaction, natural language sending,
 * interactive card responses, drawer brief editing, and state syncing.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const customerListContainer = document.getElementById('customer-list-container');
  const customerSearchInput = document.getElementById('customer-search');
  const customerFilterChips = document.querySelectorAll('.customer-filter-chip');
  const navLinkOperator = document.getElementById('nav-link-operator');
  const customerAvatar = document.getElementById('customer-avatar');
  const chatHeaderBusiness = document.getElementById('chat-header-business');
  const chatMessagesEl = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const btnSend = document.getElementById('btn-send');
  const typingIndicator = document.getElementById('typing-indicator');
  const headerStatus = document.getElementById('header-status');
  const headerSubtitle = document.getElementById('header-subtitle');
  const briefDrawer = document.getElementById('brief-drawer');
  const customerIntakeStepper = document.getElementById('customer-intake-stepper');
  const btnReviewFinalBrief = document.getElementById('btn-review-final-brief');
  const customerStepLabel = document.getElementById('customer-step-label');
  const customerStepTopic = document.getElementById('customer-step-topic');
  const customerStepBar = document.getElementById('customer-step-bar');
  const drawerMainTitle = document.getElementById('drawer-main-title');
  const btnCloseDrawer = document.getElementById('btn-close-drawer');
  const btnResetDemo = document.getElementById('btn-reset-demo');
  const drawerBody = document.getElementById('drawer-body');
  const overallProgressText = document.getElementById('overall-progress-text');
  const overallProgressBar = document.getElementById('overall-progress-bar');
  const toastContainer = document.getElementById('toast-container');
  const btnAttach = document.getElementById('btn-attach');
  const chatFileInput = document.getElementById('chat-file-input');
  const attachmentPreviewContainer = document.getElementById('attachment-preview-container');
  let attachedFiles = [];

  // Active customer conversation resolution (URL param -> LocalStorage -> Default)
  function resolveActiveConvId() {
    const urlParams = new URLSearchParams(window.location.search);
    const convParam = urlParams.get('conv');
    const validIds = ['demo-001', 'demo-002', 'demo-003', 'demo-004'];
    if (convParam && validIds.includes(convParam)) {
      localStorage.setItem('alias_customer_active_conv', convParam);
      return convParam;
    }
    const stored = localStorage.getItem('alias_customer_active_conv');
    if (stored && validIds.includes(stored)) {
      return stored;
    }
    return 'demo-001';
  }

  let currentConvId = resolveActiveConvId();

  function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function renderAttachmentPreviews() {
    if (!attachmentPreviewContainer) return;
    attachmentPreviewContainer.innerHTML = '';
    attachedFiles.forEach((file, index) => {
      const chip = document.createElement('div');
      chip.className = 'attachment-preview-chip';
      chip.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
        <span>${file.name}</span>
        <span style="opacity:0.75; font-size:10px;">(${file.size})</span>
        <button class="attachment-remove-btn" title="Remove file">✕</button>
      `;
      chip.querySelector('.attachment-remove-btn').addEventListener('click', () => {
        attachedFiles.splice(index, 1);
        renderAttachmentPreviews();
      });
      attachmentPreviewContainer.appendChild(chip);
    });
  }

  if (btnAttach && chatFileInput) {
    btnAttach.addEventListener('click', () => {
      chatFileInput.click();
    });

    chatFileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      files.forEach(f => {
        attachedFiles.push({
          name: f.name,
          size: formatFileSize(f.size),
          type: f.type
        });
      });
      renderAttachmentPreviews();
      showToast(`Attached ${files.length} file(s).`, 'info');
      chatFileInput.value = '';
    });
  }

  // Helper for toast notifications
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

  // Customer Account Switcher handling
  function switchCustomer(newConvId) {
    if (!newConvId) return;
    currentConvId = newConvId;
    localStorage.setItem('alias_customer_active_conv', newConvId);

    // Update URL query parameter cleanly without reloading page
    const url = new URL(window.location);
    url.searchParams.set('conv', newConvId);
    window.history.replaceState({}, '', url);

    // Reset pre-send files & typing
    attachedFiles = [];
    renderAttachmentPreviews();
    showTyping(false);

    // Re-sync UI for newly selected customer
    syncUI(AliasState.get());

    const state = AliasState.get();
    const conv = state.conversations[newConvId];
    if (conv) {
      showToast(`Switched customer view to ${conv.customerName} (${conv.businessName}).`, 'info');
    }
  }

  let currentCustomerFilter = 'all';
  let customerSearchQuery = '';

  if (customerSearchInput) {
    customerSearchInput.addEventListener('input', (e) => {
      customerSearchQuery = e.target.value.toLowerCase().trim();
      renderCustomerSidebar(AliasState.get());
    });
  }

  customerFilterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      customerFilterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCustomerFilter = chip.getAttribute('data-filter') || 'all';
      renderCustomerSidebar(AliasState.get());
    });
  });

  // Render Left Conversations Sidebar in Customer View (matches Operator Dashboard layout)
  function renderCustomerSidebar(state) {
    if (!customerListContainer) return;
    const convs = Object.values(state.conversations || {});

    // Filter matching search & chips
    const filtered = convs.filter(c => {
      const matchSearch = !customerSearchQuery ||
        c.customerName.toLowerCase().includes(customerSearchQuery) ||
        c.businessName.toLowerCase().includes(customerSearchQuery);

      if (!matchSearch) return false;

      if (currentCustomerFilter === 'all') return true;
      if (currentCustomerFilter === 'ai_active') return c.status === 'AI Active';
      if (currentCustomerFilter === 'human_active') return c.status === 'Human Active';
      if (currentCustomerFilter === 'copilot') return c.mode === 'copilot';
      return true;
    });

    customerListContainer.innerHTML = '';

    filtered.forEach(c => {
      const card = document.createElement('div');
      card.className = `conversation-card ${c.id === currentConvId ? 'active' : ''}`;
      card.setAttribute('role', 'listitem');
      card.style.cursor = 'pointer';

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
        if (c.id !== currentConvId) {
          switchCustomer(c.id);
        }
      });

      customerListContainer.appendChild(card);
    });
  }

  // Handle URL navigation back/forward and window focus
  window.addEventListener('popstate', () => {
    const target = resolveActiveConvId();
    if (target !== currentConvId) {
      currentConvId = target;
      syncUI(AliasState.get());
    }
  });

  window.addEventListener('focus', () => {
    const target = resolveActiveConvId();
    if (target !== currentConvId) {
      currentConvId = target;
      syncUI(AliasState.get());
    }
  });

  // Drawer toggle
  window.openBriefDrawer = () => briefDrawer.classList.add('open');
  window.closeBriefDrawer = () => briefDrawer.classList.remove('open');
  if (customerIntakeStepper) customerIntakeStepper.addEventListener('click', window.openBriefDrawer);
  if (btnReviewFinalBrief) btnReviewFinalBrief.addEventListener('click', window.openBriefDrawer);
  if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', window.closeBriefDrawer);

  // Reset Demo button
  if (btnResetDemo) {
    btnResetDemo.addEventListener('click', () => {
      if (confirm('Reset conversation and campaign brief back to starting state?')) {
        AliasState.reset();
        showToast('Demo state reset successfully.', 'success');
      }
    });
  }

  // Handle Interactive Action from Chat Cards
  function handleInteractiveAction(actionPayload) {
    const state = AliasState.get();
    const conv = state.conversations[currentConvId];
    if (!conv) return;

    showTyping(true);

    setTimeout(() => {
      const result = MockAIEngine.processCustomerMessage(currentConvId, null, actionPayload);
      const curState = AliasState.get();

      if (curState.operatorPresence === 'present' && (curState.aiReviewDelaySeconds || 0) > 0) {
        // Operator is present: Enter review grace period
        showTyping(true);
        HandoffManager.startAutoSendReview(currentConvId, result, actionPayload.value || 'Selected option');
      } else {
        // Operator is away or review disabled: auto-dispatch immediately!
        showTyping(false);
        if (result && result.responseMessage) {
          AliasState.update(s => {
            const c = s.conversations[currentConvId];
            c.messages.push(result.responseMessage);
            if (result.nextStepIndex !== null) c.stepIndex = result.nextStepIndex;
            return s;
          });
        }
      }
    }, 600);
  }

  // Handle Natural Language User Message Send
  function sendMessage() {
    let text = chatInput.value.trim();
    if (!text && attachedFiles.length === 0) return;

    if (!text && attachedFiles.length > 0) {
      text = "Attached document: " + attachedFiles.map(f => f.name).join(', ');
    }

    const currentFiles = [...attachedFiles];
    attachedFiles = [];
    renderAttachmentPreviews();

    chatInput.value = '';
    chatInput.style.height = 'auto';

    const stateBefore = AliasState.get();
    const curConv = stateBefore.conversations[currentConvId] || {};

    const timeStr = MockAIEngine.getCurrentTime();
    const customerMsg = {
      id: 'msg-cust-' + Date.now(),
      sender: 'customer',
      senderLabel: curConv.customerName || 'Customer',
      timestamp: timeStr,
      type: 'text',
      content: text,
      attachments: currentFiles,
      status: 'sent'
    };

    // If file was attached, record in campaign brandGuidelines
    if (currentFiles.length > 0) {
      const fileNames = currentFiles.map(f => f.name).join(', ');
      AliasState.update(s => {
        const c = s.conversations[currentConvId];
        c.campaign.business.brandGuidelines = (c.campaign.business.brandGuidelines ? c.campaign.business.brandGuidelines + '; ' : '') + fileNames;
        return s;
      });
    }

    // Append customer message immediately to state
    AliasState.update(state => {
      const conv = state.conversations[currentConvId];
      conv.messages.push(customerMsg);
      conv.unreadCount = (conv.unreadCount || 0) + 1;
      return state;
    });

    const state = AliasState.get();
    const conv = state.conversations[currentConvId];

    // Determine reaction based on mode and availability
    if (conv.mode === 'auto' && state.globalAiEnabled) {
      showTyping(true);
      const delay = Math.min(1400, Math.max(800, text.length * 20));

      setTimeout(() => {
        const result = MockAIEngine.processCustomerMessage(currentConvId, text);
        const curState = AliasState.get();

        if (curState.operatorPresence === 'present' && (curState.aiReviewDelaySeconds || 0) > 0) {
          // Operator is at desk: show typing to customer, start review grace period in operator console!
          showTyping(true);
          HandoffManager.startAutoSendReview(currentConvId, result, text);
        } else {
          // Operator is away or instant send enabled: dispatch directly!
          showTyping(false);
          if (result && result.responseMessage) {
            AliasState.update(s => {
              const c = s.conversations[currentConvId];
              c.messages.push(result.responseMessage);
              if (result.nextStepIndex !== null) c.stepIndex = result.nextStepIndex;
              return s;
            });
          }
        }
      }, delay);
    } else if (conv.mode === 'copilot') {
      // AI Copilot Mode: AI generates a draft in background for the operator!
      const draft = MockAIEngine.generateCopilotDraft(customerMsg, conv);
      AliasState.update(s => {
        s.conversations[currentConvId].pendingDraft = draft;
        return s;
      });
      AliasState.addAuditLog('ai', `AI Copilot generated a draft response for operator approval in ${currentConvId}.`);
    } else if (conv.mode === 'human') {
      // Human Mode: Schedule takeover check if unanswered
      HandoffManager.scheduleTakeoverCheck(currentConvId);
    }
  }

  // Show/Hide typing
  function showTyping(show) {
    if (typingIndicator) {
      typingIndicator.style.display = show ? 'inline-flex' : 'none';
      if (show) ChatRenderer.scrollToBottom(chatMessagesEl);
    }
  }

  // Send button & Enter key
  btnSend.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize input
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });

  // Render Drawer Content (Editable Campaign Info)
  function renderDrawerContent(campaign) {
    if (!drawerBody) return;
    const prog = CampaignManager.calculateProgress(campaign);

    if (overallProgressText) overallProgressText.textContent = `${prog.percentage}% Complete`;
    if (overallProgressBar) overallProgressBar.style.width = `${prog.percentage}%`;

    const b = campaign.business || {};
    const obj = campaign.objective || {};
    const aud = campaign.audience || {};
    const sch = campaign.schedule || {};
    const bg = campaign.budget || {};

    const isFullyComplete = prog.isComplete || campaign.confirmed;

    if (drawerMainTitle) {
      drawerMainTitle.textContent = isFullyComplete ? "Final Campaign Brief" : "Answers Collected So Far";
    }

    let cardsHtml = '';

    // Section 1: Business Information (always shown if any info exists)
    if (b.name || b.industry || b.productName || isFullyComplete) {
      cardsHtml += `
        <div class="card" style="padding:0.75rem;">
          <div style="font-weight:600; font-size:13px; margin-bottom:0.5rem; display:flex; justify-content:space-between;">
            <span>1. Business & Product</span>
            <span class="badge ${prog.sections.business.status === 'completed' ? 'badge-success' : 'badge-warning'}">
              ${prog.sections.business.status === 'completed' ? 'Completed' : 'In Progress'}
            </span>
          </div>
          <div class="form-group">
            <label class="form-label">Business Name</label>
            <input type="text" class="form-control" id="edit-b-name" value="${b.name || ''}" placeholder="Business Name"/>
          </div>
          <div class="form-group">
            <label class="form-label">Industry</label>
            <input type="text" class="form-control" id="edit-b-industry" value="${b.industry || ''}" placeholder="e.g. Handmade Skincare"/>
          </div>
          <div class="form-group">
            <label class="form-label">Product Name & USP</label>
            <input type="text" class="form-control" id="edit-b-prod" value="${b.productName || ''}" placeholder="Product Name"/>
          </div>
        </div>
      `;
    }

    // Section 2: Objectives (shown if objective selected or complete)
    if (obj.primary || isFullyComplete) {
      cardsHtml += `
        <div class="card" style="padding:0.75rem;">
          <div style="font-weight:600; font-size:13px; margin-bottom:0.5rem; display:flex; justify-content:space-between;">
            <span>2. Objectives & Channel</span>
            <span class="badge ${prog.sections.objective.status === 'completed' ? 'badge-success' : 'badge-warning'}">
              ${prog.sections.objective.status === 'completed' ? 'Completed' : 'Pending'}
            </span>
          </div>
          <div class="form-group">
            <label class="form-label">Primary Objective</label>
            <input type="text" class="form-control" id="edit-obj-prim" value="${obj.primary || ''}" placeholder="e.g. Sales / Conversions"/>
          </div>
        </div>
      `;
    }

    // Section 3: Target Audience (shown if audience info exists or complete)
    if (aud.ageRange || aud.gender || (aud.location && aud.location.length) || isFullyComplete) {
      cardsHtml += `
        <div class="card" style="padding:0.75rem;">
          <div style="font-weight:600; font-size:13px; margin-bottom:0.5rem; display:flex; justify-content:space-between;">
            <span>3. Target Audience</span>
            <span class="badge ${prog.sections.audience.status === 'completed' ? 'badge-success' : 'badge-warning'}">
              ${prog.sections.audience.status === 'completed' ? 'Completed' : 'Pending'}
            </span>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Age</label>
              <input type="text" class="form-control" id="edit-aud-age" value="${aud.ageRange || ''}"/>
            </div>
            <div class="form-group">
              <label class="form-label">Gender</label>
              <input type="text" class="form-control" id="edit-aud-gender" value="${aud.gender || ''}"/>
            </div>
          </div>
        </div>
      `;
    }

    // Section 4: Platforms & Media (shown if platforms selected or complete)
    if ((campaign.platforms && campaign.platforms.length) || isFullyComplete) {
      cardsHtml += `
        <div class="card" style="padding:0.75rem;">
          <div style="font-weight:600; font-size:13px; margin-bottom:0.5rem; display:flex; justify-content:space-between;">
            <span>4. Advertising Platforms</span>
            <span class="badge ${prog.sections.platforms.status === 'completed' ? 'badge-success' : 'badge-warning'}">
              ${prog.sections.platforms.status === 'completed' ? 'Completed' : 'Pending'}
            </span>
          </div>
          <div class="form-group">
            <label class="form-label">Platforms</label>
            <input type="text" class="form-control" id="edit-platforms" value="${campaign.platforms ? campaign.platforms.join(', ') : ''}" readonly/>
          </div>
        </div>
      `;
    }

    // Section 5: Schedule & Budget (shown if schedule or budget entered or complete)
    if (sch.startDate || bg.total || isFullyComplete) {
      cardsHtml += `
        <div class="card" style="padding:0.75rem;">
          <div style="font-weight:600; font-size:13px; margin-bottom:0.5rem; display:flex; justify-content:space-between;">
            <span>5. Schedule & Budget</span>
            <span class="badge ${prog.sections.budget.status === 'completed' ? 'badge-success' : 'badge-warning'}">
              ${prog.sections.budget.status === 'completed' ? 'Completed' : 'Pending'}
            </span>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Duration (Days)</label>
              <input type="text" class="form-control" id="edit-sch-days" value="${sch.durationDays ? sch.durationDays + ' Days' : ''}" readonly/>
            </div>
            <div class="form-group">
              <label class="form-label">Total Budget</label>
              <input type="number" class="form-control" id="edit-bg-total" value="${bg.total || ''}"/>
            </div>
          </div>
        </div>
      `;
    }

    // Notice for in-progress vs complete
    let footerActionHtml = `
      <button class="btn btn-primary" id="btn-save-drawer-changes" style="width:100%; margin-top:0.5rem;">
        Save Changes
      </button>
    `;

    if (isFullyComplete && !campaign.confirmed) {
      footerActionHtml += `
        <button class="btn btn-success" id="btn-drawer-confirm-brief" style="width:100%; margin-top:0.5rem;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Confirm Campaign Brief
        </button>
      `;
    }

    drawerBody.innerHTML = `
      <div style="font-size:12px; color:#64748b; line-height:1.4;">
        ${isFullyComplete ? 
          'All required campaign brief parameters have been captured. Review and confirm below.' : 
          'You can review and correct any information already gathered by Alias AI. Changes will update immediately.'}
      </div>

      ${cardsHtml}

      ${!isFullyComplete ? `
        <div style="padding:0.75rem; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:6px; font-size:12px; color:#64748b;">
          <strong>Upcoming Questions:</strong> The remaining requirements will be collected step-by-step in your chat with Alias.
        </div>
      ` : ''}

      ${footerActionHtml}
    `;

    const btnSave = drawerBody.querySelector('#btn-save-drawer-changes');
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        AliasState.update(s => {
          const c = s.conversations[currentConvId];
          if (!c) return s;
          const bNameEl = drawerBody.querySelector('#edit-b-name');
          if (bNameEl) c.campaign.business.name = bNameEl.value;
          const bIndEl = drawerBody.querySelector('#edit-b-industry');
          if (bIndEl) c.campaign.business.industry = bIndEl.value;
          const bProdEl = drawerBody.querySelector('#edit-b-prod');
          if (bProdEl) c.campaign.business.productName = bProdEl.value;
          const objEl = drawerBody.querySelector('#edit-obj-prim');
          if (objEl) c.campaign.objective.primary = objEl.value;
          const audAgeEl = drawerBody.querySelector('#edit-aud-age');
          if (audAgeEl) c.campaign.audience.ageRange = audAgeEl.value;
          const audGenEl = drawerBody.querySelector('#edit-aud-gender');
          if (audGenEl) c.campaign.audience.gender = audGenEl.value;
          const bgTotEl = drawerBody.querySelector('#edit-bg-total');
          if (bgTotEl) {
            const newTot = parseFloat(bgTotEl.value);
            if (newTot && newTot > 0) {
              c.campaign.budget.total = newTot;
              c.campaign.budget.calculatedAvgDaily = CampaignManager.calculateAvgDaily(newTot, c.campaign.schedule.durationDays || 14);
            }
          }
          return s;
        });
        showToast('Corrections saved and synchronized.', 'success');
        window.closeBriefDrawer();
      });
    }

    const btnConfirm = drawerBody.querySelector('#btn-drawer-confirm-brief');
    if (btnConfirm) {
      btnConfirm.addEventListener('click', () => {
        handleInteractiveAction({ action: 'confirm_brief' });
        window.closeBriefDrawer();
      });
    }
  }

  // Synchronize UI from Global State
  function syncUI(state) {
    if (!state || !state.conversations) return;
    const conv = state.conversations[currentConvId];
    if (!conv) return;

    // Render customer conversations sidebar
    renderCustomerSidebar(state);

    // Synchronize Operator Dashboard link so clicking it opens this customer
    if (navLinkOperator) {
      navLinkOperator.href = `operator.html?conv=${currentConvId}`;
    }

    // Customer Avatar Initials
    if (customerAvatar && conv.customerName) {
      const initials = conv.customerName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      customerAvatar.textContent = initials;
    }

    // Chat Header Business & Customer Name
    if (chatHeaderBusiness && conv.businessName) {
      chatHeaderBusiness.innerHTML = `<span>${conv.businessName}</span> <span style="font-size:12px; font-weight:normal; color:#64748b;">(${conv.customerName})</span>`;
    }

    // Header status & subtitle
    if (conv.handler === 'human') {
      headerStatus.innerHTML = `<span class="badge-dot active"></span> Campaign Specialist (Human Active)`;
      if (headerSubtitle) headerSubtitle.textContent = 'Sarah K. from Marketing Ops is handling this conversation';
    } else if (conv.mode === 'copilot') {
      headerStatus.innerHTML = `<span class="badge-dot copilot"></span> Alias AI Copilot Active`;
      if (headerSubtitle) headerSubtitle.textContent = 'AI assisted with human verification';
    } else {
      headerStatus.innerHTML = `<span class="badge-dot ai"></span> Alias AI Assistant Connected`;
      if (headerSubtitle) headerSubtitle.textContent = 'Automated intake workflow active';
    }

    // Progressive Intake Stepper calculation
    const prog = CampaignManager.calculateProgress(conv.campaign);
    let stepNum = 1;
    let stepTopic = 'Business Info';

    if (prog.sections.business.status === 'completed') {
      stepNum = 2;
      stepTopic = 'Marketing Objectives';
    }
    if (prog.sections.objective.status === 'completed') {
      stepNum = 3;
      stepTopic = 'Target Audience';
    }
    if (prog.sections.audience.status === 'completed') {
      stepNum = 4;
      stepTopic = 'Advertising Platforms';
    }
    if (prog.sections.platforms.status === 'completed') {
      stepNum = 5;
      stepTopic = 'Campaign Schedule';
    }
    if (prog.sections.schedule.status === 'completed') {
      stepNum = 6;
      stepTopic = 'Budget & Currency';
    }
    if (prog.isComplete || conv.campaign.confirmed) {
      stepNum = 6;
      stepTopic = 'Brief Ready';
    }

    if (customerStepLabel) {
      customerStepLabel.textContent = (prog.isComplete || conv.campaign.confirmed) ? 'Brief Ready' : `Step ${stepNum} of 6`;
    }
    if (customerStepTopic) {
      customerStepTopic.textContent = `• ${stepTopic}`;
    }
    if (customerStepBar) {
      customerStepBar.style.width = `${Math.max(16, prog.percentage)}%`;
      customerStepBar.classList.toggle('complete', prog.isComplete || conv.campaign.confirmed);
    }

    // Toggle Review Final Brief button: Activates ONLY once intake is finished!
    if (btnReviewFinalBrief) {
      btnReviewFinalBrief.style.display = (prog.isComplete || conv.campaign.confirmed) ? 'inline-flex' : 'none';
    }

    // If there is an active pre-send review in progress (and not paused by operator), show typing indicator to customer
    if (conv.pendingAutoSend && !conv.pendingAutoSend.isPaused) {
      showTyping(true);
    } else {
      showTyping(false);
    }

    // Messages
    ChatRenderer.renderMessages(conv.messages, chatMessagesEl, false, handleInteractiveAction);

    // Drawer info
    renderDrawerContent(conv.campaign);
  }

  // Subscribe to state updates
  AliasState.subscribe((newState) => {
    syncUI(newState);
  });

  // Initial render
  syncUI(AliasState.get());
});

