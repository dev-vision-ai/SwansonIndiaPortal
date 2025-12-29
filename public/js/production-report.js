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
    shift: '',
    productionType: ''
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
            window.location.href = 'employee-dashboard.html';
        });
            // Back button enabled for regular user
        }
    }
    
    // Initialize filter functionality
    initializeFilters();
    
    // Fetch defect types and initialize defect tracking table
    await fetchDefectTypes();
    initializeDefectTrackingTable();

    // Wire download button for defect report
    bindDefectDownloadButton();
    
    // Load initial data
    loadFormsData();
    
    // Save filter state when page is about to be unloaded
    window.addEventListener('beforeunload', saveFilterState);
    
    // Production Report initialized
});

// Save current filter state to localStorage
function saveFilterState() {
    const filterState = {
        fromDate: document.getElementById('filterFromDate').value,
        toDate: document.getElementById('filterToDate').value,
        product: document.getElementById('filterProduct').value,
        machine: document.getElementById('filterMachine').value,
        shift: document.getElementById('filterShift').value,
        productionType: document.getElementById('filterProductionType').value
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
            console.log('🔄 Loading saved filter state:', filterState);
            
            // Apply saved filters to form inputs and update currentFilters
            if (filterState.fromDate) {
                document.getElementById('filterFromDate').value = filterState.fromDate;
                currentFilters.fromDate = filterState.fromDate;
            }
            if (filterState.toDate) {
                document.getElementById('filterToDate').value = filterState.toDate;
                currentFilters.toDate = filterState.toDate;
            }
            if (filterState.machine) {
                currentFilters.machine = filterState.machine;
            }
            if (filterState.product) {
                currentFilters.product = filterState.product;
            }
            if (filterState.shift !== undefined) {
                currentFilters.shift = filterState.shift;
            }
            if (filterState.productionType) {
                currentFilters.productionType = filterState.productionType;
            }
            
            // Populate dropdowns and apply filters with improved timing
            if (filterState.fromDate || filterState.toDate) {
                populateMachineDropdown(filterState.fromDate, filterState.toDate, filterState.productionType);
                
                // Wait for dropdown population, then apply machine filter
                setTimeout(() => {
                    if (filterState.machine) {
                        document.getElementById('filterMachine').value = filterState.machine;
                        currentFilters.machine = filterState.machine;
                        populateProductDropdown(filterState.fromDate, filterState.toDate, filterState.machine, filterState.productionType);
                        
                        // Wait for product dropdown population
                        setTimeout(() => {
                            if (filterState.product) {
                                document.getElementById('filterProduct').value = filterState.product;
                                currentFilters.product = filterState.product;
                                populateShiftDropdown(filterState.fromDate, filterState.toDate, filterState.machine, filterState.product, true);
                                
                                // Wait for shift dropdown population and apply final filter
                                setTimeout(() => {
                                    if (filterState.shift !== undefined) {
                                        document.getElementById('filterShift').value = filterState.shift;
                                        currentFilters.shift = filterState.shift;
                                        
                                        // Apply the complete filter based on saved state
                                        applySavedFilter(filterState);
                                    }
                                }, 200);
                            } else {
                                // No product selected, but we still need to apply the filter
                                setTimeout(() => {
                                    applySavedFilter(filterState);
                                }, 200);
                            }
                        }, 200);
                    } else {
                        // No machine selected, but we still need to apply the filter
                        setTimeout(() => {
                            applySavedFilter(filterState);
                        }, 200);
                    }
                }, 200);
            }

            // Only set filter status to "On" if filters actually have meaningful values
            const hasActiveFilters = filterState.fromDate &&
                                   filterState.toDate &&
                                   filterState.machine &&
                                   filterState.machine !== 'all';
            updateFilterStatus(hasActiveFilters);
            
        } catch (error) {
            console.error('❌ Error loading filter state:', error);
        }
    }
}

