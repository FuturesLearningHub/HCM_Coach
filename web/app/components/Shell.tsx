"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { CURRENT_USER, DECOY_NOTICE } from "../lib/data";
import { IconBell, IconClose, IconFlag, IconHome, IconInfo, IconMenu, IconStar } from "./Icons";

const NoticeContext = createContext<() => void>(() => {});

/** Call the returned function from any control that is deliberately not part of the practice. */
export function useDecoy(): () => void {
  return useContext(NoticeContext);
}

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [notice, setNotice] = useState(0);
  const decoy = useCallback(() => setNotice((n) => n + 1), []);

  useEffect(() => {
    setNotice(0);
  }, [pathname]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(0), 8000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <NoticeContext.Provider value={decoy}>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="gh">
        <div className="gh-in">
          <button type="button" className="gh-btn" aria-label="Navigator" onClick={decoy}>
            <IconMenu size={24} />
          </button>
          <Link href="/" className="gh-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/vu-lockup-black.png" alt="Vanderbilt University" width={107} height={28} />
          </Link>
          <span className="gh-chip">Practice</span>
          <div className="gh-tools">
            <Link href="/" className="gh-btn" aria-label="Home">
              <IconHome size={24} />
            </Link>
            <button type="button" className="gh-btn gh-wide" aria-label="Favorites and recent items" onClick={decoy}>
              <IconStar size={24} />
            </button>
            <button type="button" className="gh-btn gh-wide" aria-label="Watchlist" onClick={decoy}>
              <IconFlag size={24} />
            </button>
            <button type="button" className="gh-btn" aria-label="Notifications, 3 unread" onClick={decoy}>
              <IconBell size={24} />
              <span className="gh-badge" aria-hidden="true">
                3
              </span>
            </button>
            <button
              type="button"
              className="gh-btn gh-user"
              aria-label={`${CURRENT_USER.name}, settings`}
              onClick={decoy}
            >
              <span className="gh-avatar" aria-hidden="true">
                {CURRENT_USER.initials}
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="toast-region" aria-live="polite">
        {notice > 0 && (
          <div className="msg msg-info toast" role="status" key={notice}>
            <IconInfo size={20} />
            <p>{DECOY_NOTICE}</p>
            <button type="button" className="icon-btn" aria-label="Dismiss notice" onClick={() => setNotice(0)}>
              <IconClose size={18} />
            </button>
          </div>
        )}
      </div>

      <main id="main" tabIndex={-1}>
        {children}
      </main>

      <footer className="footer">
        <p>Practice environment with fictional people and data. Not connected to Oracle.</p>
      </footer>
    </NoticeContext.Provider>
  );
}
