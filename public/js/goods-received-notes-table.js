import { supabase } from '../supabase-config.js';

// Global variables
let currentPage = 1;
const itemsPerPage = 10;
let allGRNData = [];
let filteredData = [];
let currentUser = null;

// DOM elements
const tableBody = document.querySelector('#grnTableBody');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const currentPageDisplay = document.getElementById('currentPageDisplay');
const totalPagesDisplay = document.getElementById('totalPagesDisplay');

const filterFromDate = document.getElementById('filterFromDate');
const filterToDate = document.getElementById('filterToDate');
const filterSupplier = document.getElementById('filterSupplier');
const filterStatus = document.getElementById('filterStatus');
const clearFilterBtn = document.getElementById('clearFilter');
const filterStatusIndicator = document.querySelector('#filterStatus');

// Create New GRN form overlay elements
let grnFormOverlay = null;

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const userId = await getLoggedInUserId();
    if (!userId) {
        console.error("User not authenticated on GRN Table.");
        window.location.href = '../html/auth.html';
        return;
    }

    currentUser = userId;

    // Check if user has access to GRN (Warehouse only)
    const hasAccess = await checkGRNAccess(userId);
    if (!hasAccess) {
        showMessage('Access Denied: GRN is restricted to Warehouse personnel only.', true);
        setTimeout(() => {
            window.location.href = '../html/employee-dashboard.html';
        }, 3000);
        return;
    }

    // Setup event listeners
    setupEventListeners();

    // Load initial data
    await fetchGRNData();
    await populateFilterDropdowns();

    // Setup pagination
    updatePaginationControls(1);
    displayCurrentPage();
});

// Setup all event listeners
function setupEventListeners() {
    // Pagination buttons
    if (prevPageBtn) prevPageBtn.addEventListener('click', prevPage);
    if (nextPageBtn) nextPageBtn.addEventListener('click', nextPage);

    // Filter elements
    if (filterFromDate) filterFromDate.addEventListener('change', applyFilters);
    if (filterToDate) filterToDate.addEventListener('change', applyFilters);
    if (filterSupplier) filterSupplier.addEventListener('change', applyFilters);
    if (filterStatus) filterStatus.addEventListener('change', applyFilters);
    if (clearFilterBtn) clearFilterBtn.addEventListener('click', clearAllFilters);

    // Create New GRN button - now opens modal
    const createGrnBtn = document.getElementById('showGrnFormOverlay');
    if (createGrnBtn) {
        createGrnBtn.addEventListener('click', () => {
            showGrnFormModal();
        });
    }

    // Modal close button
    const closeGrnFormOverlay = document.getElementById('closeGrnFormOverlay');
    if (closeGrnFormOverlay) {
        closeGrnFormOverlay.addEventListener('click', () => {
            hideGrnFormModal();
        });
    }

    // Modal overlay click disabled - only close button works

    // Delete confirmation buttons
    setupDeleteModalListeners();
}

// Fetch GRN data from database
async function fetchGRNData() {
    try {
        // Fetch both submitted GRNs and drafts
        const [submittedResult, draftsResult] = await Promise.all([
            supabase
                .from('goods_received_notes')
                .select(`
                    id,
                    grn_number,
                    grn_date,
                    po_number,
                    po_date,
                    supplier_name,
                    received_by,
                    quality_status,
                    status,
                    user_id,
                    created_at,
                    submitted_at,
                    users!inner(full_name)
                `)
                .eq('user_id', currentUser)
                .order('created_at', { ascending: false }),

            supabase
                .from('grn_drafts')
                .select(`
                    id,
                    grn_number,
                    grn_date,
                    po_number,
                    po_date,
                    supplier_name,
                    received_by,
                    quality_status,
                    created_at,
                    drafted_at,
                    users!inner(full_name)
                `)
                .eq('user_id', currentUser)
                .order('drafted_at', { ascending: false })
        ]);

        if (submittedResult.error) {
            console.error('Error fetching submitted GRNs:', submittedResult.error);
            return;
        }

        if (draftsResult.error) {
            console.error('Error fetching GRN drafts:', draftsResult.error);
            return;
        }

        // Combine and format data
        const submittedGRNs = submittedResult.data.map(grn => ({
            ...grn,
            type: 'submitted',
            prepared_by: grn.users?.full_name || 'Unknown',
            display_status: grn.status === 'draft' ? 'Draft' : 'Submitted',
            sort_date: grn.submitted_at || grn.created_at
        }));

        const draftGRNs = draftsResult.data.map(draft => ({
            ...draft,
            type: 'draft',
            id: draft.id,
            status: 'draft',
            display_status: 'Draft',
            prepared_by: draft.users?.full_name || 'Unknown',
            sort_date: draft.drafted_at
        }));

        // Combine all data and sort by date
        allGRNData = [...submittedGRNs, ...draftGRNs].sort((a, b) =>
            new Date(b.sort_date) - new Date(a.sort_date)
        );

        filteredData = [...allGRNData];
        applyFilters();

    } catch (error) {
        console.error('Error fetching GRN data:', error);
        showMessage('Error loading GRN data. Please try again.', true);
    }
}