// Apply the saved filter based on the complete filter state
function applySavedFilter(filterState) {
    console.log('🎯 Applying saved filter:', filterState);
    
    // Set production type dropdown value if available
    if (filterState.productionType) {
        document.getElementById('filterProductionType').value = filterState.productionType;
    }
    
    if (filterState.fromDate && filterState.toDate && filterState.machine) {
        if (filterState.product && filterState.product !== 'all') {
            // Specific product selected
            if (filterState.shift) {
                // Single shift selected
                getProductionShiftData(filterState.fromDate, filterState.toDate, filterState.product, filterState.machine, filterState.shift);
            } else {
                // All shifts selected
                getAllShiftsData(filterState.fromDate, filterState.toDate, filterState.product, filterState.machine);
            }
        } else {
            // All products selected - show combined data for all products
            if (filterState.shift) {
                // Single shift selected - get all products for this machine and shift
                getAllProductsData(filterState.fromDate, filterState.toDate, filterState.machine, filterState.shift, filterState.productionType);
            } else {
                // All shifts selected - get all products for this machine
                getAllProductsData(filterState.fromDate, filterState.toDate, filterState.machine, '', filterState.productionType);
            }
        }
    }
}

// Check if filters are actually active (have meaningful values)
function areFiltersActive() {
    return currentFilters.fromDate &&
           currentFilters.toDate &&
           currentFilters.machine &&
           currentFilters.machine !== 'all';
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
    // Keep download button visibility in sync with filter status
    updateDownloadButtonVisibility();
}

