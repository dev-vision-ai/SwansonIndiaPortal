import { supabase } from '../../supabase-config.js';

// IMMEDIATE PROTECTION: Prevent customer field from being converted to dropdown
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded - setting up customer field protection...');
    
    // Set up immediate protection
    const protectCustomerField = () => {
        const customerField = document.getElementById('customer');
        if (customerField && customerField.tagName !== 'INPUT') {
            console.warn('Customer field was already a dropdown! Converting to input...');
            const newInput = document.createElement('input');
            newInput.type = 'text';
            newInput.id = 'customer';
            newInput.name = 'customer';
            newInput.className = 'mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#002E7D] focus:border-[#002E7D] sm:text-sm bg-gray-50';
            newInput.placeholder = 'Customer will auto-fill';
            newInput.readOnly = true;
            
            customerField.parentNode.replaceChild(newInput, customerField);
            console.log('Customer field converted to input on page load');
        }
    };
    
    // Run immediately
    protectCustomerField();
    
    // Also run after a short delay to catch any late conversions
    setTimeout(protectCustomerField, 100);
    setTimeout(protectCustomerField, 500);
    setTimeout(protectCustomerField, 1000);
    
    console.log('Customer field protection setup complete');
});

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const formId = urlParams.get('id');

    // Modal controls
    const createFormBtn = document.getElementById('showFilmInspectionFormOverlay');
    const overlay = document.getElementById('filmInspectionFormOverlay');
    const closeBtn = document.getElementById('closeFilmInspectionFormOverlay');
    const clearFormBtn = document.getElementById('clearFilmInspectionForm');
    const form = document.getElementById('filmInspectionForm');
    const productCodeInput = document.getElementById('product_code');
    const productSuggestions = document.getElementById('productSuggestions');
    let allProducts = []; // Store all products for autocomplete

    // Function to close modal
    function closeModal() {
        if (overlay) {
            overlay.style.display = 'none';
        }
        if (form) {
            form.reset();
        }
        // Hide suggestions when modal closes
        if (productSuggestions) {
            productSuggestions.classList.add('hidden');
        }
    }

    // Function to clear form
    function clearForm() {
        if (form) {
            form.reset();
        }
    }

    // Setup modal controls
    if (createFormBtn) {
        createFormBtn.addEventListener('click', function() {
            if (form) {
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.textContent = 'Create Film Inspection Form';
                form.onsubmit = null; // Reset to default handler
            }
            overlay.style.display = 'flex';
            loadProducts(); // Load products when modal opens
        });
    }

    // Close button functionality
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            closeModal();
        });
    }

    // Cancel button functionality
    if (clearFormBtn) {
        clearFormBtn.addEventListener('click', function() {
            clearForm();
        });
    }

    // ESC key functionality
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && overlay && overlay.style.display === 'flex') {
            closeModal();
        }
    });

    // Function to load products from fif_products_master table
    async function loadProducts() {
        try {
            console.log('Loading products from fif_products_master...');
            
            // First, let's see what columns actually exist
            const { data: tableInfo, error: tableError } = await supabase
                .from('fif_products_master')
                .select('*')
                .limit(1);
                
            if (tableError) {
                console.error('Table access error:', tableError.message);
                return;
            }
            
            console.log('Table structure sample:', tableInfo);
            
            // Now try to load products with proper error handling
            const { data: products, error } = await supabase
                .from('fif_products_master')
                .select('*')
                .order('prod_code');

            if (error) {
                console.error('Error fetching products:', error.message);
                console.error('Full error:', error);
                return;
            }

            console.log('Products loaded:', products);

            // Store all products for autocomplete
            allProducts = products;

            console.log('Products stored for autocomplete');

        } catch (error) {
            console.error('Error loading products:', error);
        }
    }



    // Function to load specification based on selected product
    async function loadSpecification(selectedProduct) {
        const specificationInput = document.getElementById('specification');
        
        if (!selectedProduct || !specificationInput) {
            return;
        }

        try {
            console.log('Loading specification for product:', selectedProduct);
            const { data: product, error } = await supabase
                .from('fif_products_master')
                .select('spec')
                .eq('prod_code', selectedProduct)
                .single();

            if (error) {
                console.error('Error fetching specification:', error.message);
                return;
            }

            if (product && product.spec) {
                console.log('Specification loaded:', product.spec);
                specificationInput.value = product.spec;
            }

        } catch (error) {
            console.error('Error loading specification:', error);
        }
    }

    // Function to load customer based on selected product
    async function loadCustomerForProduct(selectedProduct) {
        const customerInput = document.getElementById('customer');
        
        if (!selectedProduct || !customerInput) {
            return;
        }

        try {
            console.log('Loading customer for product:', selectedProduct);
            const { data: product, error } = await supabase
                .from('fif_products_master')
                .select('customer')
                .eq('prod_code', selectedProduct)
                .single();

            if (error) {
                console.error('Error fetching customer:', error.message);
                return;
            }

            if (product && product.customer) {
                console.log('Customer loaded:', product.customer);
                customerInput.value = product.customer;
                
                // FORCE the field to stay as input and prevent conversion to dropdown
                if (customerInput.tagName !== 'INPUT') {
                    console.error('Customer field was converted to dropdown! Forcing back to input...');
                    const newInput = document.createElement('input');
                    newInput.type = 'text';
                    newInput.id = 'customer';
                    newInput.name = 'customer';
                    newInput.className = 'mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#002E7D] focus:border-[#002E7D] sm:text-sm bg-gray-50';
                    newInput.placeholder = 'Customer will auto-fill';
                    newInput.readOnly = true;
                    newInput.value = product.customer;
                    
                    customerInput.parentNode.replaceChild(newInput, customerInput);
                    console.log('Customer field forced back to input type');
                }
                
                // ADD PROTECTION: Set up a mutation observer to prevent future conversions
                if (!window.customerFieldProtected) {
                    window.customerFieldProtected = true;
                    
                    // Watch for any changes to the customer field
                    const observer = new MutationObserver(function(mutations) {
                        mutations.forEach(function(mutation) {
                            if (mutation.type === 'childList') {
                                const customerField = document.getElementById('customer');
                                if (customerField && customerField.tagName !== 'INPUT') {
                                    console.warn('Customer field being converted again! Re-protecting...');
                                    // Force it back to input
                                    const newInput = document.createElement('input');
                                    newInput.type = 'text';
                                    newInput.id = 'customer';
                                    newInput.name = 'customer';
                                    newInput.className = 'mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#002E7D] focus:border-[#002E7D] sm:text-sm bg-gray-50';
                                    newInput.placeholder = 'Customer will auto-fill';
                                    newInput.readOnly = true;
                                    newInput.value = product.customer;
                                    
                                    customerField.parentNode.replaceChild(newInput, customerField);
                                }
                            }
                        });
                    });
                    
                    // Start observing the customer field
                    const customerField = document.getElementById('customer');
                    if (customerField) {
                        observer.observe(customerField.parentNode, { childList: true, subtree: true });
                        console.log('Customer field protection activated!');
                    }
                }
            }

        } catch (error) {
            console.error('Error loading customer:', error);
        }
    }

    // Function to show product suggestions
    function showProductSuggestions(searchTerm) {
        if (!productSuggestions || !allProducts.length) return;

        const filteredProducts = allProducts.filter(product => 
            product.prod_code.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (filteredProducts.length === 0) {
            productSuggestions.classList.add('hidden');
            return;
        }

        productSuggestions.innerHTML = '';
        filteredProducts.forEach(product => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'px-3 py-1 hover:bg-blue-200 cursor-pointer text-xs';
            suggestionItem.textContent = product.prod_code;
            suggestionItem.addEventListener('click', () => {
                productCodeInput.value = product.prod_code;
                productSuggestions.classList.add('hidden');
                loadSpecification(product.prod_code);
                loadCustomerForProduct(product.prod_code);
            });
            productSuggestions.appendChild(suggestionItem);
        });

        productSuggestions.classList.remove('hidden');
    }

    // Add event listeners for autocomplete
    if (productCodeInput) {
        productCodeInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value;
            if (searchTerm.length >= 1) {
                showProductSuggestions(searchTerm);
            } else {
                productSuggestions.classList.add('hidden');
            }
            
            // Auto-load customer and specification when product code is manually typed
            if (searchTerm && allProducts.some(p => p.prod_code === searchTerm)) {
                loadSpecification(searchTerm);
                loadCustomerForProduct(searchTerm);
            }
        });

        productCodeInput.addEventListener('focus', (e) => {
            const searchTerm = e.target.value;
            if (searchTerm.length >= 1) {
                showProductSuggestions(searchTerm);
            }
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!productCodeInput.contains(e.target) && !productSuggestions.contains(e.target)) {
                productSuggestions.classList.add('hidden');
            }
        });
    }

    // Load products when modal opens
    if (createFormBtn) {
        createFormBtn.addEventListener('click', function() {
            if (form) {
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.textContent = 'Create Film Inspection Form';
                form.onsubmit = null; // Reset to default handler
            }
            overlay.style.display = 'flex';
            loadProducts(); // Load products when modal opens
        });
    }

    if (formId) {
        // Fetch existing data for the form
        const { data, error } = await supabase
            .from('prestore_and_film_inspection_form')
            .select('*')
            .eq('id', formId)
            .single();

        if (error) {
            console.error('Error fetching form data:', error.message);
            alert('Error loading form data for editing.');
            return;
        }

        if (data) {
            // Populate form fields with fetched data
            for (const key in data) {
                const input = document.getElementById(key);
                if (input) {
                    input.value = data[key];
                }
            }
        }
    }

    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            const formData = new FormData(form);
            const data = {};
            for (let [key, value] of formData.entries()) {
                // Only include fields that have actual values (not empty strings)
                if (value && value.trim() !== '') {
                    data[key] = value.trim();
                }
            }
            
            console.log('Form data being submitted:', data);

            // Validate required fields
            const requiredFields = ['product_code', 'customer', 'specification', 'production_date', 'inspection_date', 'machine_no'];
            const missingFields = requiredFields.filter(field => !data[field]);
            
            if (missingFields.length > 0) {
                alert(`Please fill in all required fields: ${missingFields.join(', ')}`);
                return;
            }

            // Get the logged-in user's full name
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) {
                console.error('Error fetching user:', userError.message);
                alert('Could not retrieve user information. Please try again.');
                return;
            }
            
            // Fetch user's full name from users table
            if (user && user.id) {
                const { data: profile, error: profileError } = await supabase
                    .from('users')
                    .select('full_name')
                    .eq('id', user.id)
                    .single();
                
                if (profileError) {
                    console.error('Error fetching user profile:', profileError.message);
                    data.prepared_by = user.email || 'Unknown User'; // Fallback to email
                } else if (profile && profile.full_name) {
                    data.prepared_by = profile.full_name;
                } else {
                    data.prepared_by = user.email || 'Unknown User'; // Fallback to email
                }
            } else {
                data.prepared_by = 'Unknown User'; // Fallback if user ID is not available
            }

            // Convert specific fields to numbers if necessary
            // The 'PO' field (now 'purchase_order'), 'Prod. Order' (production_order), and 'Lot. No' (lot_no) are intended to be text.
            // No explicit conversion needed here as they are already strings from formData.get().
            // Convert specific fields to numbers if necessary
            // The 'PO' field (now 'purchase_order') and 'Prod. Order' (production_order) are intended to be numbers.
            // The 'Lot. No' field (lot_no) is also intended to be a number.
            // product_code and machine_no can be strings or numbers, no explicit conversion needed here.
            data.product_code = data.product_code;
            data.machine_no = data.machine_no;

            // Convert quantity to an integer
            if (data.quantity) {
                data.quantity = parseInt(data.quantity);
            }

            // Only include lot_no if it was actually entered by the user
            const lotNo = formData.get('lot_no');
            if (lotNo && lotNo.trim() !== '') {
                data.lot_no = lotNo.trim();
            }

            // Determine the table name based on the selected product
            let tableName = '168_16cp_kranti'; // default table for 16 GSM Kranti products
            
            if (data.product_code) {
                // Map product codes to their specific tables
                const productTableMap = {
                    'APE-168(16)C': '168_16cp_kranti',           // Your current table
                    'APE-168(16)CP(KRANTI)': '168_16cp_kranti'  // Your current table
                    // Add more product-specific tables as they are created
                    // 'WHITE-234(18)': 'white_234_18_table',
                    // 'APE-176(18)CP(LCC+WW)BS': 'ape_176_18_cp_lcc_ww_bs_table',
                    // 'APE-168(18)CP(KRANTI)': 'ape_168_18_cp_kranti_table',
                    // 'APE-168(18)C': 'ape_168_18_c_table',
                    // 'WHITE-214(18)': 'white_214_18_table',
                    // 'APE-102(18)C': 'ape_102_18_c_table',
                    // 'INUE1C18-290NP(AB-QR)': 'inue1c18_290np_ab_qr_table',
                    // 'INUE1C18-250W(BF-QR)': 'inue1c18_250w_bf_qr_table',
                    // 'INUE1C18-250P(AB-QR)': 'inue1c18_250p_ab_qr_table',
                    // 'INUE1C18-210W(BF-QR)': 'inue1c18_210w_bf_qr_table',
                    // 'INUE1C18-290P(AB-QR)': 'inue1c18_290p_ab_qr_table',
                    // 'UWF3-WHITE-214(18)-WW': 'uwf3_white_214_18_ww_table'
                };
                
                tableName = productTableMap[data.product_code] || 'prestore_and_film_inspection_form';
            }
            
            console.log('Selected product:', data.product_code);
            console.log('Target table:', tableName);

            let dbOperation;
            if (formId) {
                // Update existing record
                dbOperation = supabase
                    .from(tableName)
                    .update(data)
                    .eq('id', formId);
            } else {
                // Check for uniqueness before submission (only for new entries and only if lot_no is provided)
                if (data.lot_no) {
                    const { data: existingLots, error: checkError } = await supabase
                        .from(tableName)
                        .select('lot_no')
                        .eq('lot_no', data.lot_no)
                        .limit(1);

                    if (checkError) {
                        console.error('Error checking LOT NO uniqueness:', checkError.message);
                        alert('An error occurred while validating LOT NO. Please try again.');
                        return;
                    }

                    if (existingLots && existingLots.length > 0) {
                        alert('Error: LOT NO already exists. Please enter a unique LOT NO.');
                        return;
                    }
                }

                // Insert new record into the product-specific table
                // Note: Only inserting the basic form fields, not the additional columns
                // that are specific to the default table structure
                
                // Add prestore_forms column with default value (commented out until column is created)
                // data.prestore_forms = 'n-a';

                dbOperation = supabase
                    .from(tableName)
                    .insert([data])
                    .select('*');
            }

            const { data: resultData, error } = await dbOperation;
            if (error) {
                if (error.code === '23505') { // PostgreSQL unique violation error code
                    alert('Error: This LOT NO already exists. Please use a unique LOT NO.');
                } else {
                    console.error('Error inserting data:', error.message);
                    alert('An error occurred during form submission. Please try again.');
                }
                return;
            }
            console.log('Data inserted successfully:', resultData);
            console.log('Type of resultData:', typeof resultData);
            console.log('Length of resultData:', resultData ? resultData.length : 'N/A');
            if (resultData && resultData.length > 0) {
                const dataToStore = resultData[0];
                sessionStorage.setItem('filmInspectionData', JSON.stringify(dataToStore));
                console.log('Data stored in sessionStorage:', dataToStore);
            } else {
                sessionStorage.removeItem('filmInspectionData'); // Clear if no data was inserted
                console.log('No data inserted, sessionStorage cleared.');
            }
            alert(`Film Inspection Form ${formId ? 'updated' : 'submitted'} successfully!`);
            
            // Close modal and refresh the list
            closeModal();
            
            // Refresh the film inspection list
            if (typeof loadFilmInspectionForms === 'function') {
                loadFilmInspectionForms();
            } else {
                // Reload the page to refresh the list
                window.location.reload();
            }
        });
    }
});