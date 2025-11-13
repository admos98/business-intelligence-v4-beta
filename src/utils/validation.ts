/**
 * Input validation and sanitization utilities
 */

/**
 * Sanitizes a string by removing potentially dangerous characters
 */
export function sanitizeString(input: string): string {
    return input
        .trim()
        .replace(/[<>]/g, '') // Remove angle brackets
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, ''); // Remove event handlers
}

/**
 * Validates that a string is not empty and within length limits
 */
export function validateString(
    input: string,
    minLength: number = 1,
    maxLength: number = 1000
): { isValid: boolean; error?: string } {
    if (!input || typeof input !== 'string') {
        return { isValid: false, error: 'Input must be a non-empty string' };
    }

    const trimmed = input.trim();
    if (trimmed.length < minLength) {
        return { isValid: false, error: `Input must be at least ${minLength} characters long` };
    }

    if (trimmed.length > maxLength) {
        return { isValid: false, error: `Input must be no more than ${maxLength} characters long` };
    }

    return { isValid: true };
}

/**
 * Validates a number is within a valid range
 */
export function validateNumber(
    input: number,
    min: number = 0,
    max: number = Number.MAX_SAFE_INTEGER
): { isValid: boolean; error?: string } {
    if (typeof input !== 'number' || isNaN(input)) {
        return { isValid: false, error: 'Input must be a valid number' };
    }

    if (input < min) {
        return { isValid: false, error: `Number must be at least ${min}` };
    }

    if (input > max) {
        return { isValid: false, error: `Number must be no more than ${max}` };
    }

    return { isValid: true };
}

/**
 * Validates an email address format (basic validation)
 */
export function validateEmail(email: string): { isValid: boolean; error?: string } {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { isValid: false, error: 'Invalid email format' };
    }
    return { isValid: true };
}

/**
 * Sanitizes user input for display (prevents XSS)
 */
export function sanitizeForDisplay(input: string): string {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}
