import { supabase } from '../../supabase-config.js';

/**
 * Calculates the average of modulus readings for a specific row.
 * This is used because Modulus is tested in triplicate (cols 7, 8, 9) 
 * but reported as a single average value in column 10 to meet specification.
 * @param {HTMLInputElement} input - The input element that triggered the calculation.
 */
function calculateModulusAverage(input) {
    const row = input.closest('tr');
    if (!row) return;

    const inputs = row.querySelectorAll('input');
    if (inputs.length < 11) return;

    const v1 = parseFloat(inputs[7].value) || 0;
    const v2 = parseFloat(inputs[8].value) || 0;
    const v3 = parseFloat(inputs[9].value) || 0;

    let count = 0, sum = 0;
    if (inputs[7].value.trim() !== '') { sum += v1; count++; }
    if (inputs[8].value.trim() !== '') { sum += v2; count++; }
    if (inputs[9].value.trim() !== '') { sum += v3; count++; }

    if (count > 0) {
        inputs[10].value = (sum / count).toFixed(1);
        setTimeout(() => {
            const tb = row.closest('tbody');
            if (tb && tb.id === 'testingTableBody') calculateColumnStats(tb, 10);
        }, 10);
    } else {
        inputs[10].value = '';
    }
}


/**
 * Patches Number.prototype.toFixed to provide stable, expected rounding across all browsers.
 * Standard toFixed() uses "round half to even" or suffers from floating point precision issues
 * (e.g., 1.005.toFixed(2) might return "1.00" instead of "1.01"). This patch ensures 
 * business-standard rounding for quality control metrics.
 */
(function patchToFixedRounding() {
    const currentToFixed = Number.prototype.toFixed;
    if (currentToFixed && currentToFixed.__swansonPatched) return;

    const originalToFixed = Number.prototype.toFixed;
    function patchedToFixed(digits) {
        const num = Number(this.valueOf());
        if (!Number.isFinite(num)) return originalToFixed.call(this, digits);

        const d = Number(digits);
        if (!Number.isFinite(d)) return originalToFixed.call(this, digits);

        const factor = 10 ** d;
        const fudge = 1e-12 * Math.sign(num || 1);
        const rounded = Math.round((num + fudge) * factor) / factor;
        return originalToFixed.call(rounded, digits);
    }
    patchedToFixed.__swansonPatched = true;
    patchedToFixed.__swansonOriginal = originalToFixed;
    Number.prototype.toFixed = patchedToFixed;
})();

// ===== VERIFICATION & APPROVAL FUNCTIONALITY =====
// NOTE: Consolidated event listeners - initializeVerification() and initializeApproval() set up all handlers
const VERIFICATION_PASSWORD = "QC-2256"; // Verification password for form verification
const APPROVAL_PASSWORD = "QA-2256"; // Approval password for form approval

// ===== CENTRALIZED CONFIGURATION =====
const PARAMETER_LIMITS = {
    'basicWeight': { min: 15.70, max: 20.30 },
    'cofRR': { min: 0.30, max: 0.50 },
    'cofRS': { min: 0.10, max: 0.35 },
    'opacity': { min: 57.0, max: 63.0 },
    'modulus': { min: 18.2, max: 31.2 },
    'gloss': { min: 7.0, max: 10.0 },
    'forceElongationMD': { min: 1.77, max: null },
    'forceTensileMD': { min: 9.07, max: null },
    'forceElongationCD': { min: 1.49, max: null },
    'forceTensileCD': { min: 6.13, max: null },
    'colourL': { min: 91.5, max: 99.5 },
    'colourA': { min: -4.4, max: 3.6 },
    'colourB': { min: -4.5, max: 3.5 },
    'deltaE': { min: null, max: 5.00 }
};

const COLUMN_CONFIG = {
    'testingTableBody': {
        0: { type: 'lotRoll' },
        1: { type: 'rollID' },
        2: { type: 'lotTime' },
        3: { format: 'twoDigitTwoDecimal', oos: 'basicWeight', stats: { summaryIndex: 1, decimals: 2 } },
        4: { format: 'cof', oos: 'cofRR', stats: { summaryIndex: 2, decimals: 2 } },
        5: { format: 'cof', oos: 'cofRS', stats: { summaryIndex: 3, decimals: 2 } },
        6: { format: 'twoDigitOneDecimal', oos: 'opacity', stats: { summaryIndex: 4, decimals: 1 } },
        7: { format: 'twoDigitOneDecimal', oos: 'modulus', isModulus: true },
        8: { format: 'twoDigitOneDecimal', oos: 'modulus', isModulus: true },
        9: { format: 'twoDigitOneDecimal', oos: 'modulus', isModulus: true },
        10: { type: 'readonly', isModulusAvg: true, stats: { summaryIndex: 6, decimals: 1 } },
        11: { format: 'flexibleOneDecimal', oos: 'gloss', stats: { summaryIndex: 7, decimals: 1 } }
    },
    'testingTableBody2': {
        0: { type: 'readonly' },
        1: { type: 'readonly' },
        2: { type: 'readonly' },
        3: { format: 'oneDigitTwoDecimal', oos: 'forceElongationMD', stats: { summaryIndex: 1, decimals: 2 } },
        4: { format: 'flexibleTwoDecimal', oos: 'forceTensileMD', stats: { summaryIndex: 2, decimals: 2 } },
        5: { format: 'oneDigitTwoDecimal', oos: 'forceElongationCD', stats: { summaryIndex: 3, decimals: 2 } },
        6: { format: 'twoDigitTwoDecimal', oos: 'forceTensileCD', stats: { summaryIndex: 4, decimals: 2 } },
        7: { format: 'twoDigitTwoDecimal', oos: 'colourL', stats: { summaryIndex: 5, decimals: 2 } },
        8: { format: 'twoDigitTwoDecimal', oos: 'colourA', stats: { summaryIndex: 6, decimals: 2 } },
        9: { format: 'twoDigitTwoDecimal', oos: 'colourB', stats: { summaryIndex: 7, decimals: 2 } },
        10: { format: 'twoDigitTwoDecimal', oos: 'deltaE', stats: { summaryIndex: 8, decimals: 2 } }
    }
};

const DATA_LOAD_MAPPING = [
    { dbField: 'lot_and_roll', tableId: 'testingTableBody', colIndex: 0 },
    { dbField: 'roll_id', tableId: 'testingTableBody', colIndex: 1 },
    { dbField: 'lot_time', tableId: 'testingTableBody', colIndex: 2 },
    { dbField: 'page1_basis_weight', tableId: 'testingTableBody', colIndex: 3 },
    { dbField: 'page1_cof_kinetic_r_r', tableId: 'testingTableBody', colIndex: 4 },
    { dbField: 'page1_cof_kinetic_r_s', tableId: 'testingTableBody', colIndex: 5 },
    { dbField: 'page1_opacity', tableId: 'testingTableBody', colIndex: 6 },
    { dbField: 'page1_modulus_1', tableId: 'testingTableBody', colIndex: 7 },
    { dbField: 'page1_modulus_2', tableId: 'testingTableBody', colIndex: 8 },
    { dbField: 'page1_modulus_3', tableId: 'testingTableBody', colIndex: 9 },
    { dbField: 'page1_gloss', tableId: 'testingTableBody', colIndex: 11 },
    { dbField: 'page2_force_elongation_md_5p', tableId: 'testingTableBody2', colIndex: 3 },
    { dbField: 'page2_force_tensile_md', tableId: 'testingTableBody2', colIndex: 4 },
    { dbField: 'page2_force_elongation_cd_5p', tableId: 'testingTableBody2', colIndex: 5 },
    { dbField: 'page2_force_tensile_cd', tableId: 'testingTableBody2', colIndex: 6 },
    { dbField: 'page2_color_l', tableId: 'testingTableBody2', colIndex: 7 },
    { dbField: 'page2_color_a', tableId: 'testingTableBody2', colIndex: 8 },
    { dbField: 'page2_color_b', tableId: 'testingTableBody2', colIndex: 9 },
    { dbField: 'page2_color_delta_e', tableId: 'testingTableBody2', colIndex: 10 },
    { dbField: 'lot_and_roll', tableId: 'testingTableBody2', colIndex: 0 },
    { dbField: 'roll_id', tableId: 'testingTableBody2', colIndex: 1 },
    { dbField: 'lot_time', tableId: 'testingTableBody2', colIndex: 2 }
];

const EQUIPMENT_MAPPING = {
    page1: [
        { field: 'basic_weight', id: 'basic-weight-equipment' },
        { field: 'modulus', id: 'modulus-equipment' },
        { field: 'opacity', id: 'opacity-equipment' },
        { field: 'cof_rr', id: 'cof-rr-equipment' },
        { field: 'cof_rs', id: 'cof-rs-equipment' },
        { field: 'gloss', id: 'gloss-equipment' }
    ],
    page2: [
        { field: 'force', id: 'page2-force-equipment' },
        { field: 'colour', id: 'page2-colour-equipment' }
    ]
};

/**
 * Formats a date string into DD/MM/YYYY format for regional display requirements.
 * Handles input from both HTML5 date pickers (YYYY-MM-DD) and legacy slash formats.
 * @param {string} dateString - The raw date value from an input or database.
 * @returns {string} The formatted date or original string if parsing fails.
 */
function formatDateToDDMMYYYY(dateString) {
    if (!dateString) return '';

    let date;
    if (dateString.includes('/')) {
        return dateString;
    } else {
        date = new Date(dateString);
    }

    if (isNaN(date.getTime())) {
        return dateString;
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
}

/**
 * Scrapes key header fields to generate a summary for the final sign-off popups.
 * This ensures the verifier/approver knows exactly which record they are signing for.
 * @returns {Object} Mapping of field labels to current values.
 */
function getFormDetailsForConfirmation() {
    try {
        const productCodeInput = document.querySelector('input[placeholder*="Product Code"]') ||
            document.querySelector('input[name="product_code"]') ||
            document.querySelector('#product-code') ||
            document.querySelector('input[value*="APE"]');
        const productName = productCodeInput ? productCodeInput.value : 'N/A';

        const productionDateInput = document.querySelector('input[type="date"]') ||
            document.querySelector('input[name="production_date"]') ||
            document.querySelector('#production-date');
        const productionDate = productionDateInput ? formatDateToDDMMYYYY(productionDateInput.value) : 'N/A';

        const allDateInputs = document.querySelectorAll('input[type="date"]');
        const inspectionDateInput = allDateInputs.length > 1 ? allDateInputs[1] : allDateInputs[0];
        const inspectionDate = inspectionDateInput ? formatDateToDDMMYYYY(inspectionDateInput.value) : 'N/A';

        return {
            productName: productName || 'N/A',
            productionDate: productionDate || 'N/A',
            inspectionDate: inspectionDate || 'N/A'
        };
    } catch (error) {
        console.error('Error getting form details:', error);
        return {
            productName: 'N/A',
            productionDate: 'N/A',
            inspectionDate: 'N/A'
        };
    }
}

/**
 * Retrieves the full name or employee code of the currently authenticated user.
 * This is used to attribute verification and approval logs correctly in the database.
 * @returns {Promise<string>} The user's identifer for display and logging.
 */
async function getCurrentUser() {
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return "Unknown User";
        }

        const { data: userData, error: profileError } = await supabase
            .from('users')
            .select('full_name, employee_code')
            .eq('id', user.id)
            .single();

        if (!profileError && userData) {
            if (userData.full_name && userData.full_name.trim() !== '') {
                return userData.full_name;
            } else if (userData.employee_code && userData.employee_code.trim() !== '') {
                return userData.employee_code;
            }
        }

        return user.email || "Unknown User";

    } catch (error) {
        console.error('Error getting current user:', error);
        return "Unknown User";
    }
}

/**
 * Persists the verification sign-off to the database.
 * Verification is the first gate in the quality control process.
 * @param {string} verifierName - The name/code of the person verifying.
 * @param {string} verificationDate - The date of sign-off.
 */
async function updateVerificationInDatabase(verifierName, verificationDate) {
    try {
        const formId = getCurrentFormId();
        if (!formId) {
            console.error('No form ID found');
            alert('Error: Could not identify the form. Please refresh and try again.');
            return;
        }

        const { data, error } = await supabase
            .from('214_18_micro_white')
            .update({
                verified_by: verifierName,
                verified_date: verificationDate
            })
            .eq('form_id', formId)
            .select();

        if (error) {
            console.error('Error updating verification:', error);
            alert('Error saving verification data. Please try again.');
            return;
        }

        console.log('Verification data updated successfully');

    } catch (error) {
        console.error('Error updating verification in database:', error);
        alert('Error saving verification data. Please try again.');
    }
}

async function updateApprovalInDatabase(approverName, approvalDate) {
    try {
        // Get the current form ID
        const formId = getCurrentFormId();
        if (!formId) {
            console.error('No form ID found');
            alert('Error: Could not identify the form. Please refresh and try again.');
            return;
        }

        // Update the database with approval data
        const { data, error } = await supabase
            .from('214_18_micro_white')
            .update({
                approved_by: approverName,
                approved_date: approvalDate
            })
            .eq('form_id', formId)
            .select();

        if (error) {
            console.error('Error updating approval:', error);
            alert('Error saving approval data. Please try again.');
            return;
        }

        // Approval data saved successfully
        console.log('Approval data updated successfully');

    } catch (error) {
        console.error('Error updating approval in database:', error);
        alert('Error saving approval data. Please try again.');
    }
}

/**
 * Retrieves the unique identifier for the current form instance.
 * Implements a fallback chain: global state -> URL parameters -> session storage.
 * This ensures the ID is accessible even after page refreshes or cross-page navigation.
 * @returns {string|null} The form ID or null if not found.
 */
