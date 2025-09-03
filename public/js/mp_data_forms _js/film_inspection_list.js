import { supabase } from '../../supabase-config.js';

document.addEventListener('DOMContentLoaded', async () => {
    const tableBody = document.querySelector('#filmInspectionListTableBody');

    async function fetchFilmInspectionForms() {
        const { data, error } = await supabase
            .from('168_16cp_kranti')
            .select('form_id, lot_no, production_order, product_code, specification, inspection_date, machine_no, prepared_by, production_date');

        // Fetch user names for prepared_by field
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const userIds = data ? [...new Set(data.map(item => item.prepared_by).filter(id => uuidRegex.test(id)))] : [];

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

        tableBody.innerHTML = ''; // Clear existing rows

        data.forEach((formData, index) => {
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td class="py-2 px-4 border-b border-r text-center">${index + 1}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.production_date ? new Date(formData.production_date).toLocaleDateString('en-GB') : ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.product_code || ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.machine_no || ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.lot_no || ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.specification || ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.inspection_date ? new Date(formData.inspection_date).toLocaleDateString('en-GB') : ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">
                    ${uuidRegex.test(formData.prepared_by) ? (userMap.get(formData.prepared_by) || formData.prepared_by) : formData.prepared_by || ''}
                </td>
                <td class="py-2 px-4 border-b border-r text-center">-</td>
                <td class="py-2 px-4 border-b border-r text-center">
                    <div class="flex justify-center space-x-3 flex-wrap max-w-full overflow-hidden">
                        <!-- Sky blue Enter Data button -->
                        <button class="p-1.5 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-600 hover:text-sky-800 transition-all duration-200 border border-sky-200 hover:border-sky-300 flex-shrink-0 view-film-form-button" data-id="${formData.form_id}" title="Add Details">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                            </svg>
                        </button>
                        <!-- Green Edit button - now opens prestore form -->
                        <button onclick="openPrestoreForm('${formData.lot_no}', '${formData.product_code}', '${formData.production_order}')" class="p-1.5 rounded-md bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-800 transition-all duration-200 border border-green-200 hover:border-green-300 flex-shrink-0" title="Edit Pre-store">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                        </button>
                        <!-- Dark blue View button -->
                        <button class="p-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 hover:text-blue-900 transition-all duration-200 border border-blue-200 hover:border-blue-300 flex-shrink-0" title="View">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                            </svg>
                        </button>
                        <!-- Red Delete button -->
                        <button class="p-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 transition-all duration-200 border border-red-200 hover:border-red-300 flex-shrink-0 delete-button" data-id="${formData.id}" title="Delete Film Inspection Form">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                </td>
                <td class="py-2 px-4 border-b border-r text-center">
                    <button class="p-1.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-800 transition-all duration-200 border border-indigo-200 hover:border-indigo-300 flex-shrink-0" title="Download">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                    </button>
                </td>
            `;
        });
    }

    // Expose the function globally so it can be called from the modal
    window.loadFilmInspectionForms = fetchFilmInspectionForms;

    // Load forms table on page load
    fetchFilmInspectionForms();

    // Example for a search function
    async function searchFilmInspectionForms(searchTerm) {
        let query = supabase.from('168_16cp_kranti').select('*');
    
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

    // Function to pre-populate prestore form modal
    function prePopulatePrestoreForm(data) {
        console.log('Pre-populating prestore form with data:', data);
        
        // Map field names from film inspection to prestore form
        const fieldMappings = {
            'lot_no': 'lot-no-modal',
            'product_code': 'product-code-modal',
            'production_order': 'production-order-modal'
        };
        
        for (const [key, modalId] of Object.entries(fieldMappings)) {
            const input = document.getElementById(modalId);
            if (input && data[key]) {
                input.value = data[key];
                console.log(`Populated ${modalId} with value: ${data[key]}`);
            }
        }
        
        // Load customers for the modal
        loadCustomersForModal();
    }
    
    // Function to load customers for the modal
    async function loadCustomersForModal() {
        try {
            console.log('Loading customers for modal...');
            const { data: customers, error } = await supabase
                .from('customers_master')
                .select('customer_name')
                .order('customer_name');

            if (error) {
                console.error('Error fetching customers:', error.message);
                return;
            }

            console.log('Customers loaded for modal:', customers);

            // Get the customer dropdown in modal
            const customerSelect = document.getElementById('customer-modal');
            if (!customerSelect) return;

            // Clear existing options except the first one
            customerSelect.innerHTML = '<option value="">Select Customer</option>';

            // Add customers to dropdown
            customers.forEach(customer => {
                const option = document.createElement('option');
                option.value = customer.customer_name;
                option.textContent = customer.customer_name;
                customerSelect.appendChild(option);
            });

            console.log('Customers added to modal dropdown');

        } catch (error) {
            console.error('Error loading customers for modal:', error);
        }
    }
    
    // Function to open prestore form modal with pre-filled data
    window.openPrestoreForm = function(lotNo, productCode, productionOrder) {
        // Store the film inspection data in session storage
        const prestoreData = {
            lot_no: lotNo,
            product_code: productCode,
            production_order: productionOrder,
            source: 'film_inspection'
        };
        sessionStorage.setItem('prestoreFormData', JSON.stringify(prestoreData));
        
        // Open the prestore form modal
        const preStoreFormOverlay = document.getElementById('preStoreFormOverlay');
        if (preStoreFormOverlay) {
            preStoreFormOverlay.classList.remove('hidden');
            prePopulatePrestoreForm(prestoreData);
        }
    };
    
    // Modal close functionality
    const closePreStoreFormOverlay = document.getElementById('closePreStoreFormOverlay');
    const preStoreFormOverlay = document.getElementById('preStoreFormOverlay');
    const preStoreFormModal = document.getElementById('preStoreFormModal');
    
    // Close modal when X button is clicked
    if (closePreStoreFormOverlay) {
        closePreStoreFormOverlay.addEventListener('click', function() {
            if (preStoreFormOverlay) {
                preStoreFormOverlay.classList.add('hidden');
                if (preStoreFormModal) {
                    preStoreFormModal.reset();
                }
            }
        });
    }
    

        
    // Handle form submission
    if (preStoreFormModal) {
        preStoreFormModal.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            const formData = new FormData(preStoreFormModal);
            const preStoreFormData = {
                production_order: formData.get('production_order'),
                product_code: formData.get('product-code'),
                quantity: formData.get('quantity'),
                customer: formData.get('customer'),
                location: formData.get('location'),
                specification: formData.get('specification'),
                batch: formData.get('batch'),
                ref_no: formData.get('ref_no'),
                standard_packing: formData.get('standard-packing'),
                production_date: formData.get('production-date'),
                inspection_date_prestore: formData.get('inspection-date'),
                pallet_size: formData.get('pallet-size'),
                machine_no: formData.get('machine_no'),
                purchase_order: formData.get('purchase_order'),
                lot_no: formData.get('lot_no'),
                pallet_list: formData.get('pallet-list'),
                product_label: formData.get('product-label'),
                wrapping: formData.get('wrapping'),
                layer_pad: formData.get('layer-pad'),
                contamination: formData.get('contamination'),
                kraft_paper: formData.get('kraft-paper'),
            };

            // Add 'SWIN' prefix to lot_no if it doesn't already have it
            if (preStoreFormData.lot_no && !preStoreFormData.lot_no.startsWith('SWIN')) {
                preStoreFormData.lot_no = 'SWIN' + preStoreFormData.lot_no;
            }

            // Get the logged-in user's email
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) {
                console.error('Error fetching user:', userError.message);
                alert('Could not retrieve user information. Please try again.');
                return;
            }
            
            // Add the user's email to the finalData object
            if (user && user.id) {
                preStoreFormData.prepared_by = user.id;
            } else {
                preStoreFormData.prepared_by = 'unknown';
            }

            console.log('Submitting prestore form data:', preStoreFormData);

            // Determine the table name based on the selected product
            let tableName = '168_16cp_kranti';
            if (preStoreFormData.product_code) {
                const productTableMap = {
                    'APE-168(16)C': '168_16cp_kranti',
                    'APE-168(16)CP(KRANTI)': '168_16cp_kranti'
                };
                tableName = productTableMap[preStoreFormData.product_code] || '168_16cp_kranti';
            }
            console.log('Selected product:', preStoreFormData.product_code);
            console.log('Target table:', tableName);

            // Insert new record
            const { error } = await supabase
                .from(tableName)
                .insert([preStoreFormData]);

            if (error) {
                console.error('Error saving prestore data:', error.message);
                alert('Error saving data: ' + error.message);
            } else {
                alert('Pre-store form data saved successfully!');
                preStoreFormModal.reset();
                preStoreFormOverlay.classList.add('hidden');
                sessionStorage.removeItem('prestoreFormData');
            }
        });
    }

    // Add event listener for edit buttons
    tableBody.addEventListener('click', (event) => {
        const viewFilmFormButton = event.target.closest('.view-film-form-button');
        if (viewFilmFormButton) {
            const formId = viewFilmFormButton.dataset.id;
            const lotNo = viewFilmFormButton.closest('tr').querySelector('td:nth-child(5)').textContent; // Get lot_no from the row
            const productCode = viewFilmFormButton.closest('tr').querySelector('td:nth-child(3)').textContent; // Get product_code from the row
            
            // Store form data in sessionStorage
            sessionStorage.setItem('currentFormId', formId);
            sessionStorage.setItem('currentLotNo', lotNo);
            sessionStorage.setItem('currentProductCode', productCode);
            
            // Route to the correct form based on product code
            let targetForm = '';
            switch(productCode) {
                case 'APE-168(16)CP(KRANTI)':
                case 'APE-168(16)C':
                    targetForm = '16_gsm_kranti.html';
                    break;
                case 'APE-168(18)CP(KRANTI)':
                case 'APE-168(18)C':
                    targetForm = '18_gsm_kranti.html'; // Future form
                    break;
                case 'WHITE-234(18)':
                    targetForm = 'white_234_18.html'; // Future form
                    break;
                case 'APE-176(18)CP(LCC+WW)BS':
                    targetForm = 'ape_176_18_lcc_ww_bs.html'; // Future form
                    break;
                default:
                    // Default fallback
                    targetForm = '16_gsm_kranti.html';
                    break;
            }
            
            window.location.href = targetForm;
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

    // Check if password modal elements exist before adding event listeners
    const passwordConfirmModal = document.getElementById('passwordConfirmModal');
    const deletePasswordInput = document.getElementById('deletePasswordInput');
    const confirmDeleteButton = document.getElementById('confirmDeleteButton');
    const cancelDeleteButton = document.getElementById('cancelDeleteButton');
    const togglePasswordVisibilityButton = document.getElementById('togglePasswordVisibility');

    let currentDeleteFormId = null;

    function showPasswordConfirmModal(formId) {
        if (!passwordConfirmModal || !deletePasswordInput) {
            console.warn('Password modal elements not found');
            return;
        }
        currentDeleteFormId = formId;
        deletePasswordInput.value = ''; // Clear any previous input
        passwordConfirmModal.classList.remove('hidden');
        // Reset password field to type 'password' and eye icon to 'fa-eye'
        deletePasswordInput.type = 'password';
        const toggleButton = document.getElementById('togglePasswordVisibility');
        if (toggleButton) {
            toggleButton.querySelector('i').classList.remove('fa-eye-slash');
            toggleButton.querySelector('i').classList.add('fa-eye');
        }
    }

    function hidePasswordConfirmModal() {
        if (passwordConfirmModal) {
            passwordConfirmModal.classList.add('hidden');
        }
        currentDeleteFormId = null;
    }

    // Only add event listeners if elements exist
    if (cancelDeleteButton) {
        cancelDeleteButton.addEventListener('click', () => {
            hidePasswordConfirmModal();
        });
    }

    if (togglePasswordVisibilityButton) {
        togglePasswordVisibilityButton.addEventListener('click', () => {
            if (!deletePasswordInput) return;
            const type = deletePasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            deletePasswordInput.setAttribute('type', type);
            // Toggle the eye icon
            togglePasswordVisibilityButton.querySelector('i').classList.toggle('fa-eye');
            togglePasswordVisibilityButton.querySelector('i').classList.toggle('fa-eye-slash');
        });
    }

    if (confirmDeleteButton) {
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
    }
});