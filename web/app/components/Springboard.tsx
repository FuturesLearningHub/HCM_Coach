"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CURRENT_USER } from "../lib/data";
import { IconPlus } from "./Icons";
import { useDecoy } from "./Shell";

export type QuickAction = { label: string; icon: ReactNode };
export type AppTile = { label: string; icon: ReactNode; href?: string };

const TABS: { id: string; label: string; href?: string }[] = [
  { id: "me", label: "Me", href: "/" },
  { id: "team", label: "My Team" },
  { id: "workforce", label: "Our Workforce", href: "/practice/workforce" },
  { id: "tools", label: "Tools" },
  { id: "others", label: "Others" },
];

export default function Springboard({
  tab,
  quickActions,
  apps,
  children,
  after,
}: {
  tab: "me" | "workforce";
  quickActions: QuickAction[];
  apps: AppTile[];
  children?: ReactNode;
  after?: ReactNode;
}) {
  const decoy = useDecoy();
  return (
    <>
      <div className="banner">
        <div className="wrap">
          <h1 className="greeting">Good afternoon, {CURRENT_USER.name}!</h1>
          <nav className="tabs" aria-label="Home tabs">
            {TABS.map((t) =>
              t.href ? (
                <Link key={t.id} href={t.href} className="tab" aria-current={t.id === tab ? "page" : undefined}>
                  {t.label}
                </Link>
              ) : (
                <button key={t.id} type="button" className="tab" onClick={decoy}>
                  {t.label}
                </button>
              ),
            )}
          </nav>
        </div>
      </div>

      <div className="wrap body">
        {children}
        <div className="board">
          <section className="board-quick" aria-labelledby="quick-h">
            <h2 className="caps" id="quick-h">
              Quick Actions
            </h2>
            <ul className="quick-list" role="list">
              {quickActions.map((q) => (
                <li key={q.label}>
                  <button type="button" className="quick-link" onClick={decoy}>
                    {q.icon}
                    <span>{q.label}</span>
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="quick-link quick-more" onClick={decoy}>
                  Show More
                </button>
              </li>
            </ul>
          </section>

          <section className="board-apps" aria-labelledby="apps-h">
            <h2 className="caps" id="apps-h">
              Apps
            </h2>
            <ul className="app-grid" role="list">
              {apps.map((a) => (
                <li key={a.label}>
                  {a.href ? (
                    <Link href={a.href} className="app">
                      <span className="app-tile">{a.icon}</span>
                      <span className="app-label">{a.label}</span>
                    </Link>
                  ) : (
                    <button type="button" className="app" onClick={decoy}>
                      <span className="app-tile">{a.icon}</span>
                      <span className="app-label">{a.label}</span>
                    </button>
                  )}
                </li>
              ))}
              <li>
                <button type="button" className="app" aria-label="Personalize springboard" onClick={decoy}>
                  <span className="app-tile app-tile-add">
                    <IconPlus size={28} />
                  </span>
                </button>
              </li>
            </ul>
          </section>
        </div>
        {after}
      </div>
    </>
  );
}
