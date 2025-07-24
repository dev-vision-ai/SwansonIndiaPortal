import { supabase } from '../supabase-config.js';

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
      const formObject = {
        form_id: form_id,
        traceability_code: traceability_code,
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
      overlay.classList.add('hidden');
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
      overlay.classList.remove('hidden');
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      overlay.classList.add('hidden');
    });
  }

  // Close overlay when clicking outside
  if (overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.classList.add('hidden');
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
      .order('created_at', { ascending: true }); // Order by oldest first
    
    if (error) {
      console.error('Error loading forms:', error);
      return;
    }
    
    // Update table
    updateFormsTable(data);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// ===== UPDATE FORMS TABLE =====
function updateFormsTable(forms) {
  const tbody = document.querySelector('table tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  if (forms.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="py-4 text-center text-gray-500">
          No forms created yet. Click "Create Film Inspection Form" to get started.
        </td>
      </tr>
    `;
    return;
  }
  // Only display the first (oldest) row per traceability_code
  const seen = new Set();
  forms.forEach((form, index) => {
    if (seen.has(form.traceability_code)) return;
    seen.add(form.traceability_code);
    // Combine names with '/'
    const supervisorDisplay = [form.supervisor, form.supervisor2].filter(Boolean).join(' / ');
    const operatorDisplay = [form.operator, form.operator2].filter(Boolean).join(' / ');
    const lineLeaderDisplay = [form.line_leader, form.line_leader2].filter(Boolean).join(' / ');
    const qcInspectorDisplay = [form.qc_inspector, form.qc_inspector2].filter(Boolean).join(' / ');
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50 transition-colors';
    row.innerHTML = `
      <td class="py-3 px-4 border-r border-gray-200 text-center">${index + 1}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center">${formatDate(form.production_date)}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center">${form.prod_code || '-'}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center">${form.mc_no || '-'}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center">${form.shift}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center">${operatorDisplay || '-'}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center">${supervisorDisplay || '-'}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center">${lineLeaderDisplay || '-'}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center">${qcInspectorDisplay || '-'}</td>
      <td class="py-3 px-4 text-center">
        <div class="flex justify-center space-x-2">
          <button onclick="viewForm('${form.traceability_code}')" class="text-blue-600 hover:text-blue-800" title="View">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
          </button>
          <button onclick="editForm('${form.traceability_code}')" class="text-green-600 hover:text-green-800" title="Edit">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>
          <button onclick="deleteForm('${form.traceability_code}')" class="text-red-600 hover:text-red-800" title="Delete">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// ===== FORM ACTIONS =====
function viewForm(traceability_code) {
  // Redirect to data entry page with traceability_code
  window.location.href = `inline_inspection_data.html?traceability_code=${traceability_code}`;
}

async function editForm(traceability_code) {
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
  // Fill all fields (as before)
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
  // Change button text to 'Save Changes'
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Save Changes';
  // Show overlay
  overlay.classList.remove('hidden');
  // Change submit handler to update (not insert)
  form.onsubmit = async function(e) {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Saving...';
    submitBtn.disabled = true;
    try {
      const formDataEdit = new FormData(form);
      const updateObj = {
        customer: formDataEdit.get('customer'),
        production_no: formDataEdit.get('production_no'),
        prod_code: formDataEdit.get('prod_code'),
        spec: formDataEdit.get('spec'),
        production_date: formDataEdit.get('production_date'),
        emboss_type: formDataEdit.get('emboss_type'),
        printed: formDataEdit.get('printed') === 'on',
        non_printed: formDataEdit.get('non_printed') === 'on',
        ct: formDataEdit.get('ct') === 'on',
        year: formDataEdit.get('year'),
        month: formDataEdit.get('month'),
        date: formDataEdit.get('date'),
        mc_no: formDataEdit.get('mc_no'),
        shift: formDataEdit.get('shift'),
        supervisor: formDataEdit.get('supervisor'),
        supervisor2: formDataEdit.get('supervisor2'),
        line_leader: formDataEdit.get('line_leader'),
        line_leader2: formDataEdit.get('line_leader2'),
        operator: formDataEdit.get('operator'),
        operator2: formDataEdit.get('operator2'),
        qc_inspector: formDataEdit.get('qc_inspector'),
        qc_inspector2: formDataEdit.get('qc_inspector2'),
      };
      const { error: updateError } = await supabase
        .from('inline_inspection_form_master')
        .update(updateObj)
        .eq('traceability_code', traceability_code)
        .eq('created_at', formData.created_at);
      if (updateError) {
        alert('Error updating form: ' + updateError.message);
        return;
      }
      overlay.classList.add('hidden');
      form.reset();
      showNotification('Form updated successfully!', 'success');
      loadFormsTable();
    } catch (err) {
      alert('Error updating form: ' + err.message);
    } finally {
      submitBtn.textContent = 'Save Changes';
      submitBtn.disabled = false;
    }
  };
}

async function deleteForm(traceability_code) {
  if (!confirm('Are you sure you want to delete this form?')) {
    return;
  }
  
  try {
    const { error } = await supabase
      .from('inline_inspection_form_master')
      .delete()
      .eq('traceability_code', traceability_code);
    
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
window.viewForm = viewForm;
window.editForm = editForm;
window.deleteForm = deleteForm;

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
      overlay.classList.remove('hidden');
    });
  }
  
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      overlay.classList.add('hidden');
    });
  }
  
  // Close overlay when clicking outside
  if (overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.classList.add('hidden');
      }
    });
  }
});
