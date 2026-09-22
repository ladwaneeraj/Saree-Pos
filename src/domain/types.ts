/**
 * Domain model for VASRA.
 *
 * Conventions:
 * - All money values are whole Indian Rupees (integers). Tax splits are derived at display time.
 * - All timestamps are epoch milliseconds.
 * - A Design is the sellable product shown on the website. An InventoryItem is one physical saree
 *   with its own SKU. Every channel (POS, website, WhatsApp) sells InventoryItems.
 */

export type ID = string;
export type Timestamp = number;

/* ------------------------------------------------------------------ */
/* Masters                                                             */
/* ------------------------------------------------------------------ */

export interface Category {
  id: ID;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface Collection {
  id: ID;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
}

export interface Colour {
  id: ID;
  name: string;
  hex: string;
}

export interface Fabric {
  id: ID;
  name: string;
  description: string;
  care: string;
  /** Category assigned to new designs of this fabric when none is chosen. */
  categoryId: ID;
}

export interface Supplier {
  id: ID;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  gstin: string;
  createdAt: Timestamp;
}

/* ------------------------------------------------------------------ */
/* Media                                                               */
/* ------------------------------------------------------------------ */

/** The single image source shared by inventory, POS, website and WhatsApp. */
export interface Media {
  id: ID;
  /** UPLOAD: resized in the browser and stored as a data URL. STOCK: demo photo loaded from a CDN. */
  kind: "UPLOAD" | "STOCK";
  mime: string;
  url: string;
  /** Small version for tables and grids. */
  thumbUrl: string;
  width: number;
  height: number;
  /** Photographer credit for stock photos. */
  credit: string | null;
  createdAt: Timestamp;
}

/* ------------------------------------------------------------------ */
/* Designs and inventory                                               */
/* ------------------------------------------------------------------ */

export interface Design {
  id: ID;
  code: string;
  name: string;
  slug: string;
  categoryId: ID;
  fabricId: ID;
  collectionIds: ID[];
  pattern: string;
  border: string;
  lengthM: number;
  blouseIncluded: boolean;
  description: string;
  /** Default MRP for pieces of this design. */
  mrp: number;
  /** Default selling price for pieces of this design. */
  price: number;
  /** Design gallery. The first image is the primary image. */
  imageIds: ID[];
  isPublished: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const INVENTORY_STATUSES = ["AVAILABLE", "RESERVED", "SOLD", "DAMAGED", "RETURNED"] as const;
export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

export const SALES_CHANNELS = ["SHOP", "WEBSITE", "WHATSAPP"] as const;
export type SalesChannel = (typeof SALES_CHANNELS)[number];

/**
 * CART: website cart, expires.
 * HOLD: POS counter or WhatsApp conversation hold, expires.
 * ORDER: allocated to a placed order, never expires on its own.
 */
export type ReservationKind = "CART" | "HOLD" | "ORDER";

export interface Reservation {
  kind: ReservationKind;
  /** Cart session id, POS terminal id, WhatsApp conversation id, or order id. */
  holderId: string;
  channel: SalesChannel;
  orderId: ID | null;
  reservedAt: Timestamp;
  expiresAt: Timestamp | null;
}

export interface InventoryItem {
  id: ID;
  sku: string;
  designId: ID;
  colourId: ID;
  cost: number;
  mrpOverride: number | null;
  priceOverride: number | null;
  location: string;
  status: InventoryStatus;
  /** Piece photos. Empty means the piece uses its design's photos. */
  imageIds: ID[];
  purchaseId: ID | null;
  supplierId: ID | null;
  receivedAt: Timestamp;
  reservation: Reservation | null;
  /** Denormalised for the [holder] index used by carts. Mirrors reservation?.holderId. */
  holderId: string | null;
  soldAt: Timestamp | null;
  soldOrderId: ID | null;
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const MOVEMENT_TYPES = [
  "PURCHASED",
  "RECEIVED",
  "LOCATION_CHANGED",
  "RESERVED",
  "RESERVATION_RELEASED",
  "RESERVATION_EXPIRED",
  "SOLD",
  "RETURN_RECEIVED",
  "QC_PASSED",
  "QC_FAILED",
  "MARKED_DAMAGED",
  "RESTORED",
  "PRICE_CHANGED",
  "EDITED",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export interface InventoryMovement {
  id: ID;
  itemId: ID;
  sku: string;
  type: MovementType;
  /** +1 when stock enters, -1 when it leaves, 0 for internal changes. */
  quantityDelta: number;
  fromStatus: InventoryStatus | null;
  toStatus: InventoryStatus | null;
  location: string | null;
  channel: SalesChannel | null;
  refType: "ORDER" | "PURCHASE" | "RETURN" | "CART" | "HOLD" | null;
  refId: string | null;
  refLabel: string | null;
  note: string;
  actorName: string;
  createdAt: Timestamp;
}

/** Row in the bulk photo entry sheet. Persisted so work survives a refresh. */
export interface InventoryDraft {
  id: ID;
  position: number;
  imageIds: ID[];
  designId: ID | null;
  designName: string;
  colourId: ID | null;
  colourAutoDetected: boolean;
  fabricId: ID | null;
  collectionId: ID | null;
  cost: number | null;
  mrp: number | null;
  price: number | null;
  location: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/* ------------------------------------------------------------------ */
/* Purchases                                                           */
/* ------------------------------------------------------------------ */

export type PurchaseStatus = "DRAFT" | "RECEIVED" | "CANCELLED";

export interface Purchase {
  id: ID;
  number: string;
  supplierId: ID;
  invoiceNumber: string;
  date: Timestamp;
  status: PurchaseStatus;
  pieceCount: number;
  totalCost: number;
  notes: string;
  receivedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PurchaseItem {
  id: ID;
  purchaseId: ID;
  designId: ID;
  colourId: ID;
  quantity: number;
  cost: number;
  mrp: number;
  price: number;
  location: string;
  createdAt: Timestamp;
}

/* ------------------------------------------------------------------ */
/* Customers                                                           */
/* ------------------------------------------------------------------ */

export interface Address {
  id: ID;
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
}

export interface CustomerStats {
  orderCount: number;
  totalSpend: number;
  firstOrderAt: Timestamp | null;
  lastOrderAt: Timestamp | null;
}

export interface Customer {
  id: ID;
  name: string;
  phone: string;
  email: string;
  addresses: Address[];
  notes: string;
  source: SalesChannel;
  stats: CustomerStats;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CustomerType = "NEW" | "REPEAT" | "HIGH_VALUE" | "INACTIVE";

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

export const ORDER_STATUSES = [
  "NEW",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "RESERVED",
  "PACKING",
  "READY_TO_DISPATCH",
  "DISPATCHED",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED",
  "RETURN_REQUESTED",
  "RETURNED",
  "REFUNDED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type PaymentStatus = "PENDING" | "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED";
export type Fulfilment = "IN_STORE" | "SHIPPING";
export type PaymentMethod = "CASH" | "UPI" | "CARD" | "NETBANKING" | "STORE_CREDIT";

export interface OrderEvent {
  id: ID;
  status: OrderStatus | null;
  label: string;
  note: string;
  actorName: string;
  at: Timestamp;
}

export interface CustomerSnapshot {
  name: string;
  phone: string;
  email: string;
}

export interface Order {
  id: ID;
  number: number;
  channel: SalesChannel;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfilment: Fulfilment;
  customerId: ID | null;
  customer: CustomerSnapshot;
  shippingAddress: Address | null;
  itemCount: number;
  /** Sum of line totals (after line discounts). */
  subtotal: number;
  /** Order-level discount. */
  discount: number;
  shippingFee: number;
  total: number;
  /** GST snapshot at the time of sale. Prices are tax-inclusive. */
  taxRate: number;
  taxAmount: number;
  notes: string;
  /** Payment deadline for WhatsApp orders awaiting payment. */
  paymentDueAt: Timestamp | null;
  timeline: OrderEvent[];
  /** For exchanges: the order this one replaces an item from. */
  exchangeOfOrderId: ID | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type OrderItemStatus = "ACTIVE" | "RETURNED" | "EXCHANGED";

/** Snapshot of what was sold. Never re-derived from current design or price data. */
export interface OrderItem {
  id: ID;
  orderId: ID;
  inventoryItemId: ID;
  sku: string;
  designId: ID;
  designName: string;
  colourName: string;
  fabricName: string;
  imageId: ID | null;
  mrp: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  cost: number;
  status: OrderItemStatus;
  createdAt: Timestamp;
}

export interface Payment {
  id: ID;
  orderId: ID;
  kind: "PAYMENT" | "REFUND";
  method: PaymentMethod;
  /** Always positive. Refunds are identified by kind. */
  amount: number;
  reference: string;
  createdAt: Timestamp;
}

/* ------------------------------------------------------------------ */
/* Shipping                                                            */
/* ------------------------------------------------------------------ */

export type ShipmentStatus = "DISPATCHED" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED";

export interface ShipmentEvent {
  status: ShipmentStatus;
  location: string;
  description: string;
  at: Timestamp;
}

export interface Shipment {
  id: ID;
  orderId: ID;
  courier: string;
  awb: string;
  status: ShipmentStatus;
  dispatchedAt: Timestamp;
  expectedDeliveryAt: Timestamp;
  deliveredAt: Timestamp | null;
  events: ShipmentEvent[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/* ------------------------------------------------------------------ */
/* Returns and exchanges                                               */
/* ------------------------------------------------------------------ */

export type ReturnStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "RECEIVED"
  | "QC_COMPLETED"
  | "REFUNDED"
  | "EXCHANGED";

export type QcResult = "PENDING" | "GOOD" | "DAMAGED";

export interface ReturnLine {
  orderItemId: ID;
  inventoryItemId: ID;
  sku: string;
  designName: string;
  colourName: string;
  unitPrice: number;
  qc: QcResult;
}

export interface ExchangeDetails {
  newInventoryItemId: ID;
  newSku: string;
  newDesignName: string;
  newPrice: number;
  /** Positive: customer pays. Negative: shop refunds. */
  priceDifference: number;
  newOrderId: ID | null;
}

export interface ReturnRequest {
  id: ID;
  number: string;
  orderId: ID;
  orderNumber: number;
  customerId: ID | null;
  customerName: string;
  type: "RETURN" | "EXCHANGE";
  status: ReturnStatus;
  reason: string;
  lines: ReturnLine[];
  refundAmount: number;
  exchange: ExchangeDetails | null;
  timeline: { label: string; actorName: string; at: Timestamp }[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/* ------------------------------------------------------------------ */
/* Engagement                                                          */
/* ------------------------------------------------------------------ */

export interface WishlistEntry {
  id: ID;
  /** Shopper session id (website) or customer id. */
  ownerId: string;
  customerId: ID | null;
  designId: ID;
  /** Set when a back-in-stock message was sent, cleared when stock runs out again. */
  notifiedAt: Timestamp | null;
  createdAt: Timestamp;
}

export interface Review {
  id: ID;
  orderId: ID;
  designId: ID;
  customerName: string;
  city: string;
  rating: number;
  body: string;
  createdAt: Timestamp;
}

export const NOTIFICATION_EVENTS = [
  "ORDER_CONFIRMED",
  "PAYMENT_REQUEST",
  "PAYMENT_RECEIVED",
  "ORDER_PACKED",
  "ORDER_DISPATCHED",
  "ORDER_DELIVERED",
  "REVIEW_REQUEST",
  "BACK_IN_STOCK",
  "RETURN_UPDATE",
  "ORDER_CANCELLED",
] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export type NotificationChannel = "WHATSAPP" | "SMS" | "EMAIL";

/** Simulated customer message. Nothing is actually sent in the demo. */
export interface Notification {
  id: ID;
  event: NotificationEvent;
  channel: NotificationChannel;
  recipient: string;
  recipientName: string;
  message: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  customerId: ID | null;
  /** Website shopper session for anonymous wishlists. */
  ownerId: string | null;
  orderId: ID | null;
  designId: ID | null;
  status: "SIMULATED";
  createdAt: Timestamp;
}

/* ------------------------------------------------------------------ */
/* WhatsApp (simulated)                                                */
/* ------------------------------------------------------------------ */

export interface WaConversation {
  id: ID;
  customerId: ID | null;
  name: string;
  phone: string;
  lastMessageAt: Timestamp;
  lastMessagePreview: string;
  unreadCount: number;
  orderIds: ID[];
  createdAt: Timestamp;
}

export type WaMessageKind = "TEXT" | "PRODUCT" | "PAYMENT_REQUEST" | "ORDER" | "SYSTEM";

export interface WaMessage {
  id: ID;
  conversationId: ID;
  direction: "IN" | "OUT";
  kind: WaMessageKind;
  text: string;
  designId: ID | null;
  orderId: ID | null;
  amount: number | null;
  createdAt: Timestamp;
}

/* ------------------------------------------------------------------ */
/* Audit, users, settings                                              */
/* ------------------------------------------------------------------ */

export const ROLES = ["OWNER", "MANAGER", "BILLING", "PACKING"] as const;
export type Role = (typeof ROLES)[number];

export interface Actor {
  id: string;
  name: string;
  role: Role | "SYSTEM";
}

export interface DemoUser {
  id: string;
  name: string;
  role: Role;
  email: string;
}

export const AUDIT_ACTIONS = [
  "PRICE_CHANGED",
  "PRODUCT_CREATED",
  "PRODUCT_EDITED",
  "INVENTORY_ADDED",
  "INVENTORY_EDITED",
  "INVENTORY_ADJUSTED",
  "ORDER_CREATED",
  "ORDER_STATUS_CHANGED",
  "ORDER_CANCELLED",
  "PAYMENT_RECORDED",
  "RETURN_UPDATED",
  "PURCHASE_RECEIVED",
  "SETTINGS_CHANGED",
  "DEMO_RESET",
  "DATA_IMPORTED",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditLog {
  id: ID;
  action: AuditAction;
  entityType: "DESIGN" | "INVENTORY" | "ORDER" | "PURCHASE" | "RETURN" | "SETTINGS" | "SYSTEM" | "CUSTOMER";
  entityId: string;
  entityLabel: string;
  summary: string;
  before: string | null;
  after: string | null;
  actorName: string;
  actorRole: string;
  createdAt: Timestamp;
}

export interface BusinessSettings {
  name: string;
  legalName: string;
  tagline: string;
  gstin: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

export interface StoreSettings {
  cartReservationMinutes: number;
  posHoldMinutes: number;
  whatsappHoldHours: number;
  lowStockThreshold: number;
  scarcityThreshold: number;
  autoPublishNewDesigns: boolean;
  returnWindowDays: number;
  highValueThreshold: number;
  inactiveAfterDays: number;
}

export interface TaxSettings {
  gstRate: number;
  pricesIncludeTax: boolean;
  hsnCode: string;
}

export interface ShippingSettings {
  flatFee: number;
  freeAbove: number;
  couriers: string[];
  defaultCourier: string;
  defaultTransitDays: number;
}

export interface NotificationSettings {
  channel: NotificationChannel;
  enabled: Record<NotificationEvent, boolean>;
  templates: Record<NotificationEvent, string>;
}

export interface LabelSettings {
  size: "THERMAL_50x25" | "A4_3x8";
  showDesignName: boolean;
  showColour: boolean;
}

export interface AppSettings {
  business: BusinessSettings;
  store: StoreSettings;
  tax: TaxSettings;
  shipping: ShippingSettings;
  notifications: NotificationSettings;
  labels: LabelSettings;
  users: DemoUser[];
}

export type SettingsKey = keyof AppSettings;

export interface SettingsRecord<K extends SettingsKey = SettingsKey> {
  key: K;
  value: AppSettings[K];
}

export interface Counter {
  key: string;
  value: number;
}

export interface MetaRecord {
  key: string;
  value: string | number | boolean | null;
}
