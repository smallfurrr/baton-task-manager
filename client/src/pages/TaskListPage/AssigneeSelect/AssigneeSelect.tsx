import { Select } from "../../../components/Select/Select";
import type { Developer } from "../../../api/types";

interface AssigneeSelectProps {
  label: string;
  /** Id of the current assignee, or null when unassigned. */
  value: number | null;
  /** Developers who may be chosen; the caller decides who is eligible. */
  developers: readonly Pick<Developer, "id" | "name">[];
  disabled?: boolean;
  onChange: (developerId: number | null) => void;
}

export function AssigneeSelect({ label, value, developers, disabled, onChange }: AssigneeSelectProps) {
  return (
    <Select
      aria-label={label}
      value={value === null ? "" : String(value)}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
    >
      <option value="">Unassigned</option>
      {developers.map((developer) => (
        <option key={developer.id} value={developer.id}>
          {developer.name}
        </option>
      ))}
    </Select>
  );
}
