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

    // Auto-calculate total hours when schedule changes
    setupScheduleCalculation();

    // Calculate total hours after form is populated with data
    setTimeout(calculateTotalHoursFromFields, 100);

    // Setup equipment name auto-suggestions
    setupEquipmentNameSuggestions();

    // Setup dynamic roller fields
    setupDynamicRollerFields();
});

function setupScheduleCalculation() {
    const scheduleStartDate = document.getElementById('scheduleStartDate');
    const scheduleStartTime = document.getElementById('scheduleStartTime');
    const scheduleEndDate = document.getElementById('scheduleEndDate');
    const scheduleEndTime = document.getElementById('scheduleEndTime');
    const totalHrs = document.getElementById('totalHrs');

    if (!scheduleStartDate || !scheduleStartTime || !scheduleEndDate || !scheduleEndTime || !totalHrs) {
        return; // Exit if any required fields are missing
    }

    function calculateTotalHours() {
        const startDate = scheduleStartDate.value;
        const startTime = scheduleStartTime.value;
        const endDate = scheduleEndDate.value;
        const endTime = scheduleEndTime.value;

        if (startDate && startTime && endDate && endTime) {
            try {
                // Parse dates more reliably
                const startDateTime = new Date(startDate + ' ' + startTime);
                const endDateTime = new Date(endDate + ' ' + endTime);

                if (endDateTime > startDateTime) {
                    const diffMs = endDateTime - startDateTime;
                    const diffMinutes = Math.floor(diffMs / (1000 * 60)); // Get total minutes
                    const hours = Math.floor(diffMinutes / 60);
                    const minutes = diffMinutes % 60;

                    totalHrs.value = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                } else {
                    totalHrs.value = '00:00';
                }
            } catch (error) {
                console.error('Error calculating total hours:', error);
                totalHrs.value = '00:00';
            }
        }
    }

    // Add event listeners to all schedule fields
    scheduleStartDate.addEventListener('change', calculateTotalHours);
    scheduleStartTime.addEventListener('change', calculateTotalHours);
    scheduleEndDate.addEventListener('change', calculateTotalHours);
    scheduleEndTime.addEventListener('change', calculateTotalHours);

    // Also calculate on input for real-time updates
    scheduleStartDate.addEventListener('input', calculateTotalHours);
    scheduleStartTime.addEventListener('input', calculateTotalHours);
    scheduleEndDate.addEventListener('input', calculateTotalHours);
    scheduleEndTime.addEventListener('input', calculateTotalHours);
}

function calculateTotalHoursFromFields() {
    const scheduleStartDate = document.getElementById('scheduleStartDate');
    const scheduleStartTime = document.getElementById('scheduleStartTime');
    const scheduleEndDate = document.getElementById('scheduleEndDate');
    const scheduleEndTime = document.getElementById('scheduleEndTime');
    const totalHrs = document.getElementById('totalHrs');

    if (!scheduleStartDate || !scheduleStartTime || !scheduleEndDate || !scheduleEndTime || !totalHrs) {
        return;
    }

    const startDate = scheduleStartDate.value;
    const startTime = scheduleStartTime.value;
    const endDate = scheduleEndDate.value;
    const endTime = scheduleEndTime.value;

    if (startDate && startTime && endDate && endTime) {
        try {
            // Parse dates more reliably
            const startDateTime = new Date(startDate + ' ' + startTime);
            const endDateTime = new Date(endDate + ' ' + endTime);

            if (startDateTime < endDateTime) {
                const diffMs = endDateTime - startDateTime;
                const diffMinutes = Math.floor(diffMs / (1000 * 60)); // Get total minutes
                const hours = Math.floor(diffMinutes / 60);
                const minutes = diffMinutes % 60;

                totalHrs.value = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            }
        } catch (error) {
            console.error('Error calculating total hours from fields:', error);
        }
    }
}

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

    // Check if we have URL parameters for pre-populating the form
    await handleUrlParameters();

    setupFormEventListeners(userId);
});

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
            console.error('Error fetching requisition:', error);
            showActionMessage('Error loading requisition data', true);
            return;
        }

        if (data) {
            populateFormForView(data);
        }
    } catch (error) {
        console.error('Error loading requisition for view:', error);
        showMessage('Error loading requisition data', true);
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
            console.error('Error fetching requisition:', error);
            showActionMessage('Error loading requisition data', true);
            return;
        }

        if (data) {
            populateFormForEdit(data);
        }
    } catch (error) {
        console.error('Error loading requisition for edit:', error);
        showMessage('Error loading requisition data', true);
    }
}

