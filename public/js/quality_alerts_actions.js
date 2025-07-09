import { supabase } from '../supabase-config.js';

// ------------------- NEW: Role Constants & Helpers -------------------
const ROLE_QA_ADMIN = 'QA_ADMIN';
const ROLE_DEPT_ADMIN = 'DEPT_ADMIN';
const ROLE_EMPLOYEE = 'EMPLOYEE';
let currentUserRole = null; // Filled after auth lookup
let recipientEditCompleted = false; // Filled after alert fetch
let currentUserDepartment = null; // store department for redirects

// Redirect unauthenticated users to login & bounce back here after login
async function ensureAuthenticated() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // Store current URL so auth page can send us back after login
    sessionStorage.setItem('redirectAfterLogin', window.location.href);
    const basePath = window.location.pathname.includes('/public/') ? '/public' : '';
    window.location.href = `${basePath}/html/auth.html`;
    return null; // Stop further execution
  }
  return user;
}

// Determine role from users table
async function determineUserRole(userId) {
  try {
    const { data: profile } = await supabase
      .from('users')
      .select('is_admin, department')
      .eq('id', userId)
      .single();
    if (!profile) return ROLE_EMPLOYEE; // Fallback
    currentUserDepartment = profile.department || null; // store
    if (profile.is_admin && profile.department === 'Quality Assurance') return ROLE_QA_ADMIN;
    if (profile.is_admin) return ROLE_DEPT_ADMIN;
    return ROLE_EMPLOYEE;
  } catch (e) {
    console.error('Error determining user role:', e);
    return ROLE_EMPLOYEE;
  }
}
// ---------------------------------------------------------------------


const form = document.getElementById('alert-form');
const formTitle = document.getElementById('form-title');
const alertIdInput = document.getElementById('alertId'); // Hidden input
const alertIdDisplay = document.getElementById('alertIdDisplay'); // Visible display
const incidentDateInput = document.getElementById('incidentdate');
const incidentTimeInput = document.getElementById('incidenttime');
const userNameInput = document.getElementById('user_name');
const incidentTitleInput = document.getElementById('incidenttitle');
const incidentDescInput = document.getElementById('incidentdesc');
const responsibleDeptInput = document.getElementById('responsibledept');
const statusActionSelect = document.getElementById('statusaction');
// Add references for S, D, F and the calculate button
const severityInput = document.getElementById('severity');
const detectionInput = document.getElementById('detection');
const frequencyInput = document.getElementById('frequency');
const rpnInput = document.getElementById('rpn');

// Add reference for Repeat Alert dropdown
const repeatAlertSelect = document.getElementById('repeat_alert');

// Add event listeners for dynamic RPN calculation
if (severityInput && detectionInput && frequencyInput && rpnInput) {
  function calculateRPN() {
    const s = parseInt(severityInput.value) || 0;
    const d = parseInt(detectionInput.value) || 0;
    const f = parseInt(frequencyInput.value) || 0;
    rpnInput.value = s * d * f;
  }
  severityInput.addEventListener('input', calculateRPN);
  detectionInput.addEventListener('input', calculateRPN);
  frequencyInput.addEventListener('input', calculateRPN);
}
const rootCauseInput = document.getElementById('root_cause');
const correctiveActionsInput = document.getElementById('corrective_actions');
const remarksInput = document.getElementById('remarks');
// Add references for other read-only fields
const locationAreaInput = document.getElementById('locationarea');
const abnormalityTypeInput = document.getElementById('abnormalitytype');
const qualityRiskInput = document.getElementById('qualityrisk');
const keptInViewInput = document.getElementById('keptinview');
// --- ADD THIS LINE --- 
const shiftInput = document.getElementById('shift'); 
const productCodeInput = document.getElementById('productcode');
const rollIdInput = document.getElementById('rollid');
const lotNoInput = document.getElementById('lotno');
const rollPositionsInput = document.getElementById('rollpositions');
const lotTimeInput = document.getElementById('lottime');
const actionTakenInput = document.getElementById('actiontaken');
const whoActionInput = document.getElementById('whoaction');
const whenActionDateInput = document.getElementById('whenactiondate');
const timestampInput = document.getElementById('timestamp');
// Add references for Counter Measure row fields
const counterWhoInput = document.getElementById('counter_who');
const counterWhenInput = document.getElementById('counter_when');
const counterStatusInput = document.getElementById('counter_status');

