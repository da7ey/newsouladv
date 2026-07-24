/**
 * ============================================
 * Utils Module - Helper Functions
 * Logo to SVG Converter
 * ============================================
 */

const Utils = (function() {
    'use strict';

    /**
     * Debounce function to limit execution rate
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Format bytes to human readable string
     */
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    /**
     * Clamp value between min and max
     */
    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    /**
     * Calculate color distance (Euclidean)
     */
    function colorDistance(c1, c2) {
        return Math.sqrt(
            Math.pow(c1.r - c2.r, 2) +
            Math.pow(c1.g - c2.g, 2) +
            Math.pow(c1.b - c2.b, 2)
        );
    }

    /**
     * Convert hex to rgb
     */
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    /**
     * Convert rgb to hex
     */
    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = Math.round(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    /**
     * Get dominant colors from image data
     */
    function getDominantColors(imageData, maxColors = 10) {
        const pixels = imageData.data;
        const colorMap = new Map();

        for (let i = 0; i < pixels.length; i += 16) { // Sample every 4th pixel
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const a = pixels[i + 3];

            if (a < 128) continue; // Skip transparent

            const key = `${r >> 4},${g >> 4},${b >> 4}`; // Quantize
            colorMap.set(key, (colorMap.get(key) || 0) + 1);
        }

        return Array.from(colorMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxColors)
            .map(([key]) => {
                const [r, g, b] = key.split(',').map(Number);
                return { r: r << 4, g: g << 4, b: b << 4 };
            });
    }

    /**
     * Detect if image is likely a logo
     */
    function detectLogoLikeness(imageData) {
        const pixels = imageData.data;
        const width = imageData.width;
        const height = imageData.height;

        // Check color count
        const uniqueColors = new Set();
        let edgePixels = 0;
        let transparentPixels = 0;

        for (let y = 0; y < height; y += 4) {
            for (let x = 0; x < width; x += 4) {
                const i = (y * width + x) * 4;
                const r = pixels[i];
                const g = pixels[i + 1];
                const b = pixels[i + 2];
                const a = pixels[i + 3];

                if (a < 128) {
                    transparentPixels++;
                    continue;
                }

                uniqueColors.add(`${r >> 4},${g >> 4},${b >> 4}`);

                // Simple edge detection
                if (x > 0 && x < width - 1) {
                    const left = ((y * width + (x - 1)) * 4);
                    const right = ((y * width + (x + 1)) * 4);
                    const diff = Math.abs(pixels[left] - pixels[right]) +
                                 Math.abs(pixels[left + 1] - pixels[right + 1]) +
                                 Math.abs(pixels[left + 2] - pixels[right + 2]);
                    if (diff > 50) edgePixels++;
                }
            }
        }

        const totalSamples = (width / 4) * (height / 4);
        const colorCount = uniqueColors.size;
        const edgeRatio = edgePixels / totalSamples;
        const transparencyRatio = transparentPixels / totalSamples;

        // Logos typically have: few colors, high edges, possible transparency
        const isLogo = colorCount < 50 && (edgeRatio > 0.1 || transparencyRatio > 0.1);

        return {
            isLogo,
            colorCount,
            edgeRatio,
            transparencyRatio
        };
    }

    /**
     * Create a canvas from image source
     */
    function createCanvasFromImage(img) {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return canvas;
    }

    /**
     * Resize image maintaining aspect ratio
     */
    function resizeImage(img, maxDimension = 800) {
        let { width, height } = img;

        if (width > maxDimension || height > maxDimension) {
            const ratio = Math.min(maxDimension / width, maxDimension / height);
            width *= ratio;
            height *= ratio;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        return canvas;
    }

    /**
     * Download blob as file
     */
    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Copy text to clipboard
     */
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);
            return success;
        }
    }

    /**
     * Generate unique ID
     */
    function generateId() {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Parse SVG string to DOM
     */
    function parseSVG(svgString) {
        const parser = new DOMParser();
        return parser.parseFromString(svgString, 'image/svg+xml');
    }

    /**
     * Serialize SVG DOM to string
     */
    function serializeSVG(svgDoc) {
        const serializer = new XMLSerializer();
        return serializer.serializeToString(svgDoc);
    }

    // Public API
    return {
        debounce,
        formatBytes,
        clamp,
        colorDistance,
        hexToRgb,
        rgbToHex,
        getDominantColors,
        detectLogoLikeness,
        createCanvasFromImage,
        resizeImage,
        downloadBlob,
        copyToClipboard,
        generateId,
        parseSVG,
        serializeSVG
    };
})();
