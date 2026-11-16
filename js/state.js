/**
 * ALIAS Agent 1 - Central State Store & Cross-Tab Synchronizer
 * Manages conversation history, campaign data, AI collaboration modes,
 * and synchronizes state between Customer and Operator views via localStorage.
 */

const STORAGE_KEY = 'alias_agent1_store_v1';
const STATE_EVENT = 'alias:state_updated';

// Initial default state with realistic enterprise mock data
const DEFAULT_STATE = {
  activeConversationId: 'demo-001',
  globalAiEnabled: true,
  globalCopilotEnabled: true,
  scheduledModeEnabled: false,
  takeoverDelaySeconds: 15, // Default fast demo delay (15s), configurable to 2m, 5m, 10m, 15m
  demoFastMode: true,
  operatorPresence: 'present', // 'present' (At Desk - Review Mode) | 'away' (Unattended - Immediate Auto-Send)
  aiReviewDelaySeconds: 15, // Pre-send review window for AI auto-responses (15s default, 5s, 10s, 30s, or 0)
  scheduleSettings: {
    humanStart: '09:00',
    humanEnd: '17:00',
    aiStart: '17:00',
    aiEnd: '09:00',
    workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    timezone: 'Asia/Dhaka (GMT+6)'
  },
  auditLogs: [
    {
      id: 'log-1',
      timestamp: '10:45 AM',
      type: 'system',
      text: 'Alias Platform initialized. Agent 1 (Campaign Intake) ready.'
    },
    {
      id: 'log-2',
      timestamp: '10:50 AM',
      type: 'ai',
      text: 'Conversation demo-001 connected. Mode: AI Automatic.'
    }
  ],
  conversations: {
    'demo-001': {
      id: 'demo-001',
      customerName: 'Tanvir Ahmed',
      businessName: 'Lumina Natural Skincare',
      unreadCount: 0,
      mode: 'auto', // 'auto' | 'human' | 'copilot'
      handler: 'ai', // 'ai' | 'human'
      status: 'AI Active', // 'AI Active' | 'Human Active' | 'AI Copilot' | 'Waiting for Human' | 'Human Requested' | 'Paused'
      aiEnabled: true,
      humanAvailable: true,
      takeoverTimerStartedAt: null,
      pendingDraft: null,
      stepIndex: 0,
      campaign: {
        business: {
          name: 'Lumina Natural Skincare',
          industry: '',
          description: '',
          productName: '',
          productDescription: '',
          usp: '',
          websiteUrl: 'https://luminaskincare.com',
          productPrice: '',
          brandGuidelines: ''
        },
        objective: {
          primary: '',
          secondary: [],
          salesLocation: '',
          leadDefinition: ''
        },
        audience: {
          ageRange: '',
          gender: '',
          location: [],
          interests: [],
          customerType: 'B2C',
          description: ''
        },
        platforms: [],
        contentFormats: [],
        schedule: {
          startDate: '',
          endDate: '',
          durationDays: 0
        },
        budget: {
          total: 0,
          currency: 'BDT',
          daily: null,
          maximumDaily: null,
          calculatedAvgDaily: 0
        },
        status: 'draft',
        confirmed: false
      },
      messages: [
        {
          id: 'msg-init-1',
          sender: 'ai',
          senderLabel: 'Alias AI Assistant',
          timestamp: '10:50 AM',
          type: 'text',
          content: "Hello! I'm Alias, your AI Campaign Brief Assistant. I will guide you through preparing your digital advertising brief for automated campaign launch.",
          status: 'delivered'
        },
        {
          id: 'msg-init-2',
          sender: 'ai',
          senderLabel: 'Alias AI Assistant',
          timestamp: '10:50 AM',
          type: 'quick_replies',
          content: "To begin, what product or service would you like to advertise today? You can select a common category below or type your answer.",
          interactiveData: {
            title: "Select your industry or category:",
            options: [
              { label: "Handmade Skincare", value: "Handmade Skincare" },
              { label: "B2B Cloud Software", value: "B2B SaaS" },
              { label: "Fashion & Apparel", value: "Fashion Retail" },
              { label: "Specialty Cafe & Food", value: "Restaurant & Food" }
            ]
          },
          status: 'delivered'
        }
      ]
    },
    'demo-002': {
      id: 'demo-002',
      customerName: 'Farhan Karim',
      businessName: 'Apex Cloud Systems',
      unreadCount: 1,
      mode: 'copilot',
      handler: 'human',
      status: 'AI Copilot',
      aiEnabled: true,
      humanAvailable: true,
      takeoverTimerStartedAt: null,
      pendingDraft: {
        id: 'draft-demo-002',
        text: "Hi Farhan! For Apex Cloud's B2B ERP launch, LinkedIn Lead Gen forms combined with Google search ads typically offer the highest conversion rates. Would you like us to structure the brief around decision-maker targeting (CTOs & IT Directors)?",
        originalText: "Hi Farhan! For Apex Cloud's B2B ERP launch, LinkedIn Lead Gen forms combined with Google search ads typically offer the highest conversion rates. Would you like us to structure the brief around decision-maker targeting (CTOs & IT Directors)?",
        generatedAt: '10:48 AM',
        status: 'pending'
      },
      stepIndex: 3,
      campaign: {
        business: {
          name: 'Apex Cloud Systems',
          industry: 'B2B Software',
          description: 'Cloud ERP software for mid-sized manufacturers in South Asia.',
          productName: 'ApexFlow ERP',
          productDescription: 'Automated warehouse & inventory tracking module.',
          usp: 'Implementation in under 14 days with zero downtime.',
          websiteUrl: 'https://apexcloud.io',
          productPrice: '25,000 BDT/mo',
          brandGuidelines: 'Corporate blue & white'
        },
        objective: {
          primary: 'Lead Generation',
          secondary: ['Brand Awareness'],
          salesLocation: 'Online Demo Request Form',
          leadDefinition: 'Verified Business Email & Phone Number'
        },
        audience: {
          ageRange: '30-55',
          gender: 'All',
          location: ['Dhaka', 'Chittagong'],
          interests: ['Enterprise Software', 'Supply Chain Management'],
          customerType: 'B2B',
          description: 'Factory owners and IT Procurement Managers'
        },
        platforms: ['LinkedIn'],
        contentFormats: ['Both'],
        schedule: {
          startDate: '2026-12-01',
          endDate: '2026-12-31',
          durationDays: 30
        },
        budget: {
          total: 150000,
          currency: 'BDT',
          daily: 5000,
          maximumDaily: 6000,
          calculatedAvgDaily: 5000
        },
        status: 'draft',
        confirmed: false
      },
      messages: [
        {
          id: 'msg-002-1',
          sender: 'customer',
          senderLabel: 'Farhan Karim',
          timestamp: '10:40 AM',
          type: 'text',
          content: "We want to launch ApexFlow ERP next month. What platforms do you suggest for reaching industrial plant managers?",
          status: 'read'
        }
      ]
    },
    'demo-003': {
      id: 'demo-003',
      customerName: 'Nusrat Jahan',
      businessName: 'Vintage Denims Ltd',
      unreadCount: 2,
      mode: 'human',
      handler: 'human',
      status: 'Waiting for Human',
      aiEnabled: true,
      humanAvailable: false,
      takeoverTimerStartedAt: Date.now() - 8000, // waiting simulation
      pendingDraft: null,
      stepIndex: 2,
      campaign: {
        business: {
          name: 'Vintage Denims Ltd',
          industry: 'Fashion & Apparel',
          description: 'Sustainable handcrafted raw denim jeans and jackets.',
          productName: 'Winter Denim Jacket 2026',
          productDescription: 'Japanese selvedge denim lined with organic fleece.',
          usp: 'Ethically dyed with zero water waste.',
          websiteUrl: 'https://vintagedenims.com',
          productPrice: '4,500 BDT',
          brandGuidelines: 'Indigo & earth tones'
        },
        objective: {
          primary: 'Sales / Conversions',
          secondary: ['Reach'],
          salesLocation: 'Shopify Website Checkout',
          leadDefinition: ''
        },
        audience: {
          ageRange: '20-35',
          gender: 'All',
          location: ['Dhaka', 'Sylhet'],
          interests: ['Streetwear', 'Sustainable Fashion'],
          customerType: 'B2C',
          description: 'Urban youth interested in sustainable fashion'
        },
        platforms: ['Instagram', 'Facebook'],
        contentFormats: ['Video advertisements'],
        schedule: {
          startDate: '2026-11-20',
          endDate: '2026-12-05',
          durationDays: 15
        },
        budget: {
          total: 60000,
          currency: 'BDT',
          daily: 4000,
          maximumDaily: 5000,
          calculatedAvgDaily: 4000
        },
        status: 'draft',
        confirmed: false
      },
      messages: [
        {
          id: 'msg-003-1',
          sender: 'customer',
          senderLabel: 'Nusrat Jahan',
          timestamp: '10:42 AM',
          type: 'text',
          content: "Hi! Can an operator help me calculate what budget I need for 10,000 video views in Dhaka?",
          status: 'unread'
        },
        {
          id: 'msg-003-2',
          sender: 'customer',
          senderLabel: 'Nusrat Jahan',
          timestamp: '10:44 AM',
          type: 'text',
          content: "Is anyone online? I need guidance before proceeding.",
          status: 'unread'
        }
      ]
    },
    'demo-004': {
      id: 'demo-004',
      customerName: 'Arif Chowdhury',
      businessName: 'FreshBite Express',
      unreadCount: 0,
      mode: 'auto',
      handler: 'ai',
      status: 'AI Active',
      aiEnabled: true,
      humanAvailable: true,
      takeoverTimerStartedAt: null,
      pendingDraft: null,
      stepIndex: 10,
      campaign: {
        business: {
          name: 'FreshBite Express',
          industry: 'Food & Beverage',
          description: 'Healthy chef-curated meal subscriptions delivered to offices.',
          productName: 'Corporate Healthy Lunch Plan',
          productDescription: 'Fresh calorie-counted meals delivered daily at 12 PM.',
          usp: 'Dietitian certified with free doorstep delivery.',
          websiteUrl: 'https://freshbite.delivery',
          productPrice: '350 BDT/meal',
          brandGuidelines: 'Green & fresh orange'
        },
        objective: {
          primary: 'Sales / Conversions',
          secondary: ['Website Traffic'],
          salesLocation: 'Mobile App and Website',
          leadDefinition: ''
        },
        audience: {
          ageRange: '24-45',
          gender: 'All',
          location: ['Gulshan', 'Banani', 'Dhanmondi'],
          interests: ['Fitness', 'Healthy Eating', 'Corporate Lifestyle'],
          customerType: 'B2C',
          description: 'Corporate executives and office professionals'
        },
        platforms: ['Facebook', 'Instagram'],
        contentFormats: ['Both'],
        schedule: {
          startDate: '2026-11-25',
          endDate: '2026-12-25',
          durationDays: 30
        },
        budget: {
          total: 80000,
          currency: 'BDT',
          daily: 2666,
          maximumDaily: 3500,
          calculatedAvgDaily: 2666
        },
        status: 'confirmed',
        confirmed: true
      },
      messages: [
        {
          id: 'msg-004-1',
          sender: 'ai',
          senderLabel: 'Alias AI Assistant',
          timestamp: '09:30 AM',
          type: 'text',
          content: "Your campaign brief has been successfully completed and is ready for the Product Intelligence and Research stage.",
          status: 'delivered'
        }
      ]
    }
  }
};

