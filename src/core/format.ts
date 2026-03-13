export function formatAge(days: number): string {
  if (days < 0) return "0 days";

  const years = days / 365.25;
  if (years >= 1) {
    return years.toFixed(1) + (years < 1.05 ? " year" : " years");
  }
  const months = days / 30.44;
  if (months >= 1) {
    return months.toFixed(1) + (months < 1.05 ? " month" : " months");
  }
  return days === 1 ? "1 day" : `${days} days`;
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
