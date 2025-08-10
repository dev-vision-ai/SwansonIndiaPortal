import { supabase } from '../supabase-config.js';

// Global variables
let allInspections = [];
let filteredInspections = [];
let allExtinguishers = [];
let currentFilters = {
    fromDate: '',
    toDate: '',
    type: '',
    status: '',
    location: ''
};


// DOM elements
const tableBody = document.getElementById('fireInspectionTableBody');
const searchInput = document.getElementById('filterLocation');
const typeFilter = document.getElementById('filterType');
const statusFilter = document.getElementById('filterStatus');
const toDateFilter = document.getElementById('filterToDate');
const clearFilterBtn = document.getElementById('clearFilter');
const filterStatusEl = document.getElementById('filterStatusIndicator');

// Modal elements
const inspectionModal = document.getElementById('inspectionModal');
const modalTitle = document.getElementById('modalTitle');
const inspectionForm = document.getElementById('inspectionForm');
const extinguisherInput = document.getElementById('extinguisherInput');
const extinguisherType = document.getElementById('extinguisherType');
const extinguisherLocation = document.getElementById('extinguisherLocation');

const refilledDate = document.getElementById('refilledDate');
const expiryDate = document.getElementById('expiryDate');
const capacity = document.getElementById('capacity');
const checkedBy = document.getElementById('checkedBy');
const verifiedBy = document.getElementById('verifiedBy');

// Delete Selection Modal elements
const deleteSelectionModal = document.getElementById('deleteSelectionModal');

// Statistics elements
const totalInspectionsEl = document.getElementById('totalInspections');
const activeInspectionsEl = document.getElementById('activeInspections');
const expiredInspectionsEl = document.getElementById('expiredInspections');
const serviceDueInspectionsEl = document.getElementById('serviceDueInspections');

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    await loadUserProfile();
    await loadFireExtinguishers();
    await loadFireExtinguisherInspections();
    setupEventListeners();
    updateStatistics();
});

// Load user profile
async function loadUserProfile() {
    const userNameElement = document.querySelector('.user-name');
    if (!userNameElement) return;

    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        if (user) {
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('full_name')
                .eq('id', user.id)
                .single();

            if (profileError) throw profileError;

            if (profile && profile.full_name) {
                userNameElement.textContent = 'Hi, ' + profile.full_name;
            } else {
                userNameElement.textContent = 'Hi, ' + (user.email || 'Admin');
            }
        } else {
            window.location.href = '../html/auth.html';
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
        userNameElement.textContent = 'Error loading name';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Back button
    const backBtn = document.querySelector('.header-back-button');
    if (backBtn) {
        backBtn.addEventListener('click', function() {
            window.location.href = 'employee_dashboard.html';
        });
    }

    // Search and filter
    if (searchInput) searchInput.addEventListener('input', filterInspections);
    if (typeFilter) typeFilter.addEventListener('change', filterInspections);
    if (statusFilter) statusFilter.addEventListener('change', filterInspections);
    if (toDateFilter) toDateFilter.addEventListener('change', filterInspections);

    // Clear filter
    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', clearAllFilters);
    }

    // Form submission
    if (inspectionForm) {
        inspectionForm.addEventListener('submit', handleInspectionSubmit);
    }

    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === inspectionModal) {
            closeInspectionModal();
        }
        if (event.target === deleteSelectionModal) {
            closeDeleteSelectionModal();
        }
    });
}

// Load fire extinguishers for dropdown
async function loadFireExtinguishers() {
    try {
        const { data: extinguishers, error } = await supabase
            .from('fire_extinguishers')
            .select('*')
            .order('extinguisher_no', { ascending: true });

        if (error) throw error;

        allExtinguishers = extinguishers || [];
        console.log('Available Fire Extinguishers:', allExtinguishers);
        
        // Update help text based on available extinguishers
        updateExtinguisherHelpText();
    } catch (error) {
        console.error('Error loading fire extinguishers:', error);
        showErrorMessage('Error loading fire extinguishers. Please try again.');
    }
}

