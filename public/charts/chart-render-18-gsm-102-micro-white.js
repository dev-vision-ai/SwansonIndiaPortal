// Chart rendering utilities
// This file contains functions for rendering and updating charts

// Global chart instances storage
const chartInstances = new Map();

// Centralized Metric Specifications for all charts
const METRIC_SPECS = { 
    // Page 1 
    'basisWeightChart': { label: 'Basic Weight', usl: 20.00, tgt: 18.00, lsl: 16.00, min: 14, max: 22, unit: 'GSM', col: 'basis-weight', color: 'rgb(54, 162, 235)' }, 
    'thicknessChart':   { label: 'Thickness', usl: 0.065, tgt: 0.050, lsl: 0.040, min: 0.035, max: 0.070, unit: 'mm', col: 'thickness', color: 'rgb(255, 99, 132)' }, 
    'opacityChart':     { label: 'Opacity', usl: 55.0, tgt: 50.0, lsl: 45.0, min: 40, max: 60, unit: '%', col: 'opacity', color: 'rgb(75, 192, 192)' }, 
    'cofChart':         { label: 'COF Kinetic', usl: 0.60, tgt: 0.40, lsl: 0.20, min: 0.10, max: 0.70, unit: 'COF', col: 'cof', color: 'rgb(255, 159, 64)' }, 
    // Page 2 
    'elongationMDChart': { label: 'Elongation@ Break(%) MD', tgt: 450, lsl: 350, min: 300, max: 600, unit: '%', col: 'elongation-md', table: 'testingTableBody2', color: 'rgb(153, 102, 255)' }, 
    'tensileStrengthMDChart': { label: 'Force Tensile Strength@Break(N)MD', tgt: 13.0, lsl: 9.5, min: 8.0, max: 18.0, unit: 'N', col: 'tensile-strength-md', table: 'testingTableBody2', color: 'rgb(255, 205, 86)' }, 
    'tensileStrength5MDChart': { label: 'Force Elongation 5% (N) MD', usl: 5.0, tgt: 3.5, lsl: 2.0, min: 1.5, max: 6.0, unit: 'N', col: 'tensile-strength-5-md', table: 'testingTableBody2', color: 'rgb(76, 175, 80)' }, 
    // Page 3 
    'elongationCDChart': { label: 'Elongation@ Break (%) CD', tgt: 500, lsl: 400, min: 350, max: 650, unit: '%', col: 'elongation-cd', table: 'testingTableBody3', color: 'rgb(156, 39, 176)' }, 
    'tensileStrengthCDChart': { label: 'Force-Tensile Strength@Break (N) CD', tgt: 9.5, lsl: 6.5, min: 5.0, max: 14.0, unit: 'N', col: 'tensile-strength-cd', table: 'testingTableBody3', color: 'rgb(233, 30, 99)' }, 
    'modulusWebChart': { label: 'Modulus Web MD Fresh@2%', usl: 35.0, tgt: 25.0, lsl: 15.0, min: 10.0, max: 40.0, unit: 'N/cm', col: 'modulus-web', table: 'testingTableBody3', color: 'rgb(0, 150, 136)' }, 
    // Page 4 
    'colorLChart': { label: 'Color L', usl: 98.6, tgt: 94.6, lsl: 90.6, min: 88, max: 100, unit: 'H', col: 'color-l', table: 'testingTableBody4', color: 'rgb(121, 85, 72)' }, 
    'colorAChart': { label: 'Color A', usl: 2.9, tgt: -1.1, lsl: -5.1, min: -6, max: 4, unit: 'H', col: 'color-a', table: 'testingTableBody4', color: 'rgb(63, 81, 181)' }, 
    'colorBChart': { label: 'Color B', usl: 4.4, tgt: 0.4, lsl: -3.6, min: -6.00, max: 6.00, unit: 'H', col: 'color-b', table: 'testingTableBody4', color: 'rgb(0, 188, 212)' }, 
    'colorDeltaEChart': { label: 'Color Delta E', usl: 5.00, tgt: 0.00, min: 0, max: 6, unit: 'Delta E', col: 'color-delta-e', table: 'testingTableBody4', color: 'rgb(255, 87, 34)' }, 
    'glossChart': { label: 'Gloss', usl: 11.0, tgt: 7.0, min: 4, max: 14, unit: 'Gloss unit', col: 'gloss', table: 'testingTableBody4', color: 'rgb(0, 0, 0)' } 
};

