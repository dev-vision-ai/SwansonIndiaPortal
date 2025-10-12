import { supabase } from '../supabase-config.js';

// Auto-expand textarea fields
function autoExpandTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

// Initialize auto-expand for textareas
document.addEventListener('DOMContentLoaded', function() {
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach(textarea => {
        textarea.addEventListener('input', function() {
            autoExpandTextarea(this);
        });
        // Set initial height
        autoExpandTextarea(textarea);
    });
});

function showMessage(message, isError = false) {
    const overlay = document.querySelector('.submission-message-overlay');
    const submissionMessage = document.querySelector('.submission-message');
    if (submissionMessage && overlay) {
        submissionMessage.textContent = message;
        submissionMessage.classList.remove('error', 'show');
        overlay.classList.remove('show');
        if (isError) submissionMessage.classList.add('error');
        submissionMessage.classList.add('show');
        overlay.classList.add('show');
        setTimeout(() => {
            submissionMessage.classList.remove('show');
            overlay.classList.remove('show');
        }, 3000);
    } else {
        console.warn('Submission message or overlay element not found.');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const userId = await getLoggedInUserId();
    if (!userId) {
        console.error("User not authenticated on Maintenance Form.");
        window.location.href = '/';
        return;
    }

    // Auto-populate requestor information from user profile
    await autoPopulateRequestorInfo();

    // Setup equipment name auto-suggestions
    await setupEquipmentNameSuggestions();

    setupFormEventListeners(userId);
});


async function getLoggedInUserId() {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
}


// Helper function to format date from yyyy-mm-dd to dd/mm/yyyy
function formatDateToDDMMYYYY(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// Helper function to convert dd/mm/yyyy back to yyyy-mm-dd for HTML date inputs
function formatDateForHTMLInput(dateString) {
    if (!dateString) return '';
    // If already in yyyy-mm-dd format, return as is
    if (dateString.includes('-') && dateString.length === 10) return dateString;

    // Convert dd/mm/yyyy to yyyy-mm-dd
    const [day, month, year] = dateString.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Helper function to convert dd/mm/yyyy to yyyy-mm-dd for database storage
function formatDateForDatabase(dateString) {
    if (!dateString) return null;

    // If already in yyyy-mm-dd format, return as is
    if (dateString.includes('-') && dateString.length === 10) return dateString;

    // If in dd/mm/yyyy format, convert to yyyy-mm-dd
    if (dateString.includes('/') && dateString.length === 10) {
        const [day, month, year] = dateString.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Try to parse as Date object and format for database
    try {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    } catch (error) {
        console.warn('Could not parse date for database:', dateString);
    }

    return dateString; // Return original if parsing fails
}

// Auto-populate requestor information from user profile
async function autoPopulateRequestorInfo() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return;
        }

        // Fetch user profile including department
        const { data: profile, error } = await supabase
            .from('users')
            .select('full_name, employee_code, department')
            .eq('id', user.id)
            .single();

        if (error) {
            console.error('Error fetching user profile:', error);
            return;
        }

        if (profile) {
            // Auto-populate requestor name
            const requestorNameField = document.getElementById('requestorName');
            if (requestorNameField && !requestorNameField.value) {
                requestorNameField.value = profile.full_name || profile.employee_code || '';
            }

            // Auto-populate department
            const reqDeptField = document.getElementById('reqDept');
            if (reqDeptField) {
                reqDeptField.value = profile.department || '';
            }
        }
    } catch (error) {
        console.error('Error in auto-populate requestor info:', error);
    }
}

