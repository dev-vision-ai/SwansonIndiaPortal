// Bulletproof back button logic for My Forms
if (!sessionStorage.getItem('myFormsJustArrived')) {
  sessionStorage.removeItem('myFormsPrevPage');
}
sessionStorage.removeItem('myFormsJustArrived');

// Debug logs
console.log('myFormsJustArrived:', sessionStorage.getItem('myFormsJustArrived'));
console.log('myFormsPrevPage:', sessionStorage.getItem('myFormsPrevPage'));

import { supabase } from '../supabase-config.js';

async function loadUserProfile() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('full_name, employee_code')
                .eq('id', user.id)
                .single();

            const userNameElement = document.querySelector('.user-name');

            if (profile) {
                if (userNameElement) {
                    userNameElement.textContent = 'Hi, ' + profile.full_name;
                }
            } else if (profileError) {
                console.error("Error fetching profile:", profileError);
                if (userNameElement) {
                    userNameElement.textContent = user.email ? 'Hi, ' + user.email : 'Hi there';
                }
            }
        } else {
            console.error("User not logged in.");
            window.location.href = '../html/auth.html';
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
    }
}

function showQuickActions() {
    document.getElementById('myFormsQuickActions').style.display = 'flex';
    document.getElementById('safetyTableContainer').classList.remove('active');
    document.getElementById('qualityTableContainer').classList.remove('active');
}

function showSafetyTable() {
    document.getElementById('myFormsQuickActions').style.display = 'none';
    document.getElementById('safetyTableContainer').classList.add('active');
    document.getElementById('qualityTableContainer').classList.remove('active');
    renderSafetyTable();
}

function showQualityTable() {
    document.getElementById('myFormsQuickActions').style.display = 'none';
    document.getElementById('qualityTableContainer').classList.add('active');
    document.getElementById('safetyTableContainer').classList.remove('active');
    renderQualityTable();
}

// Stub: Render the safety incidents table dynamically
function renderSafetyTable() {
    const container = document.getElementById('safetyTableContent');
    container.innerHTML = '<div style="text-align:center; padding:2rem;">Loading Safety Incidents Table...</div>';
    // TODO: Insert table rendering logic here (reuse from safety_incidents_table.js)
}

// --- Quality Alerts Table Logic ---
let qaAlertsData = [];
let qaCurrentSort = { column: 'id', direction: 'asc' };

function renderQualityTable() {
    const container = document.getElementById('qualityTableContent');
    container.innerHTML = `
    <div class="quality-alerts-container p-6">
      <h2 class="text-xl font-semibold mb-4 text-center">All Quality Alerts</h2>
      <div class="filter-controls mb-4 flex justify-center space-x-4">
        <span class="text-sm font-medium">Sort or Filter Alerts:</span>
        <input type="date" id="filterDate" class="filter-input border rounded px-2 py-1" placeholder="Filter by Date">
        <select id="filterDept" class="filter-select border rounded px-2 py-1">
          <option value="">Filter by Responsible Dept.</option>
          <option value="Production">Production</option>
          <option value="Quality Control">Quality Control</option>
          <option value="Administration">Administration</option>
          <option value="Quality Assurance">Quality Assurance</option>
          <option value="Sales">Sales</option>
          <option value="Human Resource">Human Resource</option>
          <option value="Warehouse">Warehouse</option>
          <option value="Logistics">Logistics</option>
          <option value="Purchase">Purchase</option>
          <option value="Maintenance">Maintenance</option>
        </select>
        <select id="filterAbnormality" class="filter-select border rounded px-2 py-1">
          <option value="">Filter by Type of Abnormality</option>
          <option value="Safety">Safety</option>
          <option value="Raw/Sub Material">Raw/Sub Material</option>
          <option value="Documents/Records">Documents/Records</option>
          <option value="SOP Deviation">SOP Deviation</option>
          <option value="Packing Material">Packing Material</option>
          <option value="Insects/Pests">Insects/Pests</option>
          <option value="Machine/Equipment">Machine/Equipment</option>
          <option value="Semi/Finished Goods">Semi/Finished Goods</option>
          <option value="Environment/Facility">Environment/Facility</option>
          <option value="Process">Process</option>
          <option value="Labelling">Labelling</option>
          <option value="Other">Other</option>
        </select>
        <button id="clearFilters" class="filter-btn bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-1 px-3 rounded transition-colors">
          Clear Filters
        </button>
      </div>
      <table class="min-w-full bg-white shadow-md rounded">
        <thead>
          <tr class="bg-gray-200 text-left">
            <th class="py-2 px-4" data-sort="id">Alert No.</th>
            <th class="py-2 px-4" data-sort="incidentdate">Date</th>
            <th class="py-2 px-4" data-sort="user_name">Reported By</th>
            <th class="py-2 px-4" data-sort="incidenttitle">Title</th>
            <th class="py-2 px-4" data-sort="incidentdesc">Description</th>
            <th class="py-2 px-4" data-sort="responsibledept">Responsible Dept.</th>
            <th class="py-2 px-4" data-sort="abnormalitytype">Type of Abnormality</th>
            <th class="py-2 px-4" data-sort="status">Status</th>
            <th class="py-2 px-4">Actions</th>
          </tr>
        </thead>
        <tbody id="alertsBody">
            <tr class="loading-row">
                <td colspan="8" class="text-center py-4">Loading alerts...</td>
            </tr>
        </tbody>
      </table>
    </div>
    `;
    setupQualityTableEvents();
    fetchLatestQualityAlerts();
}

