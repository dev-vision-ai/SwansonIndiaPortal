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
                const startDateTime = new Date(`${startDate}T${startTime}`);
                const endDateTime = new Date(`${endDate}T${endTime}`);

                if (startDateTime < endDateTime) {
                    const diffMs = endDateTime - startDateTime;
                    const diffHours = diffMs / (1000 * 60 * 60); // Convert to hours
                    const hours = Math.floor(diffHours);
                    const minutes = Math.round((diffHours - hours) * 60);

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
            const startDateTime = new Date(`${startDate}T${startTime}`);
            const endDateTime = new Date(`${endDate}T${endTime}`);

            if (startDateTime < endDateTime) {
                const diffMs = endDateTime - startDateTime;
                const diffHours = diffMs / (1000 * 60 * 60);
                const hours = Math.floor(diffHours);
                const minutes = Math.round((diffHours - hours) * 60);

                totalHrs.value = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            }
        } catch (error) {
            console.error('Error calculating total hours from fields:', error);
        }
    }
}

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

    // Check if we have URL parameters for pre-populating the form
    await handleUrlParameters();

    setupFormEventListeners(userId);
});

async function handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const requisitionId = urlParams.get('id');
    const action = urlParams.get('action');

    if (requisitionId && action === 'view') {
        console.log(`Loading MT job requisition ${requisitionId} in view mode`);
        await loadRequisitionForView(requisitionId);
    } else if (requisitionId && action === 'edit') {
        console.log(`Loading MT job requisition ${requisitionId} in edit mode`);
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
            showMessage('Error loading requisition data', true);
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
            showMessage('Error loading requisition data', true);
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
        'requestorName': data.requestorname,
        'equipmentName': data.equipmentname,
        'equipmentNo': data.equipmentno,
        'requisitionNo': data.requisitionno,
        'machineNo': data.machineno,
        'occurDate': data.occurdate,
        'occurTime': data.occurtime,
        'requireCompletionDate': data.requirecompletiondate,
        'completionTime': data.completiontime,
        'existingCondition': data.existingcondition,
        'purchaseReqNo': data.purchasereqno,
        'correction': data.correction,
        'technicianName': data.technicianname,
        'materialRetrieval': data.materialretrieval,
        'cleaningInspection': data.cleaninginspection,
        'scheduleStartDate': data.schedulestartdate || '',
        'scheduleStartTime': data.schedulestarttime || '',
        'scheduleEndDate': data.scheduleenddate || '',
        'scheduleEndTime': data.scheduleendtime || '',
        'totalHrs': (() => {
            const hours = data.totalhours || 0;
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

    // Populate simple fields
    Object.entries(fieldMappings).forEach(([fieldId, value]) => {
        const element = document.getElementById(fieldId);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = Boolean(value);
            } else if (element.tagName === 'SELECT') {
                if (value) element.value = value;
            } else {
                element.value = value || '';
            }
        }
    });

    // Handle JSON fields
    console.log('Raw data for debugging:', data);
    if (data.breakdowncodes) {
        console.log('Breakdown codes data:', data.breakdowncodes);
        populateBreakdownCodes(data.breakdowncodes);
    }

    if (data.poweroptions) {
        console.log('Power options data:', data.poweroptions);
        populatePowerOptions(data.poweroptions);
    }

    if (data.machineoptions) {
        console.log('Machine options data:', data.machineoptions);
        populateMachineOptions(data.machineoptions);
    }

    if (data.handleby) {
        console.log('Handle by data:', data.handleby);
        populateHandleBy(data.handleby);
    }

    if (data.materials_used) {
        console.log('Materials used data:', data.materials_used);
        populateMaterialsUsed(data.materials_used);
    }

    // Handle inspection result
    if (data.inspectionresult) {
        const acceptedRadio = document.getElementById('inspectionAccepted');
        const rejectedRadio = document.getElementById('inspectionRejected');
        if (acceptedRadio) acceptedRadio.checked = data.inspectionresult === 'Accepted';
        if (rejectedRadio) rejectedRadio.checked = data.inspectionresult === 'Rejected';
    }

    console.log('Form fields populated');
}

