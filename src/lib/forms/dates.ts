export type DayChoice = 'today' | 'yesterday' | 'custom';

export function isoFromChoice(choice: DayChoice, custom = '') {
  if (choice === 'yesterday') {
    const value = new Date();
    value.setDate(value.getDate() - 1);
    return value.toISOString();
  }
  if (choice === 'custom' && custom.trim()) {
    const parsed = new Date(`${custom.trim()}T12:00:00`);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

export function todayKey() {
  return localDayKey(new Date());
}

export function yesterdayKey() {
  const value = new Date();
  value.setDate(value.getDate() - 1);
  return localDayKey(value);
}

export function localDayKey(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function prettyDay(iso: string) {
  const value = new Date(iso);
  if (!Number.isFinite(value.getTime())) return 'Date not set';
  return value.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}
