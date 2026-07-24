/**
 * ============================================
 * UI Module - User Interface Management
 * Logo to SVG Converter
 * ============================================
 */

const UI = (function() {
    'use strict';

    // DOM Elements cache
    const elements = {};

    /**
     * Initialize UI module
     */
    function init() {
        cacheElements();
        bindEvents();
    }

    /**
     * Cache DOM elements
     */
    function cacheElements() {
        const ids = [
            'dropZone', 'fileInput', 'browseBtn',
            'uploadSection', 'processingSection', 'editorSection',
            'progressBar', 'progressFill', 'progressText',
            'warningBanner', 'comparisonContainer', 'comparisonSlider',
            'beforeImage', 'afterImage', 'originalImg', 'svgPreview',
            'zoomInBtn', 'zoomOutBtn', 'fitScreenBtn', 'toggleGridBtn',
            'toggleFillBtn', 'toggleStrokeBtn', 'undoBtn', 'redoBtn',
            'threshold', 'thresholdValue',
            'numColors', 'colorsValue',
            'cornerThreshold', 'cornerValue',
            'lineThreshold', 'lineValue',
            'pathOmit', 'pathOmitValue',
            'noiseReduction', 'smoothCurves',
            'removeBackground', 'transparentBg',
            'autoOptimize', 'autoCenter', 'autoViewBox',
            'reconvertBtn',
            'statPaths', 'statNodes', 'statSize', 'statCompression',
            'statColors', 'statQuality', 'statLaser', 'statFileSize',
            'qualityBadge', 'qualityStars', 'qualityLabel',
            'colorEditor', 'colorList', 'mergeColorsBtn',
            'downloadSvgBtn', 'downloadOptimizedBtn', 'downloadPngBtn', 'copyClipboardBtn'
        ];

        ids.forEach(id => {
            elements[id] = document.getElementById(id);
        });
    }

    /**
     * Bind UI events
     */
    function bindEvents() {
        // File upload
        if (elements.browseBtn) {
            elements.browseBtn.addEventListener('click', () => elements.fileInput.click());
        }

        // Drag and drop
        if (elements.dropZone) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                elements.dropZone.addEventListener(eventName, preventDefaults, false);
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                elements.dropZone.addEventListener(eventName, () => {
                    elements.dropZone.classList.add('dragover');
                }, false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                elements.dropZone.addEventListener(eventName, () => {
                    elements.dropZone.classList.remove('dragover');
                }, false);
            });

            elements.dropZone.addEventListener('drop', handleDrop, false);
        }

        // Settings sliders
        bindSlider('threshold', 'thresholdValue');
        bindSlider('numColors', 'colorsValue');
        bindSlider('cornerThreshold', 'cornerValue');
        bindSlider('lineThreshold', 'lineValue');
        bindSlider('pathOmit', 'pathOmitValue');

        // Comparison slider
        if (elements.comparisonSlider) {
            initComparisonSlider();
        }
    }

    /**
     * Prevent default events
     */
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * Handle file drop
     */
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    }

    /**
     * Handle file selection
     */
    function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            showNotification('Please select an image file', 'error');
            return;
        }

        if (window.App && window.App.processFile) {
            window.App.processFile(file);
        }
    }

    /**
     * Bind slider to value display
     */
    function bindSlider(sliderId, valueId) {
        const slider = elements[sliderId];
        const value = elements[valueId];

        if (slider && value) {
            slider.addEventListener('input', () => {
                value.textContent = slider.value;
            });
        }
    }

    /**
     * Initialize comparison slider
     */
    function initComparisonSlider() {
        let isDragging = false;
        const slider = elements.comparisonSlider;
        const wrapper = elements.comparisonContainer.querySelector('.comparison-wrapper');
        const beforeImage = elements.beforeImage;

        function updateSlider(x) {
            const rect = wrapper.getBoundingClientRect();
            let percent = ((x - rect.left) / rect.width) * 100;
            percent = Utils.clamp(percent, 0, 100);

            slider.style.left = percent + '%';
            beforeImage.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
        }

        slider.addEventListener('mousedown', () => isDragging = true);
        document.addEventListener('mouseup', () => isDragging = false);
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            updateSlider(e.clientX);
        });

        // Touch support
        slider.addEventListener('touchstart', () => isDragging = true);
        document.addEventListener('touchend', () => isDragging = false);
        document.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            updateSlider(e.touches[0].clientX);
        });
    }

    /**
     * Show section
     */
    function showSection(sectionName) {
        ['uploadSection', 'processingSection', 'editorSection'].forEach(name => {
            if (elements[name]) {
                elements[name].classList.toggle('hidden', name !== sectionName);
            }
        });
    }

    /**
     * Update progress bar
     */
    function updateProgress(percent, text) {
        if (elements.progressFill) {
            elements.progressFill.style.width = percent + '%';
        }
        if (elements.progressText) {
            elements.progressText.textContent = text;
        }
    }

    /**
     * Show warning banner
     */
    function showWarning(show) {
        if (elements.warningBanner) {
            elements.warningBanner.classList.toggle('hidden', !show);
        }
    }

    /**
     * Set original image
     */
    function setOriginalImage(src) {
        if (elements.originalImg) {
            elements.originalImg.src = src;
        }
    }

    /**
     * Set SVG preview
     */
    function setSVGPreview(svgString) {
        if (elements.svgPreview) {
            elements.svgPreview.innerHTML = svgString;
        }
    }

    /**
     * Update statistics
     */
    function updateStats(stats) {
        if (elements.statPaths) elements.statPaths.textContent = stats.pathCount.toLocaleString();
        if (elements.statNodes) elements.statNodes.textContent = stats.nodeCount.toLocaleString();
        if (elements.statSize) elements.statSize.textContent = Utils.formatBytes(stats.svgSize);
        if (elements.statCompression) elements.statCompression.textContent = stats.compression + '%';
        if (elements.statColors) elements.statColors.textContent = stats.colorCount;
        if (elements.statQuality) elements.statQuality.textContent = stats.quality;
        if (elements.statLaser) elements.statLaser.textContent = stats.laserCompatible ? 'Yes' : 'No';
        if (elements.statFileSize) elements.statFileSize.textContent = Utils.formatBytes(stats.fileSize);

        // Quality badge
        if (elements.qualityStars) {
            const starStr = '★'.repeat(stats.stars) + '☆'.repeat(5 - stats.stars);
            elements.qualityStars.textContent = starStr;
        }
        if (elements.qualityLabel) {
            elements.qualityLabel.textContent = stats.quality;
            elements.qualityLabel.style.color = stats.stars >= 4 ? '#22C55E' : 
                                                stats.stars >= 3 ? '#F59E0B' : '#EF4444';
        }
    }

    /**
     * Update color editor
     */
    function updateColorEditor(colors) {
        if (!elements.colorList) return;

        elements.colorList.innerHTML = '';

        colors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;

            const input = document.createElement('input');
            input.type = 'color';
            input.value = color.startsWith('#') ? color : '#000000';
            input.addEventListener('change', (e) => {
                if (window.App && window.App.changeColor) {
                    window.App.changeColor(color, e.target.value);
                }
            });

            swatch.appendChild(input);
            elements.colorList.appendChild(swatch);
        });

        if (elements.colorEditor) {
            elements.colorEditor.classList.remove('hidden');
        }
    }

    /**
     * Show notification
     */
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            background: ${type === 'error' ? '#EF4444' : type === 'success' ? '#22C55E' : '#7A2BFF'};
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Get current settings
     */
    function getSettings() {
        return {
            threshold: parseInt(elements.threshold?.value || 128),
            numColors: parseInt(elements.numColors?.value || 16),
            cornerThreshold: parseFloat(elements.cornerThreshold?.value || 1.0),
            lineThreshold: parseFloat(elements.lineThreshold?.value || 1.0),
            pathOmit: parseInt(elements.pathOmit?.value || 8),
            noiseReduction: elements.noiseReduction?.checked || false,
            smoothCurves: elements.smoothCurves?.checked || false,
            removeBackground: elements.removeBackground?.checked || false,
            transparentBg: elements.transparentBg?.checked || false,
            autoOptimize: elements.autoOptimize?.checked || false,
            autoCenter: elements.autoCenter?.checked || false,
            autoViewBox: elements.autoViewBox?.checked || false
        };
    }

    /**
     * Toggle grid background
     */
    function toggleGrid(show) {
        const wrapper = elements.comparisonContainer?.querySelector('.comparison-wrapper');
        if (wrapper) {
            wrapper.classList.toggle('grid-bg', show);
        }
    }

    // Public API
    return {
        init,
        showSection,
        updateProgress,
        showWarning,
        setOriginalImage,
        setSVGPreview,
        updateStats,
        updateColorEditor,
        showNotification,
        getSettings,
        toggleGrid,
        elements
    };
})();
