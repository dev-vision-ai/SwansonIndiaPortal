import { supabase } from '../supabase-config.js';
import { showToast, storePendingToast } from './toast.js';

const PD_ROWS_PER_PAGE = 8;
let currentSort = { column: 'date', direction: 'desc' };
let jobCostRecordsData = []; // Store fetched records globally for sorting and filtering
let pdCurrentPage = 1;
let formSubmitAttached = false; // Flag to prevent duplicate form submit listeners
let autocompleteAttached = false; // Flag to prevent duplicate autocomplete listeners
let isProcessing = false; // Global safety lock to prevent double submissions

function formatDateToDDMMYYYY(dateString) {
  if (!dateString) return 'N/A';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid Date';

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Render paginated table of job cost records with sorting and action buttons
 * @param {Array} data - Array of job cost record objects to display
 */
function renderTable(data) {
  const tbody = document.getElementById('jobCostRecordsTableBody');
  if (!tbody) return;

  // Calculate pagination
  const totalRecords = data.length;
  const totalPages = Math.ceil(totalRecords / PD_ROWS_PER_PAGE);
  const startIndex = (pdCurrentPage - 1) * PD_ROWS_PER_PAGE;
  const endIndex = startIndex + PD_ROWS_PER_PAGE;
  const pageData = data.slice(startIndex, endIndex);

  // Update pagination info
  const pageStartRow = document.getElementById('pdPageStartRow');
  const pageEndRow = document.getElementById('pdPageEndRow');
  const totalRecordsSpan = document.getElementById('pdTotalRecords');
  const pageNumberSpan = document.getElementById('pdCurrentPage');
  const totalPagesSpan = document.getElementById('pdTotalPages');
  const prevBtn = document.getElementById('pdPrevPageBtn');
  const nextBtn = document.getElementById('pdNextPageBtn');

  if (pageStartRow) pageStartRow.textContent = totalRecords === 0 ? '0' : startIndex + 1;
  if (pageEndRow) pageEndRow.textContent = Math.min(endIndex, totalRecords);
  if (totalRecordsSpan) totalRecordsSpan.textContent = totalRecords;
  if (pageNumberSpan) pageNumberSpan.textContent = totalRecords === 0 ? '0' : pdCurrentPage;
  if (totalPagesSpan) totalPagesSpan.textContent = totalRecords === 0 ? '1' : totalPages;

  if (prevBtn) prevBtn.disabled = pdCurrentPage <= 1;
  if (nextBtn) nextBtn.disabled = pdCurrentPage >= totalPages;

  tbody.innerHTML = pageData.map((record, index) => {
    // Validate record.id
    if (!record.id) {
      console.warn('Record missing ID:', record);
      return ''; // Skip rendering this row
    }

    // Reverse Sr No: latest record gets Sr No 1
    const reversedIndex = totalRecords - (startIndex + index);
    
    return `
    <tr data-id="${record.id}">
      <td>${reversedIndex}</td>
      <td>${formatDateToDDMMYYYY(record.date)}</td>
      <td>${record.shift || 'N/A'}</td>
      <td>${record.machine || 'N/A'}</td>
      <td>${record.customer || 'N/A'}</td>
      <td>${record.prod_code || 'N/A'}</td>
      <td>${record.specification || 'N/A'}</td>
      <td>${record.operator || 'N/A'}</td>
      <td>${record.supervisor || 'N/A'}</td>
      <td>
        <div class="action-icons">
          <button class="action-btn view-btn p-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 hover:text-blue-900 transition-all duration-200 border border-blue-200 hover:border-blue-300 flex-shrink-0" data-id="${record.id}" title="View Record">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
          </button>
          <button class="action-btn edit-btn p-1.5 rounded-md bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-800 transition-all duration-200 border border-green-200 hover:border-green-300 flex-shrink-0" data-id="${record.id}" title="Edit Record">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>
          <button class="action-btn add-data-btn p-1.5 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-600 hover:text-sky-800 transition-all duration-200 border border-sky-200 hover:border-sky-300 flex-shrink-0" data-id="${record.id}" title="Add Consumption Data">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
          </button>
          <button class="action-btn delete-btn p-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 transition-all duration-200 border border-red-200 hover:border-red-300 flex-shrink-0" data-id="${record.id}" title="Delete Record">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `;
  }).join('');
}

function sortData(column) {
  if (currentSort.column === column) {
    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort = { column, direction: 'desc' };
  }

  // Always sort by date descending first (latest on top), then by selected column
  jobCostRecordsData.sort((a, b) => {
    // Primary sort: by date descending (latest first)
    const dateA = new Date(a.date || 0);
    const dateB = new Date(b.date || 0);
    const dateDiff = dateB - dateA;
    
    if (dateDiff !== 0) return dateDiff; // If dates differ, use date sort
    
    // Secondary sort: by selected column if dates are same
    if (currentSort.column !== 'date') {
      const modifier = currentSort.direction === 'asc' ? 1 : -1;
      const aValue = a[currentSort.column];
      const bValue = b[currentSort.column];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return aValue.localeCompare(bValue) * modifier;
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * modifier;
      }
    }
    return 0;
  });

  pdCurrentPage = 1; // Reset to first page after sorting
  renderTable(jobCostRecordsData);
}

