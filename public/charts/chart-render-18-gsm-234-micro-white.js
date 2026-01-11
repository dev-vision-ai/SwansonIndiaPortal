// Chart rendering utilities
// Global chart instances storage
const chartInstances = new Map();

// Centralized Metric Specifications for all charts
const METRIC_SPECS = {
    basisWeightChart: { label: 'Basic Weight', usl: 20.3, tgt: 18.0, lsl: 15.7, min: 14, max: 22, unit: 'GSM', col: 'basis-weight', table: 'testingTableBody', color: 'rgb(54, 162, 235)' },
    opacityChart: { label: 'Opacity', usl: 63.0, tgt: 60.0, lsl: 57.0, min: 55, max: 65, unit: '%', col: 'opacity', table: 'testingTableBody', color: 'rgb(75, 192, 192)' },
    cofChart: { label: 'COF-Kinetic(R-R)', usl: 0.50, tgt: 0.40, lsl: 0.30, min: 0.25, max: 0.55, unit: 'COF', col: 'cof-rr', table: 'testingTableBody', color: 'rgb(255, 159, 64)' },
    cofRSChart: { label: 'COF-Kinetic(R-S)', usl: 0.35, tgt: 0.20, lsl: 0.10, min: 0.05, max: 0.40, unit: 'COF', col: 'cof-rs', table: 'testingTableBody', color: 'rgb(255, 192, 128)' },
    modulusWebChart: { label: 'Modulus-MD-web@ 2%', usl: 31.2, tgt: 24.7, lsl: 18.2, min: 15, max: 35, unit: 'N/cm', col: 'modulus-web', table: 'testingTableBody', color: 'rgb(0, 150, 136)' },
    glossChart: { label: 'Gloss Level', usl: 10.0, tgt: 7.0, min: 6, max: 12, unit: 'Gloss unit', col: 'gloss', table: 'testingTableBody', color: 'rgb(0, 0, 0)' },
    elongationMDChart: { label: 'Force-elongation-MD@5%', tgt: 2.77, lsl: 1.77, min: 1.0, max: 5.0, unit: 'N', col: 'tensile-strength-5-md', table: 'testingTableBody2', color: 'rgb(153, 102, 255)' },
    tensileStrengthMDChart: { label: 'Force-Tensile Strength-MD-peak', tgt: 12.57, lsl: 9.07, min: 7.0, max: 16.0, unit: 'N', col: 'tensile-strength-md', table: 'testingTableBody2', color: 'rgb(255, 205, 86)' },
    elongationCDChart: { label: 'Force-elongation-CD@5%', tgt: 2.49, lsl: 1.49, min: 1.0, max: 5.0, unit: 'N', col: 'tensile-strength-5-cd', table: 'testingTableBody2', color: 'rgb(156, 39, 176)' },
    tensileStrengthCDChart: { label: 'Force-Tensile Strength-CD-peak', tgt: 9.63, lsl: 6.13, min: 5.0, max: 14.0, unit: 'N', col: 'tensile-strength-cd', table: 'testingTableBody2', color: 'rgb(233, 30, 99)' },
    colorLChart: { label: 'Colour L', usl: 99.5, tgt: 95.5, lsl: 91.5, min: 90, max: 100, unit: 'H', col: 'color-l', table: 'testingTableBody2', color: 'rgb(121, 85, 72)' },
    colorAChart: { label: 'Colour A', usl: 3.6, tgt: -0.4, lsl: -4.4, min: -6.00, max: 6.00, unit: 'H', col: 'color-a', table: 'testingTableBody2', color: 'rgb(63, 81, 181)' },
    colorBChart: { label: 'Colour B', usl: 3.5, tgt: -0.5, lsl: -4.5, min: -6, max: 6, unit: 'H', col: 'color-b', table: 'testingTableBody2', color: 'rgb(0, 188, 212)' },
    colorDeltaEChart: { label: 'Delta E', usl: 5.0, tgt: 0.0, min: 0, max: 6, unit: 'Delta E', col: 'color-delta-e', table: 'testingTableBody2', color: 'rgb(255, 87, 34)' }
};

