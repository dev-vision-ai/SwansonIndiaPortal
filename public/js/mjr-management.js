import { supabase } from '../supabase-config.js';

/**
 * MJR Management Page - Quick Action Card Department Filtering
 * This script handles the visibility of quick action cards based on user department
 * Following the same pattern as employee-dashboard.js and dcc.js
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
            // If not logged in, hide all cards
            document.querySelectorAll('.action-card').forEach(card => {
                card.classList.add('js-hide');
            });
            return;
        }

        // Fetch user profile with department info
        const { data: userProfile, error } = await supabase
            .from('users')
            .select('department')
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

        // Filter cards based on department
        document.querySelectorAll('.action-card').forEach(card => {
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
 * Initialize MJR Management Page
 * Called when DOM is ready
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('MJR Management Page loaded');
    
    // Filter cards based on user department
    filterQuickActionsByDepartment();
});