async function applyFilters() {
  const dateFromValue = document.getElementById('filterDateFrom')?.value || '';
  const dateToValue = document.getElementById('filterDateTo')?.value || '';
  const machineValue = document.getElementById('filterMachine')?.value || '';
  const productValue = document.getElementById('filterProduct')?.value || '';
  const shiftValue = document.getElementById('filterShift')?.value || '';
  const customerValue = document.getElementById('filterCustomer')?.value || '';

  const filters = {
    dateFrom: dateFromValue,
    dateTo: dateToValue,
    machine: machineValue,
    product: productValue,
    shift: shiftValue,
    customer: customerValue
  };

  // Trigger a new Supabase query with filters
  await fetchJobCostRecords(filters);

  // Reset to first page after filtering
  pdCurrentPage = 1;

  // Update filter status
  const isFiltered = dateFromValue || dateToValue || machineValue || productValue || shiftValue || customerValue;
  const filterStatus = document.getElementById('filterStatus');
  if (filterStatus) {
    filterStatus.textContent = isFiltered ? 'On' : 'Off';
    filterStatus.style.color = isFiltered ? '#059669' : '#d97706';
  }
}

async function clearFilters() {
  const dateFromInput = document.getElementById('filterDateFrom');
  const dateToInput = document.getElementById('filterDateTo');
  const machineInput = document.getElementById('filterMachine');
  const productInput = document.getElementById('filterProduct');
  const shiftInput = document.getElementById('filterShift');
  const customerInput = document.getElementById('filterCustomer');

  if (dateFromInput) dateFromInput.value = '';
  if (dateToInput) dateToInput.value = '';
  if (machineInput) machineInput.value = '';
  if (productInput) productInput.value = '';
  if (shiftInput) shiftInput.value = '';
  if (customerInput) customerInput.value = '';

  // Reset filter status
  const filterStatus = document.getElementById('filterStatus');
  if (filterStatus) {
    filterStatus.textContent = 'Off';
    filterStatus.style.color = '#d97706';
  }

  await applyFilters();
}

