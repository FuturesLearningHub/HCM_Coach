"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PageHeader from "../../../components/PageHeader";
import RequestTable from "../../../components/RequestTable";
import { SAMPLE_REQUESTS, loadSubmitted, type TimeOffRequest } from "../../../lib/data";

const OLDER: TimeOffRequest[] = [
  {
    id: "h1",
    type: "Vacation",
    reason: "Family",
    start: "2026-07-02",
    end: "2026-07-03",
    hours: 16,
    status: "Approved",
    submitted: "2026-06-11",
  },
  {
    id: "h2",
    type: "Sick",
    reason: "Other",
    start: "2026-03-17",
    end: "2026-03-17",
    hours: 8,
    status: "Approved",
    submitted: "2026-03-17",
  },
];

export default function HistoryPage() {
  const [submitted, setSubmitted] = useState<TimeOffRequest[]>([]);

  useEffect(() => {
    document.title = "Absence History · HCM practice";
    setSubmitted(loadSubmitted());
  }, []);

  const rows = [...submitted, ...SAMPLE_REQUESTS, ...OLDER];

  return (
    <>
      <PageHeader title="Absence History" backHref="/practice/time-off" backLabel="Back to Time Off" />
      <div className="wrap body stack">
        <p className="muted">
          Past and pending requests. A request stays pending until Payroll releases it. To start a new one,{" "}
          <Link href="/practice/time-off">go back to Time Off</Link>.
        </p>
        <div className="card card-flush">
          <RequestTable caption="Time off request status" rows={rows} />
        </div>
      </div>
    </>
  );
}
