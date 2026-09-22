import { cn } from "@/lib/utils";

/** Card used for every chart and list on the dashboard and reports. */
export function Panel({ title, description, action, children, className, bodyClassName }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-xl border bg-card shadow-xs", className)}>
      <header className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className={cn("flex-1 p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