// Format numbers with proper decimal places based on metric type
function formatChartValue(value, chartType = null) {
    if (value === null || value === undefined || Number.isNaN(value)) return '';
    const specKey = chartType === 'cof' ? 'cofChart' : chartType;
    const spec = METRIC_SPECS[specKey];
    let decimals = 2;
    if (spec) {
        if (specKey === 'thicknessChart') decimals = 3;
        else if (spec.unit === '%') decimals = specKey.includes('elongation') ? 0 : 1;
        else if (['N', 'N/cm', 'Gloss unit'].includes(spec.unit)) decimals = 1;
    }
    return Number(value).toFixed(decimals);
}

// Function to create a Chart.js chart inside a canvas element
function createChart(canvasId, chartType, data = null, customOptions = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    if (chartInstances.has(canvasId)) chartInstances.get(canvasId).destroy();
    let config = {
        type: chartType || 'line',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    display: true,
                    labels: { filter: (legendItem) => legendItem.text !== null && legendItem.text !== undefined && legendItem.text !== '', color: '#000' }
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
                    filter: (tooltipItem) => tooltipItem.dataset.label !== null && tooltipItem.dataset.label !== undefined && tooltipItem.dataset.label !== '',
                    callbacks: {
                        title: function(context) {
                            const value = context[0]?.parsed?.y ?? context[0]?.raw?.y;
                            return `${formatChartValue(value)}`;
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
                    ticks: { callback: (value) => (value === undefined || value === null ? '' : value) }
                }
            }
        }
    };
    if (data) {
        if (data.labels) config.data.labels = data.labels;
        if (data.datasets) {
            config.data.datasets = data.datasets.map(ds => ({
                ...ds,
                data: ds.data ? ds.data.map(d => (d === null ? undefined : d)) : []
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

// Function to update an existing chart's data and labels
function updateChartData(canvasId, newData) {
    const chart = chartInstances.get(canvasId);
    if (!chart) return false;
    if (newData.labels) chart.data.labels = newData.labels;
    if (newData.datasets) chart.data.datasets = newData.datasets;
    chart.update();
    return true;
}

// Function to add a new data point to a chart
function addDataPoint(canvasId, label, dataPoint) {
    const chart = chartInstances.get(canvasId);
    if (!chart) return false;
    if (label && !chart.data.labels.includes(label)) chart.data.labels.push(label);
    chart.data.datasets.forEach((dataset, index) => {
        if (Array.isArray(dataPoint)) dataset.data.push(dataPoint[index] || 0);
        else dataset.data.push(dataPoint);
    });
    chart.update();
    return true;
}

// Function to remove a data point by index from a chart
function removeDataPoint(canvasId, index = -1) {
    const chart = chartInstances.get(canvasId);
    if (!chart) return false;
    if (index >= 0 && index < chart.data.labels.length) {
        chart.data.labels.splice(index, 1);
        chart.data.datasets.forEach(dataset => { dataset.data.splice(index, 1); });
        chart.update();
        return true;
    }
    return false;
}

// Create a dataset representing a horizontal limit line for specs (USL/LSL/TGT)
function createLimitDataset(value, color, isBold, length) {
    return { label: null, data: Array(length).fill(value), borderColor: color, borderDash: [5, 5], borderWidth: isBold ? 2 : 1, pointRadius: 0, fill: false };
}

// Helper that adds target/limit datasets to a chart based on metric spec
function _addLimitLines(datasets, spec, length) {
    if (spec.tgt !== undefined) datasets.push(createLimitDataset(spec.tgt, 'rgb(34, 197, 94)', true, length));
    if (spec.lsl !== undefined) datasets.push(createLimitDataset(spec.lsl, 'rgb(239, 68, 68)', false, length));
    if (spec.usl !== undefined) datasets.push(createLimitDataset(spec.usl, 'rgb(239, 68, 68)', false, length));
}

// Render charts for a list of metric IDs using optional db data
async function renderMetricCharts(metricIds, dbData = null) {
    metricIds.forEach(id => {
        const spec = METRIC_SPECS[id];
        if (!spec) {
            console.warn(`Chart spec not found for ${id}`);
            return;
        }
        const result = getMetricData(spec, dbData);
        const data = result.data || [];
        const displayLen = 30;
        const paddedData = [...data, ...Array(displayLen - data.length).fill(undefined)];
        const labels = Array.from({ length: displayLen }, (_, i) => (i + 1).toString());
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
        const chart = createChart(id, 'line', { labels, datasets }, {
            plugins: {
                title: { display: true, text: spec.label },
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
                    title: { display: true, text: spec.unit === 'H' ? 'Color units-H' : (spec.unit === 'Delta E' ? 'Color units-Delta E' : spec.unit) },
                    ticks: { 
                        callback: function(value) { return formatChartValue(value, id); }
                    }
                }
            }
        });
        if (!chart) {
            console.error(`Failed to create chart for ${id}`);
        }
    });
}

const graphsVisible = {};

// Initialize page-level graph toggles (expand/collapse behavior)
function initializeGraphToggle() {
    initializePageToggle(1, true);
    initializePageToggle(2);
}

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
                if (toggleText) toggleText.textContent = 'Hide Trend';
                if (toggleIcon) toggleIcon.className = 'fas fa-chevron-up';
                if (pageNum === 1) {
                    await initializeInspectionCharts();
                } else if (pageNum === 2) {
                    await initializeInspectionChartsPage2();
                }
            } else {
                graphsSection.style.display = 'none';
                if (toggleText) toggleText.textContent = 'View Trend';
                if (toggleIcon) toggleIcon.className = 'fas fa-chevron-down';
            }
        });
    }
}

