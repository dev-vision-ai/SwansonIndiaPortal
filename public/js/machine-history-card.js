import { supabase } from '../supabase-config.js';
import { showToast } from './toast.js';

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================

const itemsPerPage = 10;
const facilityAreas = [
  'Production Corridor', 'Warehouse Corridor', 'Dock Area', 'Building Surrounding',
  'RM Warehouse #1', 'RM Warehouse #2', 'Utility Area', 'Terrace Area', 'Security Gate'
];

// Table configuration for different record types
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
      { key: 'start_time', header: 'Start Time', field: 'start_time' },
      { key: 'finish_time', header: 'Finish Time', field: 'finish_time' },
      { key: 'total_bd_time', header: 'Total BD Time', field: 'total_bd_time' },
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

// ==========================================
// STATE MANAGEMENT
// ==========================================

let state = {
  data: [],        // Raw data from DB
  filtered: [],    // Data after filters
  currentPage: 1,
  sort: { column: 'breakdown_date', direction: 'desc' },
  tableConfig: 'standard',
  filters: {
    category: '',
    equipmentName: '',
    equipment: '',
    fromDate: '',
    toDate: '',
    status: ''
  }
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

const isRollerEquipment = name => name && ['Rubber Roller', 'Emboss Roller', 'Rubber roller', 'Emboss roller'].some(t => name.includes(t));

const formatDateToDDMMYYYY = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};

const getStatusClass = (status) => {
  if (!status || status === 'N/A') return 'status-pending';
  const s = status.toLowerCase();
  return s === 'completed' ? 'status-completed' : (s === 'pending' ? 'status-pending' : 'status-default');
};

// Helper to combine Date and Time strings into a Date object
const parseDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  const d = new Date(`${dateStr}T${timeStr}`);
  return isNaN(d.getTime()) ? null : d;
};

// Updated implementation of breakdown time calculation
// Uses full DateTime difference to support multi-day breakdowns
const calculateTotalBDTime = (start, end) => {
  if (!start || !end) return 'N/A';

  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return 'Error (Neg)';

  const d = Math.floor(diffMs / (24 * 3600000));
  const h = Math.floor((diffMs % (24 * 3600000)) / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);

  let result = [];
  if (d > 0) result.push(`${d}d`);
  if (h > 0) result.push(`${h}h`);
  if (m > 0) result.push(`${m}m`);

  return result.length > 0 ? result.join(' ') : '0m';
};

// DOM Helper to populate select options
const populateSelect = (elementId, items, defaultText) => {
  const select = document.getElementById(elementId);
  if (!select) return;
  select.innerHTML = `<option value="">${defaultText}</option>`;
  [...new Set(items)].sort().forEach(item => {
    const option = document.createElement('option');
    option.value = item;
    option.textContent = item;
    select.appendChild(option);
  });
};

// ==========================================
// CORE LOGIC: MAPPING & FILTERING
// ==========================================