// Pagination functions
function updatePaginationControls(totalPages) {
    const totalPagesValue = Math.max(1, totalPages);
    totalPagesDisplay.textContent = totalPagesValue;
    currentPageDisplay.textContent = currentPage;

    if (prevPageBtn) {
        prevPageBtn.disabled = currentPage <= 1;
    }
    if (nextPageBtn) {
        nextPageBtn.disabled = currentPage >= totalPagesValue;
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        displayCurrentPage();
        updatePaginationControls(totalPages);
    }
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        displayCurrentPage();
        updatePaginationControls(Math.ceil(filteredData.length / itemsPerPage));
    }
}

// Filter functions
function applyFilters() {
    const activeFilters = {
        fromDate: filterFromDate?.value || '',
        toDate: filterToDate?.value || '',
        supplier: filterSupplier?.value || '',
        status: filterStatus?.value || ''
    };

    filteredData = allGRNData.filter(grn => {
        // Date range filter
        if (activeFilters.fromDate) {
            const grnDate = new Date(grn.grn_date);
            const fromDate = new Date(activeFilters.fromDate);
            if (grnDate < fromDate) return false;
        }

        if (activeFilters.toDate) {
            const grnDate = new Date(grn.grn_date);
            const toDate = new Date(activeFilters.toDate);
            if (grnDate > toDate) return false;
        }

        // Supplier filter
        if (activeFilters.supplier && !grn.supplier_name.toLowerCase().includes(activeFilters.supplier.toLowerCase())) {
            return false;
        }

        // Status filter
        if (activeFilters.status && grn.display_status !== activeFilters.status) {
            return false;
        }

        return true;
    });

    // Update filter status indicator
    const hasActiveFilters = Object.values(activeFilters).some(value => value !== '');
    if (filterStatusIndicator) {
        filterStatusIndicator.textContent = hasActiveFilters ? 'On' : 'Off';
        filterStatusIndicator.className = `px-2 py-1 text-sm font-semibold rounded-full ${
            hasActiveFilters ? 'bg-blue-200 text-blue-700' : 'bg-gray-200 text-gray-700'
        }`;
    }

    // Reset to page 1 when filters change
    currentPage = 1;
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    updatePaginationControls(totalPages);
    displayCurrentPage();
}

function clearAllFilters() {
    if (filterFromDate) filterFromDate.value = '';
    if (filterToDate) filterToDate.value = '';
    if (filterSupplier) filterSupplier.selectedIndex = 0;
    if (filterStatus) filterStatus.selectedIndex = 0;

    filteredData = [...allGRNData];
    currentPage = 1;
    applyFilters();
}

