import { supabase } from '../supabase-config.js';
import { showToast } from './toast.js';

/**
 * Get current user's full name
 */
async function getCurrentUser() {
    try {
        // Get the logged-in user from Supabase auth
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            throw new Error('User not authenticated');
        }

        // Get user's full name from database
        const { data: userData, error: profileError } = await supabase
            .from('users')
            .select('full_name, employee_code')
            .eq('id', user.id)
            .single();

        if (!profileError && userData) {
            if (userData.full_name && userData.full_name.trim() !== '') {
                return userData.full_name;
            } else if (userData.employee_code && userData.employee_code.trim() !== '') {
                return userData.employee_code;
            }
        }

        // Fallback to email prefix if no full name or employee code
        return user.email.split('@')[0];
    } catch (error) {
        console.error('Error getting current user:', error);
        return 'Unknown User';
    }
}

/**
 * Check if user has access to DMS page
 */
async function checkDmsAccess() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
        .from('users')
        .select('department, is_admin')
        .eq('id', user.id)
        .single();

    if (profile) {
        const allowedDepts = ['Quality Control', 'Quality Assurance'];
        const isAllowed = profile.is_admin || (profile.department && allowedDepts.includes(profile.department));

        if (!isAllowed) {
            showToast('You do not have permission to access Daily Management System.', 'error');
            setTimeout(() => {
                window.location.href = 'employee-dashboard.html';
            }, 2000);
            return false;
        }
    }
    return true;
}

/**
 * Filter Quick Action Cards by User Department
 * Shows/hides cards based on user's department and card's data-department attribute
 */
async function filterQuickActionsByDepartment() {
    try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            // If not logged in, hide all cards and redirect to login
            document.querySelectorAll('.action-card').forEach(card => {
                card.classList.add('js-hide');
            });
            window.location.replace('../html/auth.html');
            return;
        }

        // Fetch user profile with department and admin info
        const { data: userProfile, error } = await supabase
            .from('users')
            .select('department, is_admin')
            .eq('id', user.id)
            .single();

        if (error) {
            console.error('Error fetching user profile:', error);
            // Hide all cards if we can't fetch user info
            document.querySelectorAll('.action-card').forEach(card => {
                card.classList.add('js-hide');
            });
            return;
        }

        const userDepartment = userProfile?.department || '';
        const isAdmin = userProfile?.is_admin || false;

        // Filter cards based on department
        document.querySelectorAll('.action-card').forEach(card => {
            // Admin bypass
            if (isAdmin) {
                card.classList.remove('js-hide');
                return;
            }

            let shouldDisplay = false;
            const cardDepartments = card.getAttribute('data-department');

            if (cardDepartments) {
                const departmentsArray = cardDepartments.split(',').map(dept => dept.trim());

                if (departmentsArray.includes('All')) {
                    shouldDisplay = true;
                } else if (userDepartment) {
                    const userDepartmentsArray = userDepartment.split(',').map(d => d.trim());
                    shouldDisplay = departmentsArray.some(cardDept => userDepartmentsArray.includes(cardDept));
                }
            }

            // Apply display decision
            if (shouldDisplay) {
                card.classList.remove('js-hide');
            } else {
                card.classList.add('js-hide');
            }
        });

        // Show the entire grid after filtering
        const quickActionGrid = document.querySelector('.quick-action-grid');
        if (quickActionGrid) {
            quickActionGrid.style.display = 'flex';
        }

    } catch (error) {
        console.error('Unexpected error in filterQuickActionsByDepartment:', error);
        // Hide all cards on error
        document.querySelectorAll('.action-card').forEach(card => {
            card.classList.add('js-hide');
        });
    }
}

/**
 * Show DMS list section and hide quick cards
 */
function showDmsList() {
    const quickGrid = document.querySelector('.quick-action-grid');
    const dmsList = document.getElementById('dms-list-section');
    if (quickGrid) quickGrid.classList.add('js-hide');
    if (dmsList) {
        dmsList.classList.remove('js-hide');
        // Load data when list is shown
        loadDmsList();
    }

    // Update header back button to go back to DMS quick cards
    const backButton = document.querySelector('.header-back-button');
    if (backButton) {
        backButton.setAttribute('onclick', 'backToQuickCards()');
    }
}

