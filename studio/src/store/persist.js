// @ts-check

import IndexedDB from '../services/offline/IndexedDB';

const STORE_NAME = 'workspaces';

/**
 * Persist store slice to IndexedDB
 * @param {import('@types').Store} store
 * @param {import('@types').PersistOptions} options
 * @returns {function} Unsubscribe function
 */
export function persist(store, options) {
  const { key, fields = null, debounce = 300 } = options;
  let timeout = null;

  const saveToIndexedDB = async state => {
    try {
      const dataToSave = fields
        ? fields.reduce((acc, field) => ({ ...acc, [field]: state[field] }), {})
        : state;

      const instance = IndexedDB.getInstance();
      await instance.put(STORE_NAME, { uuid: key, data: dataToSave });
    } catch (error) {
      console.error(`[Persist] Failed to save ${key}:`, error);
    }
  };

  const debouncedSave = state => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      saveToIndexedDB(state);
      timeout = null;
    }, debounce);
  };

  const unsubscribe = store.subscribe(debouncedSave);

  return () => {
    clearTimeout(timeout);
    unsubscribe();
  };
}

/**
 * Rehydrate store from IndexedDB
 * @param {import('@/types').Store} store
 * @param {string} key
 * @returns {Promise<boolean>}
 */
export async function rehydrate(store, key) {
  try {
    const instance = IndexedDB.getInstance();
    const record = await instance.get(STORE_NAME, key);

    if (record && record.data) {
      store.setState(record.data);

      return true;
    }

    return false;
  } catch (error) {
    console.error(`[Persist] Failed to rehydrate ${key}:`, error);

    return false;
  }
}

/**
 * Clear persisted data from IndexedDB
 * @param {string} key
 * @returns {Promise<void>}
 */
export async function clearPersisted(key) {
  try {
    const instance = IndexedDB.getInstance();
    await instance.delete(STORE_NAME, key);
  } catch (error) {
    console.error(`[Persist] Failed to clear ${key}:`, error);
  }
}
