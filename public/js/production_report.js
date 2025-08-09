import { supabase } from '../supabase-config.js';

// Global variables
let currentFilters = {
    fromDate: '',
    toDate: '',
    product: '',
    machineNo: '',
    shift: ''
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
    
    // Setup filter event listeners
    setupFilterEventListeners();
    
    // Populate filter dropdowns
    populateFilterDropdowns();
    
    // Load initial data
    loadProductionData();
});

// Populate filter dropdowns with data from database
async function populateFilterDropdowns() {
    console.log('🔧 Populating filter dropdowns...');
    
    try {
        // Get unique products
        const { data: products, error: productsError } = await supabase
            .from('inline_inspection_form_master_2')
            .select('prod_code')
            .not('prod_code', 'is', null);
            
        if (!productsError && products) {
            const uniqueProducts = [...new Set(products.map(p => p.prod_code).filter(Boolean))];
            const productSelect = document.getElementById('filterProduct');
            if (productSelect) {
                productSelect.innerHTML = '<option value="">All</option>' + 
                    uniqueProducts.map(prod => `<option value="${prod}">${prod}</option>`).join('');
            }
        }
        
        // Get unique machine numbers
        const { data: machines, error: machinesError } = await supabase
            .from('inline_inspection_form_master_2')
            .select('mc_no')
            .not('mc_no', 'is', null);
            
        if (!machinesError && machines) {
            const uniqueMachines = [...new Set(machines.map(m => m.mc_no).filter(Boolean))];
            const machineSelect = document.getElementById('filterMachine');
            if (machineSelect) {
                machineSelect.innerHTML = '<option value="">All</option>' + 
                    uniqueMachines.map(mc => `<option value="${mc}">${mc}</option>`).join('');
            }
        }
        
        console.log('✅ Filter dropdowns populated');
        
    } catch (error) {
        console.error('❌ Error populating filter dropdowns:', error);
    }
}

// Setup filter event listeners
function setupFilterEventListeners() {
    console.log('🔧 Setting up filter event listeners...');
    
    // Date filters
    const fromDateInput = document.getElementById('filterFromDate');
    const toDateInput = document.getElementById('filterToDate');
    
    if (fromDateInput) {
        fromDateInput.addEventListener('change', function() {
            currentFilters.fromDate = this.value;
            loadProductionData();
        });
    }
    
    if (toDateInput) {
        toDateInput.addEventListener('change', function() {
            currentFilters.toDate = this.value;
            loadProductionData();
        });
    }
    
    // Product filter
    const productSelect = document.getElementById('filterProduct');
    if (productSelect) {
        productSelect.addEventListener('change', function() {
            currentFilters.product = this.value;
            loadProductionData();
        });
    }
    
    // Machine filter
    const machineSelect = document.getElementById('filterMachine');
    if (machineSelect) {
        machineSelect.addEventListener('change', function() {
            currentFilters.machineNo = this.value;
            loadProductionData();
        });
    }
    
    // Shift filter
    const shiftSelect = document.getElementById('filterShift');
    if (shiftSelect) {
        shiftSelect.addEventListener('change', function() {
            currentFilters.shift = this.value;
            loadProductionData();
        });
    }
    
    // Clear filter button
    const clearFilterBtn = document.getElementById('clearFilter');
    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', function() {
            clearFilters();
        });
    }
}

// Clear all filters
function clearFilters() {
    console.log('🧹 Clearing filters...');
    
    // Reset filter values
    currentFilters = {
        fromDate: '',
        toDate: '',
        product: '',
        machineNo: '',
        shift: ''
    };
    
    // Reset UI
    const fromDateInput = document.getElementById('filterFromDate');
    const toDateInput = document.getElementById('filterToDate');
    const productSelect = document.getElementById('filterProduct');
    const machineSelect = document.getElementById('filterMachine');
    const shiftSelect = document.getElementById('filterShift');
    
    if (fromDateInput) fromDateInput.value = '';
    if (toDateInput) toDateInput.value = '';
    if (productSelect) productSelect.value = '';
    if (machineSelect) machineSelect.value = '';
    if (shiftSelect) shiftSelect.value = '';
    
    // Update filter status
    updateFilterStatus();
    
    // Reload data
    loadProductionData();
}

// Update filter status display
function updateFilterStatus() {
    const filterStatus = document.getElementById('filterStatus');
    if (!filterStatus) return;
    
    const hasActiveFilters = Object.values(currentFilters).some(value => value !== '');
    
    if (hasActiveFilters) {
        filterStatus.textContent = 'On';
        filterStatus.className = 'px-2 py-1 text-sm font-semibold rounded-full bg-green-200 text-green-800';
    } else {
        filterStatus.textContent = 'Off';
        filterStatus.className = 'px-2 py-1 text-sm font-semibold rounded-full bg-gray-200 text-gray-700';
    }
}

