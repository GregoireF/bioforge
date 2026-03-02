import type { APIRoute } from 'astro'
import { withAuth } from '@/lib/auth/auth'
import { getAnalyticsSummary } from '@/lib/db/queries.server'
import { getErrorMessage } from '@/lib/supabase/helpers'

export const GET: APIRoute = async ({ url, cookies }) => {
  try {
    // Auth
    const user = await withAuth(cookies)
    if (!user?.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Paramètre days
    const daysParam = url.searchParams.get('days')
    let days = daysParam ? parseInt(daysParam, 10) : 7

    // Validation stricte
    if (isNaN(days) || days < 1 || days > 180) { // max 180 jours pour éviter des queries trop lourdes
      return new Response(
        JSON.stringify({ error: 'Invalid days parameter (1-180)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Récupération des stats
    const analyticsResult = await getAnalyticsSummary(user.id, days)

    if (!analyticsResult.success) {
      console.error('Analytics summary failed:', analyticsResult.error)
      return new Response(
        JSON.stringify({ error: analyticsResult.error?.message || 'Failed to fetch analytics' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { summary, profileStats, blockStats, topBlocks } = analyticsResult.data

    // Réponse normalisée (toujours les mêmes clés, même si vide)
    const response = {
      summary: {
        totalViews: summary.totalViews ?? 0,
        totalClicks: summary.totalClicks ?? 0,
        clickRate: summary.clickRate ?? 0,
        activeBlocks: summary.activeBlocks ?? 0
      },
      profileStats: (profileStats ?? []).map(stat => ({
        date: stat.date,
        views: stat.views ?? 0
        // unique_visitors: stat.unique_visitors ?? 0  // décommente si tu l'ajoutes plus tard
      })),
      blockStats: (blockStats ?? []).map(stat => ({
        date: stat.date,
        block_id: stat.block_id,
        clicks: stat.clicks ?? 0
      })),
      topBlocks: (topBlocks ?? []).map(block => ({
        id: block.id,
        type: block.type,
        title: block.title ?? 'Sans titre',
        config: block.config ?? {},
        clicks: (block as any).clicks ?? 0
      }))
    }

    return new Response(
      JSON.stringify(response),
      { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'private, max-age=300' // cache 5 min côté navigateur
        }
      }
    )
  } catch (error) {
    console.error('GET /api/analytics error:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })

    const isAuthError = error instanceof Error && error.message.includes('Authentication')
    
    return new Response(
      JSON.stringify({ 
        error: isAuthError ? 'Unauthorized' : getErrorMessage(error) 
      }),
      { 
        status: isAuthError ? 401 : 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}