// Load fire extinguisher inspections from database
async function loadFireExtinguisherInspections() {
    try {
        // First, get all fire extinguishers
        const { data: extinguishers, error: extinguisherError } = await supabase
            .from('fire_extinguishers')
            .select('*')
            .order('extinguisher_no', { ascending: true });

        if (extinguisherError) throw extinguisherError;

        // Process inspections from each extinguisher - only keep the latest one
        allInspections = [];
        let inspectionId = 1;

        extinguishers.forEach(extinguisher => {
            // Always add the extinguisher, even if no inspections exist
            if (extinguisher.inspection_data && extinguisher.inspection_data.inspections && extinguisher.inspection_data.inspections.length > 0) {
                // Sort inspections by date (newest first) and take only the latest one
                const sortedInspections = extinguisher.inspection_data.inspections
                    .filter(inspection => inspection.date) // Only include inspections with dates
                    .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date descending
                
                if (sortedInspections.length > 0) {
                    const latestInspection = sortedInspections[0]; // Get the latest inspection
                    allInspections.push({
                        id: inspectionId++,
                        extinguisher_id: extinguisher.id,
                        extinguisher_no: extinguisher.extinguisher_no,
                        type: extinguisher.type_of_extinguisher,
                        location: extinguisher.location,
                        form_date: latestInspection.form_date,
                        refilled_date: latestInspection.refilled_date,
                        expiry_date: latestInspection.expiry_date,
                        capacity: latestInspection.capacity,
                        checked_by: latestInspection.checked_by,
                        verified_by: latestInspection.verified_by,
                        inspection_date: latestInspection.date,
                        next_due_date: latestInspection.next_due_date,
                        inspector: latestInspection.inspector,
                        pin_seal: latestInspection.pin_seal,
                        pressure: latestInspection.pressure,
                        hose_nozzle: latestInspection.hose_nozzle,
                        handle_knob: latestInspection.handle_knob,
                        dent_rust_leak: latestInspection.dent_rust_leak,
                        easy_access: latestInspection.easy_access,
                        remarks: latestInspection.remarks,
                        status: getInspectionStatus(latestInspection.next_due_date)
                    });
                }
            } else {
                // Add extinguisher with no inspection data (empty inspection fields)
                allInspections.push({
                    id: inspectionId++,
                    extinguisher_id: extinguisher.id,
                    extinguisher_no: extinguisher.extinguisher_no,
                    type: extinguisher.type_of_extinguisher,
                    location: extinguisher.location,
                    form_date: '',
                    refilled_date: '',
                    expiry_date: '',
                    capacity: extinguisher.capacity || '',
                    checked_by: '',
                    verified_by: '',
                    inspection_date: '',
                    next_due_date: '',
                    inspector: '',
                    pin_seal: '',
                    pressure: '',
                    hose_nozzle: '',
                    handle_knob: '',
                    dent_rust_leak: '',
                    easy_access: '',
                    remarks: '',
                    status: 'No Inspection'
                });
            }
        });

        // Sort by Fire Extinguisher number for better organization
        allInspections.sort((a, b) => a.extinguisher_no.localeCompare(b.extinguisher_no));
        
        filteredInspections = [...allInspections];
        renderTable();
        updateStatistics();
    } catch (error) {
        console.error('Error loading fire extinguisher inspections:', error);
        showErrorMessage('Error loading inspections. Please try again.');
    }
}