// Load production data from Supabase
async function loadProductionData() {
    console.log('📊 Loading production data...');
    console.log('Current filters:', currentFilters);
    
    try {
        // First, get all unique traceability_code and lot_letter combinations
        let baseQuery = supabase
            .from('inline_inspection_form_master_2')
            .select('traceability_code, lot_letter, customer, production_no, prod_code, spec, production_date, mc_no, shift')
            .not('customer', 'is', null);
        
        // Apply filters to the base query
        if (currentFilters.fromDate) {
            baseQuery = baseQuery.gte('production_date', currentFilters.fromDate);
        }
        
        if (currentFilters.toDate) {
            baseQuery = baseQuery.lte('production_date', currentFilters.toDate);
        }
        
        if (currentFilters.product) {
            baseQuery = baseQuery.eq('prod_code', currentFilters.product);
        }
        
        if (currentFilters.machineNo) {
            baseQuery = baseQuery.eq('mc_no', currentFilters.machineNo);
        }
        
        if (currentFilters.shift) {
            baseQuery = baseQuery.eq('shift', currentFilters.shift);
        }
        
        console.log('Executing base query to get form combinations...');
        
        const { data: formCombinations, error: baseError } = await baseQuery;
        
        if (baseError) {
            console.error('❌ Error fetching form combinations:', baseError);
            loadEmptyData();
            return;
        }
        
        console.log('✅ Found', formCombinations.length, 'form combinations');
        
        // Now fetch ALL lots for each form combination with complete data
        let allLots = [];
        
        for (const form of formCombinations) {
            console.log('Fetching lots for:', form.traceability_code, form.lot_letter);
            
            // Fetch complete lot data including all JSONB columns
            const { data: lots, error: lotsError } = await supabase
                .from('inline_inspection_form_master_2')
                .select(`
                    *,
                    roll_weights,
                    roll_widths,
                    film_weights_gsm,
                    thickness_data,
                    roll_diameters,
                    accept_reject_status,
                    defect_names,
                    film_appearance,
                    printing_quality,
                    roll_appearance,
                    paper_core_data,
                    time_data,
                    remarks_data,
                    accepted_rolls,
                    rejected_rolls,
                    rework_rolls,
                    kiv_rolls,
                    accepted_weight,
                    rejected_weight,
                    rework_weight,
                    kiv_weight,
                    total_rolls,
                    lot_no,
                    form_id
                `)
                .eq('traceability_code', form.traceability_code)
                .eq('lot_letter', form.lot_letter)
                .order('lot_no', { ascending: true });
            
            if (lotsError) {
                console.error('❌ Error fetching lots for', form.traceability_code, form.lot_letter, ':', lotsError);
                continue;
            }
            
            if (lots && lots.length > 0) {
                allLots = allLots.concat(lots);
                console.log('Added', lots.length, 'lots for', form.traceability_code, form.lot_letter);
                
                // Debug: Log details of each lot
                lots.forEach((lot, index) => {
                    console.log(`  Lot ${index + 1}:`, {
                        lot_no: lot.lot_no,
                        total_rolls: lot.total_rolls,
                        accepted_rolls: lot.accepted_rolls,
                        rejected_rolls: lot.rejected_rolls,
                        roll_weights_keys: lot.roll_weights ? Object.keys(lot.roll_weights).length : 0,
                        defect_names_keys: lot.defect_names ? Object.keys(lot.defect_names).length : 0
                    });
                });
            }
        }
        
        console.log('✅ Total lots fetched:', allLots.length);
        if (allLots.length > 0) {
            console.log('Sample lot record keys:', Object.keys(allLots[0]));
            console.log('Sample lot roll_weights:', allLots[0].roll_weights);
            console.log('Sample lot defect_names:', allLots[0].defect_names);
        }
        
        // Process all lots data
        const processedData = processProductionData(allLots);
        
        // Update UI
        updateSummaryTables(processedData);
        
        // Update filter status
        updateFilterStatus();
        
    } catch (error) {
        console.error('❌ Error in loadProductionData:', error);
        loadEmptyData();
    }
}

