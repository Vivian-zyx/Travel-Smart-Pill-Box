export type TripStatus = 'planning' | 'active' | 'completed';
export type MedicationType = 'scheduled' | 'backup';
export type MedicationSource = 'manual' | 'prescription_image' | 'scenario_catalog';
export type VerificationStatus = 'confirmed' | 'needs_review';

export type Trip = {
  id: string;
  title: string;
  destination?: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  medicationIds: string[];
  createdAt: string;
};

export type MedicationSchedule = {
  dosesPerDay: number;
  times: string[];
  unitsPerDose: number;
  unitLabel: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
};

export type Medication = {
  id: string;
  tripId: string;
  type: MedicationType;
  name: string;
  scenario?: string;
  schedule?: MedicationSchedule;
  backupQuantity?: number;
  backupUnit?: string;
  notes?: string;
  packed: boolean;
  storageLocation?: string;
  storageNote?: string;
  source: MedicationSource;
  sourceFileName?: string;
  verificationStatus: VerificationStatus;
  createdAt: string;
};

export type DoseLog = {
  id: string;
  tripId: string;
  medicationId: string;
  scheduledAt: string;
  status: 'confirmed_taken';
  confirmedAt: string;
};

export type AppData = {
  trips: Trip[];
  medications: Medication[];
  doseLogs: DoseLog[];
};

export type OcrDraft = {
  name: string;
  times: string[];
  unitsPerDose: number | '';
  unitLabel: string;
  durationText: string;
  notes: string;
  confidence: {
    name: 'high' | 'medium' | 'low';
    dosage: 'high' | 'medium' | 'low';
    times: 'high' | 'medium' | 'low';
  };
  warnings?: string[];
};