function setupFormEventListeners(userId) {
    const form = document.getElementById('maintenanceForm');

    if (!form) {
        console.error('Form element not found!');
        return;
    }

    // Mutually exclusive Accepted/Rejected checkboxes
    const acceptedCheckbox = document.getElementById('inspectionAccepted');
    const rejectedCheckbox = document.getElementById('inspectionRejected');

    function handleInspectionCheckboxes(event) {
        const clickedCheckbox = event.target;
        if (clickedCheckbox === acceptedCheckbox) {
            rejectedCheckbox.checked = false;
        } else if (clickedCheckbox === rejectedCheckbox) {
            acceptedCheckbox.checked = false;
        }
    }

    if (acceptedCheckbox && rejectedCheckbox) {
        acceptedCheckbox.addEventListener('change', handleInspectionCheckboxes);
        rejectedCheckbox.addEventListener('change', handleInspectionCheckboxes);
    }


    // Simple test - add a basic click handler first
    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.addEventListener('click', function(e) {
        });
    }

    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        if (validateForm()) {
            showUploadOverlay(0, null, 'submitting...');
            const cancelBtn = document.getElementById('cancel-upload-btn');
            if (cancelBtn) cancelBtn.style.display = 'none';
            updateUploadProgress(0);

            const id = await getNextMaintenanceId();

            // Build insertData object with only existing fields
            const insertData = {
                id,
                form_type: 'regular',
                reqdept: document.getElementById('reqDept').value || 'Unknown',
                reqdepthod: document.getElementById('reqDeptHOD').value.trim(),
                requestorname: document.getElementById('requestorName').value.trim(),
                equipmentname: document.getElementById('equipmentName').value.trim(),
                equipmentno: document.getElementById('equipmentNo').value.trim(),
                equipmentinstalldate: document.getElementById('equipmentInstallDate').value ? formatDateForDatabase(document.getElementById('equipmentInstallDate').value) : null,
                occurdate: document.getElementById('occurDate').value,
                occurtime: document.getElementById('occurTime').value,
                requisitionno: document.getElementById('requisitionNo').value.trim(),
                machineno: document.getElementById('machineNo').value.trim(),
                requirecompletiondate: document.getElementById('requireCompletionDate').value,
                completiontime: document.getElementById('completionTime').value,
                existingcondition: document.getElementById('existingCondition').value.trim(),
                timestamp: new Date().toISOString(),
                submission_status: 'submitted'
            };

            // Only add user_id if it exists (not causing foreign key issues for now)
            if (userId) {
                insertData.user_id = userId;
            }

            // Handle checkbox arrays as JSONB
            const breakdownCodes = [];
            const checkboxes = document.querySelectorAll('input[name="breakdownCode"]:checked');
            checkboxes.forEach(cb => breakdownCodes.push(cb.value));
            insertData.breakdowncodes = breakdownCodes;

            const powerOptions = [];
            const powerCheckboxes = document.querySelectorAll('input[name="powerOption"]:checked');
            powerCheckboxes.forEach(cb => powerOptions.push(cb.id));
            insertData.poweroptions = powerOptions;

            const machineOptions = [];
            const machineCheckboxes = document.querySelectorAll('input[name="machineOption"]:checked');
            machineCheckboxes.forEach(cb => machineOptions.push(cb.id));
            insertData.machineoptions = machineOptions;

            // Collect material tracking data into JSONB format (only if fields exist)
            const materialsUsed = [];
            for (let i = 1; i <= 8; i++) {
                const materialElement = document.getElementById(`materialUsed${i}`);
                const specificationElement = document.getElementById(`specification${i}`);
                const quantityUsedElement = document.getElementById(`quantityUsed${i}`);
                const quantityRetrievedElement = document.getElementById(`quantityRetrieved${i}`);

                if (materialElement || specificationElement || quantityUsedElement || quantityRetrievedElement) {
                    const material = materialElement?.value?.trim() || '';
                    const specification = specificationElement?.value?.trim() || '';
                    const quantityUsed = quantityUsedElement?.value?.trim() || '';
                    const quantityRetrieved = quantityRetrievedElement?.value?.trim() || '';

                    if (material || specification || quantityUsed || quantityRetrieved) {
                        materialsUsed.push({
                            material: material,
                            specification: specification,
                            quantity_used: quantityUsed,
                            quantity_retrieved: quantityRetrieved
                        });
                    }
                }
            }

            if (materialsUsed.length > 0) {
                insertData.materials_used = materialsUsed;
            }

            // Only collect purchaseReqNo if the field exists
            const purchaseReqNoElement = document.getElementById('purchaseReqNo');
            if (purchaseReqNoElement) {
                insertData.purchasereqno = purchaseReqNoElement.value.trim();
            }

            // Get inspection result (only if checkboxes exist)
            const acceptedCheckbox = document.getElementById('inspectionAccepted');
            const rejectedCheckbox = document.getElementById('inspectionRejected');
            let inspectionResult = '';
            if (acceptedCheckbox && rejectedCheckbox) {
                if (acceptedCheckbox.checked) {
                    inspectionResult = 'Accepted';
                } else if (rejectedCheckbox.checked) {
                    inspectionResult = 'Rejected';
                }
            }
            insertData.inspectionresult = inspectionResult;

            try {
                updateUploadProgress(50);
                console.log('📡 Sending data to database...');
                console.log('Data being sent:', insertData);

                // Use the data as prepared (user_id conditionally included)
                const submitData = { ...insertData };

                const { data, error } = await supabase
                    .from('mt_job_requisition_master')
                    .insert([submitData]);

                if (error) {
                    hideUploadOverlay();
                    console.error('Database error:', error);
                    showMessage('Error submitting form. Please try again. Details: ' + error.message, true);
                } else {
                    updateUploadProgress(100);
                    setTimeout(hideUploadOverlay, 500);
                    showMessage('Maintenance Request submitted successfully!');
                    document.getElementById('maintenanceForm').reset();
                }
            } catch (error) {
                hideUploadOverlay();
                console.error('Unexpected error:', error);
                showMessage('Error submitting form. Please try again.', true);
            }
        }
    });
}