// Render the table
function renderTable() {
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (filteredInspections.length === 0) {
    const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="10" style="text-align: center; padding: 40px; color: #666; font-style: italic;">
                No inspection records found
            </td>
        `;
        tableBody.appendChild(row);
        return;
    }
    
    filteredInspections.forEach((inspection, index) => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${parseInt((inspection.extinguisher_no || '').replace('FE-', '')).toString().padStart(2, '0')}</td>
            <td>${inspection.type || ''}</td>
            <td>${inspection.location || ''}</td>
            <td>${inspection.capacity || ''} kg</td>
            <td>${formatDate(inspection.expiry_date)}</td>
            <td>${formatDate(inspection.inspection_date)}</td>
            <td>${formatDate(inspection.next_due_date)}</td>
            <td><span class="status-badge status-${inspection.status.toLowerCase().replace(' ', '-')}">${inspection.status}</span></td>
            <td>${inspection.remarks || ''}</td>
            <td style="text-align: center;">
                <div class="action-buttons">
                    <button onclick="viewInspection(${inspection.id})" class="btn-small btn-view" title="View Details">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                        </svg>
                </button>
                    <button onclick="addInspectionForExtinguisher(${inspection.extinguisher_id}, '${inspection.extinguisher_no}')" class="btn-small btn-add" title="Add Inspection" style="background-color: #10b981;">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                        </svg>
                    </button>
                    <button onclick="editFireExtinguisher(${inspection.extinguisher_id}, '${inspection.extinguisher_no}')" class="btn-small btn-edit" title="Edit Fire Extinguisher" style="background-color: #f59e0b;">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                </button>
                    <button onclick="openDeleteOptionsModal(${inspection.extinguisher_id}, '${inspection.extinguisher_no}')" class="btn-small btn-delete" title="Delete Options">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                </button>
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Filter inspections based on search and filters
function filterInspections() {
    const searchTerm = (searchInput?.value || '').toLowerCase();
    const typeFilterValue = typeFilter?.value || '';
    const statusFilterValue = statusFilter?.value || '';
    const toDateValue = toDateFilter?.value || '';

    filteredInspections = allInspections.filter(inspection => {
        const matchesSearch = 
            (inspection.extinguisher_no && inspection.extinguisher_no.toLowerCase().includes(searchTerm)) ||
            (inspection.location && inspection.location.toLowerCase().includes(searchTerm)) ||
            (inspection.type && inspection.type.toLowerCase().includes(searchTerm)) ||
            (inspection.inspector && inspection.inspector.toLowerCase().includes(searchTerm));

        const matchesType = !typeFilterValue || inspection.type === typeFilterValue;
        const matchesStatus = !statusFilterValue || inspection.status === statusFilterValue;
        
        const matchesDateRange = !toDateValue || new Date(inspection.inspection_date) <= new Date(toDateValue);

        return matchesSearch && matchesType && matchesStatus && matchesDateRange;
    });

    renderTable();
    updateFilterStatus();
}

// Clear all filters
function clearAllFilters() {
    if (searchInput) searchInput.value = '';
    if (typeFilter) typeFilter.value = '';
    if (statusFilter) statusFilter.value = '';
    if (toDateFilter) toDateFilter.value = '';

    currentFilters = {
        toDate: '',
        type: '',
        status: '',
        location: ''
    };

    filteredInspections = [...allInspections];
    renderTable();
    updateFilterStatus();
}

// Update filter status display
function updateFilterStatus() {
    if (!filterStatusEl) return;

    const hasActiveFilters = 
        (searchInput?.value || '') ||
        (typeFilter?.value || '') ||
        (statusFilter?.value || '') ||
        (fromDateFilter?.value || '') ||
        (toDateFilter?.value || '');

    if (hasActiveFilters) {
        filterStatusEl.textContent = 'On';
        filterStatusEl.className = 'px-2 py-1 text-sm font-semibold rounded-full bg-green-200 text-green-800';
    } else {
        filterStatusEl.textContent = 'Off';
        filterStatusEl.className = 'px-2 py-1 text-sm font-semibold rounded-full bg-gray-200 text-gray-700';
    }
}

// Get inspection status
function getInspectionStatus(nextDueDate) {
    if (!nextDueDate) return 'Unknown';
    
    const today = new Date();
    const dueDate = new Date(nextDueDate);
    const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue < 0) return 'Expired';
    if (daysUntilDue <= 30) return 'Service Due';
    return 'Active';
}

// Format inspection result
function formatInspectionResult(result) {
    if (!result) return '-';
    if (result === '✔') return '✔ Ok';
    if (result === '❌') return '❌ Not Ok';
    if (result === 'NA') return '- NA';
    return result;
}

// Format date
function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-GB'); // DD/MM/YYYY format
}

// Update statistics
function updateStatistics() {
    const total = allInspections.length;
    const active = allInspections.filter(i => i.status === 'Active').length;
    const expired = allInspections.filter(i => i.status === 'Expired').length;
    const serviceDue = allInspections.filter(i => i.status === 'Service Due').length;

    if (totalInspectionsEl) totalInspectionsEl.textContent = total;
    if (activeInspectionsEl) activeInspectionsEl.textContent = active;
    if (expiredInspectionsEl) expiredInspectionsEl.textContent = expired;
    if (serviceDueInspectionsEl) serviceDueInspectionsEl.textContent = serviceDue;
}

// Modal functions
function openAddInspectionModal() {
    modalTitle.textContent = 'Add New Inspection Record';
    inspectionForm.reset();
    
    // Clear manual input fields
    if (extinguisherInput) extinguisherInput.value = '';
    if (extinguisherType) extinguisherType.value = '';
    if (extinguisherLocation) extinguisherLocation.value = '';
    if (refilledDate) refilledDate.value = '';
    if (expiryDate) expiryDate.value = '';
    if (capacity) capacity.value = '';
    if (checkedBy) checkedBy.value = '';
    if (verifiedBy) verifiedBy.value = '';
    
    // Setup location autocomplete
    setupLocationAutocomplete();
    
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('inspectionDate').value = today;
    
    // Set next due date to 1 year from today
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    document.getElementById('nextDueDate').value = nextYear.toISOString().split('T')[0];
    
    // Set expiry date to 5 years from today (typical fire extinguisher lifespan)
    const expiryYear = new Date();
    expiryYear.setFullYear(expiryYear.getFullYear() + 5);
    if (expiryDate) expiryDate.value = expiryYear.toISOString().split('T')[0];
    
    inspectionModal.style.display = 'block';
}

function closeInspectionModal() {
    inspectionModal.style.display = 'none';
    inspectionForm.reset();
}

// Handle form submission
async function handleInspectionSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(inspectionForm);
    const inspectionData = {
        extinguisher_no: extinguisherInput.value,
        type: extinguisherType.value,
        location: extinguisherLocation.value,
        refilled_date: refilledDate.value || null,
        expiry_date: expiryDate.value,
        capacity: capacity.value,
        inspection_date: document.getElementById('inspectionDate').value,
        next_due_date: document.getElementById('nextDueDate').value,
        inspector: document.getElementById('inspector').value,
        pin_seal: document.getElementById('pinSeal').value,
        pressure: document.getElementById('pressure').value,
        hose_nozzle: document.getElementById('hoseNozzle').value,
        handle_knob: document.getElementById('handleKnob').value,
        dent_rust_leak: document.getElementById('dentRustLeak').value,
        easy_access: document.getElementById('easyAccess').value,
        remarks: document.getElementById('remarks').value,
        checked_by: checkedBy.value || null,
        verified_by: verifiedBy.value || null
    };

    // Validate extinguisher number format
    if (!inspectionData.extinguisher_no || !inspectionData.extinguisher_no.trim()) {
        showErrorMessage('Please enter a Fire Extinguisher number.');
        return;
    }
    
    // Check if extinguisher number format is valid (00-99)
    const extinguisherPattern = /^\d{1,2}$/;
    if (!extinguisherPattern.test(inspectionData.extinguisher_no.trim())) {
        showErrorMessage('Please enter a valid Fire Extinguisher number (00 to 99).');
        return;
    }
    
    // Check if number is within range (00-99)
    const extinguisherNum = parseInt(inspectionData.extinguisher_no.trim());
    if (extinguisherNum < 0 || extinguisherNum > 99) {
        showErrorMessage('Fire Extinguisher number must be between 00 and 99.');
        return;
    }

    // Validate type
    if (!inspectionData.type || !inspectionData.type.trim()) {
        showErrorMessage('Please select a Fire Extinguisher type.');
        return;
    }

    // Validate location
    if (!inspectionData.location || !inspectionData.location.trim()) {
        showErrorMessage('Please enter a location.');
        return;
    }



    // Validate expiry date
    if (!inspectionData.expiry_date) {
        showErrorMessage('Please select an expiry date.');
        return;
    }

    // Validate capacity
    if (!inspectionData.capacity || inspectionData.capacity <= 0) {
        showErrorMessage('Please enter a valid capacity.');
        return;
    }

    try {
            // Add new inspection
            await addInspection(inspectionData);
        
        closeInspectionModal();
        await loadFireExtinguisherInspections(); // Reload data
        showSuccessMessage('Inspection record added successfully!');
    } catch (error) {
        console.error('Error saving inspection:', error);
        showErrorMessage('Error saving inspection. Please try again.');
    }
}

// Add new inspection
async function addInspection(inspectionData) {
    // Convert numeric input to database format (e.g., "01" -> "FE-001")
    const numericValue = inspectionData.extinguisher_no.trim();
    const databaseFormat = `FE-${numericValue.padStart(3, '0')}`;
    
    console.log('Looking for extinguisher:', databaseFormat);
    console.log('Available extinguishers:', allExtinguishers.map(e => e.extinguisher_no));
    
    // Find the extinguisher by extinguisher number (database format)
    let extinguisher = allExtinguishers.find(e => e.extinguisher_no === databaseFormat);
    
    if (!extinguisher) {
        // Try to find by just the numeric value (in case database uses different format)
        extinguisher = allExtinguishers.find(e => e.extinguisher_no === numericValue || e.extinguisher_no === databaseFormat);
        
        if (!extinguisher) {
            // Create a new Fire Extinguisher if it doesn't exist
            console.log('Creating new Fire Extinguisher:', databaseFormat);
            
            const newExtinguisherData = {
                extinguisher_no: databaseFormat,
                type_of_extinguisher: inspectionData.type,
                location: inspectionData.location,
                inspection_data: { inspections: [] }
            };
            
            const { data: newExtinguisher, error: createError } = await supabase
                .from('fire_extinguishers')
                .insert([newExtinguisherData])
                .select()
                .single();
                
            if (createError) {
                throw new Error(`Failed to create Fire Extinguisher ${numericValue}: ${createError.message}`);
            }
            
            extinguisher = newExtinguisher;
            console.log('Created new Fire Extinguisher:', extinguisher);
            
            // Add to local array so future lookups work
            allExtinguishers.push(extinguisher);
        }
    }
    
    const extinguisherId = extinguisher.id;

    // Get current inspection data
    const { data: currentData, error: fetchError } = await supabase
            .from('fire_extinguishers')
        .select('inspection_data')
            .eq('id', extinguisherId)
            .single();

    if (fetchError) throw fetchError;

    // Prepare new inspection record with all fields
    const newInspection = {
        date: inspectionData.inspection_date,
        next_due_date: inspectionData.next_due_date,
        inspector: inspectionData.inspector,
        pin_seal: inspectionData.pin_seal,
        pressure: inspectionData.pressure,
        hose_nozzle: inspectionData.hose_nozzle,
        handle_knob: inspectionData.handle_knob,
        dent_rust_leak: inspectionData.dent_rust_leak,
        easy_access: inspectionData.easy_access,
        remarks: inspectionData.remarks,
        refilled_date: inspectionData.refilled_date,
        expiry_date: inspectionData.expiry_date,
        capacity: inspectionData.capacity,
        checked_by: inspectionData.checked_by,
        verified_by: inspectionData.verified_by
    };

    // Update inspection_data
    const updatedInspectionData = currentData.inspection_data || { inspections: [] };
    updatedInspectionData.inspections = updatedInspectionData.inspections || [];
    updatedInspectionData.inspections.push(newInspection);

    // Update the database
    const { error: updateError } = await supabase
        .from('fire_extinguishers')
        .update({ inspection_data: updatedInspectionData })
        .eq('id', extinguisherId);

    if (updateError) throw updateError;
}



// View inspection details - Navigate to form page
window.viewInspection = function(id) {
    const inspection = allInspections.find(i => i.id === id);
    if (!inspection) return;

    // Navigate to the Fire Extinguisher Inspection Form page
    // Pass the extinguisher ID as a URL parameter
    window.location.href = `fire_extinguisher_inspection_form.html?extinguisher_id=${inspection.extinguisher_id}&extinguisher_no=${inspection.extinguisher_no}`;
}

// Add inspection for specific extinguisher
window.addInspectionForExtinguisher = function(extinguisherId, extinguisherNo) {
    console.log('addInspectionForExtinguisher called with:', extinguisherId, extinguisherNo);
    console.log('allExtinguishers:', allExtinguishers);
    
    // Find the extinguisher data
    const extinguisher = allExtinguishers.find(e => e.id === extinguisherId);
    console.log('Found extinguisher:', extinguisher);
    
    if (!extinguisher) {
        console.error('Extinguisher not found for ID:', extinguisherId);
        return;
    }

    // Open the add inspection modal
    openAddInspectionModal();
    
    // Pre-populate the extinguisher fields
    setTimeout(() => {
        console.log('Pre-populating fields for extinguisher:', extinguisher);
        
        // Convert FE number from database format (FE-001) to display format (1)
        let numericValue = extinguisher.extinguisher_no;
        if (extinguisher.extinguisher_no.includes('FE-')) {
            numericValue = extinguisher.extinguisher_no.replace('FE-', '').replace(/^0+/, '') || '0';
        } else if (extinguisher.extinguisher_no.match(/^\d+$/)) {
            numericValue = extinguisher.extinguisher_no.replace(/^0+/, '') || '0';
        }
        
        console.log('Setting extinguisher input to:', numericValue);
        if (extinguisherInput) {
            extinguisherInput.value = numericValue;
            console.log('Extinguisher input set to:', extinguisherInput.value);
        } else {
            console.error('extinguisherInput element not found');
        }
        
        if (extinguisherType) {
            extinguisherType.value = extinguisher.type_of_extinguisher || '';
            console.log('Extinguisher type set to:', extinguisherType.value);
        }
        
        if (extinguisherLocation) {
            extinguisherLocation.value = extinguisher.location || '';
            console.log('Extinguisher location set to:', extinguisherLocation.value);
        }
        
        if (capacity) {
            capacity.value = extinguisher.capacity || '';
            console.log('Capacity set to:', capacity.value);
        }
        
        // Set today's date as default
        const today = new Date().toISOString().split('T')[0];
        
        // Set next month as default next due date
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        if (document.getElementById('nextDueDate')) {
            document.getElementById('nextDueDate').value = nextMonth.toISOString().split('T')[0];
        }
        
        // Update modal title
        if (modalTitle) {
            modalTitle.textContent = 'Add Inspection Record';
        }
        
        console.log('Pre-population completed');
    }, 100);
}



// Global variables for delete selection
let currentDeleteExtinguisherId = null;
let currentDeleteExtinguisherNo = null;
let selectedInspectionsToDelete = [];

// Global variables for delete options
let currentDeleteOptionsExtinguisherId = null;
let currentDeleteOptionsExtinguisherNo = null;

// Global variables for clear inspection data
let selectedInspectionsToClear = [];

// Open delete selection modal
window.openDeleteSelectionModal = function(extinguisherId, extinguisherNo) {
    currentDeleteExtinguisherId = extinguisherId;
    currentDeleteExtinguisherNo = extinguisherNo;
    selectedInspectionsToDelete = [];
    
    // Find the extinguisher data
    const extinguisher = allExtinguishers.find(e => e.id === extinguisherId);
    if (!extinguisher || !extinguisher.inspection_data || !extinguisher.inspection_data.inspections) {
        showErrorMessage('No inspection records found for this Fire Extinguisher.');
        return;
    }
    
    const inspections = extinguisher.inspection_data.inspections;
    if (inspections.length === 0) {
        showErrorMessage('No inspection records found for this Fire Extinguisher.');
        return;
    }
    
    // Populate the modal content
    const contentDiv = document.getElementById('deleteSelectionContent');
    contentDiv.innerHTML = `
        <p style="margin-bottom: 15px; color: #666;">Select inspection records to delete for <strong>${extinguisherNo}</strong>:</p>
        <div style="max-height: 400px; overflow-y: auto; border: 1px solid #ddd; border-radius: 5px; padding: 10px;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f8f9fa;">
                        <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">
                            <input type="checkbox" id="selectAll" onchange="toggleSelectAll()" style="margin-right: 5px;">
                            Select All
                        </th>
                        <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Date</th>
                        <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Inspector</th>
                        <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Remarks</th>
                    </tr>
                </thead>
                <tbody>
                    ${inspections.map((inspection, index) => `
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">
                                <input type="checkbox" 
                                       id="inspection_${index}" 
                                       value="${index}"
                                       onchange="updateSelectedInspections()"
                                       style="margin-right: 5px;">
                            </td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">${formatDate(inspection.date)}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">${inspection.inspector || 'N/A'}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">${inspection.remarks || 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <p style="margin-top: 15px; color: #dc3545; font-size: 14px;">
            <i class="bi bi-exclamation-triangle"></i> 
            Warning: This action cannot be undone. Selected inspection records will be permanently deleted.
        </p>
    `;
    
    document.getElementById('deleteSelectionModal').style.display = 'block';
}

// Toggle select all checkboxes
window.toggleSelectAll = function() {
    const selectAllCheckbox = document.getElementById('selectAll');
    const inspectionCheckboxes = document.querySelectorAll('#deleteSelectionContent input[type="checkbox"]:not(#selectAll)');
    
    inspectionCheckboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
    
    updateSelectedInspections();
}

// Update selected inspections array
window.updateSelectedInspections = function() {
    const inspectionCheckboxes = document.querySelectorAll('#deleteSelectionContent input[type="checkbox"]:not(#selectAll)');
    selectedInspectionsToDelete = [];
    
    inspectionCheckboxes.forEach(checkbox => {
        if (checkbox.checked) {
            selectedInspectionsToDelete.push(parseInt(checkbox.value));
        }
    });
    
    // Update select all checkbox
    const selectAllCheckbox = document.getElementById('selectAll');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = selectedInspectionsToDelete.length === inspectionCheckboxes.length;
        selectAllCheckbox.indeterminate = selectedInspectionsToDelete.length > 0 && selectedInspectionsToDelete.length < inspectionCheckboxes.length;
    }
}

// Close delete selection modal
window.closeDeleteSelectionModal = function() {
    document.getElementById('deleteSelectionModal').style.display = 'none';
    currentDeleteExtinguisherId = null;
    currentDeleteExtinguisherNo = null;
    selectedInspectionsToDelete = [];
}

// Confirm and delete selected inspections
window.confirmDeleteSelected = async function() {
    if (selectedInspectionsToDelete.length === 0) {
        showErrorMessage('Please select at least one inspection record to delete.');
        return;
    }
    
    const confirmMessage = selectedInspectionsToDelete.length === 1 
        ? `Are you sure you want to delete 1 inspection record?`
        : `Are you sure you want to delete ${selectedInspectionsToDelete.length} inspection records?`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        // Get current inspection data
        const { data: currentData, error: fetchError } = await supabase
            .from('fire_extinguishers')
            .select('inspection_data')
            .eq('id', currentDeleteExtinguisherId)
            .single();

        if (fetchError) throw fetchError;

        // Remove selected inspections from the array
        const updatedInspectionData = currentData.inspection_data || { inspections: [] };
        updatedInspectionData.inspections = updatedInspectionData.inspections || [];
        
        // Sort indices in descending order to avoid index shifting issues
        const sortedIndices = selectedInspectionsToDelete.sort((a, b) => b - a);
        
        // Remove inspections by index
        sortedIndices.forEach(index => {
            if (index >= 0 && index < updatedInspectionData.inspections.length) {
                updatedInspectionData.inspections.splice(index, 1);
            }
        });

        // Update the database
        const { error: updateError } = await supabase
            .from('fire_extinguishers')
            .update({ inspection_data: updatedInspectionData })
            .eq('id', currentDeleteExtinguisherId);

        if (updateError) throw updateError;

        // Store the count before clearing the array
        const deletedCount = selectedInspectionsToDelete.length;
        
        // Close modal and reload data
        closeDeleteSelectionModal();
        await loadFireExtinguisherInspections();
        
        // Only show success message if records were actually deleted
        if (deletedCount > 0) {
            const successMessage = deletedCount === 1 
                ? '1 inspection record deleted successfully!'
                : `${deletedCount} inspection records deleted successfully!`;
            showSuccessMessage(successMessage);
        }
        
    } catch (error) {
        console.error('Error deleting inspections:', error);
        showErrorMessage('Error deleting inspection records. Please try again.');
    }
}

// Delete inspection (old function - kept for backward compatibility)
window.deleteInspection = async function(id) {
    if (confirm('Are you sure you want to delete this inspection record?')) {
        try {
            const inspection = allInspections.find(i => i.id === id);
            if (!inspection) {
                showErrorMessage('Inspection record not found.');
        return;
    }

            // Get current inspection data
            const { data: currentData, error: fetchError } = await supabase
                .from('fire_extinguishers')
                .select('inspection_data')
                .eq('id', inspection.extinguisher_id)
                .single();

            if (fetchError) throw fetchError;

            // Remove the specific inspection from the array
            const updatedInspectionData = currentData.inspection_data || { inspections: [] };
            updatedInspectionData.inspections = updatedInspectionData.inspections || [];
            
            // Find and remove the inspection by matching date and inspector
            const inspectionIndex = updatedInspectionData.inspections.findIndex(insp => 
                insp.date === inspection.inspection_date && 
                insp.inspector === inspection.inspector
            );

            if (inspectionIndex !== -1) {
                updatedInspectionData.inspections.splice(inspectionIndex, 1);
        } else {
                showErrorMessage('Inspection record not found in database.');
                return;
            }

            // Update the database
            const { error: updateError } = await supabase
                .from('fire_extinguishers')
                .update({ inspection_data: updatedInspectionData })
                .eq('id', inspection.extinguisher_id);

            if (updateError) throw updateError;

            // Reload the data and show success message
            await loadFireExtinguisherInspections();
            showSuccessMessage('Inspection record deleted successfully!');
        } catch (error) {
            console.error('Error deleting inspection:', error);
            showErrorMessage('Error deleting inspection record. Please try again.');
        }
    }
}

// Show success message
function showSuccessMessage(message) {
    alert(message); // You can replace this with a better notification system
}

// Show error message
function showErrorMessage(message) {
    alert(message);
}

// Update extinguisher help text based on available extinguishers
function updateExtinguisherHelpText() {
    const helpTextElement = document.querySelector('#extinguisherInput + small');
    if (helpTextElement) {
        helpTextElement.textContent = 'Enter any number 00-99 to create new Fire Extinguishers';
    }
}

// Setup location autocomplete
function setupLocationAutocomplete() {
    if (!extinguisherLocation) return;
    
    // Get unique locations from existing extinguishers
    const locations = [...new Set(allExtinguishers.map(e => e.location).filter(loc => loc))];
    
    // Create datalist for autocomplete
    let datalist = document.getElementById('locationDatalist');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'locationDatalist';
        document.body.appendChild(datalist);
    }
    
    datalist.innerHTML = '';
    locations.forEach(location => {
        const option = document.createElement('option');
        option.value = location;
        datalist.appendChild(option);
    });
    
    // Add datalist to location input
    extinguisherLocation.setAttribute('list', 'locationDatalist');
}







