// ==================== PLAN DEFINITIONS ====================

export interface PlanLimits {
  max_blocks_total: number;
  max_blocks_per_type: Record<string, number>;
  max_analytics_retention_days: number;
  max_custom_themes: number;
  api_rate_limit: number;
  features: string[];
}

export const PLANS: Record<string, PlanLimits> = {
  'Free': {
    max_blocks_total: 10,
    max_blocks_per_type: {
      'link': 10,
      'heading': 5,
      'spacer': 3,
      'image': 3,
      'video': 2,
      'social': 1
    },
    max_analytics_retention_days: 7,
    max_custom_themes: 0,
    api_rate_limit: 0,
    features: [
      'blocks',
      'basic_analytics',
      'standard_themes'
    ]
  },
  
  'Creator': {
    max_blocks_total: 50,
    max_blocks_per_type: {
      'link': 50,
      'heading': 20,
      'spacer': 15,
      'image': 15,
      'video': 10,
      'social': 5
    },
    max_analytics_retention_days: 30,
    max_custom_themes: 5,
    api_rate_limit: 100,
    features: [
      'blocks',
      'advanced_analytics',
      'custom_themes',
      'remove_branding',
      'priority_support',
      'export_data'
    ]
  },
  
  'Pro': {
    max_blocks_total: -1, // Unlimited
    max_blocks_per_type: {
      'link': -1,
      'heading': -1,
      'spacer': -1,
      'image': -1,
      'video': -1,
      'social': -1
    },
    max_analytics_retention_days: 90,
    max_custom_themes: -1, // Unlimited
    api_rate_limit: 1000,
    features: [
      'blocks',
      'advanced_analytics',
      'ai_insights',
      'custom_themes',
      'api_access',
      'webhooks',
      'custom_domain',
      'remove_branding',
      'priority_support',
      'export_data',
      'white_label'
    ]
  },
  
  'Enterprise': {
    max_blocks_total: -1,
    max_blocks_per_type: {
      'link': -1,
      'heading': -1,
      'spacer': -1,
      'image': -1,
      'video': -1,
      'social': -1
    },
    max_analytics_retention_days: 365,
    max_custom_themes: -1,
    api_rate_limit: 10000,
    features: [
      'blocks',
      'advanced_analytics',
      'ai_insights',
      'custom_themes',
      'api_access',
      'webhooks',
      'custom_domain',
      'remove_branding',
      'priority_support',
      'export_data',
      'white_label',
      'sso',
      'dedicated_support',
      'sla'
    ]
  }
};

// ==================== FEATURE DEFINITIONS ====================

export interface Feature {
  id: string;
  name: string;
  description: string;
  icon: string;
  requiredPlan: string;
}

export const FEATURES: Feature[] = [
  {
    id: 'blocks',
    name: 'Content Blocks',
    description: 'Add links, headings, images, videos and more',
    icon: '📦',
    requiredPlan: 'Free'
  },
  {
    id: 'basic_analytics',
    name: 'Basic Analytics',
    description: 'Track views and clicks',
    icon: '📊',
    requiredPlan: 'Free'
  },
  {
    id: 'advanced_analytics',
    name: 'Advanced Analytics',
    description: 'Detailed insights with charts and trends',
    icon: '📈',
    requiredPlan: 'Creator'
  },
  {
    id: 'ai_insights',
    name: 'AI Insights',
    description: 'Get AI-powered recommendations',
    icon: '🤖',
    requiredPlan: 'Pro'
  },
  {
    id: 'custom_themes',
    name: 'Custom Themes',
    description: 'Create and save custom themes',
    icon: '🎨',
    requiredPlan: 'Creator'
  },
  {
    id: 'api_access',
    name: 'API Access',
    description: 'Programmatic access to your data',
    icon: '🔌',
    requiredPlan: 'Pro'
  },
  {
    id: 'webhooks',
    name: 'Webhooks',
    description: 'Real-time event notifications',
    icon: '🪝',
    requiredPlan: 'Pro'
  },
  {
    id: 'custom_domain',
    name: 'Custom Domain',
    description: 'Use your own domain',
    icon: '🌐',
    requiredPlan: 'Pro'
  },
  {
    id: 'remove_branding',
    name: 'Remove Branding',
    description: 'Hide "Powered by BioForge"',
    icon: '🏷️',
    requiredPlan: 'Creator'
  },
  {
    id: 'white_label',
    name: 'White Label',
    description: 'Full white-label solution',
    icon: '⚪',
    requiredPlan: 'Pro'
  }
];

// ==================== HELPER FUNCTIONS ====================

/**
 * Check if a plan has access to a feature
 */
export function hasFeatureAccess(plan: string, featureId: string): boolean {
  const planConfig = PLANS[plan];
  if (!planConfig) return false;
  
  return planConfig.features.includes(featureId);
}

/**
 * Get plan limits
 */
export function getPlanLimits(plan: string): PlanLimits | null {
  return PLANS[plan] || null;
}

/**
 * Check if can add more blocks
 */
export function canAddBlock(plan: string, currentCount: number): boolean {
  const limits = getPlanLimits(plan);
  if (!limits) return false;
  
  // -1 means unlimited
  if (limits.max_blocks_total === -1) return true;
  
  return currentCount < limits.max_blocks_total;
}

/**
 * Check if can add specific block type
 */
export function canAddBlockType(plan: string, type: string, currentCount: number): boolean {
  const limits = getPlanLimits(plan);
  if (!limits) return false;
  
  const typeLimit = limits.max_blocks_per_type[type];
  
  // -1 means unlimited
  if (typeLimit === -1) return true;
  
  // Type not configured, check total limit
  if (typeLimit === undefined) {
    return canAddBlock(plan, currentCount);
  }
  
  return currentCount < typeLimit;
}

/**
 * Get upgrade suggestion
 */
export function getUpgradeSuggestion(currentPlan: string, reason: string): string {
  const planOrder = ['Free', 'Creator', 'Pro', 'Enterprise'];
  const currentIndex = planOrder.indexOf(currentPlan);
  
  if (currentIndex === -1 || currentIndex >= planOrder.length - 1) {
    return currentPlan;
  }
  
  return planOrder[currentIndex + 1];
}

/**
 * Calculate usage percentage
 */
export function calculateUsagePercentage(current: number, limit: number): number {
  if (limit === -1) return 0; // Unlimited
  return Math.min((current / limit) * 100, 100);
}

/**
 * Should show warning (>80% usage)
 */
export function shouldShowUsageWarning(current: number, limit: number): boolean {
  if (limit === -1) return false;
  const percentage = calculateUsagePercentage(current, limit);
  return percentage >= 80;
}

/**
 * Format limit display
 */
export function formatLimit(limit: number): string {
  return limit === -1 ? 'Unlimited' : limit.toString();
}