import Link from "next/link";
import type { ReactNode } from "react";
import { IconChevronLeft } from "./Icons";

/** Redwood-style page header band: back chevron, strong title, optional detail and page-level actions. */
export default function PageHeader({
  title,
  backHref,
  backLabel,
  actions,
  children,
}: {
  title: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="ph">
      <div className="wrap ph-in">
        <div className="ph-title">
          {backHref && (
            <Link href={backHref} className="icon-btn ph-back" aria-label={backLabel}>
              <IconChevronLeft size={24} />
            </Link>
          )}
          <h1>{title}</h1>
        </div>
        {actions && <div className="ph-actions">{actions}</div>}
        {children && <div className="ph-detail">{children}</div>}
      </div>
    </header>
  );
}
