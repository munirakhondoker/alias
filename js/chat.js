/**
 * ALIAS Chat Interface Renderer
 * Renders conversation messages, timestamps, sender badges,
 * and dynamic interactive intake cards across both Customer and Operator views.
 */

const ChatRenderer = {
  /**
   * Formats text with markdown-like bold and linebreaks
   */
  formatContent(text) {
    if (!text) return '';
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Bold **text**
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Line breaks
    escaped = escaped.replace(/\n/g, '<br/>');
    return escaped;
  },

  /**
   * Renders the complete message list into a target DOM container
   */
  renderMessages(messages, containerEl, isOperatorView = false, onInteractiveAction = null) {
    if (!containerEl) return;
    containerEl.innerHTML = '';

    messages.forEach((msg, idx) => {
      const isLast = idx === messages.length - 1;
      const row = document.createElement('div');
      row.className = `message-row sender-${msg.sender} ${this.getRowAlignment(msg.sender, isOperatorView)}`;

      // Avatar
      const avatar = document.createElement('div');
      avatar.className = `avatar avatar-${msg.sender}`;
      avatar.innerHTML = this.getAvatarIcon(msg.sender);

      // Bubble wrapper
      const bubbleWrapper = document.createElement('div');
      bubbleWrapper.className = 'message-bubble-wrapper';

      // Meta info (sender + time)
      const meta = document.createElement('div');
      meta.className = 'message-meta';
      meta.innerHTML = `
        <span class="sender-name">${msg.senderLabel || this.getDefaultLabel(msg.sender)}</span>
        <span>•</span>
        <span>${msg.timestamp}</span>
      `;

      // Bubble
      const bubble = document.createElement('div');
      bubble.className = `message-bubble ${this.getBubbleClass(msg)}`;
      bubble.innerHTML = `<div>${this.formatContent(msg.content)}</div>`;

      // Render attachments if attached
      if (msg.attachments && msg.attachments.length > 0) {
        const attachList = document.createElement('div');
        attachList.className = 'message-attachments';
        msg.attachments.forEach(att => {
          const pill = document.createElement('div');
          pill.className = 'attachment-pill';
          pill.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            <span>${att.name}</span>
            ${att.size ? `<span style="opacity:0.75; font-size:10px;">(${att.size})</span>` : ''}
          `;
          attachList.appendChild(pill);
        });
        bubble.appendChild(attachList);
      }

      // Interactive components (rendered only for Customer view, or read-only preview in Operator view)
      if (msg.interactiveData) {
        const widget = this.createInteractiveWidget(msg, isOperatorView, isLast, onInteractiveAction);
        if (widget) {
          bubble.appendChild(widget);
        }
      }

      bubbleWrapper.appendChild(meta);
      bubbleWrapper.appendChild(bubble);

      row.appendChild(avatar);
      row.appendChild(bubbleWrapper);
      containerEl.appendChild(row);
    });

    this.scrollToBottom(containerEl);
  },

  getRowAlignment(sender, isOperatorView) {
    if (isOperatorView) {
      return sender === 'customer' ? 'incoming' : 'outgoing';
    } else {
      return sender === 'customer' ? 'outgoing' : 'incoming';
    }
  },

  getBubbleClass(msg) {
    if (msg.senderLabel && msg.senderLabel.includes('Human-Edited')) {
      return 'bubble-human-edited';
    }
    if (msg.sender === 'human') return 'bubble-human';
    if (msg.sender === 'ai') return 'bubble-ai';
    return 'bubble-customer';
  },

  getDefaultLabel(sender) {
    if (sender === 'ai') return 'Alias AI Assistant';
    if (sender === 'human') return 'Human Operator';
    return 'Customer';
  },

  getAvatarIcon(sender) {
    if (sender === 'ai') {
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><rect width="18" height="12" x="3" y="6" rx="2"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/></svg>`;
    }
    if (sender === 'human') {
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    }
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  },

  /**
   * Constructs interactive DOM widgets inside chat bubbles
   */
  createInteractiveWidget(msg, isOperatorView, isLast, onAction) {
    const data = msg.interactiveData;
    const type = msg.type;
    const widget = document.createElement('div');
    widget.className = 'interactive-widget';

    // 1. Quick Reply Pills
    if (type === 'quick_replies') {
      const title = document.createElement('div');
      title.className = 'form-hint';
      title.textContent = data.title || 'Choose an option:';
      widget.appendChild(title);

      const pillsContainer = document.createElement('div');
      pillsContainer.className = 'quick-replies';

      data.options.forEach(opt => {
        const pill = document.createElement('button');
        pill.className = 'quick-reply-pill';
        pill.textContent = opt.label;
        if (isOperatorView || !isLast) {
          pill.disabled = true;
        } else {
          pill.addEventListener('click', () => {
            pill.classList.add('selected');
            if (onAction) onAction({ action: data.actionKey || 'select_industry', value: opt.value });
          });
        }
        pillsContainer.appendChild(pill);
      });
      widget.appendChild(pillsContainer);
      return widget;
    }

    // 2. Marketing Objectives Card Grid
    if (type === 'card_objectives') {
      const grid = document.createElement('div');
      grid.className = 'card-grid';

      data.options.forEach(opt => {
        const card = document.createElement('button');
        card.className = 'selection-card';
        card.innerHTML = `
          <div class="selection-card-title">${opt.title}</div>
          <div class="selection-card-desc">${opt.desc}</div>
        `;
        if (isOperatorView || !isLast) {
          card.disabled = true;
        } else {
          card.addEventListener('click', () => {
            card.classList.add('selected');
            if (onAction) onAction({ action: data.actionKey, value: opt.title });
          });
        }
        grid.appendChild(card);
      });
      widget.appendChild(grid);
      return widget;
    }

    // 3. Target Audience Card
    if (type === 'card_audience') {
      const form = document.createElement('div');
      form.className = 'interactive-form';
      form.innerHTML = `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Age Range</label>
            <select class="form-control" id="aud-age" ${isOperatorView || !isLast ? 'disabled' : ''}>
              ${data.ageOptions.map(a => `<option value="${a}">${a}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Gender</label>
            <select class="form-control" id="aud-gender" ${isOperatorView || !isLast ? 'disabled' : ''}>
              ${data.genderOptions.map(g => `<option value="${g}">${g}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Target Location / Region</label>
          <select class="form-control" id="aud-loc" ${isOperatorView || !isLast ? 'disabled' : ''}>
            ${data.locationOptions.map(l => `<option value="${l}">${l}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Key Customer Interests</label>
          <input type="text" class="form-control" id="aud-interests" value="Organic Beauty, Wellness, Natural Skincare" placeholder="e.g. Natural Skincare, Wellness" ${isOperatorView || !isLast ? 'disabled' : ''}/>
        </div>
        ${!isOperatorView && isLast ? `
          <button class="btn btn-primary btn-sm" id="btn-submit-aud">Confirm Target Audience</button>
        ` : ''}
      `;

      if (!isOperatorView && isLast) {
        setTimeout(() => {
          const btn = form.querySelector('#btn-submit-aud');
          if (btn) {
            btn.addEventListener('click', () => {
              const age = form.querySelector('#aud-age').value;
              const gender = form.querySelector('#aud-gender').value;
              const loc = form.querySelector('#aud-loc').value;
              const ints = form.querySelector('#aud-interests').value;
              if (onAction) onAction({ action: data.actionKey, data: { ageRange: age, gender, location: [loc], interests: ints } });
            });
          }
        }, 50);
      }
      widget.appendChild(form);
      return widget;
    }

    // 4. Advertising Platforms & Formats Card
    if (type === 'card_platforms') {
      const form = document.createElement('div');
      form.className = 'interactive-form';
      form.innerHTML = `
        <div class="form-group">
          <label class="form-label">Advertising Platforms (Select all that apply)</label>
          <div style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:4px;">
            ${data.platforms.map((p, i) => `
              <label style="display:inline-flex; align-items:center; gap:0.35rem; font-size:13px; cursor:pointer;">
                <input type="checkbox" name="plat-check" value="${p}" ${i < 2 ? 'checked' : ''} ${isOperatorView || !isLast ? 'disabled' : ''}/>
                <span>${p}</span>
              </label>
            `).join('')}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Content Creative Format</label>
          <select class="form-control" id="content-format-sel" ${isOperatorView || !isLast ? 'disabled' : ''}>
            ${data.formats.map(f => `<option value="${f}">${f}</option>`).join('')}
          </select>
        </div>
        ${!isOperatorView && isLast ? `
          <button class="btn btn-primary btn-sm" id="btn-submit-plat">Save Channels & Formats</button>
        ` : ''}
      `;

      if (!isOperatorView && isLast) {
        setTimeout(() => {
          const btn = form.querySelector('#btn-submit-plat');
          if (btn) {
            btn.addEventListener('click', () => {
              const checked = Array.from(form.querySelectorAll('input[name="plat-check"]:checked')).map(cb => cb.value);
              const format = form.querySelector('#content-format-sel').value;
              if (onAction) onAction({ action: data.actionKey, platforms: checked, formats: [format] });
            });
          }
        }, 50);
      }
      widget.appendChild(form);
      return widget;
    }

    // 5. Campaign Schedule Card
    if (type === 'card_schedule') {
      const today = new Date().toISOString().split('T')[0];
      const future = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const form = document.createElement('div');
      form.className = 'interactive-form';
      form.innerHTML = `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Start Date</label>
            <input type="date" class="form-control" id="sch-start" value="${today}" ${isOperatorView || !isLast ? 'disabled' : ''}/>
          </div>
          <div class="form-group">
            <label class="form-label">End Date</label>
            <input type="date" class="form-control" id="sch-end" value="${future}" ${isOperatorView || !isLast ? 'disabled' : ''}/>
          </div>
        </div>
        <div class="budget-calc-box">
          Calculated Duration: <span class="budget-calc-value" id="calc-duration-text">14 Days</span>
        </div>
        ${!isOperatorView && isLast ? `
          <button class="btn btn-primary btn-sm" id="btn-submit-sch">Set Campaign Schedule</button>
        ` : ''}
      `;

      if (!isOperatorView && isLast) {
        setTimeout(() => {
          const startIn = form.querySelector('#sch-start');
          const endIn = form.querySelector('#sch-end');
          const durText = form.querySelector('#calc-duration-text');
          const btn = form.querySelector('#btn-submit-sch');

          const updateDur = () => {
            const d = CampaignManager.calculateDuration(startIn.value, endIn.value);
            durText.textContent = `${d} Days`;
          };
          startIn.addEventListener('change', updateDur);
          endIn.addEventListener('change', updateDur);

          if (btn) {
            btn.addEventListener('click', () => {
              if (onAction) onAction({ action: data.actionKey, startDate: startIn.value, endDate: endIn.value });
            });
          }
        }, 50);
      }
      widget.appendChild(form);
      return widget;
    }

    // 6. Campaign Budget Card
    if (type === 'card_budget') {
      const duration = data.durationDays || 14;
      const form = document.createElement('div');
      form.className = 'interactive-form';
      form.innerHTML = `
        <div class="form-row">
          <div class="form-group" style="flex:2;">
            <label class="form-label">Total Advertising Budget</label>
            <input type="number" min="1000" step="500" class="form-control" id="bg-total" value="50000" ${isOperatorView || !isLast ? 'disabled' : ''}/>
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">Currency</label>
            <select class="form-control" id="bg-curr" ${isOperatorView || !isLast ? 'disabled' : ''}>
              <option value="BDT" selected>BDT (৳)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Preferred Daily Spend (Optional)</label>
            <input type="number" min="0" class="form-control" id="bg-daily" placeholder="e.g. 3000" ${isOperatorView || !isLast ? 'disabled' : ''}/>
          </div>
          <div class="form-group">
            <label class="form-label">Max Daily Cap (Optional)</label>
            <input type="number" min="0" class="form-control" id="bg-max" placeholder="e.g. 5000" ${isOperatorView || !isLast ? 'disabled' : ''}/>
          </div>
        </div>
        <div class="budget-calc-box">
          Estimated Average Daily Spend: <span class="budget-calc-value" id="calc-avg-daily">3,571 BDT/day</span> (${duration} days)
        </div>
        <div class="form-hint">
          *Note: Alias will clarify budget preferences but will never independently authorize ad spend.
        </div>
        ${!isOperatorView && isLast ? `
          <button class="btn btn-primary btn-sm" id="btn-submit-bg">Confirm Campaign Budget</button>
        ` : ''}
      `;

      if (!isOperatorView && isLast) {
        setTimeout(() => {
          const totalIn = form.querySelector('#bg-total');
          const avgText = form.querySelector('#calc-avg-daily');
          const currSel = form.querySelector('#bg-curr');
          const btn = form.querySelector('#btn-submit-bg');

          const updateAvg = () => {
            const tot = parseFloat(totalIn.value) || 0;
            const avg = CampaignManager.calculateAvgDaily(tot, duration);
            avgText.textContent = `${avg.toLocaleString()} ${currSel.value}/day`;
          };
          totalIn.addEventListener('input', updateAvg);
          currSel.addEventListener('change', updateAvg);

          if (btn) {
            btn.addEventListener('click', () => {
              const dailyIn = form.querySelector('#bg-daily');
              const maxIn = form.querySelector('#bg-max');
              if (onAction) onAction({
                action: data.actionKey,
                total: totalIn.value,
                currency: currSel.value,
                daily: dailyIn.value,
                maxDaily: maxIn.value
              });
            });
          }
        }, 50);
      }
      widget.appendChild(form);
      return widget;
    }

    // 7. Final Brief Summary Card
    if (type === 'card_brief_summary') {
      const brief = data.brief;
      const card = document.createElement('div');
      card.className = 'brief-card';
      card.innerHTML = `
        <div class="brief-card-header">
          <div style="font-weight:700; font-size:14px; color:var(--color-navy);">${brief.campaignName}</div>
          <span class="badge ${brief.isConfirmed ? 'badge-success' : 'badge-copilot'}">
            ${brief.isConfirmed ? 'Confirmed' : 'Draft Ready for Review'}
          </span>
        </div>
        <div class="brief-grid">
          <div>
            <div class="brief-field-label">Business & Product</div>
            <div class="brief-field-value">${brief.business.name} (${brief.business.industry})</div>
            <div style="font-size:11px; color:#64748b;">${brief.product.name}</div>
          </div>
          <div>
            <div class="brief-field-label">Primary Objective</div>
            <div class="brief-field-value">${brief.objectives.primary}</div>
            <div style="font-size:11px; color:#64748b;">Sec: ${brief.objectives.secondary}</div>
          </div>
          <div>
            <div class="brief-field-label">Target Audience</div>
            <div class="brief-field-value">${brief.audience.ageRange}, ${brief.audience.gender}</div>
            <div style="font-size:11px; color:#64748b;">${brief.audience.location}</div>
          </div>
          <div>
            <div class="brief-field-label">Channels & Formats</div>
            <div class="brief-field-value">${brief.mediaChannels.platforms}</div>
            <div style="font-size:11px; color:#64748b;">${brief.mediaChannels.contentFormats}</div>
          </div>
          <div>
            <div class="brief-field-label">Schedule</div>
            <div class="brief-field-value">${brief.schedule.durationDays}</div>
            <div style="font-size:11px; color:#64748b;">${brief.schedule.startDate} to ${brief.schedule.endDate}</div>
          </div>
          <div>
            <div class="brief-field-label">Budget</div>
            <div class="brief-field-value">${brief.budget.total}</div>
            <div style="font-size:11px; color:#64748b;">Avg: ${brief.budget.calculatedAvgDaily}</div>
          </div>
        </div>
        ${!brief.isConfirmed && !isOperatorView ? `
          <div class="brief-actions">
            <button class="btn btn-secondary btn-sm" id="btn-edit-brief">Edit Details</button>
            <button class="btn btn-primary btn-sm" id="btn-confirm-brief">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Confirm Campaign Brief
            </button>
          </div>
        ` : ''}
      `;

      if (!brief.isConfirmed && !isOperatorView) {
        setTimeout(() => {
          const confBtn = card.querySelector('#btn-confirm-brief');
          const editBtn = card.querySelector('#btn-edit-brief');
          if (confBtn) {
            confBtn.addEventListener('click', () => {
              if (onAction) onAction({ action: 'confirm_brief' });
            });
          }
          if (editBtn) {
            editBtn.addEventListener('click', () => {
              if (window.openBriefDrawer) window.openBriefDrawer();
            });
          }
        }, 50);
      }
      widget.appendChild(card);
      return widget;
    }

    return null;
  },

  scrollToBottom(containerEl) {
    if (!containerEl) return;
    setTimeout(() => {
      containerEl.scrollTop = containerEl.scrollHeight;
    }, 20);
  }
};

window.ChatRenderer = ChatRenderer;
if (typeof global !== 'undefined') {
  global.ChatRenderer = ChatRenderer;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatRenderer;
}