// Format numbers with proper decimal places based on metric type
function formatChartValue(value, chartType = null) { 
    if (value === null || value === undefined || Number.isNaN(value)) return ''; 
    
    let specKey = (chartType === 'cof') ? 'cofChart' : chartType; 
    const spec = METRIC_SPECS[specKey]; 
    let decimals = 2; 

    if (spec) { 
        if (specKey === 'thicknessChart') decimals = 3; 
        else if (spec.unit === '%') decimals = specKey.includes('elongation') ? 0 : 1; 
        else if (['N', 'N/cm', 'Gloss unit'].includes(spec.unit)) decimals = 1; 
    } 
    return Number(value).toFixed(decimals); 
}

// Function to create a chart in a canvas element
function createChart(canvasId, chartType, data = null, customOptions = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        return null;
    }

    // Destroy existing chart if it exists
    if (chartInstances.has(canvasId)) {
        chartInstances.get(canvasId).destroy();
    }

    // Direct Chart.js configuration - don't use ChartConfig
    let config = {
        type: chartType || 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    position: 'top',
                    display: true,
                    labels: {
                        filter: function(legendItem, data) {
                            // Only show legend items for datasets with valid labels (not null)
                            return legendItem.text !== null && legendItem.text !== undefined && legendItem.text !== '';
                        }
                    }
                },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    position: 'nearest',
                    yAlign: 'top',
                    xAlign: 'center',
                    displayColors: false,
                    caretSize: 6,
                    caretPadding: 4,
                    backgroundColor: 'rgba(0,0,0,0.75)',
                    borderColor: 'rgba(0,0,0,0.12)',
                    borderWidth: 1,
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    filter: function(tooltipItem) {
                        // Only show tooltips for data lines with labels (not spec lines with null labels)
                        return tooltipItem.dataset.label !== null && tooltipItem.dataset.label !== undefined;
                    },
                    callbacks: {
                        title: function(context) {
                            const value = context[0]?.parsed?.y ?? context[0]?.raw?.y;
                            return `${formatChartValue(value)}`;
                        },
                        label: function(context) {
                            return context.dataset.label || '';
                        }
                    },
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 12
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return value === undefined || value === null ? '' : value;
                        }
                    }
                }
            }
        }
    };

    // Update data if provided
    if (data) {
        if (data.labels) config.data.labels = data.labels;
        if (data.datasets) {
            // Filter out null/undefined values from datasets
            config.data.datasets = data.datasets.map(ds => ({
                ...ds,
                data: ds.data ? ds.data.map(d => d === null ? undefined : d) : []
            }));
        }
    }

    // Merge custom options
    if (customOptions) {
        config.options = {
            ...config.options,
            ...customOptions,
            plugins: {
                ...config.options.plugins,
                ...(customOptions.plugins || {})
            },
            scales: {
                ...config.options.scales,
                ...(customOptions.scales || {})
            }
        };
    }

    // Create new chart
    const chart = new Chart(canvas, config);
    chartInstances.set(canvasId, chart);

    return chart;
}

// Function to update chart data
function updateChartData(canvasId, newData) {
    const chart = chartInstances.get(canvasId);
    if (!chart) {
        return false;
    }

    if (newData.labels) {
        chart.data.labels = newData.labels;
    }

    if (newData.datasets) {
        chart.data.datasets = newData.datasets;
    }

    chart.update();
    return true;
}

