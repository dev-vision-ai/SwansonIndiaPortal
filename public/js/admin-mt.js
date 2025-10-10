import { supabase } from '../supabase-config.js';

let currentSort = { column: 'timestamp', direction: 'desc' };
let requisitionsData = []; // Store fetched requisitions globally for sorting and filtering

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
  const tbody = document.getElementById('alertsBody');
  tbody.innerHTML = data.map(requisition => `
    <tr>
      <td>${requisition.id}</td>
      <td>${formatDateToDDMMYYYY(requisition.occurdate)}</td>
      <td>${requisition.requestorname || 'Unknown'}</td>
      <td>${requisition.reqdept || 'N/A'}</td>
      <td>${requisition.equipmentname || 'N/A'}</td>
      <td>${requisition.existingcondition || 'N/A'}</td>
      <td>${requisition.machineno || 'N/A'}</td>
      <td>
        <!-- Add View and Edit buttons with specific classes and data-id -->
        <button class="action-btn view-btn" data-id="${requisition.id}">View</button>
        <button class="action-btn edit-btn" data-id="${requisition.id}">Edit</button>
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
  console.log(`Applying filters: Date='${dateValue}', Dept='${deptValue}', Equipment='${equipmentValue}'`);

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

  console.log('Filtered data count:', filteredData.length);

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
  console.log('Filters cleared.');
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
        occurdate,
        requestorname,
        reqdept,
        equipmentname,
        existingcondition,
        machineno
      `)
      .order('occurdate', { ascending: false });

    if (error) {
      console.error("Error fetching MT job requisitions:", error);
      showError(`Error loading data: ${error.message}`);
      return;
    }

    console.log("Fetched MT Job Requisitions:", data);
    requisitionsData = data.map(requisition => ({
      id: requisition.id,
      occurdate: requisition.occurdate,
      requestorname: requisition.requestorname,
      reqdept: requisition.reqdept,
      equipmentname: requisition.equipmentname,
      existingcondition: requisition.existingcondition,
      machineno: requisition.machineno
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

function handleButtonActions(e) {
  if (e.target.classList.contains('action-btn')) {
    const requisitionId = e.target.dataset.id;
    const targetUrl = '../html/MT-job-requisition-form-action.html';

    if (e.target.classList.contains('view-btn')) {
      console.log(`Viewing MT job requisition ${requisitionId}`);
      window.location.href = `${targetUrl}?id=${requisitionId}&action=view`;
    } else if (e.target.classList.contains('edit-btn')) {
      console.log(`Editing MT job requisition ${requisitionId}`);
      window.location.href = `${targetUrl}?id=${requisitionId}&action=edit`;
    }
  }
}

// Enhanced setup function that includes table functionality
function setupEventListeners() {
  document.addEventListener('DOMContentLoaded', async () => {
    // Load user profile
    await loadUserProfile();

    // Set up table event listeners if we're on the table page
    if (document.getElementById('alertsBody')) {
      setupTableEventListeners();
    }

  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', async (e) => {
      e.preventDefault();
        console.log('Logout button clicked');

        if (window.confirm("Are you sure you want to log out?")) {
          console.log('Logout confirmed, signing out...');
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
            
              console.log('Logout successful, redirecting...');
            window.location.replace('../html/auth.html');
          }
        } catch (err) {
          console.error('Exception during logout:', err);
          alert('An unexpected error occurred during logout.');
        }
        } else {
          console.log('Logout cancelled by user.');
      }
    });
    }
  });

  document.addEventListener('click', handleButtonActions);
  }

setupEventListeners(); 