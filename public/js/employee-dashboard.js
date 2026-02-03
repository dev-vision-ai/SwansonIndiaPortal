import { supabase } from '../supabase-config.js';

let alertsData = []; // Define globally
let currentSort = { column: 'id', direction: 'asc' }; // Define globally

// Make filter elements globally accessible
let filterDate, filterDept, filterAbnormality;

/**
 * Checks if user is authenticated and redirects to login if not
 * This runs immediately to prevent cached pages from loading
 */
async function checkAuthentication() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
            // User not authenticated, redirect to login immediately
            console.log('User not authenticated, redirecting to login');
            window.location.replace('../html/auth.html');
            return false;
        }

        return true;
    } catch (err) {
        console.error('Authentication check failed:', err);
        window.location.replace('../html/auth.html');
        return false;
    }
}

/**
 * Renders the alerts table with the provided data
 * @param {Array} data - Array of alert objects to display
 */
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
                <td class="actions-cell">
                    <div class="action-buttons-container">
                        <a href="${alert.status === 'Draft' ? 'quality-alert.html' : 'quality-alerts-actions.html'}?id=${alert.id}&action=${alert.status === 'Draft' ? 'edit' : 'view'}&from=emp-quality-alerts-table" 
                           class="action-btn-new ${alert.status === 'Draft' ? 'edit-btn-new' : 'view-btn-new'}">
                            ${alert.status === 'Draft' ? 'Edit' : 'View'}
                        </a>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Sorts the alerts data by the specified column
 * @param {string} column - The column name to sort by
 */
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

        if (currentSort.column === 'id') {
            // Sort by prefix (YYMM), then by serial (XX) as number
            const parseId = (id) => {
                const match = id && id.match(/^(\d{4})-(\d{2})$/);
                return match ? { prefix: match[1], serial: parseInt(match[2], 10) } : { prefix: '', serial: 0 };
            };
            const aId = parseId(a.id);
            const bId = parseId(b.id);
            if (aId.prefix !== bId.prefix) {
                return (aId.prefix.localeCompare(bId.prefix)) * modifier;
            }
            return (aId.serial - bId.serial) * modifier;
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

/**
 * Applies current filter values to the alerts data
 * @param {boolean} render - Whether to render the filtered results (default: true)
 * @returns {Array} Filtered data array if render is false
 */
function applyFilters(render = true) {
    const dateValue = filterDate?.value || '';
    const deptValue = filterDept?.value || '';
    const abnormalityValue = filterAbnormality?.value || '';

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

/**
 * Fetches draft quality alerts for the current user
 * @returns {Promise<Array>} Array of draft alert objects
 */
async function fetchDraftQualityAlerts() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error("User not logged in, cannot fetch draft alerts.");
            return [];
        }

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
            .eq('user_id', user.id)
            .order('drafted_at', { ascending: false });

        if (error) {
            console.error("Supabase error fetching user's draft alerts:", error);
            throw error;
        }

        return data.map(draft => ({
            ...draft,
            user_name: draft.users ? draft.users.full_name : 'Unknown',
            status: 'Draft'
        }));

    } catch (error) {
        console.error('Error fetching or processing draft alerts:', error);
        return [];
    }
}