// Function to add data point to chart
function addDataPoint(canvasId, label, dataPoint) {
    const chart = chartInstances.get(canvasId);
    if (!chart) {
        return false;
    }

    if (label && !chart.data.labels.includes(label)) {
        chart.data.labels.push(label);
    }

    chart.data.datasets.forEach((dataset, index) => {
        if (Array.isArray(dataPoint)) {
            dataset.data.push(dataPoint[index] || 0);
        } else {
            dataset.data.push(dataPoint);
        }
    });

    chart.update();
    return true;
}

// Function to remove data point from chart
function removeDataPoint(canvasId, index = -1) {
    const chart = chartInstances.get(canvasId);
    if (!chart) {
        return false;
    }

    if (index >= 0 && index < chart.data.labels.length) {
        chart.data.labels.splice(index, 1);
        chart.data.datasets.forEach(dataset => {
            dataset.data.splice(index, 1);
        });
        chart.update();
        return true;
    }

    return false;
}

// Function to create inspection results chart from form data
function createInspectionResultsChart(canvasId, passCount = 0, failCount = 0, pendingCount = 0) {
    const data = {
        datasets: [{
            data: [passCount, failCount, pendingCount],
            backgroundColor: [
                'rgba(75, 192, 192, 0.6)',
                'rgba(255, 99, 132, 0.6)',
                'rgba(255, 206, 86, 0.6)'
            ],
            borderColor: [
                'rgb(75, 192, 192)',
                'rgb(255, 99, 132)',
                'rgb(255, 206, 86)'
            ],
            borderWidth: 1
        }]
    };

    return createChart(canvasId, 'inspectionResults', data);
}

// Function to create defect rate trend chart
function createDefectRateChart(canvasId, labels = [], defectRates = []) {
    const data = {
        labels: labels,
        datasets: [{
            label: 'Defect Rate (%)',
            data: defectRates,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            tension: 0.1
        }]
    };

    return createChart(canvasId, 'defectRate', data);
}

// Function to create thickness distribution chart
function createThicknessChart(canvasId, measurements = []) {
    const data = {
        datasets: [{
            label: 'Thickness Measurements',
            data: measurements.map((value, index) => ({ x: index + 1, y: value })),
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgb(54, 162, 235)',
            borderWidth: 1
        }]
    };

    return createChart(canvasId, 'thicknessDistribution', data);
}

// Function to destroy all charts
function destroyAllCharts() {
    chartInstances.forEach((chart, canvasId) => {
        chart.destroy();
    });
    chartInstances.clear();
}

// Function to destroy specific chart
function destroyChart(canvasId) {
    const chart = chartInstances.get(canvasId);
    if (chart) {
        chart.destroy();
        chartInstances.delete(canvasId);
        return true;
    }
    return false;
}

/**
 * Helper to generate dataset for specification limits (USL/LSL/TGT)
 */
function createLimitDataset(value, color, isBold, length) { 
    return { 
        label: null, // Keeps legend clean 
        data: Array(length).fill(value), 
        borderColor: color, 
        borderDash: [5, 5], 
        borderWidth: isBold ? 2 : 1, 
        pointRadius: 0, 
        fill: false 
    }; 
} 

/**
 * Private helper to add limit lines (USL, LSL, TGT) to datasets
 */
function _addLimitLines(datasets, spec, length) {
    if (spec.tgt !== undefined) datasets.push(createLimitDataset(spec.tgt, 'rgb(34, 197, 94)', true, length)); 
    if (spec.lsl !== undefined) datasets.push(createLimitDataset(spec.lsl, 'rgb(239, 68, 68)', false, length)); 
    if (spec.usl !== undefined) datasets.push(createLimitDataset(spec.usl, 'rgb(239, 68, 68)', false, length)); 
}

/**
 * Core function to render multiple charts based on metric IDs
 */
