import { getDeepSeekEnv, getPublicAiStatus } from '../../server/deepseekCore.ts';

const JSON_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

export function GET() {
  return new Response(JSON.stringify(getPublicAiStatus(getDeepSeekEnv())), {
    status: 200,
    headers: JSON_HEADERS,
  });
}
