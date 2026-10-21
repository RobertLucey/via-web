export const FRESH_AGE = 5 * 60 * 1000;
export const MAX_AGE = 24 * 60 * 60 * 1000;

function defaultStorage() {
  try {
    return window.indexedDB;
  } catch (error) {
    return null;
  }
}
export function createRoadCache(storage = defaultStorage(), now = Date.now) {
  const memory = new Map();
  let connection;
  function open() {
    if (!storage) return Promise.resolve(null);
    if (!connection)
      connection = new Promise((resolve) => {
        try {
          const request = storage.open("via-road-cache", 1);
          request.onupgradeneeded = () =>
            request.result.createObjectStore("snapshots");
          request.onsuccess = () => resolve(request.result);
          request.onerror = request.onblocked = () => resolve(null);
        } catch (error) {
          resolve(null);
        }
      });
    return connection;
  }
  async function transaction(mode, operation) {
    try {
      const db = await open();
      if (!db) return null;
      return await new Promise((resolve) => {
        const tx = db.transaction("snapshots", mode);
        const request = operation(tx.objectStore("snapshots"));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = tx.onabort = () => resolve(null);
      });
    } catch (error) {
      return null;
    }
  }
  return {
    async read(key) {
      const record =
        memory.get(key) ||
        (await transaction("readonly", (store) => store.get(key)));
      if (
        !record ||
        typeof record.text !== "string" ||
        !Number.isFinite(record.savedAt)
      )
        return null;
      const age = now() - record.savedAt;
      if (age < 0 || age > MAX_AGE) return null;
      memory.set(key, record);
      return { ...record, fresh: age <= FRESH_AGE };
    },
    async write(key, text) {
      const record = { text, savedAt: now() };
      memory.set(key, record);
      await transaction("readwrite", (store) => store.put(record, key));
    },
    async remove(key) {
      memory.delete(key);
      await transaction("readwrite", (store) => store.delete(key));
    },
  };
}

export const roadCache = createRoadCache();
