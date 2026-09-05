export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function resolveEditableDate(
  nowKey: string,
  latestSeenDate: string,
): string {
  return nowKey > latestSeenDate ? nowKey : latestSeenDate;
}

export function isDateEditable(
  dateKey: string,
  editableDate: string,
): boolean {
  return dateKey === editableDate;
}
