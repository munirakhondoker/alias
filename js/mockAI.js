/**
 * ALIAS Intelligent Conversational Engine & Simulation Module
 * Simulates Agent 1 AI behavior, natural language extraction,
 * dynamic interactive widget generation, and Copilot response suggestions.
 */

const MockAIEngine = {
  /**
   * Evaluates incoming message and determines next conversational response & state updates
   */
  processCustomerMessage(convId, userText, explicitActionData = null) {
    const state = AliasState.get();
    const conv = state.conversations[convId];
    if (!conv) return null;

    const lowerText = (userText || '').toLowerCase().trim();

    // Check for explicit Human Operator request
    if (this.detectHumanRequest(lowerText)) {
      return this.handleHumanRequest(convId);
    }

    // Step-by-step intake progression
    const step = conv.stepIndex || 0;
    const campaign = conv.campaign;

    let aiResponse = null;
    let nextStep = step;

    // Handle interactive payload or text parsing
    if (explicitActionData) {
      const result = this.processInteractiveAction(explicitActionData, campaign, step);
      aiResponse = result.response;
      nextStep = result.nextStep;
    } else {
      const result = this.processNaturalLanguage(lowerText, userText, campaign, step);
      aiResponse = result.response;
      nextStep = result.nextStep;
    }

    // Commit the updated campaign and stepIndex to persistent state
    AliasState.update(s => {
      const c = s.conversations[convId];
      if (c) {
        c.campaign = campaign;
        if (nextStep !== null) c.stepIndex = nextStep;
      }
      return s;
    });

    // Return the generated message and updated step
    return {
      responseMessage: aiResponse,
      nextStepIndex: nextStep
    };
  },

  /**
   * Detects if customer explicitly requests human operator
   */
  detectHumanRequest(lowerText) {
    const keywords = ['human', 'operator', 'agent', 'person', 'support team', 'real human', 'talk to someone', 'representative'];
    return keywords.some(k => lowerText.includes(k));
  },

  /**
   * Handles customer request for a human operator
   */
  handleHumanRequest(convId) {
    AliasState.update(state => {
      const conv = state.conversations[convId];
      conv.status = 'Human Requested';
      conv.handler = 'human';
      conv.unreadCount = (conv.unreadCount || 0) + 1;
      return state;
    });

    AliasState.addAuditLog('human', `Customer in ${convId} requested a human operator.`);

    return {
      responseMessage: {
        id: 'msg-human-req-' + Date.now(),
        sender: 'ai',
        senderLabel: 'Alias AI Assistant',
        timestamp: this.getCurrentTime(),
        type: 'text',
        content: "I have notified our marketing operations team. A human campaign specialist will join shortly. In the meantime, you can continue answering the brief questions, or let us know if you have any urgent notes.",
        status: 'delivered'
      },
      nextStepIndex: null
    };
  },

  /**
   * Processes structured actions from interactive cards
   */
  processInteractiveAction(actionData, campaign, currentStep) {
    const action = actionData.action;

    switch (action) {
      case 'select_industry': {
        const industry = actionData.value;
        campaign.business.industry = industry;
        if (!campaign.business.description) {
          campaign.business.description = `Specialized ${industry} provider.`;
        }
        if (!campaign.business.productName) {
          campaign.business.productName = `${campaign.business.name || 'Core'} ${industry} Offer`;
        }
        if (!campaign.business.productDescription) {
          campaign.business.productDescription = `Signature product collection for ${industry}.`;
        }

        return {
          response: {
            id: 'msg-ai-' + Date.now(),
            sender: 'ai',
            senderLabel: 'Alias AI Assistant',
            timestamp: this.getCurrentTime(),
            type: 'text',
            content: `Could you describe your specific product or service, and what makes your offering unique compared to other brands (your Unique Selling Proposition)?`,
            status: 'delivered'
          },
          nextStep: 2
        };
      }

      case 'select_objective': {
        const objective = actionData.value;
        campaign.objective.primary = objective;

        // Contextual follow-up depending on objective
        if (objective === 'Sales / Conversions') {
          return {
            response: {
              id: 'msg-ai-' + Date.now(),
              sender: 'ai',
              senderLabel: 'Alias AI Assistant',
              timestamp: this.getCurrentTime(),
              type: 'quick_replies',
              content: `Focusing on **Sales / Conversions** requires optimizing for checkout points. Where will your customers complete their purchases?`,
              interactiveData: {
                title: 'Select primary purchase channel:',
                actionKey: 'select_sales_channel',
                options: [
                  { label: 'Shopify / E-Commerce Website', value: 'Shopify Website' },
                  { label: 'Instagram / Messenger DMs', value: 'Social DMs' },
                  { label: 'Physical Retail Store', value: 'Retail Store' },
                  { label: 'Marketplace (Amazon/Daraz)', value: 'Online Marketplace' }
                ]
              },
              status: 'delivered'
            },
            nextStep: 4
          };
        } else if (objective === 'Lead Generation') {
          return {
            response: {
              id: 'msg-ai-' + Date.now(),
              sender: 'ai',
              senderLabel: 'Alias AI Assistant',
              timestamp: this.getCurrentTime(),
              type: 'quick_replies',
              content: `Great! For **Lead Generation**, what qualifies as a successful lead for your team?`,
              interactiveData: {
                title: 'Select primary lead form type:',
                actionKey: 'select_lead_type',
                options: [
                  { label: 'Instant Form on Platform', value: 'Native Platform Lead Form' },
                  { label: 'Website Form / Demo Booking', value: 'Website Demo Request' },
                  { label: 'WhatsApp / Call Inquiry', value: 'Direct Phone / WhatsApp Contact' }
                ]
              },
              status: 'delivered'
            },
            nextStep: 4
          };
        } else {
          return {
            response: {
              id: 'msg-ai-' + Date.now(),
              sender: 'ai',
              senderLabel: 'Alias AI Assistant',
              timestamp: this.getCurrentTime(),
              type: 'card_audience',
              content: `Who is your **Target Audience**? Who are your primary buyers?`,
              interactiveData: {
                actionKey: 'submit_audience',
                ageOptions: ['18-24', '25-34', '35-44', '45+'],
                genderOptions: ['All', 'Female', 'Male'],
                locationOptions: ['Nationwide (Bangladesh)', 'Dhaka & Chittagong', 'Major Urban Centers', 'International'],
                customerTypes: ['B2C', 'B2B']
              },
              status: 'delivered'
            },
            nextStep: 5
          };
        }
      }

      case 'select_sales_channel':
      case 'select_lead_type': {
        const val = actionData.value;
        if (action === 'select_sales_channel') campaign.objective.salesLocation = val;
        else campaign.objective.leadDefinition = val;

        return {
          response: {
            id: 'msg-ai-' + Date.now(),
            sender: 'ai',
            senderLabel: 'Alias AI Assistant',
            timestamp: this.getCurrentTime(),
            type: 'card_audience',
            content: `Who is your **Target Audience**? Who is this campaign designed to reach?`,
            interactiveData: {
              actionKey: 'submit_audience',
              ageOptions: ['18-24', '25-34', '35-44', '45+'],
              genderOptions: ['All', 'Female', 'Male'],
              locationOptions: ['Nationwide (Bangladesh)', 'Dhaka & Chittagong', 'Major Urban Centers', 'International'],
              customerTypes: ['B2C', 'B2B']
            },
            status: 'delivered'
          },
          nextStep: 5
        };
      }

      case 'submit_audience': {
        const aud = actionData.data || {};
        campaign.audience.ageRange = aud.ageRange || '20-40';
        campaign.audience.gender = aud.gender || 'All';
        campaign.audience.location = aud.location || ['Dhaka'];
        campaign.audience.customerType = aud.customerType || 'B2C';
        campaign.audience.interests = aud.interests ? aud.interests.split(',').map(s => s.trim()) : ['Natural Skincare', 'Wellness'];

        return {
          response: {
            id: 'msg-ai-' + Date.now(),
            sender: 'ai',
            senderLabel: 'Alias AI Assistant',
            timestamp: this.getCurrentTime(),
            type: 'card_platforms',
            content: `Which **Advertising Platforms** and **Creative Formats** should we target?`,
            interactiveData: {
              actionKey: 'submit_platforms',
              platforms: ['Facebook', 'Instagram', 'LinkedIn', 'TikTok'],
              formats: ['Image advertisements', 'Video advertisements', 'Both', 'Let Alias recommend']
            },
            status: 'delivered'
          },
          nextStep: 6
        };
      }

      case 'submit_platforms': {
        const plats = actionData.platforms || ['Facebook', 'Instagram'];
        const formats = actionData.formats || ['Both'];
        campaign.platforms = plats;
        campaign.contentFormats = formats;

        return {
          response: {
            id: 'msg-ai-' + Date.now(),
            sender: 'ai',
            senderLabel: 'Alias AI Assistant',
            timestamp: this.getCurrentTime(),
            type: 'card_schedule',
            content: `What is your planned **Campaign Schedule**? Please choose start and end dates:`,
            interactiveData: {
              actionKey: 'submit_schedule'
            },
            status: 'delivered'
          },
          nextStep: 7
        };
      }

      case 'submit_schedule': {
        const sDate = actionData.startDate;
        const eDate = actionData.endDate;
        const duration = CampaignManager.calculateDuration(sDate, eDate);

        if (duration <= 0) {
          return {
            response: {
              id: 'msg-ai-' + Date.now(),
              sender: 'ai',
              senderLabel: 'Alias AI Assistant',
              timestamp: this.getCurrentTime(),
              type: 'card_schedule',
              content: `⚠️ End date must be on or after the start date. Please select valid campaign dates.`,
              interactiveData: { actionKey: 'submit_schedule' },
              status: 'delivered'
            },
            nextStep: 7
          };
        }

        campaign.schedule.startDate = sDate;
        campaign.schedule.endDate = eDate;
        campaign.schedule.durationDays = duration;

        return {
          response: {
            id: 'msg-ai-' + Date.now(),
            sender: 'ai',
            senderLabel: 'Alias AI Assistant',
            timestamp: this.getCurrentTime(),
            type: 'card_budget',
            content: `What is your total **Advertising Budget**? (Default currency is BDT)`,
            interactiveData: {
              actionKey: 'submit_budget',
              durationDays: duration
            },
            status: 'delivered'
          },
          nextStep: 8
        };
      }

      case 'submit_budget': {
        const total = parseFloat(actionData.total);
        const daily = actionData.daily ? parseFloat(actionData.daily) : null;
        const maxDaily = actionData.maxDaily ? parseFloat(actionData.maxDaily) : null;
        const currency = actionData.currency || 'BDT';

        const val = CampaignManager.validateBudget(total, daily, maxDaily);
        if (!val.valid) {
          return {
            response: {
              id: 'msg-ai-' + Date.now(),
              sender: 'ai',
              senderLabel: 'Alias AI Assistant',
              timestamp: this.getCurrentTime(),
              type: 'card_budget',
              content: `⚠️ ${val.error}\nPlease provide a valid budget:`,
              interactiveData: {
                actionKey: 'submit_budget',
                durationDays: campaign.schedule.durationDays || 14
              },
              status: 'delivered'
            },
            nextStep: 8
          };
        }

        campaign.budget.total = total;
        campaign.budget.currency = currency;
        campaign.budget.daily = daily;
        campaign.budget.maximumDaily = maxDaily;
        campaign.budget.calculatedAvgDaily = CampaignManager.calculateAvgDaily(total, campaign.schedule.durationDays);

        campaign.status = 'review';

        return {
          response: {
            id: 'msg-ai-' + Date.now(),
            sender: 'ai',
            senderLabel: 'Alias AI Assistant',
            timestamp: this.getCurrentTime(),
            type: 'card_brief_summary',
            content: `Thank you! All mandatory campaign requirements have been gathered.\n\nPlease review your complete **Campaign Brief Summary** below:`,
            interactiveData: {
              brief: CampaignManager.generateBriefSummary(campaign)
            },
            status: 'delivered'
          },
          nextStep: 9
        };
      }

      case 'confirm_brief': {
        campaign.status = 'confirmed';
        campaign.confirmed = true;

        return {
          response: {
            id: 'msg-ai-' + Date.now(),
            sender: 'ai',
            senderLabel: 'Alias AI Assistant',
            timestamp: this.getCurrentTime(),
            type: 'text',
            content: `✅ **Campaign Brief Confirmed!**\n\nYour campaign brief has been successfully completed and is ready for the Product Intelligence and Research stage.\n\n*Note: Confirming the campaign brief is NOT authorization to publish advertisements or spend money. This stage confirms the intake requirements collected by Agent 1.*`,
            status: 'delivered'
          },
          nextStep: 10
        };
      }

      default:
        return {
          response: {
            id: 'msg-ai-' + Date.now(),
            sender: 'ai',
            senderLabel: 'Alias AI Assistant',
            timestamp: this.getCurrentTime(),
            type: 'text',
            content: "Action received. Let's continue configuring your campaign brief.",
            status: 'delivered'
          },
          nextStep: currentStep
        };
    }
  },

  /**
   * Processes natural language responses when customer types in text input
   */
  processNaturalLanguage(lowerText, originalText, campaign, step) {
    // Check if customer is expressing uncertainty
    if (lowerText.includes("don't know") || lowerText.includes("not sure") || lowerText.includes("help me choose") || lowerText.includes("unsure")) {
      return this.handleUncertainCustomer(step, campaign);
    }

    // Step 0/1: Business & Industry
    if (step <= 1) {
      campaign.business.industry = campaign.business.industry || 'Handmade Skincare & Beauty';
      campaign.business.description = originalText;
      campaign.business.productName = campaign.business.productName || 'Organic Facial Serum & Herbal Soap';

      return {
        response: {
          id: 'msg-ai-' + Date.now(),
          sender: 'ai',
          senderLabel: 'Alias AI Assistant',
          timestamp: this.getCurrentTime(),
          type: 'card_objectives',
          content: `What is your **Primary Marketing Objective** for this campaign?`,
          interactiveData: {
            actionKey: 'select_objective',
            options: [
              { title: 'Brand Awareness', desc: 'Introduce your brand to fresh audiences.', icon: 'eye' },
              { title: 'Reach', desc: 'Maximize the number of people who see your ads.', icon: 'globe' },
              { title: 'Website Traffic', desc: 'Direct potential customers to your web store.', icon: 'external-link' },
              { title: 'Sales / Conversions', desc: 'Drive actual orders and revenue.', icon: 'shopping-bag' },
              { title: 'Lead Generation', desc: 'Capture customer contact information & inquiries.', icon: 'user-check' },
              { title: 'Engagement', desc: 'Increase social post likes, comments, and shares.', icon: 'message-circle' }
            ]
          },
          status: 'delivered'
        },
        nextStep: 3
      };
    }

    // Step 2: Product & USP
    if (step === 2) {
      campaign.business.productDescription = originalText;
      campaign.business.usp = originalText;

      return {
        response: {
          id: 'msg-ai-' + Date.now(),
          sender: 'ai',
          senderLabel: 'Alias AI Assistant',
          timestamp: this.getCurrentTime(),
          type: 'card_objectives',
          content: `What is the **Primary Marketing Objective** for this campaign?`,
          interactiveData: {
            actionKey: 'select_objective',
            options: [
              { title: 'Brand Awareness', desc: 'Introduce your brand to fresh audiences.' },
              { title: 'Reach', desc: 'Maximize impressions across your territory.' },
              { title: 'Website Traffic', desc: 'Drive clicks to your landing page.' },
              { title: 'Sales / Conversions', desc: 'Drive purchases and orders.' },
              { title: 'Lead Generation', desc: 'Collect qualified inquiries and forms.' },
              { title: 'Engagement', desc: 'Boost interactions and social proof.' }
            ]
          },
          status: 'delivered'
        },
        nextStep: 3
      };
    }

    // Step 3 / 4: Objective or follow-up
    if (step === 3 || step === 4) {
      // Check for objective keywords
      if (lowerText.includes('sale') || lowerText.includes('conversion') || lowerText.includes('buy')) {
        campaign.objective.primary = 'Sales / Conversions';
        campaign.objective.salesLocation = originalText;
      } else if (lowerText.includes('lead')) {
        campaign.objective.primary = 'Lead Generation';
        campaign.objective.leadDefinition = originalText;
      } else if (lowerText.includes('awareness') || lowerText.includes('reach')) {
        campaign.objective.primary = 'Brand Awareness';
      } else {
        campaign.objective.primary = campaign.objective.primary || 'Website Traffic';
      }

      return {
        response: {
          id: 'msg-ai-' + Date.now(),
          sender: 'ai',
          senderLabel: 'Alias AI Assistant',
          timestamp: this.getCurrentTime(),
          type: 'card_audience',
          content: `Who is your **Target Audience** (age, gender, target locations, or interests)?`,
          interactiveData: {
            actionKey: 'submit_audience',
            ageOptions: ['18-24', '25-34', '35-44', '45+'],
            genderOptions: ['All', 'Female', 'Male'],
            locationOptions: ['Nationwide (Bangladesh)', 'Dhaka & Chittagong', 'Major Urban Centers', 'International'],
            customerTypes: ['B2C', 'B2B']
          },
          status: 'delivered'
        },
        nextStep: 5
      };
    }

    // Step 5: Audience free text
    if (step === 5) {
      campaign.audience.description = originalText;
      // Extract age if present
      if (lowerText.includes('women') || lowerText.includes('female')) campaign.audience.gender = 'Female';
      else if (lowerText.includes('men') || lowerText.includes('male')) campaign.audience.gender = 'Male';
      else campaign.audience.gender = 'All';

      campaign.audience.ageRange = '20-40';
      campaign.audience.location = ['Dhaka', 'Major Cities'];

      return {
        response: {
          id: 'msg-ai-' + Date.now(),
          sender: 'ai',
          senderLabel: 'Alias AI Assistant',
          timestamp: this.getCurrentTime(),
          type: 'card_platforms',
          content: `Which **Advertising Platforms** and formats should we select?`,
          interactiveData: {
            actionKey: 'submit_platforms',
            platforms: ['Facebook', 'Instagram', 'LinkedIn', 'TikTok'],
            formats: ['Image advertisements', 'Video advertisements', 'Both', 'Let Alias recommend']
          },
          status: 'delivered'
        },
        nextStep: 6
      };
    }

    // Step 6: Platforms free text
    if (step === 6) {
      const selected = [];
      if (lowerText.includes('facebook') || lowerText.includes('fb')) selected.push('Facebook');
      if (lowerText.includes('instagram') || lowerText.includes('ig')) selected.push('Instagram');
      if (lowerText.includes('linkedin')) selected.push('LinkedIn');
      if (lowerText.includes('tiktok')) selected.push('TikTok');
      campaign.platforms = selected.length ? selected : ['Facebook', 'Instagram'];
      campaign.contentFormats = ['Both'];

      return {
        response: {
          id: 'msg-ai-' + Date.now(),
          sender: 'ai',
          senderLabel: 'Alias AI Assistant',
          timestamp: this.getCurrentTime(),
          type: 'card_schedule',
          content: `Please select your campaign schedule dates:`,
          interactiveData: { actionKey: 'submit_schedule' },
          status: 'delivered'
        },
        nextStep: 7
      };
    }

    // Step 7: Schedule free text
    if (step === 7) {
      campaign.schedule.startDate = '2026-12-01';
      campaign.schedule.endDate = '2026-12-20';
      campaign.schedule.durationDays = 20;

      return {
        response: {
          id: 'msg-ai-' + Date.now(),
          sender: 'ai',
          senderLabel: 'Alias AI Assistant',
          timestamp: this.getCurrentTime(),
          type: 'card_budget',
          content: `What is your total **Advertising Budget** in BDT?`,
          interactiveData: {
            actionKey: 'submit_budget',
            durationDays: 20
          },
          status: 'delivered'
        },
        nextStep: 8
      };
    }

    // Step 8: Budget text parsing
    if (step === 8) {
      const numbers = originalText.match(/\d[\d,.]*/g);
      let parsedNum = 50000;
      if (numbers && numbers.length > 0) {
        parsedNum = parseFloat(numbers[0].replace(/,/g, ''));
      }
      campaign.budget.total = parsedNum;
      campaign.budget.currency = 'BDT';
      campaign.budget.calculatedAvgDaily = Math.round(parsedNum / (campaign.schedule.durationDays || 20));
      campaign.status = 'review';

      return {
        response: {
          id: 'msg-ai-' + Date.now(),
          sender: 'ai',
          senderLabel: 'Alias AI Assistant',
          timestamp: this.getCurrentTime(),
          type: 'card_brief_summary',
          content: `All required sections have been completed with your budget of **${parsedNum.toLocaleString()} BDT**.\n\nHere is your full **Campaign Brief Summary**:`,
          interactiveData: {
            brief: CampaignManager.generateBriefSummary(campaign)
          },
          status: 'delivered'
        },
        nextStep: 9
      };
    }

    // Default conversational continuation
    return {
      response: {
        id: 'msg-ai-' + Date.now(),
        sender: 'ai',
        senderLabel: 'Alias AI Assistant',
        timestamp: this.getCurrentTime(),
        type: 'text',
        content: `What additional details regarding your target audience, platforms, or budget can you share for this campaign?`,
        status: 'delivered'
      },
      nextStep: step
    };
  },

  /**
   * Helper when customer is unsure or asks for recommendation
   */
  handleUncertainCustomer(step, campaign) {
    if (step === 3 || step === 4) {
      return {
        response: {
          id: 'msg-ai-' + Date.now(),
          sender: 'ai',
          senderLabel: 'Alias AI Assistant',
          timestamp: this.getCurrentTime(),
          type: 'text',
          content: "No problem! For e-commerce businesses starting out, **Sales / Conversions** or **Website Traffic** are usually the most cost-effective. Would you like to select **Sales / Conversions** to drive direct orders?",
          status: 'delivered'
        },
        nextStep: step
      };
    }
    if (step === 5) {
      return {
        response: {
          id: 'msg-ai-' + Date.now(),
          sender: 'ai',
          senderLabel: 'Alias AI Assistant',
          timestamp: this.getCurrentTime(),
          type: 'text',
          content: "I recommend targeting **women aged 22–38** in major metropolitan areas (Dhaka, Chittagong, Sylhet) who follow natural beauty and organic lifestyle pages. Would that suit your target customer?",
          status: 'delivered'
        },
        nextStep: step
      };
    }

    return {
      response: {
        id: 'msg-ai-' + Date.now(),
        sender: 'ai',
        senderLabel: 'Alias AI Assistant',
        timestamp: this.getCurrentTime(),
        type: 'text',
        content: "Don't worry! Alias can recommend industry benchmark parameters based on similar successful campaigns. Feel free to pick from our suggested options.",
        status: 'delivered'
      },
      nextStep: step
    };
  },

  /**
   * Generates Copilot response drafts for the human operator to review, edit, or send
   */
  generateCopilotDraft(customerMessage, conv) {
    const text = (customerMessage.content || '').toLowerCase();
    const campaign = conv.campaign || {};
    let draftText = '';

    if (text.includes('budget') || text.includes('cost') || text.includes('price')) {
      draftText = `Based on current ad auction rates in Bangladesh, a daily budget of 2,000–3,500 BDT delivers approximately 8,000–12,000 targeted impressions across Instagram and Facebook. We can start with this baseline to test your return on ad spend.`;
    } else if (text.includes('duration') || text.includes('how long') || text.includes('days')) {
      draftText = `We typically recommend running a promotional campaign for at least 14 to 21 days. This gives the platform algorithms sufficient data to exit the learning phase and optimize for the lowest cost-per-conversion.`;
    } else if (text.includes('video') || text.includes('photo') || text.includes('format')) {
      draftText = `For ${campaign.business.industry || 'your product'}, short vertical video reels (9:16 format, 15–30 seconds) showing product texture and customer demonstrations yield 40% higher engagement than static image carousels alone.`;
    } else if (text.includes('human') || text.includes('someone') || text.includes('help')) {
      draftText = `Hello! I'm an operator on the Alias campaign specialist team. I'm reviewing your brief details now and am here to assist with any custom requirements or platform questions.`;
    } else {
      draftText = `Thank you for sharing that. I have updated your brief parameters accordingly. Let's make sure we review your primary target demographics before finalizing the budget.`;
    }

    return {
      id: 'draft-' + Date.now(),
      text: draftText,
      originalText: draftText,
      generatedAt: this.getCurrentTime(),
      status: 'pending'
    };
  },

  /**
   * Generates proactive AI suggestions, talking points, and smart prompts
   * by analyzing the live conversation history and campaign brief state
   */
  /**
   * Generates proactive, dynamic AI questions based on conversation context,
   * customer responses, and missing brief information.
   * Clean and streamlined - no unnecessary essays or static fluff.
   */
  generateSuggestions(conv) {
    if (!conv) return null;
    const campaign = conv.campaign || {};
    const msgs = conv.messages || [];
    const step = conv.stepIndex || 0;
    const businessName = conv.businessName || 'the customer';
    const industry = (campaign.business && campaign.business.industry) || 'general commerce';

    const lastCustMsg = [...msgs].reverse().find(m => m.sender === 'customer');
    const custText = lastCustMsg ? (lastCustMsg.content || '').toLowerCase() : '';

    // Check if brief is complete
    let isComplete = false;
    let missingSecs = [];
    if (typeof CampaignManager !== 'undefined') {
      const p = CampaignManager.calculateProgress(campaign);
      isComplete = p.isComplete || Boolean(campaign.confirmed);
      if (p.sections) {
        Object.keys(p.sections).forEach(k => {
          if (p.sections[k].status !== 'completed') {
            missingSecs.push(p.sections[k]);
          }
        });
      }
    }

    if (isComplete) {
      return {
        stage: 'Campaign Brief Finalized',
        questions: [
          {
            tag: 'Intake Sign-off',
            title: 'Confirm & Advance Pipeline',
            text: `Your campaign brief for ${businessName} is fully compiled and ready. Shall we proceed to advance this to Agent 2 for Product Intelligence & Market Research?`
          },
          {
            tag: 'Audience Strategy',
            title: 'Confirm Demographic Profile',
            text: `Before our creative team produces ads, would you like to review the finalized audience targeting settings for ${businessName}?`
          },
          {
            tag: 'Deliverable Copy',
            title: 'Send Brief Summary to Email',
            text: `Would you like a summarized copy of this finalized campaign brief sent to your registered email address?`
          }
        ]
      };
    }

    // Dynamic questions tailored to what customer just said or current stage
    if (custText.includes('budget') || custText.includes('cost') || custText.includes('bdt') || custText.includes('tk') || step >= 5) {
      return {
        stage: 'Budget & Flight Duration',
        questions: [
          {
            tag: 'Budget Guidance',
            title: 'Recommended Budget Range',
            text: `For ${industry}, an initial budget of 30,000–50,000 BDT over 14 to 21 days provides sufficient conversion data for algorithm learning. Would that fit your plan?`
          },
          {
            tag: 'Daily Spend Cap',
            title: 'Specify Daily Cap',
            text: `What is your target maximum daily ad spend in BDT to ensure we don't exceed your threshold?`
          },
          {
            tag: 'Pacing Strategy',
            title: 'Flight Pacing Preference',
            text: `Would you prefer an equal daily spend distribution or heavier ad delivery on weekends when shopper activity peaks?`
          },
          {
            tag: 'Timeline',
            title: 'Confirm Launch Schedule',
            text: `What is your target start date for this campaign, and how many weeks would you like the flight to run?`
          }
        ]
      };
    }

    if (custText.includes('platform') || custText.includes('facebook') || custText.includes('instagram') || custText.includes('google') || custText.includes('reels') || step === 4) {
      return {
        stage: 'Advertising Channels & Formats',
        questions: [
          {
            tag: 'Channel Mix',
            title: 'Recommended Channel Mix',
            text: `For ${businessName}, short-form video reels on Instagram & Facebook paired with targeted Google Search intent usually deliver the best ROI. Shall we structure around those?`
          },
          {
            tag: 'Creative Assets',
            title: 'Vertical Video Readiness',
            text: `Do you currently have vertical video assets (Reels/TikTok style) ready, or would you like our creative studio to produce them?`
          },
          {
            tag: 'Ad Placements',
            title: 'Feed vs Story Placements',
            text: `Would you like to include automatic story placements to maximize reach across younger mobile audiences?`
          },
          {
            tag: 'Destination',
            title: 'Traffic Destination',
            text: `Where should the ads direct prospective customers—to your website product page, a WhatsApp chat, or Facebook Messenger?`
          }
        ]
      };
    }

    if (custText.includes('audience') || custText.includes('age') || custText.includes('city') || custText.includes('dhaka') || (step >= 2 && step <= 3)) {
      return {
        stage: 'Target Audience & Geography',
        questions: [
          {
            tag: 'Audience Profile',
            title: 'Core Buyer Persona',
            text: `Based on your ${industry} focus, we suggest targeting age 22–38 in major urban centers. What age demographic represents your highest-value customers?`
          },
          {
            tag: 'Geo-Targeting',
            title: 'Geographic Coverage',
            text: `Are you delivering products nationwide across Bangladesh, or focusing primarily on major metro areas like Dhaka and Chittagong?`
          },
          {
            tag: 'Interests & Behaviors',
            title: 'Buyer Lifestyle Interests',
            text: `What specific lifestyle interests, hobbies, or shopping behaviors characterize your ideal buyer for ${businessName}?`
          },
          {
            tag: 'Gender Split',
            title: 'Gender Targeting Preference',
            text: `Should the campaign target all genders equally, or does ${businessName} cater primarily to men or women?`
          }
        ]
      };
    }

    // Default: Initial Intake & Business Info
    return {
      stage: 'Business & Value Proposition',
      questions: [
        {
          tag: 'Unique Value',
          title: 'Core Differentiator (USP)',
          text: `To craft compelling ad copy, could you share what unique advantage makes ${businessName} stand out from local competitors?`
        },
        {
          tag: 'Product Highlight',
          title: 'Hero Product Focus',
          text: `Which specific product or service should take center stage in this campaign to drive the strongest immediate conversions?`
        },
        {
          tag: 'Digital Presence',
          title: 'Catalog & Website Link',
          text: `Could you share your website, Facebook page, or product catalog link for ${businessName}?`
        },
        {
          tag: 'Marketing Goal',
          title: 'Primary Campaign Objective',
          text: `Is your primary objective for this campaign direct sales/purchases, generating customer inquiries/leads, or broad brand awareness?`
        }
      ]
    };
  },

  /**
   * Generates a tailored AI question specifically to elicit missing fields
   * for a given Campaign Brief intake section.
   */
  generateMissingFieldQuestion(sectionKey, missingFields = [], businessName = 'your business') {
    const missingStr = missingFields.join(', ');
    switch (sectionKey) {
      case 'business':
        if (missingFields.some(f => f.toLowerCase().includes('usp'))) {
          return `Could you share what makes ${businessName} unique and sets your products apart from competitors in your market?`;
        }
        if (missingFields.some(f => f.toLowerCase().includes('website'))) {
          return `Could you provide your official website URL or social store link for ${businessName}?`;
        }
        return `Could you share a brief overview of the product or service you'd like to promote for ${businessName}?`;

      case 'objective':
        return `What is your primary commercial goal for this campaign—direct sales/orders, qualified lead inquiries, or brand awareness?`;

      case 'audience':
        if (missingFields.some(f => f.toLowerCase().includes('location'))) {
          return `Which geographic regions or cities (e.g. Dhaka, nationwide) should we target for ${businessName}?`;
        }
        return `What age range and demographics represent your ideal target customers for this campaign?`;

      case 'platforms':
        return `Which advertising channels (such as Facebook, Instagram Reels, Google Search, or YouTube) would you like to focus on?`;

      case 'schedule':
        return `When would you like this campaign to launch, and what is your intended flight duration (in days or weeks)?`;

      case 'budget':
        return `What is your target overall advertising budget (in BDT or USD) for this campaign duration?`;

      default:
        return `Could you provide additional details regarding ${missingStr || 'this section'} for ${businessName}?`;
    }
  },
  getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
};

if (typeof window !== 'undefined') {
  window.MockAIEngine = MockAIEngine;
}
if (typeof global !== 'undefined') {
  global.MockAIEngine = MockAIEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MockAIEngine;
}

