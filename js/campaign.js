/**
 * ALIAS Campaign Management & Validation Module
 * Handles campaign calculations, progress tracking across the 6 sections,
 * field validation, and final brief generation.
 */

const CampaignManager = {
  /**
   * Calculates campaign duration in days
   */
  calculateDuration(startDateStr, endDateStr) {
    if (!startDateStr || !endDateStr) return 0;
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    const diffTime = end.getTime() - start.getTime();
    if (diffTime < 0) return 0;
    // Difference in whole days + 1 day for inclusive campaign schedule
    const days = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return days > 0 ? days : 0;
  },

  /**
   * Calculates average daily budget
   */
  calculateAvgDaily(totalBudget, durationDays) {
    const total = parseFloat(totalBudget) || 0;
    const days = parseInt(durationDays, 10) || 0;
    if (total <= 0 || days <= 0) return 0;
    return Math.round(total / days);
  },

  /**
   * Validates budget inputs
   */
  validateBudget(totalBudget, dailyBudget, maxDaily) {
    const total = parseFloat(totalBudget);
    if (isNaN(total) || total <= 0) {
      return { valid: false, error: 'Total advertising budget must be greater than zero.' };
    }
    if (dailyBudget !== null && dailyBudget !== undefined && dailyBudget !== '') {
      const daily = parseFloat(dailyBudget);
      if (isNaN(daily) || daily < 0) {
        return { valid: false, error: 'Preferred daily budget cannot be negative.' };
      }
      if (daily > total) {
        return { valid: false, error: 'Daily budget cannot exceed total budget.' };
      }
    }
    if (maxDaily !== null && maxDaily !== undefined && maxDaily !== '') {
      const max = parseFloat(maxDaily);
      if (isNaN(max) || max < 0) {
        return { valid: false, error: 'Maximum daily spend limit cannot be negative.' };
      }
    }
    return { valid: true };
  },

  /**
   * Validates URL format
   */
  isValidUrl(string) {
    if (!string) return true; // optional field
    try {
      const url = new URL(string.startsWith('http') ? string : 'https://' + string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  },

  /**
   * Calculates dynamic completion progress for the 6 core campaign sections
   */
  calculateProgress(campaign) {
    if (!campaign) return { percentage: 0, sections: {}, isComplete: false };

    const sections = {
      business: {
        title: 'Business & Product Information',
        requiredCount: 5,
        completedCount: 0,
        missing: [],
        status: 'incomplete'
      },
      objective: {
        title: 'Marketing Objectives',
        requiredCount: 1,
        completedCount: 0,
        missing: [],
        status: 'incomplete'
      },
      audience: {
        title: 'Target Audience',
        requiredCount: 3,
        completedCount: 0,
        missing: [],
        status: 'incomplete'
      },
      platforms: {
        title: 'Advertising Platforms',
        requiredCount: 2,
        completedCount: 0,
        missing: [],
        status: 'incomplete'
      },
      schedule: {
        title: 'Campaign Schedule & Duration',
        requiredCount: 2,
        completedCount: 0,
        missing: [],
        status: 'incomplete'
      },
      budget: {
        title: 'Budget & Currency',
        requiredCount: 2,
        completedCount: 0,
        missing: [],
        status: 'incomplete'
      }
    };

    // 1. Business Info
    const b = campaign.business || {};
    if (b.name && b.name.trim()) sections.business.completedCount++;
    else sections.business.missing.push('Business Name');

    if (b.industry && b.industry.trim()) sections.business.completedCount++;
    else sections.business.missing.push('Industry');

    if (b.description && b.description.trim()) sections.business.completedCount++;
    else sections.business.missing.push('Business Description');

    if (b.productName && b.productName.trim()) sections.business.completedCount++;
    else sections.business.missing.push('Product / Service Name');

    if (b.productDescription && b.productDescription.trim()) sections.business.completedCount++;
    else sections.business.missing.push('Product / Service Description');

    // 2. Marketing Objectives
    const obj = campaign.objective || {};
    if (obj.primary && obj.primary.trim()) sections.objective.completedCount++;
    else sections.objective.missing.push('Primary Objective');

    // 3. Target Audience
    const aud = campaign.audience || {};
    if (aud.ageRange && aud.ageRange.trim()) sections.audience.completedCount++;
    else sections.audience.missing.push('Age Range');

    if (aud.gender && aud.gender.trim()) sections.audience.completedCount++;
    else sections.audience.missing.push('Gender');

    if ((aud.location && aud.location.length > 0) || (typeof aud.location === 'string' && aud.location.trim())) sections.audience.completedCount++;
    else sections.audience.missing.push('Location / Target Region');

    // 4. Advertising Platforms & Formats
    const p = campaign.platforms || [];
    const cf = campaign.contentFormats || [];
    if (p.length > 0) sections.platforms.completedCount++;
    else sections.platforms.missing.push('Advertising Platforms');

    if (cf.length > 0) sections.platforms.completedCount++;
    else sections.platforms.missing.push('Preferred Content Formats');

    // 5. Campaign Schedule
    const sch = campaign.schedule || {};
    if (sch.startDate && sch.startDate.trim()) sections.schedule.completedCount++;
    else sections.schedule.missing.push('Start Date');

    if (sch.endDate && sch.endDate.trim() && sch.durationDays > 0) sections.schedule.completedCount++;
    else sections.schedule.missing.push('End Date');

    // 6. Budget
    const bg = campaign.budget || {};
    if (bg.total && parseFloat(bg.total) > 0) sections.budget.completedCount++;
    else sections.budget.missing.push('Total Budget');

    if (bg.currency && bg.currency.trim()) sections.budget.completedCount++;
    else sections.budget.missing.push('Currency');

    // Calculate section statuses and total score
    let totalRequired = 0;
    let totalCompleted = 0;

    Object.keys(sections).forEach(key => {
      const sec = sections[key];
      totalRequired += sec.requiredCount;
      totalCompleted += sec.completedCount;

      if (sec.completedCount === sec.requiredCount) {
        sec.status = 'completed';
      } else if (sec.completedCount > 0) {
        sec.status = 'in_progress';
      } else {
        sec.status = 'incomplete';
      }
    });

    const percentage = Math.round((totalCompleted / totalRequired) * 100);
    const isComplete = percentage === 100;

    return {
      percentage,
      totalCompleted,
      totalRequired,
      isComplete,
      sections
    };
  },

  /**
   * Generates formatted brief object ready for preview or confirmation
   */
  generateBriefSummary(campaign) {
    const b = campaign.business || {};
    const obj = campaign.objective || {};
    const aud = campaign.audience || {};
    const sch = campaign.schedule || {};
    const bg = campaign.budget || {};

    const locations = Array.isArray(aud.location) ? aud.location.join(', ') : (aud.location || 'Not specified');
    const platforms = (campaign.platforms && campaign.platforms.length) ? campaign.platforms.join(', ') : 'Not selected';
    const formats = (campaign.contentFormats && campaign.contentFormats.length) ? campaign.contentFormats.join(', ') : 'Not selected';
    const secondaries = (obj.secondary && obj.secondary.length) ? obj.secondary.join(', ') : 'None';

    return {
      campaignName: `${b.name || 'Brand'} — ${obj.primary || 'General'} Campaign`,
      business: {
        name: b.name || 'Not provided',
        industry: b.industry || 'Not provided',
        description: b.description || 'Not provided',
        usp: b.usp || 'Not provided',
        website: b.websiteUrl || 'N/A'
      },
      product: {
        name: b.productName || 'Not provided',
        description: b.productDescription || 'Not provided',
        price: b.productPrice || 'N/A'
      },
      objectives: {
        primary: obj.primary || 'Not selected',
        secondary: secondaries,
        followUpNote: obj.salesLocation || obj.leadDefinition || 'Standard conversion flow'
      },
      audience: {
        ageRange: aud.ageRange || 'All',
        gender: aud.gender || 'All',
        location: locations,
        interests: Array.isArray(aud.interests) ? aud.interests.join(', ') : (aud.interests || 'General'),
        customerType: aud.customerType || 'B2C'
      },
      mediaChannels: {
        platforms: platforms,
        contentFormats: formats
      },
      schedule: {
        startDate: sch.startDate || 'TBD',
        endDate: sch.endDate || 'TBD',
        durationDays: sch.durationDays ? `${sch.durationDays} Days` : 'TBD'
      },
      budget: {
        total: bg.total ? `${Number(bg.total).toLocaleString()} ${bg.currency || 'BDT'}` : '0 BDT',
        currency: bg.currency || 'BDT',
        dailyPreference: bg.daily ? `${Number(bg.daily).toLocaleString()} ${bg.currency || 'BDT'}` : 'Auto-calculated',
        calculatedAvgDaily: bg.calculatedAvgDaily ? `${Number(bg.calculatedAvgDaily).toLocaleString()} ${bg.currency || 'BDT'}/day` : 'N/A',
        maxDaily: bg.maximumDaily ? `${Number(bg.maximumDaily).toLocaleString()} ${bg.currency || 'BDT'}` : 'No cap'
      },
      isConfirmed: Boolean(campaign.confirmed)
    };
  }
};

if (typeof window !== 'undefined') {
  window.CampaignManager = CampaignManager;
}
if (typeof global !== 'undefined') {
  global.CampaignManager = CampaignManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CampaignManager;
}

