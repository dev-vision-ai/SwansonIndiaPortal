import { supabase } from '../supabase-config.js';

let currentSort = { column: 'timestamp', direction: 'desc' };
let requisitionsData = []; // Store fetched requisitions globally for sorting and filtering

function formatDateToDDMMYYYY(dateString) {
  if (!dateString) return 'N/A';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

// Helper function to create SVG icons (same as film inspection forms)
function createIcon(iconType) {
  const icons = {
    view: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
    </svg>`,
    edit: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
    </svg>`,
    download: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
    </svg>`
  };
  return icons[iconType] || '';
}

function renderTable(data) {
  const tbody = document.getElementById('alertsBody');
  tbody.innerHTML = data.map(requisition => `
    <tr>
      <td>${requisition.requisitionno || 'N/A'}</td>
      <td>${formatDateToDDMMYYYY(requisition.occurdate)}</td>
      <td>${requisition.requestorname || 'Unknown'}</td>
      <td>${requisition.reqdept || 'N/A'}</td>
      <td>${requisition.equipmentname || 'N/A'}</td>
      <td>${requisition.existingcondition || 'N/A'}</td>
      <td>${requisition.machineno || 'N/A'}</td>
      <td><span class="status-${requisition.status?.toLowerCase() || 'pending'}">${requisition.status || 'Pending'}</span></td>
      <td>
        <!-- Action buttons with SVG icons (same as film inspection forms) -->
        <div style="display: flex; justify-content: center; gap: 4px;">
          <button style="padding: 4px; border-radius: 6px; background-color: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; min-width: 28px; min-height: 28px;" data-uuid="${requisition.id}" title="View Details" onmouseover="this.style.backgroundColor='#bfdbfe'; this.style.color='#1d4ed8'" onmouseout="this.style.backgroundColor='#dbeafe'; this.style.color='#1e40af'">
            ${createIcon('view')}
          </button>
          <button style="padding: 4px; border-radius: 6px; background-color: #f3e8ff; color: #7c3aed; border: 1px solid #e9d5ff; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; min-width: 28px; min-height: 28px;" data-uuid="${requisition.id}" title="Edit Record" onmouseover="this.style.backgroundColor='#e9d5ff'; this.style.color='#6d28d9'" onmouseout="this.style.backgroundColor='#f3e8ff'; this.style.color='#7c3aed'">
            ${createIcon('edit')}
          </button>
          <button style="padding: 4px; border-radius: 6px; background-color: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; min-width: 28px; min-height: 28px;" data-uuid="${requisition.id}" title="Download as Excel" onmouseover="this.style.backgroundColor='#c7d2fe'; this.style.color='#3730a3'" onmouseout="this.style.backgroundColor='#e0e7ff'; this.style.color='#4338ca'">
            ${createIcon('download')}
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  // Set up event listeners for newly created buttons
  setupButtonEventListeners();
}

function sortData(column) {
  if (currentSort.column === column) {
    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort = { column, direction: 'asc' };
  }

  requisitionsData.sort((a, b) => {
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

  renderTable(requisitionsData);
}

function applyFilters(render = true) {
  const dateValue = document.getElementById('filterDate')?.value || '';
  const deptValue = document.getElementById('filterDept')?.value || '';
  const equipmentValue = document.getElementById('filterEquipment')?.value || '';

  let filteredData = requisitionsData;

  if (dateValue) {
    filteredData = filteredData.filter(req => req.occurdate && req.occurdate === dateValue);
  }

  if (deptValue) {
    filteredData = filteredData.filter(req => req.reqdept === deptValue);
  }

  if (equipmentValue) {
    filteredData = filteredData.filter(req => req.equipmentname && req.equipmentname.toLowerCase().includes(equipmentValue.toLowerCase()));
  }

  if (render) {
    renderTable(filteredData);
  } else {
    return filteredData;
  }
}

function clearFilters() {
  const dateInput = document.getElementById('filterDate');
  const deptInput = document.getElementById('filterDept');
  const equipmentInput = document.getElementById('filterEquipment');

  if (dateInput) dateInput.value = '';
  if (deptInput) deptInput.value = '';
  if (equipmentInput) equipmentInput.value = '';

  applyFilters();
}


async function fetchMTJobRequisitions() {
  try {
    const alertsBody = document.getElementById('alertsBody');
    if (alertsBody) alertsBody.classList.add('loading');

    // Fetch from mt_job_requisition_master table as requested
    const { data, error } = await supabase
      .from('mt_job_requisition_master')
      .select(`
        id,
        requisitionno,
        occurdate,
        requestorname,
        reqdept,
        equipmentname,
        existingcondition,
        machineno,
        inspectionresult
      `)
      .order('occurdate', { ascending: false });

    if (error) {
      console.error("Error fetching MT job requisitions:", error);
      showError(`Error loading data: ${error.message}`);
      return;
    }

    requisitionsData = data.map(requisition => ({
      id: requisition.id,
      requisitionno: requisition.requisitionno,
      occurdate: requisition.occurdate,
      requestorname: requisition.requestorname,
      reqdept: requisition.reqdept,
      equipmentname: requisition.equipmentname,
      existingcondition: requisition.existingcondition,
      machineno: requisition.machineno,
      status: (() => {
        const result = requisition.inspectionresult;
        if (!result) return 'Pending';
        if (result.toLowerCase().includes('accepted') || result.toLowerCase().includes('rejected')) {
          return 'Completed';
        }
        return result || 'Pending';
      })()
    }));

    if (requisitionsData.length === 0) {
      showMessage('No job requisitions found');
    } else {
      renderTable(requisitionsData);
    }

  } catch (error) {
    console.error('Error loading MT job requisitions:', error);
    showError(`Error: ${error.message}`);
  } finally {
    const alertsBody = document.getElementById('alertsBody');
    if (alertsBody) alertsBody.classList.remove('loading');
  }
}

function setupTableEventListeners() {
  // Set up sorting event listeners
  document.querySelectorAll('[data-sort]').forEach(header => {
    header.addEventListener('click', () => sortData(header.dataset.sort));
  });

  // Set up filter event listeners
  const dateInput = document.getElementById('filterDate');
  const deptInput = document.getElementById('filterDept');
  const equipmentInput = document.getElementById('filterEquipment');
  const clearBtn = document.getElementById('clearFilters');

  if (dateInput) dateInput.addEventListener('change', applyFilters);
  if (deptInput) deptInput.addEventListener('change', applyFilters);
  if (equipmentInput) equipmentInput.addEventListener('input', applyFilters);
  if (clearBtn) clearBtn.addEventListener('click', clearFilters);

  // Load initial data
  fetchMTJobRequisitions();
}

function showError(message) {
  const tbody = document.getElementById('alertsBody');
  if (tbody) {
    tbody.innerHTML = `<tr class="error-row"><td colspan="8">${message}</td></tr>`;
  }
}

function showMessage(message) {
  const tbody = document.getElementById('alertsBody');
  if (tbody) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">${message}</td></tr>`;
  }
}


// Enhanced setup function that includes table functionality
function setupEventListeners() {
  document.addEventListener('DOMContentLoaded', async () => {
    // Set up table event listeners if we're on the table page
    if (document.getElementById('alertsBody')) {
      setupTableEventListeners();
    }

  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', async (e) => {
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
            
            window.history.pushState(null, '', window.location.href);
            window.onpopstate = function() {
              window.history.pushState(null, '', window.location.href);
            };
            
            const essentialKeys = ['rememberedEmpCode', 'rememberedPassword'];
            for (let i = sessionStorage.length - 1; i >= 0; i--) {
              const key = sessionStorage.key(i);
              if (!essentialKeys.includes(key)) {
                sessionStorage.removeItem(key);
              }
            }
            for (let i = localStorage.length - 1; i >= 0; i--) {
              const key = localStorage.key(i);
              if (!essentialKeys.includes(key)) {
                localStorage.removeItem(key);
              }
            }

            window.location.replace('../html/auth.html');
          }
        } catch (err) {
          console.error('Exception during logout:', err);
          alert('An unexpected error occurred during logout.');
        }
        } else {
          // User cancelled logout
      }
    });
    }
  });
}

