import { supabase } from '../supabase-config.js';

// Auto-expand incident name field
function autoExpandTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

// Initialize auto-expand for incident name field
document.addEventListener('DOMContentLoaded', function() {
    const incidentTitle = document.getElementById('incidentTitle');
    if (incidentTitle) {
        incidentTitle.addEventListener('input', function() {
            autoExpandTextarea(this);
        });
        // Set initial height
        autoExpandTextarea(incidentTitle);
    }
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
        console.error("User not authenticated on Quality Alert Form.");
        // Optionally redirect to login
        window.location.href = '/';
        return; // Important to stop further execution if not authenticated
    }
    setupFormEventListeners(userId);

    // Check if we are editing a draft
    const urlParams = new URLSearchParams(window.location.search);
    const draftId = urlParams.get('id');
    const action = urlParams.get('action');

    if (draftId && action === 'edit') {
        await loadDraftForEditing(draftId);
    }
});

async function loadDraftForEditing(draftId) {
    try {
        const { data, error } = await supabase
            .from('quality_alert_drafts')
            .select('*')
            .eq('id', draftId)
            .single();

        if (error) {
            console.error('Error fetching draft:', error);
            showMessage('Error loading draft for editing.', true);
            return;
        }

        if (data) {
            // Populate form fields
            const incidentTitle = document.getElementById('incidentTitle');
            if (incidentTitle) incidentTitle.value = data.incidenttitle || '';
            const responsibleDept = document.getElementById('responsibleDept');
            if (responsibleDept) responsibleDept.value = data.responsibledept || '';
            const locationArea = document.getElementById('locationArea');
            if (locationArea) locationArea.value = data.locationarea || '';
            const incidentDate = document.getElementById('incidentDate');
            if (incidentDate) incidentDate.value = data.incidentdate || '';
            const incidentTime = document.getElementById('incidentTime');
            if (incidentTime) incidentTime.value = data.incidenttime || '';
            const abnormalityType = document.getElementById('abnormalityType');
            if (abnormalityType) abnormalityType.value = data.abnormalitytype || '';
            const qualityRisk = document.getElementById('qualityRisk');
            if (qualityRisk) qualityRisk.value = data.qualityrisk || '';
            const keptInView = document.getElementById('keptInView');
            if (keptInView) keptInView.value = data.keptinview || '';
            const incidentDesc = document.getElementById('incidentDesc');
            if (incidentDesc) incidentDesc.value = data.incidentdesc || '';

            // Trigger change events for conditional display logic
            if (abnormalityType) abnormalityType.dispatchEvent(new Event('change'));
            if (keptInView) keptInView.dispatchEvent(new Event('change'));

            // Populate product details if relevant
            if (data.abnormalitytype === 'Semi/Finished Goods' && data.keptinview === 'yes') {
                const shift = document.getElementById('shift');
                if (shift) shift.value = data.shift || '';
                const productCode = document.getElementById('productCode');
                if (productCode) productCode.value = data.productcode || '';
                const rollID = document.getElementById('rollID');
                if (rollID) rollID.value = data.rollid || '';
                const lotNo = document.getElementById('lotNo');
                if (lotNo) lotNo.value = data.lotno || '';
                const rollPositions = document.getElementById('rollPositions');
                if (rollPositions) rollPositions.value = data.rollpositions || '';
                const lotTime = document.getElementById('lotTime'); // Corrected ID to 'lotTime'
                if (lotTime) lotTime.value = data.lottime || '';
            }

            // Populate action taken fields if relevant
            const takeImmediateAction = document.getElementById('takeImmediateAction');
            if (data.actiontaken) {
                if (takeImmediateAction) takeImmediateAction.value = 'yes';
                if (takeImmediateAction) takeImmediateAction.dispatchEvent(new Event('change'));
                const actionTaken = document.getElementById('actionTaken');
                if (actionTaken) actionTaken.value = data.actiontaken || '';
                const whoAction = document.getElementById('whoAction');
                if (whoAction) whoAction.value = data.whoaction || '';
                const whenActionDate = document.getElementById('whenActionDate');
                if (whenActionDate) whenActionDate.value = data.whenactiondate || '';
                const statusAction = document.getElementById('statusAction');
                if (statusAction) statusAction.value = data.statusaction || '';
            } else {
                if (takeImmediateAction) takeImmediateAction.value = 'no';
                if (takeImmediateAction) takeImmediateAction.dispatchEvent(new Event('change'));
            }

            if (typeof showMessage === 'function') {
                showMessage('Draft loaded successfully for editing.');
            } else {
                console.warn('showMessage function is not defined.');
            }
        }
    } catch (error) {
        console.error('Unexpected error loading draft:', error);
        if (typeof showMessage === 'function') {
            showMessage('Unexpected error loading draft. Please try again.', true);
        } else {
            console.warn('showMessage function is not defined, cannot display error message.');
        }

    }
}

