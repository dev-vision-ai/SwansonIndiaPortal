// Import the Supabase client instance
import { supabase } from '../supabase-config.js';

// DOM Elements
const createUserForm = document.getElementById('create-user-form');
const usersTableBody = document.querySelector('#users-table tbody');
const userEmailInput = document.getElementById('user-email');
const userPasswordInput = document.getElementById('user-password');
const userRoleInput = document.getElementById('user-role');
const userDepartmentInput = document.getElementById('user-department');

// --- Utility function to escape HTML ---
function escapeHTML(str) {
    // ... (same escapeHTML function as before) ...
    if (str === null || str === undefined) return '';
    return str.toString()
         .replace(/&/g, '&amp;')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;')
         .replace(/"/g, '&quot;')
         .replace(/'/g, '&#039;');
}

// --- Function to Load and Display Users ---
async function loadUsers() {
    console.log('Loading users...');
    if (!usersTableBody) {
        console.error('Users table body not found!');
        return;
    }
    usersTableBody.innerHTML = '<tr class="loading-row"><td colspan="4">Loading users...</td></tr>';

    try {
        // Fetch user data from the 'users' table
        // Assumes 'user_id' column links to auth.users.id
        // RLS policies must allow reading this data.
        const { data: usersData, error: usersError } = await supabase
            .from('users') // <<< CHANGED FROM 'profiles' to 'users'
            .select(`
                user_id, 
                role, 
                department,
                auth_user:user_id ( email ) 
            `); // <<< Adjusted join alias for clarity

        if (usersError) throw usersError;

        console.log('Fetched users data:', usersData);

        if (!usersData || usersData.length === 0) {
            usersTableBody.innerHTML = '<tr><td colspan="4">No users found.</td></tr>';
            return;
        }

        renderUsersTable(usersData);

    } catch (error) {
        console.error('Error fetching users:', error);
        usersTableBody.innerHTML = `<tr><td colspan="4" style="color: red;">Error loading users: ${error.message}</td></tr>`;
    }
}

// --- Render Users Table ---
function renderUsersTable(usersData) {
    let tableHTML = '';
    usersData.forEach(userData => {
        // Check if auth_user data (email) was successfully joined
        const email = userData.auth_user ? userData.auth_user.email : 'Email not found'; 
        const userId = userData.user_id; // Get the user ID for actions

        tableHTML += `
            <tr data-id="${escapeHTML(userId)}">
                <td>${escapeHTML(email)}</td>
                <td>${escapeHTML(userData.role || '')}</td>
                <td>${escapeHTML(userData.department || '')}</td>
                <td>
                    <button class="delete-user-btn btn btn-sm btn-danger" data-id="${escapeHTML(userId)}" data-email="${escapeHTML(email)}">Delete</button>
                    <!-- Add Edit button/functionality later if needed -->
                </td>
            </tr>
        `;
    });
    usersTableBody.innerHTML = tableHTML;
}

// --- Handle Create User Form Submission ---
async function handleCreateUserSubmit(event) {
    // ... (same handleCreateUserSubmit function as before) ...
    // It calls the 'create-user' Edge Function, which needs to know
    // internally to insert into the 'users' table.
    event.preventDefault();
    console.log('Create user form submitted');

    const email = userEmailInput.value;
    const password = userPasswordInput.value;
    const role = userRoleInput.value;
    const department = userDepartmentInput.value;

    if (!email || !password || !role || !department) {
        alert('Please fill in all fields.');
        return;
    }

    const submitButton = createUserForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Creating...';

    try {
        console.log('Invoking Supabase Edge Function: create-user');
        const { data, error } = await supabase.functions.invoke('create-user', {
            body: { email, password, role, department },
        });

        if (error) throw error;
        if (data && data.error) throw new Error(data.error);

        console.log('User creation function response:', data);
        alert('User created successfully!');
        createUserForm.reset(); 
        loadUsers(); 

    } catch (error) {
        console.error('Error creating user:', error);
        alert(`Error creating user: ${error.message}`);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Create User';
    }
}

// --- Handle Delete User ---
async function handleDeleteUser(userId, userEmail) {
    // ... (same handleDeleteUser function as before) ...
    // It calls the 'delete-user' Edge Function.
    console.log(`Attempting to delete user ID: ${userId}, Email: ${userEmail}`);
    if (!confirm(`Are you sure you want to delete the user: ${userEmail}? This cannot be undone.`)) {
        return;
    }

    try {
        console.log('Invoking Supabase Edge Function: delete-user');
        const { data, error } = await supabase.functions.invoke('delete-user', {
            body: { userIdToDelete: userId },
        });

        if (error) throw error;
        if (data && data.error) throw new Error(data.error);

        console.log('User deletion function response:', data);
        alert('User deleted successfully.');
        loadUsers();

    } catch (error) {
        console.error('Error deleting user:', error);
        alert(`Error deleting user: ${error.message}`);
    }
}

// --- Setup Event Listeners ---
function setupEventListeners() {
    // ... (same setupEventListeners function as before) ...
    if (createUserForm) {
        createUserForm.addEventListener('submit', handleCreateUserSubmit);
    } else {
        console.error('Create user form not found!');
    }

    if (usersTableBody) {
        usersTableBody.addEventListener('click', (event) => {
            const target = event.target;
            if (target.classList.contains('delete-user-btn')) {
                const userId = target.dataset.id;
                const userEmail = target.dataset.email;
                if (userId && userEmail) {
                    handleDeleteUser(userId, userEmail);
                } else {
                    console.error('Could not get user ID or email for deletion.');
                }
            }
        });
    } else {
        console.error('Users table body not found for event delegation!');
    }
}

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    // ... (same DOMContentLoaded listener as before) ...
    console.log('DOM fully loaded for User Management.');
    loadUsers();
    setupEventListeners();
});