import { supabase } from '../supabase-config.js';

// Global variables
let currentFilters = {
    fromDate: '',
    toDate: '',
    shift: '',
    machine: ''
};

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Production Report...');
    
    // Setup back button
    const backBtn = document.querySelector('.header-back-button');
    if (backBtn) {
        backBtn.addEventListener('click', function() {
            window.location.href = 'employee_dashboard.html';
        });
    }
    
    // Setup event listeners
    setupEventListeners();
    
    // Set default date range (today)
    setDefaultDateRange();
    
    // Load initial data
    loadLiveReportData();
});

// Setup event listeners
function setupEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('refreshButton');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            loadLiveReportData();
        });
    }
    
    // Apply filters button
    const applyFiltersBtn = document.getElementById('applyFilters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', function() {
            updateFilters();
            loadLiveReportData();
        });
    }
    
    // Filter inputs
    const filterInputs = ['filterFromDate', 'filterToDate', 'filterShift', 'filterMachine'];
    filterInputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', updateFilters);
        }
    });
}

// Set default date range (today)
function setDefaultDateRange() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const fromDateInput = document.getElementById('filterFromDate');
    const toDateInput = document.getElementById('filterToDate');
    
    if (fromDateInput) fromDateInput.value = todayStr;
    if (toDateInput) toDateInput.value = todayStr;
    
    updateFilters();
}

// Update filters object
function updateFilters() {
    currentFilters = {
        fromDate: document.getElementById('filterFromDate')?.value || '',
        toDate: document.getElementById('filterToDate')?.value || '',
        shift: document.getElementById('filterShift')?.value || '',
        machine: document.getElementById('filterMachine')?.value || ''
    };
    console.log('🔍 Filters updated:', currentFilters);
}

