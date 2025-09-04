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

        if (data.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="10" class="py-4 text-center text-gray-500">
                        No forms created yet. Click "Create Film Inspection Form" to get started.
                    </td>
                </tr>
            `;
            return;
        }

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
                        <button onclick="openPrestoreForm('${formData.lot_no}', '${formData.product_code}', '${formData.production_order}', '${formData.form_id}')" class="p-1.5 rounded-md bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-800 transition-all duration-200 border border-green-200 hover:border-green-300 flex-shrink-0" title="Edit Pre-store">
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
                        <button class="p-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 transition-all duration-200 border border-red-200 hover:border-red-300 flex-shrink-0 delete-button" data-id="${formData.form_id}" title="Delete Film Inspection Form">
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
                        <button class="bg-red-500 text-white p-2 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 delete-button" data-id="${formData.form_id}">
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
        
        // Map field names from database to prestore form modal IDs
        const fieldMappings = {
            'lot_no': 'lot-no-modal',
            'product_code': 'product-code-modal',
            'production_order': 'production-order-modal',
            'quantity': 'quantity-modal',
            'customer': 'customer-modal',
            'location': 'location-modal',
            'specification': 'specification-modal',
            'batch': 'batch-modal',
            'ref_no': 'ref-no-modal',
            'standard_packing': 'standard-packing-modal',
            'production_date': 'production-date-modal',
            'inspection_date': 'inspection-date-modal',
            'pallet_size': 'pallet-size-modal',
            'machine_no': 'machine-no-modal',
            'purchase_order': 'purchase-order-modal',
            'prestore_done_by': 'prestore-done-by-modal',
            'remarks': 'remarks-modal'
        };
        
        // Populate text inputs and selects
        for (const [key, modalId] of Object.entries(fieldMappings)) {
            const input = document.getElementById(modalId);
            if (input && data[key]) {
                // Special handling for standard_packing field
                if (key === 'standard_packing' && modalId === 'standard-packing-modal') {
                    // Extract number and unit from "54 Rolls / Pallet" format
                    const match = data[key].match(/(\d+)\s+(.+)/);
                    if (match) {
                        const number = match[1];
                        const unit = match[2];
                        input.value = number;
                        
                        // Set the unit dropdown
                        const unitSelect = document.getElementById('standard-packing-unit-modal');
                        if (unitSelect) {
                            unitSelect.value = unit;
                        }
                        
                        console.log(`Populated ${modalId} with number: ${number} and unit: ${unit} from: ${data[key]}`);
                    }
                } else {
                    input.value = data[key];
                    console.log(`Populated ${modalId} with value: ${data[key]}`);
                }
            }
        }
        
        // Handle radio button fields (Accept/Reject/N/A)
        const radioFields = ['pallet_list', 'product_label', 'wrapping', 'layer_pad', 'contamination', 'kraft_paper'];
        radioFields.forEach(field => {
            if (data[field]) {
                // Convert underscore field name to hyphen for HTML name attribute
                const htmlFieldName = field.replace(/_/g, '-');
                const radioButton = document.querySelector(`input[name="${htmlFieldName}"][value="${data[field]}"]`);
                if (radioButton) {
                    radioButton.checked = true;
                    console.log(`Selected radio button ${htmlFieldName}: ${data[field]}`);
                } else {
                    console.log(`Radio button not found: name="${htmlFieldName}" value="${data[field]}"`);
                }
            }
        });
        
        // Customer field is now a text input, no need to load dropdown
    }
    
    // Customer field is now a text input, no dropdown loading needed
    
    // Function to load quality users for auto-suggestion
    async function loadQualityUsers() {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('full_name, department')
                .order('full_name');

            if (error) {
                console.error('Error fetching quality users:', error);
                return [];
            }

            // Filter for Quality Control and Quality Assurance departments
            const qualityUsers = (data || []).filter(user => {
                if (!user.department || !user.full_name) return false;
                const dept = user.department.toLowerCase();
                return dept.includes('quality control') || dept.includes('quality assurance') || 
                       dept.includes('qc') || dept.includes('qa');
            });

            return qualityUsers;
        } catch (error) {
            console.error('Error loading quality users:', error);
            return [];
        }
    }

    // Function to show inspector name suggestions
    function showInspectorSuggestions(searchTerm, suggestionsContainer, inputField) {
        if (!suggestionsContainer || !window.qualityUsers || window.qualityUsers.length === 0) return;

        const filteredUsers = window.qualityUsers.filter(user => 
            user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (filteredUsers.length === 0) {
            suggestionsContainer.classList.add('hidden');
            return;
        }

        suggestionsContainer.innerHTML = '';
        filteredUsers.forEach(user => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'px-4 py-2 hover:bg-blue-200 cursor-pointer text-sm';
            suggestionItem.textContent = user.full_name;
            suggestionItem.addEventListener('click', () => {
                inputField.value = user.full_name;
                suggestionsContainer.classList.add('hidden');
            });
            suggestionsContainer.appendChild(suggestionItem);
        });

        suggestionsContainer.classList.remove('hidden');
    }

    // Function to setup auto-suggestion for prestore done by field
    async function setupPrestoreDoneByAutoSuggestion() {
        const input = document.getElementById('prestore-done-by-modal');
        const suggestionsContainer = document.getElementById('prestoreDoneBySuggestions');
        
        if (!input || !suggestionsContainer) return;

        // Load quality users
        window.qualityUsers = await loadQualityUsers();
        if (window.qualityUsers.length === 0) {
            console.log('No quality users found for auto-suggestion');
            return;
        }

        console.log('Loaded', window.qualityUsers.length, 'quality users for auto-suggestion');

        // Add event listeners for autocomplete
        input.addEventListener('input', (e) => {
            const searchTerm = e.target.value;
            if (searchTerm.length >= 1) {
                showInspectorSuggestions(searchTerm, suggestionsContainer, input);
            } else {
                suggestionsContainer.classList.add('hidden');
            }
        });

        input.addEventListener('focus', (e) => {
            const searchTerm = e.target.value;
            if (searchTerm.length >= 1) {
                showInspectorSuggestions(searchTerm, suggestionsContainer, input);
            }
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !suggestionsContainer.contains(e.target)) {
                suggestionsContainer.classList.add('hidden');
            }
        });
    }
    
    // Function to open prestore form modal with pre-filled data
    window.openPrestoreForm = async function(lotNo, productCode, productionOrder, formId) {
        // Store the film inspection data in session storage
        const prestoreData = {
            lot_no: lotNo,
            product_code: productCode,
            production_order: productionOrder,
            form_id: formId,
            source: 'film_inspection'
        };
        sessionStorage.setItem('prestoreFormData', JSON.stringify(prestoreData));
        
        // Store form_id globally for the modal to use
        window.currentPrestoreFormId = formId;
        
        // Open the prestore form modal
        const preStoreFormOverlay = document.getElementById('preStoreFormOverlay');
        if (preStoreFormOverlay) {
            preStoreFormOverlay.classList.remove('hidden');
            
            // Setup auto-suggestion for prestore done by field
            await setupPrestoreDoneByAutoSuggestion();
            
            // Try to fetch full data from database using form_id or lot_no
            if (formId) {
                try {
                    console.log('Searching for form_id:', formId);
                    const { data, error } = await supabase
                        .from('168_16cp_kranti')
                        .select('*')
                        .eq('form_id', formId)
                        .single();
                    
                    console.log('Database query result by form_id:', { data, error });
                    
                    if (data && !error) {
                        console.log('Loading existing data for prestore form:', data);
                        prePopulatePrestoreForm(data);
                    } else {
                        console.log('No existing data found by form_id, trying lot_no');
                        // Fallback to lot_no search
                        if (lotNo) {
                            const { data: lotData, error: lotError } = await supabase
                                .from('168_16cp_kranti')
                                .select('*')
                                .eq('lot_no', lotNo)
                                .single();
                            
                            if (lotData && !lotError) {
                                console.log('Loading existing data by lot_no:', lotData);
                                prePopulatePrestoreForm(lotData);
                            } else {
                                console.log('No existing data found, using basic data');
                                prePopulatePrestoreForm(prestoreData);
                            }
                        } else {
                            prePopulatePrestoreForm(prestoreData);
                        }
                    }
                } catch (error) {
                    console.error('Error loading existing data:', error);
                    prePopulatePrestoreForm(prestoreData);
                }
            } else if (lotNo) {
                try {
                    console.log('Searching for lot_no:', lotNo);
                    const { data, error } = await supabase
                        .from('168_16cp_kranti')
                        .select('*')
                        .eq('lot_no', lotNo)
                        .single();
                    
                    console.log('Database query result by lot_no:', { data, error });
                    
                    if (data && !error) {
                        console.log('Loading existing data for prestore form:', data);
                        prePopulatePrestoreForm(data);
                    } else {
                        console.log('No existing data found, using basic data');
                        prePopulatePrestoreForm(prestoreData);
                    }
                } catch (error) {
                    console.error('Error loading existing data:', error);
                    prePopulatePrestoreForm(prestoreData);
                }
            } else {
                prePopulatePrestoreForm(prestoreData);
            }
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
                standard_packing: formData.get('standard-packing') ? `${formData.get('standard-packing')} ${formData.get('standard-packing-unit')}` : null,
                production_date: formData.get('production-date'),
                inspection_date: formData.get('inspection-date'),
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
                prestore_done_by: formData.get('prestore_done_by'),
                remarks: formData.get('remarks'),
            };

            // Keep lot_no as entered by user (no automatic prefix)

            // Try to get the logged-in user's email (optional - don't block if it fails)
            try {
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError) {
                    console.warn('Could not fetch user info:', userError.message);
                    preStoreFormData.prepared_by = 'unknown';
                } else if (user && user.id) {
                    preStoreFormData.prepared_by = user.id;
                } else {
                    preStoreFormData.prepared_by = 'unknown';
                }
            } catch (error) {
                console.warn('Authentication error, continuing without user info:', error);
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

            // Update existing record if form_id exists, otherwise insert new
            let error;
            if (window.currentPrestoreFormId) {
                // Update existing record using form_id
                const { error: updateError } = await supabase
                    .from(tableName)
                    .update(preStoreFormData)
                    .eq('form_id', window.currentPrestoreFormId);
                error = updateError;
            } else {
                // Insert new record
                const { error: insertError } = await supabase
                    .from(tableName)
                    .insert([preStoreFormData]);
                error = insertError;
            }

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
            console.log('Delete button clicked for ID:', formId);
            
            // TODO: Uncomment password verification after project completion
            // showPasswordConfirmModal(formId);
            
            // Temporary direct deletion without password (for development)
            if (confirm('Are you sure you want to delete this form? This action cannot be undone.')) {
                deleteFormDirectly(formId);
            }
        }
    });

    // Direct deletion function (temporary for development)
    async function deleteFormDirectly(formId) {
        try {
            const { error } = await supabase
                .from('168_16cp_kranti')
                .delete()
                .eq('form_id', formId);

            if (error) {
                console.error('Error deleting form:', error.message);
                alert('Error deleting form: ' + error.message);
            } else {
                alert('Form deleted successfully!');
                fetchFilmInspectionForms(); // Refresh the list
            }
        } catch (error) {
            console.error('Error deleting form:', error);
            alert('Error deleting form: ' + error.message);
        }
    }

    // TODO: Uncomment password verification after project completion
    /*
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
                // Proceed with deletion from the correct table
                const { error } = await supabase
                    .from('168_16cp_kranti')
                    .delete()
                    .eq('form_id', currentDeleteFormId);

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
    */
});