function getCurrentFormId() {
    if (currentFormId) {
        return currentFormId;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const formId = urlParams.get('form_id');
    if (formId) {
        return formId;
    }

    const storedData = sessionStorage.getItem('filmInspectionData');
    if (storedData) {
        const data = JSON.parse(storedData);
        return data.form_id;
    }

    const sessionFormId = sessionStorage.getItem('currentFormId');
    if (sessionFormId) {
        return sessionFormId;
    }

    if (typeof window.currentFormId !== 'undefined' && window.currentFormId) {
        return window.currentFormId;
    }

    console.error('Could not find form ID');
    return null;
}

/**
 * Checks if the current form has been verified by a QC operator.
 * Based on the result, it toggles visibility between the verification input form
 * and the read-only verification status badge.
 */
async function checkVerificationStatus() {
    try {
        const formId = getCurrentFormId();
        if (!formId) {
            showVerificationForm();
            return;
        }

        const { data, error } = await supabase
            .from('214_18_micro_white')
            .select('verified_by, verified_date')
            .eq('form_id', formId)
            .maybeSingle();

        if (error) {
            if (error.code === 'PGRST116') {
                showVerificationForm();
                return;
            }
            console.error('Error checking verification status:', error);
            showVerificationForm();
            return;
        }

        if (data && data.verified_by && data.verified_date) {
            showVerificationStatus();
            document.getElementById('verifiedByDisplay').textContent = 'Verified by: ' + data.verified_by;
            const formattedDate = formatDateToDDMMYYYY(data.verified_date);
            document.getElementById('verifiedDateDisplay').textContent = 'Date: ' + formattedDate;
        } else {
            showVerificationForm();
        }

    } catch (error) {
        console.error('Error checking verification status:', error);
        showVerificationForm();
    }
}

function showVerificationForm() {
    document.getElementById('verificationForm').style.display = 'block';
    document.getElementById('verificationStatus').style.display = 'none';
}

function showVerificationStatus() {
    document.getElementById('verificationForm').style.display = 'none';
    document.getElementById('verificationStatus').style.display = 'flex';
}

async function verifyForm(verificationDate) {
    try {
        const currentUser = await getCurrentUser();
        const formDetails = getFormDetailsForConfirmation();
        showCustomConfirmationPopup(formDetails, currentUser, verificationDate);
    } catch (error) {
        console.error('Error during verification:', error);
        alert('Error during verification. Please try again.');
    }
}

/**
 * Displays a modal popup to confirm verification details before saving to the database.
 * Provides a final "human-in-the-loop" check for product name and dates.
 * @param {Object} formDetails - Metadata about the form being verified.
 * @param {string} currentUser - The name of the verifier.
 * @param {string} verificationDate - The chosen date for sign-off.
 */
function showCustomConfirmationPopup(formDetails, currentUser, verificationDate) {
    document.getElementById('confirmProductName').textContent = formDetails.productName;
    document.getElementById('confirmProductionDate').textContent = formDetails.productionDate;
    document.getElementById('confirmInspectionDate').textContent = formDetails.inspectionDate;
    document.getElementById('confirmVerifierName').textContent = currentUser;
    document.getElementById('confirmVerificationDate').textContent = formatDateToDDMMYYYY(verificationDate);

    document.getElementById('verificationConfirmPopup').style.display = 'flex';

    const confirmBtn = document.getElementById('confirmVerificationBtn');
    if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.onclick = async () => {
            try {
                document.getElementById('verificationConfirmPopup').style.display = 'none';

                await updateVerificationInDatabase(currentUser, verificationDate);

                alert('Form verified successfully!');

                showVerificationStatus();
                document.getElementById('verifiedByDisplay').textContent = 'Verified by: ' + currentUser;
                const formattedDate = formatDateToDDMMYYYY(verificationDate);
                document.getElementById('verifiedDateDisplay').textContent = 'Date: ' + formattedDate;

                checkApprovalStatus().catch(error => {
                    console.error('Error checking approval status:', error);
                });

            } catch (error) {
                console.error('Error during verification:', error);
                alert('Error during verification. Please try again.');
            }
        };
    }

    const cancelBtn = document.getElementById('cancelVerificationPopupBtn');
    if (cancelBtn) {
        cancelBtn.disabled = false;
        cancelBtn.onclick = () => {
            document.getElementById('verificationConfirmPopup').style.display = 'none';
        };
    }
}

// Initialize verification system
function initializeVerification() {
    // Wait a bit for form_id to be available, then check verification status
    setTimeout(() => {
        checkVerificationStatus();
    }, 500);

    // Add event listeners for verification form
    const verifyBtn = document.getElementById('verifyFormBtn');
    const cancelBtn = document.getElementById('cancelVerificationBtn');
    const passwordInput = document.getElementById('verificationPassword');
    const togglePasswordBtn = document.getElementById('toggleVerificationPassword');

    if (verifyBtn) {
        verifyBtn.addEventListener('click', function () {
            const password = document.getElementById('verificationPassword').value;
            const verificationDate = document.getElementById('verificationDate').value;

            if (!verificationDate) {
                alert('Please select a verification date.');
                return;
            }

            if (password === VERIFICATION_PASSWORD) {
                verifyForm(verificationDate);
            } else {
                alert('Incorrect password. Please try again.');
            }
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', function () {
            document.getElementById('verificationPassword').value = '';
            document.getElementById('verificationDate').value = '';
        });
    }

    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', function () {

            const passwordInput = document.getElementById('verificationPassword');
            const icon = togglePasswordBtn.querySelector('i');

            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    }

    // Enable verification inputs even in view mode
    if (passwordInput) {
        passwordInput.disabled = false;
        passwordInput.readOnly = false;
    }

    const verificationDateInput = document.getElementById('verificationDate');
    if (verificationDateInput) {
        verificationDateInput.disabled = false;
        verificationDateInput.readOnly = false;
    }

    if (verifyBtn) {
        verifyBtn.disabled = false;
    }

    if (cancelBtn) {
        cancelBtn.disabled = false;
    }

    if (togglePasswordBtn) {
        togglePasswordBtn.disabled = false;
    }

}

// ===== APPROVAL FUNCTIONS =====
// Check if form is verified in database before allowing approval
/**
 * Determines if the form is eligible for final approval.
 * Approval is only permitted after a form has been verified. 
 * This workflow ensures a two-person or two-stage check for quality records.
 */
async function checkApprovalStatus() {
    try {
        const formId = getCurrentFormId();
        if (!formId) {
            hideApprovalSection();
            return;
        }

        const { data, error } = await supabase
            .from('214_18_micro_white')
            .select('verified_by, approved_by, approved_date')
            .eq('form_id', formId)
            .maybeSingle();

        if (error) {
            if (error.code === 'PGRST116') {
                hideApprovalSection();
                return;
            }
            console.error('Error checking approval status:', error);
            hideApprovalSection();
            return;
        }

        if (data && data.verified_by) {
            showApprovalSection();
            setApprovalFormState(true);

            if (data.approved_by) {
                showApprovalStatus();
                document.getElementById('approvedByDisplay').textContent = 'Approved by: ' + data.approved_by;
                document.getElementById('approvedDateDisplay').textContent = 'Date: ' + formatDateToDDMMYYYY(data.approved_date);
            } else {
                showApprovalForm();
            }
        } else {
            hideApprovalSection();
            setApprovalFormState(false);
        }
    } catch (error) {
        console.error('Error checking approval status:', error);
        hideApprovalSection();
    }
}

// Show the approval form
function showApprovalForm() {
    try {
        const approvalForm = document.getElementById('approvalForm');
        const approvalStatus = document.getElementById('approvalStatus');
        if (approvalForm) {
            approvalForm.style.display = 'block';
        }
        if (approvalStatus) {
            approvalStatus.style.display = 'none';
        }
    } catch (error) {
        console.error('Error showing approval form:', error);
    }
}

// Show the approval status
function showApprovalStatus() {
    try {
        const approvalForm = document.getElementById('approvalForm');
        const approvalStatus = document.getElementById('approvalStatus');
        if (approvalForm) {
            approvalForm.style.display = 'none';
        }
        if (approvalStatus) {
            approvalStatus.style.display = 'flex';
        }
    } catch (error) {
        console.error('Error showing approval status:', error);
    }
}

// Show the approval section (form + status)
function showApprovalSection() {
    try {
        const approvalSection = document.getElementById('approvalSection');
        if (approvalSection) {
            approvalSection.style.display = 'block';
        }
    } catch (error) {
        console.error('Error showing approval section:', error);
    }
}

// Hide the approval section
function hideApprovalSection() {
    try {
        const approvalSection = document.getElementById('approvalSection');
        if (approvalSection) {
            approvalSection.style.display = 'none';
        }
    } catch (error) {
        console.error('Error hiding approval section:', error);
    }
}

// Unified function to enable/disable approval inputs (consolidated from enableApprovalForm + disableApprovalForm)
function setApprovalFormState(isEnabled) {
    try {
        const formElements = [
            document.getElementById('approvalPassword'),
            document.getElementById('approvalDate'),
            document.getElementById('approveFormBtn'),
            document.getElementById('cancelApprovalBtn'),
            document.getElementById('toggleApprovalPassword')
        ];

        formElements.forEach(element => {
            if (element) {
                element.disabled = !isEnabled;
            }
        });
    } catch (error) {
        console.error('Error setting approval form state:', error);
    }
}

// Approve the form
async function approveForm(approvalDate) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
            alert('Error: Could not identify the current user.');
            return;
        }

        showApprovalConfirmationPopup(currentUser, approvalDate);
    } catch (error) {
        console.error('Error during approval:', error);
        alert('Error processing approval. Please try again.');
    }
}

// Show approval confirmation popup
function showApprovalConfirmationPopup(currentUser, approvalDate) {
    try {
        // Get form details
        const formDetails = getFormDetailsForConfirmation();

        // Populate the approval popup with data
        document.getElementById('confirmApprovalProductName').textContent = formDetails.productName;
        document.getElementById('confirmApprovalProductionDate').textContent = formDetails.productionDate;
        document.getElementById('confirmApprovalInspectionDate').textContent = formDetails.inspectionDate;
        document.getElementById('confirmApproverName').textContent = currentUser;
        document.getElementById('confirmApprovalDate').textContent = formatDateToDDMMYYYY(approvalDate);

        // Show the popup
        document.getElementById('approvalConfirmPopup').style.display = 'flex';

        // Handle confirm button click
        const confirmBtn = document.getElementById('confirmApprovalBtn');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.onclick = async () => {
                try {
                    // Hide popup
                    document.getElementById('approvalConfirmPopup').style.display = 'none';

                    // Update database
                    await updateApprovalInDatabase(currentUser, approvalDate);

                    // Show success message
                    alert('Form approved successfully!');

                    // Update UI to show approval status with small delay to ensure DOM updates
                    setTimeout(() => {
                        showApprovalStatus();
                        document.getElementById('approvedByDisplay').textContent = 'Approved by: ' + currentUser;
                        const formattedDate = formatDateToDDMMYYYY(approvalDate);
                        document.getElementById('approvedDateDisplay').textContent = 'Date: ' + formattedDate;

                        // Hide approval form
                        const approvalForm = document.getElementById('approvalForm');
                        if (approvalForm) {
                            approvalForm.style.display = 'none';
                        }
                    }, 100);

                } catch (error) {
                    console.error('Error confirming approval:', error);
                    alert('Error during approval confirmation. Please try again.');
                }
            };
        }

        // Handle cancel button click
        const cancelBtn = document.getElementById('cancelApprovalPopupBtn');
        if (cancelBtn) {
            cancelBtn.disabled = false;
            cancelBtn.onclick = () => {
                document.getElementById('approvalConfirmPopup').style.display = 'none';
            };
        }

    } catch (error) {
        console.error('Error showing approval confirmation popup:', error);
        alert('Error preparing approval confirmation. Please try again.');
    }
}

// Initialize approval system
function initializeApproval() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupApprovalListeners);
    } else {
        setupApprovalListeners();
    }
}

function setupApprovalListeners() {
    try {
        // Check initial approval status (async - will check database)
        checkApprovalStatus().catch(error => {
            console.error('Error in checkApprovalStatus:', error);
            hideApprovalSection();
        });

        // Add event listeners for approval form
        const approveBtn = document.getElementById('approveFormBtn');
        const cancelBtn = document.getElementById('cancelApprovalBtn');
        const passwordInput = document.getElementById('approvalPassword');
        const togglePasswordBtn = document.getElementById('toggleApprovalPassword');

        if (approveBtn) {
            approveBtn.addEventListener('click', function () {
                const password = document.getElementById('approvalPassword').value;
                const approvalDate = document.getElementById('approvalDate').value;

                if (!approvalDate) {
                    alert('Please select an approval date.');
                    return;
                }

                if (password === APPROVAL_PASSWORD) {
                    approveForm(approvalDate);
                } else {
                    alert('Incorrect password. Please try again.');
                }
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', function () {
                document.getElementById('approvalPassword').value = '';
                document.getElementById('approvalDate').value = '';
            });
        }

        if (togglePasswordBtn) {
            togglePasswordBtn.addEventListener('click', function () {
                const passwordInput = document.getElementById('approvalPassword');
                const icon = togglePasswordBtn.querySelector('i');

                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    passwordInput.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            });
        }

        // Enable approval inputs even in view mode
        if (passwordInput) {
            passwordInput.disabled = false;
            passwordInput.readOnly = false;
        }

        const approvalDateInput = document.getElementById('approvalDate');
        if (approvalDateInput) {
            approvalDateInput.disabled = false;
            approvalDateInput.readOnly = false;
        }

        if (approveBtn) {
            approveBtn.disabled = false;
        }

        if (cancelBtn) {
            cancelBtn.disabled = false;
        }

        if (togglePasswordBtn) {
            togglePasswordBtn.disabled = false;
        }

    } catch (error) {
        console.error('Error setting up approval listeners:', error);
    }
}

// ===== VIEW MODE DETECTION =====
// Global variable to track view mode
let viewMode = false;

// Global table body references
let testingTableBody;
let testingTableBody2;

// Function to detect and set view mode
/**
 * Parses URL parameters and session state to determine if the form should be read-only.
 * Redundancy (URL + Storage) ensures consistent behavior across different entry points.
 * @returns {boolean} True if the form is in view mode.
 */
function detectViewMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const modeParam = urlParams.get('mode');
    const viewParam = urlParams.get('view');
    const viewModeFromStorage = sessionStorage.getItem('viewMode') === 'true';

    const viewParamTruthy = typeof viewParam === 'string' && ['1', 'true', 'on', 'yes'].includes(viewParam.toLowerCase());

    viewMode = modeParam === 'view' || viewParamTruthy || viewModeFromStorage;

    return viewMode;
}

// Function to setup view mode UI
function setupViewMode() {
    // Get view mode status
    const isViewMode = detectViewMode();


    // Show prestore section only in view mode
    const prestoreSection = document.getElementById('prestore-section');
    if (prestoreSection) {
        prestoreSection.style.display = isViewMode ? 'block' : 'none';
    } else {
        console.warn('🎛️ [VIEW MODE] Prestore section not found');
    }

    // Verified/Approved blocks should be visible ONLY in view mode
    const verificationApprovalContainer = document.getElementById('verificationApprovalContainer');
    if (verificationApprovalContainer) {
        verificationApprovalContainer.style.display = isViewMode ? 'flex' : 'none';
    }

    // Show/hide verification sections based on mode
    const verificationSection = document.getElementById('verificationSection');
    const approvalSection = document.getElementById('approvalSection');

    if (verificationSection) {
        verificationSection.style.display = isViewMode ? 'block' : 'none';

    } else {
        console.warn('🎛️ [VIEW MODE] Verification section not found');
    }

    if (approvalSection) {
        approvalSection.style.display = isViewMode ? 'block' : 'none';

    } else {
        console.warn('🎛️ [VIEW MODE] Approval section not found');
    }

    // Disable/enable form inputs based on view mode
    if (isViewMode) {

        disableFormInputs();
    } else {

        enableFormInputs();
    }



    // Note: synchronizeViewModeAcrossPages() will be called later after data is loaded
}

