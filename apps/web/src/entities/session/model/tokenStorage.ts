const TOKEN_STORAGE_KEY = 'f95-tinder.token';
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

export function getToken(): string | null {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  notifyListeners();
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  notifyListeners();
}

export function subscribeToToken(listener: () => void): () => void {
  listeners.add(listener);

  const handleStorage = (event: StorageEvent) => {
    if (event.key === TOKEN_STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener('storage', handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', handleStorage);
  };
}
