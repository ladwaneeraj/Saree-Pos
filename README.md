# Dhanvi Silks · Saree Commerce & Inventory

Frontend-only SaaS demo for a saree shop. Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui, Zustand, Dexie (IndexedDB), React Hook Form, Zod, Recharts.

## Run
```
npm install
npm run dev        # http://localhost:3000
```
First launch seeds ~10,600 sarees, 1,800+ orders, customers, suppliers and WhatsApp chats into IndexedDB (a few seconds). Settings > Demo data resets it relative to today.

Seeded product photos load from Unsplash (free licence), so the demo machine needs internet. Photos staff upload are stored locally.

## Where things are
- Admin: /dashboard, /inventory (quick add, bulk photo entry, labels), /designs, /purchases (+ Excel/CSV import), /pos, /orders, /whatsapp, /dispatch, /returns, /customers, /reports, /activity, /settings
- Customer store: /store, tracking: /track/<orderId>
- Switch demo user/role from the bottom of the sidebar. Shortcuts: / search, N new order, P POS, I inventory.

## Architecture
UI → hooks (`src/hooks`) → services (`src/services`) → repository interfaces (`src/data/repositories.ts`) → Dexie (`src/data/dexie`) → IndexedDB.
Swap `createDexieDataStore` in `src/data/index.ts` for an API-backed store to move to a backend without touching the UI.

## Notes
- GST defaults to 5% inclusive (Settings > Tax). Confirm rates with your CA.
- Barcodes encode the SKU only. Price changes never need label reprints, and past orders keep the price they were sold at.