// Function to synchronize view mode across all pages (like 16 GSM Kranti)
function synchronizeViewModeAcrossPages() {

    const isViewMode = detectViewMode();


    // Apply view mode to all table inputs
    const allTableBodies = [testingTableBody, testingTableBody2];

    allTableBodies.forEach(tableBody => {
        if (tableBody) {
            const inputs = tableBody.querySelectorAll('input, select, textarea');

            inputs.forEach((input, index) => {
                if (isViewMode) {
                    input.disabled = true;
                    input.readOnly = true;
                    input.style.cursor = 'default';
                    // Preserve OOS/red formatting in view mode
                    if (!input.classList.contains('text-red-600')) {
                        input.style.color = '#000000';
                    }
                    input.style.opacity = '1';


                    // Special handling for Page 2 sample columns (first 3 columns)
                    if (tableBody.id === 'testingTableBody2' && index <= 2) {
                        input.style.backgroundColor = '#f1f5f9'; // Light grey background
                        input.style.fontWeight = '600'; // Bold text
                        input.disabled = true;
                        input.readOnly = true;
                        input.style.cursor = 'default';

                    }
                } else {
                    // For edit mode, allow inputs to be editable except certain columns that must remain read-only
                    let keepReadOnly = false;

                    // Determine the column index for this input (0-based)
                    const cell = input.closest('td');
                    if (cell) {
                        const colIndex = Array.from(cell.parentElement.children).indexOf(cell);

                        if (tableBody.id === 'testingTableBody2') {
                            // Sample columns Lot & Roll, Roll ID, Lot Time correspond to indices 0,1,2
                            if (colIndex >= 0 && colIndex <= 2) {
                                keepReadOnly = true;
                            }
                        } else if (tableBody.id === 'testingTableBody') {
                            // Modulus average column (column 10) must always remain read-only
                            if (colIndex === 10) {
                                keepReadOnly = true;
                            }
                        }
                    }

                    input.disabled = false;
                    input.readOnly = keepReadOnly ? true : false;
                    input.style.cursor = keepReadOnly ? 'default' : 'text';

                    if (keepReadOnly) {
                        // Apply the same styling used when view mode is on for these specific columns
                        input.style.backgroundColor = '#f1f5f9'; // Light grey background
                    } else {
                        input.style.backgroundColor = ''; // Reset background
                        input.style.fontWeight = ''; // Reset font weight
                    }
                }
            });
        }
    });

    // Apply view mode to equipment dropdowns
    const equipmentDropdowns = document.querySelectorAll('select[id*="equipment"]');
    equipmentDropdowns.forEach(dropdown => {
        if (isViewMode) {
            dropdown.disabled = true;
            dropdown.style.cursor = 'default';

        } else {
            dropdown.disabled = false;
            dropdown.style.cursor = 'pointer';

        }
    });

    // Apply view mode to add/delete buttons
    const addRowsBtn = document.getElementById('addNewRowsBtn');
    const deleteRowsBtn = document.getElementById('deleteRowsBtn');
    const numRowsInput = document.getElementById('numRowsInput');

    if (isViewMode) {
        if (addRowsBtn) addRowsBtn.style.display = 'none';
        if (deleteRowsBtn) deleteRowsBtn.style.display = 'none';
        if (numRowsInput) numRowsInput.style.display = 'none';

    } else {
        if (addRowsBtn) addRowsBtn.style.display = 'block';
        if (deleteRowsBtn) deleteRowsBtn.style.display = 'block';
        if (numRowsInput) numRowsInput.style.display = 'block';

    }


}

// Function to apply input validation and formatting (like 16 GSM Kranti)
// Function to apply input validation and formatting (like 16 GSM Kranti)
function applyInputValidation(input, tableBodyId, columnIndex) {
    if (columnIndex === 0) return applyLotRollValidation(input);
    if (columnIndex === 1) return applyRollIDValidation(input);
    if (columnIndex === 2) return applyLotTimeValidation(input);

    const config = COLUMN_CONFIG[tableBodyId];
    if (!config) return;

    const columnConfig = config[columnIndex];
    if (columnConfig && columnConfig.type === 'numeric') {
        // Data columns - apply numeric validation and OOS validation
        let value = input.value;
        value = value.replace(/[^0-9.-]/g, '');
        input.value = value;

        if (columnConfig.oos) {
            applyOOSValidation(input, columnConfig.oos);

            // Add input event listener for real-time OOS validation if not already added
            // Note: Most specific format validators add their own listeners, but duplicate listeners are harmless if function logic is idempotent
            input.addEventListener('input', function () {
                applyOOSValidation(this, columnConfig.oos);
            });
        }
    }
}

// Lot & Roll validation (00-00 format) - from 16 GSM Kranti
/**
 * Attaches validation and real-time syncing to Lot & Roll fields.
 * @param {HTMLInputElement} input - Target field.
 */
function applyLotRollValidation(input) {
    input.addEventListener('input', function () {
        validateLotRoll(this);
        debouncedSave();

        // Real-time synchronization to other pages
        const row = this.closest('tr');
        const tableBody = row.closest('tbody');
        if (tableBody && tableBody.id === 'testingTableBody') {
            const rowIndex = Array.from(tableBody.querySelectorAll('tr')).filter(r => {
                const firstCell = r.querySelector('td');
                return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
            }).indexOf(row);
            syncSampleDataToOtherPages(rowIndex, 0, this.value);
        }
    });

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            formatLotRollOnEnter(this);

            // Sync after formatting
            const row = this.closest('tr');
            const tableBody = row.closest('tbody');
            if (tableBody && tableBody.id === 'testingTableBody') {
                const rowIndex = Array.from(tableBody.querySelectorAll('tr')).filter(r => {
                    const firstCell = r.querySelector('td');
                    return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
                }).indexOf(row);
                syncSampleDataToOtherPages(rowIndex, 0, this.value);
            }

            // Trigger immediate save on Enter
            debouncedSave();

            // Move to same column index in next row
            const currentCell = this.closest('td');
            const currentRow = currentCell.closest('tr');
            const currentColumnIndex = Array.from(currentRow.children).indexOf(currentCell);

            const nextRow = currentRow.nextElementSibling;
            if (nextRow && !['Average', 'Minimum', 'Maximum'].includes(nextRow.querySelector('td').textContent.trim())) {
                const nextCell = nextRow.children[currentColumnIndex];
                if (nextCell) {
                    const nextInput = nextCell.querySelector('input');
                    if (nextInput) {
                        nextInput.focus();
                    }
                }
            }
        }
    });
}

/**
 * Validates the Lot & Roll input to match the required 00-00 format.
 * Prevents invalid characters and automatically handles the dash separator 
 * to ensure data consistency for downstream processing.
 * @param {HTMLInputElement} input - The input element to validate.
 */
function validateLotRoll(input) {
    let value = input.value;
    const previousValue = input.dataset.previousValue || '';
    const isDeleting = value.length < previousValue.length;

    value = value.replace(/[^0-9-"]/g, '');

    const parts = value.split('-');
    if (parts.length > 2) {
        value = parts[0] + '-' + parts.slice(1).join('');
    }

    if (parts.length === 2) {
        if (parts[0].length > 2) parts[0] = parts[0].substring(0, 2);
        if (parts[1].length > 2) parts[1] = parts[1].substring(0, 2);
        value = parts[0] + '-' + parts[1];
    } else if (parts.length === 1) {
        if (parts[0].length > 2) {
            parts[0] = parts[0].substring(0, 2);
            value = parts[0];
        }
        if (!isDeleting && parts[0].length === 2) {
            value = parts[0] + '-';
        }
    }

    input.value = value;
    input.dataset.previousValue = value;
}

function formatLotRollOnEnter(input) {
    let value = input.value.trim();
    if (value === '') return;

    const parts = value.split('-');

    if (parts.length === 2) {
        // Format both parts to 2 digits with leading zeros
        const part1 = parts[0].padStart(2, '0');
        const part2 = parts[1].padStart(2, '0');
        input.value = part1 + '-' + part2;
    } else if (parts.length === 1) {
        // Single number, split into two parts
        const num = parts[0].padStart(4, '0');
        const part1 = num.substring(0, 2);
        const part2 = num.substring(2, 4);
        input.value = part1 + '-' + part2;
    }
}

// Roll ID validation (00000000 format) - from 16 GSM Kranti
/**
 * Attaches validation and real-time syncing to Roll ID fields.
 * @param {HTMLInputElement} input - Target field.
 */
function applyRollIDValidation(input) {
    input.addEventListener('input', function () {
        validateRollID(this);
        debouncedSave();

        // Real-time synchronization to other pages
        const row = this.closest('tr');
        const tableBody = row.closest('tbody');
        if (tableBody && tableBody.id === 'testingTableBody') {
            const rowIndex = Array.from(tableBody.querySelectorAll('tr')).filter(r => {
                const firstCell = r.querySelector('td');
                return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
            }).indexOf(row);
            syncSampleDataToOtherPages(rowIndex, 1, this.value);
        }
    });

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            formatRollIDOnEnter(this);

            // Sync after formatting
            const row = this.closest('tr');
            const tableBody = row.closest('tbody');
            if (tableBody && tableBody.id === 'testingTableBody') {
                const rowIndex = Array.from(tableBody.querySelectorAll('tr')).filter(r => {
                    const firstCell = r.querySelector('td');
                    return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
                }).indexOf(row);
                syncSampleDataToOtherPages(rowIndex, 1, this.value);
            }

            // Trigger immediate save on Enter
            debouncedSave();

            // Move to same column index in next row
            const currentCell = this.closest('td');
            const currentRow = currentCell.closest('tr');
            const currentColumnIndex = Array.from(currentRow.children).indexOf(currentCell);

            const nextRow = currentRow.nextElementSibling;
            if (nextRow && !['Average', 'Minimum', 'Maximum'].includes(nextRow.querySelector('td').textContent.trim())) {
                const nextCell = nextRow.children[currentColumnIndex];
                if (nextCell) {
                    const nextInput = nextCell.querySelector('input');
                    if (nextInput) {
                        nextInput.focus();
                    }
                }
            }
        }
    });
}

function validateRollID(input) {
    let value = input.value;

    // Only allow numbers and double quote
    value = value.replace(/[^0-9"]/g, '');

    // Limit to 8 digits maximum
    if (value.length > 8) {
        value = value.substring(0, 8);
    }

    input.value = value;
}

function formatRollIDOnEnter(input) {
    let value = input.value.trim();
    if (value === '') return;

    const numValue = parseInt(value);
    if (isNaN(numValue)) return;

    // Format to exactly 8 digits with leading zeros
    const formattedValue = numValue.toString().padStart(8, '0');
    input.value = formattedValue;
}

// Lot Time validation (00:00 format) - from 16 GSM Kranti
/**
 * Attaches validation and real-time syncing to Lot Time fields.
 * @param {HTMLInputElement} input - Target field.
 */
function applyLotTimeValidation(input) {
    input.addEventListener('input', function () {
        validateLotTime(this);
        debouncedSave();

        // Real-time synchronization to other pages
        const row = this.closest('tr');
        const tableBody = row.closest('tbody');
        if (tableBody && tableBody.id === 'testingTableBody') {
            const rowIndex = Array.from(tableBody.querySelectorAll('tr')).filter(r => {
                const firstCell = r.querySelector('td');
                return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
            }).indexOf(row);
            syncSampleDataToOtherPages(rowIndex, 2, this.value);
        }
    });

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            formatLotTimeOnEnter(this);

            // Sync after formatting
            const row = this.closest('tr');
            const tableBody = row.closest('tbody');
            if (tableBody && tableBody.id === 'testingTableBody') {
                const rowIndex = Array.from(tableBody.querySelectorAll('tr')).filter(r => {
                    const firstCell = r.querySelector('td');
                    return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
                }).indexOf(row);
                syncSampleDataToOtherPages(rowIndex, 2, this.value);
            }

            // Trigger immediate save on Enter
            debouncedSave();

            // Move to same column index in next row
            const currentCell = this.closest('td');
            const currentRow = currentCell.closest('tr');
            const currentColumnIndex = Array.from(currentRow.children).indexOf(currentCell);

            const nextRow = currentRow.nextElementSibling;
            if (nextRow && !['Average', 'Minimum', 'Maximum'].includes(nextRow.querySelector('td').textContent.trim())) {
                const nextCell = nextRow.children[currentColumnIndex];
                if (nextCell) {
                    const nextInput = nextCell.querySelector('input');
                    if (nextInput) {
                        nextInput.focus();
                    }
                }
            }
        }
    });
}

function validateLotTime(input) {
    let value = input.value;
    const previousValue = input.dataset.previousValue || '';
    const isDeleting = value.length < previousValue.length;

    // Only allow numbers, colon, and double quote
    value = value.replace(/[^0-9:"]/g, '');

    // Ensure only one colon
    const parts = value.split(':');
    if (parts.length > 2) {
        value = parts[0] + ':' + parts.slice(1).join('');
    }

    // Limit to 2 digits before and after colon
    if (parts.length === 2) {
        if (parts[0].length > 2) parts[0] = parts[0].substring(0, 2);
        if (parts[1].length > 2) parts[1] = parts[1].substring(0, 2);
        value = parts[0] + ':' + parts[1];
    } else if (parts.length === 1) {
        if (parts[0].length > 2) {
            parts[0] = parts[0].substring(0, 2);
            value = parts[0];
        }
        // Auto-insert colon after 2 digits
        if (!isDeleting && parts[0].length === 2) {
            value = parts[0] + ':';
        }
    }

    input.value = value;
    input.dataset.previousValue = value;
}

function formatLotTimeOnEnter(input) {
    let value = input.value.trim();
    if (value === '') return;

    const parts = value.split(':');

    if (parts.length === 2) {
        const hours = parts[0].padStart(2, '0');
        const minutes = parts[1].padStart(2, '0');

        // Validate time range
        const h = parseInt(hours);
        const m = parseInt(minutes);

        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
            input.value = hours + ':' + minutes;
        }
    } else if (parts.length === 1) {
        const num = parts[0].padStart(4, '0');
        const hours = num.substring(0, 2);
        const minutes = num.substring(2, 4);

        const h = parseInt(hours);
        const m = parseInt(minutes);

        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
            input.value = hours + ':' + minutes;
        }
    }
}

// Function to disable form inputs in view mode
/**
 * Enforces a read-only state across the form. 
 * Header fields are ALWAYS disabled as they are controlled by the list view.
 * Table fields and buttons are disabled only when in viewMode.
 */
