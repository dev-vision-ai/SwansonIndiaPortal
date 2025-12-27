import { supabase } from '../supabase-config.js';

let currentSort = { column: 'date', direction: 'desc' };
let jobCostRecordsData = []; // Store fetched records globally for sorting and filtering
let formSubmitAttached = false; // Flag to prevent duplicate form submit listeners
let autocompleteAttached = false; // Flag to prevent duplicate autocomplete listeners
let currentHeaderId = null; // Store the current header record ID for detail operations
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

function renderTable(data) {
  const tbody = document.getElementById('jobCostRecordsTableBody');
  if (!tbody) return;

  tbody.innerHTML = data.map((record, index) => {
    // Validate record.id
    if (!record.id) {
      console.warn('Record missing ID:', record);
      return ''; // Skip rendering this row
    }
    
    return `
    <tr data-id="${record.id}">
      <td>${index + 1}</td>
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
    currentSort = { column, direction: 'asc' };
  }

  jobCostRecordsData.sort((a, b) => {
    const modifier = currentSort.direction === 'asc' ? 1 : -1;
    const aValue = a[currentSort.column];
    const bValue = b[currentSort.column];

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return aValue.localeCompare(bValue) * modifier;
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
      return (aValue - bValue) * modifier;
    } else {
      return 0;
    }
  });

  renderTable(jobCostRecordsData);
}

async function applyFilters() {
  const dateFromValue = document.getElementById('filterDateFrom')?.value || '';
  const dateToValue = document.getElementById('filterDateTo')?.value || '';
  const machineValue = document.getElementById('filterMachine')?.value || '';
  const productValue = document.getElementById('filterProduct')?.value || '';
  const shiftValue = document.getElementById('filterShift')?.value || '';
  const customerValue = document.getElementById('filterCustomer')?.value || '';

  console.log(`Applying filters: DateFrom='${dateFromValue}', DateTo='${dateToValue}', Machine='${machineValue}', Product='${productValue}', Shift='${shiftValue}', Customer='${customerValue}'`);

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
  console.log('Filters cleared.');
}

function setupEventListeners() {
  // Fetch records on page load
  fetchJobCostRecords();

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

    console.log('Button clicked:', {
      button_class: button.className,
      data_id_from_button: button.dataset.id,
      fallback_data_id: recordId,
      e_target_tag: e.target.tagName
    });

    if (button.classList.contains('view-btn')) {
      console.log(`Viewing production material consumption record ${recordId}`);
      if (!recordId) {
        alert('❌ Error: Could not find record ID. Please refresh and try again.');
        return;
      }
      window.location.href = `pd_material_consumption_view.html?id=${recordId}&action=view`;
    } else if (button.classList.contains('edit-btn')) {
      console.log(`Editing production material consumption record ${recordId}`);
      if (!recordId) {
        alert('❌ Error: Could not find record ID. Please refresh and try again.');
        return;
      }
      editRecordInModal(recordId);
    } else if (button.classList.contains('add-data-btn')) {
      console.log(`Adding consumption data to record ${recordId}`);
      if (!recordId || recordId === 'undefined') {
        alert('❌ Error: Could not find record ID. Please try again.');
        console.error('Invalid recordId for add-data-btn:', recordId, 'Button:', button);
        return;
      }
      window.location.href = `pd-material-consumption-data.html?id=${recordId}&action=add`;
    } else if (button.classList.contains('delete-btn')) {
      console.log(`Deleting production material consumption record ${recordId}`);
      if (!recordId) {
        alert('❌ Error: Could not find record ID. Please refresh and try again.');
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
    console.log(`Fetching record ${recordId} for editing...`);
    
    const { data: record, error } = await supabase
      .from('pd_material_consumption_records')
      .select('*')
      .eq('id', recordId)
      .single();

    if (error) {
      console.error('Error fetching record for editing:', error);
      alert('Failed to load record for editing: ' + (error.message || JSON.stringify(error)));
      return;
    }

    if (!record) {
      alert('Record not found.');
      return;
    }

    console.log('Record loaded for editing:', record);

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
    alert('Failed to load record for editing. See console for details.');
  }
}

async function deleteRecord(recordId) {
  if (isProcessing) return;
  
  try {
    isProcessing = true;
    console.log(`Deleting record ${recordId}...`);
    
    const { error } = await supabase
      .from('pd_material_consumption_records')
      .delete()
      .eq('id', recordId);

    if (error) {
      console.error('Error deleting record:', error);
      alert('Failed to delete record: ' + (error.message || JSON.stringify(error)));
      return;
    }

    console.log('Record deleted successfully');
    alert('Record deleted successfully!');
    
    // Refresh the table
    await fetchJobCostRecords();
    
  } catch (err) {
    console.error('Error deleting record:', err);
    alert('Failed to delete record. See console for details.');
  } finally {
    isProcessing = false;
  }
}

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
      console.error('Error fetching pd_material_consumption_records:', error);
      if (error.code === 'PGRST116') {
        showMessage('Table does not exist. Ensure pd_material_consumption_records table is created in Supabase.');
      } else {
        showError('Failed to load production material consumption records.');
      }
      return;
    }

    console.log("Fetched Production Material Consumption Records:", data);
    
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

    if (jobCostRecordsData.length === 0) {
      showMessage(hasFilters ? 'No records found matching the filters.' : 'No production material consumption records found. Create your first record.');
    } else {
      renderTable(jobCostRecordsData);
      // Only populate filters on initial load (when no filters are active)
      if (!hasFilters) {
        populateMachineFilter();
        populateProductFilter();
        populateCustomerFilter();
      }
    }

  } catch (error) {
    console.error('Error fetching production material consumption records:', error);
    showError('Failed to load production material consumption records. Please try again.');
  } finally {
    const tbody = document.getElementById('jobCostRecordsTableBody');
    if (tbody) tbody.classList.remove('loading');
  }
}

function populateMachineFilter() {
  const machineSelect = document.getElementById('filterMachine');
  if (!machineSelect) return;

  // Get unique machines from the data
  const machines = [...new Set(jobCostRecordsData.map(record => record.machine).filter(Boolean))];

  // Clear existing options except the first one
  machineSelect.innerHTML = '<option value="">All</option>';

  // Add machine options
  machines.forEach(machine => {
    const option = document.createElement('option');
    option.value = machine;
    option.textContent = machine;
    machineSelect.appendChild(option);
  });
}

function populateProductFilter() {
  const productSelect = document.getElementById('filterProduct');
  if (!productSelect) return;

  // Get unique product codes from the data
  const products = [...new Set(jobCostRecordsData.map(record => record.prod_code).filter(Boolean))];

  // Clear existing options except the first one
  productSelect.innerHTML = '<option value="">All</option>';

  // Add product options
  products.forEach(product => {
    const option = document.createElement('option');
    option.value = product;
    option.textContent = product;
    productSelect.appendChild(option);
  });
}

function populateCustomerFilter() {
  const customerSelect = document.getElementById('filterCustomer');
  if (!customerSelect) return;

  // Get unique customers from the data
  const customers = [...new Set(jobCostRecordsData.map(record => record.customer).filter(Boolean))];

  // Clear existing options except the first one
  customerSelect.innerHTML = '<option value="">All</option>';

  // Add customer options
  customers.forEach(customer => {
    const option = document.createElement('option');
    option.value = customer;
    option.textContent = customer;
    customerSelect.appendChild(option);
  });
}

function showError(message) {
  const tbody = document.getElementById('jobCostRecordsTableBody');
  if (tbody) {
    tbody.innerHTML = `<tr class="error-row"><td colspan="8" class="text-center py-8 text-red-600">${message}</td></tr>`;
  }
}

function showMessage(message) {
  const tbody = document.getElementById('jobCostRecordsTableBody');
  if (tbody) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="10" class="text-center py-8 text-gray-500 w-full">${message}</td></tr>`;
  }
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
        alert('Please select a date.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = form.dataset.isEdit === 'true' ? 'Update' : 'Create';
        }
        return;
      }

      try {
        isProcessing = true;
        // Log all form values for debugging
        console.log('=== Form Submission Debug ===');
        console.log('Date:', date);
        console.log('Product Code:', prod_code);
        console.log('Customer:', customer);
        console.log('Specification:', specification);
        console.log('Machine:', machine);
        console.log('Shift:', shift);
        console.log('Operator:', operator);
        console.log('Supervisor:', supervisor);

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

        console.log('Insert payload:', payload);

        let result;
        if (form.dataset.isEdit === 'true') {
          // Update existing header record
          const recordId = form.dataset.editId;
          console.log('Updating header record with ID:', recordId);
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
        console.log('Operation response - data:', dbRecordArray, 'error:', error);

        if (error) {
          console.error('Error saving production material consumption header record:', error);
          alert(`Failed to ${form.dataset.isEdit === 'true' ? 'update' : 'create'} header record: ` + (error.message || JSON.stringify(error)));
          return;
        }

        // Extract the first record from the array (select() returns an array)
        const dbRecord = dbRecordArray && dbRecordArray.length > 0 ? dbRecordArray[0] : null;
        
        if (!dbRecord) {
          console.error('No record returned from database operation');
          alert('Error: Database did not return a record. Please try again.');
          return;
        }

        console.log('Record from DB:', dbRecord);

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

        console.log(`Record ${form.dataset.isEdit === 'true' ? 'updated' : 'created'} successfully`);
        alert(`Daily stock record ${form.dataset.isEdit === 'true' ? 'updated' : 'created'} successfully!`);
      } catch (err) {
        console.error('Error saving daily stock record:', err);
        alert('Failed to save record. See console for details.');
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

// Setup product code autocomplete for modal form
async function setupProductCodeAutocomplete() {
  const prodCodeInput = document.getElementById('ds_prod_code');
  if (!prodCodeInput || autocompleteAttached) return;

  autocompleteAttached = true;
  console.log('Setting up server-side Product Code autocomplete...');

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
        console.error('Error fetching products for autocomplete:', error);
        return;
      }

      if (!matches || matches.length === 0) return;

      console.log('Product Code matches for "' + value + '":', matches.length);

      // Create dropdown
      dropdown = document.createElement('div');
      dropdown.id = 'prod-code-dropdown';
      dropdown.className = 'absolute z-50 w-full border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto';
      dropdown.style.top = '100%';
      dropdown.style.left = '0';
      dropdown.style.background = '#eaf4fb';
      dropdown.style.marginTop = '2px';

      matches.forEach(product => {
        const item = document.createElement('div');
        item.className = 'px-2 py-1 hover:bg-blue-200 cursor-pointer text-xs';
        item.textContent = `${product.prod_code} (${product.customer})`;

        item.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();

          prodCodeInput.value = product.prod_code;

          // Auto-fill customer and specification from inline_products_master
          const customerInput = document.getElementById('ds_customer');
          const specInput = document.getElementById('ds_specification');

          if (customerInput) customerInput.value = product.customer;
          if (specInput) specInput.value = product.spec || '';

          console.log('Selected product code:', product.prod_code, 'from inline_products_master');

          if (dropdown) {
            dropdown.remove();
            dropdown = null;
          }
          // Increment lastFetchId to ignore any pending fetches
          lastFetchId++;
        });

        dropdown.appendChild(item);
      });

      // Position dropdown
      const parent = prodCodeInput.parentNode;
      parent.style.position = 'relative';
      parent.appendChild(dropdown);

    } catch (err) {
      console.error('Autocomplete error:', err);
    }
  });

  // Remove dropdown when clicking outside
  document.addEventListener('click', function(e) {
    if (dropdown && !prodCodeInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.remove();
      dropdown = null;
    }
  });

  // Remove dropdown on blur
  prodCodeInput.addEventListener('blur', function() {
    setTimeout(() => {
      if (dropdown) {
        dropdown.remove();
        dropdown = null;
      }
    }, 150);
  });
}

// Setup material code autocomplete for modal form