function renderQATable(data) {
    const tbody = document.getElementById('alertsBody');
    if (!tbody) return;
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4">No alerts found for the current criteria.</td></tr>';
        return;
    }
    tbody.innerHTML = data.map(alert => {
        const incidentDate = alert.incidentdate ? new Date(alert.incidentdate).toLocaleDateString() : 'N/A';
        return `
            <tr>
                <td>${alert.id || 'N/A'}</td>
                <td>${incidentDate}</td>
                <td>${alert.user_name || 'Unknown'}</td>
                <td>${alert.incidenttitle || 'No Title'}</td>
                <td class="description-cell">${alert.incidentdesc || 'No Description'}</td>
                <td>${alert.responsibledept || 'N/A'}</td>
                <td>${alert.abnormalitytype || 'N/A'}</td>
                <td>${alert.status || 'N/A'}</td>
                <td><a href="${alert.status === 'Draft' ? 'qualityalert.html' : 'quality_alerts_actions.html'}?id=${alert.id}&action=${alert.status === 'Draft' ? 'edit' : 'view'}" class="action-link">${alert.status === 'Draft' ? 'Edit Draft' : 'View Actions'}</a></td>
            </tr>
        `;
    }).join('');
}

function sortQAData(column) {
    if (!qaAlertsData.length) return;
    if (qaCurrentSort.column === column) {
        qaCurrentSort.direction = qaCurrentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        qaCurrentSort = { column, direction: 'asc' };
    }
    const filtered = applyQAFilters(false);
    filtered.sort((a, b) => {
        const modifier = qaCurrentSort.direction === 'asc' ? 1 : -1;
        if (qaCurrentSort.column === 'id') {
            const parseId = (id) => {
                const match = id && id.match(/^\d{4}-\d{2}$/);
                return match ? { prefix: match[1], serial: parseInt(match[2], 10) } : { prefix: '', serial: 0 };
            };
            const aId = parseId(a.id);
            const bId = parseId(b.id);
            if (aId.prefix !== bId.prefix) {
                return (aId.prefix.localeCompare(bId.prefix)) * modifier;
            }
            return (aId.serial - bId.serial) * modifier;
        }
        const aValue = a[qaCurrentSort.column];
        const bValue = b[qaCurrentSort.column];
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return -1 * modifier;
        if (bValue == null) return 1 * modifier;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            return aValue.localeCompare(bValue) * modifier;
        }
        return (aValue - bValue) * modifier;
    });
    renderQATable(filtered);
}