async function getLoggedInUserId() {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
}

function setupFormEventListeners(userId) {
    const form = document.getElementById('qualityAlertForm');
    const abnormalityType = document.getElementById('abnormalityType');
    // --- REMOVED: semiFinishedGoodsDetails --- 
    const incidentDescriptionContainer = document.getElementById('incidentDescriptionContainer'); // Keep this
    const keptInViewContainer = document.getElementById('keptInViewContainer');
    const productDetailsContainer = document.getElementById('productDetailsContainer'); // <<< ADDED: Get the new container
    // --- REMOVED: defectDescription --- 
    const submissionMessage = document.querySelector('.submission-message');
    const errorDiv = document.querySelector('.submission-error');
    const saveAsDraftButton = document.getElementById('saveAsDraft');
    const chooseImageBtn = document.getElementById('chooseImageBtn');
    const imageUpload = document.getElementById('imageUpload');
    const imagePreviews = document.getElementById('imagePreviews');
    const actionFieldsContainer = document.getElementById('actionFieldsContainer');

    // Get the labels and input fields for scrolling
    const incidentDateLabel = document.querySelector('label[for="incidentDate"]');
    const incidentTimeLabel = document.querySelector('label[for="incidentTime"]');
    const incidentDateInput = document.getElementById('incidentDate');
    const incidentTimeInput = document.getElementById('incidentTime');

    abnormalityType.addEventListener('change', function() {
        const isSemiFinished = this.value === 'Semi/Finished Goods';
        // --- REMOVED: semiFinishedGoodsDetails.style.display --- 
        keptInViewContainer.style.display = isSemiFinished ? 'block' : 'none';
        // --- REMOVED: incidentDescriptionContainer.style.display --- (Keep it visible)
        productDetailsContainer.style.display = 'none'; // <<< Hide product details initially when type changes

        // Reset and manage required status for keptInView
        const keptInViewSelect = document.getElementById('keptInView');
        keptInViewSelect.required = isSemiFinished;
        if (!isSemiFinished) {
            keptInViewSelect.value = ''; // Reset if not Semi/Finished
            // Ensure product details fields are not required if not Semi/Finished
            setProductDetailsRequired(false);
        } else {
            // Trigger change on keptInView if it already has a value (e.g., draft load)
            if (keptInViewSelect.value) {
                keptInViewSelect.dispatchEvent(new Event('change'));
            }
        }
    });

    document.getElementById('keptInView').addEventListener('change', function() {
        const isYes = this.value === 'yes';
        // --- REMOVED: semiFinishedGoodsDetails.style.display --- 
        // --- REMOVED: incidentDescriptionContainer.style.display --- (Keep it visible)
        productDetailsContainer.style.display = isYes ? 'block' : 'none'; // <<< Show/hide product details
        // --- REMOVED: defectDescription height adjustments --- 

        // Set required status for product detail fields based on 'keptInView' being 'yes'
        setProductDetailsRequired(isYes);
    });

    // Helper function to set required attribute for product details
    // Helper function to set required attribute for product details
    function setProductDetailsRequired(isRequired) {
        // --- ADDED shift --- 
        document.getElementById('shift').required = isRequired;
        document.getElementById('productCode').required = isRequired;
        document.getElementById('rollID').required = isRequired;
        document.getElementById('lotNo').required = isRequired;
        document.getElementById('rollPositions').required = isRequired;
        document.getElementById('lotTime').required = isRequired;
        // --- REMOVED: defectDescription.required --- 
    }

    // --- REMOVED: defectDescription input listener --- 

    chooseImageBtn.addEventListener('click', function() {
        imageUpload.click();
    });

    let compressedFiles = []; // Store compressed files globally or pass them

    // --- Spinner Overlay HTML Injection ---
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
        // Prevent scrolling/interactions
        document.body.style.overflow = 'hidden';
        // Cancel button
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

    // --- CSS for Spinner Overlay ---
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
@media (max-width: 600px) {
  .spinner-content {
    padding: 18px 16px 14px 16px;
    min-width: 180px;
    max-width: 90vw;
  }
  .progress-text {
    font-size: 1rem;
  }
  .spinner {
    width: 32px;
    height: 32px;
    border-width: 4px;
  }
  .cancel-upload-btn {
    width: 32px;
    height: 32px;
    font-size: 1.5rem;
  }
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

    // --- Update image upload logic ---
    let currentUploadXHR = null;
    imageUpload.addEventListener('change', async function(e) {
        const files = e.target.files;
        imagePreviews.innerHTML = '';
        compressedFiles = [];

        for (const file of Array.from(files)) {
            try {
                const options = {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 1920,
                    useWebWorker: true,
                    fileType: 'image/jpeg'
                };
                const compressedFile = await imageCompression(file, options);
                compressedFiles.push(compressedFile);

                // Only preview the image, do not upload here
                const reader = new FileReader();
                reader.onload = function(event) {
                    const img = document.createElement('img');
                    img.src = event.target.result;
                    img.style.maxWidth = '200px';
                    img.style.margin = '10px';
                    img.style.borderRadius = '4px';
                    imagePreviews.appendChild(img);
                };
                reader.readAsDataURL(compressedFile);
            } catch (error) {
                showMessage(`Error compressing image: ${file.name}`, true);
            }
        }
    });

    // Add smooth scroll listeners
    if (incidentDateLabel && incidentDateInput) {
        incidentDateLabel.addEventListener('click', () => {
            incidentDateInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Optional: focus the input after scrolling
            // setTimeout(() => incidentDateInput.focus(), 300); 
        });
    }

    if (incidentTimeLabel && incidentTimeInput) {
        incidentTimeLabel.addEventListener('click', () => {
            // Change block from 'center' to 'start'
            incidentTimeInput.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Optional: focus the input after scrolling
            // setTimeout(() => incidentTimeInput.focus(), 300); 
        });
    }



    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        if (validateForm()) {
            // Show overlay (no cancel button during submit for safety)
            showUploadOverlay(0, null, 'submitting...');
            const cancelBtn = document.getElementById('cancel-upload-btn');
            if (cancelBtn) cancelBtn.style.display = 'none';
            updateUploadProgress(0);

            const incidentTimeValue = document.getElementById('incidentTime').value;
            const lotTimeValue = document.getElementById('lotTime').value;
            // Check if product details are relevant (Semi/Finished and Kept in View = Yes)
            const isProductDetailsRelevant = document.getElementById('abnormalityType').value === 'Semi/Finished Goods' && 
                                           document.getElementById('keptInView').value === 'yes';

            // --- Generate new string ID ---
            const id = await getNextAlertId();

            const insertData = {
                id, // Use the generated string ID
                incidenttitle: document.getElementById('incidentTitle').value.trim(),
                responsibledept: document.getElementById('responsibleDept').value,
                locationarea: document.getElementById('locationArea').value.trim(),
                incidentdate: document.getElementById('incidentDate').value,
                incidenttime: incidentTimeValue,
                abnormalitytype: document.getElementById('abnormalityType').value,
                qualityrisk: document.getElementById('qualityRisk').value,
                keptinview: document.getElementById('keptInView').value,
                incidentdesc: document.getElementById('incidentDesc').value.trim(),
                shift: isProductDetailsRelevant ? document.getElementById('shift').value : null,
                productcode: isProductDetailsRelevant ? document.getElementById('productCode').value.trim() : null,
                rollid: isProductDetailsRelevant ? document.getElementById('rollID').value.trim() : null,
                lotno: isProductDetailsRelevant ? document.getElementById('lotNo').value.trim() : null,
                rollpositions: isProductDetailsRelevant ? document.getElementById('rollPositions').value.trim() : null,
                lottime: isProductDetailsRelevant ? (lotTimeValue || null) : null,
                actiontaken: document.getElementById('actionTaken').value.trim() || null,
                whoaction: document.getElementById('whoAction').value.trim() || null,
                whenactiondate: document.getElementById('whenActionDate').value.trim() || null,
                statusaction: document.getElementById('statusAction').value.trim() || null,
                user_id: userId,
                timestamp: new Date().toISOString(),
                submission_status: 'submitted'
                };

                // --- REMOVED: Conditional logic for lotTime based on semiFinishedGoodsVisible --- 

                try {
                    let imageUrls = [];
                    if (compressedFiles.length > 0) {
                        imageUrls = await uploadImagesToSupabase(compressedFiles);
                    }

                    // Simulate progress (since insert is atomic)
                    updateUploadProgress(50);
                    const { data, error } = await supabase
                        .from('quality_alerts')
                        .insert([{ ...insertData, image_urls: imageUrls }]); // Pass data as an array

                    if (error) {
                        hideUploadOverlay();
                        console.error('Submission error:', error);
                        showMessage('Error submitting form. Please try again. Details: ' + error.message, true);
                    } else {
                        updateUploadProgress(100);
                        setTimeout(hideUploadOverlay, 500);
                        showMessage('Quality Alert submitted successfully!');

                        // Check if this was an edited draft and delete it
                        const urlParams = new URLSearchParams(window.location.search);
                        const draftId = urlParams.get('id');
                        const action = urlParams.get('action');

                        if (draftId && action === 'edit') {
                            const { error: deleteError } = await supabase
                                .from('quality_alert_drafts')
                                .delete()
                                .eq('id', draftId);

                            if (deleteError) {
                                console.error('Error deleting draft:', deleteError);
                            showMessage('Quality Alert submitted, but failed to delete draft.', true);
                            } else {
                                console.log('Draft deleted successfully.');
                            }
                        }

                        // Optionally, redirect or clear form
                        document.getElementById('qualityAlertForm').reset();
                        // Clear image previews
                        document.getElementById('imagePreviews').innerHTML = '';
        // Declare uploadedImageUrls here if it's meant to be reset or used within this scope
        // If it's used elsewhere, it should be declared in a higher scope.
        // For now, assuming it's meant to be reset here.
        let uploadedImageUrls = [];
                    }

            } catch (error) {
                hideUploadOverlay();
                console.error('Unexpected error:', error);
                showMessage('Error submitting form. Please try again.', true);
            }
        } else {
            console.log("Validation failed, preventing submission.");
            // showMessage is called within validateForm now
        }
        hideUploadOverlay();
    });

    saveAsDraftButton.addEventListener('click', async function(event) {
        event.preventDefault();

        saveAsDraftButton.disabled = true;
        saveAsDraftButton.textContent = "Saving...";

        try {
            const incidentDateValue = document.getElementById('incidentDate').value;
            const incidentTimeValue = document.getElementById('incidentTime').value;
            const whenActionDateValue = document.getElementById('whenActionDate').value;
            const lotTimeValue = document.getElementById('lotTime').value;
            const isProductDetailsRelevant = document.getElementById('abnormalityType').value === 'Semi/Finished Goods' && 
                                           document.getElementById('keptInView').value === 'yes';

            const { data, error } = await supabase
                .from('quality_alert_drafts')
                .insert([{
                    user_id: userId,
                    incidenttitle: document.getElementById('incidentTitle').value.trim(),
                    responsibledept: document.getElementById('responsibleDept').value,
                    locationarea: document.getElementById('locationArea').value.trim(),
                    incidentdate: incidentDateValue || null,
                    incidenttime: incidentTimeValue || null,
                    abnormalitytype: document.getElementById('abnormalityType').value,
                    qualityrisk: document.getElementById('qualityRisk').value,
                    keptinview: document.getElementById('keptInView').value,
                    incidentdesc: document.getElementById('incidentDesc').value.trim(),
                    productcode: isProductDetailsRelevant ? document.getElementById('productCode').value.trim() : null,
                    shift: isProductDetailsRelevant ? document.getElementById('shift').value.trim() : null,
                    rollid: isProductDetailsRelevant ? document.getElementById('rollID').value.trim() : null,
                    lotno: isProductDetailsRelevant ? document.getElementById('lotNo').value.trim() : null,
                    rollpositions: isProductDetailsRelevant ? document.getElementById('rollPositions').value.trim() : null,
                    lottime: isProductDetailsRelevant ? (lotTimeValue || null) : null,
                    actiontaken: document.getElementById('actionTaken').value.trim() || null,
                    whoaction: document.getElementById('whoAction').value.trim() || null,
                    whenactiondate: whenActionDateValue || null,
                    statusaction: document.getElementById('statusAction').value.trim() || null,
                    timestamp: new Date().toISOString(),
                    drafted_at: new Date().toISOString() // Optional: record the draft time
                }]);

            if (error) {
                const message = error.message || "An error occurred. Please try again.";
                // showError(message); // Assuming showError exists or use showMessage
                showMessage('Error saving draft: ' + message, true);
            } else {
                showMessage('Draft saved successfully!');
            }
        } catch (error) {
            console.error('Unexpected error saving draft:', error);
            // showError("Unexpected error occurred. Please try again.");
            showMessage('Unexpected error saving draft. Please try again.', true);
        } finally {
            saveAsDraftButton.disabled = false;
            saveAsDraftButton.textContent = "Save as Draft";
        }
    });

    async function uploadImagesToSupabase(files) {
        const imageUrls = [];
        for (const file of files) {
            const { data, error } = await supabase.storage
                .from('quality-alert-images') // Your Supabase bucket name
                .upload(`${Date.now()}_${file.name}`, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                console.error('Error uploading image:', error);
                showMessage(`Error uploading ${file.name}: ${error.message}`, true);
            } else {
                // Get public URL
                const { data: publicUrlData } = supabase.storage
                    .from('quality-alert-images')
                    .getPublicUrl(data.path);
                imageUrls.push(publicUrlData.publicUrl);
            }
        }
        return imageUrls;
    }

    function validateForm() {
        const incidenttitle = document.getElementById('incidentTitle').value.trim();
        const responsibledept = document.getElementById('responsibleDept').value;
        const locationarea = document.getElementById('locationArea').value.trim();
        const incidentdate = document.getElementById('incidentDate').value;
        const incidenttime = document.getElementById('incidentTime').value;
        const abnormalitytype = document.getElementById('abnormalityType').value;
        const qualityrisk = document.getElementById('qualityRisk').value;
        const keptinview = document.getElementById('keptInView').value;
        const incidentdesc = document.getElementById('incidentDesc').value.trim(); // Keep incidentDesc
        // --- REMOVED: defectdescription --- 
        const productcode = document.getElementById('productCode').value.trim();
        const rollid = document.getElementById('rollID').value.trim();
        const lotno = document.getElementById('lotNo').value.trim();
        const rollpositions = document.getElementById('rollPositions').value.trim();
        const lottime = document.getElementById('lotTime').value.trim();
        const actiontaken = document.getElementById('actionTaken').value.trim();
        const whoaction = document.getElementById('whoAction').value.trim();
        const whenactiondate = document.getElementById('whenActionDate').value;
        const statusaction = document.getElementById('statusAction').value;

        // Basic required fields check
        if (!incidenttitle || responsibledept === 'Select Department' || !locationarea || !incidentdate || !incidenttime || abnormalitytype === '' || qualityrisk === '') {
            console.log("Validation failed: Basic required fields missing");
            showMessage('Please fill in all required basic fields (Title, Dept, Location, Date, Time, Abnormality, Risk).', true);
            return false;
        }

        // Conditional validation for 'Semi/Finished Goods'
        if (abnormalitytype === 'Semi/Finished Goods') {
            if (keptinview === '') {
                 console.log("Validation failed: Kept in View required for Semi/Finished Goods");
                 showMessage('Please specify if the item was Kept in View.', true);
                 return false;
            }
            const shift = document.getElementById('shift').value; // <<< Get shift value
            if (keptinview === 'yes') {
                // Check product details only if Kept in View is 'yes'
                // --- REMOVED: defectdescription check --- 
                // --- MODIFIED check to include shift --- 
                if (!shift || !productcode || !rollid || !lotno || !rollpositions || !lottime) { 
                    console.log("Validation failed: Product details missing when Kept in View is Yes");
                    // --- UPDATED message --- 
                    showMessage('Please fill in all Product details (Shift, Prod Code, Roll ID, Lot No, Roll Pos, Lot Time).', true);
                    return false;
                }
            }
        }

        // Validation for Incident Description (Now always potentially visible, make it required?)
        // DECISION: Is Incident Description always required, or only required if not Semi/Finished?
        // For now, let's make it required unless it's Semi/Finished AND Kept in View is No
        const isSemiFinishedNoView = abnormalitytype === 'Semi/Finished Goods' && keptinview === 'no';
        if (!incidentdesc && !isSemiFinishedNoView) { // Require description unless it's Semi/Finished and not kept
             console.log("Validation failed: Incident Description required.");
             showMessage('Please provide an Incident Description.', true);
             return false;
        }


        console.log("Validation successful!");
        return true;
    }

    // --- Add getNextAlertId function ---
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
}