function validateForm() {
    console.log('🔍 Starting form validation...');

    const reqDept = document.getElementById('reqDept').value || '';
    const requestorName = document.getElementById('requestorName').value.trim();
    const equipmentName = document.getElementById('equipmentName').value.trim();
    const equipmentNo = document.getElementById('equipmentNo').value.trim();
    const occurDate = document.getElementById('occurDate').value;
    const occurTime = document.getElementById('occurTime').value;
    const requireCompletionDate = document.getElementById('requireCompletionDate').value;
    const completionTime = document.getElementById('completionTime').value;
    const existingCondition = document.getElementById('existingCondition').value.trim();

    // Get equipment installation date (optional field)
    const equipmentInstallDate = document.getElementById('equipmentInstallDate')?.value?.trim() || '';

    // Basic required fields check (reqDept is auto-populated from user profile)
    if (!requestorName || !equipmentName || !equipmentNo || !occurDate || !occurTime || !requireCompletionDate || !completionTime || !existingCondition) {
        showMessage('Please fill in all required fields (Requestor Name, Equipment Name, No., Date, Time, Completion Date, Completion Time, Condition).', true);
        return false;
    }

    // Validate that at least one breakdown code is selected
    const breakdownCodes = document.querySelectorAll('input[name="breakdownCode"]:checked');
    if (breakdownCodes.length === 0) {
        showMessage('Please select at least one breakdown code.', true);
        return false;
    }

    // Validate Accepted/Rejected checkbox (only if they exist in this form)
    const acceptedCheckbox = document.getElementById('inspectionAccepted');
    const rejectedCheckbox = document.getElementById('inspectionRejected');

    if (acceptedCheckbox && rejectedCheckbox) {
        if (!acceptedCheckbox.checked && !rejectedCheckbox.checked) {
            showMessage('Please select either Accepted or Rejected for the inspection.', true);
            return false;
        }
    }

    return true;
}

async function getNextMaintenanceId() {
    try {
        // Generate a proper UUID v4
        const uuid = generateUUID();
        return uuid;
    } catch (error) {
        console.error('Error generating UUID:', error);
        // Fallback: use timestamp-based ID
        const fallbackId = `MT${Date.now().toString().slice(-10)}`;
        return fallbackId;
    }
}

// UUID v4 generator function
function generateUUID() {
    // Check if crypto.randomUUID is available (modern browsers)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    // Fallback UUID v4 generator for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Spinner Overlay functions (same as quality alert)
function showUploadOverlay(progress = 0, onCancel, message = 'uploading...') {
    let overlay = document.getElementById('image-upload-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'image-upload-overlay';
        document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
        <div class="spinner-blur-bg"></div>
        <div class="spinner-content">
            <div class="spinner"></div>
            <div class="progress-text"><span id="upload-progress">${progress}</span>% ${message}</div>
            <button class="cancel-upload-btn" id="cancel-upload-btn" title="Cancel Upload">&times;</button>
        </div>
    `;
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    const cancelBtn = document.getElementById('cancel-upload-btn');
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            if (onCancel) onCancel();
            hideUploadOverlay();
        };
    }
}

function updateUploadProgress(progress) {
    const progressElem = document.getElementById('upload-progress');
    if (progressElem) progressElem.textContent = progress;
}

function hideUploadOverlay() {
    const overlay = document.getElementById('image-upload-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
}

// CSS for Spinner Overlay
(function addSpinnerOverlayCSS() {
    if (document.getElementById('spinner-overlay-style')) return;
    const style = document.createElement('style');
    style.id = 'spinner-overlay-style';
    style.textContent = `
#image-upload-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 9999;
  display: none;
  align-items: center;
  justify-content: center;
}
.spinner-blur-bg {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255,255,255,0.7);
  backdrop-filter: blur(4px);
  z-index: 1;
}
.spinner-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(255,255,255,0.95);
  border-radius: 12px;
  padding: 32px 40px 24px 40px;
  box-shadow: 0 4px 32px rgba(0,0,0,0.12);
}
.spinner {
  border: 6px solid #e4e4e4;
  border-top: 6px solid #002E7D;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  animation: spin 1s linear infinite;
  margin-bottom: 18px;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.progress-text {
  font-size: 1.2rem;
  color: #002E7D;
  margin-bottom: 18px;
}
.cancel-upload-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: #fff;
  border: none;
  font-size: 2rem;
  color: #d32f2f;
  cursor: pointer;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}
