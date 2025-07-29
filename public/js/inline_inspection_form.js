import { supabase } from '../supabase-config.js';

// Server handles keep-alive scheduling automatically
// No client-side ping logic needed

// Back button and mutually exclusive checkboxes logic
window.addEventListener('DOMContentLoaded', async function() {
  // Auth check: redirect to login if not authenticated (only for shift-a/b/c users)
  let isShiftUser = false;
  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    if (user && user.email) {
      const username = user.email.split('@')[0].toLowerCase();
      if (username.includes('shift-a') || username.includes('shift-b') || username.includes('shift-c')) {
        isShiftUser = true;
      }
    }
  } catch (e) {}
  if (isShiftUser && !user) {
    window.location.replace('auth.html');
    return;
  }
  // Back button and mutually exclusive checkboxes logic
  const backBtn = document.querySelector('.header-back-button');
  if (backBtn) {
    if (isShiftUser) {
      backBtn.textContent = 'Logout';
      backBtn.onclick = async function() {
        await supabase.auth.signOut();
        window.location.replace('auth.html');
      };
      // Add shift label after the Logout button
      let shiftLabel = '';
      if (user && user.email) {
        const username = user.email.split('@')[0].toLowerCase();
        if (username.includes('shift-a')) shiftLabel = 'Shift A';
        else if (username.includes('shift-b')) shiftLabel = 'Shift B';
        else if (username.includes('shift-c')) shiftLabel = 'Shift C';
      }
      if (shiftLabel) {
        const shiftSpan = document.createElement('span');
        shiftSpan.textContent = shiftLabel;
        shiftSpan.style.fontSize = '1.15rem';
        shiftSpan.style.fontWeight = 'bold';
        shiftSpan.style.color = '#fff';
        shiftSpan.style.marginLeft = '18px';
        backBtn.parentNode.insertBefore(shiftSpan, backBtn.nextSibling);
      }
    } else {
      backBtn.addEventListener('click', function() {
        window.location.href = 'employee_dashboard.html';
      });
    }
  }
  // Mutually exclusive Printed/Non-Printed checkboxes
  const printed = document.querySelector('input[name="printed"]');
  const nonPrinted = document.querySelector('input[name="non_printed"]');
  if (printed && nonPrinted) {
    printed.addEventListener('change', function() {
      if (printed.checked) nonPrinted.checked = false;
    });
    nonPrinted.addEventListener('change', function() {
      if (nonPrinted.checked) printed.checked = false;
    });
  }
});

// ===== STEP 1: FORM CREATION AND SAVING =====

