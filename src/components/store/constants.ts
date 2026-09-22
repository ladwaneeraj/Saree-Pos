export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
  "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry",
] as const;

export const STORE_NAV = [
  { href: "/store/sarees", label: "Sarees" },
  { href: "/store/collections", label: "Collections" },
  { href: "/store/collections/wedding", label: "Wedding" },
  { href: "/store/sarees?sort=newest", label: "New Arrivals" },
  { href: "/store/track", label: "Track order" },
] as const;

export function whatsappLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "");
  const full = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}