function applyQAFilters(render = true) {
    const filterDate = document.getElementById('filterDate');
    const filterDept = document.getElementById('filterDept');
    const filterAbnormality = document.getElementById('filterAbnormality');
    let filtered = qaAlertsData;
    if (filterDate && filterDate.value) {
        filtered = filtered.filter(alert => alert.incidentdate && alert.incidentdate === filterDate.value);
    }
    if (filterDept && filterDept.value) {
        filtered = filtered.filter(alert => alert.responsibledept === filterDept.value);
    }
    if (filterAbnormality && filterAbnormality.value) {
        filtered = filtered.filter(alert => alert.abnormalitytype === filterAbnormality.value);
    }
    if (render) {
        renderQATable(filtered);
    } else {
        return filtered;
    }
}

async function fetchDraftQualityAlerts() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];
        const userId = user.id;
        const { data, error } = await supabase
            .from('quality_alert_drafts')
            .select(`
                id,
                incidenttitle,
                responsibledept,
                incidentdate,
                incidentdesc,
                abnormalitytype,
                user_id,
                users ( full_name )
            `)
            .eq('user_id', userId)
            .order('drafted_at', { ascending: false });
        if (error) throw error;
        return data.map(draft => ({
            ...draft,
            user_name: draft.users ? draft.users.full_name : 'Unknown',
            status: 'Draft'
        }));
    } catch (error) {
        return [];
    }
}

async function fetchLatestQualityAlerts() {
    const tbody = document.getElementById('alertsBody');
    if (tbody) {
        tbody.innerHTML = '<tr class="loading-row"><td colspan="8" class="text-center py-4">Loading alerts...</td></tr>';
    }
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="8" class="error-message">Please log in to view alerts.</td></tr>';
            }
            window.location.href = '../html/auth.html';
            return;
        }
        const userId = user.id;
        const { data, error } = await supabase
            .from('quality_alerts')
            .select(`
                id,
                incidenttitle,
                responsibledept,
                incidentdate,
                incidentdesc,
                abnormalitytype,
                user_id,
                users ( full_name )
            `)
            .eq('user_id', userId)
            .order('incidentdate', { ascending: false });
        if (error) throw error;
        const submittedAlerts = data.map(alert => ({
            ...alert,
            user_name: alert.users ? alert.users.full_name : 'Unknown',
            status: 'Submitted'
        }));
        const draftAlerts = await fetchDraftQualityAlerts();
        qaAlertsData = [...submittedAlerts, ...draftAlerts].sort((a, b) => {
            const dateA = new Date(a.incidentdate || a.drafted_at);
            const dateB = new Date(b.incidentdate || b.drafted_at);
            return dateB - dateA;
        });
        renderQATable(qaAlertsData);
    } catch (error) {
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" class="error-message">Could not load your alerts. Please try again later.</td></tr>';
        }
    }
}

function setupQualityTableEvents() {
    // Filter listeners
    setTimeout(() => {
        const filterDate = document.getElementById('filterDate');
        const filterDept = document.getElementById('filterDept');
        const filterAbnormality = document.getElementById('filterAbnormality');
        const clearFiltersButton = document.getElementById('clearFilters');
        if (filterDate) filterDate.addEventListener('change', () => applyQAFilters());
        if (filterDept) filterDept.addEventListener('change', () => applyQAFilters());
        if (filterAbnormality) filterAbnormality.addEventListener('change', () => applyQAFilters());
        if (clearFiltersButton) {
            clearFiltersButton.addEventListener('click', () => {
                if (filterDate) filterDate.value = '';
                if (filterDept) filterDept.value = '';
                if (filterAbnormality) filterAbnormality.value = '';
                applyQAFilters();
            });
        }
        // Sort listeners
        document.querySelectorAll('#alertsBody th[data-sort]').forEach(header => {
            header.addEventListener('click', () => sortQAData(header.dataset.sort));
        });
    }, 0);
}

function setupEventListeners() {
    const safetyCard = document.getElementById('safetyQuickAction');
    const qualityCard = document.getElementById('qualityQuickAction');
    if (safetyCard) safetyCard.addEventListener('click', showSafetyTable);
    if (qualityCard) qualityCard.addEventListener('click', showQualityTable);
    // Back buttons use showQuickActions() directly in HTML
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadUserProfile();
    setupEventListeners();
    showQuickActions(); // Ensure quick actions are visible on load
});

// Expose for inline back button usage
window.showQuickActions = showQuickActions; 