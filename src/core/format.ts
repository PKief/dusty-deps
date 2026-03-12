export function formatAge(days: number): string {
  const years = days / 365.25;
  if (years >= 1) {
    return `${years.toFixed(1)} years`;
  }
  const months = days / 30.44;
  if (months >= 1) {
    return `${months.toFixed(1)} months`;
  }
  return `${days} days`;
}

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}
