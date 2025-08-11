import { supabase } from '../supabase-config.js';

// Production Report - Fresh Start

// Global variables
let allForms = [];
let filteredForms = [];
let currentFilters = {
    fromDate: '',
    toDate: '',
    product: '',
    machine: '',
    shift: ''
};

// Initialize the page
document.addEventListener('DOMContentLoaded', async function() {
    // Initializing Production Report...
    
    // Check if user is a shift user
    let isShiftUser = false;
    let user = null;
    try {
        const result = await supabase.auth.getUser();
        user = result.data.user;
        if (user && user.email) {
            const username = user.email.split('@')[0].toLowerCase();
            if (username.includes('shift-a') || username.includes('shift-b') || username.includes('shift-c')) {
                isShiftUser = true;
            }
        }
    } catch (e) {
        console.log('Auth check failed:', e);
    }
    
    // Setup back button - hide for shift users
    const backBtn = document.querySelector('.header-back-button');
    if (backBtn) {
        if (isShiftUser) {
            // Hide back button for shift users
            backBtn.style.display = 'none';
            // Back button hidden for shift user
        } else {
            // Show back button for regular users
        backBtn.addEventListener('click', function() {
            window.location.href = 'employee_dashboard.html';
        });
            // Back button enabled for regular user
        }
    }
    
    // Initialize filter functionality
    initializeFilters();
    
    // Load initial data
    loadFormsData();
    
    // Production Report initialized
});

// Save current filter state to localStorage
function saveFilterState() {
    const filterState = {
        fromDate: document.getElementById('filterFromDate').value,
        toDate: document.getElementById('filterToDate').value,
        product: document.getElementById('filterProduct').value,
        machine: document.getElementById('filterMachine').value,
        shift: document.getElementById('filterShift').value
    };
    
    localStorage.setItem('productionReportFilters', JSON.stringify(filterState));
    // Filter state saved
}

// Load and apply saved filter state
function loadFilterState() {
    const savedState = localStorage.getItem('productionReportFilters');
    if (savedState) {
        try {
            const filterState = JSON.parse(savedState);
            // Loading saved filter state
            
            // Apply saved filters
            if (filterState.fromDate) {
                document.getElementById('filterFromDate').value = filterState.fromDate;
                currentFilters.fromDate = filterState.fromDate;
            }
            if (filterState.toDate) {
                document.getElementById('filterToDate').value = filterState.toDate;
                currentFilters.toDate = filterState.toDate;
            }
            
            // Populate dropdowns and apply filters
            if (filterState.fromDate || filterState.toDate) {
                populateMachineDropdown(filterState.fromDate, filterState.toDate);
                
                // Wait a bit for dropdown population, then apply machine filter
                setTimeout(() => {
                    if (filterState.machine) {
                        document.getElementById('filterMachine').value = filterState.machine;
                        currentFilters.machine = filterState.machine;
                        populateProductDropdown(filterState.fromDate, filterState.toDate, filterState.machine);
                        
                        // Wait a bit more for product dropdown population
                        setTimeout(() => {
                            if (filterState.product) {
                                document.getElementById('filterProduct').value = filterState.product;
                                currentFilters.product = filterState.product;
                                populateShiftDropdown(filterState.fromDate, filterState.toDate, filterState.machine, filterState.product);
                                
                                // Wait for shift dropdown population
                                setTimeout(() => {
                                    if (filterState.shift !== undefined) {
                                        document.getElementById('filterShift').value = filterState.shift;
                                        currentFilters.shift = filterState.shift;
                                        
                                        // Apply the complete filter
                                        if (filterState.shift) {
                                            getProductionShiftData(filterState.fromDate, filterState.toDate, filterState.product, filterState.machine, filterState.shift);
                                        } else {
                                            getAllShiftsData(filterState.fromDate, filterState.toDate, filterState.product, filterState.machine);
                                        }
                                    }
                                }, 100);
                            }
                        }, 100);
                    }
                }, 100);
            }
            
            updateFilterStatus(true);
            
        } catch (error) {
            console.error('❌ Error loading filter state:', error);
        }
    }
}

