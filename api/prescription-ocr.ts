import {
  apiErrorResponse,
  createPrescriptionDrafts,
  getDeepSeekEnv,
  MAX_API_BODY_BYTES,
  type PrescriptionOcrBody,
} from '../server/deepseekCore.ts';

const JSON_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

function isSameOriginRequest(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ error: '不允许跨站调用识别接口' }, 403);

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_API_BODY_BYTES) return json({ error: '请求过大，请换一张更小的图片后重试' }, 413);

  try {
    const body = await request.json() as PrescriptionOcrBody;
    const payload = await createPrescriptionDrafts(body, getDeepSeekEnv(), request.signal);
    return json(payload);
  } catch (error) {
    const failure = apiErrorResponse(error);
    return json(failure.payload, failure.statusCode);
  }
}
