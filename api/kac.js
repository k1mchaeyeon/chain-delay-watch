// Vercel 용 진입점. 실제 코드는 netlify/functions/kac.mjs 하나를 같이 쓴다.
import handler from '../netlify/functions/kac.mjs';
import { wrap } from './_wrap.js';
export const config = { runtime: 'edge' };
export default wrap(handler);
