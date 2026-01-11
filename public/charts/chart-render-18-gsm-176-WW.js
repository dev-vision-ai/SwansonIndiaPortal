// Chart rendering utilities for 18 GSM 176 WW
// This file contains functions for rendering and updating charts

// Global chart instances storage
const chartInstances = new Map();

// Centralized Metric Specifications for 18 GSM 176 WW
const METRIC_SPECS = { 
    // Page 1 
    'basisWeightChart': { label: 'Basic Weight', usl: 20.00, tgt: 18.00, lsl: 16.00, min: 14, max: 22, unit: 'GSM', col: 'basis-weight', color: 'rgb(54, 162, 235)' }, 
    'thicknessChart':   { label: 'Thickness', usl: 0.035, tgt: 0.030, lsl: 0.025, min: 0.022, max: 0.038, unit: 'mm', col: 'thickness', color: 'rgb(255, 99, 132)' }, 
    'opacityChart':     { label: 'Opacity', usl: 55.0, tgt: 50.0, lsl: 45.0, min: 40, max: 60, unit: '%', col: 'opacity', color: 'rgb(16, 185, 129)' }, 
    'cofChart':         { label: 'COF Kinetic', usl: 0.60, tgt: 0.40, lsl: 0.20, min: 0.10, max: 0.70, unit: 'COF', col: 'cof', color: 'rgb(255, 159, 64)' }, 
    'cutWidthChart':    { label: 'Cut Width', usl: 178, tgt: 176, lsl: 174, min: 170, max: 182, unit: 'mm', col: 'cut-width', color: 'rgb(255, 205, 86)' }, 
    'colorDeltaEUnprintedChart': { label: 'Color-Delta E (Unprinted Film) 10 Layers', usl: 4.00, tgt: 0.00, min: 0, max: 5, unit: 'Delta E', col: 'color-delta-e-unprinted', color: 'rgb(153, 102, 255)' }, 
    'colorDeltaEPrintedChart':   { label: 'Color-Delta E (Printed Film) 1 Layer', usl: 4.00, tgt: 0.00, min: 0, max: 5, unit: 'Delta E', col: 'color-delta-e-printed', color: 'rgb(79, 70, 229)' }, 
    // Page 2 
    'elongationMDChart': { label: 'Elongation@ Break(%) MD', tgt: 450, lsl: 350, min: 300, max: 600, unit: '%', col: 'elongation-md', table: 'testingTableBody2', color: 'rgb(6, 182, 212)' }, 
    'tensileStrengthMDChart': { label: 'Force~Tensile Strength@Break(N)MD', tgt: 13.0, lsl: 9.5, min: 8.0, max: 16.0, unit: 'N', col: 'tensile-strength-md', table: 'testingTableBody2', color: 'rgb(244, 63, 94)' }, 
    'tensileStrength5MDChart': { label: 'Force-Tensile Strength 5% MD (N)', usl: 5.5, tgt: 4.0, lsl: 2.5, min: 2.0, max: 6.0, unit: 'N', col: 'tensile-strength-5-md', table: 'testingTableBody2', color: 'rgb(245, 158, 11)' }, 
    // Page 3 
    'elongationCDChart': { label: 'Elongation@ Break (%) CD', tgt: 500, lsl: 400, min: 350, max: 650, unit: '%', col: 'elongation-cd', table: 'testingTableBody3', color: 'rgb(14, 165, 233)' }, 
    'tensileStrengthCDChart': { label: 'Force~Tensile Strength@Break (N) CD', tgt: 9.5, lsl: 6.5, min: 5.0, max: 12.0, unit: 'N', col: 'tensile-strength-cd', table: 'testingTableBody3', color: 'rgb(225, 29, 72)' }, 
    'modulusWebChart': { label: 'Modulus Web@ 2%', usl: 40.0, tgt: 30.0, lsl: 20.0, min: 15.0, max: 45.0, unit: 'N/cm', col: 'modulus-web', table: 'testingTableBody3', color: 'rgb(20, 184, 166)' }, 
    // Page 4 
    'glossChart': { label: 'Gloss', usl: 11.0, tgt: 9.0, min: 6, max: 14, unit: 'Gloss unit', col: 'gloss', table: 'testingTableBody4', color: 'rgb(0, 0, 0)' } 
};