// Add event listener for send alert button
document.getElementById('sendAlertButton').addEventListener('click', async function() {
  // Check if user is QA admin
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('is_admin, department')
      .eq('id', user.id)
      .single();
    if (!profile?.is_admin || profile?.department !== 'Quality Assurance') {
      alert('Only QA Admins can send alerts');
      return;
    }
  }

  // Gather all fields
  const alertId = document.getElementById('alertId').value;
  const department = document.getElementById('responsibledept').value;
  const rootCause = document.getElementById('root_cause').value;
  const correctiveActions = document.getElementById('corrective_actions').value;
  const incidentTitle = document.getElementById('incidenttitle').value;
  const incidentDesc = document.getElementById('incidentdesc').value;
  const userName = document.getElementById('user_name').value;
  const incidentDate = document.getElementById('incidentdate').value;
  const incidentTime = document.getElementById('incidenttime').value;
  const location = document.getElementById('locationarea').value;
  const abnormalityType = document.getElementById('abnormalitytype').value;
  // KIV fields
  const keptInViewInput = document.getElementById('keptinview');
  const productCodeInput = document.getElementById('productcode');
  const rollIdInput = document.getElementById('rollid');
  const lotNoInput = document.getElementById('lotno');
  const rollPositionsInput = document.getElementById('rollpositions');
  const lotTimeInput = document.getElementById('lottime');

  // Helper for alignment
  function padLabel(label, width) {
    return label.padEnd(width, ' ');
  }
  function formatDateDDMMYYYY(dateString) {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) { return dateString; }
  }
  const labelWidth = 18; // Adjust for best alignment

  const subject = `Internal Quality Alert Notification!`;
  let body = '';
  body += 'Dear Team,\n\n';
  body += 'Please find below the details of a new Quality Alert:\n\n';
  body += '------------------------------------------------------------\n';
  body += `${padLabel('Date', labelWidth)}: ${formatDateDDMMYYYY(incidentDate)}\n`;
  body += `${padLabel('Reported By', labelWidth)}: ${userName}\n`;
  body += `${padLabel('Time', labelWidth)}: ${incidentTime}\n\n`;
  body += 'Incident Details:\n';
  body += '------------------------------------------------------------\n';
  body += `${padLabel('Title', labelWidth)}: ${incidentTitle}\n`;
  body += `${padLabel('Description', labelWidth)}: ${incidentDesc}\n`;
  body += `${padLabel('Location/Area', labelWidth)}: ${location}\n`;
  body += `${padLabel('Abnormality Type', labelWidth)}: ${abnormalityType}\n`;
  body += `${padLabel('Department', labelWidth)}: ${department}\n`;

  // KIV Details if present
  if (keptInViewInput && keptInViewInput.value === 'yes') {
    body += '\nKIV Details:\n';
    body += '------------------------------------------------------------\n';
    body += `${padLabel('Product Code', labelWidth)}: ${productCodeInput.value}\n`;
    body += `${padLabel('Roll ID', labelWidth)}: ${rollIdInput.value}\n`;
    body += `${padLabel('Lot No', labelWidth)}: ${lotNoInput.value}\n`;
    body += `${padLabel('Roll Positions', labelWidth)}: ${rollPositionsInput.value}\n`;
    body += `${padLabel('Lot Time', labelWidth)}: ${lotTimeInput.value}\n`;
  }

  body += '\n------------------------------------------------------------\n';
  // Determine whether '/public' segment is needed (present when server root is project root)
  const needsPublic = window.location.pathname.includes('/public/');
  const basePath = needsPublic ? '/public' : '';
  const alertLink = `${window.location.origin}${basePath}/html/quality_alerts_actions.html?id=${alertId}&action=edit`;
  body += `Please use the following link to fill in immediate actions and corrective measures:\n${alertLink}\n\n`;

  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});