// Process production data
function processProductionData(data) {
    console.log('🔄 Processing production data...');
    console.log('Processing', data.length, 'lot records');
    
    const rollsSummary = {
        accepted: { rolls: 0, kg: 0.00 },
        rejected: { rolls: 0, kg: 0.00 },
        rework: { rolls: 0, kg: 0.00 },
        kiv: { rolls: 0, kg: 0.00 },
        total: { rolls: 0, kg: 0.00 }
    };
    
    const productionNo = {};
    const totalDefects = {};
    const statistics = {
        rollWeight: { min: Infinity, max: -Infinity, sum: 0, count: 0 },
        cutWidth: { min: Infinity, max: -Infinity, sum: 0, count: 0 },
        gsm: { min: Infinity, max: -Infinity, sum: 0, count: 0 },
        rollTheta: { min: Infinity, max: -Infinity, sum: 0, count: 0 },
        thickness: { min: Infinity, max: -Infinity, sum: 0, count: 0 }
    };
    
    // Process each record
    data.forEach((record, index) => {
        console.log(`Processing record ${index + 1}:`, {
            id: record.id,
            traceability_code: record.traceability_code,
            lot_letter: record.lot_letter,
            lot_no: record.lot_no,
            total_rolls: record.total_rolls,
            accepted_rolls: record.accepted_rolls,
            rejected_rolls: record.rejected_rolls
        });
        
        // Use the summary columns directly from the record
        rollsSummary.accepted.rolls += parseInt(record.accepted_rolls) || 0;
        rollsSummary.accepted.kg += parseFloat(record.accepted_weight) || 0;
        
        rollsSummary.rejected.rolls += parseInt(record.rejected_rolls) || 0;
        rollsSummary.rejected.kg += parseFloat(record.rejected_weight) || 0;
        
        rollsSummary.rework.rolls += parseInt(record.rework_rolls) || 0;
        rollsSummary.rework.kg += parseFloat(record.rework_weight) || 0;
        
        rollsSummary.kiv.rolls += parseInt(record.kiv_rolls) || 0;
        rollsSummary.kiv.kg += parseFloat(record.kiv_weight) || 0;
        
        rollsSummary.total.rolls += parseInt(record.total_rolls) || 0;
        
        // Process JSONB columns for detailed statistics
        if (record.roll_weights && typeof record.roll_weights === 'object') {
            console.log(`  Processing roll_weights for record ${index + 1}:`, Object.keys(record.roll_weights).length, 'entries');
            Object.values(record.roll_weights).forEach((weight, weightIndex) => {
                const rollWeight = parseFloat(weight) || 0;
                if (rollWeight > 0) {
                    statistics.rollWeight.min = Math.min(statistics.rollWeight.min, rollWeight);
                    statistics.rollWeight.max = Math.max(statistics.rollWeight.max, rollWeight);
                    statistics.rollWeight.sum += rollWeight;
                    statistics.rollWeight.count++;
                }
            });
        }
        
        if (record.roll_widths && typeof record.roll_widths === 'object') {
            console.log(`  Processing roll_widths for record ${index + 1}:`, Object.keys(record.roll_widths).length, 'entries');
            Object.values(record.roll_widths).forEach((width, widthIndex) => {
                const cutWidth = parseFloat(width) || 0;
                if (cutWidth > 0) {
                    statistics.cutWidth.min = Math.min(statistics.cutWidth.min, cutWidth);
                    statistics.cutWidth.max = Math.max(statistics.cutWidth.max, cutWidth);
                    statistics.cutWidth.sum += cutWidth;
                    statistics.cutWidth.count++;
                }
            });
        }
        
        if (record.film_weights_gsm && typeof record.film_weights_gsm === 'object') {
            console.log(`  Processing film_weights_gsm for record ${index + 1}:`, Object.keys(record.film_weights_gsm).length, 'entries');
            Object.values(record.film_weights_gsm).forEach((gsm, gsmIndex) => {
                const gsmValue = parseFloat(gsm) || 0;
                if (gsmValue > 0) {
                    statistics.gsm.min = Math.min(statistics.gsm.min, gsmValue);
                    statistics.gsm.max = Math.max(statistics.gsm.max, gsmValue);
                    statistics.gsm.sum += gsmValue;
                    statistics.gsm.count++;
                }
            });
        }
        
        if (record.roll_diameters && typeof record.roll_diameters === 'object') {
            console.log(`  Processing roll_diameters for record ${index + 1}:`, Object.keys(record.roll_diameters).length, 'entries');
            Object.values(record.roll_diameters).forEach((diameter, diameterIndex) => {
                const rollTheta = parseFloat(diameter) || 0;
                if (rollTheta > 0) {
                    statistics.rollTheta.min = Math.min(statistics.rollTheta.min, rollTheta);
                    statistics.rollTheta.max = Math.max(statistics.rollTheta.max, rollTheta);
                    statistics.rollTheta.sum += rollTheta;
                    statistics.rollTheta.count++;
                }
            });
        }
        
        if (record.thickness_data && typeof record.thickness_data === 'object') {
            console.log(`  Processing thickness_data for record ${index + 1}:`, Object.keys(record.thickness_data).length, 'entries');
            Object.values(record.thickness_data).forEach((thickness, thicknessIndex) => {
                const thicknessValue = parseFloat(thickness) || 0;
                if (thicknessValue > 0) {
                    statistics.thickness.min = Math.min(statistics.thickness.min, thicknessValue);
                    statistics.thickness.max = Math.max(statistics.thickness.max, thicknessValue);
                    statistics.thickness.sum += thicknessValue;
                    statistics.thickness.count++;
                }
            });
        }
        
        // Process defects from defect_names JSONB
        if (record.defect_names && typeof record.defect_names === 'object') {
            console.log(`  Processing defect_names for record ${index + 1}:`, Object.keys(record.defect_names).length, 'entries');
            Object.values(record.defect_names).forEach((defect, defectIndex) => {
                if (defect && defect.trim()) {
                    totalDefects[defect] = (totalDefects[defect] || 0) + 1;
                }
            });
        }
        
        // Process production numbers
        if (record.production_no) {
            const prodNo = record.production_no.split(',')[0].trim(); // Get first production number
            if (prodNo) {
                if (!productionNo[prodNo]) {
                    productionNo[prodNo] = { rolls: 0, totalKg: 0 };
                }
                
                // Add rolls and weight for this production number
                productionNo[prodNo].rolls += parseInt(record.total_rolls) || 0;
                productionNo[prodNo].totalKg += parseFloat(record.accepted_weight) || 0;
                productionNo[prodNo].totalKg += parseFloat(record.rejected_weight) || 0;
                productionNo[prodNo].totalKg += parseFloat(record.rework_weight) || 0;
                productionNo[prodNo].totalKg += parseFloat(record.kiv_weight) || 0;
            }
        }
    });
    
    // Calculate averages
    if (statistics.rollWeight.count > 0) {
        statistics.rollWeight.avg = statistics.rollWeight.sum / statistics.rollWeight.count;
    }
    if (statistics.cutWidth.count > 0) {
        statistics.cutWidth.avg = statistics.cutWidth.sum / statistics.cutWidth.count;
    }
    if (statistics.gsm.count > 0) {
        statistics.gsm.avg = statistics.gsm.sum / statistics.gsm.count;
    }
    if (statistics.rollTheta.count > 0) {
        statistics.rollTheta.avg = statistics.rollTheta.sum / statistics.rollTheta.count;
    }
    if (statistics.thickness.count > 0) {
        statistics.thickness.avg = statistics.thickness.sum / statistics.thickness.count;
    }
    
    // Handle empty statistics
    if (statistics.rollWeight.min === Infinity) statistics.rollWeight.min = 0;
    if (statistics.rollWeight.max === -Infinity) statistics.rollWeight.max = 0;
    if (statistics.cutWidth.min === Infinity) statistics.cutWidth.min = 0;
    if (statistics.cutWidth.max === -Infinity) statistics.cutWidth.max = 0;
    if (statistics.gsm.min === Infinity) statistics.gsm.min = 0;
    if (statistics.gsm.max === -Infinity) statistics.gsm.max = 0;
    if (statistics.rollTheta.min === Infinity) statistics.rollTheta.min = 0;
    if (statistics.rollTheta.max === -Infinity) statistics.rollTheta.max = 0;
    if (statistics.thickness.min === Infinity) statistics.thickness.min = 0;
    if (statistics.thickness.max === -Infinity) statistics.thickness.max = 0;
    
    console.log('Processed data summary:', {
        totalRecords: data.length,
        rollsSummary,
        productionNo: Object.keys(productionNo).length,
        totalDefects: Object.keys(totalDefects).length,
        statistics: {
            rollWeight: { count: statistics.rollWeight.count, avg: statistics.rollWeight.avg },
            cutWidth: { count: statistics.cutWidth.count, avg: statistics.cutWidth.avg },
            gsm: { count: statistics.gsm.count, avg: statistics.gsm.avg },
            rollTheta: { count: statistics.rollTheta.count, avg: statistics.rollTheta.avg },
            thickness: { count: statistics.thickness.count, avg: statistics.thickness.avg }
        }
    });
    
    return {
        rollsSummary,
        productionNo,
        totalDefects,
        statistics
    };
}

