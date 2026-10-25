export type Period = {
  id: string;
  start: number;
  end: number;
  label: string;
  tone: string;
};
export type WeekValues = { plan?: string; [key: string]: string | undefined };
export type WeeklyReview = {
  wins?: string;
  blockers?: string;
  priorities?: string;
};
export type DayTask = {
  id: string;
  text: string;
  done: boolean;
  priority?: TaskPriority;
  category?: string;
  parentId?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  repeat?: Exclude<TaskRepeat, "none">;
  seriesId?: string;
};
export type PlanningCycle = Period & {
  startDate?: string;
  endDate?: string;
};
export type SprintDefinition = {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
};
export type CalendarView = "cycle" | "sprint" | "today" | "range";
export type CalendarData = {
  goals: Record<string, string>;
  outcomes: Record<string, string>;
  weeks: Record<string, WeekValues>;
  days: Record<string, string>;
  completed: Record<string, boolean>;
  tasks: Record<string, DayTask[]>;
  reviews: Record<string, WeeklyReview>;
  cycles: Record<string, PlanningCycle>;
  sprints: Record<string, SprintDefinition>;
};
export type TaskPriority = "low" | "medium" | "high";
export type TaskRepeat = "none" | "weekly" | "weekdays";
export type TaskFilter = "all" | "overdue" | "today" | "soon" | "high";
export type CalendarWeek = { n: number; days: Date[] };
export type Tracker = {
  id: string;
  label: string;
  tone: string;
  color: string;
};

export const weekKey = (periodId: string, week: number) =>
  periodId + "-W" + week;
export const dateKey = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
export const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en", { day: "2-digit", month: "short" }).format(
    date,
  );
export const isoDate = (date: Date) => dateKey(date);
export const parseDate = (value: string) => new Date(value + "T00:00:00");
export const periodStart = (period: PlanningCycle, year: number) =>
  period.startDate ? parseDate(period.startDate) : new Date(year, period.start, 1);
export const periodEnd = (period: PlanningCycle, year: number) =>
  period.endDate
    ? parseDate(period.endDate)
    : new Date(year, period.end + 1, 0);
export function makePeriods(year: number): Period[] {
  const shortYear =
    year >= 2000 && year < 2100 ? String(year).slice(-2) : String(year);
  return [
    { id: shortYear + ".1", start: 0, end: 3, label: "Jan – Apr", tone: "violet" },
    { id: shortYear + ".2", start: 4, end: 7, label: "May – Aug", tone: "blue" },
    { id: shortYear + ".3", start: 8, end: 11, label: "Sep – Dec", tone: "green" },
  ];
}
export function makeWeeks(period: PlanningCycle, year: number): CalendarWeek[] {
  const start = periodStart(period, year);
  start.setDate(start.getDate() - start.getDay());
  const end = periodEnd(period, year);
  end.setDate(end.getDate() + 6 - end.getDay());
  const weeks: CalendarWeek[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 7)) {
    weeks.push({
      n: weeks.length + 1,
      days: Array.from(
        { length: 7 },
        (_, index) =>
          new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + index),
      ),
    });
  }
  return weeks;
}
