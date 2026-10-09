import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv, type Plugin } from 'vite';
import {
  apiErrorResponse,
  createPrescriptionDrafts,
  DEFAULT_DEEPSEEK_MODEL,
  getPublicAiStatus,
  MAX_API_BODY_BYTES,
  type DeepSeekEnv,
  type PrescriptionOcrBody,
} from './deepseekCore.ts';

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_API_BODY_BYTES) throw new Error('IMAGE_TOO_LARGE');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as PrescriptionOcrBody;
}

async function handlePrescriptionOcr(request: IncomingMessage, response: ServerResponse, env: DeepSeekEnv) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: '仅支持 POST 请求' });

  try {
    const body = await readJsonBody(request);
    const payload = await createPrescriptionDrafts(body, env);
    return sendJson(response, 200, payload);
  } catch (error) {
    if (error instanceof Error && error.message === 'IMAGE_TOO_LARGE') {
      return sendJson(response, 413, { error: '请求过大，请换一张更小的图片后重试' });
    }
    const failure = apiErrorResponse(error);
    return sendJson(response, failure.statusCode, failure.payload);
  }
}

function registerMiddleware(server: { middlewares: { use: (route: string, handler: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>) => void } }, env: DeepSeekEnv) {
  server.middlewares.use('/api/ai/status', (_request, response) => {
    sendJson(response, 200, getPublicAiStatus(env));
  });
  server.middlewares.use('/api/prescription-ocr', (request, response) => handlePrescriptionOcr(request, response, env));
}

export function deepseekProxyPlugin(mode: string): Plugin {
  const loaded = loadEnv(mode, process.cwd(), '');
  const env: DeepSeekEnv = {
    apiKey: loaded.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || '',
    model: loaded.DEEPSEEK_MODEL || process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL,
  };

  return {
    name: 'deepseek-server-proxy',
    configureServer(server) {
      registerMiddleware(server, env);
    },
    configurePreviewServer(server) {
      registerMiddleware(server, env);
    },
  };
}
