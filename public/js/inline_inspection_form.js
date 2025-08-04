import { supabase } from '../supabase-config.js';

// ===== CONFIGURATION =====
const MAX_FORMS_DISPLAY = 6; // Maximum number of forms to display

// Enhanced client-side keep-alive ping to prevent cold starts
// Multiple intervals for maximum reliability
setInterval(async () => {
  try {
    const basePath = window.location.pathname.includes('/public/') ? '/public' : '';
    const response = await fetch(`${basePath}/ping`);
    if (response.ok) {
      console.log('🔄 Client keep-alive ping successful');
    } else {
      console.warn('⚠️ Client keep-alive ping failed');
    }
  } catch (error) {
    console.warn('⚠️ Client keep-alive ping error:', error);
  }
}, 4 * 60 * 1000); // Every 4 minutes (more aggressive for cold start prevention)

// Secondary client-side keep-alive for redundancy
setInterval(async () => {
  try {
    const basePath = window.location.pathname.includes('/public/') ? '/public' : '';
    const response = await fetch(`${basePath}/health`);
    if (response.ok) {
      console.log('🔄 Client health check successful');
    } else {
      console.warn('⚠️ Client health check failed');
    }
  } catch (error) {
    console.warn('⚠️ Client health check error:', error);
  }
}, 6 * 60 * 1000); // Every 6 minutes

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
  
  // Check if user is authenticated
  if (isShiftUser && !user) {
    // Clear any remaining session data
    localStorage.removeItem('supabase.auth.session');
    sessionStorage.removeItem('supabase.auth.session');
    window.location.replace('auth.html');
    return;
  }
  
  // Prevent back navigation after logout
  window.history.pushState(null, '', window.location.href);
  window.onpopstate = function() {
    // Check if user is still authenticated
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        window.location.replace('auth.html');
      } else {
        window.history.pushState(null, '', window.location.href);
      }
    });
  };
  // Back button and mutually exclusive checkboxes logic
  const backBtn = document.querySelector('.header-back-button');
  if (backBtn) {
    if (isShiftUser) {
      backBtn.textContent = 'Logout';
      backBtn.onclick = async function() {
        // Add confirmation dialog for shift users
        if (window.confirm("Are you sure you want to log out?")) {
          console.log('Logout confirmed, signing out...'); // Debug log
          try {
        await supabase.auth.signOut();
            console.log('Logout successful, clearing session...'); // Debug log
            
            // Remove session from both storages
            localStorage.removeItem('supabase.auth.session');
            sessionStorage.removeItem('supabase.auth.session');
            
            // Clear all browser history and prevent back navigation
            window.history.pushState(null, '', window.location.href);
            window.onpopstate = function() {
              window.history.pushState(null, '', window.location.href);
            };
            
            // Clear all session storage and local storage except essential items
            const essentialKeys = ['rememberedEmpCode', 'rememberedPassword'];
            for (let i = sessionStorage.length - 1; i >= 0; i--) {
              const key = sessionStorage.key(i);
              if (!essentialKeys.includes(key)) {
                sessionStorage.removeItem(key);
              }
            }
            for (let i = localStorage.length - 1; i >= 0; i--) {
              const key = localStorage.key(i);
              if (!essentialKeys.includes(key)) {
                localStorage.removeItem(key);
              }
            }
            
            console.log('Logout successful, redirecting...'); // Debug log
        window.location.replace('auth.html');
          } catch (err) {
            console.error('Exception during logout:', err);
            alert('An unexpected error occurred during logout.');
          }
        } else {
          console.log('Logout cancelled by user.'); // Debug log (optional)
        }
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
  
  // Auto-capitalization for Team section input fields
  const teamInputs = [
    'supervisor', 'supervisor2', 
    'line_leader', 'line_leader2', 
    'operator', 'operator2', 
    'qc_inspector', 'qc_inspector2'
  ];
  
  teamInputs.forEach(inputName => {
    const input = document.querySelector(`input[name="${inputName}"]`);
    if (input) {
      input.addEventListener('input', function(e) {
        const value = e.target.value;
        if (value.length > 0) {
          // Capitalize first letter and keep rest as typed
          const capitalized = value.charAt(0).toUpperCase() + value.slice(1);
          if (capitalized !== value) {
            e.target.value = capitalized;
          }
        }
      });
    }
  });
  
  // Filter functionality
  setupFilterHandlers();
});

// ===== FILTER FUNCTIONALITY =====

let allForms = []; // Store all forms for filtering
let filteredForms = []; // Store filtered forms
let currentFilters = {}; // Store current filter state

function setupFilterHandlers() {
  const clearFilterBtn = document.getElementById('clearFilter');
  
  if (clearFilterBtn) {
    clearFilterBtn.addEventListener('click', clearFilters);
  }
  
  // Add event listeners to all filter inputs to auto-apply filters
  const filterInputs = [
    'filterFromDate', 'filterToDate', 'filterProduct', 'filterMachine', 
    'filterShift', 'filterOperator', 'filterSupervisor', 'filterLineLeader', 'filterQCInspector'
  ];
  
  filterInputs.forEach(inputId => {
    const input = document.getElementById(inputId);
    if (input) {
      input.addEventListener('change', applyFilters);
    }
  });
}

// Populate filter dropdowns with unique values
function populateFilterDropdowns() {
  if (!allForms || allForms.length === 0) return;
  
  // Get unique values for each filter
  const products = [...new Set(allForms.map(form => form.prod_code).filter(Boolean))].sort();
  const machines = [...new Set(allForms.map(form => form.mc_no).filter(Boolean))].sort();
  const operators = [...new Set(allForms.flatMap(form => [form.operator, form.operator2]).filter(Boolean))].sort();
  const supervisors = [...new Set(allForms.flatMap(form => [form.supervisor, form.supervisor2]).filter(Boolean))].sort();
  const lineLeaders = [...new Set(allForms.flatMap(form => [form.line_leader, form.line_leader2]).filter(Boolean))].sort();
  const qcInspectors = [...new Set(allForms.flatMap(form => [form.qc_inspector, form.qc_inspector2]).filter(Boolean))].sort();
  
  // Populate all dropdowns using populateSelect
  populateSelect('filterProduct', products);
  populateSelect('filterMachine', machines);
  populateSelect('filterOperator', operators);
  populateSelect('filterSupervisor', supervisors);
  populateSelect('filterLineLeader', lineLeaders);
  populateSelect('filterQCInspector', qcInspectors);
  
  // Restore previous filter state if exists
  restoreFilterState();
}

// Helper function to populate datalist options
function populateDatalist(datalistId, options) {
  const datalist = document.getElementById(datalistId);
  if (!datalist) return;
  
  // Clear existing options except "All"
  datalist.innerHTML = '<option value="">All</option>';
  
  // Add new options
  options.forEach(option => {
    const optionElement = document.createElement('option');
    optionElement.value = option;
    datalist.appendChild(optionElement);
  });
}

// Helper function to populate select dropdown
function populateSelect(selectId, options) {
  const select = document.getElementById(selectId);
  if (!select) return;
  
  // Clear existing options except "All"
  select.innerHTML = '<option value="">All</option>';
  
  // Add new options
  options.forEach(option => {
    const optionElement = document.createElement('option');
    optionElement.value = option;
    optionElement.textContent = option;
    select.appendChild(optionElement);
  });
}

// Save current filter state
function saveFilterState() {
  currentFilters = {
    fromDate: document.getElementById('filterFromDate').value,
    toDate: document.getElementById('filterToDate').value,
    product: document.getElementById('filterProduct').value,
    machine: document.getElementById('filterMachine').value,
    shift: document.getElementById('filterShift').value,
    operator: document.getElementById('filterOperator').value,
    supervisor: document.getElementById('filterSupervisor').value,
    lineLeader: document.getElementById('filterLineLeader').value,
    qcInspector: document.getElementById('filterQCInspector').value
  };
  localStorage.setItem('inlineInspectionFilters', JSON.stringify(currentFilters));
}

// Restore filter state from localStorage
function restoreFilterState() {
  const savedFilters = localStorage.getItem('inlineInspectionFilters');
  if (savedFilters) {
    currentFilters = JSON.parse(savedFilters);
    
    // Restore filter values
    document.getElementById('filterFromDate').value = currentFilters.fromDate || '';
    document.getElementById('filterToDate').value = currentFilters.toDate || '';
    document.getElementById('filterProduct').value = currentFilters.product || '';
    document.getElementById('filterMachine').value = currentFilters.machine || '';
    document.getElementById('filterShift').value = currentFilters.shift || '';
    document.getElementById('filterOperator').value = currentFilters.operator || '';
    document.getElementById('filterSupervisor').value = currentFilters.supervisor || '';
    document.getElementById('filterLineLeader').value = currentFilters.lineLeader || '';
    document.getElementById('filterQCInspector').value = currentFilters.qcInspector || '';
    
    // Update filter status
    updateFilterStatus();
    
    // Apply the restored filters
    applyFilters();
  } else {
    // Update filter status to show Off if no saved filters
    updateFilterStatus();
  }
}

// Update filter status indicator
function updateFilterStatus() {
  const filterStatus = document.getElementById('filterStatus');
  const filterContainer = document.getElementById('filterContainer');
  if (!filterStatus || !filterContainer) return;
  
  const fromDate = document.getElementById('filterFromDate').value;
  const toDate = document.getElementById('filterToDate').value;
  const product = document.getElementById('filterProduct').value;
  const machine = document.getElementById('filterMachine').value;
  const shift = document.getElementById('filterShift').value;
  const operator = document.getElementById('filterOperator').value;
  const supervisor = document.getElementById('filterSupervisor').value;
  const lineLeader = document.getElementById('filterLineLeader').value;
  const qcInspector = document.getElementById('filterQCInspector').value;
  
  const hasFilters = fromDate || toDate || product || machine || shift || operator || supervisor || lineLeader || qcInspector;
  
  if (hasFilters) {
    filterStatus.textContent = 'On';
    filterStatus.className = 'px-2 py-1 text-xs font-semibold rounded-full bg-green-200 text-green-700';
    // Highlight filter section when active
    filterContainer.className = 'bg-green-50 border-2 border-green-300 rounded-lg shadow-md p-4';
  } else {
    filterStatus.textContent = 'Off';
    filterStatus.className = 'px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-700';
    // Remove highlighting when no filters
    filterContainer.className = 'bg-white rounded-lg shadow-md p-4';
  }
}

async function applyFilters() {
  const fromDate = document.getElementById('filterFromDate').value;
  const toDate = document.getElementById('filterToDate').value;
  const product = document.getElementById('filterProduct').value;
  const machine = document.getElementById('filterMachine').value;
  const shift = document.getElementById('filterShift').value;
  const operator = document.getElementById('filterOperator').value;
  const supervisor = document.getElementById('filterSupervisor').value;
  const lineLeader = document.getElementById('filterLineLeader').value;
  const qcInspector = document.getElementById('filterQCInspector').value;
  
  // Save current filter state
  saveFilterState();
  
  // Update filter status
  updateFilterStatus();
  
  // Filter the forms
  filteredForms = allForms.filter(form => {
    // Date filter
    if (fromDate && toDate) {
      const formDate = new Date(form.production_date);
      const fromDateObj = new Date(fromDate);
      const toDateObj = new Date(toDate);
      if (formDate < fromDateObj || formDate > toDateObj) return false;
    } else if (fromDate) {
      const formDate = new Date(form.production_date);
      const fromDateObj = new Date(fromDate);
      if (formDate < fromDateObj) return false;
    } else if (toDate) {
      const formDate = new Date(form.production_date);
      const toDateObj = new Date(toDate);
      if (formDate > toDateObj) return false;
    }
    
    // Product filter
    if (product && form.prod_code) {
      if (form.prod_code !== product) return false;
    }
    
    // Machine filter
    if (machine && form.mc_no) {
      if (form.mc_no !== machine) return false;
    }
    
    // Shift filter
    if (shift && form.shift) {
      if (parseInt(form.shift) !== parseInt(shift)) return false;
    }
    
    // Operator filter
    if (operator && (form.operator || form.operator2)) {
      if (form.operator !== operator && form.operator2 !== operator) return false;
    }
    
    // Supervisor filter
    if (supervisor && (form.supervisor || form.supervisor2)) {
      if (form.supervisor !== supervisor && form.supervisor2 !== supervisor) return false;
    }
    
    // Line Leader filter
    if (lineLeader && (form.line_leader || form.line_leader2)) {
      if (form.line_leader !== lineLeader && form.line_leader2 !== lineLeader) return false;
    }
    
    // QC Inspector filter
    if (qcInspector && (form.qc_inspector || form.qc_inspector2)) {
      if (form.qc_inspector !== qcInspector && form.qc_inspector2 !== qcInspector) return false;
    }
    
    return true;
  });
  
  // Check if date filters are applied
  const hasDateFilters = fromDate || toDate;
  
  // Update the table with filtered results
  await updateFormsTable(filteredForms, hasDateFilters);
  
  // Check if filters are applied
  const hasFilters = fromDate || toDate || product || machine || shift || operator || supervisor || lineLeader || qcInspector;
  if (hasFilters) {
    // Filter applied successfully
  }
}

function clearFilters() {
  // Clear all filter inputs
  document.getElementById('filterFromDate').value = '';
  document.getElementById('filterToDate').value = '';
  document.getElementById('filterProduct').value = '';
  document.getElementById('filterMachine').value = '';
  document.getElementById('filterShift').value = '';
  document.getElementById('filterOperator').value = '';
  document.getElementById('filterSupervisor').value = '';
  document.getElementById('filterLineLeader').value = '';
  document.getElementById('filterQCInspector').value = '';
  
  // Clear saved filter state
  currentFilters = {};
  localStorage.removeItem('inlineInspectionFilters');
  
  // Update filter status
  updateFilterStatus();
  
  // Reset to show all forms
  filteredForms = [...allForms];
  updateFormsTable(filteredForms, false); // false = show limited forms when no date filters
  
  // Filters cleared successfully
}

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
          .from('inline_inspection_form_master_2')
          .select(`
            id, traceability_code, lot_letter, customer, production_no, prod_code, spec,
            production_date, emboss_type, printed, non_printed, ct, year, month, date,
            mc_no, shift, supervisor, supervisor2, line_leader, line_leader2,
            operator, operator2, qc_inspector, qc_inspector2, status,
            total_rolls, accepted_rolls, rejected_rolls, rework_rolls, kiv_rolls,
            created_at, updated_at
          `)
          .eq('id', editRecordId);
          
        console.log('Record to update:', checkRecord);
        console.log('Check error:', checkError);
        
        const updateObject = {
          customer: formData.get('customer'),
          production_no: formData.get('production_no'),
          production_no_2: formData.get('production_no_2'),
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
          table: 'inline_inspection_form_master_2',
          recordId: editRecordId
        });
        
        console.log('About to execute update query...');
        const { data, error } = await supabase
          .from('inline_inspection_form_master_2')
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
        alert('✅ Form updated successfully!');
      } else {
        // Create new form
      const form_id = crypto.randomUUID();

      // --- Determine next available lot_letter based on same shift, machine, and date ---
      let lot_letter = 'A';
      try {
        const currentShift = parseInt(formData.get('shift'));
        const currentMachine = formData.get('mc_no');
        const currentDate = formData.get('production_date');
        
        console.log('Checking for existing forms with:', {
          shift: currentShift,
          machine: currentMachine,
          date: currentDate
        });
        
        const { data: existingForms, error: fetchError } = await supabase
          .from('inline_inspection_form_master_2')
          .select('lot_letter, shift, mc_no, production_date')
          .eq('shift', currentShift)
          .eq('mc_no', currentMachine)
          .eq('production_date', currentDate);
          
        if (!fetchError && existingForms && existingForms.length > 0) {
          console.log('Found existing forms for same shift/machine/date:', existingForms);
          
          // Collect used letters
          const usedLetters = existingForms
            .map(f => f.lot_letter)
            .filter(l => l && typeof l === 'string')
            .map(l => l.toUpperCase());
            
          console.log('Used lot letters:', usedLetters);
          
          // Find next available letter
          const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
          for (let i = 0; i < alphabet.length; i++) {
            if (!usedLetters.includes(alphabet[i])) {
              lot_letter = alphabet[i];
              break;
            }
          }
          
          console.log('Assigned lot letter:', lot_letter);
        } else {
          console.log('No existing forms found for same shift/machine/date, using A');
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
        production_no_2: formData.get('production_no_2'),
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
        // inspection_data removed - using direct columns instead
        total_rolls: 0,
        accepted_rolls: 0,
        rejected_rolls: 0,
        rework_rolls: 0,
        kiv_rolls: 0,
        created_at: new Date().toISOString()
      };
        
      const { data, error } = await supabase
        .from('inline_inspection_form_master_2')
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
      
      // Setup autocomplete for personnel fields
      setTimeout(() => {
        setupPersonnelAutocomplete();
      }, 100);
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
      .from('inline_inspection_form_master_2')
      .select(`
        id, traceability_code, lot_letter, customer, production_no, prod_code, spec,
        production_date, emboss_type, printed, non_printed, ct, year, month, date,
        mc_no, shift, supervisor, supervisor2, line_leader, line_leader2,
        operator, operator2, qc_inspector, qc_inspector2, status,
        total_rolls, accepted_rolls, rejected_rolls, rework_rolls, kiv_rolls,
        created_at, updated_at
      `)
      .order('production_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading forms:', error);
      return;
    }

    // Only show forms with a non-null and non-empty customer value
    const validForms = data.filter(form => form.customer !== null && form.customer !== '');
    allForms = validForms; // Store all forms for filtering
    filteredForms = validForms; // Initialize filtered forms with all valid forms
    await updateFormsTable(validForms, false); // false = show limited forms initially
    populateFilterDropdowns(); // Populate dropdowns after loading forms
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
async function updateFormsTable(forms, showAllForDateFilters = false) {
  const tbody = document.querySelector('table tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (forms.length === 0) {
    const isFiltered = filteredForms.length !== allForms.length;
    const message = isFiltered 
      ? 'No forms match the current filter criteria. Try adjusting your filters.'
      : 'No forms created yet. Click "Create Film Inspection Form" to get started.';
    
    tbody.innerHTML = `
      <tr>
        <td colspan="12" class="py-4 text-center text-gray-500">
          ${message}
        </td>
      </tr>
    `;
    return;
  }

    // Limit to maximum entries (unless date filters are applied)
  const limitedForms = showAllForDateFilters ? forms : forms.slice(0, MAX_FORMS_DISPLAY);

  // Get user department once for all forms
  const userDepartment = await getCurrentUserDepartment();

  limitedForms.forEach((form, index) => {
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
    
    // Add circle styling for M/C No
    const mcNo = form.mc_no || '-';
    let mcNoStyle = '';
    if (mcNo === '1' || mcNo === 1) {
      mcNoStyle = 'bg-red-500 text-white font-semibold rounded-full w-8 h-8 flex items-center justify-center mx-auto';
    } else if (mcNo === '2' || mcNo === 2) {
      mcNoStyle = 'bg-green-500 text-white font-semibold rounded-full w-8 h-8 flex items-center justify-center mx-auto';
    } else {
      mcNoStyle = 'bg-gray-500 text-white font-semibold rounded-full w-8 h-8 flex items-center justify-center mx-auto';
    }
    
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50 transition-colors';
    row.innerHTML = `
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">${showAllForDateFilters ? (forms.length - index) : (limitedForms.length - index)}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">${formatDate(form.production_date)}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">${form.prod_code || '-'}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">
        <div class="${mcNoStyle}">${mcNo}</div>
      </td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">${shiftDisplay}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">${operatorDisplay || '-'}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">${supervisorDisplay || '-'}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">${lineLeaderDisplay || '-'}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">${qcInspectorDisplay || '-'}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words ${statusColor}">${statusDisplay}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">
        <div class="flex justify-center space-x-3 flex-wrap max-w-full overflow-hidden">
          ${(!isSubmitted || hasPermission) ? `
            <!-- Sky blue Enter Data button - show if not submitted OR user has permission -->
            <button onclick="enterData('${form.traceability_code}', '${form.lot_letter}')" class="p-1.5 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-600 hover:text-sky-800 transition-all duration-200 border border-sky-200 hover:border-sky-300 flex-shrink-0" title="Enter Inspection Data">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
            </button>
            <!-- Green Edit button - show if not submitted OR user has permission -->
            <button onclick="editForm('${form.traceability_code}', '${form.lot_letter}')" class="p-1.5 rounded-md bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-800 transition-all duration-200 border border-green-200 hover:border-green-300 flex-shrink-0" title="Edit Form">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
            </button>
          ` : ''}
          <!-- Dark blue View button - always show -->
          <button onclick="viewForm('${form.traceability_code}', '${form.lot_letter}')" class="p-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 hover:text-blue-900 transition-all duration-200 border border-blue-200 hover:border-blue-300 flex-shrink-0" title="View Form">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
          </button>
          ${(!isSubmitted || hasPermission) ? `
            <!-- Red Delete button - show if not submitted OR user has permission -->
            <button onclick="deleteForm('${form.traceability_code}', '${form.lot_letter}')" class="p-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 transition-all duration-200 border border-red-200 hover:border-red-300 flex-shrink-0" title="Delete Form">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          ` : ''}
        </div>
      </td>
      <td class="py-3 px-4 text-center whitespace-normal break-words">
        <button onclick="downloadFormExcel('${form.traceability_code}', '${form.lot_letter}', this)" class="p-1.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-800 transition-all duration-200 border border-indigo-200 hover:border-indigo-300 flex-shrink-0" title="Download Form Excel">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 10l5 5 5-5M12 15V3" />
          </svg>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Show message at bottom of table if there are more forms than the limit (only when not showing all for date filters)
  if (!showAllForDateFilters && forms.length > MAX_FORMS_DISPLAY) {
    const remainingCount = forms.length - MAX_FORMS_DISPLAY;
    const messageRow = document.createElement('tr');
    messageRow.innerHTML = `
      <td colspan="12" class="py-4 text-center text-sm text-gray-600 bg-gray-50 border-t border-gray-200">
        <div class="flex items-center justify-center space-x-2">
          <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span class="font-medium text-gray-700">Showing ${MAX_FORMS_DISPLAY} of ${forms.length} forms. Use filters above to find forms not listed here.</span>
        </div>
      </td>
    `;
    tbody.appendChild(messageRow);
  }
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
    .from('inline_inspection_form_master_2')
    .select(`
      id, traceability_code, lot_letter, customer, production_no, production_no_2, prod_code, spec,
      production_date, emboss_type, printed, non_printed, ct, year, month, date,
      mc_no, shift, supervisor, supervisor2, line_leader, line_leader2,
      operator, operator2, qc_inspector, qc_inspector2, status,
      total_rolls, accepted_rolls, rejected_rolls, rework_rolls, kiv_rolls,
      created_at, updated_at
    `)
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
  console.log('Non-null form fields:', Object.entries(formData).filter(([key, value]) => value !== null && value !== '' && !['id', 'created_at', 'updated_at'].includes(key)));
  
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
  
  // Use direct fields only - inspection_data column has been removed
  const dataToUse = {
    customer: formData.customer || '',
    production_no: formData.production_no || '',
    production_no_2: formData.production_no_2 || '',
    prod_code: formData.prod_code || '',
    spec: formData.spec || '',
    production_date: formData.production_date || '',
    emboss_type: formData.emboss_type || '',
    printed: formData.printed || false,
    non_printed: formData.non_printed || false,
    ct: formData.ct || false,
    year: formData.year || '',
    month: formData.month || '',
    date: formData.date || '',
    mc_no: formData.mc_no || '',
    shift: formData.shift || '',
    supervisor: formData.supervisor || '',
    supervisor2: formData.supervisor2 || '',
    line_leader: formData.line_leader || '',
    line_leader2: formData.line_leader2 || '',
    operator: formData.operator || '',
    operator2: formData.operator2 || '',
    qc_inspector: formData.qc_inspector || '',
    qc_inspector2: formData.qc_inspector2 || ''
  };
  
  console.log('Filling form fields with data:', dataToUse);
  console.log('Original formData:', formData);
  
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
  form.production_no_2.value = dataToUse.production_no_2;
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
  
  // Setup autocomplete for edit mode
  setupPersonnelAutocomplete();
  setupProductAutocomplete();
  
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
      .from('inline_inspection_form_master_2')
      .delete()
      .eq('traceability_code', traceability_code)
      .eq('lot_letter', lot_letter);
    
    if (error) {
      console.error('Error deleting form:', error);
      alert('Error deleting form: ' + error.message);
      return;
    }
    
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
    showProgressIndicator('Fetching data...');

    // Call the Node.js export server with specific form parameters
    // Use localhost for IDE testing, Render URL for production
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const backendUrl = isLocalhost ? 'http://localhost:3000' : 'https://swanson-backend.onrender.com';
    const exportUrl = `${backendUrl}/export?traceability_code=${encodeURIComponent(traceability_code)}&lot_letter=${encodeURIComponent(lot_letter)}`;

    // Add timeout for slow connections
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 minute timeout

    // Start countdown after showing "Fetching data..."
    startCountdown();
    
    // Wait for countdown to complete (5 seconds) before making the request
    await new Promise(resolve => setTimeout(resolve, 5000));

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
      <div style="font-size: 18px; font-weight: 600; margin-bottom: 15px; color: #002E7D;">Downloading...</div>
      <div class="spinner" style="
        border: 3px solid rgba(0,46,125,0.3);
        border-top: 3px solid #002E7D;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
      "></div>
      <div id="countdown-message" style="font-size: 14px; opacity: 0.8; margin-bottom: 20px; color: #666;">${message}</div>
      <div class="diagonal-progress" style="
        height: 6px;
        background: repeating-linear-gradient(
          45deg,
          #002E7D 0px,
          #002E7D 8px,
          #1e40af 8px,
          #1e40af 16px,
          transparent 16px,
          transparent 24px
        );
        margin-top: 35px;
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
  
  // Start countdown if message is "Fetching data..."
  if (message === 'Fetching data...') {
    startCountdown();
  }
}

function startCountdown() {
  const countdownElement = document.getElementById('countdown-message');
  if (!countdownElement) return;
  
  let count = 5;
  const countdownInterval = setInterval(() => {
    if (count > 0) {
      countdownElement.textContent = `${count}`;
      count--;
    } else {
      clearInterval(countdownInterval);
      countdownElement.textContent = 'Starting download...';
    }
  }, 1000);
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





// ===== DOWNLOAD EXCEL FUNCTION =====
function downloadFormExcel(traceability_code, lot_letter, buttonElement) {
  // Show loading state on button
  const originalContent = buttonElement.innerHTML;
  buttonElement.innerHTML = `
    <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
    </svg>
  `;
  buttonElement.disabled = true;
  
  // Create download URL
  const basePath = window.location.pathname.includes('/public/') ? '/public' : '';
  const serverPort = window.location.hostname === 'localhost' ? '3000' : '';
  const downloadUrl = `http://${window.location.hostname}${serverPort ? ':' + serverPort : ''}/export?traceability_code=${encodeURIComponent(traceability_code)}&lot_letter=${encodeURIComponent(lot_letter)}`;
  
  // Create temporary link and trigger download
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `ILIF-${traceability_code}-${lot_letter}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Reset button after a short delay
  setTimeout(() => {
    buttonElement.innerHTML = originalContent;
    buttonElement.disabled = false;
  }, 2000);
}

// Add autocomplete functionality for personnel fields
async function setupPersonnelAutocomplete() {
    console.log('🔍 Setting up personnel autocomplete...');
    
    // Fetch all users from the database
    const { data: users, error } = await supabase
        .from('users')
        .select('full_name, department')
        .order('full_name');
    
    if (error) {
        console.error('❌ Error fetching users:', error);
        return;
    }
    
    console.log('📊 Fetched users:', users);
    
    // Filter users by department
    const productionUsers = users.filter(user => 
        user.department === 'Production'
    );
    const qcUsers = users.filter(user => 
        user.department === 'Quality Control' || user.department === 'Quality Assurance'
    );
    
    console.log('🏭 Production users:', productionUsers);
    console.log('🔬 QC users:', qcUsers);
    
    // Setup autocomplete for each field
    const personnelFields = [
        { name: 'supervisor', users: productionUsers },
        { name: 'supervisor2', users: productionUsers },
        { name: 'line_leader', users: productionUsers },
        { name: 'line_leader2', users: productionUsers },
        { name: 'operator', users: productionUsers },
        { name: 'operator2', users: productionUsers },
        { name: 'qc_inspector', users: qcUsers },
        { name: 'qc_inspector2', users: qcUsers }
    ];
    
    personnelFields.forEach(field => {
        const input = document.querySelector(`input[name="${field.name}"]`);
        console.log(`🔍 Looking for field: ${field.name}`, input);
        if (input) {
            console.log(`✅ Found field: ${field.name}, setting up autocomplete`);
            setupAutocompleteForField(input, field.users);
        } else {
            console.log(`❌ Field not found: ${field.name}`);
        }
    });
}

async function setupProductAutocomplete() {
    console.log('🔍 Setting up product autocomplete...');
    
    // Fetch all products from the database
    const { data: products, error } = await supabase
        .from('inline_products_master')
        .select('customer, prod_code, spec')
        .eq('is_active', true)
        .order('customer');
    
    if (error) {
        console.error('❌ Error fetching products:', error);
        return;
    }
    
    console.log('📊 Fetched products:', products);
    
    // Setup autocomplete for product fields
    const productFields = [
        { name: 'customer', field: 'customer', products: products },
        { name: 'prod_code', field: 'prod_code', products: products },
        { name: 'spec', field: 'spec', products: products }
    ];
    
    productFields.forEach(field => {
        const input = document.querySelector(`input[name="${field.name}"]`);
        console.log(`🔍 Looking for field: ${field.name}`, input);
        if (input) {
            console.log(`✅ Found field: ${field.name}, setting up autocomplete`);
            setupProductAutocompleteForField(input, field.products, field.field);
        } else {
            console.log(`❌ Field not found: ${field.name}`);
        }
    });
}

function setupAutocompleteForField(input, users) {
    console.log(`🎯 Setting up autocomplete for ${input.name} with ${users.length} users`);
    let dropdown = null;
    
    input.addEventListener('input', function() {
        const value = this.value.toLowerCase();
        console.log(`📝 Input value: "${value}"`);
        
        // Remove existing dropdown
        if (dropdown) {
            dropdown.remove();
            dropdown = null;
        }
        
        if (value.length < 1) return;
        
        // Filter users based on input
        const matches = users.filter(user => 
            user.full_name.toLowerCase().includes(value)
        ).slice(0, 5); // Limit to 5 suggestions
        
        console.log(`🔍 Matches found:`, matches);
        
        if (matches.length === 0) return;
        
        // Create dropdown
        dropdown = document.createElement('div');
        dropdown.className = 'absolute z-50 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto';
        dropdown.style.top = '100%';
        dropdown.style.left = '0';
        
        matches.forEach(user => {
            const item = document.createElement('div');
            item.className = 'px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm';
            item.textContent = user.full_name;
            item.addEventListener('click', function() {
                input.value = user.full_name;
                dropdown.remove();
                dropdown = null;
                console.log(`✅ Selected: ${user.full_name}`);
            });
            dropdown.appendChild(item);
        });
        
        // Position dropdown
        const rect = input.getBoundingClientRect();
        dropdown.style.width = rect.width + 'px';
        
        // Add to DOM
        input.parentNode.style.position = 'relative';
        input.parentNode.appendChild(dropdown);
        console.log(`📋 Dropdown created with ${matches.length} items`);
    });
    
    // Remove dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (dropdown && !input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.remove();
            dropdown = null;
        }
    });
    
    // Remove dropdown on blur
    input.addEventListener('blur', function() {
        setTimeout(() => {
            if (dropdown) {
                dropdown.remove();
                dropdown = null;
            }
        }, 150);
    });
}

function setupProductAutocompleteForField(input, products, fieldType) {
    console.log(`🎯 Setting up product autocomplete for ${input.name} with ${products.length} products`);
    let dropdown = null;
    
    input.addEventListener('input', function() {
        const value = this.value.toLowerCase();
        console.log(`📝 Input value: "${value}"`);
        
        // Remove existing dropdown
        if (dropdown) {
            dropdown.remove();
            dropdown = null;
        }
        
        if (value.length < 1) return;
        
        // Filter products based on input and field type
        let matches = products.filter(product => 
            product[fieldType].toLowerCase().includes(value)
        );
        
        // For customer field, show only unique customers
        if (fieldType === 'customer') {
            const uniqueCustomers = [...new Set(matches.map(product => product.customer))];
            matches = uniqueCustomers.map(customer => ({ customer }));
        }
        
        // No limit - show all matches since there aren't many products
        
        console.log(`🔍 Matches found:`, matches);
        
        if (matches.length === 0) return;
        
        // Create dropdown
        dropdown = document.createElement('div');
        dropdown.className = 'absolute z-50 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto';
        dropdown.style.top = '100%';
        dropdown.style.left = '0';
        
        matches.forEach(product => {
            const item = document.createElement('div');
            item.className = 'px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm';
            
            // Show different information based on field type
            let displayText = '';
            if (fieldType === 'customer') {
                displayText = product.customer;
            } else if (fieldType === 'prod_code') {
                displayText = `${product.prod_code} (${product.customer})`;
            } else if (fieldType === 'spec') {
                displayText = `${product.spec} (${product.customer} - ${product.prod_code})`;
            }
            
            item.textContent = displayText;
            item.addEventListener('click', function() {
                input.value = product[fieldType];
                dropdown.remove();
                dropdown = null;
                console.log(`✅ Selected: ${product[fieldType]}`);
                
                // Auto-fill related fields if they exist
                if (fieldType === 'customer') {
                    const prodCodeInput = document.querySelector('input[name="prod_code"]');
                    const specInput = document.querySelector('input[name="spec"]');
                    
                    // Find matching products for this customer
                    const customerProducts = products.filter(p => p.customer === product.customer);
                    if (customerProducts.length === 1) {
                        if (prodCodeInput) prodCodeInput.value = customerProducts[0].prod_code;
                        if (specInput) specInput.value = customerProducts[0].spec;
                    }
                } else if (fieldType === 'prod_code') {
                    const customerInput = document.querySelector('input[name="customer"]');
                    const specInput = document.querySelector('input[name="spec"]');
                    
                    if (customerInput) customerInput.value = product.customer;
                    if (specInput) specInput.value = product.spec;
                } else if (fieldType === 'spec') {
                    const customerInput = document.querySelector('input[name="customer"]');
                    const prodCodeInput = document.querySelector('input[name="prod_code"]');
                    
                    if (customerInput) customerInput.value = product.customer;
                    if (prodCodeInput) prodCodeInput.value = product.prod_code;
                }
            });
            dropdown.appendChild(item);
        });
        
        // Position dropdown
        const rect = input.getBoundingClientRect();
        dropdown.style.width = rect.width + 'px';
        
        // Add to DOM
        input.parentNode.style.position = 'relative';
        input.parentNode.appendChild(dropdown);
        console.log(`📋 Dropdown created with ${matches.length} items`);
    });
    
    // Remove dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (dropdown && !input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.remove();
            dropdown = null;
        }
    });
    
    // Remove dropdown on blur
    input.addEventListener('blur', function() {
        setTimeout(() => {
            if (dropdown) {
                dropdown.remove();
                dropdown = null;
            }
        }, 150);
    });
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
      
      // Setup autocomplete for create mode
      setupPersonnelAutocomplete();
      setupProductAutocomplete();
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
