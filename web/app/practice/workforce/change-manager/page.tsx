"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { IconAlert, IconArrowLeft, IconCheck, IconCheckCircle, IconInfo, IconPencil } from "../../../components/Icons";
import PageHeader from "../../../components/PageHeader";
import {
  MANAGERS,
  findPerson,
  formatLongDate,
  initials,
  parseLocalDate,
  weekdayName,
  type ManagerOption,
  type Person,
} from "../../../lib/data";

const WAYS = ["Manager Change", "Reorganization", "Transfer"];
const REASONS = ["Change Line Manager", "Correction", "Manager Termination"];
const INFO_OPTIONS = [
  { id: "managers", label: "Managers", checked: true },
  { id: "comments", label: "Comments and attachments", checked: true },
  { id: "reports", label: "Direct reports", checked: false },
  { id: "salary", label: "Salary", checked: false },
];

type Step = 1 | 2 | 3;

function Section({
  number,
  title,
  step,
  summary,
  onEdit,
  headingRef,
  children,
}: {
  number: Step;
  title: string;
  step: Step;
  summary: string;
  onEdit: () => void;
  headingRef?: React.Ref<HTMLHeadingElement>;
  children: ReactNode;
}) {
  const state = step === number ? "current" : step > number ? "done" : "upcoming";
  return (
    <section className={`step step-${state}`}>
      <div className="step-head">
        <span className="step-num" aria-hidden="true">
          {state === "done" ? <IconCheck size={18} /> : number}
        </span>
        <div className="step-titles">
          <h2 className="h2" id={`step-${number}-h`} ref={headingRef} tabIndex={-1}>
            {title}
          </h2>
          {state === "done" && <p className="step-summary">{summary}</p>}
        </div>
        {state === "done" && (
          <button type="button" className="btn btn-quiet" aria-label={`Edit ${title}`} onClick={onEdit}>
            <IconPencil size={18} />
            Edit
          </button>
        )}
      </div>
      {state === "current" && <div className="step-body">{children}</div>}
    </section>
  );
}