// Update filter status display
function updateFilterStatus(isActive) {
    const statusElement = document.getElementById('filterStatus');
    if (statusElement) {
        if (isActive) {
            statusElement.textContent = 'On';
            statusElement.className = 'px-2 py-1 text-sm font-semibold rounded-full bg-green-200 text-green-800';
        } else {
            statusElement.textContent = 'Off';
            statusElement.className = 'px-2 py-1 text-sm font-semibold rounded-full bg-gray-200 text-gray-700';
        }
    }
}

// Initialize cascading filter functionality
function initializeFilters() {
    // Add change listeners for cascading filters
    document.getElementById('filterFromDate')?.addEventListener('change', onDateChange);
    document.getElementById('filterToDate')?.addEventListener('change', onDateChange);
    document.getElementById('filterProduct')?.addEventListener('change', onProductChange);
    document.getElementById('filterMachine')?.addEventListener('change', onMachineChange);
    document.getElementById('filterShift')?.addEventListener('change', onShiftChange);
    
    // Clear button
    document.getElementById('clearFilter')?.addEventListener('click', clearAllFilters);
    
    // Cascading filter functionality initialized
}

// Step 1: Date selection changes
function onDateChange() {
    const fromDate = document.getElementById('filterFromDate').value;
    const toDate = document.getElementById('filterToDate').value;
    
    // Update current filters
    currentFilters.fromDate = fromDate;
    currentFilters.toDate = toDate;
    
    // Reset dependent dropdowns
    resetDropdown('filterMachine');
    resetDropdown('filterProduct');
    resetDropdown('filterShift');
    
    if (fromDate || toDate) {
        populateMachineDropdown(fromDate, toDate);
    }
    
    // Save filter state
    saveFilterState();
    
    // Date changed
}

// Step 2: Machine selection changes
function onMachineChange() {
    const fromDate = document.getElementById('filterFromDate').value;
    const toDate = document.getElementById('filterToDate').value;
    const machine = document.getElementById('filterMachine').value;
    
    // Update current filters
    currentFilters.machine = machine;
    
    // Reset dependent dropdowns
    resetDropdown('filterProduct');
    resetDropdown('filterShift');
    
    if (machine) {
        populateProductDropdown(fromDate, toDate, machine);
    }
    
    // Save filter state
    saveFilterState();
    
    // Machine changed
}

// Step 3: Product selection changes  
function onProductChange() {
    const fromDate = document.getElementById('filterFromDate').value;
    const toDate = document.getElementById('filterToDate').value;
    const machine = document.getElementById('filterMachine').value;
    const product = document.getElementById('filterProduct').value;
    
    // Update current filters
    currentFilters.product = product;
    
    // Reset dependent dropdowns
    resetDropdown('filterShift');
    
    if (product) {
        populateShiftDropdown(fromDate, toDate, machine, product);
    }
    
    // Save filter state
    saveFilterState();
    
    // Product changed
}

// Step 4: Shift selection changes - GET PRODUCTION SHIFT DATA
function onShiftChange() {
    const fromDate = document.getElementById('filterFromDate').value;
    const toDate = document.getElementById('filterToDate').value;
    const product = document.getElementById('filterProduct').value;
    const machine = document.getElementById('filterMachine').value;
    const shift = document.getElementById('filterShift').value;
    
    // Update current filters
    currentFilters.shift = shift;
    
    // Shift changed
    
    if (fromDate && toDate && product && machine) {
        if (shift) {
            // Single shift selected
            // Getting single shift data
            getProductionShiftData(fromDate, toDate, product, machine, shift);
        } else {
            // All shifts selected (empty value means "All Shifts")
            // Getting all shifts data
            getAllShiftsData(fromDate, toDate, product, machine);
        }
        
        // Save filter state and update status
        saveFilterState();
        updateFilterStatus(true);
    } else {
        // Missing required filters
    }
}

// Reset dropdown to "All" option only
function resetDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    if (dropdown) {
        dropdown.innerHTML = '<option value="">All</option>';
    }
}

