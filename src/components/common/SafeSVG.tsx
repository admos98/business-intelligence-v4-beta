import React from 'react';

/**
 * Safe SVG component that sanitizes SVG content before rendering
 * This prevents XSS attacks from malicious SVG content
 */
interface SafeSVGProps {
    svgContent: string;
    className?: string;
    width?: number | string;
    height?: number | string;
}

export const SafeSVG: React.FC<SafeSVGProps> = ({ svgContent, className, width, height }) => {
    // Basic sanitization: remove script tags and event handlers
    const sanitizeSVG = (svg: string): string => {
        // Remove script tags and their content
        let sanitized = svg.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

        // Remove event handlers (onclick, onload, etc.)
        sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
        sanitized = sanitized.replace(/\s*on\w+\s*=\s*{[^}]*}/gi, '');

        // Remove javascript: protocol
        sanitized = sanitized.replace(/javascript:/gi, '');

        return sanitized;
    };

    const sanitizedContent = sanitizeSVG(svgContent);

    return (
        <div
            className={className}
            style={{ width, height }}
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
    );
};