// Toggle download button visibility based on whether filters are active
function updateDownloadButtonVisibility() {
    const btn = document.getElementById('downloadDefectsBtn');
    if (!btn) return;
    try {
        if (areFiltersActive()) {
            btn.style.display = 'inline-block';
        } else {
            btn.style.display = 'none';
        }
    } catch (e) {
        // ignore
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
    document.getElementById('filterProductionType')?.addEventListener('change', onProductionTypeChange);
    
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
    
    // Clear summary tables when date changes
    clearSummaryTables();
    
    // Reset dependent dropdowns - Production Type stays, but everything after it resets
    resetDropdown('filterMachine');
    resetDropdown('filterProduct');
    resetDropdown('filterShift');
    
    if (fromDate || toDate) {
        populateMachineDropdown(fromDate, toDate, '');
        // Also populate product dropdown with ALL products from date range
        populateProductDropdown(fromDate, toDate, '', '');
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
    
    // Clear summary tables when machine changes
    clearSummaryTables();
    
    // Reset dependent dropdowns
    resetDropdown('filterProduct');
    resetDropdown('filterShift');
    
    // Always populate product dropdown - if machine is selected, filter by it; if not, show all products
    const productionType = document.getElementById('filterProductionType').value;
    populateProductDropdown(fromDate, toDate, machine, productionType);
    
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
    
    // Clear summary tables when product changes
    clearSummaryTables();
    
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
    const productionType = document.getElementById('filterProductionType').value;
    
    // Update current filters
    currentFilters.shift = shift;
    currentFilters.productionType = productionType;
    
    // Shift changed
    
    if (fromDate && toDate && machine) {
        if (product && product !== 'all') {
            // Specific product selected
            if (shift) {
                // Single shift selected
                getProductionShiftData(fromDate, toDate, product, machine, shift);
            } else {
                // All shifts selected
                getAllShiftsData(fromDate, toDate, product, machine);
            }
        } else {
            // All products selected - show combined data for all products
            if (shift) {
                // Single shift selected - get all products for this machine and shift
                getAllProductsData(fromDate, toDate, machine, shift, productionType);
            } else {
                // All shifts selected - get all products for this machine
                getAllProductsData(fromDate, toDate, machine, '', productionType);
            }
        }
        
        // Save filter state and update status
        saveFilterState();
        updateFilterStatus(areFiltersActive());
    } else {
        // Missing required filters
    }
}

// Step 5: Production Type selection changes - RELOAD DATA WITH NEW FILTER
function onProductionTypeChange() {
    const fromDate = document.getElementById('filterFromDate').value;
    const toDate = document.getElementById('filterToDate').value;
    const product = document.getElementById('filterProduct').value;
    const machine = document.getElementById('filterMachine').value;
    const shift = document.getElementById('filterShift').value;
    const productionType = document.getElementById('filterProductionType').value;
    
    // Update current filters
    currentFilters.productionType = productionType;
    
    // Production Type changed - reset dependent dropdowns and repopulate machines
    resetDropdown('filterMachine');
    resetDropdown('filterProduct');
    resetDropdown('filterShift');
    
    // Re-populate machine dropdown with production type filter applied
    if (fromDate || toDate) {
        populateMachineDropdown(fromDate, toDate, productionType);
    }
    
    // Save filter state and update status
    saveFilterState();
    updateFilterStatus(areFiltersActive());
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
    
    // Special handling for production type dropdown - restore its options
    const productionTypeDropdown = document.getElementById('filterProductionType');
    if (productionTypeDropdown) {
        productionTypeDropdown.innerHTML = `
            <option value="">All</option>
            <option value="Commercial">Commercial</option>
            <option value="Trial">Trial</option>
        `;
    }
    
    // Clear current filters
    currentFilters = {
        fromDate: '',
        toDate: '',
        product: '',
        machine: '',
        shift: '',
        productionType: ''
    };
    
    // Clear saved filter state
    localStorage.removeItem('productionReportFilters');
    
    // Clear summary tables
    clearSummaryTables();
    
    // Update filter status
    updateFilterStatus(areFiltersActive());
    
    // Repopulate dropdowns to reflect cleared state and reload data view
    try {
        // Ensure production type dropdown exists and read its value
        const productionTypeDropdown = document.getElementById('filterProductionType');
        const productionType = productionTypeDropdown ? productionTypeDropdown.value : '';

        // Repopulate machine/product/shift dropdowns for the cleared date range (show all)
        populateMachineDropdown('', '', productionType);
        populateProductDropdown('', '', '', productionType);
        // Populate shifts (no machine/product selected) - skip auto-trigger to avoid unnecessary data fetch
        populateShiftDropdown('', '', '', '', true);

        // Explicitly update download button and filter status once more
        updateFilterStatus(false);
        updateDownloadButtonVisibility();
    } catch (e) {
        console.error('Error while reloading filters after clear:', e);
    }

    // All filters cleared and UI reloaded
}

// Clear summary tables back to default state
function clearSummaryTables() {
    // Clear Rolls Summary Table
    const rollsSummaryTable = document.getElementById('dynamicSummaryTableContainer');
    if (rollsSummaryTable) {
        const table = rollsSummaryTable.querySelector('table');
        if (table) {
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>Category</th>
                        <th>Rolls</th>
                        <th>KGS</th>
                    </tr>
                </thead>
                <tbody>
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
                </tbody>
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
    
    // Clear Defect Tracking Table
    clearDefectTrackingTable();
    
    // Summary tables cleared
}

// Load forms data from database
async function loadFormsData() {
    try {

        
        // First, get the total count to understand our data size across all tables
        const tables = ['inline_inspection_form_master_1', 'inline_inspection_form_master_2', 'inline_inspection_form_master_3'];
        let totalCount = 0;
        
        for (const table of tables) {
            const { count, error: countError } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });
            
            if (countError) {
                console.error(`❌ Count error for ${table}:`, countError);
            } else {
                totalCount += count || 0;
            }
        }
        
        // Total records count available if needed
        
        // Load data in chunks from all tables
        let allData = [];
        const chunkSize = 1000;
        
        for (const table of tables) {
            let hasMore = true;
            let offset = 0;
            
            while (hasMore) {
                const { data, error } = await supabase
                    .from(table)
                    .select('*')
                    .order('production_date', { ascending: false })
                    .range(offset, offset + chunkSize - 1);
                
                if (error) {
                    console.error(`❌ Database error for ${table}:`, error);
                    throw error;
                }
                
                if (data && data.length > 0) {
                    // Add table name to each record for tracking
                    data.forEach(record => {
                        record.table_name = table;
                    });
                    allData = [...allData, ...data];
                    offset += chunkSize;

                    
                    // Stop if we got less than chunk size (end of data)
                    if (data.length < chunkSize) {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                }
            }
        }
        

        
        // Set the global data
        allForms = allData;
        
        // Load saved filter state after data is loaded
        loadFilterState();
        
    } catch (error) {
        console.error('❌ Error loading forms:', error);
    }
}

// Populate Machine dropdown based on date range
function populateMachineDropdown(fromDate, toDate, productionType) {
    
    const filteredData = allForms.filter(form => {
        let includeRecord = true;
        
        if (fromDate && form.production_date) {
            const formDate = new Date(form.production_date);
            const fromDateObj = new Date(fromDate);
            if (formDate < fromDateObj) {
                includeRecord = false;
            }
        }
        if (toDate && form.production_date) {
            const formDate = new Date(form.production_date);
            const toDateObj = new Date(toDate);
            if (formDate > toDateObj) {
                includeRecord = false;
            }
        }
        
        // Filter by production type if specified
        if (productionType) {
            const formProductionType = form.production_type || 'Commercial'; // Treat NULL as Commercial
            if (String(formProductionType) !== String(productionType)) {
                includeRecord = false;
            }
        }
        
        if (includeRecord && form.mc_no) {
            return true;
        }
        
        return false; // Only include records with mc_no
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
function populateProductDropdown(fromDate, toDate, machine, productionType) {
    const filteredData = allForms.filter(form => {
        if (fromDate && form.production_date) {
            const formDate = new Date(form.production_date);
            const fromDateObj = new Date(fromDate);
            if (formDate < fromDateObj) return false;
        }
        if (toDate && form.production_date) {
            const formDate = new Date(form.production_date);
            const toDateObj = new Date(toDate);
            if (formDate > toDateObj) return false;
        }
        // Only filter by machine if one is selected
        if (machine && String(form.mc_no) !== String(machine)) return false;
        
        // Filter by production type if specified
        if (productionType) {
            const formProductionType = form.production_type || 'Commercial'; // Treat NULL as Commercial
            if (String(formProductionType) !== String(productionType)) return false;
        }
        
        return form.prod_code; // Only include records with prod_code
    });
    
    const products = [...new Set(filteredData.map(form => form.prod_code))];
    const dropdown = document.getElementById('filterProduct');
    

    
    dropdown.innerHTML = '<option value="">Select Product</option><option value="all">All Products</option>';
    products.sort().forEach(product => {
        const option = document.createElement('option');
        option.value = product;
        option.textContent = product;
        dropdown.appendChild(option);
    });
    
    // Found products for machine
}

// Populate Shift dropdown based on date + machine + product
function populateShiftDropdown(fromDate, toDate, machine, product, skipAutoTrigger = false) {
    const filteredData = allForms.filter(form => {
        if (fromDate && form.production_date) {
            const formDate = new Date(form.production_date);
            const fromDateObj = new Date(fromDate);
            if (formDate < fromDateObj) return false;
        }
        if (toDate && form.production_date) {
            const formDate = new Date(form.production_date);
            const toDateObj = new Date(toDate);
            if (formDate > toDateObj) return false;
        }
        if (String(form.mc_no) !== String(machine)) return false;
        // Only filter by product if it's not "all"
        if (product && product !== 'all' && form.prod_code !== product) return false;
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
    
    // Only trigger shift change if not loading saved state
    if (shifts.length > 0 && !skipAutoTrigger) {
        // Trigger shift change to get data (either single shift or all shifts)
        onShiftChange();
    }
}

// GET PRODUCTION SHIFT DATA - Final step
function getProductionShiftData(fromDate, toDate, product, machine, shift) {
    
    // STEP 1: Find records that match the filter criteria (these have complete data)
    const masterRecords = allForms.filter(form => {
        if (fromDate && form.production_date) {
            const formDate = new Date(form.production_date);
            const fromDateObj = new Date(fromDate);
            if (formDate < fromDateObj) return false;
        }
        if (toDate && form.production_date) {
            const formDate = new Date(form.production_date);
            const toDateObj = new Date(toDate);
            if (formDate > toDateObj) return false;
        }
        if (product && form.prod_code !== product) return false; // Only filter by product if one is selected
        if (String(form.mc_no) !== String(machine)) return false;
        if (String(form.shift) !== String(shift)) return false;
        return true;
    });
    
    // STEP 2: Extract all traceability codes and lot letters from master records
    const traceabilityKeys = [...new Set(masterRecords.map(form => `${form.traceability_code}-${form.lot_letter}`))];
    
    // STEP 3: Find ALL records (including all lots) that match these traceability keys
    const allShiftData = allForms.filter(form => {
        const traceabilityKey = `${form.traceability_code}-${form.lot_letter}`;
        return traceabilityKeys.includes(traceabilityKey);
    });
    
    // Update summary tables with ALL shift data (master + lots)
    updateSummaryTablesWithData(allShiftData);
}

// GET ALL SHIFTS DATA - For when "All Shifts" is selected
function getAllShiftsData(fromDate, toDate, product, machine) {
    
    // STEP 1: Find records that match the filter criteria (these have complete data)
    const masterRecords = allForms.filter(form => {
        if (fromDate && form.production_date) {
            const formDate = new Date(form.production_date);
            const fromDateObj = new Date(fromDate);
            if (formDate < fromDateObj) return false;
        }
        if (toDate && form.production_date) {
            const formDate = new Date(form.production_date);
            const toDateObj = new Date(toDate);
            if (formDate > toDateObj) return false;
        }
        if (product && form.prod_code !== product) return false; // Only filter by product if one is selected
        if (String(form.mc_no) !== String(machine)) return false;
        return true; // Include all shifts
    });
    
    // STEP 2: Extract all traceability codes and lot letters from master records
    const traceabilityKeys = [...new Set(masterRecords.map(form => `${form.traceability_code}-${form.lot_letter}`))];
    
    // STEP 3: Find ALL records (including all lots) that match these traceability keys
    const allShiftsData = allForms.filter(form => {
        const traceabilityKey = `${form.traceability_code}-${form.lot_letter}`;
        return traceabilityKeys.includes(traceabilityKey);
    });
    
    // Update summary tables with ALL shifts data (master + lots)
    updateSummaryTablesWithData(allShiftsData);
}

// Update summary tables with filtered shift data
function updateSummaryTablesWithData(shiftData, skipStatistics = false) {
    
    // Group records by traceability key to see all lots
    const groupedByTraceabilityKey = {};
    shiftData.forEach(form => {
        const key = `${form.traceability_code}-${form.lot_letter}`;
        if (!groupedByTraceabilityKey[key]) {
            groupedByTraceabilityKey[key] = [];
        }
        groupedByTraceabilityKey[key].push(form);
    });
    
    // Calculate totals by aggregating ALL lots/records for this shift
    let totalAccepted = 0, totalRejected = 0, totalRework = 0, totalKIV = 0;
    let totalAcceptedWeight = 0, totalRejectedWeight = 0, totalReworkWeight = 0, totalKIVWeight = 0;
    let rollWeightSum = 0;
    let rollWeightCount = 0;
    
    // Aggregate data from all lots/records in this shift
    shiftData.forEach(form => {
        
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
    
    // Update defect tracking table
    updateDefectTrackingTable(shiftData);

    // Only update statistics table if not skipping
    if (!skipStatistics) {
        updateStatisticsTable(shiftData);
    } else {
        // Clear statistics table when skipping (for "All Products" view)
        const statsContainer = document.getElementById('statisticsTableContainer');
        if (statsContainer) {
            const tbody = statsContainer.querySelector('table tbody');
            tbody.innerHTML = `
                <tr>
                    <td class="parameter-cell" colspan="4">Statistics not available for combined products view</td>
                </tr>
            `;
        }
    }
    
}

// Update Defects Summary Table
function updateDefectsSummaryTable(shiftData) {
    const defectData = {};
    let totalProduced = 0;
    
    // Calculate total produced rolls and defect data
    shiftData.forEach(form => {
        // Calculate total produced rolls for this form
        const acceptedRolls = parseInt(form.accepted_rolls) || 0;
        const rejectedRolls = parseInt(form.rejected_rolls) || 0;
        const reworkRolls = parseInt(form.rework_rolls) || 0;
        const kivRolls = parseInt(form.kiv_rolls) || 0;
        totalProduced += acceptedRolls + rejectedRolls + reworkRolls + kivRolls;
        
        // Extract defect data
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
    
    const container = document.getElementById('defectsSummaryTableContainer');
    if (container) {
        const tbody = container.querySelector('table tbody');
        if (Object.keys(defectData).length === 0) {
            tbody.innerHTML = '<tr><td class="metric-label" colspan="4">No defects found in this shift.</td></tr>';
        } else {
            // Calculate totals
            const totalCount = Object.values(defectData).reduce((sum, data) => sum + data.count, 0);
            const totalWeight = Object.values(defectData).reduce((sum, data) => sum + data.weight, 0);
            const totalDefectPercent = totalProduced > 0 ? ((totalCount / totalProduced) * 100).toFixed(2) : '0.00';
            
            tbody.innerHTML = Object.entries(defectData)
                .sort(([,a], [,b]) => b.count - a.count) // Sort by count (highest to lowest)
                .map(([defect, data]) => {
                    const defectPercent = totalProduced > 0 ? ((data.count / totalProduced) * 100).toFixed(2) : '0.00';
                    return `<tr><td class="metric-label">${defect}</td><td class="defect-count">${data.count}</td><td class="defect-percent">${defectPercent}%</td><td class="metric-value">${data.weight.toFixed(2)}</td></tr>`;
                }).join('') + 
                `<tr class="highlight-row"><td class="metric-label">Total</td><td class="defect-count">${totalCount}</td><td class="defect-percent">${totalDefectPercent}%</td><td class="metric-value">${totalWeight.toFixed(2)}</td></tr>`;
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

// GET ALL PRODUCTS DATA - Show combined data from all products for a machine
function getAllProductsData(fromDate, toDate, machine, shift, productionType) {
    
            // getAllProductsData called
    
    // STEP 1: Find records that match the filter criteria (machine + date + shift + productionType, but NO product filter)
    const masterRecords = allForms.filter(form => {
        if (fromDate && form.production_date) {
            const formDate = new Date(form.production_date);
            const fromDateObj = new Date(fromDate);
            if (formDate < fromDateObj) return false;
        }
        if (toDate && form.production_date) {
            const formDate = new Date(form.production_date);
            const toDateObj = new Date(toDate);
            if (formDate > toDateObj) return false;
        }
        if (String(form.mc_no) !== String(machine)) return false;
        if (shift && String(form.shift) !== String(shift)) return false;
        if (productionType) {
            const formProductionType = form.production_type || 'Commercial'; // Treat NULL as Commercial
            if (String(formProductionType) !== String(productionType)) return false;
        }
        return true; // Include all products
    });
    
    // STEP 2: Extract all traceability codes and lot letters from master records
    const traceabilityKeys = [...new Set(masterRecords.map(form => `${form.traceability_code}-${form.lot_letter}`))];
    
    // STEP 3: Find ALL records (including all lots) that match these traceability keys
    const allProductsData = allForms.filter(form => {
        const traceabilityKey = `${form.traceability_code}-${form.lot_letter}`;
        return traceabilityKeys.includes(traceabilityKey);
    });
    
    // getAllProductsData results
    
    // Update summary tables with combined data from all products (skip statistics for all products)
    updateSummaryTablesWithData(allProductsData, true); // true = skip statistics
}

// Defect tracking functionality
let defectTypes = []; // Will be populated from database

// Fetch defect types from database
async function fetchDefectTypes() {
    try {
        const { data, error } = await supabase
            .from('all_defects')
            .select('defect_name')
            .order('defect_name');
            
        if (error) {
            console.error('Error fetching defect types:', error);
            return [];
        }
        
        defectTypes = data.map(item => item.defect_name);
        // Fetched defect types from database
        return defectTypes;
    } catch (error) {
        console.error('Error fetching defect types:', error);
        return [];
    }
}

// Initialize defect tracking table
function initializeDefectTrackingTable() {
    const tbody = document.getElementById('defectTrackingTableBody');
    if (!tbody) return;

    // Check if defect types are loaded
    if (!defectTypes || defectTypes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="24" class="text-center py-4">Loading defect types...</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = defectTypes.map(defect => {
        const cells = Array.from({ length: 21 }, (_, i) => 
            `<td class="defect-absent">0</td>`
        ).join('');
        
        return `
            <tr>
                <td class="defect-name">${defect}</td>
                <td class="defect-qty">0</td>
                <td style="font-weight: 500; color: #1f2937;">0.00%</td>
                ${cells}
            </tr>
        `;
    }).join('');
}

// Update defect tracking table with data
function updateDefectTrackingTable(formsData) {
    if (!formsData || formsData.length === 0) {
        clearDefectTrackingTable();
        return;
    }

    // Check if defect types are loaded
    if (!defectTypes || defectTypes.length === 0) {
        // Defect types not loaded yet, skipping update
        return;
    }

    // Processing forms data for defect tracking

    // Initialize defect tracking data structure
    const defectData = {};
    defectTypes.forEach(defect => {
        defectData[defect] = {
            totalQty: 0,
            occurrences: Array(21).fill(0)  // Array with 21 elements for positions 1-21
        };
    });

    // Process forms data to extract defect information
    formsData.forEach((form) => {
        // Processing form
        
        // Check for defects in the defect_names JSONB column
        if (form.defect_names && typeof form.defect_names === 'object') {
            Object.entries(form.defect_names).forEach(([rollPosition, defectName]) => {
                if (defectName && defectName.trim() !== '') {
                    const rollPos = parseInt(rollPosition);
                    if (rollPos >= 1 && rollPos <= 21) {
                        // Find the defect in our defect types list
                        const matchingDefect = defectTypes.find(defect => 
                            defect.toLowerCase() === defectName.toLowerCase()
                        );
                        
                        if (matchingDefect) {
                            defectData[matchingDefect].totalQty += 1;
                            defectData[matchingDefect].occurrences[rollPos - 1] += 1; // rollPos - 1 because array is 0-indexed
                            // Found defect at roll position
                        } else {
                            // Defect not found in defect types list
                        }
                    }
                }
            });
        }
    });

    // Processed defect data

    // Filter to show only defects that have data
    const defectsWithData = Object.entries(defectData).filter(([defect, data]) => data.totalQty > 0);
    
    // Defects with data

    // Calculate total produced for defect % calculation
    let totalProduced = 0;
    formsData.forEach(form => {
        const acceptedRolls = parseInt(form.accepted_rolls) || 0;
        const rejectedRolls = parseInt(form.rejected_rolls) || 0;
        const reworkRolls = parseInt(form.rework_rolls) || 0;
        const kivRolls = parseInt(form.kiv_rolls) || 0;
        totalProduced += acceptedRolls + rejectedRolls + reworkRolls + kivRolls;
    });

    // Update the table - show only defects with data
    const tbody = document.getElementById('defectTrackingTableBody');
    if (tbody) {
        if (defectsWithData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="24" class="text-center py-4" style="color: #6b7280; font-style: italic;">
                        No defects found for the selected filters.
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = defectsWithData.map(([defect, data]) => {
                const defectPercent = totalProduced > 0 ? ((data.totalQty / totalProduced) * 100).toFixed(2) : '0.00';
                const cells = data.occurrences.map(occurrence => 
                    `<td class="${occurrence > 0 ? 'defect-present' : 'defect-absent'}">${occurrence}</td>`
                ).join('');
                
                return `
                    <tr>
                        <td class="defect-name">${defect}</td>
                        <td class="defect-qty">${data.totalQty}</td>
                        <td style="font-weight: 500; color: #1f2937;">${defectPercent}%</td>
                        ${cells}
                    </tr>
                `;
            }).join('');
        }
    }

    // Update summary statistics
    updateDefectTrackingSummary(formsData);
}

// Clear defect tracking table
function clearDefectTrackingTable() {
    const tbody = document.getElementById('defectTrackingTableBody');
    if (tbody) {
        // Check if defect types are loaded
        if (!defectTypes || defectTypes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="23" class="text-center py-4">Loading defect types...</td>
                </tr>
            `;
        } else {
            // Show all defect types with zero values (original form)
            tbody.innerHTML = defectTypes.map(defect => {
                const cells = Array.from({ length: 21 }, () => 
                    `<td class="defect-absent">0</td>`
                ).join('');
                
                return `
                    <tr>
                        <td class="defect-name">${defect}</td>
                        <td class="defect-qty">0</td>
                        <td style="font-weight: 500; color: #1f2937;">0.00%</td>
                        ${cells}
                    </tr>
                `;
            }).join('');
        }
    }

    // Clear summary statistics
    document.getElementById('totalRejectedQty').textContent = '0';
    document.getElementById('totalProducedQty').textContent = '0';
    document.getElementById('totalRejectionPercent').textContent = '0.0';
}

// Update defect tracking summary statistics
function updateDefectTrackingSummary(formsData) {
    let totalProduced = 0;
    let totalRejected = 0;
    
    // Calculate total rolls produced and rejected using the same logic as production summary
    formsData.forEach(form => {
        // Use the same counting logic as the production summary table
        const acceptedRolls = parseInt(form.accepted_rolls) || 0;
        const rejectedRolls = parseInt(form.rejected_rolls) || 0;
        const reworkRolls = parseInt(form.rework_rolls) || 0;
        const kivRolls = parseInt(form.kiv_rolls) || 0;
        
        // Total rolls for this form
        const formTotalRolls = acceptedRolls + rejectedRolls + reworkRolls + kivRolls;
        totalProduced += formTotalRolls;
        
        // Count rejected rolls (including rework and KIV)
        totalRejected += rejectedRolls + reworkRolls + kivRolls;
    });
    
    const rejectionPercent = totalProduced > 0 ? ((totalRejected / totalProduced) * 100).toFixed(1) : '0.0';

    // Defect tracking summary

    document.getElementById('totalRejectedQty').textContent = totalRejected;
    document.getElementById('totalProducedQty').textContent = totalProduced;
    document.getElementById('totalRejectionPercent').textContent = rejectionPercent;
}

// Build query string from currentFilters
function buildExportQuery() {
    const params = new URLSearchParams();
    if (currentFilters.fromDate) params.append('fromDate', currentFilters.fromDate);
    if (currentFilters.toDate) params.append('toDate', currentFilters.toDate);
    if (currentFilters.productionType) params.append('productionType', currentFilters.productionType);
    if (currentFilters.machine) params.append('machine', currentFilters.machine);
    if (currentFilters.product) params.append('product', currentFilters.product);
    if (currentFilters.shift) params.append('shift', currentFilters.shift);
    return params.toString();
}

// Download handler - calls backend endpoint and triggers file download
async function downloadDefectReport() {
    const btn = document.getElementById('downloadDefectsBtn');
    const originalContent = btn ? btn.innerHTML : 'Download';
    const originalTitle = btn ? btn.title : '';

    if (btn) {
        btn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
        btn.title = 'Downloading...';
        btn.disabled = true;
    }

    try {
        const qs = buildExportQuery();

        // Determine backend URL (local vs production) following existing project pattern
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const backendUrl = isLocalhost ? 'http://localhost:3000' : 'https://swanson-backend.onrender.com';
        const url = `${backendUrl}/export-production-defects${qs ? ('?' + qs) : ''}`;

        // Prepare abort & timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes

        // Include authorization header if available
        const session = await supabase.auth.getSession();
        const headers = {
            'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };
        if (session.data.session?.access_token) {
            headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
        }

        const resp = await fetch(url, { method: 'GET', signal: controller.signal, credentials: 'include', headers });
        clearTimeout(timeoutId);

        if (!resp.ok) {
            throw new Error(`HTTP error! status: ${resp.status}`);
        }

        const blob = await resp.blob();

        // Create download link
        const urlObj = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = urlObj;
        
        // Get filename from Content-Disposition header
        const contentDisposition = resp.headers.get('Content-Disposition') || '';
        let filename = 'production-defects.xlsx';
        const match = contentDisposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) {
            filename = match[1];
        }

        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(urlObj);

        // Success message
        showSuccessMessage('Production defects report downloaded successfully!');

    } catch (err) {
        console.error('Download error:', err);
        
        if (err.name === 'AbortError') {
            showErrorMessage('Request timed out. Please try again or check your internet connection.');
        } else {
            showErrorMessage('Failed to download report. Please try again.');
        }
    } finally {
        const btn2 = document.getElementById('downloadDefectsBtn');
        if (btn2) {
            btn2.innerHTML = originalContent;
            btn2.title = originalTitle;
            btn2.disabled = false;
        }
    }
}

function bindDefectDownloadButton() {
    const btn = document.getElementById('downloadDefectsBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        // Ensure filters are applied before export
        if (!areFiltersActive()) {
            if (!confirm('No active filters detected. Export will include all data for selected date range/machine. Continue?')) return;
        }
        downloadDefectReport();
    });
}

// Toast message functions (matching inline-inspection-form.js pattern)
function showSuccessMessage(message) {
    showMessage(message, 'success');
}

function showErrorMessage(message) {
    showMessage(message, 'error');
}

function showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        z-index: 10000;
        font-weight: bold;
        ${type === 'success' ? 'background: #28a745;' : 'background: #dc3545;'}
    `;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}