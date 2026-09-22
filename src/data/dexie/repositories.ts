import Dexie, { type Table, type UpdateSpec } from "dexie";
import type {
  AppSettings,
  AuditLog,
  Customer,
  Design,
  InventoryDraft,
  InventoryItem,
  InventoryMovement,
  InventoryStatus,
  Notification,
  Order,
  OrderItem,
  OrderStatus,
  Payment,
  Purchase,
  PurchaseItem,
  ReturnRequest,
  ReturnStatus,
  Review,
  SettingsKey,
  Shipment,
  WaConversation,
  WaMessage,
  WishlistEntry,
} from "@/domain/types";
import type {
  AuditRepository,
  CounterRepository,
  CustomerRepository,
  DesignRepository,
  DraftRepository,
  InventoryRepository,
  MetaRepository,
  MovementRepository,
  NotificationRepository,
  OrderItemRepository,
  OrderRepository,
  PaymentRepository,
  PurchaseItemRepository,
  PurchaseRepository,
  Repositories,
  Repository,
  ReturnRepository,
  ReviewRepository,
  SettingsRepository,
  ShipmentRepository,
  WaConversationRepository,
  WaMessageRepository,
  WishlistRepository,
} from "../repositories";
import type { VasraDatabase } from "./db";

class DexieRepository<T extends { id: string }> implements Repository<T> {
  constructor(protected readonly table: Table<T, string>) {}

  get(id: string) {
    return this.table.get(id);
  }

  async getMany(ids: readonly string[]) {
    if (ids.length === 0) return [];
    const rows = await this.table.bulkGet([...ids]);
    return rows.filter((row): row is T => row !== undefined);
  }

  list() {
    return this.table.toArray();
  }

  count() {
    return this.table.count();
  }

  async add(entity: T) {
    await this.table.add(entity);
  }

  async bulkAdd(entities: readonly T[]) {
    if (entities.length) await this.table.bulkAdd([...entities]);
  }

  async put(entity: T) {
    await this.table.put(entity);
  }

  async bulkPut(entities: readonly T[]) {
    if (entities.length) await this.table.bulkPut([...entities]);
  }

  async update(id: string, changes: Partial<T>) {
    await this.table.update(id, changes as UpdateSpec<T>);
  }

  async remove(id: string) {
    await this.table.delete(id);
  }

  async bulkRemove(ids: readonly string[]) {
    if (ids.length) await this.table.bulkDelete([...ids]);
  }
}

const byCreatedDesc = <T extends { createdAt: number }>(rows: T[]) => rows.sort((a, b) => b.createdAt - a.createdAt);

class DexieDesignRepository extends DexieRepository<Design> implements DesignRepository {
  findBySlug(slug: string) {
    return this.table.where("slug").equals(slug).first();
  }
  findByName(name: string) {
    return this.table.where("name").equalsIgnoreCase(name.trim()).first();
  }
  listPublished() {
    return this.table.filter((d) => d.isPublished).toArray();
  }
}

class DexieInventoryRepository extends DexieRepository<InventoryItem> implements InventoryRepository {
  findBySku(sku: string) {
    return this.table.where("sku").equals(sku.trim().toUpperCase()).first();
  }
  listByDesign(designId: string) {
    return this.table.where("designId").equals(designId).toArray();
  }
  listByDesignAndStatus(designId: string, status: InventoryStatus) {
    return this.table.where("[designId+status]").equals([designId, status]).toArray();
  }
  listByStatus(status: InventoryStatus) {
    return this.table.where("status").equals(status).toArray();
  }
  countByStatus(status: InventoryStatus) {
    return this.table.where("status").equals(status).count();
  }
  listByHolder(holderId: string) {
    return this.table.where("holderId").equals(holderId).toArray();
  }
  listByPurchase(purchaseId: string) {
    return this.table.where("purchaseId").equals(purchaseId).toArray();
  }
  listExpiredReservations(now: number) {
    return this.table
      .where("reservation.expiresAt")
      .belowOrEqual(now)
      .filter((i) => i.status === "RESERVED")
      .toArray();
  }
}

class DexieMovementRepository extends DexieRepository<InventoryMovement> implements MovementRepository {
  async listByItem(itemId: string) {
    return byCreatedDesc(await this.table.where("itemId").equals(itemId).toArray());
  }
  listRecent(limit: number) {
    return this.table.orderBy("createdAt").reverse().limit(limit).toArray();
  }
}

