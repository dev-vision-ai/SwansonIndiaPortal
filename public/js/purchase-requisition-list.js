import { supabase } from '../supabase-config.js';

let allRequisitions = [];
let filteredRequisitions = [];
let currentPage = 1;
const itemsPerPage = 10;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    loadRequisitions();
    setupEventListeners();
});

function setupEventListeners() {
    // Filter listeners
    document.getElementById('filterFromDate')?.addEventListener('change', applyFilters);
    document.getElementById('filterToDate')?.addEventListener('change', applyFilters);
    document.getElementById('filterDept')?.addEventListener('change', applyFilters);
    document.getElementById('filterCategory')?.addEventListener('change', applyFilters);
    document.getElementById('filterStatus')?.addEventListener('change', applyFilters);
    document.getElementById('filterPreparedBy')?.addEventListener('change', applyFilters);
    
    // Clear button
    document.getElementById('clearFilter')?.addEventListener('click', clearFilters);
    
    // Pagination buttons
    document.getElementById('prevPageBtn')?.addEventListener('click', previousPage);
    document.getElementById('nextPageBtn')?.addEventListener('click', nextPage);
    // Modal event listeners
    document.getElementById('createRequisitionBtn')?.addEventListener('click', () => openPrModal('create'));
    document.getElementById('closePrModal')?.addEventListener('click', closePrModal);
    document.getElementById('prSaveBtn')?.addEventListener('click', savePrDraft);
    document.getElementById('prSaveSubmitBtn')?.addEventListener('click', submitPr);
    document.getElementById('addItemRowBtn')?.addEventListener('click', addPrItemRow);
    document.getElementById('addNewProductBtn')?.addEventListener('click', () => openAddProductModal());
    // Add Product modal buttons
    document.getElementById('closeAddProductModal')?.addEventListener('click', closeAddProductModal);
    document.getElementById('cancelProductBtn')?.addEventListener('click', closeAddProductModal);
    document.getElementById('saveProductBtn')?.addEventListener('click', saveProductAndInsert);
    // Populate currency dropdown with standard list and default INR
    populateCurrencyList();
}

