/**
 * ============================================
 * Image Processor Module
 * Logo to SVG Converter
 * ============================================
 */

const ImageProcessor = (function() {
    'use strict';

    /**
     * Wait for ImageTracer library to be available
     */
    function waitForImageTracer(timeout = 10000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const check = () => {
                // ImageTracer.js loads as an instance on window or self
                if (typeof window.ImageTracer !== 'undefined' || 
                    (typeof self !== 'undefined' && typeof self.ImageTracer !== 'undefined')) {
                    // Get the tracer instance (it's already instantiated by the library)
                    const tracer = window.ImageTracer || self.ImageTracer;
                    resolve(tracer);
                } else if (Date.now() - start > timeout) {
                    reject(new Error('ImageTracer library failed to load. Please check your internet connection and refresh the page.'));
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    /**
     * Process image through complete pipeline
     */
    async function processImage(imageSource, settings, onProgress) {
        return new Promise(async (resolve, reject) => {
            try {
                onProgress(5, 'Loading image...');

                // Load image
                const img = await loadImage(imageSource);
                onProgress(10, 'Analyzing image...');

                // Resize if too large (max 1200px for performance)
                const canvas = Utils.resizeImage(img, 1200);
                const ctx = canvas.getContext('2d');
                let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                onProgress(15, 'Pre-processing...');

                // Remove background if enabled
                if (settings.removeBackground) {
                    imageData = removeBackground(imageData, settings.threshold);
                    onProgress(25, 'Background removed...');
                }

                // Apply noise reduction
                if (settings.noiseReduction) {
                    imageData = applyNoiseReduction(imageData);
                    onProgress(35, 'Noise reduced...');
                }

                // Enhance contrast
                imageData = enhanceContrast(imageData, settings.threshold);
                onProgress(45, 'Contrast enhanced...');

                // Sharpen
                imageData = sharpen(imageData);
                onProgress(55, 'Image sharpened...');

                // Detect if image is likely a logo
                const logoDetection = Utils.detectLogoLikeness(imageData);

                onProgress(60, 'Vectorizing...');

                // Determine if monochrome or multi-color
                const isMonochrome = isImageMonochrome(imageData);

                let svgString;

                if (isMonochrome) {
                    // Use simplified tracing for monochrome
                    svgString = await traceMonochrome(imageData, settings);
                } else {
                    // Use ImageTracer for multi-color
                    svgString = await traceMultiColor(imageData, settings);
                }

                onProgress(85, 'Optimizing SVG...');

                // Post-process SVG
                if (settings.autoOptimize) {
                    svgString = optimizeSVG(svgString, settings);
                }

                onProgress(95, 'Finalizing...');

                // Calculate stats
                const stats = calculateStats(svgString, imageData, logoDetection);

                onProgress(100, 'Complete!');

                resolve({
                    svgString,
                    stats,
                    isLogo: logoDetection.isLogo,
                    originalImage: img
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Load image from source (File or URL)
     */
    function loadImage(source) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image'));

            if (source instanceof File) {
                const reader = new FileReader();
                reader.onload = (e) => { img.src = e.target.result; };
                reader.readAsDataURL(source);
            } else {
                img.src = source;
            }
        });
    }

    /**
     * Remove background (white or uniform color)
     */
    function removeBackground(imageData, threshold) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;

        // Sample corners to detect background color
        const corners = [
            { x: 0, y: 0 },
            { x: width - 1, y: 0 },
            { x: 0, y: height - 1 },
            { x: width - 1, y: height - 1 }
        ];

        let bgR = 0, bgG = 0, bgB = 0;
        corners.forEach(c => {
            const i = (c.y * width + c.x) * 4;
            bgR += data[i];
            bgG += data[i + 1];
            bgB += data[i + 2];
        });
        bgR = Math.round(bgR / 4); 
        bgG = Math.round(bgG / 4); 
        bgB = Math.round(bgB / 4);

        // Remove pixels close to background color
        for (let i = 0; i < data.length; i += 4) {
            const diff = Math.abs(data[i] - bgR) + 
                        Math.abs(data[i + 1] - bgG) + 
                        Math.abs(data[i + 2] - bgB);

            if (diff < threshold * 3) {
                data[i + 3] = 0; // Make transparent
            }
        }

        return imageData;
    }

    /**
     * Apply noise reduction using median filter
     */
    function applyNoiseReduction(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const output = new Uint8ClampedArray(data);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const i = (y * width + x) * 4;

                for (let c = 0; c < 3; c++) {
                    const neighbors = [];
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const ni = ((y + dy) * width + (x + dx)) * 4;
                            neighbors.push(data[ni + c]);
                        }
                    }
                    neighbors.sort((a, b) => a - b);
                    output[i + c] = neighbors[4]; // Median
                }
            }
        }

        return new ImageData(output, width, height);
    }

    /**
     * Enhance contrast
     */
    function enhanceContrast(imageData, threshold) {
        const data = imageData.data;

        // Find min/max
        let min = 255, max = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) continue;
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            min = Math.min(min, gray);
            max = Math.max(max, gray);
        }

        if (max === min) return imageData;

        // Apply contrast stretching
        const factor = 255 / (max - min);
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) continue;
            for (let c = 0; c < 3; c++) {
                data[i + c] = Utils.clamp((data[i + c] - min) * factor, 0, 255);
            }
        }

        return imageData;
    }

    /**
     * Sharpen image
     */
    function sharpen(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const output = new Uint8ClampedArray(data);

        const kernel = [
            0, -1, 0,
            -1, 5, -1,
            0, -1, 0
        ];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const i = (y * width + x) * 4;

                for (let c = 0; c < 3; c++) {
                    let sum = 0;
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const ni = ((y + ky) * width + (x + kx)) * 4;
                            const ki = (ky + 1) * 3 + (kx + 1);
                            sum += data[ni + c] * kernel[ki];
                        }
                    }
                    output[i + c] = Utils.clamp(sum, 0, 255);
                }
            }
        }

        return new ImageData(output, width, height);
    }

    /**
     * Check if image is monochrome
     */
    function isImageMonochrome(imageData) {
        const data = imageData.data;
        const sampleSize = Math.min(data.length / 4, 1000);
        const step = Math.floor((data.length / 4) / sampleSize) || 1;

        let colorVariations = 0;
        let prevGray = -1;

        for (let i = 0; i < data.length; i += 4 * step) {
            if (data[i + 3] < 128) continue;
            const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            if (prevGray !== -1 && Math.abs(gray - prevGray) > 30) {
                colorVariations++;
            }
            prevGray = gray;
        }

        return colorVariations < sampleSize * 0.1;
    }

    /**
     * Trace monochrome image using simple edge detection
     */
    async function traceMonochrome(imageData, settings) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;

        // Create binary image
        const binary = new Uint8Array(width * height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                if (data[i + 3] < 128) {
                    binary[y * width + x] = 0;
                } else {
                    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    binary[y * width + x] = gray < settings.threshold ? 1 : 0;
                }
            }
        }

        // Trace contours
        const paths = traceContours(binary, width, height, settings.pathOmit);

        // Build SVG
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`;

        if (settings.transparentBg) {
            svg += `<rect width="100%" height="100%" fill="none"/>`;
        } else {
            svg += `<rect width="100%" height="100%" fill="white"/>`;
        }

        paths.forEach(path => {
            if (path.length < 3) return;
            let d = `M ${path[0].x} ${path[0].y}`;
            for (let i = 1; i < path.length; i++) {
                d += ` L ${path[i].x} ${path[i].y}`;
            }
            d += ' Z';
            svg += `<path d="${d}" fill="black" stroke="none"/>`;
        });

        svg += '</svg>';
        return svg;
    }

    /**
     * Trace contours from binary image
     */
    function traceContours(binary, width, height, pathOmit) {
        const visited = new Uint8Array(width * height);
        const paths = [];

        const directions = [
            { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 1 },
            { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 }
        ];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (binary[idx] === 1 && !visited[idx]) {
                    const path = followContour(binary, visited, width, height, x, y, directions);
                    if (path.length > pathOmit) {
                        paths.push(path);
                    }
                }
            }
        }

        return paths;
    }

    /**
     * Follow contour starting from point
     */
    function followContour(binary, visited, width, height, startX, startY, directions) {
        const path = [{ x: startX, y: startY }];
        visited[startY * width + startX] = 1;

        let x = startX, y = startY;
        let dir = 0;

        for (let step = 0; step < 10000; step++) {
            let found = false;

            for (let i = 0; i < 8; i++) {
                const ndir = (dir + i + 5) % 8;
                const nx = x + directions[ndir].x;
                const ny = y + directions[ndir].y;

                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const nidx = ny * width + nx;
                    if (binary[nidx] === 1 && !visited[nidx]) {
                        visited[nidx] = 1;
                        path.push({ x: nx, y: ny });
                        x = nx;
                        y = ny;
                        dir = ndir;
                        found = true;
                        break;
                    }
                }
            }

            if (!found) break;
            if (x === startX && y === startY) break;
        }

        return path;
    }

    /**
     * Trace multi-color image using ImageTracer
     */
    async function traceMultiColor(imageData, settings) {
        const tracer = await waitForImageTracer();

        return new Promise((resolve, reject) => {
            try {
                const options = {
                    ltres: settings.lineThreshold,
                    qtres: settings.cornerThreshold,
                    pathomit: settings.pathOmit,
                    numberofcolors: settings.numColors,
                    colorsampling: 2,
                    colorquantcycles: 3,
                    layering: 0,
                    strokewidth: 1,
                    linefilter: settings.smoothCurves,
                    scale: 1,
                    roundcoords: 1,
                    viewbox: settings.autoViewBox,
                    desc: false,
                    rightangleenhance: true,
                    blurradius: settings.noiseReduction ? 1 : 0,
                    blurdelta: 20
                };

                const svgString = tracer.imagedataToSVG(imageData, options);
                resolve(svgString);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Optimize SVG string
     */
    function optimizeSVG(svgString, settings) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgString, 'image/svg+xml');
        const svg = doc.querySelector('svg');

        if (!svg) return svgString;

        // Remove empty paths
        const paths = svg.querySelectorAll('path');
        paths.forEach(path => {
            const d = path.getAttribute('d');
            if (!d || d.trim().length < 10) {
                path.remove();
            }
        });

        // Auto center
        if (settings.autoCenter) {
            const bbox = getSVGBoundingBox(svg);
            if (bbox) {
                const currentViewBox = svg.getAttribute('viewBox') || `0 0 ${svg.getAttribute('width') || 100} ${svg.getAttribute('height') || 100}`;
                const vb = currentViewBox.split(/\s+/).map(Number);

                const cx = bbox.x + bbox.width / 2;
                const cy = bbox.y + bbox.height / 2;
                const vw = Math.max(vb[2], bbox.width);
                const vh = Math.max(vb[3], bbox.height);

                svg.setAttribute('viewBox', `${cx - vw/2} ${cy - vh/2} ${vw} ${vh}`);
            }
        }

        // Remove unnecessary groups
        const groups = svg.querySelectorAll('g');
        groups.forEach(g => {
            if (!g.getAttribute('transform') && g.children.length === 0) {
                g.remove();
            }
        });

        // Clean attributes
        const allElements = svg.querySelectorAll('*');
        allElements.forEach(el => {
            if (el.getAttribute('stroke-width') === '1') {
                el.removeAttribute('stroke-width');
            }
            if (el.getAttribute('stroke') === 'none') {
                el.removeAttribute('stroke');
            }
        });

        const serializer = new XMLSerializer();
        return serializer.serializeToString(doc);
    }

    /**
     * Get bounding box of SVG content
     */
    function getSVGBoundingBox(svg) {
        const paths = svg.querySelectorAll('path');
        if (paths.length === 0) return null;

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        paths.forEach(path => {
            const d = path.getAttribute('d');
            if (!d) return;

            const matches = d.match(/[ML]\s*([\d.-]+)[\s,]+([\d.-]+)/g);
            if (matches) {
                matches.forEach(match => {
                    const coords = match.match(/[\d.-]+/g);
                    if (coords && coords.length >= 2) {
                        const x = parseFloat(coords[0]);
                        const y = parseFloat(coords[1]);
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y);
                    }
                });
            }
        });

        if (minX === Infinity) return null;

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * Calculate conversion statistics
     */
    function calculateStats(svgString, imageData, logoDetection) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgString, 'image/svg+xml');
        const svg = doc.querySelector('svg');

        const paths = svg ? svg.querySelectorAll('path') : [];
        const pathCount = paths.length;

        let nodeCount = 0;
        paths.forEach(path => {
            const d = path.getAttribute('d') || '';
            nodeCount += (d.match(/[MLCQS]/g) || []).length;
        });

        const svgSize = new Blob([svgString]).size;
        const originalSize = imageData.data.length;
        const compression = ((1 - svgSize / originalSize) * 100).toFixed(1);

        // Count unique colors
        const colors = new Set();
        if (svg) {
            const allElements = svg.querySelectorAll('*');
            allElements.forEach(el => {
                const fill = el.getAttribute('fill');
                const stroke = el.getAttribute('stroke');
                if (fill && fill !== 'none') colors.add(fill);
                if (stroke && stroke !== 'none') colors.add(stroke);
            });
        }

        // Quality assessment
        let quality = 'Excellent';
        let stars = 5;

        if (nodeCount > 10000 || pathCount > 500) {
            quality = 'Needs Cleanup';
            stars = 2;
        } else if (nodeCount > 5000 || pathCount > 200) {
            quality = 'Good';
            stars = 3;
        } else if (nodeCount > 2000 || pathCount > 100) {
            quality = 'Very Good';
            stars = 4;
        }

        // Laser cutting compatibility
        const laserCompatible = pathCount < 100 && nodeCount < 3000;

        return {
            pathCount,
            nodeCount,
            svgSize,
            compression,
            colorCount: colors.size,
            quality,
            stars,
            laserCompatible,
            fileSize: svgSize,
            isLogo: logoDetection.isLogo
        };
    }

    // Public API
    return {
        processImage,
        loadImage,
        removeBackground,
        applyNoiseReduction,
        enhanceContrast,
        sharpen,
        isImageMonochrome,
        traceMonochrome,
        traceMultiColor,
        optimizeSVG,
        calculateStats,
        waitForImageTracer
    };
})();
