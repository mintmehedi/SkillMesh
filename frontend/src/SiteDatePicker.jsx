import { DatePicker } from "@mui/x-date-pickers";
import dayjs from "dayjs";

const defaultSlotProps = {
  textField: {
    fullWidth: true,
    className: "muiDobInput",
  },
  popper: {
    className: "dobPopper",
  },
};

/**
 * Shared MUI date picker for SkillMesh. Use variant "dob" for date of birth;
 * "period" for education/work and other historical dates (no 13-year cap);
 * "closing" for job closing dates (future-friendly, same popover styling as auth).
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
      minDate={isClosing ? undefined : dayjs("1940-01-01")}
      maxDate={
        isDob ? dayjs().subtract(13, "year") : isClosing ? dayjs().add(50, "year") : dayjs()
      }
      value={value ? dayjs(value) : null}
      onChange={(v) => onChange(v && v.isValid() ? v.format("YYYY-MM-DD") : "")}
      disabled={disabled}
      slotProps={mergedSlotProps}
    />
  );
}