// Global function for form submission
async function handleFormSubmit(e) {
  console.log('=== FORM SUBMISSION TRIGGERED ===');
    e.preventDefault();
  const form = document.getElementById('inlineInspectionEntryForm');
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
  const isEditMode = form.dataset.isEditMode === 'true';
  
  console.log('Form submission details:', {
    isEditMode,
    submitButtonText: submitBtn.textContent,
    formDataset: Object.fromEntries(Object.entries(form.dataset))
  });
  
  submitBtn.textContent = isEditMode ? 'Updating...' : 'Creating...';
    submitBtn.disabled = true;
  
    try {
      const formData = new FormData(form);
      const year = formData.get('year') || '';
      const month = formData.get('month') || '';
      const date = formData.get('date') || '';
      const machine = formData.get('mc_no') || '';
      const shift = formData.get('shift') || '';
      const traceability_code = `${year}${month}${date}${machine}${shift}`;
      
      if (isEditMode) {
        // Update existing form using record ID (like the old working code)
        const editRecordId = form.dataset.editRecordId;
        
        console.log('=== UPDATE DEBUG ===');
        console.log('Edit Mode Debug:', {
          isEditMode,
          editRecordId,
          formData: Object.fromEntries(formData.entries())
        });
        
        // Check if the record we're trying to update actually exists
        const { data: checkRecord, error: checkError } = await supabase
          .from('inline_inspection_form_master')
          .select('*')
          .eq('id', editRecordId);
          
        console.log('Record to update:', checkRecord);
        console.log('Check error:', checkError);
        
        const updateObject = {
          customer: formData.get('customer'),
          production_no: formData.get('production_no'),
          prod_code: formData.get('prod_code'),
          spec: formData.get('spec'),
          production_date: formData.get('production_date'),
          emboss_type: formData.get('emboss_type'),
          printed: formData.get('printed') === 'on',
          non_printed: formData.get('non_printed') === 'on',
          ct: formData.get('ct') === 'on',
          year: formData.get('year'),
          month: formData.get('month'),
          date: formData.get('date'),
          mc_no: formData.get('mc_no'),
          shift: parseInt(formData.get('shift')),
          supervisor: formData.get('supervisor'),
          supervisor2: formData.get('supervisor2'),
          line_leader: formData.get('line_leader'),
          line_leader2: formData.get('line_leader2'),
          operator: formData.get('operator'),
          operator2: formData.get('operator2'),
          qc_inspector: formData.get('qc_inspector'),
          qc_inspector2: formData.get('qc_inspector2'),
          updated_at: new Date().toISOString()
        };
        
        console.log('Update Object:', updateObject);
        console.log('Update Query:', {
          table: 'inline_inspection_form_master',
          recordId: editRecordId
        });
        
        console.log('About to execute update query...');
        const { data, error } = await supabase
          .from('inline_inspection_form_master')
          .update(updateObject)
          .eq('id', editRecordId)
          .select();
        
        console.log('Update query executed. Error:', error);
        console.log('Update query result:', data);
          
        if (error) {
          console.error('Error updating form:', error);
          alert('Error updating form: ' + error.message);
          return;
        }
        
        console.log('Update Result:', data);
        console.log('Updated record count:', data ? data.length : 0);
        
        // Show success message
        showNotification('✅ Form updated successfully!', 'success');
        alert('✅ Form updated successfully!');
      } else {
        // Create new form
      const form_id = crypto.randomUUID();

      // --- Determine next available lot_letter ---
      let lot_letter = 'A';
      try {
        const { data: existingForms, error: fetchError } = await supabase
          .from('inline_inspection_form_master')
          .select('lot_letter')
          .eq('traceability_code', traceability_code);
        if (!fetchError && existingForms && existingForms.length > 0) {
          // Collect used letters
          const usedLetters = existingForms
            .map(f => f.lot_letter)
            .filter(l => l && typeof l === 'string')
            .map(l => l.toUpperCase());
          // Find next available letter
          const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
          for (let i = 0; i < alphabet.length; i++) {
            if (!usedLetters.includes(alphabet[i])) {
              lot_letter = alphabet[i];
              break;
            }
          }
        }
      } catch (err) {
        console.warn('Could not determine next lot_letter, defaulting to A.', err);
      }
      // --- End lot_letter logic ---

      const formObject = {
        form_id: form_id,
        traceability_code: traceability_code,
        lot_letter: lot_letter,
        customer: formData.get('customer'),
        production_no: formData.get('production_no'),
        prod_code: formData.get('prod_code'),
        spec: formData.get('spec'),
        production_date: formData.get('production_date'),
        emboss_type: formData.get('emboss_type'),
        printed: formData.get('printed') === 'on',
        non_printed: formData.get('non_printed') === 'on',
        ct: formData.get('ct') === 'on',
        year: formData.get('year'),
        month: formData.get('month'),
        date: formData.get('date'),
        mc_no: formData.get('mc_no'),
        shift: parseInt(formData.get('shift')),
        supervisor: formData.get('supervisor'),
        supervisor2: formData.get('supervisor2'),
        line_leader: formData.get('line_leader'),
        line_leader2: formData.get('line_leader2'),
        operator: formData.get('operator'),
        operator2: formData.get('operator2'),
        qc_inspector: formData.get('qc_inspector'),
        qc_inspector2: formData.get('qc_inspector2'),
        status: 'draft',
        inspection_data: {
          customer: formData.get('customer'),
          production_no: formData.get('production_no'),
          prod_code: formData.get('prod_code'),
          spec: formData.get('spec'),
          shift: parseInt(formData.get('shift')),
          machine: formData.get('mc_no'),
          date: formData.get('production_date'),
          emboss_type: formData.get('emboss_type'),
          printed: formData.get('printed') === 'on',
          non_printed: formData.get('non_printed') === 'on',
          ct: formData.get('ct') === 'on',
          supervisor: formData.get('supervisor'),
          line_leader: formData.get('line_leader'),
          operator: formData.get('operator'),
          qc_inspector: formData.get('qc_inspector'),
          inspected_by: '',
          rolls: [],
          supervisor2: formData.get('supervisor2'),
          line_leader2: formData.get('line_leader2'),
          operator2: formData.get('operator2'),
          qc_inspector2: formData.get('qc_inspector2'),
        },
        total_rolls: 0,
        accepted_rolls: 0,
        rejected_rolls: 0,
        rework_rolls: 0,
        kiv_rolls: 0,
        created_at: new Date().toISOString()
      };
        
      const { data, error } = await supabase
        .from('inline_inspection_form_master')
        .insert([formObject])
        .select();
          
      if (error) {
        console.error('Error saving form:', error);
        alert('Error creating form: ' + error.message);
        return;
      }
        
        // Success message removed for form creation
      }
      
      const overlay = document.getElementById('inspectionFormOverlay');
      overlay.style.display = 'none';
      form.reset();
      
      // Reset form mode and UI
      form.dataset.isEditMode = 'false';
      delete form.dataset.editRecordId;
      
      // Reset modal title and button
      const modalTitle = overlay.querySelector('h3');
      if (modalTitle) {
        modalTitle.textContent = 'Enter Inline Inspection Form Details';
      }
      if (submitBtn) {
        submitBtn.textContent = 'Create Inline Inspection Form';
      }
      
      loadFormsTable();
    } catch (error) {
      console.error('Error:', error);
      alert('Error ' + (isEditMode ? 'updating' : 'creating') + ' form: ' + error.message);
    } finally {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  }

  // DOMContentLoaded event listener
  window.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('inlineInspectionEntryForm');
    const overlay = document.getElementById('inspectionFormOverlay');
    const createFormBtn = document.getElementById('showInspectionFormOverlay');
    const closeBtn = document.getElementById('closeInspectionFormOverlay');

  if (form) {
    // Remove the old addEventListener if present
    form.onsubmit = null;
  }

  if (createFormBtn) {
    createFormBtn.addEventListener('click', function() {
      if (form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Create Inline Inspection Form';
        form.onsubmit = handleFormSubmit;
      }
      overlay.style.display = 'flex';
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      overlay.style.display = 'none';
    });
  }

  // Close overlay when clicking outside
  if (overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.style.display = 'none';
      }
    });
  }

  // Load forms table on page load
  loadFormsTable();
  
  // Add event listeners for delete confirmation overlays
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const cancelFinalDeleteBtn = document.getElementById('cancelFinalDeleteBtn');
  const confirmFinalDeleteBtn = document.getElementById('confirmFinalDeleteBtn');
  
  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', cancelDelete);
  }
  
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', confirmDelete);
  }
  
  if (cancelFinalDeleteBtn) {
    cancelFinalDeleteBtn.addEventListener('click', cancelFinalDelete);
  }
  
  if (confirmFinalDeleteBtn) {
    confirmFinalDeleteBtn.addEventListener('click', confirmFinalDelete);
  }
});