function populateFormFields(data) {
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
        'occurDate': data.occurdate, // HTML date inputs expect yyyy-mm-dd format
        'occurTime': data.occurtime,
        'requireCompletionDate': data.requirecompletiondate, // HTML date inputs expect yyyy-mm-dd format
        'completionTime': data.completiontime,
        'existingCondition': data.existingcondition,
        'purchaseReqNo': data.purchasereqno,
        'costIncurred': data.costincurred !== null && data.costincurred !== undefined ? String(data.costincurred) : '',
        'correction': data.correction,
        'rootCause': data.rootcause,
        'technicianName': data.technicianname,
        'materialRetrieval': data.materialretrieval,
        'cleaningInspection': data.cleaninginspection,
        'scheduleStartDate': formatDateForHTMLInput(data.schedulestartdate) || '',
        'scheduleStartTime': data.schedulestarttime || '',
        'scheduleEndDate': formatDateForHTMLInput(data.scheduleenddate) || '',
        'scheduleEndTime': data.scheduleendtime || '',
        'totalHrs': (() => {
            const hours = data.totalhours;
            if (hours && typeof hours === 'string') {
                // If it's already a time string format, return as is
                return hours;
            } else if (typeof hours === 'number') {
                // Handle legacy decimal format
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

    // Populate simple fields
    Object.entries(fieldMappings).forEach(([fieldId, value]) => {
        const element = document.getElementById(fieldId);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = Boolean(value);
            } else if (element.type === 'date') {
                // Convert dd/mm/yyyy to yyyy-mm-dd for HTML date inputs
                element.value = formatDateForHTMLInput(value);
            } else if (element.type === 'time') {
                // HTML time inputs expect HH:MM format, which is what we store
                element.value = value || '';
            } else if (element.tagName === 'SELECT') {
                if (value) element.value = value;
            } else {
                element.value = value || '';
            }
        }
    });

    // Handle JSON fields
    if (data.breakdowncodes) {
        populateBreakdownCodes(data.breakdowncodes);
    }

    if (data.poweroptions) {
        populatePowerOptions(data.poweroptions);
    }

    if (data.machineoptions) {
        populateMachineOptions(data.machineoptions);
    }

    if (data.handleby) {
        populateHandleBy(data.handleby);
    }

    if (data.materials_used) {
        populateMaterialsUsed(data.materials_used);
    }

    // Handle inspection result
    if (data.inspectionresult) {
        const acceptedRadio = document.getElementById('inspectionAccepted');
        const rejectedRadio = document.getElementById('inspectionRejected');
        if (acceptedRadio) acceptedRadio.checked = data.inspectionresult === 'Accepted';
        if (rejectedRadio) rejectedRadio.checked = data.inspectionresult === 'Rejected';
    }

    // Check if this is roller equipment and populate roller fields
    if (data.equipmentname) {
        const equipmentNameInput = document.getElementById('equipmentName');
        const rollerFields = document.getElementById('rollerFields');

        if (equipmentNameInput && rollerFields) {
            // Set the equipment name value (this will trigger the toggle via event listeners)
            equipmentNameInput.value = data.equipmentname;
            equipmentNameInput.dispatchEvent(new Event('input', { bubbles: true }));

            // Also populate roller fields if they exist in the data
            if (data.recoatingdate) {
                const recoatingDateInput = document.getElementById('recoatingDate');
                if (recoatingDateInput) {
                    recoatingDateInput.value = data.recoatingdate;
                }
            }

            if (data.regrindingdate) {
                const regrindingDateInput = document.getElementById('regrindingDate');
                if (regrindingDateInput) {
                    regrindingDateInput.value = data.regrindingdate;
                }
            }
        }
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

function populateBreakdownCodes(breakdownCodes) {
    // Handle breakdown codes checkboxes
    if (!breakdownCodes) {
        return;
    }

    // Handle different possible data formats
    let codesData = breakdownCodes;

    // If it's a string, try to parse it as JSON
    if (typeof breakdownCodes === 'string') {
        try {
            codesData = JSON.parse(breakdownCodes);
        } catch (e) {
            console.error('Failed to parse breakdown codes string:', e);
            return;
        }
    }

    if (Array.isArray(codesData)) {
        // Handle array format: ['A', 'B', 'I']
        codesData.forEach(code => {
            const checkbox = document.getElementById(`code${code.toUpperCase()}`);
            if (checkbox) {
                checkbox.checked = true;
            } else {
                console.warn(`Checkbox with ID code${code.toUpperCase()} not found`);
            }
        });
    } else if (typeof codesData === 'object' && codesData !== null && !Array.isArray(codesData)) {
        // Handle object format: {"A": true, "B": false, "I": true}
        Object.entries(codesData).forEach(([code, isChecked]) => {
            const checkbox = document.getElementById(`code${code.toUpperCase()}`);
            if (checkbox) {
                checkbox.checked = Boolean(isChecked);
            } else {
                console.warn(`Checkbox with ID code${code.toUpperCase()} not found`);
            }
        });
    }
}

function populatePowerOptions(powerOptions) {
    // Handle power options checkboxes
    if (!powerOptions) {
        return;
    }

    // Handle different possible data formats
    let optionsData = powerOptions;

    // If it's a string, try to parse it as JSON
    if (typeof powerOptions === 'string') {
        try {
            optionsData = JSON.parse(powerOptions);
        } catch (e) {
            console.error('Failed to parse power options string:', e);
            return;
        }
    }

    if (Array.isArray(optionsData)) {
        // Handle array format: ['switchOffPower', 'stopMachine']
        optionsData.forEach(optionId => {
            const checkbox = document.getElementById(optionId);
            if (checkbox) {
                checkbox.checked = true;
            } else {
                console.warn(`Checkbox with ID ${optionId} not found`);
            }
        });
    } else if (typeof optionsData === 'object' && optionsData !== null && !Array.isArray(optionsData)) {
        // Handle object format: {"switchOffPower": true, "noSwitchPower": false}
        Object.entries(optionsData).forEach(([option, isChecked]) => {
            const checkbox = document.getElementById(option);
            if (checkbox) {
                checkbox.checked = Boolean(isChecked);
            } else {
                console.warn(`Checkbox with ID ${option} not found`);
            }
        });
    }
}

function populateMachineOptions(machineOptions) {
    // Handle machine options checkboxes
    if (!machineOptions) {
        return;
    }

    // Handle different possible data formats
    let optionsData = machineOptions;

    // If it's a string, try to parse it as JSON
    if (typeof machineOptions === 'string') {
        try {
            optionsData = JSON.parse(machineOptions);
        } catch (e) {
            console.error('Failed to parse machine options string:', e);
            return;
        }
    }

    if (Array.isArray(optionsData)) {
        // Handle array format: ['stopMachine', 'noStopMachine']
        optionsData.forEach(optionId => {
            const checkbox = document.getElementById(optionId);
            if (checkbox) {
                checkbox.checked = true;
            } else {
                console.warn(`Checkbox with ID ${optionId} not found`);
            }
        });
    } else if (typeof optionsData === 'object' && optionsData !== null && !Array.isArray(optionsData)) {
        // Handle object format: {"stopMachine": true, "noStopMachine": false}
        Object.entries(optionsData).forEach(([option, isChecked]) => {
            const checkbox = document.getElementById(option);
            if (checkbox) {
                checkbox.checked = Boolean(isChecked);
            } else {
                console.warn(`Checkbox with ID ${option} not found`);
            }
        });
    }
}

function populateHandleBy(handleBy) {
    // Handle handle by checkboxes
    if (!handleBy) {
        return;
    }

    // Handle different possible data formats
    let handleData = handleBy;

    // If it's a string, try to parse it as JSON
    if (typeof handleBy === 'string') {
        try {
            handleData = JSON.parse(handleBy);
        } catch (e) {
            console.error('Failed to parse handle by string:', e);
            return;
        }
    }

    if (Array.isArray(handleData)) {
        // Handle array format: ['MT', 'OTS', 'BT']
        handleData.forEach(option => {
            const checkbox = document.getElementById(`handle${option.toUpperCase()}`);
            if (checkbox) {
                checkbox.checked = true;
            } else {
                console.warn(`Checkbox with ID handle${option.toUpperCase()} not found`);
            }
        });
    } else if (typeof handleData === 'object' && handleData !== null && !Array.isArray(handleData)) {
        // Handle object format: {"MT": true, "OTS": false, "BT": true}
        Object.entries(handleData).forEach(([option, isChecked]) => {
            const checkbox = document.getElementById(`handle${option.toUpperCase()}`);
            if (checkbox) {
                checkbox.checked = Boolean(isChecked);
            } else {
                console.warn(`Checkbox with ID handle${option.toUpperCase()} not found`);
            }
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

// Helper function to format date for display as dd/mm/yyyy
function formatDateForDisplay(dateString) {
    if (!dateString) return '';

    // If already in dd/mm/yyyy format, return as is
    if (dateString.includes('/') && dateString.length === 10) return dateString;

    // If in yyyy-mm-dd format, convert to dd/mm/yyyy
    if (dateString.includes('-') && dateString.length === 10) {
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    }

    // Try to parse as Date object and format
    try {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        }
    } catch (error) {
        console.warn('Could not parse date:', dateString);
    }

    return dateString; // Return original if parsing fails
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

function setupFormEventListeners(userId) {
    const form = document.getElementById('maintenanceForm');
    const deleteBtn = document.querySelector('.delete-btn');

    // Delete button event listener
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

                    const { error } = await supabase
                        .from('mt_job_requisition_master')
                        .delete()
                        .eq('id', existingId);

                    hideActionUploadOverlay();

                    if (error) {
                        console.error('Delete error:', error);
                        showActionMessage('Error deleting MJR record. Please try again.', true);
                    } else {
                        showActionMessage('MJR record deleted successfully!');
                        setTimeout(() => {
                            window.location.href = '../html/MT-job-requisition-table.html';
                        }, 1500);
                    }
                } catch (error) {
                    hideActionUploadOverlay();
                    console.error('Unexpected error during deletion:', error);
                    showMessage('Error deleting MJR record. Please try again.', true);
                }
            }
        });
    }

    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        if (validateForm()) {
            showActionUploadOverlay(0, null, 'submitting...');
            const cancelBtn = document.getElementById('cancel-upload-btn');
            if (cancelBtn) cancelBtn.style.display = 'none';
            updateActionUploadProgress(0);

            // Check if we're in edit mode
            const urlParams = new URLSearchParams(window.location.search);
            const existingId = urlParams.get('id');
            const action = urlParams.get('action');

            const insertData = {
                form_type: 'action',
                reqdept: document.getElementById('reqDept').value || null,
                reqdepthod: document.getElementById('reqDeptHOD').value.trim() || null,
                requestorname: document.getElementById('requestorName').value.trim() || null,
                equipmentname: document.getElementById('equipmentName').value.trim() || null,
                equipmentno: document.getElementById('equipmentNo').value.trim() || null,
                equipmentinstalldate: document.getElementById('equipmentInstallDate').value ? formatDateForDatabase(document.getElementById('equipmentInstallDate').value) : null,
                occurdate: document.getElementById('occurDate').value || null,
                occurtime: document.getElementById('occurTime').value || null,
                requisitionno: document.getElementById('requisitionNo').value.trim() || null,
                machineno: document.getElementById('machineNo').value.trim() || null,
                requirecompletiondate: document.getElementById('requireCompletionDate').value || null,
                completiontime: document.getElementById('completionTime').value || null,
                existingcondition: document.getElementById('existingCondition').value.trim() || null,
                correction: document.getElementById('correction').value.trim() || null,
                rootcause: document.getElementById('rootCause').value.trim() || null,
                technicianname: document.getElementById('technicianName').value.trim() || null,
                materialretrieval: document.getElementById('materialRetrieval').value.trim() || null,
                cleaninginspection: document.getElementById('cleaningInspection').value.trim() || null,
                schedulestartdate: formatDateToDDMMYYYY(document.getElementById('scheduleStartDate')?.value) || null,
                schedulestarttime: document.getElementById('scheduleStartTime')?.value || null,
                scheduleenddate: formatDateToDDMMYYYY(document.getElementById('scheduleEndDate')?.value) || null,
                scheduleendtime: document.getElementById('scheduleEndTime')?.value || null,
                totalhours: (() => {
                    const timeValue = document.getElementById('totalHrs')?.value || '00:00';
                    return timeValue;
                })(),
                inspectionremarks: document.getElementById('inspectionRemarks')?.value?.trim() || null,
                inspectionresult: (() => {
                    const accepted = document.getElementById('inspectionAccepted');
                    const rejected = document.getElementById('inspectionRejected');
                    if (accepted?.checked) return 'Accepted';
                    if (rejected?.checked) return 'Rejected';
                    return null;
                })(),
                inspectioncheckedby: document.getElementById('inspectionCheckedBy')?.value?.trim() || null,
                cleanretrcheckedby: document.getElementById('cleanRetrCheckedBy')?.value?.trim() || null,
                timestamp: new Date().toISOString(),
                submission_status: 'submitted'
            };

            // Only add user_id if it exists (not causing foreign key issues for now)
            if (userId) {
                insertData.user_id = userId;
            }

            // Handle checkbox objects as JSONB
            const breakdownCodes = {};
            const checkboxes = document.querySelectorAll('input[name="breakdownCode"]');
            checkboxes.forEach(cb => {
                breakdownCodes[cb.value] = cb.checked;
            });
            insertData.breakdowncodes = breakdownCodes;

            const powerOptions = {};
            const powerCheckboxes = document.querySelectorAll('input[name="powerOption"]');
            powerCheckboxes.forEach(cb => {
                powerOptions[cb.id] = cb.checked;
            });
            insertData.poweroptions = powerOptions;

            const machineOptions = {};
            const machineCheckboxes = document.querySelectorAll('input[name="machineOption"]');
            machineCheckboxes.forEach(cb => {
                machineOptions[cb.id] = cb.checked;
            });
            insertData.machineoptions = machineOptions;

            const handleBy = {};
            const handleCheckboxes = document.querySelectorAll('input[name="handleBy"]');
            handleCheckboxes.forEach(cb => {
                handleBy[cb.value] = cb.checked;
            });
            insertData.handleby = handleBy;

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

            // Only collect costIncurred if the field exists and has a value
            const costIncurredElement = document.getElementById('costIncurred');
            if (costIncurredElement && costIncurredElement.value.trim()) {
                const costValue = parseFloat(costIncurredElement.value.trim());
                if (!isNaN(costValue)) {
                    insertData.costincurred = costValue;
                }
            }

            // Collect roller-specific fields if they are visible
            const rollerFields = document.getElementById('rollerFields');
            if (rollerFields && rollerFields.style.display !== 'none') {
                const recoatingDateElement = document.getElementById('recoatingDate');
                const regrindingDateElement = document.getElementById('regrindingDate');

                if (recoatingDateElement && recoatingDateElement.value) {
                    insertData.recoatingdate = recoatingDateElement.value;
                }

                if (regrindingDateElement && regrindingDateElement.value) {
                    insertData.regrindingdate = regrindingDateElement.value;
                }
            }

            try {
                updateActionUploadProgress(50);
                let result;

                if (action === 'edit' && existingId) {
                    // Update existing record
                    result = await supabase
                        .from('mt_job_requisition_master')
                        .update(insertData)
                        .eq('id', existingId);
                } else {
                    // Insert new record
                    const id = await getNextMaintenanceId();
                    insertData.id = id;
                    result = await supabase
                        .from('mt_job_requisition_master')
                        .insert([insertData]);
                }

                const { data, error } = result;

                if (error) {
                    hideActionUploadOverlay();
                    console.error('Submission error:', error);
                    showActionMessage('Error submitting form. Please try again. Details: ' + error.message, true);
                } else {
                    updateActionUploadProgress(100);
                    setTimeout(() => {
                        hideActionUploadOverlay();
                        // Ensure any blur effects are completely removed
                        setTimeout(() => {
                            // Double-check that all blur effects are removed
                            document.body.style.backdropFilter = 'none';
                            document.body.style.filter = 'none';
                            document.documentElement.style.backdropFilter = 'none';
                            document.documentElement.style.filter = 'none';

                            if (action === 'edit') {
                                showActionMessage('Maintenance Request updated successfully!');
                            } else {
                                showActionMessage('Maintenance Request submitted successfully!');
                            document.getElementById('maintenanceForm').reset();
                            }
                        }, 200);
                    }, 500);
                }
            } catch (error) {
                hideActionUploadOverlay();
                console.error('Unexpected error:', error);
                showActionMessage('Error submitting form. Please try again.', true);
            }
        }
    });
}

