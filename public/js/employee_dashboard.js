import { supabase } from '../supabase-config.js';

// Filter DOM Elements
const filterDate = document.getElementById('filterDate');
const filterDept = document.getElementById('filterDept');
const filterAbnormality = document.getElementById('filterAbnormality');
const findButton = document.getElementById('findButton'); // Get the find button

// --- Core Table and Data Management ---
let alertsData = []; // Stores the full dataset fetched initially
let currentSort = { column: 'id', direction: 'asc' }; // Initial sort state

// Function to render the table with given data
function renderTable(data) {
    const tbody = document.getElementById('alertsBody');
    if (!tbody) {
        console.error("Table body element #alertsBody not found!");
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4">No alerts found for the current criteria.</td></tr>'; // Updated colspan to 8
        return;
    }

    tbody.innerHTML = data.map(alert => {
        // Format date to a readable string
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
                <td><a href="quality_alerts_actions.html?id=${alert.id}&action=view" class="action-link">View Actions</a></td>
            </tr>
        `;
    }).join('');
}

// Function to sort the data
function sortData(column) {
    if (!alertsData.length) return; // Don't sort empty data

    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort = { column, direction: 'asc' };
    }

    // Get the currently filtered data to sort (if filters are applied)
    const currentlyDisplayedData = applyFilters(false); // Apply filters without rendering

    currentlyDisplayedData.sort((a, b) => {
        const modifier = currentSort.direction === 'asc' ? 1 : -1;
        const aValue = a[currentSort.column];
        const bValue = b[currentSort.column];

        // Handle potential null or undefined values during comparison
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return -1 * modifier; // Nulls come first in asc, last in desc
        if (bValue == null) return 1 * modifier;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
            return aValue.localeCompare(bValue) * modifier;
        }
        // Attempt numerical comparison if not strings
        return (aValue - bValue) * modifier;
    });

    renderTable(currentlyDisplayedData); // Render the sorted and filtered data
}

// Function to apply filters to the current alertsData (in memory)
function applyFilters(render = true) {
    const dateValue = filterDate.value;
    const deptValue = filterDept.value;
    const abnormalityValue = filterAbnormality.value;

    let filteredData = alertsData;

    if (dateValue) {
        // Filter by exact date match
        filteredData = filteredData.filter(alert => alert.incidentdate && alert.incidentdate === dateValue);
    }

    if (deptValue) {
        // Filter by responsible department
        filteredData = filteredData.filter(alert => alert.responsibledept === deptValue);
    }

    if (abnormalityValue) {
        // Filter by type of abnormality
        filteredData = filteredData.filter(alert => alert.abnormalitytype === abnormalityValue);
    }

    if (render) {
        renderTable(filteredData); // Render the filtered results
    } else {
        return filteredData; // Return data without rendering if render is false
    }
}

// Function to fetch the initial data (all alerts for the logged-in user)
async function fetchLatestAlerts() {
    const tbody = document.getElementById('alertsBody');
    if (tbody) {
        tbody.innerHTML = '<tr class="loading-row"><td colspan="8" class="text-center py-4">Loading alerts...</td></tr>'; // Updated colspan
    }

    try {
        // 1. Get the logged-in user's ID
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error("User not logged in, cannot fetch alerts.");
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="8" class="error-message">Please log in to view alerts.</td></tr>'; // Updated colspan
            }
            window.location.href = '/'; // Redirect to login if no user
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
            .eq('user_id', userId) // Filter by the logged-in user's ID
            
            .order('incidentdate', { ascending: false }); // Order by date descending initially

        if (error) {
            console.error("Supabase error fetching user's alerts:", error);
            throw error; // Re-throw to be caught by the outer catch block
        }

        // 4. Process the fetched data
        alertsData = data.map(alert => ({
            ...alert,
            // Extract full_name from the joined 'users' table
            user_name: alert.users ? alert.users.full_name : 'Unknown'
        }));

        // 5. Render the initially fetched data
        renderTable(alertsData);

    } catch (error) {
        console.error('Error fetching or processing alerts:', error);
        // Display an error message in the UI
        const tbody = document.getElementById('alertsBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" class="error-message">Could not load your alerts. Please try again later.</td></tr>'; // Updated colspan
        }
    }
}

// --- User Profile and Authentication ---
async function loadUserProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        // Fetch additional user details from the 'users' table
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('full_name, employee_code')
            .eq('id', user.id)
            .single();

        const userNameElement = document.querySelector('.user-name');
        // Assuming elements with these IDs exist based on typical dashboard structures
        const employeeNameElement = document.getElementById('employeeName'); // Not in provided HTML, but in original JS
        const employeeCodeElement = document.getElementById('employeeCode'); // Not in provided HTML, but in original JS


        if (profile) {
            if (userNameElement) userNameElement.textContent = 'Hi, ' + profile.full_name;
            if (employeeNameElement) employeeNameElement.textContent = profile.full_name;
            if (employeeCodeElement) employeeCodeElement.textContent = (profile.employee_code || '').toUpperCase();
        } else if (profileError) {
            console.error("Error fetching profile:", profileError);
            // Fallback to using email or a default value if profile fetch fails
            if (userNameElement) userNameElement.textContent = user.email ? 'Hi, ' + user.email : 'Hi there';
            if (employeeNameElement) employeeNameElement.textContent = user.email || 'Employee';
            if (employeeCodeElement) employeeCodeElement.textContent = user.id.substring(0, 8).toUpperCase();
        }
    } else {
        console.error("User not logged in.");
        // Redirect handled in fetchLatestAlerts now
    }
}

async function logoutUser() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Error signing out:', error);
        alert('Failed to logout. Please try again.');
    } else {
        console.log('User logged out successfully');
        window.location.href = '/'; // Redirect to login page
    }
}

// --- Notifications (Placeholder - adjust as needed) ---
// This section seems less critical to the "quality alerts table" part but is kept from your original code.
async function loadNotifications() {
    // Placeholder: In a real application, fetch from your database
    const notifications = JSON.parse(localStorage.getItem('notifications')) || [
        { id: 1, message: "New quality alert submitted", date: "2 mins ago", read: false, icon: "fas fa-exclamation-circle" },
        { id: 2, message: "Form approval pending", date: "1 hour ago", read: false, icon: "fas fa-clock" }
    ];

    const notificationBadge = document.querySelector('.notification-badge'); // Not in provided HTML
    const notificationList = document.querySelector('.notification-list'); // Not in provided HTML
    const notificationDropdown = document.querySelector('.notification-dropdown'); // Not in provided HTML


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
        // Decide which element actually displays the list in your UI
        notificationDropdown.innerHTML = notifications.length ? notificationHTML : '<p class="no-data">No notifications</p>';
     }
}

// --- Other Functions (Placeholder) ---
function printRTCIS() {
    alert("RTCIS print functionality will be implemented here.");
    // You would typically implement the logic to generate and print RTCIS labels here.
}


// --- Event Listeners ---
function setupEventListeners() {
    // Logout button listener
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logoutUser);
    } else {
        console.error("Logout button not found."); // This error is expected if the element is not in the HTML
    }

    // Function to clear all filters and show all data
    function clearFilters() {
        document.getElementById('filterDate').value = '';
        document.getElementById('filterDept').value = '';
        document.getElementById('filterAbnormality').value = '';
        applyFilters(); // This will show all data again
    }
    
    // Add event listener for clear filters button
    document.getElementById('clearFilters').addEventListener('click', clearFilters);

    // Filter change listeners (apply filters immediately on change)
    if (filterDate) filterDate.addEventListener('change', () => applyFilters());
    if (filterDept) filterDept.addEventListener('change', () => applyFilters());
    if (filterAbnormality) filterAbnormality.addEventListener('change', () => applyFilters());

    // Find button listener (also applies filters - could potentially trigger a re-fetch if that was the desired behavior)
    if (findButton) findButton.addEventListener('click', () => applyFilters()); // Currently filters in-memory

    // Sort header listeners
    document.querySelectorAll('[data-sort]').forEach(header => {
        header.addEventListener('click', () => sortData(header.dataset.sort));
    });

    // Notification icon listener (Placeholder - related to elements not in provided HTML)
    const notificationIcon = document.querySelector('.notification-icon'); // Not in provided HTML
    const notificationDropdown = document.querySelector('.notification-dropdown'); // Not in provided HTML

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


    // Navigation links (Placeholder - related to elements not in provided HTML)
    const qualityAlertLink = document.querySelector('.quality-alert-link'); // Not in provided HTML
    const dailyReportLink = document.querySelector('.daily-report-link'); // Not in provided HTML

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

     // Menu icon listener (Placeholder - related to element removed from HTML)
     // Remove this unused toggleDropdown function
     // function toggleDropdown() {
     //   const dropdownMenu = document.querySelector('.dropdown-menu');
     //   if(dropdownMenu) dropdownMenu.classList.toggle('show');
     // }
      // If you intended the menu-icon to control the *user info* dropdown, re-add the icon and link it here.
}


// --- Initial Load ---
document.addEventListener('DOMContentLoaded', async () => {
    await loadUserProfile(); // Load user info
    // loadRecentActivities(); // Removed as per original code's comment
    loadNotifications(); // Load notifications (placeholder)
    setupEventListeners(); // Setup all event listeners
    fetchLatestAlerts(); // Fetch and render the initial data for the table
});