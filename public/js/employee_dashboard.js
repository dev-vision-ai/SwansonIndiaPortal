import { supabase } from '../supabase-config.js';

let alertsData = []; // Define globally
let currentSort = { column: 'id', direction: 'asc' }; // Define globally

function renderTable(data) {
    const tbody = document.getElementById('alertsBody');
    if (!tbody) {
        console.error("Table body element #alertsBody not found!");
        return;
    }

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

function sortData(column) {
    if (!alertsData.length) return;

    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort = { column, direction: 'asc' };
    }

    const currentlyDisplayedData = applyFilters(false);

    currentlyDisplayedData.sort((a, b) => {
        const modifier = currentSort.direction === 'asc' ? 1 : -1;
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
    const dateValue = filterDate.value;
    const deptValue = filterDept.value;
    const abnormalityValue = filterAbnormality.value;

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

    if (render) {
        renderTable(filteredData);
    } else {
        return filteredData;
    }
}

async function fetchDraftQualityAlerts() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error("User not logged in, cannot fetch draft alerts.");
            return [];
        }
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

        if (error) {
            console.error("Supabase error fetching user's draft alerts:", error);
            throw error;
        }

        return data.map(draft => ({
            ...draft,
            user_name: draft.users ? draft.users.full_name : 'Unknown',
            status: 'Draft' // Add a status to differentiate drafts
        }));

    } catch (error) {
        console.error('Error fetching or processing draft alerts:', error);
        return [];
    }
}

async function fetchLatestAlerts() {
    const tbody = document.getElementById('alertsBody');
    if (tbody) {
        tbody.innerHTML = '<tr class="loading-row"><td colspan="8" class="text-center py-4">Loading alerts...</td></tr>';
    }

    try {
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error("User not logged in, cannot fetch alerts.");
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="8" class="error-message">Please log in to view alerts.</td></tr>';
            }
            window.location.href = '/';
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

        if (error) {
            console.error("Supabase error fetching user's alerts:", error);
            throw error;
        }

        const submittedAlerts = data.map(alert => ({
            ...alert,
            user_name: alert.users ? alert.users.full_name : 'Unknown',
            status: 'Submitted' // Add a status to differentiate submitted alerts
        }));

        const draftAlerts = await fetchDraftQualityAlerts();

        // Combine and sort alerts (you might want a more sophisticated sort)
        alertsData = [...submittedAlerts, ...draftAlerts].sort((a, b) => {
            const dateA = new Date(a.incidentdate || a.drafted_at);
            const dateB = new Date(b.incidentdate || b.drafted_at);
            return dateB - dateA; // Sort by most recent date
        });

        renderTable(alertsData);

    } catch (error) {
        console.error('Error fetching or processing alerts:', error);
        
        const tbody = document.getElementById('alertsBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" class="error-message">Could not load your alerts. Please try again later.</td></tr>';
        }
    }
}

async function loadNotifications() {
    
    const notifications = JSON.parse(localStorage.getItem('notifications')) || [
        { id: 1, message: "New quality alert submitted", date: "2 mins ago", read: false, icon: "fas fa-exclamation-circle" },
        { id: 2, message: "Form approval pending", date: "1 hour ago", read: false, icon: "fas fa-clock" }
    ];

    const notificationBadge = document.querySelector('.notification-badge');
    const notificationList = document.querySelector('.notification-list');
    const notificationDropdown = document.querySelector('.notification-dropdown');


    if (notificationBadge) {
        const unreadCount = notifications.filter(n => !n.read).length;
        notificationBadge.textContent = unreadCount;
        notificationBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }


    const notificationHTML = notifications.map(notification => `
        <div class="notification-item ${notification.read ? 'read' : ''}" data-id="${notification.id}">
            <i class="${notification.icon}"></i>
            <div class="notification-details">
                <p>${notification.message}</p>
                <small>${notification.date}</small>
            </div>
        </div>
    `).join('');

    if (notificationList) {
         notificationList.innerHTML = notifications.length ? notificationHTML : '<p class="no-data">No notifications</p>';
    }
     if (notificationDropdown) {
        
        notificationDropdown.innerHTML = notifications.length ? notificationHTML : '<p class="no-data">No notifications</p>';
     }
}


function printRTCIS() {
    alert("RTCIS print functionality will be implemented here.");
    
}

