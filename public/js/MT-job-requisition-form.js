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
    setupFormEventListeners(userId);
});


async function getLoggedInUserId() {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
}

function setupFormEventListeners(userId) {
    const form = document.getElementById('maintenanceForm');
    console.log('🔧 Setting up form event listeners...');
    console.log('Form element found:', !!form);

    if (!form) {
        console.error('❌ Form element not found!');
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

    // Auto-calculate Total Hours when Schedule Start/End changes
    const scheduleStartDate = document.getElementById('scheduleStartDate');
    const scheduleStartTime = document.getElementById('scheduleStartTime');
    const scheduleEndDate = document.getElementById('scheduleEndDate');
    const scheduleEndTime = document.getElementById('scheduleEndTime');
    const totalHoursField = document.getElementById('totalHrs');

    function calculateTotalHours() {
        if (scheduleStartDate.value && scheduleStartTime.value && scheduleEndDate.value && scheduleEndTime.value) {
            const startDateTime = new Date(`${scheduleStartDate.value}T${scheduleStartTime.value}`);
            const endDateTime = new Date(`${scheduleEndDate.value}T${scheduleEndTime.value}`);

            if (endDateTime > startDateTime) {
                const diffMs = endDateTime - startDateTime;
                const diffMinutes = Math.floor(diffMs / (1000 * 60));
                const hours = Math.floor(diffMinutes / 60);
                const minutes = diffMinutes % 60;

                // Display as HH:MM format
                totalHoursField.value = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            } else {
                totalHoursField.value = '00:00';
            }
        } else {
            totalHoursField.value = '00:00';
        }
    }

    if (scheduleStartDate && scheduleStartTime && scheduleEndDate && scheduleEndTime && totalHoursField) {
        scheduleStartDate.addEventListener('change', calculateTotalHours);
        scheduleStartTime.addEventListener('change', calculateTotalHours);
        scheduleEndDate.addEventListener('change', calculateTotalHours);
        scheduleEndTime.addEventListener('change', calculateTotalHours);
    }

    // Simple test - add a basic click handler first
    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.addEventListener('click', function(e) {
            console.log('🖱️ Submit button clicked!');
        });
    }

    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        console.log('🚀 Form submission started');

        if (validateForm()) {
            console.log('✅ Form validation passed');
            showUploadOverlay(0, null, 'submitting...');
            const cancelBtn = document.getElementById('cancel-upload-btn');
            if (cancelBtn) cancelBtn.style.display = 'none';
            updateUploadProgress(0);
            console.log('⏳ Generating maintenance ID...');

            const id = await getNextMaintenanceId();
            console.log('✅ Generated ID:', id);

            // Build insertData object with only existing fields
            const insertData = {
                id,
                form_type: 'regular',
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
                    console.error('❌ Database error:', error);
                    console.log('🔧 Error details:', error.message);
                    console.log('💡 Possible solutions:');
                    console.log('   - Check if users table exists');
                    console.log('   - Verify user_id is valid UUID');
                    console.log('   - Check RLS policies');
                    showMessage('Error submitting form. Please try again. Details: ' + error.message, true);
                } else {
                    updateUploadProgress(100);
                    setTimeout(hideUploadOverlay, 500);
                    console.log('✅ Form submitted successfully!', data);
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

    const reqDept = document.getElementById('reqDept').value;
    const requestorName = document.getElementById('requestorName').value.trim();
    const equipmentName = document.getElementById('equipmentName').value.trim();
    const equipmentNo = document.getElementById('equipmentNo').value.trim();
    const occurDate = document.getElementById('occurDate').value;
    const occurTime = document.getElementById('occurTime').value;
    const requireCompletionDate = document.getElementById('requireCompletionDate').value;
    const completionTime = document.getElementById('completionTime').value;
    const existingCondition = document.getElementById('existingCondition').value.trim();

    console.log('Form field values:', {
        reqDept, requestorName, equipmentName, equipmentNo,
        occurDate, occurTime, requireCompletionDate, completionTime, existingCondition
    });

    // Basic required fields check
    if (!reqDept || !requestorName || !equipmentName || !equipmentNo || !occurDate || !occurTime || !requireCompletionDate || !completionTime || !existingCondition) {
        console.log('❌ Required fields missing');
        showMessage('Please fill in all required fields (Req. Dept., Requestor Name, Equipment Name, No., Date, Time, Completion Date, Completion Time, Condition).', true);
        return false;
    }

    // Validate that at least one breakdown code is selected
    const breakdownCodes = document.querySelectorAll('input[name="breakdownCode"]:checked');
    console.log('Breakdown codes selected:', breakdownCodes.length);
    if (breakdownCodes.length === 0) {
        console.log('❌ No breakdown codes selected');
        showMessage('Please select at least one breakdown code.', true);
        return false;
    }

    // Validate Accepted/Rejected checkbox (only if they exist in this form)
    const acceptedCheckbox = document.getElementById('inspectionAccepted');
    const rejectedCheckbox = document.getElementById('inspectionRejected');

    if (acceptedCheckbox && rejectedCheckbox) {
        console.log('Inspection checkboxes:', { accepted: acceptedCheckbox.checked, rejected: rejectedCheckbox.checked });
        if (!acceptedCheckbox.checked && !rejectedCheckbox.checked) {
            console.log('❌ No inspection result selected');
            showMessage('Please select either Accepted or Rejected for the inspection.', true);
            return false;
        }
    } else {
        console.log('ℹ️ Inspection checkboxes not found in this form (regular form)');
    }

    console.log('✅ All validation passed');
    return true;
}

async function getNextMaintenanceId() {
    console.log('🔍 Checking existing maintenance IDs...');
    const now = new Date();
    const year = now.getFullYear() % 100;
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `MT${year}${month}`;

    try {
        const { data, error } = await supabase
            .from('mt_job_requisition_master')
            .select('id')
            .like('id', `${prefix}-%`);

        if (error) {
            console.error('❌ Error fetching maintenance IDs:', error);
            console.log('🔧 This might be due to:');
            console.log('   - Table doesn\'t exist');
            console.log('   - RLS policies blocking access');
            console.log('   - Foreign key constraint issues');
            throw error;
        }

        console.log('✅ Found existing IDs:', data?.length || 0);

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
    } catch (error) {
        console.error('💥 Error in getNextMaintenanceId:', error);
        // Fallback: generate ID without checking database
        const nextSerial = String(Math.floor(Math.random() * 99) + 1).padStart(2, '0');
        const fallbackId = `${prefix}-${nextSerial}`;
        console.log('🔄 Using fallback ID:', fallbackId);
        return fallbackId;
    }
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
