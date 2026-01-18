import { supabase } from '../supabase-config.js';

/**
 * MJR FORM MODULE
 * Handles Maintenance Job Requisition form functionality including:
 * - Form auto-population from user profile
 * - Equipment selection with type-ahead and dropdown
 * - Form validation and submission
 * - Dynamic area/machine and equipment dropdowns
 */

// UTILITY FUNCTIONS
// =================

/**
 * Auto-expands textarea elements to fit content
 */
function autoExpandTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

/**
 * Initialize auto-expand for all textarea elements
 */
document.addEventListener('DOMContentLoaded', function() {
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach(textarea => {
        textarea.addEventListener('input', function() {
            autoExpandTextarea(this);
        });
        autoExpandTextarea(textarea);
    });
});

/**
 * Display user feedback messages with optional error styling
 */
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
    }
}

// AUTHENTICATION & INITIALIZATION
// ===============================

/**
 * Main initialization function - runs after DOM loads
 * Handles user authentication and sets up form components
 */
document.addEventListener('DOMContentLoaded', async () => {
    const userId = await getLoggedInUserId();
    if (!userId) {
        window.location.href = '/';
        return;
    }

    await autoPopulateRequestorInfo();
    await setupAreaMachineDropdown();
    setupFormEventListeners(userId);
});

/**
 * Get the currently logged-in user ID from Supabase auth
 */
async function getLoggedInUserId() {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
}

// DATE FORMATTING UTILITIES
// =========================

/**
 * Convert date from yyyy-mm-dd to dd/mm/yyyy for display
 */
function formatDateToDDMMYYYY(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * Convert date from dd/mm/yyyy to yyyy-mm-dd for database storage
 */
function formatDateForDatabase(dateString) {
    if (!dateString) return null;

    if (dateString.includes('-') && dateString.length === 10) return dateString;

    if (dateString.includes('/') && dateString.length === 10) {
        const [day, month, year] = dateString.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    try {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    } catch (error) {
        // Silently handle parsing errors
    }

    return dateString;
}

// FORM AUTO-POPULATION
// ====================

/**
 * Auto-populate requestor information from authenticated user profile
 * Fills in name, department, and HOD based on user data
 */
async function autoPopulateRequestorInfo() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile, error } = await supabase
            .from('users')
            .select('full_name, employee_code, department, is_hod')
            .eq('id', user.id)
            .single();

        if (error) return;

        if (profile) {
            const requestorNameField = document.getElementById('requestorName');
            const reqDeptField = document.getElementById('reqDept');

            if (requestorNameField && !requestorNameField.value) {
                requestorNameField.value = profile.full_name || profile.employee_code || '';
            }

            if (reqDeptField) {
                reqDeptField.value = profile.department || '';
            }

            if (profile.department) {
                await autoPopulateHODForDepartment(profile.department, profile.is_hod);
            }
        }
    } catch (error) {
        // Silently handle auto-population errors
    }
}

/**
 * Auto-populate HOD field based on department
 * If user is HOD, gets HOD from PGM department instead
 */
async function autoPopulateHODForDepartment(department, isUserHOD = false) {
    try {
        const targetDepartment = isUserHOD ? 'PGM' : department;

        const { data: hodUser, error } = await supabase
            .from('users')
            .select('full_name, employee_code')
            .eq('department', targetDepartment)
            .eq('is_hod', true)
            .single();

        if (error) return;

        if (hodUser) {
            const hodField = document.getElementById('reqDeptHOD');
            if (hodField && !hodField.value) {
                hodField.value = hodUser.full_name || hodUser.employee_code || '';
            }
        }
    } catch (error) {
        // Silently handle HOD population errors
    }
}

// FORM EVENT HANDLERS & SUBMISSION
// ================================

/**
 * Set up all form event listeners including submission and checkbox handling
 */
