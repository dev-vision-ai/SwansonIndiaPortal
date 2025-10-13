import { supabase } from '../supabase-config.js';

// Global variables
let historyData = [];
let currentPage = 1;
let itemsPerPage = 10; // Changed to 10 entries per page
let filteredData = [];
let currentSort = { column: 'breakdown_date', direction: 'desc' };
let currentFilters = {
  equipmentName: '',
  equipment: '',
  fromDate: '',
  toDate: '',
  status: ''
};
let currentTableConfig = 'standard'; // 'standard' or 'roller'

// Table configuration for different equipment types
const tableConfigs = {
  standard: {
    title: "Machine History Card",
    columns: [
      { key: 'breakdown_date', header: 'Breakdown Date', field: 'breakdown_date' },
      { key: 'mjr_number', header: 'MJR#', field: 'mjr_number' },
      { key: 'bd_code', header: 'BD CODE', field: 'bd_code' },
      { key: 'equipment_identification_no', header: 'Equipment ID No.', field: 'equipment_identification_no' },
      { key: 'equipment_name', header: 'Equipment Name', field: 'equipment_name' },
      { key: 'equipment_installation_date', header: 'Equipment Installation Date', field: 'equipment_installation_date' },
      { key: 'breakdown_description', header: 'Breakdown Descr.', field: 'breakdown_description' },
      { key: 'start_time', header: 'M/C BD Start Time', field: 'start_time' },
      { key: 'finish_time', header: 'M/C BD Finish Time', field: 'finish_time' },
      { key: 'total_bd_time', header: 'Total M/C BD Time', field: 'total_bd_time' },
      { key: 'root_cause', header: 'Root Cause', field: 'root_cause' },
      { key: 'corrective_action', header: 'Corrective Action', field: 'corrective_action' },
      { key: 'cost_incurred', header: 'Cost Incurred', field: 'cost_incurred' },
      { key: 'done_by', header: 'Done By', field: 'done_by' },
      { key: 'verified_by', header: 'Verify By', field: 'verified_by' },
      { key: 'status', header: 'Status', field: 'status' }
    ]
  },
  roller: {
    title: "History Card of Rubber/Emboss Roller",
    columns: [
      { key: 'date', header: 'Date', field: 'breakdown_date' },
      { key: 'mjr_number', header: 'MJR# No.', field: 'mjr_number' },
      { key: 'recoated_date', header: 'Recoated Date', field: 'recoatingdate' },
      { key: 'regrind_date', header: 'Regrind date', field: 'regrindingdate' },
      { key: 'work_description', header: 'Work Description', field: 'breakdown_description' },
      { key: 'start_time', header: 'Start Time', field: 'start_time' },
      { key: 'finish_time', header: 'Finish Time', field: 'finish_time' },
      { key: 'total_bd_time', header: 'Total BD Time', field: 'total_bd_time' },
      { key: 'reason_for_changeover', header: 'Reason for changeover', field: 'root_cause' },
      { key: 'corrective_action', header: 'Corrective Action', field: 'corrective_action' },
      { key: 'cost_incurred', header: 'Cost Incurred', field: 'cost_incurred' },
      { key: 'done_by', header: 'Done By', field: 'done_by' },
      { key: 'verified_by', header: 'Verify By', field: 'verified_by' }
    ]
  }
};

// Equipment type detection
function isRollerEquipment(equipmentName) {
  if (!equipmentName) return false;
  const rollerTypes = ['Rubber Roller', 'Emboss Roller', 'Rubber roller', 'Emboss roller'];
  return rollerTypes.some(type => equipmentName.includes(type));
}

// Get table configuration based on equipment type
function getTableConfig(equipmentName) {
  return isRollerEquipment(equipmentName) ? tableConfigs.roller : tableConfigs.standard;
}