// Edit Fire Extinguisher function
window.editFireExtinguisher = function(extinguisherId, extinguisherNo) {
    console.log('editFireExtinguisher called with:', extinguisherId, extinguisherNo);
    
    // Find the extinguisher data
    const extinguisher = allExtinguishers.find(e => e.id === extinguisherId);
    if (!extinguisher) {
        showErrorMessage('Fire extinguisher not found.');
        return;
    }
    
    // Open edit modal with pre-filled data
    openEditExtinguisherModal(extinguisher);
};

// Open Edit Extinguisher Modal
function openEditExtinguisherModal(extinguisher) {
    const modal = document.getElementById('editExtinguisherModal');
    const form = document.getElementById('editExtinguisherForm');
    const title = document.getElementById('editModalTitle');
    
    // Set modal title
    title.textContent = `Edit Fire Extinguisher - ${extinguisher.extinguisher_no}`;
    
    // Pre-fill form fields
    document.getElementById('editExtinguisherId').value = extinguisher.id;
    document.getElementById('editExtinguisherNo').value = extinguisher.extinguisher_no;
    document.getElementById('editExtinguisherType').value = extinguisher.type_of_extinguisher;
    document.getElementById('editLocation').value = extinguisher.location;
    document.getElementById('editCapacity').value = extinguisher.capacity;
    
    // Show modal
    modal.style.display = 'block';
    
    // Add form submit handler
    form.onsubmit = handleEditExtinguisherSubmit;
}

