export const CLASSES_PER_CREDIT = 15;
export const MIN_ATTENDANCE = 0.75;

export function getExpectedClasses(credits) {
  return Number(credits || 0) * CLASSES_PER_CREDIT;
}

export function calculateAttendance(attended, conducted) {
  const total = Number(conducted || 0);
  if (total <= 0) return 0;
  return (Number(attended || 0) / total) * 100;
}

export function getAdditionalAbsencesAllowed(attended, conducted, target = MIN_ATTENDANCE) {
  const a = Number(attended || 0);
  const c = Number(conducted || 0);
  if (c <= 0) return 0;
  return Math.max(0, Math.floor(a / target - c + 1e-9));
}

export function getRecoveryClassesNeeded(attended, conducted, target = MIN_ATTENDANCE) {
  const a = Number(attended || 0);
  const c = Number(conducted || 0);
  if (c <= 0 || a / c >= target) return 0;
  return Math.max(0, Math.ceil((target * c - a) / (1 - target)));
}

export function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}
