import Dexie, { type Table } from "dexie";
import type {
  AuditLog,
  Category,
  Collection,
  Colour,
  Counter,
  Customer,
  Design,
  Fabric,
  InventoryDraft,
  InventoryItem,
  InventoryMovement,
  Media,
  MetaRecord,
  Notification,
  Order,
  OrderItem,
  Payment,
  Purchase,
  PurchaseItem,
  ReturnRequest,
  Review,
  SettingsRecord,
  Shipment,
  Supplier,
  WaConversation,
  WaMessage,
  WishlistEntry,
} from "@/domain/types";

export const DB_NAME = "vasra-demo";

export class VasraDatabase extends Dexie {
  designs!: Table<Design, string>;
  inventoryItems!: Table<InventoryItem, string>;
  inventoryMovements!: Table<InventoryMovement, string>;
  inventoryDrafts!: Table<InventoryDraft, string>;
  categories!: Table<Category, string>;
  collections!: Table<Collection, string>;
  colours!: Table<Colour, string>;
  fabrics!: Table<Fabric, string>;
  suppliers!: Table<Supplier, string>;
  purchases!: Table<Purchase, string>;
  purchaseItems!: Table<PurchaseItem, string>;
  customers!: Table<Customer, string>;
  orders!: Table<Order, string>;
  orderItems!: Table<OrderItem, string>;
  payments!: Table<Payment, string>;
  shipments!: Table<Shipment, string>;
  returns!: Table<ReturnRequest, string>;
  wishlists!: Table<WishlistEntry, string>;
  reviews!: Table<Review, string>;
  notifications!: Table<Notification, string>;
  auditLogs!: Table<AuditLog, string>;
  waConversations!: Table<WaConversation, string>;
  waMessages!: Table<WaMessage, string>;
  media!: Table<Media, string>;
  settings!: Table<SettingsRecord, string>;
  counters!: Table<Counter, string>;
  meta!: Table<MetaRecord, string>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      designs: "id, &code, &slug, name, categoryId, fabricId, *collectionIds, createdAt",
      inventoryItems:
        "id, &sku, designId, colourId, status, location, purchaseId, receivedAt, updatedAt, holderId, reservation.expiresAt, [designId+status]",
      inventoryMovements: "id, itemId, type, refId, createdAt",
      inventoryDrafts: "id, position",
      categories: "id, &slug",
      collections: "id, &slug",
      colours: "id, &name",
      fabrics: "id, &name",
      suppliers: "id, name",
      purchases: "id, &number, supplierId, status, date",
      purchaseItems: "id, purchaseId, designId",
      customers: "id, &phone, name, createdAt",
      orders: "id, &number, channel, status, customerId, createdAt",
      orderItems: "id, orderId, inventoryItemId, designId, createdAt",
      payments: "id, orderId, createdAt",
      shipments: "id, &orderId, awb",
      returns: "id, &number, orderId, status, createdAt",
      wishlists: "id, ownerId, designId, customerId, &[ownerId+designId]",
      reviews: "id, designId, orderId, createdAt",
      notifications: "id, orderId, customerId, createdAt",
      auditLogs: "id, action, entityId, createdAt",
      waConversations: "id, customerId, lastMessageAt",
      waMessages: "id, [conversationId+createdAt]",
      media: "id",
      settings: "key",
      counters: "key",
      meta: "key",
    });
  }
}