// Close Edit Extinguisher Modal
window.closeEditExtinguisherModal = function() {
    const modal = document.getElementById('editExtinguisherModal');
    modal.style.display = 'none';
};

// Handle Edit Extinguisher Form Submit
async function handleEditExtinguisherSubmit(event) {
    event.preventDefault();
    
    const formData = {
        id: document.getElementById('editExtinguisherId').value,
        extinguisher_no: document.getElementById('editExtinguisherNo').value,
        type_of_extinguisher: document.getElementById('editExtinguisherType').value,
        location: document.getElementById('editLocation').value,
        capacity: document.getElementById('editCapacity').value
    };
    
    try {
        // Update the fire extinguisher in the database
        const { error } = await supabase
            .from('fire_extinguishers')
            .update({
                extinguisher_no: formData.extinguisher_no,
                type_of_extinguisher: formData.type_of_extinguisher,
                location: formData.location,
                capacity: formData.capacity
            })
            .eq('id', formData.id);
        
        if (error) throw error;
        
        // Close modal and reload data
        closeEditExtinguisherModal();
        await loadFireExtinguishers();
        await loadFireExtinguisherInspections();
        showSuccessMessage('Fire extinguisher updated successfully!');
        
    } catch (error) {
        console.error('Error updating fire extinguisher:', error);
        showErrorMessage('Error updating fire extinguisher. Please try again.');
    }
}

