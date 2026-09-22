# VASRA · Saree Commerce & Inventory (work in progress)

Frontend-only demo (Next.js 16, TypeScript, Tailwind, shadcn/ui, Zustand, Dexie/IndexedDB).

## Status
Done: domain model and business rules, Dexie schema and repositories, application services, demo seed generator.
In progress: switching seed images to Unsplash photos (`src/services/demo/seed.ts` still imports the removed `saree-art.ts`, so the build currently fails).
Not started: admin and store UI, end-to-end tests.

## Layers
UI → hooks (`src/hooks`) → services (`src/services`) → repository interfaces (`src/data/repositories.ts`) → Dexie (`src/data/dexie`) → IndexedDB.
Swap `createDexieDataStore` in `src/data/index.ts` for an API-backed store to move to a backend.
