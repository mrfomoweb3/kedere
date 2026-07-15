// Lightweight per-wallet registration memory (localStorage). The chain is the
// source of truth for membership; this just lets a returning wallet skip the
// onboarding and stores the resident's display name (which isn't onchain).
export type Role = "chairman" | "resident";

export interface Profile {
  role: Role;
  estateId: string;
  name?: string;
  unit?: string;
}

const key = (addr: string) => `kedere:profile:${addr.toLowerCase()}`;

export function getProfile(address?: string): Profile | null {
  if (!address) return null;
  try {
    const raw = localStorage.getItem(key(address));
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

export function saveProfile(address: string, p: Profile) {
  try {
    localStorage.setItem(key(address), JSON.stringify(p));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export function clearProfile(address: string) {
  try {
    localStorage.removeItem(key(address));
  } catch {
    /* ignore */
  }
}