async function fetchMachineHistory() {
  const tbody = document.getElementById('historyTableBody');
  tbody.innerHTML = '<tr class="loading-row"><td colspan="16">Loading machine history data...</td></tr>';

  try {
    const { data, error } = await supabase
      .from('mt_job_requisition_master')
      .select('*')
      .order('occurdate', { ascending: false });

    if (error) throw error;

    // Map DB to App Logic
    state.data = data.map(record => {
      const category = (record.machineno && facilityAreas.includes(record.machineno)) ? 'Facility' : 'Machine';
      const breakdownCodes = record.breakdowncodes;

      let bdCodeDisplay = 'N/A';
      if (breakdownCodes) {
        if (typeof breakdownCodes === 'object' && !Array.isArray(breakdownCodes)) {
          const keys = Object.keys(breakdownCodes).filter(k => breakdownCodes[k] === true);
          if (keys.length) bdCodeDisplay = keys.join(', ');
        } else if (Array.isArray(breakdownCodes)) {
          bdCodeDisplay = breakdownCodes.join(', ');
        } else {
          bdCodeDisplay = breakdownCodes;
        }
      }

      const status = (!record.inspectionresult) ? 'Pending' :
        (record.inspectionresult.toLowerCase().includes('accepted') || record.inspectionresult.toLowerCase().includes('rejected')) ? 'Completed' :
          record.inspectionresult;

      // Construct full DateTime objects for calculation using schedule dates
      const startDateTime = parseDateTime(record.schedulestartdate, record.schedulestarttime);
      const endDateTime = parseDateTime(record.scheduleenddate, record.scheduleendtime);

      return {
        id: record.id,
        category,
        breakdown_date: record.occurdate,
        mjr_number: record.requisitionno,
        bd_code: bdCodeDisplay,
        equipment_identification_no: record.equipmentno || 'N/A',
        equipment_name: record.equipmentname || 'N/A',
        equipment_installation_date: record.equipmentinstalldate || 'N/A',
        status,
        breakdown_description: record.existingcondition,
        start_time: record.schedulestarttime?.substring(0, 5) || 'N/A', // Using Schedule Start Time
        finish_time: record.scheduleendtime?.substring(0, 5) || 'N/A', // Using Schedule End Time
        total_bd_time: calculateTotalBDTime(startDateTime, endDateTime),
        root_cause: record.rootcause || 'N/A',
        corrective_action: record.correction || 'N/A',
        cost_incurred: record.costincurred ? `₹${record.costincurred}` : 'N/A',
        done_by: record.technicianname || 'N/A',
        verified_by: record.inspectioncheckedby || 'N/A',
        recoatingdate: record.recoatingdate || 'N/A',
        regrindingdate: record.regrindingdate || 'N/A',

        // Keep raw values for filters if needed
        raw_start_date: startDateTime,
        raw_end_date: endDateTime,
        
        // Raw schedule fields for export
        schedulestartdate: record.schedulestartdate,
        schedulestarttime: record.schedulestarttime,
        scheduleenddate: record.scheduleenddate,
        scheduleendtime: record.scheduleendtime
      };
    });

    state.filtered = [...state.data];
    populateFilters(true);
    renderTable();

  } catch (error) {
    console.error('Error:', error);
    tbody.innerHTML = `<tr class="loading-row"><td colspan="16">Error loading data: ${error.message}</td></tr>`;
  }
}

function applyFilters() {
  const { category, equipmentName, equipment, fromDate, toDate, status } = state.filters;

  state.filtered = state.data.filter(rec => {
    if (category && rec.category !== category) return false;
    if (equipmentName && rec.equipment_name !== equipmentName) return false;
    if (equipment && rec.equipment_identification_no !== equipment) return false;
    if (fromDate && rec.breakdown_date < fromDate) return false;
    if (toDate && rec.breakdown_date > toDate) return false;
    if (status && rec.status.toLowerCase() !== status.toLowerCase()) return false;
    return true;
  });

  state.currentPage = 1;

  // Update Config based on selection
  const newConfig = isRollerEquipment(equipmentName) ? 'roller' : 'standard';
  if (newConfig !== state.tableConfig) {
    state.tableConfig = newConfig;
    renderTableHeaders();
  }

  renderTable();
  updateFilterStatusUI();
}

function populateFilters(fullReset = false) {
  // We filter dropdown options based on current Category logic
  // If fullReset, we use all data. If just updating, we might want to respect category
  // Implementation: Always respect current Category filter for Dropdowns

  const relevantData = state.filters.category
    ? state.data.filter(d => d.category === state.filters.category)
    : state.data;

  // 1. Available Equipment Names (filtered by Category)
  const names = relevantData.map(d => d.equipment_name).filter(n => n && n !== 'N/A');

  // 2. Available Equipment IDs (filtered by Category AND Selected Name if any)
  // Logic: If name is selected, limit IDs to that name.
  const relevantDataForIds = state.filters.equipmentName
    ? relevantData.filter(d => d.equipment_name === state.filters.equipmentName)
    : relevantData;

  const ids = relevantDataForIds.map(d => d.equipment_identification_no).filter(id => id && id !== 'N/A');

  // We only re-populate if we are not the ones triggering change?
  // Strategy: Always re-populate compatible options.
  // Note: re-populating 'Name' while 'Name' is selected might lose focus or value if not handled.
  // We only repopulate if the value is likely invalid or during initialization.
  // For 'UpdateEquipmentFilter' equivalent:

  if (fullReset) {
    populateSelect('equipmentNameFilter', names, 'All Equipment Names');
    populateSelect('equipmentFilter', ids, 'All Equipment');
  } else {
    // Logic for cascaded updates
    // Re-populate IDs when Name changes
    populateSelect('equipmentFilter', ids, 'All Equipment');
    // Don't nuke Name filter if it's the one that changed
  }
}

