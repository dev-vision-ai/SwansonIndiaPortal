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
let editingInspectionId = null;

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
const formDate = document.getElementById('formDate');
const refilledDate = document.getElementById('refilledDate');
const expiryDate = document.getElementById('expiryDate');
const capacity = document.getElementById('capacity');
const checkedBy = document.getElementById('checkedBy');
const verifiedBy = document.getElementById('verifiedBy');

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
            window.location.href = 'fire_extinguisher_mgmt.html';
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
    });
}

// Load fire extinguishers for dropdown
async function loadFireExtinguishers() {
    try {
        const { data: extinguishers, error } = await supabase
            .from('fire_extinguishers')
            .select('id, extinguisher_no, type_of_extinguisher, location')
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
            if (extinguisher.inspection_data && extinguisher.inspection_data.inspections) {
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
            <td colspan="18" style="text-align: center; padding: 40px; color: #666; font-style: italic;">
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
            <td>${inspection.extinguisher_no || ''}</td>
            <td>${inspection.type || ''}</td>
            <td>${inspection.location || ''}</td>
            <td>${inspection.capacity || ''} kg</td>
            <td>${formatDate(inspection.expiry_date)}</td>
            <td>${formatDate(inspection.inspection_date)}</td>
            <td>${formatDate(inspection.next_due_date)}</td>
            <td>${inspection.inspector || ''}</td>
            <td>${formatInspectionResult(inspection.pin_seal)}</td>
            <td>${formatInspectionResult(inspection.pressure)}</td>
            <td>${formatInspectionResult(inspection.hose_nozzle)}</td>
            <td>${formatInspectionResult(inspection.handle_knob)}</td>
            <td>${formatInspectionResult(inspection.dent_rust_leak)}</td>
            <td>${formatInspectionResult(inspection.easy_access)}</td>
            <td><span class="status-badge status-${inspection.status.toLowerCase().replace(' ', '-')}">${inspection.status}</span></td>
            <td>${inspection.remarks || ''}</td>
            <td class="action-buttons">
                <button onclick="viewInspection(${inspection.id})" class="btn-small btn-view" title="View Details">
                    <i class="bi bi-eye"></i>
                </button>
                <button onclick="editInspection(${inspection.id})" class="btn-small btn-edit" title="Edit">
                    <i class="bi bi-pencil"></i>
                </button>
                <button onclick="deleteInspection(${inspection.id})" class="btn-small btn-delete" title="Delete">
                <i class="bi bi-trash"></i>
            </button>
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
    editingInspectionId = null;
    modalTitle.textContent = 'Add New Inspection Record';
    inspectionForm.reset();
    
    // Clear manual input fields
    if (extinguisherInput) extinguisherInput.value = '';
    if (extinguisherType) extinguisherType.value = '';
    if (extinguisherLocation) extinguisherLocation.value = '';
    if (formDate) formDate.value = '';
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
    if (formDate) formDate.value = today;
    
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
    editingInspectionId = null;
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
        form_date: formDate.value,
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

    // Validate form date
    if (!inspectionData.form_date) {
        showErrorMessage('Please select a form date.');
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
        if (editingInspectionId) {
            // Update existing inspection
            await updateInspection(editingInspectionId, inspectionData);
        } else {
            // Add new inspection
            await addInspection(inspectionData);
        }
        
        closeInspectionModal();
        await loadFireExtinguisherInspections(); // Reload data
        showSuccessMessage(editingInspectionId ? 'Inspection record updated successfully!' : 'Inspection record added successfully!');
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
        form_date: inspectionData.form_date,
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

// Update existing inspection (placeholder - would need more complex logic)
async function updateInspection(inspectionId, inspectionData) {
    // This would require more complex logic to update specific inspection records
    // For now, we'll just add a new inspection
    await addInspection(inspectionData);
}

// View inspection details
function viewInspection(id) {
    const inspection = allInspections.find(i => i.id === id);
    if (!inspection) return;

    const details = `
Fire Extinguisher Details:
• Extinguisher No: ${inspection.extinguisher_no}
• Type: ${inspection.type}
• Location: ${inspection.location}
• Capacity: ${inspection.capacity || 'N/A'} kg
• Form Date: ${formatDate(inspection.form_date)}
• Refilled Date: ${inspection.refilled_date ? formatDate(inspection.refilled_date) : 'N/A'}
• Expiry Date: ${formatDate(inspection.expiry_date)}

Inspection Details:
• Inspection Date: ${formatDate(inspection.inspection_date)}
• Next Due Date: ${formatDate(inspection.next_due_date)}
• Inspected By: ${inspection.inspector}
• Status: ${inspection.status}

Inspection Results:
• Pin/Tamper Seal: ${formatInspectionResult(inspection.pin_seal)}
• Pressure: ${formatInspectionResult(inspection.pressure)}
• Hose/Nozzle: ${formatInspectionResult(inspection.hose_nozzle)}
• Handle/Nob: ${formatInspectionResult(inspection.handle_knob)}
• Dent/Rust/Leak: ${formatInspectionResult(inspection.dent_rust_leak)}
• Easy Access: ${formatInspectionResult(inspection.easy_access)}

Verification:
• Checked By: ${inspection.checked_by || 'N/A'}
• Verified By: ${inspection.verified_by || 'N/A'}

Remarks: ${inspection.remarks || 'None'}
    `;

    alert(details);
}

// Edit inspection
function editInspection(id) {
    const inspection = allInspections.find(i => i.id === id);
    if (!inspection) return;

    editingInspectionId = id;
    modalTitle.textContent = 'Edit Inspection Record';
    
    // Populate form fields
    // Convert database format to numeric display (e.g., "FE-001" -> "01" or "1" -> "1")
    let numericValue = inspection.extinguisher_no;
    if (inspection.extinguisher_no.includes('FE-')) {
        numericValue = inspection.extinguisher_no.replace('FE-', '').replace(/^0+/, '') || '0';
    } else if (inspection.extinguisher_no.match(/^\d+$/)) {
        // If it's already numeric, just remove leading zeros
        numericValue = inspection.extinguisher_no.replace(/^0+/, '') || '0';
    }
    extinguisherInput.value = numericValue;
    extinguisherType.value = inspection.type || '';
    extinguisherLocation.value = inspection.location || '';
    if (formDate) formDate.value = inspection.form_date || '';
    if (refilledDate) refilledDate.value = inspection.refilled_date || '';
    if (expiryDate) expiryDate.value = inspection.expiry_date || '';
    if (capacity) capacity.value = inspection.capacity || '';
    document.getElementById('inspectionDate').value = inspection.inspection_date;
    document.getElementById('nextDueDate').value = inspection.next_due_date;
    document.getElementById('inspector').value = inspection.inspector || '';
    document.getElementById('pinSeal').value = inspection.pin_seal || '✔';
    document.getElementById('pressure').value = inspection.pressure || '✔';
    document.getElementById('hoseNozzle').value = inspection.hose_nozzle || '✔';
    document.getElementById('handleKnob').value = inspection.handle_knob || '✔';
    document.getElementById('dentRustLeak').value = inspection.dent_rust_leak || '✔';
    document.getElementById('easyAccess').value = inspection.easy_access || '✔';
    document.getElementById('remarks').value = inspection.remarks || '';
    if (checkedBy) checkedBy.value = inspection.checked_by || '';
    if (verifiedBy) verifiedBy.value = inspection.verified_by || '';
    
    inspectionModal.style.display = 'block';
}

// Delete inspection
async function deleteInspection(id) {
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
    if (helpTextElement && allExtinguishers.length > 0) {
        const extinguisherNumbers = allExtinguishers.map(e => e.extinguisher_no).sort();
        helpTextElement.textContent = `Existing: ${extinguisherNumbers.join(', ')} | Enter any number 00-99 to create new`;
    } else if (helpTextElement) {
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



// Make functions globally available
window.viewInspection = viewInspection;
window.editInspection = editInspection;
window.deleteInspection = deleteInspection;
window.openAddInspectionModal = openAddInspectionModal;
window.closeInspectionModal = closeInspectionModal;