function ChangeManager({ person }: { person: Person }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [info, setInfo] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(INFO_OPTIONS.map((o) => [o.id, o.checked])),
  );
  const [date, setDate] = useState("");
  const [way, setWay] = useState("");
  const [why, setWhy] = useState("");

  const [manager, setManager] = useState(person.manager);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(person.manager);
  const [picked, setPicked] = useState<ManagerOption | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [saved, setSaved] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const headingRefs = [
    useRef<HTMLHeadingElement>(null),
    useRef<HTMLHeadingElement>(null),
    useRef<HTMLHeadingElement>(null),
  ];
  const inputRef = useRef<HTMLInputElement>(null);
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    document.title = `Change Manager · ${person.name} · HCM practice`;
  }, [person.name]);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    headingRefs[step - 1].current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (submitted) doneRef.current?.focus();
  }, [submitted]);

  const parsed = parseLocalDate(date);
  const isSunday = parsed?.getDay() === 0;
  const canContinue2 = Boolean(parsed) && way !== "" && why !== "";

  const term = text.trim().toLowerCase();
  const matches =
    listOpen && term.length >= 2
      ? MANAGERS.filter((m) => m.name !== person.name && m.name.toLowerCase().includes(term))
      : [];
  const showList = listOpen && term.length >= 2;
  const canSave = picked !== null && picked.name === text && picked.name !== manager;
  const canSubmit = saved && step === 3 && !editing;

  function pick(option: ManagerOption) {
    setText(option.name);
    setPicked(option);
    setListOpen(false);
    inputRef.current?.focus();
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showList || matches.length === 0) {
      if (event.key === "Escape") setListOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i - 1 + matches.length) % matches.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(matches[Math.min(active, matches.length - 1)]);
    } else if (event.key === "Escape") {
      setListOpen(false);
    }
  }

  function save() {
    if (!picked) return;
    setManager(picked.name);
    setEditing(false);
    setSaved(true);
    window.requestAnimationFrame(() => editBtnRef.current?.focus());
  }

  if (submitted) {
    return (
      <>
        <PageHeader title="Change Manager">
          <div className="ph-person">
            <span className="avatar avatar-lg" aria-hidden="true">
              {initials(person.name)}
            </span>
            <div className="person-main">
              <p className="person-name">{person.name}</p>
              <p className="person-title">
                {person.title} · Person Number {person.personNumber}
              </p>
              <p className="person-pay">{person.payType}</p>
            </div>
          </div>
        </PageHeader>
        <div className="wrap body">
          <div aria-live="polite">
            <section className="card confirm" ref={doneRef} tabIndex={-1} aria-labelledby="done-title">
              <span className="confirm-icon">
                <IconCheckCircle size={28} />
              </span>
              <p className="confirm-title" id="done-title">
                Manager change submitted
              </p>
              <p className="muted">
                Manager changes are approved automatically. A confirmation notification follows shortly.
              </p>
              <dl className="summary">
                <div>
                  <dt>Employee</dt>
                  <dd>{person.name}</dd>
                </div>
                <div>
                  <dt>New manager</dt>
                  <dd>{manager}</dd>
                </div>
                <div>
                  <dt>Effective date</dt>
                  <dd>{formatLongDate(date)}</dd>
                </div>
                <div>
                  <dt>Reason</dt>
                  <dd>{why}</dd>
                </div>
              </dl>
              <div className="actions actions-start">
                <Link href="/practice/workforce" className="btn btn-primary">
                  <IconArrowLeft size={16} />
                  Back to Our Workforce
                </Link>
              </div>
            </section>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Change Manager"
        backHref="/practice/workforce"
        backLabel="Back to Our Workforce"
        actions={
          <>
            <button type="button" className="btn btn-primary" disabled={!canSubmit} onClick={() => setSubmitted(true)}>
              Submit
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => router.push("/practice/workforce")}>
              Cancel
            </button>
          </>
        }
      >
        <div className="ph-person">
          <span className="avatar avatar-lg" aria-hidden="true">
            {initials(person.name)}
          </span>
          <div className="person-main">
            <p className="person-name">{person.name}</p>
            <p className="person-title">
              {person.title} · Person Number {person.personNumber}
            </p>
            <p className="person-pay">{person.payType}</p>
          </div>
        </div>
      </PageHeader>

      <div className="wrap body">
        <div className="steps">
          <Section
            number={1}
            title="Info to Include"
            step={step}
            summary={
              INFO_OPTIONS.filter((o) => info[o.id])
                .map((o) => o.label)
                .join(", ") || "Nothing extra included"
            }
            onEdit={() => setStep(1)}
            headingRef={headingRefs[0]}
          >
            <fieldset className="checks">
              <legend>Choose what else this change should carry.</legend>
              {INFO_OPTIONS.map((option) => (
                <label key={option.id} className="check">
                  <input
                    type="checkbox"
                    checked={info[option.id]}
                    onChange={(e) => setInfo({ ...info, [option.id]: e.target.checked })}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
            <div className="step-foot">
              <button type="button" className="btn btn-primary" onClick={() => setStep(2)}>
                Continue
              </button>
            </div>
          </Section>

          <Section
            number={2}
            title="When and why"
            step={step}
            summary={[parsed ? formatLongDate(date) : "", way, why].filter(Boolean).join(" · ")}
            onEdit={() => setStep(2)}
            headingRef={headingRefs[1]}
          >
            <div className="field">
              <label htmlFor="start-date">When does the manager change start?</label>
              <input
                id="start-date"
                type="date"
                className="input input-date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-describedby="start-date-help"
              />
              <div aria-live="polite" id="start-date-help">
                {!parsed && <p className="field-msg">Pick the date the new manager takes over.</p>}
                {parsed && person.nonExempt && isSunday && (
                  <p className="field-msg field-msg-ok">
                    <IconCheckCircle size={15} />
                    {formatLongDate(date)}: first day of the pay period.
                  </p>
                )}
                {parsed && person.nonExempt && !isSunday && (
                  <p className="field-msg field-msg-warn">
                    <IconAlert size={15} />
                    That date is a {weekdayName(parsed)}, which falls mid pay period. Non-exempt changes start on a
                    Sunday.
                  </p>
                )}
                {parsed && !person.nonExempt && (
                  <p className="field-msg field-msg-ok">
                    <IconCheckCircle size={15} />
                    {formatLongDate(date)}. Exempt changes can start on any date.
                  </p>
                )}
              </div>
            </div>

            <div className="field">
              <label htmlFor="way">What&apos;s the way to change the manager?</label>
              <select id="way" className="input" value={way} onChange={(e) => setWay(e.target.value)}>
                <option value="">Select…</option>
                {WAYS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="why">Why are you changing the manager?</label>
              <select id="why" className="input" value={why} onChange={(e) => setWhy(e.target.value)}>
                <option value="">Select…</option>
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="step-foot">
              <button type="button" className="btn btn-primary" disabled={!canContinue2} onClick={() => setStep(3)}>
                Continue
              </button>
              {!canContinue2 && <p className="muted small">Fill in all three fields to continue.</p>}
            </div>
          </Section>

          <Section
            number={3}
            title="Managers"
            step={step}
            summary=""
            onEdit={() => setStep(3)}
            headingRef={headingRefs[2]}
          >
            {editing ? (
              <div className="mgr-row mgr-row-edit">
                <div className="field combo">
                  <label htmlFor="managers-input">Managers</label>
                  <input
                    id="managers-input"
                    ref={inputRef}
                    type="text"
                    className="input"
                    value={text}
                    autoComplete="off"
                    spellCheck={false}
                    aria-autocomplete="list"
                    aria-controls="managers-list"
                    aria-activedescendant={
                      showList && matches.length > 0 ? `mgr-opt-${Math.min(active, matches.length - 1)}` : undefined
                    }
                    aria-describedby="managers-help"
                    onChange={(e) => {
                      setText(e.target.value);
                      setPicked(null);
                      setListOpen(true);
                      setActive(0);
                    }}
                    onKeyDown={onInputKeyDown}
                    onBlur={() => window.setTimeout(() => setListOpen(false), 120)}
                  />
                  <ul
                    className="listbox"
                    id="managers-list"
                    role="listbox"
                    aria-label="Matching managers"
                    hidden={!showList || matches.length === 0}
                  >
                    {matches.map((option, index) => (
                      <li
                        key={option.name}
                        id={`mgr-opt-${index}`}
                        role="option"
                        aria-selected={index === Math.min(active, matches.length - 1)}
                        className="option"
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => pick(option)}
                      >
                        <span className="option-name">{option.name}</span>
                        <span className="option-title">{option.title}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="field-msg" id="managers-help" aria-live="polite">
                    {showList && matches.length === 0
                      ? "No managers match. Check the spelling."
                      : picked && picked.name === manager
                        ? `${picked.name} is already the line manager. Pick someone else.`
                        : canSave
                          ? `${picked?.title}. Line manager.`
                          : "Clear the name, type at least two letters, then pick from the list."}
                  </p>
                </div>
                <button type="button" className="btn btn-primary" disabled={!canSave} onClick={save}>
                  Save
                </button>
              </div>
            ) : (
              <div className="mgr-row">
                <span className="avatar" aria-hidden="true">
                  {initials(manager)}
                </span>
                <div className="person-main">
                  <p className="person-name">{manager}</p>
                  <p className="person-title">
                    Line manager
                    {saved && manager !== person.manager ? ` · replaces ${person.manager}` : " · active"}
                  </p>
                </div>
                <button
                  type="button"
                  ref={editBtnRef}
                  className="icon-btn icon-btn-outlined"
                  aria-label="Edit manager"
                  onClick={() => {
                    setText(manager);
                    setPicked(null);
                    setListOpen(false);
                    setEditing(true);
                  }}
                >
                  <IconPencil size={18} />
                </button>
              </div>
            )}
            <div aria-live="polite">
              {saved && !editing && (
                <p className="notice notice-ok" role="status">
                  <IconCheckCircle size={18} />
                  <span>Changes saved. Review, then submit.</span>
                </p>
              )}
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}

function Resolver() {
  const params = useSearchParams();
  const slug = params.get("person");
  const person = findPerson(slug);
  if (!person) {
    return (
      <>
        <PageHeader title="Person not found" backHref="/practice/workforce" backLabel="Back to Our Workforce" />
        <div className="wrap body">
          <div className="card">
            <p className="notice">
              <IconInfo size={18} />
              <span>Start from Our Workforce: search for a person, then choose an action for them.</span>
            </p>
            <div className="actions actions-start">
              <Link href="/practice/workforce" className="btn btn-primary">
                <IconArrowLeft size={16} />
                Back to Our Workforce
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }
  return <ChangeManager key={person.slug} person={person} />;
}

export default function ChangeManagerPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <Resolver />
    </Suspense>
  );
}
