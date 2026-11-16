"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  IconBriefcase,
  IconCalendar,
  IconChart,
  IconClock,
  IconCompass,
  IconDocument,
  IconDots,
  IconIdCard,
  IconSearch,
  IconSitemap,
  IconSwap,
  IconUser,
  IconUserPlus,
  IconWallet,
} from "../../components/Icons";
import { useDecoy } from "../../components/Shell";
import Springboard from "../../components/Springboard";
import { PEOPLE, initials, type Person } from "../../lib/data";

const QUICK = [
  { label: "Hire an Employee", icon: <IconUserPlus size={20} /> },
  { label: "Add a Contingent Worker", icon: <IconUserPlus size={20} /> },
  { label: "Person", icon: <IconUser size={20} /> },
  { label: "Document Records", icon: <IconDocument size={20} /> },
  { label: "Change Assignment", icon: <IconSwap size={20} /> },
];

const APPS = [
  { label: "Hiring", icon: <IconBriefcase size={32} /> },
  { label: "Journeys", icon: <IconCompass size={32} /> },
  { label: "Person Management", icon: <IconIdCard size={32} /> },
  { label: "Workforce Structures", icon: <IconSitemap size={32} /> },
  { label: "Absences", icon: <IconCalendar size={32} /> },
  { label: "Time", icon: <IconClock size={32} /> },
  { label: "Payroll", icon: <IconWallet size={32} /> },
  { label: "Compensation", icon: <IconChart size={32} /> },
];

function ActionsMenu({ person, onDecoy }: { person: Person; onDecoy: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = `actions-menu-${person.slug}`;

  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    items?.[0]?.focus();
    function onPointer(event: MouseEvent | TouchEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open]);

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (event.key === "ArrowDown") next = (index + 1) % items.length;
    else if (event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    } else if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (next >= 0) {
      event.preventDefault();
      items[next]?.focus();
    }
  }

  function decoy() {
    close(false);
    onDecoy();
  }

  return (
    <div className="menu-wrap" ref={wrapRef}>
      <button
        type="button"
        ref={buttonRef}
        className="icon-btn icon-btn-outlined"
        aria-label={`Actions for ${person.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          } else if (event.key === "Escape" && open) {
            close(true);
          }
        }}
      >
        <IconDots size={20} />
      </button>
      {open && (
        <div
          className="menu"
          id={menuId}
          role="menu"
          aria-label={`Actions for ${person.name}`}
          ref={menuRef}
          onKeyDown={onMenuKeyDown}
        >
          <div role="group" aria-labelledby={`${menuId}-group`}>
            <p className="menu-heading" id={`${menuId}-group`}>
              Employment
            </p>
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="menu-item"
              onClick={() => router.push(`/practice/workforce/change-manager?person=${person.slug}`)}
            >
              Change Manager
            </button>
            <button type="button" role="menuitem" tabIndex={-1} className="menu-item" onClick={decoy}>
              Change Location
            </button>
            <button type="button" role="menuitem" tabIndex={-1} className="menu-item" onClick={decoy}>
              Termination
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkforcePage() {
  const decoy = useDecoy();
  const [query, setQuery] = useState("");

  useEffect(() => {
    document.title = "Our Workforce · HCM practice";
  }, []);

  const term = query.trim().toLowerCase();
  const ready = term.length >= 2;
  const results = ready ? PEOPLE.filter((p) => p.name.toLowerCase().includes(term)) : [];

  return (
    <Springboard tab="workforce" quickActions={QUICK} apps={APPS}>
      <section className="search" aria-label="Person search">
        <div className="search-box">
          <label htmlFor="person-search" className="sr-only">
            Search for a person
          </label>
          <IconSearch size={20} />
          <input
            id="person-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for people and actions"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="person-search-status"
          />
        </div>
        <p className="search-status" id="person-search-status" aria-live="polite">
          {!ready
            ? "Enter at least 2 characters of a name."
            : results.length === 0
              ? "No results found. Check the spelling and try again."
              : `${results.length} ${results.length === 1 ? "person" : "people"}`}
        </p>

        {results.length > 0 && (
          <ul className="card people" role="list">
            {results.map((person) => (
              <li key={person.slug} className="person-row">
                <span className="avatar" aria-hidden="true">
                  {initials(person.name)}
                </span>
                <div className="person-main">
                  <p className="person-name">{person.name}</p>
                  <p className="person-title">{person.title}</p>
                  <p className="person-meta">
                    <span>{person.personNumber}</span>
                    <span>{person.department}</span>
                    <span>{person.payType}</span>
                    <span>Manager: {person.manager}</span>
                  </p>
                </div>
                <ActionsMenu person={person} onDecoy={decoy} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </Springboard>
  );
}