// Load empty data
function loadEmptyData() {
    console.log('📊 Loading empty data...');
    
    // Empty data
    const emptyData = {
        rollsSummary: {
            accepted: { rolls: 0, kg: 0.00 },
            rejected: { rolls: 0, kg: 0.00 },
            rework: { rolls: 0, kg: 0.00 },
            kiv: { rolls: 0, kg: 0.00 },
            total: { rolls: 0, kg: 0.00 }
        },
        productionNo: {},
        totalDefects: {},
        statistics: {
            rollWeight: { min: 0.00, max: 0.00, avg: 0.00 },
            cutWidth: { min: 0, max: 0, avg: 0 },
            gsm: { min: 0.00, max: 0.00, avg: 0.00 },
            rollTheta: { min: 0, max: 0, avg: 0 },
            thickness: { min: 0.00, max: 0.00, avg: 0.00 }
        }
    };
    
    // Update UI with empty data
    updateSummaryTables(emptyData);
}

// Update summary tables in UI
function updateSummaryTables(data) {
    console.log('🔄 Updating summary tables...');
    
    // Update Rolls Summary table
    updateRollsSummaryTable(data.rollsSummary);
    
    // Update Production No table
    updateProductionNoTable(data.productionNo);
    
    // Update Total Defects table
    updateTotalDefectsTable(data.totalDefects);
    
    // Update Statistics table
    updateStatisticsTable(data.statistics);
}

