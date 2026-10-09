import type { OcrResultItem } from '@paddleocr/paddleocr-js';
import type { OcrDraft } from '../types';

const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 2400;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const UNIT_PATTERN = '片|粒|袋|支|毫升|ml|mL|滴|揿|喷|丸|包|贴';
const DOSAGE_FORM_PATTERN = '缓释片|肠溶片|分散片|咀嚼片|泡腾片|片|胶囊|颗粒|口服液|混悬液|滴眼液|滴鼻液|喷雾剂|软膏|乳膏|贴剂|注射液|吸入剂|丸|散';
const MEDICATION_NAME_PATTERN = new RegExp(`([\\u4e00-\\u9fffA-Za-z][\\u4e00-\\u9fffA-Za-z0-9·（）()\\-]{1,36}?(?:${DOSAGE_FORM_PATTERN}))`, 'i');

type PaddleOcrModule = typeof import('@paddleocr/paddleocr-js');
type OcrEngine = Awaited<ReturnType<PaddleOcrModule['PaddleOCR']['create']>>;
type RecognizedLine = OcrResultItem & { text: string };

let enginePromise: Promise<OcrEngine> | null = null;

export interface PrescriptionOcrService {
  createDrafts(file: File): Promise<OcrDraft[]>;
}

export class MockPrescriptionOcrService implements PrescriptionOcrService {
  async createDrafts(_file: File): Promise<OcrDraft[]> {
    await new Promise((resolve) => window.setTimeout(resolve, 750));

    return [
      {
        name: 'Mock 药品一（请按图片修改）',
        times: ['08:00'],
        unitsPerDose: 1,
        unitLabel: '片',
        durationText: '',
        notes: '固定 Mock 草稿，不是对上传图片的真实识别。',
        confidence: { name: 'medium', dosage: 'medium', times: 'low' },
      },
      {
        name: 'Mock 药品二（请按图片修改）',
        times: ['20:00'],
        unitsPerDose: '',
        unitLabel: '',
        durationText: '',
        notes: '缺失字段可以留空；核对后仍可加入药单，但不会生成提醒。',
        confidence: { name: 'medium', dosage: 'low', times: 'low' },
      },
    ];
  }
}

export class BrowserPrescriptionOcrService implements PrescriptionOcrService {
  async createDrafts(file: File): Promise<OcrDraft[]> {
    const preparedImage = await prepareImageForOcr(file);
    const engine = await getOcrEngine();
    const predictions = await engine.predict(preparedImage, {
      textDetLimitSideLen: MAX_IMAGE_DIMENSION,
      textRecScoreThresh: 0.35,
    }).catch(() => {
      throw new Error('识别暂时失败，请检查网络或更换图片后重试');
    });
    const [result] = predictions;

    if (!result || result.items.length === 0) {
      throw new Error('没有识别到清晰文字，请裁剪药单区域或换一张更清楚的图片');
    }

    return createDraftsFromLines(result.items);
  }
}

function getOcrEngine() {
  if (!enginePromise) {
    enginePromise = import('@paddleocr/paddleocr-js').then(({ PaddleOCR }) => PaddleOCR.create({
      lang: 'ch',
      ocrVersion: 'PP-OCRv5',
      worker: true,
      ortOptions: {
        backend: 'wasm',
        numThreads: 1,
        simd: true,
        ...(import.meta.env.PROD ? { wasmPaths: `${import.meta.env.BASE_URL}assets/` } : {}),
      },
    })).catch(() => {
      enginePromise = null;
      throw new Error('识别组件加载失败，请检查网络后重试');
    });
  }
  return enginePromise;
}

function createDraftsFromLines(items: OcrResultItem[]): OcrDraft[] {
  const lines = items
    .map((item): RecognizedLine => ({ ...item, text: normalizeText(item.text) }))
    .filter((item) => item.text && item.score >= 0.35)
    .sort(compareReadingOrder);

  const medicationIndexes = lines
    .map((line, index) => MEDICATION_NAME_PATTERN.test(stripFieldPrefix(line.text)) ? index : -1)
    .filter((index) => index >= 0);

  if (medicationIndexes.length === 0) {
    return [{
      name: '',
      times: [],
      unitsPerDose: '',
      unitLabel: '',
      durationText: '',
      notes: `识别原文：${lines.map((line) => line.text).join(' / ')}`,
      confidence: { name: 'low', dosage: 'low', times: 'low' },
      warnings: ['已识别到文字，但未可靠分辨药品条目。请根据原图填写药品名称。'],
    }];
  }

  return medicationIndexes.slice(0, 30).map((lineIndex, candidateIndex) => {
    const nextMedicationIndex = medicationIndexes[candidateIndex + 1] ?? lines.length;
    const contextLines = lines.slice(lineIndex, Math.min(nextMedicationIndex, lineIndex + 4));
    const context = contextLines.map((line) => line.text).join('；');
    const nameMatch = stripFieldPrefix(lines[lineIndex].text).match(MEDICATION_NAME_PATTERN);
    const name = nameMatch?.[1]?.trim() || '';
    const dose = parseDose(context);
    const times = parseExplicitTimes(context);
    const durationText = parseDuration(context);
    const usageText = parseUsageText(context);
    const averageScore = contextLines.reduce((sum, line) => sum + line.score, 0) / contextLines.length;
    const warnings = ['本机 OCR 与规则提取可能有误，请逐项对照原图。'];
    if (averageScore < 0.72) warnings.push('这一项文字较模糊，建议重点核对。');
    if (!dose) warnings.push('未可靠识别每次数量或单位，请手动补充。');
    if (times.length === 0) warnings.push('未发现明确的钟点时间，不会自动生成提醒。');

    return {
      name,
      times,
      unitsPerDose: dose?.amount ?? '',
      unitLabel: dose?.unit ?? '',
      durationText,
      notes: [usageText, `识别原文：${context}`].filter(Boolean).join('；'),
      confidence: {
        name: scoreToConfidence(lines[lineIndex].score),
        dosage: dose ? scoreToConfidence(averageScore) : 'low',
        times: times.length > 0 ? scoreToConfidence(averageScore) : 'low',
      },
      warnings,
    };
  });
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').replace(/[：︰]/g, ':').trim();
}

