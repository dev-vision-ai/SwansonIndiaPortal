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
      <td>${alert.user_department || 'N/A'}</td>
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
  document.addEventListener('DOMContentLoaded', async () => {
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
    const showStatsBtn = document.getElementById('showStats');
    if (showStatsBtn) showStatsBtn.addEventListener('click', showStats);
    // -------------------------------

    const logoutButton = document.getElementById('logoutButton'); // Get the button by its ID

    // --- Updated Logout Button Listener with Confirmation --- 
    if (logoutButton) {
        logoutButton.addEventListener('click', async (e) => { // Added async and event object 'e'
            e.preventDefault(); // Prevent default button behavior if any

            if (window.confirm("Are you sure you want to log out?")) {
                console.log('Logout confirmed, signing out...'); // Debug log
                try {
                    const { error } = await supabase.auth.signOut();
                    if (error) {
                        console.error('Error logging out:', error);
                        alert('Logout failed. Please try again.');
                    } else {
                        console.log('Logout successful, redirecting...'); // Debug log
                        window.location.href = '../html/auth.html'; // Redirect after successful logout
                    }
                } catch (err) {
                    console.error('Exception during logout:', err);
                    alert('An unexpected error occurred during logout.');
                }
            } else {
                console.log('Logout cancelled by user.'); // Debug log (optional)
            }
        });
    }
    // --- End Updated Logout Button Listener ---
  });

  document.addEventListener('click', handleButtonActions);
}

setupEventListeners();

function showStats() {
  window.location.href = '../html/quality_alerts_stats.html';
}

function handleButtonActions(e) {
  // Check if the clicked element has the 'action-btn' class
  if (e.target.classList.contains('action-btn')) {
    const alertId = e.target.dataset.id;
    // Determine the target URL (absolute path from web root)
    const targetUrl = '../html/quality_alerts_actions.html';
    const fromTable = '&from=table';

    // Check for the specific 'view-btn' or 'edit-btn' class
    if (e.target.classList.contains('view-btn')) {
      console.log(`Viewing alert ${alertId}`);
      // Navigate to the actions page with ID and action=view, and disable RPN calculation
      window.location.href = `${targetUrl}?id=${alertId}&action=view&skip_rpn=true${fromTable}`;
    } else if (e.target.classList.contains('edit-btn')) {
      console.log(`Editing alert ${alertId}`);
      // Navigate to the actions page with ID and action=edit
      window.location.href = `${targetUrl}?id=${alertId}&action=edit${fromTable}`;
    }
  }
}

async function fetchLatestAlerts() {
  try {
    const alertsBody = document.getElementById('alertsBody');
    if (alertsBody) alertsBody.classList.add('loading');
    // Modify the select query to include department
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
        users ( full_name, department ) // Added department here
      `)
      .order('id', { ascending: false });

    if (error) throw error;

    console.log("Fetched All Alerts:", data);
    alertsData = data.map(alert => ({
      ...alert,
      user_name: alert.users ? alert.users.full_name : null,
      user_department: alert.users ? alert.users.department : null // Added department mapping
    }));

    if (alertsData.length === 0) {
      showMessage('No incidents found');
    } else {
      renderTable(alertsData);
    }

  } catch (error) {
    showError(error.message);
  } finally {
    const alertsBody = document.getElementById('alertsBody');
    if (alertsBody) alertsBody.classList.remove('loading');
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
  if (tbody) {
    tbody.innerHTML = `<tr class="error-row"><td colspan="9">${message}</td></tr>`; // Updated colspan
  }
}

function showMessage(message) {
  const tbody = document.getElementById('alertsBody');
  if (tbody) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="9">${message}</td></tr>`; // Updated colspan
  }
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
            const userNameEl = document.querySelector('.user-name');
            if (userNameEl) userNameEl.textContent = 'Hi, ' + profile.full_name;
            const employeeNameEl = document.getElementById('employeeName');
            if (employeeNameEl) employeeNameEl.textContent = profile.full_name;
            const employeeCodeEl = document.getElementById('employeeCode');
            if (employeeCodeEl) employeeCodeEl.textContent = (profile.employee_code || '').toUpperCase();
        } else if (profileError) {
            console.error("Error fetching profile:", profileError);
            const employeeNameEl = document.getElementById('employeeName');
            if (employeeNameEl) employeeNameEl.textContent = user.email || 'Employee';
            const employeeCodeEl = document.getElementById('employeeCode');
            if (employeeCodeEl) employeeCodeEl.textContent = user.id.substring(0, 8).toUpperCase();
        }
    } else {
        console.error("User not logged in.");
        window.location.href = '/';
    }
}

// Call loadUserProfile on page load
loadUserProfile();
