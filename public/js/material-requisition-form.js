import { supabase } from '../supabase-config.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Validate Session FIRST and wait
    const user = await validateSession();
    if (!user) return; // Exit immediately if no user

    // Setup back button
    const backBtn = document.querySelector('.header-back-button');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'material-requisition-form-list.html';
        });
    }

    // 2. Check for edit/view mode
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const recordId = urlParams.get('id');

    if (action && recordId) {
        await loadExistingRequisition(recordId, action);
    } else {
        initForm(user);
    }

    // 3. Setup Event Listeners
    setupEventListeners();
});

async function validateSession() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
            window.location.replace('auth.html');
            return null;
        }
        return user;
    } catch (error) {
        console.error('Session validation error:', error);
        window.location.replace('auth.html');
        return null;
    }
}

async function loadExistingRequisition(recordId, action) {
    const form = document.getElementById('requisitionForm');
    try {
        // Show loading state
        form.style.opacity = '0.5';
        form.style.pointerEvents = 'none';

        // 1. Load header data
        const { data: header, error: headerError } = await supabase
            .from('material_requisitions')
            .select('*')
            .eq('id', recordId)
            .single();

        if (headerError) {
            console.error('Error loading requisition header:', headerError);
            alert('Error loading requisition data: ' + headerError.message);
            window.location.href = 'material-requisition-form-list.html';
            return;
        }

        // 2. Load items data
        const { data: items, error: itemsError } = await supabase
            .from('material_requisition_items')
            .select('*')
            .eq('requisition_id', recordId)
            .order('row_index', { ascending: true }); // <--- SORT BY ROW INDEX

        if (itemsError) {
            console.error('Error loading requisition items:', itemsError);
            alert('Error loading requisition items: ' + itemsError.message);
            window.location.href = 'material-requisition-form-list.html';
            return;
        }

        // 3. Populate form with loaded data
        populateFormWithData(header, items, action);

        // 4. Setup form mode (view/edit)
        await setupFormMode(action, header);

    } catch (error) {
        console.error('Error loading requisition:', error);
        alert('Error loading requisition: ' + error.message);
        window.location.href = 'material-requisition-form-list.html';
    } finally {
        // Remove loading state
        form.style.opacity = '1';
        form.style.pointerEvents = 'auto';
    }
}

function populateFormWithData(header, items, action) {
    // Populate header fields
    document.getElementById('requisitionNo').value = header.requisition_no || '';
    document.getElementById('requisitionDate').value = header.requisition_date ? header.requisition_date.split('T')[0] : '';
    document.getElementById('requiredBefore').value = header.required_before ? header.required_before.split('T')[0] : '';
    document.getElementById('requesterDept').value = header.requester_dept || '';
    document.getElementById('requestedBy').value = header.requested_by || '';

    // Warehouse fields
    document.getElementById('issuedDate').value = header.issued_date ? header.issued_date.split('T')[0] : '';
    document.getElementById('issuedBy').value = header.issued_by || '';

    // Clear existing table rows
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    // Populate items
    if (items && items.length > 0) {
        items.forEach(item => {
            addRowWithData(item);
        });
    }

    // Update empty table message
    updateSrNumbers();
}

function addRowWithData(item) {
    const tbody = document.getElementById('tableBody');
    const rowCount = tbody.rows.length + 1;
    const row = document.createElement('tr');
    
    row.innerHTML = `
        <td class="text-center font-bold">${rowCount}</td>
        <td>
            <input type="text" name="description[]" value="${item.description || ''}" 
                   placeholder="Material Description" autocomplete="off"
                   data-mid="${item.material_id || ''}" 
                   data-uom="${item.uom || 'Nos'}"
                   data-cat="${item.uom === 'Kgs' ? 'raw material' : ''}">
        </td>
        <td>
            <input type="text" name="lotNo[]" value="${item.lot_no || ''}" class="text-center" placeholder="Lot No" autocomplete="off">
        </td>
        <td>
            <input type="number" name="reqQty[]" value="${item.req_qty || ''}" class="text-center" placeholder="0" min="0" step="0.01" autocomplete="off">
        </td>
        <td>
            <input type="number" name="issuedQty[]" value="${item.issued_qty || ''}" class="text-center" placeholder="0" min="0" step="0.01" autocomplete="off">
        </td>
    `;

    tbody.appendChild(row);

    const descriptionInput = row.querySelector('input[name="description[]"]');
    if (descriptionInput) {
        setupMaterialAutocomplete(descriptionInput);
    }
}

