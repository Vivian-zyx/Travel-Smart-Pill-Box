const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';

export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-flash';
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_API_BODY_BYTES = 4_400_000;

export type DeepSeekEnv = {
  apiKey: string;
  model: string;
};

export type PrescriptionOcrBody = {
  imageData?: unknown;
  fileName?: unknown;
};

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
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
  const rawItems = Array.isArray(value.medications) ? value.medications : [value];

  return rawItems
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map(normalizeDraft)
    .filter((item) => item.name || item.times.length > 0 || item.unitsPerDose || item.unitLabel || item.notes)
    .slice(0, 30);
}

function parseModelJson(content: string) {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw new ApiError(502, 'DeepSeek 返回的内容不是有效 JSON，请重试');
  }
}

function dataUrlByteLength(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) return 0;
  const base64 = dataUrl.slice(commaIndex + 1).replace(/\s/g, '');
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function validateBody(body: PrescriptionOcrBody) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, '请求内容必须是 JSON 对象');
  }
  if (typeof body.imageData !== 'string' || !/^data:image\/(jpeg|png|gif|webp);base64,/i.test(body.imageData)) {
    throw new ApiError(400, '请上传 JPEG、PNG、GIF 或 WebP 图片');
  }
  if (dataUrlByteLength(body.imageData) > MAX_IMAGE_BYTES) {
    throw new ApiError(413, '图片处理后仍然过大，请换一张更小的图片后重试');
  }

  return {
    imageData: body.imageData,
    fileName: typeof body.fileName === 'string' ? body.fileName.slice(0, 120) : '未提供',
  };
}

export function getDeepSeekEnv(environment: NodeJS.ProcessEnv = process.env): DeepSeekEnv {
  return {
    apiKey: environment.DEEPSEEK_API_KEY?.trim() || '',
    model: environment.DEEPSEEK_MODEL?.trim() || DEFAULT_DEEPSEEK_MODEL,
  };
}

export function getPublicAiStatus(env: DeepSeekEnv) {
  return {
    configured: Boolean(env.apiKey),
    provider: 'deepseek',
    model: env.model,
  };
}

export async function createPrescriptionDrafts(
  body: PrescriptionOcrBody,
  env: DeepSeekEnv,
  requestSignal?: AbortSignal,
) {
  if (!env.apiKey) throw new ApiError(503, 'DeepSeek API 尚未配置');
  const { imageData, fileName } = validateBody(body);

  try {
    const timeoutSignal = AbortSignal.timeout(75_000);
    const signal = requestSignal ? AbortSignal.any([requestSignal, timeoutSignal]) : timeoutSignal;
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
                  `原文件名仅供对照：${fileName}。`,
                ].join(''),
              },
              { type: 'image_url', image_url: { url: imageData, detail: 'high' } },
            ],
          },
        ],
      }),
      signal,
    });

    const payload = await apiResponse.json().catch(() => ({})) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };
    if (!apiResponse.ok) {
      const detail = payload.error?.message || `DeepSeek 请求失败（${apiResponse.status}）`;
      throw new ApiError(apiResponse.status, detail.slice(0, 300));
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new ApiError(502, 'DeepSeek 未返回可解析内容');
    const drafts = normalizeDrafts(parseModelJson(content));
    if (drafts.length === 0) throw new ApiError(422, '未从图片中识别出可核对的药品');
    return { provider: 'deepseek', model: env.model, drafts };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new ApiError(504, 'DeepSeek 请求超时，请稍后重试');
    }
    throw new ApiError(502, '药单识别失败，请稍后重试或使用离线演示草稿');
  }
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof SyntaxError) {
    return { statusCode: 400, payload: { error: '请求内容不是有效 JSON' } };
  }
  const statusCode = error instanceof ApiError ? error.statusCode : 500;
  const message = error instanceof ApiError ? error.message : '服务器处理请求失败';
  return { statusCode, payload: { error: message } };
}
