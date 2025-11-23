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
    const isDevelopment = import.meta.env.DEV;
    const username = import.meta.env.VITE_DEFAULT_USERNAME;
    const passwordHash = import.meta.env.VITE_DEFAULT_PASSWORD_HASH;
    const salt = import.meta.env.VITE_DEFAULT_SALT;

    // In development, provide fallback defaults if env vars are missing
    if (isDevelopment && (!username || !passwordHash || !salt)) {
        // Development fallback - DO NOT USE IN PRODUCTION
        // These are insecure defaults for local development only
        return [{
            id: 'user-1',
            username: username || 'admin',
            passwordHash: passwordHash || 'dev-hash-placeholder',
            salt: salt || 'dev-salt-placeholder',
            role: 'admin' as const
        }];
    }

    // In production, require environment variables
    if (!username || !passwordHash || !salt) {
        const missing = [];
        if (!username) missing.push('VITE_DEFAULT_USERNAME');
        if (!passwordHash) missing.push('VITE_DEFAULT_PASSWORD_HASH');
        if (!salt) missing.push('VITE_DEFAULT_SALT');

        throw new Error(
            `Missing required environment variables: ${missing.join(', ')}. ` +
            'Please set these in your .env file. Never commit actual credentials to source code.'
        );
    }

    return [{
        id: 'user-1',
        username,
        passwordHash,
        salt,
        role: 'admin' as const // Default role for the first user
    }];
};

export const defaultUsers = getDefaultUsers();
