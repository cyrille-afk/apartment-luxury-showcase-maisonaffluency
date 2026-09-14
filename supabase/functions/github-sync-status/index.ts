// GitHub sync status for the admin funnel-tracker dashboard.
// Returns the latest commit on the synced repo's main branch and whether the
// GitHub Actions 'playwright-visual' check passed for that commit.
// Admin-only.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/github'
const OWNER = 'cyrille-afk'
const REPO = 'apartment-luxury-showcase-maisonaffluency'
const BRANCH = 'main'
const CHECK_NAME = 'playwright-visual'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

async function gh(path: string, lovableKey: string, ghKey: string) {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': ghKey,
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GitHub ${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // --- Auth (admin only) ---
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Missing auth' }, 401)
  const { data: claims } = await admin.auth.getClaims(token)
  const uid = claims?.claims?.sub
  if (!uid) return json({ error: 'Invalid token' }, 401)
  const { data: isAdmin } = await admin.rpc('has_role', { _user_id: uid, _role: 'admin' })
  if (!isAdmin) return json({ error: 'Admin only' }, 403)

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  const GITHUB_API_KEY = Deno.env.get('GITHUB_API_KEY')
  if (!LOVABLE_API_KEY || !GITHUB_API_KEY) {
    return json({ error: 'GitHub connection not configured' }, 500)
  }

  try {
    const commit = await gh(`/repos/${OWNER}/${REPO}/commits/${BRANCH}`, LOVABLE_API_KEY, GITHUB_API_KEY)
    const sha: string = commit.sha
    const checks = await gh(
      `/repos/${OWNER}/${REPO}/commits/${sha}/check-runs?per_page=100`,
      LOVABLE_API_KEY,
      GITHUB_API_KEY,
    )
    const runs: any[] = checks?.check_runs ?? []
    const visual = runs.find((r) => r.name === CHECK_NAME) ?? null

    return json({
      repo: `${OWNER}/${REPO}`,
      branch: BRANCH,
      commit: {
        sha,
        shortSha: sha.slice(0, 7),
        message: String(commit?.commit?.message ?? '').split('\n')[0],
        committedAt: commit?.commit?.committer?.date ?? null,
        url: commit?.html_url ?? null,
      },
      check: visual
        ? {
            name: visual.name,
            status: visual.status, // queued | in_progress | completed
            conclusion: visual.conclusion, // success | failure | null
            url: visual.html_url ?? null,
            startedAt: visual.started_at ?? null,
            completedAt: visual.completed_at ?? null,
          }
        : null,
      fetchedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error('github-sync-status failed:', e)
    return json({ error: 'GitHub status fetch failed', details: String(e).slice(0, 300) }, 502)
  }
})