function stripFieldPrefix(value: string) {
  return value
    .replace(/^\s*(?:\d{1,2}[.、)）]|[（(]?\d{1,2}[）)])\s*/, '')
    .replace(/^\s*(?:药品名称|药名|名称)\s*[:：]?\s*/, '');
}

function compareReadingOrder(a: RecognizedLine, b: RecognizedLine) {
  const aTop = Math.min(...a.poly.map((point) => point[1]));
  const bTop = Math.min(...b.poly.map((point) => point[1]));
  const aLeft = Math.min(...a.poly.map((point) => point[0]));
  const bLeft = Math.min(...b.poly.map((point) => point[0]));
  const rowTolerance = 14;
  return Math.abs(aTop - bTop) <= rowTolerance ? aLeft - bLeft : aTop - bTop;
}

function parseDose(text: string) {
  const match = text.match(new RegExp(`(?:每次|一次|每服)\\s*([0-9]+(?:\\.[0-9]+)?|半|一|二|两|三|四|五|六|七|八|九|十)\\s*(${UNIT_PATTERN})`, 'i'))
    ?? text.match(new RegExp(`([0-9]+(?:\\.[0-9]+)?)\\s*(${UNIT_PATTERN})\\s*[/／]\\s*次`, 'i'));
  if (!match) return null;
  const amount = chineseNumberToNumber(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { amount, unit: normalizeUnit(match[2]) };
}

function parseExplicitTimes(text: string) {
  const matches = [...text.matchAll(/(?:^|[^0-9])([01]?\d|2[0-3])[:：]([0-5]\d)(?!\d)/g)];
  return [...new Set(matches.map((match) => `${match[1].padStart(2, '0')}:${match[2]}`))].sort();
}

function parseDuration(text: string) {
  return text.match(/(?:疗程|连用|服用|使用)?\s*[0-9一二两三四五六七八九十半]+\s*(?:天|日|周|星期|个月|月)/)?.[0]?.trim() || '';
}

function parseUsageText(text: string) {
  const parts = [
    text.match(/(?:每日|每天|一日|一天)\s*[0-9一二两三四五六七八九十]+\s*次/)?.[0],
    text.match(/(?:早晚|早中晚|睡前|晨起|饭前|餐前|饭后|餐后|空腹|随餐)/)?.[0],
    text.match(/(?:口服|外用|含服|舌下|滴眼|滴鼻|吸入|肌注|静滴)/)?.[0],
  ].filter((part): part is string => Boolean(part));
  return [...new Set(parts)].join('；');
}

function chineseNumberToNumber(value: string) {
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (value === '半') return 0.5;
  const digits: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  return digits[value] ?? Number.NaN;
}

function normalizeUnit(value: string) {
  return /^ml$/i.test(value) ? '毫升' : value;
}

function scoreToConfidence(score: number): 'high' | 'medium' | 'low' {
  return score >= 0.9 ? 'high' : score >= 0.72 ? 'medium' : 'low';
}

async function prepareImageForOcr(file: File) {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    throw new Error('仅支持 JPEG、PNG、GIF 或 WebP 图片');
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error('原图超过 20 MB，请裁剪或压缩后重试');
  }
  if (typeof createImageBitmap !== 'function') return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error('浏览器无法读取这张图片，请换用 JPG、PNG 或 WebP');

  try {
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器无法处理这张图片');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.filter = 'grayscale(1) contrast(1.15)';
    context.drawImage(bitmap, 0, 0, width, height);
    return await canvasToBlob(canvas, 'image/jpeg', 0.9);
  } finally {
    bitmap.close();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('图片处理失败')), type, quality);
  });
}

export const prescriptionOcrService: PrescriptionOcrService = new BrowserPrescriptionOcrService();
export const mockPrescriptionOcrService: PrescriptionOcrService = new MockPrescriptionOcrService();
