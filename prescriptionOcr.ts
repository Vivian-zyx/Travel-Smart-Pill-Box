import type { OcrDraft } from '../types';

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
    if (file.size > 10 * 1024 * 1024) throw new Error('图片过大，请压缩到 10 MB 以内后重试');
    const imageData = await fileToDataUrl(file);
    const response = await fetch('/api/prescription-ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData, fileName: file.name }),
    });
    const payload = await response.json() as { error?: string; drafts?: OcrDraft[]; draft?: OcrDraft };
    const drafts = payload.drafts ?? (payload.draft ? [payload.draft] : []);
    if (!response.ok || drafts.length === 0) throw new Error(payload.error || 'DeepSeek 未识别出药品');
    return drafts;
  }

}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('图片读取失败'));
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

export async function getPrescriptionOcrStatus() {
  try {
    const response = await fetch('/api/ai/status', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('status unavailable');
    return await response.json() as { configured: boolean; provider: string; model: string };
  } catch {
    return { configured: false, provider: 'deepseek', model: 'deepseek-flash' };
  }
}

export const prescriptionOcrService: PrescriptionOcrService = new DeepSeekPrescriptionOcrService();
export const mockPrescriptionOcrService: PrescriptionOcrService = new MockPrescriptionOcrService();