function setupFormEventListeners(userId) {
    const form = document.getElementById('maintenanceForm');
    if (!form) return;

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

    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        if (validateForm()) {
            showUploadOverlay(0, null, 'submitting...');
            const cancelBtn = document.getElementById('cancel-upload-btn');
            if (cancelBtn) cancelBtn.style.display = 'none';
            updateUploadProgress(0);

            const id = await getNextMaintenanceId();

            const formElements = {
                reqDept: document.getElementById('reqDept'),
                reqDeptHOD: document.getElementById('reqDeptHOD'),
                requestorName: document.getElementById('requestorName'),
                equipmentName: document.getElementById('equipmentName'),
                equipmentNo: document.getElementById('equipmentNo'),
                equipmentInstallDate: document.getElementById('equipmentInstallDate'),
                occurDate: document.getElementById('occurDate'),
                occurTime: document.getElementById('occurTime'),
                requisitionNo: document.getElementById('requisitionNo'),
                machineNo: document.getElementById('machineNo'),
                requireCompletionDate: document.getElementById('requireCompletionDate'),
                completionTime: document.getElementById('completionTime'),
                existingCondition: document.getElementById('existingCondition')
            };

            const insertData = {
                id,
                form_type: 'regular',
                reqdept: formElements.reqDept?.value || 'Unknown',
                reqdepthod: formElements.reqDeptHOD?.value?.trim() || '',
                requestorname: formElements.requestorName?.value?.trim() || '',
                equipmentname: formElements.equipmentName?.value?.trim() || '',
                equipmentno: formElements.equipmentNo?.value?.trim() || null,
                equipmentinstalldate: formElements.equipmentInstallDate?.value ? formatDateForDatabase(formElements.equipmentInstallDate.value) : null,
                occurdate: formElements.occurDate?.value || '',
                occurtime: formElements.occurTime?.value || '',
                requisitionno: formElements.requisitionNo?.value?.trim() || '',
                machineno: formElements.machineNo?.value?.trim() || '',
                requirecompletiondate: formElements.requireCompletionDate?.value || '',
                completiontime: formElements.completionTime?.value || '',
                existingcondition: formElements.existingCondition?.value?.trim() || '',
                timestamp: new Date().toISOString(),
                submission_status: 'submitted'
            };

            if (userId) {
                insertData.user_id = userId;
            }

            const breakdownCodes = [];
            const checkboxes = document.querySelectorAll('input[name="breakdownCode"]:checked');
            checkboxes.forEach(cb => breakdownCodes.push(cb.value));
            insertData.breakdowncodes = breakdownCodes;

            const materialsUsed = [];
            const materialElements = {};

            for (let i = 1; i <= 8; i++) {
                materialElements[i] = {
                    material: document.getElementById(`materialUsed${i}`),
                    specification: document.getElementById(`specification${i}`),
                    quantityUsed: document.getElementById(`quantityUsed${i}`),
                    quantityRetrieved: document.getElementById(`quantityRetrieved${i}`)
                };
            }

            for (let i = 1; i <= 8; i++) {
                const elems = materialElements[i];
                const material = elems.material?.value?.trim() || '';
                const specification = elems.specification?.value?.trim() || '';
                const quantityUsed = elems.quantityUsed?.value?.trim() || '';
                const quantityRetrieved = elems.quantityRetrieved?.value?.trim() || '';

                if (material || specification || quantityUsed || quantityRetrieved) {
                    materialsUsed.push({
                        material,
                        specification,
                        quantity_used: quantityUsed,
                        quantity_retrieved: quantityRetrieved
                    });
                }
            }

            if (materialsUsed.length > 0) {
                insertData.materials_used = materialsUsed;
            }

            const purchaseReqNoElement = document.getElementById('purchaseReqNo');
            if (purchaseReqNoElement) {
                insertData.purchasereqno = purchaseReqNoElement.value.trim();
            }

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

                const submitData = { ...insertData };

                const { data, error } = await supabase
                    .from('mt_job_requisition_master')
                    .insert([submitData]);

                if (error) {
                    hideUploadOverlay();
                    showMessage('Error submitting form. Please try again. Details: ' + error.message, true);
                } else {
                    updateUploadProgress(100);
                    setTimeout(hideUploadOverlay, 500);
                    showMessage('Maintenance Request submitted successfully!');
                    document.getElementById('maintenanceForm').reset();
                }
            } catch (error) {
                hideUploadOverlay();
                showMessage('Error submitting form. Please try again.', true);
            }
        }
    });
}