function disableFormInputs() {
    const headerTableInputs = document.querySelectorAll('.modern-header-table input, .modern-header-table select, .modern-header-table textarea');
    headerTableInputs.forEach(input => {
        input.disabled = true;
        input.readOnly = true;
        input.style.pointerEvents = 'none';
        input.style.cursor = 'default';
        input.style.fontSize = '16px';
        input.style.fontWeight = '500';
        input.style.color = '#000000';
        input.style.opacity = '1';
        input.title = 'This field is read-only';

        const td = input.closest('td');
        if (td) {
            td.style.backgroundColor = '#f1f5f9';
            td.style.fontWeight = '600';
            td.style.fontSize = '15px';
        }
    });

    if (isViewMode()) {
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            const inputId = input.id;
            const inputClass = input.className;

            if (inputId && (
                inputId.includes('verification') ||
                inputId.includes('approval') ||
                inputId.includes('back') ||
                inputId.includes('navigation') ||
                inputId.includes('nav')
            )) {
                return;
            }

            if (inputClass && (
                inputClass.includes('nav') ||
                inputClass.includes('back') ||
                inputClass.includes('navigation')
            )) {
                return;
            }

            if (input.closest('.modern-header-table')) {
                return;
            }

            input.disabled = true;
            input.readOnly = true;
            input.style.cursor = 'default';

            const isHeaderTable = input.closest('.modern-header-table');
            const isHeaderField = input.closest('input[placeholder*="Enter"]') ||
                input.closest('input[placeholder*="Product"]') ||
                input.closest('input[placeholder*="Machine"]') ||
                input.closest('input[placeholder*="Order"]') ||
                input.closest('input[placeholder*="Specification"]') ||
                input.closest('input[placeholder*="Quantity"]') ||
                input.closest('input[type="date"]');

            if (isHeaderTable || isHeaderField) {
                input.style.fontSize = '16px';
            }

            input.style.fontWeight = '500';
            input.style.color = '#000000';
            input.style.opacity = '1';
            input.title = 'This field is read-only';
        });

        const addRowsBtn = document.getElementById('addNewRowsBtn');
        const deleteRowsBtn = document.getElementById('deleteRowsBtn');
        const numRowsInput = document.getElementById('numRowsInput');

        if (addRowsBtn) addRowsBtn.style.display = 'none';
        if (deleteRowsBtn) deleteRowsBtn.style.display = 'none';
        if (numRowsInput) numRowsInput.style.display = 'none';

        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            const buttonId = button.id;
            const buttonClass = button.className;
            const buttonText = button.textContent.toLowerCase();

            if (buttonId && (
                buttonId.includes('verification') ||
                buttonId.includes('approval') ||
                buttonId.includes('back') ||
                buttonId.includes('navigation') ||
                buttonId.includes('nav') ||
                buttonId.includes('home') ||
                buttonId.includes('return') ||
                buttonId.includes('toggle') ||
                buttonId === 'toggleGraphsBtn' ||
                buttonId === 'toggleGraphsBtn2'
            )) {
                return;
            }

            if (buttonClass && (
                buttonClass.includes('nav') ||
                buttonClass.includes('back') ||
                buttonClass.includes('navigation') ||
                buttonClass.includes('btn-back') ||
                buttonClass.includes('btn-nav')
            )) {
                return;
            }

            if (buttonText && (
                buttonText.includes('back') ||
                buttonText.includes('home') ||
                buttonText.includes('return') ||
                buttonText.includes('navigation') ||
                buttonText.includes('nav')
            )) {
                return;
            }

            button.disabled = true;
        });
    }
}

// Function to enable form inputs in edit mode
function enableFormInputs() {
    // Enable all input fields
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.disabled = false;
        input.readOnly = false;
    });

    // Enable all buttons
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.disabled = false;
    });
}

// Function to check if currently in view mode
function isViewMode() {
    return viewMode;
}

// Function to toggle between view and edit mode
function toggleViewMode() {
    viewMode = !viewMode;
    setupViewMode();
    return viewMode;
}

// ===== SESSION INITIALIZATION =====
// Global variables to store session data
let currentFormId = null;
let currentLotNo = null;
let currentProductCode = null;

// Function to initialize session variables
function initializeSession() {


    // Load session variables from sessionStorage (set by film_inspection_list.js)
    const sessionFormId = sessionStorage.getItem('currentFormId');
    const sessionLotNo = sessionStorage.getItem('currentLotNo');
    const sessionProductCode = sessionStorage.getItem('currentProductCode');






    // Set global variables
    currentFormId = sessionFormId;
    currentLotNo = sessionLotNo;
    currentProductCode = sessionProductCode;

    // Set window variables for global access
    if (sessionFormId && sessionLotNo) {
        window.currentFormId = sessionFormId;
        window.currentLotNo = sessionLotNo;

    }

    if (sessionProductCode) {
        window.currentProductCode = sessionProductCode;

    }

    const sessionData = {
        formId: currentFormId,
        lotNo: currentLotNo,
        productCode: currentProductCode
    };


    return sessionData;
}

// Function to get current session data
function getSessionData() {
    return {
        formId: currentFormId,
        lotNo: currentLotNo,
        productCode: currentProductCode
    };
}

// Function to set session data
function setSessionData(formId, lotNo, productCode) {
    currentFormId = formId;
    currentLotNo = lotNo;
    currentProductCode = productCode;

    // Update window variables
    window.currentFormId = formId;
    window.currentLotNo = lotNo;
    window.currentProductCode = productCode;

    // Update sessionStorage
    if (formId) {
        sessionStorage.setItem('currentFormId', formId);
    }
    if (lotNo) {
        sessionStorage.setItem('currentLotNo', lotNo);
    }
    if (productCode) {
        sessionStorage.setItem('currentProductCode', productCode);
    }
}

// Function to clear session data
function clearSessionData() {
    currentFormId = null;
    currentLotNo = null;
    currentProductCode = null;

    // Clear window variables
    window.currentFormId = null;
    window.currentLotNo = null;
    window.currentProductCode = null;

    // Clear sessionStorage
    sessionStorage.removeItem('currentFormId');
    sessionStorage.removeItem('currentLotNo');
    sessionStorage.removeItem('currentProductCode');
}

// Function to check if session is active
function isSessionActive() {
    return !!(currentFormId && currentLotNo);
}


// Function to get current lot number
function getCurrentLotNo() {
    return currentLotNo || sessionStorage.getItem('currentLotNo');
}

// Function to get current product code
function getCurrentProductCode() {
    return currentProductCode || sessionStorage.getItem('currentProductCode');
}

// ===== QC EQUIPMENT DROPDOWNS SETUP =====
// Load QC equipment data and populate dropdowns - SIMPLE AND DIRECT
/**
 * Loads the list of QC equipment from the database and populates dropdowns.
 * This ensures that the equipment IDs being recorded are valid and tracked assets.
 */
async function loadQCEquipmentDropdowns() {
    try {
        showEquipmentLoadingState();

        const { data: equipmentData, error } = await supabase
            .from('qc_equipments')
            .select('equipment_type, equipment_id')
            .order('equipment_type, equipment_id');

        if (error) {
            console.error('🔧 [EQUIPMENT] Database error:', error);
            throw new Error(`Database error: ${error.message}`);
        }

        if (!equipmentData || equipmentData.length === 0) {
            console.warn('🔧 [EQUIPMENT] No equipment data found in database');
            throw new Error('No equipment data found');
        }

        populateEquipmentDropdowns(equipmentData);

    } catch (error) {
        console.error('🔧 [EQUIPMENT] Error loading QC equipment:', error);
        showEquipmentLoadingError();
    }
}

// Function to show loading state
function showEquipmentLoadingState() {
    const allDropdownIds = [
        'basic-weight-equipment', 'cof-rr-equipment', 'cof-rs-equipment',
        'opacity-equipment', 'modulus-equipment', 'gloss-equipment',
        'page2-force-equipment', 'page2-colour-equipment'
    ];

    allDropdownIds.forEach(dropdownId => {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            dropdown.innerHTML = '<option value="">Loading equipment...</option>';
        }
    });
}

// Separate function to populate dropdowns
function populateEquipmentDropdowns(equipmentData) {


    // Group equipment by type
    const equipmentByType = {};
    equipmentData.forEach(equipment => {
        if (!equipmentByType[equipment.equipment_type]) {
            equipmentByType[equipment.equipment_type] = [];
        }
        equipmentByType[equipment.equipment_type].push(equipment.equipment_id);
    });



    // Equipment type to dropdown mapping (Page 1 & 2 only) - Fixed to match actual HTML IDs
    const equipmentMappings = {
        'Weigh Scale': ['basic-weight-equipment'],
        'Dial Gauge': [], // Dial Gauge not used in this form
        'X-RITE': ['page2-colour-equipment'], // X-RITE for Page 2 colour
        'Spectrophotometer': ['opacity-equipment', 'page2-colour-equipment'],
        'Instron': ['cof-rr-equipment', 'cof-rs-equipment', 'page2-force-equipment', 'modulus-equipment'], // UTM for modulus testing
        'Glossmeter': ['gloss-equipment']
    };



    // Populate dropdowns
    Object.keys(equipmentMappings).forEach(equipmentType => {
        const dropdownIds = equipmentMappings[equipmentType];
        const equipmentIds = equipmentByType[equipmentType] || [];



        dropdownIds.forEach(dropdownId => {
            const dropdown = document.getElementById(dropdownId);
            if (dropdown) {

                // Remove 'Loading equipment...' option if present
                Array.from(dropdown.options).forEach(opt => {
                    if (opt.textContent === 'Loading equipment...') {
                        dropdown.removeChild(opt);
                    }
                });

                // Always ensure 'Select Equipment ▼' is present as the first option
                const selectOptionExists = Array.from(dropdown.options).some(opt => opt.textContent === 'Select Equipment ▼');
                if (!selectOptionExists) {
                    const selectOption = document.createElement('option');
                    selectOption.value = '';
                    selectOption.textContent = 'Select Equipment ▼';
                    dropdown.insertBefore(selectOption, dropdown.firstChild);
                }

                // Add equipment options (append only, avoid duplicates)
                equipmentIds.forEach(equipmentId => {
                    const optionExists = Array.from(dropdown.options).some(opt => opt.value === equipmentId);
                    if (!optionExists) {
                        const option = document.createElement('option');
                        option.value = equipmentId;
                        option.textContent = equipmentId;
                        dropdown.appendChild(option);
                    }
                });

                // Add change event listener for auto-save (only once)
                if (!dropdown.hasAttribute('data-listener-added')) {
                    dropdown.addEventListener('change', function () {
                        if (!isViewMode()) {
                            debouncedSave(); // Auto-save equipment selection to database
                        }
                        // Apply equipment highlighting
                        updateEquipmentHighlighting();
                    });
                    dropdown.setAttribute('data-listener-added', 'true');
                }
            } else {
                console.warn(`🔧 [EQUIPMENT] Dropdown not found: ${dropdownId}`);
            }
        });
    });


}

// Function to show equipment loading error
function showEquipmentLoadingError() {
    // Set default options for all dropdowns
    const allDropdownIds = [
        'basic-weight-equipment', 'cof-rr-equipment', 'cof-rs-equipment',
        'opacity-equipment', 'modulus-equipment', 'gloss-equipment',
        'page2-force-equipment', 'page2-colour-equipment'
    ];

    allDropdownIds.forEach(dropdownId => {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            dropdown.innerHTML = '<option value="">Equipment loading failed - Please refresh</option>';
        }
    });
}

// ===== TABLE OPERATIONS =====
// Get all table bodies as an array for easier iteration
function getAllTableBodies() {
    const testingTableBody = document.getElementById('testingTableBody');
    const testingTableBody2 = document.getElementById('testingTableBody2');
    return [testingTableBody, testingTableBody2];
}

// Get table body by page number (1-2)
function getTableBodyByPage(pageNumber) {
    switch (pageNumber) {
        case 1: return document.getElementById('testingTableBody');
        case 2: return document.getElementById('testingTableBody2');
        default: return null;
    }
}

// Get column count for a specific table
function getTableColumnCount(tableBody) {
    if (tableBody.id === 'testingTableBody') return 12;     // Page 1: 12 columns (3 Sample No + 9 parameters)
    if (tableBody.id === 'testingTableBody2') return 11;    // Page 2: 11 columns (3 Sample No + 8 parameters)
    return 0;
}

// Get columns per row for each table
function getColumnsPerRow(tableBody) {
    if (tableBody.id === 'testingTableBody') return 12;      // Page 1: 12 columns (3 Sample No + 9 parameters)
    if (tableBody.id === 'testingTableBody2') return 11;     // Page 2: 11 columns (3 Sample No + 8 parameters)
    return 12; // Default fallback
}

// ===== HISTORICAL DATA LOADING =====
// Load historical data when user enters required fields
function checkAndLoadHistoricalData() {

    const productCodeInput = document.querySelector('input[name="product_code"]') ||
        document.querySelector('#productCodeInput') ||
        document.querySelector('input[placeholder*="Product Code"]');
    const machineInput = document.querySelector('input[name="machine"]') ||
        document.querySelector('input[placeholder="Enter Machine"]');
    const productionDateInput = document.querySelector('input[name="production_date"]') ||
        document.querySelector('table input[type="date"]') ||
        document.querySelector('input[type="date"]');
    const currentFormId = (typeof window !== 'undefined' && window.currentFormId) || document.getElementById('form_id')?.value;

    /*
    console.log('🔍 [HISTORICAL] Current input values:', {
        productCode: productCodeInput?.value,
        machine: machineInput?.value,
        productionDate: productionDateInput?.value,
        currentFormId: currentFormId
    });
    */

    if (productCodeInput?.value && machineInput?.value && productionDateInput?.value && !currentFormId) {

        loadHistoricalDataForNewForm();
    } else {

    }
}

// Safely resolve JSONB/array/string values from historical payload
/**
 * Safely resolves a value from historical JSONB data.
 * Supports both 0-based and 1-based indexing, as well as Array/Object formats.
 * @param {Object} historicalData - The raw database record from history.
 * @param {string} key - The database column name (e.g. 'page1_basis_weight').
 * @param {number} historicalRow - The 1-based row index to retrieve.
 * @returns {any} The resolved value or undefined.
 */
function getHistoricalCellValue(historicalData, key, historicalRow) {
    if (!historicalData || !key) return undefined;
    let container = historicalData[key];
    if (!container) return undefined;

    if (typeof container === 'string') {
        try {
            container = JSON.parse(container);
        } catch (e) {
            return undefined;
        }
    }
    const rowKey1 = String(historicalRow);
    const rowKey0 = String(historicalRow - 1);

    if (typeof container === 'object' && !Array.isArray(container)) {
        return container[rowKey1] ?? container[rowKey0];
    }

    if (Array.isArray(container)) {
        return container[historicalRow - 1] ?? container[historicalRow];
    }
    return undefined;
}