// ===== LOAD FORMS TABLE =====
async function loadFormsTable() {
  try {
    const { data, error } = await supabase
      .from('inline_inspection_form_master')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading forms:', error);
      return;
    }

    // Only show forms with a non-null and non-empty customer value
    const validForms = data.filter(form => form.customer !== null && form.customer !== '');
    await updateFormsTable(validForms);
  } catch (error) {
    console.error('Error:', error);
  }
}

// ===== AUTHORIZATION FUNCTIONS =====
async function getCurrentUserDepartment() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('department')
      .eq('id', user.id)
      .single();
    
    if (error || !userProfile) return null;
    return userProfile.department;
  } catch (error) {
    console.error('Error getting user department:', error);
    return null;
  }
}

function hasEditDeletePermission(userDepartment, formStatus) {
  if (!userDepartment) return false;
  
  const authorizedDepartments = ['Quality Assurance', 'Quality Control', 'Production'];
  
  // If form is submitted, only authorized departments can edit/delete
  if (formStatus === 'submit') {
    return authorizedDepartments.includes(userDepartment);
  }
  
  // If form is draft, all departments can edit/delete
  return true;
}

// ===== UPDATE FORMS TABLE =====
async function updateFormsTable(forms) {
  const tbody = document.querySelector('table tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (forms.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12" class="py-4 text-center text-gray-500">
          No forms created yet. Click "Create Film Inspection Form" to get started.
        </td>
      </tr>
    `;
    return;
  }

  // Get user department once for all forms
  const userDepartment = await getCurrentUserDepartment();

  forms.forEach((form, index) => {
    // Combine names with '/'
    const supervisorDisplay = [form.supervisor, form.supervisor2].filter(Boolean).join(' / ');
    const operatorDisplay = [form.operator, form.operator2].filter(Boolean).join(' / ');
    const lineLeaderDisplay = [form.line_leader, form.line_leader2].filter(Boolean).join(' / ');
    const qcInspectorDisplay = [form.qc_inspector, form.qc_inspector2].filter(Boolean).join(' / ');
    
    // Convert shift number to letter for display
    const shiftDisplay = form.shift ? 
      (form.shift === '1' || form.shift === 1 ? 'A' : 
       form.shift === '2' || form.shift === 2 ? 'B' : 
       form.shift === '3' || form.shift === 3 ? 'C' : form.shift) : '-';
    
    // Debug: Log the shift conversion
    console.log(`Shift conversion: ${form.shift} (${typeof form.shift}) → ${shiftDisplay}`);
    
    // Check if form status is "submit" - if so, only show eye icon
    const isSubmitted = form.status === 'submit';
    
    // Check permissions synchronously
    const hasPermission = hasEditDeletePermission(userDepartment, form.status);
    
    // Format status for display
    const statusDisplay = form.status ? 
      (form.status === 'submit' ? 'Submitted' : form.status.charAt(0).toUpperCase() + form.status.slice(1)) : '-';
    const statusColor = form.status === 'submit' ? 'text-green-600 font-semibold' : 'text-orange-600 font-semibold';
    
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50 transition-colors';
    row.innerHTML = `
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">${forms.length - index}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">${formatDate(form.production_date)}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">${form.prod_code || '-'}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">${form.mc_no || '-'}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">${shiftDisplay}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">${operatorDisplay || '-'}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">${supervisorDisplay || '-'}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">${lineLeaderDisplay || '-'}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">${qcInspectorDisplay || '-'}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words ${statusColor}">${statusDisplay}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">
        <div class="flex justify-center space-x-2">
          ${(!isSubmitted || hasPermission) ? `
            <!-- Sky blue Enter Data button - show if not submitted OR user has permission -->
            <button onclick="enterData('${form.traceability_code}', '${form.lot_letter}')" class="text-sky-600 hover:text-sky-800" title="Enter Data">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
            </button>
            <!-- Green Edit button - show if not submitted OR user has permission -->
            <button onclick="editForm('${form.traceability_code}', '${form.lot_letter}')" class="text-green-600 hover:text-green-800" title="Edit">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
            </button>
            <!-- Red Delete button - show if not submitted OR user has permission -->
            <button onclick="deleteForm('${form.traceability_code}', '${form.lot_letter}')" class="text-red-600 hover:text-red-800" title="Delete">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          ` : ''}
          <!-- Dark blue View button - always show -->
          <button onclick="viewForm('${form.traceability_code}', '${form.lot_letter}')" class="text-blue-800 hover:text-blue-900" title="View">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
          </button>
        </div>
      </td>
      <td class="py-3 px-4 text-center whitespace-normal break-words">
        <button onclick="downloadFormExcel('${form.traceability_code}', '${form.lot_letter}', this)" class="text-indigo-600 hover:text-indigo-800" title="Download Excel">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 10l5 5 5-5M12 15V3" />
          </svg>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// ===== FORM ACTIONS =====
function enterData(traceability_code, lot_letter) {
  // Redirect to data entry page with traceability_code for entering data
  window.location.href = `inline_inspection_data.html?traceability_code=${traceability_code}&lot_letter=${lot_letter}`;
}

function viewForm(traceability_code, lot_letter) {
  // Redirect to data entry page in view-only mode
  window.location.href = `inline_inspection_data.html?traceability_code=${traceability_code}&lot_letter=${lot_letter}&mode=view`;
}

async function editForm(traceability_code, lot_letter) {
  console.log('EditForm called with:', { traceability_code, lot_letter });
  
  // Find the record with actual form data for this traceability_code
  const { data: allData, error: listError } = await supabase
    .from('inline_inspection_form_master')
    .select('*')
    .eq('traceability_code', traceability_code);
    
  if (listError) {
    console.error('Error listing forms:', listError);
    alert('Error loading form for editing.');
    return;
  }
  
  console.log('All forms for traceability_code:', allData);
  
  // Find the form with actual data (customer, production_no, etc.)
  const formData = allData.find(form => form.customer || form.production_no || form.prod_code || form.spec);
  
  if (!formData) {
    console.error('No form with data found for traceability_code:', traceability_code);
    alert('No form data found for editing.');
    return;
  }
  
  console.log('Found form with data:', formData);
  
  console.log('Fetched form data for editing:', formData);
  console.log('All formData keys:', Object.keys(formData));
  console.log('FormData values:', Object.entries(formData).filter(([key, value]) => value !== null && value !== ''));
  console.log('Non-null form fields:', Object.entries(formData).filter(([key, value]) => value !== null && value !== '' && !['id', 'created_at', 'updated_at', 'inspection_data'].includes(key)));
  
  const overlay = document.getElementById('inspectionFormOverlay');
  const form = document.getElementById('inlineInspectionEntryForm');
  const modalTitle = overlay.querySelector('h3');
  const submitButton = form.querySelector('button[type="submit"]');
  
  if (!overlay || !form) {
    console.error('Overlay or form not found');
    return;
  }
  
  // Update modal title and button for edit mode
  if (modalTitle) {
    modalTitle.textContent = 'Edit Inline Inspection Form Details';
  }
  if (submitButton) {
    submitButton.textContent = 'Update Inline Inspection Form';
  }
  
  // Store the record ID for update (like the old working code)
  form.dataset.editRecordId = formData.id;
  form.dataset.isEditMode = 'true';
  
  console.log('Storing in form dataset:', {
    recordId: formData.id,
    storedRecordId: form.dataset.editRecordId
  });
  
  console.log('Edit Form Debug:', {
    traceability_code,
    lot_letter,
    storedTraceabilityCode: form.dataset.editTraceabilityCode,
    storedLotLetter: form.dataset.editLotLetter,
    isEditMode: form.dataset.isEditMode
  });
  
  // Extract data from inspection_data JSON if available, otherwise use direct fields
  const inspectionData = formData.inspection_data || {};
  console.log('Full inspection_data:', inspectionData);
  
  // The form data is likely stored in the inspection_data.summary or similar structure
  const summary = inspectionData.summary || {};
  const rolls = inspectionData.rolls || [];
  
  console.log('Summary data:', summary);
  console.log('First roll data:', rolls[0]);
  console.log('All rolls:', rolls);
  
  const dataToUse = {
    customer: formData.customer || summary.customer || '',
    production_no: formData.production_no || summary.production_no || '',
    prod_code: formData.prod_code || summary.prod_code || '',
    spec: formData.spec || summary.spec || '',
    production_date: formData.production_date || summary.date || summary.production_date || '',
    emboss_type: formData.emboss_type || summary.emboss_type || '',
    printed: formData.printed || summary.printed || false,
    non_printed: formData.non_printed || summary.non_printed || false,
    ct: formData.ct || summary.ct || false,
    year: formData.year || summary.year || '',
    month: formData.month || summary.month || '',
    date: formData.date || summary.date || '',
    mc_no: formData.mc_no || summary.machine || summary.mc_no || '',
    shift: formData.shift || summary.shift || '',
    supervisor: formData.supervisor || summary.supervisor || '',
    supervisor2: formData.supervisor2 || summary.supervisor2 || '',
    line_leader: formData.line_leader || summary.line_leader || '',
    line_leader2: formData.line_leader2 || summary.line_leader2 || '',
    operator: formData.operator || summary.operator || '',
    operator2: formData.operator2 || summary.operator2 || '',
    qc_inspector: formData.qc_inspector || summary.qc_inspector || '',
    qc_inspector2: formData.qc_inspector2 || summary.qc_inspector2 || ''
  };
  
  console.log('Filling form fields with data:', dataToUse);
  console.log('Original formData:', formData);
  console.log('Inspection data:', inspectionData);
  
  // Check if form fields exist
  console.log('Form field checks:', {
    customerField: !!form.customer,
    productionNoField: !!form.production_no,
    prodCodeField: !!form.prod_code,
    specField: !!form.spec,
    productionDateField: !!form.production_date,
    embossTypeField: !!form.emboss_type,
    printedField: !!form.printed,
    nonPrintedField: !!form.non_printed,
    ctField: !!form.ct,
    yearField: !!form.year,
    monthField: !!form.month,
    dateField: !!form.date,
    mcNoField: !!form.mc_no,
    shiftField: !!form.shift,
    supervisorField: !!form.supervisor,
    supervisor2Field: !!form.supervisor2,
    lineLeaderField: !!form.line_leader,
    lineLeader2Field: !!form.line_leader2,
    operatorField: !!form.operator,
    operator2Field: !!form.operator2,
    qcInspectorField: !!form.qc_inspector,
    qcInspector2Field: !!form.qc_inspector2
  });
  
  form.customer.value = dataToUse.customer;
  form.production_no.value = dataToUse.production_no;
  form.prod_code.value = dataToUse.prod_code;
  form.spec.value = dataToUse.spec;
  form.production_date.value = dataToUse.production_date;
  form.emboss_type.value = dataToUse.emboss_type;
  form.printed.checked = !!dataToUse.printed;
  form.non_printed.checked = !!dataToUse.non_printed;
  form.ct.checked = !!dataToUse.ct;
  form.year.value = dataToUse.year;
  form.month.value = dataToUse.month;
  form.date.value = dataToUse.date;
  form.mc_no.value = dataToUse.mc_no;
  form.shift.value = dataToUse.shift;
  form.supervisor.value = dataToUse.supervisor;
  form.supervisor2.value = dataToUse.supervisor2;
  form.line_leader.value = dataToUse.line_leader;
  form.line_leader2.value = dataToUse.line_leader2;
  form.operator.value = dataToUse.operator;
  form.operator2.value = dataToUse.operator2;
  form.qc_inspector.value = dataToUse.qc_inspector;
  form.qc_inspector2.value = dataToUse.qc_inspector2;
  
  // Show the overlay for editing form details
  overlay.style.display = 'flex';
  
  // Ensure form submission handler is attached
  if (form) {
    form.onsubmit = handleFormSubmit;
  }
}

async function deleteForm(traceability_code, lot_letter) {
  // Store the form details for deletion
  window.pendingDeleteForm = { traceability_code, lot_letter };
  
  // Show first confirmation overlay
  const deleteOverlay = document.getElementById('deleteConfirmationOverlay');
  const deleteMessage = document.getElementById('deleteConfirmationMessage');
  deleteMessage.textContent = 'Are you sure you want to delete this inline form?';
  deleteOverlay.style.display = 'flex';
}

async function confirmDelete() {
  // Hide first confirmation overlay
  const deleteOverlay = document.getElementById('deleteConfirmationOverlay');
  deleteOverlay.style.display = 'none';
  
  // Show final warning overlay
  const finalWarningOverlay = document.getElementById('finalDeleteWarningOverlay');
  finalWarningOverlay.style.display = 'flex';
}

async function confirmFinalDelete() {
  const { traceability_code, lot_letter } = window.pendingDeleteForm;
  
  try {
    const { error } = await supabase
      .from('inline_inspection_form_master')
      .delete()
      .eq('traceability_code', traceability_code)
      .eq('lot_letter', lot_letter);
    
    if (error) {
      console.error('Error deleting form:', error);
      alert('Error deleting form: ' + error.message);
      return;
    }
    
    showNotification('Form deleted successfully!', 'success');
    loadFormsTable();
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error deleting form: ' + error.message);
  } finally {
    // Hide final warning overlay
    const finalWarningOverlay = document.getElementById('finalDeleteWarningOverlay');
    finalWarningOverlay.style.display = 'none';
    
    // Clear pending delete data
    delete window.pendingDeleteForm;
  }
}

function cancelDelete() {
  // Hide first confirmation overlay
  const deleteOverlay = document.getElementById('deleteConfirmationOverlay');
  deleteOverlay.style.display = 'none';
  
  // Clear pending delete data
  delete window.pendingDeleteForm;
}

function cancelFinalDelete() {
  // Hide final warning overlay
  const finalWarningOverlay = document.getElementById('finalDeleteWarningOverlay');
  finalWarningOverlay.style.display = 'none';
  
  // Clear pending delete data
  delete window.pendingDeleteForm;
}

// Make form actions globally accessible for onclick handlers
window.enterData = enterData;
window.viewForm = viewForm;
window.editForm = editForm;
window.deleteForm = deleteForm;
window.confirmDelete = confirmDelete;
window.confirmFinalDelete = confirmFinalDelete;
window.cancelDelete = cancelDelete;
window.cancelFinalDelete = cancelFinalDelete;

// Add a placeholder for the download function
window.downloadFormExcel = async function(traceability_code, lot_letter, buttonElement) {
  // Show loading state
  const downloadBtn = buttonElement || document.querySelector('[onclick*="downloadFormExcel"]');
  const originalContent = downloadBtn ? downloadBtn.innerHTML : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>';
  
  if (downloadBtn) {
    downloadBtn.innerHTML = '⏳ Generating Excel...';
    downloadBtn.disabled = true;
  }

  try {

    // Show progress indicator
    showProgressIndicator('Connecting to server...');

    // Call the Node.js export server with specific form parameters
    // Use localhost for IDE testing, Render URL for production
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const backendUrl = isLocalhost ? 'http://localhost:3000' : 'https://swanson-backend.onrender.com';
    const exportUrl = `${backendUrl}/export?traceability_code=${encodeURIComponent(traceability_code)}&lot_letter=${encodeURIComponent(lot_letter)}`;

    // Add timeout for slow connections (increased for cold starts)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes timeout for cold starts

    updateProgressIndicator('Connecting to server...');
    
    // Show longer loading sequence for cold starts
    setTimeout(() => {
      updateProgressIndicator('Server is starting up...');
    }, 3000);
    
    setTimeout(() => {
      updateProgressIndicator('Fetching data from database...');
    }, 8000);
    
    setTimeout(() => {
      updateProgressIndicator('Processing Excel template...');
    }, 15000);

    const response = await fetch(exportUrl, {
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

    updateProgressIndicator('Generating Excel file...');
    
    setTimeout(() => {
      updateProgressIndicator('Applying formatting and protection...');
    }, 2000);
    
    setTimeout(() => {
      updateProgressIndicator('Finalizing document...');
    }, 5000);

    const blob = await response.blob();
    
    updateProgressIndicator('Preparing download...');

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    
    // Get filename from Content-Disposition header if available
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `inspection_form_${traceability_code}_${lot_letter}.xlsx`;
    
    console.log('Content-Disposition header:', contentDisposition); // Debug log
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
        console.log('Extracted filename:', filename); // Debug log
      }
    }
    
    // Fallback: Create a simple filename if header is not available
    if (!contentDisposition || contentDisposition === 'null') {
      filename = `In-Line_Inspection_Form_${traceability_code}_${lot_letter}.xlsx`;
      console.log('Using fallback filename:', filename); // Debug log
    }
    
    console.log('Final filename:', filename); // Debug log
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    // Success message
    showSuccessMessage('Excel file downloaded successfully!');
    
  } catch (error) {
    console.error('Download failed:', error);
    
    if (error.name === 'AbortError') {
      showErrorMessage('Request timed out. Please try again or check your internet connection.');
    } else {
      showErrorMessage('Failed to download Excel file. Please try again.');
    }
  } finally {
    // Reset button state
    const downloadBtn = buttonElement || document.querySelector('[onclick*="downloadFormExcel"]');
    if (downloadBtn) {
      downloadBtn.innerHTML = originalContent;
      downloadBtn.disabled = false;
    }
    
    hideProgressIndicator();
  }
};

// Progress indicator functions
function showProgressIndicator(message) {
  let progressDiv = document.getElementById('progress-indicator');
  if (!progressDiv) {
    progressDiv = document.createElement('div');
    progressDiv.id = 'progress-indicator';
    progressDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255, 255, 255, 0.95);
      color: #333;
      padding: 30px;
      border-radius: 15px;
      z-index: 9999;
      text-align: center;
      min-width: 350px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      border: 1px solid rgba(0,0,0,0.1);
      backdrop-filter: blur(10px);
    `;
    document.body.appendChild(progressDiv);
  }
  progressDiv.innerHTML = `
    <div style="margin-bottom: 20px;">
      <div class="spinner" style="
        border: 3px solid rgba(0,46,125,0.3);
        border-top: 3px solid #002E7D;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
      "></div>
      <div style="font-size: 18px; font-weight: 600; margin-bottom: 15px; color: #002E7D;">Excel Generation in Progress</div>
      <div style="font-size: 14px; opacity: 0.8; margin-bottom: 20px; color: #666;">${message}</div>
      <div style="background: rgba(0,46,125,0.1); height: 4px; border-radius: 2px; overflow: hidden;">
        <div class="progress-bar" style="
          background: linear-gradient(90deg, #002E7D, #1e40af);
          height: 100%;
          width: 0%;
          transition: width 0.3s ease;
          animation: progress 3s ease-in-out infinite;
        "></div>
      </div>
    </div>
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes progress {
        0% { width: 0%; }
        50% { width: 70%; }
        100% { width: 100%; }
      }
    </style>
  `;
}

function updateProgressIndicator(message) {
  const progressDiv = document.getElementById('progress-indicator');
  if (progressDiv) {
    const messageDiv = progressDiv.querySelector('div:last-child');
    if (messageDiv) {
      messageDiv.textContent = message;
    }
  }
}

function hideProgressIndicator() {
  const progressDiv = document.getElementById('progress-indicator');
  if (progressDiv) {
    progressDiv.remove();
  }
}

function showSuccessMessage(message) {
  showMessage(message, 'success');
}

function showErrorMessage(message) {
  showMessage(message, 'error');
}

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

// ===== UTILITY FUNCTIONS =====
function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB');
}

function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
    type === 'success' ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
  }`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// ===== OVERLAY CONTROLS =====
document.addEventListener('DOMContentLoaded', function() {
  const createFormBtn = document.getElementById('showInspectionFormOverlay');
  const overlay = document.getElementById('inspectionFormOverlay');
  const closeBtn = document.getElementById('closeInspectionFormOverlay');
  const form = document.getElementById('inlineInspectionEntryForm');
  
  if (createFormBtn) {
    createFormBtn.addEventListener('click', function() {
      if (form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Create Inline Inspection Form';
        form.onsubmit = null; // Reset to default handler
      }
      overlay.style.display = 'flex';
    });
  }
  
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      overlay.style.display = 'none';
    });
  }
  
  // Close overlay when clicking outside
  if (overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.style.display = 'none';
      }
    });
  }
});