async function initializeInspectionCharts() {
    const dbData = await fetchInspectionDataFromDB();
    await renderMetricCharts(['basisWeightChart', 'cofChart', 'cofRSChart', 'opacityChart', 'modulusWebChart', 'glossChart'], dbData);
}

async function initializeInspectionChartsPage2() {
    await renderMetricCharts(['elongationMDChart', 'tensileStrengthMDChart', 'elongationCDChart', 'tensileStrengthCDChart', 'colorLChart', 'colorAChart', 'colorBChart', 'colorDeltaEChart']);
}

async function fetchInspectionDataFromDB() {
    try {
        const { supabase } = await import('../supabase-config.js');
        const urlParams = new URLSearchParams(window.location.search);
        let formId = urlParams.get('form_id');
        if (!formId) {
            const formIdElement = document.querySelector('[data-form-id]');
            if (formIdElement) formId = formIdElement.getAttribute('data-form-id');
        }
        if (!formId) return null;
        const filmTableNames = [
            '234_18_micro_white',
            '168_18c_white',
            '176_18cp_ww',
            '168_16c_white',
            '168_16cp_kranti',
            '168_18c_white_jeddah',
            '214_18_micro_white',
            'uc_18gsm_250p_abqr',
            'uc_18gsm_290p_abqr',
            'uc_18gsm_290np_abqr',
            'uc_18gsm_250w_bfqr',
            'uc_18gsm_210w_bfqr',
            '102_18c_micro_white',
            'uc_16gsm_165w'
        ];
        for (const tableName of filmTableNames) {
            try {
                const { data, error } = await supabase
                    .from(tableName)
                    .select('*')
                    .eq('form_id', formId)
                    .order('sample_no', { ascending: true });
                if (!error && data && data.length > 0) {
                    const samples = data.slice(0, 30);
                    const processedData = samples.map((row, index) => ({
                        sample_no: index + 1,
                        basis_weight: parseFloat(row.basis_weight) || null,
                        thickness: parseFloat(row.thickness) || null,
                        opacity: parseFloat(row.opacity) || null,
                        cof_kinetic: parseFloat(row.cof_kinetic) || null,
                        cof_kinetic_rs: parseFloat(row.page1_cof_kinetic_r_s) || parseFloat(row.cof_kinetic_rs) || null
                    }));
                    return processedData;
                }
            } catch (tableError) {
                continue;
            }
        }
        return null;
    } catch (error) {
        return null;
    }
}

