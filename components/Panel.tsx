import type { ReactNode } from "react";

export function Stat({
  label,
  value,
  note,
  accent = false,
  badge,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  accent?: boolean;
  badge?: ReactNode;
}) {
  return (
    <div className="stat">
      <div className="stat-label">
        {label}
        {badge}
      </div>
      <div className="stat-value" data-accent={accent}>
        {value}
      </div>
      {note ? <div className="stat-note">{note}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  action,
  live = false,
  children,
}: {
  title: string;
  action?: ReactNode;
  live?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">
          {live ? <span className="pulse" aria-hidden="true" /> : null}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Notice({
  title,
  tone = "info",
  children,
}: {
  title?: string;
  tone?: "info" | "warn";
  children: ReactNode;
}) {
  return (
    <div className="notice" data-tone={tone}>
      <div>
        {title ? <div className="notice-title">{title}</div> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}