// Helper function to format date to DD/MM/YYYY
function formatDateToDDMMYYYY(dateString, isOptional = false) {
  if (!dateString) return 'N/A';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

// Helper function to format time
function formatTime(timeString) {
  if (!timeString) return 'N/A';
  return timeString;
}

// Helper function to get status CSS class
function getStatusClass(status) {
  if (!status || status === 'N/A' || status.toLowerCase() === 'pending') {
    return 'status-pending';
  }
  if (status.toLowerCase() === 'completed') {
    return 'status-completed';
  }
  return 'status-default';
}

// Helper function to calculate total breakdown time
function calculateTotalBDTime(startTime, finishTime) {
  if (!startTime || !finishTime) return 'N/A';

  try {
    const start = new Date(`1970-01-01T${startTime}:00`);
    const finish = new Date(`1970-01-01T${finishTime}:00`);

    if (isNaN(start.getTime()) || isNaN(finish.getTime())) return 'N/A';

    let diffMs = finish.getTime() - start.getTime();

    // If finish time is earlier than start time, assume it spans midnight (next day)
    if (diffMs < 0) {
      // Add 24 hours (in milliseconds) to handle next day scenario
      diffMs += 24 * 60 * 60 * 1000;
    }

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0 && diffMinutes > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else if (diffHours > 0) {
      return `${diffHours}h`;
    } else {
      return `${diffMinutes}m`;
    }
  } catch (error) {
    console.error('Error calculating total BD time:', error);
    return 'N/A';
  }
}


// Render table headers dynamically
function renderTableHeaders() {
  const table = document.getElementById('historyTable');
  const thead = table.querySelector('thead tr');
  const config = tableConfigs[currentTableConfig];

  if (!thead) return;

  // Add/remove table format class for CSS targeting
  table.className = `history-table ${currentTableConfig}-format`;

  thead.innerHTML = config.columns.map(col => `<th>${col.header}</th>`).join('');

  // Update page title
  const titleElement = document.querySelector('.table-header h2');
  if (titleElement) {
    titleElement.textContent = config.title;
  }
}

// Render table with current page data
function renderTable() {
  const tbody = document.getElementById('historyTableBody');
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageData = filteredData.slice(startIndex, endIndex);
  const config = tableConfigs[currentTableConfig];

  if (pageData.length === 0) {
    tbody.innerHTML = `<tr class="loading-row"><td colspan="${config.columns.length}">No records found</td></tr>`;
    updatePaginationInfo();
    return;
  }

  tbody.innerHTML = pageData.map(record => {
    return `<tr>${config.columns.map(col => {
      let value = record[col.field];

      // Special formatting for different field types
      if (col.field === 'breakdown_date' || col.field === 'equipment_installation_date') {
        value = formatDateToDDMMYYYY(value);
      } else if (col.field === 'recoatingdate' || col.field === 'regrindingdate') {
        value = formatDateToDDMMYYYY(value, true); // Pass true for roller fields
      } else if (col.field === 'start_time' || col.field === 'finish_time') {
        value = formatTime(value);
      } else if (col.field === 'total_bd_time') {
        value = calculateTotalBDTime(record.start_time, record.finish_time);
      } else if (col.field === 'status') {
        value = `<span class="${getStatusClass(value)}">${value || 'N/A'}</span>`;
      } else {
        value = value || 'N/A';
      }

      return `<td>${value}</td>`;
    }).join('')}</tr>`;
  }).join('');

  // Update pagination info after rendering
  updatePaginationInfo();
}

// Update pagination information
function updatePaginationInfo() {
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startItem = Math.min((currentPage - 1) * itemsPerPage + 1, totalItems);
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  document.getElementById('paginationInfo').textContent =
    totalItems === 0 ? 'No entries' : `Showing ${startItem}-${endItem} of ${totalItems} entries`;

  // Update pagination controls
  document.getElementById('prevPage').disabled = currentPage === 1;
  document.getElementById('nextPage').disabled = currentPage >= totalPages || totalPages === 0;
  document.getElementById('currentPage').textContent = currentPage;
}

// Pagination event listeners
function setupPaginationListeners() {
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(filteredData.length / itemsPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        renderTable();
      }
    });
  }
}

