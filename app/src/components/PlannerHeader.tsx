import type { ChangeEvent } from "react";

type PlannerHeaderProps = {
  year: number;
  dark: boolean;
  taskCount: number;
  onYearChange: (year: number) => void;
  onExport: () => void;
  onBackup: () => void;
  onRestore: (event: ChangeEvent<HTMLInputElement>) => void;
  onToggleTheme: () => void;
  onOpenTasks: () => void;
  onOpenProgress: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
};

export function PlannerHeader({
  year,
  dark,
  taskCount,
  onYearChange,
  onExport,
  onBackup,
  onRestore,
  onToggleTheme,
  onOpenTasks,
  onOpenProgress,
  onOpenSearch,
  onOpenSettings,
}: PlannerHeaderProps) {
  return (
    <header className="topbar planner-header">
      <div className="logo">{String(year).slice(-2)}</div>
      <div>
        <small>PERSONAL PLANNER</small>
        <h1>{year} Calendar</h1>
      </div>
      <label className="year-picker">
        <span>YEAR</span>
        <select value={year} onChange={(event) => onYearChange(Number(event.target.value))}>
          {Array.from({ length: 201 }, (_, index) => 2100 - index).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <nav className="actions planner-nav" aria-label="Planner actions">
        <button onClick={onExport}>Export CSV</button>
        <button onClick={onBackup}>Backup</button>
        <label className="button">
          Restore
          <input type="file" accept=".json,application/json" onChange={onRestore} />
        </label>
        <button onClick={() => window.print()}>Print</button>
        <button onClick={onToggleTheme} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
          {dark ? "Light theme" : "Dark theme"}
        </button>
        <button onClick={onOpenTasks}>Tasks ({taskCount})</button>
        <button onClick={onOpenProgress}>Progress</button>
        <button onClick={onOpenSearch}>Search year</button>
        <button onClick={onOpenSettings}>Planner settings</button>
      </nav>
    </header>
  );
}
