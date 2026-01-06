import { supabase } from '../supabase-config.js';

const ROWS_PER_PAGE = 8;
let currentSort = { column: 'requisition_date', direction: 'desc' };
let requisitionsData = []; // Store fetched records globally for sorting and filtering
let currentPage = 1;
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
  const tbody = document.getElementById('requisitionsTableBody');
  if (!tbody) return;

  // Calculate pagination
  const totalRecords = data.length;
  const totalPages = Math.ceil(totalRecords / ROWS_PER_PAGE);
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const endIndex = startIndex + ROWS_PER_PAGE;
  const pageData = data.slice(startIndex, endIndex);

  // Update pagination info
  const pageStartRow = document.getElementById('pageStartRow');
  const pageEndRow = document.getElementById('pageEndRow');
  const totalRecordsSpan = document.getElementById('totalRecords');
  const pageNumberSpan = document.getElementById('currentPage');
  const totalPagesSpan = document.getElementById('totalPages');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');

  if (pageStartRow) pageStartRow.textContent = totalRecords === 0 ? '0' : startIndex + 1;
  if (pageEndRow) pageEndRow.textContent = Math.min(endIndex, totalRecords);
  if (totalRecordsSpan) totalRecordsSpan.textContent = totalRecords;
  if (pageNumberSpan) pageNumberSpan.textContent = totalRecords === 0 ? '0' : currentPage;
  if (totalPagesSpan) totalPagesSpan.textContent = totalRecords === 0 ? '1' : totalPages;

  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

  tbody.innerHTML = pageData.map((record, index) => {
    // Validate record.id
    if (!record.id) {
      console.warn('Record missing ID:', record);
      return ''; // Skip rendering this row
    }

    // Reverse Sr No: latest record gets Sr No 1
    const reversedIndex = totalRecords - (startIndex + index);

    // Status badge styling
    const statusClass = record.status ? `status-${record.status.toLowerCase()}` : 'status-requested';
    const statusText = record.status || 'REQUESTED';

    // Hide edit and delete buttons for ISSUED status
    const isIssued = record.status === 'ISSUED';
    const editButtonHtml = isIssued ? '' : `
          <button class="action-btn edit-btn p-1.5 rounded-md bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-800 transition-all duration-200 border border-green-200 hover:border-green-300 flex-shrink-0" data-id="${record.id}" title="Edit Requisition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>`;
    const deleteButtonHtml = isIssued ? '' : `
          <button class="action-btn delete-btn p-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 transition-all duration-200 border border-red-200 hover:border-red-300 flex-shrink-0" data-id="${record.id}" title="Delete Requisition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>`;
    
    return `
    <tr data-id="${record.id}">
      <td>${reversedIndex}</td>
      <td class="font-mono font-bold text-red-600">${record.requisition_no || 'N/A'}</td>
      <td>${formatDateToDDMMYYYY(record.requisition_date)}</td>
      <td>${formatDateToDDMMYYYY(record.required_before)}</td>
      <td>${record.requested_by || 'N/A'}</td>
      <td>${record.requester_dept || 'N/A'}</td>
      <td><span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">${statusText}</span></td>
      <td>
        <div class="action-icons">
          <button class="action-btn view-btn p-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 hover:text-blue-900 transition-all duration-200 border border-blue-200 hover:border-blue-300 flex-shrink-0" data-id="${record.id}" title="View Requisition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
          </button>${editButtonHtml}${deleteButtonHtml}
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
  requisitionsData.sort((a, b) => {
    // Primary sort: by requisition_date descending (latest first)
    const dateA = new Date(a.requisition_date || 0);
    const dateB = new Date(b.requisition_date || 0);
    const dateDiff = dateB - dateA;
    
    if (dateDiff !== 0) return dateDiff; // If dates differ, use date sort
    
    // Secondary sort: by selected column if dates are same
    if (currentSort.column !== 'requisition_date') {
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

  currentPage = 1; // Reset to first page after sorting
  renderTable(requisitionsData);
}

async function applyFilters() {
  const dateFromValue = document.getElementById('filterDateFrom')?.value || '';
  const dateToValue = document.getElementById('filterDateTo')?.value || '';
  const departmentValue = document.getElementById('filterDepartment')?.value || '';
  const statusValue = document.getElementById('filterStatusSelect')?.value || '';
  const requestedByValue = document.getElementById('filterRequestedBy')?.value || '';

  console.log(`Applying filters: DateFrom='${dateFromValue}', DateTo='${dateToValue}', Department='${departmentValue}', Status='${statusValue}', RequestedBy='${requestedByValue}'`);

  const filters = {
    dateFrom: dateFromValue,
    dateTo: dateToValue,
    department: departmentValue,
    status: statusValue,
    requestedBy: requestedByValue
  };

  // Trigger a new Supabase query with filters
  await fetchRequisitions(filters);

  // Reset to first page after filtering
  currentPage = 1;

  // Update filter status
  const isFiltered = dateFromValue || dateToValue || departmentValue || statusValue || requestedByValue;
  const filterStatus = document.getElementById('filterStatus');
  if (filterStatus) {
    filterStatus.textContent = isFiltered ? 'On' : 'Off';
    filterStatus.style.color = isFiltered ? '#059669' : '#d97706';
  }
}

async function clearFilters() {
  const dateFromInput = document.getElementById('filterDateFrom');
  const dateToInput = document.getElementById('filterDateTo');
  const departmentInput = document.getElementById('filterDepartment');
  const statusInput = document.getElementById('filterStatusSelect');
  const requestedByInput = document.getElementById('filterRequestedBy');

  if (dateFromInput) dateFromInput.value = '';
  if (dateToInput) dateToInput.value = '';
  if (departmentInput) departmentInput.value = '';
  if (statusInput) statusInput.value = '';
  if (requestedByInput) requestedByInput.value = '';

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
  // Create new requisition button
  const createBtn = document.getElementById('createRequisitionBtn');
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      window.location.href = 'material-requisition-form.html';
    });
  }

  // Fetch records on page load
  fetchRequisitions();

  // Setup pagination event listeners
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');
  
  if (prevBtn) prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable(requisitionsData);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  if (nextBtn) nextBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(requisitionsData.length / ROWS_PER_PAGE);
    if (currentPage < totalPages) {
      currentPage++;
      renderTable(requisitionsData);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // Setup filter event listeners
  const dateFromInput = document.getElementById('filterDateFrom');
  const dateToInput = document.getElementById('filterDateTo');
  const departmentInput = document.getElementById('filterDepartment');
  const statusInput = document.getElementById('filterStatusSelect');
  const requestedByInput = document.getElementById('filterRequestedBy');
  const clearBtn = document.getElementById('clearFilters');

  if (dateFromInput) dateFromInput.addEventListener('change', applyFilters);
  if (dateToInput) dateToInput.addEventListener('change', applyFilters);
  if (departmentInput) departmentInput.addEventListener('change', applyFilters);
  if (statusInput) statusInput.addEventListener('change', applyFilters);
  if (requestedByInput) requestedByInput.addEventListener('change', applyFilters);
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
      console.log(`Viewing material requisition ${recordId}`);
      if (!recordId) {
        alert('❌ Error: Could not find record ID. Please refresh and try again.');
        return;
      }
      window.location.href = `material-requisition-form.html?id=${recordId}&action=view`;
    } else if (button.classList.contains('edit-btn')) {
      console.log(`Editing material requisition ${recordId}`);
      if (!recordId) {
        alert('❌ Error: Could not find record ID. Please refresh and try again.');
        return;
      }
      window.location.href = `material-requisition-form.html?id=${recordId}&action=edit`;
    } else if (button.classList.contains('delete-btn')) {
      console.log(`Deleting material requisition ${recordId}`);
      if (!recordId) {
        alert('❌ Error: Could not find record ID. Please refresh and try again.');
        return;
      }
      if (confirm('Are you sure you want to delete this requisition? This action cannot be undone.')) {
        deleteRecord(recordId);
      }
    }
  }
}

async function deleteRecord(recordId) {
  if (isProcessing) return;

  try {
    isProcessing = true;
    console.log(`Deleting requisition ${recordId}...`);

    const { error } = await supabase
      .from('material_requisitions')
      .delete()
      .eq('id', recordId);

    if (error) {
      console.error('Error deleting requisition:', error);
      alert('Failed to delete requisition: ' + (error.message || JSON.stringify(error)));
      return;
    }

    console.log('Requisition deleted successfully');
    alert('Requisition deleted successfully!');

    // Refresh the table
    await fetchRequisitions();

  } catch (err) {
    console.error('Error deleting requisition:', err);
    alert('Failed to delete requisition. See console for details.');
  } finally {
    isProcessing = false;
  }
}

async function fetchRequisitions(filters = null) {
  try {
    const tbody = document.getElementById('requisitionsTableBody');
    if (tbody) tbody.classList.add('loading');

    // Get current user and profile for filtering
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('User not authenticated:', userError);
      window.location.replace('auth.html');
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('full_name, department')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      showError('Failed to load user profile.');
      return;
    }

    // Determine if user is from warehouse department
    const isWarehouse = profile && profile.department && profile.department.toLowerCase().includes('warehouse');
    const userFullName = profile?.full_name || user.email.split('@')[0];

    // Apply UI permissions based on user role
    applyUserPermissions(isWarehouse);

    // Build query
    let query = supabase
      .from('material_requisitions')
      .select('*')
      .order('requisition_date', { ascending: false });

    // Apply user-based filtering unless user is from warehouse
    if (!isWarehouse) {
      // Filter to show only requisitions requested by the current user
      query = query.ilike('requested_by', `%${userFullName}%`);
    }

    // Apply filters if provided, otherwise limit to 50
    const hasFilters = filters && Object.values(filters).some(v => v !== '');

    if (hasFilters) {
      if (filters.dateFrom) query = query.gte('requisition_date', filters.dateFrom);
      if (filters.dateTo) query = query.lte('requisition_date', filters.dateTo);
      if (filters.department) query = query.eq('requester_dept', filters.department);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.requestedBy) query = query.ilike('requested_by', `%${filters.requestedBy}%`);
    } else {
      query = query.limit(50);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching material_requisitions:', error);
      if (error.code === 'PGRST116') {
        showMessage('Table does not exist. Ensure material_requisitions table is created in Supabase.');
      } else {
        showError('Failed to load material requisitions.');
      }
      return;
    }

    console.log("Fetched Material Requisitions:", data);

    // Map database columns to UI format
    requisitionsData = (data || []).map(record => ({
      id: record.id,
      requisition_no: record.requisition_no,
      requisition_date: record.requisition_date, // Database column name
      required_before: record.required_before,
      requested_by: record.requested_by,
      requester_dept: record.requester_dept,
      issued_date: record.issued_date,
      issued_by: record.issued_by,
      status: record.status
    }));

    // Ensure latest added records are on top (sort by date descending)
    requisitionsData.sort((a, b) => {
      const dateA = new Date(a.requisition_date || 0);
      const dateB = new Date(b.requisition_date || 0);
      return dateB - dateA;
    });

    // Reset to first page after fetching
    currentPage = 1;

    if (requisitionsData.length === 0) {
      const message = hasFilters
        ? 'No requisitions found matching the filters.'
        : isWarehouse
          ? 'No material requisitions found. Create your first requisition.'
          : 'No requisitions found for your account. Create your first requisition.';
      showMessage(message);
    } else {
      renderTable(requisitionsData);
      // Only populate filters on initial load (when no filters are active)
      if (!hasFilters) {
        populateDepartmentFilter();
        // Only populate requested by filter for warehouse users
        if (isWarehouse) {
          populateRequestedByFilter();
        }
      }
    }

  } catch (error) {
    console.error('Error fetching material requisitions:', error);
    showError('Failed to load material requisitions. Please try again.');
  } finally {
    const tbody = document.getElementById('requisitionsTableBody');
    if (tbody) tbody.classList.remove('loading');
  }
}

async function populateDepartmentFilter() {
  try {
    const { data, error } = await supabase
      .from('material_requisitions')
      .select('requester_dept')
      .not('requester_dept', 'is', null);

    if (error) {
      console.error('Error fetching departments:', error);
      return;
    }

    // Get unique departments
    const departments = [...new Set(data.map(item => item.requester_dept).filter(Boolean))].sort();

    const departmentSelect = document.getElementById('filterDepartment');
    if (departmentSelect) {
      // Clear existing options except "All"
      departmentSelect.innerHTML = '<option value="">All</option>';

      // Add department options
      departments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept;
        option.textContent = dept;
        departmentSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error populating department filter:', error);
  }
}

async function populateRequestedByFilter() {
  try {
    const { data, error } = await supabase
      .from('material_requisitions')
      .select('requested_by')
      .not('requested_by', 'is', null);

    if (error) {
      console.error('Error fetching requested by:', error);
      return;
    }

    // Get unique requested by names
    const requestedByList = [...new Set(data.map(item => item.requested_by).filter(Boolean))].sort();

    const requestedBySelect = document.getElementById('filterRequestedBy');
    if (requestedBySelect) {
      // Clear existing options except "All"
      requestedBySelect.innerHTML = '<option value="">All</option>';

      // Add requested by options
      requestedByList.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        requestedBySelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error populating requested by filter:', error);
  }
}

function showMessage(message) {
  const tbody = document.getElementById('requisitionsTableBody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-gray-500">${message}</td></tr>`;
  }
}

function showError(message) {
  const tbody = document.getElementById('requisitionsTableBody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-red-500">${message}</td></tr>`;
  }
}

function applyUserPermissions(isWarehouse) {
  const requestedByFilter = document.querySelector('label[for="filterRequestedBy"]')?.parentElement;
  if (requestedByFilter) {
    requestedByFilter.style.display = isWarehouse ? 'flex' : 'none';
  }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
});