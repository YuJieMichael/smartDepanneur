import { create } from 'zustand';

export interface Permission {
  id: number;
  name: string;
}

export interface Role {
  id: number;
  name: string;
  permissions: Permission[];
}

export interface User {
  id: number;
  email: string;
  roles: Role[];
  createdAt: string;
  updatedAt: string;
}

interface AppState {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),
}));
