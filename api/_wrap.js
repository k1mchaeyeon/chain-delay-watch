// Netlify 전용 CDN 보관 헤더를 Vercel 이 읽는 이름으로 옮긴다.
export const wrap = (handler) => async (req) => {
  const res = await handler(req);
  const cdn = res.headers.get('netlify-cdn-cache-control');
  if (!cdn) return res;
  const headers = new Headers(res.headers);
  headers.set('cdn-cache-control', cdn);
  return new Response(res.body, { status: res.status, headers });
};
