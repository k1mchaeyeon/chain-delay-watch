// 인천공항(RKSI) 실제 기상 관측(METAR)과 예보(TAF) 중계. 미국 항공기상센터 공개 자료, 키 없음.
const AWC = 'https://aviationweather.gov/api/data';
const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...extra } });

const visM = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'string' && v.includes('+')) return 10000;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(10000, Math.round(n * 1609.34)) : null;
};
const cond = (wx, vis) => {
  const w = wx || '';
  if (/TS/.test(w)) return '뇌우';
  if (/SN|SG|PL/.test(w)) return /-/.test(w) ? '약한 눈' : '눈';
  if (/FG/.test(w)) return '안개';
  if (/RA|DZ|SH/.test(w)) return '비';
  if (/BR/.test(w)) return '박무';
  if (/HZ|FU|DU|SA/.test(w)) return '연무';
  if (vis != null && vis < 1000) return '안개';
  return '맑음';
};
const kstHour = (sec) => new Date(sec * 1000 + 9 * 3600 * 1000).getUTCHours();
const kstDay = (sec) => new Date(sec * 1000 + 9 * 3600 * 1000).toISOString().slice(0, 10);
const get = async (path) => {
  const r = await fetch(`${AWC}/${path}`, { headers: { accept: 'application/json', 'user-agent': 'chain-delay-watch-dashboard' }, signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error('aviationweather ' + r.status);
  const t = await r.text();
  return t.trim() ? JSON.parse(t) : [];
};

export default async (req) => {
  try {
    const [metars, tafs] = await Promise.all([get('metar?ids=RKSI&format=json&hours=30'), get('taf?ids=RKSI&format=json').catch(() => [])]);
    if (new URL(req.url).searchParams.get('debug') === '1') return json({ metar: metars[0] ?? null, taf: tafs[0] ?? null }, 200, { 'cache-control': 'no-store' });
    const nowSec = Math.floor(Date.now() / 1000), today = kstDay(nowSec);
    const obs = metars.map((m) => {
      const t = Number(m.obsTime) || Math.floor(Date.parse(m.reportTime) / 1000);
      const vis = visM(m.visib);
      return { t, vis, wx: m.wxString || null, temp: m.temp ?? null, wdir: m.wdir ?? null, wspd: m.wspd ?? null, wgst: m.wgst ?? null, raw: m.rawOb || null, cover: m.cover ?? (m.clouds?.at(-1)?.cover ?? null) };
    }).filter((o) => Number.isFinite(o.t)).sort((a, b) => a.t - b.t);
    // 시간별: 오늘(서울 기준) 각 시각의 가장 나쁜 시정 관측
    const hours = new Map();
    for (const o of obs) {
      if (kstDay(o.t) !== today) continue;
      const h = kstHour(o.t), cur = hours.get(h);
      if (!cur || (o.vis ?? 1e9) < (cur.vis ?? 1e9)) hours.set(h, o);
    }
    const rows = [];
    for (let h = 0; h < 24; h++) {
      const o = hours.get(h);
      if (o) { rows.push({ hour: h, visibility_m: o.vis ?? 10000, condition: cond(o.wx, o.vis), observed: true, temp: o.temp, wind_kt: o.wspd, raw: o.raw }); continue; }
      // 관측이 아직 없는 시각은 TAF 예보로 채운다.
      const mid = Date.parse(today + 'T00:00:00+09:00') / 1000 + h * 3600 + 1800;
      let f = null;
      for (const p of tafs[0]?.fcsts || []) { if (p.timeFrom <= mid && mid < p.timeTo && (!f || (p.fcstChange !== 'PROB' && p.timeFrom >= f.timeFrom))) f = p; }
      const vis = f ? visM(f.visib) : null;
      rows.push({ hour: h, visibility_m: vis ?? 10000, condition: f ? cond(f.wxString, vis) : '맑음', observed: false, forecast: !!f, temp: null, wind_kt: f?.wspd ?? null, raw: null });
    }
    const last = obs.at(-1) || null;
    return json({
      source: 'aviationweather.gov METAR/TAF (RKSI)', at: nowSec,
      now: last && { time: last.t, visibility_m: last.vis, condition: cond(last.wx, last.vis), temp: last.temp, wind_dir: last.wdir, wind_kt: last.wspd, gust_kt: last.wgst, cover: last.cover, raw: last.raw },
      taf_raw: tafs[0]?.rawTAF ?? null, hours: rows,
    }, 200, { 'cache-control': 'public, max-age=300', 'netlify-cdn-cache-control': 'public, s-maxage=600' });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502, { 'cache-control': 'no-store' });
  }
};
export const config = { path: '/api/weather' };
