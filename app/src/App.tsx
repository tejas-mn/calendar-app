import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarTable } from "./components/CalendarTable";
import { PlannerHeader } from "./components/PlannerHeader";
import { CalendarViewControls } from "./components/CalendarViewControls";
import { TaskItem } from "./components/TaskItem";
import {
  dateKey,
  formatDate,
  makePeriods,
  makeWeeks,
  parseDate,
  periodEnd,
  periodStart,
  weekKey,
} from "./types";
import type {
  CalendarView,
  PlanningCycle,
  SprintDefinition,
} from "./types";

type W = { plan?: string; [key: string]: string | undefined };
type WeeklyReview = { wins?: string; blockers?: string; priorities?: string };
type S = {
  goals: Record<string, string>;
  outcomes: Record<string, string>;
  weeks: Record<string, W>;
  days: Record<string, string>;
  completed: Record<string, boolean>;
  tasks: Record<string, DayTask[]>;
  reviews: Record<string, WeeklyReview>;
  cycles: Record<string, PlanningCycle>;
  sprints: Record<string, SprintDefinition>;
};
type TaskPriority = "low" | "medium" | "high";
type TaskRepeat = "none" | "weekly" | "weekdays";
type TaskFilter = "all" | "overdue" | "today" | "soon" | "high";
type DayTask = {
  id: string;
  text: string;
  done: boolean;
  category?: string;
  parentId?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  priority?: TaskPriority;
  repeat?: Exclude<TaskRepeat, "none">;
  seriesId?: string;
};
type Tracker = { id: string; label: string; tone: string; color: string };
const storeKey = "calendar-planner-2027-v1";
const widthKey = "calendar-planner-2027-column-widths";
const themeKey = "calendar-planner-2027-theme",
  yearKey = "calendar-planner-selected-year";
const viewKey = "calendar-planner-view-v2";
const rangeStartKey = "calendar-planner-range-start";
const rangeEndKey = "calendar-planner-range-end";
const trackerKey = "calendar-planner-2027-trackers",
  sprintKey = "calendar-planner-2027-sprint-length";