// Sort data
function sortData(column) {
  if (currentSort.column === column) {
    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort = { column, direction: 'asc' };
  }

  filteredData.sort((a, b) => {
    const modifier = currentSort.direction === 'asc' ? 1 : -1;
    let aValue = a[column];
    let bValue = b[column];

    // Handle date sorting
    if (column.includes('date') && aValue && bValue) {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
      return (aValue - bValue) * modifier;
    }

    // Handle string sorting
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return aValue.localeCompare(bValue) * modifier;
    }

    // Handle numeric sorting
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return (aValue - bValue) * modifier;
    }

    return 0;
  });

  renderTable();
}

// Cascading filter logic
function initializeCascadingFilters() {
  // Step 1: Equipment Name selection
  document.getElementById('equipmentNameFilter')?.addEventListener('change', function() {
    const equipmentName = this.value;
    currentFilters.equipmentName = equipmentName;

    // Filter equipment IDs based on selected equipment name
    updateEquipmentFilter();
    applyCascadingFilters();
  });

  // Step 2: Equipment ID selection
  document.getElementById('equipmentFilter')?.addEventListener('change', function() {
    currentFilters.equipment = this.value;
    applyCascadingFilters();
  });

  // Step 3: Date range selection
  document.getElementById('dateFromFilter')?.addEventListener('change', function() {
    currentFilters.fromDate = this.value;
    applyCascadingFilters();
  });

  document.getElementById('dateToFilter')?.addEventListener('change', function() {
    currentFilters.toDate = this.value;
    applyCascadingFilters();
  });

  // Step 4: Status selection
  document.getElementById('statusFilter')?.addEventListener('change', function() {
    currentFilters.status = this.value;
    applyCascadingFilters();
  });

  // Clear button
  document.getElementById('clearFilters')?.addEventListener('click', clearAllFilters);
}

// Apply cascading filters
function applyCascadingFilters() {
  filteredData = historyData.filter(record => {
    // Equipment Name filter (affects available equipment IDs)
    if (currentFilters.equipmentName && record.equipment_name !== currentFilters.equipmentName) {
      return false;
    }

    // Equipment filter
    if (currentFilters.equipment && record.equipment_identification_no !== currentFilters.equipment) {
      return false;
    }

    // Date range filter
    if (currentFilters.fromDate && record.breakdown_date < currentFilters.fromDate) {
      return false;
    }
    if (currentFilters.toDate && record.breakdown_date > currentFilters.toDate) {
      return false;
    }

    // Status filter
    if (currentFilters.status && record.status.toLowerCase() !== currentFilters.status.toLowerCase()) {
      return false;
    }

    return true;
  });

  currentPage = 1;

  // Update table configuration based on selected equipment
  const selectedEquipmentName = currentFilters.equipmentName;
  const newTableConfig = isRollerEquipment(selectedEquipmentName) ? 'roller' : 'standard';

  if (newTableConfig !== currentTableConfig) {
    currentTableConfig = newTableConfig;
    renderTableHeaders();
    updateExportButtonText(); // Update button text when config changes
  }

  renderTable();
  updateFilterStatus();
}

// Update equipment filter based on selected equipment name
function updateEquipmentFilter() {
  const equipmentNameFilter = document.getElementById('equipmentNameFilter');
  const equipmentFilter = document.getElementById('equipmentFilter');

  if (!equipmentNameFilter || !equipmentFilter) return;

  const selectedEquipmentName = equipmentNameFilter.value;
  const currentEquipmentValue = equipmentFilter.value;

  // Get available equipment IDs for selected equipment name
  const availableEquipment = new Set();
  historyData.forEach(record => {
    if (!selectedEquipmentName || record.equipment_name === selectedEquipmentName) {
      if (record.equipment_identification_no) {
        availableEquipment.add(record.equipment_identification_no);
      }
    }
  });

  // Update equipment filter options
  equipmentFilter.innerHTML = '<option value="">All Equipment</option>';
  Array.from(availableEquipment).sort().forEach(equipment => {
    const option = document.createElement('option');
    option.value = equipment;
    option.textContent = equipment;
    equipmentFilter.appendChild(option);
  });

  // Reset equipment filter if current selection is not available
  if (currentEquipmentValue && !availableEquipment.has(currentEquipmentValue)) {
    equipmentFilter.value = '';
    currentFilters.equipment = '';
  }
}