// ==================== ADD PRODUCT MODAL ====================
function openAddProductModal() {
    const modal = document.getElementById('addProductModal');
    if (!modal) return;
    // reset fields
    ['prodName','prodSKU','prodUOM','prodDesc','prodHSN','prodGST'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    modal.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeAddProductModal() {
    const modal = document.getElementById('addProductModal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

function saveProductAndInsert() {
    const name = document.getElementById('prodName')?.value?.trim();
    if (!name) { alert('Please enter product name'); return; }
    const sku = document.getElementById('prodSKU')?.value?.trim() || '';
    const uom = document.getElementById('prodUOM')?.value?.trim() || '';
    const desc = document.getElementById('prodDesc')?.value?.trim() || '';
    const hsn = document.getElementById('prodHSN')?.value?.trim() || '';
    const gst = document.getElementById('prodGST')?.value || '';

    // Reuse addPrItemRow to insert a new item row prefilled with product data
    addPrItemRow({ item: name, description: desc, uom: uom, qty: '', instock: '', last_purchased: '', sku: sku, hsn: hsn, gst: gst });
    closeAddProductModal();
}



// Populate currency dropdown with the project's standard list and default to INR
function populateCurrencyList() {
    const all = [
        ['INR', 'Indian Rupee (INR)'],
        ['AUD', 'Australian Dollar (AUD)'],
        ['GBP', 'British Pound (GBP)'],
        ['CAD', 'Canadian Dollar (CAD)'],
        ['CNY', 'Chinese Yuan / Renminbi (CNY)'],
        ['EUR', 'Euro (EUR)'],
        ['HKD', 'Hong Kong Dollar (HKD)'],
        ['JPY', 'Japanese Yen (JPY)'],
        ['NZD', 'New Zealand Dollar (NZD)'],
        ['RUB', 'Russian Ruble (RUB)'],
        ['SAR', 'Saudi Riyal (SAR)'],
        ['SGD', 'Singapore Dollar (SGD)'],
        ['ZAR', 'South African Rand (ZAR)'],
        ['KRW', 'South Korean Won (KRW)'],
        ['CHF', 'Swiss Franc (CHF)'],
        ['TRY', 'Turkish Lira (TRY)'],
        ['AED', 'UAE Dirham (AED)'],
        ['USD', 'US Dollar (USD)']
    ];

    const sel = document.getElementById('prCurrency');
    if (!sel) return;

    // Build order: INR first, USD second, then remaining codes alphabetically by code
    const map = new Map(all.map(([code, label]) => [code, label]));
    const special = [];
    if (map.has('INR')) special.push(['INR', map.get('INR')]);
    if (map.has('USD')) special.push(['USD', map.get('USD')]);

    // Collect remaining codes except INR and USD
    const remaining = Array.from(map.keys()).filter(c => c !== 'INR' && c !== 'USD');
    remaining.sort(); // alphabetical by currency code

    // Compose final list
    const finalList = [...special, ...remaining.map(c => [c, map.get(c)])];

    // Populate select
    sel.innerHTML = '';
    finalList.forEach(([code, label]) => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = label;
        sel.appendChild(opt);
    });

    // Default to INR when present
    sel.value = 'INR';
}

// ==================== DATA LOADING ====================
async function loadRequisitions() {
    try {
        const { data, error } = await supabase
            .from('purchase_requisitions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            // Silently ignore if table doesn't exist yet (error code 42P01)
            if (error.code === '42P01') {
                allRequisitions = [];
                showNoDataMessage();
                return;
            }
            console.error('Error loading requisitions:', error);
            showNoDataMessage();
            return;
        }

        if (!data || data.length === 0) {
            allRequisitions = [];
            showNoDataMessage();
        } else {
            allRequisitions = data;
            filteredRequisitions = [...allRequisitions];
            populateFilterDropdowns();
            renderTable();
        }
    } catch (err) {
        // Silently handle any unexpected errors
        allRequisitions = [];
        showNoDataMessage();
    }
}

function populateFilterDropdowns() {
    const deptSet = new Set();
    const categorySet = new Set();
    const preparedBySet = new Set();

    allRequisitions.forEach(req => {
        if (req.department) deptSet.add(req.department);
        if (req.category) categorySet.add(req.category);
        if (req.prepared_by) preparedBySet.add(req.prepared_by);
    });

    // Populate Department
    const deptSelect = document.getElementById('filterDept');
    if (deptSelect) {
        const existingOptions = Array.from(deptSelect.options).map(o => o.value);
        deptSet.forEach(dept => {
            if (!existingOptions.includes(dept)) {
                const option = document.createElement('option');
                option.value = dept;
                option.textContent = dept;
                deptSelect.appendChild(option);
            }
        });
    }

    // Populate Category
    const categorySelect = document.getElementById('filterCategory');
    if (categorySelect) {
        const existingOptions = Array.from(categorySelect.options).map(o => o.value);
        categorySet.forEach(category => {
            if (!existingOptions.includes(category)) {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categorySelect.appendChild(option);
            }
        });
    }

    // Populate Prepared By
    const preparedBySelect = document.getElementById('filterPreparedBy');
    if (preparedBySelect) {
        const existingOptions = Array.from(preparedBySelect.options).map(o => o.value);
        preparedBySet.forEach(preparedBy => {
            if (!existingOptions.includes(preparedBy)) {
                const option = document.createElement('option');
                option.value = preparedBy;
                option.textContent = preparedBy;
                preparedBySelect.appendChild(option);
            }
        });
    }

    // Also populate the modal dept/currency selects if present
    const prDeptSelect = document.getElementById('prDepartment');
    if (prDeptSelect) {
        const existingOptions = Array.from(prDeptSelect.options).map(o => o.value);
        deptSet.forEach(dept => {
            if (!existingOptions.includes(dept)) {
                const option = document.createElement('option');
                option.value = dept;
                option.textContent = dept;
                prDeptSelect.appendChild(option);
            }
        });
    }

    const prCurrencySelect = document.getElementById('prCurrency');
    if (prCurrencySelect) {
        // Derive a small set from data currencies (if present) or from common list
        const currencySet = new Set(allRequisitions.map(r => r.currency).filter(Boolean));
        if (currencySet.size === 0) {
            ['INR', 'USD', 'EUR'].forEach(c => currencySet.add(c));
        }
        const existingCurr = Array.from(prCurrencySelect.options).map(o => o.value);
        currencySet.forEach(c => {
            if (!existingCurr.includes(c)) {
                const opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                prCurrencySelect.appendChild(opt);
            }
        });
    }
}

// ==================== FILTERING ====================
function applyFilters() {
    const fromDate = document.getElementById('filterFromDate')?.value;
    const toDate = document.getElementById('filterToDate')?.value;
    const dept = document.getElementById('filterDept')?.value;
    const category = document.getElementById('filterCategory')?.value;
    const status = document.getElementById('filterStatus')?.value;
    const preparedBy = document.getElementById('filterPreparedBy')?.value;

    filteredRequisitions = allRequisitions.filter(req => {
        const reqDate = req.requisition_date ? new Date(req.requisition_date).toISOString().split('T')[0] : null;

        let match = true;

        if (fromDate && reqDate < fromDate) match = false;
        if (toDate && reqDate > toDate) match = false;
        if (dept && req.department !== dept) match = false;
        if (category && req.category !== category) match = false;
        if (status && req.status !== status) match = false;
        if (preparedBy && req.prepared_by !== preparedBy) match = false;

        return match;
    });

    currentPage = 1;
    updateFilterStatus();
    renderTable();
}

function updateFilterStatus() {
    const fromDate = document.getElementById('filterFromDate')?.value;
    const toDate = document.getElementById('filterToDate')?.value;
    const dept = document.getElementById('filterDept')?.value;
    const category = document.getElementById('filterCategory')?.value;
    const status = document.getElementById('filterStatus')?.value;
    const preparedBy = document.getElementById('filterPreparedBy')?.value;

    const isFiltered = fromDate || toDate || dept || category || status || preparedBy;
    const statusIndicator = document.getElementById('filterStatusIndicator');
    if (statusIndicator) {
        if (isFiltered) {
            statusIndicator.textContent = 'On';
            statusIndicator.className = 'px-2 py-1 text-sm font-semibold rounded-full bg-green-200 text-green-700';
        } else {
            statusIndicator.textContent = 'Off';
            statusIndicator.className = 'px-2 py-1 text-sm font-semibold rounded-full bg-gray-200 text-gray-700';
        }
    }
}

function clearFilters() {
    document.getElementById('filterFromDate').value = '';
    document.getElementById('filterToDate').value = '';
    document.getElementById('filterDept').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterPreparedBy').value = '';

    filteredRequisitions = [...allRequisitions];
    currentPage = 1;
    updateFilterStatus();
    renderTable();
}

// ==================== TABLE RENDERING ====================
function renderTable() {
    const tbody = document.getElementById('requisitionsTableBody');
    if (!tbody) return;

    if (filteredRequisitions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="py-8 text-center text-gray-500">No requisitions found</td></tr>';
        updatePagination();
        return;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = filteredRequisitions.slice(start, end);

    tbody.innerHTML = pageData.map((req, index) => `
        <tr>
            <td>${start + index + 1}</td>
            <td>${formatDate(req.requisition_date) || '-'}</td>
            <td>${req.requisition_no || '-'}</td>
            <td>${req.created_by || '-'}</td>
            <td>${req.category || '-'}</td>
            <td>${req.total_items || 0}</td>
            <td>${getStatusBadge(req.status)}</td>
            <td>
                <button onclick="viewRequisition('${req.id}')" title="View" class="action-icon">
                    <i class="fas fa-eye"></i>
                </button>
                <button onclick="editRequisition('${req.id}')" title="Edit" class="action-icon">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="approveRequisition('${req.id}')" title="Approve" class="action-icon">
                    <i class="fas fa-check"></i>
                </button>
                <button onclick="deleteRequisition('${req.id}')" title="Delete" class="action-icon">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
            <td>
                <button onclick="downloadRequisition('${req.id}')" title="Download PDF" class="action-icon">
                    <i class="fas fa-download"></i>
                </button>
            </td>
        </tr>
    `).join('');

    updatePagination();
}

function getStatusBadge(status) {
    const statusMap = {
        'pending': '<span class="status-badge status-pending">Pending</span>',
        'approved': '<span class="status-badge status-approved">Approved</span>',
        'rejected': '<span class="status-badge status-rejected">Rejected</span>'
    };
    return statusMap[status] || `<span class="text-gray-600">${status || 'Unknown'}</span>`;
}

function showNoDataMessage() {
    const tbody = document.getElementById('requisitionsTableBody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="9" class="py-8 text-center text-gray-500">No data available</td></tr>';
    }
    updatePagination();
}

// ==================== PAGINATION ====================
function updatePagination() {
    const totalPages = Math.ceil(filteredRequisitions.length / itemsPerPage);
    document.getElementById('currentPageDisplay').textContent = currentPage;
    document.getElementById('totalPagesDisplay').textContent = totalPages;
    
    document.getElementById('prevPageBtn').disabled = currentPage === 1;
    document.getElementById('nextPageBtn').disabled = currentPage === totalPages;
}

function nextPage() {
    const totalPages = Math.ceil(filteredRequisitions.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderTable();
        window.scrollTo(0, 0);
    }
}

function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
        window.scrollTo(0, 0);
    }
}

// ==================== ACTION FUNCTIONS ====================
async function viewRequisition(id) {
    console.log('View requisition:', id);
    const req = allRequisitions.find(r => r.id === id || String(r.id) === String(id));
    if (req) openPrModal('view', req);
}

async function editRequisition(id) {
    console.log('Edit requisition:', id);
    const req = allRequisitions.find(r => r.id === id || String(r.id) === String(id));
    if (req) openPrModal('edit', req);
}

// ==================== PURCHASE REQUISITION MODAL ====================
function openPrModal(mode = 'create', data = null) {
    const modal = document.getElementById('purchaseRequisitionModal');
    if (!modal) return;
    // Reset content for create mode, populate for edit/view modes
    if (mode === 'create') {
        resetPrForm();
    } else if (data) {
        populatePrForm(data, mode);
    }
    setPrFormMode(mode);
    modal.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    // prepare one default row if empty
    const tbody = document.getElementById('prItemListBody');
    if (tbody && tbody.children.length === 0) addPrItemRow();
}

function closePrModal() {
    const modal = document.getElementById('purchaseRequisitionModal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

function resetPrForm() {
    document.getElementById('prDepartment').value = '';
    document.getElementById('prNo').value = '';
    document.getElementById('prWhenRequired').value = '';
    document.getElementById('prPurpose').value = '';
    // Default currency should be INR
    const prCurrencyEl = document.getElementById('prCurrency');
    if (prCurrencyEl) prCurrencyEl.value = 'INR';
    // clear item rows
    const tbody = document.getElementById('prItemListBody');
    if (tbody) tbody.innerHTML = '';
}

function populatePrForm(data, mode) {
    // Fill basic details
    document.getElementById('prDepartment').value = data.department || '';
    document.getElementById('prNo').value = data.requisition_no || '';
    document.getElementById('prWhenRequired').value = data.when_required || '';
    document.getElementById('prPurpose').value = data.purpose || '';
    document.getElementById('prCurrency').value = data.currency || '';
    // Items (if any)
    const tbody = document.getElementById('prItemListBody');
    if (tbody) {
        tbody.innerHTML = '';
        const items = data.items || [];
        if (items.length === 0) addPrItemRow();
        items.forEach((it, index) => addPrItemRow(it));
    }
}

function setPrFormMode(mode) {
    const readonly = (mode === 'view');
    // Inputs
    ['prDepartment', 'prNo', 'prWhenRequired', 'prPurpose', 'prCurrency'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = readonly;
    });
    // Item table - handle contenteditable cells
    const tbody = document.getElementById('prItemListBody');
    if (tbody) {
        // Disable contenteditable cells
        tbody.querySelectorAll('td[contenteditable]').forEach(cell => {
            cell.contentEditable = readonly ? 'false' : 'true';
        });
        // Disable/enable inputs (date inputs etc.)
        tbody.querySelectorAll('input, select').forEach(el => {
            el.disabled = readonly;
        });
        // Hide delete buttons in view mode
        tbody.querySelectorAll('button.pr-item-delete').forEach(btn => {
            btn.style.display = readonly ? 'none' : '';
        });
    }
    // Buttons
    document.getElementById('prSaveBtn').style.display = readonly ? 'none' : '';
    document.getElementById('prSaveSubmitBtn').style.display = readonly ? 'none' : '';
}

function addPrItemRow(item = {}) {
    const tbody = document.getElementById('prItemListBody');
    if (!tbody) return;
    const rowIndex = tbody.children.length + 1;
    const tr = document.createElement('tr');
    
    const itemText = item.item || '';
    const descText = item.description || '';
    const uomText = item.uom || '';
    const qtyText = item.qty || '';
    const instockText = item.instock || '';
    const lastPurchasedText = item.last_purchased || '';

    // normalize date value to yyyy-mm-dd for input.value when possible
    let dateInputValue = '';
    if (lastPurchasedText) {
        // try to parse common formats
        const d = new Date(lastPurchasedText);
        if (!isNaN(d.getTime())) {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            dateInputValue = `${yyyy}-${mm}-${dd}`;
        } else {
            // if it's already in yyyy-mm-dd, keep it
            dateInputValue = lastPurchasedText;
        }
    }

    tr.innerHTML = `
        <td class="pr-item-sr">${rowIndex}</td>
        <td contenteditable="true" class="pr-item-select" data-placeholder="Item name">${itemText}</td>
        <td contenteditable="true" class="pr-item-desc" data-placeholder="Description">${descText}</td>
        <td contenteditable="true" class="pr-item-uom" data-placeholder="Unit">${uomText}</td>
        <td contenteditable="true" class="pr-item-qty" data-placeholder="0">${qtyText}</td>
        <td contenteditable="true" class="pr-item-instock" data-placeholder="0">${instockText}</td>
        <td class="pr-item-last-purchased"><input type="date" class="pr-item-last-purchased-input" value="${dateInputValue}" /></td>
        <td class="pr-item-actions"><button type="button" class="pr-item-delete" style="background: none; border: none; cursor: pointer; color: #ef4444; font-size: 1rem; padding: 0;">🗑</button></td>
    `;
    // attach metadata attributes if provided
    if (item.sku) tr.setAttribute('data-sku', item.sku);
    if (item.hsn) tr.setAttribute('data-hsn', item.hsn);
    if (item.gst) tr.setAttribute('data-gst', item.gst);
    tbody.appendChild(tr);
    
    tr.querySelector('.pr-item-delete').addEventListener('click', (e) => {
        e.preventDefault();
        tr.remove();
        renumberPrRows();
    });
}

function renumberPrRows() {
    const tbody = document.getElementById('prItemListBody');
    if (!tbody) return;
    Array.from(tbody.children).forEach((tr, idx) => {
        tr.querySelector('td').textContent = idx + 1;
    });
}

async function savePrDraft() {
    // For now, perform a basic validation and mock save using supabase insert
    const data = collectPrData();
    try {
        const { data: res, error } = await supabase.from('purchase_requisitions').insert([data]);
        if (error) throw error;
        alert('Requisition saved (draft)');
        closePrModal();
        loadRequisitions();
    } catch (err) {
        console.error('Error saving requisition:', err);
        alert('Failed to save requisition');
    }
}

async function submitPr() {
    const data = collectPrData();
    data.status = 'pending';
    try {
        const { data: res, error } = await supabase.from('purchase_requisitions').insert([data]);
        if (error) throw error;
        alert('Requisition saved and submitted');
        closePrModal();
        loadRequisitions();
    } catch (err) {
        console.error('Error submitting requisition:', err);
        alert('Failed to submit requisition');
    }
}

function collectPrData() {
    // Collect fields and items into an object
    const department = document.getElementById('prDepartment')?.value;
    const requisition_no = document.getElementById('prNo')?.value;
    const when_required = document.getElementById('prWhenRequired')?.value;
    const purpose = document.getElementById('prPurpose')?.value;
    const currency = document.getElementById('prCurrency')?.value;

    const items = [];
    const tbody = document.getElementById('prItemListBody');
    if (tbody) {
        Array.from(tbody.children).forEach(tr => {
            const cells = tr.querySelectorAll('td');
            if (cells.length >= 8) {
                const item = cells[1].textContent?.trim() || '';
                const desc = cells[2].textContent?.trim() || '';
                const uom = cells[3].textContent?.trim() || '';
                const qty = parseFloat(cells[4].textContent?.trim()) || 0;
                const instock = cells[5].textContent?.trim() || '';
                // if there's a date input in the cell prefer its value
                let last_purchased = '';
                const dateInput = cells[6].querySelector && cells[6].querySelector('input[type="date"]');
                if (dateInput && dateInput.value) {
                    last_purchased = dateInput.value;
                } else {
                    last_purchased = cells[6].textContent?.trim() || '';
                }
                items.push({ item, description: desc, uom, qty, instock, last_purchased });
            }
        });
    }
    return { department, requisition_no, when_required, purpose, currency, items, total_estimated: 0 };
}

async function approveRequisition(id) {
    try {
        const { error } = await supabase
            .from('purchase_requisitions')
            .update({ status: 'approved', updated_at: new Date() })
            .eq('id', id);

        if (error) {
            console.error('Error approving requisition:', error);
            alert('Failed to approve requisition');
            return;
        }

        alert('Requisition approved successfully');
        loadRequisitions();
    } catch (err) {
        console.error('Unexpected error:', err);
        alert('An error occurred while approving');
    }
}

async function deleteRequisition(id) {
    if (!confirm('Are you sure you want to delete this requisition?')) return;

    try {
        const { error } = await supabase
            .from('purchase_requisitions')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting requisition:', error);
            alert('Failed to delete requisition');
            return;
        }

        alert('Requisition deleted successfully');
        loadRequisitions();
    } catch (err) {
        console.error('Unexpected error:', err);
        alert('An error occurred while deleting');
    }
}

async function downloadRequisition(id) {
    try {
        const response = await fetch(`/api/export-purchase-requisition?id=${id}`);
        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `requisition-${id}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } else {
            alert('Failed to download requisition');
        }
    } catch (err) {
        console.error('Error downloading:', err);
        alert('An error occurred while downloading');
    }
}

// ==================== UTILITY FUNCTIONS ====================
function formatDate(dateString) {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Export functions for HTML onclick handlers
window.viewRequisition = viewRequisition;
window.editRequisition = editRequisition;
window.approveRequisition = approveRequisition;
window.deleteRequisition = deleteRequisition;
window.downloadRequisition = downloadRequisition;
window.clearFilters = clearFilters;
window.nextPage = nextPage;
window.previousPage = previousPage;
