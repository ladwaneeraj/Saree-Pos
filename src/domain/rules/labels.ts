import type { LabelSettings } from "../types";

/** Values a SKU template can draw on for one piece. */
export interface SkuContext {
  shopCode: string;
  vendorCode: string;
  patternCode: string;
  fabricName: string;
  /** Running number reserved from the "sku" counter. */
  seq: number;
}

const clean = (s: string) => s.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

/**
 * Expands a SKU template such as "{shop}{vendor}{pattern}{seq:4}" → "DSVSCHC0001".
 * Unknown tokens are dropped; literal text between tokens is kept.
 */
export function skuFromTemplate(template: string, ctx: SkuContext): string {
  const out = template.replace(/\{(\w+)(?::(\d+))?\}/g, (_, token: string, digits?: string) => {
    switch (token.toLowerCase()) {
      case "shop":
        return clean(ctx.shopCode);
      case "vendor":
        return clean(ctx.vendorCode);
      case "pattern":
        return clean(ctx.patternCode);
      case "fabric":
        return clean(ctx.fabricName).slice(0, 3);
      case "seq":
        return String(ctx.seq).padStart(Number(digits ?? 0), "0");
      default:
        return "";
    }
  });
  return out.trim().toUpperCase();
}

/** Problems with a template that would produce clashing or empty SKUs. */
export function validateSkuTemplate(template: string): string | null {
  if (!template.trim()) return "Enter a SKU format";
  if (!/\{seq(?::\d+)?\}/i.test(template)) return "The format must include {seq} so every piece gets a unique number";
  const unknown = [...template.matchAll(/\{(\w+)(?::\d+)?\}/g)].map((m) => m[1]!.toLowerCase()).filter((t) => !["shop", "vendor", "pattern", "fabric", "seq"].includes(t));
  if (unknown.length) return `Unknown token: {${unknown[0]}}`;
  return null;
}

export function validatePriceCipher(cipher: string): string | null {
  const c = cipher.toUpperCase();
  if (!/^[A-Z]{10}$/.test(c)) return "Use exactly 10 letters";
  if (new Set(c).size !== 10) return "All 10 letters must be different";
  return null;
}

/** "SILKWEAVER" turns 4,250 into "WRKS": each digit is replaced by the letter at that position. */
export function encodePrice(price: number, cipher: string): string {
  const c = cipher.toUpperCase();
  if (validatePriceCipher(c)) return String(price);
  return String(Math.round(price)).replace(/\d/g, (d) => c[Number(d)]!);
}

export function labelPriceText(price: number, settings: Pick<LabelSettings, "priceMode" | "priceCipher">): string {
  return settings.priceMode === "CODED" ? encodePrice(price, settings.priceCipher) : `Rs. ${Math.round(price).toLocaleString("en-IN")}`;
}