const draftedAtInput = document.getElementById('drafted_at');

// saveButton is already declared earlier in the file – avoid redeclaration
const loadingMessage = document.getElementById('loading-message');
const errorMessage = document.getElementById('error-message');

// --- Helper Functions ---
function formatDate(dateString) {
    if (!dateString) return '';
    // Handles Supabase 'date' (YYYY-MM-DD) or 'timestamptz'
    try {
        const date = new Date(dateString);
        // Format to YYYY-MM-DD for input type="date"
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) { return dateString; }
}

function formatTime(timeString) {
    // Assuming timeString is like 'HH:MM:SS' or part of a timestamp
    if (!timeString) return '';
    try {
        // If it's part of a timestamp, extract time
        if (timeString.includes('T')) {
            return timeString.split('T')[1].substring(0, 8); // HH:MM:SS
        }
        // If it's already HH:MM:SS or similar
        if (timeString.includes(':')) {
             return timeString.substring(0, 8); // Ensure HH:MM:SS
        }
        return timeString; // Return as is if format is unexpected
    } catch (e) { return timeString; }
}


function formatTimestampForDisplay(timestampString) {
    if (!timestampString) return 'N/A';
    try {
        return new Date(timestampString).toLocaleString();
    } catch (e) { return timestampString; }
}

// --- Main Logic ---

document.addEventListener('DOMContentLoaded', async () => {
    // Ensure user is logged in or redirect
    const user = await ensureAuthenticated();
    if (!user) return; // Redirected

    currentUserRole = await determineUserRole(user.id);

    if (form) form.style.display = 'none';
    if (errorMessage) errorMessage.style.display = 'none';
    if (loadingMessage) loadingMessage.style.display = 'block';

    const params = new URLSearchParams(window.location.search);
    const alertId = params.get('id');
    const actionParam = params.get('action'); // 'view', 'edit', etc.

    if (!alertId) {
        showError('Invalid URL parameters');
        return;
    }

    // Handle new alert creation (QA Admin only)
    if (actionParam === 'new') {
        if (currentUserRole !== ROLE_QA_ADMIN) {
            showError('Only QA Admins can create new alerts.');
            return;
        }
        try {
            const nextId = await getNextAlertId();
            alertIdDisplay.value = nextId;
            alertIdInput.value = nextId;
            setupFormMode('edit');
            if (form) form.style.display = 'block';
            if (loadingMessage) loadingMessage.style.display = 'none';

            // Initialize empty form with current user and timestamp
            userNameInput.value = user.email || 'Current User';
            const now = new Date();
            incidentDateInput.value = formatDate(now.toISOString());
            incidentTimeInput.value = formatTime(now.toISOString());
            return;
        } catch (err) {
            showError('Failed to initialize new alert: ' + err.message);
            return;
        }
    }

    try {
        const alertData = await fetchAlertDetails(alertId);
        if (!alertData) {
            showError('Failed to load alert details.');
            return;
        }
        recipientEditCompleted = !!alertData.recipient_edit_completed;
        populateForm(alertData);

        // Determine page mode based on role & completion flag
        if (currentUserRole === ROLE_QA_ADMIN) {
            const desiredMode = actionParam === 'edit' ? 'edit' : 'view';
            setupFormMode(desiredMode); // Full permissions
        } else if (currentUserRole === ROLE_DEPT_ADMIN) {
            if (recipientEditCompleted) {
                setupDeptAdminMode(true); // read-only
            } else {
                setupDeptAdminMode(false); // limited edit
            }
        } else if (actionParam === 'view' && sessionStorage.getItem('empViewAccess') === 'true') {
            // Employee came from emp table, allow view-only
            setupFormMode('view');
        } else {
            // Employee / unauthorized
            showError('You are not authorized to view this page.');
            return;
        }

        if (form) form.style.display = 'block';
        if (loadingMessage) loadingMessage.style.display = 'none';
    } catch (error) {
        console.error('Unexpected error during data loading:', error);
        showError('An unexpected error occurred while loading alert details.');
    }
    // Setup custom back button behaviour
    setupBackButton();
});