/**
 * Loads current state from localStorage or initializes with default
 */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveState(DEFAULT_STATE);
      return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
    const parsed = JSON.parse(raw);
    // Ensure vital keys exist if schema updated
    if (!parsed.conversations) {
      saveState(DEFAULT_STATE);
      return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
    // Migration helpers for pre-send review window & presence
    if (parsed.operatorPresence === undefined) parsed.operatorPresence = 'present';
    if (parsed.aiReviewDelaySeconds === undefined) parsed.aiReviewDelaySeconds = 15;
    Object.keys(parsed.conversations).forEach(k => {
      const c = parsed.conversations[k];
      if (c.pendingAutoSend === undefined) {
        c.pendingAutoSend = null;
      } else if (c.pendingAutoSend) {
        // If mode is human and pendingAutoSend exists, ensure isPaused is true
        if (c.mode === 'human') {
          c.pendingAutoSend.isPaused = true;
          if (c.pendingAutoSend.pausedRemainingSeconds === undefined) {
            c.pendingAutoSend.pausedRemainingSeconds = c.pendingAutoSend.remainingSeconds || 5;
          }
        } else if (!c.pendingAutoSend.isPaused && !c.pendingAutoSend.expiresAt) {
          const sec = c.pendingAutoSend.remainingSeconds || 15;
          c.pendingAutoSend.expiresAt = Date.now() + (sec * 1000);
        }
      }
    });
    return parsed;
  } catch (err) {
    console.warn('Failed to parse localStorage state, resetting:', err);
    saveState(DEFAULT_STATE);
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

/**
 * Saves state to localStorage and broadcasts update event
 */
function saveState(newState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    // Dispatch local custom event for the same tab
    window.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: newState }));
  } catch (err) {
    console.error('Failed to save state to localStorage:', err);
  }
}