// Determine total historical rows available by inspecting common JSONB fields
function getHistoricalTotalRows(historicalData) {
    if (!historicalData) return 0;
    const candidateKeys = [
        'lot_and_roll', 'roll_id', 'lot_time',
        'page1_basis_weight', 'page1_cof_kinetic_r_r', 'page1_cof_kinetic_r_s', 'page1_opacity', 'page1_modulus_1', 'page1_modulus_2', 'page1_modulus_3', 'page1_gloss',
        'page2_force_elongation_md_5p', 'page2_force_tensile_md', 'page2_force_elongation_cd_5p', 'page2_force_tensile_cd',
        'page2_color_l', 'page2_color_a', 'page2_color_b', 'page2_color_delta_e'
    ];
    let maxRows = 0;
    for (const key of candidateKeys) {
        let container = historicalData[key];
        if (!container) continue;
        if (typeof container === 'string') {
            try { container = JSON.parse(container); } catch (e) { continue; }
        }
        if (Array.isArray(container)) {
            maxRows = Math.max(maxRows, container.length);
            continue;
        }
        if (typeof container === 'object') {
            const numericKeys = Object.keys(container)
                .map(k => parseInt(k, 10))
                .filter(n => !Number.isNaN(n));
            if (numericKeys.length) {
                maxRows = Math.max(maxRows, Math.max(...numericKeys));
            }
        }
    }
    // If keys were 1-based, maxRows is good; if 0-based, this still gives the highest index
    return maxRows;
}

// Load historical data into top rows
function loadHistoricalDataIntoTopRows(historicalData, availableForHistorical) {
    /* console.log('🔍 [HISTORICAL] loadHistoricalDataIntoTopRows CALLED with:', {
        hasHistoricalData: !!historicalData,
        availableForHistorical,
        historicalDataKeys: historicalData ? Object.keys(historicalData).slice(0, 5) : []
    }); */

    const allTables = getAllTableBodies();


    allTables.forEach(tableBody => {
        if (!tableBody) return;

        const rows = Array.from(tableBody.querySelectorAll('tr'));
        let currentRow = 1;
        // Match 16 GSM Kranti: map top rows to the BOTTOM segment of previous form
        const totalHistoricalRows = getHistoricalTotalRows(historicalData);
        const historicalRowStart = Math.max(1, totalHistoricalRows - availableForHistorical + 1);
        let historicalRow = historicalRowStart;

        const endRow = Math.min(availableForHistorical, rows.length);

        for (let i = 0; i < rows.length && currentRow <= endRow; i++) {
            const row = rows[i];
            const firstCell = row.querySelector('td');

            // Skip summary rows
            if (firstCell && ['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim())) {
                continue;
            }

            // Load historical data for this row
            loadHistoricalRowData(row, historicalData, historicalRow);

            currentRow++;
            historicalRow++;
        }
    });
}

// Load historical data for a specific row
// Load historical data for a specific row
function loadHistoricalRowData(row, historicalData, historicalRow) {
    if (!row || !historicalData) return;
    const inputs = row.querySelectorAll('input');
    const tableBody = row.closest('tbody');
    if (!tableBody) return;

    // Filter mapping for this table
    const tableMapping = DATA_LOAD_MAPPING.filter(m => m.tableId === tableBody.id);

    tableMapping.forEach(mapping => {
        // Get value using helper
        const val = getHistoricalCellValue(historicalData, mapping.dbField, historicalRow);

        if (inputs[mapping.colIndex] && val !== undefined && val !== null && val !== '') {
            inputs[mapping.colIndex].value = val;
            // Optional: add visual indicator for historical data
            // inputs[mapping.colIndex].classList.add('historical-data'); 
        }
    });
}

function setupHistoricalDataTrigger() {


    const productCodeInput = document.querySelector('input[name="product_code"]') ||
        document.querySelector('#productCodeInput') ||
        document.querySelector('input[placeholder*="Product Code"]');
    const machineInput = document.querySelector('input[name="machine"]') ||
        document.querySelector('input[placeholder="Enter Machine"]');
    const productionDateInput = document.querySelector('input[name="production_date"]') ||
        document.querySelector('table input[type="date"]') ||
        document.querySelector('input[type="date"]');



    if (productCodeInput) {
        const handler = () => {

            checkAndLoadHistoricalData();
        };
        productCodeInput.addEventListener('input', handler);
        productCodeInput.addEventListener('change', handler);
        productCodeInput.addEventListener('blur', handler);
    }
    if (machineInput) {
        const handler = () => {

            checkAndLoadHistoricalData();
        };
        machineInput.addEventListener('input', handler);
        machineInput.addEventListener('change', handler);
        machineInput.addEventListener('blur', handler);
    }
    if (productionDateInput) {
        const handler = () => {

            checkAndLoadHistoricalData();
        };
        productionDateInput.addEventListener('input', handler);
        productionDateInput.addEventListener('change', handler);
        productionDateInput.addEventListener('blur', handler);
    }

    // Initial check on page load
    checkAndLoadHistoricalData();
}

// Call setupHistoricalDataTrigger when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', setupHistoricalDataTrigger);


// ===== AUTO-SAVE TO DATABASE =====
// Track saving state to prevent duplicate saves
let isSaving = false;
let saveTimeout = null;
let pendingSave = false;

/**
 * Prevents multiple rapid database writes by delaying the save operation.
 * If a save is already in progress, it queues a follow-up save to ensure 
 * the final state is always captured.
 */
function debouncedSave() {
    if (isSaving) {
        pendingSave = true;
        return;
    }

    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        isSaving = true;
        try {
            await autoSaveToDatabase();
        } catch (error) {
            console.error('💾 [AUTO-SAVE] Auto-save failed:', error);
        } finally {
            isSaving = false;
            // If another change occurred during current save, trigger one last save
            if (pendingSave) {
                pendingSave = false;
                debouncedSave();
            }
        }
    }, 200);
}

// Main auto-save function
/**
 * Orchestrates the persistence of all form state to Supabase.
 * Determines whether to perform an INSERT (new record) or UPDATE (existing record)
 * based on the presence of a form identifier.
 */
async function autoSaveToDatabase() {
    if (isViewMode()) {
        return;
    }

    try {
        const formData = await collectFormData();
        if (!formData) {
            return;
        }

        if (currentFormId) {
            await updateFormInDatabase(formData);
        } else {
            await createFormInDatabase(formData);
        }
    } catch (error) {
        console.error('💾 [AUTO-SAVE] Error during auto-save:', error);
    }
}

// Collect all form data
async function collectFormData() {


    try {
        // Get header form data
        const headerData = getHeaderFormData();

        // Get table data
        const tableData = getTableDataFromAllTables();

        // Get equipment data
        const equipmentData = getEquipmentSelections();

        // Check if equipment data is valid (not all empty)
        const hasValidEquipmentData = equipmentData.page1 && Object.values(equipmentData.page1).some(value => value !== '') ||
            equipmentData.page2 && Object.values(equipmentData.page2).some(value => value !== '');

        // Only include equipment data if it has valid values
        const formData = {
            ...headerData,
            ...tableData
        };

        // Only include equipment_used if we have valid equipment data
        if (hasValidEquipmentData) {
            formData.equipment_used = equipmentData;
        }


        return formData;

    } catch (error) {
        console.error('💾 [AUTO-SAVE] Error collecting form data:', error);
        return null;
    }
}

// Get header form data
function getHeaderFormData() {


    const productCodeInput = document.querySelector('input[placeholder="Enter Product Code"]');
    const productionOrderInput = document.querySelector('input[placeholder="Enter Prod. Order"]');
    const machineInput = document.querySelector('input[placeholder="Enter Machine"]');
    const productionDateInput = document.querySelector('input[type="date"]:nth-of-type(1)');
    // Find inspection date input by looking for the one after "Inspection Date:" label
    const inspectionDateInput = Array.from(document.querySelectorAll('input[type="date"]')).find(input => {
        const td = input.closest('td');
        const prevTd = td?.previousElementSibling;
        return prevTd && prevTd.textContent.includes('Inspection Date');
    });
    const specificationInput = document.querySelector('input[placeholder="Enter Specification"]');
    const poInput = document.querySelector('input[placeholder="Enter PO"]');
    const quantityInput = document.querySelector('input[placeholder="Enter Quantity"]');

    const headerData = {
        product_code: productCodeInput?.value || '',
        production_order: productionOrderInput?.value || '',
        machine_no: machineInput?.value || '',
        production_date: productionDateInput?.value || '',
        inspection_date: inspectionDateInput?.value || '',
        specification: specificationInput?.value || '',
        purchase_order: 'N/A',
        quantity: quantityInput?.value ? parseInt(quantityInput.value) : null
    };


    return headerData;
}

/**
 * Efficiently scrapes all table data by scanning the DOM once.
 * This replaces multiple redundant conversion calls to minimize main thread blockage.
 */
function getTableDataFromAllTables() {
    const tableData = {};
    const allTables = getAllTableBodies();

    allTables.forEach(tableBody => {
        if (!tableBody) return;
        const tableId = tableBody.id;

        // Get data rows once for the entire table to avoid redundant querySelectorAll
        const dataRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
            const firstCell = row.querySelector('td');
            return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
        });

        const convert = (colIdx) => {
            const jsonbObject = {};
            dataRows.forEach((row, i) => {
                const val = row.querySelectorAll('input')[colIdx]?.value || '';
                jsonbObject[String(i + 1)] = val;
            });
            return Object.keys(jsonbObject).length > 0 ? jsonbObject : null;
        };

        if (tableId === 'testingTableBody') {
            tableData.lot_and_roll = convert(0);
            tableData.roll_id = convert(1);
            tableData.lot_time = convert(2);
            tableData.page1_basis_weight = convert(3);
            tableData.page1_cof_kinetic_r_r = convert(4);
            tableData.page1_cof_kinetic_r_s = convert(5);
            tableData.page1_opacity = convert(6);
            tableData.page1_modulus_1 = convert(7);
            tableData.page1_modulus_2 = convert(8);
            tableData.page1_modulus_3 = convert(9);
            tableData.page1_gloss = convert(11);
        } else if (tableId === 'testingTableBody2') {
            tableData.page2_force_elongation_md_5p = convert(3);
            tableData.page2_force_tensile_md = convert(4);
            tableData.page2_force_elongation_cd_5p = convert(5);
            tableData.page2_force_tensile_cd = convert(6);
            tableData.page2_color_l = convert(7);
            tableData.page2_color_a = convert(8);
            tableData.page2_color_b = convert(9);
            tableData.page2_color_delta_e = convert(10);
        }
    });

    return tableData;
}


// Load table data
function loadTableData(tableBody, data) {


    if (!data || data.length === 0) {

        return;
    }

    // Find the first summary row (Average row) to insert data rows before it
    const summaryRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
        const firstCell = row.querySelector('td');
        return firstCell && ['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
    });

    if (summaryRows.length === 0) {

        return;
    }

    const firstSummaryRow = summaryRows[0]; // Average row

    data.forEach(rowData => {
        const tr = document.createElement('tr');
        tr.className = 'border border-gray-800 px-3 py-2 text-center';

        rowData.forEach(cellValue => {
            const td = document.createElement('td');
            td.className = 'testing-table-cell';
            td.style.fontSize = '13px';

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'testing-input';
            input.value = cellValue;

            // Add event listener for auto-save
            input.addEventListener('input', function () {
                if (!isViewMode()) {
                    debouncedSave();
                }
            });

            td.appendChild(input);
            tr.appendChild(td);
        });

        // Insert the row BEFORE the first summary row
        tableBody.insertBefore(tr, firstSummaryRow);
    });


}

// Clear data rows (excluding summary rows)
function clearDataRows(tableBody) {


    const rows = Array.from(tableBody.querySelectorAll('tr'));
    rows.forEach(row => {
        const firstCell = row.querySelector('td');
        if (firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim())) {
            row.remove();
        }
    });


}

// Helper function to add consolidated input event listener
function addConsolidatedInputListener(input, tableBody, tr, columnIndex) {


    input.addEventListener('input', function () {
        // Block input in view mode
        if (isViewMode()) {

            return;
        }


        // Auto-save to database after each change (debounced)
        debouncedSave();

        // Apply validation and formatting (like 16 GSM Kranti)
        applyInputValidation(this, tableBody.id, columnIndex);

        // Real-time sync for Page 1 sample columns (like 16 GSM Kranti)
        if (tableBody.id === 'testingTableBody' && columnIndex <= 2) {
            const rowIndex = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
                const firstCell = row.querySelector('td');
                return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
            }).indexOf(tr);
            if (rowIndex !== -1) {

                syncSampleDataToOtherPages(rowIndex, columnIndex, this.value);
            }
        }
    });
}

// Update equipment highlighting based on selections
function updateEquipmentHighlighting() {
    const equipmentDropdowns = document.querySelectorAll('.testing-table select');
    equipmentDropdowns.forEach(function (dropdown) {
        if (dropdown.value && dropdown.value !== '' && dropdown.value !== 'Select Equipment ▼') {
            dropdown.classList.add('equipment-selected');
        } else {
            dropdown.classList.remove('equipment-selected');
        }
    });
}

// Apply OOS validation and red text highlighting to input values
// Apply OOS validation and red text highlighting to input values
function applyOOSValidation(input, columnType) {
    if (!input || !columnType) return;

    // Skip validation if input is empty
    if (!input.value || input.value.trim() === '') {
        input.classList.remove('text-red-600');
        input.style.color = '';
        return;
    }

    const value = parseFloat(input.value);

    // Skip validation if value is not a valid number
    if (isNaN(value)) {
        input.classList.remove('text-red-600');
        input.style.color = '';
        return;
    }

    // Clear previous styling
    input.classList.remove('text-red-600');
    input.style.color = '';

    const limits = PARAMETER_LIMITS[columnType];
    let shouldHighlight = false;

    if (limits) {
        if (limits.min !== undefined && limits.min !== null && value < limits.min) shouldHighlight = true;
        if (limits.max !== undefined && limits.max !== null && value > limits.max) shouldHighlight = true;
    }

    if (shouldHighlight) {
        // Apply red text only
        input.classList.add('text-red-600');
    }
}

// Apply OOS validation to all existing inputs in Page 1 and Page 2
// Apply OOS validation to all existing inputs in Page 1 and Page 2
function applyOOSValidationToAllInputs() {
    ['testingTableBody', 'testingTableBody2'].forEach(tableId => {
        const tableBody = document.getElementById(tableId);
        if (!tableBody) return;

        const config = COLUMN_CONFIG[tableId];
        if (!config) return;

        const rows = tableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const firstCell = row.querySelector('td');
            if (firstCell && ['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim())) return;

            const inputs = row.querySelectorAll('input');
            inputs.forEach((input, index) => {
                const colConfig = config[index];
                if (colConfig && colConfig.oos) {
                    applyOOSValidation(input, colConfig.oos);
                    if (!input.hasAttribute('data-oos-listener')) {
                        input.addEventListener('input', function () {
                            applyOOSValidation(this, colConfig.oos);
                        });
                        input.setAttribute('data-oos-listener', 'true');
                    }
                }
            });
        });
    });
}

