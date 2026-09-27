/**
 * Reads a supplier bill (photo or PDF) with the Claude API and returns the fields a purchase
 * needs. The call goes straight from the browser, so the API key lives in this browser only.
 * Nothing is saved until the user reviews the prefilled form.
 */
import { DomainError } from "@/domain/errors";
import { getSettings } from "./settings";

export interface ScannedLine {
  description: string;
  hsn: string;
  quantity: number;
  /** Per-unit price before GST, in rupees. */
  rate: number;
  amount: number;
  colour: string;
}

export interface ScannedBill {
  supplier: { name: string; gstin: string; phone: string; address: string };
  invoiceNumber: string;
  /** YYYY-MM-DD */
  date: string;
  lines: ScannedLine[];
  taxable: number;
  gstRate: number;
  gstAmount: number;
  otherCharges: number;
  total: number;
  amountPaid: number;
  /** Anything the model was unsure about, shown to the user. */
  notes: string;
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["supplier", "invoiceNumber", "date", "lines", "taxable", "gstRate", "gstAmount", "otherCharges", "total", "amountPaid", "notes"],
  properties: {
    supplier: {
      type: "object",
      additionalProperties: false,
      required: ["name", "gstin", "phone", "address"],
      properties: { name: { type: "string" }, gstin: { type: "string" }, phone: { type: "string" }, address: { type: "string" } },
    },
    invoiceNumber: { type: "string" },
    date: { type: "string", description: "Invoice date as YYYY-MM-DD, empty if unreadable" },
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description", "hsn", "quantity", "rate", "amount", "colour"],
        properties: {
          description: { type: "string" },
          hsn: { type: "string" },
          quantity: { type: "number" },
          rate: { type: "number", description: "Price per unit before GST" },
          amount: { type: "number", description: "Line amount before GST" },
          colour: { type: "string", description: "Colour if the line mentions one, else empty" },
        },
      },
    },
    taxable: { type: "number" },
    gstRate: { type: "number", description: "Total GST percent (CGST + SGST, or IGST). 0 if no GST." },
    gstAmount: { type: "number" },
    otherCharges: { type: "number", description: "Freight, packing, round-off; negative for discounts" },
    total: { type: "number", description: "Grand total payable" },
    amountPaid: { type: "number", description: "Received or paid amount printed on the bill, else 0" },
    notes: { type: "string", description: "Anything unclear or assumed" },
  },
} as const;

const PROMPT =
  "This is a supplier invoice for a saree shop in India. Read it carefully and return the purchase details using the record_bill tool. " +
  "Use the seller's (supplier's) details, not the buyer's. Amounts are rupees. If the bill lists quantities in pieces, keep pieces. " +
  "Rate must be per unit before GST; if the bill shows GST-inclusive rates, back the GST out. Do not invent values: leave text empty and numbers 0 when unreadable, and say so in notes.";

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function scanSupplierBill(file: File): Promise<ScannedBill> {
  const { ai } = await getSettings();
  if (!ai.anthropicApiKey) throw new DomainError("Add your Claude API key under Settings → AI to scan bills");
  if (file.size > 20 * 1024 * 1024) throw new DomainError("File is larger than 20 MB. Use a smaller photo.");
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf && !IMAGE_TYPES.has(file.type)) throw new DomainError("Use a JPG, PNG, WebP or PDF of the bill");
  const data = await toBase64(file);
  const source = { type: "base64", media_type: isPdf ? "application/pdf" : file.type, data };
  const content = [isPdf ? { type: "document", source } : { type: "image", source }, { type: "text", text: PROMPT }];

  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ai.anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: ai.model || "claude-sonnet-4-5",
        max_tokens: 4096,
        tools: [{ name: "record_bill", description: "Records the fields read from the supplier bill.", input_schema: SCHEMA }],
        tool_choice: { type: "tool", name: "record_bill" },
        messages: [{ role: "user", content }],
      }),
    });
  } catch {
    throw new DomainError("Could not reach the Claude API. Check the internet connection.");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new DomainError(`Claude API error ${response.status}: ${body?.error?.message ?? response.statusText}`);
  }
  const json = (await response.json()) as { content?: { type: string; name?: string; input?: unknown }[] };
  const tool = json.content?.find((c) => c.type === "tool_use" && c.name === "record_bill");
  if (!tool?.input) throw new DomainError("The bill could not be read. Try a clearer photo.");
  return normalise(tool.input as Partial<ScannedBill>);
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(String(v ?? "").replace(/[^\d.-]/g, "")) || 0);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function normalise(raw: Partial<ScannedBill>): ScannedBill {
  const supplier = (raw.supplier ?? {}) as Partial<ScannedBill["supplier"]>;
  const lines = (Array.isArray(raw.lines) ? raw.lines : []).map((l) => ({
    description: str(l?.description),
    hsn: str(l?.hsn),
    quantity: Math.max(1, Math.round(num(l?.quantity)) || 1),
    rate: Math.round(num(l?.rate)),
    amount: Math.round(num(l?.amount)),
    colour: str(l?.colour),
  })).filter((l) => l.description);
  const taxable = Math.round(num(raw.taxable)) || lines.reduce((s, l) => s + (l.amount || l.quantity * l.rate), 0);
  const gstAmount = Math.round(num(raw.gstAmount));
  const gstRate = num(raw.gstRate) || (taxable ? Math.round((gstAmount / taxable) * 100) : 0);
  return {
    supplier: { name: str(supplier.name), gstin: str(supplier.gstin).toUpperCase(), phone: str(supplier.phone), address: str(supplier.address) },
    invoiceNumber: str(raw.invoiceNumber),
    date: /^\d{4}-\d{2}-\d{2}$/.test(str(raw.date)) ? str(raw.date) : "",
    lines,
    taxable,
    gstRate,
    gstAmount,
    otherCharges: Math.round(num(raw.otherCharges)),
    total: Math.round(num(raw.total)) || taxable + gstAmount + Math.round(num(raw.otherCharges)),
    amountPaid: Math.round(num(raw.amountPaid)),
    notes: str(raw.notes),
  };
}
