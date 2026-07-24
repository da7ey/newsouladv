/**
 * ============================================
 * Main Application Script
 * Logo to SVG Converter
 * Powered by New Soul Advertising
 * ============================================
 */

const App = (function() {
    'use strict';

    // State
    let currentFile = null;
    let currentSVG = '';
    let currentStats = null;
    let zoomLevel = 1;
    let showGrid = false;
    let showFill = true;
    let showStroke = false;
    let isProcessing = false;

    /**
     * Initialize application
     */
    function init() {
        UI.init();
        bindEvents();

        // Expose app to global for UI callbacks
        window.App = {
            processFile,
            changeColor
        };

        console.log('Logo to SVG Converter initialized');
    }

    /**
     * Bind main events
     */
    function bindEvents() {
        // File input
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    processFile(e.target.files[0]);
                }
            });
        }

        // Toolbar buttons
        bindToolbarEvents();

        // Action buttons
        bindActionEvents();

        // Reconvert button
        const reconvertBtn = document.getElementById('reconvertBtn');
        if (reconvertBtn) {
            reconvertBtn.addEventListener('click', () => {
                if (currentFile && !isProcessing) {
                    processFile(currentFile);
                }
            });
        }
    }

    /**
     * Bind toolbar events
     */
    function bindToolbarEvents() {
        // Zoom
        document.getElementById('zoomInBtn')?.addEventListener('click', () => {
            zoomLevel = Math.min(zoomLevel + 0.25, 5);
            applyZoom();
        });

        document.getElementById('zoomOutBtn')?.addEventListener('click', () => {
            zoomLevel = Math.max(zoomLevel - 0.25, 0.25);
            applyZoom();
        });

        document.getElementById('fitScreenBtn')?.addEventListener('click', () => {
            zoomLevel = 1;
            applyZoom();
        });

        // Grid
        document.getElementById('toggleGridBtn')?.addEventListener('click', (e) => {
            showGrid = !showGrid;
            e.currentTarget.classList.toggle('active', showGrid);
            UI.toggleGrid(showGrid);
        });

        // Fill/Stroke
        document.getElementById('toggleFillBtn')?.addEventListener('click', (e) => {
            showFill = !showFill;
            e.currentTarget.classList.toggle('active', showFill);
            SVGOptimizer.toggleFill(showFill);
        });

        document.getElementById('toggleStrokeBtn')?.addEventListener('click', (e) => {
            showStroke = !showStroke;
            e.currentTarget.classList.toggle('active', showStroke);
            SVGOptimizer.toggleStroke(showStroke);
        });

        // Undo/Redo
        document.getElementById('undoBtn')?.addEventListener('click', () => {
            if (SVGOptimizer.undo()) {
                refreshPreview();
            }
        });

        document.getElementById('redoBtn')?.addEventListener('click', () => {
            if (SVGOptimizer.redo()) {
                refreshPreview();
            }
        });
    }

    /**
     * Bind action button events
     */
    function bindActionEvents() {
        // Download SVG
        document.getElementById('downloadSvgBtn')?.addEventListener('click', () => {
            if (!currentSVG) return;
            const blob = new Blob([currentSVG], { type: 'image/svg+xml' });
            Utils.downloadBlob(blob, 'logo-converted.svg');
            UI.showNotification('SVG downloaded!', 'success');
        });

        // Download Optimized SVG
        document.getElementById('downloadOptimizedBtn')?.addEventListener('click', () => {
            const optimized = SVGOptimizer.getSVGString();
            if (!optimized) return;
            const blob = new Blob([optimized], { type: 'image/svg+xml' });
            Utils.downloadBlob(blob, 'logo-optimized.svg');
            UI.showNotification('Optimized SVG downloaded!', 'success');
        });

        // Download PNG
        document.getElementById('downloadPngBtn')?.addEventListener('click', () => {
            exportPNG();
        });

        // Copy to clipboard
        document.getElementById('copyClipboardBtn')?.addEventListener('click', async () => {
            const svg = SVGOptimizer.getSVGString() || currentSVG;
            if (!svg) return;
            const success = await Utils.copyToClipboard(svg);
            if (success) {
                UI.showNotification('Copied to clipboard!', 'success');
            } else {
                UI.showNotification('Failed to copy', 'error');
            }
        });

        // Merge colors
        document.getElementById('mergeColorsBtn')?.addEventListener('click', () => {
            SVGOptimizer.mergeSimilarColors(30);
            refreshPreview();
            updateColors();
            UI.showNotification('Similar colors merged!', 'success');
        });
    }

    /**
     * Process file
     */
    async function processFile(file) {
        if (isProcessing) return;
        isProcessing = true;
        currentFile = file;

        UI.showSection('processingSection');
        UI.updateProgress(0, 'Starting...');

        try {
            const settings = UI.getSettings();

            const result = await ImageProcessor.processImage(
                file,
                settings,
                (percent, text) => {
                    UI.updateProgress(percent, text);
                }
            );

            currentSVG = result.svgString;
            currentStats = result.stats;

            // Initialize SVG optimizer
            SVGOptimizer.init(currentSVG, 'svgPreview');

            // Update original image preview
            const reader = new FileReader();
            reader.onload = (e) => {
                UI.setOriginalImage(e.target.result);
            };
            reader.readAsDataURL(file);

            UI.setSVGPreview(currentSVG);
            UI.updateStats(currentStats);
            UI.showWarning(!result.isLogo);
            UI.showSection('editorSection');

            // Update color editor
            updateColors();

            // Reset zoom
            zoomLevel = 1;
            applyZoom();

        } catch (error) {
            console.error('Processing error:', error);
            UI.showNotification('Error: ' + (error.message || 'Unknown error'), 'error');
            UI.showSection('uploadSection');
        } finally {
            isProcessing = false;
        }
    }

    /**
     * Apply zoom to preview
     */
    function applyZoom() {
        const svgElement = document.querySelector('#svgPreview svg');
        const imgElement = document.querySelector('#beforeImage img');

        if (svgElement) {
            svgElement.style.transform = `scale(${zoomLevel})`;
            svgElement.style.transformOrigin = 'center center';
            svgElement.style.transition = 'transform 0.2s ease';
        }

        if (imgElement) {
            imgElement.style.transform = `scale(${zoomLevel})`;
            imgElement.style.transformOrigin = 'center center';
            imgElement.style.transition = 'transform 0.2s ease';
        }
    }

    /**
     * Refresh SVG preview
     */
    function refreshPreview() {
        const svgString = SVGOptimizer.getSVGString();
        if (svgString) {
            UI.setSVGPreview(svgString);

            // Update stats
            if (currentStats) {
                try {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(svgString, 'image/svg+xml');
                    const paths = doc.querySelectorAll('path');

                    let nodeCount = 0;
                    paths.forEach(path => {
                        const d = path.getAttribute('d') || '';
                        nodeCount += (d.match(/[MLCQS]/g) || []).length;
                    });

                    const svgSize = new Blob([svgString]).size;

                    UI.updateStats({
                        ...currentStats,
                        pathCount: paths.length,
                        nodeCount,
                        svgSize,
                        fileSize: svgSize
                    });
                } catch (e) {
                    console.warn('Could not update stats:', e);
                }
            }
        }
    }

    /**
     * Update color editor
     */
    function updateColors() {
        try {
            const colors = SVGOptimizer.getColors();
            UI.updateColorEditor(colors);
        } catch (e) {
            console.warn('Could not update colors:', e);
        }
    }

    /**
     * Change color
     */
    function changeColor(oldColor, newColor) {
        SVGOptimizer.changeColor(oldColor, newColor);
        refreshPreview();
        updateColors();
    }

    /**
     * Export as PNG
     */
    function exportPNG() {
        const svgString = SVGOptimizer.getSVGString() || currentSVG;
        if (!svgString) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Default size
        let width = 800, height = 800;

        // Try to get size from SVG
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgString, 'image/svg+xml');
        const svg = doc.querySelector('svg');
        if (svg) {
            const vb = svg.getAttribute('viewBox');
            if (vb) {
                const parts = vb.split(/\s+/).map(Number);
                if (parts.length >= 4) {
                    width = parts[2];
                    height = parts[3];
                }
            }
            const w = svg.getAttribute('width');
            const h = svg.getAttribute('height');
            if (w && !isNaN(parseFloat(w))) width = parseFloat(w);
            if (h && !isNaN(parseFloat(h))) height = parseFloat(h);
        }

        // Scale up for better quality
        const scale = 2;
        canvas.width = width * scale;
        canvas.height = height * scale;

        const img = new Image();
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            ctx.scale(scale, scale);
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);

            canvas.toBlob((blob) => {
                if (blob) {
                    Utils.downloadBlob(blob, 'logo-export.png');
                    UI.showNotification('PNG exported!', 'success');
                }
            });
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            UI.showNotification('Failed to export PNG', 'error');
        };

        img.src = url;
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public API
    return {
        processFile,
        changeColor
    };
})();
