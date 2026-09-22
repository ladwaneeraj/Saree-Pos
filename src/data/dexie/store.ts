import { liveQuery } from "dexie";
import type { DataStore, Subscribable, TableSnapshot } from "../repositories";
import { ShopDatabase } from "./db";
import { createDexieRepositories } from "./repositories";

export function createDexieDataStore(): DataStore {
  const db = new ShopDatabase();
  const repos = createDexieRepositories(db);

  return {
    repos,

    transaction(work) {
      return db.transaction("rw", db.tables, work);
    },

    observe<T>(query: () => Promise<T>): Subscribable<T> {
      const observable = liveQuery(query);
      return {
        subscribe(observer) {
          const sub = observable.subscribe({ next: observer.next, error: observer.error });
          return { unsubscribe: () => sub.unsubscribe() };
        },
      };
    },

    async clear() {
      await db.transaction("rw", db.tables, async () => {
        await Promise.all(db.tables.map((t) => t.clear()));
      });
    },

    async exportSnapshot() {
      const snapshot: TableSnapshot = {};
      await db.transaction("r", db.tables, async () => {
        for (const table of db.tables) snapshot[table.name] = await table.toArray();
      });
      return snapshot;
    },

    async importSnapshot(snapshot) {
      const known = new Set(db.tables.map((t) => t.name));
      const unknown = Object.keys(snapshot).filter((name) => !known.has(name));
      if (unknown.length) throw new Error(`Unknown tables in file: ${unknown.join(", ")}`);
      await db.transaction("rw", db.tables, async () => {
        for (const table of db.tables) {
          await table.clear();
          const rows = snapshot[table.name];
          if (Array.isArray(rows) && rows.length) await table.bulkAdd(rows as never[]);
        }
      });
    },
  };
}
