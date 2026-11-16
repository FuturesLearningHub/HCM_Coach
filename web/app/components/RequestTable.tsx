import { formatDate, formatRange, type TimeOffRequest } from "../lib/data";

export function StatusPill({ status }: { status: string }) {
  const tone = status === "Approved" ? "ok" : "pending";
  return <span className={`pill pill-${tone}`}>{status}</span>;
}

export default function RequestTable({ caption, rows }: { caption: string; rows: TimeOffRequest[] }) {
  return (
    <table className="table">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Absence type</th>
          <th scope="col">Dates</th>
          <th scope="col">Hours</th>
          <th scope="col">Sent</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <th scope="row" data-label="Absence type">
              {row.type}
            </th>
            <td data-label="Dates">{formatRange(row.start, row.end)}</td>
            <td data-label="Hours">{row.hours.toFixed(1)}</td>
            <td data-label="Sent">{formatDate(row.submitted)}</td>
            <td data-label="Status">
              <StatusPill status={row.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