class DexieDraftRepository extends DexieRepository<InventoryDraft> implements DraftRepository {
  listOrdered() {
    return this.table.orderBy("position").toArray();
  }
}

class DexieOrderRepository extends DexieRepository<Order> implements OrderRepository {
  findByNumber(number: number) {
    return this.table.where("number").equals(number).first();
  }
  async listByCustomer(customerId: string) {
    return byCreatedDesc(await this.table.where("customerId").equals(customerId).toArray());
  }
  listByStatuses(statuses: readonly OrderStatus[]) {
    return this.table.where("status").anyOf([...statuses]).toArray();
  }
  listSince(since: number) {
    return this.table.where("createdAt").aboveOrEqual(since).toArray();
  }
  listRecent(limit: number) {
    return this.table.orderBy("createdAt").reverse().limit(limit).toArray();
  }
}

class DexieOrderItemRepository extends DexieRepository<OrderItem> implements OrderItemRepository {
  listByOrder(orderId: string) {
    return this.table.where("orderId").equals(orderId).toArray();
  }
  listByOrders(orderIds: readonly string[]) {
    if (orderIds.length === 0) return Promise.resolve([]);
    return this.table.where("orderId").anyOf([...orderIds]).toArray();
  }
  async listByInventoryItem(itemId: string) {
    return byCreatedDesc(await this.table.where("inventoryItemId").equals(itemId).toArray());
  }
  listSince(since: number) {
    return this.table.where("createdAt").aboveOrEqual(since).toArray();
  }
}

class DexiePaymentRepository extends DexieRepository<Payment> implements PaymentRepository {
  listByOrder(orderId: string) {
    return this.table.where("orderId").equals(orderId).sortBy("createdAt");
  }
  listSince(since: number) {
    return this.table.where("createdAt").aboveOrEqual(since).toArray();
  }
}

class DexieShipmentRepository extends DexieRepository<Shipment> implements ShipmentRepository {
  findByOrder(orderId: string) {
    return this.table.where("orderId").equals(orderId).first();
  }
  listByOrders(orderIds: readonly string[]) {
    if (orderIds.length === 0) return Promise.resolve([]);
    return this.table.where("orderId").anyOf([...orderIds]).toArray();
  }
}

class DexieCustomerRepository extends DexieRepository<Customer> implements CustomerRepository {
  findByPhone(phone: string) {
    return this.table.where("phone").equals(phone).first();
  }
}

class DexiePurchaseRepository extends DexieRepository<Purchase> implements PurchaseRepository {
  findByNumber(number: string) {
    return this.table.where("number").equals(number).first();
  }
}

class DexiePurchaseItemRepository extends DexieRepository<PurchaseItem> implements PurchaseItemRepository {
  listByPurchase(purchaseId: string) {
    return this.table.where("purchaseId").equals(purchaseId).sortBy("createdAt");
  }
}

class DexieReturnRepository extends DexieRepository<ReturnRequest> implements ReturnRepository {
  listByOrder(orderId: string) {
    return this.table.where("orderId").equals(orderId).toArray();
  }
  listByStatuses(statuses: readonly ReturnStatus[]) {
    return this.table.where("status").anyOf([...statuses]).toArray();
  }
}

class DexieWishlistRepository extends DexieRepository<WishlistEntry> implements WishlistRepository {
  async listByOwner(ownerId: string) {
    return byCreatedDesc(await this.table.where("ownerId").equals(ownerId).toArray());
  }
  listByDesign(designId: string) {
    return this.table.where("designId").equals(designId).toArray();
  }
  listByCustomer(customerId: string) {
    return this.table.where("customerId").equals(customerId).toArray();
  }
  find(ownerId: string, designId: string) {
    return this.table.where("[ownerId+designId]").equals([ownerId, designId]).first();
  }
}

class DexieReviewRepository extends DexieRepository<Review> implements ReviewRepository {
  async listByDesign(designId: string) {
    return byCreatedDesc(await this.table.where("designId").equals(designId).toArray());
  }
  listRecent(limit: number) {
    return this.table.orderBy("createdAt").reverse().limit(limit).toArray();
  }
  findByOrder(orderId: string) {
    return this.table.where("orderId").equals(orderId).toArray();
  }
}