/**
 * State mutation helper
 */
function updateState(mutationFn) {
  const current = loadState();
  const next = mutationFn(current) || current;
  saveState(next);
  return next;
}

/**
 * Reset state to fresh demo values
 */
function resetState() {
  saveState(DEFAULT_STATE);
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

/**
 * Add a record to system audit logs
 */
function addAuditLog(type, text) {
  updateState(state => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    state.auditLogs.unshift({
      id: 'log-' + Date.now(),
      timestamp: timeStr,
      type: type, // 'ai' | 'human' | 'system'
      text: text
    });
    if (state.auditLogs.length > 50) {
      state.auditLogs.pop();
    }
    return state;
  });
}

/**
 * Listen for state changes (both same tab and cross-tab via 'storage' event)
 */
function onStateChange(callback) {
  // Same tab event
  const localHandler = (e) => callback(e.detail);
  window.addEventListener(STATE_EVENT, localHandler);

  // Cross-tab storage event
  const storageHandler = (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        callback(parsed);
      } catch (err) {
        console.error('Error handling cross-tab storage sync:', err);
      }
    }
  };
  window.addEventListener('storage', storageHandler);

  return () => {
    window.removeEventListener(STATE_EVENT, localHandler);
    window.removeEventListener('storage', storageHandler);
  };
}

// Expose state API globally for clean vanilla JS access
const AliasStateObj = {
  get: loadState,
  save: saveState,
  update: updateState,
  reset: resetState,
  addAuditLog: addAuditLog,
  subscribe: onStateChange,
  DEFAULT: DEFAULT_STATE
};

if (typeof window !== 'undefined') {
  window.AliasState = AliasStateObj;
}
if (typeof global !== 'undefined') {
  global.AliasState = AliasStateObj;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AliasStateObj;
}

