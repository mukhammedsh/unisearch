function storageApi(kind = "local") {
  if (typeof window === "undefined") return null;
  return kind === "session" ? window.sessionStorage : window.localStorage;
}

function read(store, key, fallback = "") {
  try {
    const api = storageApi(store);
    if (!api) return fallback;
    const value = api.getItem(key);
    return value === null ? fallback : value;
  } catch (error) {
    return fallback;
  }
}

function write(store, key, value) {
  try {
    const api = storageApi(store);
    if (!api) return false;
    api.setItem(key, value);
    return true;
  } catch (error) {
    return false;
  }
}

function drop(store, key) {
  try {
    storageApi(store)?.removeItem(key);
    return true;
  } catch (error) {
    return false;
  }
}

function readJson(store, key, fallback = null) {
  const raw = read(store, key, "");
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function writeJson(store, key, value) {
  try {
    return write(store, key, JSON.stringify(value));
  } catch (error) {
    return false;
  }
}

function createSafeStorage(store = "local") {
  return {
    get: (key, fallback = "") => read(store, key, fallback),
    set: (key, value) => write(store, key, String(value)),
    remove: (key) => drop(store, key),
    getJson: (key, fallback = null) => readJson(store, key, fallback),
    setJson: (key, value) => writeJson(store, key, value),
  };
}

export const safeLocalStorage = createSafeStorage("local");
export const safeSessionStorage = createSafeStorage("session");
export { createSafeStorage };