async function renderMetricCharts(metricIds, dbData = null) { 
    metricIds.forEach(id => { 
        const spec = METRIC_SPECS[id]; 
        if (!spec) return; 

        const result = getMetricData(spec, dbData); 
        const data = result.data || []; 
        const displayLen = 30; 
        const paddedData = [...data, ...Array(displayLen - data.length).fill(undefined)]; 
        const labels = Array.from({length: displayLen}, (_, i) => (i + 1).toString()); 

        const datasets = [{ 
            label: spec.label, 
            data: paddedData, 
            borderColor: spec.color || 'rgb(54, 162, 235)', 
            backgroundColor: (spec.color || 'rgb(54, 162, 235)').replace('rgb', 'rgba').replace(')', ', 0.2)'), 
            tension: 0.3, 
            pointRadius: 5, 
            pointHoverRadius: 7,
            pointBackgroundColor: spec.color || 'rgb(54, 162, 235)',
            borderWidth: 2 
        }]; 

        _addLimitLines(datasets, spec, displayLen);

        createChart(id, 'line', { labels, datasets }, { 
            plugins: { 
                title: { 
                    display: true, 
                    text: spec.label 
                }, 
                tooltip: {
                    position: 'nearest',
                    yAlign: 'top',
                    displayColors: false,
                    backgroundColor: 'rgba(0,0,0,0.75)',
                    borderColor: 'rgba(0,0,0,0.12)',
                    borderWidth: 1,
                    caretPadding: 6,
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    callbacks: {
                        title: function(context) {
                            const value = context[0]?.parsed?.y ?? context[0]?.raw?.y;
                            return `${formatChartValue(value, id)}`;
                        },
                        label: function(context) {
                            if (context.dataset.label === null || context.dataset.label === undefined) return '';
                            return context.dataset.label || '';
                        }
                    },
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 12
                    }
                }
            }, 
            scales: { 
                y: { 
                    min: spec.min, 
                    max: spec.max, 
                    title: { 
                        display: true, 
                        text: spec.unit === 'H' ? 'Color units-H' : (spec.unit === 'Delta E' ? 'Color units-Delta E' : spec.unit) 
                    },
                    ticks: {
                        callback: function(value) {
                            return formatChartValue(value, id);
                        }
                    }
                } 
            } 
        }); 
    }); 
}

// Film Inspection Form Chart Integration
const graphsVisible = {};

// Initialize graph toggle functionality for all pages
function initializeGraphToggle() {
    // Page 1 (existing) - special case, no number suffix
    initializePageToggle(1, true);
    
    // Page 2
    initializePageToggle(2);
    
    // Page 3
    initializePageToggle(3);
    
    // Page 4
    initializePageToggle(4);
}

// Helper function to initialize toggle for a specific page
function initializePageToggle(pageNum, isPage1 = false) {
    const suffix = isPage1 ? '' : pageNum.toString();
    const toggleBtn = document.getElementById(`toggleGraphsBtn${suffix}`);
    const graphsSection = document.getElementById(`graphsSection${suffix}`);
    const toggleText = document.getElementById(`toggleText${suffix}`);
    const toggleIcon = document.getElementById(`toggleIcon${suffix}`);

    if (toggleBtn && graphsSection) {
        // Initialize visibility state
        graphsVisible[pageNum] = false;
        
        toggleBtn.addEventListener('click', async function() {
            graphsVisible[pageNum] = !graphsVisible[pageNum];

            if (graphsVisible[pageNum]) {
                graphsSection.style.display = 'block';
                toggleText.textContent = 'Hide Trend';
                toggleIcon.className = 'fas fa-chevron-up';
                // Initialize charts when shown
                if (pageNum === 1) {
                    await initializeInspectionCharts();
                } else if (pageNum === 2) {
                    await initializeInspectionChartsPage2();
                } else if (pageNum === 3) {
                    await initializeInspectionChartsPage3();
                } else if (pageNum === 4) {
                    await initializeInspectionChartsPage4();
                }
            } else {
                graphsSection.style.display = 'none';
                toggleText.textContent = 'View Trend';
                toggleIcon.className = 'fas fa-chevron-down';
            }
        });
    }
}

