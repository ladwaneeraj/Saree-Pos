# Dhanvi Silks · Saree Commerce & Inventory (work in progress)

Frontend-only demo (Next.js 16, TypeScript, Tailwind, shadcn/ui, Zustand, Dexie/IndexedDB).

## Status
Done: domain model and business rules, Dexie schema and repositories, application services, demo seed generator.
Done: admin shell (sidebar, role switcher, global search `/`, shortcuts, demo badge, customer message outbox), Inventory list page, real Unsplash photos in the seed (needs internet).
Not started: remaining screens (dashboard, POS, orders, WhatsApp, dispatch, returns, designs, purchases, customers, reports, settings, labels, store, tracking), end-to-end tests.

Run: `npm install` then `npm run dev`, open http://localhost:3000/inventory. First launch seeds ~10,800 sarees into IndexedDB (a few seconds).

## Layers
UI → hooks (`src/hooks`) → services (`src/services`) → repository interfaces (`src/data/repositories.ts`) → Dexie (`src/data/dexie`) → IndexedDB.
Swap `createDexieDataStore` in `src/data/index.ts` for an API-backed store to move to a backend.
