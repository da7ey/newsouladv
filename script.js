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
                if (currentFile) {
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
            refreshPreview();
        });

        document.getElementById('toggleStrokeBtn')?.addEventListener('click', (e) => {
            showStroke = !showStroke;
            e.currentTarget.classList.toggle('active', showStroke);
            SVGOptimizer.toggleStroke(showStroke);
            refreshPreview();
        });

        // Undo/Redo
        document.getElementById('undoBtn')?.addEventListener('click', () => {
            if (SVGOptimizer.undo()) {
                refreshPreview();
                UI.showNotification('Undo successful', 'success');
            }
        });

        document.getElementById('redoBtn')?.addEventListener('click', () => {
            if (SVGOptimizer.redo()) {
                refreshPreview();
                UI.showNotification('Redo successful', 'success');
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
            if (!currentSVG) return;
            const optimized = SVGOptimizer.getSVGString();
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
            if (!currentSVG) return;
            const success = await Utils.copyToClipboard(currentSVG);
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

            // Update UI
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

        } catch (error) {
            console.error('Processing error:', error);
            UI.showNotification('Error: ' + error.message, 'error');
            UI.showSection('uploadSection');
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
        }

        if (imgElement) {
            imgElement.style.transform = `scale(${zoomLevel})`;
            imgElement.style.transformOrigin = 'center center';
        }
    }

    /**
     * Refresh SVG preview
     */
    function refreshPreview() {
        const svgString = SVGOptimizer.getSVGString();
        UI.setSVGPreview(svgString);

        // Update stats
        if (currentStats) {
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
        }
    }

    /**
     * Update color editor
     */
    function updateColors() {
        const colors = SVGOptimizer.getColors();
        UI.updateColorEditor(colors);
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
        if (!currentSVG) return;

        const svgElement = document.querySelector('#svgPreview svg');
        if (!svgElement) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const bbox = svgElement.getBBox ? svgElement.getBBox() : 
                     { width: 500, height: 500 };

        canvas.width = bbox.width || 500;
        canvas.height = bbox.height || 500;

        const img = new Image();
        const svgBlob = new Blob([currentSVG], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);

            canvas.toBlob((blob) => {
                Utils.downloadBlob(blob, 'logo-export.png');
                UI.showNotification('PNG exported!', 'success');
            });
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