// Update Rolls Summary table
function updateRollsSummaryTable(rollsSummary) {
    document.getElementById('acceptedRollsCount').textContent = rollsSummary.accepted.rolls;
    document.getElementById('acceptedRollsKG').textContent = rollsSummary.accepted.kg.toFixed(2);
    
    document.getElementById('rejectedRollsCount').textContent = rollsSummary.rejected.rolls;
    document.getElementById('rejectedRollsKG').textContent = rollsSummary.rejected.kg.toFixed(2);
    
    document.getElementById('reworkRollsCount').textContent = rollsSummary.rework.rolls;
    document.getElementById('reworkRollsKG').textContent = rollsSummary.rework.kg.toFixed(2);
    
    document.getElementById('kivRollsCount').textContent = rollsSummary.kiv.rolls;
    document.getElementById('kivRollsKG').textContent = rollsSummary.kiv.kg.toFixed(2);
    
    document.getElementById('totalRollsCount').textContent = rollsSummary.total.rolls;
    document.getElementById('totalRollsKG').textContent = rollsSummary.total.kg.toFixed(2);
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
        `<tr>
            <td class="font-medium">${prodNo}</td>
            <td class="text-center">${data.rolls}</td>
            <td class="text-center">${data.totalKg.toFixed(2)} KG</td>
        </tr>`
    ).join('');
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
        `<tr>
            <td>${defect}</td>
            <td class="text-center font-medium">${count}</td>
        </tr>`
    ).join('');
}

// Update Statistics table
function updateStatisticsTable(statistics) {
    // Roll Weight
    document.getElementById('rollWeightMin').textContent = statistics.rollWeight.min.toFixed(2);
    document.getElementById('rollWeightMax').textContent = statistics.rollWeight.max.toFixed(2);
    document.getElementById('rollWeightAvg').textContent = statistics.rollWeight.avg.toFixed(2);
    
    // Cut Width
    document.getElementById('cutWidthMin').textContent = Math.round(statistics.cutWidth.min);
    document.getElementById('cutWidthMax').textContent = Math.round(statistics.cutWidth.max);
    document.getElementById('cutWidthAvg').textContent = Math.round(statistics.cutWidth.avg);
    
    // GSM
    document.getElementById('gsmMin').textContent = statistics.gsm.min.toFixed(2);
    document.getElementById('gsmMax').textContent = statistics.gsm.max.toFixed(2);
    document.getElementById('gsmAvg').textContent = statistics.gsm.avg.toFixed(2);
    
    // Roll θ
    document.getElementById('rollThetaMin').textContent = Math.round(statistics.rollTheta.min);
    document.getElementById('rollThetaMax').textContent = Math.round(statistics.rollTheta.max);
    document.getElementById('rollThetaAvg').textContent = Math.round(statistics.rollTheta.avg);
    
    // Thickness
    document.getElementById('thicknessMin').textContent = statistics.thickness.min.toFixed(2);
    document.getElementById('thicknessMax').textContent = statistics.thickness.max.toFixed(2);
    document.getElementById('thicknessAvg').textContent = statistics.thickness.avg.toFixed(2);
} 