function setupEventListeners() {
  // Fetch records on page load
  fetchJobCostRecords();

  // Setup pagination event listeners
  const prevBtn = document.getElementById('pdPrevPageBtn');
  const nextBtn = document.getElementById('pdNextPageBtn');
  
  if (prevBtn) prevBtn.addEventListener('click', () => {
    if (pdCurrentPage > 1) {
      pdCurrentPage--;
      renderTable(jobCostRecordsData);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  if (nextBtn) nextBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(jobCostRecordsData.length / PD_ROWS_PER_PAGE);
    if (pdCurrentPage < totalPages) {
      pdCurrentPage++;
      renderTable(jobCostRecordsData);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // Setup filter event listeners
  const dateFromInput = document.getElementById('filterDateFrom');
  const dateToInput = document.getElementById('filterDateTo');
  const machineInput = document.getElementById('filterMachine');
  const productInput = document.getElementById('filterProduct');
  const shiftInput = document.getElementById('filterShift');
  const customerInput = document.getElementById('filterCustomer');
  const clearBtn = document.getElementById('clearFilters');

  if (dateFromInput) dateFromInput.addEventListener('change', applyFilters);
  if (dateToInput) dateToInput.addEventListener('change', applyFilters);
  if (machineInput) machineInput.addEventListener('change', applyFilters);
  if (productInput) productInput.addEventListener('change', applyFilters);
  if (shiftInput) shiftInput.addEventListener('change', applyFilters);
  if (customerInput) customerInput.addEventListener('change', applyFilters);
  if (clearBtn) clearBtn.addEventListener('click', clearFilters);

  document.addEventListener('click', handleButtonActions);
}

function handleButtonActions(e) {
  if (e.target.closest('.action-btn')) {
    const button = e.target.closest('.action-btn');
    let recordId = button.dataset.id;

    // Fallback: if button doesn't have data-id, try to get it from the parent row
    if (!recordId) {
      const row = button.closest('tr');
      recordId = row ? row.dataset.id : null;
    }

    if (button.classList.contains('view-btn')) {
      if (!recordId) {
        showToast('Error: Could not find record ID. Please refresh and try again.', 'error');
        return;
      }
      window.location.href = `pd_material_consumption_view.html?id=${recordId}&action=view`;
    } else if (button.classList.contains('edit-btn')) {
      if (!recordId) {
        showToast('Error: Could not find record ID. Please refresh and try again.', 'error');
        return;
      }
      editRecordInModal(recordId);
    } else if (button.classList.contains('add-data-btn')) {
      if (!recordId || recordId === 'undefined') {
        showToast('Error: Could not find record ID. Please try again.', 'error');
        console.error('Invalid recordId for add-data-btn:', recordId, 'Button:', button);
        return;
      }
      window.location.href = `pd-material-consumption-data.html?id=${recordId}&action=add`;
    } else if (button.classList.contains('delete-btn')) {
      if (!recordId) {
        showToast('Error: Could not find record ID. Please refresh and try again.', 'error');
        return;
      }
      if (confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
        deleteRecord(recordId);
      }
    }
  }
}

async function editRecordInModal(recordId) {
  try {
    const { data: record, error } = await supabase
      .from('pd_material_consumption_records')
      .select('*')
      .eq('id', recordId)
      .single();

    if (error) {
      console.error('Error fetching record for editing:', error);
      showToast('Failed to load record for editing: ' + (error.message || JSON.stringify(error)), 'error');
      return;
    }

    if (!record) {
      showToast('Record not found.', 'error');
      return;
    }

    // Populate the modal form with existing data
    const dateInput = document.getElementById('ds_date');
    const prodCodeInput = document.getElementById('ds_prod_code');
    const customerInput = document.getElementById('ds_customer');
    const specInput = document.getElementById('ds_specification');
    const machineInput = document.getElementById('ds_machine');
    const shiftInput = document.getElementById('ds_shift');
    const operatorInput = document.getElementById('ds_operator');
    const supervisorInput = document.getElementById('ds_supervisor');

    if (dateInput) dateInput.value = record.production_date || '';
    if (prodCodeInput) prodCodeInput.value = record.product_code || '';
    if (customerInput) customerInput.value = record.customer || '';
    if (specInput) specInput.value = record.specification || '';
    if (machineInput) machineInput.value = record.machine_no || '';
    if (shiftInput) shiftInput.value = record.shift || '';
    if (operatorInput) operatorInput.value = record.operator_name || '';
    if (supervisorInput) supervisorInput.value = record.supervisor_name || '';

    // Change modal title and button text
    const modalTitle = document.querySelector('#dailyStockOverlay h3');
    const submitBtn = document.getElementById('ds_submit');
    
    if (modalTitle) modalTitle.textContent = 'Edit Daily Stock Record';
    if (submitBtn) submitBtn.textContent = 'Update';

    // Store the record ID for update operation
    const form = document.getElementById('dailyStockForm');
    if (form) {
      form.dataset.editId = recordId;
      form.dataset.isEdit = 'true';
    }

    // Show the modal
    showDailyStockOverlay();

  } catch (err) {
    console.error('Error loading record for editing:', err);
    showToast('Failed to load record for editing. See console for details.', 'error');
  }
}

async function deleteRecord(recordId) {
  if (isProcessing) return;
  
  try {
    isProcessing = true;
    
    const { error } = await supabase
      .from('pd_material_consumption_records')
      .delete()
      .eq('id', recordId);

    if (error) {
      console.error('Error deleting record:', error);
      showToast('Failed to delete record: ' + (error.message || JSON.stringify(error)), 'error');
      return;
    }

    showToast('Record deleted successfully!', 'success');
    
    // Refresh the table
    await fetchJobCostRecords();
    
  } catch (err) {
    console.error('Error deleting record:', err);
    showToast('Failed to delete record. See console for details.', 'error');
  } finally {
    isProcessing = false;
  }
}

/**
 * Fetch job cost records from Supabase with optional filtering
 * @param {Object} filters - Optional filter object with dateFrom, dateTo, machine, product, shift, customer properties
 */
async function fetchJobCostRecords(filters = null) {
  try {
    const tbody = document.getElementById('jobCostRecordsTableBody');
    if (tbody) tbody.classList.add('loading');

    // Build query
    let query = supabase
      .from('pd_material_consumption_records')
      .select('*')
      .order('production_date', { ascending: false });

    // Apply filters if provided, otherwise limit to 50
    const hasFilters = filters && Object.values(filters).some(v => v !== '');
    
    if (hasFilters) {
      if (filters.dateFrom) query = query.gte('production_date', filters.dateFrom);
      if (filters.dateTo) query = query.lte('production_date', filters.dateTo);
      if (filters.machine) query = query.eq('machine_no', filters.machine);
      if (filters.product) query = query.eq('product_code', filters.product);
      if (filters.shift) query = query.eq('shift', filters.shift);
      if (filters.customer) query = query.eq('customer', filters.customer);
    } else {
      query = query.limit(50);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === 'PGRST116') {
        showToast('Table does not exist. Ensure pd_material_consumption_records table is created in Supabase.', 'error');
      } else {
        showToast('Failed to load production material consumption records.', 'error');
      }
      return;
    }

    // Map database columns to UI format
    jobCostRecordsData = (data || []).map(record => ({
      id: record.id,
      date: record.production_date,
      prod_code: record.product_code,
      machine: record.machine_no,
      shift: record.shift,
      operator: record.operator_name,
      supervisor: record.supervisor_name,
      customer: record.customer,
      specification: record.specification
    }));

    // Ensure latest records are shown first (sort by date descending)
    jobCostRecordsData.sort((a, b) => {
      const dateA = new Date(a.date || 0);
      const dateB = new Date(b.date || 0);
      return dateB - dateA;
    });

    // Reset to first page after fetching
    pdCurrentPage = 1;

    if (jobCostRecordsData.length === 0) {
      showToast(hasFilters ? 'No records found matching the filters.' : 'No production material consumption records found. Create your first record.', 'info');
    } else {
      renderTable(jobCostRecordsData);
      // Only populate filters on initial load (when no filters are active)
      if (!hasFilters) {
        populateMachineFilter();
        populateProductFilter();
        populateCustomerFilter();
      }
    }
    populateProductFilter();
    populateCustomerFilter();

  } catch (error) {
    console.error('Error fetching production material consumption records:', error);
    showToast('Failed to load production material consumption records. Please try again.', 'error');
  } finally {
    const tbody = document.getElementById('jobCostRecordsTableBody');
    if (tbody) tbody.classList.remove('loading');
  }
}

/**
 * Factory function to populate filter dropdowns with unique values from job cost records
 * @param {string} elementId - The ID of the select element to populate
 * @param {string} fieldName - The field name to extract unique values from records
 * @param {string} label - The label for the "All" option
 */
function populateFilterDropdown(elementId, fieldName, label = 'All') {
  const selectElement = document.getElementById(elementId);
  if (!selectElement) return;

  // Extract unique values from records, filtering out null/undefined/empty values
  const uniqueValues = [...new Set(jobCostRecordsData.map(record => record[fieldName]).filter(Boolean))];

  // Clear existing options except the first one
  selectElement.innerHTML = `<option value="">${label}</option>`;

  // Add unique value options
  uniqueValues.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    selectElement.appendChild(option);
  });
}

// Consolidated filter population functions using the factory
function populateMachineFilter() {
  populateFilterDropdown('filterMachine', 'machine');
}

function populateProductFilter() {
  populateFilterDropdown('filterProduct', 'prod_code');
}

function populateCustomerFilter() {
  populateFilterDropdown('filterCustomer', 'customer');
}

/**
 * Utility function to create and position autocomplete dropdown
 * @param {HTMLElement} inputElement - The input element to attach dropdown to
 * @param {Array} items - Array of items to display in dropdown
 * @param {Function} onItemClick - Callback function when an item is clicked
 * @param {string} dropdownId - Optional ID for the dropdown element
 * @param {boolean} useAbsolutePositioning - Whether to use absolute positioning relative to viewport
 * @returns {HTMLElement} The created dropdown element
 */
function createAutocompleteDropdown(inputElement, items, onItemClick, dropdownId = null, useAbsolutePositioning = false) {
  // Remove any existing dropdown
  const existingDropdown = dropdownId ? document.getElementById(dropdownId) : null;
  if (existingDropdown) existingDropdown.remove();

  if (!items || items.length === 0) return null;

  // Create dropdown container
  const dropdown = document.createElement('div');
  if (dropdownId) dropdown.id = dropdownId;
  dropdown.className = 'absolute z-50 border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto';
  dropdown.style.background = '#eaf4fb';

  // Add items to dropdown
  items.forEach(item => {
    const itemElement = document.createElement('div');
    itemElement.className = 'px-3 py-2 hover:bg-blue-200 cursor-pointer text-sm';
    itemElement.textContent = typeof item === 'string' ? item : item.displayText || item;

    itemElement.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      onItemClick(item, inputElement);
      dropdown.remove();
    });

    dropdown.appendChild(itemElement);
  });

  // Position dropdown
  if (useAbsolutePositioning) {
    // Position relative to viewport (for name autocomplete)
    document.body.appendChild(dropdown);
    const rect = inputElement.getBoundingClientRect();
    dropdown.style.top = (rect.bottom + window.scrollY) + 'px';
    dropdown.style.left = rect.left + 'px';
    dropdown.style.width = rect.width + 'px';
  } else {
    // Position relative to parent (for product code autocomplete)
    const parent = inputElement.parentNode;
    parent.style.position = 'relative';
    parent.appendChild(dropdown);
    dropdown.style.top = '100%';
    dropdown.style.left = '0';
    dropdown.style.width = '100%';
    dropdown.style.marginTop = '2px';
  }

  return dropdown;
}