class DexieNotificationRepository extends DexieRepository<Notification> implements NotificationRepository {
  async listByOrder(orderId: string) {
    return byCreatedDesc(await this.table.where("orderId").equals(orderId).toArray());
  }
  async listByCustomer(customerId: string) {
    return byCreatedDesc(await this.table.where("customerId").equals(customerId).toArray());
  }
  listRecent(limit: number) {
    return this.table.orderBy("createdAt").reverse().limit(limit).toArray();
  }
}

class DexieAuditRepository extends DexieRepository<AuditLog> implements AuditRepository {
  listRecent(limit: number) {
    return this.table.orderBy("createdAt").reverse().limit(limit).toArray();
  }
  async listByEntity(entityId: string) {
    return byCreatedDesc(await this.table.where("entityId").equals(entityId).toArray());
  }
}

class DexieConversationRepository extends DexieRepository<WaConversation> implements WaConversationRepository {
  listRecent() {
    return this.table.orderBy("lastMessageAt").reverse().toArray();
  }
}

class DexieMessageRepository extends DexieRepository<WaMessage> implements WaMessageRepository {
  listByConversation(conversationId: string) {
    return this.table
      .where("[conversationId+createdAt]")
      .between([conversationId, Dexie.minKey], [conversationId, Dexie.maxKey])
      .toArray();
  }
}

class DexieSettingsRepository implements SettingsRepository {
  constructor(private readonly db: VasraDatabase) {}
  async get<K extends SettingsKey>(key: K) {
    const row = await this.db.settings.get(key);
    return row?.value as AppSettings[K] | undefined;
  }
  async set<K extends SettingsKey>(key: K, value: AppSettings[K]) {
    await this.db.settings.put({ key, value });
  }
}

class DexieCounterRepository implements CounterRepository {
  constructor(private readonly db: VasraDatabase) {}
  async next(key: string, count = 1) {
    const current = (await this.db.counters.get(key))?.value ?? 1;
    await this.db.counters.put({ key, value: current + count });
    return current;
  }
  async peek(key: string) {
    return (await this.db.counters.get(key))?.value ?? 1;
  }
  async set(key: string, value: number) {
    await this.db.counters.put({ key, value });
  }
}

class DexieMetaRepository implements MetaRepository {
  constructor(private readonly db: VasraDatabase) {}
  async get<T extends string | number | boolean | null>(key: string) {
    return (await this.db.meta.get(key))?.value as T | undefined;
  }
  async set(key: string, value: string | number | boolean | null) {
    await this.db.meta.put({ key, value });
  }
}

export function createDexieRepositories(db: VasraDatabase): Repositories {
  return {
    designs: new DexieDesignRepository(db.designs),
    inventory: new DexieInventoryRepository(db.inventoryItems),
    movements: new DexieMovementRepository(db.inventoryMovements),
    drafts: new DexieDraftRepository(db.inventoryDrafts),
    categories: new DexieRepository(db.categories),
    collections: new DexieRepository(db.collections),
    colours: new DexieRepository(db.colours),
    fabrics: new DexieRepository(db.fabrics),
    suppliers: new DexieRepository(db.suppliers),
    purchases: new DexiePurchaseRepository(db.purchases),
    purchaseItems: new DexiePurchaseItemRepository(db.purchaseItems),
    customers: new DexieCustomerRepository(db.customers),
    orders: new DexieOrderRepository(db.orders),
    orderItems: new DexieOrderItemRepository(db.orderItems),
    payments: new DexiePaymentRepository(db.payments),
    shipments: new DexieShipmentRepository(db.shipments),
    returns: new DexieReturnRepository(db.returns),
    wishlists: new DexieWishlistRepository(db.wishlists),
    reviews: new DexieReviewRepository(db.reviews),
    notifications: new DexieNotificationRepository(db.notifications),
    audit: new DexieAuditRepository(db.auditLogs),
    conversations: new DexieConversationRepository(db.waConversations),
    messages: new DexieMessageRepository(db.waMessages),
    media: new DexieRepository(db.media),
    settings: new DexieSettingsRepository(db),
    counters: new DexieCounterRepository(db),
    meta: new DexieMetaRepository(db),
  };
}