// Display current page data
function displayCurrentPage() {
    if (!tableBody) return;

    tableBody.innerHTML = '';

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredData.length);
    const currentPageData = filteredData.slice(startIndex, endIndex);

    if (currentPageData.length === 0) {
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 9;
        cell.textContent = 'No GRNs found';
        cell.className = 'text-center py-8 text-gray-500';
        return;
    }

    currentPageData.forEach((grn, index) => {
        const row = tableBody.insertRow();

        // Serial Number
        const serialCell = row.insertCell();
        serialCell.textContent = filteredData.length - (startIndex + index);
        serialCell.className = 'text-center py-2 px-2';

        // GRN Date
        const dateCell = row.insertCell();
        dateCell.textContent = formatDate(grn.grn_date);
        dateCell.className = 'text-center py-2 px-2';

        // GRN Number
        const numberCell = row.insertCell();
        numberCell.textContent = grn.grn_number || 'N/A';
        numberCell.className = 'text-center py-2 px-2';

        // PO Number
        const poCell = row.insertCell();
        poCell.textContent = grn.po_number || 'N/A';
        poCell.className = 'text-center py-2 px-2';

        // Supplier Name
        const supplierCell = row.insertCell();
        supplierCell.textContent = grn.supplier_name || 'N/A';
        supplierCell.className = 'text-center py-2 px-2';

        // Received By
        const receivedByCell = row.insertCell();
        receivedByCell.textContent = grn.received_by || 'N/A';
        receivedByCell.className = 'text-center py-2 px-2';

        // Status
        const statusCell = row.insertCell();
        const statusBadge = document.createElement('span');
        statusBadge.textContent = grn.display_status;
        statusBadge.className = `px-2 py-1 text-xs font-semibold rounded-full ${
            grn.display_status === 'Submitted' ? 'bg-green-200 text-green-800' :
            'bg-yellow-200 text-yellow-800'
        }`;
        statusCell.appendChild(statusBadge);
        statusCell.className = 'text-center py-2 px-2';

        // Action buttons
        const actionCell = row.insertCell();
        actionCell.className = 'text-center py-2 px-2';

        const actionButtons = document.createElement('div');
        actionButtons.className = 'flex justify-center space-x-1';

        // Edit button
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.className = 'bg-blue-500 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs';
        editBtn.title = 'Edit GRN';
        editBtn.onclick = () => editGRN(grn);
        actionButtons.appendChild(editBtn);

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.className = 'bg-red-500 hover:bg-red-700 text-white px-2 py-1 rounded text-xs';
        deleteBtn.title = 'Delete GRN';
        deleteBtn.onclick = () => showDeleteModal(grn);
        actionButtons.appendChild(deleteBtn);

        actionCell.appendChild(actionButtons);

        // Download button
        const downloadCell = row.insertCell();
        downloadCell.className = 'text-center py-2 px-2';

        const downloadBtn = document.createElement('button');
        downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
        downloadBtn.className = 'bg-green-500 hover:bg-green-700 text-white px-3 py-1 rounded text-xs';
        downloadBtn.title = 'Download GRN';
        downloadBtn.onclick = () => downloadGRN(grn);
        downloadCell.appendChild(downloadBtn);
    });
}

// Populate filter dropdowns
async function populateFilterDropdowns() {
    try {
        // Suppliers
        if (filterSupplier) {
            const suppliers = [...new Set(allGRNData.map(grn => grn.supplier_name).filter(Boolean))];
            suppliers.forEach(supplier => {
                const option = document.createElement('option');
                option.value = supplier;
                option.textContent = supplier;
                filterSupplier.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error populating filter dropdowns:', error);
    }
}

// Edit GRN function
function editGRN(grn) {
    if (grn.type === 'draft') {
        // For drafts, show message that editing is not available in modal
        showMessage('Draft editing will be available in the modal soon. Please create a new GRN for now.', false);
    } else {
        // For submitted GRNs, show message that they cannot be edited
        showMessage('Submitted GRNs cannot be edited. Please create a new GRN if needed.', true);
    }
}

// Delete functions
function showDeleteModal(grn) {
    const deleteConfirmationTitle = document.getElementById('deleteConfirmationTitle');
    const deleteConfirmationMessage = document.getElementById('deleteConfirmationMessage');

    if (deleteConfirmationTitle) {
        deleteConfirmationTitle.textContent = `Delete GRN: ${grn.grn_number || 'Draft'}`;
    }

    if (deleteConfirmationMessage) {
        deleteConfirmationMessage.textContent = `Are you sure you want to delete this ${grn.display_status.toLowerCase()} GRN? This action cannot be undone.`;
    }

    // Store the GRN to delete
    window.grnToDelete = grn;

    // Show the modal
    const deleteConfirmationOverlay = document.getElementById('deleteConfirmationOverlay');
    if (deleteConfirmationOverlay) {
        deleteConfirmationOverlay.classList.remove('hidden');
    }
}

function setupDeleteModalListeners() {
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const deleteConfirmationOverlay = document.getElementById('deleteConfirmationOverlay');

    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', () => {
            if (deleteConfirmationOverlay) {
                deleteConfirmationOverlay.classList.add('hidden');
            }
            window.grnToDelete = null;
        });
    }

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', () => {
            if (deleteConfirmationOverlay) {
                deleteConfirmationOverlay.classList.add('hidden');
            }

            const finalDeleteWarningOverlay = document.getElementById('finalDeleteWarningOverlay');
            if (finalDeleteWarningOverlay) {
                finalDeleteWarningOverlay.classList.remove('hidden');
            }
        });
    }

    // Final delete confirmation
    const cancelFinalDeleteBtn = document.getElementById('cancelFinalDeleteBtn');
    const confirmFinalDeleteBtn = document.getElementById('confirmFinalDeleteBtn');
    const finalDeleteWarningOverlay = document.getElementById('finalDeleteWarningOverlay');

    if (cancelFinalDeleteBtn) {
        cancelFinalDeleteBtn.addEventListener('click', () => {
            if (finalDeleteWarningOverlay) {
                finalDeleteWarningOverlay.classList.add('hidden');
            }
            window.grnToDelete = null;
        });
    }

    if (confirmFinalDeleteBtn) {
        confirmFinalDeleteBtn.addEventListener('click', async () => {
            if (finalDeleteWarningOverlay) {
                finalDeleteWarningOverlay.classList.add('hidden');
            }

            if (window.grnToDelete) {
                await deleteGRN(window.grnToDelete);
            }
            window.grnToDelete = null;
        });
    }
}

