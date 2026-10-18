// EMER-2 / EMER-3: called every minute by pg_cron. Reads BMKG open data and stores qualifying quakes as draft
// disaster_events; nothing is activated until the coordinator approves the draft in the dashboard.
// Idempotent (deduplicated on external_event_id), so being called extra times only costs two BMKG requests.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { FRESH_HOURS, toDrafts, type BmkgItem, type WorkArea } from './drafts.ts'

const FEEDS = [
  { url: 'https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json', felt: false }, // 15 latest M >= 5.0
  { url: 'https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json', felt: true }, // 15 latest felt quakes
]

// Work area (EMER-2 "wilayah kerja"): default Medan + 300 km; override per deployment with secrets.
const area: WorkArea = {
  lat: Number(Deno.env.get('WORK_AREA_LAT') ?? 3.58),
  lng: Number(Deno.env.get('WORK_AREA_LNG') ?? 98.68),
  km: Number(Deno.env.get('WORK_AREA_KM') ?? 300),
}

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

async function feed(url: string): Promise<BmkgItem[]> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  const g = (await res.json())?.Infogempa?.gempa
  return Array.isArray(g) ? g : g ? [g] : []
}

Deno.serve(async () => {
  const now = new Date()
  const errors: string[] = []
  let rows: ReturnType<typeof toDrafts> = []
  for (const f of FEEDS) {
    // One feed down must not hide alerts from the other.
    try {
      rows.push(...toDrafts(await feed(f.url), f.felt, area, now))
    } catch (e) {
      errors.push(String(e))
    }
  }
  rows = [...new Map(rows.map((r) => [r.id, r])).values()] // same quake can be in both feeds

  let inserted = 0
  if (rows.length) {
    const { data, error } = await db.from('disaster_events').upsert(rows, { onConflict: 'external_event_id', ignoreDuplicates: true }).select('id')
    if (error) errors.push(error.message)
    inserted = data?.length ?? 0
  }

  // Unapproved BMKG drafts expire so the alert panel only shows live events.
  const cutoff = new Date(now.getTime() - FRESH_HOURS * 3_600_000).toISOString()
  const { error: closeErr } = await db.from('disaster_events').update({ status: 'closed' })
    .eq('source', 'bmkg').eq('status', 'draft').lt('time', cutoff)
  if (closeErr) errors.push(closeErr.message)

  return Response.json({ candidates: rows.length, inserted, area, errors }, { status: errors.length ? 502 : 200 })
})
