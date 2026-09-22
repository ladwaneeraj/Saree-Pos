import { Pill } from "@/components/shared/status-badge";
import type { PurchaseStatus } from "@/domain/types";

const TONE = { DRAFT: "warning", RECEIVED: "success", CANCELLED: "neutral" } as const;
const LABEL: Record<PurchaseStatus, string> = { DRAFT: "Draft", RECEIVED: "Received", CANCELLED: "Cancelled" };

export function PurchaseStatusBadge({ status }: { status: PurchaseStatus }) {
  return <Pill tone={TONE[status]}>{LABEL[status]}</Pill>;
}

export const purchaseStatusLabel = (s: PurchaseStatus) => LABEL[s];
