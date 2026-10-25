import type { CSSProperties, ReactNode } from "react";
import type {
  CalendarData,
  CalendarWeek,
  Period,
  Tracker,
  WeekValues,
  SprintDefinition,
} from "../types";
import { dateKey, weekKey, formatDate, periodEnd, periodStart } from "../types";

type CalendarTableProps = {
  period: Period;
  weeks: CalendarWeek[];
  visibleWeeks: CalendarWeek[];
  data: CalendarData;
  trackers: Tracker[];
  sprints: Record<string, SprintDefinition>;
  widths: number[];
  sprintLength: number;
  taskCellMatch: (date: Date) => string;
  onDayOpen: (date: Date) => void;
  onReviewOpen: (week: number) => void;
  onWeekUpdate: (week: number, patch: Partial<WeekValues>) => void;
  onSprintUpdate: (week: number, value: string) => void;
  resizeHandle: (index: number) => ReactNode;
  isDateVisible?: (date: Date) => boolean;
};

export function CalendarTable({
  period,
  weeks,
  visibleWeeks,
  data,
  trackers,
  sprints,
  widths,
  sprintLength,
  taskCellMatch,
  onDayOpen,
  onReviewOpen,
  onWeekUpdate,
  onSprintUpdate,
  resizeHandle,
  isDateVisible = () => true,
}: CalendarTableProps) {
  return (
    <table className="calendar-table" style={{ width: widths.reduce((sum, value) => sum + value, 0) }}>
      <colgroup>
        {widths.map((width, index) => (
          <col key={index} style={{ width: width + "px" }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th className="week" rowSpan={2}>
            WEEK{resizeHandle(0)}
          </th>
          <th colSpan={7} className="date-group">
            WEEK AT A GLANCE
          </th>
          <th className="plan-head" rowSpan={2}>
            SPRINT PLAN{resizeHandle(8)}
          </th>
          {trackers.map((tracker, index) => (
            <th
              key={tracker.id}
              rowSpan={2}
              className={tracker.tone + "-heading tracker-heading"}
              style={{ "--tracker-color": tracker.color } as CSSProperties}
            >
              {tracker.label.toUpperCase()}
              {resizeHandle(index + 9)}
            </th>
          ))}
        </tr>
        <tr className="days">
          {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map(
            (label, index) => (
              <th key={label}>
                {label}
                {resizeHandle(index + 1)}
              </th>
            ),
          )}
        </tr>
      </thead>
      <tbody>
        {visibleWeeks.map((week, index) => {
          const values = data.weeks[weekKey(period.id, week.n)] || {};
          const sprint = Math.floor((week.n - 1) / sprintLength) * sprintLength + 1;
          const sprintGroup = Math.floor((week.n - 1) / sprintLength);
          const previous = visibleWeeks[index - 1];
          const showSprint =
            !previous || Math.floor((previous.n - 1) / sprintLength) !== sprintGroup;
          let sprintSpan = 1;
          while (
            index + sprintSpan < visibleWeeks.length &&
            Math.floor((visibleWeeks[index + sprintSpan].n - 1) / sprintLength) ===
              sprintGroup
          ) {
            sprintSpan++;
          }
          return (
            <tr key={week.n} id={`week-${period.id}-${week.n}`}>
              <th
                className="week review-cell"
                role="button"
                tabIndex={0}
                aria-label={`Open weekly review for week ${week.n}`}
                title="Open weekly review"
                onClick={() => onReviewOpen(week.n)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onReviewOpen(week.n);
                  }
                }}
              >
                W{week.n}
                {Object.values(data.reviews[weekKey(period.id, week.n)] || {}).some(
                  (value) => value?.trim(),
                ) && <i className="review-indicator" aria-hidden="true" />}
              </th>
              {week.days.map((date) => {
                const key = dateKey(date);
                const tasks = data.tasks[key] || [];
                const dateVisible = isDateVisible(date);
                return (
                  <td
                    key={key}
                    className={
                      (!dateVisible
                        ? "range-hidden "
                        : date < periodStart(period, date.getFullYear()) ||
                            date > periodEnd(period, date.getFullYear())
                        ? "outside "
                        : "") +
                      (key === dateKey(new Date()) ? "today " : "") +
                      taskCellMatch(date) +
                      (data.days[key] ? "marked " : "") +
                      (data.completed[key] ? "completed" : "")
                    }
                  >
                    <button disabled={!dateVisible} onClick={() => onDayOpen(date)}>
                      {formatDate(date)}
                      {(data.days[key] || tasks.length > 0) && <i />}
                      {!!tasks.length && (
                        <small className="date-task-count">
                          {tasks.filter((task) => task.done).length}/{tasks.length} tasks
                        </small>
                      )}
                    </button>
                  </td>
                );
              })}
              {showSprint && (
                <td rowSpan={sprintSpan} className="sprint">
                  <b>
                    {sprints[period.id + "-S" + sprint]?.title ||
                      `Sprint ${sprint}–${Math.min(
                        sprint + sprintLength - 1,
                        weeks.length,
                      )}`}
                  </b>
                  <textarea
                    value={data.weeks[weekKey(period.id, sprint)]?.plan || ""}
                    onChange={(event) => onSprintUpdate(sprint, event.target.value)}
                    placeholder="Goals, milestones, prep…"
                  />
                </td>
              )}
              {trackers.map((tracker) => (
                <td
                  key={tracker.id}
                  className={`edit ${tracker.tone} tracker-cell`}
                  style={{ "--tracker-color": tracker.color } as CSSProperties}
                >
                  <textarea
                    aria-label={`Week ${week.n} ${tracker.label}`}
                    value={values[tracker.id] || ""}
                    onChange={(event) =>
                      onWeekUpdate(week.n, { [tracker.id]: event.target.value })
                    }
                  />
                </td>
              ))}
            </tr>
          );
        })}
        {!visibleWeeks.length && (
          <tr>
            <td colSpan={9 + trackers.length} className="empty">
              No matching weeks.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
