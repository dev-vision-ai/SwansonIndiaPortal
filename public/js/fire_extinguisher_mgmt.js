import { supabase } from '../supabase-config.js';

// Global variables
let currentEditingId = null;
let allExtinguishers = [];
let filteredExtinguishers = [];
let inspectionRowCount = 0;

// DOM elements
const tableBody = document.getElementById('fireExtinguisherTableBody');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const typeFilter = document.getElementById('typeFilter');
const modal = document.getElementById('extinguisherModal');
const qrModal = document.getElementById('qrModal');
const form = document.getElementById('extinguisherForm');
const inspectionRows = document.getElementById('inspectionRows');

// Statistics elements
const totalExtinguishersEl = document.getElementById('totalExtinguishers');
const activeExtinguishersEl = document.getElementById('activeExtinguishers');
const expiredExtinguishersEl = document.getElementById('expiredExtinguishers');
const serviceDueExtinguishersEl = document.getElementById('serviceDueExtinguishers');

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    await loadUserProfile();
    await loadFireExtinguishers();
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
    // Search and filter
    searchInput.addEventListener('input', filterExtinguishers);
    statusFilter.addEventListener('change', filterExtinguishers);
    typeFilter.addEventListener('change', filterExtinguishers);

    // Form submission
    form.addEventListener('submit', handleFormSubmit);

    // Modal close buttons
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', closeModal);
    });

    // Logout button
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === modal) closeModal();
        if (event.target === qrModal) closeQRModal();
    });
}

// Load fire extinguishers from database
async function loadFireExtinguishers() {
    try {
        const { data, error } = await supabase
            .from('fire_extinguishers')
            .select('*')
            .order('extinguisher_no', { ascending: true });

        if (error) throw error;

        allExtinguishers = data || [];
        filteredExtinguishers = [...allExtinguishers];
        renderTable();
        updateStatistics();
    } catch (error) {
        console.error('Error loading fire extinguishers:', error);
        alert('Error loading fire extinguishers. Please try again.');
    }
}