// Get equipment selections
function getEquipmentSelections() {


    const equipmentData = {
        page1: {
            basic_weight: document.getElementById('basic-weight-equipment')?.value || '',
            modulus: document.getElementById('modulus-equipment')?.value || '',
            opacity: document.getElementById('opacity-equipment')?.value || '',
            cof_rr: document.getElementById('cof-rr-equipment')?.value || '',
            cof_rs: document.getElementById('cof-rs-equipment')?.value || '',
            gloss: document.getElementById('gloss-equipment')?.value || ''
        },
        page2: {
            force: document.getElementById('page2-force-equipment')?.value || '',
            colour: document.getElementById('page2-colour-equipment')?.value || ''
        }
    };


    return equipmentData;
}

// Convert a table column to JSONB format
/**
 * Transverses a specific column across all data rows to create a JSON-compatible object.
 * This is used to pack large tables into a single Postgres JSONB column.
 * Keys are 1-based strings to maintain consistency with historical reporting.
 * @param {HTMLTableSectionElement} tableBody - The table part to scan.
 * @param {number} columnIndex - The 0-based index of the column to extract.
 * @returns {Object|null} Map of row indices to values or null if empty.
 */
function convertColumnToJSONB(tableBody, columnIndex) {
    const rows = Array.from(tableBody.querySelectorAll('tr'));
    const dataRows = rows.filter(row => {
        const firstCell = row.querySelector('td');
        return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
    });

    const jsonbObject = {};

    for (let i = 1; i <= dataRows.length; i++) {
        const rowIndex = i - 1;
        const row = dataRows[rowIndex];
        const inputs = row.querySelectorAll('input');
        const inputElement = inputs[columnIndex];

        if (inputElement) {
            jsonbObject[String(i)] = inputElement.value || '';
        } else {
            jsonbObject[String(i)] = '';
        }
    }

    return Object.keys(jsonbObject).length > 0 ? jsonbObject : null;
}

// Create new form in database
async function createFormInDatabase(formData) {


    try {
        const { data, error } = await supabase
            .from('214_18_micro_white')
            .insert([formData])
            .select();

        if (error) {
            console.error('💾 [AUTO-SAVE] Error creating form:', error);
            return;
        }

        if (data && data.length > 0) {
            currentFormId = data[0].form_id;
            window.currentFormId = currentFormId;

        }

    } catch (error) {
        console.error('💾 [AUTO-SAVE] Error creating form:', error);
    }
}

// Update existing form in database
async function updateFormInDatabase(formData) {



    try {
        // If equipment_used is not in formData, don't update it (preserve existing)
        const updateData = { ...formData };
        if (!updateData.equipment_used) {
            delete updateData.equipment_used;
        }

        // Do NOT update prepared_by to preserve original author
        delete updateData.prepared_by;

        const { error } = await supabase
            .from('214_18_micro_white')
            .update(updateData)
            .eq('form_id', currentFormId);

        if (error) {
            console.error('💾 [AUTO-SAVE] Error updating form:', error);
            return;
        }



    } catch (error) {
        console.error('💾 [AUTO-SAVE] Error updating form:', error);
    }
}

// ===== INPUT VALIDATION FUNCTIONS =====
// ULTRA-OPTIMIZED: Single generic validator replaces 8 separate functions

const VALIDATION_RULES = {
    'threeDigits': { maxBefore: 3, maxAfter: 0, allowNegative: false, allowDecimal: false },
    'twoDigitOneDecimal': { maxBefore: 2, maxAfter: 1, allowNegative: false, allowDecimal: true },
    'twoDigitTwoDecimal': { maxBefore: 2, maxAfter: 2, allowNegative: true, allowDecimal: true },
    'oneDigitOneDecimal': { maxBefore: 1, maxAfter: 1, allowNegative: true, allowDecimal: true },
    'oneDigitTwoDecimal': { maxBefore: 1, maxAfter: 2, allowNegative: true, allowDecimal: true },
    'flexibleOneDecimal': { maxBefore: 2, maxAfter: 1, allowNegative: false, allowDecimal: true },
    'flexibleTwoDecimal': { maxBefore: 2, maxAfter: 2, allowNegative: false, allowDecimal: true },
    'cof': { maxBefore: 2, maxAfter: 2, allowNegative: false, allowDecimal: true }
};

/**
 * Sanitizes numeric input based on specified rules for length and precision.
 * This generic validator handles decimals, negatives, and character stripping 
 * to provide a consistent data entry experience.
 * @param {HTMLInputElement} input - The field being validated.
 * @param {string} ruleName - Key from VALIDATION_RULES (e.g., 'twoDigitOneDecimal').
 */
function validateNumericInput(input, ruleName) {
    const rule = VALIDATION_RULES[ruleName];
    if (!rule) return;

    let value = input.value;
    const allowedChars = rule.allowNegative ? '[^0-9.-]' : (rule.allowDecimal ? '[^0-9.]' : '[^0-9]');
    value = value.replace(new RegExp(allowedChars, 'g'), '');

    if (rule.allowNegative) {
        if (value.indexOf('-') > 0) value = value.replace(/-/g, '');
        else if (value.startsWith('-')) value = '-' + value.substring(1).replace(/-/g, '');
    }

    if (!rule.allowDecimal) {
        value = value.replace(/\./g, '');
        if (value.length > rule.maxBefore) value = value.substring(0, rule.maxBefore);
    } else {
        const parts = value.split('.');
        if (parts.length > 2) value = parts[0] + '.' + parts.slice(1).join('');

        if (parts.length === 2) {
            let before = parts[0];
            let after = parts[1];
            const negOffset = before.startsWith('-') ? 1 : 0;
            if (before.length > rule.maxBefore + negOffset) before = before.substring(0, rule.maxBefore + negOffset);
            if (after.length > rule.maxAfter) after = after.substring(0, rule.maxAfter);
            value = before + '.' + after;
        } else if (parts.length === 1) {
            const negOffset = value.startsWith('-') ? 1 : 0;
            if (value.length > rule.maxBefore + negOffset) value = value.substring(0, rule.maxBefore + negOffset);
        }
    }

    input.value = value;
}

function formatNumericInput(input, ruleName) {
    const rule = VALIDATION_RULES[ruleName];
    if (!rule || !rule.allowDecimal) return;

    let value = input.value.trim();
    if (value === '') { input.value = ''; return; }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) { input.value = ''; return; }

    if (ruleName === 'cof' && numValue >= 1) {
        input.value = (numValue / 100).toFixed(rule.maxAfter);
    } else {
        input.value = numValue.toFixed(rule.maxAfter);
    }
}

// Generic function to setup numeric validation and formatting
/**
 * Configures all behavioral logic for a numeric input cell.
 * Attaches validation on input, formatting on blur, and triggers 
 * OOS checks and statistics recalculation when values change.
 * @param {HTMLInputElement} input - Target cell.
 * @param {string} tableId - Parent table (used to check configuration).
 * @param {number} columnIndex - Specific parameter column index.
 */
function setupNumericValidator(input, tableId, columnIndex) {
    const config = COLUMN_CONFIG[tableId]?.[columnIndex];
    if (!config || !config.format) return;

    const ruleName = config.format;

    const updateLogic = (el) => {
        if (config.oos) applyOOSValidation(el, config.oos);
        if (config.isModulus) calculateModulusAverage(el);
        if (config.stats) calculateColumnStats(document.getElementById(tableId), columnIndex);
    };

    input.addEventListener('input', function () {
        if (isViewMode()) return;
        validateNumericInput(this, ruleName);
        updateLogic(this);
        debouncedSave();
    });

    const formatHandler = function () {
        if (isViewMode()) return;
        if (ruleName === 'threeDigits') {
            let val = this.value.trim();
            if (val !== '') this.value = parseInt(val).toString().padStart(3, '0');
        } else {
            formatNumericInput(this, ruleName);
        }
        updateLogic(this);
        debouncedSave();
    };

    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') formatHandler.call(input); });
    input.addEventListener('blur', formatHandler);
}

// Generic function to calculate column statistics
/**
 * Computes Average, Min, and Max for a specific column in a given table.
 * Results are pushed to the summary rows (usually the last 3 rows of the table).
 * @param {HTMLTableSectionElement} tableBody - Parent table to analyze.
 * @param {number|null} changedColumnIndex - If provided, only this column is updated for performance.
 */
function calculateColumnStats(tableBody, changedColumnIndex = null) {
    if (!tableBody) return;

    const config = COLUMN_CONFIG[tableBody.id];
    if (!config) return;

    const rows = Array.from(tableBody.querySelectorAll('tr'));
    const dataRows = rows.filter(row => {
        const firstCell = row.querySelector('td');
        return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
    });

    if (dataRows.length === 0) return;

    let columnsToCalculate = [];
    if (changedColumnIndex !== null) {
        if (config[changedColumnIndex]?.stats) columnsToCalculate.push(parseInt(changedColumnIndex));
    } else {
        columnsToCalculate = Object.keys(config).map(Number).filter(idx => config[idx].stats);
    }

    columnsToCalculate.forEach(inputColIndex => {
        const colStatsParams = config[inputColIndex].stats;
        const values = [];

        dataRows.forEach(row => {
            const inputs = row.querySelectorAll('input');
            if (inputs[inputColIndex]?.value.trim() !== '') {
                const val = parseFloat(inputs[inputColIndex].value);
                if (!isNaN(val)) values.push(val);
            }
        });

        const decimals = colStatsParams.decimals || 1;
        let avg = 0, min = 0, max = 0;

        if (values.length > 0) {
            avg = values.reduce((s, v) => s + v, 0) / values.length;
            min = Math.min(...values);
            max = Math.max(...values);
        }

        updateSummaryRow(tableBody, 'Average', colStatsParams.summaryIndex, avg.toFixed(decimals));
        updateSummaryRow(tableBody, 'Minimum', colStatsParams.summaryIndex, min.toFixed(decimals));
        updateSummaryRow(tableBody, 'Maximum', colStatsParams.summaryIndex, max.toFixed(decimals));
    });
}

/**
 * Updates a specific cell in a summary row.
 * Handles both input elements (for editable summaries) and 
 * plain td text (for read-only summaries).
 */
function updateSummaryRow(tableBody, label, colIndex, value) {
    const rows = Array.from(tableBody.querySelectorAll('tr'));
    const summaryRow = rows.find(row => row.querySelector('td')?.textContent.trim() === label);
    if (!summaryRow) return;

    const cells = summaryRow.querySelectorAll('td');
    const inputs = summaryRow.querySelectorAll('input');

    // Try updating input value first
    if (inputs.length > 0 && inputs[colIndex]) {
        inputs[colIndex].value = value;
    } else if (cells[colIndex]) {
        // Fallback to text content if no input exists
        cells[colIndex].textContent = value;
    }
}

// Backward compatibility wrappers
const calculatePage1ColumnStats = (tableBody, index) => calculateColumnStats(tableBody, index);
const calculatePage2ColumnStats = (tableBody, index) => calculateColumnStats(tableBody, index);
const calculateSummaryStatistics = (tableBody) => calculateColumnStats(tableBody);
const forceRecalculateAllSummaryStatistics = () => {
    ['testingTableBody', 'testingTableBody2'].forEach(id => {
        const tb = document.getElementById(id);
        if (tb) calculateColumnStats(tb);
    });
};


/**
 * Iterates through all existing table rows to bind validation logic.
 * Essential for populating data from the database or after deep DOM changes.
 */
function applyValidationToExistingInputs() {
    ['testingTableBody', 'testingTableBody2'].forEach(tableId => {
        const tableBody = document.getElementById(tableId);
        if (!tableBody) return;

        const config = COLUMN_CONFIG[tableId];
        if (!config) return;

        tableBody.querySelectorAll('tr').forEach(row => {
            const firstCell = row.querySelector('td');
            if (!firstCell || ['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim())) return;

            row.querySelectorAll('input').forEach((input, index) => {
                const colConfig = config[index];
                if (!colConfig) return;

                if (colConfig.type === 'lotRoll') {
                    applyLotRollValidation(input);
                } else if (colConfig.type === 'rollID') {
                    applyRollIDValidation(input);
                } else if (colConfig.type === 'lotTime') {
                    applyLotTimeValidation(input);
                } else if (colConfig.type === 'readonly') {
                    input.readOnly = true;
                    input.style.backgroundColor = 'transparent';
                    input.style.color = '#000000';
                } else {
                    setupNumericValidator(input, tableId, index);
                    if (colConfig.oos) applyOOSValidation(input, colConfig.oos);
                    if (colConfig.isModulus) calculateModulusAverage(input);
                }

                if (colConfig.isModulusAvg) {
                    input.readOnly = true;
                    input.style.backgroundColor = 'transparent';
                }
            });
        });
        calculateColumnStats(tableBody);
    });
}


// ===== CELL HIGHLIGHTING =====
// Track currently highlighted cell
let highlightedCell = null;

function clearCellHighlighting() {
    if (highlightedCell) {
        highlightedCell.classList.remove('highlighted');
        highlightedCell = null;
    }
}

function highlightCell(cell) {
    if (highlightedCell) highlightedCell.classList.remove('highlighted');
    if (cell) {
        cell.classList.add('highlighted');
        highlightedCell = cell;
        const input = cell.querySelector('input');
        if (input) input.focus();
    }
}

/**
 * Enables an Excel-like interaction model for the data tables.
 * Provides visual highlighting on click and binds keyboard navigation 
 * to handle rapid data entry without using the mouse.
 */
function addCellHighlighting() {
    const allTables = getAllTableBodies();
    allTables.forEach(tableBody => {
        const cells = Array.from(tableBody.querySelectorAll('td')).filter(cell => {
            const firstCell = cell.closest('tr').querySelector('td');
            return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
        });

        cells.forEach(cell => {
            cell.addEventListener('click', (e) => {
                e.preventDefault();
                highlightCell(cell);
            });

            const input = cell.querySelector('input');
            if (input) {
                input.addEventListener('keydown', (e) => {
                    if (isViewMode()) return;
                    handleKeyboardNavigation(e, cell);
                });
            }
        });
    });
}

/**
 * Manages custom arrow key and enter navigation across table cells.
 * This overrides browser defaults to allow operators to navigate row-by-row
 * or column-by-column, increasing data entry efficiency.
 */
function handleKeyboardNavigation(e, currentCell) {
    const allTables = getAllTableBodies();
    let allCells = [];

    allTables.forEach(tableBody => {
        const dataCells = Array.from(tableBody.querySelectorAll('td')).filter(cell => {
            const firstCell = cell.closest('tr').querySelector('td');
            return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
        });
        allCells = allCells.concat(dataCells);
    });

    const currentIndex = allCells.indexOf(currentCell);
    let nextCell = null;
    const currentTable = currentCell.closest('tbody');
    const columnsPerRow = currentTable.id === 'testingTableBody' ? 12 : 11;

    switch (e.key) {
        case 'Tab':
            e.preventDefault();
            const pageCells = allCells.filter(c => c.closest('tbody') === currentTable);
            const pageIndex = pageCells.indexOf(currentCell);
            nextCell = e.shiftKey ?
                pageCells[(pageIndex - 1 + pageCells.length) % pageCells.length] :
                pageCells[(pageIndex + 1) % pageCells.length];
            break;
        case 'ArrowUp':
            e.preventDefault();
            nextCell = allCells[currentIndex - columnsPerRow] || currentCell;
            break;
        case 'ArrowDown':
            e.preventDefault();
            nextCell = allCells[currentIndex + columnsPerRow] || currentCell;
            break;
        case 'ArrowLeft':
            e.preventDefault();
            nextCell = allCells[currentIndex - 1] || currentCell;
            break;
        case 'ArrowRight':
            e.preventDefault();
            nextCell = allCells[currentIndex + 1] || currentCell;
            break;
        case 'Enter':
            e.preventDefault();
            nextCell = allCells[currentIndex + columnsPerRow] || currentCell;
            break;
    }

    if (nextCell && nextCell.closest('tbody') === currentTable) highlightCell(nextCell);
}

function addHighlightingToRow(row) {
    const firstCell = row.querySelector('td');
    if (firstCell && ['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim())) return;

    row.querySelectorAll('td').forEach(cell => {
        cell.addEventListener('click', () => highlightCell(cell));
        const input = cell.querySelector('input');
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (isViewMode()) return;
                handleKeyboardNavigation(e, cell);
            });
        }
    });
}


// ===== FORM INITIALIZATION =====
// Function to update tab order for all rows in a table
/**
 * Recalculates tabIndex values for all inputs in the table.
 * This ensures that a natural "left-to-right, top-to-bottom" tab flow 
 * is maintained even after rows are dynamically added or deleted.
 */
function updateTabOrderForAllRows(tableBody) {
    const dataRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
        const firstCell = row.querySelector('td');
        return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
    });

    let columnCount;
    if (tableBody.id === 'testingTableBody') {
        columnCount = 12;
    } else if (tableBody.id === 'testingTableBody2') {
        columnCount = 11;
    } else {
        columnCount = 7;
    }

    dataRows.forEach((row, rowIndex) => {
        const inputs = row.querySelectorAll('input');
        inputs.forEach((input, columnIndex) => {
            const tabIndex = rowIndex * columnCount + columnIndex;
            input.tabIndex = tabIndex;
        });
    });
}

