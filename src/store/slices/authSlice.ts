// src/store/slices/authSlice.ts
// Authentication domain slice

import { StateCreator } from 'zustand';
import { User, AuthSlice } from '../../../shared/types';
import { defaultUsers } from '../../config/auth';
import { logger } from '../../utils/logger';

const hashPassword = async (password: string, salt: string): Promise<string> => {
    if (!(globalThis.crypto && typeof globalThis.crypto.subtle !== 'undefined')) {
        throw new Error("Secure login is unavailable in this environment.");
    }
    const data = new TextEncoder().encode(`${salt}:${password}`);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
};

export interface AuthSliceState extends AuthSlice {
    // Additional state if needed
}

export const createAuthSlice: StateCreator<
    AuthSliceState,
    [],
    [],
    AuthSliceState
> = (set, get) => ({
    users: defaultUsers,
    currentUser: null,

    login: async (username, password) => {
        const user = get().users.find((u: User) => u.username.toLowerCase() === username.toLowerCase());
        if (!user) {
            return false;
        }

        try {
            if (!user.salt || !user.passwordHash) {
                return false;
            }
            const hashedInput = await hashPassword(password, user.salt);
            if (hashedInput === user.passwordHash) {
                set({ currentUser: user });
                return true;
            }
        } catch (error) {
            logger.error("Login failed due to hashing error:", error);
        }

        return false;
    },

    logout: () => {
        set({ currentUser: null });
    },

    addUser: (userData: Omit<User, 'id'>) => {
        const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const salt = crypto.getRandomValues(new Uint8Array(16)).reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
        const passwordHash = userData.passwordHash || '';

        const newUser: User = {
            id: userId,
            username: userData.username,
            role: userData.role || 'cashier',
            passwordHash,
            salt,
        };

        set((state) => ({ users: [...state.users, newUser] }));
        return userId;
    },

    updateUser: (userId: string, updates: Partial<User>) => {
        set((state) => ({
            users: state.users.map((user) =>
                user.id === userId ? { ...user, ...updates } : user
            ),
        }));
    },

    deleteUser: (userId: string) => {
        const currentUser = get().currentUser;
        if (currentUser?.id === userId) {
            throw new Error('Cannot delete the currently logged-in user');
        }
        set((state) => ({
            users: state.users.filter((user) => user.id !== userId),
        }));
    },
});
