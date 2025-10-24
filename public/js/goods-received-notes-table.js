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

// Initialize modal form functionality
function initializeModalForm() {
    // Generate GRN number
    generateModalGRNNumber();

    // Setup form event listeners
    setupModalFormEventListeners();

    // Setup item calculations
    setupModalItemCalculations();

    // Setup document upload
    setupModalDocumentUpload();
}

// Reset modal form
function resetModalForm() {
    const form = document.getElementById('grnFormModal');
    if (form) {
        form.reset();
    }

    // Clear items container (keep first row)
    const itemsContainer = document.getElementById('itemsContainerModal');
    if (itemsContainer) {
        const itemRows = itemsContainer.querySelectorAll('.item-row');
        for (let i = 1; i < itemRows.length; i++) {
            itemRows[i].remove();
        }
        modalItemRowCounter = 1;
    }

    // Clear document previews
    const documentPreviews = document.getElementById('documentPreviewsModal');
    if (documentPreviews) {
        documentPreviews.innerHTML = '';
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
        const grnNumberInput = document.getElementById('grnNumberModal');
        if (grnNumberInput) {
            grnNumberInput.value = grnNumber;
        }
        modalCurrentGRNId = grnNumber;
    } catch (error) {
        console.error('Error generating GRN number:', error);
    }
}

// Setup modal form event listeners
function setupModalFormEventListeners() {
    const form = document.getElementById('grnFormModal');
    const saveAsDraftButton = document.getElementById('saveAsDraftModal');
    const printButton = document.getElementById('printGRNModal');

    // Form submission
    if (form) {
        form.addEventListener('submit', async function(event) {
            event.preventDefault();
            await submitModalGRN(currentUser);
        });
    }

    // Save as draft
    if (saveAsDraftButton) {
        saveAsDraftButton.addEventListener('click', async function(event) {
            event.preventDefault();
            await saveModalAsDraft(currentUser);
        });
    }

    // Print (placeholder)
    if (printButton) {
        printButton.addEventListener('click', function(event) {
            event.preventDefault();
            showMessage('Print functionality will be implemented soon.', false);
        });
    }
}

// Setup modal item calculations
function setupModalItemCalculations() {
    // Add event listeners for item calculations
    setupModalCalculations();
}

// Setup modal document upload
function setupModalDocumentUpload() {
    const documentUpload = document.getElementById('documentUploadModal');
    const chooseDocumentBtn = document.getElementById('chooseDocumentBtnModal');

    if (chooseDocumentBtn && documentUpload) {
        chooseDocumentBtn.addEventListener('click', () => {
            documentUpload.click();
        });

        documentUpload.addEventListener('change', handleModalDocumentUpload);
    }
}

// Handle modal document upload
async function handleModalDocumentUpload(event) {
    const files = Array.from(event.target.files);
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    const documentPreviews = document.getElementById('documentPreviewsModal');

    for (const file of files) {
        if (file.size > maxFileSize) {
            showMessage(`File ${file.name} is too large. Maximum size is 10MB.`, true);
            continue;
        }

        // Compress image if needed
        let processedFile = file;
        if (file.type.startsWith('image/')) {
            try {
                processedFile = await compressImage(file);
            } catch (error) {
                console.error('Error compressing image:', error);
            }
        }

        // Upload to Supabase Storage
        const fileName = `grn-${Date.now()}-${file.name}`;
        const { data, error } = await supabase.storage
            .from('grn-documents')
            .upload(fileName, processedFile);

        if (error) {
            console.error('Error uploading document:', error);
            showMessage(`Failed to upload ${file.name}`, true);
            continue;
        }

        // Add to uploaded documents
        modalUploadedDocuments.push({
            name: file.name,
            url: data.path,
            size: processedFile.size
        });

        // Add preview
        addModalDocumentPreview(file.name, data.path);
    }
}

// Add document preview in modal
function addModalDocumentPreview(fileName, filePath) {
    const documentPreviews = document.getElementById('documentPreviewsModal');
    if (!documentPreviews) return;

    const previewDiv = document.createElement('div');
    previewDiv.className = 'document-preview';
    previewDiv.innerHTML = `
        <span>${fileName}</span>
        <button type="button" class="remove-doc" onclick="removeModalDocument('${filePath}', this)">&times;</button>
    `;

    documentPreviews.appendChild(previewDiv);
}

// Remove document from modal
function removeModalDocument(filePath, buttonElement) {
    // Remove from uploaded documents
    modalUploadedDocuments = modalUploadedDocuments.filter(doc => doc.url !== filePath);

    // Remove preview
    const previewDiv = buttonElement.parentElement;
    previewDiv.remove();
}