async function setupFormMode(action, header) {
    const formTitle = document.querySelector('.header-title'); // The top blue bar
    const pageTitle = document.querySelector('h1'); // The header on the white card
    const submitBtn = document.querySelector('button[type="submit"]');
    const addRowBtn = document.getElementById('addRowBtn');
    const deleteRowBtn = document.getElementById('deleteRowBtn');
    const warehouseSection = document.getElementById('warehouseSection');

    // 1. STANDARD PROFESSIONAL TITLE (No more "Warehouse Mode" text)
    const standardTitle = 'Material Requisition Cum Issue Slip';
    if(formTitle) formTitle.textContent = standardTitle;
    if(pageTitle) pageTitle.textContent = standardTitle;

    if (action === 'view') {
        // VIEW MODE: Lock Everything
        formTitle.textContent = 'View Material Requisition';
        if (submitBtn) submitBtn.style.display = 'none';

        document.querySelectorAll('input, select, textarea').forEach(input => {
            input.disabled = true;
            input.classList.add('bg-gray-100', 'cursor-not-allowed');
        });
        if (addRowBtn) addRowBtn.style.display = 'none';
        if (deleteRowBtn) deleteRowBtn.style.display = 'none';
        
        // SHOW warehouse section in view mode IF it was already issued
        if (header.status === 'ISSUED' && warehouseSection) {
            warehouseSection.classList.remove('hidden');
        }

    } else if (action === 'edit') {

        // 1. GET USER ROLE FIRST
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
            .from('users')
            .select('full_name, department')
            .eq('id', user.id)
            .single();

        const isWarehouse = profile && profile.department && profile.department.toLowerCase().includes('warehouse');
        const currentStatus = header.status || 'REQUESTED';

        // Update status display
        const statusDisplay = document.getElementById('statusDisplay');
        if (statusDisplay) {
            statusDisplay.textContent = currentStatus;
            statusDisplay.className = `status-badge status-${currentStatus.toLowerCase()}`;
            statusDisplay.style.display = 'inline-block';
        }

        // 2. CHECK: Is the Requisition already locked?
        // If it is ISSUED or APPROVED, nobody can edit (except maybe Admin, but let's keep it strict)
        if (currentStatus === 'ISSUED' || currentStatus === 'APPROVED') {
             formTitle.textContent = `View ${currentStatus} Requisition`;
             if (submitBtn) submitBtn.style.display = 'none';
             applyEditLocks(false, currentStatus); // Lock everything for completed requisitions
             return;
        }

        // LOGIC: Show warehouse section ONLY if user is Warehouse 
        // OR if the record is already issued
        if (warehouseSection) {
            if (isWarehouse || currentStatus === 'ISSUED') {
                warehouseSection.classList.remove('hidden');
            } else {
                warehouseSection.classList.add('hidden');
            }
        }

        // 3. WAREHOUSE LOGIC
        if (isWarehouse) {
            // A. Auto-Fill Issue Details if empty
            const issuedDateInput = document.getElementById('issuedDate');
            const issuedByInput = document.getElementById('issuedBy');

            if (!issuedDateInput.value) {
                issuedDateInput.value = new Date().toISOString().split('T')[0]; // Today
            }
            if (!issuedByInput.value) {
                issuedByInput.value = profile.full_name; // Current User
            }

            // ENABLE SPLIT FEATURE
            enableWarehouseSplit(); // <--- ADD THIS LINE HERE

            // B. Button Text
            if (submitBtn) {
                submitBtn.style.display = 'inline-flex';
                submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Issue Material'; // Professional Text
                submitBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                submitBtn.classList.add('bg-green-700', 'hover:bg-green-800'); // Green for "Action"
            }
        } else {
            // GSE LOGIC
            if (submitBtn) {
                submitBtn.style.display = 'inline-flex';
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Request';
            }
        }

        // 4. APPLY FIELD LOCKS
        applyEditLocks(isWarehouse, currentStatus);
    }
}