// Expose functions to global scope so inline onclick handlers can call them
window.showDmsList = showDmsList;
window.backToQuickCards = backToQuickCards;
window.loadDmsList = loadDmsList;
window.approveDmsRecord = approveDmsRecord;
window.deleteDmsRecord = deleteDmsRecord;

/**
 * Back to quick cards
 */
function backToQuickCards() {
    const quickGrid = document.querySelector('.quick-action-grid');
    const dmsList = document.getElementById('dms-list-section');
    if (dmsList) dmsList.classList.add('js-hide');
    if (quickGrid) quickGrid.classList.remove('js-hide');

    // Update URL to remove view parameter completely
    const url = new URL(window.location);
    url.searchParams.delete('view');
    window.history.replaceState({}, '', url.toString());

    // Reset header back button to go to employee dashboard
    const backButton = document.querySelector('.header-back-button');
    if (backButton) {
        backButton.setAttribute('onclick', "window.location.href='employee-dashboard.html'");
    }
}

let currentPage = 1;
const itemsPerPage = 10;

/**
 * Load DMS records from Supabase and populate table (with pagination)
 */
async function loadDmsList(page = 1) {
    currentPage = page;

    const tbody = document.getElementById('dmsListTableBody');
    const currentPageDisplay = document.getElementById('currentPageDisplay');
    const totalPagesDisplay = document.getElementById('totalPagesDisplay');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');

    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-500">Loading...</td></tr>';

    try {
        const from = (page - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;

        const { data: reports, error, count } = await supabase
            .from('production_floor_inspections')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('Error loading DMS records:', error);
            if (error.code === '42P01') {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-red-500">DB table <strong>production_floor_inspections</strong> not found.</td></tr>';
                if (currentPageDisplay) currentPageDisplay.textContent = '0';
                if (totalPagesDisplay) totalPagesDisplay.textContent = '0';
                return;
            }
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-red-500">Error loading records.</td></tr>';
            return;
        }

        const totalItems = count || (reports ? reports.length : 0);
        const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

        if (!reports || reports.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-500">No records found.</td></tr>';
            if (currentPageDisplay) currentPageDisplay.textContent = page.toString();
            if (totalPagesDisplay) totalPagesDisplay.textContent = totalPages.toString();
            if (prevBtn) prevBtn.disabled = page <= 1;
            if (nextBtn) nextBtn.disabled = page >= totalPages;
            return;
        }

        const rows = reports.map((r, i) => `
            <tr>
                <td class="text-center align-middle" style="width:5%">${from + i + 1}</td>
                <td class="text-center align-middle" style="width:15%">${r.inspection_date ? new Date(r.inspection_date).toLocaleDateString('en-GB') : ''}</td>
                <td class="text-center align-middle" style="width:15%">${r.checked_by || 'Unknown'}</td>
                <td class="text-center align-middle" style="width:15%">${r.verified_by || 'Pending'}</td>
                <td class="text-center align-middle" style="width:15%">${r.verification_date ? new Date(r.verification_date).toLocaleDateString('en-GB') : '-'}</td>
                <td class="text-center align-middle" style="width:10%">
                    <span class="px-2 py-1 rounded-full text-xs font-medium
                        ${r.status === 'Verified' ? 'bg-green-100 text-green-800' :
                r.status === 'Approved' ? 'bg-green-100 text-green-800' :
                    r.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'}">
                        ${r.status || 'Submitted'}
                    </span>
                </td>
                <td class="text-center align-middle" style="width:25%">
                    <div class="flex justify-center space-x-1 flex-nowrap max-w-full overflow-hidden">
                        <!-- Blue View button - always show -->
                        <button class="p-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-800 transition-all duration-200 border border-blue-200 hover:border-blue-300 flex-shrink-0" onclick="window.open('production-floor-dms.html?id=${r.id || r.form_id}','_self')" title="View">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                            </svg>
                        </button>
                        <!-- Purple Edit button - hide if verified -->
                        ${r.status !== 'Verified' ? `<button class="p-1 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-600 hover:text-purple-800 transition-all duration-200 border border-purple-200 hover:border-purple-300 flex-shrink-0" onclick="window.open('production-floor-dms.html?id=${r.id || r.form_id}&edit=true','_self')" title="Edit">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                            </svg>
                        </button>` : ''}
                        <!-- Green Approve button - hide if verified -->
                        ${r.status !== 'Verified' ? `<button class="p-1 rounded-md bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-800 transition-all duration-200 border border-green-200 hover:border-green-300 flex-shrink-0" onclick="approveDmsRecord(${r.id || r.form_id})" title="Approve">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </button>` : ''}
                        <!-- Red Delete button - hide if verified -->
                        ${r.status !== 'Verified' ? `<button class="p-1 rounded-md bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 transition-all duration-200 border border-red-200 hover:border-red-300 flex-shrink-0" onclick="deleteDmsRecord(${r.id || r.form_id})" title="Delete">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>` : ''}
                    </div>
                </td>
            </tr>
        `).join('');

        tbody.innerHTML = rows;

        if (currentPageDisplay) currentPageDisplay.textContent = page.toString();
        if (totalPagesDisplay) totalPagesDisplay.textContent = totalPages.toString();
        if (prevBtn) prevBtn.disabled = page <= 1;
        if (nextBtn) nextBtn.disabled = page >= totalPages;

    } catch (error) {
        console.error('Unexpected error loading DMS list:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-red-500">Unexpected error loading records.</td></tr>';
    }
}

/**
 * Approve DMS Record
 */
async function approveDmsRecord(recordId) {
    try {
        const currentUser = await getCurrentUser();
        const approvalDate = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD format

        // Show approval confirmation popup
        showApprovalConfirmationPopup(recordId, currentUser, approvalDate);

    } catch (error) {
        console.error('Error during approval:', error);
        showToast('Error during approval: ' + error.message, 'error');
    }
}

/**
 * Show Approval Confirmation Popup
 */
function showApprovalConfirmationPopup(recordId, currentUser, approvalDate) {
    // Populate popup with data
    document.getElementById('confirmApproverName').textContent = currentUser;
    document.getElementById('confirmApprovalDate').value = approvalDate; // Set date input value

    // Clear password field
    document.getElementById('approvalPasswordInput').value = '';

    // Show popup
    document.getElementById('approvalConfirmPopup').style.display = 'flex';

    // Set up event listeners
    document.getElementById('confirmApprovalBtn').onclick = async () => {
        const password = document.getElementById('approvalPasswordInput').value;
        const selectedApprovalDate = document.getElementById('confirmApprovalDate').value; // Get selected date

        if (password !== 'QC-2256') {
            showToast('Invalid approval password!', 'error');
            return;
        }

        if (!selectedApprovalDate) {
            showToast('Please select verification date.', 'warning');
            return;
        }

        try {
            document.getElementById('approvalConfirmPopup').style.display = 'none';

            const { error } = await supabase
                .from('production_floor_inspections')
                .update({
                    status: 'Verified',
                    verified_by: currentUser,
                    verification_date: selectedApprovalDate
                })
                .eq('id', recordId);

            if (error) throw error;

            showToast('Record approved successfully!', 'success');
            loadDmsList(currentPage);
        } catch (error) {
            console.error('Error approving record:', error);
            showToast('Error approving record: ' + error.message, 'error');
        }
    };

    document.getElementById('cancelApprovalPopupBtn').onclick = () => {
        document.getElementById('approvalConfirmPopup').style.display = 'none';
    };
}

/**
 * Delete DMS Record
 */
async function deleteDmsRecord(recordId) {
    if (!confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('production_floor_inspections')
            .delete()
            .eq('id', recordId);

        if (error) throw error;

        showToast('Record deleted successfully!', 'success');
        loadDmsList(currentPage);
    } catch (error) {
        console.error('Error deleting record:', error);
        showToast('Error deleting record: ' + error.message, 'error');
    }
}

/**
 * Initialize DMS Page
 * Called when DOM is ready
 */
document.addEventListener('DOMContentLoaded', function () {
    console.log('Daily Management System Page loaded');

    // Check if we should show DMS list based on URL
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view');

    if (view === 'list') {
        showDmsList();
    }

    // Check access permissions
    checkDmsAccess();

    // Filter cards based on user department
    filterQuickActionsByDepartment();

    // Wire up back button and create button if present
    const createBtn = document.getElementById('createDMSBtn');
    if (createBtn) createBtn.addEventListener('click', () => window.location.href = 'production-floor-dms.html');

    // Pagination controls
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    if (prevBtn) prevBtn.addEventListener('click', () => loadDmsList(Math.max(1, currentPage - 1)));
    if (nextBtn) nextBtn.addEventListener('click', () => loadDmsList(currentPage + 1));

    // Expose load function if needed elsewhere
    window.loadDmsList = loadDmsList;
});
