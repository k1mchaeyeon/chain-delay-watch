// Vercel 용 진입점. 실제 코드는 netlify/functions/flights.mjs 하나를 같이 쓴다.
// 인천공항 API 는 Edge 실행 환경에서 부르면 연결 실패(05)가 나서 이 함수만 Node 실행 환경(서울 지역)에서 돌린다.
import handler from '../netlify/functions/flights.mjs';
import { wrap } from './_wrap.js';
const run = wrap(handler);
export function GET(request) {
  const host = request.headers.get('host') || 'localhost';
  return run({ url: new URL(request.url, `https://${host}`).href, headers: request.headers });
}