// FORM VALIDATION
// ===============

/**
 * Validate all required form fields before submission
 * Returns true if form is valid, false otherwise
 */
function validateForm() {
    const elements = {
        reqDept: document.getElementById('reqDept'),
        requestorName: document.getElementById('requestorName'),
        equipmentName: document.getElementById('equipmentName'),
        equipmentNo: document.getElementById('equipmentNo'),
        occurDate: document.getElementById('occurDate'),
        occurTime: document.getElementById('occurTime'),
        requireCompletionDate: document.getElementById('requireCompletionDate'),
        completionTime: document.getElementById('completionTime'),
        existingCondition: document.getElementById('existingCondition'),
        equipmentInstallDate: document.getElementById('equipmentInstallDate'),
        machineNo: document.getElementById('machineNo')
    };

    const reqDept = elements.reqDept?.value || '';
    const requestorName = elements.requestorName?.value?.trim() || '';
    const equipmentName = elements.equipmentName?.value?.trim() || '';
    const equipmentNo = elements.equipmentNo?.value?.trim() || '';
    const occurDate = elements.occurDate?.value || '';
    const occurTime = elements.occurTime?.value || '';
    const requireCompletionDate = elements.requireCompletionDate?.value || '';
    const completionTime = elements.completionTime?.value || '';
    const existingCondition = elements.existingCondition?.value?.trim() || '';
    const areaMachine = elements.machineNo?.value || '';

    if (!requestorName || !equipmentName || !areaMachine || !occurDate || !occurTime || !requireCompletionDate || !completionTime || !existingCondition) {
        showMessage('Please fill in all required fields (Requestor Name, Equipment Name, Area/Machine, Date, Time, Completion Date, Completion Time, Condition).', true);
        return false;
    }

    // REMOVED STRICT EQUIPMENT VALIDATION TO ALLOW MANUAL INPUT (e.g., Office Tubelight)
    /*
    if (window.validEquipmentList && window.validEquipmentList.length > 0) {
        const isValidEquipment = window.validEquipmentList.some(equipment =>
            equipment.name === equipmentName
        );
        if (!isValidEquipment) {
            showMessage('Please select a valid equipment name from the dropdown list.', true);
            document.getElementById('equipmentName').focus();
            return false;
        }
    }
    */

    const breakdownCodes = document.querySelectorAll('input[name="breakdownCode"]:checked');
    if (breakdownCodes.length === 0) {
        showMessage('Please select at least one breakdown code.', true);
        return false;
    }

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

// ID GENERATION
// =============

/**
 * Generate a unique ID for the maintenance request
 * Uses UUID v4 for uniqueness
 */
async function getNextMaintenanceId() {
    try {
        const uuid = generateUUID();
        return uuid;
    } catch (error) {
        const fallbackId = `MT${Date.now().toString().slice(-10)}`;
        return fallbackId;
    }
}

/**
 * Generate a UUID v4 string
 * Uses crypto.randomUUID() if available, otherwise fallback implementation
 */
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// UPLOAD OVERLAY UI
// =================

/**
 * Show upload progress overlay with spinner and progress indicator
 */
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

/**
 * Update the progress percentage in the upload overlay
 */
function updateUploadProgress(progress) {
    const progressElem = document.getElementById('upload-progress');
    if (progressElem) progressElem.textContent = progress;
}

/**
 * Hide the upload overlay and restore page scroll
 */
function hideUploadOverlay() {
    const overlay = document.getElementById('image-upload-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
}

// Inject CSS styles for upload overlay
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

// EQUIPMENT NAME SUGGESTIONS
// ==========================

/**
 * Set up auto-suggestions for equipment name input field
 * Provides dropdown suggestions based on equipment master data
 */
async function setupEquipmentNameSuggestions() {
    const equipmentNameInput = document.getElementById('equipmentName');
    if (!equipmentNameInput) return;

    let suggestionsContainer = null;
    let equipmentList = [];

    try {
        const { data, error } = await supabase
            .from('mt_machines_and_equipments_masterdata')
            .select('equipment_name, equipment_identification_no, installation_area, equipment_installation_date')
            .order('equipment_name');

        if (error) return;

        equipmentList = data || [];

    } catch (error) {
        return;
    }

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

                const equipmentNoInput = document.getElementById('equipmentNo');
                const equipmentInstallDateInput = document.getElementById('equipmentInstallDate');

                if (equipmentNoInput && equipment.equipment_identification_no) {
                    equipmentNoInput.value = equipment.equipment_identification_no;
                }

                if (equipmentInstallDateInput && equipment.equipment_installation_date) {
                    equipmentInstallDateInput.value = formatDateToDDMMYYYY(equipment.equipment_installation_date);
                }

                container.style.display = 'none';
            });

            container.appendChild(suggestionItem);
        });

        container.style.display = 'block';
    }

    function hideSuggestions() {
        if (suggestionsContainer) {
            suggestionsContainer.style.display = 'none';
        }
    }

    function filterEquipment(query) {
        if (!query || query.length < 2) {
            hideSuggestions();
            return [];
        }

        return equipmentList.filter(equipment =>
            equipment.equipment_name.toLowerCase().includes(query.toLowerCase())
        );
    }

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
        setTimeout(hideSuggestions, 200);
    });

    document.addEventListener('click', (e) => {
        if (!equipmentNameInput.contains(e.target) && (!suggestionsContainer || !suggestionsContainer.contains(e.target))) {
            hideSuggestions();
        }
    });
}

