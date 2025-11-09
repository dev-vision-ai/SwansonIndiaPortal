import { supabase } from '../../supabase-config.js';

document.addEventListener('DOMContentLoaded', async () => {
    const tableBody = document.querySelector('#filmInspectionListTableBody');

    // Pagination state
    let currentPage = 1;
    const itemsPerPage = 10;
    let totalItems = 0;
    let allData = [];
    let filteredData = [];

    // Filter state
    let activeFilters = {
        fromDate: '',
        toDate: '',
        product: '',
        machine: '',
        status: '',
        preparedBy: ''
    };

    // Pagination controls
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const currentPageDisplay = document.getElementById('currentPageDisplay');
    const totalPagesDisplay = document.getElementById('totalPagesDisplay');

    // Filter controls
    const filterFromDate = document.getElementById('filterFromDate');
    const filterToDate = document.getElementById('filterToDate');
    const filterProduct = document.getElementById('filterProduct');
    const filterMachine = document.getElementById('filterMachine');
    const filterStatus = document.getElementById('filterStatus');
    const filterPreparedBy = document.getElementById('filterPreparedBy');
    const clearFilterBtn = document.getElementById('clearFilter');
    const filterStatusIndicator = document.getElementById('filterStatusIndicator');

    // IMMEDIATE PROTECTION: Prevent customer field from being converted to dropdown
    
    // Set up immediate protection
    const protectCustomerField = () => {
        const customerField = document.getElementById('customer');
        if (customerField && customerField.tagName !== 'INPUT') {
            const newInput = document.createElement('input');
            newInput.type = 'text';
            newInput.id = 'customer';
            newInput.name = 'customer';
            newInput.className = 'mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#002E7D] focus:border-[#002E7D] sm:text-sm bg-gray-50';
            newInput.placeholder = 'Customer will auto-fill';
            newInput.readOnly = true;
            
            customerField.parentNode.replaceChild(newInput, customerField);
        }
    };
    
    // Run immediately
    protectCustomerField();
    
    // Also run after a short delay to catch any late conversions
    setTimeout(protectCustomerField, 100);
    setTimeout(protectCustomerField, 500);
    setTimeout(protectCustomerField, 1000);

    async function fetchFilmInspectionForms() {
        try {
            // Fetch data from all tables - INCLUDING CUSTOMER AND OTHER FIELDS
            const [krantiResult, whiteResult, wwResult, jeddahResult, microWhite214Result, uc250pResult, uc290pResult, uc290npResult, uc250wResult, uc210wResult, microWhite234Result, microWhite102Result, white168Result, uc165wResult] = await Promise.all([
                supabase
                    .from('168_16cp_kranti')
                    .select('form_id, production_order, product_code, specification, machine_no, prepared_by, verified_by, production_date, created_at, customer, film_insp_form_ref_no, lot_no, purchase_order, approved_by')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('168_16c_white')
                    .select('form_id, production_order, product_code, specification, machine_no, prepared_by, verified_by, production_date, created_at, customer, film_insp_form_ref_no, lot_no, purchase_order, approved_by')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('176_18cp_ww')
                    .select('form_id, production_order, product_code, specification, machine_no, prepared_by, verified_by, production_date, created_at, customer, film_insp_form_ref_no, lot_no, purchase_order, approved_by')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('168_18c_white_jeddah')
                    .select('form_id, production_order, product_code, specification, machine_no, prepared_by, verified_by, production_date, created_at, customer, film_insp_form_ref_no, lot_no, purchase_order, approved_by')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('214_18_micro_white')
                    .select('form_id, production_order, product_code, specification, machine_no, prepared_by, verified_by, production_date, created_at, customer, film_insp_form_ref_no, lot_no, purchase_order, approved_by')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('uc-18gsm-250p-abqr')
                    .select('form_id, production_order, product_code, specification, machine_no, prepared_by, verified_by, production_date, created_at, customer, film_insp_form_ref_no, lot_no, purchase_order, approved_by')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('uc-18gsm-290p-abqr')
                    .select('form_id, production_order, product_code, specification, machine_no, prepared_by, verified_by, production_date, created_at, customer, film_insp_form_ref_no, lot_no, purchase_order, approved_by')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('uc-18gsm-290np-abqr')
                    .select('form_id, production_order, product_code, specification, machine_no, prepared_by, verified_by, production_date, created_at, customer, film_insp_form_ref_no, lot_no, purchase_order, approved_by')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('uc-18gsm-250w-bfqr')
                    .select('form_id, production_order, product_code, specification, machine_no, prepared_by, verified_by, production_date, created_at, customer, film_insp_form_ref_no, lot_no, purchase_order, approved_by')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('uc-18gsm-210w-bfqr')
                    .select('form_id, production_order, product_code, specification, machine_no, prepared_by, verified_by, production_date, created_at, customer, film_insp_form_ref_no, lot_no, purchase_order, approved_by')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('234_18_micro_white')
                    .select('form_id, production_order, product_code, specification, machine_no, prepared_by, verified_by, production_date, created_at, customer, film_insp_form_ref_no, lot_no, purchase_order, approved_by')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('102_18c_micro_white')
                    .select('form_id, production_order, product_code, specification, machine_no, prepared_by, verified_by, production_date, created_at, customer, film_insp_form_ref_no, lot_no, purchase_order, approved_by')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('168_18c_white')
                    .select('form_id, production_order, product_code, specification, machine_no, prepared_by, verified_by, production_date, created_at, customer, film_insp_form_ref_no, lot_no, purchase_order, approved_by')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('uc-16gsm-165w')
                    .select('form_id, production_order, product_code, specification, machine_no, prepared_by, verified_by, production_date, created_at, customer, film_insp_form_ref_no, lot_no, purchase_order, approved_by')
                    .order('created_at', { ascending: false })
            ]);

            // Check for errors
            if (krantiResult.error) {
                console.error('Error fetching from 168_16cp_kranti:', krantiResult.error.message);
            }
            if (whiteResult.error) {
                console.error('Error fetching from 168_16c_white:', whiteResult.error.message);
            }
            if (wwResult.error) {
                console.error('Error fetching from 176_18cp_ww:', wwResult.error.message);
            }
            if (jeddahResult.error) {
                console.error('Error fetching from 168_18c_white_jeddah:', jeddahResult.error.message);
            }
            if (microWhite214Result.error) {
                console.error('Error fetching from 214_18_micro_white:', microWhite214Result.error.message);
            }
            if (uc250pResult.error) {
                console.error('Error fetching from uc-18gsm-250p-abqr:', uc250pResult.error.message);
            }
            if (uc290pResult.error) {
                console.error('Error fetching from uc-18gsm-290p-abqr:', uc290pResult.error.message);
            }
            if (uc290npResult.error) {
                console.error('Error fetching from uc-18gsm-290np-abqr:', uc290npResult.error.message);
            }
            if (uc250wResult.error) {
                console.error('Error fetching from uc-18gsm-250w-bfqr:', uc250wResult.error.message);
            }
            if (uc210wResult.error) {
                console.error('Error fetching from uc-18gsm-210w-bfqr:', uc210wResult.error.message);
            }
            if (microWhite234Result.error) {
                console.error('Error fetching from 234_18_micro_white:', microWhite234Result.error.message);
            }
            if (microWhite102Result.error) {
                console.error('Error fetching from 102_18c_micro_white:', microWhite102Result.error.message);
            }
            if (white168Result.error) {
                console.error('Error fetching from 168_18c_white:', white168Result.error.message);
            }
            if (uc165wResult.error) {
                console.error('Error fetching from uc-16gsm-165w:', uc165wResult.error.message);
            }

            // Combine data from all tables
            allData = [
                ...(krantiResult.data || []),
                ...(whiteResult.data || []),
                ...(wwResult.data || []),
                ...(jeddahResult.data || []),
                ...(microWhite214Result.data || []),
                ...(uc250pResult.data || []),
                ...(uc290pResult.data || []),
                ...(uc290npResult.data || []),
                ...(uc250wResult.data || []),
                ...(uc210wResult.data || []),
                ...(microWhite234Result.data || []),
                ...(microWhite102Result.data || []),
                ...(white168Result.data || []),
                ...(uc165wResult.data || [])
            ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // Sort by creation date, newest first

            // Lookup MRMP / GCAS / MATERIAL CODE from fif_products_master table
            await lookupGcasMrmpForForms();

            // Apply filters to get filtered data
            applyFilters();
        } catch (error) {
            console.error('Error fetching film inspection forms:', error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="py-4 text-center text-red-500">
                        Error loading forms. Please refresh the page.
                    </td>
                </tr>
            `;
        }
    }

    // Function to lookup MRMP / GCAS / MATERIAL CODE from fif_products_master table
    async function lookupGcasMrmpForForms() {
        try {
            // Get all unique product_codes from the forms
            const uniqueProductCodes = [...new Set(
                allData
                    .filter(form => form.product_code)
                    .map(form => form.product_code)
            )];

            if (uniqueProductCodes.length === 0) {
                console.log('No product codes found to lookup MRMP / GCAS / MATERIAL CODE');
                return;
            }

            // Fetch GCAS/MRMP data from fif_products_master
            const { data: masterData, error } = await supabase
                .from('fif_products_master')
                .select('prod_code, mrmp, gcas, material_code');

            if (error) {
                console.error('Error fetching from fif_products_master:', error.message);
                return;
            }

            // Create a lookup map using only product_code
            const gcasMrmpMap = new Map();
            (masterData || []).forEach(master => {
                // Combine MRMP, GCAS, and MATERIAL CODE as requested (MRMP / GCAS / MATERIAL CODE format)
                const gcasMrmpValue = master.gcas && master.mrmp && master.material_code ? `${master.mrmp} / ${master.gcas} / ${master.material_code}` :
                                    master.gcas && master.mrmp ? `${master.mrmp} / ${master.gcas}` :
                                    master.gcas && master.material_code ? `${master.gcas} / ${master.material_code}` :
                                    master.mrmp && master.material_code ? `${master.mrmp} / ${master.material_code}` :
                                    master.gcas ? master.gcas :
                                    master.mrmp ? master.mrmp :
                                    master.material_code ? master.material_code : '';
                gcasMrmpMap.set(master.prod_code, gcasMrmpValue);
            });

            // Add MRMP / GCAS / MATERIAL CODE to each form data using product_code only
            allData.forEach(form => {
                if (form.product_code) {
                    form.gcas_irms = gcasMrmpMap.get(form.product_code) || '';
                } else {
                    form.gcas_irms = '';
                }
            });

            console.log('MRMP / GCAS / MATERIAL CODE lookup completed for', allData.length, 'forms');

        } catch (error) {
            console.error('Error in lookupGcasIrmsForForms:', error);
        }
    }

    // Function to lookup MRMP / GCAS / MATERIAL CODE for search results
    async function lookupGcasMrmpForSearchResults(searchData) {
        try {
            // Get all unique product_code + specification combinations from the search results
            const uniqueProductSpecs = [...new Set(
                searchData
                    .filter(form => form.product_code && form.specification)
                    .map(form => `${form.product_code}|${form.specification}`)
            )];

            if (uniqueProductSpecs.length === 0) {
                console.log('No product specifications found in search results to lookup MRMP / GCAS / MATERIAL CODE');
                return;
            }

            // Fetch MRMP / GCAS / MATERIAL CODE data from fif_products_master
            const { data: masterData, error } = await supabase
                .from('fif_products_master')
                .select('prod_code, spec, mrmp, gcas, material_code');

            if (error) {
                console.error('Error fetching from fif_products_master for search:', error.message);
                return;
            }

            // Create a lookup map
            const gcasMrmpMap = new Map();
            (masterData || []).forEach(master => {
                const key = master.prod_code;
                // Combine MRMP, GCAS, and MATERIAL CODE as requested (MRMP / GCAS / MATERIAL CODE format)
                const gcasMrmpValue = master.gcas && master.mrmp && master.material_code ? `${master.mrmp} / ${master.gcas} / ${master.material_code}` :
                                    master.gcas && master.mrmp ? `${master.mrmp} / ${master.gcas}` :
                                    master.gcas && master.material_code ? `${master.gcas} / ${master.material_code}` :
                                    master.mrmp && master.material_code ? `${master.mrmp} / ${master.material_code}` :
                                    master.gcas ? master.gcas :
                                    master.mrmp ? master.mrmp :
                                    master.material_code ? master.material_code : '';
                gcasMrmpMap.set(key, gcasMrmpValue);
            });

            // Add MRMP / GCAS / MATERIAL CODE to each search result
            searchData.forEach(form => {
                if (form.product_code) {
                    const key = form.product_code;
                    form.gcas_irms = gcasMrmpMap.get(key) || '';
                } else {
                    form.gcas_irms = '';
                }
            });

            console.log('MRMP / GCAS / MATERIAL CODE lookup completed for search results');

        } catch (error) {
            console.error('Error in lookupGcasIrmsForSearchResults:', error);
        }
    }

    // Pagination functions
    function updatePaginationControls(totalPages) {
        currentPageDisplay.textContent = currentPage;
        totalPagesDisplay.textContent = totalPages;

        // Enable/disable buttons based on current page
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
    }

    function nextPage() {
        if (currentPage < Math.ceil(totalItems / itemsPerPage)) {
            currentPage++;
            displayCurrentPage();
            updatePaginationControls(Math.ceil(totalItems / itemsPerPage));
        }
    }

    function prevPage() {
        if (currentPage > 1) {
            currentPage--;
            displayCurrentPage();
            updatePaginationControls(Math.ceil(totalItems / itemsPerPage));
        }
    }

    // Filter functions
    function applyFilters() {
        filteredData = allData.filter(form => {
            // Date range filter
            if (activeFilters.fromDate && form.production_date) {
                const formDate = new Date(form.production_date);
                const fromDate = new Date(activeFilters.fromDate);
                if (formDate < fromDate) return false;
            }

            if (activeFilters.toDate && form.production_date) {
                const formDate = new Date(form.production_date);
                const toDate = new Date(activeFilters.toDate);
                if (formDate > toDate) return false;
            }

            // Product filter
            if (activeFilters.product && form.product_code !== activeFilters.product) {
                return false;
            }

            // Machine filter
            if (activeFilters.machine && form.machine_no !== activeFilters.machine) {
                return false;
            }

            // Status filter - determine status based on approval
            if (activeFilters.status) {
                const formStatus = form.approved_by ? 'Complete' : 'Pending';
                if (formStatus !== activeFilters.status) {
                    return false;
                }
            }

            // Prepared by filter
            if (activeFilters.preparedBy && form.prepared_by !== activeFilters.preparedBy) {
                return false;
            }

            return true;
        });

        // Update filter status indicator (On/Off style like inline inspection)
        const hasActiveFilters = Object.values(activeFilters).some(value => value !== '');
        if (filterStatusIndicator) {
            if (hasActiveFilters) {
                filterStatusIndicator.textContent = 'On';
                filterStatusIndicator.className = 'px-2 py-1 text-sm font-semibold rounded-full bg-green-200 text-green-700';
            } else {
                filterStatusIndicator.textContent = 'Off';
                filterStatusIndicator.className = 'px-2 py-1 text-sm font-semibold rounded-full bg-gray-200 text-gray-700';
            }
        }

        // Reset to first page when filters change
        currentPage = 1;
        totalItems = filteredData.length;

        // Update pagination and display
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        updatePaginationControls(totalPages);

        displayCurrentPage();
    }

    function displayCurrentPage() {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
        const currentPageData = filteredData.slice(startIndex, endIndex);

        tableBody.innerHTML = '';

        if (currentPageData.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="py-4 text-center text-gray-500">
                        No forms match the current filters.
                    </td>
                </tr>
            `;
            return;
        }

        currentPageData.forEach((formData, index) => {
            const row = tableBody.insertRow();
            // Store all form data in data attributes for instant access
            row.setAttribute('data-customer', formData.customer || '');
            row.setAttribute('data-production-order', formData.production_order || '');
            row.setAttribute('data-film-insp-form-ref-no', formData.film_insp_form_ref_no || '');
            row.setAttribute('data-lot-no', formData.lot_no || '');
            row.setAttribute('data-specification', formData.specification || '');

            // Serial number based on overall position in filtered dataset: latest entry gets highest number
            const serialNumber = totalItems - (startIndex + index);

            const statusBadge = formData.approved_by ?
                `<span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium inline-block">Complete</span>` :
                `<span class="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-medium inline-block">Pending</span>`;

            row.innerHTML = `
                <td class="py-2 px-4 border-b border-r text-center">${serialNumber}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.production_date ? new Date(formData.production_date).toLocaleDateString('en-GB') : ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.gcas_irms || ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.machine_no || ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.product_code || ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">
                    ${formData.prepared_by || ''}
                </td>
                <td class="py-2 px-4 border-b border-r text-center">
                    ${formData.verified_by ? 
                        `<span class="text-gray-900">${formData.verified_by}</span>` :
                        `<span class="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-medium inline-block">Verification Pending</span>`
                    }
                </td>
                <td class="py-2 px-4 border-b border-r text-center">
                    ${statusBadge}
                </td>
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
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                            </svg>
                        </button>
                        <!-- Green Edit button - now opens prestore form -->
                        <button onclick="openPrestoreForm('${formData.product_code}', '${formData.production_order}', '${formData.form_id}')" class="p-1 rounded-md bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-800 transition-all duration-200 border border-green-200 hover:border-green-300 flex-shrink-0" title="Edit Pre-store">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                        </button>
                        <!-- Dark blue View button -->
                        <button onclick="viewFilmForm('${formData.form_id}', '${formData.product_code}')" class="p-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 hover:text-blue-900 transition-all duration-200 border border-blue-200 hover:border-blue-300 flex-shrink-0" title="View">
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
                    <button onclick="handleDownloadClick('${formData.product_code}', '${formData.form_id}', this)" class="p-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-800 transition-all duration-200 border border-indigo-200 hover:border-indigo-300 flex-shrink-0" title="Film Inspection Form">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                    </button>
                    <button onclick="downloadPrestoreExcel('${formData.form_id}', this)" class="p-1 rounded-md bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-800 transition-all duration-200 border border-green-200 hover:border-green-300 flex-shrink-0 ml-1" title="Pre-Store">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                    </button>
                </td>
            `;
        });
    }

    function clearAllFilters() {
        // Reset filter inputs and trigger change events for UI update
        if (filterFromDate) {
            filterFromDate.value = '';
            filterFromDate.dispatchEvent(new Event('change'));
        }
        if (filterToDate) {
            filterToDate.value = '';
            filterToDate.dispatchEvent(new Event('change'));
        }
        if (filterProduct) {
            filterProduct.value = '';
            filterProduct.dispatchEvent(new Event('change'));
        }
        if (filterMachine) {
            filterMachine.value = '';
            filterMachine.dispatchEvent(new Event('change'));
        }
        if (filterStatus) {
            filterStatus.value = '';
            filterStatus.dispatchEvent(new Event('change'));
        }
        if (filterPreparedBy) {
            filterPreparedBy.value = '';
            filterPreparedBy.dispatchEvent(new Event('change'));
        }

        // Reset filter state
        activeFilters = {
            fromDate: '',
            toDate: '',
            product: '',
            machine: '',
            status: '',
            preparedBy: ''
        };

        // Apply filters (will show all data)
        applyFilters();
    }

    // Add event listeners for pagination buttons
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', prevPage);
    }
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', nextPage);
    }

    // Add event listeners for filters
    if (filterFromDate) {
        filterFromDate.addEventListener('change', () => {
            activeFilters.fromDate = filterFromDate.value;
            applyFilters();
        });
    }
    if (filterToDate) {
        filterToDate.addEventListener('change', () => {
            activeFilters.toDate = filterToDate.value;
            applyFilters();
        });
    }
    if (filterProduct) {
        filterProduct.addEventListener('change', () => {
            activeFilters.product = filterProduct.value;
            applyFilters();
        });
    }
    if (filterMachine) {
        filterMachine.addEventListener('change', () => {
            activeFilters.machine = filterMachine.value;
            applyFilters();
        });
    }
    if (filterStatus) {
        filterStatus.addEventListener('change', () => {
            activeFilters.status = filterStatus.value;
            applyFilters();
        });
    }
    if (filterPreparedBy) {
        filterPreparedBy.addEventListener('change', () => {
            activeFilters.preparedBy = filterPreparedBy.value;
            applyFilters();
        });
    }
    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', clearAllFilters);
    }

    // Function to populate filter dropdowns
    async function populateFilterDropdowns() {
        try {
            // Get unique products
            const products = [...new Set(allData.map(form => form.product_code).filter(Boolean))];
            if (filterProduct) {
                filterProduct.innerHTML = '<option value="">All</option>';
                products.forEach(product => {
                    const option = document.createElement('option');
                    option.value = product;
                    option.textContent = product;
                    filterProduct.appendChild(option);
                });
            }

            // Get unique machines
            const machines = [...new Set(allData.map(form => form.machine_no).filter(Boolean))];
            if (filterMachine) {
                filterMachine.innerHTML = '<option value="">All</option>';
                machines.forEach(machine => {
                    const option = document.createElement('option');
                    option.value = machine;
                    option.textContent = machine;
                    filterMachine.appendChild(option);
                });
            }

            // Get unique prepared by users
            const preparedByUsers = [...new Set(allData.map(form => form.prepared_by).filter(Boolean))];
            if (filterPreparedBy) {
                filterPreparedBy.innerHTML = '<option value="">All</option>';
                preparedByUsers.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user;
                    option.textContent = user;
                    filterPreparedBy.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error populating filter dropdowns:', error);
        }
    }

    // Expose the function globally so it can be called from the modal
    window.loadFilmInspectionForms = fetchFilmInspectionForms;

    // Load forms table on page load
    await fetchFilmInspectionForms();
    populateFilterDropdowns();

    // Enhanced search function with pagination support
    async function searchFilmInspectionForms(searchTerm) {
        // Search across all tables
        const [krantiResult, whiteResult, wwResult, jeddahResult, microWhite214Result, uc250pResult, uc290pResult, uc290npResult, uc250wResult, uc210wResult, microWhite234Result, microWhite102Result, white168Result] = await Promise.all([
            supabase.from('168_16cp_kranti').select('*'),
            supabase.from('168_16c_white').select('*'),
            supabase.from('176_18cp_ww').select('*'),
            supabase.from('168_18c_white_jeddah').select('*'),
            supabase.from('214_18_micro_white').select('*'),
            supabase.from('uc-18gsm-250p-abqr').select('*'),
            supabase.from('uc-18gsm-290p-abqr').select('*'),
            supabase.from('uc-18gsm-290np-abqr').select('*'),
            supabase.from('uc-18gsm-250w-bfqr').select('*'),
            supabase.from('uc-18gsm-210w-bfqr').select('*'),
            supabase.from('234_18_micro_white').select('*'),
            supabase.from('102_18c_micro_white').select('*'),
            supabase.from('168_18c_white').select('*')
        ]);

        let allData = [];
        if (!krantiResult.error) allData = allData.concat(krantiResult.data);
        if (!whiteResult.error) allData = allData.concat(whiteResult.data);
        if (!wwResult.error) allData = allData.concat(wwResult.data);
        if (!jeddahResult.error) allData = allData.concat(jeddahResult.data);
        if (!microWhite214Result.error) allData = allData.concat(microWhite214Result.data);
        if (!uc250pResult.error) allData = allData.concat(uc250pResult.data);
        if (!uc290pResult.error) allData = allData.concat(uc290pResult.data);
        if (!uc290npResult.error) allData = allData.concat(uc290npResult.data);
        if (!uc250wResult.error) allData = allData.concat(uc250wResult.data);
        if (!uc210wResult.error) allData = allData.concat(uc210wResult.data);
        if (!microWhite234Result.error) allData = allData.concat(microWhite234Result.data);
        if (!microWhite102Result.error) allData = allData.concat(microWhite102Result.data);
        if (!white168Result.error) allData = allData.concat(white168Result.data);

        if (searchTerm) {
            // Filter results based on search term
            allData = allData.filter(item =>
                item.production_order?.includes(searchTerm) ||
                item.product_code?.includes(searchTerm)
            );
        }

        // Sort by creation date, newest first
        allData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Lookup MRMP / GCAS / MATERIAL CODE from fif_products_master table
        await lookupGcasMrmpForSearchResults(allData);

        // Update pagination state
        totalItems = allData.length;
        currentPage = 1; // Reset to first page when searching

        // Calculate pagination info
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
        const data = allData.slice(startIndex, endIndex);

        // Update pagination controls
        updatePaginationControls(totalPages);

        tableBody.innerHTML = ''; // Clear existing rows

        data.forEach((formData, index) => {
            const row = tableBody.insertRow();
            // Store all form data in data attributes for instant access
            row.setAttribute('data-customer', formData.customer || '');
            row.setAttribute('data-production-order', formData.production_order || '');
            row.setAttribute('data-film-insp-form-ref-no', formData.film_insp_form_ref_no || '');
            row.setAttribute('data-lot-no', formData.lot_no || '');
            row.setAttribute('data-specification', formData.specification || '');

            // Serial number based on overall position in filtered dataset: latest entry gets highest number
            const serialNumber = totalItems - (startIndex + index);
            row.innerHTML = `
                <td class="py-2 px-4 border-b border-r text-center">${serialNumber}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.production_date ? new Date(formData.production_date).toLocaleDateString('en-GB') : ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.gcas_irms || ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.machine_no || ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">${formData.product_code || ''}</td>
                <td class="py-2 px-4 border-b border-r text-center">
                    ${formData.prepared_by || ''}
                </td>
                <td class="py-2 px-4 border-b border-r text-center">
                    ${formData.verified_by ? 
                        `<span class="text-gray-900">${formData.verified_by}</span>` :
                        `<span class="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-medium inline-block">Verification Pending</span>`
                    }
                </td>
                <td class="py-2 px-4 border-b border-r text-center">
                    ${formData.approved_by ?
                        `<span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium inline-block">Complete</span>` : 
                        `<span class="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-medium inline-block">Pending</span>`
                    }
                </td>
                <td class="py-2 px-4 border-b border-r text-center">
                    <div class="flex justify-center space-x-1 flex-nowrap max-w-full overflow-hidden">
                        <!-- Sky blue Enter Data button -->
                        <button onclick="enterData('${formData.form_id}')" class="p-1 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-600 hover:text-sky-800 transition-all duration-200 border border-sky-200 hover:border-sky-300 flex-shrink-0" title="Enter Data">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                            </svg>
                        </button>
                        <!-- Green Edit button - now opens prestore form -->
                        <button onclick="openPrestoreForm('${formData.product_code}', '${formData.production_order}', '${formData.form_id}')" class="p-1 rounded-md bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-800 transition-all duration-200 border border-green-200 hover:border-green-300 flex-shrink-0" title="Edit Pre-store">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                        </button>
                        <!-- Dark blue View button -->
                        <button onclick="viewFilmForm('${formData.form_id}', '${formData.product_code}')" class="p-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 hover:text-blue-900 transition-all duration-200 border border-blue-200 hover:border-blue-300 flex-shrink-0" title="View">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                            </svg>
                        </button>
                        <!-- Red Delete button -->
                        <button onclick="deleteFilmForm('${formData.form_id}')" class="p-1 rounded-md bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 transition-all duration-200 border border-red-200 hover:border-red-300 flex-shrink-0" title="Delete">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                </td>
                <td class="py-2 px-4 border-b border-r text-center">
                                            <button onclick="handleDownloadClick('${formData.product_code}', '${formData.form_id}', this)" class="p-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-800 transition-all duration-200 border border-indigo-200 hover:border-indigo-300 flex-shrink-0" title="Film Inspection Form">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                    </button>
                    <button onclick="downloadPrestoreExcel('${formData.form_id}', this)" class="p-1 rounded-md bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-800 transition-all duration-200 border border-green-200 hover:border-green-300 flex-shrink-0 ml-1" title="Pre-Store">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                    </button>
                </td>
            `;
        });
    }

    fetchFilmInspectionForms();

    // Function to pre-populate prestore form modal
    function prePopulatePrestoreForm(data) {
        
        // Map field names from database to prestore form modal IDs
        const fieldMappings = {
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
            'prestore_done_by': 'prestore-done-by-modal',
            'remarks': 'remarks-modal'
        };
        
        // Populate text inputs and selects
        for (const [key, modalId] of Object.entries(fieldMappings)) {
            const input = document.getElementById(modalId);
            if (input && data[key] && data[key] !== 'N/A' && data[key] !== 'n/a' && data[key] !== 'na' && data[key] !== 'N/a' && data[key] !== 'null') {
                // Special handling for standard_packing field
                if (key === 'standard_packing' && modalId === 'standard-packing-modal') {
                    console.log('Standard packing data:', data[key]); // Debug log

                    // Handle different possible formats
                    let number = '';
                    let unit = 'Rolls / Pallet'; // default

                    if (data[key] && typeof data[key] === 'string') {
                        console.log('Processing standard packing data:', data[key]);

                        // For standard packing, extract numbers for input field and unit for dropdown

                        // Extract all numbers and separators (like "30 & 40")
                        const numberPart = data[key].match(/[\d&\+\s]+/) ? data[key].match(/[\d&\+\s]+/)[0].trim() : '';

                        // Extract unit part (like "Rolls / Pallet")
                        const unitPart = data[key].replace(/[\d&\+\s]+/, '').trim();

                        // Populate input field with just the number part
                        input.value = numberPart;

                        // Determine unit for dropdown
                        let extractedUnit = 'Rolls / Pallet'; // default

                        if (unitPart) {
                            // Clean up the unit part
                            const cleanUnit = unitPart.replace(/[\/]/g, ' / ').trim();

                            // Check if it matches known units
                            if (cleanUnit.toLowerCase().includes('pallet')) {
                                extractedUnit = 'Rolls / Pallet';
                            } else if (cleanUnit.toLowerCase().includes('box')) {
                                extractedUnit = 'Rolls / Box';
                            } else {
                                extractedUnit = 'Rolls / Pallet'; // default
                            }
                        }

                        unit = extractedUnit;
                        console.log('Number part:', numberPart, 'Unit part:', unitPart, 'Dropdown unit:', unit);
                    }

                    // Set the unit dropdown - handle different unit formats
                    const unitSelect = document.getElementById('standard-packing-unit-modal');
                    if (unitSelect) {
                        // Try exact match first
                        if (unitSelect.querySelector(`option[value="${unit}"]`)) {
                            unitSelect.value = unit;
                        } else {
                            // Try partial matches for common variations
                            const options = unitSelect.querySelectorAll('option');
                            let matched = false;
                            options.forEach(option => {
                                if (option.value.toLowerCase().includes(unit.toLowerCase()) ||
                                    unit.toLowerCase().includes(option.value.toLowerCase().replace('Rolls / ', ''))) {
                                    unitSelect.value = option.value;
                                    matched = true;
                                }
                            });
                            if (!matched) {
                                console.warn('No matching unit found for:', unit);
                            }
                        }
                    }

                } else {
                    input.value = data[key];
                }
            }
        }
        
        // Handle radio button fields (Accept/Reject/N/A)
        const radioFields = ['pallet_list', 'product_label', 'wrapping', 'layer_pad', 'contamination', 'kraft_paper', 'no_damage', 'pallet'];
        radioFields.forEach(field => {
            if (data[field]) {
                // Convert underscore field name to hyphen for HTML name attribute
                const htmlFieldName = field.replace(/_/g, '-');
                // Handle different case variations of N/A
                let valueToMatch = data[field];
                if (data[field] === 'N/A' || data[field] === 'n/a' || data[field] === 'na' || data[field] === 'N/a') {
                    valueToMatch = 'N/A'; // Standardize to 'N/A' for HTML value
                }
                const radioButton = document.querySelector(`input[name="${htmlFieldName}"][value="${valueToMatch}"]`);
                if (radioButton) {
                    radioButton.checked = true;
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
            return;
        }

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
    window.openPrestoreForm = async function(productCode, productionOrder, formId) {
        // Store the film inspection data in session storage immediately (fast)
        const prestoreData = {
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
        preStoreFormId = formId; // Set the local variable for edit detection
        
        // Open the prestore form modal immediately
        const preStoreFormOverlay = document.getElementById('preStoreFormOverlay');
        if (preStoreFormOverlay) {
            preStoreFormOverlay.classList.remove('hidden');
            
            // Load pallet sizes dropdown
            loadPalletSizes();
            
            // Populate with basic data immediately (fast)
            prePopulatePrestoreForm(prestoreData);
            
            // Do all heavy operations in background (non-blocking)
            setupPrestoreModalInBackground(formId);
        }
    };
    
    // Function to fetch prestore_ref_no in background
    async function fetchPrestoreRefNo(formId) {
        try {
            // Try to fetch from all tables using .maybeSingle() to avoid errors when no data found
            const [krantiResult, whiteResult, wwResult, jeddahResult, microWhite214Result, uc250pResult, uc290pResult, uc290npResult, uc250wResult, uc210wResult, microWhite234Result, microWhite102Result, white168Result, uc165wResult] = await Promise.all([
                supabase
                    .from('168_16cp_kranti')
                    .select('prestore_ref_no')
                    .eq('form_id', formId)
                    .maybeSingle(),
                supabase
                    .from('168_16c_white')
                    .select('prestore_ref_no')
                    .eq('form_id', formId)
                    .maybeSingle(),
                supabase
                    .from('176_18cp_ww')
                    .select('prestore_ref_no')
                    .eq('form_id', formId)
                    .maybeSingle(),
                supabase
                    .from('168_18c_white_jeddah')
                    .select('prestore_ref_no')
                    .eq('form_id', formId)
                    .maybeSingle(),
                supabase
                    .from('214_18_micro_white')
                    .select('prestore_ref_no')
                    .eq('form_id', formId)
                    .maybeSingle(),
                supabase
                    .from('uc-18gsm-250p-abqr')
                    .select('prestore_ref_no')
                    .eq('form_id', formId)
                    .maybeSingle(),
                supabase
                    .from('uc-18gsm-290p-abqr')
                    .select('prestore_ref_no')
                    .eq('form_id', formId)
                    .maybeSingle(),
                supabase
                    .from('uc-18gsm-290np-abqr')
                    .select('prestore_ref_no')
                    .eq('form_id', formId)
                    .maybeSingle(),
                supabase
                    .from('uc-18gsm-250w-bfqr')
                    .select('prestore_ref_no')
                    .eq('form_id', formId)
                    .maybeSingle(),
                supabase
                    .from('uc-18gsm-210w-bfqr')
                    .select('prestore_ref_no')
                    .eq('form_id', formId)
                    .maybeSingle(),
                supabase
                    .from('234_18_micro_white')
                    .select('prestore_ref_no')
                    .eq('form_id', formId)
                    .maybeSingle(),
                supabase
                    .from('102_18c_micro_white')
                    .select('prestore_ref_no')
                    .eq('form_id', formId)
                    .maybeSingle(),
                supabase
                    .from('168_18c_white')
                    .select('prestore_ref_no')
                    .eq('form_id', formId)
                    .maybeSingle(),
                supabase
                    .from('uc-16gsm-165w')
                    .select('prestore_ref_no')
                    .eq('form_id', formId)
                    .maybeSingle()
            ]);
            
            // Use the result that has data (not an error)
            let formData = null;
            if (!krantiResult.error && krantiResult.data) {
                formData = krantiResult.data;
            } else if (!whiteResult.error && whiteResult.data) {
                formData = whiteResult.data;
            } else if (!wwResult.error && wwResult.data) {
                formData = wwResult.data;
            } else if (!jeddahResult.error && jeddahResult.data) {
                formData = jeddahResult.data;
            } else if (!microWhite214Result.error && microWhite214Result.data) {
                formData = microWhite214Result.data;
            } else if (!uc250pResult.error && uc250pResult.data) {
                formData = uc250pResult.data;
            } else if (!uc290pResult.error && uc290pResult.data) {
                formData = uc290pResult.data;
            } else if (!uc290npResult.error && uc290npResult.data) {
                formData = uc290npResult.data;
            } else if (!uc250wResult.error && uc250wResult.data) {
                formData = uc250wResult.data;
            } else if (!uc210wResult.error && uc210wResult.data) {
                formData = uc210wResult.data;
            } else if (!microWhite234Result.error && microWhite234Result.data) {
                formData = microWhite234Result.data;
            } else if (!microWhite102Result.error && microWhite102Result.data) {
                formData = microWhite102Result.data;
            } else if (!white168Result.error && white168Result.data) {
                formData = white168Result.data;
            } else if (!uc165wResult.error && uc165wResult.data) {
                formData = uc165wResult.data;
            }
            
            if (!formData) {
                console.log('Form data not found in any table for prestore_ref_no');
                return;
            }
            
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
    async function setupPrestoreModalInBackground(formId) {
        try {
            // Setup auto-suggestion for prestore done by field
            await setupPrestoreDoneByAutoSuggestion();
            
            // Try to fetch full data from database using form_id
            if (formId) {
                try {
                    // Try to fetch from all tables using .maybeSingle() to avoid errors when no data found
                    const [krantiResult, whiteResult, wwResult, jeddahResult, microWhite214Result, uc250pResult, uc290pResult, uc290npResult, uc250wResult, uc210wResult, microWhite234Result, microWhite102Result, white168Result] = await Promise.all([
                        supabase
                            .from('168_16cp_kranti')
                            .select('*')
                            .eq('form_id', formId)
                            .maybeSingle(),
                        supabase
                            .from('168_16c_white')
                            .select('*')
                            .eq('form_id', formId)
                            .maybeSingle(),
                        supabase
                            .from('176_18cp_ww')
                            .select('*')
                            .eq('form_id', formId)
                            .maybeSingle(),
                        supabase
                            .from('168_18c_white_jeddah')
                            .select('*')
                            .eq('form_id', formId)
                            .maybeSingle(),
                        supabase
                            .from('214_18_micro_white')
                            .select('*')
                            .eq('form_id', formId)
                            .maybeSingle(),
                        supabase
                            .from('uc-18gsm-250p-abqr')
                            .select('*')
                            .eq('form_id', formId)
                            .maybeSingle(),
                        supabase
                            .from('uc-18gsm-290p-abqr')
                            .select('*')
                            .eq('form_id', formId)
                            .maybeSingle(),
                        supabase
                            .from('uc-18gsm-290np-abqr')
                            .select('*')
                            .eq('form_id', formId)
                            .maybeSingle(),
                        supabase
                            .from('uc-18gsm-250w-bfqr')
                            .select('*')
                            .eq('form_id', formId)
                            .maybeSingle(),
                        supabase
                            .from('uc-18gsm-210w-bfqr')
                            .select('*')
                            .eq('form_id', formId)
                            .maybeSingle(),
                        supabase
                            .from('234_18_micro_white')
                            .select('*')
                            .eq('form_id', formId)
                            .maybeSingle(),
                        supabase
                            .from('102_18c_micro_white')
                            .select('*')
                            .eq('form_id', formId)
                            .maybeSingle(),
                        supabase
                            .from('168_18c_white')
                            .select('*')
                            .eq('form_id', formId)
                            .maybeSingle()
                    ]);
                    
                    // Use the result that has data (not an error)
                    let data = null;
                    if (!krantiResult.error && krantiResult.data) {
                        data = krantiResult.data;
                    } else if (!whiteResult.error && whiteResult.data) {
                        data = whiteResult.data;
                    } else if (!wwResult.error && wwResult.data) {
                        data = wwResult.data;
                    } else if (!jeddahResult.error && jeddahResult.data) {
                        data = jeddahResult.data;
                    } else if (!microWhite214Result.error && microWhite214Result.data) {
                        data = microWhite214Result.data;
                    } else if (!uc250pResult.error && uc250pResult.data) {
                        data = uc250pResult.data;
                    } else if (!uc290pResult.error && uc290pResult.data) {
                        data = uc290pResult.data;
                    } else if (!uc290npResult.error && uc290npResult.data) {
                        data = uc290npResult.data;
                    } else if (!uc250wResult.error && uc250wResult.data) {
                        data = uc250wResult.data;
                    } else if (!uc210wResult.error && uc210wResult.data) {
                        data = uc210wResult.data;
                    } else if (!microWhite234Result.error && microWhite234Result.data) {
                        data = microWhite234Result.data;
                    } else if (!microWhite102Result.error && microWhite102Result.data) {
                        data = microWhite102Result.data;
                    } else if (!white168Result.error && white168Result.data) {
                        data = white168Result.data;
                    }
                    
                    if (data) {
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
                
                // Reset submit button state
                const submitButton = preStoreFormModal.querySelector('button[type="submit"]');
                if (submitButton) {
                    submitButton.textContent = 'Save';
                    submitButton.disabled = false;
                    submitButton.style.backgroundColor = '#002E7D'; // Original dark blue
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


            // Products should be loaded by now, but continue if not (for robustness)
            // Remove the strict check that was blocking form submission

            // Determine the table name based on the selected product
            let tableName = '168_16cp_kranti';
            if (preStoreFormData.product_code) {
                const productTableMap = {
                    'APE-168(16)C': '168_16c_white',            // Updated to correct table
                    'APE-168(16)CP(KRANTI)': '168_16cp_kranti',  // Keep existing mapping
                    'APE-168(18)C (Jeddah)': '168_18c_white_jeddah', // New Jeddah product
                    'WHITE-214(18)': '214_18_micro_white', // Existing 214 Micro White product
                    'INUE1C18-250P(AB-QR)': 'uc-18gsm-250p-abqr', // UC-18gsm-250P-ABQR form
                    'INUE1C18-290P(AB-QR)': 'uc-18gsm-290p-abqr', // UC-18gsm-290P-ABQR form
                    'INUE1C18-290NP(AB-QR)': 'uc-18gsm-290np-abqr', // UC-18gsm-290NP-ABQR form
                    'INUE1C18-250W(BF-QR)': 'uc-18gsm-250w-bfqr', // UC-18gsm-250W-BFQR form
                    'INUE1C18-210W(BF-QR)': 'uc-18gsm-210w-bfqr', // UC-18gsm-210W-BFQR form
                    'WHITE-234(18)': '234_18_micro_white', // New 234 Micro White product
                    'APE-102(18)C': '102_18c_micro_white', // New 102 Micro White product
                    'APE-168(18)C': '168_18c_white', // New 168 White product
                    'INUE16-165W': 'uc-16gsm-165w' // UC-16gsm-165W form
                };
                tableName = productTableMap[preStoreFormData.product_code];
                if (!tableName) {
                    console.error('Product code not found in mapping:', preStoreFormData.product_code);
                    console.error('Product code length:', preStoreFormData.product_code.length);
                    console.error('Product code char codes:', preStoreFormData.product_code.split('').map(c => c.charCodeAt(0)));
                    console.error('Available product codes:', Object.keys(productTableMap));
                    alert(`Error: No table mapping found for product code "${preStoreFormData.product_code}". Please contact administrator.`);
                    return;
                }
            }

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
                // Handle specific error types without browser popup
                if (error.message.includes('duplicate key value violates unique constraint')) {
                    if (error.message.includes('lot_no_key')) {
                        console.error('Duplicate lot number detected. Please use a different lot number.');
                    } else {
                        console.error('Duplicate key constraint violation:', error.message);
                    }
                } else {
                    console.error('Database error:', error.message);
                }
                
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
                
                // Reset submit button state
                submitButton.textContent = 'Save';
                submitButton.disabled = false;
                submitButton.style.backgroundColor = '#002E7D'; // Original dark blue
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
        
        // Populate additional fields from data attributes (INSTANT!)
        if (data.customer) {
            form.querySelector('input[name="customer"]').value = data.customer;
        }
        if (data.productionOrder) {
            form.querySelector('input[name="production_order"]').value = data.productionOrder;
        }
        if (data.filmInspFormRefNo) {
            form.querySelector('input[name="ref_no"]').value = data.filmInspFormRefNo;
        }
        
        // Set form ID for update
        form.setAttribute('data-form-id', data.formId);
        
        // Clear any existing sessionStorage to prevent stale data
        sessionStorage.removeItem('filmInspectionData');
        
        // Show the modal immediately - NO DATABASE CALLS NEEDED!
        modal.style.display = 'flex';
    }
    

    // Function to close and reset edit modal
    function closeEditFilmInspectionModal() {
        const modal = document.getElementById('editFilmInspectionFormOverlay');
        const form = document.getElementById('editFilmInspectionForm');
        
        if (modal) {
            modal.style.display = 'none';
        }
        if (form) {
            form.reset();
            form.removeAttribute('data-form-id');
            
            // Reset submit button state
            const submitButton = form.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.textContent = 'Update Film Inspection Form';
                submitButton.disabled = false;
                submitButton.style.backgroundColor = '';
            }
        }
        
        // Clear sessionStorage to prevent stale data from being loaded
        sessionStorage.removeItem('filmInspectionData');
    }

    // Add event listener for edit buttons
    tableBody.addEventListener('click', (event) => {
        const viewFilmFormButton = event.target.closest('.view-film-form-button');
        if (viewFilmFormButton) {
            const formId = viewFilmFormButton.dataset.id;
            const productCode = viewFilmFormButton.closest('tr').querySelector('td:nth-child(5)').textContent; // Get product_code from the row (updated column position)
            
            // Store form data in sessionStorage
            sessionStorage.setItem('currentFormId', formId);
            sessionStorage.setItem('currentProductCode', productCode);
            
            // Ensure we are NOT in view mode
            sessionStorage.removeItem('viewMode');
            
            // Route to the correct form based on product code
            let targetForm = '';
            console.log('Routing form for product code (ADD DETAILS):', productCode);
            switch(productCode) {
                case 'APE-168(16)CP(KRANTI)':
                    targetForm = '16-gsm-kranti.html';
                    console.log('Routing to kranti form');
                    break;
                case 'APE-168(16)C':
                    targetForm = '16-gsm-168-white.html';
                    console.log('Routing to white form');
                    break;
                case 'APE-168(18)CP(KRANTI)':
                case 'APE-168(18)C':
                    targetForm = '18-gsm-168-white.html'; // New 168 White product
                    break;
                case 'WHITE-234(18)':
                    targetForm = '18-gsm-234-micro-white.html'; // New 234 Micro White product
                    break;
                case 'APE-102(18)C':
                    targetForm = '18-gsm-102-micro-white.html'; // New 102 Micro White product
                    break;
                case 'APE-176(18)CP(LCC+WW)BS':
                    targetForm = '18-gsm-176-WW.html';
                    console.log('Routing to 18 GSM 176 WW form');
                    break;
                case 'APE-168(18)C (Jeddah)':
                    targetForm = '18-gsm-168-white-jeddah.html';
                    console.log('Routing to 18-gsm-168-white-jeddah form');
                    break;
                case 'WHITE-214(18)':
                    targetForm = '18-gsm-214-micro-white.html';
                    console.log('Routing to 18-gsm-214-micro-white form');
                    break;
                case 'INUE1C18-250P(AB-QR)':
                    targetForm = 'UC-18gsm-250P-ABQR.html';
                    console.log('Routing to UC-18gsm-250P-ABQR form');
                    break;
                case 'INUE1C18-290P(AB-QR)':
                    targetForm = 'UC-18gsm-290P-ABQR.html';
                    console.log('Routing to UC-18gsm-290P-ABQR form');
                    break;
                case 'INUE1C18-290NP(AB-QR)':
                    targetForm = 'UC-18gsm-290NP-ABQR.html';
                    console.log('Routing to UC-18gsm-290NP-ABQR form');
                    break;
                case 'INUE1C18-250W(BF-QR)':
                    targetForm = 'UC-18gsm-250W-BFQR.html';
                    console.log('Routing to UC-18gsm-250W-BFQR form');
                    break;
                case 'INUE1C18-210W(BF-QR)':
                    targetForm = 'UC-18gsm-210W-BFQR.html';
                    console.log('Routing to UC-18gsm-210W-BFQR form');
                    break;
                case 'INUE16-165W':
                    targetForm = 'UC-16gsm-165W.html';
                    console.log('Routing to UC-16gsm-165W form');
                    break;
                default:
                    // Default fallback
                    targetForm = '16-gsm-kranti.html';
                    break;
            }
            
            window.location.href = targetForm;
        }

        const editDetailsButton = event.target.closest('.edit-details-button');
        if (editDetailsButton) {
            const formId = editDetailsButton.dataset.id;
            const row = editDetailsButton.closest('tr');
            
            // Extract data from the table row (INSTANT - no database calls!)
            const productionDate = row.querySelector('td:nth-child(2)').textContent.trim();
            const inspectionDate = row.querySelector('td:nth-child(3)').textContent.trim();
            const machineNo = row.querySelector('td:nth-child(4)').textContent.trim();
            const productCode = row.querySelector('td:nth-child(5)').textContent.trim();
            const lotNo = row.querySelector('td:nth-child(6)').textContent.trim();
            const preparedBy = row.querySelector('td:nth-child(7)').textContent.trim();
            const verifiedBy = row.querySelector('td:nth-child(8)').textContent.trim();
            
            // Get additional data from data attributes (INSTANT!)
            const customer = row.getAttribute('data-customer') || '';
            const productionOrder = row.getAttribute('data-production-order') || '';
            const filmInspFormRefNo = row.getAttribute('data-film-insp-form-ref-no') || '';
            const specification = row.getAttribute('data-specification') || '';


            // Open the Edit Film Inspection Form Details modal with populated data
            openEditFilmInspectionFormModal({
                formId: formId,
                productionDate: productionDate,
                inspectionDate: inspectionDate,
                machineNo: machineNo,
                productCode: productCode,
                specification: specification,
                lotNo: lotNo,
                preparedBy: preparedBy,
                customer: customer,
                productionOrder: productionOrder,
                filmInspFormRefNo: filmInspFormRefNo
            });
        }

        const editButton = event.target.closest('.edit-button');
        if (editButton) {
            const formId = editButton.dataset.id;
            window.location.href = `pre-store-form.html?id=${formId}`;
        }

        const deleteButton = event.target.closest('.delete-button');
        if (deleteButton) {
            const formId = deleteButton.dataset.id;
            
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
            // Try to delete from all tables
            const [krantiResult, whiteResult, wwResult, jeddahResult, microWhite214Result, uc250pResult, uc290pResult, uc290npResult, uc250wResult, uc210wResult, microWhite234Result, microWhite102Result, white168Result, uc165wResult] = await Promise.all([
                supabase
                    .from('168_16cp_kranti')
                    .delete()
                    .eq('form_id', formId),
                supabase
                    .from('168_16c_white')
                    .delete()
                    .eq('form_id', formId),
                supabase
                    .from('176_18cp_ww')
                    .delete()
                    .eq('form_id', formId),
                supabase
                    .from('168_18c_white_jeddah')
                    .delete()
                    .eq('form_id', formId),
                supabase
                    .from('214_18_micro_white')
                    .delete()
                    .eq('form_id', formId),
                supabase
                    .from('uc-18gsm-250p-abqr')
                    .delete()
                    .eq('form_id', formId),
                supabase
                    .from('uc-18gsm-290p-abqr')
                    .delete()
                    .eq('form_id', formId),
                supabase
                    .from('uc-18gsm-290np-abqr')
                    .delete()
                    .eq('form_id', formId),
                supabase
                    .from('uc-18gsm-250w-bfqr')
                    .delete()
                    .eq('form_id', formId),
                supabase
                    .from('uc-18gsm-210w-bfqr')
                    .delete()
                    .eq('form_id', formId),
                supabase
                    .from('234_18_micro_white')
                    .delete()
                    .eq('form_id', formId),
                supabase
                    .from('102_18c_micro_white')
                    .delete()
                    .eq('form_id', formId),
                supabase
                    .from('168_18c_white')
                    .delete()
                    .eq('form_id', formId),
                supabase
                    .from('uc-16gsm-165w')
                    .delete()
                    .eq('form_id', formId)
            ]);

            // Check if any deletion was successful
            const krantiSuccess = !krantiResult.error;
            const whiteSuccess = !whiteResult.error;
            const wwSuccess = !wwResult.error;
            const jeddahSuccess = !jeddahResult.error;
            const microWhite214Success = !microWhite214Result.error;
            const uc250pSuccess = !uc250pResult.error;
            const uc290pSuccess = !uc290pResult.error;
            const uc290npSuccess = !uc290npResult.error;
            const uc250wSuccess = !uc250wResult.error;
            const uc210wSuccess = !uc210wResult.error;
            const microWhite234Success = !microWhite234Result.error;
            const microWhite102Success = !microWhite102Result.error;
            const white168Success = !white168Result.error;
            const uc165wSuccess = !uc165wResult.error;

            if (krantiSuccess || whiteSuccess || wwSuccess || jeddahSuccess || microWhite214Success || uc250pSuccess || uc290pSuccess || uc290npSuccess || uc250wSuccess || uc210wSuccess || microWhite234Success || microWhite102Success || white168Success || uc165wSuccess) {
                alert('Form deleted successfully!');
                fetchFilmInspectionForms(); // Refresh the list
            } else {
                console.error('Error deleting form from all tables:', krantiResult.error, whiteResult.error, wwResult.error, jeddahResult.error, microWhite214Result.error, uc250pResult.error, uc290pResult.error, uc290npResult.error, uc250wResult.error, microWhite234Result.error, microWhite102Result.error, white168Result.error, uc165wResult.error);
                alert('Error deleting form: Form not found in any table');
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
                // Proceed with deletion from all five tables
                const [krantiResult, whiteResult, wwResult, jeddahResult, microWhite214Result, uc250pResult, microWhite234Result, microWhite102Result, white168Result] = await Promise.all([
                    supabase
                        .from('168_16cp_kranti')
                        .delete()
                        .eq('form_id', currentDeleteFormId),
                    supabase
                        .from('168_16c_white')
                        .delete()
                        .eq('form_id', currentDeleteFormId),
                    supabase
                        .from('176_18cp_ww')
                        .delete()
                        .eq('form_id', currentDeleteFormId),
                    supabase
                        .from('168_18c_white_jeddah')
                        .delete()
                        .eq('form_id', currentDeleteFormId),
                    supabase
                        .from('214_18_micro_white')
                        .delete()
                        .eq('form_id', currentDeleteFormId),
                    supabase
                        .from('uc-18gsm-250p-abqr')
                        .delete()
                        .eq('form_id', currentDeleteFormId),
                    supabase
                        .from('234_18_micro_white')
                        .delete()
                        .eq('form_id', currentDeleteFormId),
                    supabase
                        .from('102_18c_micro_white')
                        .delete()
                        .eq('form_id', currentDeleteFormId),
                    supabase
                        .from('168_18c_white')
                        .delete()
                        .eq('form_id', currentDeleteFormId)
                ]);

                // Check if any deletion was successful
                const krantiSuccess = !krantiResult.error;
                const whiteSuccess = !whiteResult.error;
                const wwSuccess = !wwResult.error;
                const jeddahSuccess = !jeddahResult.error;
                const microWhite214Success = !microWhite214Result.error;
                const uc250pSuccess = !uc250pResult.error;
                const microWhite234Success = !microWhite234Result.error;
                const microWhite102Success = !microWhite102Result.error;
                const white168Success = !white168Result.error;

                if (krantiSuccess || whiteSuccess || wwSuccess || jeddahSuccess || microWhite214Success || uc250pSuccess || microWhite234Success || microWhite102Success || white168Success) {
                    alert('Form deleted successfully!');
                    fetchFilmInspectionForms(); // Refresh the list
                } else {
                    console.error('Error deleting form from all tables:', krantiResult.error, whiteResult.error, wwResult.error, jeddahResult.error, microWhite214Result.error, uc250pResult.error, microWhite234Result.error, microWhite102Result.error, white168Result.error);
                    alert('Error deleting form: Form not found in any table');
                }
                hidePasswordConfirmModal();
            } else {
                alert('Incorrect password.');
            }
        });
    }
    */

    // Function to download Pre-Store Excel file
    window.downloadPrestoreExcel = async function(formId, buttonElement) {
        // Store original button state immediately
        const downloadBtn = buttonElement || event.target;
        const originalContent = downloadBtn.innerHTML;
        const originalTitle = downloadBtn.title;
        const originalDisabled = downloadBtn.disabled;
        
        try {
            // Show loading state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
            downloadBtn.title = 'Downloading...';
            downloadBtn.disabled = true;
            
            // Make API call to download prestore Excel
            // Use localhost for IDE testing, Render URL for production
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const backendUrl = isLocalhost ? 'http://localhost:3000' : 'https://swanson-backend.onrender.com';
            
            // Prestore download endpoint (with /api/ prefix)
            const downloadUrl = `${backendUrl}/api/download-prestore-excel/${encodeURIComponent(formId)}`;

            // Get the current session for authentication
            const session = await supabase.auth.getSession();
            const headers = {
                'Content-Type': 'application/json',
            };

            // Add authorization header if session exists
            if (session.data.session?.access_token) {
                headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
            }

            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: headers,
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Get the blob from response
            const blob = await response.blob();
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            // Use backend-provided filename
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `Pre-Store-${formId}.xlsx`; // fallback
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            // Show success state briefly
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
            downloadBtn.title = 'Downloaded!';
            
            // Reset button after 2 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 2000);
            
        } catch (error) {
            console.error('Error downloading prestore Excel:', error);
            
            // Show error state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
            downloadBtn.title = 'Download failed';
            
            // Reset button after 3 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 3000);
        }
    };

    // Function to download 18 GSM 176 WW Excel file (APE-176(18)CP(LCC+WW)BS)
    window.download18GSM176WWExcel = async function(formId, buttonElement, productCode = null) {
        // Store original button state immediately
        const downloadBtn = buttonElement || event.target;
        const originalContent = downloadBtn.innerHTML;
        const originalTitle = downloadBtn.title;
        const originalDisabled = downloadBtn.disabled;

        try {
            // Show loading state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
            downloadBtn.title = 'Downloading...';
            downloadBtn.disabled = true;

            // Make API call to download film inspection Excel
            // Use localhost for IDE testing, Render URL for production
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const backendUrl = isLocalhost ? 'http://localhost:3000' : 'https://swanson-backend.onrender.com';
            const downloadUrl = `${backendUrl}/export-176-18cp-ww-form?form_id=${encodeURIComponent(formId)}`;

            // Get the current session for authentication
            const session = await supabase.auth.getSession();
            const headers = {
                'Content-Type': 'application/json',
            };

            // Add authorization header if session exists
            if (session.data.session?.access_token) {
                headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
            }

            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: headers,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Get the blob data
            const blob = await response.blob();

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            // Use product code for dynamic filename, fallback to default if not provided
            const productName = productCode || 'APE-176(18)CP(LCC+WW)BS';
            const filename = `FIF-${productName}-.xlsx`;

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Show success state briefly
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
            downloadBtn.title = 'Downloaded!';

            // Reset button after 2 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 2000);

        } catch (error) {
            console.error('Error downloading 18 GSM 176 WW Excel:', error);

            // Show error state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
            downloadBtn.title = 'Download failed';

            // Reset button after 3 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 3000);
        }
    };

    // Function to download 102 18 Micro White Excel file (APE-102(18)C)
    window.download102MicroWhiteExcel = async function(formId, buttonElement, productCode = null) {
        // Store original button state immediately
        const downloadBtn = buttonElement || event.target;
        const originalContent = downloadBtn.innerHTML;
        const originalTitle = downloadBtn.title;
        const originalDisabled = downloadBtn.disabled;

        try {
            // Show loading state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
            downloadBtn.title = 'Downloading...';
            downloadBtn.disabled = true;

            // Make API call to download film inspection Excel
            // Use localhost for IDE testing, Render URL for production
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const backendUrl = isLocalhost ? 'http://localhost:3000' : 'https://swanson-backend.onrender.com';
            const downloadUrl = `${backendUrl}/export-102-18c-white-form?form_id=${encodeURIComponent(formId)}`;

            // Get the current session for authentication
            const session = await supabase.auth.getSession();

            // Prepare headers with authentication
            const headers = {
                'Content-Type': 'application/json',
            };

            if (session.data.session?.access_token) {
                headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
            }

            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: headers,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Use product code for dynamic filename, fallback to default if not provided
            const productName = productCode || 'APE-102(18)C';
            const filename = `FIF-${productName}-.xlsx`;
            console.log('APE-102 download filename:', filename);

            // Create blob and download
            const blob = await response.blob();

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);

            // Show success state briefly
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
            downloadBtn.title = 'Downloaded!';

            // Reset button after 2 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 2000);

        } catch (error) {
            console.error('Error downloading 102 Micro White Excel:', error);

            // Show error state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
            downloadBtn.title = 'Download failed';

            // Reset button after 3 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 3000);
        }
    };

    // Function to download APE-168(16)CP(Kranti) Excel file
    window.download16GSMKrantiExcel = async function(formId, buttonElement, productCode = null) {
        // Store original button state immediately
        const downloadBtn = buttonElement || event.target;
        const originalContent = downloadBtn.innerHTML;
        const originalTitle = downloadBtn.title;
        const originalDisabled = downloadBtn.disabled;

        try {
            // Show loading state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
            downloadBtn.title = 'Downloading...';
            downloadBtn.disabled = true;

            // Make API call to download film inspection Excel
            // Use localhost for IDE testing, Render URL for production
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const backendUrl = isLocalhost ? 'http://localhost:3000' : 'https://swanson-backend.onrender.com';
            const downloadUrl = `${backendUrl}/export-168-16cp-kranti-form?form_id=${encodeURIComponent(formId)}`;

            // Get the current session for authentication
            const session = await supabase.auth.getSession();
            const headers = {
                'Content-Type': 'application/json',
            };

            // Add authorization header if session exists
            if (session.data.session?.access_token) {
                headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
            }

            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: headers,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Get the blob data
            const blob = await response.blob();

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            // Use product code for dynamic filename, fallback to default if not provided
            const productName = productCode || 'APE-168(16)CP(KRANTI)';
            const filename = `FIF-${productName}-.xlsx`;

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Show success state briefly
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
            downloadBtn.title = 'Downloaded!';

            // Reset button after 2 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 2000);

        } catch (error) {
            console.error('Error downloading APE-168(16)CP(Kranti) Excel:', error);

            // Show error state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
            downloadBtn.title = 'Download failed';

            // Reset button after 3 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 3000);
        }
    };

    // Function to download 16 GSM White Excel file (APE-168(16)C)
    window.download16GSMWhiteExcel = async function(formId, buttonElement, productCode = null) {
        // Store original button state immediately
        const downloadBtn = buttonElement || event.target;
        const originalContent = downloadBtn.innerHTML;
        const originalTitle = downloadBtn.title;
        const originalDisabled = downloadBtn.disabled;

        try {
            // Show loading state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
            downloadBtn.title = 'Downloading...';
            downloadBtn.disabled = true;

            // Make API call to download film inspection Excel
            // Use localhost for IDE testing, Render URL for production
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const backendUrl = isLocalhost ? 'http://localhost:3000' : 'https://swanson-backend.onrender.com';
            const downloadUrl = `${backendUrl}/export-168-16c-white-form?form_id=${encodeURIComponent(formId)}`;

            // Get the current session for authentication
            const session = await supabase.auth.getSession();
            const headers = {
                'Content-Type': 'application/json',
            };

            // Add authorization header if session exists
            if (session.data.session?.access_token) {
                headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
            }

            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: headers,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Get the blob data
            const blob = await response.blob();

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            // Use product code for dynamic filename, fallback to default if not provided
            const productName = productCode || 'APE-168(16)C';
            const filename = `FIF-${productName}-.xlsx`;
            
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Show success state briefly
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
            downloadBtn.title = 'Downloaded!';

            // Reset button after 2 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 2000);

        } catch (error) {
            console.error('Error downloading 16 GSM White Excel:', error);

            // Show error state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
            downloadBtn.title = 'Download failed';

            // Reset button after 3 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 3000);
        }
    };

    // Function to download 168 18C White Excel file (APE-168(18)C)
    window.download168WhiteExcel = async function(formId, buttonElement, productCode = null) {
        // Store original button state immediately
        const downloadBtn = buttonElement || event.target;
        const originalContent = downloadBtn.innerHTML;
        const originalTitle = downloadBtn.title;
        const originalDisabled = downloadBtn.disabled;

        try {
            // Show loading state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
            downloadBtn.title = 'Downloading...';
            downloadBtn.disabled = true;

            // Make API call to download film inspection Excel
            // Use localhost for IDE testing, Render URL for production
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const backendUrl = isLocalhost ? 'http://localhost:3000' : 'https://swanson-backend.onrender.com';
            const downloadUrl = `${backendUrl}/export-168-18c-white-form?form_id=${encodeURIComponent(formId)}`;

            // Get the current session for authentication
            const session = await supabase.auth.getSession();
            const headers = {
                'Content-Type': 'application/json',
            };

            // Add authorization header if session exists
            if (session.data.session?.access_token) {
                headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
            }

            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: headers,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Get the blob data
            const blob = await response.blob();

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            // Use product code for dynamic filename, fallback to default if not provided
            const productName = productCode || 'APE-168(18)C-White';
            const filename = `FIF-${productName}-.xlsx`;

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Restore original button state after successful download
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 1000);

            // Success - no toast needed, visual feedback is sufficient
        } catch (error) {
            console.error('Error downloading 168 White Excel:', error);

            // Restore original button state
            downloadBtn.innerHTML = originalContent;
            downloadBtn.title = originalTitle;
            downloadBtn.disabled = originalDisabled;

            // Show error message
            alert('Error downloading Excel file. Please try again.');
        }
    };

    // Function to download 168 18C White Jeddah Excel file (APE-168(18)C (Jeddah))
    window.download168WhiteJeddahExcel = async function(formId, buttonElement, productCode = null) {
        // Store original button state immediately
        const downloadBtn = buttonElement || event.target;
        const originalContent = downloadBtn.innerHTML;
        const originalTitle = downloadBtn.title;
        const originalDisabled = downloadBtn.disabled;

        try {
            // Show loading state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
            downloadBtn.title = 'Downloading...';
            downloadBtn.disabled = true;

            // Make API call to download film inspection Excel
            // Use localhost for IDE testing, Render URL for production
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const backendUrl = isLocalhost ? 'http://localhost:3000' : 'https://swanson-backend.onrender.com';
            const downloadUrl = `${backendUrl}/export-168-18c-white-jeddah-form?form_id=${encodeURIComponent(formId)}`;

            // Get the current session for authentication
            const session = await supabase.auth.getSession();
            const headers = {
                'Content-Type': 'application/json',
            };

            // Add authorization header if session exists
            if (session.data.session?.access_token) {
                headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
            }

            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: headers,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Get the blob data
            const blob = await response.blob();

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            // Use product code for dynamic filename, fallback to default if not provided
            const productName = productCode || 'APE-168(18)C-Jeddah';
            const filename = `FIF-${productName}-.xlsx`;

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Show success state briefly
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
            downloadBtn.title = 'Downloaded!';

            // Reset button after 2 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 2000);

        } catch (error) {
            console.error('Error downloading 168 White Jeddah Excel:', error);

            // Show error state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
            downloadBtn.title = 'Download failed';

            // Reset button after 3 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 3000);
        }
    };

    // Function to handle download button clicks and route to appropriate download function
    window.handleDownloadClick = async function(productCode, formId, buttonElement) {
        const downloadFunctionName = getDownloadFunction(productCode);

        if (downloadFunctionName) {
            // Call the appropriate download function with product code
            window[downloadFunctionName](formId, buttonElement, productCode);
        } else {
            // Show alert for unsupported product types
            alert('Download not available for this product type');
        }
    };

    // Helper function to get the appropriate download function based on product code
    window.getDownloadFunction = function(productCode) {
        if (productCode === 'APE-168(16)CP(KRANTI)') {
            return 'download16GSMKrantiExcel';
        } else if (productCode === 'APE-168(16)C') {
            return 'download16GSMWhiteExcel';
        } else if (productCode === 'APE-168(18)C (Jeddah)') {
            return 'download168WhiteJeddahExcel';
        } else if (productCode === 'APE-168(18)C') {
            return 'download168WhiteExcel';
        } else if (productCode === 'APE-176(18)CP(LCC+WW)BS') {
            return 'download18GSM176WWExcel';
        } else if (productCode === 'WHITE-214(18)') {
            return 'download214WhiteExcel';
        } else if (productCode === 'INUE1C18-250P(AB-QR)') {
            return 'downloadUC250PABQRExcel';
        } else if (productCode === 'INUE1C18-290P(AB-QR)') {
            return 'downloadUC290PABQRExcel';
        } else if (productCode === 'INUE1C18-290NP(AB-QR)') {
            return 'downloadUC290NPABQRExcel';
        } else if (productCode === 'INUE1C18-250W(BF-QR)') {
            return 'downloadUC250WBFQRExcel';
        } else if (productCode === 'WHITE-234(18)') {
            return 'download234WhiteExcel';
        } else if (productCode === 'APE-102(18)C') {
            return 'download102MicroWhiteExcel';
        } else if (productCode === 'INUE1C18-210W(BF-QR)') {
            return 'downloadUC210WBFQRExcel';
        } else if (productCode === 'INUE16-165W') {
            return 'downloadUC165WExcel';
        } else {
            return null; // No download function available
        }
    };

    // Function to download 214 18 White Excel file (WHITE-214(18))
    window.download214WhiteExcel = async function(formId, buttonElement, productCode = null) {
        // Store original button state immediately
        const downloadBtn = buttonElement || event.target;
        const originalContent = downloadBtn.innerHTML;
        const originalTitle = downloadBtn.title;
        const originalDisabled = downloadBtn.disabled;

        try {
            // Show loading state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
            downloadBtn.title = 'Downloading...';
            downloadBtn.disabled = true;

            // Make API call to download film inspection Excel
            // Use localhost for IDE testing, Render URL for production
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const backendUrl = isLocalhost ? 'http://localhost:3000' : 'https://swanson-backend.onrender.com';
            const downloadUrl = `${backendUrl}/export-214-18-micro-white-form?form_id=${encodeURIComponent(formId)}`;

            // Get the current session for authentication
            const session = await supabase.auth.getSession();
            const headers = {
                'Content-Type': 'application/json',
            };

            // Add authorization header if session exists
            if (session.data.session?.access_token) {
                headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
            }

            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: headers,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Get the blob data
            const blob = await response.blob();

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            // Use product code for dynamic filename, fallback to default if not provided
            const productName = productCode || 'WHITE-214(18)';
            const filename = `FIF-${productName}-.xlsx`;
            
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Show success state briefly
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
            downloadBtn.title = 'Downloaded!';

            // Reset button after 2 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 2000);

        } catch (error) {
            console.error('Error downloading 214 18 White Excel:', error);

            // Show error state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
            downloadBtn.title = 'Download failed';

            // Reset button after 3 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 3000);
        }
    };

    // Function to download 234 18 White Excel file (WHITE-234(18))
    window.download234WhiteExcel = async function(formId, buttonElement, productCode = null) {
        // Store original button state immediately
        const downloadBtn = buttonElement || event.target;
        const originalContent = downloadBtn.innerHTML;
        const originalTitle = downloadBtn.title;
        const originalDisabled = downloadBtn.disabled;

        try {
            // Show loading state immediately
            downloadBtn.innerHTML = '<svg class="w-4 h-4 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
            downloadBtn.title = 'Downloading...';
            downloadBtn.disabled = true;

            // Make API call to download film inspection Excel
            // Use localhost for IDE testing, Render URL for production
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const backendUrl = isLocalhost ? 'http://localhost:3000' : 'https://swanson-backend.onrender.com';
            const downloadUrl = `${backendUrl}/export-234-18-micro-white-form?form_id=${encodeURIComponent(formId)}`;

            // Get the current session for authentication
            const session = await supabase.auth.getSession();
            const headers = {
                'Content-Type': 'application/json',
            };

            // Add authorization header if session exists
            if (session.data.session?.access_token) {
                headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
            }

            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: headers,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Get the blob from response
            const blob = await response.blob();

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            // Use product code for dynamic filename, fallback to default if not provided
            const productName = productCode || 'WHITE-234(18)';
            const filename = `FIF-${productName}-.xlsx`;
            console.log('234 White download filename:', filename);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Show success state briefly
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
            downloadBtn.title = 'Downloaded!';

            // Reset button after 2 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 2000);

        } catch (error) {
            console.error('Error downloading 234 18 White Excel:', error);

            // Show error state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
            downloadBtn.title = 'Download failed';

            // Reset button after 3 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 3000);
        }
    };

    // Function to download APE-168(16)CP(Kranti) Excel file
    window.download16GSMKrantiExcel = async function(formId, buttonElement, productCode = null) {
        // Store original button state immediately
        const downloadBtn = buttonElement || event.target;
        const originalContent = downloadBtn.innerHTML;
        const originalTitle = downloadBtn.title;
        const originalDisabled = downloadBtn.disabled;
        
        try {
            // Show loading state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
            downloadBtn.title = 'Downloading...';
            downloadBtn.disabled = true;
            
            // Make API call to download film inspection Excel
            // Use localhost for IDE testing, Render URL for production
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const backendUrl = isLocalhost ? 'http://localhost:3000' : 'https://swanson-backend.onrender.com';
            const downloadUrl = `${backendUrl}/export-168-16cp-kranti-form?form_id=${encodeURIComponent(formId)}`;

            // Get the current session for authentication
            const session = await supabase.auth.getSession();
            const headers = {
                'Content-Type': 'application/json',
            };

            // Add authorization header if session exists
            if (session.data.session?.access_token) {
                headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
            }

            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: headers,
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Get the blob from response
            const blob = await response.blob();
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            // Use consistent filename pattern
            const filename = `FIF-APE-168(16)CP(Kranti)-.xlsx`;
            console.log('APE-168(16)CP(Kranti) download filename:', filename);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            // Show success state briefly
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
            downloadBtn.title = 'Downloaded!';
            
            // Reset button after 2 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 2000);
            
        } catch (error) {
            console.error('Error downloading film inspection Excel:', error);
            
            // Show error state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
            downloadBtn.title = 'Download failed';
            
            // Reset button after 3 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 3000);
        }
    };

    // Function to download UC-16gsm-165W Excel file
    window.downloadUC165WExcel = async function(formId, buttonElement, productCode = null) {
        // Store original button state immediately
        const downloadBtn = buttonElement || event.target;
        const originalContent = downloadBtn.innerHTML;
        const originalTitle = downloadBtn.title;
        const originalDisabled = downloadBtn.disabled;

        try {
            // Show loading state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
            downloadBtn.title = 'Downloading...';
            downloadBtn.disabled = true;

            // Make API call to download film inspection Excel
            // Use localhost for IDE testing, Render URL for production
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const backendUrl = isLocalhost ? 'http://localhost:3000' : 'https://swanson-backend.onrender.com';
            const downloadUrl = `${backendUrl}/export-uc-16gsm-165w-form?form_id=${encodeURIComponent(formId)}`;

            // Get the current session for authentication
            const session = await supabase.auth.getSession();
            const headers = {
                'Content-Type': 'application/json',
            };

            // Add authorization header if session exists
            if (session.data.session?.access_token) {
                headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
            }

            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: headers,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Get the blob from response
            const blob = await response.blob();

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            // Use product code for dynamic filename, fallback to default if not provided
            const productName = productCode || 'INUE16-165W';
            const filename = `FIF-${productName}-.xlsx`;
            console.log('INUE16-165W download filename:', filename);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Show success state briefly
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
            downloadBtn.title = 'Downloaded!';

            // Reset button after 2 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 2000);

        } catch (error) {
            console.error('Error downloading UC-16gsm-165W Excel:', error);

            // Show error state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
            downloadBtn.title = 'Download failed';

            // Reset button after 3 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 3000);
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

                    // Convert "N/A" values to null for database storage
                    Object.keys(updateData).forEach(key => {
                        const value = updateData[key];
                        if (value === 'N/A' || value === 'n/a' || value === 'na' || value === 'N/a' || 
                            value === '' || value === ' ' || value === 'null' || value === 'undefined') {
                            updateData[key] = null;
                        }
                    });
                    
                    // Try to update in all tables with film_insp_form_ref_no for ALL tables
                    const [krantiResult, whiteResult, wwResult, jeddahResult, microWhite214Result, uc250pResult, uc290pResult, uc250wResult, uc210wResult, microWhite234Result, microWhite102Result, white168Result, uc165wResult] = await Promise.all([
                        supabase
                            .from('168_16cp_kranti')
                            .update(updateData)
                            .eq('form_id', formId),
                        supabase
                            .from('168_16c_white')
                            .update(updateData)
                            .eq('form_id', formId),
                        supabase
                            .from('176_18cp_ww')
                            .update(updateData)
                            .eq('form_id', formId),
                        supabase
                            .from('168_18c_white_jeddah')
                            .update(updateData)
                            .eq('form_id', formId),
                        supabase
                            .from('214_18_micro_white')
                            .update(updateData)
                            .eq('form_id', formId),
                        supabase
                            .from('uc-18gsm-250p-abqr')
                            .update(updateData)
                            .eq('form_id', formId),
                        supabase
                            .from('uc-18gsm-250w-bfqr')
                            .update(updateData)
                            .eq('form_id', formId),
                        supabase
                            .from('uc-18gsm-210w-bfqr')
                            .update(updateData)
                            .eq('form_id', formId),
                        supabase
                            .from('234_18_micro_white')
                            .update(updateData)
                            .eq('form_id', formId),
                        supabase
                            .from('102_18c_micro_white')
                            .update(updateData)
                            .eq('form_id', formId),
                        supabase
                            .from('168_18c_white')
                            .update(updateData)
                            .eq('form_id', formId),
                        supabase
                            .from('uc-16gsm-165w')
                            .update(updateData)
                            .eq('form_id', formId)
                    ]);
                    
                    // Check if any update was successful
                    const krantiSuccess = !krantiResult.error;
                    const whiteSuccess = !whiteResult.error;
                    const wwSuccess = !wwResult.error;
                    const jeddahSuccess = !jeddahResult.error;
                    const microWhite214Success = !microWhite214Result.error;
                    const uc250pSuccess = !uc250pResult.error;
                    const uc250wSuccess = !uc250wResult.error;
                    const uc210wSuccess = !uc210wResult.error;
                    const microWhite234Success = !microWhite234Result.error;
                    const microWhite102Success = !microWhite102Result.error;
                    const white168Success = !white168Result.error;
                    const uc165wSuccess = !uc165wResult.error;

                    if (!krantiSuccess && !whiteSuccess && !wwSuccess && !jeddahSuccess && !microWhite214Success && !uc250pSuccess && !uc250wSuccess && !uc210wSuccess && !microWhite234Success && !microWhite102Success && !white168Success && !uc165wSuccess) {
                        throw new Error('Form not found in any table');
                    }
                    
                    // Show success state
                    submitButton.textContent = 'Updated!';
                    submitButton.style.backgroundColor = '#10B981'; // Green
                    
                    // Close modal and refresh the list after a short delay
                    setTimeout(async () => {
                        closeEditFilmInspectionModal();
                        if (typeof fetchFilmInspectionForms === 'function') {
                            await fetchFilmInspectionForms();
                        } else {
                            // Fallback: reload the page to refresh the list
                            window.location.reload();
                        }
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
window.viewFilmForm = function(formId, productCode) {
    // Store form data in sessionStorage with view mode flag
    sessionStorage.setItem('currentFormId', formId);
    sessionStorage.setItem('currentProductCode', productCode);
    sessionStorage.setItem('viewMode', 'true');
    
    // Route to the correct form based on product code
    let targetForm = '';
    console.log('View form routing for product code:', productCode);
    switch(productCode) {
        case 'APE-168(16)CP(KRANTI)':
            targetForm = '16-gsm-kranti.html';
            console.log('View routing to kranti form');
            break;
        case 'APE-168(16)C':
            targetForm = '16-gsm-168-white.html';
            console.log('View routing to white form');
            break;
        case 'APE-168(18)CP(KRANTI)':
        case 'APE-168(18)C':
            targetForm = '18-gsm-168-white.html'; // New 168 White product
            break;
        case 'WHITE-234(18)':
                    targetForm = '18-gsm-234-micro-white.html'; // New 234 Micro White product
            break;
        case 'APE-102(18)C':
                    targetForm = '18-gsm-102-micro-white.html'; // New 102 Micro White product
            break;
        case 'APE-176(18)CP(LCC+WW)BS':
                    targetForm = '18-gsm-176-WW.html';
            break;
        case 'APE-168(18)C (Jeddah)':
                    targetForm = '18-gsm-168-white-jeddah.html';
            break;
        case 'WHITE-214(18)':
            targetForm = '18-gsm-214-micro-white.html';
            break;
        case 'INUE1C18-250P(AB-QR)':
            targetForm = 'UC-18gsm-250P-ABQR.html';
            console.log('View routing to UC-18gsm-250P-ABQR form');
            break;
        case 'INUE1C18-290P(AB-QR)':
            targetForm = 'UC-18gsm-290P-ABQR.html';
            console.log('View routing to UC-18gsm-290P-ABQR form');
            break;
        case 'INUE1C18-290NP(AB-QR)':
            targetForm = 'UC-18gsm-290NP-ABQR.html';
            console.log('View routing to UC-18gsm-290NP-ABQR form');
            break;
        case 'INUE1C18-250W(BF-QR)':
            targetForm = 'UC-18gsm-250W-BFQR.html';
            console.log('View routing to UC-18gsm-250W-BFQR form');
            break;
        case 'INUE1C18-210W(BF-QR)':
            targetForm = 'UC-18gsm-210W-BFQR.html';
            console.log('View routing to UC-18gsm-210W-BFQR form');
            break;
        case 'INUE16-165W':
            targetForm = 'UC-16gsm-165W.html';
            console.log('View routing to UC-16gsm-165W form');
            break;
        default:
            // Default fallback
            targetForm = '16-gsm-kranti.html';
            break;
    }
    
    // Navigate to the form with view mode parameter
    window.location.href = targetForm + '?mode=view';
};

// Global function to handle Enter Data button click - navigate to form in edit mode
window.enterData = function(formId) {
    // Store form data in sessionStorage
    sessionStorage.setItem('currentFormId', formId);
    sessionStorage.removeItem('viewMode'); // Ensure edit mode
    
    // Find the product code from the table row
    const tableRow = document.querySelector(`button[onclick="enterData('${formId}')"]`).closest('tr');
    const productCode = tableRow.querySelector('td:nth-child(5)').textContent.trim();
    
    // Route to the correct form based on product code
    let targetForm = '';
    console.log('Enter data routing for product code:', productCode);
    switch(productCode) {
        case 'APE-168(16)CP(KRANTI)':
            targetForm = '16-gsm-kranti.html';
            break;
        case 'APE-168(16)C':
            targetForm = '16-gsm-168-white.html';
            break;
        case 'APE-168(18)C':
            targetForm = '18-gsm-168-white.html';
            break;
        case 'APE-176(18)CP(LCC+WW)BS':
            targetForm = '18-gsm-176-WW.html';
            break;
        case 'APE-168(18)C (Jeddah)':
            targetForm = '18-gsm-168-white-jeddah.html';
            break;
        case 'WHITE-214(18)':
            targetForm = '18-gsm-214-micro-white.html';
            break;
        case 'INUE1C18-250P(AB-QR)':
            targetForm = 'UC-18gsm-250P-ABQR.html';
            console.log('Enter data routing to UC-18gsm-250P-ABQR form');
            break;
        case 'INUE1C18-250W(BF-QR)':
            targetForm = 'UC-18gsm-250W-BFQR.html';
            console.log('Enter data routing to UC-18gsm-250W-BFQR form');
            break;
        case 'INUE1C18-290P(AB-QR)':
            targetForm = 'UC-18gsm-290P-ABQR.html';
            console.log('Enter data routing to UC-18gsm-290P-ABQR form');
            break;
        case 'INUE1C18-290NP(AB-QR)':
            targetForm = 'UC-18gsm-290NP-ABQR.html';
            console.log('Enter data routing to UC-18gsm-290NP-ABQR form');
            break;
        case 'WHITE-234(18)':
            targetForm = '18-gsm-234-micro-white.html';
            break;
        case 'APE-102(18)C':
            targetForm = '18-gsm-102-micro-white.html';
            break;
        case 'INUE16-165W':
            targetForm = 'UC-16gsm-165W.html';
            break;
        default:
            targetForm = '16-gsm-kranti.html';
            break;
    }
    
    // Force edit mode explicitly to avoid accidental view-mode via stale params
    window.location.href = `${targetForm}?mode=edit`;
};

// Global function to handle Delete button click
window.deleteFilmForm = async function(formId) {
    if (confirm('Are you sure you want to delete this film inspection form? This action cannot be undone.')) {
        try {
            await deleteFormDirectly(formId);
        } catch (error) {
            console.error('Error in deleteFilmForm:', error);
            alert('Error deleting form: ' + error.message);
        }
    }
};

    // ============================================================================
    // FILM INSPECTION FORM MODAL FUNCTIONALITY
    // ============================================================================
    
    // Modal controls for Film Inspection Form
    const createFormBtn = document.getElementById('showFilmInspectionFormOverlay');
    const filmOverlay = document.getElementById('filmInspectionFormOverlay');
    const closeFilmBtn = document.getElementById('closeFilmInspectionFormOverlay');
    const clearFilmBtn = document.getElementById('clearFilmInspectionForm');
    const filmForm = document.getElementById('filmInspectionForm');
    const productCodeInput = document.getElementById('product_code');
    const productSuggestions = document.getElementById('productSuggestions');
    let allProducts = []; // Store all products for autocomplete

    // Function to close film modal
    function closeFilmModal() {
        if (filmOverlay) {
            filmOverlay.style.display = 'none';
        }
        if (filmForm) {
            filmForm.reset();
        }
        // Hide suggestions when modal closes
        if (productSuggestions) {
            productSuggestions.classList.add('hidden');
        }
    }

    // Function to clear film form
    function clearFilmForm() {
        if (filmForm) {
            filmForm.reset();
        }
    }

    // Setup film modal controls
    if (createFormBtn) {
        createFormBtn.addEventListener('click', function() {
            // Clear sessionStorage for new form creation
            sessionStorage.removeItem('filmInspectionData');
            
            if (filmForm) {
                const submitBtn = filmForm.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.textContent = 'Create Film Inspection Form';
                filmForm.onsubmit = null; // Reset to default handler
            }
            filmOverlay.style.display = 'flex';
            loadProducts(); // Load products when modal opens
        });
    }

    // Close button functionality
    if (closeFilmBtn) {
        closeFilmBtn.addEventListener('click', function() {
            closeFilmModal();
        });
    }

    // Cancel button functionality
    if (clearFilmBtn) {
        clearFilmBtn.addEventListener('click', function() {
            clearFilmForm();
        });
    }

    // ESC key functionality
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && filmOverlay && filmOverlay.style.display === 'flex') {
            closeFilmModal();
        }
    });

    // Function to load products from fif_products_master table
    async function loadProducts() {
        try {
            const { data: products, error } = await supabase
                .from('fif_products_master')
                .select('*')
                .order('prod_code');

            if (error) {
                console.error('Error fetching products:', error.message);
                return;
            }

            // Store all products for autocomplete
            allProducts = products;

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
                customerInput.value = product.customer;
                
                // FORCE the field to stay as input and prevent conversion to dropdown
                if (customerInput.tagName !== 'INPUT') {
                    const newInput = document.createElement('input');
                    newInput.type = 'text';
                    newInput.id = 'customer';
                    newInput.name = 'customer';
                    newInput.className = 'mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#002E7D] focus:border-[#002E7D] sm:text-sm bg-gray-50';
                    newInput.placeholder = 'Customer will auto-fill';
                    newInput.readOnly = true;
                    newInput.value = product.customer;
                    
                    customerInput.parentNode.replaceChild(newInput, customerInput);
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
            
            // Show product code only (customer_site column doesn't exist)
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
            if (searchTerm && allProducts.length > 0 && allProducts.some(p => p.prod_code === searchTerm)) {
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

    // Film Inspection Form submission
    if (filmForm) {
        filmForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const formData = new FormData(filmForm);
            const data = {};
            for (let [key, value] of formData.entries()) {
                // Only include fields that have actual values (not empty strings)
                if (value && value.trim() !== '') {
                    data[key] = value.trim();
                }
            }
            

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
            data.product_code = data.product_code;
            data.machine_no = data.machine_no;

            // Convert quantity to an integer
            if (data.quantity) {
                data.quantity = parseInt(data.quantity);
            }

            // lot_no field removed - not present in HTML form

            // Convert "N/A" values to null for database storage
            Object.keys(data).forEach(key => {
                const value = data[key];
                if (value === 'N/A' || value === 'n/a' || value === 'na' || value === 'N/a' || 
                    value === '' || value === ' ' || value === 'null' || value === 'undefined') {
                    data[key] = null;
                }
            });

            // Determine the table name based on the selected product
            let tableName = '168_16cp_kranti'; // default table for 16 GSM Kranti products

            if (data.product_code) {
                // Map product codes to their specific tables
                const productTableMap = {
                    'APE-168(16)C': '168_16c_white',            // Updated to correct table
                    'APE-168(16)CP(KRANTI)': '168_16cp_kranti',  // Keep existing mapping
                    'APE-176(18)CP(LCC+WW)BS': '176_18cp_ww',    // New 18 GSM 176 WW product
                    'APE-168(18)C (Jeddah)': '168_18c_white_jeddah', // New Jeddah product
                    'WHITE-214(18)': '214_18_micro_white', // Existing 214 Micro White product
                    'INUE1C18-250P(AB-QR)': 'uc-18gsm-250p-abqr', // UC-18gsm-250P-ABQR form
                    'INUE1C18-290P(AB-QR)': 'uc-18gsm-290p-abqr', // UC-18gsm-290P-ABQR form
                    'INUE1C18-290NP(AB-QR)': 'uc-18gsm-290np-abqr', // UC-18gsm-290NP-ABQR form
                    'INUE1C18-250W(BF-QR)': 'uc-18gsm-250w-bfqr', // UC-18gsm-250W-BFQR form
                    'INUE1C18-210W(BF-QR)': 'uc-18gsm-210w-bfqr', // UC-18gsm-210W-BFQR form
                    'WHITE-234(18)': '234_18_micro_white', // New 234 Micro White product
                    'APE-102(18)C': '102_18c_micro_white', // New 102 Micro White product
                    'APE-168(18)C': '168_18c_white', // New 168 White product
                    'INUE16-165W': 'uc-16gsm-165w' // UC-16gsm-165W form
                    // Add more product-specific tables as they are created
                };

                tableName = productTableMap[data.product_code];
                if (!tableName) {
                    console.error('Product code not found in mapping:', data.product_code);
                    console.error('Product code length:', data.product_code.length);
                    console.error('Product code char codes:', data.product_code.split('').map(c => c.charCodeAt(0)));
                    console.error('Available product codes:', Object.keys(productTableMap));
                    alert(`Error: No table mapping found for product code "${data.product_code}". Please contact administrator.`);
                    return;
                }
            }

            // Map ref_no to film_insp_form_ref_no for ALL tables
            if (data.ref_no) {
                data.film_insp_form_ref_no = data.ref_no;
                delete data.ref_no; // Remove the original ref_no field
            }
            

            let dbOperation;
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
                    console.error('Error: LOT NO already exists. Please enter a unique LOT NO.');
                    // You could show a user-friendly message in the UI instead of alert
                    return;
                }
            }

            // Insert new record into the product-specific table
            dbOperation = supabase
                .from(tableName)
                .insert([data])
                .select('*');

            const { data: resultData, error } = await dbOperation;
            if (error) {
                if (error.code === '23505') { // PostgreSQL unique violation error code
                    console.error('Error: This LOT NO already exists. Please use a unique LOT NO.');
                } else {
                    console.error('Error inserting data:', error.message);
                    console.error('An error occurred during form submission. Please try again.');
                }
                return;
            }
            if (resultData && resultData.length > 0) {
                const dataToStore = resultData[0];
                sessionStorage.setItem('filmInspectionData', JSON.stringify(dataToStore));
            } else {
                sessionStorage.removeItem('filmInspectionData'); // Clear if no data was inserted
            }
            console.log(`Film Inspection Form submitted successfully!`);
            
            // Close modal and refresh the list
            closeFilmModal();
            
            // Refresh the film inspection list
            if (typeof fetchFilmInspectionForms === 'function') {
                await fetchFilmInspectionForms();
            } else {
                // Fallback: reload the page to refresh the list
                window.location.reload();
            }
        });
    }

    // ============================================================================
    // PRE-STORE FORM MODAL FUNCTIONALITY
    // ============================================================================
    
    // Pre-Store Form Modal Controls
    const preStoreForm = document.getElementById('preStoreFormModal');
    let preStoreFormId = null; // To store the ID if we are editing

    // Prestore modal product autocomplete
    const prestoreProductCodeInput = document.getElementById('product-code-modal');
    const prestoreProductSuggestions = document.getElementById('prestoreProductSuggestions');

    // Setup product autocomplete for prestore modal
    if (prestoreProductCodeInput && prestoreProductSuggestions) {
        prestoreProductCodeInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value;
            if (searchTerm.length >= 1) {
                showProductSuggestionsForPrestore(searchTerm);
            } else {
                prestoreProductSuggestions.classList.add('hidden');
            }

            // Auto-load customer and specification when product code is manually typed
            if (searchTerm && allProducts.length > 0 && allProducts.some(p => p.prod_code === searchTerm)) {
                loadSpecificationForPrestore(searchTerm);
                loadCustomerForPrestore(searchTerm);
            }
        });

        prestoreProductCodeInput.addEventListener('focus', (e) => {
            const searchTerm = e.target.value;
            if (searchTerm.length >= 1) {
                showProductSuggestionsForPrestore(searchTerm);
            }
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!prestoreProductCodeInput.contains(e.target) && !prestoreProductSuggestions.contains(e.target)) {
                prestoreProductSuggestions.classList.add('hidden');
            }
        });
    }

    // Function to load customers from fif_products_master table
    async function loadCustomers() {
        try {
            const { data: products, error } = await supabase
                .from('fif_products_master')
                .select('customer')
                .not('customer', 'is', null)
                .order('customer');

            if (error) {
                console.error('Error fetching customers:', error.message);
                return;
            }

            // Get unique customers
            const uniqueCustomers = [...new Set(products.map(product => product.customer))].filter(customer => customer && customer.trim() !== '');

            // Get the customer dropdown
            const customerSelect = document.getElementById('customer');
            if (!customerSelect) return;

            // Clear existing options except the first one
            customerSelect.innerHTML = '<option value="">Select Customer</option>';

            // Add customers to dropdown
            uniqueCustomers.forEach(customer => {
                const option = document.createElement('option');
                option.value = customer;
                option.textContent = customer;
                customerSelect.appendChild(option);
            });


        } catch (error) {
            console.error('Error loading customers:', error);
        }
    }

    // Function to show product suggestions for prestore modal
    function showProductSuggestionsForPrestore(searchTerm) {
        if (!prestoreProductSuggestions || !allProducts.length) return;

        const filteredProducts = allProducts.filter(product =>
            product.prod_code.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (filteredProducts.length === 0) {
            prestoreProductSuggestions.classList.add('hidden');
            return;
        }

        prestoreProductSuggestions.innerHTML = '';
        filteredProducts.forEach(product => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'px-3 py-2 hover:bg-blue-200 cursor-pointer text-sm';
            suggestionItem.textContent = product.prod_code;
            suggestionItem.title = `Specification: ${product.spec || 'N/A'}`;

            suggestionItem.addEventListener('click', () => {
                prestoreProductCodeInput.value = product.prod_code;
                prestoreProductSuggestions.classList.add('hidden');
                loadSpecificationForPrestore(product.prod_code);
                loadCustomerForPrestore(product.prod_code);
            });
            prestoreProductSuggestions.appendChild(suggestionItem);
        });

        prestoreProductSuggestions.classList.remove('hidden');
    }

    // Function to load specification for prestore modal
    async function loadSpecificationForPrestore(selectedProduct) {
        const specificationInput = document.getElementById('specification-modal');

        if (!selectedProduct || !specificationInput) {
            return;
        }

        try {
            const { data: product, error } = await supabase
                .from('fif_products_master')
                .select('spec')
                .eq('prod_code', selectedProduct)
                .single();

            if (error) {
                console.error('Error fetching specification for prestore:', error.message);
                return;
            }

            if (product && product.spec) {
                specificationInput.value = product.spec;
            }
        } catch (error) {
            console.error('Error loading specification for prestore:', error);
        }
    }

    // Function to load customer for prestore modal
    async function loadCustomerForPrestore(selectedProduct) {
        const customerInput = document.getElementById('customer-modal');

        if (!selectedProduct || !customerInput) {
            return;
        }

        try {
            const { data: product, error } = await supabase
                .from('fif_products_master')
                .select('customer')
                .eq('prod_code', selectedProduct)
                .single();

            if (error) {
                console.error('Error fetching customer for prestore:', error.message);
                return;
            }

            if (product && product.customer) {
                customerInput.value = product.customer;
            }
        } catch (error) {
            console.error('Error loading customer for prestore:', error);
        }
    }

    // Function to load pallet sizes from fif_products_master table
    async function loadPalletSizes() {
        try {
            const { data: products, error } = await supabase
                .from('fif_products_master')
                .select('pallet_size')
                .not('pallet_size', 'is', null)
                .order('pallet_size');

            if (error) {
                console.error('Error fetching pallet sizes:', error.message);
                return;
            }

            // Get unique pallet sizes
            const uniquePalletSizes = [...new Set(products.map(product => product.pallet_size))].filter(size => size && size.trim() !== '');

            // Get the pallet size dropdown in the modal
            const palletSizeSelect = document.getElementById('pallet-size-modal');
            if (!palletSizeSelect) return;

            // Clear existing options except the first one
            palletSizeSelect.innerHTML = '<option value="">Select Pallet Size</option>';

            // Add pallet sizes to dropdown
            uniquePalletSizes.forEach(size => {
                const option = document.createElement('option');
                option.value = size;
                option.textContent = size;
                palletSizeSelect.appendChild(option);
            });

        } catch (error) {
            console.error('Error loading pallet sizes:', error);
        }
    }

    // Function to pre-populate form fields (pre-store form only)
    function prePopulateForm(data) {
        
        // Get the pre-store form element
        const preStoreFormElement = document.getElementById('preStoreForm');
        if (!preStoreFormElement) {
            return;
        }
        
        for (const key in data) {
            const targetId = key.replace(/_/g, '-');
            // Only target elements within the pre-store form
            const input = preStoreFormElement.querySelector(`#${targetId}`);

            if (input) {
                // Handle non-radio inputs - don't populate N/A or null values
                if (data[key] && data[key] !== 'N/A' && data[key] !== 'n/a' && data[key] !== 'na' && data[key] !== 'N/a' && data[key] !== 'null') {
                    input.value = data[key];
                }
            } else {
                // Handle radio button groups - don't populate N/A values
                const radioGroupNames = ['pallet-list', 'product-label', 'wrapping', 'layer-pad', 'contamination', 'kraft-paper', 'no-damage', 'pallet'];
                if (radioGroupNames.includes(targetId)) {
                    const radioValue = data[key];
                    if (radioValue && radioValue !== 'N/A' && radioValue !== 'n/a' && radioValue !== 'na' && radioValue !== 'N/a') {
                        const radioButtons = preStoreFormElement.querySelectorAll(`input[name="${targetId}"]`);
                        radioButtons.forEach(radio => {
                            if (radio.value.toLowerCase() === radioValue.toLowerCase()) {
                                radio.checked = true;
                            }
                        });
                    }
                }
            }
        }
    }

    // Function to get URL parameters
    function getUrlParameter(name) {
        name = name.replace(/[[\]]/g, '\$&');
        var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
            results = regex.exec(window.location.href);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, ' '));
    }

    // Check if there's an ID in the URL (for editing)
    preStoreFormId = getUrlParameter('id');

    // Load customers when page loads
    await loadCustomers();

    if (preStoreFormId) {
        // Fetch existing data for the form
        async function fetchFormData() {
            // Try to fetch from all five tables
            const [krantiResult, whiteResult, wwResult, jeddahResult, microWhite214Result, uc250pResult, uc290pResult, uc250wResult, uc210wResult, microWhite234Result, microWhite102Result] = await Promise.all([
                supabase
                    .from('168_16cp_kranti')
                    .select('*')
                    .eq('form_id', preStoreFormId)
                    .maybeSingle(),
                supabase
                    .from('168_16c_white')
                    .select('*')
                    .eq('form_id', preStoreFormId)
                    .maybeSingle(),
                supabase
                    .from('176_18cp_ww')
                    .select('*')
                    .eq('form_id', preStoreFormId)
                    .maybeSingle(),
                supabase
                    .from('168_18c_white_jeddah')
                    .select('*')
                    .eq('form_id', preStoreFormId)
                    .maybeSingle(),
                supabase
                    .from('214_18_micro_white')
                    .select('*')
                    .eq('form_id', preStoreFormId)
                    .maybeSingle(),
                supabase
                    .from('uc-18gsm-250p-abqr')
                    .select('*')
                    .eq('form_id', preStoreFormId)
                    .maybeSingle(),
                supabase
                    .from('uc-18gsm-290p-abqr')
                    .select('*')
                    .eq('form_id', preStoreFormId)
                    .maybeSingle(),
                supabase
                    .from('uc-18gsm-250w-bfqr')
                    .select('*')
                    .eq('form_id', preStoreFormId)
                    .maybeSingle(),
                supabase
                    .from('uc-18gsm-210w-bfqr')
                    .select('*')
                    .eq('form_id', preStoreFormId)
                    .maybeSingle(),
                supabase
                    .from('234_18_micro_white')
                    .select('*')
                    .eq('form_id', preStoreFormId)
                    .maybeSingle(),
                supabase
                    .from('102_18c_micro_white')
                    .select('*')
                    .eq('form_id', preStoreFormId)
                    .maybeSingle()
            ]);

            // Use the result that has data (not an error)
            let data = null;
            if (!krantiResult.error && krantiResult.data) {
                data = krantiResult.data;
            } else if (!whiteResult.error && whiteResult.data) {
                data = whiteResult.data;
            } else if (!wwResult.error && wwResult.data) {
                data = wwResult.data;
            } else if (!jeddahResult.error && jeddahResult.data) {
                data = jeddahResult.data;
            } else if (!microWhite214Result.error && microWhite214Result.data) {
                data = microWhite214Result.data;
            } else if (!uc250pResult.error && uc250pResult.data) {
                data = uc250pResult.data;
            } else if (!uc290pResult.error && uc290pResult.data) {
                data = uc290pResult.data;
            } else if (!uc250wResult.error && uc250wResult.data) {
                data = uc250wResult.data;
            } else if (!uc210wResult.error && uc210wResult.data) {
                data = uc210wResult.data;
            } else if (!microWhite234Result.error && microWhite234Result.data) {
                data = microWhite234Result.data;
            } else if (!microWhite102Result.error && microWhite102Result.data) {
                data = microWhite102Result.data;
            }

            if (!data) {
                console.error('Form data not found in any table');
                alert('Error loading data for editing: Form not found');
                return;
            }

            prePopulateForm(data);
        }
        fetchFormData();
    } else {
        // Check for film inspection data in sessionStorage for new entries
        const filmInspectionData = JSON.parse(sessionStorage.getItem('filmInspectionData'));

        if (filmInspectionData) {
            prePopulateForm(filmInspectionData);
            // Optionally clear sessionStorage after use if data is only needed once
            // sessionStorage.removeItem('filmInspectionData');
        }
    }

    // Pre-Store Form submission
    if (preStoreForm) {
        preStoreForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const formData = new FormData(preStoreForm);
            const preStoreFormData = {
                production_order: formData.get('production_order') || '',
                product_code: formData.get('product-code') || '',
                quantity: formData.get('quantity') || '',
                customer: formData.get('customer') || '',
                location: formData.get('location') || '',
                specification: formData.get('specification') || '',
                batch: formData.get('batch') || '',
                prestore_ref_no: formData.get('ref_no') || '', // Map ref_no to prestore_ref_no (matches schema)
                standard_packing: (formData.get('standard-packing') || '') + ' ' + (formData.get('standard-packing-unit') || ''),
                production_date: formData.get('production-date') || '',
                inspection_date: formData.get('inspection-date') || '',
                pallet_size: formData.get('pallet-size') || '',
                machine_no: formData.get('machine_no') || '',
                purchase_order: formData.get('purchase_order') || '',
                // lot_no field removed - not present in HTML form
                pallet_list: formData.get('pallet-list') || '',
                product_label: formData.get('product-label') || '',
                wrapping: formData.get('wrapping') || '',
                layer_pad: formData.get('layer-pad') || '',
                contamination: formData.get('contamination') || '',
                kraft_paper: formData.get('kraft-paper') || '',
                no_damage: formData.get('no-damage') || '',
                pallet: formData.get('pallet') || '',
                prestore_done_by: formData.get('prestore_done_by') || '',
                remarks: formData.get('remarks') || ''
            };

            // Keep lot_no as entered by user (no automatic prefix)

            // Merge filmInspectionData with preStoreFormData if it exists and we are not editing
            let finalData = { ...preStoreFormData };
            if (!preStoreFormId) { // Only merge from sessionStorage if it's a new entry
                const filmInspectionDataFromSession = JSON.parse(sessionStorage.getItem('filmInspectionData'));
                if (filmInspectionDataFromSession) {
                    finalData = { ...filmInspectionDataFromSession, ...preStoreFormData };
                }
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
                    finalData.prepared_by = user.email || 'Unknown User'; // Fallback to email
                } else if (profile && profile.full_name) {
                    finalData.prepared_by = profile.full_name;
                } else {
                    finalData.prepared_by = user.email || 'Unknown User'; // Fallback to email
                }
            } else {
                finalData.prepared_by = 'Unknown User'; // Fallback if user ID is not available
            }

            // Convert "N/A" values to empty strings for Excel compatibility, but keep N/A for radio buttons
            const radioFields = ['pallet_list', 'product_label', 'wrapping', 'layer_pad', 'contamination', 'kraft_paper', 'no_damage', 'pallet'];
            Object.keys(finalData).forEach(key => {
                const value = finalData[key];
                // Don't convert N/A to empty string for radio button fields - keep them as N/A
                if (value === 'N/A' || value === 'n/a' || value === 'na' || value === 'N/a') {
                    if (!radioFields.includes(key)) {
                        finalData[key] = ''; // Convert N/A to empty string for non-radio fields
                    }
                    // Keep N/A values for radio button fields
                }
            });


            // Products should be loaded by now, but continue if not (for robustness)

            // Determine the table name based on the selected product
            let tableName = '168_16cp_kranti'; // default table for pre-store form
            if (finalData.product_code) {
                // Map product codes to their specific tables
                const productTableMap = {
                    'APE-168(16)C': '168_16c_white',            // Updated to correct table
                    'APE-168(16)CP(KRANTI)': '168_16cp_kranti',  // Keep existing mapping
                    'APE-176(18)CP(LCC+WW)BS': '176_18cp_ww',    // New 18 GSM 176 WW product
                    'APE-168(18)C (Jeddah)': '168_18c_white_jeddah', // New Jeddah product
                    'WHITE-214(18)': '214_18_micro_white', // Existing 214 Micro White product
                    'INUE1C18-250P(AB-QR)': 'uc-18gsm-250p-abqr', // UC-18gsm-250P-ABQR form
                    'INUE1C18-290P(AB-QR)': 'uc-18gsm-290p-abqr', // UC-18gsm-290P-ABQR form
                    'INUE1C18-290NP(AB-QR)': 'uc-18gsm-290np-abqr', // UC-18gsm-290NP-ABQR form
                    'INUE1C18-250W(BF-QR)': 'uc-18gsm-250w-bfqr', // UC-18gsm-250W-BFQR form
                    'INUE1C18-210W(BF-QR)': 'uc-18gsm-210w-bfqr', // UC-18gsm-210W-BFQR form
                    'WHITE-234(18)': '234_18_micro_white', // New 234 Micro White product
                    'APE-102(18)C': '102_18c_micro_white', // New 102 Micro White product
                    'APE-168(18)C': '168_18c_white' // New 168 White product
                    // Add more product-specific tables as they are created
                };
                tableName = productTableMap[finalData.product_code];
                if (!tableName) {
                    console.error('Product code not found in mapping:', finalData.product_code);
                    console.error('Product code length:', finalData.product_code.length);
                    console.error('Product code char codes:', finalData.product_code.split('').map(c => c.charCodeAt(0)));
                    console.error('Available product codes:', Object.keys(productTableMap));
                    alert(`Error: No table mapping found for product code "${finalData.product_code}". Please contact administrator.`);
                    return;
                }
            }

            let upsertError = null;
            if (preStoreFormId) {
                // Update existing record
                const { error } = await supabase
                    .from(tableName)
                    .update(finalData)
                    .eq('form_id', preStoreFormId);
                upsertError = error;
            } else {
                // Insert new record
                const { error } = await supabase
                    .from(tableName)
                    .insert([finalData]);
                upsertError = error;
            }

            if (upsertError) {
                console.error('Error saving data:', upsertError.message);
                
                // Handle specific error types without browser popup
                if (upsertError.message.includes('duplicate key value violates unique constraint')) {
                    if (upsertError.message.includes('lot_no_key')) {
                        console.error('Duplicate lot number detected. Please use a different lot number.');
                        // You could show a user-friendly message in the UI instead of alert
                        // For now, just log to console to avoid browser popup
                    } else {
                        console.error('Duplicate key constraint violation:', upsertError.message);
                    }
                } else {
                    console.error('Database error:', upsertError.message);
                }
            } else {
                console.log('Data saved successfully!');
                if (!preStoreFormId) { // Only clear sessionStorage and reset form if it was a new entry
                    preStoreForm.reset();
                    sessionStorage.removeItem('filmInspectionData');
                }
                // Refresh the list
                if (typeof fetchFilmInspectionForms === 'function') {
                    await fetchFilmInspectionForms();
                } else {
                    // Fallback: reload the page to refresh the list
                    window.location.reload();
                }
            }
        });
    }

    // Function to download UC-18gsm-250P-ABQR Excel file
    window.downloadUC250PABQRExcel = async function(formId, buttonElement, productCode = null) {
        // Store original button state immediately
        const downloadBtn = buttonElement || event.target;
        const originalContent = downloadBtn.innerHTML;
        const originalTitle = downloadBtn.title;
        const originalDisabled = downloadBtn.disabled;

        try {
            // Show loading state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
            downloadBtn.title = 'Downloading...';
            downloadBtn.disabled = true;

            // Make API call to download UC-18gsm-250P-ABQR Excel
            // Use localhost for IDE testing, Render URL for production
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const backendUrl = isLocalhost ? 'http://localhost:3000' : 'https://swanson-backend.onrender.com';
            const downloadUrl = `${backendUrl}/export-uc-18gsm-250p-abqr-form?form_id=${encodeURIComponent(formId)}`;

            // Get the current session for authentication
            const session = await supabase.auth.getSession();
            const headers = {
                'Content-Type': 'application/json'
            };

            if (session.data.session?.access_token) {
                headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
            }

            // Make the request
            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Create blob and download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;

            // Use product code for dynamic filename, fallback to default if not provided
            const productName = productCode || 'UC-18gsm-250P-ABQR';
            a.download = `FIF-${productName}-.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);

            // Show success state briefly
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
            downloadBtn.title = 'Downloaded!';

            // Reset button after 2 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 2000);

        } catch (error) {
            console.error('Error downloading UC-18gsm-250P-ABQR Excel:', error);

            // Show error state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
            downloadBtn.title = 'Download failed';

            // Reset button after 3 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 3000);
        }
    };

    // Function to download UC-18gsm-250W-BFQR Excel file
    window.downloadUC250WBFQRExcel = async function(formId, buttonElement, productCode = null) {
        // Store original button state immediately
        const downloadBtn = buttonElement || event.target;
        const originalContent = downloadBtn.innerHTML;
        const originalTitle = downloadBtn.title;
        const originalDisabled = downloadBtn.disabled;

        try {
            // Show loading state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
            downloadBtn.title = 'Downloading...';
            downloadBtn.disabled = true;

            // Make API call to download UC-18gsm-250W-BFQR Excel
            // Use localhost for IDE testing, Render URL for production
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const backendUrl = isLocalhost ? 'http://localhost:3000' : 'https://swanson-backend.onrender.com';
            const downloadUrl = `${backendUrl}/export-uc-18gsm-250w-bfqr-form?form_id=${encodeURIComponent(formId)}`;

            // Get the current session for authentication
            const session = await supabase.auth.getSession();
            const headers = {
                'Content-Type': 'application/json'
            };

            if (session.data.session?.access_token) {
                headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
            }

            // Make the request
            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Create blob and download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;

            // Use product code for dynamic filename, fallback to default if not provided
            const productName = productCode || 'UC-18gsm-250W-BFQR';
            a.download = `FIF-${productName}-.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);

            // Show success state briefly
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
            downloadBtn.title = 'Downloaded!';

            // Reset button after 2 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 2000);

        } catch (error) {
            console.error('Error downloading UC-18gsm-250W-BFQR Excel:', error);

            // Show error state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
            downloadBtn.title = 'Download failed';

            // Reset button after 3 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 3000);
        }
    };

    // Function to download UC-18gsm-290P-ABQR Excel file
    window.downloadUC290PABQRExcel = async function(formId, buttonElement, productCode = null) {
        // Store original button state immediately
        const downloadBtn = buttonElement || event.target;
        const originalContent = downloadBtn.innerHTML;
        const originalTitle = downloadBtn.title;
        const originalDisabled = downloadBtn.disabled;

        try {
            // Show loading state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
            downloadBtn.title = 'Downloading...';
            downloadBtn.disabled = true;

            // Make API call to download UC-18gsm-290P-ABQR Excel
            // Use localhost for IDE testing, Render URL for production
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const backendUrl = isLocalhost ? 'http://localhost:3000' : 'https://swanson-backend.onrender.com';
            const downloadUrl = `${backendUrl}/export-uc-18gsm-290p-abqr-form?form_id=${encodeURIComponent(formId)}`;

            // Get the current session for authentication
            const session = await supabase.auth.getSession();
            const headers = {
                'Content-Type': 'application/json'
            };

            if (session.data.session?.access_token) {
                headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
            }

            // Make the request
            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Create blob and download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;

            // Use product code for dynamic filename, fallback to default if not provided
            const productName = productCode || 'UC-18gsm-290P-ABQR';
            a.download = `FIF-${productName}-.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);

            // Show success state briefly
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
            downloadBtn.title = 'Downloaded!';

            // Reset button after 2 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 2000);

        } catch (error) {
            console.error('Error downloading UC-18gsm-290P-ABQR Excel:', error);

            // Show error state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
            downloadBtn.title = 'Download failed';

            // Reset button after 3 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 3000);
        }
    };

    // Function to download UC-18gsm-290NP-ABQR Excel file
    window.downloadUC290NPABQRExcel = async function(formId, buttonElement, productCode = null) {
        // Store original button state immediately
        const downloadBtn = buttonElement || event.target;
        const originalContent = downloadBtn.innerHTML;
        const originalTitle = downloadBtn.title;
        const originalDisabled = downloadBtn.disabled;

        try {
            // Show loading state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
            downloadBtn.title = 'Downloading...';
            downloadBtn.disabled = true;

            // Make API call to download UC-18gsm-290NP-ABQR Excel
            // Use localhost for IDE testing, Render URL for production
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const backendUrl = isLocalhost ? 'http://localhost:3000' : 'https://swanson-backend.onrender.com';
            const downloadUrl = `${backendUrl}/export-uc-18gsm-290np-abqr-form?form_id=${encodeURIComponent(formId)}`;

            // Get the current session for authentication
            const session = await supabase.auth.getSession();
            const headers = {
                'Content-Type': 'application/json'
            };

            if (session.data.session?.access_token) {
                headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
            }

            // Make the request
            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Create blob and download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;

            // Use product code for dynamic filename, fallback to default if not provided
            const productName = productCode || 'UC-18gsm-290NP-ABQR';
            const filename = `FIF-${productName}-.xlsx`;
            a.download = filename;

            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Show success state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
            downloadBtn.title = 'Downloaded successfully';
            downloadBtn.classList.add('text-green-600');

            // Reset button after delay
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
                downloadBtn.classList.remove('text-green-600');
            }, 3000);
        } catch (error) {
            console.error('Error downloading UC-18gsm-290NP-ABQR Excel:', error);

            // Show error state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
            downloadBtn.title = 'Download failed';
            downloadBtn.classList.add('text-red-600');

            // Reset button after delay
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
                downloadBtn.classList.remove('text-red-600');
            }, 3000);
        }
    };

    // Function to download UC-18gsm-210W-BFQR Excel file
    window.downloadUC210WBFQRExcel = async function(formId, buttonElement, productCode = null) {
        // Store original button state immediately
        const downloadBtn = buttonElement || event.target;
        const originalContent = downloadBtn.innerHTML;
        const originalTitle = downloadBtn.title;
        const originalDisabled = downloadBtn.disabled;

        try {
            // Show loading state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
            downloadBtn.title = 'Downloading...';
            downloadBtn.disabled = true;

            // Make API call to download UC-18gsm-210W-BFQR Excel
            // Use localhost for IDE testing, Render URL for production
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const backendUrl = isLocalhost ? 'http://localhost:3000' : 'https://swanson-backend.onrender.com';
            const downloadUrl = `${backendUrl}/export-uc-18gsm-210w-bfqr-form?form_id=${encodeURIComponent(formId)}`;

            // Get the current session for authentication
            const session = await supabase.auth.getSession();
            const headers = {
                'Content-Type': 'application/json'
            };

            if (session.data.session?.access_token) {
                headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
            }

            // Make the request
            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Create blob and download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;

            // Use product code for dynamic filename, fallback to default if not provided
            const productName = productCode || 'UC-18gsm-210W-BFQR';
            a.download = `FIF-${productName}-.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);

            // Show success state briefly
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
            downloadBtn.title = 'Downloaded!';

            // Reset button after 2 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 2000);

        } catch (error) {
            console.error('Error downloading UC-18gsm-210W-BFQR Excel:', error);

            // Show error state
            downloadBtn.innerHTML = '<svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
            downloadBtn.title = 'Download failed';

            // Reset button after 3 seconds
            setTimeout(() => {
                downloadBtn.innerHTML = originalContent;
                downloadBtn.title = originalTitle;
                downloadBtn.disabled = originalDisabled;
            }, 3000);
        }
    };