// --- Functions ---

async function fetchAlertDetails(id) {
    try {
        const { data, error } = await supabase
            .from('quality_alerts')
            .select(`*, users ( full_name )`)
            .eq('id', id)
            .single();

        if (error) {
            console.error("Supabase error:", error);
            throw error;
        }
        if (!data) {
            console.error("No data found for alert ID:", id);
            throw new Error("Alert not found.");
        }
        console.log("Fetched Alert Details:", data);
        return data;
    } catch (error) {
        console.error("Error fetching alert details:", error);
        showError(`Error loading alert details: ${error.message}`);
        return null;
    }
}

function populateForm(data) {
    // Helper to safely get data or return empty string for inputs
    const get = (value) => value !== null && value !== undefined ? value : '';

    if (alertIdInput) alertIdInput.value = data.id; // Hidden input
    if (alertIdDisplay) alertIdDisplay.value = get(data.id); // Visible input
    if (userNameInput) userNameInput.value = data.users ? get(data.users.full_name) : 'Unknown';
    if (incidentDateInput) incidentDateInput.value = formatDate(data.incidentdate);
    if (incidentTimeInput) incidentTimeInput.value = formatTime(data.incidenttime || data.timestamp); // Use incidenttime if available, else try timestamp

    // Editable fields
    if (incidentTitleInput) incidentTitleInput.value = get(data.incidenttitle);
    if (incidentDescInput) incidentDescInput.value = get(data.incidentdesc);
    if (responsibleDeptInput) responsibleDeptInput.value = get(data.responsibledept);
    if (statusActionSelect) statusActionSelect.value = get(data.statusaction);
    if (severityInput) severityInput.value = get(data.severity);
    if (detectionInput) detectionInput.value = get(data.detection);
    if (frequencyInput) frequencyInput.value = get(data.frequency);
    if (rpnInput) rpnInput.value = get(data.rpn); // Populate existing RPN
    if (rootCauseInput) rootCauseInput.value = get(data.root_cause);
    if (correctiveActionsInput) correctiveActionsInput.value = get(data.corrective_actions);
    if (remarksInput) remarksInput.value = get(data.remarks);
    if (counterWhoInput) counterWhoInput.value = get(data.counter_who);
    if (counterWhenInput) counterWhenInput.value = get(data.counter_when);
    if (counterStatusInput) counterStatusInput.value = get(data.counter_status);

    // Other read-only fields
    if (locationAreaInput) locationAreaInput.value = get(data.locationarea);
    if (abnormalityTypeInput) abnormalityTypeInput.value = get(data.abnormalitytype); // Ensure this is populated
    if (qualityRiskInput) qualityRiskInput.value = get(data.qualityrisk);
    if (keptInViewInput) keptInViewInput.value = get(data.keptinview);
    if (shiftInput) shiftInput.value = get(data.shift);
    if (productCodeInput) productCodeInput.value = get(data.productcode);
    if (rollIdInput) rollIdInput.value = get(data.rollid);
    if (lotNoInput) lotNoInput.value = get(data.lotno);
    if (rollPositionsInput) rollPositionsInput.value = get(data.rollpositions);
    if (lotTimeInput) lotTimeInput.value = get(data.lottime);
    if (actionTakenInput) actionTakenInput.value = get(data.actiontaken);
    if (whoActionInput) whoActionInput.value = get(data.whoaction);
    if (whenActionDateInput) whenActionDateInput.value = get(data.whenactiondate);
    if (timestampInput) timestampInput.value = formatTimestampForDisplay(data.timestamp);
    if (draftedAtInput) draftedAtInput.value = formatTimestampForDisplay(data.drafted_at);
    if (repeatAlertSelect) repeatAlertSelect.value = get(data.repeat_alert);

    // Display images
    const imageDisplayContainer = document.getElementById('imageDisplayContainer');
    if (imageDisplayContainer) {
        imageDisplayContainer.innerHTML = ''; // Clear previous images

        if (data.image_urls && data.image_urls.length > 0) {
            let imagesProcessed = 0;
            let successfulLoads = 0;
            const totalImages = data.image_urls.length;

            const checkCompletion = () => {
                if (imagesProcessed === totalImages) {
                    if (successfulLoads === 0) {
                        imageDisplayContainer.innerHTML = '<p>No images uploaded for this alert.</p>';
                    }
                }
            };

            data.image_urls.forEach(url => {
                const img = new Image(); // Use new Image() for better control over loading
                img.src = url;
                img.style.maxWidth = '200px';
                img.style.margin = '10px';
                img.style.borderRadius = '4px';

                img.onload = () => {
                    imageDisplayContainer.appendChild(img);
                    successfulLoads++;
                    imagesProcessed++;
                    checkCompletion();
                };

                img.onerror = () => {
                    console.warn(`Failed to load image: ${url}`);
                    imagesProcessed++;
                    checkCompletion();
                };
            });
        } else {
            imageDisplayContainer.innerHTML = '<p>No images uploaded for this alert.</p>';
        }
    }

    // --- Ensure this logic exists ---
    const kivDetailsSection = document.querySelector('.kiv-details');
    if (kivDetailsSection) {
        kivDetailsSection.style.display = data.keptinview === 'yes' ? 'block' : 'none';
    }
    // --- End of confirmation ---
}

