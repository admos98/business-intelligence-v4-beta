import { User } from '../../shared/types';

/**
 * Authentication configuration
 *
 * For production, consider moving user data to environment variables or a secure backend.
 * You can set these via environment variables:
 * - VITE_DEFAULT_USERNAME
 * - VITE_DEFAULT_PASSWORD_HASH
 * - VITE_DEFAULT_SALT
 */
const getDefaultUsers = (): User[] => {
    // Check for environment variables first (for build-time configuration)
    const username = import.meta.env.VITE_DEFAULT_USERNAME || 'mehrnoosh';
    const passwordHash = import.meta.env.VITE_DEFAULT_PASSWORD_HASH || '02dc4c8ba1c2c109611b8f08baad4b9cf5f268d1c4aee6d21fd97be4ec1b1385';
    const salt = import.meta.env.VITE_DEFAULT_SALT || '3bb5f7b9d6a64e5ab74c2f6d4c8a02e2';

    return [{
        id: 'user-1',
        username,
        passwordHash,
        salt
    }];
};

export const defaultUsers = getDefaultUsers();
