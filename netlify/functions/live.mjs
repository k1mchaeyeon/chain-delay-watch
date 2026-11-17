// 한반도 주변 항공기 위치를 adsb.lol(ODbL)에서 받아 브라우저에 전달하는 중계 함수
// 브라우저는 adsb.lol을 직접 부를 수 없어서 서버가 대신 받는다. 키는 필요 없다.
const POINTS = [[37.0, 127.5], [33.8, 127.5]]; // 반경 250해리 원 두 개로 한반도·제주 주변을 덮는다
const country = (reg) => {
  if (!reg) return '등록 미상';
  if (reg.startsWith('HL')) return '대한민국';
  if (reg.startsWith('JA')) return '일본';
  if (reg.startsWith('B-')) return '중국·대만';
  if (reg.startsWith('N')) return '미국';
  return '기타';
};
export default async () => {
  try {
    const now = Math.floor(Date.now() / 1000);
    // 공개 ADS-B 서버가 가끔 느리거나 막혀서 같은 형식의 세 곳에 동시에 묻고 가장 먼저 온 답을 쓴다.
    const SOURCES = [
      ['adsb.lol', (lat, lon) => `https://api.adsb.lol/v2/point/${lat}/${lon}/250`],
      ['airplanes.live', (lat, lon) => `https://api.airplanes.live/v2/point/${lat}/${lon}/250`],
      ['adsb.fi', (lat, lon) => `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/250`],
    ];
    const used = new Set();
    const results = await Promise.all(POINTS.map(([lat, lon]) => Promise.any(SOURCES.map(async ([name, url]) => {
      const r = await fetch(url(lat, lon), { headers: { accept: 'application/json', 'user-agent': 'chain-delay-watch-dashboard' }, signal: AbortSignal.timeout(9000) });
      if (!r.ok) throw new Error(name + ' ' + r.status);
      const j = await r.json(); const ac = j.ac || j.aircraft;
      if (!Array.isArray(ac) || !ac.length) throw new Error(name + ' 빈 응답');
      used.add(name); return ac;
    }))));
    const seen = new Map();
    for (const a of results.flat()) {
      if (a.lat == null || a.lon == null || seen.has(a.hex)) continue;
      const ground = a.alt_baro === 'ground';
      seen.set(a.hex, {
        icao24: a.hex, callsign: (a.flight || '').trim(), reg: a.r || null, type: a.t || null, country: country(a.r),
        lon: a.lon, lat: a.lat, alt_m: ground ? 0 : (typeof a.alt_baro === 'number' ? a.alt_baro / 3.281 : null), on_ground: ground,
        speed_ms: typeof a.gs === 'number' ? a.gs / 1.944 : null, heading: a.track ?? null,
        vrate: typeof a.baro_rate === 'number' ? a.baro_rate / 196.85 : null, last: now - Math.round(a.seen || 0),
      });
    }
    return new Response(JSON.stringify({ source: [...used].join(' · '), at: now, ac: [...seen.values()] }), {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=20', 'netlify-cdn-cache-control': 'public, s-maxage=20, stale-while-revalidate=600' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof AggregateError ? e.errors.map((x) => String(x.message || x)).join(' / ') : String(e.message || e) }), { status: 502, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
};
export const config = { path: '/api/live' };
