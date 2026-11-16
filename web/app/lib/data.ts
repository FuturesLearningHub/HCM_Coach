// Fictional people and data for the practice environment. Nothing here is real.

export type Person = {
  slug: string;
  personNumber: string;
  name: string;
  title: string;
  department: string;
  payType: string;
  nonExempt: boolean;
  manager: string;
  isManager: boolean;
};

export const PEOPLE: Person[] = [
  {
    slug: "jordan-avery",
    personNumber: "100482",
    name: "Jordan Avery",
    title: "Administrative Assistant II",
    department: "Administrative Services",
    payType: "Non-exempt · Biweekly",
    nonExempt: true,
    manager: "Sam Whitfield",
    isManager: false,
  },
  {
    slug: "jordan-ellis",
    personNumber: "100517",
    name: "Jordan Ellis",
    title: "Program Coordinator",
    department: "Student Programs",
    payType: "Exempt · Monthly",
    nonExempt: false,
    manager: "Priya Raman",
    isManager: false,
  },
  {
    slug: "priya-raman",
    personNumber: "100231",
    name: "Priya Raman",
    title: "Manager, Operations",
    department: "Operations",
    payType: "Exempt · Monthly",
    nonExempt: false,
    manager: "Dana Okafor",
    isManager: true,
  },
  {
    slug: "sam-whitfield",
    personNumber: "100198",
    name: "Sam Whitfield",
    title: "Manager, Administrative Services",
    department: "Administrative Services",
    payType: "Exempt · Monthly",
    nonExempt: false,
    manager: "Dana Okafor",
    isManager: true,
  },
  {
    slug: "marcus-lindqvist",
    personNumber: "100634",
    name: "Marcus Lindqvist",
    title: "Facilities Technician",
    department: "Facilities",
    payType: "Non-exempt · Biweekly",
    nonExempt: true,
    manager: "Priya Raman",
    isManager: false,
  },
];

export type ManagerOption = { name: string; title: string };

// People who can be picked as a line manager. Priya Ramos is a similar name on purpose.
export const MANAGERS: ManagerOption[] = [
  { name: "Priya Raman", title: "Manager, Operations" },
  { name: "Priya Ramos", title: "Manager, Dining Services" },
  { name: "Sam Whitfield", title: "Manager, Administrative Services" },
  { name: "Dana Okafor", title: "Director, People Operations" },
];

export function findPerson(slug: string | null): Person | undefined {
  return PEOPLE.find((p) => p.slug === slug);
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/* ---------- dates (always local, never UTC) ---------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Parse a yyyy-mm-dd value from <input type="date"> as a local date. */
export function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 2000 || year > 2100) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function weekdayName(date: Date): string {
  return WEEKDAYS[date.getDay()];
}

export function formatDate(value: string): string {
  const date = parseLocalDate(value);
  if (!date) return value;
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatLongDate(value: string): string {
  const date = parseLocalDate(value);
  if (!date) return value;
  return `${weekdayName(date)}, ${formatDate(value)}`;
}

export function formatRange(start: string, end: string): string {
  return start === end ? formatDate(start) : `${formatDate(start)} to ${formatDate(end)}`;
}

/** Working hours between two dates, inclusive: 8 hours per weekday. */
export function workHours(start: string, end: string): number | null {
  const from = parseLocalDate(start);
  const to = parseLocalDate(end);
  if (!from || !to || to < from) return null;
  let days = 0;
  const cursor = new Date(from);
  while (cursor <= to && days < 400) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) days += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return days * 8;
}

/* ---------- time off ---------- */

export type TimeOffRequest = {
  id: string;
  type: string;
  reason: string;
  start: string;
  end: string;
  hours: number;
  status: string;
  submitted: string;
};

export const VACATION_BALANCE = 64;

export const SAMPLE_REQUESTS: TimeOffRequest[] = [
  {
    id: "s1",
    type: "Personal Day",
    reason: "Personal",
    start: "2026-12-24",
    end: "2026-12-24",
    hours: 8,
    status: "Pending Payroll release",
    submitted: "2026-11-09",
  },
  {
    id: "s2",
    type: "Vacation",
    reason: "Family",
    start: "2026-10-08",
    end: "2026-10-09",
    hours: 16,
    status: "Approved",
    submitted: "2026-09-18",
  },
  {
    id: "s3",
    type: "Sick",
    reason: "Other",
    start: "2026-09-21",
    end: "2026-09-21",
    hours: 8,
    status: "Approved",
    submitted: "2026-09-21",
  },
];

const STORAGE_KEY = "hcm-practice.time-off.submitted";

export function loadSubmitted(): TimeOffRequest[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as TimeOffRequest[]) : [];
  } catch {
    return [];
  }
}

export function saveSubmitted(request: TimeOffRequest): void {
  try {
    const next = [request, ...loadSubmitted()];
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable (private mode). The confirmation still shows.
  }
}

export function todayValue(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

/* ---------- signed-in user (fictional) ---------- */

export const CURRENT_USER = { name: "Alex Morgan", initials: "AM" };
export const DECOY_NOTICE = "This action is not part of this practice.";