function populateFormForView(data) {
    // Disable all form fields for view mode
    disableAllFormFields();

    // Populate form fields with data
    populateFormFields(data);

    console.log('Form populated for view mode');
}

function populateFormForEdit(data) {
    // Enable form fields for editing (some fields remain disabled)
    enableFormFieldsForEdit();

    // Populate form fields with data
    populateFormFields(data);

    console.log('Form populated for edit mode');
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
    console.log('populateBreakdownCodes called with:', breakdownCodes, 'type:', typeof breakdownCodes);

    if (!breakdownCodes) {
        console.log('Breakdown codes data is null or undefined');
        return;
    }

    // Handle different possible data formats
    let codesData = breakdownCodes;

    // If it's a string, try to parse it as JSON
    if (typeof breakdownCodes === 'string') {
        try {
            codesData = JSON.parse(breakdownCodes);
            console.log('Parsed breakdown codes from string:', codesData);
        } catch (e) {
            console.error('Failed to parse breakdown codes string:', e);
            return;
        }
    }

    if (Array.isArray(codesData)) {
        // Handle array format: ['A', 'B', 'I']
        console.log('Processing breakdown codes as array:', codesData);
        codesData.forEach(code => {
            const checkbox = document.getElementById(`code${code.toUpperCase()}`);
            console.log(`Looking for checkbox code${code.toUpperCase()}, found:`, checkbox, 'setting checked: true');
            if (checkbox) {
                checkbox.checked = true;
            } else {
                console.warn(`Checkbox with ID code${code.toUpperCase()} not found`);
            }
        });
    } else if (typeof codesData === 'object' && codesData !== null && !Array.isArray(codesData)) {
        // Handle object format: {"A": true, "B": false, "I": true}
        console.log('Processing breakdown codes as object:', codesData);
        Object.entries(codesData).forEach(([code, isChecked]) => {
            const checkbox = document.getElementById(`code${code.toUpperCase()}`);
            console.log(`Looking for checkbox code${code.toUpperCase()}, found:`, checkbox, 'setting checked:', Boolean(isChecked));
            if (checkbox) {
                checkbox.checked = Boolean(isChecked);
            } else {
                console.warn(`Checkbox with ID code${code.toUpperCase()} not found`);
            }
        });
    } else {
        console.log('Breakdown codes data is not an array or object:', codesData);
    }
}

function populatePowerOptions(powerOptions) {
    // Handle power options checkboxes
    console.log('populatePowerOptions called with:', powerOptions, 'type:', typeof powerOptions);

    if (!powerOptions) {
        console.log('Power options data is null or undefined');
        return;
    }

    // Handle different possible data formats
    let optionsData = powerOptions;

    // If it's a string, try to parse it as JSON
    if (typeof powerOptions === 'string') {
        try {
            optionsData = JSON.parse(powerOptions);
            console.log('Parsed power options from string:', optionsData);
        } catch (e) {
            console.error('Failed to parse power options string:', e);
            return;
        }
    }

    if (Array.isArray(optionsData)) {
        // Handle array format: ['switchOffPower', 'stopMachine']
        console.log('Processing power options as array:', optionsData);
        optionsData.forEach(optionId => {
            const checkbox = document.getElementById(optionId);
            console.log(`Looking for checkbox ${optionId}, found:`, checkbox, 'setting checked: true');
            if (checkbox) {
                checkbox.checked = true;
            } else {
                console.warn(`Checkbox with ID ${optionId} not found`);
            }
        });
    } else if (typeof optionsData === 'object' && optionsData !== null && !Array.isArray(optionsData)) {
        // Handle object format: {"switchOffPower": true, "noSwitchPower": false}
        console.log('Processing power options as object:', optionsData);
        Object.entries(optionsData).forEach(([option, isChecked]) => {
            const checkbox = document.getElementById(option);
            console.log(`Looking for checkbox ${option}, found:`, checkbox, 'setting checked:', Boolean(isChecked));
            if (checkbox) {
                checkbox.checked = Boolean(isChecked);
            } else {
                console.warn(`Checkbox with ID ${option} not found`);
            }
        });
    } else {
        console.log('Power options data is not an array or object after processing:', optionsData);
    }
}

