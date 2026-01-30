import { supabase } from '../supabase-config.js';
import { showToast, storePendingToast } from './toast.js';

// Global variables
let allInspections = [];
let filteredInspections = [];
let allExtinguishers = [];
let currentFilters = {
    type: '',
    status: '',
    location: ''
};


// DOM elements
const tableBody = document.getElementById('fireInspectionTableBody');
const searchInput = document.getElementById('filterLocation');
const typeFilter = document.getElementById('filterType');
const statusFilter = document.getElementById('filterStatus');
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

// --- Small DOM & formatting helpers (kept simple, purely cosmetic) ---
function getEl(el) { return el || null; }
function setInputValue(el, value) {
    if (!el) return;
    try { el.value = value == null ? '' : value; } catch (e) { /* ignore */ }
}
function setText(el, value) {
    if (!el) return;
    try { el.textContent = value == null ? '' : value; } catch (e) { /* ignore */ }
}
function setDateInput(el, dateStr) {
    if (!el) return;
    if (!dateStr) { el.value = ''; return; }
    // Normalize to YYYY-MM-DD (works for ISO or yyyy-mm-ddT...)
    try {
        const d = String(dateStr).split('T')[0];
        el.value = d;
    } catch (e) { el.value = ''; }
}
function clearInputs(arr) { if (!Array.isArray(arr)) return; arr.forEach(a => setInputValue(a, '')); }
// ---------------------------------------------------------------------

// Small presentation helpers
function padFEId(fe) {
    if (!fe) return '00';
    try { return String(parseInt(String(fe).replace('FE-', '').replace(/^0+/, '') || '0')).padStart(2, '0'); } catch (e) { return String(fe).padStart(2, '0'); }
}

function buildActionButtons(inspection) {
    return `
        <div class="flex justify-center items-center space-x-2 max-w-full overflow-hidden">
            <!-- View Details -->
            <button onclick="viewInspection('${inspection.id}')" class="p-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 hover:text-blue-900 transition-all duration-200 border border-blue-200 hover:border-blue-300 flex-shrink-0" title="View Details">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                </svg>
            </button>
            
            <!-- Add Inspection -->
            <button onclick="addInspectionForExtinguisher('${inspection.extinguisher_id}', '${inspection.extinguisher_no}')" class="p-1 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-600 hover:text-sky-800 transition-all duration-200 border border-sky-200 hover:border-sky-300 flex-shrink-0" title="Add Inspection">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
            </button>

            <!-- Edit Fire Extinguisher -->
            <button onclick="editFireExtinguisher('${inspection.extinguisher_id}', '${inspection.extinguisher_no}')" class="p-1 rounded-md bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-800 transition-all duration-200 border border-green-200 hover:border-green-300 flex-shrink-0" title="Edit Fire Extinguisher">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                </svg>
            </button>

            <!-- Delete This Inspection -->
            <button onclick="deleteInspectionRecord('${inspection.id}', '${inspection.extinguisher_no}')" class="p-1 rounded-md bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 transition-all duration-200 border border-red-200 hover:border-red-300 flex-shrink-0" title="Delete This Inspection">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
            </button>

            <!-- More Options -->
            <button onclick="openDeleteOptionsModal('${inspection.extinguisher_id}', '${inspection.extinguisher_no}')" class="p-1 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-all duration-200 border border-gray-200 hover:border-gray-300 flex-shrink-0" title="More Options">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path>
                </svg>
            </button>
        </div>`;
}

function buildInspectionRow(inspection, index) {
    return `
        <td>${index + 1}</td>
        <td>${padFEId(inspection.extinguisher_no)}</td>
        <td>${inspection.type || ''}</td>
        <td>${inspection.location || ''}</td>
        <td>${inspection.capacity || ''} kg</td>
        <td>${formatDate(inspection.refilled_date)}</td>
        <td>${formatDate(inspection.expiry_date)}</td>
        <td>${formatDate(inspection.inspection_date)}</td>
        <td>${formatDate(inspection.next_due_date)}</td>
        <td><span class="status-badge status-${inspection.status.toLowerCase().replace(' ', '-')}">${inspection.status}</span></td>
        <td>${inspection.remarks || ''}</td>
        <td style="text-align: center;">
            ${buildActionButtons(inspection)}
        </td>
    `;
}

// Delete Selection Modal elements
const deleteSelectionModal = document.getElementById('deleteSelectionModal');

// Statistics elements
const totalInspectionsEl = document.getElementById('totalInspections');
const activeInspectionsEl = document.getElementById('activeInspections');
const expiredInspectionsEl = document.getElementById('expiredInspections');
const serviceDueInspectionsEl = document.getElementById('serviceDueInspections');

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    // Single load for all data
    await loadFireExtinguisherInspections();
    setupEventListeners();
    updateStatistics();
});

