import { supabase } from '../supabase-config.js';

/**
 * MJR ACTION MODULE
 * Handles Maintenance Job Requisition Action form functionality including:
 * - Form data loading and population for view/edit modes
 * - Dynamic equipment dropdowns with area-based filtering
 * - Schedule calculation and validation
 * - Roller equipment field management
 * - Form submission and validation
 */

// DOM REFERENCE CACHING
// =====================

/**
 * Cached DOM references for frequently accessed elements
 */
const domCache = {
    scheduleElements: null,
    formElements: null,

    initScheduleElements() {
        if (!this.scheduleElements) {
            this.scheduleElements = {
                startDate: document.getElementById('scheduleStartDate'),
                startTime: document.getElementById('scheduleStartTime'),
                endDate: document.getElementById('scheduleEndDate'),
                endTime: document.getElementById('scheduleEndTime'),
                totalHrs: document.getElementById('totalHrs')
            };
        }
        return this.scheduleElements;
    },

    initFormElements() {
        if (!this.formElements) {
            this.formElements = {
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
                existingCondition: document.getElementById('existingCondition'),
                correction: document.getElementById('correction'),
                rootCause: document.getElementById('rootCause'),
                technicianName: document.getElementById('technicianName'),
                materialRetrieval: document.getElementById('materialRetrieval'),
                cleaningInspection: document.getElementById('cleaningInspection'),
                scheduleStartDate: document.getElementById('scheduleStartDate'),
                scheduleStartTime: document.getElementById('scheduleStartTime'),
                scheduleEndDate: document.getElementById('scheduleEndDate'),
                scheduleEndTime: document.getElementById('scheduleEndTime'),
                totalHrs: document.getElementById('totalHrs'),
                inspectionRemarks: document.getElementById('inspectionRemarks'),
                inspectionAccepted: document.getElementById('inspectionAccepted'),
                inspectionRejected: document.getElementById('inspectionRejected'),
                inspectionCheckedBy: document.getElementById('inspectionCheckedBy'),
                cleanRetrCheckedBy: document.getElementById('cleanRetrCheckedBy'),
                purchaseReqNo: document.getElementById('purchaseReqNo'),
                costIncurred: document.getElementById('costIncurred')
            };
        }
        return this.formElements;
    }
};

// TEXTAREA AUTO-EXPAND
// ====================

/**
 * Auto-expands textarea elements to fit content
 */
function autoExpandTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

/**
 * Initialize all page functionality when DOM is ready
 */
document.addEventListener('DOMContentLoaded', async function() {
    // 1. Authentication check
    const userId = await getLoggedInUserId();
    if (!userId) {
        window.location.href = '/';
        return;
    }

    // 2. Initialize UI Components
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach(textarea => {
        textarea.addEventListener('input', function() {
            autoExpandTextarea(this);
        });
        autoExpandTextarea(textarea);
    });

    // 3. Setup core form functionality
    setupScheduleCalculation();
    setTimeout(() => updateTotalHoursDisplay(), 100);
    setupDynamicRollerFields();
    setupAreaMachineDropdown();

    // 4. Handle URL parameters for view/edit modes
    await handleUrlParameters();

    // 5. Setup event listeners
    setupFormEventListeners(userId);
});

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