// Initialize inspection charts with sample data
async function initializeInspectionCharts() { 
    const dbData = await fetchInspectionDataFromDB(); 
    await renderMetricCharts(['basisWeightChart', 'thicknessChart', 'opacityChart', 'cofChart'], dbData); 
} 

// Initialize inspection charts for Page 2
async function initializeInspectionChartsPage2() { 
    await renderMetricCharts(['elongationMDChart', 'tensileStrengthMDChart', 'tensileStrength5MDChart']); 
} 

// Initialize inspection charts for Page 3
async function initializeInspectionChartsPage3() { 
    await renderMetricCharts(['elongationCDChart', 'tensileStrengthCDChart', 'modulusWebChart']); 
} 

// Initialize inspection charts for Page 4
async function initializeInspectionChartsPage4() { 
    await renderMetricCharts(['colorLChart', 'colorAChart', 'colorBChart', 'colorDeltaEChart', 'glossChart']); 
}

// Fetch data from database (Supabase)
async function fetchInspectionDataFromDB() {
    try {
        // Import supabase config
        const { supabase } = await import('../supabase-config.js');
        
        // Try to get form_id from URL parameters or form data
        const urlParams = new URLSearchParams(window.location.search);
        let formId = urlParams.get('form_id');
        
        // If no form_id in URL, try to get it from page data
        if (!formId) {
            const formIdElement = document.querySelector('[data-form-id]');
            if (formIdElement) {
                formId = formIdElement.getAttribute('data-form-id');
            }
        }
        
        // If still no form_id, return null
        if (!formId) {
            return null;
        }
        
        // Film inspection tables: product-specific format
        const filmTableNames = [
            '102_18c_micro_white', // Prioritized for this product
            '168_16c_white',
            '168_16cp_kranti',
            '176_18cp_ww',
            '168_18c_white_jeddah',
            '214_18_micro_white',
            'uc_18gsm_250p_abqr',
            'uc_18gsm_290p_abqr',
            'uc_18gsm_290np_abqr',
            'uc_18gsm_250w_bfqr',
            'uc_18gsm_210w_bfqr',
            '234_18_micro_white',
            '168_18c_white',
            'uc_16gsm_165w'
        ];
        
        // Try each table to find the form
        for (const tableName of filmTableNames) {
            try {
                const { data, error } = await supabase
                    .from(tableName)
                    .select('*')
                    .eq('form_id', formId)
                    .order('sample_no', { ascending: true });
                
                if (!error && data && data.length > 0) {
                    
                    // Extract the first 30 samples
                    const samples = data.slice(0, 30);
                    
                    // Build data array with proper field mapping
                    const processedData = samples.map((row, index) => ({
                        sample_no: index + 1,
                        basis_weight: parseFloat(row.basis_weight) || null,
                        thickness: parseFloat(row.thickness) || null,
                        opacity: parseFloat(row.opacity) || null,
                        cof_kinetic: parseFloat(row.cof_kinetic) || null
                    }));
                    
                    return processedData;
                }
            } catch (tableError) {
                continue;
            }
        }
        
        // If no data found in any table
        return null;
        
    } catch (error) {
        console.error('Error fetching data from database:', error);
        return null;
    }
}

/**
 * Unified data extraction function for all pages and data sources
 * @param {Object} spec - Metric specification from METRIC_SPECS
 * @param {Array} dbData - Optional database data from Supabase
 * @returns {Object} { data: Array, sampleNumbers: Array }
 */