function getMetricData(spec, dbData = null) {
    const { col: columnType, table: tableBodyId = 'testingTableBody' } = spec;
    
    if (dbData && dbData.length > 0 && tableBodyId === 'testingTableBody') {
        const dbValues = dbData.map(row => {
            let value = null;
            switch (columnType) {
                case 'basis-weight': value = row.basis_weight; break;
                case 'thickness': value = row.thickness; break;
                case 'opacity': value = row.opacity; break;
                case 'cof-rr': value = row.cof_kinetic; break;
                case 'cof-rs': value = row.cof_kinetic_rs; break;
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
        
        // Skip summary rows
        if (/Average|Minimum|Maximum/.test(firstCellText)) continue;
        if (!firstCellText && !row.querySelector('input')) continue;
        
        let columnIndices = [];
        
        if (tableBodyId === 'testingTableBody') {
            // Page 1 actual cell indices (after colspan resolution)
            // Cell 0: Lot & Roll | Cell 1: Roll ID | Cell 2: Lot Time
            // Cell 3: Basis Weight | Cell 4: COF-Kinetic(R-R) | Cell 5: COF-Kinetic(R-S) | Cell 6: Opacity 
            // Cell 7-10: Modulus 1,2,3,Avg | Cell 11: Gloss
            const map = { 
                'basis-weight': [3], 
                'opacity': [6], 
                'cof-rr': [4], 
                'cof-rs': [5],
                'modulus-web': [7, 8, 9], 
                'gloss': [11] 
            };
            columnIndices = map[columnType] !== undefined ? (Array.isArray(map[columnType]) ? map[columnType] : [map[columnType]]) : [];
        } else if (tableBodyId === 'testingTableBody2') {
            // Page 2: Cell 0: Lot & Roll | Cell 1: Roll ID | Cell 2: Lot Time
            // Cell 3: Force-elongation-MD@5% | Cell 4: Force-Tensile Strength-MD-peak 
            // Cell 5: Force-elongation-CD@5% | Cell 6: Force-Tensile Strength-CD-peak
            // Cell 7: Colour L | Cell 8: Colour A | Cell 9: Colour B | Cell 10: Delta E
            const map = { 
                'tensile-strength-5-md': [3],
                'tensile-strength-md': [4],
                'tensile-strength-5-cd': [5],
                'tensile-strength-cd': [6],
                'color-l': [7],
                'color-a': [8],
                'color-b': [9],
                'color-delta-e': [10]
            };
            columnIndices = map[columnType] || [];
        } else if (tableBodyId === 'testingTableBody3') {
            const map = { 
                'elongation-cd': [3,4,5], 
                'tensile-strength-cd': [7,8,9], 
                'modulus-web': [11,12,13] 
            };
            columnIndices = map[columnType] || [];
        } else if (tableBodyId === 'testingTableBody4') {
            const map = { 
                'color-l': [3], 
                'color-a': [4], 
                'color-b': [5], 
                'color-delta-e': [6], 
                'gloss': [7,8,9] 
            };
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
    addData: addDataPoint,
    removeData: removeDataPoint,
    destroy: function(canvasId) { const chart = chartInstances.get(canvasId); if (chart) { chart.destroy(); chartInstances.delete(canvasId); return true; } return false; },
    destroyAll: function() { chartInstances.forEach((chart) => chart.destroy()); chartInstances.clear(); },
    initializeGraphToggle: initializeGraphToggle,
    initializeInspectionCharts: initializeInspectionCharts,
    initializeInspectionChartsPage2: initializeInspectionChartsPage2,
    renderMetricCharts: renderMetricCharts
};
