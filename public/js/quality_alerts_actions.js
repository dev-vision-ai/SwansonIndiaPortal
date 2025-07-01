import { supabase } from '../supabase-config.js';

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


// Add event listeners for dynamic RPN calculation
severityInput.addEventListener('input', calculateRPN);
detectionInput.addEventListener('input', calculateRPN);
frequencyInput.addEventListener('input', calculateRPN);

function calculateRPN() {
    const severity = parseInt(severityInput.value) || 0;
    const detection = parseInt(detectionInput.value) || 0;
    const frequency = parseInt(frequencyInput.value) || 0;
    const rpn = severity * detection * frequency;
    rpnInput.value = rpn;
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
  
  if (!department) {
    alert('Please specify the responsible department');
    return;
  }
  
  // Construct detailed email body with only alerts action table data
  const subject = `Internal Quality Alerts Notification!`;
  const body =`

Quality Alert Notification
=========================
Hi Team,
Please find below the Quality Alerts Notification: 
-----------------
Date: ${incidentDate}
Reported By: ${userName}
Time: ${incidentTime}

Incident Details:
-----------------
Title: ${incidentTitle}
Description: ${incidentDesc}
Location/Area: ${location}
Abnormality Type: ${abnormalityType}
Responsible Department: ${department}

${keptInViewInput.value === 'yes' ? `
KIV Details:
-----------------
Product Code: ${productCodeInput.value}
Roll ID: ${rollIdInput.value}
Lot No: ${lotNoInput.value}
Roll Positions: ${rollPositionsInput.value}
Lot Time: ${lotTimeInput.value}
` : ''}
==========================

Please reply with below details:

Immediate Action :
-------------------
1.
2.
-------------------

Root Cause Analysis:
-------------------


-------------------

Corrective Actions:
-------------------
1.
2.
-------------------
`;

  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});
const draftedAtInput = document.getElementById('drafted_at');

const saveButton = document.getElementById('saveButton');
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
    if (form) form.style.display = 'none';
    if (errorMessage) errorMessage.style.display = 'none';
    if (loadingMessage) loadingMessage.style.display = 'block';

    const params = new URLSearchParams(window.location.search);
    const alertId = params.get('id');
    const action = params.get('action'); // 'view', 'edit', or 'new'

    // Handle new alert creation
    if (action === 'new') {
        try {
            const nextId = await getNextAlertId();
            alertIdDisplay.value = nextId;
            alertIdInput.value = nextId;
            setupFormMode('edit');
            if (form) form.style.display = 'block';
            if (loadingMessage) loadingMessage.style.display = 'none';
            
            // Initialize empty form with current user and timestamp
            userNameInput.value = "Current User"; // Replace with actual user
            const now = new Date();
            incidentDateInput.value = formatDate(now.toISOString());
            incidentTimeInput.value = formatTime(now.toISOString());
            return;
        } catch (error) {
            showError("Failed to initialize new alert: " + error.message);
            return;
        }
    }

    // Existing validation for view/edit modes
    if (!alertId || (action !== 'view' && action !== 'edit')) {
        showError("Invalid URL parameters");
        return;
    }

    try {
        const alertData = await fetchAlertDetails(alertId);

        if (alertData) {
            populateForm(alertData);
            setupFormMode(action); // Setup view or edit mode
            if (form) form.style.display = 'block'; // Ensure form is displayed
            if (loadingMessage) loadingMessage.style.display = 'none';
        } else {
            showError("Failed to load alert details.");
        }
    } catch (error) {
        console.error("Unexpected error during data loading:", error);
        showError("An unexpected error occurred while loading alert details.");
    }

    // Add event listener for the calculate button
    
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
    if (whenActionDateInput) whenActionDateInput.value = formatDate(data.whenactiondate);
    if (timestampInput) timestampInput.value = formatTimestampForDisplay(data.timestamp);
    if (draftedAtInput) draftedAtInput.value = formatTimestampForDisplay(data.drafted_at);

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
        timestampInput, draftedAtInput
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
        whenActionDateInput
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

    // Ensure RPN fields and calculate button are always editable
    
    

    // Show/hide save button and attach/detach submit listener
    if (isEditMode) {
        if (saveButton) saveButton.classList.remove('hidden');
        if (form) form.addEventListener('submit', handleFormSubmit);
        if (deleteButton) deleteButton.classList.remove('hidden');
    } else {
        if (saveButton) saveButton.classList.add('hidden');
        if (form) form.removeEventListener('submit', handleFormSubmit);
        if (deleteButton) deleteButton.classList.add('hidden');
    }
}



async function handleFormSubmit(event) {
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
        // --- DELETE THIS LINE --- 
        // defectdescription: defectDescriptionInput.value,
        productcode: productCodeInput.value,
        rollid: rollIdInput.value,
        lotno: lotNoInput.value,
        rollpositions: rollPositionsInput.value,
        lottime: lotTimeInput.value || null,  // Convert empty string to null
        actiontaken: actionTakenInput.value,
        whoaction: whoActionInput.value,
        whenactiondate: whenActionDateInput.value || null,
    };

    try {
        const { error } = await supabase
            .from('quality_alerts')
            .update(updatedData)
            .eq('id', originalId);

        if (error) throw error;
        alert('Alert updated successfully!');
        
        // Replace current history entry instead of adding new one
        window.history.replaceState({}, '', `?id=${updatedData.id}&action=view`);
        window.location.reload();  // Refresh to load new ID
    } catch (error) {
        console.error("Error updating alert:", error);
        alert(`Error updating alert: ${error.message || JSON.stringify(error)}`);
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

// Delete button creation (modify this section)
let deleteButton = document.querySelector('.delete-button');
if (!deleteButton) {
    deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.classList.add('delete-button', 'red-button');
    saveButton.insertAdjacentElement('afterend', deleteButton);
}

// Delete event handler (modify this section)
deleteButton.addEventListener('click', async function handler() {
    if (confirm('Are you sure you want to delete this alert?')) {
        try {
            const { error } = await supabase
                .from('quality_alerts')
                .delete()
                .match({ id: alertIdInput.value });

            if (error) throw error;
            
            // Replace history before redirect
            window.history.replaceState({}, '', 'quality_alerts_table.html');
            window.location.href = 'quality_alerts_table.html';

        } catch (error) {
            console.error('Delete error details:', error);
            alert(`Error deleting alert: ${error.message || 'Check console for details'}`);
        }
    }
}, {once: true}); // Ensures the listener only fires once
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