// Clear all filters and reset
function clearAllFilters() {
  document.getElementById('equipmentNameFilter').value = '';
  document.getElementById('equipmentFilter').value = '';
  document.getElementById('dateFromFilter').value = '';
  document.getElementById('dateToFilter').value = '';
  document.getElementById('statusFilter').value = '';

  // Reset current filters
  currentFilters = {
    equipmentName: '',
    equipment: '',
    fromDate: '',
    toDate: '',
    status: ''
  };

  // Reset table configuration to standard
  currentTableConfig = 'standard';
  renderTableHeaders();
  updateExportButtonText(); // Update button text when resetting

  // Repopulate equipment filter with all options
  populateEquipmentFilter();

  filteredData = [...historyData];
  currentPage = 1;
  renderTable();
  updateFilterStatus();
}

// Update filter status indicator
function updateFilterStatus() {
  const statusElement = document.getElementById('filterStatus');
  if (!statusElement) return;

  const hasFilters = Object.values(currentFilters).some(value => value !== '');
  statusElement.textContent = hasFilters ? 'On' : 'Off';
  statusElement.className = hasFilters
    ? 'px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700'
    : 'px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-700';
}



// Export table data to Excel using backend endpoint
async function exportToExcel() {
  // Determine which export endpoint to use based on equipment type (declare outside try block)
  const selectedEquipmentName = document.getElementById('equipmentNameFilter')?.value || '';
  const selectedEquipmentId = document.getElementById('equipmentFilter')?.value || '';
  const isRollerExport = isRollerEquipment(selectedEquipmentName);
  const exportEndpoint = isRollerExport ? '/api/export-roller-history-card' : '/api/export-machine-history-card';
  const exportType = isRollerExport ? 'Roller' : 'Machine';

  try {
    // Show loading state
    const exportBtn = document.getElementById('exportBtn');
    const originalText = exportBtn.innerHTML;
    exportBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Exporting ${exportType} History Card...`;
    exportBtn.disabled = true;

    // Determine backend URL
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const backendUrl = isLocalhost ? 'http://localhost:3000' : 'https://swanson-backend.onrender.com';

    // Get the filtered data that's currently displayed in the table
    console.log('📊 Exporting filtered table data:', filteredData.length, 'records');

    // Prepare the filtered data for export
    const exportData = filteredData.map(record => ({
      occurdate: record.breakdown_date,
      requisitionno: record.mjr_number,
      breakdowncodes: record.bd_code,
      equipmentno: record.equipment_identification_no,
      equipmentname: record.equipment_name,
      equipmentinstalldate: record.equipment_installation_date,
      existingcondition: record.breakdown_description,
      occurtime: record.start_time,
      completiontime: record.finish_time,
      rootcause: record.root_cause,
      correction: record.corrective_action,
      costincurred: record.cost_incurred ? record.cost_incurred.replace('₹', '') : '',
      technicianname: record.done_by,
      inspectioncheckedby: record.verified_by,
      inspectionresult: record.status === 'Completed' ? 'Accepted' : 'Pending',
      recoatingdate: record.recoatingdate,
      regrindingdate: record.regrindingdate
    }));

    // Test if backend is reachable first
    try {
      const testResponse = await fetch(`${backendUrl}/api/test`);
      if (!testResponse.ok) {
        throw new Error(`Backend server not reachable at ${backendUrl}`);
      }
    } catch (testError) {
      console.error('❌ Cannot reach backend server at', backendUrl);
      throw new Error(`Cannot connect to backend server. Please ensure the backend is running on port 3000 for ${exportType} History Card export.`);
    }

    console.log(`🔄 Exporting as ${exportType} History Card to endpoint: ${exportEndpoint}`);

    // Send filtered data to backend for export
    const response = await fetch(`${backendUrl}${exportEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: exportData,
        filterSummary: {
          totalRecords: filteredData.length,
          appliedFilters: {
            equipmentName: selectedEquipmentName,
            equipment: selectedEquipmentId,
            fromDate: document.getElementById('dateFromFilter')?.value || '',
            toDate: document.getElementById('dateToFilter')?.value || '',
            status: document.getElementById('statusFilter')?.value || ''
          }
        },
        selectedEquipmentName: selectedEquipmentName,
        selectedEquipmentId: selectedEquipmentId
      }),
    });

    if (!response.ok) {
      let errorMessage = 'Export failed';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (jsonError) {
        // If response is not JSON (e.g., HTML error page), use response status text
        errorMessage = `Server error (${response.status}): ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    // Get filename from response headers first (before reading the body)
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `${exportType}-History-Card.xlsx`; // default filename

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    // Get the Excel file from response
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    console.log(`✅ ${exportType} history card exported successfully`);

  } catch (error) {
    console.error('❌ Export failed:', error);
    alert('Export failed: ' + error.message);
  } finally {
    // Restore button state
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      exportBtn.innerHTML = `<i class="fas fa-download"></i> ${exportType} History Card`;
      exportBtn.disabled = false;
    }
  }
}

// Fetch machine history data from Supabase
async function fetchMachineHistory() {
  try {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '<tr class="loading-row"><td colspan="16">Loading machine history data...</td></tr>';

    // Fetch from mt_job_requisition_master table
    const { data, error } = await supabase
      .from('mt_job_requisition_master')
      .select(`
        id,
        requisitionno,
        occurdate,
        occurtime,
        requestorname,
        reqdept,
        equipmentname,
        equipmentno,
        equipmentinstalldate,
        existingcondition,
        technicianname,
        rootcause,
        correction,
        costincurred,
        inspectioncheckedby,
        totalhours,
        completiontime,
        breakdowncodes,
        inspectionresult,
        recoatingdate,
        regrindingdate
      `)
      .order('occurdate', { ascending: false });

    if (error) {
      console.error("Error fetching MT job requisitions:", error);
      tbody.innerHTML = `<tr class="loading-row"><td colspan="16">Error loading data: ${error.message}</td></tr>`;
      return;
    }

    // Map database fields to expected format
    historyData = data.map(record => ({
      id: record.id,
      breakdown_date: record.occurdate,
      mjr_number: record.requisitionno,
      bd_code: (() => {
        if (!record.breakdowncodes) return 'N/A';

        // Handle JSON object format like {"A": false, "B": false, "J": true}
        if (typeof record.breakdowncodes === 'object' && !Array.isArray(record.breakdowncodes)) {
          const selectedCodes = Object.keys(record.breakdowncodes).filter(key => record.breakdowncodes[key] === true);
          return selectedCodes.length > 0 ? selectedCodes.join(', ') : 'N/A';
        }

        // Handle array format (fallback)
        if (Array.isArray(record.breakdowncodes)) {
          return record.breakdowncodes.join(', ');
        }

        return record.breakdowncodes || 'N/A';
      })(),
      equipment_identification_no: record.equipmentno || 'N/A',
      equipment_name: record.equipmentname || 'N/A',
      equipment_installation_date: record.equipmentinstalldate || 'N/A', // Equipment installation date only
      status: (() => {
        const result = record.inspectionresult;
        if (!result) return 'Pending';
        if (result.toLowerCase().includes('accepted') || result.toLowerCase().includes('rejected')) {
          return 'Completed';
        }
        return result || 'Pending';
      })(),
      breakdown_description: record.existingcondition,
      maintenance_breakdown_time: record.totalhours || 'N/A',
      start_time: record.occurtime ? record.occurtime.substring(0, 5) : 'N/A', // Format time as HH:MM
      finish_time: record.completiontime ? record.completiontime.substring(0, 5) : 'N/A', // Format time as HH:MM
      root_cause: record.rootcause || 'N/A',
      corrective_action: record.correction || 'N/A', // Using correction field for corrective action
      cost_incurred: record.costincurred ? `₹${record.costincurred}` : 'N/A',
      done_by: record.technicianname || 'N/A',
      verified_by: record.inspectioncheckedby || 'N/A',
      recoatingdate: record.recoatingdate || 'N/A',
      regrindingdate: record.regrindingdate || 'N/A'
    }));

    filteredData = [...historyData];

    // Populate equipment filter dropdown
    populateEquipmentFilter();

    renderTable();

  } catch (error) {
    console.error('Error loading machine history:', error);
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = `<tr class="loading-row"><td colspan="16">Error loading data: ${error.message}</td></tr>`;
  }
}

// Populate equipment filter dropdowns
function populateEquipmentFilter() {
  const equipmentIdSet = new Set();
  const equipmentNameSet = new Set();

  historyData.forEach(record => {
    if (record.equipment_identification_no) {
      equipmentIdSet.add(record.equipment_identification_no);
    }
    if (record.equipment_name) {
      equipmentNameSet.add(record.equipment_name);
    }
  });

  // Populate Equipment ID filter
  const equipmentFilter = document.getElementById('equipmentFilter');
  equipmentFilter.innerHTML = '<option value="">All Equipment</option>';
  Array.from(equipmentIdSet).sort().forEach(equipment => {
    const option = document.createElement('option');
    option.value = equipment;
    option.textContent = equipment;
    equipmentFilter.appendChild(option);
  });

  // Populate Equipment Name filter
  const equipmentNameFilter = document.getElementById('equipmentNameFilter');
  equipmentNameFilter.innerHTML = '<option value="">All Equipment Names</option>';
  Array.from(equipmentNameSet).sort().forEach(equipment => {
    const option = document.createElement('option');
    option.value = equipment;
    option.textContent = equipment;
    equipmentNameFilter.appendChild(option);
  });
}

// Load user profile
async function loadUserProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('full_name, employee_code')
      .eq('id', user.id)
      .single();

    if (profile) {
      const userNameEl = document.querySelector('.user-name');
      if (userNameEl) userNameEl.textContent = 'Hi, ' + profile.full_name;
    } else if (profileError) {
      console.error("Error fetching profile:", profileError);
    }
  } else {
    console.error("User not logged in.");
    window.location.href = '../html/auth.html';
  }
}

// Setup event listeners
function setupEventListeners() {
  document.addEventListener('DOMContentLoaded', async () => {
    // Load user profile
    await loadUserProfile();

    // Initialize cascading filter system
    initializeCascadingFilters();

    // Set up export button
    document.getElementById('exportBtn')?.addEventListener('click', exportToExcel);

    // Set up back button
    document.getElementById('backButton')?.addEventListener('click', () => {
      window.location.href = '../html/admin-mt.html';
    });

    // Update export button text based on current table config
    updateExportButtonText();

    // Logout functionality removed - this is a navigation page with only back button

    // Load initial data
    await fetchMachineHistory();

    // Setup pagination listeners
    setupPaginationListeners();
  });
}

// Update export button text based on current table configuration
function updateExportButtonText() {
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    const exportType = currentTableConfig === 'roller' ? 'Roller' : 'Machine';
    exportBtn.innerHTML = `<i class="fas fa-download"></i> ${exportType} History Card`;
  }
}

// Initialize the page
setupEventListeners();