/**
 * Utility function to setup common autocomplete event listeners
 * @param {HTMLElement} inputElement - The input element
 * @param {Function} getDropdown - Function that returns the current dropdown element
 * @param {Function} cleanup - Function to call when cleaning up dropdown
 */
function setupAutocompleteEventListeners(inputElement, getDropdown, cleanup = null) {
  // Remove dropdown when clicking outside
  document.addEventListener('click', function(e) {
    const dropdown = getDropdown();
    if (dropdown && !inputElement.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.remove();
      if (cleanup) cleanup();
    }
  });

  // Remove dropdown on blur with delay to allow clicks
  inputElement.addEventListener('blur', function() {
    setTimeout(() => {
      const dropdown = getDropdown();
      if (dropdown) {
        dropdown.remove();
        if (cleanup) cleanup();
      }
    }, 150);
  });
}

setupEventListeners();

// --- Daily Stock Overlay handlers ---
function showDailyStockOverlay() {
  const ov = document.getElementById('dailyStockOverlay');
  if (ov) ov.classList.remove('hidden');
}

function closeDailyStockOverlay() {
  const ov = document.getElementById('dailyStockOverlay');
  if (ov) ov.classList.add('hidden');
  
  // Clear all form fields
  const form = document.getElementById('dailyStockForm');
  if (form) {
    form.reset();
    // Clear individual field values to ensure they're empty
    document.getElementById('ds_date').value = '';
    document.getElementById('ds_prod_code').value = '';
    document.getElementById('ds_customer').value = '';
    document.getElementById('ds_specification').value = '';
    document.getElementById('ds_machine').value = '';
    document.getElementById('ds_shift').value = '';
    document.getElementById('ds_operator').value = '';
    document.getElementById('ds_supervisor').value = '';
  }
}

