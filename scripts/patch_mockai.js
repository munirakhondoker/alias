const fs = require('fs');

let code = fs.readFileSync('js/mockAI.js', 'utf8');

const targetMethod = '  generateSuggestions(conv) {';
const startIndex = code.indexOf(targetMethod);
if (startIndex === -1) {
  console.error('Target method not found');
  process.exit(1);
}

const endMarker = '  getCurrentTime() {';
const endIndex = code.indexOf(endMarker);
if (endIndex === -1) {
  console.error('End marker not found');
  process.exit(1);
}

const newMethods = `  /**
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
            text: \`Your campaign brief for \${businessName} is fully compiled and ready. Shall we proceed to advance this to Agent 2 for Product Intelligence & Market Research?\`
          },
          {
            tag: 'Audience Strategy',
            title: 'Confirm Demographic Profile',
            text: \`Before our creative team produces ads, would you like to review the finalized audience targeting settings for \${businessName}?\`
          },
          {
            tag: 'Deliverable Copy',
            title: 'Send Brief Summary to Email',
            text: \`Would you like a summarized copy of this finalized campaign brief sent to your registered email address?\`
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
            text: \`For \${industry}, an initial budget of 30,000–50,000 BDT over 14 to 21 days provides sufficient conversion data for algorithm learning. Would that fit your plan?\`
          },
          {
            tag: 'Daily Spend Cap',
            title: 'Specify Daily Cap',
            text: \`What is your target maximum daily ad spend in BDT to ensure we don't exceed your threshold?\`
          },
          {
            tag: 'Pacing Strategy',
            title: 'Flight Pacing Preference',
            text: \`Would you prefer an equal daily spend distribution or heavier ad delivery on weekends when shopper activity peaks?\`
          },
          {
            tag: 'Timeline',
            title: 'Confirm Launch Schedule',
            text: \`What is your target start date for this campaign, and how many weeks would you like the flight to run?\`
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
            text: \`For \${businessName}, short-form video reels on Instagram & Facebook paired with targeted Google Search intent usually deliver the best ROI. Shall we structure around those?\`
          },
          {
            tag: 'Creative Assets',
            title: 'Vertical Video Readiness',
            text: \`Do you currently have vertical video assets (Reels/TikTok style) ready, or would you like our creative studio to produce them?\`
          },
          {
            tag: 'Ad Placements',
            title: 'Feed vs Story Placements',
            text: \`Would you like to include automatic story placements to maximize reach across younger mobile audiences?\`
          },
          {
            tag: 'Destination',
            title: 'Traffic Destination',
            text: \`Where should the ads direct prospective customers—to your website product page, a WhatsApp chat, or Facebook Messenger?\`
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
            text: \`Based on your \${industry} focus, we suggest targeting age 22–38 in major urban centers. What age demographic represents your highest-value customers?\`
          },
          {
            tag: 'Geo-Targeting',
            title: 'Geographic Coverage',
            text: \`Are you delivering products nationwide across Bangladesh, or focusing primarily on major metro areas like Dhaka and Chittagong?\`
          },
          {
            tag: 'Interests & Behaviors',
            title: 'Buyer Lifestyle Interests',
            text: \`What specific lifestyle interests, hobbies, or shopping behaviors characterize your ideal buyer for \${businessName}?\`
          },
          {
            tag: 'Gender Split',
            title: 'Gender Targeting Preference',
            text: \`Should the campaign target all genders equally, or does \${businessName} cater primarily to men or women?\`
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
          text: \`To craft compelling ad copy, could you share what unique advantage makes \${businessName} stand out from local competitors?\`
        },
        {
          tag: 'Product Highlight',
          title: 'Hero Product Focus',
          text: \`Which specific product or service should take center stage in this campaign to drive the strongest immediate conversions?\`
        },
        {
          tag: 'Digital Presence',
          title: 'Catalog & Website Link',
          text: \`Could you share your website, Facebook page, or product catalog link for \${businessName}?\`
        },
        {
          tag: 'Marketing Goal',
          title: 'Primary Campaign Objective',
          text: \`Is your primary objective for this campaign direct sales/purchases, generating customer inquiries/leads, or broad brand awareness?\`
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
          return \`Could you share what makes \${businessName} unique and sets your products apart from competitors in your market?\`;
        }
        if (missingFields.some(f => f.toLowerCase().includes('website'))) {
          return \`Could you provide your official website URL or social store link for \${businessName}?\`;
        }
        return \`Could you share a brief overview of the product or service you'd like to promote for \${businessName}?\`;

      case 'objective':
        return \`What is your primary commercial goal for this campaign—direct sales/orders, qualified lead inquiries, or brand awareness?\`;

      case 'audience':
        if (missingFields.some(f => f.toLowerCase().includes('location'))) {
          return \`Which geographic regions or cities (e.g. Dhaka, nationwide) should we target for \${businessName}?\`;
        }
        return \`What age range and demographics represent your ideal target customers for this campaign?\`;

      case 'platforms':
        return \`Which advertising channels (such as Facebook, Instagram Reels, Google Search, or YouTube) would you like to focus on?\`;

      case 'schedule':
        return \`When would you like this campaign to launch, and what is your intended flight duration (in days or weeks)?\`;

      case 'budget':
        return \`What is your target overall advertising budget (in BDT or USD) for this campaign duration?\`;

      default:
        return \`Could you provide additional details regarding \${missingStr || 'this section'} for \${businessName}?\`;
    }
  },
`;

code = code.substring(0, startIndex) + newMethods + code.substring(endIndex);
fs.writeFileSync('js/mockAI.js', code, 'utf8');
console.log('Successfully updated js/mockAI.js');