// Populate Equipment Name dropdown based on selected area
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
        displayInput.placeholder = 'Select or Type Equipment';
        displayInput.readOnly = false;
        displayInput.required = true;
        displayInput.style.cssText = equipmentNameField.style.cssText;
        Object.assign(displayInput.style, {
            cursor: 'text',
            backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23666\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6,9 12,15 18,9\'%3e%3c/polyline%3e%3c/svg%3e")',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
            backgroundSize: '16px',
            paddingRight: '30px'
        });

        if (!document.getElementById('equipment-placeholder-style')) {
            const style = document.createElement('style');
            style.id = 'equipment-placeholder-style';
            style.textContent = `
                #equipmentName::placeholder {
                    color: #999 !important;
                    opacity: 1 !important;
                }
            `;
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

        const defaultOption = document.createElement('div');
        defaultOption.className = 'dropdown-option';
        defaultOption.style.cssText = `
            padding: 8px 12px;
            cursor: pointer;
            border-bottom: 1px solid #eee;
            font-size: 14px;
        `;
        defaultOption.textContent = 'Clear Selection';
        defaultOption.addEventListener('click', () => {
            displayInput.value = '';
            dropdownList.style.display = 'none';
            
            // Clear related fields too
            const equipmentNoField = document.getElementById('equipmentNo');
            if (equipmentNoField) equipmentNoField.value = '';
            const installDateField = document.getElementById('equipmentInstallDate');
            if (installDateField) installDateField.value = '';
            
            displayInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
        dropdownList.appendChild(defaultOption);

        data.forEach(equipment => {
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.style.cssText = `
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid #eee;
                font-size: 14px;
            `;

            const nameDiv = document.createElement('div');
            nameDiv.textContent = equipment.equipment_name;
            Object.assign(nameDiv.style, {
                fontWeight: '500',
                color: '#333'
            });

            const idDiv = document.createElement('div');
            idDiv.textContent = equipment.equipment_identification_no || '';
            Object.assign(idDiv.style, {
                fontSize: '12px',
                color: '#666',
                marginTop: '2px'
            });

            option.appendChild(nameDiv);
            option.appendChild(idDiv);

            option.dataset.equipmentName = equipment.equipment_name;
            option.dataset.equipmentNo = equipment.equipment_identification_no || '';
            option.dataset.installDate = equipment.equipment_installation_date || '';

            option.addEventListener('mouseenter', () => {
                option.style.backgroundColor = '#f8f9fa';
            });
            option.addEventListener('mouseleave', () => {
                option.style.backgroundColor = 'white';
            });

            option.addEventListener('click', () => {
                displayInput.value = equipment.equipment_name;
                dropdownList.style.display = 'none';

                const equipmentNoField = document.getElementById('equipmentNo');
                if (equipmentNoField && equipment.equipment_identification_no) {
                    equipmentNoField.value = equipment.equipment_identification_no;
                }

                const installDateField = document.getElementById('equipmentInstallDate');
                if (installDateField && equipment.equipment_installation_date) {
                    installDateField.value = formatDateForDisplay(equipment.equipment_installation_date);
                }
                
                // Trigger input event to update roller fields if needed
                displayInput.dispatchEvent(new Event('input', { bubbles: true }));
            });

            dropdownList.appendChild(option);
        });

        dropdownContainer.appendChild(displayInput);
        dropdownContainer.appendChild(dropdownList);

        equipmentNameField.parentNode.replaceChild(dropdownContainer, equipmentNameField);

        // Update domCache if it exists
        if (domCache.formElements) {
            domCache.formElements.equipmentName = displayInput;
        }

        // Add search filtering
        displayInput.addEventListener('input', () => {
            const filter = displayInput.value.toLowerCase();
            const options = dropdownList.querySelectorAll('.dropdown-option');
            let hasVisibleOptions = false;

            options.forEach(option => {
                if (option.textContent === 'Clear Selection') {
                    option.style.display = filter ? 'none' : 'block';
                    return;
                }
                const name = option.dataset.equipmentName?.toLowerCase() || '';
                const id = option.dataset.equipmentNo?.toLowerCase() || '';
                
                if (name.includes(filter) || id.includes(filter)) {
                    option.style.display = 'block';
                    hasVisibleOptions = true;
                } else {
                    option.style.display = 'none';
                }
            });

            dropdownList.style.display = 'block';
        });

        displayInput.addEventListener('click', () => {
            dropdownList.style.display = 'block';
        });

        displayInput.addEventListener('focus', () => {
            dropdownList.style.display = 'block';
        });

        document.addEventListener('click', (e) => {
            if (!dropdownContainer.contains(e.target)) {
                dropdownList.style.display = 'none';
            }
        });

    } catch (error) {
        // Silently handle equipment dropdown population errors
    }
}

// Clear equipment-related fields
function clearEquipmentFields() {
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

// Reset equipment field to input when no area is selected
function resetEquipmentField() {
    const equipmentNameField = document.getElementById('equipmentName');
    if (!equipmentNameField) return;

    if (equipmentNameField.tagName === 'INPUT') return;

    const inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.id = 'equipmentName';
    inputElement.name = 'equipmentName';
    inputElement.placeholder = 'Select or Type Equipment';
    inputElement.required = true;
    inputElement.className = equipmentNameField.className;
    inputElement.style.cssText = equipmentNameField.style.cssText;

    equipmentNameField.parentNode.replaceChild(inputElement, equipmentNameField);

    // Update domCache if it exists
    if (domCache.formElements) {
        domCache.formElements.equipmentName = inputElement;
    }
}

// SCHEDULE CALCULATION
// ====================

/**
 * Set up automatic total hours calculation when schedule times change
 */
function setupScheduleCalculation() {
    const elements = domCache.initScheduleElements();

    if (!elements.startDate || !elements.startTime || !elements.endDate || !elements.endTime || !elements.totalHrs) {
        return;
    }

    function updateTotalHours() {
        updateTotalHoursDisplay();
    }

    elements.startDate.addEventListener('change', updateTotalHours);
    elements.startTime.addEventListener('change', updateTotalHours);
    elements.endDate.addEventListener('change', updateTotalHours);
    elements.endTime.addEventListener('change', updateTotalHours);

    elements.startDate.addEventListener('input', updateTotalHours);
    elements.startTime.addEventListener('input', updateTotalHours);
    elements.endDate.addEventListener('input', updateTotalHours);
    elements.endTime.addEventListener('input', updateTotalHours);
}

/**
 * Calculate and display total hours between start and end schedule times
 */
function updateTotalHoursDisplay(startDateStr, startTimeStr, endDateStr, endTimeStr) {
    const elements = domCache.initScheduleElements();

    if (!elements.totalHrs) return;

    const sDate = startDateStr || elements.startDate?.value;
    const sTime = startTimeStr || elements.startTime?.value;
    const eDate = endDateStr || elements.endDate?.value;
    const eTime = endTimeStr || elements.endTime?.value;

    if (sDate && sTime && eDate && eTime) {
        try {
            const startDateTime = new Date(sDate + ' ' + sTime);
            const endDateTime = new Date(eDate + ' ' + eTime);

            if (endDateTime > startDateTime) {
                const diffMs = endDateTime - startDateTime;
                const diffMinutes = Math.floor(diffMs / (1000 * 60));
                const hours = Math.floor(diffMinutes / 60);
                const minutes = diffMinutes % 60;

                elements.totalHrs.value = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            } else {
                elements.totalHrs.value = '00:00';
            }
        } catch (error) {
            elements.totalHrs.value = '00:00';
        }
    } else {
        elements.totalHrs.value = '00:00';
    }
}

// MESSAGE DISPLAY
// ===============

/**
 * Display user feedback messages with optional error styling
 */
function showActionMessage(message, isError = false) {
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

async function handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const requisitionId = urlParams.get('id');
    const action = urlParams.get('action');

    if (requisitionId && action === 'view') {
        await loadRequisitionForView(requisitionId);
    } else if (requisitionId && action === 'edit') {
        await loadRequisitionForEdit(requisitionId);
    }
}

async function loadRequisitionForView(requisitionId) {
    try {
        const { data, error } = await supabase
            .from('mt_job_requisition_master')
            .select('*')
            .eq('id', requisitionId)
            .single();

        if (error) {
            showActionMessage('Error loading requisition data', true);
            return;
        }

        if (data) {
            populateFormForView(data);
        }
    } catch (error) {
        showActionMessage('Error loading requisition data', true);
    }
}

async function loadRequisitionForEdit(requisitionId) {
    try {
        const { data, error } = await supabase
            .from('mt_job_requisition_master')
            .select('*')
            .eq('id', requisitionId)
            .single();

        if (error) {
            showActionMessage('Error loading requisition data', true);
            return;
        }

        if (data) {
            populateFormForEdit(data);
        }
    } catch (error) {
        showActionMessage('Error loading requisition data', true);
    }
}

function populateFormFields(data) {
    const elements = domCache.initFormElements();

    // Populate form fields with data
    const fieldMappings = {
        'reqDept': data.reqdept,
        'reqDeptHOD': data.reqdepthod,
        'requestorName': data.requestorname,
        'equipmentName': data.equipmentname,
        'equipmentNo': data.equipmentno,
        'equipmentInstallDate': data.equipmentinstalldate ? formatDateForDisplay(data.equipmentinstalldate) : '',
        'requisitionNo': data.requisitionno,
        'machineNo': data.machineno,
        'occurDate': data.occurdate,
        'occurTime': data.occurtime,
        'requireCompletionDate': data.requirecompletiondate,
        'completionTime': data.completiontime,
        'existingCondition': data.existingcondition,
        'purchaseReqNo': data.purchasereqno,
        'costIncurred': data.costincurred !== null && data.costincurred !== undefined ? String(data.costincurred) : '',
        'correction': data.correction,
        'rootCause': data.rootcause,
        'technicianName': data.technicianname,
        'materialRetrieval': data.materialretrieval,
        'cleaningInspection': data.cleaninginspection,
        'scheduleStartDate': data.schedulestartdate ? formatDateForHTMLInput(data.schedulestartdate) : '',
        'scheduleStartTime': data.schedulestarttime || '',
        'scheduleEndDate': data.scheduleenddate ? formatDateForHTMLInput(data.scheduleenddate) : '',
        'scheduleEndTime': data.scheduleendtime || '',
        'totalHrs': (() => {
            const hours = data.totalhours;
            if (hours && typeof hours === 'string') return hours;
            if (typeof hours === 'number') {
                const wholeHours = Math.floor(hours);
                const minutes = Math.round((hours - wholeHours) * 60);
                return `${wholeHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            }
            return hours || '00:00';
        })(),
        'inspectionRemarks': data.inspectionremarks,
        'inspectionCheckedBy': data.inspectioncheckedby,
        'cleanRetrCheckedBy': data.cleanretrcheckedby
    };

    // Populate fields using the mappings and cached elements
    Object.entries(fieldMappings).forEach(([fieldId, value]) => {
        const element = elements[fieldId];
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = Boolean(value);
            } else if (element.type === 'date') {
                element.value = formatDateForHTMLInput(value);
            } else if (element.type === 'time') {
                element.value = value || '';
            } else {
                element.value = value || '';
            }
        }
    });

    // Handle JSON and special fields
    if (data.breakdowncodes) populateCheckboxes('breakdownCode', data.breakdowncodes, 'code');
    if (data.poweroptions) populateCheckboxes('powerOption', data.poweroptions);
    if (data.machineoptions) populateCheckboxes('machineOption', data.machineoptions);
    if (data.handleby) populateCheckboxes('handleBy', data.handleby, 'handle');
    if (data.materials_used) populateMaterialsUsed(data.materials_used);

    // Handle inspection result
    if (data.inspectionresult) {
        if (elements.inspectionAccepted) elements.inspectionAccepted.checked = data.inspectionresult === 'Accepted';
        if (elements.inspectionRejected) elements.inspectionRejected.checked = data.inspectionresult === 'Rejected';
    }

    // Handle roller equipment toggle
    if (data.equipmentname && elements.equipmentName) {
        elements.equipmentName.value = data.equipmentname;
        elements.equipmentName.dispatchEvent(new Event('input', { bubbles: true }));

        const recoatingDateInput = document.getElementById('recoatingDate');
        const regrindingDateInput = document.getElementById('regrindingDate');
        if (recoatingDateInput && data.recoatingdate) recoatingDateInput.value = data.recoatingdate;
        if (regrindingDateInput && data.regrindingdate) regrindingDateInput.value = data.regrindingdate;
    }
}

function populateFormForView(data) {
    // Disable all form fields for view mode
    disableAllFormFields();

    // Populate form fields with data
    populateFormFields(data);
}

function populateFormForEdit(data) {
    // Enable form fields for editing (some fields remain disabled)
    enableFormFieldsForEdit();

    // Populate form fields with data
    populateFormFields(data);
}

function disableAllFormFields() {
    const form = document.getElementById('maintenanceForm');
    if (form) {
        // Make all form fields read-only (not disabled, so they're visible but not editable)
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.readOnly = true;  // Read-only but visible, not greyed out
            input.style.backgroundColor = '#f5f5f5';  // Light grey background to indicate read-only
            input.style.cursor = 'default';  // Normal cursor instead of disabled
        });

        // Hide submit button and delete button in view mode
        const submitBtn = form.querySelector('button[type="submit"]');
        const deleteBtn = form.querySelector('.delete-btn');
        if (submitBtn) {
            submitBtn.style.display = 'none';
        }
        if (deleteBtn) {
            deleteBtn.style.display = 'none';
        }
    }
}

function enableFormFieldsForEdit() {
    const form = document.getElementById('maintenanceForm');
    if (form) {
        // Keep some fields disabled even in edit mode
        const disabledFields = ['reqDept', 'requestorName'];
        const inputs = form.querySelectorAll('input, select, textarea');

        inputs.forEach(input => {
            if (!disabledFields.includes(input.id)) {
                input.readOnly = false;  // Enable editing
                input.style.backgroundColor = '';  // Remove read-only styling
                input.style.cursor = '';  // Restore normal cursor
            }
        });

        // Show submit button and delete button in edit mode
        const submitBtn = form.querySelector('button[type="submit"]');
        const deleteBtn = form.querySelector('.delete-btn');
        if (submitBtn) {
            submitBtn.style.display = 'block';
            submitBtn.textContent = 'Update MJR';
        }
        if (deleteBtn) {
            deleteBtn.style.display = 'block';
        }
    }
}

/**
 * Helper to populate checkboxes from various data formats
 */
function populateCheckboxes(name, data, prefix = '') {
    if (!data) return;

    let optionsData = data;
    if (typeof data === 'string') {
        try { optionsData = JSON.parse(data); } catch (e) { return; }
    }

    if (Array.isArray(optionsData)) {
        optionsData.forEach(item => {
            // Try different ID variations for backward compatibility
            const variations = [
                item,                                   // Direct value
                prefix ? `${prefix}${item}` : null,     // prefix + value
                prefix ? `${prefix}${item.toUpperCase()}` : null // prefix + UPPERCASE value
            ].filter(Boolean);

            for (const id of variations) {
                const cb = document.getElementById(id);
                if (cb) {
                    cb.checked = true;
                    break;
                }
            }
        });
    } else if (typeof optionsData === 'object' && optionsData !== null) {
        Object.entries(optionsData).forEach(([key, isChecked]) => {
            // For objects, the key is usually the element ID or value
            let cb = document.getElementById(key);
            
            // If not found by key, try variations
            if (!cb && prefix) {
                const id = prefix ? `${prefix}${key.toUpperCase()}` : key;
                cb = document.getElementById(id);
            }

            if (cb) cb.checked = Boolean(isChecked);
        });
    }
}

function populateMaterialsUsed(materialsUsed) {
    // Handle materials used table
    if (Array.isArray(materialsUsed)) {
        materialsUsed.forEach((material, index) => {
            const rowIndex = index + 1;
            const materialInput = document.getElementById(`materialUsed${rowIndex}`);
            const specInput = document.getElementById(`specification${rowIndex}`);
            const qtyUsedInput = document.getElementById(`quantityUsed${rowIndex}`);
            const qtyRetrievedInput = document.getElementById(`quantityRetrieved${rowIndex}`);

            if (materialInput) materialInput.value = material.material || '';
            if (specInput) specInput.value = material.specification || '';
            if (qtyUsedInput) qtyUsedInput.value = material.quantity_used || '';
            if (qtyRetrievedInput) qtyRetrievedInput.value = material.quantity_retrieved || '';
        });
    }
}

/**
 * Cached user authentication to avoid repeated API calls
 */
let cachedUserId = null;

/**
 * Get logged in user ID with caching for performance
 */
async function getLoggedInUserId() {
    if (cachedUserId !== null) return cachedUserId;
    const { data: { user } } = await supabase.auth.getUser();
    cachedUserId = user ? user.id : null;
    return cachedUserId;
}

// Helper function to convert dd/mm/yyyy back to yyyy-mm-dd for HTML date inputs
function formatDateForHTMLInput(dateString) {
    if (!dateString) return '';
    if (dateString.includes('-') && dateString.length === 10) return dateString;
    const [day, month, year] = dateString.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Helper function to format date for display as dd/mm/yyyy
function formatDateForDisplay(dateString) {
    if (!dateString) return '';
    if (dateString.includes('/') && dateString.length === 10) return dateString;
    if (dateString.includes('-') && dateString.length === 10) {
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    }
    try {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        }
    } catch (error) {}
    return dateString;
}

// Helper function to convert dd/mm/yyyy to yyyy-mm-dd for database storage
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
    } catch (error) {}
    return dateString;
}

/**
 * Helper to collect checkbox values by name
 */
function collectCheckboxValues(name) {
    const values = {};
    const checkboxes = document.querySelectorAll(`input[name="${name}"]`);
    checkboxes.forEach(cb => {
        const key = cb.id || cb.value;
        values[key] = cb.checked;
    });
    return values;
}

/**
 * Helper to collect material tracking data
 */
function collectMaterialsUsed() {
    const materialsUsed = [];
    for (let i = 1; i <= 8; i++) {
        const material = document.getElementById(`materialUsed${i}`)?.value?.trim();
        const specification = document.getElementById(`specification${i}`)?.value?.trim();
        const quantityUsed = document.getElementById(`quantityUsed${i}`)?.value?.trim();
        const quantityRetrieved = document.getElementById(`quantityRetrieved${i}`)?.value?.trim();

        if (material || specification || quantityUsed || quantityRetrieved) {
            materialsUsed.push({
                material: material || '',
                specification: specification || '',
                quantity_used: quantityUsed || '',
                quantity_retrieved: quantityRetrieved || ''
            });
        }
    }
    return materialsUsed;
}

function setupFormEventListeners(userId) {
    const elements = domCache.initFormElements();
    
    // Handle inspection radio logic
    if (elements.inspectionAccepted && elements.inspectionRejected) {
        elements.inspectionAccepted.addEventListener('change', function() {
            if (this.checked) elements.inspectionRejected.checked = false;
        });

        elements.inspectionRejected.addEventListener('change', function() {
            if (this.checked) elements.inspectionAccepted.checked = false;
        });
    }

    const form = document.getElementById('maintenanceForm');
    if (!form) return;

    // Delete button logic
    const deleteBtn = document.querySelector('.delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async function() {
            const urlParams = new URLSearchParams(window.location.search);
            const existingId = urlParams.get('id');

            if (!existingId) {
                showActionMessage('No MJR record found to delete.', true);
                return;
            }

            if (window.confirm('Are you sure you want to delete this MJR record? This action cannot be undone.')) {
                try {
                    showActionUploadOverlay(0, null, 'deleting...');
                    const { error } = await supabase.from('mt_job_requisition_master').delete().eq('id', existingId);
                    hideActionUploadOverlay();

                    if (error) throw error;
                    
                    showActionMessage('MJR record deleted successfully!');
                    setTimeout(() => window.location.href = '../html/mjr-table.html', 1500);
                } catch (error) {
                    hideActionUploadOverlay();
                    showActionMessage('Error deleting record: ' + error.message, true);
                }
            }
        });
    }

    // Form submission logic
    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        if (!validateForm()) return;

        showActionUploadOverlay(0, null, 'submitting...');
        updateActionUploadProgress(0);

        const urlParams = new URLSearchParams(window.location.search);
        const existingId = urlParams.get('id');
        const action = urlParams.get('action');

        try {
            const insertData = {
                form_type: 'action',
                timestamp: new Date().toISOString(),
                submission_status: 'submitted',
                user_id: userId
            };

            // Map standard form fields
            const fieldMap = {
                reqDept: 'reqdept',
                reqDeptHOD: 'reqdepthod',
                requestorName: 'requestorname',
                equipmentName: 'equipmentname',
                equipmentNo: 'equipmentno',
                equipmentInstallDate: 'equipmentinstalldate',
                occurDate: 'occurdate',
                occurTime: 'occurtime',
                requisitionNo: 'requisitionno',
                machineNo: 'machineno',
                requireCompletionDate: 'requirecompletiondate',
                completionTime: 'completiontime',
                existingCondition: 'existingcondition',
                correction: 'correction',
                rootCause: 'rootcause',
                technicianName: 'technicianname',
                materialRetrieval: 'materialretrieval',
                cleaningInspection: 'cleaninginspection',
                scheduleStartDate: 'schedulestartdate',
                scheduleStartTime: 'schedulestarttime',
                scheduleEndDate: 'scheduleenddate',
                scheduleEndTime: 'scheduleendtime',
                totalHrs: 'totalhours',
                inspectionRemarks: 'inspectionremarks',
                inspectionCheckedBy: 'inspectioncheckedby',
                cleanRetrCheckedBy: 'cleanretrcheckedby',
                purchaseReqNo: 'purchasereqno',
                costIncurred: 'costincurred'
            };

            Object.entries(fieldMap).forEach(([formId, dbField]) => {
                const element = elements[formId];
                if (element) {
                    let value = element.value?.trim();
                    
                    // If the field is empty string, explicitly set to null for the database
                    if (!value) {
                        value = null;
                    }

                    if (value && ['occurDate', 'requireCompletionDate', 'scheduleStartDate', 'scheduleEndDate', 'equipmentInstallDate'].includes(formId)) {
                        value = formatDateForDatabase(value);
                    }
                    if (formId === 'costIncurred' && value) {
                        value = parseFloat(value);
                    }
                    insertData[dbField] = value;
                }
            });

            // Handle complex fields
            insertData.breakdowncodes = collectCheckboxValues('breakdownCode');
            insertData.poweroptions = collectCheckboxValues('powerOption');
            insertData.machineoptions = collectCheckboxValues('machineOption');
            insertData.handleby = collectCheckboxValues('handleBy');
            insertData.materials_used = collectMaterialsUsed();

            if (elements.inspectionAccepted?.checked) insertData.inspectionresult = 'Accepted';
            else if (elements.inspectionRejected?.checked) insertData.inspectionresult = 'Rejected';
            else insertData.inspectionresult = null;

            // Roller fields
            if (isRollerEquipment(insertData.equipmentname)) {
                const recoatingVal = document.getElementById('recoatingDate')?.value;
                const regrindingVal = document.getElementById('regrindingDate')?.value;
                if (recoatingVal) insertData.recoatingdate = formatDateForDatabase(recoatingVal);
                if (regrindingVal) insertData.regrindingdate = formatDateForDatabase(regrindingVal);
            }

            updateActionUploadProgress(50);
            let result;
            if (action === 'edit' && existingId) {
                result = await supabase.from('mt_job_requisition_master').update(insertData).eq('id', existingId);
            } else {
                insertData.id = await getNextMaintenanceId();
                result = await supabase.from('mt_job_requisition_master').insert([insertData]);
            }

            if (result.error) throw result.error;

            updateActionUploadProgress(100);
            setTimeout(() => {
                hideActionUploadOverlay();
                showActionMessage(action === 'edit' ? 'Maintenance Request updated successfully!' : 'Maintenance Request submitted successfully!');
                if (action !== 'edit') form.reset();
                setTimeout(() => window.location.href = '../html/mjr-table.html', 1500);
            }, 500);

        } catch (error) {
            console.error('Error submitting form:', error);
            hideActionUploadOverlay();
            showActionMessage('Error: ' + error.message, true);
        }
    });
}

// FORM VALIDATION
// ===============

/**
 * Validate form fields before submission
 */
function validateForm() {
    const elements = domCache.initFormElements();

    const requiredFields = [
        { id: 'reqDept', label: 'Req. Dept.' },
        { id: 'requestorName', label: 'Requestor Name' },
        { id: 'machineNo', label: 'Area / Machine' },
        { id: 'equipmentName', label: 'Equipment Name' },
        { id: 'occurDate', label: 'Date' },
        { id: 'occurTime', label: 'Time' },
        { id: 'requireCompletionDate', label: 'Completion Date' },
        { id: 'completionTime', label: 'Completion Time' },
        { id: 'existingCondition', label: 'Condition' }
    ];

    const missingFields = [];
    requiredFields.forEach(field => {
        const element = elements[field.id];
        const value = element?.value?.trim() || '';
        if (!value) {
            missingFields.push(field.label);
        }
    });

    if (missingFields.length > 0) {
        showActionMessage(`Please fill in the following required fields: ${missingFields.join(', ')}.`, true);
        return false;
    }

    // Validate that at least one breakdown code is selected
    const breakdownCodes = document.querySelectorAll('input[name="breakdownCode"]:checked');
    if (breakdownCodes.length === 0) {
        showActionMessage('Please select at least one breakdown code.', true);
        return false;
    }

    // Validate schedule if provided
    const scheduleStartDate = document.getElementById('scheduleStartDate')?.value || '';
    const scheduleStartTime = document.getElementById('scheduleStartTime')?.value || '';
    const scheduleEndDate = document.getElementById('scheduleEndDate')?.value || '';
    const scheduleEndTime = document.getElementById('scheduleEndTime')?.value || '';

    if (scheduleStartDate && scheduleStartTime && scheduleEndDate && scheduleEndTime) {
        try {
            const startDateTime = new Date(scheduleStartDate + ' ' + scheduleStartTime);
            const endDateTime = new Date(scheduleEndDate + ' ' + scheduleEndTime);

            if (startDateTime >= endDateTime) {
                showActionMessage('Schedule end time must be after start time.', true);
                return false;
            }
        } catch (error) {
            showActionMessage('Error validating schedule times.', true);
            return false;
        }
    }

    return true;
}

// UTILITY FUNCTIONS
// =================

/**
 * Generate unique maintenance ID for new records
 */
async function getNextMaintenanceId() {
    try {
        return generateUUID();
    } catch (error) {
        return `MT${Date.now().toString().slice(-10)}`;
    }
}

/**
 * Generate UUID v4 for unique identifiers
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

// UPLOAD OVERLAY
// ==============

/**
 * Show upload progress overlay with spinner
 */
function showActionUploadOverlay(progress = 0, onCancel, message = 'uploading...') {
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
            hideActionUploadOverlay();
        };
    }
}

/**
 * Update upload progress percentage
 */
function updateActionUploadProgress(progress) {
    const progressElem = document.getElementById('upload-progress');
    if (progressElem) progressElem.textContent = progress;
}

/**
 * Hide upload overlay and clean up effects
 */
function hideActionUploadOverlay() {
    const overlay = document.getElementById('image-upload-overlay');
    if (overlay) {
        overlay.style.display = 'none';
        document.body.style.backdropFilter = 'none';
        document.body.style.filter = 'none';
        document.documentElement.style.backdropFilter = 'none';
        document.documentElement.style.filter = 'none';
        document.body.style.overflow = '';
    }
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

// DYNAMIC ROLLER FIELDS
// =====================

/**
 * Equipment type detection
 */
function isRollerEquipment(equipmentName) {
    if (!equipmentName) return false;
    const rollerTypes = ['Rubber Roller', 'Emboss Roller', 'Rubber roller', 'Emboss roller'];
    return rollerTypes.some(type => equipmentName.includes(type));
}

/**
 * Setup dynamic roller-specific fields based on equipment type
 */
function setupDynamicRollerFields() {
    const rollerFields = document.getElementById('rollerFields');
    if (!rollerFields) return;

    // Use event delegation on the document for the dynamic equipmentName input
    const toggleRollerFields = () => {
        const equipmentNameInput = document.getElementById('equipmentName');
        if (!equipmentNameInput) return;

        const isRoller = isRollerEquipment(equipmentNameInput.value.trim());
        rollerFields.style.display = isRoller ? 'block' : 'none';
        
        if (!isRoller) {
            const recoatingDate = document.getElementById('recoatingDate');
            const regrindingDate = document.getElementById('regrindingDate');
            if (recoatingDate) recoatingDate.value = '';
            if (regrindingDate) regrindingDate.value = '';
        }
    };

    // Initial check
    toggleRollerFields();

    // Listen for events on the equipmentName element
    document.addEventListener('input', (e) => {
        if (e.target && e.target.id === 'equipmentName') {
            toggleRollerFields();
        }
    });

    document.addEventListener('change', (e) => {
        if (e.target && e.target.id === 'equipmentName') {
            toggleRollerFields();
        }
    });

    // Check periodically for value changes that don't trigger events (like auto-fill)
    if (window.rollerFieldsInterval) clearInterval(window.rollerFieldsInterval);
    window.rollerFieldsInterval = setInterval(toggleRollerFields, 500);
}