// Wire overlay controls after DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const openBtn = document.getElementById('createDailyStockRecordBtn');
  const closeBtn = document.getElementById('closeDailyStockOverlay');
  const cancelBtn = document.getElementById('ds_cancel');
  const overlay = document.getElementById('dailyStockOverlay');
  const form = document.getElementById('dailyStockForm');

  if (openBtn) openBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showDailyStockOverlay();
    // Setup product autocomplete when modal opens
    setupProductCodeAutocomplete();
    // Setup operator and supervisor autocomplete
    setupOperatorSupervisorAutocomplete();
  });

  if (closeBtn) closeBtn.addEventListener('click', (e) => { e.preventDefault(); closeDailyStockOverlay(); });
  if (cancelBtn) cancelBtn.addEventListener('click', (e) => { e.preventDefault(); closeDailyStockOverlay(); });

  // Close when clicking outside modal content
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeDailyStockOverlay();
    });
  }

  // Handle form submit: add a temporary record locally and re-render
  if (form && !formSubmitAttached) {
    formSubmitAttached = true;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (isProcessing) return;

      // Prevent double submission
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';
      }
      
      const date = document.getElementById('ds_date')?.value || '';
      const prod_code = document.getElementById('ds_prod_code')?.value.trim() || '';
      const customer = document.getElementById('ds_customer')?.value.trim() || '';
      const specification = document.getElementById('ds_specification')?.value.trim() || '';
      const machine = document.getElementById('ds_machine')?.value.trim() || '';
      const shift = document.getElementById('ds_shift')?.value || '';
      const operator = document.getElementById('ds_operator')?.value.trim() || '';
      const supervisor = document.getElementById('ds_supervisor')?.value.trim() || '';

      // Minimal validation
      if (!date) {
        showToast('Please select a date.', 'warning');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = form.dataset.isEdit === 'true' ? 'Update' : 'Create';
        }
        return;
      }

      try {
        isProcessing = true;

        // Build traceability code (header-level identifier)
        const traceability_code = generateTraceabilityCode(date, machine, shift);

        // Get current user email
        let created_by = 'unknown';
        try {
          const { data: { user } } = await supabase.auth.getUser();
          created_by = (user && (user.email || user.id)) || 'unknown';
        } catch (err) {
          console.warn('Could not get current user:', err);
        }

        const payload = {
          production_date: date,
          product_code: prod_code || null,
          customer: customer || null,
          specification: specification || null,
          machine_no: machine || null,
          shift: shift || null,
          operator_name: operator || null,
          supervisor_name: supervisor || null,
          traceability_code: traceability_code,
          created_by: created_by
        };

        let result;
        if (form.dataset.isEdit === 'true') {
          // Update existing header record
          const recordId = form.dataset.editId;
          result = await supabase
            .from('pd_material_consumption_records')
            .update(payload)
            .eq('id', recordId)
            .select();
        } else {
          // Create new header record
          result = await supabase
            .from('pd_material_consumption_records')
            .insert([payload])
            .select();
        }

        const { data: dbRecordArray, error } = result;

        if (error) {
          console.error('Error saving production material consumption header record:', error);
          showToast(`Failed to ${form.dataset.isEdit === 'true' ? 'update' : 'create'} header record: ` + (error.message || JSON.stringify(error)), 'error');
          return;
        }

        const dbRecord = dbRecordArray && dbRecordArray.length > 0 ? dbRecordArray[0] : null;
        
        if (!dbRecord) {
          showToast('Error: Database did not return a record. Please try again.', 'error');
          return;
        }

        // Update UI based on operation type
        if (form.dataset.isEdit === 'true') {
          // Update existing record in the array
          const recordId = form.dataset.editId;
          const existingIndex = jobCostRecordsData.findIndex(record => record.id == recordId);
          if (existingIndex !== -1) {
            jobCostRecordsData[existingIndex] = {
              id: dbRecord.id,
              date: date,
              prod_code: prod_code,
              machine: machine,
              shift: shift,
              operator: operator,
              supervisor: supervisor,
              customer: customer,
              specification: specification
            };
          }
        } else {
          // Add new record to the beginning
          const uiRecord = {
            id: dbRecord.id,
            date: date,
            prod_code: prod_code,
            machine: machine,
            shift: shift,
            operator: operator,
            supervisor: supervisor,
            customer: customer,
            specification: specification
          };
          jobCostRecordsData.unshift(uiRecord);
        }

        renderTable(jobCostRecordsData);
        populateMachineFilter();
        populateProductFilter();
        populateCustomerFilter();

        closeDailyStockOverlay();
        form.reset();

        // Reset modal state for next use
        const modalTitle = document.getElementById('dailyStockModalTitle');
        const submitBtn = form.querySelector('button[type="submit"]');
        if (modalTitle) modalTitle.textContent = 'Create Daily Stock Record';
        if (submitBtn) submitBtn.textContent = 'Create';
        delete form.dataset.isEdit;
        delete form.dataset.editId;

        showToast(`Daily stock record ${form.dataset.isEdit === 'true' ? 'updated' : 'created'} successfully!`, 'success');
      } catch (err) {
        console.error('Error saving daily stock record:', err);
        showToast('Failed to save record. See console for details.', 'error');
      } finally {
        isProcessing = false;
        // Re-enable submit button
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = form.dataset.isEdit === 'true' ? 'Update' : 'Create';
        }
      }
    });
  }
});