/**
 * Fetches and displays the latest alerts for the current user
 */
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
            .eq('user_id', user.id)
            .order('incidentdate', { ascending: false });

        if (error) {
            console.error("Supabase error fetching user's alerts:", error);
            throw error;
        }

        const submittedAlerts = data.map(alert => ({
            ...alert,
            user_name: alert.users ? alert.users.full_name : 'Unknown',
            status: 'Submitted'
        }));

        const draftAlerts = await fetchDraftQualityAlerts();

        // Combine and sort alerts by most recent date
        alertsData = [...submittedAlerts, ...draftAlerts].sort((a, b) => {
            const dateA = new Date(a.incidentdate || a.drafted_at);
            const dateB = new Date(b.incidentdate || b.drafted_at);
            return dateB - dateA;
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

/**
 * Loads and displays notifications from localStorage
 */
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


/**
 * Sets up all event listeners for the dashboard
 */
function setupEventListeners() {
    // Look up filter elements
    filterDate = document.getElementById('filterDate');
    filterDept = document.getElementById('filterDept');
    filterAbnormality = document.getElementById('filterAbnormality');
    const clearFiltersButton = document.getElementById('clearFilters');

    // Add filter listeners
    if (filterDate) filterDate.addEventListener('change', () => applyFilters());
    if (filterDept) filterDept.addEventListener('change', () => applyFilters());
    if (filterAbnormality) filterAbnormality.addEventListener('change', () => applyFilters());

    if (clearFiltersButton) {
        clearFiltersButton.addEventListener('click', () => {
            if (filterDate) filterDate.value = '';
            if (filterDept) filterDept.value = '';
            if (filterAbnormality) filterAbnormality.value = '';
            applyFilters();
        });
    } else {
        if (document.getElementById('alertsBody')) {
            console.warn("Element with ID 'clearFilters' not found, but expected on table page.");
        }
    }

    // Add sort listeners
    document.querySelectorAll('#alertsBody th[data-sort]').forEach(header => {
        header.addEventListener('click', () => sortData(header.dataset.sort));
    });

    // Notification listeners
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

    if (qualityAlertLink) {
        qualityAlertLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '../html/quality-alert.html';
        });
    }

    if (dailyReportLink) {
        dailyReportLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '../html/dailyreport.html';
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication first before doing anything else
    const isAuthenticated = await checkAuthentication();
    if (!isAuthenticated) {
        return; // Stop execution if not authenticated
    }

    loadNotifications();
    setupEventListeners();
    await loadUserProfile();

    if (document.getElementById('alertsBody')) {
        await fetchLatestAlerts();
        // Add delegated click handler for 'View Actions' links
        document.getElementById('alertsBody').addEventListener('click', function (e) {
            const target = e.target;
            if (target.classList.contains('action-link') && target.textContent.includes('View Actions')) {
                sessionStorage.setItem('empViewAccess', 'true');
            }
        });
    }

    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', async (e) => {
            e.preventDefault();

            // Show logout confirmation modal
            const logoutModal = document.getElementById('logoutModal');
            logoutModal.classList.add('show');
        });
    }

    // Logout modal event handlers
    const logoutModalClose = document.getElementById('logoutModalClose');
    const logoutCancel = document.getElementById('logoutCancel');
    const logoutConfirm = document.getElementById('logoutConfirm');
    const logoutModal = document.getElementById('logoutModal');

    // Close modal handlers
    if (logoutModalClose) {
        logoutModalClose.addEventListener('click', () => {
            logoutModal.classList.remove('show');
        });
    }

    if (logoutCancel) {
        logoutCancel.addEventListener('click', () => {
            logoutModal.classList.remove('show');
        });
    }

    // Message modal event handlers
    const messageModalClose = document.getElementById('messageModalClose');
    const messageModalOk = document.getElementById('messageModalOk');
    const messageModal = document.getElementById('messageModal');

    if (messageModalClose) {
        messageModalClose.addEventListener('click', () => {
            messageModal.classList.remove('show');
        });
    }

    if (messageModalOk) {
        messageModalOk.addEventListener('click', () => {
            messageModal.classList.remove('show');
        });
    }

    if (messageModal) {
        messageModal.addEventListener('click', (e) => {
            if (e.target === messageModal) {
                messageModal.classList.remove('show');
            }
        });
    }

    // Confirm logout handler
    if (logoutConfirm) {
        logoutConfirm.addEventListener('click', async () => {
            logoutModal.classList.remove('show');

            try {
                const { error } = await supabase.auth.signOut();
                if (error) {
                    console.error('Error logging out:', error);
                    // Show error modal instead of alert
                    showMessageModal('Logout Failed', 'An error occurred during logout. Please try again.', 'error');
                } else {
                    // Logout successful, redirecting
                    window.location.replace('../html/auth.html');
                }
            } catch (err) {
                console.error('Exception during logout:', err);
                // Show error modal instead of alert
                showMessageModal('Logout Failed', 'An unexpected error occurred during logout.', 'error');
            }
        });
    }
});

/**
 * Shows a styled message modal
 * @param {string} title - Modal title
 * @param {string} message - Modal message
 * @param {string} type - Modal type ('success', 'error', 'info', 'warning')
 */
function showMessageModal(title, message, type = 'info') {
    const messageModal = document.getElementById('messageModal');
    const messageModalTitle = document.getElementById('messageModalTitle');
    const messageModalText = document.getElementById('messageModalText');
    const messageModalIcon = document.getElementById('messageModalIcon');

    if (messageModalTitle) messageModalTitle.textContent = title;
    if (messageModalText) messageModalText.textContent = message;

    // Set icon based on type
    let iconClass = 'fas fa-info-circle';
    let iconColor = '#17a2b8'; // info color

    switch (type) {
        case 'success':
            iconClass = 'fas fa-check-circle';
            iconColor = '#28a745';
            break;
        case 'error':
            iconClass = 'fas fa-exclamation-circle';
            iconColor = '#dc3545';
            break;
        case 'warning':
            iconClass = 'fas fa-exclamation-triangle';
            iconColor = '#ffc107';
            break;
    }

    if (messageModalIcon) {
        messageModalIcon.innerHTML = `<i class="${iconClass}" style="color: ${iconColor}"></i>`;
    }

    if (messageModal) {
        messageModal.classList.add('show');
    }
}

/**
 * Loads and displays the current user's profile information
 */