// ===== TABLE OPERATIONS =====
// Function to add rows to any table
function addRowsToTable(tableBody, n) {
    const summaryRows = [];
    const rows = Array.from(tableBody.querySelectorAll('tr'));
    rows.forEach(row => {
        const firstCell = row.querySelector('td');
        if (firstCell && ['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim())) {
            summaryRows.push(row);
            row.remove();
        }
    });

    const isPage1 = tableBody.id === 'testingTableBody';
    const isPage2 = tableBody.id === 'testingTableBody2';

    let columnCount = isPage2 ? 11 : 12;
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < n; i++) {
        const tr = document.createElement('tr');
        tr.className = 'border border-gray-800 px-3 py-2 text-center';

        for (let j = 0; j < columnCount; j++) {
            const td = document.createElement('td');
            td.className = 'testing-table-cell';
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'testing-input';

            const colConfig = COLUMN_CONFIG[tableBody.id]?.[j];
            if (colConfig) {
                if (colConfig.type === 'lotRoll') applyLotRollValidation(input);
                else if (colConfig.type === 'rollID') applyRollIDValidation(input);
                else if (colConfig.type === 'lotTime') applyLotTimeValidation(input);
                else if (colConfig.type === 'readonly') {
                    input.readOnly = true;
                    input.style.backgroundColor = 'transparent';
                    input.style.color = '#000000';
                } else {
                    setupNumericValidator(input, tableBody.id, j);
                }
            }

            input.addEventListener('input', function () {
                if (isViewMode()) return;
                debouncedSave();
            });

            td.appendChild(input);
            tr.appendChild(td);
        }

        addHighlightingToRow(tr);
        fragment.appendChild(tr);
    }

    tableBody.appendChild(fragment);
    updateTabOrderForAllRows(tableBody);

    summaryRows.forEach(row => {
        tableBody.appendChild(row);
    });

    if (currentFormId) {
        reloadDataForTable(tableBody);
    }
    synchronizeViewModeAcrossPages();
}

// Reload data for a specific table after rows are added
async function reloadDataForTable(tableBody) {


    if (!currentFormId) {

        return;
    }

    try {
        // Get the current form data from database
        const { data, error } = await supabase
            .from('214_18_micro_white')
            .select('*')
            .eq('form_id', currentFormId)
            .single();

        if (error) {
            console.error('🔄 [RELOAD] Error fetching data:', error);
            return;
        }

        if (!data) {

            return;
        }



        // Reload data using Generic Mapping
        const tableMapping = DATA_LOAD_MAPPING.filter(m => m.tableId === tableBody.id);

        tableMapping.forEach(mapping => {
            if (data[mapping.dbField]) {
                loadColumnDataToTable(tableBody, mapping.colIndex, data[mapping.dbField]);
            }
        });

        // Calculate summary stats
        if (typeof calculateColumnStats === 'function') {
            calculateColumnStats(tableBody);
        }



    } catch (error) {
        console.error('🔄 [RELOAD] Error reloading data:', error);
    }
}

// Function to delete rows from any table
function deleteRowsFromTable(tableBody, n) {


    // Get all data rows (excluding summary rows)
    const allRows = Array.from(tableBody.querySelectorAll('tr'));
    const dataRows = allRows.filter(row => {
        const firstCell = row.querySelector('td');
        return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
    });

    // Delete the last n rows
    const rowsToDelete = Math.min(n, dataRows.length);
    for (let i = 0; i < rowsToDelete; i++) {
        const rowToDelete = dataRows[dataRows.length - 1 - i];
        if (rowToDelete) {
            rowToDelete.remove();
        }
    }

    // Save the updated table state to database after deleting rows

    // Force immediate save to ensure deleted data is removed from database
    debouncedSave();

    // Clear cache since table structure changed
    clearTableCache(tableBody);

    // Recalculate summary statistics for Pages 2, 3 and 4 after deleting rows
    // Recalculate summary statistics for Page 2 after deleting rows
    if (tableBody.id === 'testingTableBody2') {
        calculateSummaryStatistics(tableBody);
    }

    // Force immediate recalculation of ALL summary statistics across all pages
    forceRecalculateAllSummaryStatistics();

    // Also use debounced save for efficiency
    debouncedSave();

    // Re-apply view mode styling after deleting rows
    synchronizeViewModeAcrossPages();
}

// Load data from database when page loads
async function loadDataFromDatabase() {
    try {
        if (!currentFormId) return;

        const { data, error } = await supabase
            .from('214_18_micro_white')
            .select('*')
            .eq('form_id', currentFormId)
            .single();

        if (error || !data) return;

        currentLotNo = data.lot_no;

        // Load all data (Header, View mode, Tables, Statistics)
        loadAllFormData(data);

        // Handle dynamic rows
        loadRowCountFromDatabase(data);

        // Load equipment selections & pre-store
        setTimeout(() => {
            loadEquipmentSelections(data);
            updateEquipmentHighlighting();
            applyOOSValidationToAllInputs();
            loadPreStoreData(data);
        }, 500);

    } catch (error) {
        console.error('💾 [DATABASE] Error loading data:', error);
    }
}


// Load all form data (header + tables) from the database object
function loadAllFormData(data) {
    if (!data) return;

    // 1. Load Header Inputs
    const selectors = {
        'input[placeholder="Enter Product Code"]': data.product_code,
        'input[placeholder="Enter Prod. Order"]': data.production_order,
        'input[placeholder="Enter Machine"]': data.machine_no,
        'input[placeholder="Enter Specification"]': data.specification,
        'input[placeholder="Enter PO"]': data.purchase_order,
        'input[placeholder="Enter Quantity"]': data.quantity
    };

    Object.entries(selectors).forEach(([selector, value]) => {
        if (value === undefined) return;
        const input = document.querySelector(selector);
        if (input) input.value = value;
    });

    // 2. Handle Date Inputs specifically
    const dateInputs = document.querySelectorAll('input[type="date"]');
    if (data.production_date && dateInputs[0]) {
        dateInputs[0].value = new Date(data.production_date).toISOString().split('T')[0];
    }
    const inspectionDateInput = Array.from(dateInputs).find(input =>
        input.closest('td')?.previousElementSibling?.textContent.includes('Inspection Date')
    );
    if (data.inspection_date && inspectionDateInput) {
        inspectionDateInput.value = new Date(data.inspection_date).toISOString().split('T')[0];
    }

    // 3. Update View Mode Elements
    const viewMappings = {
        'view-product-code': data.product_code,
        'view-production-order': data.production_order,
        'view-machine-no': data.machine_no,
        'view-specification': data.specification,
        'view-quantity': data.quantity,
        'view-customer': data.customer,
        'view-location': data.location,
        'view-pallet-size': data.pallet_size,
        'view-batch': data.batch,
        'view-ref-no': data.ref_no,
        'view-standard-packing': data.standard_packing,
        'view-prestore-done-by': data.prestore_done_by
    };

    Object.entries(viewMappings).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el && value) el.textContent = value;
    });

    if (data.production_date && document.getElementById('view-production-date')) {
        document.getElementById('view-production-date').textContent = new Date(data.production_date).toLocaleDateString('en-GB');
    }
    if (data.inspection_date && document.getElementById('view-inspection-date')) {
        document.getElementById('view-inspection-date').textContent = new Date(data.inspection_date).toLocaleDateString('en-GB');
    }

    // 4. Load Table Data using Generic Mapping
    DATA_LOAD_MAPPING.forEach(mapping => {
        if (data[mapping.dbField]) {
            const tableBody = document.getElementById(mapping.tableId);
            if (tableBody) loadColumnDataToTable(tableBody, mapping.colIndex, data[mapping.dbField]);
        }
    });

    // 5. Trigger statistics calculation
    forceRecalculateAllSummaryStatistics();
}


// Load row count from database and add rows if needed
function loadRowCountFromDatabase(data) {
    // Calculate how many rows we need based on the data
    let page1RowsNeeded = 0;
    let page2RowsNeeded = 0;

    // Iterate through mapped fields to find max row index
    DATA_LOAD_MAPPING.forEach(mapping => {
        if (data[mapping.dbField] && typeof data[mapping.dbField] === 'object') {
            const maxRow = Math.max(...Object.keys(data[mapping.dbField]).map(key => parseInt(key)).filter(num => !isNaN(num)));

            if (mapping.tableId === 'testingTableBody') {
                page1RowsNeeded = Math.max(page1RowsNeeded, maxRow);
            } else if (mapping.tableId === 'testingTableBody2') {
                page2RowsNeeded = Math.max(page2RowsNeeded, maxRow);
            }
        }
    });

    // Add rows to Page 1 if needed
    if (page1RowsNeeded > 0) {
        const currentPage1Rows = getCurrentDataRowCount(testingTableBody);
        const rowsToAddPage1 = Math.max(0, page1RowsNeeded - currentPage1Rows);
        if (rowsToAddPage1 > 0) {
            addRowsToTable(testingTableBody, rowsToAddPage1);
        }
    }

    // Add rows to Page 2 if needed
    if (page2RowsNeeded > 0) {
        const currentPage2Rows = getCurrentDataRowCount(testingTableBody2);
        const rowsToAddPage2 = Math.max(0, page2RowsNeeded - currentPage2Rows);
        if (rowsToAddPage2 > 0) {
            addRowsToTable(testingTableBody2, rowsToAddPage2);
        }
    }

    // Update row count displays
    updateAllRowCounts();
}

// Function to sync sample data changes from Page 1 to Page 2 in real-time (like 16 GSM Kranti)
/**
 * Propagates sample identifiers from Page 1 to Page 2 in real-time.
 * This reactive link ensures that fundamental traceability data (Lot, Roll ID, Time)
 * stays synchronized across all form pages without redundant entry.
 */
function syncSampleDataToOtherPages(rowIndex, columnIndex, newValue) {
    const otherTableBodies = [testingTableBody2];

    otherTableBodies.forEach(tableBody => {
        let dataRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
            const firstCell = row.querySelector('td');
            return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
        });

        if (rowIndex >= dataRows.length) {
            const rowsToAdd = rowIndex + 1 - dataRows.length;
            if (rowsToAdd > 0) {
                addRowsToTable(tableBody, rowsToAdd);
            }
            dataRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
                const firstCell = row.querySelector('td');
                return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
            });
        }

        if (dataRows[rowIndex]) {
            const inputs = dataRows[rowIndex].querySelectorAll('input');
            let targetColumnIndex = columnIndex;

            if (columnIndex <= 2) {
                targetColumnIndex = columnIndex;
            }

            if (inputs[targetColumnIndex]) {
                inputs[targetColumnIndex].value = newValue;
            }
        }
    });
}

// Load column data from JSONB into table inputs
// Load column data from JSONB into table inputs
function loadColumnDataToTable(tableBody, inputIndex, jsonbData) {
    if (!jsonbData || typeof jsonbData !== 'object') return;

    // Get all data rows (excluding summary rows)
    const dataRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
        const firstCell = row.querySelector('td');
        return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
    });

    // Load data into each row
    Object.keys(jsonbData).forEach(key => {
        const rowIndex = parseInt(key) - 1; // Convert to 0-based index
        if (rowIndex >= 0 && rowIndex < dataRows.length) {
            const row = dataRows[rowIndex];
            const inputs = row.querySelectorAll('input');
            const input = inputs[inputIndex];

            if (input) {
                input.value = jsonbData[key] || '';

                // Apply OOS validation if configured
                const config = COLUMN_CONFIG[tableBody.id]?.[inputIndex];
                if (config) {
                    if (config.oos) applyOOSValidation(input, config.oos);

                    // Trigger statistics updates
                    if (config.isModulus) calculateModulusAverage(input);
                    if (config.stats && typeof calculateColumnStats === 'function') {
                        calculateColumnStats(tableBody, inputIndex);
                    }
                }
            }
        }
    });
}

// Load equipment selections from database
function loadEquipmentSelections(data) {
    if (data.equipment_used && typeof data.equipment_used === 'object') {
        const equipment = data.equipment_used;

        // Iterate through equipment mapping
        Object.keys(EQUIPMENT_MAPPING).forEach(page => {
            if (equipment[page] && EQUIPMENT_MAPPING[page]) {
                EQUIPMENT_MAPPING[page].forEach(item => {
                    if (equipment[page][item.field]) {
                        const dropdown = document.getElementById(item.id);
                        if (dropdown) {
                            dropdown.value = equipment[page][item.field];
                        }
                    }
                });
            }
        });
    }

    // Apply equipment highlighting after loading
    updateEquipmentHighlighting();
}