// Setup event listeners
function setupEventListeners() {
    // Back button
    const backBtn = document.querySelector('.header-back-button');
    if (backBtn) {
        backBtn.addEventListener('click', function() {
            window.location.href = 'employee-dashboard.html';
        });
    }

    // Search and filter
    if (searchInput) searchInput.addEventListener('input', filterInspections);
    if (typeFilter) typeFilter.addEventListener('change', filterInspections);
    if (statusFilter) statusFilter.addEventListener('change', filterInspections);

    // Clear filter
    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', clearAllFilters);
    } else {
        console.error('Clear button not found!');
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

// Load fire extinguisher inspections from database
async function loadFireExtinguisherInspections() {
    try {
        // First, get all fire extinguishers
        const { data: extinguishers, error: extinguisherError } = await supabase
            .from('fire_extinguishers')
            .select('*')
            .order('extinguisher_no', { ascending: true });

        if (extinguisherError) throw extinguisherError;

        // Store for other functions to use
        allExtinguishers = extinguishers || [];
        
        // Update help text for the search input
        updateExtinguisherHelpText();

        // Process inspections from each extinguisher - only keep the latest one
        allInspections = [];

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
                        id: extinguisher.id, // Use database ID for stable identification
                        inspection_id: latestInspection.id, // Unique inspection ID
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
                        status: getInspectionStatus(latestInspection.next_due_date, latestInspection.date)
                    });
                }
            } else {
                // Add extinguisher with no inspection data (empty inspection fields)
                allInspections.push({
                    id: extinguisher.id, // Use database ID
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
        showToast('Error loading inspections. Please try again.', 'error');
    }
}

// Render the table
function renderTable() {
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (filteredInspections.length === 0) {
    const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="12" style="text-align: center; padding: 40px; color: #666; font-style: italic;">
                No inspection records found
            </td>
        `;
        tableBody.appendChild(row);
        return;
    }
    
    filteredInspections.forEach((inspection, index) => {
        const row = document.createElement('tr');
        row.innerHTML = buildInspectionRow(inspection, index);
        tableBody.appendChild(row);
    });
}

// Filter inspections based on search and filters
function filterInspections() {
    const searchTerm = (searchInput?.value || '').toLowerCase();
    const typeFilterValue = typeFilter?.value || '';
    const statusFilterValue = statusFilter?.value || '';

    filteredInspections = allInspections.filter(inspection => {
        const matchesSearch =
            (inspection.extinguisher_no && inspection.extinguisher_no.toLowerCase().includes(searchTerm)) ||
            (inspection.location && inspection.location.toLowerCase().includes(searchTerm)) ||
            (inspection.type && inspection.type.toLowerCase().includes(searchTerm)) ||
            (inspection.inspector && inspection.inspector.toLowerCase().includes(searchTerm));

        const matchesType = !typeFilterValue || inspection.type === typeFilterValue;
        const matchesStatus = !statusFilterValue || inspection.status === statusFilterValue;

        return matchesSearch && matchesType && matchesStatus;
    });

    renderTable();
    updateFilterStatus();
}

// Clear all filters
function clearAllFilters() {
    if (searchInput) {
        searchInput.value = '';
    }
    if (typeFilter) {
        typeFilter.value = '';
    }
    if (statusFilter) {
        statusFilter.value = '';
    }

    currentFilters = {
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
        (statusFilter?.value || '');

    if (hasActiveFilters) {
        filterStatusEl.textContent = 'On';
        filterStatusEl.className = 'px-2 py-1 text-sm font-semibold rounded-full bg-green-200 text-green-800';
    } else {
        filterStatusEl.textContent = 'Off';
        filterStatusEl.className = 'px-2 py-1 text-sm font-semibold rounded-full bg-gray-200 text-gray-700';
    }
}

// Get inspection status
function getInspectionStatus(nextDueDate, inspectionDate) {
    if (!nextDueDate) return 'No Inspection';

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time for accurate day calculation
        
        const dueDate = new Date(nextDueDate);
        dueDate.setHours(0, 0, 0, 0);

        // Validate due date
        if (isNaN(dueDate.getTime())) {
            console.warn('Invalid next due date:', nextDueDate);
            return 'Unknown';
        }

        const diffTime = dueDate - today;
        const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysUntilDue < 0) return 'Expired';
        if (daysUntilDue <= 0) return 'Service Due'; // Include today as service due
        return 'Active';

    } catch (error) {
        console.error('Error calculating inspection status:', error, 'Next due date:', nextDueDate);
        return 'Unknown';
    }
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

    try {
        // Handle different date formats that might come from database
        let date;

        // If it's already a valid date string, use it directly
        if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
            date = new Date(dateString + 'T00:00:00.000Z'); // Assume UTC for database dates
        } else {
            date = new Date(dateString);
        }

        // Check if date is valid
        if (isNaN(date.getTime())) {
            console.warn('Invalid date string:', dateString);
            return dateString; // Return original string if parsing fails
        }

        return date.toLocaleDateString('en-GB'); // DD/MM/YYYY format
    } catch (error) {
        console.error('Error formatting date:', error, 'Input:', dateString);
        return dateString; // Return original string on error
    }
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
    clearInputs([extinguisherInput, extinguisherType, extinguisherLocation, refilledDate, expiryDate, capacity, checkedBy, verifiedBy]);
    
    // Setup location autocomplete
    setupLocationAutocomplete();
    
    // Leave all dates empty for user to fill manually
    // Users should enter actual inspection date, expiry date, and next due date
    
    // Add event listener to automatically calculate next due date when inspection date is selected
    const inspectionDateField = document.getElementById('inspectionDate');
    const nextDueDateField = document.getElementById('nextDueDate');
    
    if (inspectionDateField && nextDueDateField) {
        inspectionDateField.addEventListener('change', function() {
            const inspectionDate = new Date(this.value);
            if (inspectionDate && !isNaN(inspectionDate.getTime())) {
                // Calculate next due date as 30 days from inspection date (or 31 if current month has 31 days)
                const currentMonth = inspectionDate.getMonth();
                const currentYear = inspectionDate.getFullYear();
                const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
                
                const nextDueDate = new Date(inspectionDate);
                nextDueDate.setDate(nextDueDate.getDate() + (daysInMonth === 31 ? 31 : 30));
                
                // Format date as YYYY-MM-DD for input field
                const formattedDate = nextDueDate.toISOString().split('T')[0];
                nextDueDateField.value = formattedDate;
            }
        });
    }
    
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
        showToast('Please enter a Fire Extinguisher number.', 'warning');
        return;
    }
    
    // Check if extinguisher number format is valid (numeric)
    const extinguisherPattern = /^\d+$/;
    if (!extinguisherPattern.test(inspectionData.extinguisher_no.trim())) {
        showToast('Please enter a valid Fire Extinguisher number (numeric).', 'warning');
        return;
    }
    
    // Check if number is positive
    const extinguisherNum = parseInt(inspectionData.extinguisher_no.trim());
    if (extinguisherNum < 0) {
        showToast('Fire Extinguisher number must be positive.', 'warning');
        return;
    }

    // Validate type
    if (!inspectionData.type || !inspectionData.type.trim()) {
        showToast('Please select a fire extinguisher.', 'warning');
        return;
    }

    // Validate location
    if (!inspectionData.location || !inspectionData.location.trim()) {
        showToast('Please enter a location.', 'warning');
        return;
    }

    // Validate expiry date
    if (!inspectionData.expiry_date) {
        showToast('Please select an expiry date.', 'warning');
        return;
    }

    // Validate inspection dates
    if (inspectionData.inspection_date && inspectionData.next_due_date) {
        const inspDate = new Date(inspectionData.inspection_date);
        const dueDate = new Date(inspectionData.next_due_date);
        
        if (dueDate <= inspDate) {
            showToast('Next Due Date must be after the Inspection Date.', 'warning');
            return;
        }
    }

    // Validate refill/expiry dates
    if (inspectionData.refilled_date && inspectionData.expiry_date) {
        const refill = new Date(inspectionData.refilled_date);
        const expiry = new Date(inspectionData.expiry_date);
        
        if (expiry <= refill) {
            showToast('Expiry Date must be after the Refilled Date.', 'warning');
            return;
        }
    }

    // Validate capacity
    if (!inspectionData.capacity || inspectionData.capacity <= 0) {
        showToast('Please enter a valid capacity.', 'warning');
        return;
    }

    // Validate inspector
    if (!inspectionData.inspector || !inspectionData.inspector.trim()) {
        showToast('Please enter the name of the inspector.', 'warning');
        return;
    }

    try {
            // Add new inspection
            await addInspection(inspectionData);
        
        closeInspectionModal();
        await loadFireExtinguisherInspections(); // Reload data
        showToast('Inspection record added successfully!', 'success');
    } catch (error) {
        console.error('Error saving inspection:', error);
        showToast('Error saving inspection. Please try again.', 'error');
    }
}

// Add new inspection
async function addInspection(inspectionData) {
    // Convert numeric input to database format (e.g., "01" -> "FE-001")
    const numericValue = inspectionData.extinguisher_no.trim();
    const databaseFormat = `FE-${numericValue.padStart(3, '0')}`;
    
    
    // Find the extinguisher by extinguisher number (database format)
    let extinguisher = allExtinguishers.find(e => e.extinguisher_no === databaseFormat);
    
    if (!extinguisher) {
        // Try to find by just the numeric value (in case database uses different format)
        extinguisher = allExtinguishers.find(e => e.extinguisher_no === numericValue || e.extinguisher_no === databaseFormat);
        
        if (!extinguisher) {
            // Create a new Fire Extinguisher if it doesn't exist
            
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
        .update({ 
            inspection_data: updatedInspectionData,
            type_of_extinguisher: inspectionData.type,
            location: inspectionData.location,
            capacity: inspectionData.capacity
        })
        .eq('id', extinguisherId);

    if (updateError) throw updateError;
}



// View inspection details - Navigate to form page
function viewInspection(id) {
    const inspection = allInspections.find(i => String(i.id) === String(id));
    if (!inspection) return;

    // Navigate to the Fire Extinguisher Inspection Form page
    // Pass the extinguisher ID as a URL parameter
    window.location.href = `fire-extinguisher-inspection-form.html?extinguisher_id=${inspection.extinguisher_id}&extinguisher_no=${inspection.extinguisher_no}`;
}

// Make function globally available for onclick handlers
window.viewInspection = viewInspection;

// Add inspection for specific extinguisher
function addInspectionForExtinguisher(extinguisherId, extinguisherNo) {
    // Find the extinguisher data
    const extinguisher = allExtinguishers.find(e => String(e.id) === String(extinguisherId));
    
    if (!extinguisher) {
        console.error('Extinguisher not found for ID:', extinguisherId);
        return;
    }

    // Open the add inspection modal
    openAddInspectionModal();
    
    // Pre-populate the extinguisher fields immediately
    // Convert FE number from database format (FE-001) to display format (1)
    let numericValue = extinguisher.extinguisher_no;
    if (extinguisher.extinguisher_no.includes('FE-')) {
        numericValue = extinguisher.extinguisher_no.replace('FE-', '').replace(/^0+/, '') || '0';
    } else if (extinguisher.extinguisher_no.match(/^\d+$/)) {
        numericValue = extinguisher.extinguisher_no.replace(/^0+/, '') || '0';
    }
    
    setInputValue(extinguisherInput, numericValue);
    setInputValue(extinguisherType, extinguisher.type_of_extinguisher || '');
    setInputValue(extinguisherLocation, extinguisher.location || '');
    setInputValue(capacity, extinguisher.capacity || '');

    // Pre-populate refilled and expiry dates from latest inspection if available
    try {
        let latestRefilled = '';
        let latestExpiry = '';
        
        if (extinguisher.inspection_data && Array.isArray(extinguisher.inspection_data.inspections) && extinguisher.inspection_data.inspections.length > 0) {
            // Sort to find truly latest record
            const sortedInspections = [...extinguisher.inspection_data.inspections]
                .filter(i => i && (i.date || i.refilled_date || i.expiry_date))
                .sort((a, b) => new Date(b.date || b.refilled_date || b.expiry_date) - new Date(a.date || a.refilled_date || a.expiry_date));

            if (sortedInspections.length > 0) {
                const latest = sortedInspections[0];
                if (latest.refilled_date) latestRefilled = String(latest.refilled_date).split('T')[0];
                if (latest.expiry_date) latestExpiry = String(latest.expiry_date).split('T')[0];
            }
        }

        if (refilledDate) refilledDate.value = latestRefilled;
        if (expiryDate) expiryDate.value = latestExpiry;
        
    } catch (e) {
        console.error('Error pre-populating dates:', e);
    }
    
    if (modalTitle) modalTitle.textContent = 'Add Inspection Record';
}

// Make function globally available for onclick handlers
window.addInspectionForExtinguisher = addInspectionForExtinguisher;



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
function openDeleteSelectionModal(extinguisherId, extinguisherNo) {
    currentDeleteExtinguisherId = extinguisherId;
    currentDeleteExtinguisherNo = extinguisherNo;
    selectedInspectionsToDelete = [];
    
    // Find the extinguisher data
    const extinguisher = allExtinguishers.find(e => String(e.id) === String(extinguisherId));
    if (!extinguisher || !extinguisher.inspection_data || !extinguisher.inspection_data.inspections) {
        showToast('No inspection records found for this Fire Extinguisher.', 'warning');
        return;
    }
    
    const inspections = extinguisher.inspection_data.inspections;
    if (inspections.length === 0) {
        showToast('No inspection records found for this Fire Extinguisher.', 'warning');
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
                            <input type="checkbox" id="selectAll" style="margin-right: 5px;">
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
    
    // Add event listeners to checkboxes after modal is displayed
    setTimeout(() => {
        const inspectionCheckboxes = document.querySelectorAll('#deleteSelectionContent input[type="checkbox"]:not(#selectAll)');
        inspectionCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', updateSelectedInspections);
        });
        
        const selectAllCheckbox = document.getElementById('selectAll');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', toggleSelectAll);
        }
    }, 100);
}

// Toggle select all checkboxes
function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAll');
    const inspectionCheckboxes = document.querySelectorAll('#deleteSelectionContent input[type="checkbox"]:not(#selectAll)');
    
    inspectionCheckboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
    
    updateSelectedInspections();
}

// Update selected inspections array
function updateSelectedInspections() {
    
    const inspectionCheckboxes = document.querySelectorAll('#deleteSelectionContent input[type="checkbox"]:not(#selectAll)');
    
    selectedInspectionsToDelete = [];
    
    inspectionCheckboxes.forEach((checkbox, index) => {
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
function closeDeleteSelectionModal() {
    document.getElementById('deleteSelectionModal').style.display = 'none';
    currentDeleteExtinguisherId = null;
    currentDeleteExtinguisherNo = null;
    selectedInspectionsToDelete = [];
}

// Confirm and delete selected inspections
async function confirmDeleteSelected() {
    
    if (selectedInspectionsToDelete.length === 0) {
        showToast('Please select at least one inspection record to delete.', 'warning');
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
        const { data: updateData, error: updateError } = await supabase
            .from('fire_extinguishers')
            .update({ 
                inspection_data: {
                    ...currentData.inspection_data, // Preserve other metadata
                    inspections: updatedInspectionData.inspections
                }
            })
            .eq('id', currentDeleteExtinguisherId)
            .select();
            
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
            showToast(successMessage, 'success');
        }
        
    } catch (error) {
        console.error('Error deleting inspections:', error);
        showToast('Error deleting inspection records. Please try again.', 'error');
    }
}

// Delete individual inspection record
async function deleteInspectionRecord(inspectionId, extinguisherNo) {
    if (confirm(`Are you sure you want to delete this inspection record for ${extinguisherNo}?`)) {
        try {

            const inspection = allInspections.find(i => String(i.id) === String(inspectionId));
            if (!inspection) {
                showToast('Inspection record not found.', 'error');
                return;
            }

            // Get current inspection data
            const { data: currentData, error: fetchError } = await supabase
                .from('fire_extinguishers')
                .select('inspection_data')
                .eq('id', inspection.extinguisher_id)
                .single();

            if (fetchError) throw fetchError;

            // Remove the specific inspection from the array using the unique inspection ID
            const updatedInspectionData = currentData.inspection_data || { inspections: [] };
            updatedInspectionData.inspections = updatedInspectionData.inspections || [];

            // Find and remove the inspection - try unique ID first, then fall back to field matching
            let inspectionIndex = -1;
            
            if (inspection.inspection_id) {
                // Use unique ID if available
                inspectionIndex = updatedInspectionData.inspections.findIndex(insp => insp.id === inspection.inspection_id);
            }
            
            if (inspectionIndex === -1) {
                // Fall back to field matching for backward compatibility
                inspectionIndex = updatedInspectionData.inspections.findIndex(insp =>
                    insp.date === inspection.inspection_date &&
                    insp.inspector === inspection.inspector &&
                    insp.next_due_date === inspection.next_due_date
                );
            }

            if (inspectionIndex !== -1) {
                updatedInspectionData.inspections.splice(inspectionIndex, 1);
            } else {
                showToast('Inspection record not found in database.', 'error');
                return;
            }

            // Update the database
            const { data: updateData, error: updateError } = await supabase
                .from('fire_extinguishers')
                .update({ 
                    inspection_data: {
                        ...currentData.inspection_data, // Preserve other metadata
                        inspections: updatedInspectionData.inspections 
                    }
                })
                .eq('id', inspection.extinguisher_id)
                .select();

            if (updateError) throw updateError;

            // Reload the data and show success message
            await loadFireExtinguisherInspections();
            showToast(`Inspection record for ${extinguisherNo} deleted successfully!`, 'success');
        } catch (error) {
            console.error('Error deleting inspection:', error);
            showToast('Error deleting inspection record. Please try again.', 'error');
        }
    }
}

// Make function globally available for onclick handlers
window.deleteInspectionRecord = deleteInspectionRecord;

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
function editFireExtinguisher(extinguisherId, extinguisherNo) {
    
    // Find the extinguisher data
    const extinguisher = allExtinguishers.find(e => String(e.id) === String(extinguisherId));
    if (!extinguisher) {
        showToast('Fire extinguisher not found.', 'error');
        return;
    }
    
    // Open edit modal with pre-filled data
    openEditExtinguisherModal(extinguisher);
};

// Make function globally available for onclick handlers
window.editFireExtinguisher = editFireExtinguisher;

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
function closeEditExtinguisherModal() {
    const modal = document.getElementById('editExtinguisherModal');
    modal.style.display = 'none';
};

// Handle Edit Extinguisher Form Submit
async function handleEditExtinguisherSubmit(event) {
    event.preventDefault();
    
    let rawNo = document.getElementById('editExtinguisherNo').value.trim();
    // Normalize format to FE-000
    if (rawNo && !rawNo.startsWith('FE-')) {
        rawNo = `FE-${rawNo.padStart(3, '0')}`;
    }

    const formData = {
        id: document.getElementById('editExtinguisherId').value,
        extinguisher_no: rawNo,
        type_of_extinguisher: document.getElementById('editExtinguisherType').value,
        location: document.getElementById('editLocation').value,
        capacity: document.getElementById('editCapacity').value
    };

    // Basic validation
    if (!formData.extinguisher_no) {
        showToast('Fire Extinguisher number is required.', 'warning');
        return;
    }
    if (!formData.type_of_extinguisher) {
        showToast('Type is required.', 'warning');
        return;
    }
    if (!formData.location) {
        showToast('Location is required.', 'warning');
        return;
    }
    
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
        await loadFireExtinguisherInspections();
        showToast('Fire extinguisher updated successfully!', 'success');
        
    } catch (error) {
        console.error('Error updating fire extinguisher:', error);
        showToast('Error updating fire extinguisher. Please try again.', 'error');
    }
}

// Add New Fire Extinguisher functions
function openAddNewExtinguisherModal() {
    const modal = document.getElementById('addNewExtinguisherModal');
    const form = document.getElementById('addNewExtinguisherForm');
    
    // Clear form fields
    form.reset();
    
    // Show modal
    modal.style.display = 'block';
    
    // Add form submit handler
    form.onsubmit = handleAddNewExtinguisherSubmit;
};

function closeAddNewExtinguisherModal() {
    const modal = document.getElementById('addNewExtinguisherModal');
    modal.style.display = 'none';
};

// Handle Add New Extinguisher Form Submit
async function handleAddNewExtinguisherSubmit(event) {
    event.preventDefault();
    
    let rawNo = document.getElementById('newExtinguisherNo').value.trim();
    if (!rawNo) {
        showToast('Fire Extinguisher number is required.', 'warning');
        return;
    }

    // Normalize format to FE-000
    if (!rawNo.startsWith('FE-')) {
        // If it's just a number, pad it
        if (/^\d+$/.test(rawNo)) {
            rawNo = `FE-${rawNo.padStart(3, '0')}`;
        }
    }

    const formData = {
        extinguisher_no: rawNo,
        type_of_extinguisher: document.getElementById('newExtinguisherType').value,
        location: document.getElementById('newLocation').value,
        capacity: document.getElementById('newCapacity').value
    };

    if (!formData.type_of_extinguisher) {
        showToast('Type is required.', 'warning');
        return;
    }
    if (!formData.location) {
        showToast('Location is required.', 'warning');
        return;
    }
    
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
        await loadFireExtinguisherInspections();
        showToast('New fire extinguisher added successfully!', 'success');
        
    } catch (error) {
        console.error('Error adding new fire extinguisher:', error);
        showToast('Error adding new fire extinguisher. Please try again.', 'error');
    }
}

// Make functions globally available
window.viewInspection = viewInspection;
window.deleteInspectionRecord = deleteInspectionRecord;
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

// Make function globally available for onclick handlers
window.openDeleteOptionsModal = openDeleteOptionsModal;

function closeDeleteOptionsModal() {
    const modal = document.getElementById('deleteOptionsModal');
    modal.style.display = 'none';
    currentDeleteOptionsExtinguisherId = null;
    currentDeleteOptionsExtinguisherNo = null;
}

// Delete entire fire extinguisher
async function deleteEntireExtinguisher() {
    if (!currentDeleteOptionsExtinguisherId) return;
    
    if (!confirm(`Are you sure you want to delete the entire fire extinguisher ${currentDeleteOptionsExtinguisherNo}? This will remove it completely from the system.`)) {
        return;
    }

    try {
        
        const { data, error } = await supabase
            .from('fire_extinguishers')
            .delete()
            .eq('id', currentDeleteOptionsExtinguisherId)
            .select();
        
        if (error) throw error;
        
        closeDeleteOptionsModal();
        await loadFireExtinguisherInspections();
        showToast(`Fire extinguisher ${currentDeleteOptionsExtinguisherNo} deleted successfully!`, 'success');
        
    } catch (error) {
        console.error('Error deleting fire extinguisher:', error);
        showToast('Error deleting fire extinguisher. Please try again.', 'error');
    }
};

// Clear inspection data modal functions
function openClearInspectionDataModal() {
    if (!currentDeleteOptionsExtinguisherId) return;
    
    // Fetch current data from database instead of using potentially stale local data
    supabase
        .from('fire_extinguishers')
        .select('inspection_data')
        .eq('id', currentDeleteOptionsExtinguisherId)
        .single()
        .then(({ data: extinguisher, error }) => {
            if (error) {
                console.error('Error fetching extinguisher data:', error);
                showToast('Error loading inspection data.', 'error');
                return;
            }
            
            if (!extinguisher || !extinguisher.inspection_data || !extinguisher.inspection_data.inspections || extinguisher.inspection_data.inspections.length === 0) {
                showToast('No inspection data found for this extinguisher.', 'warning');
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
                        <div style="font-weight: 600; color: #374151; font-size: 13px;">Inspection Date: ${formatDate(inspection.date)}</div>
                        <div style="font-size: 12px; color: #6b7280;">Inspector: ${inspection.inspector || 'N/A'}</div>
                        <div style="font-size: 12px; color: #6b7280;">Remarks: ${inspection.remarks || 'N/A'}</div>
                    </div>
                `;
                
                inspectionListElement.appendChild(inspectionDiv);
            });
            
            // Store the extinguisher ID before closing the delete options modal
            const extinguisherIdToClear = currentDeleteOptionsExtinguisherId;
            
            // Close the delete options modal and open the clear data modal
            closeDeleteOptionsModal();
            
            // Set the ID for the clear modal
            currentDeleteOptionsExtinguisherId = extinguisherIdToClear;
            
            // Add event listeners to buttons
            const clearButton = document.getElementById('clearSelectedButton');
            if (clearButton) {
                clearButton.addEventListener('click', confirmClearSelectedInspections);
            }
            
            modal.style.display = 'block';
        })
        .catch(error => {
            console.error('Error in openClearInspectionDataModal:', error);
            showToast('Error loading inspection data.', 'error');
        });
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
        showToast('Please select at least one inspection record to clear.', 'warning');
        return;
    }

    if (!confirm(`Are you sure you want to clear ${selectedInspectionsToClear.length} selected inspection record(s)?`)) {
        return;
    }

    try {
        // Get current inspection data from database
        const { data: currentData, error: fetchError } = await supabase
            .from('fire_extinguishers')
            .select('inspection_data')
            .eq('id', currentDeleteOptionsExtinguisherId)
            .single();

        if (fetchError) throw fetchError;

        if (!currentData || !currentData.inspection_data || !Array.isArray(currentData.inspection_data.inspections)) {
            throw new Error('Extinguisher inspection data not found in database');
        }
        
        // Remove selected inspections by index
        const updatedInspections = currentData.inspection_data.inspections.filter((_, index) => 
            !selectedInspectionsToClear.includes(index)
        );
        
        // Simple direct update - just update inspection_data
        const { error } = await supabase
            .from('fire_extinguishers')
            .update({ 
                inspection_data: {
                    inspections: updatedInspections
                }
            })
            .eq('id', currentDeleteOptionsExtinguisherId);

        console.log('Update error:', error);
        
        if (error) {
            console.error('Update error details:', error);
            throw new Error(`Database update failed: ${error.message}`);
        }
        
        console.log('Update successful! Now verifying...');
        
        // Verify the update was successful by fetching fresh data
        const { data: verifyData, error: verifyError } = await supabase
            .from('fire_extinguishers')
            .select('inspection_data')
            .eq('id', currentDeleteOptionsExtinguisherId)
            .single();
        
        if (verifyError) {
            throw new Error(`Verification failed: ${verifyError.message}`);
        }
        
        console.log('Verification data:', verifyData);
        console.log('New inspection count:', verifyData.inspection_data.inspections.length);
        
        const clearedCount = selectedInspectionsToClear.length;
        const finalClearedCount = clearedCount;
        
        closeClearInspectionDataModal();
        await loadFireExtinguisherInspections();
        showToast(`${finalClearedCount} inspection record(s) cleared successfully!`, 'success');
        
    } catch (error) {
        console.error('Error clearing inspection data:', error);
        showToast('Error clearing inspection data. Please try again.', 'error');
    }
};