// AREA/MACHINE DROPDOWN
// =====================

/**
 * Initialize the area/machine dropdown with data from equipment master
 * Populates dropdown with unique installation areas
 */
async function setupAreaMachineDropdown() {
    const areaMachineSelect = document.getElementById('machineNo');
    if (!areaMachineSelect) return;

    try {
        const { data, error } = await supabase
            .from('mt_machines_and_equipments_masterdata')
            .select('installation_area')
            .not('installation_area', 'is', null)
            .order('installation_area');

        if (error) return;

        const uniqueAreas = [...new Set(data.map(item => item.installation_area))].filter(area => area && area.trim() !== '');

        areaMachineSelect.innerHTML = '<option value="">Select Area / Machine</option>';

        uniqueAreas.forEach(area => {
            const option = document.createElement('option');
            option.value = area;
            option.textContent = area;
            areaMachineSelect.appendChild(option);
        });

        areaMachineSelect.addEventListener('change', async function() {
            const selectedArea = this.value;

            clearEquipmentFields();

            if (selectedArea) {
                await populateEquipmentDropdown(selectedArea);
            } else {
                resetEquipmentField();
            }
        });

    } catch (error) {
        // Silently handle area dropdown setup errors
    }
}

// EQUIPMENT DROPDOWN POPULATION
// =============================

/**
 * Populate equipment dropdown based on selected installation area
 * Creates a custom dropdown with type-ahead filtering and auto-population
 */