// ==========================================
// TABLE RENDERING
// ==========================================

function renderTableHeaders() {
  const table = document.getElementById('historyTable');
  const thead = table.querySelector('thead');
  const config = tableConfigs[state.tableConfig];

  table.className = `history-table ${state.tableConfig}-format`;

  if (state.tableConfig === 'standard') {
    const groupKeys = ['start_time', 'finish_time', 'total_bd_time'];
    const firstRow = [];
    const secondRow = [];
    let groupAdded = false;

    config.columns.forEach(col => {
      if (groupKeys.includes(col.key)) {
        if (!groupAdded) {
          firstRow.push(`<th colspan="${groupKeys.length}">Maintenance Breakdown Time</th>`);
          groupAdded = true;
        }
        secondRow.push(`<th>${col.header}</th>`);
      } else {
        firstRow.push(`<th rowspan="2">${col.header}</th>`);
      }
    });

    thead.innerHTML = `<tr>${firstRow.join('')}</tr><tr>${secondRow.join('')}</tr>`;
  } else {
    thead.innerHTML = `<tr>${config.columns.map(col => `<th>${col.header}</th>`).join('')}</tr>`;
  }

  const titleEl = document.querySelector('.table-header h2');
  if (titleEl) titleEl.textContent = config.title;

  updateExportButtonUI();
}

function getFormattedCellValue(col, record) {
  let value = record[col.field];

  if (['breakdown_date', 'equipment_installation_date'].includes(col.field)) {
    return formatDateToDDMMYYYY(value);
  }
  if (['recoatingdate', 'regrindingdate'].includes(col.field)) {
    return formatDateToDDMMYYYY(value);
  }
  if (['start_time', 'finish_time'].includes(col.field)) {
    return value || 'N/A';
  }
  if (col.field === 'total_bd_time') {
    return value || 'N/A';
  }
  if (col.field === 'status') {
    return `<span class="${getStatusClass(value)}">${value || 'N/A'}</span>`;
  }
  return value || 'N/A';
}

function renderTable() {
  const tbody = document.getElementById('historyTableBody');
  const start = (state.currentPage - 1) * itemsPerPage;
  const pageData = state.filtered.slice(start, start + itemsPerPage);
  const config = tableConfigs[state.tableConfig];

  if (!pageData.length) {
    tbody.innerHTML = `<tr class="loading-row"><td colspan="${config.columns.length}">No records found</td></tr>`;
    updatePaginationUI();
    return;
  }

  tbody.innerHTML = pageData.map(record => `
    <tr>${config.columns.map(col => `<td>${getFormattedCellValue(col, record)}</td>`).join('')}</tr>
  `).join('');

  updatePaginationUI();
}

function updatePaginationUI() {
  const total = state.filtered.length;
  const pages = Math.ceil(total / itemsPerPage) || 1;

  document.getElementById('paginationInfo').textContent = `Page ${state.currentPage} of ${pages}`;
  document.getElementById('prevPage').disabled = state.currentPage === 1;
  document.getElementById('nextPage').disabled = state.currentPage >= pages;
}

function updateFilterStatusUI() {
  const statusEl = document.getElementById('filterStatusIndicator');
  if (!statusEl) return;
  const active = Object.values(state.filters).some(v => v !== '');
  statusEl.textContent = active ? 'On' : 'Off';
  statusEl.className = `px-2 py-1 text-sm font-semibold rounded-full ${active ? 'bg-green-200 text-green-700' : 'bg-gray-200 text-gray-700'}`;
}

function updateExportButtonUI() {
  const btn = document.getElementById('exportBtn');
  if (btn) {
    const type = state.tableConfig === 'roller' ? 'Roller' : 'Machine';
    btn.innerHTML = `<i class="fas fa-download"></i> ${type} History Card`;
  }
}

// ==========================================
// EVENT HANDLERS
// ==========================================