function setupFormMode(action) {
    const isEditMode = action === 'edit' || action === 'new';
    formTitle.textContent = isEditMode ? 'Edit Quality Alert Details' : 'View Quality Alert Details';

    // Define which fields are *always* read-only
    const alwaysReadOnlyFields = [
        userNameInput, incidentDateInput, incidentTimeInput,
        keptInViewInput,
        timestampInput, draftedAtInput,
        rpnInput, // Add RPN input to always read-only
    ];

    // Set readOnly/disabled for always read-only fields
    alwaysReadOnlyFields.forEach(field => {
        if (field) { // Check if field is not null
            if (field.tagName === 'SELECT') field.disabled = true;
            else field.readOnly = true;
        }
    });

    // Set readOnly/disabled for alertIdDisplay based on mode
    if (alertIdDisplay) {
        alertIdDisplay.readOnly = !isEditMode;
    }

    // Define which fields are editable *only* in edit mode
    const conditionallyEditableFields = [
        incidentTitleInput, incidentDescInput, responsibleDeptInput,
        statusActionSelect, rootCauseInput,
        correctiveActionsInput, remarksInput,
        locationAreaInput, abnormalityTypeInput, qualityRiskInput,
        // --- ADD shiftInput HERE --- 
        shiftInput,
        // --- REMOVE 'defectDescriptionInput' FROM THIS ARRAY --- 
        productCodeInput, rollIdInput, lotNoInput,
        rollPositionsInput, lotTimeInput, actionTakenInput, whoActionInput,
        whenActionDateInput,
        counterWhoInput, counterWhenInput, counterStatusInput,
        severityInput, detectionInput, frequencyInput // Add S, D, F inputs here
    ];

    // Set readOnly/disabled for conditionally editable fields based on mode
    conditionallyEditableFields.forEach(field => {
        if (field) { // Check if field is not null
            if (field.tagName === 'SELECT') {
                field.disabled = !isEditMode;
            } else {
                field.readOnly = !isEditMode;
            }
        }
    });

    // Lock repeat_alert dropdown in view mode
    if (repeatAlertSelect) {
        repeatAlertSelect.disabled = !isEditMode;
    }

    // Show/hide save button and attach/detach submit listener
    if (isEditMode) {
        if (saveButton) saveButton.classList.remove('hidden');
        if (form) form.addEventListener('submit', handleFormSubmit);
        if (deleteButton) deleteButton.classList.remove('hidden');
        // Show Send Alert button
        const sendAlertButton = document.getElementById('sendAlertButton');
        if (sendAlertButton) sendAlertButton.style.display = '';
    } else {
        if (saveButton) saveButton.classList.add('hidden');
        if (form) form.removeEventListener('submit', handleFormSubmit);
        if (deleteButton) deleteButton.classList.add('hidden');
        // Hide Send Alert button
        const sendAlertButton = document.getElementById('sendAlertButton');
        if (sendAlertButton) sendAlertButton.style.display = 'none';
    }
}

