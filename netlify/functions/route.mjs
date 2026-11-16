// 콜사인으로 노선(출발·도착 공항)을 찾는 중계. adsbdb.com 공개 자료, 키 없음.
const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...extra } });
const ap = (a) => (a ? { iata: a.iata_code || null, icao: a.icao_code || null, name: a.name || null, city: a.municipality || null, country: a.country_name || null, lat: a.latitude ?? null, lon: a.longitude ?? null } : null);

export default async (req) => {
  const q = new URL(req.url).searchParams;
  const cs = (q.get('cs') || '').toUpperCase().trim();
  if (!/^[A-Z0-9]{3,8}$/.test(cs)) return json({ error: '콜사인 형식이 아닙니다.' }, 400);
  try {
    const r = await fetch(`https://api.adsbdb.com/v0/callsign/${cs}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    const cache = { 'cache-control': 'public, max-age=3600', 'netlify-cdn-cache-control': 'public, s-maxage=21600' };
    if (r.status === 404) return json({ callsign: cs, found: false }, 200, cache);
    if (!r.ok) throw new Error('adsbdb ' + r.status);
    const d = await r.json();
    if (q.get('debug') === '1') return json(d, 200, { 'cache-control': 'no-store' });
    const fr = d?.response?.flightroute;
    if (!fr) return json({ callsign: cs, found: false }, 200, cache);
    return json({ callsign: cs, found: true, source: 'adsbdb.com', flight: fr.callsign_iata || null, airline: fr.airline?.name || null, origin: ap(fr.origin), dest: ap(fr.destination) }, 200, cache);
  } catch (e) {
    return json({ error: String(e.message || e) }, 502, { 'cache-control': 'no-store' });
  }
};
export const config = { path: '/api/route' };