function applyEditLocks(isWarehouse, status) {
    // GSE can edit request details ONLY if status is REQUESTED
    const canEditRequest = !isWarehouse && (status === 'REQUESTED' || status === 'DRAFT');

    // Warehouse can edit issue details ONLY if they are Warehouse
    const canEditIssue = isWarehouse;

    // --- 1. HEADER FIELDS ---
    document.getElementById('requisitionDate').disabled = !canEditRequest;
    document.getElementById('requiredBefore').disabled = !canEditRequest;
    // Requester Name/Dept always locked in edit mode to prevent identity swapping
    document.getElementById('requesterDept').disabled = true;
    document.getElementById('requestedBy').disabled = true;

    // Warehouse fields
    const issuedDate = document.getElementById('issuedDate');
    const issuedBy = document.getElementById('issuedBy');

    issuedDate.disabled = !canEditIssue;
    issuedBy.disabled = !canEditIssue;

    if (canEditIssue) {
        issuedDate.classList.remove('bg-gray-100');
        issuedBy.classList.remove('bg-gray-100');
    } else {
        issuedDate.classList.add('bg-gray-100');
        issuedBy.classList.add('bg-gray-100');
    }

    // --- 2. TABLE COLUMNS ---
    const rows = document.querySelectorAll('#tableBody tr');
    rows.forEach(row => {
        const descInput = row.querySelector('input[name="description[]"]');
        const reqQtyInput = row.querySelector('input[name="reqQty[]"]');
        const lotInput = row.querySelector('input[name="lotNo[]"]');
        const issQtyInput = row.querySelector('input[name="issuedQty[]"]');

        // Just disable them. Do NOT add 'bg-gray-100'.
        // The CSS rule ".modern-table input:disabled" will handle the styling subtly.

        if(descInput) descInput.disabled = !canEditRequest;
        if(reqQtyInput) reqQtyInput.disabled = !canEditRequest;

        if(lotInput) {
            lotInput.disabled = !canEditIssue;
            // Highlights for active Warehouse entry (Optional: Keep Yellow if helpful, remove if you want 100% plain)
            if(canEditIssue) lotInput.classList.add('bg-yellow-50');
        }
        if(issQtyInput) {
            issQtyInput.disabled = !canEditIssue;
            // Highlights for active Warehouse entry (Optional: Keep Yellow if helpful, remove if you want 100% plain)
            if(canEditIssue) issQtyInput.classList.add('bg-yellow-50');
        }
    });

    // --- 3. ROW BUTTONS ---
    // Only GSE can add/delete rows, and only if editing is allowed
    const addRowBtn = document.getElementById('addRowBtn');
    const deleteRowBtn = document.getElementById('deleteRowBtn');

    if (addRowBtn) addRowBtn.style.display = canEditRequest ? 'inline-flex' : 'none';
    if (deleteRowBtn) deleteRowBtn.style.display = canEditRequest ? 'inline-flex' : 'none';
}

async function initForm(user) {
    // Set current date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('requisitionDate').value = today;

    // Auto-populate user info
    try {
        const { data: profile, error } = await supabase
            .from('users')
            .select('full_name, department')
            .eq('id', user.id)
            .single();

        if (profile) {
            document.getElementById('requestedBy').value = profile.full_name || '';
            document.getElementById('requesterDept').value = profile.department || '';
            
            // Auto-populate Issued By for warehouse users
            if (profile.department && profile.department.toLowerCase().includes('warehouse')) {
                document.getElementById('issuedBy').value = profile.full_name || '';
            }
            
            // Apply department-based field restrictions
            applyDepartmentRestrictions(profile.department);
        } else {
            // Fallback if profile not found
            document.getElementById('requestedBy').value = user.email.split('@')[0];
        }
    } catch (error) {
        console.error('Error fetching profile:', error);
    }

    // Generate Requisition No with accounting year format
    const reqNo = await generateRequisitionNumber();
    document.getElementById('requisitionNo').value = reqNo;

    // Add initial 0 rows (changed from 5)
    // Users can add rows as needed
    
    // Show empty table message initially
    updateSrNumbers();
}

function setupEventListeners() {
    // Add Row Button
    document.getElementById('addRowBtn').addEventListener('click', addRow);

    // Delete Row Button
    document.getElementById('deleteRowBtn').addEventListener('click', deleteLastRow);

    // Print Button
    document.getElementById('printBtn').addEventListener('click', handlePrint);

    // Share PDF Button
    document.getElementById('shareBtn').addEventListener('click', handleSharePdf);

    // Form Submission
    document.getElementById('requisitionForm').addEventListener('submit', handleFormSubmit);
}

