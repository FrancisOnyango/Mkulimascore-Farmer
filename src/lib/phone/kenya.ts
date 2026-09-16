export function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

export function normalizeKenyaPhone(value: string) {
  const digits = digitsOnly(value);
  if (digits.startsWith('254') && digits.length >= 12) return `+${digits.slice(0, 12)}`;
  if (digits.startsWith('0') && digits.length >= 10) return `+254${digits.slice(1, 10)}`;
  if (digits.length === 9) return `+254${digits}`;
  if (digits.startsWith('254')) return `+${digits}`;
  return value.trim();
}

export function maskPhone(value: string) {
  const normalized = normalizeKenyaPhone(value);
  const digits = digitsOnly(normalized);
  if (digits.length < 9) return value;
  const local = digits.startsWith('254') ? `0${digits.slice(3)}` : digits;
  return `${local.slice(0, 2)}** *** ${local.slice(-3)}`;
}

export function isPlausibleKenyaPhone(value: string) {
  const digits = digitsOnly(value);
  if (digits.startsWith('254')) return digits.length >= 12;
  if (digits.startsWith('0')) return digits.length >= 10;
  return digits.length >= 9;
}

export function formatKenyaPhoneInput(value: string) {
  let local = digitsOnly(value);
  if (local.startsWith('254')) local = `0${local.slice(3)}`;
  if (local.length > 0 && !local.startsWith('0')) local = `0${local}`;
  local = local.slice(0, 10);
  if (local.length <= 4) return local;
  if (local.length <= 7) return `${local.slice(0, 4)} ${local.slice(4)}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

/** Kenya national ID / alien ID digits for display and matching. */
export function normalizeNationalId(value: string) {
  return digitsOnly(value).slice(0, 12);
}

export function maskNationalId(value: string) {
  const digits = normalizeNationalId(value);
  if (digits.length < 4) return 'Added';
  return `****${digits.slice(-4)}`;
}

export function isPlausibleNationalId(value: string) {
  const digits = normalizeNationalId(value);
  return digits.length >= 6 && digits.length <= 12;
}
