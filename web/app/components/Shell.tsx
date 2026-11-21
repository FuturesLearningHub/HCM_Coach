"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { CURRENT_USER, DECOY_NOTICE } from "../lib/data";
import { IconBell, IconClose, IconFlag, IconGrid, IconHome, IconInfo, IconMenu, IconSearch, IconStar } from "./Icons";

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

  // The progress dashboard is an admin page, not part of the practice Oracle screens.
  if (pathname?.startsWith("/progress")) return <>{children}</>;

  return (
    <NoticeContext.Provider value={decoy}>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="gh">
        <div className="gh-in">
          <button type="button" className="gh-btn" aria-label="Navigator" onClick={decoy}>
            <IconMenu size={28} />
          </button>
          <Link href="/" className="gh-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/vu-lockup-white.png" alt="Vanderbilt University" width={170} height={44} />
          </Link>
          <form
            className="gh-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              decoy();
            }}
          >
            <IconSearch size={26} />
            <input type="search" aria-label="Search for people and actions" placeholder="Search for people and actions" autoComplete="off" />
          </form>
          <div className="gh-tools">
            <Link href="/" className="gh-btn" aria-label="Home">
              <IconHome size={28} />
            </Link>
            <button type="button" className="gh-btn gh-wide" aria-label="Favorites and recent items" onClick={decoy}>
              <IconStar size={28} />
            </button>
            <button type="button" className="gh-btn gh-wide" aria-label="Watchlist" onClick={decoy}>
              <IconFlag size={28} />
            </button>
            <button type="button" className="gh-btn" aria-label="Notifications" onClick={decoy}>
              <IconBell size={28} />
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

      <div className="side-dock" aria-label="Page tools">
        <button type="button" className="side-dock-btn" aria-label="Page information" onClick={decoy}>
          <IconInfo size={24} />
        </button>
        <button type="button" className="side-dock-btn" aria-label="More apps" onClick={decoy}>
          <IconGrid size={24} />
        </button>
      </div>
      <button type="button" className="assistant" aria-label="Virtual assistant" onClick={decoy}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/vu-v-icon.png" alt="" width={34} height={34} />
        <span className="assistant-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </button>

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
