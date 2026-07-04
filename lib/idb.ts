// ============================================================
// IndexedDB Persistence Layer for Collector
// ============================================================
// Pages / stores MUST go through this module.
// NEVER open or write to IndexedDB directly.

import { openDB, type IDBPDatabase } from 'idb';
import type { Session } from '@/types';

// -----------------------------------------------------------
// Database constants
// -----------------------------------------------------------

const DB_NAME = 'collector-db';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const SESSION_KEY = 'current-session';

// -----------------------------------------------------------
// Feature detection
// -----------------------------------------------------------

/** Check whether IndexedDB is available in this environment. */
function idbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

// -----------------------------------------------------------
// Singleton – open once, reuse across the app lifetime
// -----------------------------------------------------------

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!idbAvailable()) {
    return Promise.reject(new Error('IndexedDB is not available in this environment'));
  }

  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    }).catch((err) => {
      // Reset on failure so future retries can attempt again
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

// -----------------------------------------------------------
// Public API
// -----------------------------------------------------------

/**
 * Persist the current session to IndexedDB.
 * Overwrites any previously-saved session.
 * Silently ignores errors — auto-save failures shouldn't crash the app.
 */
export async function saveSession(session: Session): Promise<void> {
  try {
    const db = await getDB();
    await db.put(STORE_NAME, session, SESSION_KEY);
  } catch {
    // IndexedDB write failed — likely quota or private browsing.
    // The app continues working in-memory.
  }
}

/**
 * Load the most recently saved session from IndexedDB.
 * Returns `null` when no session exists or when storage is unavailable.
 */
export async function loadSession(): Promise<Session | null> {
  try {
    const db = await getDB();
    const session = await db.get(STORE_NAME, SESSION_KEY);
    return session ?? null;
  } catch {
    // IndexedDB unavailable — return null so the app starts fresh.
    return null;
  }
}

/**
 * Remove the persisted session from IndexedDB.
 */
export async function clearSession(): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(STORE_NAME, SESSION_KEY);
  } catch {
    // Best-effort cleanup.
  }
}