function validateForm() {
    const reqDept = document.getElementById('reqDept')?.value || '';
    const requestorName = document.getElementById('requestorName')?.value?.trim() || '';
    const equipmentName = document.getElementById('equipmentName')?.value?.trim() || '';
    const equipmentNo = document.getElementById('equipmentNo')?.value?.trim() || '';
    const occurDate = document.getElementById('occurDate')?.value || '';
    const occurTime = document.getElementById('occurTime')?.value || '';
    const requireCompletionDate = document.getElementById('requireCompletionDate')?.value || '';
    const completionTime = document.getElementById('completionTime')?.value || '';
    const existingCondition = document.getElementById('existingCondition')?.value?.trim() || '';

    // Basic required fields check
    if (!reqDept || !requestorName || !equipmentName || !equipmentNo || !occurDate || !occurTime || !requireCompletionDate || !completionTime || !existingCondition) {
        showActionMessage('Please fill in all required fields (Req. Dept., Requestor Name, Equipment Name, No., Date, Time, Completion Date, Completion Time, Condition).', true);
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
            // Parse dates more reliably
            const startDateTime = new Date(scheduleStartDate + ' ' + scheduleStartTime);
            const endDateTime = new Date(scheduleEndDate + ' ' + scheduleEndTime);

            if (startDateTime >= endDateTime) {
                showActionMessage('Schedule end time must be after start time.', true);
                return false;
            }
        } catch (error) {
            console.error('Error validating schedule times:', error);
            showActionMessage('Error validating schedule times. Please check the date and time format.', true);
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
            hideUploadOverlay();
        };
    }
}