// Clear all filters
function clearAllFilters() {
    document.getElementById('filterFromDate').value = '';
    document.getElementById('filterToDate').value = '';
    resetDropdown('filterProduct');
    resetDropdown('filterMachine');
    resetDropdown('filterShift');
    
    // Clear current filters
    currentFilters = {
        fromDate: '',
        toDate: '',
        product: '',
        machine: '',
        shift: ''
    };
    
    // Clear saved filter state
    localStorage.removeItem('productionReportFilters');
    
    // Clear summary tables
    clearSummaryTables();
    
    // Update filter status
    updateFilterStatus(false);
    
    // All filters cleared
}

// Clear summary tables back to default state
function clearSummaryTables() {
    // Clear Rolls Summary Table
    const rollsSummaryTable = document.getElementById('dynamicSummaryTableContainer');
    if (rollsSummaryTable) {
        const tbody = rollsSummaryTable.querySelector('tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td class="metric-label">Accepted Rolls</td>
                    <td class="metric-value">0 Rolls</td>
                    <td class="metric-value">0.00 KG</td>
                </tr>
                <tr>
                    <td class="metric-label">Rejected Rolls</td>
                    <td class="metric-value">0 Rolls</td>
                    <td class="metric-value">0.00 KG</td>
                </tr>
                <tr>
                    <td class="metric-label">Rolls Rejected for Rework</td>
                    <td class="metric-value">0 Rolls</td>
                    <td class="metric-value">0.00 KG</td>
                </tr>
                <tr>
                    <td class="metric-label">KIV Rolls</td>
                    <td class="metric-value">0 Rolls</td>
                    <td class="metric-value">0.00 KG</td>
                </tr>
                <tr class="highlight-row">
                    <td>Total Rolls</td>
                    <td>0 Rolls</td>
                    <td>0.00 KG</td>
                </tr>
            `;
        }
    }
    
    // Clear Defects Summary Table
    const defectsTable = document.getElementById('defectsSummaryTableContainer');
    if (defectsTable) {
        const tbody = defectsTable.querySelector('tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td class="metric-label" colspan="3">No defects found in this shift.</td>
                </tr>
            `;
        }
    }
    
    // Clear Statistics Table
    const statsTable = document.getElementById('statisticsTableContainer');
    if (statsTable) {
        const tbody = statsTable.querySelector('tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td class="parameter-cell">Roll Weight</td>
                    <td class="value-cell">0.00</td>
                    <td class="value-cell">0.00</td>
                    <td class="value-cell">0.00</td>
                </tr>
                <tr>
                    <td class="parameter-cell">Cut Width</td>
                    <td class="value-cell">0</td>
                    <td class="value-cell">0</td>
                    <td class="value-cell">0</td>
                </tr>
                <tr>
                    <td class="parameter-cell">GSM</td>
                    <td class="value-cell">0.00</td>
                    <td class="value-cell">0.00</td>
                    <td class="value-cell">0.00</td>
                </tr>
                <tr>
                    <td class="parameter-cell">Roll θ</td>
                    <td class="value-cell">0</td>
                    <td class="value-cell">0</td>
                    <td class="value-cell">0</td>
                </tr>
                <tr>
                    <td class="parameter-cell">Thickness</td>
                    <td class="value-cell">0.00</td>
                    <td class="value-cell">0.00</td>
                    <td class="value-cell">0.00</td>
                </tr>
            `;
        }
    }
    
    // Summary tables cleared
}

// Load forms data from database
async function loadFormsData() {
    try {
        // Loading forms data...
        
        // Load ALL forms data from the database
        const { data, error } = await supabase
            .from('inline_inspection_form_master_2')
            .select('*')
            .order('production_date', { ascending: false });
        
        if (error) throw error;
        
        // Loaded records from database
        
        // Load data
        allForms = data || [];
        
        // Data loaded - no filtering or display
        
        // Load saved filter state after data is loaded
        loadFilterState();
        
    } catch (error) {
        console.error('❌ Error loading forms:', error);
    }
}

// Populate Machine dropdown based on date range
function populateMachineDropdown(fromDate, toDate) {
    const filteredData = allForms.filter(form => {
        if (fromDate && form.production_date && form.production_date < fromDate) return false;
        if (toDate && form.production_date && form.production_date > toDate) return false;
        return form.mc_no; // Only include records with mc_no
    });
    
    const machines = [...new Set(filteredData.map(form => form.mc_no))];
    const dropdown = document.getElementById('filterMachine');
    
    dropdown.innerHTML = '<option value="">Select Machine</option>';
    machines.sort().forEach(machine => {
        const option = document.createElement('option');
        option.value = machine;
        option.textContent = machine;
        dropdown.appendChild(option);
    });
    
    // Found machines for date range
}

// Populate Product dropdown based on date + machine  
function populateProductDropdown(fromDate, toDate, machine) {
    const filteredData = allForms.filter(form => {
        if (fromDate && form.production_date && form.production_date < fromDate) return false;
        if (toDate && form.production_date && form.production_date > toDate) return false;
        if (String(form.mc_no) !== String(machine)) return false;
        return form.prod_code; // Only include records with prod_code
    });
    
    const products = [...new Set(filteredData.map(form => form.prod_code))];
    const dropdown = document.getElementById('filterProduct');
    
    dropdown.innerHTML = '<option value="">Select Product</option>';
    products.sort().forEach(product => {
        const option = document.createElement('option');
        option.value = product;
        option.textContent = product;
        dropdown.appendChild(option);
    });
    
    // Found products for machine
}

// Populate Shift dropdown based on date + machine + product
function populateShiftDropdown(fromDate, toDate, machine, product) {
    const filteredData = allForms.filter(form => {
        if (fromDate && form.production_date && form.production_date < fromDate) return false;
        if (toDate && form.production_date && form.production_date > toDate) return false;
        if (String(form.mc_no) !== String(machine)) return false;
        if (form.prod_code !== product) return false;
        return form.shift; // Only include records with shift
    });
    
    const shifts = [...new Set(filteredData.map(form => form.shift))];
    const dropdown = document.getElementById('filterShift');
    
    // Always include "All Shifts" option first
    dropdown.innerHTML = '<option value="">All Shifts</option>';
    
    // Add individual shift options
    shifts.sort().forEach(shift => {
        const option = document.createElement('option');
        option.value = shift;
        option.textContent = shift === '1' ? 'A' : shift === '2' ? 'B' : shift === '3' ? 'C' : shift;
        dropdown.appendChild(option);
    });
    
    // Found shifts for product
    
    // If we have data for this product, trigger the shift change to get data
    if (shifts.length > 0) {
        // Trigger shift change to get data (either single shift or all shifts)
        onShiftChange();
    }
}

// GET PRODUCTION SHIFT DATA - Final step
function getProductionShiftData(fromDate, toDate, product, machine, shift) {
    console.log('🎯 Getting production shift data for:', {fromDate, toDate, product, machine, shift});
    console.log('🔍 Total forms loaded:', allForms.length);
    
    // STEP 1: Find records that match the filter criteria (these have complete data)
    const masterRecords = allForms.filter(form => {
        if (fromDate && form.production_date && form.production_date < fromDate) return false;
        if (toDate && form.production_date && form.production_date > toDate) return false;
        if (form.prod_code !== product) return false;
        if (String(form.mc_no) !== String(machine)) return false;
        if (String(form.shift) !== String(shift)) return false;
        return true;
    });
    
    console.log(`📋 Found ${masterRecords.length} master records with complete data`);
    
    // STEP 2: Extract all traceability codes from master records
    const traceabilityCodes = [...new Set(masterRecords.map(form => form.traceability_code))];
    console.log('🔗 Traceability codes to search for:', traceabilityCodes);
    
    // STEP 3: Find ALL records (including lots) that match these traceability codes
    const allShiftData = allForms.filter(form => 
        traceabilityCodes.includes(form.traceability_code)
    );
    
    console.log(`📊 Found ${allShiftData.length} total records (including all lots) for this shift`);
    console.log('📋 All matching records:');
    allShiftData.forEach((form, index) => {
        console.log(`${index + 1}:`, {
            traceability_code: form.traceability_code,
            lot_letter: form.lot_letter,
            lot_no: form.lot_no,
            total_rolls: form.total_rolls,
            accepted_rolls: form.accepted_rolls,
            rejected_rolls: form.rejected_rolls,
            production_date: form.production_date,
            prod_code: form.prod_code
        });
    });
    
    // Update summary tables with ALL shift data (master + lots)
    updateSummaryTablesWithData(allShiftData);
}

// GET ALL SHIFTS DATA - For when "All Shifts" is selected
function getAllShiftsData(fromDate, toDate, product, machine) {
    console.log('🎯 Getting ALL shifts data for:', {fromDate, toDate, product, machine});
    console.log('🔍 Total forms loaded:', allForms.length);
    
    // STEP 1: Find records that match the filter criteria (these have complete data)
    const masterRecords = allForms.filter(form => {
        if (fromDate && form.production_date && form.production_date < fromDate) return false;
        if (toDate && form.production_date && form.production_date > toDate) return false;
        if (form.prod_code !== product) return false;
        if (String(form.mc_no) !== String(machine)) return false;
        return true; // Include all shifts
    });
    
    console.log(`📋 Found ${masterRecords.length} master records across all shifts`);
    
    // STEP 2: Extract all traceability codes from master records
    const traceabilityCodes = [...new Set(masterRecords.map(form => form.traceability_code))];
    console.log('🔗 Traceability codes to search for:', traceabilityCodes);
    
    // STEP 3: Find ALL records (including lots) that match these traceability codes
    const allShiftsData = allForms.filter(form => 
        traceabilityCodes.includes(form.traceability_code)
    );
    
    console.log(`📊 Found ${allShiftsData.length} total records (including all lots) across all shifts`);
    console.log('📋 All matching records across shifts:');
    allShiftsData.forEach((form, index) => {
        console.log(`${index + 1}:`, {
            traceability_code: form.traceability_code,
            lot_letter: form.lot_letter,
            lot_no: form.lot_no,
            shift: form.shift,
            total_rolls: form.total_rolls,
            accepted_rolls: form.accepted_rolls,
            rejected_rolls: form.rejected_rolls,
            production_date: form.production_date,
            prod_code: form.prod_code
        });
    });
    
    // Update summary tables with ALL shifts data (master + lots)
    updateSummaryTablesWithData(allShiftsData);
}

// Update summary tables with filtered shift data
function updateSummaryTablesWithData(shiftData) {
    console.log('📊 Processing shift data:', shiftData.length, 'records');
    
    // Calculate totals by aggregating ALL lots/records for this shift
    let totalAccepted = 0, totalRejected = 0, totalRework = 0, totalKIV = 0;
    let totalAcceptedWeight = 0, totalRejectedWeight = 0, totalReworkWeight = 0, totalKIVWeight = 0;
    let rollWeightSum = 0;
    let rollWeightCount = 0;
    
    // Aggregate data from all lots/records in this shift
    shiftData.forEach(form => {
        console.log(`Processing record: ${form.traceability_code}-${form.lot_letter}-${form.lot_no}`);
        
        // Sum up rolls from each record
        totalAccepted += parseInt(form.accepted_rolls) || 0;
        totalRejected += parseInt(form.rejected_rolls) || 0;
        totalRework += parseInt(form.rework_rolls) || 0;
        totalKIV += parseInt(form.kiv_rolls) || 0;
        
        // Sum up weights from direct columns
        totalAcceptedWeight += parseFloat(form.accepted_weight) || 0;
        totalRejectedWeight += parseFloat(form.rejected_weight) || 0;
        totalReworkWeight += parseFloat(form.rework_weight) || 0;
        totalKIVWeight += parseFloat(form.kiv_weight) || 0;
        
        // Also calculate from roll_weights JSONB for comparison
        if (form.roll_weights && typeof form.roll_weights === 'object') {
            const weights = Object.values(form.roll_weights);
            weights.forEach(weight => {
                const w = parseFloat(weight) || 0;
                if (w > 0) {
                    rollWeightSum += w;
                    rollWeightCount++;
                }
            });
        }
    });
    
    const totalRolls = totalAccepted + totalRejected + totalRework + totalKIV;
    const totalWeight = totalAcceptedWeight + totalRejectedWeight + totalReworkWeight + totalKIVWeight;
    
    console.log('📊 Aggregated totals:', {
        totalAccepted, totalRejected, totalRework, totalKIV, totalRolls,
        totalWeight, rollWeightSum, rollWeightCount
    });
    
    // Update Rolls Summary Table
    const container = document.getElementById('dynamicSummaryTableContainer');
    if (container) {
        const table = container.querySelector('table tbody');
        table.innerHTML = `
            <tr>
                <td class="metric-label">Accepted Rolls</td>
                <td class="metric-value">${totalAccepted} Rolls</td>
                <td class="metric-value">${totalAcceptedWeight.toFixed(2)} KG</td>
            </tr>
            <tr>
                <td class="metric-label">Rejected Rolls</td>
                <td class="metric-value">${totalRejected} Rolls</td>
                <td class="metric-value">${totalRejectedWeight.toFixed(2)} KG</td>
            </tr>
            <tr>
                <td class="metric-label">Rolls Rejected for Rework</td>
                <td class="metric-value">${totalRework} Rolls</td>
                <td class="metric-value">${totalReworkWeight.toFixed(2)} KG</td>
            </tr>
            <tr>
                <td class="metric-label">KIV Rolls</td>
                <td class="metric-value">${totalKIV} Rolls</td>
                <td class="metric-value">${totalKIVWeight.toFixed(2)} KG</td>
            </tr>
            <tr class="highlight-row">
                <td>Total Rolls</td>
                <td>${totalRolls} Rolls</td>
                <td>${totalWeight.toFixed(2)} KG</td>
            </tr>
        `;
    }
    
    // Update other summary tables with aggregated data
    updateDefectsSummaryTable(shiftData);

    updateStatisticsTable(shiftData);
    
    console.log('📋 All summary tables updated with aggregated shift data');
}

// Update Defects Summary Table
function updateDefectsSummaryTable(shiftData) {
    const defectData = {};
    
    shiftData.forEach(form => {
        if (form.defect_names && typeof form.defect_names === 'object' && 
            form.roll_weights && typeof form.roll_weights === 'object') {
            
            // Get roll positions that have defects
            const defectPositions = Object.keys(form.defect_names);
            
            defectPositions.forEach(rollPosition => {
                const defectName = form.defect_names[rollPosition];
                const rollWeight = parseFloat(form.roll_weights[rollPosition]) || 0;
                
                if (defectName && defectName.trim() !== '' && rollWeight > 0) {
                    if (!defectData[defectName]) {
                        defectData[defectName] = { count: 0, weight: 0 };
                    }
                    defectData[defectName].count += 1;
                    
                    // Add the ACTUAL roll weight for this specific defect
                    defectData[defectName].weight += rollWeight;
                }
            });
        }
    });
    
    console.log('🔍 Defect data calculated:', defectData);
    
    const container = document.getElementById('defectsSummaryTableContainer');
    if (container) {
        const tbody = container.querySelector('table tbody');
        if (Object.keys(defectData).length === 0) {
            tbody.innerHTML = '<tr><td class="metric-label" colspan="3">No defects found in this shift.</td></tr>';
        } else {
            // Calculate totals
            const totalCount = Object.values(defectData).reduce((sum, data) => sum + data.count, 0);
            const totalWeight = Object.values(defectData).reduce((sum, data) => sum + data.weight, 0);
            
            tbody.innerHTML = Object.entries(defectData)
                .sort(([,a], [,b]) => b.count - a.count) // Sort by count (highest to lowest)
                .map(([defect, data]) => 
                    `<tr><td class="metric-label">${defect}</td><td class="defect-count">${data.count}</td><td class="metric-value">${data.weight.toFixed(2)}</td></tr>`
                ).join('') + 
                `<tr class="highlight-row"><td class="metric-label">Total</td><td class="defect-count">${totalCount}</td><td class="metric-value">${totalWeight.toFixed(2)}</td></tr>`;
        }
    }
}



// Update Statistics Table
function updateStatisticsTable(shiftData) {
    const stats = {
        rollWeight: [],
        cutWidth: [],
        gsm: [],
        rollTheta: [],
        thickness: []
    };
    
    shiftData.forEach(form => {
        // Collect roll weights from JSONB
        if (form.roll_weights && typeof form.roll_weights === 'object') {
            Object.values(form.roll_weights).forEach(weight => {
                const w = parseFloat(weight);
                if (!isNaN(w) && w > 0) stats.rollWeight.push(w);
            });
        }
        
        // Collect other stats from JSONB fields
        if (form.roll_widths && typeof form.roll_widths === 'object') {
            Object.values(form.roll_widths).forEach(width => {
                const w = parseFloat(width);
                if (!isNaN(w) && w > 0) stats.cutWidth.push(w);
            });
        }
        
        if (form.film_weights_gsm && typeof form.film_weights_gsm === 'object') {
            Object.values(form.film_weights_gsm).forEach(gsm => {
                const g = parseFloat(gsm);
                if (!isNaN(g) && g > 0) stats.gsm.push(g);
            });
        }
        
        if (form.roll_diameters && typeof form.roll_diameters === 'object') {
            Object.values(form.roll_diameters).forEach(theta => {
                const t = parseFloat(theta);
                if (!isNaN(t) && t > 0) stats.rollTheta.push(t);
            });
        }
        
        if (form.thickness_data && typeof form.thickness_data === 'object') {
            Object.values(form.thickness_data).forEach(thickness => {
                const t = parseFloat(thickness);
                if (!isNaN(t) && t > 0) stats.thickness.push(t);
            });
        }
    });
    
    // Calculate min, max, avg for each parameter
    const calculateStats = (arr) => {
        if (arr.length === 0) return { min: 0, max: 0, avg: 0 };
        const min = Math.min(...arr);
        const max = Math.max(...arr);
        const avg = arr.reduce((sum, val) => sum + val, 0) / arr.length;
        return { min, max, avg };
    };
    
    const rollWeightStats = calculateStats(stats.rollWeight);
    const cutWidthStats = calculateStats(stats.cutWidth);
    const gsmStats = calculateStats(stats.gsm);
    const rollThetaStats = calculateStats(stats.rollTheta);
    const thicknessStats = calculateStats(stats.thickness);
    
    const container = document.getElementById('statisticsTableContainer');
    if (container) {
        const tbody = container.querySelector('table tbody');
        tbody.innerHTML = `
            <tr>
                <td class="parameter-cell">Roll Weight</td>
                <td class="value-cell">${rollWeightStats.min.toFixed(2)}</td>
                <td class="value-cell">${rollWeightStats.max.toFixed(2)}</td>
                <td class="value-cell">${rollWeightStats.avg.toFixed(2)}</td>
            </tr>
            <tr>
                <td class="parameter-cell">Cut Width</td>
                <td class="value-cell">${cutWidthStats.min.toFixed(0)}</td>
                <td class="value-cell">${cutWidthStats.max.toFixed(0)}</td>
                <td class="value-cell">${cutWidthStats.avg.toFixed(0)}</td>
            </tr>
            <tr>
                <td class="parameter-cell">GSM</td>
                <td class="value-cell">${gsmStats.min.toFixed(2)}</td>
                <td class="value-cell">${gsmStats.max.toFixed(2)}</td>
                <td class="value-cell">${gsmStats.avg.toFixed(2)}</td>
            </tr>
            <tr>
                <td class="parameter-cell">Roll θ</td>
                <td class="value-cell">${rollThetaStats.min.toFixed(0)}</td>
                <td class="value-cell">${rollThetaStats.max.toFixed(0)}</td>
                <td class="value-cell">${rollThetaStats.avg.toFixed(0)}</td>
            </tr>
            <tr>
                <td class="parameter-cell">Thickness</td>
                <td class="value-cell">${thicknessStats.min.toFixed(2)}</td>
                <td class="value-cell">${thicknessStats.max.toFixed(2)}</td>
                <td class="value-cell">${thicknessStats.avg.toFixed(2)}</td>
            </tr>
        `;
    }
}