// Download QR Code function
window.downloadQRCodes = async function() {
    if (!currentDeleteOptionsExtinguisherId || !currentDeleteOptionsExtinguisherNo) {
        showToast('No extinguisher selected for QR code generation.', 'warning');
        return;
    }

    // Create the inspection form URL with extinguisher parameters
    // Use production URL for QR codes so they work when scanned from mobile
    const productionUrl = 'https://swanson-india-portal.vercel.app';
    const baseUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
        ? productionUrl 
        : window.location.origin;
    
    // The files are located in the /html/ directory relative to the root
    const inspectionUrl = `${baseUrl}/html/fire-extinguisher-inspection-form.html?extinguisher_id=${currentDeleteOptionsExtinguisherId}&extinguisher_no=${encodeURIComponent(currentDeleteOptionsExtinguisherNo)}`;

    // Format extinguisher number (e.g., "FE-001" -> "01")
    let formattedExtinguisherNo = 'Unknown';
    if (currentDeleteOptionsExtinguisherNo && currentDeleteOptionsExtinguisherNo.startsWith('FE-')) {
        const numPart = currentDeleteOptionsExtinguisherNo.substring(3); // Get "001" from "FE-001"
        const num = parseInt(numPart, 10); // Convert to integer: 1
        formattedExtinguisherNo = String(num).padStart(2, '0'); // Format as "01"
    }

    // Get location from database
    let location = 'Unknown Location';
    // Find the button inside the modal and update text
    const buttons = document.querySelectorAll('#deleteOptionsModal button');
    let qrButton = null;
    buttons.forEach(btn => {
        if (btn.textContent.includes('Download QR Code')) {
            qrButton = btn;
        }
    });

    // Save original content
    const originalContent = qrButton ? qrButton.innerHTML : '';
    
    // Set loading state with spinner
    if (qrButton) {
        qrButton.innerHTML = `
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Downloading...
        `;
        qrButton.disabled = true;
        qrButton.style.opacity = '0.7';
        qrButton.style.cursor = 'not-allowed';
        qrButton.style.display = 'flex';
        qrButton.style.alignItems = 'center';
        qrButton.style.justifyContent = 'center';
    }

    try {
        const { data: extinguisher, error } = await supabase
            .from('fire_extinguishers')
            .select('location')
            .eq('id', currentDeleteOptionsExtinguisherId)
            .single();

        if (!error && extinguisher && extinguisher.location) {
            location = extinguisher.location;
        }
    } catch (error) {
        console.error('Error fetching location:', error);
    }

    // Create QR code with text below it using a canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Set canvas size (QR code + text space)
    canvas.width = 400;
    canvas.height = 550;

    // Fill background with white
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Create QR code image
    const qrImage = new Image();
    qrImage.crossOrigin = 'anonymous';

    qrImage.onload = function() {
        // Draw border
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

        // Draw QR code in center
        const qrSize = 300;
        const qrX = (canvas.width - qrSize) / 2;
        const qrY = 20;
        ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

        // Add text below QR code
        ctx.fillStyle = 'black';
        ctx.font = 'bold 28px Arial'; // Increased from 24px
        ctx.textAlign = 'center';

        // Add "Fire Extinguisher" text
        ctx.fillText('Fire Extinguisher', canvas.width / 2, qrY + qrSize + 40);

        // Add extinguisher number
        ctx.font = 'bold 24px Arial'; // Increased from 20px
        ctx.fillText(`No. ${formattedExtinguisherNo}`, canvas.width / 2, qrY + qrSize + 75);

        // Add location with word wrap
        ctx.font = 'bold 20px Arial'; // Increased from 16px
        const maxWidth = canvas.width - 40; // 40px margins
        const lineHeight = 25;
        const locationY = qrY + qrSize + 110;
        
        // Wrap location text
        const words = location.split(' ');
        let line = '';
        let y = locationY;
        
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            
            if (testWidth > maxWidth && n > 0) {
                ctx.fillText(line, canvas.width / 2, y);
                line = words[n] + ' ';
                y += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, canvas.width / 2, y);

        // Convert canvas to blob and download
        canvas.toBlob(function(blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `fire-extinguisher-${formattedExtinguisherNo}-qr.png`;
            link.click();
            URL.revokeObjectURL(url);
            
            // Restore button state
            if (qrButton) {
                qrButton.innerHTML = originalContent;
                qrButton.disabled = false;
                qrButton.style.opacity = '1';
                qrButton.style.cursor = 'pointer';
            }
        }, 'image/png');
    };

    // Handle QR code loading error
    qrImage.onerror = function() {
        showToast('Error generating QR code. Please try again.', 'error');
        
        // Restore button state
        if (qrButton) {
            qrButton.innerHTML = originalContent;
            qrButton.disabled = false;
            qrButton.style.opacity = '1';
            qrButton.style.cursor = 'pointer';
        }
    };

    // Load QR code image
    qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(inspectionUrl)}`;
};

// Download All QR Codes function
window.downloadAllQRCodes = async function() {
    const downloadBtn = document.querySelector('button[onclick="downloadAllQRCodes()"]');
    const originalContent = downloadBtn ? downloadBtn.innerHTML : '';

    if (downloadBtn) {
        downloadBtn.innerHTML = `
            <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Generating PDF...
        `;
        downloadBtn.disabled = true;
        downloadBtn.style.opacity = '0.7';
    }

    try {
        // Fetch all extinguishers from Supabase
        const { data: extinguishers, error } = await supabase
            .from('fire_extinguishers')
            .select('*')
            .order('extinguisher_no', { ascending: true });

        if (error) throw error;
        if (!extinguishers || extinguishers.length === 0) {
            showToast('No fire extinguishers found to generate QR codes.', 'warning');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;
        const cols = 3;
        const rows = 4;
        const qrPerBatch = cols * rows;
        
        const cellWidth = (pageWidth - (2 * margin)) / cols;
        const cellHeight = (pageHeight - (2 * margin)) / rows;
        const qrSize = 40; // Increased size for 3x4 grid

        for (let i = 0; i < extinguishers.length; i++) {
            if (i > 0 && i % qrPerBatch === 0) {
                doc.addPage();
            }

            const ext = extinguishers[i];
            const pageIdx = i % qrPerBatch;
            const col = pageIdx % cols;
            const row = Math.floor(pageIdx / cols);

            const x = margin + (col * cellWidth);
            const y = margin + (row * cellHeight);

            // Draw border box for each QR code
            const boxPadding = 2;
            doc.setDrawColor(0); // Black color
            doc.setLineWidth(0.1);
            doc.rect(x + boxPadding, y + boxPadding, cellWidth - (boxPadding * 2), cellHeight - (boxPadding * 2));

            // Generate inspection URL
            // Use production URL for QR codes so they work when scanned from mobile
            const productionUrl = 'https://swanson-india-portal.vercel.app';
            const baseUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
                ? productionUrl 
                : window.location.origin;
            
            const inspectionUrl = `${baseUrl}/html/fire-extinguisher-inspection-form.html?extinguisher_id=${ext.id}&extinguisher_no=${encodeURIComponent(ext.extinguisher_no)}`;

            // Use qrcode-generator to create QR code data URL
            const typeNumber = 0;
            const errorCorrectionLevel = 'H';
            const qr = qrcode(typeNumber, errorCorrectionLevel);
            qr.addData(inspectionUrl);
            qr.make();
            const qrDataUrl = qr.createDataURL(4);

            // Draw QR Code
             const qrX = x + (cellWidth - qrSize) / 2;
             const qrY = y + 5;
             doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
 
             // Add Text below QR
             doc.setFontSize(10); // Increased from 8
             doc.setFont('helvetica', 'bold');
             doc.text('Fire Extinguisher', x + cellWidth / 2, qrY + qrSize + 5, { align: 'center' });
             
             // Format extinguisher number (e.g., "FE-001" -> "No. 01")
             let displayNo = ext.extinguisher_no;
             if (displayNo && displayNo.startsWith('FE-')) {
                 const numPart = displayNo.substring(3);
                 const num = parseInt(numPart, 10);
                 displayNo = `No. ${String(num).padStart(2, '0')}`;
             }
 
             doc.setFontSize(12); // Increased from 10
             doc.text(displayNo, x + cellWidth / 2, qrY + qrSize + 11, { align: 'center' });
 
             doc.setFontSize(9); // Increased from 7
             doc.setFont('helvetica', 'normal');
             const locationText = ext.location || 'No Location';
             const splitLocation = doc.splitTextToSize(locationText, cellWidth - 4);
             doc.text(splitLocation, x + cellWidth / 2, qrY + qrSize + 16, { align: 'center' });
        }

        doc.save('All_Fire_Extinguisher_QR_Codes.pdf');

        // Show success toast for PDF download
        showToast('All Fire Extinguisher QR Codes downloaded successfully!', 'success');

    } catch (error) {
        console.error('Error generating PDF:', error);
        showToast('Error generating PDF. Please try again.', 'error');
    } finally {
        if (downloadBtn) {
            downloadBtn.innerHTML = originalContent;
            downloadBtn.disabled = false;
            downloadBtn.style.opacity = '1';
        }
    }
};
