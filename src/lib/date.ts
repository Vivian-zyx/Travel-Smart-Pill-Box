import type { Medication, Trip } from '../types';

const DAY_MS = 86_400_000;

export function parseLocalDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

export function toDateInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function addDays(value: string, days: number) {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  return toDateInput(date);
}

export function formatDate(value: string, withWeekday = false) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    ...(withWeekday ? { weekday: 'short' as const } : {}),
  }).format(parseLocalDate(value));
}

export function formatFullDate(value: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(parseLocalDate(value));
}

export function inclusiveDays(start: string, end: string) {
  if (!start || !end || end < start) return 0;
  return Math.floor((parseLocalDate(end).getTime() - parseLocalDate(start).getTime()) / DAY_MS) + 1;
}

export function tripDays(trip: Trip) {
  return inclusiveDays(trip.startDate, trip.endDate);
}

export function overlapDays(trip: Trip, medication: Medication) {
  if (!medication.schedule) return 0;
  const start = medication.schedule.startDate
    ? medication.schedule.startDate > trip.startDate
      ? medication.schedule.startDate
      : trip.startDate
    : trip.startDate;
  const end = medication.schedule.endDate
    ? medication.schedule.endDate < trip.endDate
      ? medication.schedule.endDate
      : trip.endDate
    : trip.endDate;
  return inclusiveDays(start, end);
}

export function requiredQuantity(trip: Trip, medication: Medication) {
  const schedule = medication.schedule;
  if (!schedule || schedule.dosesPerDay <= 0 || schedule.unitsPerDose <= 0 || !schedule.unitLabel) {
    return null;
  }
  const days = overlapDays(trip, medication);
  if (days <= 0) return 0;
  return days * schedule.dosesPerDay * schedule.unitsPerDose;
}

export function isMedicationActiveOnDate(medication: Medication, trip: Trip, date: string) {
  if (date < trip.startDate || date > trip.endDate) return false;
  if (!medication.schedule) return false;
  if (medication.schedule.startDate && date < medication.schedule.startDate) return false;
  if (medication.schedule.endDate && date > medication.schedule.endDate) return false;
  return true;
}

export function enumerateDates(start: string, end: string) {
  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) dates.push(cursor);
  return dates;
}