async function populateEquipmentDropdown(selectedArea) {
    const equipmentNameField = document.getElementById('equipmentName');
    if (!equipmentNameField) return;

    try {
        const { data, error } = await supabase
            .from('mt_machines_and_equipments_masterdata')
            .select('equipment_name, equipment_identification_no, equipment_installation_date')
            .eq('installation_area', selectedArea)
            .order('equipment_name');

        if (error) return;

        window.validEquipmentList = data.map(equipment => ({
            name: equipment.equipment_name,
            number: equipment.equipment_identification_no,
            installDate: equipment.equipment_installation_date
        }));

        const dropdownContainer = document.createElement('div');
        dropdownContainer.className = 'custom-equipment-dropdown';
        dropdownContainer.style.cssText = `
            position: relative;
            width: 100%;
        `;

        const displayInput = document.createElement('input');
        displayInput.type = 'text';
        displayInput.id = 'equipmentName';
        displayInput.name = 'equipmentName';
        displayInput.placeholder = 'Select or type equipment name';
        displayInput.required = true;
        displayInput.style.cssText = equipmentNameField.style.cssText;
        displayInput.style.cursor = 'text';
        displayInput.autocomplete = 'off';
        displayInput.style.backgroundImage = 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23666\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6,9 12,15 18,9\'%3e%3c/polyline%3e%3c/svg%3e")';
        displayInput.style.backgroundRepeat = 'no-repeat';
        displayInput.style.backgroundPosition = 'right 8px center';
        displayInput.style.backgroundSize = '16px';
        displayInput.style.paddingRight = '30px';

        if (!document.getElementById('equipment-placeholder-style')) {
            const style = document.createElement('style');
            style.id = 'equipment-placeholder-style';
            style.textContent = '#equipmentName::placeholder { color: #333 !important; opacity: 1 !important; }';
            document.head.appendChild(style);
        }

        const dropdownList = document.createElement('div');
        dropdownList.className = 'equipment-dropdown-list';
        dropdownList.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            max-height: 400px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
        `;

        if (!document.getElementById('equipment-dropdown-styles')) {
            const style = document.createElement('style');
            style.id = 'equipment-dropdown-styles';
            style.textContent = `
                .equipment-dropdown-option {
                    padding: 8px 12px;
                    cursor: pointer;
                    border-bottom: 1px solid #eee;
                    font-size: 14px;
                }
                .equipment-dropdown-option:hover {
                    background-color: #f8f9fa;
                }
            `;
            document.head.appendChild(style);
        }

        const fragment = document.createDocumentFragment();

        const defaultOption = document.createElement('div');
        defaultOption.className = 'equipment-dropdown-option';
        defaultOption.textContent = 'Select Equipment';
        defaultOption.addEventListener('click', () => {
            displayInput.value = '';
            dropdownList.style.display = 'none';
        });
        fragment.appendChild(defaultOption);

        data.forEach(equipment => {
            const option = document.createElement('div');
            option.className = 'equipment-dropdown-option';

            const nameDiv = document.createElement('div');
            nameDiv.textContent = equipment.equipment_name;
            nameDiv.style.fontWeight = '500';
            nameDiv.style.color = '#333';

            const idDiv = document.createElement('div');
            idDiv.textContent = equipment.equipment_identification_no || '';
            idDiv.style.fontSize = '12px';
            idDiv.style.color = '#666';
            idDiv.style.marginTop = '2px';

            option.appendChild(nameDiv);
            option.appendChild(idDiv);

            option.dataset.equipmentName = equipment.equipment_name;
            option.dataset.equipmentNo = equipment.equipment_identification_no || '';
            option.dataset.installDate = equipment.equipment_installation_date || '';

            fragment.appendChild(option);
        });

        dropdownList.appendChild(fragment);

        dropdownList.addEventListener('mouseenter', (e) => {
            if (e.target.classList.contains('equipment-dropdown-option')) {
                e.target.style.backgroundColor = '#f8f9fa';
            }
        }, true);

        dropdownList.addEventListener('mouseleave', (e) => {
            if (e.target.classList.contains('equipment-dropdown-option')) {
                e.target.style.backgroundColor = 'white';
            }
        }, true);

        dropdownList.addEventListener('click', (e) => {
            if (!e.target.classList.contains('equipment-dropdown-option')) return;

            const option = e.target.closest('.equipment-dropdown-option');
            if (!option) return;

            if (option.textContent === 'Select Equipment') {
                displayInput.value = '';
            } else {
                displayInput.value = option.dataset.equipmentName;

                const equipmentNoField = document.getElementById('equipmentNo');
                if (equipmentNoField && option.dataset.equipmentNo) {
                    equipmentNoField.value = option.dataset.equipmentNo;
                }

                const installDateField = document.getElementById('equipmentInstallDate');
                if (installDateField && option.dataset.installDate) {
                    installDateField.value = formatDateToDDMMYYYY(option.dataset.installDate);
                }
            }

            dropdownList.style.display = 'none';
        });

        dropdownContainer.appendChild(displayInput);
        dropdownContainer.appendChild(dropdownList);

        equipmentNameField.parentNode.replaceChild(dropdownContainer, equipmentNameField);

        displayInput.addEventListener('click', () => {
            showFilteredDropdown('');
        });

        displayInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const isValidSelection = showFilteredDropdown(searchTerm);

            if (searchTerm && !isValidSelection) {
                displayInput.style.borderColor = '#dc3545';
            } else {
                displayInput.style.borderColor = '#ddd';
            }
        });

        const allOptions = dropdownList.querySelectorAll('.equipment-dropdown-option');

        function showFilteredDropdown(searchTerm) {
            let visibleCount = 0;
            let hasValidMatches = false;

            for (const option of allOptions) {
                if (option === dropdownList.firstChild) {
                    option.style.display = 'block';
                    visibleCount++;
                    continue;
                }

                const equipmentName = option.dataset.equipmentName || '';
                const equipmentNo = option.dataset.equipmentNo || '';

                const nameMatch = equipmentName.toLowerCase().includes(searchTerm);
                const noMatch = equipmentNo.toLowerCase().includes(searchTerm);
                const matches = nameMatch || noMatch;

                option.style.display = matches ? 'block' : 'none';
                if (matches) {
                    visibleCount++;
                    hasValidMatches = true;
                }
            }

            const shouldShow = (searchTerm && hasValidMatches) || (!searchTerm && visibleCount > 1);
            dropdownList.style.display = shouldShow ? 'block' : 'none';

            return hasValidMatches || !searchTerm;
        }

        document.addEventListener('click', (e) => {
            if (!dropdownContainer.contains(e.target)) {
                dropdownList.style.display = 'none';
            }
        });

    } catch (error) {
        // Silently handle equipment dropdown population errors
    }
}

// FIELD MANAGEMENT UTILITIES
// ===========================

/**
 * Clear all equipment-related form fields
 */
function clearEquipmentFields() {
    window.validEquipmentList = [];

    const equipmentNameField = document.getElementById('equipmentName');
    if (equipmentNameField) {
        if (equipmentNameField.tagName === 'INPUT') {
            equipmentNameField.value = '';
        } else {
            const displayInput = equipmentNameField.querySelector('input');
            if (displayInput) {
                displayInput.value = '';
            }
        }
    }

    const equipmentNoField = document.getElementById('equipmentNo');
    if (equipmentNoField) {
        equipmentNoField.value = '';
    }

    const installDateField = document.getElementById('equipmentInstallDate');
    if (installDateField) {
        installDateField.value = '';
    }
}

/**
 * Reset equipment field to simple input when no area is selected
 */
function resetEquipmentField() {
    window.validEquipmentList = [];

    const equipmentNameField = document.getElementById('equipmentName');
    if (!equipmentNameField) return;

    if (equipmentNameField.tagName === 'INPUT') return;

    const inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.id = 'equipmentName';
    inputElement.name = 'equipmentName';
    inputElement.placeholder = 'Select or type equipment name';
    inputElement.required = true;
    inputElement.style.cssText = equipmentNameField.style.cssText;

    equipmentNameField.parentNode.replaceChild(inputElement, equipmentNameField);

    const equipmentNoField = document.getElementById('equipmentNo');
    const installDateField = document.getElementById('equipmentInstallDate');

    if (equipmentNoField) equipmentNoField.value = '';
    if (installDateField) installDateField.value = '';

    setupEquipmentNameSuggestions();
}