// Add New Fire Extinguisher functions
window.openAddNewExtinguisherModal = function() {
    const modal = document.getElementById('addNewExtinguisherModal');
    const form = document.getElementById('addNewExtinguisherForm');
    
    // Clear form fields
    form.reset();
    
    // Show modal
    modal.style.display = 'block';
    
    // Add form submit handler
    form.onsubmit = handleAddNewExtinguisherSubmit;
};

window.closeAddNewExtinguisherModal = function() {
    const modal = document.getElementById('addNewExtinguisherModal');
    modal.style.display = 'none';
};

// Handle Add New Extinguisher Form Submit
async function handleAddNewExtinguisherSubmit(event) {
    event.preventDefault();
    
    const formData = {
        extinguisher_no: document.getElementById('newExtinguisherNo').value,
        type_of_extinguisher: document.getElementById('newExtinguisherType').value,
        location: document.getElementById('newLocation').value,
        capacity: document.getElementById('newCapacity').value
    };
    
    try {
        // Insert new fire extinguisher into the database
        const { error } = await supabase
            .from('fire_extinguishers')
            .insert([{
                extinguisher_no: formData.extinguisher_no,
                type_of_extinguisher: formData.type_of_extinguisher,
                location: formData.location,
                capacity: formData.capacity,
                inspection_data: { inspections: [] }
            }]);
        
        if (error) throw error;
        
        // Close modal and reload data
        closeAddNewExtinguisherModal();
        await loadFireExtinguishers();
        await loadFireExtinguisherInspections();
        showSuccessMessage('New fire extinguisher added successfully!');
        
    } catch (error) {
        console.error('Error adding new fire extinguisher:', error);
        showErrorMessage('Error adding new fire extinguisher. Please try again.');
    }
}

