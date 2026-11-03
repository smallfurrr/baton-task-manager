import { Select } from "../../../components/Select/Select";
import { TASK_STATUSES, type TaskStatus } from "../../../api/types";
import { STATUS_LABELS } from "../../../lib/statusLabels";
import styles from "./StatusSelect.module.css";

interface StatusSelectProps {
  label: string;
  value: TaskStatus;
  disabled?: boolean;
  onChange: (status: TaskStatus) => void;
}

export function StatusSelect({ label, value, disabled, onChange }: StatusSelectProps) {
  return (
    <Select
      aria-label={label}
      className={styles[value]}
      value={value}
      disabled={disabled}
      onChange={(event) => {
        const next = TASK_STATUSES.find((status) => status === event.target.value);
        if (next) onChange(next);
      }}
    >
      {TASK_STATUSES.map((status) => (
        <option key={status} value={status}>
          {STATUS_LABELS[status]}
        </option>
      ))}
    </Select>
  );
}
