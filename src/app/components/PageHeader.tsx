import type { ReactNode } from "react";

export function PageHeader({ title, description, action }: { title: string; description: string; action: ReactNode }) {
  return <header className="page-header">
    <div className="min-w-0"><h1>{title}</h1><p title={description}>{description}</p></div>
    <div className="page-header-action">{action}</div>
  </header>;
}
