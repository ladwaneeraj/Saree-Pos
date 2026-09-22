"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { downloadFile, toCsv } from "@/lib/files";

type Cell = string | number | null | undefined;

export interface CsvSpec<T> {
  filename: string;
  header: string[];
  row: (r: T) => Cell[];
}

export function exportCsv<T>(rows: T[], spec: CsvSpec<T>) {
  const date = new Date().toISOString().slice(0, 10);
  downloadFile(`dhanvi-${spec.filename}-${date}.csv`, toCsv([spec.header, ...rows.map(spec.row)]));
}

export function CsvButton<T>({ rows, spec }: { rows: T[] | undefined; spec: CsvSpec<T> }) {
  return (
    <Button variant="outline" size="sm" className="bg-card" disabled={!rows?.length} onClick={() => rows && exportCsv(rows, spec)}>
      <Download /> CSV
    </Button>
  );
}

/** Titled table with its own CSV export. */
export function TableSection<T>({ title, description, rows, columns, rowKey, csv, mobileCard, empty, onRowClick }: {
  title: React.ReactNode;
  description?: React.ReactNode;
  rows: T[] | undefined;
  columns: Column<T>[];
  rowKey: (r: T) => string;
  csv: CsvSpec<T>;
  mobileCard?: (r: T) => React.ReactNode;
  empty?: string;
  onRowClick?: (r: T) => void;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        <CsvButton rows={rows} spec={csv} />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={rowKey}
        mobileCard={mobileCard}
        onRowClick={onRowClick}
        loadingRows={5}
        empty={<div className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">{empty ?? "Nothing to show for this period."}</div>}
      />
    </section>
  );
}