async function deleteGRN(grn) {
    try {
        let result;

        if (grn.type === 'draft') {
            // Delete from drafts table
            result = await supabase
                .from('grn_drafts')
                .delete()
                .eq('id', grn.id);
        } else {
            // Delete from main table (this will cascade to items)
            result = await supabase
                .from('goods_received_notes')
                .delete()
                .eq('id', grn.id);
        }

        if (result.error) {
            throw result.error;
        }

        showMessage(`GRN ${grn.grn_number || 'Draft'} deleted successfully.`, false);
        await fetchGRNData();

    } catch (error) {
        console.error('Error deleting GRN:', error);
        showMessage('Error deleting GRN. Please try again.', true);
    }
}

// Download GRN function
async function downloadGRN(grn) {
    try {
        // For now, just show a message. This could be enhanced to generate a PDF
        showMessage('GRN download functionality will be implemented soon.', false);
    } catch (error) {
        console.error('Error downloading GRN:', error);
        showMessage('Error downloading GRN. Please try again.', true);
    }
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB'); // dd/mm/yyyy format
}

function showMessage(message, isError = false) {
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 px-6 py-3 rounded-md text-white text-sm font-medium z-50 ${
        isError ? 'bg-red-500' : 'bg-green-500'
    }`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 3000);
}

// Helper function to get logged in user ID (same as in other files)
async function getLoggedInUserId() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        return user?.id || null;
    } catch (error) {
        console.error('Error getting logged in user:', error);
        return null;
    }
}

// Helper function to check GRN access (Warehouse only)
async function checkGRNAccess(userId) {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('department')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error checking GRN access:', error);
            return false;
        }

        return data?.department === 'Warehouse';
    } catch (error) {
        console.error('Error checking GRN access:', error);
        return false;
    }
}

// Modal functions for GRN Form
function showGrnFormModal() {
    const modal = document.getElementById('grnFormOverlay');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex'; // Ensure flex display
        document.body.style.overflow = 'hidden'; // Prevent background scrolling

        // Initialize the modal form
        initializeModalForm();
    }
}

function hideGrnFormModal() {
    const modal = document.getElementById('grnFormOverlay');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = ''; // Reset display style
        document.body.style.overflow = 'auto'; // Restore background scrolling

        // Reset form
        resetModalForm();
    }
}

function closeGRNModal() {
    hideGrnFormModal();
}

// Initialize modal form functionality
function initializeModalForm() {
    // Generate GRN number
    generateModalGRNNumber();

    // Setup form event listeners
    setupModalFormEventListeners();

    // Setup item calculations
    setupModalItemCalculations();

    // Setup contenteditable placeholder
    setupContenteditablePlaceholder();
}

// Reset modal form
function resetModalForm() {
    const form = document.getElementById('grnFormModal');
    if (form) {
        form.reset();
    }

    // Clear contenteditable From field
    const fromSupplier = document.getElementById('fromSupplier');
    if (fromSupplier) {
        setTimeout(() => {
            fromSupplier.textContent = 'Enter supplier name';
            fromSupplier.classList.add('placeholder');
            // Trigger input event to ensure placeholder styling is applied
            fromSupplier.dispatchEvent(new Event('input'));
            // Update delete button visibility after reset
            updateDeleteButtonVisibility();
        }, 0);
    }

    // Clear items table (keep first row)
    const itemsTableBody = document.getElementById('itemsTableBody');
    if (itemsTableBody) {
        // Keep only the first row
        const firstRow = itemsTableBody.querySelector('.item-row');
        if (firstRow) {
            // Reset the first row
            const inputs = firstRow.querySelectorAll('input');
            inputs.forEach(input => {
                if (!input.classList.contains('balance-qty')) {
                    input.value = '';
                }
            });
            const selects = firstRow.querySelectorAll('select');
            selects.forEach(select => select.selectedIndex = 0);

            // Reset serial numbers
            const srNoCells = itemsTableBody.querySelectorAll('.sr-no-cell');
            srNoCells.forEach((cell, index) => cell.textContent = index + 1);
        }
    }

    modalUploadedDocuments = [];
    modalCurrentGRNId = null;
}

// Global variables for modal form
let modalItemRowCounter = 1;
let modalUploadedDocuments = [];
let modalCurrentGRNId = null;

// Generate GRN number for modal
async function generateModalGRNNumber() {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const prefix = `GRN-${year}${month}`;

        // Query existing GRN numbers
        const { data, error } = await supabase
            .from('goods_received_notes')
            .select('grn_number')
            .like('grn_number', `${prefix}-%`)
            .order('grn_number', { ascending: false })
            .limit(1);

        if (error) {
            console.error('Error fetching GRN numbers:', error);
            return;
        }

        let nextNumber = 1;
        if (data && data.length > 0) {
            const lastNumber = data[0].grn_number;
            const match = lastNumber.match(/-(\d+)$/);
            if (match) {
                nextNumber = parseInt(match[1], 10) + 1;
            }
        }

        const grnNumber = `${prefix}-${String(nextNumber).padStart(3, '0')}`;
        const grnNumberDisplay = document.getElementById('grnNumberDisplay');
        if (grnNumberDisplay) {
            grnNumberDisplay.textContent = grnNumber;
        }
        modalCurrentGRNId = grnNumber;
    } catch (error) {
        console.error('Error generating GRN number:', error);
    }
}

// Setup modal form event listeners
function setupModalFormEventListeners() {
    const form = document.getElementById('grnFormModal');

    // Form submission
    if (form) {
        form.addEventListener('submit', async function(event) {
            event.preventDefault();
            await submitModalGRN(currentUser);
        });
    }

    // Setup quantity calculations
    setupQuantityCalculations();
}

// Setup quantity calculations for the new table structure
function setupQuantityCalculations() {
    const itemsTableBody = document.getElementById('itemsTableBody');
    if (itemsTableBody) {
        itemsTableBody.addEventListener('input', function(event) {
            const target = event.target;
            if (target.classList.contains('received-qty') || target.classList.contains('accepted-qty') || target.classList.contains('rejected-qty')) {
                calculateBalance(target);
            }
        });
    }
}

function calculateBalance(inputElement) {
    const row = inputElement.closest('.item-row');
    if (!row) return;

    const receivedQty = parseFloat(row.querySelector('.received-qty')?.value) || 0;
    const acceptedQty = parseFloat(row.querySelector('.accepted-qty')?.value) || 0;
    const rejectedQty = parseFloat(row.querySelector('.rejected-qty')?.value) || 0;

    const balanceQty = receivedQty - acceptedQty - rejectedQty;
    const balanceInput = row.querySelector('.balance-qty');
    if (balanceInput) {
        balanceInput.value = balanceQty.toFixed(2);
    }
}

// Setup modal item calculations
function setupModalItemCalculations() {
    // Item calculations are now handled in setupModalFormEventListeners
}

// Setup contenteditable placeholder functionality
function setupContenteditablePlaceholder() {
    const fromSupplier = document.getElementById('fromSupplier');
    if (fromSupplier) {
        const placeholderText = 'Enter supplier name';

        // Handle placeholder
        fromSupplier.addEventListener('focus', function() {
            if (this.classList.contains('placeholder') || this.textContent.trim() === placeholderText) {
                this.textContent = '';
                this.classList.remove('placeholder');
            }
        });

        fromSupplier.addEventListener('blur', function() {
            if (this.textContent.trim() === '') {
                this.textContent = placeholderText;
                this.classList.add('placeholder');
            }
        });

        fromSupplier.addEventListener('input', function() {
            if (this.textContent.trim() === '') {
                this.classList.add('placeholder');
            } else {
                this.classList.remove('placeholder');
            }
        });

        // Initialize placeholder on next tick to ensure DOM is ready
        setTimeout(() => {
            if (!fromSupplier.textContent || fromSupplier.textContent.trim() === '' || fromSupplier.classList.contains('placeholder')) {
                fromSupplier.textContent = placeholderText;
                fromSupplier.classList.add('placeholder');
            }
            // Initialize delete button visibility
            updateDeleteButtonVisibility();
        }, 0);
    }
}

// Add item row function for new table structure
function addItemRow() {
    const itemsTableBody = document.getElementById('itemsTableBody');
    if (!itemsTableBody) return;

    const currentRows = itemsTableBody.querySelectorAll('.item-row');
    const newRowNumber = currentRows.length + 1;

    const newRow = document.createElement('tr');
    newRow.className = 'item-row';
    newRow.innerHTML = `
        <td class="sr-no-cell">${newRowNumber}</td>
        <td class="particulars-cell">
            <input type="text" class="item-input" placeholder="Enter item description" required>
        </td>
        <td class="unit-cell">
            <select class="unit-select" required>
                <option value="">Select</option>
                <option value="KG">KG</option>
                <option value="PC">PC</option>
                <option value="BOX">BOX</option>
                <option value="MTR">MTR</option>
                <option value="LTR">LTR</option>
                <option value="NOS">NOS</option>
            </select>
        </td>
        <td class="qty-cell">
            <input type="number" class="qty-input ordered-qty" placeholder="0" min="0" step="0.01" required>
        </td>
        <td class="qty-cell">
            <input type="number" class="qty-input received-qty" placeholder="0" min="0" step="0.01" required>
        </td>
        <td class="qty-cell">
            <input type="number" class="qty-input accepted-qty" placeholder="0" min="0" step="0.01" required>
        </td>
        <td class="qty-cell">
            <input type="number" class="qty-input rejected-qty" placeholder="0" min="0" step="0.01">
        </td>
        <td class="qty-cell">
            <input type="number" class="qty-input balance-qty" placeholder="0" min="0" step="0.01" readonly>
        </td>
    `;

    itemsTableBody.appendChild(newRow);

    // Add event listeners for the new row
    const newRowInputs = newRow.querySelectorAll('.received-qty, .accepted-qty, .rejected-qty');
    newRowInputs.forEach(input => {
        input.addEventListener('input', function() {
            calculateBalance(this);
        });
    });

    // Update delete button visibility
    updateDeleteButtonVisibility();
}

// Delete last item row function
function deleteLastItemRow() {
    const itemsTableBody = document.getElementById('itemsTableBody');
    if (!itemsTableBody) return;

    const rows = itemsTableBody.querySelectorAll('.item-row');
    if (rows.length <= 1) return; // Don't delete if only one item remains

    // Remove the last row (latest added)
    const lastRow = rows[rows.length - 1];
    lastRow.remove();

    // Update serial numbers
    updateSerialNumbers();

    // Update delete button visibility
    updateDeleteButtonVisibility();
}

// Update serial numbers after deletion
function updateSerialNumbers() {
    const itemsTableBody = document.getElementById('itemsTableBody');
    if (!itemsTableBody) return;

    const rows = itemsTableBody.querySelectorAll('.item-row');
    rows.forEach((row, index) => {
        const serialCell = row.querySelector('.sr-no-cell');
        if (serialCell) {
            serialCell.textContent = index + 1;
        }
    });
}

// Update delete button visibility based on number of items
function updateDeleteButtonVisibility() {
    const itemsTableBody = document.getElementById('itemsTableBody');
    const deleteBtn = document.getElementById('deleteItemBtn');

    if (!itemsTableBody || !deleteBtn) return;

    const rows = itemsTableBody.querySelectorAll('.item-row');

    // Show delete button if more than 1 item, hide if 1 or fewer
    if (rows.length > 1) {
        deleteBtn.style.display = 'inline-flex';
    } else {
        deleteBtn.style.display = 'none';
    }
}

// Save as draft function
function saveAsDraft() {
    showMessage('Save as Draft functionality will be implemented soon.', false);
}

// Print GRN function
function printGRN() {
    showMessage('Print GRN functionality will be implemented soon.', false);
}

// Submit modal GRN
async function submitModalGRN(userId) {
    try {
        const formData = getModalFormData();

        // Validate form
        if (!validateModalForm(formData)) {
            return;
        }

        // Insert GRN
        const { data: grnData, error: grnError } = await supabase
            .from('goods_received_notes')
            .insert([{
                grn_number: formData.grnNumber,
                grn_date: formData.grnDate,
                receipt_date: formData.receiptDate,
                received_by: formData.receivedBy,
                po_number: formData.poNumber,
                po_date: formData.poDate,
                supplier_name: formData.supplierName,
                supplier_code: formData.supplierCode,
                supplier_invoice: formData.supplierInvoice,
                invoice_date: formData.invoiceDate,
                delivery_challan: formData.deliveryChallan,
                vehicle_number: formData.vehicleNumber,
                quality_status: formData.qualityStatus,
                document_urls: modalUploadedDocuments.map(doc => doc.url),
                user_id: userId,
                status: 'submitted'
            }])
            .select()
            .single();

        if (grnError) {
            throw grnError;
        }

        // Insert GRN items
        const itemsData = formData.items.map(item => ({
            grn_id: grnData.id,
            item_code: item.itemCode,
            item_description: item.itemDescription,
            quantity_ordered: parseFloat(item.quantityOrdered) || 0,
            quantity_received: parseFloat(item.quantityReceived) || 0,
            quantity_accepted: parseFloat(item.quantityAccepted) || 0,
            quantity_rejected: parseFloat(item.quantityRejected) || 0,
            uom: item.uom,
            unit_price: parseFloat(item.unitPrice) || 0,
            batch_number: item.batchNumber,
            expiry_date: item.expiryDate || null,
            mfg_date: item.mfgDate || null,
            storage_location: item.storageLocation
        }));

        const { error: itemsError } = await supabase
            .from('grn_items')
            .insert(itemsData);

        if (itemsError) {
            throw itemsError;
        }

        showModalMessage('New GRN submitted successfully!', false);
        setTimeout(() => {
            hideGrnFormModal();
            fetchGRNData(); // Refresh the table
        }, 2000);

    } catch (error) {
        console.error('Error submitting GRN:', error);
        showModalMessage('Error submitting GRN. Please try again.', true);
    }
}

// Save modal as draft
async function saveModalAsDraft(userId) {
    try {
        const formData = getModalFormData();

        // Insert draft
        const { error } = await supabase
            .from('grn_drafts')
            .insert([{
                grn_number: formData.grnNumber,
                grn_date: formData.grnDate,
                receipt_date: formData.receiptDate,
                received_by: formData.receivedBy,
                po_number: formData.poNumber,
                po_date: formData.poDate,
                supplier_name: formData.supplierName,
                supplier_code: formData.supplierCode,
                supplier_invoice: formData.supplierInvoice,
                invoice_date: formData.invoiceDate,
                delivery_challan: formData.deliveryChallan,
                vehicle_number: formData.vehicleNumber,
                quality_status: formData.qualityStatus,
                items: formData.items,
                document_urls: modalUploadedDocuments.map(doc => doc.url),
                user_id: userId
            }]);

        if (error) {
            throw error;
        }

        showModalMessage('New GRN saved as draft successfully!', false);
        setTimeout(() => {
            hideGrnFormModal();
            fetchGRNData(); // Refresh the table
        }, 2000);

    } catch (error) {
        console.error('Error saving draft:', error);
        showModalMessage('Error saving draft. Please try again.', true);
    }
}

// Get modal form data
function getModalFormData() {
    return {
        grnNumber: document.getElementById('grnNumberDisplay')?.textContent || '',
        grnDate: document.getElementById('grnDate')?.value || '',
        receiptDate: document.getElementById('grnDate')?.value || '', // Using GRN date as receipt date for now
        receivedBy: document.getElementById('receivedBy')?.value || '',
        poNumber: document.getElementById('purchaseOrderNo')?.value || '',
        poDate: '', // Not in current form - will need to add
        supplierName: document.getElementById('fromSupplier')?.textContent?.trim() || '',
        supplierCode: '', // Not in current form - will need to add
        supplierInvoice: document.getElementById('taxInvoiceNo')?.value || '',
        invoiceDate: document.getElementById('invoiceDate')?.value || '',
        deliveryChallan: document.getElementById('deliveryChallanNo')?.value || '',
        vehicleNumber: '', // Not in current form - will need to add
        qualityStatus: '', // Not in current form - will need to add
        items: getModalItemsData()
    };
}

// Get modal items data from the new table structure
function getModalItemsData() {
    const items = [];
    const itemRows = document.querySelectorAll('#itemsTableBody .item-row');

    itemRows.forEach((row, index) => {
        const particularsInput = row.querySelector('.item-input');
        const unitSelect = row.querySelector('.unit-select');
        const orderedQtyInput = row.querySelector('.ordered-qty');
        const receivedQtyInput = row.querySelector('.received-qty');
        const acceptedQtyInput = row.querySelector('.accepted-qty');
        const rejectedQtyInput = row.querySelector('.rejected-qty');
        const balanceQtyInput = row.querySelector('.balance-qty');

        if (particularsInput && particularsInput.value.trim() !== '') {
        items.push({
                itemCode: `${index + 1}`, // Simple item code based on row number
                itemDescription: particularsInput.value.trim(),
                quantityOrdered: orderedQtyInput?.value || '0',
                quantityReceived: receivedQtyInput?.value || '0',
                quantityAccepted: acceptedQtyInput?.value || '0',
                quantityRejected: rejectedQtyInput?.value || '0',
                uom: unitSelect?.value || '',
                unitPrice: '0', // Not implemented yet
                batchNumber: '', // Not in current form
                expiryDate: '', // Not in current form
                mfgDate: '', // Not in current form
                storageLocation: '' // Not in current form
            });
        }
    });

    return items;
}

// Validate modal form
function validateModalForm(formData) {
    if (!formData.grnDate) {
        showModalMessage('Please select GRN Date.', true);
        return false;
    }
    if (!formData.receivedBy) {
        showModalMessage('Please enter Received By.', true);
        return false;
    }
    if (!formData.poNumber) {
        showModalMessage('Please enter Purchase Order Number.', true);
        return false;
    }
    const fromSupplierElement = document.getElementById('fromSupplier');
    const hasPlaceholder = fromSupplierElement?.classList.contains('placeholder');
    if (!formData.supplierName || formData.supplierName === 'Enter supplier name' || formData.supplierName.trim() === '' || hasPlaceholder) {
        showModalMessage('Please enter Supplier Name.', true);
        return false;
    }
    if (!formData.supplierInvoice) {
        showModalMessage('Please enter Tax Invoice Number.', true);
        return false;
    }
    if (!formData.invoiceDate) {
        showModalMessage('Please select Invoice Date.', true);
        return false;
    }
    if (!formData.deliveryChallan) {
        showModalMessage('Please enter Delivery Challan Number.', true);
        return false;
    }

    // Validate items
    if (!formData.items || formData.items.length === 0) {
        showModalMessage('Please add at least one item.', true);
        return false;
    }

    for (const item of formData.items) {
        if (!item.itemDescription || !item.quantityReceived || !item.quantityAccepted || !item.uom) {
            showModalMessage('Please fill all required fields for items (Description, Quantities, Unit).', true);
            return false;
        }
    }

    return true;
}

// Show modal message
function showModalMessage(message, isError = false) {
    const messageDiv = document.querySelector('.submission-message');
    const overlay = document.querySelector('.submission-message-overlay');

    if (messageDiv && overlay) {
        messageDiv.textContent = message;
        messageDiv.className = `submission-message ${isError ? 'error' : ''}`;

        overlay.style.display = 'block';
        messageDiv.style.display = 'block';

        // Auto hide after 3 seconds
        setTimeout(() => {
            overlay.style.display = 'none';
            messageDiv.style.display = 'none';
        }, 3000);
    } else {
        // Fallback to regular message if modal message elements not found
        showMessage(message, isError);
    }
}

// Make functions globally available for onclick handlers
window.addItemRow = addItemRow;
window.deleteLastItemRow = deleteLastItemRow;
window.saveAsDraft = saveAsDraft;
window.printGRN = printGRN;
window.closeGRNModal = closeGRNModal;