// Helper: generate traceability code like PROD-YYYYMMDD-M01-A-091035
function generateTraceabilityCode(dateStr, machine, shift) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return `PROD-${dateStr}-${machine}-${shift}`;

    // Use date from production_date for YYYYMMDD
    const y = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');

    // Use current time for HHMMSS to ensure uniqueness
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');

    const m = machine ? machine.replace(/\s+/g, '').toUpperCase() : 'M0';
    const s = shift || 'A';

    return `PROD-${y}${mm}${dd}-${m}-${s}-${hh}${min}${ss}`;
  } catch (err) {
    return `PROD-${dateStr}-${machine}-${shift}`;
  }
}

// Helper: generate a simple UUID v4
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0,
      v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Setup autocomplete for product code input with database-driven suggestions
 * Fetches matching products from inline_products_master table and auto-fills related fields
 */
async function setupProductCodeAutocomplete() {
  const prodCodeInput = document.getElementById('ds_prod_code');
  if (!prodCodeInput || autocompleteAttached) return;

  autocompleteAttached = true;
  let dropdown = null;
  let lastFetchId = 0;

  prodCodeInput.addEventListener('input', async function() {
    const value = this.value.trim();
    const fetchId = ++lastFetchId;

    // Remove existing dropdown
    if (dropdown) {
      dropdown.remove();
      dropdown = null;
    }

    // Also check for any orphaned dropdowns by ID
    const existingDropdown = document.getElementById('prod-code-dropdown');
    if (existingDropdown) existingDropdown.remove();

    if (value.length < 1) return;

    try {
      // Fetch matching products from inline_products_master (FG products)
      const { data: matches, error } = await supabase
        .from('inline_products_master')
        .select('customer, prod_code, spec')
        .eq('is_active', true)
        .ilike('prod_code', `%${value}%`)
        .order('prod_code')
        .limit(10);

      // If a newer fetch has started, ignore this result
      if (fetchId !== lastFetchId) return;

      if (error) {
        // Database query failed - log for debugging but don't show to user
        console.error('Error fetching products for autocomplete:', error);
        return;
      }

      if (!matches || matches.length === 0) return;

      // Transform matches for dropdown display
      const dropdownItems = matches.map(product => ({
        ...product,
        displayText: `${product.prod_code} (${product.customer})`
      }));

      // Create dropdown using utility function
      dropdown = createAutocompleteDropdown(
        prodCodeInput,
        dropdownItems,
        (selectedProduct) => {
          // Set product code
          prodCodeInput.value = selectedProduct.prod_code;

          // Auto-fill customer and specification from inline_products_master
          const customerInput = document.getElementById('ds_customer');
          const specInput = document.getElementById('ds_specification');

          if (customerInput) customerInput.value = selectedProduct.customer;
          if (specInput) specInput.value = selectedProduct.spec || '';

          // Increment lastFetchId to ignore any pending fetches
          lastFetchId++;
        },
        'prod-code-dropdown',
        false // Use relative positioning
      );

    } catch (err) {
      // Unexpected error during autocomplete setup
      console.error('Autocomplete error:', err);
    }
  });

  // Setup common event listeners for cleanup
  setupAutocompleteEventListeners(
    prodCodeInput,
    () => dropdown,
    () => { dropdown = null; }
  );
}

