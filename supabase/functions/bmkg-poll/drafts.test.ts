// deno test supabase/functions/bmkg-poll
import { assertEquals } from 'jsr:@std/assert@1'
import { draftRadiusKm, toDrafts, type BmkgItem } from './drafts.ts'

const medan = { lat: 3.58, lng: 98.68, km: 300 }
const now = new Date('2026-10-18T09:00:00Z')
const item = (over: Partial<BmkgItem>): BmkgItem => ({
  DateTime: '2026-10-18T08:00:00+00:00', Coordinates: '2.92,98.30', Magnitude: '5.3', Kedalaman: '10 km', Wilayah: '32 km BaratDaya KAB-KARO', ...over,
})

Deno.test('M>5 inside the work area becomes one draft', () => {
  const [d, ...rest] = toDrafts([item({})], false, medan, now)
  assertEquals(rest.length, 0)
  assertEquals(d.title, 'Gempa M5,3 — 32 km BaratDaya KAB-KARO')
  assertEquals([d.lat, d.lng, d.depth_km, d.status, d.id], [2.92, 98.3, 10, 'draft', 'bmkg-2026-10-18T08:00:00.000Z'])
})

Deno.test('filters: magnitude, felt, distance, age, bad rows', () => {
  assertEquals(toDrafts([item({ Magnitude: '5.0' })], false, medan, now).length, 0, 'PRD: strictly above 5.0')
  assertEquals(toDrafts([item({ Magnitude: '4.1' })], true, medan, now).length, 1, 'felt quakes count at any magnitude')
  assertEquals(toDrafts([item({ Coordinates: '-8.09,120.26' })], false, medan, now).length, 0, 'Labuan Bajo is outside Medan work area')
  assertEquals(toDrafts([item({ DateTime: '2026-10-16T08:00:00+00:00' })], false, medan, now).length, 0, 'older than 24 h')
  assertEquals(toDrafts([item({ Coordinates: 'x' })], false, medan, now).length, 0)
})

Deno.test('draft radius grows with magnitude, clamped 5..100 km', () => {
  assertEquals([draftRadiusKm(4), draftRadiusKm(5), draftRadiusKm(6), draftRadiusKm(9)], [5, 10, 20, 100])
})
