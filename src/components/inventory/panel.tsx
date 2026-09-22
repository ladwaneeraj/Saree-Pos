import { cn } from "@/lib/utils";

/** Card surface used across inventory and design pages. */
export function Panel({ title, action, children, className, bodyClassName }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card shadow-xs", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </header>
      )}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
