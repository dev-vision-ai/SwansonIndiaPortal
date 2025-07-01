import { supabase } from '../supabase-config.js';

document.addEventListener('DOMContentLoaded', async () => {
    const tableBody = document.querySelector('#filmInspectionListTableBody');

    async function fetchFilmInspectionForms() {
        const { data, error } = await supabase
            .from('prestore_and_film_inspection_form')
            .select('id, lot_no, production_order, product_code, specification, inspection_date, machine_no, prepared_by');

        // Fetch user names for prepared_by field
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const userIds = [...new Set(data.map(item => item.prepared_by).filter(id => uuidRegex.test(id)))];

        let usersData = null;
        let usersError = null;

        if (userIds.length > 0) {
            const { data: fetchedUsersData, error: fetchedUsersError } = await supabase
                .from('users') // Assuming your user profiles are in a 'users' table
                .select('id, full_name')
                .in('id', userIds);
            usersData = fetchedUsersData;
            usersError = fetchedUsersError;
        }

        if (usersError) {
            console.error('Error fetching user names:', usersError.message);
            // Continue without names if there's an error
        }

        const userMap = new Map();
        if (usersData) {
            usersData.forEach(user => {
                userMap.set(user.id, user.full_name);
            });
        }

        if (error) {
            console.error('Error fetching data:', error.message);
            return;
        }
        console.log('Fetched data:', data);

        tableBody.innerHTML = ''; // Clear existing rows

        data.forEach(formData => {
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td class="py-2 px-4 border-b border-r text-center">${formData.lot_no || ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.production_order || ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.product_code || ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.specification || ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.inspection_date ? new Date(formData.inspection_date).toLocaleDateString('en-GB') : ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.machine_no || ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">
                    ${uuidRegex.test(formData.prepared_by) ? (userMap.get(formData.prepared_by) || formData.prepared_by) : formData.prepared_by || ''}
                </td>
                <td class="py-2 px-5 border-b text-center">
                    <div class="flex items-center space-x-2 justify-center">

                        <button class="bg-purple-500 text-white p-2 rounded-md hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 view-film-form-button" data-id="${formData.id}" title="Add Details">
                            <i class="fas fa-plus fa-lg"></i>
                        </button>
                        <button class="bg-green-500 text-white p-2 rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 edit-button" data-id="${formData.id}" title="Edit Pre-store">
                            <i class="fas fa-edit fa-lg"></i>
                        </button>
                        <button class="bg-blue-700 text-white p-2 rounded-md hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-opacity-50" title="View">
                            <i class="fas fa-eye fa-lg"></i>
                        </button>
                        <button class="bg-red-500 text-white p-2 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 delete-button" data-id="${formData.id}" title="Delete Film Inspection Form">
                            <i class="fas fa-trash fa-lg"></i>
                        </button>
                    </div>
                </td>
            `;
        });
    }

    // Example for a search function
    async function searchFilmInspectionForms(searchTerm) {
        let query = supabase.from('prestore_and_film_inspection_form').select('*');
    
        if (searchTerm) {
            // Prioritize exact match on lot_no
            query = query.eq('lot_no', searchTerm);
            // Or for partial matches, you might use .ilike() for case-insensitive search
            // query = query.ilike('lot_no', `%${searchTerm}%`);
        }
    
        const { data, error } = await query;
    
        if (error) {
            console.error('Error fetching data:', error.message);
            return;
        }
        console.log('Fetched data:', data);

        tableBody.innerHTML = ''; // Clear existing rows

        data.forEach(formData => {
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td class="py-2 px-4 border-b text-center">${formData.lot_no || ''}</td>
                <td class="py-2 px-4 border-b">${formData.production_order || ''}</td>
                <td class="py-2 px-4 border-b">${formData.product_code || ''}</td>
                <td class="py-2 px-4 border-b">${formData.specification || ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.inspection_date || ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.machine_no || ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.prepared_by || ''}</td>
                <td class="py-2 px-5 border-b text-center">
                    <div class="flex items-center space-x-2 justify-center">
                        <button class="bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button class="bg-green-500 text-white p-2 rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="bg-blue-700 text-white p-2 rounded-md hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-opacity-50">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="bg-red-500 text-white p-2 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 delete-button" data-id="${formData.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
        });
    }

    fetchFilmInspectionForms();

    // Add event listener for edit buttons
    tableBody.addEventListener('click', (event) => {
        const viewFilmFormButton = event.target.closest('.view-film-form-button');
        if (viewFilmFormButton) {
            const formId = viewFilmFormButton.dataset.id;
            window.location.href = `/html/pre_store_&_fif/film_inspection_form_data.html?id=${formId}`;
        }

        const editButton = event.target.closest('.edit-button');
        if (editButton) {
            const formId = editButton.dataset.id;
            window.location.href = `pre_store_form.html?id=${formId}`;
        }

        const deleteButton = event.target.closest('.delete-button');
        if (deleteButton) {
            const formId = deleteButton.dataset.id;
            // For now, just log the ID. We'll add the password prompt later.
            console.log('Delete button clicked for ID:', formId);
            // Implement password prompt and deletion logic here
            showPasswordConfirmModal(formId);
        }
    });

    const passwordConfirmModal = document.getElementById('passwordConfirmModal');
    const deletePasswordInput = document.getElementById('deletePasswordInput');
    const confirmDeleteButton = document.getElementById('confirmDeleteButton');
    const cancelDeleteButton = document.getElementById('cancelDeleteButton');

    let currentDeleteFormId = null;

    function showPasswordConfirmModal(formId) {
        currentDeleteFormId = formId;
        deletePasswordInput.value = ''; // Clear any previous input
        passwordConfirmModal.classList.remove('hidden');
        // Reset password field to type 'password' and eye icon to 'fa-eye'
        deletePasswordInput.type = 'password';
        document.getElementById('togglePasswordVisibility').querySelector('i').classList.remove('fa-eye-slash');
        document.getElementById('togglePasswordVisibility').querySelector('i').classList.add('fa-eye');
    }

    function hidePasswordConfirmModal() {
        passwordConfirmModal.classList.add('hidden');
        currentDeleteFormId = null;
    }

    cancelDeleteButton.addEventListener('click', () => {
        hidePasswordConfirmModal();
    });

    const togglePasswordVisibilityButton = document.getElementById('togglePasswordVisibility');
    togglePasswordVisibilityButton.addEventListener('click', () => {
        const type = deletePasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        deletePasswordInput.setAttribute('type', type);
        // Toggle the eye icon
        togglePasswordVisibilityButton.querySelector('i').classList.toggle('fa-eye');
        togglePasswordVisibilityButton.querySelector('i').classList.toggle('fa-eye-slash');
    });

    confirmDeleteButton.addEventListener('click', async () => {
        const password = deletePasswordInput.value;
        if (!password) {
            alert('Please enter your password.');
            return;
        }

        // In a real application, you would send this password to a secure backend
        // (e.g., a Supabase Function or an API endpoint) for verification.
        // For this example, we'll simulate a check. You might compare it against
        // the current user's password if you have access to it client-side (less secure)
        // or a predefined admin password (also less secure).
        // A more secure approach involves re-authenticating the user or using a server-side check.

        // For demonstration purposes, let's assume a hardcoded password for now.
        // REPLACE THIS WITH SECURE SERVER-SIDE VERIFICATION IN PRODUCTION!
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        console.log('Current Supabase User:', currentUser);
        if (!currentUser) {
            alert('User not logged in. Cannot verify password.');
            hidePasswordConfirmModal();
            return;
        }

        // This is a placeholder for actual password verification.
        // You CANNOT directly verify a user's password against a hash client-side.
        // You would typically call a server-side function that checks the password.
        // For the sake of demonstrating the flow, we'll use a dummy check.
        const isPasswordCorrect = password === 'Swanson@2010'; // DUMMY CHECK - REPLACE WITH REAL AUTHENTICATION

        if (isPasswordCorrect) {
            // Proceed with deletion
            const { error } = await supabase
                .from('prestore_and_film_inspection_form')
                .delete()
                .eq('id', currentDeleteFormId);

            if (error) {
                console.error('Error deleting form:', error.message);
                alert('Error deleting form: ' + error.message);
            } else {
                alert('Form deleted successfully!');
                fetchFilmInspectionForms(); // Refresh the list
            }
            hidePasswordConfirmModal();
        } else {
            alert('Incorrect password.');
        }
    });
});