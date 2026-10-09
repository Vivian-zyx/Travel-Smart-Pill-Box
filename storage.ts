import type { AppData } from '../types';

const STORAGE_KEY = 'travel-medication-box:v1';
const DEMO_CLEANUP_KEY = 'travel-medication-box:demo-cleanup-v1';

export const emptyData: AppData = {
  trips: [],
  medications: [],
  doseLogs: [],
};

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    const data: AppData = {
      trips: Array.isArray(parsed.trips) ? parsed.trips : [],
      medications: Array.isArray(parsed.medications) ? parsed.medications : [],
      doseLogs: Array.isArray(parsed.doseLogs) ? parsed.doseLogs : [],
    };
    if (localStorage.getItem(DEMO_CLEANUP_KEY)) return data;

    const demoTrip = data.trips.find((trip) =>
      trip.title === '杭州周末慢旅行'
      && data.medications.some((medication) => medication.tripId === trip.id && medication.name === '个人常用药（示例）'),
    );
    if (!demoTrip) return data;

    const removedMedicationIds = new Set(data.medications.filter((item) => item.tripId === demoTrip.id).map((item) => item.id));
    const cleaned: AppData = {
      trips: data.trips.filter((trip) => trip.id !== demoTrip.id),
      medications: data.medications.filter((item) => item.tripId !== demoTrip.id),
      doseLogs: data.doseLogs.filter((log) => !removedMedicationIds.has(log.medicationId)),
    };
    localStorage.setItem(DEMO_CLEANUP_KEY, '1');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    return cleaned;
  } catch {
    return emptyData;
  }
}

export function saveData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