function addRow() {
    const tbody = document.getElementById('tableBody');
    const rowCount = tbody.rows.length + 1;
    const row = document.createElement('tr');

    const disabledColumns = window.disabledColumns || [];
    const descriptionDisabled = disabledColumns.includes('description') ? 'disabled' : '';
    const reqQtyDisabled = disabledColumns.includes('reqQty') ? 'disabled' : '';
    const lotNoDisabled = disabledColumns.includes('lotNo') ? 'disabled' : '';
    const issuedQtyDisabled = disabledColumns.includes('issuedQty') ? 'disabled' : '';

    row.innerHTML = `
        <td class="text-center font-bold">${rowCount}</td>
        <td><input type="text" name="description[]" autocomplete="off" ${descriptionDisabled}></td>
        <td><input type="text" name="lotNo[]" class="text-center" autocomplete="off" ${lotNoDisabled}></td>
        <td><input type="number" name="reqQty[]" class="text-center" autocomplete="off" ${reqQtyDisabled}></td>
        <td><input type="number" name="issuedQty[]" class="text-center" autocomplete="off" ${issuedQtyDisabled}></td>
    `;

    tbody.appendChild(row);

    const descriptionInput = row.querySelector('input[name="description[]"]');
    if (descriptionInput) {
        setupMaterialAutocomplete(descriptionInput);
    }

    updateSrNumbers();
}

async function generateRequisitionNumber() {
    try {
        // Get the count of existing requisitions to generate sequential number
        const { count, error } = await supabase
            .from('material_requisitions')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('Error getting requisition count:', error);
            // Fallback to random if database query fails
            const fallbackNumber = Math.floor(1 + Math.random() * 999);
            return fallbackNumber.toString().padStart(3, '0');
        }

        // Generate sequential number starting from 001
        const sequentialNumber = (count || 0) + 1;
        return sequentialNumber.toString().padStart(3, '0');

    } catch (error) {
        console.error('Error generating requisition number:', error);
        // Fallback to random if something goes wrong
        const fallbackNumber = Math.floor(1 + Math.random() * 999);
        return fallbackNumber.toString().padStart(3, '0');
    }
}

function applyDepartmentRestrictions(department) {
    const dept = department ? department.toLowerCase() : '';
    const issuedDateInput = document.getElementById('issuedDate');
    const issuedByInput = document.getElementById('issuedBy');
    
    if (dept.includes('warehouse')) {
        // Disable MATERIAL DESCRIPTION & REQUESTED QTY for warehouse
        disableTableColumns(['description', 'reqQty']);
        
        // FIX: Use .disabled instead of readonly for consistency with applyEditLocks
        if (issuedDateInput) {
            issuedDateInput.disabled = false; 
            issuedDateInput.classList.remove('bg-gray-100');
            issuedDateInput.classList.add('bg-white');
        }
        if (issuedByInput) {
            issuedByInput.disabled = false;
            issuedByInput.classList.remove('bg-gray-100');
            issuedByInput.classList.add('bg-white');
        }
    } else {
        // For other departments (like Production, Quality), disable LOT NO & ISSUED QTY
        disableTableColumns(['lotNo', 'issuedQty']);
        
        if (issuedDateInput) {
            issuedDateInput.disabled = true;
            issuedDateInput.classList.remove('bg-white');
            issuedDateInput.classList.add('bg-gray-100');
        }
        if (issuedByInput) {
            issuedByInput.disabled = true;
            issuedByInput.classList.remove('bg-white');
            issuedByInput.classList.add('bg-gray-100');
        }
    }
}

function disableTableColumns(columnNames) {
    // This will be applied when rows are added
    // Store the disabled columns for future row additions
    window.disabledColumns = columnNames;
}

function deleteLastRow() {
    const tbody = document.getElementById('tableBody');
    const rows = tbody.rows;
    
    if (rows.length > 0) {
        tbody.deleteRow(-1); // Delete last row
        updateSrNumbers(); // This now correctly handles the "Add rows" message visibility
    }
}

