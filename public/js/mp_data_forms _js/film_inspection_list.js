import { supabase } from '../../supabase-config.js';

document.addEventListener('DOMContentLoaded', async () => {
    const tableBody = document.querySelector('#filmInspectionListTableBody');

    async function fetchFilmInspectionForms() {
        const { data, error } = await supabase
            .from('168_16cp_kranti')
            .select('form_id, lot_no, production_order, product_code, specification, inspection_date, machine_no, prepared_by, production_date, created_at')
            .order('created_at', { ascending: false });

        // No need to fetch user names since prepared_by now stores full names directly

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
            // Serial number based on creation order: latest entry gets highest number
            const serialNumber = data.length - index;
            row.innerHTML = `
                <td class="py-2 px-4 border-b border-r text-center">${serialNumber}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.production_date ? new Date(formData.production_date).toLocaleDateString('en-GB') : ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.inspection_date ? new Date(formData.inspection_date).toLocaleDateString('en-GB') : ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.machine_no || ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.product_code || ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.specification || ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.lot_no || ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">
                    ${formData.prepared_by || ''}
                </td>
                <td class="py-2 px-4 border-b border-r text-center">-</td>
                <td class="py-2 px-4 border-b border-r text-center">
                    <div class="flex justify-center space-x-1 flex-nowrap max-w-full overflow-hidden">
                        <!-- Sky blue Enter Data button -->
                        <button class="p-1 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-600 hover:text-sky-800 transition-all duration-200 border border-sky-200 hover:border-sky-300 flex-shrink-0 view-film-form-button" data-id="${formData.form_id}" title="Add Details">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                            </svg>
                        </button>
                        <!-- Purple Edit Details button -->
                        <button class="p-1 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-600 hover:text-purple-800 transition-all duration-200 border border-purple-200 hover:border-purple-300 flex-shrink-0 edit-details-button" data-id="${formData.form_id}" title="Edit Form Details">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            </svg>
                        </button>
                        <!-- Green Edit button - now opens prestore form -->
                        <button onclick="openPrestoreForm('${formData.lot_no}', '${formData.product_code}', '${formData.production_order}', '${formData.form_id}')" class="p-1 rounded-md bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-800 transition-all duration-200 border border-green-200 hover:border-green-300 flex-shrink-0" title="Edit Pre-store">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                        </button>
                        <!-- Dark blue View button -->
                        <button onclick="viewFilmForm('${formData.form_id}', '${formData.lot_no}', '${formData.product_code}')" class="p-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 hover:text-blue-900 transition-all duration-200 border border-blue-200 hover:border-blue-300 flex-shrink-0" title="View">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                            </svg>
                        </button>
                        <!-- Red Delete button -->
                        <button class="p-1 rounded-md bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 transition-all duration-200 border border-red-200 hover:border-red-300 flex-shrink-0 delete-button" data-id="${formData.form_id}" title="Delete Film Inspection Form">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                </td>
                <td class="py-2 px-4 border-b border-r text-center">
                                            <button onclick="download16GSMKrantiExcel('${formData.form_id}', '${formData.lot_no}', this)" class="p-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-800 transition-all duration-200 border border-indigo-200 hover:border-indigo-300 flex-shrink-0" title="Download Excel">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <div class="flex items-center space-x-1 justify-center flex-nowrap">
                        <button class="bg-blue-500 text-white p-1 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
                            <i class="fas fa-plus text-sm"></i>
                        </button>
                        <button class="bg-green-500 text-white p-1 rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50">
                            <i class="fas fa-edit text-sm"></i>
                        </button>
                        <button class="bg-blue-700 text-white p-1 rounded-md hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-opacity-50">
                            <i class="fas fa-eye text-sm"></i>
                        </button>
                        <button class="bg-red-500 text-white p-1 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 delete-button" data-id="${formData.form_id}">
                            <i class="fas fa-trash text-sm"></i>
                        </button>
                    </div>
                </td>
            `;
        });
    }

    fetchFilmInspectionForms();

    // Function to pre-populate prestore form modal
    function prePopulatePrestoreForm(data) {
        
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
            'prestore_ref_no': 'ref-no-modal', // Only prestore_ref_no should map to ref-no-modal
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
        const radioFields = ['pallet_list', 'product_label', 'wrapping', 'layer_pad', 'contamination', 'kraft_paper', 'no_damage', 'pallet'];
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
        // Store the film inspection data in session storage immediately (fast)
        const prestoreData = {
            lot_no: lotNo,
            product_code: productCode,
            production_order: productionOrder,
            form_id: formId,
            source: 'film_inspection'
        };
        sessionStorage.setItem('prestoreFormData', JSON.stringify(prestoreData));
        
        // Fetch prestore_ref_no in background (non-blocking)
        fetchPrestoreRefNo(formId);
        
        // Store form_id globally for the modal to use
        window.currentPrestoreFormId = formId;
        
        // Open the prestore form modal immediately
        const preStoreFormOverlay = document.getElementById('preStoreFormOverlay');
        if (preStoreFormOverlay) {
            preStoreFormOverlay.classList.remove('hidden');
            
            // Populate with basic data immediately (fast)
            prePopulatePrestoreForm(prestoreData);
            
            // Do all heavy operations in background (non-blocking)
            setupPrestoreModalInBackground(formId, lotNo);
        }
    };
    
    // Function to fetch prestore_ref_no in background
    async function fetchPrestoreRefNo(formId) {
        try {
            const { data: formData, error } = await supabase
                .from('168_16cp_kranti')
                .select('prestore_ref_no')
                .eq('form_id', formId)
                .single();
            
            if (error) throw error;
            
            // Update the reference number field if it exists
            if (formData.prestore_ref_no) {
                const refNoField = document.getElementById('ref-no-modal');
                if (refNoField) {
                    refNoField.value = formData.prestore_ref_no;
                }
            }
            
        } catch (error) {
            console.error('Error fetching prestore_ref_no:', error);
        }
    }
    
    // Function to setup prestore modal in background (non-blocking)
    async function setupPrestoreModalInBackground(formId, lotNo) {
        try {
            // Setup auto-suggestion for prestore done by field
            await setupPrestoreDoneByAutoSuggestion();
            
            // Try to fetch full data from database using form_id or lot_no
            if (formId) {
                try {
                    const { data, error } = await supabase
                        .from('168_16cp_kranti')
                        .select('*')
                        .eq('form_id', formId)
                        .single();
                    
                    if (data && !error) {
                        prePopulatePrestoreForm(data);
                    } else if (lotNo) {
                        // Fallback to lot_no search
                            const { data: lotData, error: lotError } = await supabase
                                .from('168_16cp_kranti')
                                .select('*')
                                .eq('lot_no', lotNo)
                                .single();
                            
                            if (lotData && !lotError) {
                                prePopulatePrestoreForm(lotData);
                        }
                    }
                } catch (error) {
                    console.error('Error loading existing data:', error);
                }
            } else if (lotNo) {
                try {
                    const { data, error } = await supabase
                        .from('168_16cp_kranti')
                        .select('*')
                        .eq('lot_no', lotNo)
                        .single();
                    
                    if (data && !error) {
                        prePopulatePrestoreForm(data);
                    }
                } catch (error) {
                    console.error('Error loading existing data:', error);
                }
            }
        } catch (error) {
            console.error('Error in background setup:', error);
        }
    }
    
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
            
            const submitButton = preStoreFormModal.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            
            // Show loading state
            submitButton.textContent = 'Saving...';
            submitButton.disabled = true;
            
            const formData = new FormData(preStoreFormModal);
            const preStoreFormData = {
                production_order: formData.get('production_order'),
                product_code: formData.get('product-code'),
                quantity: formData.get('quantity'),
                customer: formData.get('customer'),
                location: formData.get('location'),
                specification: formData.get('specification'),
                batch: formData.get('batch'),
                prestore_ref_no: formData.get('ref_no'),
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
                no_damage: formData.get('no-damage'),
                pallet: formData.get('pallet'),
                prestore_done_by: formData.get('prestore_done_by'),
                remarks: formData.get('remarks'),
            };

            // Keep lot_no as entered by user (no automatic prefix)

            // Try to get the logged-in user's email (optional - don't block if it fails)
            try {
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError) {
                    console.warn('Could not fetch user info:', userError.message);
                    preStoreFormData.prepared_by = 'Unknown User';
                } else if (user && user.id) {
                    // Fetch user's full name from users table
                    const { data: profile, error: profileError } = await supabase
                        .from('users')
                        .select('full_name')
                        .eq('id', user.id)
                        .single();
                    
                    if (profileError) {
                        console.warn('Error fetching user profile:', profileError.message);
                        preStoreFormData.prepared_by = user.email || 'Unknown User';
                    } else if (profile && profile.full_name) {
                        preStoreFormData.prepared_by = profile.full_name;
                } else {
                        preStoreFormData.prepared_by = user.email || 'Unknown User';
                    }
                } else {
                    preStoreFormData.prepared_by = 'Unknown User';
                }
            } catch (error) {
                console.warn('Authentication error, continuing without user info:', error);
                preStoreFormData.prepared_by = 'Unknown User';
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
                // Update existing record using form_id (DO NOT update prepared_by to preserve original author)
                const updateData = { ...preStoreFormData };
                delete updateData.prepared_by; // Remove prepared_by from update to preserve original author
                
                const { error: updateError } = await supabase
                    .from(tableName)
                    .update(updateData)
                    .eq('form_id', window.currentPrestoreFormId);
                error = updateError;
            } else {
                // Insert new record (prepared_by is set for new records)
                const { error: insertError } = await supabase
                    .from(tableName)
                    .insert([preStoreFormData]);
                error = insertError;
            }

            if (error) {
                console.error('Error saving prestore data:', error.message);
                alert('Error saving data: ' + error.message);
                
                // Reset button state on error
                submitButton.textContent = originalButtonText;
                submitButton.disabled = false;
            } else {
                // Show success state
                submitButton.textContent = 'Saved!';
                submitButton.style.backgroundColor = '#10B981'; // Green
                
                // Close modal and clean up after a short delay
                setTimeout(() => {
                preStoreFormModal.reset();
                preStoreFormOverlay.classList.add('hidden');
                sessionStorage.removeItem('prestoreFormData');
                }, 500);
            }
        });
    }

    // Function to open Edit Film Inspection Form modal with populated data
    function openEditFilmInspectionFormModal(data) {
        const modal = document.getElementById('editFilmInspectionFormOverlay');
        const form = document.getElementById('editFilmInspectionForm');
        
        if (!modal || !form) {
            console.error('Edit modal or form not found');
            return;
        }
        
        // Populate form fields with table data (fast, no database call)
        if (data.productCode) {
            form.querySelector('input[name="product_code"]').value = data.productCode;
        }
        if (data.specification) {
            form.querySelector('input[name="specification"]').value = data.specification;
        }
        if (data.productionDate) {
            // Convert DD/MM/YYYY to YYYY-MM-DD for date input
            const dateParts = data.productionDate.split('/');
            if (dateParts.length === 3) {
                const formattedDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
                form.querySelector('input[name="production_date"]').value = formattedDate;
            }
        }
        if (data.inspectionDate) {
            // Convert DD/MM/YYYY to YYYY-MM-DD for date input
            const dateParts = data.inspectionDate.split('/');
            if (dateParts.length === 3) {
                const formattedDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
                form.querySelector('input[name="inspection_date"]').value = formattedDate;
            }
        }
        if (data.machineNo) {
            form.querySelector('select[name="machine_no"]').value = data.machineNo;
        }
        
        // Set form ID for update
        form.setAttribute('data-form-id', data.formId);
        
        // Show the modal immediately
        modal.classList.remove('hidden');
        
        // Fetch additional data from database in background (async, non-blocking)
        fetchAdditionalFormData(data.formId, form);
    }
    
    // Function to fetch additional form data in background
    async function fetchAdditionalFormData(formId, form) {
        try {
            const { data: formData, error } = await supabase
                .from('168_16cp_kranti')
                .select('customer, production_order, film_insp_form_ref_no')
                .eq('form_id', formId)
                .single();
            
            if (error) throw error;
            
            // Update fields that weren't available in table data
            if (formData.customer) {
                form.querySelector('input[name="customer"]').value = formData.customer;
            }
            if (formData.production_order) {
                form.querySelector('input[name="production_order"]').value = formData.production_order;
            }
            if (formData.film_insp_form_ref_no) {
                form.querySelector('input[name="ref_no"]').value = formData.film_insp_form_ref_no;
            }
            
        } catch (error) {
            console.error('Error fetching additional form data:', error);
        }
    }

    // Function to close and reset edit modal
    function closeEditFilmInspectionModal() {
        const modal = document.getElementById('editFilmInspectionFormOverlay');
        const form = document.getElementById('editFilmInspectionForm');
        
        if (modal) {
            modal.classList.add('hidden');
        }
        if (form) {
            form.reset();
            form.removeAttribute('data-form-id');
        }
    }

    // Add event listener for edit buttons
    tableBody.addEventListener('click', (event) => {
        const viewFilmFormButton = event.target.closest('.view-film-form-button');
        if (viewFilmFormButton) {
            const formId = viewFilmFormButton.dataset.id;
            const lotNo = viewFilmFormButton.closest('tr').querySelector('td:nth-child(7)').textContent; // Get lot_no from the row (updated column position)
            const productCode = viewFilmFormButton.closest('tr').querySelector('td:nth-child(5)').textContent; // Get product_code from the row (updated column position)
            
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

        const editDetailsButton = event.target.closest('.edit-details-button');
        if (editDetailsButton) {
            const formId = editDetailsButton.dataset.id;
            const row = editDetailsButton.closest('tr');
            
            // Extract data from the table row
            const productionDate = row.querySelector('td:nth-child(2)').textContent.trim();
            const inspectionDate = row.querySelector('td:nth-child(3)').textContent.trim();
            const machineNo = row.querySelector('td:nth-child(4)').textContent.trim();
            const productCode = row.querySelector('td:nth-child(5)').textContent.trim();
            const specification = row.querySelector('td:nth-child(6)').textContent.trim();
            const lotNo = row.querySelector('td:nth-child(7)').textContent.trim();
            const preparedBy = row.querySelector('td:nth-child(8)').textContent.trim();
            
            // Open the Edit Film Inspection Form Details modal with populated data
            openEditFilmInspectionFormModal({
                formId: formId,
                productionDate: productionDate,
                inspectionDate: inspectionDate,
                machineNo: machineNo,
                productCode: productCode,
                specification: specification,
                lotNo: lotNo,
                preparedBy: preparedBy
            });
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

    // Function to download 16 GSM Kranti Excel file
    window.download16GSMKrantiExcel = async function(formId, lotNo, buttonElement) {
        // Store original button state immediately
        const downloadBtn = buttonElement || event.target;
        const originalContent = downloadBtn.innerHTML;
        const originalTitle = downloadBtn.title;
        const originalDisabled = downloadBtn.disabled;
        
        try {
            console.log('Downloading 16 GSM Kranti Excel for form_id:', formId, 'lot_no:', lotNo);
            
            // Validate formId
            if (!formId || formId === 'undefined' || formId === 'null') {
                alert('Error: Form ID is missing. Cannot download Excel file.');
                console.error('Form ID is missing or invalid:', formId);
                return;
            }
            
            // Show loading state
            if (downloadBtn) {
                downloadBtn.innerHTML = '⏳ Generating Excel...';
                downloadBtn.title = 'Generating Excel file...';
                downloadBtn.disabled = true;
            }
            
            // Show progress indicator
            showProgressIndicator('Fetching data...');
            
            // Call the Node.js export server with specific form parameters
            // Use localhost for IDE testing, Render URL for production
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const backendUrl = isLocalhost ? 'http://localhost:3000' : 'https://swanson-backend.onrender.com';
            const downloadUrl = `${backendUrl}/export-168-16cp-kranti-form?form_id=${encodeURIComponent(formId)}`;

            // Add timeout for slow connections
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 minute timeout

            // Start countdown after showing "Fetching data..."
            startCountdown();
            
            // Wait for countdown to complete (5 seconds) before making the request
            await new Promise(resolve => setTimeout(resolve, 5000));

            const response = await fetch(downloadUrl, {
                method: 'GET',
                signal: controller.signal,
                credentials: 'include',
                headers: {
                    'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                }
            });

            clearTimeout(timeoutId);

                    if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const blob = await response.blob();
            
            updateProgressIndicator('Preparing download...');
            
            // Create download link
                    const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            
            // Generate filename using lot_no
            const filename = lotNo ? `APE-168(16)CP(KRANTI)-${lotNo}.xlsx` : `APE-168(16)CP(KRANTI)-${formId}.xlsx`;
            a.download = filename;
            
            document.body.appendChild(a);
            a.click();
                    window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            // Success message
            showSuccessMessage('Excel file downloaded successfully!');
            
            console.log('Excel file downloaded successfully');
            
        } catch (error) {
            console.error('Download failed:', error);
            
            if (error.name === 'AbortError') {
                showErrorMessage('Request timed out. Please try again or check your internet connection.');
            } else {
                showErrorMessage('Failed to download Excel file. Please try again.');
            }
        } finally {
            // Reset button state completely
            if (downloadBtn) {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }
            
            hideProgressIndicator();
        }
    };

    // ===== LOADING UI FUNCTIONS (from inline form) =====
    
    // Progress indicator functions
    let progressDiv = null;
    let countdownInterval = null;
    
    function showProgressIndicator(message) {
        if (progressDiv) {
            progressDiv.remove();
        }
        
        progressDiv = document.createElement('div');
        progressDiv.id = 'progressIndicator';
        progressDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 255, 255, 0.95);
            padding: 20px;
            border-radius: 12px;
            z-index: 9999;
            text-align: center;
            min-width: 280px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            border: 1px solid rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
        `;
        document.body.appendChild(progressDiv);
        updateProgressIndicator(message);
    }
    
    function updateProgressIndicator(message) {
        if (!progressDiv) return;
        
        progressDiv.innerHTML = `
            <div style="margin-bottom: 15px;">
                <div style="font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #002E7D;">Downloading...</div>
                <div class="spinner" style="
                    border: 2px solid rgba(0,46,125,0.3);
                    border-top: 2px solid #002E7D;
                    border-radius: 50%;
                    width: 35px;
                    height: 35px;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 15px;
                "></div>
                <div id="countdown-message" style="font-size: 13px; opacity: 0.8; margin-bottom: 15px; color: #666;">${message}</div>
                <div class="diagonal-progress" style="
                    height: 5px;
                    background: repeating-linear-gradient(
                        45deg,
                        #002E7D 0px,
                        #002E7D 6px,
                        #1e40af 6px,
                        #1e40af 12px,
                        transparent 12px,
                        transparent 18px
                    );
                    margin-top: 20px;
                    border-radius: 3px;
                    border: 1px solid #002E7D;
                    animation: diagonalMove 1.5s linear infinite;
                "></div>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes diagonalMove {
                    0% { background-position: 0px 0px; }
                    100% { background-position: 40px 0px; }
                }
            </style>
        `;
    }
    
    function hideProgressIndicator() {
        if (progressDiv) {
            progressDiv.remove();
            progressDiv = null;
        }
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    }
    
    function startCountdown() {
        let countdown = 5;
        const countdownElement = document.getElementById('countdown-message');
        
        if (countdownElement) {
            countdownElement.textContent = `Starting download in ${countdown} seconds...`;
        }
        
        countdownInterval = setInterval(() => {
            countdown--;
            if (countdownElement) {
                countdownElement.textContent = `Starting download in ${countdown} seconds...`;
            }
            
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
        }, 1000);
    }
    
    function showSuccessMessage(message) {
        // Hide progress indicator first
        hideProgressIndicator();
        
        // Show standalone success notification (same as inline form)
        showMessage(message, 'success');
    }
    
    function showErrorMessage(message) {
        // Hide progress indicator first
        hideProgressIndicator();
        
        // Show standalone error notification (same as inline form)
        showMessage(message, 'error');
    }
    
    // Standalone notification function (same as inline form)
    function showMessage(message, type) {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            z-index: 10000;
            font-weight: bold;
            ${type === 'success' ? 'background: #28a745;' : 'background: #dc3545;'}
        `;
        messageDiv.textContent = message;
        document.body.appendChild(messageDiv);
        
            setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }

    // Set up edit modal event listeners
    setTimeout(() => {
        const closeEditBtn = document.getElementById('closeEditFilmInspectionFormOverlay');
        const clearEditBtn = document.getElementById('clearEditFilmInspectionForm');
        const editModal = document.getElementById('editFilmInspectionFormOverlay');
        const editForm = document.getElementById('editFilmInspectionForm');
        
        
        if (closeEditBtn) {
            closeEditBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                closeEditFilmInspectionModal();
            };
        }
        
        if (clearEditBtn) {
            clearEditBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (editForm) {
                    editForm.reset();
                    editForm.removeAttribute('data-form-id');
                }
            };
        }
        
        if (editModal) {
            editModal.onclick = function(e) {
                if (e.target === editModal) {
                    e.preventDefault();
                    e.stopPropagation();
                    closeEditFilmInspectionModal();
                }
            };
        }
        
        if (editForm) {
            editForm.addEventListener('submit', async function(event) {
                event.preventDefault();
                
                const formData = new FormData(editForm);
                const formId = editForm.getAttribute('data-form-id');
                const submitButton = editForm.querySelector('button[type="submit"]');
                
                if (!formId) {
                    alert('Form ID not found. Please try again.');
                    return;
                }
                
                // Show loading state
                const originalButtonText = submitButton.textContent;
                submitButton.textContent = 'Updating...';
                submitButton.disabled = true;
                
                try {
                    // Update existing form (DO NOT update prepared_by to preserve original author)
                    const updateData = {
                        product_code: formData.get('product_code'),
                        customer: formData.get('customer'),
                        specification: formData.get('specification'),
                        production_date: formData.get('production_date'),
                        inspection_date: formData.get('inspection_date'),
                        machine_no: formData.get('machine_no'),
                        production_order: formData.get('production_order'),
                        film_insp_form_ref_no: formData.get('ref_no')
                        // prepared_by is intentionally excluded to preserve original author
                    };
                    
                    const { error } = await supabase
                        .from('168_16cp_kranti')
                        .update(updateData)
                        .eq('form_id', formId);
                    
                    if (error) throw error;
                    
                    // Show success state
                    submitButton.textContent = 'Updated!';
                    submitButton.style.backgroundColor = '#10B981'; // Green
                    
                    // Close modal and refresh the list after a short delay
                    setTimeout(async () => {
                        closeEditFilmInspectionModal();
                        await fetchFilmInspectionForms();
                    }, 500);
                    
                } catch (error) {
                    console.error('Error updating form:', error);
                    alert('Error updating form: ' + error.message);
                    
                    // Reset button state
                    submitButton.textContent = originalButtonText;
                    submitButton.disabled = false;
                    submitButton.style.backgroundColor = '';
                }
            });
        }
    }, 1000);
});

// Global function to handle View button click - navigate to form in view-only mode
window.viewFilmForm = function(formId, lotNo, productCode) {
    // Store form data in sessionStorage with view mode flag
    sessionStorage.setItem('currentFormId', formId);
    sessionStorage.setItem('currentLotNo', lotNo);
    sessionStorage.setItem('currentProductCode', productCode);
    sessionStorage.setItem('viewMode', 'true');
    
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
    
    // Navigate to the form with view mode parameter
    window.location.href = targetForm + '?mode=view';
};