import { supabase } from '../supabase-config.js';

// Production Report - Fresh Start

// Global variables
let allForms = [];
let filteredForms = [];
let currentFilterMode = 'basic'; // Track current filter mode
let currentFilters = {
    fromDate: '',
    toDate: '',
    product: '',
    machine: '',
    shift: '',
    productionType: ''
};
let advancedFilters = {
    fromDate: '',
    toDate: '',
    productionType: '',
    machines: [], // Array of selected machines
    product: '',
    shift: '',
    defect: ''
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

// Save advanced filter state to localStorage
function saveAdvancedFilterState() {
    localStorage.setItem('productionReportAdvancedFilters', JSON.stringify(advancedFilters));
}

// Load and apply saved filter state
function loadFilterState() {
    const savedState = localStorage.getItem('productionReportFilters');
    if (savedState) {
        try {
            const filterState = JSON.parse(savedState);

            // Apply saved filters to form inputs and update currentFilters
            if (filterState.fromDate) {
                document.getElementById('filterFromDate').value = filterState.fromDate;
                currentFilters.fromDate = filterState.fromDate;
            }
            if (filterState.toDate) {
                document.getElementById('filterToDate').value = filterState.toDate;
                currentFilters.toDate = filterState.toDate;
            }
            if (filterState.productionType) {
                document.getElementById('filterProductionType').value = filterState.productionType;
                currentFilters.productionType = filterState.productionType;
            }

            // Apply the saved filter immediately to load data
            if (filterState.fromDate && filterState.toDate && filterState.machine) {
                applySavedFilter(filterState);
            }

            // Populate dropdowns and apply filters with improved timing
            if (filterState.fromDate || filterState.toDate) {
                populateMachineDropdown(filterState.fromDate, filterState.toDate, filterState.productionType, filterState.machine);
                
                // Wait for dropdown population, then continue with product
                setTimeout(() => {
                    if (filterState.machine) {
                        currentFilters.machine = filterState.machine;
                        populateProductDropdown(filterState.fromDate, filterState.toDate, filterState.machine, filterState.productionType, filterState.product);
                        
                        // Wait for product dropdown population, then continue with shift
                        setTimeout(() => {
                            if (filterState.product) {
                                currentFilters.product = filterState.product;
                                populateShiftDropdown(filterState.fromDate, filterState.toDate, filterState.machine, filterState.product, true, filterState.shift);
                                
                                // Wait for shift dropdown population, then set shift value
                                setTimeout(() => {
                                    if (filterState.shift !== undefined) {
                                        currentFilters.shift = filterState.shift;
                                    }
                                }, 300);
                            } else {
                                // No product selected
                                setTimeout(() => {
                                    // Data already loaded above, just set currentFilters
                                }, 300);
                            }
                        }, 300);
                    } else {
                        // No machine selected
                        setTimeout(() => {
                            // Data already loaded above
                        }, 300);
                    }
                }, 300);
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

    // Load advanced filter state
    loadAdvancedFilterState();
}

// Load and apply saved advanced filter state
function loadAdvancedFilterState() {
    const savedAdvancedState = localStorage.getItem('productionReportAdvancedFilters');
    if (savedAdvancedState) {
        try {
            const advancedState = JSON.parse(savedAdvancedState);

            // Apply saved advanced filters to form inputs ONLY (don't auto-apply)
            if (advancedState.fromDate) {
                document.getElementById('advFilterFromDate').value = advancedState.fromDate;
            }
            if (advancedState.toDate) {
                document.getElementById('advFilterToDate').value = advancedState.toDate;
            }
            if (advancedState.product) {
                document.getElementById('advFilterProduct').value = advancedState.product;
            }
            if (advancedState.shift) {
                document.getElementById('advFilterShift').value = advancedState.shift;
            }
            if (advancedState.defect) {
                document.getElementById('advFilterDefect').value = advancedState.defect;
            }
            if (advancedState.productionType) {
                document.getElementById('advFilterProductionType').value = advancedState.productionType;
            }

            // Apply machine checkboxes
            if (advancedState.machines && advancedState.machines.length > 0) {
                const container = document.getElementById('advFilterMachinesContainer');
                if (container) {
                    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
                    checkboxes.forEach(cb => {
                        cb.checked = advancedState.machines.includes(cb.value);
                    });
                    updateSelectedMachinesDisplay();
                }
            }

            // Update advancedFilters object but DON'T auto-apply the filter
            advancedFilters = advancedState;

            // Clear any existing advanced filter results on page load
            clearSummaryTables();
            updateFilterStatus(false);

        } catch (error) {
            console.error('❌ Error loading advanced filter state:', error);
        }
    }
}

// Apply the saved filter based on the complete filter state
function applySavedFilter(filterState) {
    // Set production type dropdown value if available
    if (filterState.productionType) {
        document.getElementById('filterProductionType').value = filterState.productionType;
    }
    
    if (filterState.fromDate && filterState.toDate && filterState.machine) {
        const params = {
            fromDate: filterState.fromDate,
            toDate: filterState.toDate,
            product: filterState.product || '',
            machine: filterState.machine,
            shift: filterState.shift || '',
            productionType: filterState.productionType || ''
        };
        fetchAndRenderSummary(params);
    }
}

// Check if filters are actually active (have meaningful values)
function areFiltersActive() {
    if (currentFilterMode === 'advance') {
        // For advanced filter, check if advanced filters are active
        return advancedFilters.fromDate &&
               advancedFilters.toDate &&
               advancedFilters.machines.length > 0;
    } else {
        // For basic filter, use existing logic
        return currentFilters.fromDate &&
               currentFilters.toDate &&
               currentFilters.machine &&
               currentFilters.machine !== 'all';
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
    
    // Filter mode toggle buttons
    document.getElementById('basicFilterBtn')?.addEventListener('click', () => toggleFilterMode('basic'));
    document.getElementById('advanceFilterBtn')?.addEventListener('click', () => toggleFilterMode('advance'));
    
    // Advanced filter listeners
    document.getElementById('advFilterProductionType')?.addEventListener('change', onAdvancedDateOrTypeChange);
    document.getElementById('advFilterFromDate')?.addEventListener('change', onAdvancedDateOrTypeChange);
    document.getElementById('advFilterToDate')?.addEventListener('change', onAdvancedDateOrTypeChange);
    document.getElementById('advApplyFilter')?.addEventListener('click', applyAdvancedFilter);
    document.getElementById('advClearFilter')?.addEventListener('click', clearAdvancedFilters);
    
    // Initialize with Basic Filter as default
    toggleFilterMode('basic');
}

// Toggle between Basic and Advance filter modes
async function toggleFilterMode(mode) {
    const basicBtn = document.getElementById('basicFilterBtn');
    const advanceBtn = document.getElementById('advanceFilterBtn');
    const basicContent = document.getElementById('basicFilterMode');
    const advanceContent = document.getElementById('advanceFilterMode');
    
    if (mode === 'basic') {
        currentFilterMode = 'basic';
        basicBtn.classList.add('active');
        advanceBtn.classList.remove('active');
        basicContent.style.display = 'block';
        advanceContent.style.display = 'none';
    } else if (mode === 'advance') {
        currentFilterMode = 'advance';
        advanceBtn.classList.add('active');
        basicBtn.classList.remove('active');
        basicContent.style.display = 'none';
        advanceContent.style.display = 'block';
        // Populate advanced filter dropdowns
        await populateAdvancedFilterDropdowns();
    }
    
    // Update download button visibility when switching modes
    updateDownloadButtonVisibility();
}

// Populate dropdowns in advanced filter mode
async function populateAdvancedFilterDropdowns() {
    // Populate machines as radio buttons
    const machinesContainer = document.getElementById('advFilterMachinesContainer');
    if (!machinesContainer) {
        console.error('Machines container not found');
        return;
    }
    
    try {
        const { data, error } = await supabase.rpc('get_production_filter_values', {
            p_from_date: '',
            p_to_date: '',
            p_production_type: '',
            p_target_column: 'mc_no'
        });

        if (error) throw error;

        const machines = data.map(d => d.filter_value).filter(Boolean);
        
        machinesContainer.innerHTML = '';
        
        if (machines.length === 0) {
            machinesContainer.innerHTML = '<span class="text-xs text-gray-500">No machines found</span>';
            return;
        }
        
        machines.forEach(machine => {
            const radioGroup = document.createElement('div');
            radioGroup.className = 'machine-radio-group';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `machine-${machine}`;
            checkbox.value = machine;
            checkbox.addEventListener('change', updateSelectedMachinesDisplay);
            
            const label = document.createElement('label');
            label.htmlFor = `machine-${machine}`;
            label.textContent = machine;
            
            radioGroup.appendChild(checkbox);
            radioGroup.appendChild(label);
            machinesContainer.appendChild(radioGroup);
        });
    } catch (error) {
        console.error('❌ Error populating advanced filter machines:', error);
    }

    // Populate defects select
    const defectSelect = document.getElementById('advFilterDefect');
    if (defectSelect) {
        defectSelect.innerHTML = '<option value="">All Defects</option>';
        defectTypes.forEach(defect => {
            const option = document.createElement('option');
            option.value = defect;
            option.textContent = defect;
            defectSelect.appendChild(option);
        });
    }
}

// Update display of selected machines
function updateSelectedMachinesDisplay() {
    const container = document.getElementById('advFilterMachinesContainer');
    if (!container) return;
    
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    const selectedMachines = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    
    const display = document.getElementById('selectedMachinesDisplay');
    if (display) {
        if (selectedMachines.length === 0) {
            display.textContent = 'No machines selected';
        } else {
            display.textContent = 'Selected: ' + selectedMachines.join(', ');
        }
    }
    
    // Update download button visibility when machine selection changes
    updateDownloadButtonVisibility();
}

// Handle changes in advanced filter product/shift/defect (automatic filtering)
async function onAdvancedFilterChange() {
    const fromDate = document.getElementById('advFilterFromDate').value;
    const toDate = document.getElementById('advFilterToDate').value;
    const container = document.getElementById('advFilterMachinesContainer');
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    const selectedMachines = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    const product = document.getElementById('advFilterProduct').value;
    const shift = document.getElementById('advFilterShift').value;
    const defect = document.getElementById('advFilterDefect').value;
    const productionType = document.getElementById('advFilterProductionType').value;
    
    // Only apply filter if we have minimum required criteria
    if (selectedMachines.length > 0 && fromDate && toDate) {
        // Update advanced filters object
        advancedFilters = {
            fromDate,
            toDate,
            productionType,
            machines: selectedMachines,
            product,
            shift,
            defect
        };
        
        // NOW USING V3 ENGINE (fetchAndRenderSummary)
        await fetchAndRenderSummary(advancedFilters);
        
        // Update filter status
        updateFilterStatus(true);
        // Save advanced filter state to localStorage
        saveAdvancedFilterState();
    } else {
        // Clear results if criteria not met
        clearSummaryTables();
        updateFilterStatus(false);
    }
    
    // Update download button visibility
    updateDownloadButtonVisibility();
}
async function onAdvancedDateOrTypeChange() {
    const fromDate = document.getElementById('advFilterFromDate').value;
    const toDate = document.getElementById('advFilterToDate').value;
    const productionType = document.getElementById('advFilterProductionType').value;
    
    // Repopulate machines based on new date/production type
    if (fromDate || toDate) {
        try {
            const { data, error } = await supabase.rpc('get_production_filter_values', {
                p_from_date: fromDate || '',
                p_to_date: toDate || '',
                p_production_type: productionType || '',
                p_target_column: 'mc_no'
            });

            if (error) throw error;

            const machines = data.map(d => d.filter_value).filter(Boolean);
            const machinesContainer = document.getElementById('advFilterMachinesContainer');
            
            if (machinesContainer) {
                // Get currently selected checkboxes
                const currentSelectedCheckboxes = Array.from(machinesContainer.querySelectorAll('input[type="checkbox"]:checked'))
                    .map(cb => cb.value);
                
                // Repopulate checkboxes
                machinesContainer.innerHTML = '';
                machines.forEach(machine => {
                    const radioGroup = document.createElement('div');
                    radioGroup.className = 'machine-radio-group';
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `machine-${machine}`;
                    checkbox.value = machine;
                    checkbox.addEventListener('change', updateSelectedMachinesDisplay);
                    
                    // Keep selection if machine was previously selected
                    if (currentSelectedCheckboxes.includes(machine)) {
                        checkbox.checked = true;
                    }
                    
                    const label = document.createElement('label');
                    label.htmlFor = `machine-${machine}`;
                    label.textContent = machine;
                    
                    radioGroup.appendChild(checkbox);
                    radioGroup.appendChild(label);
                    machinesContainer.appendChild(radioGroup);
                });
            }
        } catch (error) {
            console.error('❌ Error populating advanced machine checkboxes:', error);
        }
    }
    
    // Update download button visibility
    updateDownloadButtonVisibility();
}

// Apply advanced filter
async function applyAdvancedFilter() {
    const fromDate = document.getElementById('advFilterFromDate').value;
    const toDate = document.getElementById('advFilterToDate').value;
    const container = document.getElementById('advFilterMachinesContainer');
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    const selectedMachines = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    const product = document.getElementById('advFilterProduct').value;
    const shift = document.getElementById('advFilterShift').value;
    const defect = document.getElementById('advFilterDefect').value;
    const productionType = document.getElementById('advFilterProductionType').value;
    
    if (selectedMachines.length === 0) {
        alert('Please select at least one machine');
        return;
    }
    
    if (!fromDate || !toDate) {
        alert('Please select both From Date and To Date');
        return;
    }
    
    // Update advanced filters object
    advancedFilters = {
        fromDate,
        toDate,
        productionType,
        machines: selectedMachines,
        product,
        shift,
        defect
    };
    
    // NOW USING V3 ENGINE (fetchAndRenderSummary)
    await fetchAndRenderSummary(advancedFilters);
    
    // Update filter status
    updateFilterStatus(true);

    // Save advanced filter state to localStorage
    saveAdvancedFilterState();
}

// Get data for combined machines in advanced filter


// Clear advanced filters
function clearAdvancedFilters() {
    document.getElementById('advFilterFromDate').value = '';
    document.getElementById('advFilterToDate').value = '';
    document.getElementById('advFilterProduct').value = '';
    document.getElementById('advFilterShift').value = '';
    document.getElementById('advFilterDefect').value = '';
    document.getElementById('advFilterProductionType').value = '';
    
    const container = document.getElementById('advFilterMachinesContainer');
    if (container) {
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
    }
    
    const displayElement = document.getElementById('selectedMachinesDisplay');
    if (displayElement) {
        displayElement.textContent = 'No machines selected';
    }
    
    advancedFilters = {
        fromDate: '',
        toDate: '',
        productionType: '',
        machines: [],
        product: '',
        shift: '',
        defect: ''
    };
    
    // Clear advanced filter state from localStorage
    localStorage.removeItem('productionReportAdvancedFilters');
    
    clearSummaryTables();
    updateFilterStatus(false);
}

// Step 1: Date selection changes
async function onDateChange() {
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
        const productionType = document.getElementById('filterProductionType').value;
        await populateMachineDropdown(fromDate, toDate, productionType);
        // Also populate product dropdown with ALL products from date range
        await populateProductDropdown(fromDate, toDate, '', productionType);
    }
    
    // Save filter state
    saveFilterState();
}

// Step 2: Machine selection changes
async function onMachineChange() {
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
    await populateProductDropdown(fromDate, toDate, machine, productionType);
    
    // Save filter state
    saveFilterState();
}

// Step 3: Product selection changes  
async function onProductChange() {
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
        await populateShiftDropdown(fromDate, toDate, machine, product);
    }
    
    // Save filter state
    saveFilterState();
}

// Step 4: Shift selection changes - GET PRODUCTION SHIFT DATA
async function onShiftChange() {
    const fromDate = document.getElementById('filterFromDate').value;
    const toDate = document.getElementById('filterToDate').value;
    const product = document.getElementById('filterProduct').value;
    const machine = document.getElementById('filterMachine').value;
    const shift = document.getElementById('filterShift').value;
    const productionType = document.getElementById('filterProductionType').value;
    
    // Update current filters
    currentFilters.shift = shift;
    currentFilters.productionType = productionType;
    
    if (fromDate && toDate && machine) {
        const params = {
            fromDate: fromDate,
            toDate: toDate,
            product: product || '',
            machine: machine,
            shift: shift || '',
            productionType: productionType || ''
        };
        await fetchAndRenderSummary(params);
        
        // Save filter state and update status
        saveFilterState();
        updateFilterStatus(areFiltersActive());
    } else {
        // Missing required filters
    }
}

// Step 5: Production Type selection changes - RELOAD DATA WITH NEW FILTER
async function onProductionTypeChange() {
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
        await populateMachineDropdown(fromDate, toDate, productionType);
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
    localStorage.removeItem('productionReportAdvancedFilters');
    
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
                <tr class="scrap-caution-row">
                    <td class="metric-label">
                        <div class="scrap-label">
                            Total Shift Scrap
                        </div>
                    </td>
                    <td class="metric-value">-</td>
                    <td class="metric-value">0.00 KG</td>
                </tr>
                <tr class="highlight-row">
                    <td>Total Produced</td>
                    <td>0 Rolls</td>
                    <td>0.00 KG</td>
                </tr>
                <tr class="yield-row">
                    <td class="metric-label" colspan="2">Production Yield</td>
                    <td class="metric-value">0.00%</td>
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
                    <td class="metric-label" colspan="4" style="text-align: center;">No defects found in this shift.</td>
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

// Load initial data and filter options
async function loadFormsData() {
    try {
        // Populate initial machine and product dropdowns
        await Promise.all([
            populateMachineDropdown('', '', ''),
            populateProductDropdown('', '', '', '')
        ]);
        
        // Load saved state if any
        loadFilterState();

    } catch (error) {
        console.error('❌ Error loading initial data:', error);
    }
}

// Populate Machine dropdown based on date range
async function populateMachineDropdown(fromDate, toDate, productionType, selectedValue = null) {
    try {
        const { data, error } = await supabase.rpc('get_production_filter_values', {
            p_from_date: fromDate || '',
            p_to_date: toDate || '',
            p_production_type: productionType || '',
            p_target_column: 'mc_no'
        });

        if (error) throw error;

        const machines = data.map(d => d.filter_value).filter(Boolean);
        const dropdown = document.getElementById('filterMachine');
        
        if (dropdown) {
            dropdown.innerHTML = '<option value="">Select Machine</option>';
            machines.forEach(machine => {
                const option = document.createElement('option');
                option.value = machine;
                option.textContent = machine;
                dropdown.appendChild(option);
            });
            
            // Set selected value if provided
            if (selectedValue) {
                dropdown.value = selectedValue;
            }
        }
    } catch (error) {
        console.error('❌ Error populating machine dropdown:', error);
    }
}

// Populate Product dropdown based on date + machine  
async function populateProductDropdown(fromDate, toDate, machine, productionType, selectedValue = null) {
    try {
        const { data, error } = await supabase.rpc('get_production_filter_values', {
            p_from_date: fromDate || '',
            p_to_date: toDate || '',
            p_mc_no: machine || '',
            p_production_type: productionType || '',
            p_target_column: 'prod_code'
        });

        if (error) throw error;

        const products = data.map(d => d.filter_value).filter(Boolean);
        const dropdown = document.getElementById('filterProduct');
        
        if (dropdown) {
            dropdown.innerHTML = '<option value="">Select Product</option><option value="all">All Products</option>';
            products.forEach(product => {
                const option = document.createElement('option');
                option.value = product;
                option.textContent = product;
                dropdown.appendChild(option);
            });
            
            // Set selected value if provided
            if (selectedValue) {
                dropdown.value = selectedValue;
            }
        }
    } catch (error) {
        console.error('❌ Error populating product dropdown:', error);
    }
}

// Populate Shift dropdown based on date + machine + product
async function populateShiftDropdown(fromDate, toDate, machine, product, skipAutoTrigger = false, selectedValue = null) {
    try {
        const productionType = document.getElementById('filterProductionType').value;
        const { data, error } = await supabase.rpc('get_production_filter_values', {
            p_from_date: fromDate || '',
            p_to_date: toDate || '',
            p_mc_no: machine || '',
            p_prod_code: product === 'all' ? '' : (product || ''),
            p_production_type: productionType || '',
            p_target_column: 'shift'
        });

        if (error) throw error;

        const shifts = data.map(d => d.filter_value).filter(Boolean);
        const dropdown = document.getElementById('filterShift');
        
        if (dropdown) {
            dropdown.innerHTML = '<option value="">All Shifts</option>';
            shifts.forEach(shift => {
                const option = document.createElement('option');
                option.value = shift;
                option.textContent = shift === '1' ? 'A' : shift === '2' ? 'B' : shift === '3' ? 'C' : shift;
                dropdown.appendChild(option);
            });
            
            // Set selected value if provided
            if (selectedValue !== null && selectedValue !== undefined) {
                dropdown.value = selectedValue;
            }
            
            if (shifts.length > 0 && !skipAutoTrigger) {
                onShiftChange();
            }
        }
    } catch (error) {
        console.error('❌ Error populating shift dropdown:', error);
    }
}

// GET PRODUCTION SHIFT DATA - Final step
async function getProductionShiftData(fromDate, toDate, product, machine, shift, productionType) {
    try {
        const { data, error } = await supabase.rpc('get_production_report_data', {
            p_from_date: fromDate || '',
            p_to_date: toDate || '',
            p_prod_code: product || '',
            p_mc_nos: machine ? [machine] : [],
            p_shift: shift || '',
            p_production_type: productionType || ''
        });

        if (error) throw error;

        // Update summary tables with the returned data
        updateSummaryTablesWithData(data || []);
    } catch (error) {
        console.error('❌ Error fetching production shift data:', error);
    }
}

// ========== V3 FUNCTIONS (Server-Side Summary) ==========

async function fetchAndRenderSummary(params) {
    try {
        console.time("Fetch Summary V3");
        
        // Prepare correct parameters for SQL
        const rpcParams = {
            p_from_date: params.fromDate || '',
            p_to_date: params.toDate || '',
            // Handle Multiple Machines vs Single Machine
            p_mc_nos: (params.machines && params.machines.length > 0) ? params.machines : (params.machine ? [params.machine] : []),
            p_prod_code: (params.product === 'all' || !params.product) ? '' : params.product,
            p_shift: params.shift || '',
            p_production_type: params.productionType || '',
            // NEW: Pass the defect filter
            p_defect: params.defect || '' 
        };

        const { data, error } = await supabase.rpc('get_production_summary_v3', rpcParams);

        if (error) throw error;
        console.timeEnd("Fetch Summary V3");

        renderAllTables(data, params.product);

    } catch (error) {
        console.error('❌ Error fetching summary:', error);
    }
}

function renderAllTables(data, selectedProduct) {
    if (!data || !data.totals) return;

    const t = data.totals;
    const totalRolls = t.acc_r + t.rej_r + t.rew_r + t.kiv_r;
    const totalWeight = t.acc_w + t.rej_w + t.rew_w + t.kiv_w;
    const totalInput = totalWeight + t.scrap;
    const yieldPercent = totalInput > 0 ? ((t.acc_w / totalInput) * 100).toFixed(2) : "0.00";

    // 1. Production Summary
    const summaryTbody = document.querySelector('#dynamicSummaryTableContainer table tbody');
    if (summaryTbody) {
        summaryTbody.innerHTML = `
            <tr><td class="metric-label">Accepted Rolls</td><td class="metric-value">${t.acc_r} Rolls</td><td class="metric-value">${t.acc_w.toFixed(2)} KG</td></tr>
            <tr><td class="metric-label">Rejected Rolls</td><td class="metric-value">${t.rej_r} Rolls</td><td class="metric-value">${t.rej_w.toFixed(2)} KG</td></tr>
            <tr><td class="metric-label">Rolls Rejected for Rework</td><td class="metric-value">${t.rew_r} Rolls</td><td class="metric-value">${t.rew_w.toFixed(2)} KG</td></tr>
            <tr><td class="metric-label">KIV Rolls</td><td class="metric-value">${t.kiv_r} Rolls</td><td class="metric-value">${t.kiv_w.toFixed(2)} KG</td></tr>
            <tr class="scrap-caution-row"><td class="metric-label"><div class="scrap-label">Total Shift Scrap</div></td><td class="metric-value">-</td><td class="metric-value">${t.scrap.toFixed(2)} KG</td></tr>
            <tr class="highlight-row"><td>Total Produced</td><td>${totalRolls} Rolls</td><td>${totalWeight.toFixed(2)} KG</td></tr>
            <tr class="yield-row"><td class="metric-label" colspan="2">Production Yield</td><td class="metric-value">${yieldPercent}%</td></tr>
        `;
    }

    // 2. Defects Summary (Small Table)
    const defectSummaryBody = document.querySelector('#defectsSummaryTableContainer table tbody');
    if (defectSummaryBody) {
        if (!data.defect_summary || data.defect_summary.length === 0) {
            defectSummaryBody.innerHTML = '<tr><td colspan="4" class="text-center">No defects found.</td></tr>';
        } else {
            const sorted = (data.defect_summary || []).sort((a, b) => b.count - a.count);
            const totalCount = sorted.reduce((s, d) => s + d.count, 0);
            const totalW = sorted.reduce((s, d) => s + d.weight, 0);
            
            let html = sorted.map(d => {
                const pct = totalRolls > 0 ? ((d.count / totalRolls) * 100).toFixed(2) : "0.00";
                return `<tr><td class="metric-label">${d.name}</td><td class="defect-count">${d.count}</td><td class="defect-percent">${pct}%</td><td class="metric-value">${d.weight.toFixed(2)}</td></tr>`;
            }).join('');
            
            const totPct = totalRolls > 0 ? ((totalCount / totalRolls) * 100).toFixed(2) : "0.00";
            html += `<tr class="highlight-row"><td class="metric-label">Total</td><td class="defect-count">${totalCount}</td><td class="defect-percent">${totPct}%</td><td class="metric-value">${totalW.toFixed(2)}</td></tr>`;
            defectSummaryBody.innerHTML = html;
        }
    }

    // 3. Statistics
    const statsBody = document.querySelector('#statisticsTableContainer table tbody');
    if (statsBody) {
        if (currentFilterMode === 'advance') {
            // Show message when in advanced filter mode
            statsBody.innerHTML = `<tr><td class="parameter-cell" colspan="4">Statistics not available in advanced filter mode</td></tr>`;
        } else if (selectedProduct === 'all' || !selectedProduct) {
            // Show message when "All Products" is selected
            statsBody.innerHTML = `<tr><td class="parameter-cell" colspan="4">Statistics not available for multiple products</td></tr>`;
        } else if (data.stats) {
            // Show statistics in basic filter mode with specific product
            const s = data.stats;
            const renderRow = (lbl, obj, dec) => `<tr><td class="parameter-cell">${lbl}</td><td class="value-cell">${Number(obj?.min||0).toFixed(dec)}</td><td class="value-cell">${Number(obj?.max||0).toFixed(dec)}</td><td class="value-cell">${Number(obj?.avg||0).toFixed(dec)}</td></tr>`;
            statsBody.innerHTML = `${renderRow('Roll Weight',s.weight,2)}${renderRow('Cut Width',s.width,0)}${renderRow('GSM',s.gsm,2)}${renderRow('Roll θ',s.theta,0)}${renderRow('Thickness',s.thick,2)}`;
        }
    }

    // 4. Defect Matrix
    const matrixBody = document.getElementById('defectTrackingTableBody');
    if (matrixBody) {
        if (!data.defect_matrix || data.defect_matrix.length === 0) {
            matrixBody.innerHTML = `<tr><td colspan="24" class="text-center py-4">No defects found.</td></tr>`;
        } else {
            const grouped = {};
            data.defect_matrix.forEach(x => {
                if(!grouped[x.name]) grouped[x.name] = {total:0, pos:{}};
                grouped[x.name].total += x.count;
                grouped[x.name].pos[x.pos] = x.count;
            });
            matrixBody.innerHTML = Object.entries(grouped).map(([name, d]) => {
                const pct = totalRolls > 0 ? ((d.total/totalRolls)*100).toFixed(2) : "0.00";
                let cells = "";
                for(let i=1; i<=21; i++) cells += `<td class="${(d.pos[i]||0)>0?'defect-present':'defect-absent'}">${d.pos[i]||0}</td>`;
                return `<tr><td class="defect-name">${name}</td><td class="defect-qty">${d.total}</td><td style="font-weight: 500;">${pct}%</td>${cells}</tr>`;
            }).join('');
        }
    }
    
    // 5. Update Footer
    const totalRej = t.rej_r + t.rew_r + t.kiv_r;
    if(document.getElementById('totalRejectedQty')) document.getElementById('totalRejectedQty').textContent = totalRej;
    if(document.getElementById('totalProducedQty')) document.getElementById('totalProducedQty').textContent = totalRolls;
    if(document.getElementById('totalRejectionPercent')) document.getElementById('totalRejectionPercent').textContent = totalRolls>0?((totalRej/totalRolls)*100).toFixed(1):"0.0";
}

// GET ALL SHIFTS DATA - For when "All Shifts" is selected
async function getAllShiftsData(fromDate, toDate, product, machine, productionType) {
    try {
        const { data, error } = await supabase.rpc('get_production_report_data', {
            p_from_date: fromDate || '',
            p_to_date: toDate || '',
            p_prod_code: product || '',
            p_mc_nos: machine ? [machine] : [],
            p_shift: '', // All shifts
            p_production_type: productionType || ''
        });

        if (error) throw error;

        // Update summary tables with the returned data
        updateSummaryTablesWithData(data || []);
    } catch (error) {
        console.error('❌ Error fetching all shifts data:', error);
    }
}

// Update summary tables with filtered shift data
function updateSummaryTablesWithData(shiftData, skipStatistics = false, filterDefect = null) {
    if (!shiftData || shiftData.length === 0) {
        clearSummaryTables();
        return;
    }

    const startTime = performance.now();

    // 1. Initialize all counters and structures
    let totalAccepted = 0, totalRejected = 0, totalRework = 0, totalKIV = 0;
    let totalAcceptedWeight = 0, totalRejectedWeight = 0, totalReworkWeight = 0, totalKIVWeight = 0;
    let totalScrap = 0;
    
    // For defects summary table
    const defectSummaryData = {};
    
    // For statistics table
    const stats = {
        rollWeight: [],
        cutWidth: [],
        gsm: [],
        rollTheta: [],
        thickness: []
    };

    // For defect tracking table (the big one)
    const defectLookup = {};
    if (defectTypes && defectTypes.length > 0) {
        defectTypes.forEach(d => { defectLookup[d.toLowerCase()] = d; });
    }
    
    const defectTrackingData = {};
    if (defectTypes && defectTypes.length > 0) {
        defectTypes.forEach(defect => {
            defectTrackingData[defect] = {
                totalQty: 0,
                occurrences: Array(21).fill(0)
            };
        });
    }

    // 2. SINGLE PASS through all data for maximum performance
    shiftData.forEach(form => {
        // A. Roll Totals
        const aR = parseInt(form.accepted_rolls) || 0;
        const rR = parseInt(form.rejected_rolls) || 0;
        const rwR = parseInt(form.rework_rolls) || 0;
        const kR = parseInt(form.kiv_rolls) || 0;
        
        totalAccepted += aR;
        totalRejected += rR;
        totalRework += rwR;
        totalKIV += kR;

        // B. Weights
        totalAcceptedWeight += parseFloat(form.accepted_weight) || 0;
        totalRejectedWeight += parseFloat(form.rejected_weight) || 0;
        totalReworkWeight += parseFloat(form.rework_weight) || 0;
        totalKIVWeight += parseFloat(form.kiv_weight) || 0;
        totalScrap += parseFloat(form.process_scrap) || 0;

        // C. Process JSONB fields once
        const rollWeights = form.roll_weights && typeof form.roll_weights === 'object' ? form.roll_weights : {};
        const defectNames = form.defect_names && typeof form.defect_names === 'object' ? form.defect_names : {};
        
        // Only extract these if needed for statistics
        const rollWidths = !skipStatistics ? (form.roll_widths && typeof form.roll_widths === 'object' ? form.roll_widths : {}) : {};
        const filmGsm = !skipStatistics ? (form.film_weights_gsm && typeof form.film_weights_gsm === 'object' ? form.film_weights_gsm : {}) : {};
        const rollDiameters = !skipStatistics ? (form.roll_diameters && typeof form.roll_diameters === 'object' ? form.roll_diameters : {}) : {};
        const thicknesses = !skipStatistics ? (form.thickness_data && typeof form.thickness_data === 'object' ? form.thickness_data : {}) : {};

        // D. Loop through roll positions (max 21)
        // Process weights and defects separately to ensure all data is captured
        
        // 1. Process Weights (for statistics)
        Object.keys(rollWeights).forEach(pos => {
            const weight = parseFloat(rollWeights[pos]);
            if (!isNaN(weight) && weight > 0) {
                if (!skipStatistics) stats.rollWeight.push(weight);
            }
        });

        // 2. Process Defects (for summary and tracking)
        Object.keys(defectNames).forEach(pos => {
            const defectName = defectNames[pos];
            if (defectName && defectName.trim() !== '') {
                const weight = parseFloat(rollWeights[pos]) || 0;
                
                // Small Summary Table logic (usually needs weight for yield/loss)
                if (!filterDefect || String(defectName).trim() === String(filterDefect).trim()) {
                    if (!defectSummaryData[defectName]) {
                        defectSummaryData[defectName] = { count: 0, weight: 0 };
                    }
                    defectSummaryData[defectName].count += 1;
                    defectSummaryData[defectName].weight += weight;
                }

                // Large Tracking Table logic (shows occurrences by position)
                const matchingDefect = defectLookup[defectName.toLowerCase()];
                if (matchingDefect) {
                    const rollPos = parseInt(pos);
                    if (rollPos >= 1 && rollPos <= 21) {
                        defectTrackingData[matchingDefect].totalQty += 1;
                        defectTrackingData[matchingDefect].occurrences[rollPos - 1] += 1;
                    }
                }
            }
        });

        // E. Other Statistics
        if (!skipStatistics) {
            Object.values(rollWidths).forEach(v => { const n = parseFloat(v); if (n > 0) stats.cutWidth.push(n); });
            Object.values(filmGsm).forEach(v => { const n = parseFloat(v); if (n > 0) stats.gsm.push(n); });
            Object.values(rollDiameters).forEach(v => { const n = parseFloat(v); if (n > 0) stats.rollTheta.push(n); });
            Object.values(thicknesses).forEach(v => { const n = parseFloat(v); if (n > 0) stats.thickness.push(n); });
        }
    });

    const totalRolls = totalAccepted + totalRejected + totalRework + totalKIV;
    const totalWeight = totalAcceptedWeight + totalRejectedWeight + totalReworkWeight + totalKIVWeight;

    // 3. Update Rolls Summary Table
    const summaryContainer = document.getElementById('dynamicSummaryTableContainer');
    if (summaryContainer) {
        const tbody = summaryContainer.querySelector('table tbody');
        const totalInputWeight = totalWeight + totalScrap;
        const yieldPercent = totalInputWeight > 0 ? ((totalAcceptedWeight / totalInputWeight) * 100).toFixed(2) : '0.00';
        
        tbody.innerHTML = `
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
            <tr class="scrap-caution-row">
                <td class="metric-label">
                    <div class="scrap-label">
                        Total Shift Scrap
                    </div>
                </td>
                <td class="metric-value">-</td>
                <td class="metric-value">${totalScrap.toFixed(2)} KG</td>
            </tr>
            <tr class="highlight-row">
                <td>Total Produced</td>
                <td>${totalRolls} Rolls</td>
                <td>${totalWeight.toFixed(2)} KG</td>
            </tr>
            <tr class="yield-row">
                <td class="metric-label" colspan="2">Production Yield</td>
                <td class="metric-value">${yieldPercent}%</td>
            </tr>
        `;
    }

    // 4. Update Defects Summary Table
    const defectsContainer = document.getElementById('defectsSummaryTableContainer');
    if (defectsContainer) {
        const tbody = defectsContainer.querySelector('table tbody');
        if (Object.keys(defectSummaryData).length === 0) {
            tbody.innerHTML = '<tr><td class="metric-label" colspan="4" style="text-align: center;">No defects found in this shift.</td></tr>';
        } else {
            const totalDefectCount = Object.values(defectSummaryData).reduce((sum, d) => sum + d.count, 0);
            const totalDefectWeight = Object.values(defectSummaryData).reduce((sum, d) => sum + d.weight, 0);
            const totalDefectPercent = totalRolls > 0 ? ((totalDefectCount / totalRolls) * 100).toFixed(2) : '0.00';

            tbody.innerHTML = Object.entries(defectSummaryData)
                .sort(([,a], [,b]) => b.count - a.count)
                .map(([defect, data]) => {
                    const defectPercent = totalRolls > 0 ? ((data.count / totalRolls) * 100).toFixed(2) : '0.00';
                    return `<tr><td class="metric-label">${defect}</td><td class="defect-count">${data.count}</td><td class="defect-percent">${defectPercent}%</td><td class="metric-value">${data.weight.toFixed(2)}</td></tr>`;
                }).join('') + 
                `<tr class="highlight-row"><td class="metric-label">Total</td><td class="defect-count">${totalDefectCount}</td><td class="defect-percent">${totalDefectPercent}%</td><td class="metric-value">${totalDefectWeight.toFixed(2)}</td></tr>`;
        }
    }

    // 5. Update Statistics Table
    if (!skipStatistics) {
        const statsContainer = document.getElementById('statisticsTableContainer');
        if (statsContainer) {
            const tbody = statsContainer.querySelector('table tbody');
            const calculateRow = (label, values, decimalPlaces) => {
                if (!values || values.length === 0) {
                    return `<tr><td class="parameter-cell">${label}</td><td class="value-cell">0.00</td><td class="value-cell">0.00</td><td class="value-cell">0.00</td></tr>`;
                }
                const min = Math.min(...values).toFixed(decimalPlaces);
                const max = Math.max(...values).toFixed(decimalPlaces);
                const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(decimalPlaces);
                return `<tr><td class="parameter-cell">${label}</td><td class="value-cell">${min}</td><td class="value-cell">${max}</td><td class="value-cell">${avg}</td></tr>`;
            };

            tbody.innerHTML = `
                ${calculateRow('Roll Weight', stats.rollWeight, 2)}
                ${calculateRow('Cut Width', stats.cutWidth, 0)}
                ${calculateRow('GSM', stats.gsm, 2)}
                ${calculateRow('Roll θ', stats.rollTheta, 0)}
                ${calculateRow('Thickness', stats.thickness, 2)}
            `;
        }
    }

    // 6. Update Defect Tracking Table (The big one)
    renderDefectTrackingTable(defectTrackingData, totalRolls);
    
    // 7. Update Defect Tracking Summary
    renderDefectTrackingSummary(totalRolls, (totalRejected + totalRework + totalKIV));
}

// Optimized renderer for Defect Tracking Table - accepts pre-calculated data
function renderDefectTrackingTable(defectTrackingData, totalProduced) {
    const tbody = document.getElementById('defectTrackingTableBody');
    if (!tbody) return;

    const defectsWithData = Object.entries(defectTrackingData).filter(([defect, data]) => data.totalQty > 0);

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

// Optimized renderer for Defect Tracking Summary - accepts pre-calculated totals
function renderDefectTrackingSummary(totalProduced, totalRejected) {
    const rejectionPercent = totalProduced > 0 ? ((totalRejected / totalProduced) * 100).toFixed(1) : '0.0';
    
    const totalRejectedElem = document.getElementById('totalRejectedQty');
    const totalProducedElem = document.getElementById('totalProducedQty');
    const totalPercentElem = document.getElementById('totalRejectionPercent');
    
    if (totalRejectedElem) totalRejectedElem.textContent = totalRejected;
    if (totalProducedElem) totalProducedElem.textContent = totalProduced;
    if (totalPercentElem) totalPercentElem.textContent = rejectionPercent;
}







// GET ALL PRODUCTS DATA - Show combined data from all products for a machine
// GET ALL PRODUCTS DATA - For when "All Products" is selected
async function getAllProductsData(fromDate, toDate, machine, shift, productionType) {
    try {
        const { data, error } = await supabase.rpc('get_production_report_data', {
            p_from_date: fromDate || '',
            p_to_date: toDate || '',
            p_mc_nos: machine ? [machine] : [],
            p_prod_code: '', // Explicitly set empty for all products
            p_shift: shift || '',
            p_production_type: productionType || ''
        });

        if (error) throw error;

        // Update summary tables with combined data from all products (skip statistics for all products)
        updateSummaryTablesWithData(data || [], true); // true = skip statistics
    } catch (error) {
        console.error('❌ Error fetching all products data:', error);
    }
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



// Build query string from currentFilters
function buildExportQuery() {
    const params = new URLSearchParams();

    if (currentFilterMode === 'advance') {
        // Use advanced filters
        if (advancedFilters.fromDate) params.append('fromDate', advancedFilters.fromDate);
        if (advancedFilters.toDate) params.append('toDate', advancedFilters.toDate);
        if (advancedFilters.productionType) params.append('productionType', advancedFilters.productionType);
        if (advancedFilters.machines.length > 0) params.append('machines', advancedFilters.machines.join(','));
        if (advancedFilters.product) params.append('product', advancedFilters.product);
        if (advancedFilters.shift) params.append('shift', advancedFilters.shift);
        if (advancedFilters.defect) params.append('defect', advancedFilters.defect);
    } else {
        // Use basic filters
        if (currentFilters.fromDate) params.append('fromDate', currentFilters.fromDate);
        if (currentFilters.toDate) params.append('toDate', currentFilters.toDate);
        if (currentFilters.productionType) params.append('productionType', currentFilters.productionType);
        if (currentFilters.machine) params.append('machine', currentFilters.machine);
        if (currentFilters.product) params.append('product', currentFilters.product);
        if (currentFilters.shift) params.append('shift', currentFilters.shift);
    }

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
        
        // Choose export endpoint based on filter mode
        const exportEndpoint = currentFilterMode === 'advance' ? '/export-production-defects-advanced' : '/export-production-defects';
        const url = `${backendUrl}${exportEndpoint}${qs ? ('?' + qs) : ''}`;

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