function setupDeptAdminMode(isReadOnly) {
    const isEditMode = !isReadOnly;
    formTitle.textContent = isEditMode ? 'Edit Quality Alert Details' : 'View Quality Alert Details';

    // Define which fields are *always* read-only
    const alwaysReadOnlyFields = [
        userNameInput, incidentDateInput, incidentTimeInput,
        keptInViewInput,
        timestampInput, draftedAtInput,
        rpnInput,
        severityInput, detectionInput, frequencyInput,
        remarksInput,
    ];

    // Set readOnly/disabled for always read-only fields
    alwaysReadOnlyFields.forEach(field => {
        if (field) { // Check if field is not null
            if (field.tagName === 'SELECT') field.disabled = true;
            else field.readOnly = true;
        }
    });

    // Set readOnly/disabled for alertIdDisplay based on mode
    if (alertIdDisplay) {
        alertIdDisplay.readOnly = !isEditMode;
    }

    // Fields Dept Admin is allowed to edit when editable
    const allowedEditableFields = [
        statusActionSelect,
        actionTakenInput, whoActionInput, whenActionDateInput,
        rootCauseInput,
        correctiveActionsInput,
        counterWhoInput, counterWhenInput, counterStatusInput,
    ];

    // First, set everything in the form to read-only / disabled
    document.querySelectorAll('#alert-form input, #alert-form textarea, #alert-form select').forEach(el => {
        if (el.tagName === 'SELECT') el.disabled = true;
        else el.readOnly = true;
    });

    // Then re-enable only the allowed fields if in edit mode
    if (isEditMode) {
        allowedEditableFields.forEach(field => {
            if (!field) return;
            if (field.tagName === 'SELECT') field.disabled = false;
            else field.readOnly = false;
        });
    }

    // Lock repeat_alert dropdown in view mode
    if (repeatAlertSelect) {
        repeatAlertSelect.disabled = !isEditMode;
    }

    // Show/hide save button and attach/detach submit listener
    if (isEditMode) {
        if (saveButton) saveButton.classList.remove('hidden');
        if (form) form.addEventListener('submit', handleFormSubmit);
        // Hide admin-only buttons
        if (deleteButton) deleteButton.classList.add('hidden');
        const sendAlertButton = document.getElementById('sendAlertButton');
        if (sendAlertButton) sendAlertButton.style.display = 'none';
    } else {
        if (saveButton) saveButton.classList.add('hidden');
        if (form) form.removeEventListener('submit', handleFormSubmit);
        if (deleteButton) deleteButton.classList.add('hidden');
        const sendAlertButton = document.getElementById('sendAlertButton');
        if (sendAlertButton) sendAlertButton.style.display = 'none';
    }
}