// Render the table
function renderTable() {
    if (!tableBody) return;

    tableBody.innerHTML = '';

    filteredExtinguishers.forEach(extinguisher => {
        const row = document.createElement('tr');
        
        const status = getExtinguisherStatus(extinguisher);
        const lastInspection = getLastInspectionDate(extinguisher);
        
        row.innerHTML = `
            <td>${extinguisher.extinguisher_no || ''}</td>
            <td>${extinguisher.type_of_extinguisher || ''}</td>
            <td>${extinguisher.capacity || ''}</td>
            <td>${extinguisher.location || ''}</td>
            <td>${formatDate(extinguisher.installation_date)}</td>
            <td>${formatDate(extinguisher.expiry_date)}</td>
            <td><span class="status-badge status-${status.toLowerCase().replace(' ', '-')}">${status}</span></td>
            <td>${lastInspection}</td>
            <td class="action-buttons">
                <button onclick="viewExtinguisher(${extinguisher.id})" class="btn-small btn-view" title="View Details">
                    <i class="bi bi-eye"></i>
                </button>
                <button onclick="editExtinguisher(${extinguisher.id})" class="btn-small btn-edit" title="Edit">
                    <i class="bi bi-pencil"></i>
                </button>
                <button onclick="generateQRCode(${extinguisher.id})" class="btn-small btn-qr" title="Generate QR Code">
                    <i class="bi bi-qr-code"></i>
                </button>
                <button onclick="deleteExtinguisher(${extinguisher.id})" class="btn-small btn-delete" title="Delete">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Filter extinguishers based on search and filters
function filterExtinguishers() {
    const searchTerm = searchInput.value.toLowerCase();
    const statusFilterValue = statusFilter.value;
    const typeFilterValue = typeFilter.value;

    filteredExtinguishers = allExtinguishers.filter(extinguisher => {
        const matchesSearch = 
            (extinguisher.extinguisher_no && extinguisher.extinguisher_no.toLowerCase().includes(searchTerm)) ||
            (extinguisher.location && extinguisher.location.toLowerCase().includes(searchTerm)) ||
            (extinguisher.type_of_extinguisher && extinguisher.type_of_extinguisher.toLowerCase().includes(searchTerm));

        const matchesStatus = !statusFilterValue || getExtinguisherStatus(extinguisher) === statusFilterValue;
        const matchesType = !typeFilterValue || extinguisher.type_of_extinguisher === typeFilterValue;

        return matchesSearch && matchesStatus && matchesType;
    });

    renderTable();
}

// Get extinguisher status
function getExtinguisherStatus(extinguisher) {
    if (!extinguisher.expiry_date) return 'Unknown';
    
    const today = new Date();
    const expiryDate = new Date(extinguisher.expiry_date);
    const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) return 'Expired';
    if (daysUntilExpiry <= 30) return 'Service Due';
    return 'Active';
}

// Get last inspection date
function getLastInspectionDate(extinguisher) {
    if (!extinguisher.inspection_data || !extinguisher.inspection_data.inspections) {
        return 'No inspections';
    }
    
    const inspections = extinguisher.inspection_data.inspections;
    if (inspections.length === 0) return 'No inspections';
    
    // Find the most recent inspection
    const sortedInspections = inspections.sort((a, b) => new Date(b.date) - new Date(a.date));
    return formatDate(sortedInspections[0].date);
}

// Format date
function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
}

// Update statistics
function updateStatistics() {
    const total = allExtinguishers.length;
    const active = allExtinguishers.filter(e => getExtinguisherStatus(e) === 'Active').length;
    const expired = allExtinguishers.filter(e => getExtinguisherStatus(e) === 'Expired').length;
    const serviceDue = allExtinguishers.filter(e => getExtinguisherStatus(e) === 'Service Due').length;

    totalExtinguishersEl.textContent = total;
    activeExtinguishersEl.textContent = active;
    expiredExtinguishersEl.textContent = expired;
    serviceDueExtinguishersEl.textContent = serviceDue;
}

// Open add modal
function openAddModal() {
    currentEditingId = null;
    document.getElementById('modalTitle').textContent = 'Add New Fire Extinguisher';
    form.reset();
    clearInspectionRows();
    addInspectionRow(); // Add one initial row
    modal.style.display = 'block';
}

// Add inspection row
function addInspectionRow() {
    if (!inspectionRows) return;
    
    const rowId = `inspection_${inspectionRowCount++}`;
    const row = document.createElement('div');
    row.className = 'inspection-row';
    row.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr; gap: 8px; margin-bottom: 10px; padding: 10px; border: 1px solid #eee; border-radius: 4px; background-color: #f9f9f9;';
    
    row.innerHTML = `
        <div>
            <label style="font-size: 12px; color: #666;">Inspection Date:</label>
            <input type="date" name="inspection_date_${rowId}" style="width: 100%; padding: 4px; font-size: 12px;">
        </div>
        <div>
            <label style="font-size: 12px; color: #666;">Next Due Date:</label>
            <input type="date" name="next_due_date_${rowId}" style="width: 100%; padding: 4px; font-size: 12px;">
        </div>
        <div>
            <label style="font-size: 12px; color: #666;">Inspected By:</label>
            <input type="text" name="inspector_${rowId}" placeholder="Name/Sign" style="width: 100%; padding: 4px; font-size: 12px;">
        </div>
        <div>
            <label style="font-size: 12px; color: #666;">Pin/Tamper Seal:</label>
            <select name="pin_seal_${rowId}" style="width: 100%; padding: 4px; font-size: 12px;">
                <option value="">-</option>
                <option value="✔">✔ Ok</option>
                <option value="❌">❌ Not Ok</option>
                <option value="NA">NA</option>
            </select>
        </div>
        <div>
            <label style="font-size: 12px; color: #666;">Pressure:</label>
            <select name="pressure_${rowId}" style="width: 100%; padding: 4px; font-size: 12px;">
                <option value="">-</option>
                <option value="✔">✔ Ok</option>
                <option value="❌">❌ Not Ok</option>
                <option value="NA">NA</option>
            </select>
        </div>
        <div>
            <label style="font-size: 12px; color: #666;">Hose/Nozzle:</label>
            <select name="hose_nozzle_${rowId}" style="width: 100%; padding: 4px; font-size: 12px;">
                <option value="">-</option>
                <option value="✔">✔ Ok</option>
                <option value="❌">❌ Not Ok</option>
                <option value="NA">NA</option>
            </select>
        </div>
        <div>
            <label style="font-size: 12px; color: #666;">Handle/Nob:</label>
            <select name="handle_knob_${rowId}" style="width: 100%; padding: 4px; font-size: 12px;">
                <option value="">-</option>
                <option value="✔">✔ Ok</option>
                <option value="❌">❌ Not Ok</option>
                <option value="NA">NA</option>
            </select>
        </div>
        <div>
            <label style="font-size: 12px; color: #666;">Dent/Rust/Leak:</label>
            <select name="dent_rust_leak_${rowId}" style="width: 100%; padding: 4px; font-size: 12px;">
                <option value="">-</option>
                <option value="✔">✔ Ok</option>
                <option value="❌">❌ Not Ok</option>
                <option value="NA">NA</option>
            </select>
        </div>
        <div>
            <label style="font-size: 12px; color: #666;">Easy Access:</label>
            <select name="easy_access_${rowId}" style="width: 100%; padding: 4px; font-size: 12px;">
                <option value="">-</option>
                <option value="✔">✔ Ok</option>
                <option value="❌">❌ Not Ok</option>
                <option value="NA">NA</option>
            </select>
        </div>
        <div style="grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
            <input type="text" name="remarks_${rowId}" placeholder="Remarks" style="flex: 1; margin-right: 10px; padding: 4px; font-size: 12px;">
            <button type="button" onclick="removeInspectionRow(this)" style="background-color: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">Remove</button>
        </div>
    `;
    
    inspectionRows.appendChild(row);
}

// Remove inspection row
function removeInspectionRow(button) {
    button.closest('.inspection-row').remove();
}

// Clear inspection rows
function clearInspectionRows() {
    if (inspectionRows) {
        inspectionRows.innerHTML = '';
        inspectionRowCount = 0;
    }
}

// Open edit modal
function editExtinguisher(id) {
    const extinguisher = allExtinguishers.find(e => e.id === id);
    if (!extinguisher) return;

    currentEditingId = id;
    document.getElementById('modalTitle').textContent = 'Edit Fire Extinguisher';
    
    // Fill form with existing data
    document.getElementById('extinguisherNo').value = extinguisher.extinguisher_no || '';
    document.getElementById('typeOfExtinguisher').value = extinguisher.type_of_extinguisher || '';
    document.getElementById('formDate').value = extinguisher.form_date || '';
    document.getElementById('refilledDate').value = extinguisher.refilled_date || '';
    document.getElementById('location').value = extinguisher.location || '';
    document.getElementById('expiryDate').value = extinguisher.expiry_date || '';
    document.getElementById('capacity').value = extinguisher.capacity || '';
    document.getElementById('checkedBy').value = extinguisher.checked_by || '';
    document.getElementById('verifiedBy').value = extinguisher.verified_by || '';
    
    // Load inspection data
    clearInspectionRows();
    if (extinguisher.inspection_data && extinguisher.inspection_data.inspections) {
        extinguisher.inspection_data.inspections.forEach(inspection => {
            addInspectionRow();
            const lastRow = document.querySelector('.inspection-row:last-child');
            if (lastRow) {
                lastRow.querySelector(`input[name^="inspection_date_"]`).value = inspection.date || '';
                lastRow.querySelector(`input[name^="next_due_date_"]`).value = inspection.next_due_date || '';
                lastRow.querySelector(`input[name^="inspector_"]`).value = inspection.inspector || '';
                lastRow.querySelector(`select[name^="pin_seal_"]`).value = inspection.pin_seal || '';
                lastRow.querySelector(`select[name^="pressure_"]`).value = inspection.pressure || '';
                lastRow.querySelector(`select[name^="hose_nozzle_"]`).value = inspection.hose_nozzle || '';
                lastRow.querySelector(`select[name^="handle_knob_"]`).value = inspection.handle_knob || '';
                lastRow.querySelector(`select[name^="dent_rust_leak_"]`).value = inspection.dent_rust_leak || '';
                lastRow.querySelector(`select[name^="easy_access_"]`).value = inspection.easy_access || '';
                lastRow.querySelector(`input[name^="remarks_"]`).value = inspection.remarks || '';
            }
        });
    } else {
        addInspectionRow(); // Add one initial row if no existing data
    }
    
    modal.style.display = 'block';
}

// View extinguisher details
function viewExtinguisher(id) {
    const extinguisher = allExtinguishers.find(e => e.id === id);
    if (!extinguisher) return;

    // Create a detailed view modal or redirect to a detailed view page
    alert(`Viewing details for Extinguisher ${extinguisher.extinguisher_no}\nLocation: ${extinguisher.location}\nType: ${extinguisher.type_of_extinguisher}\nCapacity: ${extinguisher.capacity}`);
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Collect inspection data
    const inspections = [];
    const inspectionRows = document.querySelectorAll('.inspection-row');
    
    inspectionRows.forEach((row, index) => {
        const inspection = {
            date: row.querySelector(`input[name^="inspection_date_"]`).value,
            next_due_date: row.querySelector(`input[name^="next_due_date_"]`).value,
            inspector: row.querySelector(`input[name^="inspector_"]`).value,
            pin_seal: row.querySelector(`select[name^="pin_seal_"]`).value,
            pressure: row.querySelector(`select[name^="pressure_"]`).value,
            hose_nozzle: row.querySelector(`select[name^="hose_nozzle_"]`).value,
            handle_knob: row.querySelector(`select[name^="handle_knob_"]`).value,
            dent_rust_leak: row.querySelector(`select[name^="dent_rust_leak_"]`).value,
            easy_access: row.querySelector(`select[name^="easy_access_"]`).value,
            remarks: row.querySelector(`input[name^="remarks_"]`).value
        };
        
        // Only add if inspection date is filled
        if (inspection.date) {
            inspections.push(inspection);
        }
    });
    
    const formData = {
        extinguisher_no: document.getElementById('extinguisherNo').value,
        type_of_extinguisher: document.getElementById('typeOfExtinguisher').value,
        form_date: document.getElementById('formDate').value,
        refilled_date: document.getElementById('refilledDate').value || null,
        location: document.getElementById('location').value,
        expiry_date: document.getElementById('expiryDate').value,
        capacity: document.getElementById('capacity').value,
        checked_by: document.getElementById('checkedBy').value || null,
        verified_by: document.getElementById('verifiedBy').value || null,
        inspection_data: { inspections: inspections }
    };

    try {
        if (currentEditingId) {
            // Update existing extinguisher
            const { error } = await supabase
                .from('fire_extinguishers')
                .update(formData)
                .eq('id', currentEditingId);

            if (error) throw error;
            alert('Fire extinguisher updated successfully!');
        } else {
            // Add new extinguisher
            const { error } = await supabase
                .from('fire_extinguishers')
                .insert([formData]);

            if (error) throw error;
            alert('Fire extinguisher added successfully!');
        }

        closeModal();
        await loadFireExtinguishers();
    } catch (error) {
        console.error('Error saving fire extinguisher:', error);
        alert('Error saving fire extinguisher. Please try again.');
    }
}

// Delete extinguisher
async function deleteExtinguisher(id) {
    if (!confirm('Are you sure you want to delete this fire extinguisher?')) return;

    try {
        const { error } = await supabase
            .from('fire_extinguishers')
            .delete()
            .eq('id', id);

        if (error) throw error;
        alert('Fire extinguisher deleted successfully!');
        await loadFireExtinguishers();
    } catch (error) {
        console.error('Error deleting fire extinguisher:', error);
        alert('Error deleting fire extinguisher. Please try again.');
    }
}

// Generate QR code
function generateQRCode(id) {
    const extinguisher = allExtinguishers.find(e => e.id === id);
    if (!extinguisher) return;

    // Create QR code URL
    const qrUrl = `${window.location.origin}/fire-extinguisher-view.html?id=${extinguisher.id}`;
    
    // Generate QR code using a library (you'll need to include a QR code library)
    // For now, we'll show the URL
    document.getElementById('qrCodeContainer').innerHTML = `
        <div style="padding: 20px; border: 1px solid #ddd; border-radius: 8px; margin: 20px;">
            <h3>QR Code for Extinguisher ${extinguisher.extinguisher_no}</h3>
            <p><strong>Location:</strong> ${extinguisher.location}</p>
            <p><strong>Type:</strong> ${extinguisher.type_of_extinguisher}</p>
            <p><strong>QR URL:</strong> ${qrUrl}</p>
            <p style="color: #666; font-size: 12px;">Scan this QR code to view extinguisher details</p>
        </div>
    `;
    
    qrModal.style.display = 'block';
}

// Download QR code
function downloadQRCode() {
    // Implementation for downloading QR code image
    alert('QR code download functionality will be implemented');
}

// Print QR code
function printQRCode() {
    // Implementation for printing QR code
    alert('QR code print functionality will be implemented');
}

// Close modal
function closeModal() {
    modal.style.display = 'none';
    currentEditingId = null;
}

// Close QR modal
function closeQRModal() {
    qrModal.style.display = 'none';
}

// Handle logout
async function handleLogout(e) {
    e.preventDefault();
    
    if (window.confirm("Are you sure you want to log out?")) {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('Error logging out:', error);
                alert('Logout failed. Please try again.');
            } else {
                localStorage.removeItem('supabase.auth.session');
                sessionStorage.removeItem('supabase.auth.session');
                window.location.replace('../html/auth.html');
            }
        } catch (err) {
            console.error('Exception during logout:', err);
            alert('An unexpected error occurred during logout.');
        }
    }
}

// Make functions globally available
window.openAddModal = openAddModal;
window.editExtinguisher = editExtinguisher;
window.viewExtinguisher = viewExtinguisher;
window.deleteExtinguisher = deleteExtinguisher;
window.generateQRCode = generateQRCode;
window.closeModal = closeModal;
window.downloadQRCode = downloadQRCode;
window.printQRCode = printQRCode;
window.addInspectionRow = addInspectionRow;
window.removeInspectionRow = removeInspectionRow;