// Setup operator and supervisor autocomplete with real-time suggestions
async function setupOperatorSupervisorAutocomplete() {
  try {
    // Fetch all production staff once
    const { data: prodUsers, error } = await supabase
      .from('users')
      .select('full_name')
      .eq('department', 'Production')
      .order('full_name');

    if (error) {
      console.error('Error fetching production users:', error);
      return;
    }

    if (!prodUsers || prodUsers.length === 0) {
      console.warn('No users found in Production department');
      return;
    }

    // Extract unique full names
    const allNames = [...new Set(prodUsers.map(u => u.full_name).filter(Boolean))];

    // Setup autocomplete for operator field
    const operatorInput = document.getElementById('ds_operator');
    if (operatorInput) {
      setupNameAutocomplete(operatorInput, allNames, 'operator');
    }

    // Setup autocomplete for supervisor field
    const supervisorInput = document.getElementById('ds_supervisor');
    if (supervisorInput) {
      setupNameAutocomplete(supervisorInput, allNames, 'supervisor');
    }

  } catch (err) {
    console.error('Error setting up operator/supervisor autocomplete:', err);
  }
}

/**
 * Setup autocomplete for name input fields (operator/supervisor) with pre-loaded suggestions
 * @param {HTMLElement} inputElement - The input element to attach autocomplete to
 * @param {Array<string>} allNames - Array of all available names to filter from
 * @param {string} fieldType - Type of field for debugging ('operator' or 'supervisor')
 */
function setupNameAutocomplete(inputElement, allNames, fieldType) {
  let dropdown = null;

  inputElement.addEventListener('input', function() {
    const value = this.value.trim().toLowerCase();

    // Remove existing dropdown
    if (dropdown) {
      dropdown.remove();
      dropdown = null;
    }

    if (value.length < 1) return;

    // Filter names matching input (case-insensitive)
    const matches = allNames.filter(name => name.toLowerCase().includes(value));

    if (matches.length === 0) return;

    // Create dropdown using utility function
    dropdown = createAutocompleteDropdown(
      inputElement,
      matches,
      (selectedName) => {
        inputElement.value = selectedName;
      },
      null, // No specific ID needed
      true // Use absolute positioning relative to viewport
    );
  });

  // Setup common event listeners for cleanup
  setupAutocompleteEventListeners(
    inputElement,
    () => dropdown,
    () => { dropdown = null; }
  );
}

