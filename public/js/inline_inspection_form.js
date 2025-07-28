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
window.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('inlineInspectionEntryForm');
  const overlay = document.getElementById('inspectionFormOverlay');
  const createFormBtn = document.getElementById('showInspectionFormOverlay');
  const closeBtn = document.getElementById('closeInspectionFormOverlay');

  async function handleCreateForm(e) {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating...';
    submitBtn.disabled = true;
    try {
      const formData = new FormData(form);
      const year = formData.get('year') || '';
      const month = formData.get('month') || '';
      const date = formData.get('date') || '';
      const machine = formData.get('mc_no') || '';
      const shift = formData.get('shift') || '';
      const traceability_code = `${year}${month}${date}${machine}${shift}`;
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
      overlay.style.display = 'none';
      form.reset();
      showNotification('Form created successfully!', 'success');
      loadFormsTable();
    } catch (error) {
      console.error('Error:', error);
      alert('Error creating form: ' + error.message);
    } finally {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  }

  if (form) {
    // Remove the old addEventListener if present
    form.onsubmit = null;
  }

  if (createFormBtn) {
    createFormBtn.addEventListener('click', function() {
      if (form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Create Inline Inspection Form';
        form.onsubmit = handleCreateForm;
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
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">${form.shift}</td>
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
  // Fetch the form data for the given traceability_code (oldest by created_at)
  const { data, error } = await supabase
    .from('inline_inspection_form_master')
    .select('*')
    .eq('traceability_code', traceability_code)
    .order('created_at', { ascending: true });
  if (error || !data || data.length === 0) {
    alert('Error loading form for editing.');
    return;
  }
  const formData = data[0];
  
  const overlay = document.getElementById('inspectionFormOverlay');
  const form = document.getElementById('inlineInspectionEntryForm');
  if (!overlay || !form) return;
  
  // Fill all fields
  form.customer.value = formData.customer || '';
  form.production_no.value = formData.production_no || '';
  form.prod_code.value = formData.prod_code || '';
  form.spec.value = formData.spec || '';
  form.production_date.value = formData.production_date || '';
  form.emboss_type.value = formData.emboss_type || '';
  form.printed.checked = !!formData.printed;
  form.non_printed.checked = !!formData.non_printed;
  form.ct.checked = !!formData.ct;
  form.year.value = formData.year || '';
  form.month.value = formData.month || '';
  form.date.value = formData.date || '';
  form.mc_no.value = formData.mc_no || '';
  form.shift.value = formData.shift || '';
  form.supervisor.value = formData.supervisor || '';
  form.supervisor2.value = formData.supervisor2 || '';
  form.line_leader.value = formData.line_leader || '';
  form.line_leader2.value = formData.line_leader2 || '';
  form.operator.value = formData.operator || '';
  form.operator2.value = formData.operator2 || '';
  form.qc_inspector.value = formData.qc_inspector || '';
  form.qc_inspector2.value = formData.qc_inspector2 || '';
  
  // Show the overlay for editing form details
  overlay.style.display = 'flex';
}

async function deleteForm(traceability_code, lot_letter) {
  if (!confirm('Are you sure you want to delete this form?')) {
    return;
  }
  
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
  }
}

// Make form actions globally accessible for onclick handlers
window.enterData = enterData;
window.viewForm = viewForm;
window.editForm = editForm;
window.deleteForm = deleteForm;

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