setupEventListeners();

function setupButtonEventListeners() {
  // Set up view button listeners (using data-uuid attribute)
  const viewButtons = document.querySelectorAll('button[data-uuid][title="View Details"]');

  viewButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const requisitionId = e.currentTarget.dataset.uuid;

      if (!requisitionId) {
        console.error('No requisition ID found in button data-uuid attribute');
        alert('Error: No requisition ID found');
        return;
      }

      const targetUrl = '../html/MT-job-requisition-form-action.html';
      window.location.href = `${targetUrl}?id=${requisitionId}&action=view`;
    });
  });

  // Set up edit button listeners (using data-uuid attribute)
  const editButtons = document.querySelectorAll('button[data-uuid][title="Edit Record"]');

  editButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const requisitionId = e.currentTarget.dataset.uuid;

      if (!requisitionId) {
        console.error('No requisition ID found in button data-uuid attribute');
        alert('Error: No requisition ID found');
        return;
      }

      const targetUrl = '../html/MT-job-requisition-form-action.html';
      window.location.href = `${targetUrl}?id=${requisitionId}&action=edit`;
    });
  });

  // Set up download button listeners (using data-uuid attribute)
  const downloadButtons = document.querySelectorAll('button[data-uuid][title="Download as Excel"]');

  downloadButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent any parent event handlers
      const requisitionId = e.currentTarget.dataset.uuid;

      if (!requisitionId) {
        console.error('No requisition ID found in button data-uuid attribute');
        alert('Error: No requisition ID found');
        return;
      }

      downloadRequisitionAsExcel(requisitionId);
    });
  });
}

