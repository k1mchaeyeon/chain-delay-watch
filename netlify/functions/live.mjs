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
    // 공개 ADS-B 서버가 가끔 느리거나 막힌다. adsb.lol 을 먼저 짧게 시도하고, 안 되면 adsb.fi 로 넘어간다.
    // adsb.fi 는 1초에 한 번만 받으므로 두 지점을 차례로 묻는다.
    const ask = async (name, url, ms) => {
      const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'chain-delay-watch-dashboard' }, signal: AbortSignal.timeout(ms) });
      if (!r.ok) throw new Error(name + ' ' + r.status);
      const j = await r.json(); const ac = j.ac || j.aircraft;
      if (!Array.isArray(ac) || !ac.length) throw new Error(name + ' 빈 응답');
      return ac;
    };
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    const used = new Set(); let results; const errs = [];
    try {
      results = await Promise.all(POINTS.map(([lat, lon]) => ask('adsb.lol', `https://api.adsb.lol/v2/point/${lat}/${lon}/250`, 3500)));
      used.add('adsb.lol');
    } catch (e) {
      errs.push(String(e.message || e)); results = [];
      for (const [lat, lon] of POINTS) {
        if (results.length) await wait(1150);
        const url = `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/250`;
        try { results.push(await ask('adsb.fi', url, 6000)); }
        catch (e1) { errs.push(String(e1.message || e1)); await wait(1300); results.push(await ask('adsb.fi', url, 6000)); }
      }
      used.add('adsb.fi');
    }
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
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=20', 'netlify-cdn-cache-control': 'public, s-maxage=30, stale-while-revalidate=600' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof AggregateError ? e.errors.map((x) => String(x.message || x)).join(' / ') : String(e.message || e) }), { status: 502, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
};
export const config = { path: '/api/live' };
