import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv, type Plugin } from 'vite';

const MAX_BODY_BYTES = 16 * 1024 * 1024;
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const DEFAULT_MODEL = 'deepseek-flash';

type DeepSeekEnv = {
  apiKey: string;
  model: string;
};

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
    if (size > MAX_BODY_BYTES) throw new Error('IMAGE_TOO_LARGE');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as { imageData?: unknown; fileName?: unknown };
}

function parseModelJson(content: string) {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned) as Record<string, unknown>;
}

const confidence = (value: unknown): 'high' | 'medium' | 'low' =>
  value === 'high' || value === 'medium' ? value : 'low';

function normalizeDraft(value: Record<string, unknown>) {
  const rawConfidence = value.confidence && typeof value.confidence === 'object'
    ? value.confidence as Record<string, unknown>
    : {};
  const times = Array.isArray(value.times)
    ? value.times.filter((item): item is string => typeof item === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(item))
    : [];
  const units = typeof value.unitsPerDose === 'number' && Number.isFinite(value.unitsPerDose) && value.unitsPerDose > 0
    ? value.unitsPerDose
    : '';

  return {
    name: typeof value.name === 'string' ? value.name.trim() : '',
    times,
    unitsPerDose: units,
    unitLabel: typeof value.unitLabel === 'string' ? value.unitLabel.trim() : '',
    durationText: typeof value.durationText === 'string' ? value.durationText.trim() : '',
    notes: typeof value.notes === 'string' ? value.notes.trim() : '',
    confidence: {
      name: confidence(rawConfidence.name),
      dosage: confidence(rawConfidence.dosage),
      times: confidence(rawConfidence.times),
    },
    warnings: Array.isArray(value.warnings)
      ? value.warnings.filter((item): item is string => typeof item === 'string').slice(0, 6)
      : [],
  };
}

function normalizeDrafts(value: Record<string, unknown>) {
  const rawItems = Array.isArray(value.medications)
    ? value.medications
    : [value];

  return rawItems
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map(normalizeDraft)
    .filter((item) => item.name || item.times.length > 0 || item.unitsPerDose || item.unitLabel || item.notes)
    .slice(0, 30);
}

async function handlePrescriptionOcr(request: IncomingMessage, response: ServerResponse, env: DeepSeekEnv) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: '仅支持 POST 请求' });
  if (!env.apiKey) return sendJson(response, 503, { error: 'DeepSeek API 尚未配置' });

  try {
    const body = await readJsonBody(request);
    if (typeof body.imageData !== 'string' || !/^data:image\/(jpeg|png|gif|webp);base64,/i.test(body.imageData)) {
      return sendJson(response, 400, { error: '请上传 JPEG、PNG、GIF 或 WebP 图片' });
    }

    const apiResponse = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.model,
        reasoning_effort: 'none',
        response_format: { type: 'json_object' },
        max_tokens: 4000,
        messages: [
          {
            role: 'system',
            content: [
              '你是药单文字转录工具，不是医生。只提取图片中清晰可见的原文信息。',
              '禁止推断、补全、推荐、纠错或调整药品、剂量、频率、疗程。',
              '看不清或没有出现的字段必须返回空字符串、空数组或 null，并将置信度设为 low。',
              '仅输出 JSON，不要包含 Markdown。',
            ].join(''),
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: [
                  '请把这张药单图片中的所有药品逐条转为待用户核对的结构化草稿，不得只返回第一条。',
                  '返回 JSON 对象，顶层字段 medications 为数组；图片中每一种药对应一个数组项，并保持原图顺序。',
                  '每项字段：name(string), times(string[]，仅 HH:mm), unitsPerDose(number|null), unitLabel(string), durationText(string), notes(string),',
                  'confidence({name:"high|medium|low",dosage:"high|medium|low",times:"high|medium|low"}), warnings(string[])。',
                  '即使某个药品的剂量或时间看不清，也要保留该药品并把相应字段留空，不要省略整项。不要合并不同药品。',
                  `原文件名仅供对照：${typeof body.fileName === 'string' ? body.fileName.slice(0, 120) : '未提供'}。`,
                ].join(''),
              },
              { type: 'image_url', image_url: { url: body.imageData, detail: 'high' } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(75_000),
    });

    const payload = await apiResponse.json() as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };
    if (!apiResponse.ok) {
      const detail = payload.error?.message || `DeepSeek 请求失败（${apiResponse.status}）`;
      return sendJson(response, apiResponse.status, { error: detail.slice(0, 300) });
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) return sendJson(response, 502, { error: 'DeepSeek 未返回可解析内容' });
    const drafts = normalizeDrafts(parseModelJson(content));
    if (drafts.length === 0) return sendJson(response, 422, { error: '未从图片中识别出可核对的药品' });
    return sendJson(response, 200, { provider: 'deepseek', model: env.model, drafts });
  } catch (error) {
    if (error instanceof Error && error.message === 'IMAGE_TOO_LARGE') {
      return sendJson(response, 413, { error: '图片过大，请压缩到 10 MB 以内后重试' });
    }
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? 'DeepSeek 请求超时，请稍后重试'
      : '药单识别失败，请稍后重试或使用离线演示草稿';
    return sendJson(response, 500, { error: message });
  }
}

function registerMiddleware(server: { middlewares: { use: (route: string, handler: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>) => void } }, env: DeepSeekEnv) {
  server.middlewares.use('/api/ai/status', (_request, response) => {
    sendJson(response, 200, { configured: Boolean(env.apiKey), provider: 'deepseek', model: env.model });
  });
  server.middlewares.use('/api/prescription-ocr', (request, response) => handlePrescriptionOcr(request, response, env));
}

export function deepseekProxyPlugin(mode: string): Plugin {
  const loaded = loadEnv(mode, process.cwd(), '');
  const env: DeepSeekEnv = {
    apiKey: loaded.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || '',
    model: loaded.DEEPSEEK_MODEL || process.env.DEEPSEEK_MODEL || DEFAULT_MODEL,
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
