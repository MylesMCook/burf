// Small localStorage helpers. Storage can be missing or throw (private
// windows, cleared site data), and the app must work without it.

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Remembering is a convenience; losing it is fine.
  }
}


export class StorageWriteError extends Error {
  constructor() {
    super("Burf could not save the chat draft. Free space or allow local storage, then try again. Keep this window open to preserve your text.");
    this.name = "StorageWriteError";
  }
}

// A request must not leave the app until its recovery journal is saved.
export function saveChecked(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { throw new StorageWriteError(); }
}
