/**
 * Data store registry. This is the single place that decides where data lives.
 * Swap `createDexieDataStore` for an API-backed DataStore to move to a server.
 */
import type { DataStore, Repositories } from "./repositories";
import { createDexieDataStore } from "./dexie/store";

let store: DataStore | null = null;

export function dataStore(): DataStore {
  if (typeof window === "undefined") {
    throw new Error("The demo data store runs in the browser only");
  }
  store ??= createDexieDataStore();
  return store;
}

export function repos(): Repositories {
  return dataStore().repos;
}

export function transaction<T>(work: () => Promise<T>): Promise<T> {
  return dataStore().transaction(work);
}

export type { DataStore, Repositories } from "./repositories";
