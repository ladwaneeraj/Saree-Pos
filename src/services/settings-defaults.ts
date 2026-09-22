import type { AppSettings, NotificationEvent } from "@/domain/types";

const ALL_EVENTS_ON: Record<NotificationEvent, boolean> = {
  ORDER_CONFIRMED: true,
  PAYMENT_REQUEST: true,
  PAYMENT_RECEIVED: true,
  ORDER_PACKED: true,
  ORDER_DISPATCHED: true,
  ORDER_DELIVERED: true,
  REVIEW_REQUEST: true,
  BACK_IN_STOCK: true,
  RETURN_UPDATE: true,
  ORDER_CANCELLED: true,
};

export const DEFAULT_TEMPLATES: Record<NotificationEvent, string> = {
  ORDER_CONFIRMED: "Hi {name}, thank you for shopping with {store}! Your order {order} for {total} is confirmed. Track it here: {trackingLink}",
  PAYMENT_REQUEST: "Hi {name}, please complete the payment of {amount} for order {order} using this link: {paymentLink}. We are holding your saree until {dueTime}.",
  PAYMENT_RECEIVED: "Hi {name}, we have received your payment of {amount} for order {order}. Thank you!",
  ORDER_PACKED: "Hi {name}, your order {order} has been packed and will be dispatched soon.",
  ORDER_DISPATCHED: "Your order {order} has been dispatched via {courier}. AWB: {awb}. Track your parcel: {trackingLink}",
  ORDER_DELIVERED: "Your order {order} has been delivered. We hope you love it!",
  REVIEW_REQUEST: "How did you like your saree, {name}? Tap to rate your {design}: {reviewLink}",
  BACK_IN_STOCK: "Good news! The saree you saved is available again: {design} at {price}. {productLink}",
  RETURN_UPDATE: "Update on your return {returnNumber} for order {order}: {returnStatus}.",
  ORDER_CANCELLED: "Your order {order} has been cancelled. {refundNote}",
};

export const DEFAULT_SETTINGS: AppSettings = {
  business: {
    name: "Anvaya Silks",
    legalName: "Anvaya Silks & Textiles",
    tagline: "Handpicked silks and handlooms",
    gstin: "29ABCPA1234K1Z5",
    phone: "+91 98450 21870",
    whatsapp: "+91 98450 21870",
    email: "hello@anvayasilks.in",
    address: "1st Floor, 214 Chamarajpet Main Road",
    city: "Davanagere",
    state: "Karnataka",
    pincode: "577001",
  },
  store: {
    cartReservationMinutes: 15,
    posHoldMinutes: 30,
    whatsappHoldHours: 24,
    lowStockThreshold: 3,
    scarcityThreshold: 2,
    autoPublishNewDesigns: true,
    returnWindowDays: 7,
    highValueThreshold: 50_000,
    inactiveAfterDays: 180,
  },
  tax: {
    gstRate: 5,
    pricesIncludeTax: true,
    hsnCode: "5007",
  },
  shipping: {
    flatFee: 99,
    freeAbove: 2_999,
    couriers: ["DTDC", "Delhivery", "Blue Dart", "India Post", "Xpressbees"],
    defaultCourier: "DTDC",
    defaultTransitDays: 4,
  },
  notifications: {
    channel: "WHATSAPP",
    enabled: ALL_EVENTS_ON,
    templates: DEFAULT_TEMPLATES,
  },
  labels: {
    size: "THERMAL_50x25",
    showDesignName: true,
    showColour: true,
  },
  users: [
    { id: "u-owner", name: "Ramesh Hegde", role: "OWNER", email: "ramesh@anvayasilks.in" },
    { id: "u-manager", name: "Kavya Shetty", role: "MANAGER", email: "kavya@anvayasilks.in" },
    { id: "u-billing", name: "Suresh Naik", role: "BILLING", email: "suresh@anvayasilks.in" },
    { id: "u-packing", name: "Manjunath K", role: "PACKING", email: "manju@anvayasilks.in" },
  ],
};