.cancel-upload-btn:hover {
  background: #ffeaea;
}
`;
    document.head.appendChild(style);
})();

// Equipment Name Auto-Suggestions Functionality
async function setupEquipmentNameSuggestions() {
    const equipmentNameInput = document.getElementById('equipmentName');
    if (!equipmentNameInput) {
        console.warn('Equipment name input field not found');
        return;
    }

    let suggestionsContainer = null;
    let equipmentList = [];

    // Fetch equipment names from master data table
    try {
        const { data, error } = await supabase
            .from('mt_machines_and_equipments_masterdata')
            .select('equipment_name, equipment_identification_no, installation_area, equipment_installation_date')
            .order('equipment_name');

        if (error) {
            console.error('Error fetching equipment data:', error);
            return;
        }

        equipmentList = data || [];
        console.log('✅ Loaded', equipmentList.length, 'equipment records for suggestions');

    } catch (error) {
        console.error('Error setting up equipment suggestions:', error);
        return;
    }

    // Create suggestions container
    function createSuggestionsContainer() {
        if (suggestionsContainer) return suggestionsContainer;

        suggestionsContainer = document.createElement('div');
        suggestionsContainer.className = 'equipment-suggestions';
        suggestionsContainer.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
        `;

        equipmentNameInput.parentNode.style.position = 'relative';
        equipmentNameInput.parentNode.appendChild(suggestionsContainer);
        return suggestionsContainer;
    }

    // Show suggestions
    function showSuggestions(suggestions) {
        const container = createSuggestionsContainer();
        container.innerHTML = '';

        if (suggestions.length === 0) {
            container.style.display = 'none';
            return;
        }

        suggestions.forEach(equipment => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';
            suggestionItem.style.cssText = `
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid #eee;
                font-size: 14px;
            `;
            suggestionItem.innerHTML = `
                <div style="font-weight: 500; color: #333;">${equipment.equipment_name}</div>
                <div style="font-size: 12px; color: #666; margin-top: 2px;">
                    ${equipment.equipment_identification_no} • ${equipment.installation_area || 'No area specified'}
                </div>
            `;

            suggestionItem.addEventListener('mouseenter', () => {
                suggestionItem.style.backgroundColor = '#f8f9fa';
            });

            suggestionItem.addEventListener('mouseleave', () => {
                suggestionItem.style.backgroundColor = 'white';
            });

            suggestionItem.addEventListener('click', () => {
                equipmentNameInput.value = equipment.equipment_name;

                // Also populate equipment number and installation date if available
                const equipmentNoInput = document.getElementById('equipmentNo');
                const equipmentInstallDateInput = document.getElementById('equipmentInstallDate');

                if (equipmentNoInput && equipment.equipment_identification_no) {
                    equipmentNoInput.value = equipment.equipment_identification_no;
                }

                if (equipmentInstallDateInput && equipment.equipment_installation_date) {
                    // Format date from yyyy-mm-dd to dd/mm/yyyy for display
                    const date = new Date(equipment.equipment_installation_date);
                    const day = date.getDate().toString().padStart(2, '0');
                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                    const year = date.getFullYear();
                    equipmentInstallDateInput.value = `${day}/${month}/${year}`;
                }

                container.style.display = 'none';
            });

            container.appendChild(suggestionItem);
        });

        container.style.display = 'block';
    }

    // Hide suggestions
    function hideSuggestions() {
        if (suggestionsContainer) {
            suggestionsContainer.style.display = 'none';
        }
    }

    // Filter equipment based on input
    function filterEquipment(query) {
        if (!query || query.length < 2) {
            hideSuggestions();
            return [];
        }

        return equipmentList.filter(equipment =>
            equipment.equipment_name.toLowerCase().includes(query.toLowerCase())
        );
    }

    // Event listeners
    equipmentNameInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        const suggestions = filterEquipment(query);
        showSuggestions(suggestions);
    });

    equipmentNameInput.addEventListener('focus', () => {
        const query = equipmentNameInput.value.trim();
        if (query.length >= 2) {
            const suggestions = filterEquipment(query);
            showSuggestions(suggestions);
        }
    });

    equipmentNameInput.addEventListener('blur', () => {
        // Delay hiding to allow for clicks on suggestions
        setTimeout(hideSuggestions, 200);
    });

    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!equipmentNameInput.contains(e.target) && (!suggestionsContainer || !suggestionsContainer.contains(e.target))) {
            hideSuggestions();
        }
    });

    console.log('✅ Equipment name auto-suggestions setup complete');
}
