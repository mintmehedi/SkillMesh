import { DatePicker } from "@mui/x-date-pickers";
import dayjs from "dayjs";

const DOB_MIN = dayjs("1940-01-01");
const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const defaultSlotProps = {
  textField: {
    fullWidth: true,
    className: "muiDobInput",
  },
  popper: {
    className: "dobPopper",
  },
};

function dobMaxDate() {
  return dayjs().subtract(13, "year");
}

function parseDobValue(value) {
  if (!value) {
    return { day: "", month: "", year: "" };
  }
  const d = dayjs(value);
  if (!d.isValid()) {
    return { day: "", month: "", year: "" };
  }
  return { day: String(d.date()), month: String(d.month() + 1), year: String(d.year()) };
}

function daysInMonth(month, year) {
  if (!month) {
    return 31;
  }
  const y = year || 2000;
  return dayjs(`${y}-${String(month).padStart(2, "0")}-01`).daysInMonth();
}

function buildDobIso(day, month, year) {
  if (!day || !month || !year) {
    return "";
  }
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const d = dayjs(iso);
  if (!d.isValid() || d.format("YYYY-MM-DD") !== iso) {
    return "";
  }
  if (d.isBefore(DOB_MIN, "day") || d.isAfter(dobMaxDate(), "day")) {
    return "";
  }
  return iso;
}

function DobDateField({ label, value, onChange, disabled, slotProps }) {
  const textField = slotProps?.textField || {};
  const { id, error, helperText } = textField;
  const fieldId = id || "dob-date-field";
  const helperId = helperText ? `${fieldId}-helper` : undefined;

  const maxYear = dobMaxDate().year();
  const minYear = DOB_MIN.year();
  const years = [];
  for (let y = maxYear; y >= minYear; y -= 1) {
    years.push(y);
  }

  const parts = parseDobValue(value);
  const maxDay = daysInMonth(parts.month, parts.year);
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  const updatePart = (key, raw) => {
    const next = { ...parts, [key]: raw };
    if (key !== "day" && next.day && next.month && next.year) {
      const cap = daysInMonth(next.month, next.year);
      if (Number(next.day) > cap) {
        next.day = String(cap);
      }
    }
    onChange(buildDobIso(next.day, next.month, next.year));
  };

  const selectClass = (hasError) =>
    hasError ? "authInput authSelect authInputHasError" : "authInput authSelect";

  return (
    <div className="dobSelectField" id={fieldId}>
      {label ? (
        <span className="dobSelectLabel" id={`${fieldId}-label`}>
          {label}
        </span>
      ) : null}
      <div
        className="dobSelectRow"
        role="group"
        aria-labelledby={label ? `${fieldId}-label` : undefined}
        aria-invalid={error || undefined}
        aria-describedby={helperId}
      >
        <div className="authSelectWrap">
          <select
            className={selectClass(error)}
            value={parts.day}
            disabled={disabled}
            aria-label="Day"
            onChange={(e) => updatePart("day", e.target.value)}
          >
            <option value="">Day</option>
            {days.map((d) => (
              <option key={d} value={String(d)}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="authSelectWrap">
          <select
            className={selectClass(error)}
            value={parts.month}
            disabled={disabled}
            aria-label="Month"
            onChange={(e) => updatePart("month", e.target.value)}
          >
            <option value="">Month</option>
            {MONTHS.map((m) => (
              <option key={m.value} value={String(m.value)}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="authSelectWrap">
          <select
            className={selectClass(error)}
            value={parts.year}
            disabled={disabled}
            aria-label="Year"
            onChange={(e) => updatePart("year", e.target.value)}
          >
            <option value="">Year</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>
      {helperText ? (
        <p className={error ? "fieldErrorHint" : "dobSelectHint"} id={helperId} role={error ? "alert" : undefined}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Shared date control for SkillMesh. Use variant "dob" for date of birth (day/month/year
 * selects — reliable keyboard and screen-reader UX); "period" for education/work dates;
 * "closing" for job closing dates.
 */
export function SiteDatePicker({
  label,
  value,
  onChange,
  variant = "period",
  className = "dobPicker",
  disabled,
  slotProps,
}) {
  const isDob = variant === "dob";
  const isClosing = variant === "closing";

  if (isDob) {
    return (
      <DobDateField
        label={label}
        value={value}
        onChange={onChange}
        disabled={disabled}
        slotProps={slotProps}
      />
    );
  }

  const mergedSlotProps = {
    ...defaultSlotProps,
    ...slotProps,
    textField: {
      ...defaultSlotProps.textField,
      ...(slotProps?.textField || {}),
    },
    popper: {
      ...defaultSlotProps.popper,
      ...(slotProps?.popper || {}),
    },
  };

  return (
    <DatePicker
      className={className}
      label={label}
      disableFuture={!isClosing}
      minDate={isClosing ? undefined : DOB_MIN}
      maxDate={isClosing ? dayjs().add(50, "year") : dayjs()}
      value={value ? dayjs(value) : null}
      onChange={(v) => onChange(v && v.isValid() ? v.format("YYYY-MM-DD") : "")}
      disabled={disabled}
      slotProps={mergedSlotProps}
    />
  );
}