function updateSrNumbers() {
    const tbody = document.getElementById('tableBody');
    const rows = tbody.rows;
    const emptyMessage = document.getElementById('emptyTableMessage');

    // Toggle message visibility
    if (emptyMessage) {
        emptyMessage.style.display = rows.length === 0 ? 'block' : 'none';
    }

    // Update all serial numbers in one loop
    Array.from(rows).forEach((row, index) => {
        if (row.cells[0]) {
            row.cells[0].textContent = index + 1;
        }
    });
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Validate required fields
    const requiredBefore = document.getElementById('requiredBefore').value;
    if (!requiredBefore) {
        showToast('Please select a "Required Before" date.', true);
        document.getElementById('requiredBefore').focus();
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return; // Prevent double submission

    submitBtn.disabled = true;
    const originalBtnHTML = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        const recordId = urlParams.get('id');
        const isEditMode = action === 'edit' && recordId;

        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('users').select('department').eq('id', user.id).single();
        const isWarehouse = profile?.department?.toLowerCase().includes('warehouse');

        const headerData = {
            requisition_no: document.getElementById('requisitionNo').value,
            requisition_date: document.getElementById('requisitionDate').value,
            required_before: document.getElementById('requiredBefore').value || null,
            requester_dept: document.getElementById('requesterDept').value,
            requested_by: document.getElementById('requestedBy').value,
            issued_date: document.getElementById('issuedDate').value || null,
            issued_by: document.getElementById('issuedBy').value || null,
            status: isWarehouse ? 'ISSUED' : 'REQUESTED'
        };

        let currentId = recordId;

        if (isEditMode) {
            const { error: headerError } = await supabase.from('material_requisitions').update(headerData).eq('id', recordId);
            if (headerError) throw headerError;
            await supabase.from('material_requisition_items').delete().eq('requisition_id', recordId);
        } else {
            const { data: header, error: headerError } = await supabase.from('material_requisitions').insert([headerData]).select().single();
            if (headerError) throw headerError;
            currentId = header.id;
        }

        const rows = document.querySelectorAll('#tableBody tr');
        const itemsToInsert = Array.from(rows).map((row, index) => {
            const descInput = row.querySelector('input[name="description[]"]');
            const desc = descInput?.value.trim();
            if (!desc) return null;

            // 1. Check for Category (from autocomplete) or existing UOM (from database load)
            const category = (descInput.getAttribute('data-cat') || '').toLowerCase();
            const existingUom = descInput.getAttribute('data-uom');
            
            // 2. Logic: If it was already Kgs in the DB, KEEP IT Kgs.
            let finalUom = existingUom || 'Nos'; 

            // 3. Override if we explicitly know it's a Raw Material/Ink/Resin
            if (category.includes('raw material') || category.includes('resin') || 
                category.includes('ink') || category.includes('print') || 
                category.includes('reducer')) {
                finalUom = 'Kgs';
            }

            return {
                requisition_id: currentId,
                description: desc,
                lot_no: row.querySelector('input[name="lotNo[]"]').value || '',
                req_qty: parseFloat(row.querySelector('input[name="reqQty[]"]').value) || 0,
                issued_qty: parseFloat(row.querySelector('input[name="issuedQty[]"]').value) || 0,
                row_index: index,
                material_id: descInput.getAttribute('data-mid'), // CRITICAL FOR TRIGGER STEP 2
                uom: finalUom, // STOP THE MOTHERFUCKING OVERRIDE
                bags: 0 
            };
        }).filter(item => item !== null);

        if (itemsToInsert.length > 0) {
            const { error: itemsError } = await supabase.from('material_requisition_items').insert(itemsToInsert);
            if (itemsError) throw itemsError;
        }

        showToast(isEditMode ? 'Updated Successfully!' : 'Saved Successfully!');
        setTimeout(() => window.location.href = 'material-requisition-form-list.html', 1500);

    } catch (error) {
        console.error('Error:', error);
        showToast('Error: ' + error.message, true);
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHTML;
    }
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.display = 'block';
    toast.style.backgroundColor = isError ? '#dc3545' : '#28a745';

    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

async function fetchMaterialSuggestions(searchTerm = '') {
    try {
        let query = supabase
            .from('pd_material_catalog')
            .select('id, material_name, material_category, uom') // FETCH CATEGORY
            .ilike('material_name', `%${searchTerm}%`)
            .eq('is_active', true)
            .order('material_name')
            .limit(10);

        const { data, error } = await query;
        if (error) throw error;

        // Return the full object so we can use the extra data
        return data || [];
    } catch (error) {
        console.error('Error in fetchMaterialSuggestions:', error);
        return [];
    }
}

// Setup material autocomplete for a description input
function setupMaterialAutocomplete(descriptionInput) {
    if (!descriptionInput || descriptionInput.hasAttribute('data-autocomplete-set')) {
        return; // Already has autocomplete
    }

    // Mark as having autocomplete to avoid duplicates
    descriptionInput.setAttribute('data-autocomplete-set', 'true');

    let suggestionTimeout;
    descriptionInput.addEventListener('input', async (e) => {
        // Check if suggestions should be prevented
        if (descriptionInput.hasAttribute('data-prevent-suggestions')) {
            return;
        }
        
        clearTimeout(suggestionTimeout);
        const searchTerm = e.target.value.trim();

        suggestionTimeout = setTimeout(async () => {
            // Hide any existing suggestions first
            const existingDropdown = document.querySelector('.material-suggestions');
            if (existingDropdown) {
                existingDropdown.remove();
            }

            if (searchTerm.length >= 1) {
                const suggestions = await fetchMaterialSuggestions(searchTerm);
                showMaterialSuggestions(descriptionInput, suggestions);
            }
        }, 300); // Debounce for 300ms
    });

    // Handle blur to hide suggestions
    descriptionInput.addEventListener('blur', () => {
        // Delay hiding to allow click events on suggestions to fire first
        setTimeout(() => {
            const dropdown = document.querySelector('.material-suggestions');
            if (dropdown) {
                dropdown.remove();
            }
        }, 150);
    });
    
    // Also handle focus to show suggestions for existing content
    descriptionInput.addEventListener('focus', async (e) => {
        if (descriptionInput.hasAttribute('data-prevent-suggestions')) {
            return;
        }
        
        const searchTerm = e.target.value.trim();
        if (searchTerm.length >= 1) {
            // Clear any existing timeout
            clearTimeout(suggestionTimeout);
            
            suggestionTimeout = setTimeout(async () => {
                const suggestions = await fetchMaterialSuggestions(searchTerm);
                showMaterialSuggestions(descriptionInput, suggestions);
            }, 200);
        }
    });
}

// Create and show material suggestions dropdown
function showMaterialSuggestions(inputElement, suggestions) {
    // Remove existing dropdown
    const existingDropdown = document.querySelector('.material-suggestions');
    if (existingDropdown) {
        existingDropdown.remove();
    }

    if (suggestions.length === 0) return;

    // Create dropdown with styling similar to inline inspection form
    const dropdown = document.createElement('div');
    dropdown.className = 'material-suggestions border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto';
    dropdown.style.background = '#eaf4fb'; // Light blue background
    dropdown.style.position = 'fixed';
    dropdown.style.zIndex = '9999';
    dropdown.style.minWidth = '250px';

    suggestions.forEach(suggestion => {
        const item = document.createElement('div');
        item.className = 'suggestion-item px-3 py-2 hover:bg-blue-200 cursor-pointer text-sm';
        item.textContent = suggestion.material_name;
        item.addEventListener('click', () => {
            inputElement.setAttribute('data-prevent-suggestions', 'true');
            inputElement.value = suggestion.material_name;
            
            // THE FIX: Store the category so the Save button can see it
            inputElement.setAttribute('data-mid', suggestion.id);
            inputElement.setAttribute('data-uom', suggestion.uom || 'Nos');
            inputElement.setAttribute('data-cat', suggestion.material_category || ''); // CRITICAL
            
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            if (dropdown.parentNode) dropdown.remove();
            setTimeout(() => inputElement.removeAttribute('data-prevent-suggestions'), 500);
        });
        dropdown.appendChild(item);
    });

    // Add to DOM first to get dimensions
    document.body.appendChild(dropdown);

    // Position dropdown relative to input (accounting for scroll position)
    const rect = inputElement.getBoundingClientRect();
    const dropdownHeight = dropdown.offsetHeight;
    const viewportHeight = window.innerHeight;
    const scrollY = window.scrollY;

    // Position below by default, but above if not enough space
    let top;
    if (rect.bottom + dropdownHeight > viewportHeight && rect.top - dropdownHeight > 0) {
        // Position above input
        top = scrollY + rect.top - dropdownHeight - 2;
    } else {
        // Position below input
        top = scrollY + rect.bottom + 2;
    }

    // Set final position
    Object.assign(dropdown.style, {
        left: rect.left + 'px',
        top: (window.scrollY + rect.bottom + 2) + 'px', // Adjusted for scroll position
        width: Math.max(rect.width, 250) + 'px'
    });

    // Close dropdown when clicking outside
    const closeDropdown = (e) => {
        if (!dropdown.contains(e.target) && e.target !== inputElement && !e.target.closest('.suggestion-item')) {
            if (dropdown.parentNode) dropdown.remove();
            document.removeEventListener('click', closeDropdown);
        }
    };
    setTimeout(() => document.addEventListener('click', closeDropdown), 100);
}

// Initialize material autocomplete for all existing description inputs
function initializeMaterialAutocomplete() {
    const descriptionInputs = document.querySelectorAll('input[name="description[]"]');
    descriptionInputs.forEach(input => {
        setupMaterialAutocomplete(input);
    });
}

function enableWarehouseSplit() {
    // 1. Find the table rows
    const rows = document.querySelectorAll('#tableBody tr');
    
    rows.forEach(row => {
        // Check if we already added the button to avoid duplicates
        if (row.querySelector('.split-btn')) return;

        // 2. Find the Issued Qty cell (last cell, index 4)
        const issueCell = row.cells[4]; 
        
        // 3. Get the existing input element inside the cell
        const input = issueCell.querySelector('input');
        if (!input) return;

        // 4. Create a Flex Wrapper (DIV)
        // We put this INSIDE the cell, so the cell keeps its table-cell behavior
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.width = '100%';
        wrapper.style.height = '100%';

        // 5. Move the Input into the Wrapper
        // Important: Set input width to auto and flex-grow so it fills space
        input.style.width = 'auto';
        input.style.flex = '1'; 
        wrapper.appendChild(input);

        // 6. Create the Split Button
        const splitBtn = document.createElement('button');
        splitBtn.type = 'button';
        splitBtn.className = 'split-btn ml-2 text-blue-600 hover:text-blue-800 text-xs font-bold';
        splitBtn.innerHTML = '<i class="fas fa-level-down-alt transform rotate-90"></i> Split';
        splitBtn.title = 'Split this lot into multiple batches';
        splitBtn.style.marginLeft = '4px';
        splitBtn.style.whiteSpace = 'nowrap'; // Keep text on one line
        
        splitBtn.onclick = function() {
            splitRow(row);
        };

        // 7. Add Button to Wrapper
        wrapper.appendChild(splitBtn);

        // 8. Finally, clear the cell and add the wrapper
        // This ensures the TD stays a TD, preserving the black border
        issueCell.appendChild(wrapper);
    });
}

function splitRow(parentRow) {
    const tbody = document.getElementById('tableBody');

    // 1. Clone the row
    const newRow = parentRow.cloneNode(true);

    // 2. Clean up the cloned row inputs
    const inputs = newRow.querySelectorAll('input');
    inputs[0].value = parentRow.querySelector('input[name="description[]"]').value;
    inputs[0].disabled = true;

    inputs[1].value = ''; // Clear Lot No
    inputs[1].disabled = false;
    inputs[1].classList.add('bg-yellow-50');

    inputs[2].value = 0; // Clear Requested Qty
    inputs[2].disabled = true;

    inputs[3].value = ''; // Clear Issued Qty
    inputs[3].disabled = false;
    inputs[3].classList.add('bg-yellow-50');

    // 3. HANDLE THE BUTTONS
    const wrapper = newRow.cells[4].querySelector('div');
    if (wrapper) {
        wrapper.innerHTML = ''; 
        wrapper.appendChild(inputs[3]);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'ml-2 text-red-600 hover:text-red-800 transition';
        removeBtn.innerHTML = '<i class="fas fa-times-circle"></i>';
        removeBtn.title = 'Remove this split';
        removeBtn.onclick = function() {
            newRow.remove(); // Simply delete this specific row
            updateSrNumbers(); // Update serial numbers after row removal
        };
        wrapper.appendChild(removeBtn);
    }

    // 4. Insert AFTER the parent row
    parentRow.parentNode.insertBefore(newRow, parentRow.nextSibling);

    // FIX: Re-run serial numbers so the UI and DB index stay in sync
    updateSrNumbers(); 
}

function handleSharePdf() {
    // 1. Get Elements & Basic Data
    const reqNo = document.getElementById('requisitionNo').value || 'New-Req';
    const filename = `Requisition-${reqNo}.pdf`;
    const element = document.getElementById('requisitionForm');
    const shareBtn = document.getElementById('shareBtn');
    
    // Create the formatted date immediately for the Email and PDF
    const rawDate = document.getElementById('requisitionDate').value;
    const formattedDate = rawDate ? rawDate.split('-').reverse().join('/') : ''; 

    // Find the button container to hide it
    const buttonContainer = document.getElementById('formActions');

    // 2. PREPARE UI
    const originalBtnText = shareBtn.innerHTML;
    shareBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    shareBtn.disabled = true;

    if(buttonContainer) buttonContainer.style.display = 'none';

    // --- FORCE DATES TO DD/MM/YYYY FOR PDF ---
    const dateInputs = element.querySelectorAll('input[type="date"]');
    const originalDateStates = [];

    dateInputs.forEach(input => {
        originalDateStates.push({
            element: input,
            originalValue: input.value,
        });

        if (input.value) {
            const parts = input.value.split('-');
            if (parts.length === 3) {
                input.type = 'text';
                input.value = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
        }
    });

    window.scrollTo(0, 0);

    const opt = {
        margin:       [5, 10, 5, 10],
        filename:     filename,
        image:        { type: 'jpeg', quality: 1 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    // 3. Generate PDF and then Open Email
    html2pdf().set(opt).from(element).save().then(() => {
        // RESTORE UI IMMEDIATELY
        if(buttonContainer) buttonContainer.style.display = 'flex';
        shareBtn.innerHTML = originalBtnText;
        shareBtn.disabled = false;

        // Critical Fix: Restore types before the mailto trigger
        originalDateStates.forEach(item => {
            item.element.type = 'date';
            item.element.value = item.originalValue;
        });

        const subject = encodeURIComponent(`Material Requisition Form - ${reqNo}`);
        const body = encodeURIComponent(
            `Dear Warehouse Team,\n\n` +
            `A new Material Requisition has been generated with the following details:\n\n` +
            `------------------------------------------\n` +
            `Requisition No : ${reqNo}\n` +
            `Request Date   : ${formattedDate}\n` +
            `Requested By   : ${document.getElementById('requestedBy').value}\n` +
            `Department     : ${document.getElementById('requesterDept').value}\n` +
            `------------------------------------------\n\n` +
            `Please review the attached PDF for the full items list and process the issue accordingly.\n\n` +
            `Best Regards,\n` +
            `${document.getElementById('requestedBy').value}`
        );
        
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }).catch(err => {
        console.error('PDF Error:', err);
        
        // Critical Fix: Always restore date types even on error
        originalDateStates.forEach(item => {
            item.element.type = 'date';
            item.element.value = item.originalValue;
        });
        
        if(buttonContainer) buttonContainer.style.display = 'flex';
        shareBtn.innerHTML = originalBtnText;
        shareBtn.disabled = false;
        alert('Error generating PDF.');
    });
}

function handlePrint() {
    const element = document.getElementById('requisitionForm');

    // 1. PREPARE DATES (Swap 'date' to 'text' for DD/MM/YYYY format)
    // This ensures the printer sees "05/01/2026" instead of "2026-01-05"
    const dateInputs = element.querySelectorAll('input[type="date"]');
    const originalDateStates = [];

    dateInputs.forEach(input => {
        originalDateStates.push({
            element: input,
            originalValue: input.value,
        });

        if (input.value) {
            const parts = input.value.split('-');
            if (parts.length === 3) {
                input.type = 'text';
                input.value = `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
            }
        }
    });

    // 2. TRIGGER PRINT
    // The CSS @media print we added handles the Landscape and Hiding Buttons
    window.print();

    // 3. CLEANUP (Run this immediately after the print dialog opens/closes)
    // We restore the dates so the user can keep editing if they want.

    // Note: Most browsers pause JS during the print dialog.
    // This code runs effectively after they click "Print" or "Cancel".
    originalDateStates.forEach(item => {
        item.element.type = 'date';
        item.element.value = item.originalValue;
    });
}
