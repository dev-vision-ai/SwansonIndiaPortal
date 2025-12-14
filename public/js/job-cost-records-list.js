import { supabase } from '../supabase-config.js';

let currentSort = { column: 'date', direction: 'desc' };
let jobCostRecordsData = []; // Store fetched records globally for sorting and filtering

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

  tbody.innerHTML = data.map((record, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${formatDateToDDMMYYYY(record.date)}</td>
      <td>${record.machine || 'N/A'}</td>
      <td>${record.customer || 'N/A'}</td>
      <td>${record.prod_code || 'N/A'}</td>
      <td>${record.product_type || 'N/A'}</td>
      <td>${record.shift || 'N/A'}</td>
      <td>
        <div class="action-icons">
          <button class="action-btn view-btn" data-id="${record.id}" title="View Record">
            <i class="fas fa-eye"></i>
          </button>
          <button class="action-btn edit-btn" data-id="${record.id}" title="Edit Record">
            <i class="fas fa-edit"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
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

function applyFilters() {
  const dateFromValue = document.getElementById('filterDateFrom')?.value || '';
  const dateToValue = document.getElementById('filterDateTo')?.value || '';
  const machineValue = document.getElementById('filterMachine')?.value || '';
  const productValue = document.getElementById('filterProduct')?.value || '';
  const shiftValue = document.getElementById('filterShift')?.value || '';
  const customerValue = document.getElementById('filterCustomer')?.value || '';

  console.log(`Applying filters: DateFrom='${dateFromValue}', DateTo='${dateToValue}', Machine='${machineValue}', Product='${productValue}', Shift='${shiftValue}', Customer='${customerValue}'`);

  let filteredData = jobCostRecordsData;

  if (dateFromValue) {
    filteredData = filteredData.filter(record => record.date && record.date >= dateFromValue);
  }

  if (dateToValue) {
    filteredData = filteredData.filter(record => record.date && record.date <= dateToValue);
  }

  if (machineValue) {
    filteredData = filteredData.filter(record => record.machine === machineValue);
  }

  if (productValue) {
    filteredData = filteredData.filter(record => record.product_type === productValue);
  }

  if (shiftValue) {
    filteredData = filteredData.filter(record => record.shift === shiftValue);
  }

  if (customerValue) {
    filteredData = filteredData.filter(record => record.customer === customerValue);
  }

  // Update filter status
  const isFiltered = dateFromValue || dateToValue || machineValue || productValue || shiftValue || customerValue;
  const filterStatus = document.getElementById('filterStatus');
  if (filterStatus) {
    filterStatus.textContent = isFiltered ? 'On' : 'Off';
    filterStatus.style.color = isFiltered ? '#059669' : '#d97706';
  }

  console.log('Filtered data count:', filteredData.length);
  renderTable(filteredData);
}

function clearFilters() {
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

  applyFilters();
  console.log('Filters cleared.');
}

function setupEventListeners() {
  document.addEventListener('DOMContentLoaded', async () => {
    await fetchJobCostRecords();

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
  });

  document.addEventListener('click', handleButtonActions);
}

function handleButtonActions(e) {
  if (e.target.closest('.action-btn')) {
    const button = e.target.closest('.action-btn');
    const recordId = button.dataset.id;

    if (button.classList.contains('view-btn')) {
      console.log(`Viewing job cost record ${recordId}`);
      // Navigate to view/edit page with view action
      window.location.href = `job-cost-record.html?id=${recordId}&action=view`;
    } else if (button.classList.contains('edit-btn')) {
      console.log(`Editing job cost record ${recordId}`);
      // Navigate to view/edit page with edit action
      window.location.href = `job-cost-record.html?id=${recordId}&action=edit`;
    }
  }
}

async function fetchJobCostRecords() {
  try {
    const tbody = document.getElementById('jobCostRecordsTableBody');
    if (tbody) tbody.classList.add('loading');

    // TODO: Replace with actual Supabase query when job_cost_records table is created
    // For now, showing empty state
    const { data, error } = await supabase
      .from('job_cost_records') // This table doesn't exist yet
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      // If table doesn't exist, show empty message
      if (error.code === 'PGRST116') {
        showMessage('No job cost records found. Create your first record.');
        return;
      }
      throw error;
    }

    console.log("Fetched Job Cost Records:", data);
    jobCostRecordsData = data || [];

    if (jobCostRecordsData.length === 0) {
      showMessage('No job cost records found. Create your first record.');
    } else {
      renderTable(jobCostRecordsData);
      populateMachineFilter();
      populateProductFilter();
      populateCustomerFilter();
    }

  } catch (error) {
    console.error('Error fetching job cost records:', error);
    showError('Failed to load job cost records. Please try again.');
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

  // Get unique product types from the data
  const products = [...new Set(jobCostRecordsData.map(record => record.product_type).filter(Boolean))];

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
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8" class="text-center py-8 text-gray-500">${message}</td></tr>`;
  }
}

setupEventListeners();
