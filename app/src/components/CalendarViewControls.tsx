import { useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import type { CalendarView } from "../types";
import { dateKey, parseDate } from "../types";

type CalendarViewControlsProps = {
  view: CalendarView;
  rangeStart: string;
  rangeEnd: string;
  onViewChange: (view: CalendarView) => void;
  onRangeStartChange: (value: string) => void;
  onRangeEndChange: (value: string) => void;
  onToday: () => void;
};

export function CalendarViewControls({
  view,
  rangeStart,
  rangeEnd,
  onViewChange,
  onRangeStartChange,
  onRangeEndChange,
  onToday,
}: CalendarViewControlsProps) {
  const [rangeOpen, setRangeOpen] = useState(false);
  const [dragStart, setDragStart] = useState<Date | null>(null);
  const [dragRange, setDragRange] = useState<DateRange | undefined>();
  const selectedRange: DateRange | undefined = rangeStart
    ? { from: parseDate(rangeStart), to: rangeEnd ? parseDate(rangeEnd) : undefined }
    : undefined;
  const displayedRange = dragRange || selectedRange;

  const dayFromEvent = (event: React.PointerEvent<HTMLDivElement>) => {
    const day = (event.target as HTMLElement).closest<HTMLElement>("[data-day]")
      ?.dataset.day;
    return day ? parseDate(day) : null;
  };

  const rangeBetween = (first: Date, second: Date): DateRange =>
    first <= second
      ? { from: first, to: second }
      : { from: second, to: first };

  const updateRange = (range: DateRange | undefined) => {
    onRangeStartChange(range?.from ? dateKey(range.from) : "");
    onRangeEndChange(range?.to ? dateKey(range.to) : "");
    if (range?.from && range?.to) setRangeOpen(false);
  };

  return (
    <div className="view-controls" aria-label="Calendar view">
      <div className="view-segmented">
        {(["cycle", "sprint", "today", "range"] as CalendarView[]).map((option) => (
          <button
            key={option}
            className={view === option ? "active" : ""}
            onClick={() => (option === "today" ? onToday() : onViewChange(option))}
          >
            {option === "cycle" ? "Planning cycle" : option === "sprint" ? "Current sprint" : option === "today" ? "Today" : "Date range"}
          </button>
        ))}
      </div>
      {view === "range" && (
        <div className="range-picker">
          <button
            type="button"
            className="range-trigger"
            onClick={() => setRangeOpen((open) => !open)}
            aria-expanded={rangeOpen}
          >
            {rangeStart && rangeEnd
              ? `${rangeStart} → ${rangeEnd}`
              : rangeStart
                ? `${rangeStart} → Choose end`
                : "Choose date range"}
          </button>
          {rangeOpen && (
            <div
              className="range-popover"
              onPointerDown={(event) => {
                const date = dayFromEvent(event);
                if (date) {
                  setDragStart(date);
                  setDragRange({ from: date });
                }
              }}
              onPointerMove={(event) => {
                if (!dragStart) return;
                const date = dayFromEvent(event);
                if (date) setDragRange(rangeBetween(dragStart, date));
              }}
              onPointerUp={() => {
                if (dragRange?.from && dragRange.to) updateRange(dragRange);
                setDragStart(null);
                setDragRange(undefined);
              }}
              onPointerCancel={() => {
                setDragStart(null);
                setDragRange(undefined);
              }}
            >
              <DayPicker
                mode="range"
                selected={displayedRange}
                onSelect={updateRange}
                defaultMonth={selectedRange?.from || new Date()}
                numberOfMonths={1}
                showOutsideDays
              />
              <button
                type="button"
                className="range-clear"
                onClick={() => {
                  updateRange(undefined);
                  setRangeOpen(false);
                }}
              >
                Clear range
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
