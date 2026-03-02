import { getProfile, getPlanLimits, getBlocks } from '@/lib/supabase/queries'

export async function checkCanAddBlock(profileId: string) {
  const profile = await getProfile(profileId)
  const limits = await getPlanLimits(profile.plan)
  const blocks = await getBlocks(profileId)
  
  const usage = {
    current: blocks.length,
    limit: limits.max_blocks_total,
    percentage: (blocks.length / limits.max_blocks_total) * 100
  }
  
  return {
    allowed: blocks.length < limits.max_blocks_total,
    usage,
    shouldWarn: usage.percentage >= 80,
    requiresUpgrade: !usage.allowed
  }
}