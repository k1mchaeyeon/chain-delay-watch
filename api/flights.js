// Vercel 용 진입점. 실제 코드는 netlify/functions/flights.mjs 하나를 같이 쓴다.
import handler from '../netlify/functions/flights.mjs';
import { wrap } from './_wrap.js';
// 인천공항 API 는 해외 지역에서 부르면 연결 실패(05)가 나서 서울 지역에서 실행한다.
export const config = { runtime: 'edge', regions: ['icn1'] };
export default wrap(handler);
