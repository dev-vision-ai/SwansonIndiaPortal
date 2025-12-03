import { supabase } from '../supabase-config.js';

let incidentsData = []; // Define globally
let currentSort = { column: 'id', direction: 'asc' }; // Define globally
const isEmployeeTable = window.location.pathname.includes('emp-safety-incidents-table.html');

// Helper to generate incident number in YYMM-serial format
function getIncidentNo(incident, index) {
    if (!incident.incident_date) return 'N/A';
    const date = new Date(incident.incident_date);
    const year = String(date.getFullYear() % 100).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    // Serial is index+1, pad to 2 digits
    const serial = String(index + 1).padStart(2, '0');
    return `${year}${month}-${serial}`;
}

function renderTable(data) {
    const tbody = document.getElementById('incidentsBody');
    if (!tbody) {
        console.error("Table body element #incidentsBody not found!");
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4">No incidents found for the current criteria.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map((incident, idx) => {
        const incidentDate = incident.incident_date ? new Date(incident.incident_date).toLocaleDateString() : 'N/A';
        const incidentNo = getIncidentNo(incident, idx);
        return `
            <tr>
                <td>${incidentNo}</td>
                <td>${incidentDate}</td>
                <td>${incident.user_name || 'Unknown'}</td>
                <td>${incident.users?.department || incident.user_department || 'N/A'}</td>
                <td class="description-cell">${incident.description || 'No Description'}</td>
                <td>${incident.department || incident.responsibledept || 'N/A'}</td>
                <td>${incident.incident_type || 'N/A'}</td>
                <td class="actions-cell">
                  ${incident.status === 'Draft' 
                    ? `<a href="safety-incident.html?draft_id=${incident.id}" class="action-btn edit-btn">Edit Draft</a>`
                    : `<div class="action-buttons-container">
                         <a href="safety-incident-actions.html?id=${incident.id}&mode=view" class="action-btn view-btn">View</a>
                         ${!isEmployeeTable ? `<a href="safety-incident-actions.html?id=${incident.id}&mode=edit" class="action-btn edit-btn">Edit</a>` : ''}
                       </div>`
                  }
                </td>
            </tr>
        `;
    }).join('');
}

function sortData(column) {
    if (!incidentsData.length) return;

    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort = { column, direction: 'asc' };
    }

    const currentlyDisplayedData = applyFilters(false);

    currentlyDisplayedData.sort((a, b) => {
        const modifier = currentSort.direction === 'asc' ? 1 : -1;
        if (currentSort.column === 'id') {
            // Sort by UUID as string
            const aValue = a.id || '';
            const bValue = b.id || '';
            return aValue.localeCompare(bValue) * modifier;
        }
        const aValue = a[currentSort.column];
        const bValue = b[currentSort.column];
     
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return -1 * modifier;
        if (bValue == null) return 1 * modifier;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
            return aValue.localeCompare(bValue) * modifier;
        }
        
        return (aValue - bValue) * modifier;
    });

    renderTable(currentlyDisplayedData);
}

function applyFilters(render = true) {
    const dateValue = document.getElementById('filterDate').value;
    const deptValue = document.getElementById('filterDept').value;
    const incidentTypeValue = document.getElementById('filterIncidentType').value;
    const severityValue = document.getElementById('filterSeverity').value;

    let filteredData = incidentsData;

    if (dateValue) {
        filteredData = filteredData.filter(incident => incident.incident_date && incident.incident_date === dateValue);
    }

    if (deptValue) {
        filteredData = filteredData.filter(incident => incident.department === deptValue);
    }

    if (incidentTypeValue) {
        filteredData = filteredData.filter(incident => incident.incident_type === incidentTypeValue);
    }

    if (severityValue) {
        filteredData = filteredData.filter(incident => incident.severity === severityValue);
    }

    if (render) {
        renderTable(filteredData);
    } else {
        return filteredData;
    }
}

async function fetchDraftSafetyIncidents() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error("User not logged in, cannot fetch draft incidents.");
            return [];
        }
        const userId = user.id;

        const { data, error } = await supabase
            .from('safety_incident_draft')
            .select(`
                id,
                incident_type,
                department,
                incident_date,
                description,
                severity,
                user_id,
                users ( full_name, department )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Supabase error fetching user's draft incidents:", error);
            throw error;
        }

        return data.map(draft => ({
            ...draft,
            user_name: draft.users ? draft.users.full_name : 'Unknown',
            status: 'Draft' // Add a status to differentiate drafts
        }));

    } catch (error) {
        console.error('Error fetching or processing draft incidents:', error);
        return [];
    }
}

async function fetchLatestIncidents() {
    const tbody = document.getElementById('incidentsBody');
    if (tbody) {
        tbody.innerHTML = '<tr class="loading-row"><td colspan="8" class="text-center py-4">Loading incidents...</td></tr>';
    }

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error("User not logged in, cannot fetch incidents.");
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="8" class="error-message">Please log in to view incidents.</td></tr>';
            }
            window.location.href = '../html/auth.html';
            return;
        }
        const userId = user.id;
        console.log("Current userId:", userId); // Debug log

        let query = supabase
            .from('safety_incident_form')
            .select(`
                id,
                incident_type,
                department,
                incident_date,
                description,
                severity,
                user_id,
                users ( full_name, department )
            `);
        if (isEmployeeTable) {
            query = query.eq('user_id', userId); // Only filter for employee table
        }
        const { data, error } = await query.order('created_at', { ascending: false });

        console.log("Fetched safety incidents:", data); // Debug log

        const submittedIncidents = data.map(incident => ({
            ...incident,
            user_name: incident.users ? incident.users.full_name : 'Unknown',
            status: 'Submitted' // Add a status to differentiate submitted incidents
        }));

        const draftIncidents = await fetchDraftSafetyIncidents();

        // Combine and sort incidents
        incidentsData = [...submittedIncidents, ...draftIncidents].sort((a, b) => {
            // Sort by created_at date, with submitted incidents first
            const aDate = new Date(a.created_at || a.drafted_at || 0);
            const bDate = new Date(b.created_at || b.drafted_at || 0);
            return bDate - aDate;
        });

        renderTable(incidentsData);
        setupEventListeners();

    } catch (error) {
        console.error('Error fetching incidents:', error);
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" class="error-message">Error loading incidents. Please try again.</td></tr>';
        }
    }
}

function setupEventListeners() {
    // Sort functionality
    const sortableHeaders = document.querySelectorAll('th[data-sort]');
    sortableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const column = header.getAttribute('data-sort');
            sortData(column);
        });
    });

    // Filter functionality
    const filterDate = document.getElementById('filterDate');
    const filterDept = document.getElementById('filterDept');
    const filterIncidentType = document.getElementById('filterIncidentType');
    const filterSeverity = document.getElementById('filterSeverity');
    const clearFilters = document.getElementById('clearFilters');

    if (filterDate) filterDate.addEventListener('change', applyFilters);
    if (filterDept) filterDept.addEventListener('change', applyFilters);
    if (filterIncidentType) filterIncidentType.addEventListener('change', applyFilters);
    if (filterSeverity) filterSeverity.addEventListener('change', applyFilters);
    if (clearFilters) clearFilters.addEventListener('click', () => {
        if (filterDate) filterDate.value = '';
        if (filterDept) filterDept.value = '';
        if (filterIncidentType) filterIncidentType.value = '';
        if (filterSeverity) filterSeverity.value = '';
        applyFilters();
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    fetchLatestIncidents();
}); 