function setupEventListeners() {
  // FILTERS
  const ids = {
    category: 'categoryFilter',
    equipmentName: 'equipmentNameFilter',
    equipment: 'equipmentFilter',
    fromDate: 'dateFromFilter',
    toDate: 'dateToFilter',
    status: 'statusFilter'
  };

  Object.entries(ids).forEach(([key, id]) => {
    document.getElementById(id)?.addEventListener('change', (e) => {
      state.filters[key] = e.target.value;

      // Special Logic for Cascading
      if (key === 'category') {
        // Reset sub-filters
        state.filters.equipmentName = '';
        state.filters.equipment = '';
        document.getElementById(ids.equipmentName).value = '';
        document.getElementById(ids.equipment).value = '';
        populateFilters(true); // Re-populate based on new category
      } else if (key === 'equipmentName') {
        // Update ID list based on Name
        populateFilters(false);
      }

      applyFilters();
    });
  });

  document.getElementById('clearFilters')?.addEventListener('click', () => {
    Object.keys(ids).forEach(k => {
      state.filters[k] = '';
      const el = document.getElementById(ids[k]);
      if (el) el.value = '';
    });
    state.tableConfig = 'standard';
    renderTableHeaders();
    populateFilters(true); // Reset lists to full
    applyFilters();
  });

  // PAGINATION
  document.getElementById('prevPage')?.addEventListener('click', () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      renderTable();
    }
  });

  document.getElementById('nextPage')?.addEventListener('click', () => {
    const pages = Math.ceil(state.filtered.length / itemsPerPage);
    if (state.currentPage < pages) {
      state.currentPage++;
      renderTable();
    }
  });

  // EXPORT & NAV
  document.getElementById('exportBtn')?.addEventListener('click', exportToExcel);
  document.getElementById('backButton')?.addEventListener('click', () => window.location.href = '../html/employee-dashboard.html');
}


// ==========================================
// EXPORT FUNCTIONALITY
// ==========================================

async function exportToExcel() {
  const { equipmentName, equipment } = state.filters;
  const isRoller = isRollerEquipment(equipmentName);
  const type = isRoller ? 'Roller' : 'Machine';
  const endpoint = isRoller ? '/api/export-roller-history-card' : '/api/export-machine-history-card';

  try {
    const btn = document.getElementById('exportBtn');
    if (btn) {
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Exporting...`;
      btn.disabled = true;
    }

    const exportData = state.filtered.map(r => ({
      occurdate: r.breakdown_date,
      requisitionno: r.mjr_number,
      breakdowncodes: r.bd_code,
      equipmentno: r.equipment_identification_no,
      equipmentname: r.equipment_name,
      equipmentinstalldate: r.equipment_installation_date,
      existingcondition: r.breakdown_description,
      occurtime: r.start_time,
      completiontime: r.finish_time,
      // Add schedule fields for backend
      schedulestartdate: r.schedulestartdate,
      schedulestarttime: r.schedulestarttime,
      scheduleenddate: r.scheduleenddate,
      scheduleendtime: r.scheduleendtime,
      rootcause: r.root_cause,
      correction: r.corrective_action,
      costincurred: r.cost_incurred.replace('₹', ''),
      technicianname: r.done_by,
      inspectioncheckedby: r.verified_by,
      inspectionresult: r.status === 'Completed' ? 'Accepted' : 'Pending',
      recoatingdate: r.recoatingdate,
      regrindingdate: r.regrindingdate,
      total_bd_time: r.total_bd_time
    }));

    const baseUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:3000' : 'https://swanson-backend.onrender.com';

    // Test connectivity
    try {
      const testParam = await fetch(`${baseUrl}/api/test`);
      if (!testParam.ok) throw new Error('Backend unreachable');
    } catch {
      throw new Error(`Cannot connect to backend for ${type} export.`);
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: exportData,
        filterSummary: {
          totalRecords: state.filtered.length,
          appliedFilters: state.filters
        },
        selectedEquipmentName: equipmentName,
        selectedEquipmentId: equipment
      })
    });

    if (!response.ok) throw new Error('Export request failed');

    // Extract filename
    const disposition = response.headers.get('Content-Disposition');
    const filename = disposition?.match(/filename="(.+)"/)?.[1] || `${type}-History-Card.xlsx`;

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    // Show success message
    showToast(`${type} History Card exported successfully!`, 'success');

  } catch (error) {
    showToast('Export failed: ' + error.message, 'error');
  } finally {
    updateExportButtonUI();
    const btn = document.getElementById('exportBtn');
    if (btn) btn.disabled = false;
  }
}

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  fetchMachineHistory();
});