// Compress image
async function compressImage(file) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            // Calculate new dimensions (max 1920px width/height)
            let { width, height } = img;
            const maxDimension = 1920;

            if (width > height) {
                if (width > maxDimension) {
                    height = (height * maxDimension) / width;
                    width = maxDimension;
                }
            } else {
                if (height > maxDimension) {
                    width = (width * maxDimension) / height;
                    height = maxDimension;
                }
            }

            canvas.width = width;
            canvas.height = height;

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(resolve, 'image/jpeg', 0.8);
        };

        img.src = URL.createObjectURL(file);
    });
}

// Setup modal calculations
function setupModalCalculations() {
    // Add listeners for quantity and price changes to calculate totals
    const itemsContainer = document.getElementById('itemsContainerModal');

    if (itemsContainer) {
        itemsContainer.addEventListener('input', function(event) {
            const target = event.target;
            if (target.matches('[id*="quantityOrderedModal"], [id*="quantityReceivedModal"]')) {
                // Could add calculations here if needed
            }
        });
    }
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
        grnNumber: document.getElementById('grnNumberModal')?.value || '',
        grnDate: document.getElementById('grnDateModal')?.value || '',
        receiptDate: document.getElementById('receiptDateModal')?.value || '',
        receivedBy: document.getElementById('receivedByModal')?.value || '',
        poNumber: document.getElementById('poNumberModal')?.value || '',
        poDate: document.getElementById('poDateModal')?.value || '',
        supplierName: document.getElementById('supplierNameModal')?.value || '',
        supplierCode: document.getElementById('supplierCodeModal')?.value || '',
        supplierInvoice: document.getElementById('supplierInvoiceModal')?.value || '',
        invoiceDate: document.getElementById('invoiceDateModal')?.value || '',
        deliveryChallan: document.getElementById('deliveryChallanModal')?.value || '',
        vehicleNumber: document.getElementById('vehicleNumberModal')?.value || '',
        qualityStatus: document.getElementById('qualityStatusModal')?.value || '',
        items: getModalItemsData()
    };
}

