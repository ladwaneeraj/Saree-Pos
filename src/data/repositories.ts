/**
 * Repository contracts. Services depend only on these interfaces.
 *
 * The demo ships Dexie (IndexedDB) implementations. A REST backend can be introduced by
 * implementing the same interfaces (ApiDesignRepository, ApiInventoryRepository, ...) and
 * returning them from a different DataStore in `src/data/index.ts`. No UI code changes.
 */
import type {
  AppSettings,
  AuditLog,
  Category,
  Collection,
  Colour,
  Customer,
  Design,
  Fabric,
  InventoryDraft,
  InventoryItem,
  InventoryMovement,
  InventoryStatus,
  InvoiceFile,
  Media,
  Notification,
  Order,
  OrderItem,
  OrderStatus,
  Payment,
  Purchase,
  PurchaseItem,
  PurchasePayment,
  ReturnRequest,
  ReturnStatus,
  Review,
  SettingsKey,
  Shipment,
  Supplier,
  WaConversation,
  WaMessage,
  WishlistEntry,
} from "@/domain/types";

export interface Repository<T extends { id: string }> {
  get(id: string): Promise<T | undefined>;
  /** Returns the entities that exist, in the order of the ids given. */
  getMany(ids: readonly string[]): Promise<T[]>;
  list(): Promise<T[]>;
  count(): Promise<number>;
  add(entity: T): Promise<void>;
  bulkAdd(entities: readonly T[]): Promise<void>;
  put(entity: T): Promise<void>;
  bulkPut(entities: readonly T[]): Promise<void>;
  update(id: string, changes: Partial<T>): Promise<void>;
  remove(id: string): Promise<void>;
  bulkRemove(ids: readonly string[]): Promise<void>;
}

export interface DesignRepository extends Repository<Design> {
  findBySlug(slug: string): Promise<Design | undefined>;
  findByName(name: string): Promise<Design | undefined>;
  listPublished(): Promise<Design[]>;
}

export interface InventoryRepository extends Repository<InventoryItem> {
  findBySku(sku: string): Promise<InventoryItem | undefined>;
  listByDesign(designId: string): Promise<InventoryItem[]>;
  listByDesignAndStatus(designId: string, status: InventoryStatus): Promise<InventoryItem[]>;
  listByStatus(status: InventoryStatus): Promise<InventoryItem[]>;
  countByStatus(status: InventoryStatus): Promise<number>;
  listByHolder(holderId: string): Promise<InventoryItem[]>;
  listByPurchase(purchaseId: string): Promise<InventoryItem[]>;
  /** Reserved pieces whose reservation expired at or before `now`. */
  listExpiredReservations(now: number): Promise<InventoryItem[]>;
}

export interface MovementRepository extends Repository<InventoryMovement> {
  listByItem(itemId: string): Promise<InventoryMovement[]>;
  listRecent(limit: number): Promise<InventoryMovement[]>;
}

export interface DraftRepository extends Repository<InventoryDraft> {
  listOrdered(): Promise<InventoryDraft[]>;
}

export interface OrderRepository extends Repository<Order> {
  findByNumber(number: number): Promise<Order | undefined>;
  listByCustomer(customerId: string): Promise<Order[]>;
  listByStatuses(statuses: readonly OrderStatus[]): Promise<Order[]>;
  listSince(since: number): Promise<Order[]>;
  listRecent(limit: number): Promise<Order[]>;
}

export interface OrderItemRepository extends Repository<OrderItem> {
  listByOrder(orderId: string): Promise<OrderItem[]>;
  listByOrders(orderIds: readonly string[]): Promise<OrderItem[]>;
  listByInventoryItem(itemId: string): Promise<OrderItem[]>;
  listSince(since: number): Promise<OrderItem[]>;
}

export interface PaymentRepository extends Repository<Payment> {
  listByOrder(orderId: string): Promise<Payment[]>;
  listSince(since: number): Promise<Payment[]>;
}

export interface ShipmentRepository extends Repository<Shipment> {
  findByOrder(orderId: string): Promise<Shipment | undefined>;
  listByOrders(orderIds: readonly string[]): Promise<Shipment[]>;
}

export interface CustomerRepository extends Repository<Customer> {
  findByPhone(phone: string): Promise<Customer | undefined>;
}

export interface PurchaseRepository extends Repository<Purchase> {
  findByNumber(number: string): Promise<Purchase | undefined>;
}

export interface PurchaseItemRepository extends Repository<PurchaseItem> {
  listByPurchase(purchaseId: string): Promise<PurchaseItem[]>;
}