// Load pre-store data from database
function loadPreStoreData(data) {


    // Load all Pre-Store fields
    const prestoreFields = [
        { dbField: 'production_order', viewId: 'view-production-order' },
        { dbField: 'product_code', viewId: 'view-product-code' },
        { dbField: 'specification', viewId: 'view-specification' },
        { dbField: 'pallet_size', viewId: 'view-pallet-size' },
        { dbField: 'customer', viewId: 'view-customer' },
        { dbField: 'location', viewId: 'view-location' },
        { dbField: 'machine_no', viewId: 'view-machine-no' },
        { dbField: 'quantity', viewId: 'view-quantity' },
        { dbField: 'production_date', viewId: 'view-production-date' },
        { dbField: 'inspection_date', viewId: 'view-inspection-date' },
        { dbField: 'standard_packing', viewId: 'view-standard-packing' },
        { dbField: 'batch', viewId: 'view-batch' },
        { dbField: 'ref_no', viewId: 'view-ref-no' },
        { dbField: 'prestore_done_by', viewId: 'view-prestore-done-by' },
        { dbField: 'pallet_list', viewId: 'view-pallet-list' },
        { dbField: 'product_label', viewId: 'view-product-label' },
        { dbField: 'wrapping', viewId: 'view-wrapping' },
        { dbField: 'layer_pad', viewId: 'view-layer-pad' },
        { dbField: 'contamination', viewId: 'view-contamination' },
        { dbField: 'kraft_paper', viewId: 'view-kraft-paper' },
        { dbField: 'no_damage', viewId: 'view-no-damage' },
        { dbField: 'pallet', viewId: 'view-pallet' },
        { dbField: 'remarks', viewId: 'view-remarks' }
    ];

    // Populate all Pre-Store fields
    prestoreFields.forEach(field => {
        if (data[field.dbField]) {
            const element = document.getElementById(field.viewId);
            if (element) {
                // Handle date formatting for date fields
                if (field.dbField === 'production_date' || field.dbField === 'inspection_date') {
                    element.textContent = new Date(data[field.dbField]).toLocaleDateString('en-GB');
                } else {
                    element.textContent = data[field.dbField];
                }

                // Apply color coding for Palletized Finished Goods Status fields
                const statusFields = ['pallet_list', 'product_label', 'wrapping', 'layer_pad', 'contamination', 'kraft_paper', 'no_damage', 'pallet'];
                if (statusFields.includes(field.dbField)) {
                    applyStatusStyling(element, data[field.dbField]);
                }


            } else {
                console.warn(`📦 [PRESTORE] View element not found: ${field.viewId}`);
            }
        }
    });

    // Handle JSONB fields (lot_and_roll, roll_id, lot_time)
    if (data.lot_and_roll) {

        const lotAndRollElement = document.getElementById('view-lot-and-roll');
        if (lotAndRollElement) {
            lotAndRollElement.textContent = typeof data.lot_and_roll === 'object' ? JSON.stringify(data.lot_and_roll) : data.lot_and_roll;
        }
    }

    if (data.roll_id) {

        const rollIdElement = document.getElementById('view-roll-id');
        if (rollIdElement) {
            rollIdElement.textContent = typeof data.roll_id === 'object' ? JSON.stringify(data.roll_id) : data.roll_id;
        }
    }

    if (data.lot_time) {

        const lotTimeElement = document.getElementById('view-lot-time');
        if (lotTimeElement) {
            lotTimeElement.textContent = typeof data.lot_time === 'object' ? JSON.stringify(data.lot_time) : data.lot_time;
        }
    }


}

// Function to apply colored background styling to status values (like 16 GSM Kranti)
function applyStatusStyling(element, statusValue) {
    if (!element || !statusValue) return;

    // Remove any existing background classes
    element.classList.remove('bg-green-100', 'bg-red-100', 'bg-orange-100', 'text-green-800', 'text-red-800', 'text-orange-800', 'rounded-full');

    const status = statusValue.toString().toLowerCase().trim();

    if (status === 'accept') {
        element.classList.add('bg-green-100', 'text-green-800', 'rounded-full');
    } else if (status === 'reject') {
        element.classList.add('bg-red-100', 'text-red-800', 'rounded-full');
    } else if (status === 'n/a' || status === 'na') {
        element.classList.add('bg-orange-100', 'text-orange-800', 'rounded-full');
    }
}

// Load historical data for new form
async function loadHistoricalDataForNewForm() {


    try {
        const productCodeInput = document.querySelector('input[name="product_code"]') ||
            document.querySelector('#productCodeInput') ||
            document.querySelector('input[placeholder*="Product Code"]');
        const machineInput = document.querySelector('input[name="machine"]') ||
            document.querySelector('input[placeholder="Enter Machine"]');
        const productionDateInput = document.querySelector('input[name="production_date"]') ||
            document.querySelector('table input[type="date"]') ||
            document.querySelector('input[type="date"]');



        if (!productCodeInput || !machineInput || !productionDateInput) {

            return;
        }

        const productCode = productCodeInput.value.trim();
        const machineNo = machineInput.value.trim();
        const productionDate = productionDateInput.value;





        if (!productCode || !machineNo || !productionDate) {

            return;
        }

        // Calculate previous date (local, avoid UTC shift)
        const currentDate = new Date(`${productionDate}T00:00:00`);
        const previousDate = new Date(currentDate);
        previousDate.setDate(previousDate.getDate() - 1);
        const previousDateStr = [
            previousDate.getFullYear(),
            String(previousDate.getMonth() + 1).padStart(2, '0'),
            String(previousDate.getDate()).padStart(2, '0')
        ].join('-');



        // First try to find data from previous day with matching criteria

        const { data: historicalData, error } = await supabase
            .from('214_18_micro_white')
            .select('*')
            .eq('product_code', productCode)
            .eq('machine_no', machineNo)
            .eq('production_date', previousDateStr)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();



        if (error || !historicalData) {


            // If no data for previous date, find most recent form with same product + machine
            const { data: recentData, error: recentError } = await supabase
                .from('214_18_micro_white')
                .select('*')
                .eq('product_code', productCode)
                .eq('machine_no', machineNo)
                .lt('production_date', productionDate)
                .order('production_date', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (recentError || !recentData) {

                return;
            }


            // Load most recent historical data
            await loadHistoricalDataIntoForm(recentData);
        } else {

            // Load previous day's data
            await loadHistoricalDataIntoForm(historicalData);
        }

    } catch (error) {
        console.error('📚 [HISTORICAL] Error loading historical data:', error);
    }
}

// Load historical data into form with dynamic row allocation (like 16 GSM Kranti)
/**
 * Populates the form using historical records while reserving space for new data.
 * Splits the 30-row table into a "Historical" section (top) and "Fresh" section (bottom).
 * This allows the operator to reference the previous shift's data while entering new results.
 * @param {Object} historicalData - Database payload from the previous record.
 */
async function loadHistoricalDataIntoForm(historicalData) {
    try {
        const numRowsInput = document.getElementById('numRowsInput');
        const requestedRows = parseInt(numRowsInput?.value, 10) || 12;
        const availableForHistorical = 30 - requestedRows;

        loadHistoricalDataIntoTopRows(historicalData, availableForHistorical);
        clearBottomRowsForFreshData(requestedRows);

        calculatePage1ColumnStats(testingTableBody);
        calculatePage2ColumnStats(testingTableBody2);
        forceRecalculateAllSummaryStatistics();

        applyOOSValidationToAllInputs();
        applyValidationToExistingInputs();

        await autoSaveToDatabase();

    } catch (error) {
        console.error('📚 [HISTORICAL] Error loading historical data into form:', error);
    }
}

// Function to add event listeners to existing input fields for real-time calculation
// function addAverageCalculationListeners() { ... } // Deleted as redundant

// Missing validation functions (placeholders)

/**
 * Protects aggregate rows from manual modification.
 * Since statistics are calculated automatically from raw data, 
 * disabling these inputs prevents accidental data skew.
 */
function makeSummaryRowsUneditable() {
    const allTables = getAllTableBodies();
    allTables.forEach(tableBody => {
        if (!tableBody) return;

        const summaryRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
            const firstCell = row.querySelector('td');
            return firstCell && ['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
        });

        summaryRows.forEach(row => {
            const inputs = row.querySelectorAll('input');
            inputs.forEach(input => {
                input.disabled = true;
                input.readOnly = true;
                input.style.backgroundColor = '#f3f4f6';
                input.style.color = '#6b7280';
            });
        });
    });
}

// ===== HELPER FUNCTIONS =====
// Get current data row count (excluding summary rows)
function getCurrentDataRowCount(tableBody) {
    if (!tableBody) return 0;
    const dataRows = tableBody.querySelectorAll('tr').length - 3; // Subtract 3 for summary rows
    return Math.max(0, dataRows);
}

// Consolidated row count update
function updateAllRowCounts() {
    ['testingTableBody', 'testingTableBody2'].forEach((id, i) => {
        const tb = document.getElementById(id);
        const display = document.getElementById(`rowCountDisplay${i === 0 ? '' : '2'}`);
        if (tb && display) {
            display.textContent = `Rows: ${getCurrentDataRowCount(tb)}`;
        }
    });
}
const updateRowCount = updateAllRowCounts;
const updateRowCountByPage = updateAllRowCounts;


// Clear bottom rows for fresh data entry
function clearBottomRowsForFreshData(requestedRows) {


    const allTables = getAllTableBodies();
    allTables.forEach(tableBody => {
        if (!tableBody) return;

        // Get all data rows (excluding summary rows)
        const dataRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
            const firstCell = row.querySelector('td');
            return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
        });

        // Clear the last requestedRows rows
        const startIndex = Math.max(0, dataRows.length - requestedRows);
        for (let i = startIndex; i < dataRows.length; i++) {
            const row = dataRows[i];
            const inputs = row.querySelectorAll('input');
            inputs.forEach(input => {
                if (input.value !== '') {
                    input.value = '';
                }
            });
        }


    });
}

// ===== INITIALIZATION =====
// Initialize everything when page loads
/**
 * Core initialization block executed on page load.
 * Bootstraps the application state, binds UI listeners, and enforces 
 * read-only constraints on the document header.
 */
document.addEventListener('DOMContentLoaded', async function () {
    testingTableBody = document.getElementById('testingTableBody');
    testingTableBody2 = document.getElementById('testingTableBody2');

    initializeSession();
    setupViewMode();
    setupHistoricalDataTrigger();

    const headerTable = document.querySelector('.modern-header-table');
    if (headerTable) {
        const productCodeInput = document.querySelector('input[placeholder="Enter Product Code"]');
        const productionOrderInput = document.querySelector('input[placeholder="Enter Prod. Order"]');
        const machineInput = document.querySelector('input[placeholder="Enter Machine"]');
        const productionDateInput = document.querySelector('input[type="date"]:nth-of-type(1)');
        const specificationInput = document.querySelector('input[placeholder="Enter Specification"]');
        const poInput = document.querySelector('input[placeholder="Enter PO"]');
        const quantityInput = document.querySelector('input[placeholder="Enter Quantity"]');

        let inspectionDateInput = document.querySelector('input[type="date"]:nth-of-type(2)') ||
            document.querySelector('input[placeholder*="Inspection"]');

        const headerFields = [
            productCodeInput, productionOrderInput, machineInput, productionDateInput,
            specificationInput, poInput, quantityInput, inspectionDateInput
        ];

        headerFields.forEach(field => {
            if (field) {
                field.readOnly = true;
                field.style.cursor = 'default';
                field.style.fontSize = '16px';
                field.style.fontWeight = '500';
                field.style.color = '#000000';
                field.style.opacity = '1';
                field.title = 'This field is read-only';
            }
        });
    }

    loadQCEquipmentDropdowns();
    initializeVerification();
    initializeApproval();
    addCellHighlighting();

    const allTables = getAllTableBodies();
    allTables.forEach(tableBody => {
        if (tableBody) updateTabOrderForAllRows(tableBody);
    });

    const addRowsBtn = document.getElementById('addNewRowsBtn');
    const deleteRowsBtn = document.getElementById('deleteRowsBtn');
    const numRowsInput = document.getElementById('numRowsInput');

    if (addRowsBtn) {
        addRowsBtn.addEventListener('click', async function () {
            if (isViewMode()) return;

            const requestedRows = parseInt(numRowsInput?.value, 10) || 12;
            const currentRows = getCurrentDataRowCount(testingTableBody);
            const rowsToAdd = 30 - currentRows;

            if (rowsToAdd > 0) {
                addRowsToTable(testingTableBody, rowsToAdd);
                addRowsToTable(testingTableBody2, rowsToAdd);
                updateRowCount();
                updateRowCountByPage(2);
            }

            await loadHistoricalDataForNewForm();
            clearBottomRowsForFreshData(requestedRows);
            await autoSaveToDatabase();
        });
    }

    if (deleteRowsBtn) {
        deleteRowsBtn.addEventListener('click', function () {
            if (isViewMode()) return;

            const rowsToDelete = parseInt(numRowsInput?.value, 10) || 1;
            const page1Rows = Array.from(testingTableBody.querySelectorAll('tr')).filter(row => {
                const firstCell = row.querySelector('td');
                return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
            });

            const page2Rows = Array.from(testingTableBody2.querySelectorAll('tr')).filter(row => {
                const firstCell = row.querySelector('td');
                return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
            });

            const rowsToDeleteCount = Math.min(rowsToDelete, page1Rows.length, page2Rows.length);
            for (let i = 0; i < rowsToDeleteCount; i++) {
                page1Rows[page1Rows.length - 1 - i].remove();
                page2Rows[page2Rows.length - 1 - i].remove();
            }

            debouncedSave();
            clearTableCache(testingTableBody);
            clearTableCache(testingTableBody2);
            updateRowCount();
            updateRowCountByPage(2);
            forceRecalculateAllSummaryStatistics();
        });
    }

    if (currentFormId) {
        await loadDataFromDatabase();
    }

    setTimeout(() => { synchronizeViewModeAcrossPages(); }, 100);
    setTimeout(() => { synchronizeViewModeAcrossPages(); }, 500);

    updateRowCount();
    updateAllRowCounts();
    makeSummaryRowsUneditable();
    applyValidationToExistingInputs();

    calculatePage1ColumnStats(document.getElementById('testingTableBody'));
    calculatePage2ColumnStats(document.getElementById('testingTableBody2'));

    document.addEventListener('click', function (e) {
        const isTableCell = e.target.closest('td') || e.target.closest('th');
        const isTableInput = e.target.classList.contains('testing-input');
        if (!isTableCell && !isTableInput) clearCellHighlighting();
    });
});

// Clear cache for a specific table after structural changes
function clearTableCache(tableBody) {
    if (!tableBody) return;

    // Remove any stored data specific to this table
    const tableId = tableBody.id;

    // Example cache clearing (adjust based on actual caching mechanism)
    try {
        // Clear any localStorage or sessionStorage related to this table
        localStorage.removeItem(`${tableId}_data`);
        sessionStorage.removeItem(`${tableId}_data`);
    } catch (error) {
        console.warn(`🧹 [CACHE] Error clearing cache for ${tableId}:`, error);
    }

    // Trigger any necessary UI updates or recalculations
    updateRowCount();

    // Recalculate summary statistics if needed
    if (tableBody.id === 'testingTableBody2') {
        calculateSummaryStatistics(tableBody);
    }
}
