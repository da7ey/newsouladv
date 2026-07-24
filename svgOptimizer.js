/**
 * ============================================
 * SVG Optimizer Module
 * Logo to SVG Converter
 * ============================================
 */

const SVGOptimizer = (function() {
    'use strict';

    let svgElement = null;
    let history = [];
    let historyIndex = -1;
    const MAX_HISTORY = 20;

    /**
     * Initialize SVG from string
     */
    function init(svgString, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return null;

        container.innerHTML = svgString;
        svgElement = container.querySelector('svg');

        if (!svgElement) return null;

        // Ensure SVG has proper styling
        svgElement.style.maxWidth = '100%';
        svgElement.style.maxHeight = '100%';
        svgElement.style.width = 'auto';
        svgElement.style.height = 'auto';

        saveState(svgString);
        return svgElement;
    }

    /**
     * Save current state to history
     */
    function saveState(svgString) {
        if (!svgString && svgElement) {
            svgString = svgElement.outerHTML;
        }
        if (!svgString) return;

        // Remove future history if we're not at the end
        if (historyIndex < history.length - 1) {
            history = history.slice(0, historyIndex + 1);
        }

        history.push(svgString);

        if (history.length > MAX_HISTORY) {
            history.shift();
        } else {
            historyIndex++;
        }
    }

    /**
     * Undo last action
     */
    function undo() {
        if (historyIndex > 0) {
            historyIndex--;
            restoreState();
            return true;
        }
        return false;
    }

    /**
     * Redo last undone action
     */
    function redo() {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            restoreState();
            return true;
        }
        return false;
    }

    /**
     * Restore state from history
     */
    function restoreState() {
        if (historyIndex < 0 || !svgElement) return;

        const container = svgElement.parentNode;
        if (!container) return;

        container.innerHTML = history[historyIndex];
        svgElement = container.querySelector('svg');

        if (svgElement) {
            svgElement.style.maxWidth = '100%';
            svgElement.style.maxHeight = '100%';
        }
    }

    /**
     * Remove small elements
     */
    function removeSmallElements(minArea = 10) {
        if (!svgElement) return;

        const paths = svgElement.querySelectorAll('path');
        paths.forEach(path => {
            try {
                const bbox = path.getBBox();
                if (bbox.width * bbox.height < minArea) {
                    path.remove();
                }
            } catch (e) {
                // Element might not be renderable
            }
        });

        saveState();
    }

    /**
     * Merge similar colors
     */
    function mergeSimilarColors(threshold = 30) {
        if (!svgElement) return;

        const colorMap = new Map();
        const elements = svgElement.querySelectorAll('path, rect, circle, ellipse, polygon, polyline');

        // Collect all colors
        elements.forEach(el => {
            const fill = el.getAttribute('fill');
            if (fill && fill !== 'none') {
                if (!colorMap.has(fill)) {
                    colorMap.set(fill, []);
                }
                colorMap.get(fill).push(el);
            }
        });

        // Find similar colors and merge
        const colors = Array.from(colorMap.keys());
        const merged = new Set();

        for (let i = 0; i < colors.length; i++) {
            if (merged.has(i)) continue;

            const color1 = Utils.hexToRgb(colors[i]) || parseColor(colors[i]);
            if (!color1) continue;

            for (let j = i + 1; j < colors.length; j++) {
                if (merged.has(j)) continue;

                const color2 = Utils.hexToRgb(colors[j]) || parseColor(colors[j]);
                if (!color2) continue;

                const distance = Utils.colorDistance(color1, color2);

                if (distance < threshold) {
                    // Merge color2 into color1
                    const elements2 = colorMap.get(colors[j]);
                    elements2.forEach(el => el.setAttribute('fill', colors[i]));
                    merged.add(j);
                }
            }
        }

        saveState();
    }

    /**
     * Simplify paths by reducing points
     */
    function simplifyPaths(tolerance = 1) {
        if (!svgElement) return;

        const paths = svgElement.querySelectorAll('path');

        paths.forEach(path => {
            const d = path.getAttribute('d');
            if (!d) return;

            const simplified = simplifyPathData(d, tolerance);
            path.setAttribute('d', simplified);
        });

        saveState();
    }

    /**
     * Simplify path data using Douglas-Peucker algorithm
     */
    function simplifyPathData(d, tolerance) {
        // Parse path data - extract M and L commands
        const commands = d.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi) || [];
        if (commands.length < 3) return d;

        const points = [];
        let currentX = 0, currentY = 0;

        commands.forEach(cmd => {
            const type = cmd[0];
            const coords = cmd.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));

            switch(type) {
                case 'M':
                    if (coords.length >= 2) {
                        currentX = coords[0];
                        currentY = coords[1];
                        points.push({ x: currentX, y: currentY });
                    }
                    break;
                case 'L':
                    if (coords.length >= 2) {
                        currentX = coords[0];
                        currentY = coords[1];
                        points.push({ x: currentX, y: currentY });
                    }
                    break;
            }
        });

        if (points.length < 3) return d;

        // Douglas-Peucker simplification
        const simplified = douglasPeucker(points, tolerance);

        // Rebuild path
        let newD = `M ${simplified[0].x} ${simplified[0].y}`;
        for (let i = 1; i < simplified.length; i++) {
            newD += ` L ${simplified[i].x} ${simplified[i].y}`;
        }

        return newD;
    }

    /**
     * Douglas-Peucker algorithm
     */
    function douglasPeucker(points, tolerance) {
        if (points.length <= 2) return points;

        let maxDist = 0;
        let index = 0;

        const first = points[0];
        const last = points[points.length - 1];

        for (let i = 1; i < points.length - 1; i++) {
            const dist = pointToLineDistance(points[i], first, last);
            if (dist > maxDist) {
                maxDist = dist;
                index = i;
            }
        }

        if (maxDist > tolerance) {
            const left = douglasPeucker(points.slice(0, index + 1), tolerance);
            const right = douglasPeucker(points.slice(index), tolerance);
            return left.slice(0, -1).concat(right);
        }

        return [first, last];
    }

    /**
     * Point to line distance
     */
    function pointToLineDistance(point, lineStart, lineEnd) {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const len = Math.sqrt(dx * dx + dy * dy);

        if (len === 0) return Math.sqrt(
            Math.pow(point.x - lineStart.x, 2) + 
            Math.pow(point.y - lineStart.y, 2)
        );

        const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (len * len);
        const tClamped = Math.max(0, Math.min(1, t));

        const projX = lineStart.x + tClamped * dx;
        const projY = lineStart.y + tClamped * dy;

        return Math.sqrt(
            Math.pow(point.x - projX, 2) + 
            Math.pow(point.y - projY, 2)
        );
    }

    /**
     * Parse color string to RGB
     */
    function parseColor(color) {
        if (!color) return null;
        if (color.startsWith('rgb')) {
            const match = color.match(/\d+/g);
            if (match) {
                return {
                    r: parseInt(match[0]),
                    g: parseInt(match[1]),
                    b: parseInt(match[2])
                };
            }
        }
        return Utils.hexToRgb(color);
    }

    /**
     * Center SVG content
     */
    function centerContent() {
        if (!svgElement) return;

        try {
            const bbox = svgElement.getBBox ? svgElement.getBBox() : null;
            if (!bbox) return;

            const viewBox = svgElement.getAttribute('viewBox');
            let vb = viewBox ? viewBox.split(/\s+/).map(Number) : [0, 0, bbox.width, bbox.height];

            const cx = bbox.x + bbox.width / 2;
            const cy = bbox.y + bbox.height / 2;

            const newViewBox = `${cx - vb[2]/2} ${cy - vb[3]/2} ${vb[2]} ${vb[3]}`;
            svgElement.setAttribute('viewBox', newViewBox);
            saveState();
        } catch (e) {
            console.warn('Could not center content:', e);
        }
    }

    /**
     * Remove empty paths and groups
     */
    function cleanup() {
        if (!svgElement) return;

        // Remove empty paths
        const paths = svgElement.querySelectorAll('path');
        paths.forEach(path => {
            const d = path.getAttribute('d');
            if (!d || d.trim().length < 5) {
                path.remove();
            }
        });

        // Remove empty groups
        const groups = svgElement.querySelectorAll('g');
        groups.forEach(g => {
            if (g.children.length === 0) {
                g.remove();
            }
        });

        saveState();
    }

    /**
     * Get current SVG string
     */
    function getSVGString() {
        return svgElement ? svgElement.outerHTML : '';
    }

    /**
     * Toggle fill visibility
     */
    function toggleFill(show) {
        if (!svgElement) return;

        const elements = svgElement.querySelectorAll('path, rect, circle, ellipse, polygon');
        elements.forEach(el => {
            if (show) {
                el.style.fillOpacity = '1';
                el.removeAttribute('fill-opacity');
            } else {
                el.style.fillOpacity = '0';
            }
        });
    }

    /**
     * Toggle stroke visibility
     */
    function toggleStroke(show) {
        if (!svgElement) return;

        const elements = svgElement.querySelectorAll('path, rect, circle, ellipse, polygon');
        elements.forEach(el => {
            if (show) {
                const currentStroke = el.getAttribute('stroke');
                if (!currentStroke || currentStroke === 'none') {
                    el.setAttribute('stroke', '#000000');
                    el.setAttribute('stroke-width', '1');
                }
            } else {
                el.setAttribute('stroke', 'none');
            }
        });
    }

    /**
     * Get all colors in SVG
     */
    function getColors() {
        if (!svgElement) return [];

        const colors = new Set();
        const elements = svgElement.querySelectorAll('path, rect, circle, ellipse, polygon, polyline');

        elements.forEach(el => {
            const fill = el.getAttribute('fill');
            const stroke = el.getAttribute('stroke');
            if (fill && fill !== 'none') colors.add(fill);
            if (stroke && stroke !== 'none') colors.add(stroke);
        });

        return Array.from(colors);
    }

    /**
     * Change color
     */
    function changeColor(oldColor, newColor) {
        if (!svgElement) return;

        const elements = svgElement.querySelectorAll('path, rect, circle, ellipse, polygon, polyline');

        elements.forEach(el => {
            if (el.getAttribute('fill') === oldColor) {
                el.setAttribute('fill', newColor);
            }
            if (el.getAttribute('stroke') === oldColor) {
                el.setAttribute('stroke', newColor);
            }
        });

        saveState();
    }

    // Public API
    return {
        init,
        undo,
        redo,
        removeSmallElements,
        mergeSimilarColors,
        simplifyPaths,
        centerContent,
        cleanup,
        getSVGString,
        toggleFill,
        toggleStroke,
        getColors,
        changeColor,
        saveState
    };
})();