async function downloadRequisitionAsExcel(requisitionId) {
  // Show loading state immediately
  const downloadBtn = event.target;
  if (!downloadBtn) {
    console.error('No download button found');
    return;
  }

  const originalContent = downloadBtn.innerHTML;
  const originalTitle = downloadBtn.title;

  // Show loading state
  downloadBtn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
  downloadBtn.title = 'Downloading...';
  downloadBtn.disabled = true;

  try {
    // Determine backend URL
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const backendUrl = isLocalhost ? 'http://localhost:3000' : 'https://swanson-backend.onrender.com';

    // First, test if backend is reachable
    try {
      const testResponse = await fetch(`${backendUrl}/api/test`);
      if (testResponse.ok) {
        // Backend server is reachable
      } else {
        console.warn('Backend server responded with status:', testResponse.status);
      }
    } catch (testError) {
      console.error('❌ Cannot reach backend server at', backendUrl);
      throw new Error(`Cannot connect to backend server. Please ensure the backend is running on port 3000.`);
    }

    // Call the Excel export API endpoint
    const endpoint = `${backendUrl}/api/export-mjr-record/${encodeURIComponent(requisitionId)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (parseError) {
        // Could not parse error response as JSON
      }
      throw new Error(errorMessage);
    }

    // Get the Excel blob from response
    const blob = await response.blob();

    if (blob.size === 0) {
      throw new Error('Received empty file from server');
    }

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;

    // Get filename from response headers or use default
    let filename = `MJR-${requisitionId}.xlsx`;
    const contentDisposition = response.headers.get('Content-Disposition');

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    // Show success state briefly
    downloadBtn.innerHTML = '<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
    downloadBtn.title = 'Downloaded!';

    // Reset button after 2 seconds
    setTimeout(() => {
      downloadBtn.innerHTML = originalContent;
      downloadBtn.title = originalTitle;
      downloadBtn.disabled = false;
    }, 2000);

  } catch (error) {
    console.error('Error downloading MJR Excel:', error);

    // Show error state on button
    downloadBtn.innerHTML = '<svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
    downloadBtn.title = 'Download failed';

    // Reset button after 3 seconds
    setTimeout(() => {
      downloadBtn.innerHTML = createIcon('download');
      downloadBtn.title = 'Download as Excel';
      downloadBtn.disabled = false;
    }, 3000);

    // Show user-friendly error message
    let errorMessage = error.message;
    if (error.name === 'AbortError') {
      errorMessage = 'Download timed out. Please check if the backend server is running.';
    } else if (error.message.includes('fetch')) {
      errorMessage = 'Cannot connect to server. Please check if the backend is running on port 3000.';
    }

    alert(`Error downloading Excel file: ${errorMessage}\n\nCheck the browser console for more details.`);
  }
} 