// Make functions globally available
window.viewInspection = viewInspection;
window.deleteInspection = deleteInspection;
window.editFireExtinguisher = editFireExtinguisher;
window.closeEditExtinguisherModal = closeEditExtinguisherModal;
window.openAddNewExtinguisherModal = openAddNewExtinguisherModal;
window.closeAddNewExtinguisherModal = closeAddNewExtinguisherModal;
window.openAddInspectionModal = openAddInspectionModal;
window.closeInspectionModal = closeInspectionModal;
window.openDeleteOptionsModal = openDeleteOptionsModal;
window.closeDeleteOptionsModal = closeDeleteOptionsModal;
window.deleteEntireExtinguisher = deleteEntireExtinguisher;
window.openClearInspectionDataModal = openClearInspectionDataModal;
window.closeClearInspectionDataModal = closeClearInspectionDataModal;
window.toggleSelectAllInspections = toggleSelectAllInspections;
window.toggleInspectionSelection = toggleInspectionSelection;
window.confirmClearSelectedInspections = confirmClearSelectedInspections;
window.openDeleteSelectionModal = openDeleteSelectionModal;
window.closeDeleteSelectionModal = closeDeleteSelectionModal;
window.toggleSelectAll = toggleSelectAll;
window.updateSelectedInspections = updateSelectedInspections;
window.confirmDeleteSelected = confirmDeleteSelected;

// Delete Options Modal functions
function openDeleteOptionsModal(extinguisherId, extinguisherNo) {
    currentDeleteOptionsExtinguisherId = extinguisherId;
    currentDeleteOptionsExtinguisherNo = extinguisherNo;
    
    const modal = document.getElementById('deleteOptionsModal');
    const extinguisherNoElement = document.getElementById('deleteOptionsExtinguisherNo');
    
    extinguisherNoElement.textContent = extinguisherNo;
    modal.style.display = 'block';
}

window.openDeleteOptionsModal = openDeleteOptionsModal;

function closeDeleteOptionsModal() {
    const modal = document.getElementById('deleteOptionsModal');
    modal.style.display = 'none';
    currentDeleteOptionsExtinguisherId = null;
    currentDeleteOptionsExtinguisherNo = null;
}

window.closeDeleteOptionsModal = closeDeleteOptionsModal;