// Format numbers with proper decimal places based on metric type
function formatChartValue(value, chartType = null) { 
    if (value === null || value === undefined || Number.isNaN(value)) return ''; 
    
    let specKey = (chartType === 'cof') ? 'cofChart' : chartType; 
    const spec = METRIC_SPECS[specKey]; 
    let decimals = 2; 

    if (spec) { 
        if (spec.unit === '%') decimals = specKey.includes('elongation') ? 0 : 1; 
        else if (['N', 'N/cm', 'Gloss unit', 'mm'].includes(spec.unit)) {
            decimals = (specKey === 'thicknessChart') ? 3 : 1;
            if (specKey === 'cutWidthChart') decimals = 0;
        } 
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

    // Direct Chart.js configuration
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
                    caretPadding: 6,
                    backgroundColor: 'rgba(0,0,0,0.75)',
                    borderColor: 'rgba(0,0,0,0.12)',
                    borderWidth: 1,
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    filter: function(tooltipItem) {
                        return tooltipItem.dataset.label !== null && tooltipItem.dataset.label !== undefined;
                    },
                    callbacks: {
                        title: function(context) {
                            const value = context[0]?.parsed?.y ?? context[0]?.raw?.y;
                            return `${formatChartValue(value, canvasId)}`;
                        },
                        label: function(context) {
                            const value = context.parsed?.y ?? context.raw?.y;
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

    if (data) {
        if (data.labels) config.data.labels = data.labels;
        if (data.datasets) {
            config.data.datasets = data.datasets.map(ds => ({
                ...ds,
                data: ds.data ? ds.data.map(d => d === null ? undefined : d) : []
            }));
        }
    }

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

// Helper to generate dataset for specification limits (USL/LSL/TGT)
function createLimitDataset(value, color, isBold, length) { 
    return { 
        label: null, 
        data: Array(length).fill(value), 
        borderColor: color, 
        borderDash: [5, 5], 
        borderWidth: isBold ? 2 : 1, 
        pointRadius: 0, 
        fill: false 
    }; 
} 

// Private helper to add limit lines (USL, LSL, TGT) to datasets
function _addLimitLines(datasets, spec, length) {
    if (spec.tgt !== undefined) datasets.push(createLimitDataset(spec.tgt, 'rgb(34, 197, 94)', true, length)); 
    if (spec.lsl !== undefined) datasets.push(createLimitDataset(spec.lsl, 'rgb(239, 68, 68)', false, length)); 
    if (spec.usl !== undefined) datasets.push(createLimitDataset(spec.usl, 'rgb(239, 68, 68)', false, length)); 
}

// Core function to render multiple charts based on metric IDs
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
                    caretPadding: 4,
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

const graphsVisible = {};

// Initialize graph toggle functionality for all pages
function initializeGraphToggle() {
    initializePageToggle(1, true);
    initializePageToggle(2);
    initializePageToggle(3);
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
        graphsVisible[pageNum] = false;
        
        toggleBtn.addEventListener('click', async function() {
            graphsVisible[pageNum] = !graphsVisible[pageNum];

            if (graphsVisible[pageNum]) {
                graphsSection.style.display = 'block';
                toggleText.textContent = 'Hide Trend';
                toggleIcon.className = 'fas fa-chevron-up';
                if (pageNum === 1) await initializeInspectionCharts();
                else if (pageNum === 2) await initializeInspectionChartsPage2();
                else if (pageNum === 3) await initializeInspectionChartsPage3();
                else if (pageNum === 4) await initializeInspectionChartsPage4();
            } else {
                graphsSection.style.display = 'none';
                toggleText.textContent = 'View Trend';
                toggleIcon.className = 'fas fa-chevron-down';
            }
        });
    }
}

// Initialize inspection charts for each page
async function initializeInspectionCharts() { 
    const dbData = await fetchInspectionDataFromDB(); 
    await renderMetricCharts(['basisWeightChart', 'thicknessChart', 'opacityChart', 'cofChart', 'cutWidthChart', 'colorDeltaEUnprintedChart', 'colorDeltaEPrintedChart'], dbData); 
} 

async function initializeInspectionChartsPage2() { 
    await renderMetricCharts(['elongationMDChart', 'tensileStrengthMDChart', 'tensileStrength5MDChart']); 
} 

async function initializeInspectionChartsPage3() { 
    await renderMetricCharts(['elongationCDChart', 'tensileStrengthCDChart', 'modulusWebChart']); 
} 

async function initializeInspectionChartsPage4() { 
    await renderMetricCharts(['glossChart']); 
}

// Fetch data from database (Supabase)
async function fetchInspectionDataFromDB() {
    try {
        const { supabase } = await import('../supabase-config.js');
        const urlParams = new URLSearchParams(window.location.search);
        let formId = urlParams.get('form_id');
        if (!formId) return null;
        
        const { data, error } = await supabase
            .from('176_18cp_ww')
            .select('*')
            .eq('form_id', formId)
            .order('sample_no', { ascending: true });
        
        if (!error && data && data.length > 0) {
            const samples = data.slice(0, 30);
            return samples.map((row, index) => ({
                sample_no: index + 1,
                basis_weight: parseFloat(row.page1_basis_weight) || null,
                thickness: parseFloat(row.page1_thickness) || null,
                opacity: parseFloat(row.page1_opacity) || null,
                cof_kinetic: parseFloat(row.page1_cof_kinetic) || null,
                cut_width: parseFloat(row.page1_cut_width) || null,
                color_delta_unprinted: parseFloat(row.page1_color_delta_unprinted) || null,
                color_delta_printed: parseFloat(row.page1_color_delta_printed) || null,
                gloss: parseFloat(row.page4_gloss_avg) || null
            }));
        }
        return null;
    } catch (error) {
        console.error('Error fetching data from database:', error);
        return null;
    }
}

// Unified data extraction function
function getMetricData(spec, dbData = null) {
    const { col: columnType, table: tableBodyId = 'testingTableBody' } = spec;
    
    if (dbData && dbData.length > 0) {
        const dbValues = dbData.map(row => {
            let value = null;
            switch (columnType) {
                case 'basis-weight': value = row.basis_weight; break;
                case 'thickness': value = row.thickness; break;
                case 'opacity': value = row.opacity; break;
                case 'cof': value = row.cof_kinetic; break;
                case 'cut-width': value = row.cut_width; break;
                case 'color-delta-e-unprinted': value = row.color_delta_unprinted; break;
                case 'color-delta-e-printed': value = row.color_delta_printed; break;
                case 'gloss': value = row.gloss; break;
            }
            const numValue = parseFloat(value);
            return (!isNaN(numValue) && numValue > 0) ? numValue : null;
        });
        if (dbValues.some(v => v !== null)) {
            return { data: dbValues, sampleNumbers: dbValues.map((_, i) => (i + 1).toString()) };
        }
    }

    const data = [];
    const sampleNumbers = [];
    const tableBody = document.getElementById(tableBodyId);
    if (!tableBody) return { data, sampleNumbers };

    const rows = tableBody.querySelectorAll('tr');
    let sampleCounter = 1;

    for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length === 0) continue;
        const firstCellText = cells[0]?.textContent.trim() || '';
        if (/Average|Minimum|Maximum/.test(firstCellText)) continue;
        if (!firstCellText && !row.querySelector('input')) continue;

        let columnIndices = [];
        if (tableBodyId === 'testingTableBody') {
            const map = { 'basis-weight': 3, 'thickness': 4, 'opacity': 5, 'cof': 6, 'cut-width': 7, 'color-delta-e-unprinted': 8, 'color-delta-e-printed': 9 };
            columnIndices = map[columnType] !== undefined ? [map[columnType]] : [];
        } else if (tableBodyId === 'testingTableBody2') {
            const map = { 'elongation-md': [3,4,5], 'tensile-strength-md': [7,8,9], 'tensile-strength-5-md': [11,12,13] };
            columnIndices = map[columnType] || [];
        } else if (tableBodyId === 'testingTableBody3') {
            const map = { 'elongation-cd': [3,4,5], 'tensile-strength-cd': [7,8,9], 'modulus-web': [11,12,13] };
            columnIndices = map[columnType] || [];
        } else if (tableBodyId === 'testingTableBody4') {
            const map = { 'gloss': [3,4,5] };
            columnIndices = map[columnType] || [];
        }

        const validValues = columnIndices
            .map(idx => {
                const cell = cells[idx];
                if (!cell) return null;
                const input = cell.querySelector('input');
                const val = (input ? input.value : cell.textContent).trim();
                return val !== '' ? parseFloat(val) : null;
            })
            .filter(v => v !== null && !isNaN(v));

        if (validValues.length > 0) {
            const finalValue = validValues.reduce((a, b) => a + b, 0) / validValues.length;
            if (tableBodyId === 'testingTableBody' && finalValue <= 0) continue;
            data.push(finalValue);
            sampleNumbers.push(sampleCounter.toString());
            if (++sampleCounter > 30) break;
        }
    }
    return { data, sampleNumbers };
}

document.addEventListener('DOMContentLoaded', function() {
    initializeGraphToggle();
});

window.ChartRenderer = {
    create: createChart,
    update: updateChartData,
    initializeGraphToggle: initializeGraphToggle,
    initializeInspectionCharts: initializeInspectionCharts,
    initializeInspectionChartsPage2: initializeInspectionChartsPage2,
    initializeInspectionChartsPage3: initializeInspectionChartsPage3,
    initializeInspectionChartsPage4: initializeInspectionChartsPage4,
    renderMetricCharts: renderMetricCharts
};
