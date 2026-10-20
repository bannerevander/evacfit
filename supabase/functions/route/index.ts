// NAV-1 / NAV-4: proxies OpenRouteService directions so the API key stays server-side (Vault secret 'ors_api_key',
// read through public.ors_api_key(), which only service_role may call). Signed-in users only, so the public anon key
// alone cannot spend the ORS quota. "No route" is a normal answer: the client falls back to the vehicle route, then
// to the straight-line guide.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { parseRequest, toRoute } from './ors.ts'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

let key: string | null = null

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer /, '')
  const { data } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } }
  if (!data.user) return json({ error: 'unauthorized' }, 401)

  const r = parseRequest(await req.json().catch(() => null))
  if (!r) return json({ error: 'bad_request' }, 400)

  key ??= (await admin.rpc('ors_api_key')).data as string | null
  if (!key) return json({ error: 'not_configured' }, 503)

  try {
    const res = await fetch(`https://api.openrouteservice.org/v2/directions/${r.profile}/geojson`, {
      method: 'POST',
      headers: { Authorization: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates: [[r.from.lng, r.from.lat], [r.to.lng, r.to.lat]], language: r.lang }),
      signal: AbortSignal.timeout(10_000),
    })
    const route = res.ok ? toRoute(await res.json()) : null
    return json(route ? { route } : { error: 'no_route', status: res.status })
  } catch {
    return json({ error: 'unavailable' }, 502)
  }
})