// Delete entire fire extinguisher
async function deleteEntireExtinguisher() {
    if (!currentDeleteOptionsExtinguisherId) return;
    
    if (!confirm(`Are you sure you want to delete the entire fire extinguisher ${currentDeleteOptionsExtinguisherNo}? This will remove it completely from the system.`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from('fire_extinguishers')
            .delete()
            .eq('id', currentDeleteOptionsExtinguisherId);
        
        if (error) throw error;
        
        closeDeleteOptionsModal();
        await loadFireExtinguishers();
        await loadFireExtinguisherInspections();
        showSuccessMessage(`Fire extinguisher ${currentDeleteOptionsExtinguisherNo} deleted successfully!`);
        
    } catch (error) {
        console.error('Error deleting fire extinguisher:', error);
        showErrorMessage('Error deleting fire extinguisher. Please try again.');
    }
};

// Clear inspection data modal functions
function openClearInspectionDataModal() {
    if (!currentDeleteOptionsExtinguisherId) return;
    
    // Find the extinguisher data
    const extinguisher = allExtinguishers.find(e => e.id === currentDeleteOptionsExtinguisherId);
    if (!extinguisher || !extinguisher.inspection_data || !extinguisher.inspection_data.inspections) {
        showErrorMessage('No inspection data found for this extinguisher.');
        return;
    }

    const modal = document.getElementById('clearInspectionDataModal');
    const extinguisherNoElement = document.getElementById('clearInspectionDataExtinguisherNo');
    const inspectionListElement = document.getElementById('inspectionDataList');
    
    extinguisherNoElement.textContent = currentDeleteOptionsExtinguisherNo;
    
    // Clear previous selections
    selectedInspectionsToClear = [];
    
    // Populate inspection records with checkboxes
    inspectionListElement.innerHTML = '';
    extinguisher.inspection_data.inspections.forEach((inspection, index) => {
        const inspectionDiv = document.createElement('div');
        inspectionDiv.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid #e5e7eb; border-radius: 4px; margin-bottom: 8px; background: #f9fafb;';
        
        inspectionDiv.innerHTML = `
            <input type="checkbox" id="inspection_${index}" value="${index}" onchange="toggleInspectionSelection(${index})">
            <div style="flex: 1;">
                <div style="font-weight: 600; color: #374151;">Date: ${formatDate(inspection.date)}</div>
                <div style="font-size: 14px; color: #6b7280;">Inspector: ${inspection.inspector || 'N/A'}</div>
                <div style="font-size: 14px; color: #6b7280;">Remarks: ${inspection.remarks || 'N/A'}</div>
            </div>
        `;
        
        inspectionListElement.appendChild(inspectionDiv);
    });
    
    // Close the delete options modal and open the clear data modal
    closeDeleteOptionsModal();
    modal.style.display = 'block';
}

function closeClearInspectionDataModal() {
    const modal = document.getElementById('clearInspectionDataModal');
    modal.style.display = 'none';
    selectedInspectionsToClear = [];
}

function toggleSelectAllInspections() {
    const selectAllCheckbox = document.getElementById('selectAllInspections');
    const inspectionCheckboxes = document.querySelectorAll('#inspectionDataList input[type="checkbox"]');
    
    inspectionCheckboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
        const index = parseInt(checkbox.value);
        if (selectAllCheckbox.checked) {
            if (!selectedInspectionsToClear.includes(index)) {
                selectedInspectionsToClear.push(index);
            }
        } else {
            selectedInspectionsToClear = selectedInspectionsToClear.filter(i => i !== index);
        }
    });
}

function toggleInspectionSelection(index) {
    const checkbox = document.getElementById(`inspection_${index}`);
    if (checkbox.checked) {
        if (!selectedInspectionsToClear.includes(index)) {
            selectedInspectionsToClear.push(index);
        }
    } else {
        selectedInspectionsToClear = selectedInspectionsToClear.filter(i => i !== index);
    }
    
    // Update select all checkbox
    const selectAllCheckbox = document.getElementById('selectAllInspections');
    const allCheckboxes = document.querySelectorAll('#inspectionDataList input[type="checkbox"]');
    const checkedCheckboxes = document.querySelectorAll('#inspectionDataList input[type="checkbox"]:checked');
    
    selectAllCheckbox.checked = checkedCheckboxes.length === allCheckboxes.length;
    selectAllCheckbox.indeterminate = checkedCheckboxes.length > 0 && checkedCheckboxes.length < allCheckboxes.length;
}

async function confirmClearSelectedInspections() {
    if (!currentDeleteOptionsExtinguisherId || selectedInspectionsToClear.length === 0) {
        showErrorMessage('Please select at least one inspection record to clear.');
        return;
    }

    if (!confirm(`Are you sure you want to clear ${selectedInspectionsToClear.length} selected inspection record(s)?`)) {
        return;
    }

    try {
        // Find the extinguisher data
        const extinguisher = allExtinguishers.find(e => e.id === currentDeleteOptionsExtinguisherId);
        if (!extinguisher || !extinguisher.inspection_data || !extinguisher.inspection_data.inspections) {
            throw new Error('Extinguisher data not found');
        }
        
        // Remove selected inspections (in reverse order to maintain indices)
        const updatedInspections = extinguisher.inspection_data.inspections.filter((_, index) => 
            !selectedInspectionsToClear.includes(index)
        );
        
        // Update the database
        const { error } = await supabase
            .from('fire_extinguishers')
            .update({ inspection_data: { inspections: updatedInspections } })
            .eq('id', currentDeleteOptionsExtinguisherId);
        
        if (error) throw error;
        
        closeClearInspectionDataModal();
        await loadFireExtinguisherInspections();
        showSuccessMessage(`${selectedInspectionsToClear.length} inspection record(s) cleared successfully!`);
        
    } catch (error) {
        console.error('Error clearing inspection data:', error);
        showErrorMessage('Error clearing inspection data. Please try again.');
    }
};