export interface PurchasePaymentRepository extends Repository<PurchasePayment> {
  listByPurchase(purchaseId: string): Promise<PurchasePayment[]>;
}

export interface InvoiceRepository extends Repository<InvoiceFile> {
  listByOrder(orderId: string): Promise<InvoiceFile[]>;
}

export interface ReturnRepository extends Repository<ReturnRequest> {
  listByOrder(orderId: string): Promise<ReturnRequest[]>;
  listByStatuses(statuses: readonly ReturnStatus[]): Promise<ReturnRequest[]>;
}

export interface WishlistRepository extends Repository<WishlistEntry> {
  listByOwner(ownerId: string): Promise<WishlistEntry[]>;
  listByDesign(designId: string): Promise<WishlistEntry[]>;
  listByCustomer(customerId: string): Promise<WishlistEntry[]>;
  find(ownerId: string, designId: string): Promise<WishlistEntry | undefined>;
}

export interface ReviewRepository extends Repository<Review> {
  listByDesign(designId: string): Promise<Review[]>;
  listRecent(limit: number): Promise<Review[]>;
  findByOrder(orderId: string): Promise<Review[]>;
}

export interface NotificationRepository extends Repository<Notification> {
  listByOrder(orderId: string): Promise<Notification[]>;
  listByCustomer(customerId: string): Promise<Notification[]>;
  listRecent(limit: number): Promise<Notification[]>;
}

export interface AuditRepository extends Repository<AuditLog> {
  listRecent(limit: number): Promise<AuditLog[]>;
  listByEntity(entityId: string): Promise<AuditLog[]>;
}

export interface WaConversationRepository extends Repository<WaConversation> {
  listRecent(): Promise<WaConversation[]>;
}

export interface WaMessageRepository extends Repository<WaMessage> {
  listByConversation(conversationId: string): Promise<WaMessage[]>;
}

export interface SettingsRepository {
  get<K extends SettingsKey>(key: K): Promise<AppSettings[K] | undefined>;
  set<K extends SettingsKey>(key: K, value: AppSettings[K]): Promise<void>;
}

export interface CounterRepository {
  /** Reserves `count` consecutive numbers and returns the first. Must run inside a transaction. */
  next(key: string, count?: number): Promise<number>;
  /** The number `next` would return, without reserving it. */
  peek(key: string): Promise<number>;
  set(key: string, value: number): Promise<void>;
}

export interface MetaRepository {
  get<T extends string | number | boolean | null>(key: string): Promise<T | undefined>;
  set(key: string, value: string | number | boolean | null): Promise<void>;
}

export interface Repositories {
  designs: DesignRepository;
  inventory: InventoryRepository;
  movements: MovementRepository;
  drafts: DraftRepository;
  categories: Repository<Category>;
  collections: Repository<Collection>;
  colours: Repository<Colour>;
  fabrics: Repository<Fabric>;
  suppliers: Repository<Supplier>;
  purchases: PurchaseRepository;
  purchaseItems: PurchaseItemRepository;
  purchasePayments: PurchasePaymentRepository;
  invoices: InvoiceRepository;
  customers: CustomerRepository;
  orders: OrderRepository;
  orderItems: OrderItemRepository;
  payments: PaymentRepository;
  shipments: ShipmentRepository;
  returns: ReturnRepository;
  wishlists: WishlistRepository;
  reviews: ReviewRepository;
  notifications: NotificationRepository;
  audit: AuditRepository;
  conversations: WaConversationRepository;
  messages: WaMessageRepository;
  media: Repository<Media>;
  settings: SettingsRepository;
  counters: CounterRepository;
  meta: MetaRepository;
}

export interface Subscription {
  unsubscribe(): void;
}

export interface Subscribable<T> {
  subscribe(observer: { next: (value: T) => void; error?: (error: unknown) => void }): Subscription;
}

export type TableSnapshot = Record<string, unknown[]>;

export interface DataStore {
  readonly repos: Repositories;
  /** Runs `work` atomically. Nested calls join the outer unit of work. */
  transaction<T>(work: () => Promise<T>): Promise<T>;
  /** Emits the query result now and again whenever data it read changes (in any tab). */
  observe<T>(query: () => Promise<T>): Subscribable<T>;
  /** Deletes all data. */
  clear(): Promise<void>;
  exportSnapshot(): Promise<TableSnapshot>;
  importSnapshot(snapshot: TableSnapshot): Promise<void>;
}
