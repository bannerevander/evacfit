import { assertEquals } from 'jsr:@std/assert@1'
import { parseRequest, toRoute } from './ors.ts'

Deno.test('parseRequest accepts a valid request and defaults the language', () => {
  assertEquals(parseRequest({ from: { lat: 3.57, lng: 98.68 }, to: { lat: 3.55, lng: 98.67 }, profile: 'wheelchair' })?.lang, 'id')
})

Deno.test('parseRequest rejects bad points and unknown profiles', () => {
  assertEquals(parseRequest({ from: { lat: 91, lng: 0 }, to: { lat: 0, lng: 0 }, profile: 'wheelchair' }), null)
  assertEquals(parseRequest({ from: { lat: '3', lng: 98 }, to: { lat: 0, lng: 0 }, profile: 'wheelchair' }), null)
  assertEquals(parseRequest({ from: { lat: 3, lng: 98 }, to: { lat: 3, lng: 98 }, profile: 'cycling-road' }), null)
  assertEquals(parseRequest(null), null)
})

Deno.test('toRoute flips coordinates to [lat, lng] and flattens steps', () => {
  const r = toRoute({
    features: [{
      geometry: { coordinates: [[98.68, 3.57], [98.67, 3.55]] },
      properties: { summary: { distance: 5070.6, duration: 4376.2 }, segments: [{ steps: [{ instruction: 'Ke arah selatan', distance: 120.4 }, { instruction: 'Belok kiri', distance: 300 }] }] },
    }],
  })
  assertEquals(r, { km: 5.1, minutes: 73, coords: [[3.57, 98.68], [3.55, 98.67]], steps: [{ text: 'Ke arah selatan', m: 120 }, { text: 'Belok kiri', m: 300 }] })
  assertEquals(toRoute({ features: [] }), null)
})
