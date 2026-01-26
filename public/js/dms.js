import { supabase } from '../supabase-config.js';

/**
 * Daily Management System (DMS) Page - Quick Action Card Department Filtering
 * This script handles the visibility of quick action cards based on user department
 * Following the same pattern as employee-dashboard.js, dcc.js, and mjr-management.js
 */

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
}

// Expose functions to global scope so inline onclick handlers can call them
window.showDmsList = showDmsList;
window.backToQuickCards = backToQuickCards;
window.loadDmsList = loadDmsList;

/**
 * Back to quick cards
 */
function backToQuickCards() {
    const quickGrid = document.querySelector('.quick-action-grid');
    const dmsList = document.getElementById('dms-list-section');
    if (dmsList) dmsList.classList.add('js-hide');
    if (quickGrid) quickGrid.classList.remove('js-hide');
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
    tbody.innerHTML = '<tr><td colspan="9" class="text-center py-8 text-gray-500">Loading...</td></tr>';

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
                tbody.innerHTML = '<tr><td colspan="9" class="text-center py-8 text-red-500">DB table <strong>production_floor_inspections</strong> not found.</td></tr>';
                if (currentPageDisplay) currentPageDisplay.textContent = '0';
                if (totalPagesDisplay) totalPagesDisplay.textContent = '0';
                return;
            }
            tbody.innerHTML = '<tr><td colspan="9" class="text-center py-8 text-red-500">Error loading records.</td></tr>';
            return;
        }

        const totalItems = count || (reports ? reports.length : 0);
        const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

        if (!reports || reports.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center py-8 text-gray-500">No records found.</td></tr>';
            if (currentPageDisplay) currentPageDisplay.textContent = page.toString();
            if (totalPagesDisplay) totalPagesDisplay.textContent = totalPages.toString();
            if (prevBtn) prevBtn.disabled = page <= 1;
            if (nextBtn) nextBtn.disabled = page >= totalPages;
            return;
        }

        const rows = reports.map((r, i) => `
            <tr>
                <td>${from + i + 1}</td>
                <td>${r.inspection_date || r.production_date || ''}</td>
                <td>${(r.data && r.data.machine) || ''}</td>
                <td>${(r.data && r.data.shift) || ''}</td>
                <td>${r.user_id || r.prepared_by || ''}</td>
                <td>${r.status || 'Submitted'}</td>
                <td>
                    <button class="p-1 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-200" onclick="window.open('production-floor-dms.html?id=${r.id || r.form_id}','_self')">Open</button>
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
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-8 text-red-500">Unexpected error loading records.</td></tr>';
    }
}

/**
 * Initialize DMS Page
 * Called when DOM is ready
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('Daily Management System Page loaded');
    
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
