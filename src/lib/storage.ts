const NAME_KEY = 'collabspace:displayName';

export function getDisplayName(): string | null {
  try {
    return localStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

export function setDisplayName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // localStorage unavailable (private browsing, quota)
  }
}