// ---------------- Handle Save for Dept Admin ------------------
async function handleDeptAdminSubmit(event) {
    event.preventDefault();
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    const originalId = alertIdInput.value;
    const updatedData = {
        statusaction: statusActionSelect.value,
        actiontaken: actionTakenInput.value,
        whoaction: whoActionInput.value,
        whenactiondate: whenActionDateInput.value || null,
        root_cause: rootCauseInput.value,
        corrective_actions: correctiveActionsInput.value,
        counter_who: counterWhoInput.value,
        counter_when: counterWhenInput.value,
        counter_status: counterStatusInput.value,
        recipient_edit_completed: true,
    };

    try {
        const { error } = await supabase
            .from('quality_alerts')
            .update(updatedData)
            .eq('id', originalId);

        if (error) throw error;
        alert('Changes saved successfully!');
        window.history.replaceState({}, '', `?id=${originalId}&action=view`);
        setTimeout(() => window.location.reload(), 300);
    } catch (error) {
        console.error('Error saving changes:', error);
        alert(`Error saving changes: ${error.message}`);
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Save Changes';
    }
}

// Adjust existing handler to branch by role

async function handleFormSubmit(event) {
    if (currentUserRole === ROLE_DEPT_ADMIN) {
        // Dept Admin uses separate handler
        return handleDeptAdminSubmit(event);
    }

    event.preventDefault();
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    const originalId = alertIdInput.value; // Original ID for query
    const updatedData = {
        id: alertIdDisplay.value, // New alert ID to update
        incidenttitle: incidentTitleInput.value,
        incidentdesc: incidentDescInput.value,
        responsibledept: responsibleDeptInput.value,
        statusaction: statusActionSelect.value,
        severity: severityInput.value ? parseInt(severityInput.value, 10) : null,
        detection: detectionInput.value ? parseInt(detectionInput.value, 10) : null,
        frequency: frequencyInput.value ? parseInt(frequencyInput.value, 10) : null,
        rpn: rpnInput.value ? parseInt(rpnInput.value, 10) : null, // Update calculated RPN
        root_cause: rootCauseInput.value,
        corrective_actions: correctiveActionsInput.value,
        remarks: remarksInput.value,
        locationarea: locationAreaInput.value,
        abnormalitytype: abnormalityTypeInput.value,
        qualityrisk: qualityRiskInput.value,
        // --- ADD shift HERE --- 
        shift: shiftInput.value,
        productcode: productCodeInput.value,
        rollid: rollIdInput.value,
        lotno: lotNoInput.value,
        rollpositions: rollPositionsInput.value,
        lottime: lotTimeInput.value || null,  // Convert empty string to null
        actiontaken: actionTakenInput.value,
        whoaction: whoActionInput.value,
        whenactiondate: whenActionDateInput.value || null,
        counter_who: counterWhoInput.value,
        counter_when: counterWhenInput.value,
        counter_status: counterStatusInput.value,
        repeat_alert: repeatAlertSelect ? repeatAlertSelect.value : null,
    };

    try {
        // Check for network connectivity
        if (!navigator.onLine) {
            alert('You are offline. Please check your internet connection and try again.');
            return;
        }
        const { error } = await supabase
            .from('quality_alerts')
            .update(updatedData)
            .eq('id', originalId);

        if (error) throw error;
        alert('Alert updated successfully!');
        // Replace current history entry instead of adding new one
        window.history.replaceState({}, '', `?id=${updatedData.id}&action=view`);
        // Add a short delay before reload to ensure request completes
        setTimeout(() => {
            window.location.reload();
        }, 300);
    } catch (error) {
        console.error("Error updating alert:", error);
        if (error.message && error.message.includes('Failed to fetch')) {
            alert('Network error: Failed to reach the server. Please check your connection and try again.');
        } else {
            alert(`Error updating alert: ${error.message || JSON.stringify(error)}`);
        }
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Save Changes';
    }
}

