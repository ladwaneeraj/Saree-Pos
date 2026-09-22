import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";

export interface TimelineEntry {
  id: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  at: number;
  tone?: "default" | "success" | "warning" | "danger" | "muted";
}

const DOT: Record<NonNullable<TimelineEntry["tone"]>, string> = {
  default: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  muted: "bg-muted-foreground/40",
};

/** Vertical event list, newest last unless `reverse`. */
export function Timeline({ entries, reverse = false }: { entries: TimelineEntry[]; reverse?: boolean }) {
  const list = reverse ? [...entries].reverse() : entries;
  return (
    <ol className="relative">
      {list.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
          {i < list.length - 1 && <span className="absolute top-3 left-[5px] h-full w-px bg-border" />}
          <span className={cn("relative mt-1.5 size-[11px] shrink-0 rounded-full ring-4 ring-card", DOT[e.tone ?? "default"])} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{e.title}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {formatDateTime(e.at)}
              {e.meta && <> · {e.meta}</>}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
