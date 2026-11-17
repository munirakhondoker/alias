const fs = require('fs');

let code = fs.readFileSync('js/mockAI.js', 'utf8');

// 1. select_industry: remove intro fluff
code = code.replace(
  "content: `Excellent choice. We'll tailor this brief for **${industry}**.\\n\\nCould you describe your specific product or service? What makes your offering unique compared to other brands (your Unique Selling Proposition)?`,",
  "content: `Could you describe your specific product or service, and what makes your offering unique compared to other brands (your Unique Selling Proposition)?`,"
);

// 2. select_objective fallback: remove "Noted: Primary objective is..."
code = code.replace(
  "content: `Noted: Primary objective is **${objective}**.\\n\\nNow let's define your **Target Audience**. Who are your primary buyers?`,",
  "content: `Who is your **Target Audience**? Who are your primary buyers?`,"
);

// 3. select_sales_channel / select_lead_type: remove "Recorded channel:..."
code = code.replace(
  "content: `Recorded channel: **${val}**.\\n\\nNow let's define your **Target Audience**. Who is this campaign designed to reach?`,",
  "content: `Who is your **Target Audience**? Who is this campaign designed to reach?`,"
);

// 4. submit_audience: remove "Target audience configured for..."
code = code.replace(
  "content: `Target audience configured for **${campaign.audience.ageRange}**, **${campaign.audience.gender}** in **${Array.isArray(campaign.audience.location) ? campaign.audience.location.join(', ') : campaign.audience.location}**.\\n\\nWhich **Advertising Platforms** and **Creative Formats** should Alias target?`,",
  "content: `Which **Advertising Platforms** and **Creative Formats** should we target?`,"
);

// 5. submit_platforms: remove "Platforms saved:..."
code = code.replace(
  "content: `Platforms saved: **${plats.join(', ')}** using **${formats.join(', ')}**.\\n\\nNext, what is your planned **Campaign Schedule**? Please choose start and end dates.`,",
  "content: `What is your planned **Campaign Schedule**? Please choose start and end dates:`,"
);

// 6. submit_schedule: remove "Campaign scheduled for..."
code = code.replace(
  "content: `Campaign scheduled for **${duration} days** (${sDate} to ${eDate}).\\n\\nLastly, what is your total **Advertising Budget**? (Default currency is BDT).`,",
  "content: `What is your total **Advertising Budget**? (Default currency is BDT)`,"
);

// 7. Step 0/1: remove "Thank you! I've recorded your business details:..."
code = code.replace(
  'content: `Thank you! I\'ve recorded your business details: "${originalText}".\\n\\nWhat is your **Primary Marketing Objective** for this campaign?`,',
  'content: `What is your **Primary Marketing Objective** for this campaign?`,'
);

// 8. Step 2: remove "Great USP! "
code = code.replace(
  "content: `Great USP! What is the **Primary Marketing Objective** for this campaign?`,",
  "content: `What is the **Primary Marketing Objective** for this campaign?`,"
);

// 9. Step 3/4: remove "Primary objective set to..."
code = code.replace(
  "content: `Primary objective set to **${campaign.objective.primary}**.\\n\\nNow let's specify your **Target Audience** (age, gender, target locations, or interests):`,",
  "content: `Who is your **Target Audience** (age, gender, target locations, or interests)?`,"
);

// 10. Step 5 (THE SCREENSHOT ISSUE): remove "Audience recorded: "${originalText}".\n\n"
code = code.replace(
  'content: `Audience recorded: "${originalText}".\\n\\nWhich **Advertising Platforms** and formats should we select?`,',
  'content: `Which **Advertising Platforms** and formats should we select?`,'
);

// 11. Step 6: remove "Platforms noted:..."
code = code.replace(
  "content: `Platforms noted: **${campaign.platforms.join(', ')}**.\\n\\nPlease select your campaign schedule dates:`,",
  "content: `Please select your campaign schedule dates:`,"
);

// 12. Step 7: remove "Schedule set for 20 days.\n\n"
code = code.replace(
  "content: `Schedule set for **20 days**.\\n\\nNow, what is your total **Advertising Budget** in BDT?`,",
  "content: `What is your total **Advertising Budget** in BDT?`,"
);

// 13. Default: remove "I've noted that:..."
code = code.replace(
  'content: `I\'ve noted that: "${originalText}". Let\'s continue completing the remaining sections of your campaign brief.`,',
  'content: `What additional details regarding your target audience, platforms, or budget can you share for this campaign?`,'
);

fs.writeFileSync('js/mockAI.js', code, 'utf8');
console.log('Successfully updated js/mockAI.js to remove all recorded/acknowledgment prefixes!');
