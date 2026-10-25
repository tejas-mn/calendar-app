import type { ChangeEvent } from "react";
import type { DayTask, TaskPriority } from "../types";

type TaskItemProps = {
  task: DayTask;
  expanded: boolean;
  onToggleExpanded: () => void;
  onCollapse: () => void;
  onUpdate: (patch: Partial<DayTask>) => void;
  onToggleDone: (done: boolean) => void;
  onAddSubtask: () => void;
  onRemove: () => void;
};

export function TaskItem({
  task,
  expanded,
  onToggleExpanded,
  onCollapse,
  onUpdate,
  onToggleDone,
  onAddSubtask,
  onRemove,
}: TaskItemProps) {
  const stop = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    event.stopPropagation();
  return (
    <div
      className={"daily-task" + (task.parentId ? " subtask-row" : "") + (expanded ? " expanded" : "")}
      onClick={onToggleExpanded}
    >
      <button
        type="button"
        className="task-summary"
        aria-expanded={expanded}
        onClick={(event) => {
          event.stopPropagation();
          onToggleExpanded();
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
      {expanded && (
        <button type="button" className="collapse-task" onClick={onCollapse}>
          Hide details
        </button>
      )}
      <input
        type="checkbox"
        checked={task.done}
        aria-label="Mark task complete"
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => onToggleDone(event.target.checked)}
      />
      <input
        value={task.text}
        aria-label="Task description"
        placeholder="What needs to get done?"
        onChange={(event) => {
          stop(event);
          onUpdate({ text: event.target.value });
        }}
      />
      <input
        value={task.category || ""}
        aria-label="Task category"
        placeholder="Category"
        onChange={(event) => {
          stop(event);
          onUpdate({ category: event.target.value });
        }}
      />
      <input
        type="time"
        aria-label="Task start time"
        value={task.startTime || ""}
        onChange={(event) => {
          stop(event);
          onUpdate({ startTime: event.target.value });
        }}
      />
      <input
        type="time"
        aria-label="Task end time"
        value={task.endTime || ""}
        onChange={(event) => {
          stop(event);
          onUpdate({ endTime: event.target.value });
        }}
      />
      <select
        aria-label="Task priority"
        className={"priority-select priority-" + (task.priority || "medium")}
        value={task.priority || "medium"}
        onChange={(event) => {
          stop(event);
          onUpdate({ priority: event.target.value as TaskPriority });
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
        onClick={(event) => {
          event.stopPropagation();
          onAddSubtask();
        }}
      >
        + Subtask
      </button>
      <button
        type="button"
        aria-label="Remove task"
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
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
  );
}
