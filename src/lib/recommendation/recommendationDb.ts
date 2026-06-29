function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** YYYY-MM-DD（本地日历） */
export function todayLocalIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** ISO 周一日期（本地时区） */
export function getMondayOfWeek(d: Date = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
}

export function getWeekDatesFromMonday(mondayIso: string): string[] {
  const parts = mondayIso.split("-").map(Number);
  const y = parts[0]!;
  const mo = parts[1]!;
  const day = parts[2]!;
  const base = new Date(y, mo - 1, day);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const t = new Date(base);
    t.setDate(base.getDate() + i);
    dates.push(`${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`);
  }
  return dates;
}
