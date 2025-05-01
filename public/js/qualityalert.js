import { supabase } from '../supabase-config.js';

document.addEventListener('DOMContentLoaded', async () => {
    const userId = await getLoggedInUserId();
    if (!userId) {
        console.error("User not authenticated on Quality Alert Form.");
        // Optionally redirect to login
        window.location.href = '/';
        return; // Important to stop further execution if not authenticated
    }
    setupFormEventListeners(userId);
});

async function getLoggedInUserId() {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
}

function setupFormEventListeners(userId) {
    const form = document.getElementById('qualityAlertForm');
    const abnormalityType = document.getElementById('abnormalityType');
    const semiFinishedGoodsDetails = document.getElementById('semiFinishedGoodsDetails');
    const incidentDescriptionContainer = document.getElementById('incidentDescriptionContainer');
    const keptInViewContainer = document.getElementById('keptInViewContainer');
    const defectDescription = document.getElementById('defectDescription');
    const submissionMessage = document.querySelector('.submission-message');
    const errorDiv = document.querySelector('.submission-error');
    const saveAsDraftButton = document.getElementById('saveAsDraft');
    const chooseImageBtn = document.getElementById('chooseImageBtn');
    const imageUpload = document.getElementById('imageUpload');
    const imagePreviews = document.getElementById('imagePreviews');
    const takeImmediateAction = document.getElementById('takeImmediateAction');
    const actionFieldsContainer = document.getElementById('actionFieldsContainer');

    abnormalityType.addEventListener('change', function() {
        const isSemiFinished = this.value === 'Semi/Finished Goods';
        semiFinishedGoodsDetails.style.display = isSemiFinished ? 'block' : 'none';
        keptInViewContainer.style.display = isSemiFinished ? 'block' : 'none';
        incidentDescriptionContainer.style.display = isSemiFinished ? 'none' : 'block';
        document.getElementById('keptInView').required = isSemiFinished;
        document.getElementById('keptInView').value = ''; // Reset Kept in View
    });

    document.getElementById('keptInView').addEventListener('change', function() {
        const isYes = this.value === 'yes';
        semiFinishedGoodsDetails.style.display = isYes ? 'block' : 'none';
        incidentDescriptionContainer.style.display = isYes ? 'none' : 'block';
        defectDescription.style.height = 'auto';
        defectDescription.style.height = defectDescription.scrollHeight + 'px';

        document.getElementById('productCode').required = isYes;
        document.getElementById('rollID').required = isYes;
        document.getElementById('lotNo').required = isYes;
        document.getElementById('rollPositions').required = isYes;
        document.getElementById('lotTime').required = isYes;
        document.getElementById('defectDescription').required = isYes;
    });

    defectDescription.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    });

    chooseImageBtn.addEventListener('click', function() {
        imageUpload.click();
    });

    imageUpload.addEventListener('change', function(e) {
        const files = e.target.files;
        imagePreviews.innerHTML = '';
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = function(event) {
                const img = document.createElement('img');
                img.src = event.target.result;
                img.style.maxWidth = '200px';
                img.style.margin = '10px';
                img.style.borderRadius = '4px';
                imagePreviews.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    });

    takeImmediateAction.addEventListener('change', function() {
        actionFieldsContainer.style.display = this.value === 'yes' ? 'block' : 'none';
    });

    function showMessage(message) {
        const submissionMessage = document.querySelector('.submission-message');
        submissionMessage.textContent = message;
        submissionMessage.style.display = 'block';
        setTimeout(() => {
            submissionMessage.style.display = 'none';
        }, 3000);
    }

    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        if (validateForm()) {
            const incidentTimeValue = document.getElementById('incidentTime').value;
            const lotTimeValue = document.getElementById('lotTime').value;
            const semiFinishedGoodsVisible = document.getElementById('semiFinishedGoodsDetails').style.display === 'block';

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
                defectdescription: document.getElementById('defectDescription').value.trim(),
                productcode: document.getElementById('productCode').value.trim(),
                rollid: document.getElementById('rollID').value.trim(),
                lotno: document.getElementById('lotNo').value.trim(),
                rollpositions: document.getElementById('rollPositions').value.trim(),
                actiontaken: takeImmediateAction.value === 'yes' ? document.getElementById('actionTaken').value.trim() : null,
                whoaction: takeImmediateAction.value === 'yes' ? document.getElementById('whoAction').value.trim() : null,
                whenactiondate: takeImmediateAction.value === 'yes' ? document.getElementById('whenActionDate').value : null,
                statusaction: document.getElementById('statusAction').value,
                user_id: userId,
                timestamp: new Date().toISOString(),
                submission_status: 'submitted'
            };

            // Conditionally add lotTime if the relevant section is visible and has a value
            if (semiFinishedGoodsVisible) {
                insertData.lottime = lotTimeValue || null; // Send null if empty but visible
            } else {
                insertData.lottime = null; // Send null if not relevant
            }

            try {
                const { data, error } = await supabase
                    .from('quality_alerts')
                    .insert(insertData);

                if (error) {
                    console.error('Submission error:', error);
                    showMessage('Error submitting form. Please try again.');
                } else {
                    form.reset();
                    abnormalityType.dispatchEvent(new Event('change'));
                    document.getElementById('keptInView').dispatchEvent(new Event('change'));
                    imagePreviews.innerHTML = '';
                    showMessage('Form submitted successfully!');


                }
            } catch (error) {
                console.error('Unexpected error:', error);
                showMessage('Error submitting form. Please try again.');
            }
        } else {
            console.log("Validation failed, preventing submission.");
            // Make sure submissionError is defined or use a static message
            // showMessage(submissionError); // If submissionError is defined elsewhere
            showMessage('Validation failed. Please check the form.'); // Or use a static message
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

            const { data, error } = await supabase
                .from('quality_alert_drafts')
                .insert({
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
                    defectdescription: document.getElementById('defectDescription').value.trim(),
                    productcode: document.getElementById('productCode').value.trim(),
                    rollid: document.getElementById('rollID').value.trim(),
                    lotno: document.getElementById('lotNo').value.trim(),
                    rollpositions: document.getElementById('rollPositions').value.trim(),
                    lottime: lotTimeValue || null,
                    actiontaken: document.getElementById('actionTaken').value.trim(),
                    whoaction: document.getElementById('whoAction').value.trim(),
                    whenactiondate: whenActionDateValue || null,
                    statusaction: document.getElementById('statusAction').value,
                    timestamp: new Date().toISOString(),
                    drafted_at: new Date().toISOString() // Optional: record the draft time
                });

            if (error) {
                const message = error.message || "An error occurred. Please try again.";
                showError(message);
                showMessage('Error submitting form. Please try again.');
            } else {
                showMessage('Draft saved successfully!');
            }
        } catch (error) {
            console.error('Unexpected error:', error);
            showError("Unexpected error occurred. Please try again.");
            showMessage(submissionError);
        } finally {
            saveAsDraftButton.disabled = false;
            saveAsDraftButton.textContent = "Save as Draft";
        }
    });

    function validateForm() {
        const incidenttitle = document.getElementById('incidentTitle').value.trim();
        const responsibledept = document.getElementById('responsibleDept').value;
        const locationarea = document.getElementById('locationArea').value.trim();
        const incidentdate = document.getElementById('incidentDate').value;
        const incidenttime = document.getElementById('incidentTime').value.trim();
        const abnormalitytype = document.getElementById('abnormalityType').value;
        const qualityrisk = document.getElementById('qualityRisk').value;
        const keptinview = document.getElementById('keptInView').value;
        // incidentdesc is not strictly required for validation based on the original logic
        const defectdescription = document.getElementById('defectDescription').value.trim();
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
        if (!incidenttitle || responsibledept === 'Select Department' || !locationarea || !incidentdate || !incidenttime || abnormalitytype === '' || qualityrisk === '' || statusaction === '') {
            console.log("Validation failed: Basic required fields missing");
            showMessage('Please fill in all required basic fields (Title, Dept, Location, Date, Time, Abnormality, Risk, Status).');
            return false;
        }

        // Conditional validation for 'Semi/Finished Goods'
        if (abnormalitytype === 'Semi/Finished Goods') {
            if (keptinview === '') {
                 console.log("Validation failed: Kept in View required for Semi/Finished Goods");
                 showMessage('Please specify if the item was Kept in View.');
                 return false;
            }
            if (keptinview === 'yes') {
                // Check details only if Kept in View is 'yes'
                if (!defectdescription || !productcode || !rollid || !lotno || !rollpositions || !lottime) {
                    console.log("Validation failed: Semi/Finished Goods details missing when Kept in View is Yes");
                    showMessage('Please fill in all Semi/Finished Goods details (Defect Desc, Prod Code, Roll ID, Lot No, Roll Pos, Lot Time).');
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

        console.log("Validation successful!");
        return true;
    }
}