function updateActionUploadProgress(progress) {
    const progressElem = document.getElementById('upload-progress');
    if (progressElem) progressElem.textContent = progress;
}

function hideActionUploadOverlay() {
    const overlay = document.getElementById('image-upload-overlay');
    if (overlay) {
        overlay.style.display = 'none';
        // Remove all possible blur effects from body and html
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

// Dynamic Roller Fields Functionality
function setupDynamicRollerFields() {
    const equipmentNameInput = document.getElementById('equipmentName');
    const rollerFields = document.getElementById('rollerFields');

    if (!equipmentNameInput || !rollerFields) {
        console.warn('Equipment name input or roller fields not found');
        return;
    }

    // Equipment type detection
    function isRollerEquipment(equipmentName) {
        if (!equipmentName) return false;
        const rollerTypes = ['Rubber Roller', 'Emboss Roller', 'Rubber roller', 'Emboss roller'];
        return rollerTypes.some(type => equipmentName.includes(type));
    }

    // Toggle roller fields visibility
    function toggleRollerFields() {
        const equipmentName = equipmentNameInput.value.trim();
        const isRoller = isRollerEquipment(equipmentName);

        if (isRoller) {
            rollerFields.style.display = 'block';
            console.log('✅ Showing roller fields for:', equipmentName);
        } else {
            rollerFields.style.display = 'none';
            // Clear roller fields when hiding
            document.getElementById('recoatingDate').value = '';
            document.getElementById('regrindingDate').value = '';
            console.log('❌ Hiding roller fields');
        }
    }

    // Initial check
    toggleRollerFields();

    // Monitor equipment name changes
    equipmentNameInput.addEventListener('input', toggleRollerFields);
    equipmentNameInput.addEventListener('change', toggleRollerFields);

    // Also check when form is populated with existing data
    // This handles cases where equipment name is loaded from database
    const checkInterval = setInterval(() => {
        const currentValue = equipmentNameInput.value.trim();
        if (currentValue && !equipmentNameInput.hasAttribute('data-initial-checked')) {
            equipmentNameInput.setAttribute('data-initial-checked', 'true');
            toggleRollerFields();
            clearInterval(checkInterval);
        }
    }, 100);

    // Stop checking after 5 seconds
    setTimeout(() => {
        clearInterval(checkInterval);
    }, 5000);

    console.log('✅ Dynamic roller fields setup complete');
}