const trackerColors = [
  "#e8c7dc",
  "#d8cbed",
  "#dce8c8",
  "#f0ccd2",
  "#c9e5d8",
  "#d8dce3",
];
const defaultTrackers: Tracker[] = [
  {
    id: "contests",
    label: "Contests",
    tone: "contests",
    color: trackerColors[0],
  },
  {
    id: "revision",
    label: "Revision",
    tone: "revision",
    color: trackerColors[1],
  },
  { id: "apply", label: "Job apply", tone: "apply", color: trackerColors[2] },
  { id: "notes", label: "Notes", tone: "notes", color: trackerColors[3] },
  {
    id: "health",
    label: "Health / exercise",
    tone: "health",
    color: trackerColors[4],
  },
  { id: "work", label: "Work related", tone: "work", color: trackerColors[5] },
];
const trackerTones = [
  "contests",
  "revision",
  "apply",
  "notes",
  "health",
  "work",
];
function loadTrackers(): Tracker[] {
  try {
    const v = JSON.parse(localStorage.getItem(trackerKey) || "null");
    return Array.isArray(v)
      ? v
          .filter(
            (x) => x && typeof x.id === "string" && typeof x.label === "string",
          )
          .map((x, i) => ({
            ...x,
            tone: trackerTones[i % trackerTones.length],
            color:
              typeof x.color === "string"
                ? x.color
                : trackerColors[i % trackerColors.length],
          }))
      : defaultTrackers;
  } catch {
    return defaultTrackers;
  }
}
function loadSprint(): number {
  const n = Number(localStorage.getItem(sprintKey));
  return Number.isInteger(n) && n >= 1 && n <= 8 ? n : 2;
}
const defaultWidths = [
  64, 76, 76, 76, 76, 76, 76, 76, 190, 112, 112, 122, 180, 170, 150,
];
function loadWidths(): number[] {
  try {
    const saved = JSON.parse(localStorage.getItem(widthKey) || "null");
    return Array.isArray(saved) && saved.length >= 9
      ? saved.map((n: number) => Math.max(52, Number(n) || 70))
      : defaultWidths;
  } catch {
    return defaultWidths;
  }
}
function fitColumnWidths(source: number[], available: number): number[] {
  const minWidths = [
    48,
    50,
    50,
    50,
    50,
    50,
    50,
    50,
    110,
    ...source.slice(9).map(() => 95),
  ];
  const total = source.reduce((a, b) => a + b, 0),
    minimum = minWidths.reduce((a, b) => a + b, 0);
  if (total <= available || available < minimum) return source;
  const factor = (available - minimum) / (total - minimum);
  return source.map((width, index) =>
    Math.floor(minWidths[index] + (width - minWidths[index]) * factor),
  );
}
const empty: S = {
  goals: {},
  outcomes: {},
  weeks: {},
  days: {},
  completed: {},
  tasks: {},
  reviews: {},
  cycles: {},
  sprints: {},
};
const dkey = (date: Date | null) => dateKey(date || new Date());
const wkey = weekKey;
const load = (): S => {
  try {
    const x = JSON.parse(localStorage.getItem(storeKey) || "null");
    return x ? { ...empty, ...x } : empty;
  } catch {
    return empty;
  }
};
const fmt = formatDate;
function saveFile(name: string, data: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
export default function App() {
  const [initialView] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    return {
      year,
      periodId: makePeriods(year)[Math.floor(today.getMonth() / 4)].id,
    };
  });
  const [year, setYear] = useState(initialView.year),
    [periodId, setPeriodId] = useState(initialView.periodId),
    [data, setData] = useState<S>(load),
    [search, setSearch] = useState(""),
    [day, setDay] = useState<Date | null>(null),
    [trackers, setTrackers] = useState<Tracker[]>(loadTrackers),
    [sprintLength, setSprintLength] = useState(loadSprint),
    [settingsOpen, setSettingsOpen] = useState(false),
    [upcomingOpen, setUpcomingOpen] = useState(false),
    [taskFilter, setTaskFilter] = useState<TaskFilter>("all"),
    [dashboardOpen, setDashboardOpen] = useState(false),
    [yearSearchOpen, setYearSearchOpen] = useState(false),
    [yearSearch, setYearSearch] = useState(""),
    [view, setView] = useState<CalendarView>(
      () => (localStorage.getItem(viewKey) as CalendarView) || "sprint",
    ),
    [rangeStart, setRangeStart] = useState(
      () => localStorage.getItem(rangeStartKey) || "",
    ),
    [rangeEnd, setRangeEnd] = useState(
      () => localStorage.getItem(rangeEndKey) || "",
    ),
    [newTaskText, setNewTaskText] = useState(""),
    [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>("medium"),
    [newTaskRepeat, setNewTaskRepeat] = useState<TaskRepeat>("none"),
    [newTaskCategory, setNewTaskCategory] = useState(""),
    [newTaskStartTime, setNewTaskStartTime] = useState(""),
    [newTaskEndTime, setNewTaskEndTime] = useState(""),
    [newTaskParentId, setNewTaskParentId] = useState(""),
    [taskFormOpen, setTaskFormOpen] = useState(false),
    [expandedTaskId, setExpandedTaskId] = useState<string | null>(null),
    [newTaskStartDate, setNewTaskStartDate] = useState(""),
    [newTaskEndDate, setNewTaskEndDate] = useState(""),
    [reviewWeek, setReviewWeek] = useState<{
      periodId: string;
      week: number;
    } | null>(null),
    [dark, setDark] = useState(() => localStorage.getItem(themeKey) === "dark"),
    [widths, setWidths] = useState<number[]>(() => {
      const t = loadTrackers(),
        saved = loadWidths(),
        base = saved.slice(0, 9),
        tracking = saved.slice(9, 9 + t.length);
      while (tracking.length < t.length) tracking.push(112);
      return fitColumnWidths(
        [...base, ...tracking],
        Math.min(1518, Math.max(320, window.innerWidth - 100)),
      );
    });
  const tableWrap = useRef<HTMLDivElement>(null);
  const periods = useMemo(
    () =>
      makePeriods(year).map((period) => data.cycles[period.id] || period),
    [data.cycles, year],
  );
  const p = periods.find((x) => x.id === periodId) || periods[0];
  const weeks = useMemo(() => makeWeeks(p, year), [p, year]);
  const periodDays = weeks
    .flatMap((w) => w.days)
    .filter((d) => d >= periodStart(p, year) && d <= periodEnd(p, year));
  const upcomingTasks = useMemo(
    () =>
      Object.entries(data.tasks)
        .flatMap(([dateKey, tasks]) => {
          const [taskYear, month, date] = dateKey.split("-").map(Number);
          if (taskYear !== year) return [];
          const taskDate = new Date(taskYear, month - 1, date);
          return tasks
            .filter((task) => !task.done && task.text.trim())
            .map((task) => ({ ...task, dateKey, date: taskDate }));
        })
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [data.tasks, year],
  );
  const todayKey = dkey(new Date());
  const todayDate = new Date(todayKey + "T00:00:00");
  const getTaskStatus = (task: { dateKey: string; date: Date }) =>
    task.dateKey < todayKey
      ? "overdue"
      : task.dateKey === todayKey
        ? "today"
        : task.date.getTime() - todayDate.getTime() <= 6 * 86400000
          ? "soon"
          : "upcoming";
  const filteredUpcomingTasks = upcomingTasks.filter((task) => {
    if (taskFilter === "high") return task.priority === "high";
    if (taskFilter === "all") return true;
    return getTaskStatus(task) === taskFilter;
  });
  const taskCellMatch = (date: Date) => {
    if (date.getFullYear() !== year) return "";
    const tasks = (data.tasks[dkey(date)] || []).filter(
      (task) => !task.done && task.text.trim(),
    );
    if (!tasks.length) return "";
    const status = getTaskStatus({ dateKey: dkey(date), date });
    if (taskFilter === "high")
      return tasks.some((task) => task.priority === "high")
        ? "task-match-high "
        : "";
    if (taskFilter !== "all")
      return tasks.length && status === taskFilter
        ? "task-match-" + taskFilter + " "
        : "";
    if (status === "overdue") return "task-match-overdue ";
    if (status === "today") return "task-match-today ";
    if (status === "soon") return "task-match-soon ";
    return tasks.length ? "task-match-upcoming " : "";
  };
  const taskFilterCounts = {
    all: upcomingTasks.length,
    overdue: upcomingTasks.filter((task) => getTaskStatus(task) === "overdue")
      .length,
    today: upcomingTasks.filter((task) => getTaskStatus(task) === "today")
      .length,
    soon: upcomingTasks.filter((task) => getTaskStatus(task) === "soon").length,
    high: upcomingTasks.filter((task) => task.priority === "high").length,
  };
  const dashboardMonths = useMemo(
    () =>
      Array.from({ length: 12 }, (_, month) => {
        const dayCount = new Date(year, month + 1, 0).getDate();
        let daysComplete = 0,
          taskCount = 0,
          tasksComplete = 0;
        for (let date = 1; date <= dayCount; date++) {
          const key = dkey(new Date(year, month, date));
          const tasks = (data.tasks[key] || []).filter((task) =>
            task.text.trim(),
          );
          if (data.completed[key] || tasks.some((task) => task.done))
            daysComplete++;
          taskCount += tasks.length;
          tasksComplete += tasks.filter((task) => task.done).length;
        }
        return {
          label: new Intl.DateTimeFormat("en", { month: "short" }).format(
            new Date(year, month, 1),
          ),
          dayCount,
          daysComplete,
          taskCount,
          tasksComplete,
        };
      }),
    [data.completed, data.tasks, year],
  );
  const yearSearchResults = useMemo(() => {
    const query = yearSearch.toLowerCase().trim();
    if (!query) return [];
    const results: {
      id: string;
      title: string;
      detail: string;
      periodId: string;
      date?: Date;
      week?: number;
    }[] = [];
    const add = (
      id: string,
      title: string,
      detail: string,
      periodId: string,
      date?: Date,
      week?: number,
    ) => {
      if (detail.trim() && (title + " " + detail).toLowerCase().includes(query))
        results.push({ id, title, detail, periodId, date, week });
    };
    for (const period of periods) {
      add(
        "goal-" + period.id,
        "Period goal",
        data.goals[period.id] || "",
        period.id,
      );
      add(
        "outcome-" + period.id,
        "Period outcome",
        data.outcomes[period.id] || "",
        period.id,
      );
      for (const week of makeWeeks(period, year)) {
        const key = wkey(period.id, week.n),
          values = data.weeks[key] || {};
        if (values.plan)
          add(
            key + "-plan",
            "Sprint plan · Week " + week.n,
            values.plan,
            period.id,
            undefined,
            week.n,
          );
        for (const tracker of trackers)
          if (values[tracker.id])
            add(
              key + "-" + tracker.id,
              tracker.label + " · Week " + week.n,
              values[tracker.id]!,
              period.id,
              undefined,
              week.n,
            );
        const review = data.reviews[key];
        if (review)
          for (const [field, label] of [
            ["wins", "Wins"],
            ["blockers", "Blockers"],
            ["priorities", "Priorities"],
          ] as const)
            if (review[field])
              add(
                key + "-" + field,
                "Weekly review · " + label + " · Week " + week.n,
                review[field]!,
                period.id,
                undefined,
                week.n,
              );
      }
      for (
        let date = new Date(year, period.start, 1),
          end = new Date(year, period.end + 1, 0);
        date <= end;
        date.setDate(date.getDate() + 1)
      ) {
        const current = new Date(date),
          key = dkey(current);
        if (data.days[key])
          add(key + "-note", "Daily note", data.days[key], period.id, current);
        for (const task of data.tasks[key] || [])
          if (task.text.trim())
            add(
              key + "-task-" + task.id,
              (task.done ? "Completed task" : "Task") + " · " + task.text,
              "Priority: " + (task.priority || "medium"),
              period.id,
              current,
            );
      }
    }
    return results.sort(
      (a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0),
    );
  }, [data, periods, trackers, year, yearSearch]);
  const completedCount = periodDays.filter(
    (d) => data.completed[dkey(d)],
  ).length;
  const completionPercent = Math.round(
    (completedCount / periodDays.length) * 100,
  );
  useEffect(() => {
    localStorage.setItem(storeKey, JSON.stringify(data));
  }, [data]);
  useEffect(() => {
    localStorage.setItem(widthKey, JSON.stringify(widths));
  }, [widths]);
  useEffect(() => {
    localStorage.setItem(trackerKey, JSON.stringify(trackers));
  }, [trackers]);
  useEffect(() => {
    localStorage.setItem(sprintKey, String(sprintLength));
  }, [sprintLength]);
  useEffect(() => {
    localStorage.setItem(themeKey, dark ? "dark" : "light");
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => {
    localStorage.setItem(yearKey, String(year));
  }, [year]);
  useEffect(() => {
    localStorage.setItem(viewKey, view);
  }, [view]);
  useEffect(() => {
    localStorage.setItem(rangeStartKey, rangeStart);
    localStorage.setItem(rangeEndKey, rangeEnd);
  }, [rangeStart, rangeEnd]);
  useEffect(() => {
    const fit = () =>
      setWidths((current) =>
        fitColumnWidths(
          current,
          Math.min(1518, Math.max(320, window.innerWidth - 100)),
        ),
      );
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  useEffect(() => {
    if (tableWrap.current) tableWrap.current.scrollLeft = 0;
  }, [periodId]);
  const update = (n: number, patch: Partial<W>) => {
    const k = wkey(p.id, n);
    setData((x) => ({
      ...x,
      weeks: { ...x.weeks, [k]: { ...x.weeks[k], ...patch } },
    }));
  };
  const daily = (date: Date, value: string) => {
    const k = dkey(date);
    setData((x) => ({ ...x, days: { ...x.days, [k]: value } }));
  };
  const closeDay = () => {
    setDay(null);
    setExpandedTaskId(null);
  };
  const addTasksForDay = (date: Date) => {
    const text = newTaskText.trim();
    if (!text) return;
    const dates =
      newTaskRepeat === "weekdays" &&
      (date.getDay() === 0 || date.getDay() === 6)
        ? []
        : [new Date(date)];
    if (newTaskRepeat !== "none") {
      const cursor = new Date(date);
      const yearEnd = new Date(date.getFullYear(), 11, 31);
      while (cursor < yearEnd) {
        cursor.setDate(cursor.getDate() + 1);
        const matches =
          newTaskRepeat === "weekly"
            ? cursor.getDay() === date.getDay()
            : cursor.getDay() >= 1 && cursor.getDay() <= 5;
        if (matches) dates.push(new Date(cursor));
      }
    }
    const seriesId = String(Date.now());
    setData((x) => {
      const tasks = { ...x.tasks };
      dates.forEach((taskDate, index) => {
        const key = dkey(taskDate);
        tasks[key] = [
          ...(tasks[key] || []),
          {
            id: seriesId + "-" + index,
            seriesId,
            text,
            done: false,
            priority: newTaskPriority,
            ...(newTaskCategory.trim()
              ? { category: newTaskCategory.trim() }
              : {}),
            ...(newTaskStartTime ? { startTime: newTaskStartTime } : {}),
            ...(newTaskEndTime ? { endTime: newTaskEndTime } : {}),
            ...(newTaskParentId ? { parentId: newTaskParentId } : {}),
            startDate: newTaskStartDate || dkey(date),
            endDate: newTaskEndDate || dkey(date),
            ...(newTaskRepeat === "none" ? {} : { repeat: newTaskRepeat }),
          },
        ];
      });
      return { ...x, tasks };
    });
    setNewTaskText("");
    setNewTaskCategory("");
    setNewTaskStartTime("");
    setNewTaskEndTime("");
    setNewTaskParentId("");
    setNewTaskStartDate("");
    setNewTaskEndDate("");
    setTaskFormOpen(false);
  };
  const query = search.toLowerCase().trim();
  const currentWeek = weeks.find((week) =>
    week.days.some((date) => dkey(date) === todayKey),
  );
  const currentSprintStart = currentWeek
    ? Math.floor((currentWeek.n - 1) / sprintLength) * sprintLength + 1
    : 1;
  const rangeDates =
    rangeStart && rangeEnd
      ? { start: parseDate(rangeStart), end: parseDate(rangeEnd) }
      : null;
  const viewWeeks = weeks.filter((week) => {
    if (view === "today") return week === currentWeek;
    if (view === "sprint")
      return (
        Math.floor((week.n - 1) / sprintLength) ===
        Math.floor((currentSprintStart - 1) / sprintLength)
      );
    if (view === "range" && rangeDates)
      return week.days.some(
        (date) => date >= rangeDates.start && date <= rangeDates.end,
      );
    return true;
  });
  const visible = viewWeeks.filter(
    (w) =>
      !query ||
      [
        w.days.map(fmt).join(" "),
        ...Object.values(data.weeks[wkey(p.id, w.n)] || {}),
        ...w.days.map((d) => data.days[dkey(d)] || ""),
        ...w.days.flatMap((d) =>
          (data.tasks[dkey(d)] || []).map((task) => task.text),
        ),
        ...Object.values(data.reviews[wkey(p.id, w.n)] || {}),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
  );
  const goal = (value: string) =>
    setData((x) => ({ ...x, goals: { ...x.goals, [p.id]: value } }));
  const outcome = (value: string) =>
    setData((x) => ({ ...x, outcomes: { ...x.outcomes, [p.id]: value } }));
  const exportCsv = () => {
    const rows = [
      [
        "Period",
        "Week",
        "Completed dates",
        "Daily tasks",
        "Review wins",
        "Review blockers",
        "Next week priorities",
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sprint plan",
        ...trackers.map((t) => t.label),
      ],
    ];
    for (const period of periods)
      for (const w of makeWeeks(period, year)) {
        const v = data.weeks[wkey(period.id, w.n)] || {};
        rows.push([
          period.id,
          "W" + w.n,
          w.days
            .filter(
              (d) =>
                d.getFullYear() === year &&
                d.getMonth() >= period.start &&
                d.getMonth() <= period.end &&
                data.completed[dkey(d)],
            )
            .map(dkey)
            .join("; "),
          w.days
            .flatMap((d) =>
              (data.tasks[dkey(d)] || [])
                .filter((task) => task.text.trim())
                .map(
                  (task) =>
                    dkey(d) + ": " + task.text + (task.done ? " (done)" : ""),
                ),
            )
            .join("; "),
          data.reviews[wkey(period.id, w.n)]?.wins || "",
          data.reviews[wkey(period.id, w.n)]?.blockers || "",
          data.reviews[wkey(period.id, w.n)]?.priorities || "",
          ...w.days.map(dkey),
          v.plan || "",
          ...trackers.map((t) => v[t.id] || ""),
        ]);
      }
    saveFile(
      year + "-calendar.csv",
      rows
        .map((r) =>
          r.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(","),
        )
        .join("\r\n"),
      "text/csv;charset=utf-8",
    );
  };
  const clear = () => {
    if (!confirm("Clear all saved information for " + year + " " + p.id + "?"))
      return;
    setData((x) => {
      const next = {
        ...x,
        weeks: { ...x.weeks },
        days: { ...x.days },
        completed: { ...x.completed },
        tasks: { ...x.tasks },
        reviews: { ...x.reviews },
        goals: { ...x.goals },
        outcomes: { ...x.outcomes },
      };
      for (const w of weeks) {
        delete next.weeks[wkey(p.id, w.n)];
        delete next.reviews[wkey(p.id, w.n)];
        delete next.completed[wkey(p.id, w.n)];
        for (const d of w.days)
          if (
            d.getFullYear() === year &&
            d.getMonth() >= p.start &&
            d.getMonth() <= p.end
          )
            delete next.completed[dkey(d)];
        for (const d of w.days)
          if (
            d.getFullYear() === year &&
            d.getMonth() >= p.start &&
            d.getMonth() <= p.end
          )
            delete next.tasks[dkey(d)];
        for (const d of w.days)
          if (
            d.getFullYear() === year &&
            d.getMonth() >= p.start &&
            d.getMonth() <= p.end
          )
            delete next.days[dkey(d)];
      }
      delete next.goals[p.id];
      delete next.outcomes[p.id];
      return next;
    });
  };
  const restore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setData({ ...empty, ...JSON.parse(await f.text()) });
    } catch {
      alert("That file is not a valid calendar backup.");
    }
    e.target.value = "";
  };
  const addTracker = () => {
    const id = "tracker-" + Date.now();
    setTrackers((x) => [
      ...x,
      {
        id,
        label: "New tracker",
        tone: trackerTones[x.length % trackerTones.length],
        color: trackerColors[x.length % trackerColors.length],
      },
    ]);
    setWidths((x) => [...x, 140]);
  };
  const moveTracker = (index: number, direction: number) => {
    const to = index + direction;
    if (to < 0 || to >= trackers.length) return;
    setTrackers((x) => {
      const next = [...x];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
    setWidths((x) => {
      const next = [...x];
      [next[index + 9], next[to + 9]] = [next[to + 9], next[index + 9]];
      return next;
    });
  };
  const updateCycle = (cycle: PlanningCycle, patch: Partial<PlanningCycle>) => {
    setData((current) => ({
      ...current,
      cycles: {
        ...current.cycles,
        [cycle.id]: { ...cycle, ...patch },
      },
    }));
  };
  const sprintGroups = Array.from(
    { length: Math.ceil(weeks.length / sprintLength) },
    (_, index) => {
      const startWeek = index * sprintLength + 1;
      const id = p.id + "-S" + startWeek;
      return {
        id,
        startWeek,
        endWeek: Math.min(startWeek + sprintLength - 1, weeks.length),
        definition: data.sprints[id],
      };
    },
  );
  const updateSprint = (id: string, patch: Partial<SprintDefinition>) => {
    setData((current) => ({
      ...current,
      sprints: {
        ...current.sprints,
        [id]: {
          ...current.sprints[id],
          id,
          title: current.sprints[id]?.title || "",
          ...patch,
        },
      },
    }));
  };
  const resizeHandle = (index: number) => (
    <span
      className="resize-handle"
      title="Drag to resize this column"
      aria-label="Resize column"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const start = event.clientX,
          base = widths[index];
        const move = (e: PointerEvent) =>
          setWidths((current) =>
            current.map((width, i) =>
              i === index ? Math.max(52, base + e.clientX - start) : width,
            ),
          );
        const stop = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", stop);
          window.removeEventListener("pointercancel", stop);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", stop);
        window.addEventListener("pointercancel", stop);
      }}
    />
  );
  const jumpToToday = () => {
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayCycle = makePeriods(todayYear).find(
      (period) => today.getMonth() >= period.start && today.getMonth() <= period.end,
    );
    setYear(todayYear);
    setPeriodId(todayCycle?.id || makePeriods(todayYear)[0].id);
    setView("today");
    window.setTimeout(() => {
      document
        .getElementById("week-" + (todayCycle?.id || "") + "-1")
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 50);
  };
  return (
    <main className={"shell" + (dark ? " dark" : "")}>
      <PlannerHeader
        year={year}
        dark={dark}
        taskCount={upcomingTasks.length}
        onYearChange={(next) => {
          setYear(next);
          setPeriodId(makePeriods(next)[0].id);
          setSearch("");
          setDay(null);
        }}
        onExport={exportCsv}
        onBackup={() =>
          saveFile(
            year + "-calendar-backup.json",
            JSON.stringify(data, null, 2),
            "application/json",
          )
        }
        onRestore={restore}
        onToggleTheme={() => setDark((current) => !current)}
        onOpenTasks={() => setUpcomingOpen(true)}
        onOpenProgress={() => setDashboardOpen(true)}
        onOpenSearch={() => setYearSearchOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <section className="intro">
        <div>
          <small>YEAR PLAN · SAVES ON THIS DEVICE</small>
          <p>
            A weekly view for goals, applications, practice, health, and the
            work in between.
          </p>
        </div>
        <strong>
          {year}{" "}
          <span>
            52 weeks
            <br />3 planning cycles
          </span>
        </strong>
      </section>
      <nav className="tabs">
        {periods.map((x) => (
          <button
            key={x.id}
            className={periodId === x.id ? "active " + x.tone : ""}
            onClick={() => setPeriodId(x.id)}
          >
            <b>{x.id}</b>
            {x.label}
            <span>↗</span>
          </button>
        ))}
      </nav>
      <section className={"panel " + p.tone}>
        <div className="period-title">
          <div>
            <small>{p.id} / FOUR-MONTH PLAN</small>
            <h2>
              {p.label} <span>{year}</span>
            </h2>
          </div>
          <div className="period-progress">
            <div>
              <span>
                {completedCount} of {periodDays.length} days complete
              </span>
              <strong>{completionPercent}%</strong>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-label={p.id + " completion"}
              aria-valuemin={0}
              aria-valuemax={periodDays.length}
              aria-valuenow={completedCount}
            >
              <i style={{ width: completionPercent + "%" }} />
            </div>
          </div>
        </div>
        <div className="goal">
          <b>GOAL</b>
          <input
            value={data.goals[p.id] || ""}
            onChange={(e) => goal(e.target.value)}
            placeholder="What do you want to make happen this period?"
          />
          <CalendarViewControls
            view={view}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onViewChange={setView}
            onRangeStartChange={setRangeStart}
            onRangeEndChange={setRangeEnd}
            onToday={jumpToToday}
          />
        </div>
        <div className="tools">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="⌕  Find in this period"
          />
          <span>
            {visible.length} of {weeks.length} weeks
          </span>
          <span className="resize-hint">↔ Drag a column edge to resize</span>
          <button onClick={clear}>Clear period</button>
        </div>
        <div className="table-scroll" ref={tableWrap}>
          <CalendarTable
            period={p}
            weeks={weeks}
            visibleWeeks={visible}
            data={data}
            trackers={trackers}
            sprints={data.sprints}
            widths={widths}
            sprintLength={sprintLength}
            taskCellMatch={taskCellMatch}
            onDayOpen={setDay}
            onReviewOpen={(week) => setReviewWeek({ periodId: p.id, week })}
            onWeekUpdate={update}
            onSprintUpdate={(week, value) => {
              const k = wkey(p.id, week);
              setData((x) => ({
                ...x,
                weeks: { ...x.weeks, [k]: { ...x.weeks[k], plan: value } },
              }));
            }}
            resizeHandle={resizeHandle}
            isDateVisible={(date) =>
              view !== "range" ||
              !rangeDates ||
              (date >= rangeDates.start && date <= rangeDates.end)
            }
          />
        </div>
        <label className="goal outcome">
          <b>OUTCOME</b>
          <input
            value={data.outcomes[p.id] || ""}
            onChange={(e) => outcome(e.target.value)}
            placeholder="What did you complete or learn?"
          />
        </label>
      </section>
      {upcomingOpen && (
        <div
          className="backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setUpcomingOpen(false);
          }}
        >
          <section
            className="modal upcoming-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upcoming-title"
          >
            <button className="close" onClick={() => setUpcomingOpen(false)}>
              ×
            </button>
            <small>{year} / TASK OVERVIEW</small>
            <h2 id="upcoming-title">Upcoming tasks</h2>
            <p className="upcoming-summary">
              {filteredUpcomingTasks.length} of {upcomingTasks.length}{" "}
              unfinished tasks
            </p>
            <label className="task-filter">
              Show
              <select
                value={taskFilter}
                onChange={(e) => setTaskFilter(e.target.value as TaskFilter)}
              >
                <option value="all">
                  All pending ({taskFilterCounts.all})
                </option>
                <option value="overdue">
                  Overdue ({taskFilterCounts.overdue})
                </option>
                <option value="today">
                  Due today ({taskFilterCounts.today})
                </option>
                <option value="soon">Due soon ({taskFilterCounts.soon})</option>
                <option value="high">
                  High priority ({taskFilterCounts.high})
                </option>
              </select>
            </label>
            <p className="upcoming-summary">
              Matching dates are highlighted on the calendar.
            </p>
            {filteredUpcomingTasks.length ? (
              <div className="upcoming-list">
                {filteredUpcomingTasks.map((task) => (
                  <div className="upcoming-item" key={task.id + task.dateKey}>
                    <div>
                      <time dateTime={task.dateKey}>
                        {new Intl.DateTimeFormat("en", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        }).format(task.date)}
                      </time>
                      <span>{task.text}</span>
                      <small
                        className={
                          "task-priority priority-" +
                          (task.priority || "medium")
                        }
                      >
                        {task.priority || "medium"}
                      </small>
                      <small
                        className={
                          "due-status " +
                          (task.dateKey < todayKey
                            ? "overdue"
                            : task.dateKey === todayKey
                              ? "due-today"
                              : task.date.getTime() -
                                    new Date(
                                      todayKey + "T00:00:00",
                                    ).getTime() <=
                                  6 * 86400000
                                ? "due-soon"
                                : "")
                        }
                      >
                        {task.dateKey < todayKey
                          ? "Overdue"
                          : task.dateKey === todayKey
                            ? "Due today"
                            : task.date.getTime() -
                                  new Date(todayKey + "T00:00:00").getTime() <=
                                6 * 86400000
                              ? "Due soon"
                              : "Upcoming"}
                      </small>
                    </div>
                    <button
                      onClick={() => {
                        const taskPeriod = makePeriods(year).find(
                          (period) =>
                            task.date.getMonth() >= period.start &&
                            task.date.getMonth() <= period.end,
                        );
                        if (taskPeriod) setPeriodId(taskPeriod.id);
                        setUpcomingOpen(false);
                        setDay(task.date);
                      }}
                    >
                      Open date
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="tasks-empty">
                {upcomingTasks.length
                  ? "No tasks match this filter."
                  : "You’re all caught up. Add tasks from any date."}
              </p>
            )}
            <button className="done" onClick={() => setUpcomingOpen(false)}>
              Done
            </button>
          </section>
        </div>
      )}
      {dashboardOpen && (
        <div
          className="backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDashboardOpen(false);
          }}
        >
          <section
            className="modal dashboard-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-title"
          >
            <button className="close" onClick={() => setDashboardOpen(false)}>
              ×
            </button>
            <small>{year} / PROGRESS OVERVIEW</small>
            <h2 id="dashboard-title">Progress dashboard</h2>
            <div className="dashboard-summary">
              <div>
                <strong>
                  {dashboardMonths.reduce(
                    (sum, month) => sum + month.daysComplete,
                    0,
                  )}
                </strong>
                <span>days complete</span>
              </div>
              <div>
                <strong>
                  {dashboardMonths.reduce(
                    (sum, month) => sum + month.tasksComplete,
                    0,
                  )}{" "}
                  /{" "}
                  {dashboardMonths.reduce(
                    (sum, month) => sum + month.taskCount,
                    0,
                  )}
                </strong>
                <span>tasks complete</span>
              </div>
            </div>
            <h3>Completed days by month</h3>
            <div className="month-chart">
              {dashboardMonths.map((month) => (
                <div
                  className="month-bar"
                  key={month.label}
                  title={
                    month.label + ": " + month.daysComplete + " completed days"
                  }
                >
                  <div className="month-track">
                    <i
                      style={{
                        height:
                          (month.daysComplete / month.dayCount) * 100 + "%",
                      }}
                    />
                  </div>
                  <span>{month.label}</span>
                  <small>{month.daysComplete}</small>
                </div>
              ))}
            </div>
            <h3>Planning cycles</h3>
            <div className="cycle-stats">
              {periods.map((period, index) => {
                const months = dashboardMonths.slice(index * 4, index * 4 + 4);
                const done = months.reduce(
                  (sum, month) => sum + month.tasksComplete,
                  0,
                );
                const total = months.reduce(
                  (sum, month) => sum + month.taskCount,
                  0,
                );
                return (
                  <div key={period.id}>
                    <b>{period.id}</b>
                    <span>{period.label}</span>
                    <strong>
                      {done}/{total} tasks
                    </strong>
                  </div>
                );
              })}
            </div>
            <button className="done" onClick={() => setDashboardOpen(false)}>
              Done
            </button>
          </section>
        </div>
      )}
      {yearSearchOpen && (
        <div
          className="backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setYearSearchOpen(false);
          }}
        >
          <section
            className="modal year-search-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="year-search-title"
          >
            <button className="close" onClick={() => setYearSearchOpen(false)}>
              ×
            </button>
            <small>{year} / SEARCH EVERYTHING</small>
            <h2 id="year-search-title">Search this year</h2>
            <input
              className="year-search-input"
              autoFocus
              value={yearSearch}
              onChange={(e) => setYearSearch(e.target.value)}
              placeholder="Find tasks, notes, goals, reviews…"
            />
            <div className="year-search-results">
              {!yearSearch.trim() ? (
                <p className="tasks-empty">
                  Search all daily notes, tasks, sprint plans, reviews, goals,
                  and trackers.
                </p>
              ) : yearSearchResults.length ? (
                yearSearchResults.map((result) => (
                  <button
                    className="year-search-result"
                    key={result.id}
                    onClick={() => {
                      setPeriodId(result.periodId);
                      setYearSearchOpen(false);
                      if (result.date) setDay(result.date);
                      else if (
                        result.week &&
                        result.title.startsWith("Weekly review")
                      )
                        setReviewWeek({
                          periodId: result.periodId,
                          week: result.week,
                        });
                      else if (result.week)
                        window.setTimeout(
                          () =>
                            document
                              .getElementById(
                                "week-" + result.periodId + "-" + result.week,
                              )
                              ?.scrollIntoView({
                                block: "center",
                                behavior: "smooth",
                              }),
                          50,
                        );
                    }}
                  >
                    <span>
                      <b>{result.title}</b>
                      <small>
                        {result.periodId}
                        {result.date
                          ? " · " + dkey(result.date)
                          : result.week
                            ? " · Week " + result.week
                            : ""}
                      </small>
                    </span>
                    <em>{result.detail}</em>
                  </button>
                ))
              ) : (
                <p className="tasks-empty">No matches found in {year}.</p>
              )}
            </div>
            {yearSearch.trim() && (
              <p className="upcoming-summary">
                {yearSearchResults.length} result
                {yearSearchResults.length === 1 ? "" : "s"}
              </p>
            )}
          </section>
        </div>
      )}
      {settingsOpen && (
        <div
          className="backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSettingsOpen(false);
          }}
        >
          <section
            className="modal settings-modal"
            role="dialog"
            aria-modal="true"
          >
            <button className="close" onClick={() => setSettingsOpen(false)}>
              ×
            </button>
            <small>PLANNER CONFIGURATION</small>
            <h2>Sprints & tracker columns</h2>
            <div className="planner-editors">
              <h3>Planning cycles</h3>
              {periods.map((cycle) => (
                <div className="cycle-editor" key={cycle.id}>
                  <input
                    aria-label={cycle.id + " cycle title"}
                    value={cycle.label}
                    onChange={(event) =>
                      updateCycle(cycle, { label: event.target.value })
                    }
                  />
                  <label>
                    Start
                    <input
                      type="date"
                      value={cycle.startDate || dkey(periodStart(cycle, year))}
                      onChange={(event) =>
                        updateCycle(cycle, { startDate: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    End
                    <input
                      type="date"
                      value={cycle.endDate || dkey(periodEnd(cycle, year))}
                      onChange={(event) =>
                        updateCycle(cycle, { endDate: event.target.value })
                      }
                    />
                  </label>
                </div>
              ))}
              <h3>Sprints in {p.label}</h3>
              {sprintGroups.map((sprint) => (
                <div className="sprint-editor" key={sprint.id}>
                  <b>
                    Weeks {sprint.startWeek}–{sprint.endWeek}
                  </b>
                  <input
                    aria-label="Sprint title"
                    placeholder="Sprint title"
                    value={sprint.definition?.title || ""}
                    onChange={(event) =>
                      updateSprint(sprint.id, { title: event.target.value })
                    }
                  />
                  <input
                    type="date"
                    aria-label="Sprint start date"
                    value={
                      sprint.definition?.startDate ||
                      dkey(weeks[sprint.startWeek - 1]?.days[0] || new Date())
                    }
                    onChange={(event) =>
                      updateSprint(sprint.id, { startDate: event.target.value })
                    }
                  />
                  <input
                    type="date"
                    aria-label="Sprint end date"
                    value={
                      sprint.definition?.endDate ||
                      dkey(weeks[sprint.endWeek - 1]?.days[6] || new Date())
                    }
                    onChange={(event) =>
                      updateSprint(sprint.id, { endDate: event.target.value })
                    }
                  />
                </div>
              ))}
            </div>
            <label className="setting-field">
              Weeks per sprint
              <select
                value={sprintLength}
                onChange={(e) => setSprintLength(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "week" : "weeks"}
                  </option>
                ))}
              </select>
            </label>
            <div className="tracker-list">
              <div className="tracker-title">
                <b>TRACKER COLUMNS</b>
                <button className="button" onClick={addTracker}>
                  + Add column
                </button>
              </div>
              {trackers.map((column, index) => (
                <div className="tracker-row" key={column.id}>
                  <input
                    aria-label="Tracker column name"
                    value={column.label}
                    onChange={(e) =>
                      setTrackers((x) =>
                        x.map((item, i) =>
                          i === index
                            ? { ...item, label: e.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <input
                    className="tracker-color"
                    type="color"
                    aria-label={column.label + " column color"}
                    title="Choose column color"
                    value={column.color}
                    onChange={(e) =>
                      setTrackers((x) =>
                        x.map((item, i) =>
                          i === index
                            ? { ...item, color: e.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <button
                    title="Move up"
                    disabled={index === 0}
                    onClick={() => moveTracker(index, -1)}
                  >
                    Up
                  </button>
                  <button
                    title="Move down"
                    disabled={index === trackers.length - 1}
                    onClick={() => moveTracker(index, 1)}
                  >
                    Down
                  </button>
                  <button
                    title="Remove column"
                    onClick={() => {
                      setTrackers((x) => x.filter((_, i) => i !== index));
                      setWidths((x) => x.filter((_, i) => i !== index + 9));
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button className="done" onClick={() => setSettingsOpen(false)}>
              Done
            </button>
          </section>
        </div>
      )}
      {reviewWeek && (
        <div
          className="backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setReviewWeek(null);
          }}
        >
          <section
            className="modal review-modal"
            role="dialog"
            aria-modal="true"
          >
            <button className="close" onClick={() => setReviewWeek(null)}>
              ×
            </button>
            <small>{reviewWeek.periodId} / WEEKLY REVIEW</small>
            <h2>Week {reviewWeek.week} review</h2>
            {(
              [
                ["wins", "Wins", "What went well this week?"],
                ["blockers", "Blockers", "What got in the way?"],
                [
                  "priorities",
                  "Next week’s priorities",
                  "What are the most important things to focus on?",
                ],
              ] as const
            ).map(([field, label, placeholder]) => (
              <label className="review-field" key={field}>
                {label}
                <textarea
                  value={
                    data.reviews[wkey(reviewWeek.periodId, reviewWeek.week)]?.[
                      field
                    ] || ""
                  }
                  onChange={(e) => {
                    const key = wkey(reviewWeek.periodId, reviewWeek.week);
                    setData((x) => ({
                      ...x,
                      reviews: {
                        ...x.reviews,
                        [key]: { ...x.reviews[key], [field]: e.target.value },
                      },
                    }));
                  }}
                  placeholder={placeholder}
                />
              </label>
            ))}
            <button className="done" onClick={() => setReviewWeek(null)}>
              Done
            </button>
          </section>
        </div>
      )}
      {day && (
        <div
          className="backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDay();
          }}
        >
          <section className="modal daily-modal" role="dialog" aria-modal="true">
            <button className="close" onClick={closeDay}>
              ×
            </button>
            <small>{p.id} / DAILY NOTE</small>
            <h2>
              {new Intl.DateTimeFormat("en", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              }).format(day)}
            </h2>
            <label className="daily-complete">
              <input
                type="checkbox"
                checked={!!data.completed[dkey(day)]}
                onChange={(e) =>
                  setData((x) => ({
                    ...x,
                    completed: {
                      ...x.completed,
                      [dkey(day)]: e.target.checked,
                    },
                  }))
                }
              />
              Mark this day complete
            </label>
            <label>What matters today?</label>
            <textarea
              autoFocus
              value={data.days[dkey(day)] || ""}
              onChange={(e) => daily(day, e.target.value)}
              placeholder="Add a focus, reminder, or note…"
            />
            <div className="daily-tasks">
              <div className="daily-tasks-heading">
                <b>Tasks</b>
                <button
                  type="button"
                  onClick={() => {
                    setNewTaskParentId("");
                    setTaskFormOpen((open) => !open);
                  }}
                >
                  {taskFormOpen ? "Cancel" : "+ Add task"}
                </button>
              </div>
              {taskFormOpen && <div className="new-task-form">
                <input
                  value={newTaskText}
                  placeholder="Add a task…"
                  aria-label="New task"
                  onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addTasksForDay(day);
                  }}
                />
                <input
                  value={newTaskCategory}
                  placeholder="Category"
                  aria-label="Task category"
                  onChange={(e) => setNewTaskCategory(e.target.value)}
                />
                <input
                  type="date"
                  aria-label="Task start date"
                  value={newTaskStartDate || dkey(day)}
                  onChange={(e) => setNewTaskStartDate(e.target.value)}
                />
                <input
                  type="date"
                  aria-label="Task end date"
                  value={newTaskEndDate || dkey(day)}
                  onChange={(e) => setNewTaskEndDate(e.target.value)}
                />
                <input
                  type="time"
                  aria-label="Task start time"
                  value={newTaskStartTime}
                  onChange={(e) => setNewTaskStartTime(e.target.value)}
                />
                <input
                  type="time"
                  aria-label="Task end time"
                  value={newTaskEndTime}
                  onChange={(e) => setNewTaskEndTime(e.target.value)}
                />
                <label className="task-field">
                  Subtask of
                  <select
                    aria-label="Subtask parent"
                    value={newTaskParentId}
                    onChange={(e) => setNewTaskParentId(e.target.value)}
                  >
                    <option value="">Top-level task</option>
                    {(data.tasks[dkey(day)] || []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.text || "Untitled task"}
                      </option>
                    ))}
                  </select>
                </label>
                <select
                  aria-label="New task priority"
                  value={newTaskPriority}
                  onChange={(e) =>
                    setNewTaskPriority(e.target.value as TaskPriority)
                  }
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <select
                  aria-label="Repeat task"
                  value={newTaskRepeat}
                  onChange={(e) =>
                    setNewTaskRepeat(e.target.value as TaskRepeat)
                  }
                >
                  <option value="none">Once</option>
                  <option value="weekly">Weekly</option>
                  <option value="weekdays">Weekdays</option>
                </select>
                <button
                  type="button"
                  disabled={!newTaskText.trim()}
                  onClick={() => addTasksForDay(day)}
                >
                  Add
                </button>
              </div>}
              {(data.tasks[dkey(day)] || []).map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  expanded={expandedTaskId === task.id}
                  onToggleExpanded={() =>
                    setExpandedTaskId((current) =>
                      current === task.id ? null : task.id,
                    )
                  }
                  onCollapse={() => setExpandedTaskId(null)}
                  onUpdate={(patch) => {
                    const key = dkey(day);
                    setData((current) => ({
                      ...current,
                      tasks: {
                        ...current.tasks,
                        [key]: current.tasks[key].map((item) =>
                          item.id === task.id ? { ...item, ...patch } : item,
                        ),
                      },
                    }));
                  }}
                  onToggleDone={(done) => {
                    const key = dkey(day);
                    setData((current) => ({
                      ...current,
                      tasks: {
                        ...current.tasks,
                        [key]: current.tasks[key].map((item) =>
                          item.id === task.id ? { ...item, done } : item,
                        ),
                      },
                    }));
                  }}
                  onAddSubtask={() => {
                    setNewTaskParentId(task.id);
                    setTaskFormOpen(true);
                  }}
                  onRemove={() => {
                    const key = dkey(day);
                    setData((current) => ({
                      ...current,
                      tasks: {
                        ...current.tasks,
                        [key]: current.tasks[key].filter(
                          (item) => item.id !== task.id,
                        ),
                      },
                    }));
                    setExpandedTaskId(null);
                  }}
                />
              ))}
              {false && day && (
                <>
              {(data.tasks[dkey(day)] || []).map((task) => (
                <div
                  className={
                    "daily-task" +
                    (task.parentId ? " subtask-row" : "") +
                    (expandedTaskId === task.id ? " expanded" : "")
                  }
                  key={task.id}
                  onClick={() => {
                    if (expandedTaskId !== task.id) setExpandedTaskId(task.id);
                  }}
                >
                  <button
                    type="button"
                    className="task-summary"
                    aria-expanded={expandedTaskId === task.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      setExpandedTaskId((current) =>
                        current === task.id ? null : task.id,
                      );
                    }}
                  >
                    <strong>{task.text || "Untitled task"}</strong>
                    <small>
                      {task.category || "Uncategorized"}
                      {task.startTime
                        ? " · " + task.startTime + (task.endTime ? "–" + task.endTime : "")
                        : ""}
                    </small>
                  </button>
                  {expandedTaskId === task.id && (
                    <button
                      type="button"
                      className="collapse-task"
                      onClick={() => setExpandedTaskId(null)}
                    >
                      Hide details
                    </button>
                  )}
                  <input
                    type="checkbox"
                    checked={task.done}
                    aria-label="Mark task complete"
                    onChange={(e) => {
                      const key = dkey(day);
                      setData((x) => ({
                        ...x,
                        tasks: {
                          ...x.tasks,
                          [key]: x.tasks[key].map((item) =>
                            item.id === task.id
                              ? { ...item, done: e.target.checked }
                              : item,
                          ),
                        },
                      }));
                    }}
                  />
                  <input
                    value={task.text}
                    aria-label="Task description"
                    placeholder="What needs to get done?"
                    onChange={(e) => {
                      const key = dkey(day);
                      setData((x) => ({
                        ...x,
                        tasks: {
                          ...x.tasks,
                          [key]: x.tasks[key].map((item) =>
                            item.id === task.id
                              ? { ...item, text: e.target.value }
                              : item,
                          ),
                        },
                      }));
                    }}
                  />
                  <input
                    value={task.category || ""}
                    aria-label="Task category"
                    placeholder="Category"
                    onChange={(e) => {
                      const key = dkey(day);
                      setData((x) => ({
                        ...x,
                        tasks: {
                          ...x.tasks,
                          [key]: x.tasks[key].map((item) =>
                            item.id === task.id
                              ? { ...item, category: e.target.value }
                              : item,
                          ),
                        },
                      }));
                    }}
                  />
                  <input
                    type="time"
                    aria-label="Task start time"
                    value={task.startTime || ""}
                    onChange={(e) => {
                      const key = dkey(day);
                      setData((x) => ({
                        ...x,
                        tasks: {
                          ...x.tasks,
                          [key]: x.tasks[key].map((item) =>
                            item.id === task.id
                              ? { ...item, startTime: e.target.value }
                              : item,
                          ),
                        },
                      }));
                    }}
                  />
                  <input
                    type="time"
                    aria-label="Task end time"
                    value={task.endTime || ""}
                    onChange={(e) => {
                      const key = dkey(day);
                      setData((x) => ({
                        ...x,
                        tasks: {
                          ...x.tasks,
                          [key]: x.tasks[key].map((item) =>
                            item.id === task.id
                              ? { ...item, endTime: e.target.value }
                              : item,
                          ),
                        },
                      }));
                    }}
                  />
                  <select
                    aria-label="Task priority"
                    className={
                      "priority-select priority-" + (task.priority || "medium")
                    }
                    value={task.priority || "medium"}
                    onChange={(e) => {
                      const key = dkey(day);
                      setData((x) => ({
                        ...x,
                        tasks: {
                          ...x.tasks,
                          [key]: x.tasks[key].map((item) =>
                            item.id === task.id
                              ? {
                                  ...item,
                                  priority: e.target.value as TaskPriority,
                                }
                              : item,
                          ),
                        },
                      }));
                    }}
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <button
                    type="button"
                    className="add-subtask"
                    aria-label={"Add subtask to " + (task.text || "this task")}
                    onClick={() => {
                      setNewTaskParentId(task.id);
                      setTaskFormOpen(true);
                    }}
                  >
                    + Subtask
                  </button>
                  <button
                    type="button"
                    aria-label="Remove task"
                    onClick={() => {
                      const key = dkey(day);
                      setData((x) => ({
                        ...x,
                        tasks: {
                          ...x.tasks,
                          [key]: x.tasks[key].filter(
                            (item) => item.id !== task.id,
                          ),
                        },
                      }));
                    }}
                  >
                    ×
                  </button>
                  {task.repeat && (
                    <small className="repeat-tag">
                      {task.repeat === "weekly" ? "Weekly" : "Weekdays"}
                    </small>
                  )}
                </div>
              ))}
                </>
              )}
              {!data.tasks[dkey(day)]?.length && (
                <p className="tasks-empty">No tasks yet.</p>
              )}
            </div>
            <button className="done" onClick={closeDay}>
              Done
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