function populateMachineOptions(machineOptions) {
    // Handle machine options checkboxes
    console.log('populateMachineOptions called with:', machineOptions, 'type:', typeof machineOptions);

    if (!machineOptions) {
        console.log('Machine options data is null or undefined');
        return;
    }

    // Handle different possible data formats
    let optionsData = machineOptions;

    // If it's a string, try to parse it as JSON
    if (typeof machineOptions === 'string') {
        try {
            optionsData = JSON.parse(machineOptions);
            console.log('Parsed machine options from string:', optionsData);
        } catch (e) {
            console.error('Failed to parse machine options string:', e);
            return;
        }
    }

    if (Array.isArray(optionsData)) {
        // Handle array format: ['stopMachine', 'noStopMachine']
        console.log('Processing machine options as array:', optionsData);
        optionsData.forEach(optionId => {
            const checkbox = document.getElementById(optionId);
            console.log(`Looking for checkbox ${optionId}, found:`, checkbox, 'setting checked: true');
            if (checkbox) {
                checkbox.checked = true;
            } else {
                console.warn(`Checkbox with ID ${optionId} not found`);
            }
        });
    } else if (typeof optionsData === 'object' && optionsData !== null && !Array.isArray(optionsData)) {
        // Handle object format: {"stopMachine": true, "noStopMachine": false}
        console.log('Processing machine options as object:', optionsData);
        Object.entries(optionsData).forEach(([option, isChecked]) => {
            const checkbox = document.getElementById(option);
            console.log(`Looking for checkbox ${option}, found:`, checkbox, 'setting checked:', Boolean(isChecked));
            if (checkbox) {
                checkbox.checked = Boolean(isChecked);
            } else {
                console.warn(`Checkbox with ID ${option} not found`);
            }
        });
    } else {
        console.log('Machine options data is not an array or object after processing:', optionsData);
    }
}

