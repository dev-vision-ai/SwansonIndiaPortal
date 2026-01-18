import { supabase } from '../supabase-config.js';

let currentSort = { column: 'timestamp', direction: 'desc' };
let requisitionsData = []; // Store fetched requisitions globally for sorting and filtering
const filterStatusIndicator = document.getElementById('filterStatusIndicator');

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
  if (!tbody) return;

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
        <!-- Action buttons using Tailwind (consistent with film inspection forms) -->
        <div class="flex justify-center space-x-1">
          <button class="p-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 hover:text-blue-900 transition-all duration-200 border border-blue-200 hover:border-blue-300 flex-shrink-0" data-uuid="${requisition.id}" title="View Details">
            ${createIcon('view')}
          </button>
          <button class="p-1 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-600 hover:text-purple-800 transition-all duration-200 border border-purple-200 hover:border-purple-300 flex-shrink-0" data-uuid="${requisition.id}" title="Edit Record">
            ${createIcon('edit')}
          </button>
          <button class="p-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-800 transition-all duration-200 border border-indigo-200 hover:border-indigo-300 flex-shrink-0" data-uuid="${requisition.id}" title="Download as Excel">
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

  // Update filter status indicator (On/Off style like film inspection forms)
  const hasActiveFilters = dateValue || deptValue || equipmentValue;
  if (filterStatusIndicator) {
    if (hasActiveFilters) {
      filterStatusIndicator.textContent = 'On';
      filterStatusIndicator.className = 'px-2 py-1 text-sm font-semibold rounded-full bg-green-200 text-green-700';
    } else {
      filterStatusIndicator.textContent = 'Off';
      filterStatusIndicator.className = 'px-2 py-1 text-sm font-semibold rounded-full bg-gray-200 text-gray-700';
    }
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
    tbody.innerHTML = `<tr class="error-row"><td colspan="9">${message}</td></tr>`;
  }
}

function showMessage(message) {
  const tbody = document.getElementById('alertsBody');
  if (tbody) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="9">${message}</td></tr>`;
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

      const targetUrl = '../html/mjr-action.html';
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

      const targetUrl = '../html/mjr-action.html';
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

    // Get the current session to include JWT token
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const headers = {
      'Content-Type': 'application/json',
    };

    // Add Authorization header if we have a token
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: headers,
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