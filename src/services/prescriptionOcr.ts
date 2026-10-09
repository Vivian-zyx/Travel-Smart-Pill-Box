import type { OcrDraft } from '../types';

const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_UPLOAD_IMAGE_BYTES = 2.8 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 2400;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

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

export class DeepSeekPrescriptionOcrService implements PrescriptionOcrService {
  async createDrafts(file: File): Promise<OcrDraft[]> {
    const preparedImage = await prepareImageForUpload(file);
    const imageData = await fileToDataUrl(preparedImage);
    const response = await fetch('/api/prescription-ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData, fileName: file.name }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string; drafts?: OcrDraft[]; draft?: OcrDraft };
    const drafts = payload.drafts ?? (payload.draft ? [payload.draft] : []);
    if (!response.ok || drafts.length === 0) {
      const fallback = response.status === 413
        ? '图片请求过大，请裁剪图片后重试'
        : `DeepSeek 识别失败（${response.status || '网络错误'}）`;
      throw new Error(payload.error || fallback);
    }
    return drafts;
  }

}

function fileToDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('图片读取失败'));
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

async function prepareImageForUpload(file: File) {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    throw new Error('仅支持 JPEG、PNG、GIF 或 WebP 图片');
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error('原图超过 20 MB，请裁剪或压缩后重试');
  }
  if (file.size <= MAX_UPLOAD_IMAGE_BYTES) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error('浏览器无法压缩这张图片，请换用 JPG、PNG 或 WebP');

  try {
    const initialScale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    let width = Math.max(1, Math.round(bitmap.width * initialScale));
    let height = Math.max(1, Math.round(bitmap.height * initialScale));

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('浏览器无法处理这张图片');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);

      const quality = Math.max(0.64, 0.86 - attempt * 0.07);
      const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
      if (blob.size <= MAX_UPLOAD_IMAGE_BYTES) return blob;

      const shrink = Math.min(0.82, Math.sqrt(MAX_UPLOAD_IMAGE_BYTES / blob.size) * 0.92);
      width = Math.max(1, Math.round(width * shrink));
      height = Math.max(1, Math.round(height * shrink));
    }
  } finally {
    bitmap.close();
  }

  throw new Error('图片压缩后仍然过大，请先裁剪无关区域再重试');
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('图片压缩失败')), type, quality);
  });
}

export async function getPrescriptionOcrStatus() {
  try {
    const response = await fetch('/api/ai/status', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error('status unavailable');
    return await response.json() as { configured: boolean; provider: string; model: string };
  } catch {
    return { configured: false, provider: 'deepseek', model: 'deepseek-flash' };
  }
}

export const prescriptionOcrService: PrescriptionOcrService = new DeepSeekPrescriptionOcrService();
export const mockPrescriptionOcrService: PrescriptionOcrService = new MockPrescriptionOcrService();