// Get modal items data
function getModalItemsData() {
    const items = [];
    const itemRows = document.querySelectorAll('#itemsContainerModal .item-row');

    itemRows.forEach((row, index) => {
        const itemNumber = index + 1;
        items.push({
            itemCode: document.getElementById(`itemCodeModal_${itemNumber}`)?.value || '',
            itemDescription: document.getElementById(`itemDescriptionModal_${itemNumber}`)?.value || '',
            quantityOrdered: document.getElementById(`quantityOrderedModal_${itemNumber}`)?.value || '0',
            quantityReceived: document.getElementById(`quantityReceivedModal_${itemNumber}`)?.value || '0',
            uom: document.getElementById(`uomModal_${itemNumber}`)?.value || '',
            unitPrice: '0', // Not implemented in modal yet
            batchNumber: document.getElementById(`batchNumberModal_${itemNumber}`)?.value || '',
            expiryDate: document.getElementById(`expiryDateModal_${itemNumber}`)?.value || '',
            mfgDate: document.getElementById(`mfgDateModal_${itemNumber}`)?.value || '',
            storageLocation: document.getElementById(`storageLocationModal_${itemNumber}`)?.value || ''
        });
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
        showModalMessage('Please enter PO Number.', true);
        return false;
    }
    if (!formData.poDate) {
        showModalMessage('Please select PO Date.', true);
        return false;
    }
    if (!formData.supplierName) {
        showModalMessage('Please enter Supplier Name.', true);
        return false;
    }
    if (!formData.supplierInvoice) {
        showModalMessage('Please enter Invoice Number.', true);
        return false;
    }
    if (!formData.invoiceDate) {
        showModalMessage('Please select Invoice Date.', true);
        return false;
    }
    if (!formData.deliveryChallan) {
        showModalMessage('Please enter Delivery Challan.', true);
        return false;
    }
    if (!formData.qualityStatus) {
        showModalMessage('Please select Material Condition.', true);
        return false;
    }

    // Validate items
    if (!formData.items || formData.items.length === 0) {
        showModalMessage('Please add at least one item.', true);
        return false;
    }

    for (const item of formData.items) {
        if (!item.itemCode || !item.itemDescription || !item.quantityReceived || !item.uom) {
            showModalMessage('Please fill all required fields for items.', true);
            return false;
        }
    }

    return true;
}

// Show modal message
function showModalMessage(message, isError = false) {
    const messageDiv = document.querySelector('.submission-message-modal');
    const overlay = document.querySelector('.submission-message-overlay-modal');

    if (messageDiv && overlay) {
        messageDiv.textContent = message;
        messageDiv.className = `submission-message-modal ${isError ? 'error' : ''}`;

        overlay.classList.add('show');
        messageDiv.classList.add('show');

        // Auto hide after 3 seconds
        setTimeout(() => {
            overlay.classList.remove('show');
            messageDiv.classList.remove('show');
        }, 3000);
    }
}

// Add item row functions for modal
function addItemRowModal() {
    modalItemRowCounter++;
    const itemsContainer = document.getElementById('itemsContainerModal');

    if (itemsContainer) {
        const newRow = document.createElement('div');
        newRow.className = 'item-row';
        newRow.innerHTML = `
            <div class="item-grid">
                <div class="form-group">
                    <label for="itemCodeModal_${modalItemRowCounter}">Item Code:</label>
                    <input type="text" id="itemCodeModal_${modalItemRowCounter}" placeholder="Enter item code" required>
                </div>
                <div class="form-group">
                    <label for="itemDescriptionModal_${modalItemRowCounter}">Item Description:</label>
                    <input type="text" id="itemDescriptionModal_${modalItemRowCounter}" placeholder="Enter item description" required>
                </div>
                <div class="form-group">
                    <label for="quantityOrderedModal_${modalItemRowCounter}">Qty Ordered:</label>
                    <input type="number" id="quantityOrderedModal_${modalItemRowCounter}" placeholder="0" min="0" step="0.01" required>
                </div>
                <div class="form-group">
                    <label for="quantityReceivedModal_${modalItemRowCounter}">Qty Received:</label>
                    <input type="number" id="quantityReceivedModal_${modalItemRowCounter}" placeholder="0" min="0" step="0.01" required>
                </div>
                <div class="form-group">
                    <label for="uomModal_${modalItemRowCounter}">Unit of Measure:</label>
                    <select id="uomModal_${modalItemRowCounter}" required>
                        <option value="">Select UOM</option>
                        <option value="KG">Kilogram (KG)</option>
                        <option value="PC">Piece (PC)</option>
                        <option value="BOX">Box (BOX)</option>
                        <option value="MTR">Meter (MTR)</option>
                        <option value="LTR">Liter (LTR)</option>
                        <option value="NOS">Numbers (NOS)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="batchNumberModal_${modalItemRowCounter}">Batch Number:</label>
                    <input type="text" id="batchNumberModal_${modalItemRowCounter}" placeholder="Enter batch number">
                </div>
                <div class="form-group">
                    <label for="expiryDateModal_${modalItemRowCounter}">Expiry Date:</label>
                    <input type="date" id="expiryDateModal_${modalItemRowCounter}">
                </div>
                <div class="form-group">
                    <label for="mfgDateModal_${modalItemRowCounter}">Mfg Date:</label>
                    <input type="date" id="mfgDateModal_${modalItemRowCounter}">
                </div>
                <div class="form-group">
                    <label for="storageLocationModal_${modalItemRowCounter}">Storage Location:</label>
                    <input type="text" id="storageLocationModal_${modalItemRowCounter}" placeholder="Enter storage location">
                </div>
            </div>
            <div class="item-actions">
                <button type="button" class="remove-item-btn" onclick="removeItemRowModal(${modalItemRowCounter})">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </div>
        `;

        itemsContainer.appendChild(newRow);

        // Show remove button on first row if more than one row
        const itemRows = itemsContainer.querySelectorAll('.item-row');
        if (itemRows.length > 1) {
            const firstRowRemoveBtn = itemRows[0].querySelector('.remove-item-btn');
            if (firstRowRemoveBtn) {
                firstRowRemoveBtn.style.display = 'block';
            }
        }
    }
}

function removeItemRowModal(rowNumber) {
    const itemsContainer = document.getElementById('itemsContainerModal');
    const rowToRemove = document.getElementById(`itemCodeModal_${rowNumber}`)?.closest('.item-row');

    if (rowToRemove && itemsContainer) {
        rowToRemove.remove();
        modalItemRowCounter--;

        // Hide remove button on first row if only one row remains
        const itemRows = itemsContainer.querySelectorAll('.item-row');
        if (itemRows.length === 1) {
            const firstRowRemoveBtn = itemRows[0].querySelector('.remove-item-btn');
            if (firstRowRemoveBtn) {
                firstRowRemoveBtn.style.display = 'none';
            }
        }
    }
}

// Make functions globally available for onclick handlers
window.addItemRowModal = addItemRowModal;
window.removeItemRowModal = removeItemRowModal;
window.removeModalDocument = removeModalDocument;
