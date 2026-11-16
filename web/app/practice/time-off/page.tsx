"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader";
import RequestTable from "../../components/RequestTable";
import { SAMPLE_REQUESTS, VACATION_BALANCE, loadSubmitted, type TimeOffRequest } from "../../lib/data";

export default function TimeOffPage() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState<TimeOffRequest[]>([]);

  useEffect(() => {
    document.title = "Time Off · HCM practice";
    setSubmitted(loadSubmitted());
  }, []);

  const rows = [...submitted, ...SAMPLE_REQUESTS].slice(0, 5);

  return (
    <>
      <PageHeader
        title="Time Off"
        backHref="/"
        backLabel="Back to home"
        actions={
          <>
            <button type="button" className="btn btn-primary" onClick={() => router.push("/practice/time-off/new")}>
              New Request
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => router.push("/practice/time-off/history")}
            >
              History
            </button>
          </>
        }
      />
      <div className="wrap body stack">
        <section aria-labelledby="balances-h">
          <h2 className="section-title" id="balances-h">
            Plan Balances
          </h2>
          <div className="stat-row">
            <div className="card stat">
              <p className="stat-label">Vacation</p>
              <p className="stat-value">
                {VACATION_BALANCE.toFixed(1)} <span>Hours</span>
              </p>
              <p className="muted small">Balance as of Nov 15, 2026</p>
            </div>
            <div className="card stat">
              <p className="stat-label">Sick</p>
              <p className="stat-value">
                40.0 <span>Hours</span>
              </p>
              <p className="muted small">Balance as of Nov 15, 2026</p>
            </div>
            <div className="card stat">
              <p className="stat-label">Personal Day</p>
              <p className="stat-value">
                1 <span>Day</span>
              </p>
              <p className="muted small">Balance as of Nov 15, 2026</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="recent-h">
          <h2 className="section-title" id="recent-h">
            Existing Absences
          </h2>
          <div className="card card-flush">
            <RequestTable caption="Existing absences" rows={rows} />
          </div>
        </section>
      </div>
    </>
  );
}
