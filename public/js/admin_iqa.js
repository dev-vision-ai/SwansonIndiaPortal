import { supabase } from '../supabase-config.js';

let currentSort = { column: 'id', direction: 'asc' };
let alertsData = []; // Store fetched alerts globally for sorting and filtering

function renderTable(data) {
  const tbody = document.getElementById('alertsBody');
  tbody.innerHTML = data.map(alert => `
    <tr>
      <td>${alert.id}</td>
      <td>${new Date(alert.incidentdate).toLocaleDateString()}</td>
      <td>${alert.user_name || 'Unknown'}</td>
      <td>${alert.incidenttitle}</td>
      <td class="description-cell">${alert.incidentdesc || ''}</td>
      <td>${alert.responsibledept}</td>
      <td>${alert.abnormalitytype}</td>
      <td>
        <!-- Add View and Edit buttons with specific classes and data-id -->
        <button class="action-btn view-btn" data-id="${alert.id}">View</button>
        <button class="action-btn edit-btn" data-id="${alert.id}">Edit</button>
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

  alertsData.sort((a, b) => {
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

  renderTable(alertsData);
}

// Replace the old applyFilters function with this one:
function applyFilters(render = true) { // Added render parameter like in employee_dashboard.js
  // Use IDs from employee_dashboard.js
  const dateValue = document.getElementById('filterDate')?.value || ''; 
  const deptValue = document.getElementById('filterDept')?.value || '';
  const abnormalityValue = document.getElementById('filterAbnormality')?.value || '';
  console.log(`Applying filters: Date='${dateValue}', Dept='${deptValue}', Abnormality='${abnormalityValue}'`);

  let filteredData = alertsData;

  if (dateValue) {
    filteredData = filteredData.filter(alert => alert.incidentdate && alert.incidentdate === dateValue);
  }

  if (deptValue) {
    filteredData = filteredData.filter(alert => alert.responsibledept === deptValue);
  }

  if (abnormalityValue) {
    filteredData = filteredData.filter(alert => alert.abnormalitytype === abnormalityValue);
  }
  console.log('Filtered data count:', filteredData.length);

  if (render) {
      renderTable(filteredData); // Render the filtered results
  } else {
      return filteredData; // Return data without rendering if render is false
  }
}

// Replace the old clearFilters function with this one:
function clearFilters() {
  // Use IDs from employee_dashboard.js
  const dateInput = document.getElementById('filterDate');
  const deptInput = document.getElementById('filterDept');
  const abnormalityInput = document.getElementById('filterAbnormality');
  
  if (dateInput) dateInput.value = ''; // Clear date input
  if (deptInput) deptInput.value = ''; // Clear department dropdown (assuming '' is the 'all' value)
  if (abnormalityInput) abnormalityInput.value = ''; // Clear abnormality dropdown
  
  applyFilters(); // Re-apply filters which should now show all data
  console.log('Filters cleared.');
}

function setupEventListeners() {
  document.addEventListener('DOMContentLoaded', () => {
    fetchLatestAlerts();
    document.querySelectorAll('[data-sort]').forEach(header => {
      header.addEventListener('click', () => sortData(header.dataset.sort));
    });

    // --- Update these listeners --- 
    const dateInput = document.getElementById('filterDate');
    const deptInput = document.getElementById('filterDept');
    const abnormalityInput = document.getElementById('filterAbnormality');
    const clearBtn = document.getElementById('clearFilters'); // Use ID from employee_dashboard.js

    if (dateInput) dateInput.addEventListener('change', applyFilters);
    if (deptInput) deptInput.addEventListener('change', applyFilters);
    if (abnormalityInput) abnormalityInput.addEventListener('change', applyFilters);
    if (clearBtn) clearBtn.addEventListener('click', clearFilters);
    // -------------------------------

  });

  document.addEventListener('click', handleButtonActions);
}

setupEventListeners();

function handleButtonActions(e) {
  // Check if the clicked element has the 'action-btn' class
  if (e.target.classList.contains('action-btn')) {
    const alertId = e.target.dataset.id;
    // Determine the target URL (absolute path from web root)
    const targetUrl = '../html/quality_alerts_actions.html';

    // Check for the specific 'view-btn' or 'edit-btn' class
    if (e.target.classList.contains('view-btn')) {
      console.log(`Viewing alert ${alertId}`);
      // Navigate to the actions page with ID and action=view, and disable RPN calculation
      window.location.href = `${targetUrl}?id=${alertId}&action=view&skip_rpn=true`;
    } else if (e.target.classList.contains('edit-btn')) {
      console.log(`Editing alert ${alertId}`);
      // Navigate to the actions page with ID and action=edit
      window.location.href = `${targetUrl}?id=${alertId}&action=edit`;
    }
  }
}



async function fetchLatestAlerts() {
  try {
    document.getElementById('alertsBody').classList.add('loading');
    
    // Remove month boundary filtering
    const { data, error } = await supabase
      .from('quality_alerts')
      .select(`
        id,
        incidenttitle,
        responsibledept,
        incidentdate,
        statusaction,
        incidentdesc,
        abnormalitytype,
        users ( full_name )
      `)
      .order('id', { ascending: false });

    if (error) throw error;

    console.log("Fetched All Alerts:", data);
    alertsData = data.map(alert => ({
      ...alert,
      user_name: alert.users ? alert.users.full_name : null
    }));

    if (alertsData.length === 0) {
      showMessage('No incidents found');
    } else {
      renderTable(alertsData);
    }

  } catch (error) {
    showError(error.message);
  } finally {
    document.getElementById('alertsBody').classList.remove('loading');
  }
}

// Remove the following month change detection code completely
// Add month change detection
let currentMonth = new Date().getMonth();
setInterval(() => {
  const now = new Date();
  if (now.getMonth() !== currentMonth) {
    currentMonth = now.getMonth();
    fetchLatestAlerts();
  }
}, 3600000); // Check every hour

function showError(message) {
  const tbody = document.getElementById('alertsBody');
  tbody.innerHTML = `<tr class="error-row"><td colspan="7">${message}</td></tr>`;
}

function showMessage(message) {
  const tbody = document.getElementById('alertsBody');
  tbody.innerHTML = `<tr class="empty-row"><td colspan="7">${message}</td></tr>`;
}

async function loadUserProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('full_name, employee_code')
            .eq('id', user.id)
            .single();

        if (profile) {
            document.querySelector('.user-name').textContent = 'Hi, ' + profile.full_name;
            document.getElementById('employeeName').textContent = profile.full_name;
            document.getElementById('employeeCode').textContent = (profile.employee_code || '').toUpperCase();
        } else if (profileError) {
            console.error("Error fetching profile:", profileError);
            document.getElementById('employeeName').textContent = user.email || 'Employee';
            document.getElementById('employeeCode').textContent = user.id.substring(0, 8).toUpperCase();
        }
    } else {
        console.error("User not logged in.");
        window.location.href = '/';
    }
}

// Call loadUserProfile on page load
loadUserProfile();