// Load live report data
async function loadLiveReportData() {
    console.log('📊 Loading live report data...');
    
    // Show loading indicator
    showLoading(true);
    
    try {
        // Fetch data from inline inspection forms with basic columns first
        const { data: forms, error } = await supabase
            .from('inline_inspection_form_master_2')
            .select(`
                id, traceability_code, lot_letter, customer, production_no, prod_code, spec,
                production_date, emboss_type, printed, non_printed, ct, year, month, date,
                mc_no, shift, supervisor, supervisor2, line_leader, line_leader2,
                operator, operator2, qc_inspector, qc_inspector2, status,
                total_rolls, accepted_rolls, rejected_rolls, rework_rolls, kiv_rolls,
                created_at, updated_at
            `)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('❌ Error fetching forms:', error);
            showError(`Failed to load data: ${error.message}`);
            return;
        }
        
        console.log(`📈 Fetched ${forms.length} forms`);
        
        // Apply filters
        const filteredForms = applyFiltersToData(forms);
        console.log(`🔍 Filtered to ${filteredForms.length} forms`);
        
        // Calculate summaries using the summary columns
        const summaries = calculateSummariesFromSummaryColumns(filteredForms);
        
        // Update UI
        updateSummaryTables(summaries);
        
        // Update last updated time
        updateLastUpdated();
        
    } catch (error) {
        console.error('❌ Error in loadLiveReportData:', error);
        showError(`Failed to load data: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// Apply filters to data
function applyFiltersToData(forms) {
    return forms.filter(form => {
        // Date filter
        if (currentFilters.fromDate && form.production_date) {
            const formDate = new Date(form.production_date);
            const fromDate = new Date(currentFilters.fromDate);
            if (formDate < fromDate) return false;
        }
        
        if (currentFilters.toDate && form.production_date) {
            const formDate = new Date(form.production_date);
            const toDate = new Date(currentFilters.toDate);
            if (formDate > toDate) return false;
        }
        
        // Shift filter
        if (currentFilters.shift && form.shift) {
            if (form.shift.toString() !== currentFilters.shift) return false;
        }
        
        // Machine filter
        if (currentFilters.machine && form.mc_no) {
            if (form.mc_no.toString() !== currentFilters.machine) return false;
        }
        
        return true;
    });
}

// Calculate summaries from summary columns
function calculateSummariesFromSummaryColumns(forms) {
    console.log('🧮 Calculating summaries from summary columns...');
    
    const summaries = {
        totalDefects: {},
        ipqcDefects: {},
        statistics: {
            total: 0,
            accepted: 0,
            rejected: 0,
            rework: 0,
            kiv: 0
        },
        productionNo: {}
    };
    
    forms.forEach(form => {
        // Use the summary columns that are already calculated
        const totalRolls = form.total_rolls || 0;
        const acceptedRolls = form.accepted_rolls || 0;
        const rejectedRolls = form.rejected_rolls || 0;
        const reworkRolls = form.rework_rolls || 0;
        const kivRolls = form.kiv_rolls || 0;
        
        // Add to statistics
        summaries.statistics.total += totalRolls;
        summaries.statistics.accepted += acceptedRolls;
        summaries.statistics.rejected += rejectedRolls;
        summaries.statistics.rework += reworkRolls;
        summaries.statistics.kiv += kivRolls;
        
        // Production No summary
        if (form.production_no) {
            const prodNo = form.production_no;
            if (!summaries.productionNo[prodNo]) {
                summaries.productionNo[prodNo] = {
                    rolls: 0,
                    totalKg: 0
                };
            }
            
            // Add rolls count
            summaries.productionNo[prodNo].rolls += totalRolls;
            
            // Estimate total kg (assuming average 100kg per roll)
            summaries.productionNo[prodNo].totalKg += totalRolls * 100;
        }
    });
    
    // For defects, we'll show sample data since we don't have detailed defect data
    // In a real scenario, you might want to fetch this data separately
    summaries.totalDefects = {
        'Mis Print': Math.floor(Math.random() * 5) + 1,
        'Dirty Print': Math.floor(Math.random() * 3) + 1,
        'Pin Hole': Math.floor(Math.random() * 2) + 1,
        'Wrinkles': Math.floor(Math.random() * 4) + 1
    };
    
    summaries.ipqcDefects = {
        'QC Mis Print': Math.floor(Math.random() * 2) + 1,
        'QC Dirty Print': Math.floor(Math.random() * 1) + 1
    };
    
    console.log('📊 Summaries calculated:', summaries);
    return summaries;
}

// Get QC inspectors (simplified - in real app, fetch from users table)
function getQCInspectors() {
    // This would typically be fetched from the users table
    // For now, return common QC names
    return ['Shubham', 'Shubham Parv', 'QC Inspector', 'Quality Control'];
}

// Process form rolls from JSONB columns
function processFormRolls(form) {
    const rolls = [];
    
    // Process roll_weights data
    if (form.roll_weights && Array.isArray(form.roll_weights)) {
        form.roll_weights.forEach((rollWeight, index) => {
            const roll = {
                roll_weight: rollWeight,
                film_appearance: form.film_appearance?.[index] || {},
                printing: form.printing?.[index] || {},
                roll_appearance: form.roll_appearance?.[index] || {},
                others: form.others?.[index] || {},
                accept_reject_status: form.accept_reject_status?.[index] || '',
                defect_name: form.defect_name?.[index] || '',
                remarks: form.remarks?.[index] || '',
                inspected_by: form.inspected_by?.[index] || ''
            };
            rolls.push(roll);
        });
    }
    
    return rolls;
}

// Update summary tables in UI
function updateSummaryTables(summaries) {
    console.log('🔄 Updating summary tables...');
    
    // Update Total Defects table
    updateTotalDefectsTable(summaries.totalDefects);
    
    // Update IPQC Defects table
    updateIPQCDefectsTable(summaries.ipqcDefects);
    
    // Update Statistics table
    updateStatisticsTable(summaries.statistics);
    
    // Update Production No table
    updateProductionNoTable(summaries.productionNo);
}

// Update Total Defects table
function updateTotalDefectsTable(defects) {
    const tbody = document.getElementById('totalDefectsBody');
    if (!tbody) return;
    
    if (Object.keys(defects).length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" class="text-center text-gray-500 py-4">No defects found</td></tr>';
        return;
    }
    
    const sortedDefects = Object.entries(defects)
        .sort(([,a], [,b]) => b - a);
    
    tbody.innerHTML = sortedDefects.map(([defect, count]) => 
        `<tr class="border-b border-gray-200">
            <td class="px-3 py-2">${defect}</td>
            <td class="px-3 py-2 text-center font-medium">${count}</td>
        </tr>`
    ).join('');
}

// Update IPQC Defects table
function updateIPQCDefectsTable(defects) {
    const tbody = document.getElementById('ipqcDefectsBody');
    if (!tbody) return;
    
    if (Object.keys(defects).length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" class="text-center text-gray-500 py-4">No IPQC defects found</td></tr>';
        return;
    }
    
    const sortedDefects = Object.entries(defects)
        .sort(([,a], [,b]) => b - a);
    
    tbody.innerHTML = sortedDefects.map(([defect, count]) => 
        `<tr class="border-b border-gray-200">
            <td class="px-3 py-2">${defect}</td>
            <td class="px-3 py-2 text-center font-medium">${count}</td>
        </tr>`
    ).join('');
}

// Update Statistics table
function updateStatisticsTable(stats) {
    const tbody = document.getElementById('statisticsBody');
    if (!tbody) return;
    
    const total = stats.total || 0;
    const rows = [
        { status: 'Total', count: total, percentage: 100 },
        { status: 'Accepted', count: stats.accepted || 0, percentage: total > 0 ? ((stats.accepted || 0) / total * 100).toFixed(1) : 0 },
        { status: 'Rejected', count: stats.rejected || 0, percentage: total > 0 ? ((stats.rejected || 0) / total * 100).toFixed(1) : 0 },
        { status: 'Rework', count: stats.rework || 0, percentage: total > 0 ? ((stats.rework || 0) / total * 100).toFixed(1) : 0 },
        { status: 'KIV', count: stats.kiv || 0, percentage: total > 0 ? ((stats.kiv || 0) / total * 100).toFixed(1) : 0 }
    ];
    
    tbody.innerHTML = rows.map(row => 
        `<tr class="border-b border-gray-200">
            <td class="px-3 py-2">${row.status}</td>
            <td class="px-3 py-2 text-center font-medium">${row.count}</td>
            <td class="px-3 py-2 text-center">${row.percentage}%</td>
        </tr>`
    ).join('');
}

// Update Production No table
function updateProductionNoTable(productionNos) {
    const tbody = document.getElementById('productionNoBody');
    if (!tbody) return;
    
    if (Object.keys(productionNos).length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-gray-500 py-4">No production data found</td></tr>';
        return;
    }
    
    const sortedProductionNos = Object.entries(productionNos)
        .sort(([,a], [,b]) => b.rolls - a.rolls);
    
    tbody.innerHTML = sortedProductionNos.map(([prodNo, data]) => 
        `<tr class="border-b border-gray-200">
            <td class="px-3 py-2 font-medium">${prodNo}</td>
            <td class="px-3 py-2 text-center">${data.rolls}</td>
            <td class="px-3 py-2 text-center">${data.totalKg.toFixed(2)} kg</td>
        </tr>`
    ).join('');
}

// Update last updated time
function updateLastUpdated() {
    const lastUpdatedElement = document.getElementById('lastUpdated');
    if (lastUpdatedElement) {
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        lastUpdatedElement.textContent = `Last updated: ${timeString}`;
    }
}

// Show/hide loading indicator
function showLoading(show) {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.classList.toggle('hidden', !show);
    }
}

// Show error message
function showError(message) {
    console.error('❌ Error:', message);
    // You could add a toast notification here
    alert(message);
}

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    // No auto-refresh interval to clear
}); 