async function loadUserProfile() {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('full_name, employee_code, department, user_level, is_admin')
            .eq('id', user.id)
            .single();

        // Check if device is mobile (≤600px) - skip user-name functionality on mobile
        const isMobile = window.innerWidth <= 600;
        const userNameElement = isMobile ? null : document.querySelector('.user-name');
        const employeeNameElement = document.getElementById('employeeName');
        const employeeCodeElement = document.getElementById('employeeCode');

        if (profile) {
            // Only update user-name element if not on mobile
            if (userNameElement) {
                userNameElement.innerHTML = `${profile.full_name}<div style="font-size: 10px; color: white; margin-top: 2px; line-height: 1;">${profile.department || 'Department'}</div>`;
            }
            if (employeeNameElement) employeeNameElement.textContent = profile.full_name;
            if (employeeCodeElement) employeeCodeElement.textContent = (profile.employee_code || '').toUpperCase();

            filterQuickActionsByDepartment(user, profile.department, profile.user_level, profile.is_admin);

        } else if (profileError) {
            console.error("Error fetching profile:", profileError);
            // Only update user-name element if not on mobile
            if (userNameElement) {
                const displayName = user.email || 'Employee';
                userNameElement.innerHTML = `${displayName}<div style="font-size: 10px; color: white; margin-top: 2px; line-height: 1;">Department</div>`;
            }
            if (employeeNameElement) employeeNameElement.textContent = user.email || 'Employee';
            if (employeeCodeElement) employeeCodeElement.textContent = user.id.substring(0, 8).toUpperCase();

            filterQuickActionsByDepartment(user, null, null, false);
        }
    } else {
        console.error("User not logged in.");
        window.location.href = '../html/auth.html';
    }
}

/**
 * Filters quick action cards based on user department and level
 * @param {Object} user - Authenticated user object
 * @param {string|null} userDepartment - User's department or null
 * @param {number|null} userLevel - User's level or null
 * @param {boolean} isAdmin - Whether the user is an admin
 */
async function filterQuickActionsByDepartment(user, userDepartment, userLevel, isAdmin) {
    if (!user) return;

    try {
        const quickActionCards = document.querySelectorAll('.action-card');

        quickActionCards.forEach(card => {
            // Admin bypass: Admins see everything
            if (isAdmin) {
                card.classList.remove('js-hide');
                return;
            }

            const cardDepartments = card.getAttribute('data-department');
            const cardExcludeDepartments = card.getAttribute('data-exclude-department');
            const cardUserLevel = card.getAttribute('data-user-level');
            const cardRestrictedUser = card.getAttribute('data-restricted-user');
            const cardAdminOnly = card.getAttribute('data-admin-only');

            let shouldDisplay = false;

            // Check if card is admin-only
            if (cardAdminOnly === 'true' && !isAdmin) {
                shouldDisplay = false;
                card.classList.add('js-hide');
                return;
            }

            // Check if card is restricted to specific user
            if (cardRestrictedUser) {
                // This card is only for specific user(s)
                const restrictedUsers = cardRestrictedUser.split(',').map(u => u.trim());
                if (restrictedUsers.includes(user.id)) {
                    shouldDisplay = true;
                } else {
                    shouldDisplay = false;
                }
            } else if (cardDepartments) {
                // Normal department-based filtering
                const departmentsArray = cardDepartments.split(',').map(dept => dept.trim());
                const excludedArray = cardExcludeDepartments ? cardExcludeDepartments.split(',').map(dept => dept.trim()) : [];

                if (departmentsArray.includes('All')) {
                    shouldDisplay = true;
                } else if (userDepartment) {
                    const userDepartmentsArray = userDepartment.split(',').map(d => d.trim());
                    shouldDisplay = departmentsArray.some(cardDept => userDepartmentsArray.includes(cardDept));
                }

                // Apply exclusion if any
                if (shouldDisplay && userDepartment && excludedArray.length > 0) {
                    const userDepartmentsArray = userDepartment.split(',').map(d => d.trim());
                    const isExcluded = excludedArray.some(exDept => userDepartmentsArray.includes(exDept));
                    if (isExcluded) {
                        shouldDisplay = false;
                    }
                }
            }

            // Check user level if specified - if card requires a level, user must have that exact level
            if (shouldDisplay && cardUserLevel && !cardRestrictedUser) {
                if (userLevel === null || userLevel === undefined) {
                    // Card requires a user level but user doesn't have one - hide it
                    shouldDisplay = false;
                } else {
                    const requiredLevels = cardUserLevel.split(',').map(level => parseInt(level.trim()));
                    const numericUserLevel = parseInt(userLevel);
                    shouldDisplay = requiredLevels.includes(numericUserLevel);
                }
            }

            if (shouldDisplay) {
                card.classList.remove('js-hide');
            } else {
                card.classList.add('js-hide');
            }
        });

    } catch (error) {
        console.error('Unexpected error in filterQuickActionsByDepartment:', error);
    }
}
