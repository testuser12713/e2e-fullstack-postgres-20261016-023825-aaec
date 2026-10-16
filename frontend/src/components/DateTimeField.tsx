import { useMemo } from "react";
import "./DateTimeField.css";

const MAX_DURATION_MINUTES = 8 * 60;

export interface DateTimeFieldProps {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  onDateChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onBlur?: (field: "date" | "start" | "end") => void;
  dateError?: string;
  startError?: string;
  endError?: string;
}

function formatDuration(minutes: number): string {
  const total = Math.abs(Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours} Std.`);
  }
  if (mins > 0 || hours === 0) {
    parts.push(`${mins} Min.`);
  }
  return parts.join(" ");
}

function timeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function inputClass(hasError: boolean): string {
  return hasError
    ? "input datetime-field__input datetime-field__input--error"
    : "input datetime-field__input";
}

export default function DateTimeField({
  id,
  date,
  startTime,
  endTime,
  onDateChange,
  onStartTimeChange,
  onEndTimeChange,
  onBlur,
  dateError,
  startError,
  endError,
}: DateTimeFieldProps) {
  const durationMinutes = useMemo(() => {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    if (start === null || end === null || end <= start) {
      return null;
    }
    return end - start;
  }, [startTime, endTime]);

  const overLimit =
    durationMinutes !== null && durationMinutes > MAX_DURATION_MINUTES;

  return (
    <div className="datetime-field">
      <div className="datetime-field__row">
        <div className="datetime-field__control">
          <label className="datetime-field__label" htmlFor={`${id}-date`}>
            Datum
          </label>
          <input
            id={`${id}-date`}
            className={inputClass(Boolean(dateError))}
            type="date"
            lang="de"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
            onBlur={() => onBlur?.("date")}
            aria-invalid={dateError ? true : undefined}
            aria-describedby={dateError ? `${id}-date-error` : undefined}
          />
          {dateError ? (
            <p id={`${id}-date-error`} className="datetime-field__error" role="alert">
              {dateError}
            </p>
          ) : null}
        </div>

        <div className="datetime-field__control">
          <label className="datetime-field__label" htmlFor={`${id}-start-time`}>
            Beginn
          </label>
          <input
            id={`${id}-start-time`}
            className={inputClass(Boolean(startError))}
            type="time"
            step={900}
            value={startTime}
            onChange={(event) => onStartTimeChange(event.target.value)}
            onBlur={() => onBlur?.("start")}
            aria-invalid={startError ? true : undefined}
            aria-describedby={startError ? `${id}-start-error` : undefined}
          />
          {startError ? (
            <p
              id={`${id}-start-error`}
              className="datetime-field__error"
              role="alert"
            >
              {startError}
            </p>
          ) : null}
        </div>

        <div className="datetime-field__control">
          <label className="datetime-field__label" htmlFor={`${id}-end-time`}>
            Ende
          </label>
          <input
            id={`${id}-end-time`}
            className={inputClass(Boolean(endError))}
            type="time"
            step={900}
            value={endTime}
            onChange={(event) => onEndTimeChange(event.target.value)}
            onBlur={() => onBlur?.("end")}
            aria-invalid={endError ? true : undefined}
            aria-describedby={endError ? `${id}-end-error` : undefined}
          />
          {endError ? (
            <p id={`${id}-end-error`} className="datetime-field__error" role="alert">
              {endError}
            </p>
          ) : null}
        </div>
      </div>

      {durationMinutes !== null ? (
        <p
          className={
            overLimit
              ? "datetime-field__duration numeric datetime-field__duration--over"
              : "datetime-field__duration numeric"
          }
        >
          Dauer: {formatDuration(durationMinutes)}
        </p>
      ) : null}

      <p className="datetime-field__hint">Alle Zeiten in UTC</p>
    </div>
  );
}
