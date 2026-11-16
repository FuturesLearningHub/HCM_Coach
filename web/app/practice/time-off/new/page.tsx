"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { IconAlert, IconCheckCircle, IconInfo } from "../../../components/Icons";
import PageHeader from "../../../components/PageHeader";
import {
  VACATION_BALANCE,
  formatRange,
  parseLocalDate,
  saveSubmitted,
  todayValue,
  workHours,
  type TimeOffRequest,
} from "../../../lib/data";

const TYPES = ["Vacation", "Sick", "Personal Day"];
const REASONS = ["Personal", "Family", "Other"];

type Errors = Partial<Record<"type" | "reason" | "start" | "end", string>>;

export default function NewRequestPage() {
  const [type, setType] = useState("");
  const [reason, setReason] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [draftSaved, setDraftSaved] = useState(false);
  const [done, setDone] = useState<TimeOffRequest | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "New Request · HCM practice";
  }, []);

  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  const hours = workHours(start, end);
  const errorCount = Object.keys(errors).length;

  function validate(): Errors {
    const next: Errors = {};
    if (!type) next.type = "Choose an absence type.";
    if (!reason) next.reason = "Choose a reason code.";
    const from = parseLocalDate(start);
    const to = parseLocalDate(end);
    if (!from) next.start = "Enter a start date.";
    if (!to) next.end = "Enter an end date.";
    if (from && to && to < from) next.end = "End date is before the start date. Pick the same day or a later one.";
    return next;
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setDraftSaved(false);
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      window.requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    const request: TimeOffRequest = {
      id: `r${Date.now()}`,
      type,
      reason,
      start,
      end,
      hours: workHours(start, end) ?? 8,
      status: "Pending Payroll release",
      submitted: todayValue(),
    };
    saveSubmitted(request);
    setDone(request);
  }

  function clearError(key: keyof Errors) {
    if (errors[key]) {
      const next = { ...errors };
      delete next[key];
      setErrors(next);
    }
  }

  return (
    <>
      <PageHeader title="New Request" backHref="/practice/time-off" backLabel="Back to Time Off" />
      <div className="wrap body">
        <div className="split">
          <div className="split-main">
            <div aria-live="polite">
              {done && (
                <section className="card confirm" ref={doneRef} tabIndex={-1} aria-labelledby="done-title">
                  <span className="confirm-icon">
                    <IconCheckCircle size={28} />
                  </span>
                  <p className="confirm-title" id="done-title">
                    Request submitted
                  </p>
                  <p className="muted">
                    It is now waiting for Payroll to release it. The system does not notify Payroll for you.
                  </p>
                  <dl className="summary">
                    <div>
                      <dt>Absence type</dt>
                      <dd>{done.type}</dd>
                    </div>
                    <div>
                      <dt>Reason code</dt>
                      <dd>{done.reason}</dd>
                    </div>
                    <div>
                      <dt>Dates</dt>
                      <dd>{formatRange(done.start, done.end)}</dd>
                    </div>
                    <div>
                      <dt>Hours</dt>
                      <dd>{done.hours.toFixed(1)}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{done.status}</dd>
                    </div>
                  </dl>
                  <div className="actions actions-start">
                    <Link href="/practice/time-off" className="btn btn-primary">
                      Back to Time Off
                    </Link>
                    <Link href="/practice/time-off/history" className="btn btn-secondary">
                      View History
                    </Link>
                  </div>
                </section>
              )}
            </div>
            {!done && (
              <form className="card form" onSubmit={onSubmit} noValidate aria-labelledby="form-h">
                <div className="card-head">
                  <h2 className="h2" id="form-h">
                    Request details
                  </h2>
                  <p className="muted">All four fields are needed before you can submit.</p>
                </div>

                {errorCount > 0 && (
                  <div className="notice notice-warn" role="alert" ref={summaryRef} tabIndex={-1}>
                    <IconAlert size={18} />
                    <div>
                      <strong>Not sent yet.</strong>{" "}
                      {errorCount === 1 ? "One field needs attention." : `${errorCount} fields need attention.`}
                    </div>
                  </div>
                )}

                <div className="field">
                  <label htmlFor="absence-type">Absence Type</label>
                  <select
                    id="absence-type"
                    className="input"
                    value={type}
                    onChange={(e) => {
                      setType(e.target.value);
                      clearError("type");
                    }}
                    aria-invalid={errors.type ? true : undefined}
                    aria-describedby={errors.type ? "absence-type-err" : undefined}
                  >
                    <option value="">Select…</option>
                    {TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  {errors.type && (
                    <p className="field-msg field-msg-warn" id="absence-type-err">
                      <IconAlert size={15} />
                      {errors.type}
                    </p>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="reason-code">Reason Code</label>
                  <select
                    id="reason-code"
                    className="input"
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      clearError("reason");
                    }}
                    aria-invalid={errors.reason ? true : undefined}
                    aria-describedby={errors.reason ? "reason-code-err" : undefined}
                  >
                    <option value="">Select…</option>
                    {REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  {errors.reason && (
                    <p className="field-msg field-msg-warn" id="reason-code-err">
                      <IconAlert size={15} />
                      {errors.reason}
                    </p>
                  )}
                </div>

                <div className="field-row">
                  <div className="field">
                    <label htmlFor="start-date">Start Date</label>
                    <input
                      id="start-date"
                      type="date"
                      className="input"
                      value={start}
                      onChange={(e) => {
                        setStart(e.target.value);
                        clearError("start");
                      }}
                      aria-invalid={errors.start ? true : undefined}
                      aria-describedby={errors.start ? "start-date-err" : undefined}
                    />
                    {errors.start && (
                      <p className="field-msg field-msg-warn" id="start-date-err">
                        <IconAlert size={15} />
                        {errors.start}
                      </p>
                    )}
                  </div>
                  <div className="field">
                    <label htmlFor="end-date">End Date</label>
                    <input
                      id="end-date"
                      type="date"
                      className="input"
                      value={end}
                      min={start || undefined}
                      onChange={(e) => {
                        setEnd(e.target.value);
                        clearError("end");
                      }}
                      aria-invalid={errors.end ? true : undefined}
                      aria-describedby={errors.end ? "end-date-err" : undefined}
                    />
                    {errors.end && (
                      <p className="field-msg field-msg-warn" id="end-date-err">
                        <IconAlert size={15} />
                        {errors.end}
                      </p>
                    )}
                  </div>
                </div>

                {draftSaved && (
                  <div className="notice" role="status">
                    <IconInfo size={18} />
                    <div>Draft saved. Only you can see drafts.</div>
                  </div>
                )}

                <div className="form-foot">
                  <button type="button" className="btn btn-secondary" onClick={() => setDraftSaved(true)}>
                    Save Draft
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Submit
                  </button>
                </div>
              </form>
            )}
          </div>

          <aside className="card balance" aria-labelledby="balance-h">
            <p className="label-caps" id="balance-h">
              Vacation balance
            </p>
            <p className="balance-value">
              {VACATION_BALANCE.toFixed(1)} <span>hours available</span>
            </p>
            <div className="meter" aria-hidden="true">
              <span style={{ width: "80%" }} />
            </div>
            <dl className="balance-list">
              <div>
                <dt>Accrued this year</dt>
                <dd>80.0 hours</dd>
              </div>
              <div>
                <dt>Used this year</dt>
                <dd>16.0 hours</dd>
              </div>
              <div>
                <dt>Accrual rate</dt>
                <dd>3.08 hours per pay period</dd>
              </div>
              <div>
                <dt>Next accrual</dt>
                <dd>Nov 27, 2026</dd>
              </div>
              {!done && hours !== null && hours > 0 && (
                <div className="balance-this">
                  <dt>This request</dt>
                  <dd>{hours.toFixed(1)} hours</dd>
                </div>
              )}
            </dl>
            <p className="muted small">One full day is 8.0 hours. Weekends are not counted.</p>
          </aside>
        </div>
      </div>
    </>
  );
}
