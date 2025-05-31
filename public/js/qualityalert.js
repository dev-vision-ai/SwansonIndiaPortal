import { supabase } from '../supabase-config.js';

function showMessage(message) {
    const submissionMessage = document.querySelector('.submission-message');
    if (submissionMessage) {
        submissionMessage.textContent = message;
        submissionMessage.style.display = 'block';
        setTimeout(() => {
            submissionMessage.style.display = 'none';
        }, 3000);
    } else {
        console.warn('Submission message element not found.');
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
            showMessage('Error loading draft for editing.');
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
            showMessage('Unexpected error loading draft. Please try again.');
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
    const takeImmediateAction = document.getElementById('takeImmediateAction');
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

    imageUpload.addEventListener('change', async function(e) {
        const files = e.target.files;
        imagePreviews.innerHTML = '';
        compressedFiles = []; // Clear previous files

        for (const file of Array.from(files)) {
            try {
                const options = {
                    maxSizeMB: 1, // (max file size in MB)
                    maxWidthOrHeight: 1920, // max width or height in pixels
                    useWebWorker: true,
                    fileType: 'image/jpeg' // Ensure output is JPEG
                };
                const compressedFile = await imageCompression(file, options);
                compressedFiles.push(compressedFile);

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
                console.error('Image compression error:', error);
                showMessage(`Error compressing image ${file.name}.`);
            }
        }
    });

    takeImmediateAction.addEventListener('change', function() {
        const actionTakenIsYes = this.value === 'yes';
        actionFieldsContainer.style.display = actionTakenIsYes ? 'block' : 'none';

        // --- ADDED: Reset status dropdown if action is 'No' --- 
        const statusActionSelect = document.getElementById('statusAction');
        if (!actionTakenIsYes) {
            statusActionSelect.value = ''; // Reset to default/empty value
            // Optionally clear other action fields too
            // document.getElementById('actionTaken').value = '';
            // document.getElementById('whoAction').value = '';
            // document.getElementById('whenActionDate').value = '';
        }
        // --- End of addition ---
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
            const incidentTimeValue = document.getElementById('incidentTime').value;
            const lotTimeValue = document.getElementById('lotTime').value;
            // Check if product details are relevant (Semi/Finished and Kept in View = Yes)
            const isProductDetailsRelevant = document.getElementById('abnormalityType').value === 'Semi/Finished Goods' && 
                                           document.getElementById('keptInView').value === 'yes';

            const insertData = {
                incidenttitle: document.getElementById('incidentTitle').value.trim(),
                responsibledept: document.getElementById('responsibleDept').value,
                locationarea: document.getElementById('locationArea').value.trim(),
                incidentdate: document.getElementById('incidentDate').value,
                incidenttime: incidentTimeValue,
                abnormalitytype: document.getElementById('abnormalityType').value,
                qualityrisk: document.getElementById('qualityRisk').value,
                keptinview: document.getElementById('keptInView').value,
                incidentdesc: document.getElementById('incidentDesc').value.trim(),
                // --- ADDED shift --- 
                shift: isProductDetailsRelevant ? document.getElementById('shift').value : null,
                productcode: isProductDetailsRelevant ? document.getElementById('productCode').value.trim() : null,
                rollid: isProductDetailsRelevant ? document.getElementById('rollID').value.trim() : null,
                lotno: isProductDetailsRelevant ? document.getElementById('lotNo').value.trim() : null,
                rollpositions: isProductDetailsRelevant ? document.getElementById('rollPositions').value.trim() : null,
                lottime: isProductDetailsRelevant ? (lotTimeValue || null) : null, // Send null if empty or not relevant
                actiontaken: takeImmediateAction.value === 'yes' ? document.getElementById('actionTaken').value.trim() : null,
                whoaction: takeImmediateAction.value === 'yes' ? document.getElementById('whoAction').value.trim() : null,
                whenactiondate: takeImmediateAction.value === 'yes' ? document.getElementById('whenActionDate').value : null,
                statusaction: document.getElementById('statusAction').value,
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

                    const { data, error } = await supabase
                        .from('quality_alerts')
                        .insert([{ ...insertData, image_urls: imageUrls }]); // Pass data as an array

                    if (error) {
                        console.error('Submission error:', error);
                        showMessage('Error submitting form. Please try again. Details: ' + error.message);
                    } else {
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
                                showMessage('Quality Alert submitted, but failed to delete draft.');
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
                console.error('Unexpected error:', error);
                showMessage('Error submitting form. Please try again.');
            }
        } else {
            console.log("Validation failed, preventing submission.");
            // showMessage is called within validateForm now
        }
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
                    // --- REMOVED: defectdescription --- 
                    productcode: isProductDetailsRelevant ? document.getElementById('productCode').value.trim() : null,
                    shift: isProductDetailsRelevant ? document.getElementById('shift').value.trim() : null,
                    rollid: isProductDetailsRelevant ? document.getElementById('rollID').value.trim() : null,
                    lotno: isProductDetailsRelevant ? document.getElementById('lotNo').value.trim() : null,
                    rollpositions: isProductDetailsRelevant ? document.getElementById('rollPositions').value.trim() : null,
                    lottime: isProductDetailsRelevant ? (lotTimeValue || null) : null,
                    actiontaken: document.getElementById('actionTaken').value.trim(),
                    whoaction: document.getElementById('whoAction').value.trim(),
                    whenactiondate: whenActionDateValue || null,
                    statusaction: document.getElementById('statusAction').value,
                    timestamp: new Date().toISOString(),
                    drafted_at: new Date().toISOString() // Optional: record the draft time
                }]);

            if (error) {
                const message = error.message || "An error occurred. Please try again.";
                // showError(message); // Assuming showError exists or use showMessage
                showMessage('Error saving draft: ' + message);
            } else {
                showMessage('Draft saved successfully!');
            }
        } catch (error) {
            console.error('Unexpected error saving draft:', error);
            // showError("Unexpected error occurred. Please try again.");
            showMessage('Unexpected error saving draft. Please try again.');
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
                showMessage(`Error uploading ${file.name}: ${error.message}`);
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
        const takeImmediateActionValue = document.getElementById('takeImmediateAction').value;

        // Basic required fields check
        if (!incidenttitle || responsibledept === 'Select Department' || !locationarea || !incidentdate || !incidenttime || abnormalitytype === '' || qualityrisk === '') {
            console.log("Validation failed: Basic required fields missing");
            showMessage('Please fill in all required basic fields (Title, Dept, Location, Date, Time, Abnormality, Risk).');
            return false;
        }

        // Check statusaction only if immediate action was taken
        if (takeImmediateActionValue === 'yes' && statusaction === '') {
            console.log("Validation failed: Immediate Action Status missing");
            showMessage('Please select the Immediate Action Status.');
            return false;
        }

        // Conditional validation for 'Semi/Finished Goods'
        if (abnormalitytype === 'Semi/Finished Goods') {
            if (keptinview === '') {
                 console.log("Validation failed: Kept in View required for Semi/Finished Goods");
                 showMessage('Please specify if the item was Kept in View.');
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
                    showMessage('Please fill in all Product details (Shift, Prod Code, Roll ID, Lot No, Roll Pos, Lot Time).');
                    return false;
                }
            }
        }

        // Conditional validation for 'Immediate Action' fields
        if (takeImmediateActionValue === 'yes') {
            if (!actiontaken || !whoaction || !whenactiondate) {
                console.log("Validation failed: Immediate Action details missing");
                showMessage('Please fill in all Immediate Action details (Action Taken, Who, When).');
                return false;
            }
        }

        // Validation for Incident Description (Now always potentially visible, make it required?)
        // DECISION: Is Incident Description always required, or only required if not Semi/Finished?
        // For now, let's make it required unless it's Semi/Finished AND Kept in View is No
        const isSemiFinishedNoView = abnormalitytype === 'Semi/Finished Goods' && keptinview === 'no';
        if (!incidentdesc && !isSemiFinishedNoView) { // Require description unless it's Semi/Finished and not kept
             console.log("Validation failed: Incident Description required.");
             showMessage('Please provide an Incident Description.');
             return false;
        }


        console.log("Validation successful!");
        return true;
    }
}