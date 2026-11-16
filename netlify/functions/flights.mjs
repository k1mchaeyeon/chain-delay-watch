// 인천국제공항공사 "항공기 운항 현황 상세 조회" 중계.
// 인증키는 Netlify 환경 변수 DATA_GO_KR_KEY 에서만 읽고 응답에 싣지 않는다.
const BASE = 'https://apis.data.go.kr/B551177/statusOfAllFltDeOdp';
const OPS = { arr: 'getFltArrivalsDeOdp', dep: 'getFltDeparturesDeOdp' };
const ROWS = 1000;
const MAX_PAGES = 2;

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
  });

// 서울 기준 오늘 날짜 (YYYYMMDD)
const today = () => {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
};

// 필드 이름이 문서에 없어서 대소문자 구분 없이 후보 이름으로 찾는다.
const pick = (o, ...names) => {
  const keys = Object.keys(o);
  for (const n of names) {
    const k = keys.find((x) => x.toLowerCase() === n.toLowerCase());
    if (k != null && o[k] != null && String(o[k]).trim() !== '') return String(o[k]).trim();
  }
  return null;
};

const mins = (a, b) => {
  // YYYYMMDDHHmm 두 값의 차이(분)
  if (!a || !b || a.length < 12 || b.length < 12) return null;
  const t = (s) => Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12));
  return Math.round((t(b) - t(a)) / 60000);
};

const norm = (o, dir) => {
  const sched = pick(o, 'scheduleDatetime', 'scheduleDateTime', 'scheduledDatetime', 'std', 'sta');
  const est = pick(o, 'estimatedDatetime', 'estimatedDateTime', 'changedDatetime', 'etd', 'eta');
  return {
    dir,
    fid: pick(o, 'fid'),
    flight: pick(o, 'flightId', 'flightid'),
    master: pick(o, 'masterFlightId', 'masterflightid'),
    codeshare: pick(o, 'codeshare', 'codeShare'),
    airline: pick(o, 'airline', 'airlineName'),
    airport: pick(o, 'airportCode', 'airportcode'),
    airport_name: pick(o, 'airport', 'airportName'),
    sched,
    est,
    delay_min: mins(sched, est),
    status: pick(o, 'remark', 'status'),
    gate: pick(o, 'gateNumber', 'gatenumber', 'gate'),
    terminal: pick(o, 'terminalId', 'terminalid', 'terminal'),
    stand: pick(o, 'fstandPosition', 'fstandposition', 'standPosition', 'stand'),
    type: pick(o, 'aircraftSubtype', 'aircraftSubType', 'aircraftsubtype'),
    reg: pick(o, 'aircraftRegNo', 'aircraftRegno', 'aircraftregno', 'regNo'),
    kind: pick(o, 'typeOfFlight', 'typeofflight'),
  };
};

async function page(key, dir, date, pageNo) {
  const u = new URL(`${BASE}/${OPS[dir]}`);
  u.searchParams.set('serviceKey', key);
  u.searchParams.set('pageNo', String(pageNo));
  u.searchParams.set('numOfRows', String(ROWS));
  u.searchParams.set('searchDate', date);
  u.searchParams.set('searchFrom', '0000');
  u.searchParams.set('searchTo', '2400');
  u.searchParams.set('passengerOrCargo', 'P');
  u.searchParams.set('type', 'json');
  const r = await fetch(u, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(9000) });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch {
    // 키 오류 등은 XML 로 내려온다. 사유 코드만 뽑고 원문은 싣지 않는다.
    const m = text.match(/<returnAuthMsg>([^<]+)</) || text.match(/<resultMsg>([^<]+)</) || text.match(/<errMsg>([^<]+)</);
    throw new Error(`${dir} ${r.status} ${m ? m[1] : '응답 형식 오류'}`);
  }
  const head = data?.response?.header || {};
  if (head.resultCode && head.resultCode !== '00') throw new Error(`${dir} ${head.resultCode} ${head.resultMsg || ''}`);
  const body = data?.response?.body || {};
  let items = body.items ?? [];
  if (items && !Array.isArray(items)) items = items.item ?? [];
  if (!Array.isArray(items)) items = [items];
  return { items, total: Number(body.totalCount) || items.length };
}

async function all(key, dir, date) {
  const first = await page(key, dir, date, 1);
  let items = first.items;
  for (let p = 2; p <= MAX_PAGES && items.length < first.total; p++) {
    items = items.concat((await page(key, dir, date, p)).items);
  }
  return { items, total: first.total };
}

export default async (req) => {
  const key = process.env.DATA_GO_KR_KEY;
  if (!key) return json({ error: 'DATA_GO_KR_KEY 환경 변수가 없습니다.' }, 500);
  const q = new URL(req.url).searchParams;
  try {
    const date = today();
    const [arr, dep] = await Promise.all([all(key, 'arr', date), all(key, 'dep', date)]);
    if (q.get('debug') === '1') {
      // 필드 이름 확인용: 첫 항목만 원문 그대로 보여 준다.
      return json({ date, arr_total: arr.total, dep_total: dep.total, arr_sample: arr.items[0] ?? null, dep_sample: dep.items[0] ?? null },
        200, { 'cache-control': 'public, max-age=900', 'netlify-cdn-cache-control': 'public, s-maxage=900' });
    }
    const flights = [...arr.items.map((o) => norm(o, 'arr')), ...dep.items.map((o) => norm(o, 'dep'))];
    return json(
      { source: '인천국제공항공사 항공기 운항 현황 상세 조회', date, at: Math.floor(Date.now() / 1000), totals: { arr: arr.total, dep: dep.total }, flights },
      200,
      // 개발 계정은 하루 500회라서 15분 동안 CDN 에 보관한다 (하루 최대 약 400회).
      { 'cache-control': 'public, max-age=300', 'netlify-cdn-cache-control': 'public, s-maxage=900' },
    );
  } catch (e) {
    return json({ error: String(e.message || e) }, 502, { 'cache-control': 'no-store' });
  }
};

export const config = { path: '/api/flights' };
