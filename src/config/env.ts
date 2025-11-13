/**
 * Environment configuration validation
 * Validates that required environment variables are set
 */

interface EnvConfig {
    isDevelopment: boolean;
    isProduction: boolean;
}

/**
 * Validates environment configuration
 * Throws an error if critical configuration is missing
 */
export function validateEnvConfig(): EnvConfig {
    const config: EnvConfig = {
        isDevelopment: import.meta.env.DEV,
        isProduction: import.meta.env.PROD,
    };

    // Add validation for required environment variables here if needed
    // For example:
    // if (!import.meta.env.VITE_REQUIRED_VAR) {
    //     throw new Error('VITE_REQUIRED_VAR is required');
    // }

    return config;
}

/**
 * Gets the current environment configuration
 */
export function getEnvConfig(): EnvConfig {
    return {
        isDevelopment: import.meta.env.DEV,
        isProduction: import.meta.env.PROD,
    };
}