function setupEventListeners() {
    // --- Look up filter elements only if they might exist --- 
    const filterDate = document.getElementById('filterDate');
    const filterDept = document.getElementById('filterDept');
    const filterAbnormality = document.getElementById('filterAbnormality');
    const clearFiltersButton = document.getElementById('clearFilters');
    // const findButton = document.getElementById('findButton'); // If you have a find button

    // --- Add filter listeners only if elements exist --- 
    if (filterDate) filterDate.addEventListener('change', () => applyFilters());
    if (filterDept) filterDept.addEventListener('change', () => applyFilters());
    if (filterAbnormality) filterAbnormality.addEventListener('change', () => applyFilters());
    // if (findButton) findButton.addEventListener('click', () => applyFilters());

    if (clearFiltersButton) {
        clearFiltersButton.addEventListener('click', () => {
            if (filterDate) filterDate.value = '';
            if (filterDept) filterDept.value = '';
            if (filterAbnormality) filterAbnormality.value = '';
            applyFilters(); 
        });
    } else {
        // Only log error if we expect the button (e.g., on the table page)
        if (document.getElementById('alertsBody')) { // Check if we are likely on the table page
             console.warn("Element with ID 'clearFilters' not found, but expected on table page.");
        }
    }

    // --- Add sort listeners only if table headers exist --- 
    document.querySelectorAll('#alertsBody th[data-sort]').forEach(header => {
        header.addEventListener('click', () => sortData(header.dataset.sort));
    });

    // --- Existing Notification Listeners --- 
    const notificationIcon = document.querySelector('.notification-icon'); 
    const notificationDropdown = document.querySelector('.notification-dropdown');

    if (notificationIcon && notificationDropdown) {
        notificationIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationDropdown.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!notificationIcon.contains(e.target) && !notificationDropdown.contains(e.target)) {
                 notificationDropdown.classList.remove('show');
             }
        });
    }

    const qualityAlertLink = document.querySelector('.quality-alert-link'); 
    const dailyReportLink = document.querySelector('.daily-report-link');

    if(qualityAlertLink) {
        qualityAlertLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '../html/qualityalert.html';
        });
    }

     if(dailyReportLink) {
        dailyReportLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '../html/dailyreport.html';
        });
     }
}

document.addEventListener('DOMContentLoaded', async () => {

    loadNotifications(); 
    setupEventListeners(); 
    await loadUserProfile(); 

    if (document.getElementById('alertsBody')) {
        await fetchLatestAlerts(); 
    }
   
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', async (e) => { // Make the handler async
            e.preventDefault(); // Keep this if you had it

            // --- Add Confirmation --- 
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
            // --- End Confirmation ---
        });
    }
});

async function loadUserProfile() {
    console.time('loadUserProfile total'); // Start total timer
    console.time('getUser'); // Start getUser timer
    const { data: { user } } = await supabase.auth.getUser();
    console.timeEnd('getUser'); // End getUser timer

    if (user) {
        console.time('fetchProfile'); // Start profile fetch timer
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('full_name, employee_code')
            .eq('id', user.id)
            .single();
        console.timeEnd('fetchProfile'); // End profile fetch timer

        const userNameElement = document.querySelector('.user-name');
        const employeeNameElement = document.getElementById('employeeName');
        const employeeCodeElement = document.getElementById('employeeCode');

        if (profile) {
            if (userNameElement) {
                userNameElement.textContent = 'Hi, ' + profile.full_name;
            } else {
                console.error("Element with class 'user-name' not found."); // Log error
            }
            if (employeeNameElement) employeeNameElement.textContent = profile.full_name;
            if (employeeCodeElement) employeeCodeElement.textContent = (profile.employee_code || '').toUpperCase();

            // Call the filtering function after user profile is loaded
            filterQuickActionsByDepartment(user);

        } else if (profileError) {
            console.error("Error fetching profile:", profileError);
            if (userNameElement) userNameElement.textContent = user.email ? 'Hi, ' + user.email : 'Hi there';
            if (employeeNameElement) employeeNameElement.textContent = user.email || 'Employee';
            if (employeeCodeElement) employeeCodeElement.textContent = user.id.substring(0, 8).toUpperCase();
        }
    } else {
        console.error("User not logged in.");
        window.location.href = '../html/auth.html';
    }
    console.timeEnd('loadUserProfile total');
}

async function filterQuickActionsByDepartment(user) {
    console.log('filterQuickActionsByDepartment called.');
    console.log('User object:', user);

    if (!user) {
        console.log('No user object, cannot filter quick actions.');
        return;
    }

    try {
        const { data: userProfile, error } = await supabase
            .from('users')
            .select('department')
            .eq('id', user.id)
            .single();

        if (error) {
            console.error('Error fetching user profile for department:', error);
            return;
        }

        console.log('User profile data:', userProfile);

        const userDepartment = userProfile?.department;
        console.log('User Department:', userDepartment);

        const quickActionGrid = document.querySelector('.quick-action-grid');
        if (quickActionGrid) {
            quickActionGrid.style.display = 'none'; // Hide the entire grid initially
        }

        const quickActionCards = document.querySelectorAll('.action-card'); // Changed to action-card based on HTML
        console.log('Found quick action cards:', quickActionCards.length);

        quickActionCards.forEach(card => {
            const cardDepartments = card.getAttribute('data-department');
            console.log('Card data-department:', cardDepartments);

            let shouldDisplay = false;

            if (cardDepartments) {
                const departmentsArray = cardDepartments.split(',').map(dept => dept.trim());
                console.log('Card departments array:', departmentsArray);

                if (departmentsArray.includes('All')) {
                    shouldDisplay = true;
                } else if (userDepartment) {
                    const userDepartmentsArray = userDepartment.split(',').map(d => d.trim());
                    shouldDisplay = departmentsArray.some(cardDept => userDepartmentsArray.includes(cardDept));
                }
            }

            console.log(`Card: ${card.querySelector('h3')?.textContent || 'N/A'}, Should Display: ${shouldDisplay}`);
            card.style.display = shouldDisplay ? '' : 'none';
        });

        if (quickActionGrid) {
             quickActionGrid.style.display = 'flex'; // Show the entire grid after filtering
         }

    } catch (error) {
        console.error('Unexpected error in filterQuickActionsByDepartment:', error);
    }
}