function getMetricData(spec, dbData = null) {
    const { col: columnType, table: tableBodyId = 'testingTableBody' } = spec;
    
    // 1. Try DB data first (Primary for Page 1 if available)
    if (dbData && dbData.length > 0) {
        const dbValues = dbData.map(row => {
            let value = null;
            switch (columnType) {
                case 'basis-weight': value = row.basis_weight; break;
                case 'thickness': value = row.thickness; break;
                case 'opacity': value = row.opacity; break;
                case 'cof': value = row.cof_kinetic; break;
            }
            return value;
        }).filter(v => v !== null);

        if (dbValues.length > 0) {
            return {
                data: dbValues,
                sampleNumbers: dbData.map(r => r.sample_no)
            };
        }
    }

    // 2. Fallback to DOM extraction (for all pages)
    const tableBody = document.getElementById(tableBodyId);
    if (!tableBody) return { data: [], sampleNumbers: [] };

    const rows = Array.from(tableBody.querySelectorAll('tr:not(.average-row)'));
    const data = [];
    const sampleNumbers = [];

    // Helper to get value from cell (handles both text and inputs)
    const getCellValue = (cell) => {
        if (!cell) return null;
        const input = cell.querySelector('input');
        if (input) return input.value;
        return cell.textContent.trim();
    };

    rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 0) return;

        // Skip summary rows that might not have the .average-row class (like Minimum/Maximum)
        const firstCellText = cells[0]?.textContent?.trim();
        if (['Average', 'Minimum', 'Maximum', 'Std. Dev.', 'Range'].includes(firstCellText)) return;

        let value = null;
        let sampleNo = index + 1;

        // Extract value based on column type and table structure
        if (tableBodyId === 'testingTableBody') {
            // Page 1 structure
            switch (columnType) {
                case 'basis-weight': value = getCellValue(cells[3]); break;
                case 'thickness':    value = getCellValue(cells[4]); break;
                case 'opacity':      value = getCellValue(cells[5]); break;
                case 'cof':          value = getCellValue(cells[6]); break;
            }
        } else if (tableBodyId === 'testingTableBody2') {
            // Page 2 structure (MD properties) - Use Average column (indices 6, 10, 14)
            switch (columnType) {
                case 'elongation-md':         value = getCellValue(cells[6]); break;
                case 'tensile-strength-md':   value = getCellValue(cells[10]); break;
                case 'tensile-strength-5-md': value = getCellValue(cells[14]); break;
            }
        } else if (tableBodyId === 'testingTableBody3') {
            // Page 3 structure (CD properties) - Use Average column (indices 6, 10, 14)
            switch (columnType) {
                case 'elongation-cd':       value = getCellValue(cells[6]); break;
                case 'tensile-strength-cd': value = getCellValue(cells[10]); break;
                case 'modulus-web':         value = getCellValue(cells[14]); break;
            }
        } else if (tableBodyId === 'testingTableBody4') {
            // Page 4 structure (Color & Gloss)
            switch (columnType) {
                case 'color-l':       value = getCellValue(cells[3]); break;
                case 'color-a':       value = getCellValue(cells[4]); break;
                case 'color-b':       value = getCellValue(cells[5]); break;
                case 'color-delta-e': value = getCellValue(cells[6]); break;
                case 'gloss':         value = getCellValue(cells[10]); break;
            }
        }

        const numericValue = parseFloat(value);
        if (!isNaN(numericValue)) {
            data.push(numericValue);
            sampleNumbers.push(sampleNo);
        }
    });

    return { data, sampleNumbers };
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeGraphToggle();
});

// Export initialization function to window for HTML access
window.ChartRenderer = {
    initialize: initializeGraphToggle,
    update: async () => {
        if (graphsVisible[1]) await initializeInspectionCharts();
        if (graphsVisible[2]) await initializeInspectionChartsPage2();
        if (graphsVisible[3]) await initializeInspectionChartsPage3();
        if (graphsVisible[4]) await initializeInspectionChartsPage4();
    }
};
