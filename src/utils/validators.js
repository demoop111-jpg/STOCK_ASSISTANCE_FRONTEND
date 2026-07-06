export function isValidMobile(value) {
  return /^[6-9]\d{9}$/.test(String(value || '').trim());
}

export function isPositiveNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0;
}

export function cleanText(value) {
  return String(value || '').trim();
}