function showError(message) {
    loadingMessage.style.display = 'none';
    form.style.display = 'none';
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

// DELETE BUTTON LOGIC (clean, robust, only once)
let deleteButton = document.querySelector('.delete-button');
if (!deleteButton) {
    deleteButton = document.createElement('button');
    deleteButton.type = 'button'; // Prevent form submission on delete
    deleteButton.textContent = 'Delete';
    deleteButton.classList.add('delete-button', 'red-button');
    if (window.saveButton) {
        saveButton.insertAdjacentElement('afterend', deleteButton);
    } else {
        document.body.appendChild(deleteButton); // fallback
    }
}
// Remove any previous click handlers (if any)
deleteButton.replaceWith(deleteButton.cloneNode(true));
deleteButton = document.querySelector('.delete-button');
deleteButton.type = 'button'; // Ensure type is always button
deleteButton.addEventListener('click', async function () {
    if (confirm('Are you sure you want to delete this alert?')) {
        try {
            const { error } = await supabase
                .from('quality_alerts')
                .delete()
                .match({ id: alertIdInput.value });
            if (error) throw error;
            alert('Alert deleted successfully!');
            setTimeout(() => {
                window.history.replaceState({}, '', 'quality_alerts_table.html');
                window.location.href = 'quality_alerts_table.html';
            }, 300);
        } catch (error) {
            console.error('Delete error details:', error);
            alert(`Error deleting alert: ${error.message || 'Check console for details'}`);
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
  // Auto-expand textareas based on content
  function adjustTextareaHeight(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight + 2) + 'px';
    textarea.style.overflowY = 'hidden';
    textarea.style.minHeight = '50px';
  }

  // Initialize all textareas
  document.querySelectorAll('textarea').forEach(textarea => {
    adjustTextareaHeight(textarea);
    
    // Add input event listener
    textarea.addEventListener('input', function() {
      adjustTextareaHeight(this);
    });
    
    // Add ResizeObserver for content changes
    new ResizeObserver(() => adjustTextareaHeight(textarea)).observe(textarea);
  });
});

async function getNextAlertId() {
    // Get current year and month
    const now = new Date();
    const year = now.getFullYear() % 100; // last two digits
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `${year}${month}`; // e.g., 2507

    // Query Supabase for all IDs starting with this prefix
    const { data, error } = await supabase
        .from('quality_alerts')
        .select('id')
        .like('id', `${prefix}-%`);

    if (error) {
        console.error('Error fetching alert IDs:', error);
        throw error;
    }

    // Find the highest serial number for this month
    let maxSerial = 0;
    if (data && data.length > 0) {
        data.forEach(row => {
            const match = row.id.match(/^\d{4}-(\d{2})$/);
            if (match) {
                const serial = parseInt(match[1], 10);
                if (serial > maxSerial) maxSerial = serial;
            }
        });
    }
    const nextSerial = String(maxSerial + 1).padStart(2, '0');
    return `${prefix}-${nextSerial}`;
}

function setupBackButton() {
    const buttons = document.querySelectorAll('.header-back-button, .btn-back-top, .btn-back');
    if (!buttons.length) return;
    const basePath = window.location.pathname.includes('/public/') ? '/public' : '';
    const params = new URLSearchParams(window.location.search);
    const fromTable = params.get('from') === 'table';
    buttons.forEach(btn => {
        btn.onclick = null;
        btn.addEventListener('click', e => {
            e.preventDefault();
            if (currentUserRole === ROLE_DEPT_ADMIN) {
                let dest = '/html/employee_dashboard.html';
                switch ((currentUserDepartment || '').trim()) {
                    case 'Human Resources': dest = '/html/admin_adhr.html'; break;
                    case 'Quality Assurance': dest = '/html/admin_qa.html'; break;
                    case 'IQA': dest = '/html/admin_iqa.html'; break;
                    case 'QC':
                    case 'Quality Control': dest = '/html/admin_qc.html'; break;
                    default: dest = '/html/employee_dashboard.html';
                }
                window.location.href = `${basePath}${dest}`;
            } else if (currentUserRole === ROLE_QA_ADMIN) {
                if (fromTable) {
                    window.location.href = `${basePath}/html/quality_alerts_table.html`;
                } else {
                    window.location.href = `${basePath}/html/admin_qa.html`;
                }
            } else {
                window.history.back();
            }
        });
    });
}