function populateHandleBy(handleBy) {
    // Handle handle by checkboxes
    console.log('populateHandleBy called with:', handleBy, 'type:', typeof handleBy);

    if (!handleBy) {
        console.log('Handle by data is null or undefined');
        return;
    }

    // Handle different possible data formats
    let handleData = handleBy;

    // If it's a string, try to parse it as JSON
    if (typeof handleBy === 'string') {
        try {
            handleData = JSON.parse(handleBy);
            console.log('Parsed handle by from string:', handleData);
        } catch (e) {
            console.error('Failed to parse handle by string:', e);
            return;
        }
    }

    if (Array.isArray(handleData)) {
        // Handle array format: ['MT', 'OTS', 'BT']
        console.log('Processing handle by as array:', handleData);
        handleData.forEach(option => {
            const checkbox = document.getElementById(`handle${option.toUpperCase()}`);
            console.log(`Looking for checkbox handle${option.toUpperCase()}, found:`, checkbox, 'setting checked: true');
            if (checkbox) {
                checkbox.checked = true;
            } else {
                console.warn(`Checkbox with ID handle${option.toUpperCase()} not found`);
            }
        });
    } else if (typeof handleData === 'object' && handleData !== null && !Array.isArray(handleData)) {
        // Handle object format: {"MT": true, "OTS": false, "BT": true}
        console.log('Processing handle by as object:', handleData);
        Object.entries(handleData).forEach(([option, isChecked]) => {
            const checkbox = document.getElementById(`handle${option.toUpperCase()}`);
            console.log(`Looking for checkbox handle${option.toUpperCase()}, found:`, checkbox, 'setting checked:', Boolean(isChecked));
            if (checkbox) {
                checkbox.checked = Boolean(isChecked);
            } else {
                console.warn(`Checkbox with ID handle${option.toUpperCase()} not found`);
            }
        });
    } else {
        console.log('Handle by data is not an array or object after processing:', handleData);
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

function setupFormEventListeners(userId) {
    const form = document.getElementById('maintenanceForm');
    const deleteBtn = document.querySelector('.delete-btn');

    // Delete button event listener
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async function() {
            const urlParams = new URLSearchParams(window.location.search);
            const existingId = urlParams.get('id');

            if (!existingId) {
                showMessage('No MJR record found to delete.', true);
                return;
            }

            if (window.confirm('Are you sure you want to delete this MJR record? This action cannot be undone.')) {
                try {
                    showUploadOverlay(0, null, 'deleting...');

                    const { error } = await supabase
                        .from('mt_job_requisition_master')
                        .delete()
                        .eq('id', existingId);

                    hideUploadOverlay();

                    if (error) {
                        console.error('Delete error:', error);
                        showMessage('Error deleting MJR record. Please try again.', true);
                    } else {
                        showMessage('MJR record deleted successfully!');
                        setTimeout(() => {
                            window.location.href = '../html/admin-mt.html';
                        }, 1500);
                    }
                } catch (error) {
                    hideUploadOverlay();
                    console.error('Unexpected error during deletion:', error);
                    showMessage('Error deleting MJR record. Please try again.', true);
                }
            }
        });
    }

    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        if (validateForm()) {
            showUploadOverlay(0, null, 'submitting...');
            const cancelBtn = document.getElementById('cancel-upload-btn');
            if (cancelBtn) cancelBtn.style.display = 'none';
            updateUploadProgress(0);

            // Check if we're in edit mode
            const urlParams = new URLSearchParams(window.location.search);
            const existingId = urlParams.get('id');
            const action = urlParams.get('action');

            const insertData = {
                form_type: 'action',
                reqdept: document.getElementById('reqDept').value,
                requestorname: document.getElementById('requestorName').value.trim(),
                equipmentname: document.getElementById('equipmentName').value.trim(),
                equipmentno: document.getElementById('equipmentNo').value.trim(),
                occurdate: document.getElementById('occurDate').value,
                occurtime: document.getElementById('occurTime').value,
                requisitionno: document.getElementById('requisitionNo').value.trim(),
                machineno: document.getElementById('machineNo').value.trim(),
                requirecompletiondate: document.getElementById('requireCompletionDate').value,
                completiontime: document.getElementById('completionTime').value,
                existingcondition: document.getElementById('existingCondition').value.trim(),
                correction: document.getElementById('correction').value.trim(),
                technicianname: document.getElementById('technicianName').value.trim(),
                materialretrieval: document.getElementById('materialRetrieval').value.trim(),
                cleaninginspection: document.getElementById('cleaningInspection').value.trim(),
                schedulestartdate: document.getElementById('scheduleStartDate')?.value || '',
                schedulestarttime: document.getElementById('scheduleStartTime')?.value || '',
                scheduleenddate: document.getElementById('scheduleEndDate')?.value || '',
                scheduleendtime: document.getElementById('scheduleEndTime')?.value || '',
                totalhours: (() => {
                    const timeValue = document.getElementById('totalHrs')?.value || '00:00';
                    if (!timeValue || timeValue === '00:00') return 0;
                    const [hours, minutes] = timeValue.split(':').map(Number);
                    return hours + (minutes / 60);
                })(),
                inspectionremarks: document.getElementById('inspectionRemarks')?.value?.trim() || '',
                inspectionresult: (() => {
                    const accepted = document.getElementById('inspectionAccepted');
                    const rejected = document.getElementById('inspectionRejected');
                    if (accepted?.checked) return 'Accepted';
                    if (rejected?.checked) return 'Rejected';
                    return '';
                })(),
                inspectioncheckedby: document.getElementById('inspectionCheckedBy')?.value?.trim() || '',
                cleanretrcheckedby: document.getElementById('cleanRetrCheckedBy')?.value?.trim() || '',
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

            try {
                updateUploadProgress(50);
                let result;

                if (action === 'edit' && existingId) {
                    // Update existing record
                    console.log('Updating existing MJR:', existingId);
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
                    hideUploadOverlay();
                    console.error('Submission error:', error);
                    showMessage('Error submitting form. Please try again. Details: ' + error.message, true);
                } else {
                    updateUploadProgress(100);
                    setTimeout(() => {
                        hideUploadOverlay();
                        // Ensure any blur effects are completely removed
                        setTimeout(() => {
                            // Double-check that all blur effects are removed
                            document.body.style.backdropFilter = 'none';
                            document.body.style.filter = 'none';
                            document.documentElement.style.backdropFilter = 'none';
                            document.documentElement.style.filter = 'none';

                            if (action === 'edit') {
                                showMessage('Maintenance Request updated successfully!');
                            } else {
                                showMessage('Maintenance Request submitted successfully!');
                            document.getElementById('maintenanceForm').reset();
                            }
                        }, 200);
                    }, 500);
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
        showMessage('Please fill in all required fields (Req. Dept., Requestor Name, Equipment Name, No., Date, Time, Completion Date, Completion Time, Condition).', true);
        return false;
    }

    // Validate that at least one breakdown code is selected
    const breakdownCodes = document.querySelectorAll('input[name="breakdownCode"]:checked');
    if (breakdownCodes.length === 0) {
        showMessage('Please select at least one breakdown code.', true);
        return false;
    }

    // Validate schedule if provided
    const scheduleStartDate = document.getElementById('scheduleStartDate')?.value || '';
    const scheduleStartTime = document.getElementById('scheduleStartTime')?.value || '';
    const scheduleEndDate = document.getElementById('scheduleEndDate')?.value || '';
    const scheduleEndTime = document.getElementById('scheduleEndTime')?.value || '';

    if (scheduleStartDate && scheduleStartTime && scheduleEndDate && scheduleEndTime) {
        const startDateTime = new Date(`${scheduleStartDate}T${scheduleStartTime}`);
        const endDateTime = new Date(`${scheduleEndDate}T${scheduleEndTime}`);

        if (startDateTime >= endDateTime) {
        showMessage('Schedule end time must be after start time.', true);
        return false;
        }
    }

    return true;
}

async function getNextMaintenanceId() {
    const now = new Date();
    const year = now.getFullYear() % 100;
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `MT${year}${month}`;

    const { data, error } = await supabase
        .from('mt_job_requisition_master')
        .select('id')
        .like('id', `${prefix}-%`);

    if (error) {
        console.error('Error fetching maintenance IDs:', error);
        throw error;
    }

    let maxSerial = 0;
    if (data && data.length > 0) {
        data.forEach(row => {
            const match = row.id.match(/^\w{5}-(\d{2})$/);
            if (match) {
                const serial = parseInt(match[1], 10);
                if (serial > maxSerial) maxSerial = serial;
            }
        });
    }

    // Ensure we generate a unique ID
    let nextSerial = maxSerial + 1;
    let attempts = 0;
    let newId;

    do {
        newId = `${prefix}-${String(nextSerial).padStart(2, '0')}`;
        nextSerial++;
        attempts++;

        // Prevent infinite loop
        if (attempts > 100) {
            console.error('❌ Could not generate unique ID after 100 attempts');
            // Use timestamp as fallback
            newId = `${prefix}-${Date.now().toString().slice(-2)}`;
            break;
        }
    } while (attempts <= maxSerial + 10); // Check reasonable range

    console.log('✅ Generated new ID:', newId);
    return newId;
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
