// Supabase integration for auto-saving to database

// Modulus average calculation no longer needed for new table structure
// NOTE: Event listeners are consolidated to minimize redundancy:
// - Use addConsolidatedInputListener() for table cell inputs (handles: auto-save, validation, sync)
// - Use setApprovalFormState() for approval UI state (handles: enable/disable logic in one place)
// - Use detectViewMode() once per page load (cached in global viewMode variable)
import { supabase } from '../../supabase-config.js';

// Ensure consistent, stable rounding across browsers and avoid floating-point edge cases
// (e.g. 12.75 displaying as 12.7 due to 12.749999999...)
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

// ===== VERIFICATION FUNCTIONALITY =====
const VERIFICATION_PASSWORD = "QC-2256"; // Verification password for form verification
const APPROVAL_PASSWORD = "QA-2256"; // Approval password for form approval

// Date formatting function
function formatDateToDDMMYYYY(dateString) {
    if (!dateString) return '';
    
    // Handle both YYYY-MM-DD and DD/MM/YYYY formats
    let date;
    if (dateString.includes('/')) {
        // Already in DD/MM/YYYY format
        return dateString;
    } else {
        // Convert from YYYY-MM-DD to DD/MM/YYYY
        date = new Date(dateString);
    }
    
    if (isNaN(date.getTime())) {
        return dateString; // Return original if invalid
    }
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
}

// Get form details for confirmation popup (fast version)
function getFormDetailsForConfirmation() {
    try {
        // Get product code from form
        const productCodeInput = document.querySelector('input[placeholder*="Product Code"]') || 
                                document.querySelector('input[name="product_code"]') ||
                                document.querySelector('#product-code') ||
                                document.querySelector('input[value*="APE"]');
        const productName = productCodeInput ? productCodeInput.value : 'N/A';
        
        // Get production date from form
        const productionDateInput = document.querySelector('input[type="date"]') ||
                                   document.querySelector('input[name="production_date"]') ||
                                   document.querySelector('#production-date');
        const productionDate = productionDateInput ? formatDateToDDMMYYYY(productionDateInput.value) : 'N/A';
        
        // Get inspection date from form (second date input)
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

// Verification functions
async function getCurrentUser() {
    try {
        // Get the logged-in user from Supabase auth
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return "Unknown User";
        }
        
        // Get user's full name from database
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

async function updateVerificationInDatabase(verifierName, verificationDate) {
    try {
        // Get the current form ID
        const formId = getCurrentFormId();
        if (!formId) {
            console.error('No form ID found');
            alert('Error: Could not identify the form. Please refresh and try again.');
            return;
        }
        
        // Update the database with verification data
        const { data, error } = await supabase
            .from('uc-18gsm-250w-bfqr')
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
        
        // Verification data saved successfully (no need to check data length)
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
            .from('uc-18gsm-250w-bfqr')
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

function getCurrentFormId() {
    // First try global variable
    if (currentFormId) {
        return currentFormId;
    }
    
    // Try to get form ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const formId = urlParams.get('form_id');
    if (formId) {
        return formId;
    }
    
    // Try to get from session storage
    const storedData = sessionStorage.getItem('filmInspectionData');
    if (storedData) {
        const data = JSON.parse(storedData);
        return data.form_id;
    }
    
    // Try to get from sessionStorage currentFormId
    const sessionFormId = sessionStorage.getItem('currentFormId');
    if (sessionFormId) {
        return sessionFormId;
    }
    
    // Try to get from global variable if available
    if (typeof window.currentFormId !== 'undefined' && window.currentFormId) {
        return window.currentFormId;
    }
    
    console.error('Could not find form ID');
    return null;
}

async function checkVerificationStatus() {
    try {
        // Get the current form ID
        const formId = getCurrentFormId();
        if (!formId) {
            showVerificationForm();
            return;
        }
        
        // Check if the form is already verified - use .maybeSingle() to handle no results gracefully
        const { data, error } = await supabase
            .from('uc-18gsm-250w-bfqr')
            .select('verified_by, verified_date')
            .eq('form_id', formId)
            .maybeSingle();
        
        if (error) {
            // Handle specific error cases
            if (error.code === 'PGRST116') {
                // No rows found - form doesn't exist yet, show verification form
                showVerificationForm();
                return;
            }
            console.error('Error checking verification status:', error);
            showVerificationForm();
            return;
        }
        
        if (data && data.verified_by && data.verified_date) {
            // Form is already verified
            showVerificationStatus();
            document.getElementById('verifiedByDisplay').textContent = 'Verified by: ' + data.verified_by;
            // Format date to DD/MM/YYYY
            const formattedDate = formatDateToDDMMYYYY(data.verified_date);
            document.getElementById('verifiedDateDisplay').textContent = 'Date: ' + formattedDate;
        } else {
            // Form is not verified
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

function showCustomConfirmationPopup(formDetails, currentUser, verificationDate) {
    // Populate the popup with data
    document.getElementById('confirmProductName').textContent = formDetails.productName;
    document.getElementById('confirmProductionDate').textContent = formDetails.productionDate;
    document.getElementById('confirmInspectionDate').textContent = formDetails.inspectionDate;
    document.getElementById('confirmVerifierName').textContent = currentUser;
    document.getElementById('confirmVerificationDate').textContent = formatDateToDDMMYYYY(verificationDate);
    
    // Show the popup
    document.getElementById('verificationConfirmPopup').style.display = 'flex';
    
    // Handle confirm button click
    const confirmBtn = document.getElementById('confirmVerificationBtn');
    if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.onclick = async () => {
            try {
                // Hide popup
                document.getElementById('verificationConfirmPopup').style.display = 'none';
                
                // Update database
                await updateVerificationInDatabase(currentUser, verificationDate);
                
                // Show success message
                alert('Form verified successfully!');
                
                // Update UI to show verification status
                showVerificationStatus();
                document.getElementById('verifiedByDisplay').textContent = 'Verified by: ' + currentUser;
                const formattedDate = formatDateToDDMMYYYY(verificationDate);
                document.getElementById('verifiedDateDisplay').textContent = 'Date: ' + formattedDate;
                
                // Show approval section now that form is verified
                showApprovalSection();
                setApprovalFormState(true);
                showApprovalForm();
                
            } catch (error) {
                console.error('Error during verification:', error);
                alert('Error during verification. Please try again.');
            }
        };
    }
    
    // Handle cancel button click
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
    // Wait for form_id to be available and form to be fully loaded, then check verification status
    const checkVerificationWithRetry = () => {
        const formId = getCurrentFormId();
        if (formId) {
            checkVerificationStatus();
        } else {
            // If form_id not available yet, wait a bit more and try again
            setTimeout(checkVerificationWithRetry, 200);
        }
    };

    // Initial delay, then check with retry logic
    setTimeout(checkVerificationWithRetry, 500);
    
    // Add event listeners for verification form
    const verifyBtn = document.getElementById('verifyFormBtn');
    const cancelBtn = document.getElementById('cancelVerificationBtn');
    const passwordInput = document.getElementById('verificationPassword');
    const togglePasswordBtn = document.getElementById('toggleVerificationPassword');
    
    if (verifyBtn) {
        verifyBtn.addEventListener('click', function() {
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
        cancelBtn.addEventListener('click', function() {
            document.getElementById('verificationPassword').value = '';
            document.getElementById('verificationDate').value = '';
        });
    }
    
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', function() {
            
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

async function checkApprovalStatus() {
    try {
        // Get the current form ID
        const formId = getCurrentFormId();
        if (!formId) {
            hideApprovalSection();
            return;
        }
        
        // Check if the form is already approved - use .maybeSingle() to handle no results gracefully
        const { data, error } = await supabase
            .from('uc-18gsm-250w-bfqr')
            .select('verified_by, approved_by, approved_date')
            .eq('form_id', formId)
            .maybeSingle();
        
        if (error) {
            // Handle specific error cases
            if (error.code === 'PGRST116') {
                // No rows found - form doesn't exist yet, hide approval section
                hideApprovalSection();
                return;
            }
            console.error('Error checking approval status:', error);
            hideApprovalSection();
            return;
        }
        
        // Only enable approval if form is verified
        if (data && data.verified_by) {
            // Form is verified, so show approval section
            showApprovalSection();
            
            if (data.approved_by && data.approved_date) {
                // Form is already approved
                showApprovalStatus();
                document.getElementById('approvedByDisplay').textContent = 'Approved by: ' + data.approved_by;
                // Format date to DD/MM/YYYY
                const formattedDate = formatDateToDDMMYYYY(data.approved_date);
                document.getElementById('approvedDateDisplay').textContent = 'Date: ' + formattedDate;
            } else {
                // Form is verified but not approved yet
                setApprovalFormState(true);
                showApprovalForm();
            }
        } else {
            // Form is not verified yet, HIDE approval section completely
            hideApprovalSection();
        }
        
    } catch (error) {
        console.error('Error checking approval status:', error);
        hideApprovalSection();
    }
}

function showApprovalForm() {
    document.getElementById('approvalForm').style.display = 'block';
    document.getElementById('approvalStatus').style.display = 'none';
}

function showApprovalStatus() {
    document.getElementById('approvalForm').style.display = 'none';
    document.getElementById('approvalStatus').style.display = 'flex';
}

function showApprovalSection() {
    document.getElementById('approvalSection').style.display = 'block';
    document.getElementById('approvalSection').style.opacity = '1';
    document.getElementById('approvalSection').style.pointerEvents = 'auto';
}

function hideApprovalSection() {
    document.getElementById('approvalSection').style.display = 'none';
}

// Unified function to enable/disable approval inputs (consolidated from enableApprovalForm + disableApprovalForm)
function setApprovalFormState(isEnabled) {
    const approvalPassword = document.getElementById('approvalPassword');
    const approvalDate = document.getElementById('approvalDate');
    const approveBtn = document.getElementById('approveFormBtn');
    
    const bgColor = isEnabled ? '' : '#f3f4f6';
    const cursor = isEnabled ? 'pointer' : 'not-allowed';
    const btnBgColor = isEnabled ? '#002E7D' : '#9ca3af';
    
    if (approvalPassword) {
        approvalPassword.disabled = !isEnabled;
        approvalPassword.style.backgroundColor = bgColor;
    }
    if (approvalDate) {
        approvalDate.disabled = !isEnabled;
        approvalDate.style.backgroundColor = bgColor;
    }
    if (approveBtn) {
        approveBtn.disabled = !isEnabled;
        approveBtn.style.cursor = cursor;
        approveBtn.style.backgroundColor = btnBgColor;
    }
}

async function approveForm(approvalDate) {
    try {
        const currentUser = await getCurrentUser();
        const formDetails = getFormDetailsForConfirmation();
        showApprovalConfirmationPopup(formDetails, currentUser, approvalDate);
    } catch (error) {
        console.error('Error during approval:', error);
        alert('Error during approval. Please try again.');
    }
}

function showApprovalConfirmationPopup(formDetails, currentUser, approvalDate) {
    // Populate the popup with data
    document.getElementById('confirmApprovalProductName').textContent = formDetails.productName;
    document.getElementById('confirmApprovalProductionDate').textContent = formDetails.productionDate;
    document.getElementById('confirmApprovalInspectionDate').textContent = formDetails.inspectionDate;
    document.getElementById('confirmApproverName').textContent = currentUser;
    document.getElementById('confirmApprovalDate').textContent = formatDateToDDMMYYYY(approvalDate);
    
    // Show the popup
    const popupElement = document.getElementById('approvalConfirmPopup');
    popupElement.style.display = 'flex';
    
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
                
                // Update UI to show approval status
                showApprovalStatus();
                document.getElementById('approvedByDisplay').textContent = 'Approved by: ' + currentUser;
                const formattedDate = formatDateToDDMMYYYY(approvalDate);
                document.getElementById('approvedDateDisplay').textContent = 'Date: ' + formattedDate;
                
            } catch (error) {
                console.error('Error during approval:', error);
                alert('Error during approval. Please try again.');
            }
        };
    }
    
    // Handle cancel button click in popup
    const cancelBtn = document.getElementById('cancelApprovalPopupBtn');
    if (cancelBtn) {
        cancelBtn.disabled = false;
        cancelBtn.onclick = () => {
            document.getElementById('approvalConfirmPopup').style.display = 'none';
        };
    }
}

// Add event listeners for approval form
function initializeApproval() {
    const approveBtn = document.getElementById('approveFormBtn');
    const approveCancelBtn = document.getElementById('cancelApprovalBtn');
    const approvalPasswordInput = document.getElementById('approvalPassword');
    const toggleApprovalPasswordBtn = document.getElementById('toggleApprovalPassword');
    
    if (approveBtn) {
        approveBtn.addEventListener('click', function() {
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
    
    if (approveCancelBtn) {
        approveCancelBtn.addEventListener('click', function() {
            document.getElementById('approvalPassword').value = '';
            document.getElementById('approvalDate').value = '';
        });
    }
    
    if (toggleApprovalPasswordBtn) {
        toggleApprovalPasswordBtn.addEventListener('click', function() {
            const passwordInput = document.getElementById('approvalPassword');
            const icon = toggleApprovalPasswordBtn.querySelector('i');
            
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
    
    // Enable approval inputs
    if (approvalPasswordInput) {
        approvalPasswordInput.disabled = false;
        approvalPasswordInput.readOnly = false;
    }
    
    const approvalDateInput = document.getElementById('approvalDate');
    if (approvalDateInput) {
        approvalDateInput.disabled = false;
        approvalDateInput.readOnly = false;
    }
    
    if (approveBtn) {
        approveBtn.disabled = false;
    }
    
    if (approveCancelBtn) {
        approveCancelBtn.disabled = false;
    }
    
    if (toggleApprovalPasswordBtn) {
        toggleApprovalPasswordBtn.disabled = false;
    }
    
    // Check approval status with retry logic
    const checkApprovalWithRetry = () => {
        const formId = getCurrentFormId();
        if (formId) {
            checkApprovalStatus();
        } else {
            setTimeout(checkApprovalWithRetry, 200);
        }
    };
    
    setTimeout(checkApprovalWithRetry, 700);
}

    // ===== VIEW MODE DETECTION =====
// Global variable to track view mode
let viewMode = false;

// Global table body references
let testingTableBody;
let testingTableBody2;
let testingTableBody3;

// Function to set form title based on product code
function setFormTitle() {
    const formTitle = document.getElementById('formTitle');
    if (formTitle) {
        // Try to get product code from various sources
        const productCodeInput = document.querySelector('input[placeholder="Enter Product Code"]') ||
                                document.querySelector('input[name="product_code"]') ||
                                document.querySelector('#product-code');

        if (productCodeInput && productCodeInput.value) {
            formTitle.textContent = productCodeInput.value;
        } else {
            formTitle.textContent = 'UC-18gsm-250W-BFQR';
        }
    }
}

// Function to detect and set view mode
function detectViewMode() {
    // Get URL parameters first
    const urlParams = new URLSearchParams(window.location.search);
    const modeParam = urlParams.get('mode');
    const viewParam = urlParams.get('view');
    const viewModeFromStorage = sessionStorage.getItem('viewMode') === 'true';

    // Support both styles:
    // - ?mode=view (current)
    // - ?view=1 / true / on (Kranti style)
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
    const allTableBodies = [testingTableBody, testingTableBody2, testingTableBody3];

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
                    

            // Special handling for Page 2 and 3 sample columns (first 3 columns)
                if ((tableBody.id === 'testingTableBody2' || tableBody.id === 'testingTableBody3') && index <= 2) {
                    const row = input.closest('tr');
                    const rowIndex = row ? Array.from(row.parentElement.children).indexOf(row) : -1;
                    input.style.backgroundColor = '#f1f5f9'; // Light grey background
                    if (rowIndex === 0) {
                        input.style.fontWeight = '';
                    } else {
                        input.style.fontWeight = '600'; // Bold text for all except first row
                    }
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
                        } else if (tableBody.id === 'testingTableBody3') {
                            // Sample columns Lot & Roll, Roll ID, Lot Time correspond to indices 0,1,2
                            if (colIndex >= 0 && colIndex <= 2) {
                                keepReadOnly = true;
                            }
                        } else if (tableBody.id === 'testingTableBody') {
                            // Modulus average column (column 11) must always remain read-only
                            if (colIndex === 11) {
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
function applyInputValidation(input, tableBodyId, columnIndex) {

    
    // Apply specific validation for sample columns (like 16 GSM Kranti)
    if (tableBodyId === 'testingTableBody') {
        if (columnIndex === 0) {
            // Lot & Roll column - apply 16 GSM Kranti validation
            applyLotRollValidation(input);
        } else if (columnIndex === 1) {
            // Roll ID column - apply 16 GSM Kranti validation
            applyRollIDValidation(input);
        } else if (columnIndex === 2) {
            // Lot Time column - apply 16 GSM Kranti validation
            applyLotTimeValidation(input);
        } else if (columnIndex > 2) {
            // Data columns - apply numeric validation and OOS validation
            let value = input.value;
            value = value.replace(/[^0-9.-]/g, '');
            input.value = value;
            
            // Apply OOS validation based on column index
            let columnType = '';
            if (columnIndex === 3) {
                columnType = 'filmWeight'; // Film Weight column
            } else if (columnIndex === 4) {
                columnType = 'thickness'; // Thickness column
            } else if (columnIndex === 5) {
                columnType = 'wettability'; // Wettability column
            } else if (columnIndex === 6) {
                columnType = 'cofRR'; // COF (R-R) column
            } else if (columnIndex === 7) {
                columnType = 'cofCC'; // COF (C-C) column
            } else if (columnIndex === 8) {
                columnType = 'tensileBreak'; // Tensile Break column
            } else if (columnIndex === 9) {
                columnType = 'elongation'; // MD Elongation Break column
            } else if (columnIndex === 10) {
                columnType = 'modulus10'; // 10% Modulus column
            }
            
            if (columnType) {
                applyOOSValidation(input, columnType);
                
                // Add input event listener for real-time OOS validation
                input.addEventListener('input', function() {
                    applyOOSValidation(this, columnType);
                });
            }
        }
    } else if (tableBodyId === 'testingTableBody2') {
        // Page 2 validation
        if (columnIndex === 0) {
            // Lot & Roll column - apply 16 GSM Kranti validation
            applyLotRollValidation(input);
        } else if (columnIndex === 1) {
            // Roll ID column - apply 16 GSM Kranti validation
            applyRollIDValidation(input);
        } else if (columnIndex === 2) {
            // Lot Time column - apply 16 GSM Kranti validation
            applyLotTimeValidation(input);
        } else if (columnIndex > 2) {
            // Data columns - apply numeric validation and OOS validation
            let value = input.value;
            value = value.replace(/[^0-9.-]/g, '');
            input.value = value;
            
            // Apply OOS validation based on column index
            let columnType = '';
            if (columnIndex === 3) {
                columnType = 'tensileBreak'; // Tensile Break
            } else if (columnIndex === 4) {
                columnType = 'cdElongation'; // CD Elongation Break
            } else if (columnIndex === 5) {
                columnType = 'modulus10'; // 10% Modulus
            } else if (columnIndex === 6) {
                columnType = 'opacity'; // Opacity
            } else if (columnIndex === 7) {
                columnType = 'rollWidth'; // Roll Cut Width
            } else if (columnIndex === 8) {
                columnType = 'diameter'; // Diameter
            }
        } else if (tableBodyId === 'testingTableBody3') {
            // Page 3 validation is handled in the main validation section (lines 652-686)
            // Apply OOS validation for Page 3 columns
            if (columnIndex > 2) {
                let columnType = '';
                if (columnIndex === 3) {
                    columnType = 'colourL';
                } else if (columnIndex === 4) {
                    columnType = 'colourA';
                } else if (columnIndex === 5) {
                    columnType = 'colourB';
                } else if (columnIndex === 6) {
                    columnType = 'deltaE';
                } else if (columnIndex === 7) {
                    columnType = 'baseFilmPink';
                }

                if (columnType) {
                    applyOOSValidation(input, columnType);
                }
            }
        }
    }
    

}

// Lot & Roll validation (00-00 format) - from 16 GSM Kranti
function applyLotRollValidation(input) {

    
    input.addEventListener('input', function() {
        validateLotRoll(this);
        debouncedSave();
    });
    
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation(); // Prevent other event handlers from interfering
            formatLotRollOnEnter(this);
            
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

function validateLotRoll(input) {
    let value = input.value;
    const previousValue = input.dataset.previousValue || '';
    const isDeleting = value.length < previousValue.length;
    
    // Only allow numbers, dash, and double quote
    value = value.replace(/[^0-9-"]/g, '');
    
    // Ensure only one dash
    const parts = value.split('-');
    if (parts.length > 2) {
        value = parts[0] + '-' + parts.slice(1).join('');
    }
    
    // Limit to 2 digits before and after dash
    if (parts.length === 2) {
        if (parts[0].length > 2) parts[0] = parts[0].substring(0, 2);
        if (parts[1].length > 2) parts[1] = parts[1].substring(0, 2);
        value = parts[0] + '-' + parts[1];
    } else if (parts.length === 1) {
        if (parts[0].length > 2) {
            parts[0] = parts[0].substring(0, 2);
            value = parts[0];
        }
        // Auto-insert dash after 2 digits
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
function applyRollIDValidation(input) {

    
    input.addEventListener('input', function() {
        validateRollID(this);
        debouncedSave();
    });
    
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation(); // Prevent other event handlers from interfering
            formatRollIDOnEnter(this);
            
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
function applyLotTimeValidation(input) {

    
    input.addEventListener('input', function() {
        validateLotTime(this);
        debouncedSave();
    });
    
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation(); // Prevent other event handlers from interfering
            formatLotTimeOnEnter(this);
            
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
function disableFormInputs() {

    
    // ALWAYS disable header table inputs (regardless of view mode)
    const headerTableInputs = document.querySelectorAll('.modern-header-table input, .modern-header-table select, .modern-header-table textarea');
    headerTableInputs.forEach(input => {

        
        // FORCE DISABLE header table inputs ALWAYS
        input.disabled = true;
        input.readOnly = true;
        input.style.pointerEvents = 'none'; // Prevent any interaction
        input.style.cursor = 'default'; // Show default cursor
        input.style.fontSize = '16px'; // Bigger font size for better readability
        input.style.fontWeight = '500'; // Slightly bolder text
        input.style.color = '#000000'; // Force black text color
        input.style.opacity = '1'; // Force full opacity
        input.title = 'This field is read-only';
        
        // Force apply header table styling
        const td = input.closest('td');
        if (td) {
            // Apply specific styling for header table cells
            td.style.backgroundColor = '#f1f5f9'; // Light grey for labels
            td.style.fontWeight = '600'; // Bold text
            td.style.fontSize = '15px'; // Consistent font size
        }
    });
    
    // Disable other input fields only in view mode
    if (isViewMode) {
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            const inputId = input.id;
            const inputClass = input.className;
            
            // Skip navigation inputs and verification inputs
            if (inputId && (
                inputId.includes('verification') || 
                inputId.includes('approval') ||
                inputId.includes('back') ||
                inputId.includes('navigation') ||
                inputId.includes('nav')
            )) {
                return;
            }
            
            // Skip inputs with navigation classes
            if (inputClass && (
                inputClass.includes('nav') ||
                inputClass.includes('back') ||
                inputClass.includes('navigation')
            )) {
                return;
            }
            
            // Skip header table inputs (already handled above)
            if (input.closest('.modern-header-table')) {
                return;
            }
            
            input.disabled = true;
            input.readOnly = true;
            
        // Apply view mode styling (like 16 GSM Kranti)
        input.style.cursor = 'default';
        
        // Only apply 16px font size to header fields (like 16 GSM Kranti)
        const isHeaderTable = input.closest('.modern-header-table');
        const isHeaderField = input.closest('input[placeholder*="Enter"]') || 
                             input.closest('input[placeholder*="Product"]') ||
                             input.closest('input[placeholder*="Machine"]') ||
                             input.closest('input[placeholder*="Order"]') ||
                             input.closest('input[placeholder*="Specification"]') ||
                             input.closest('input[placeholder*="Quantity"]') ||
                             input.closest('input[type="date"]');
        
        if (isHeaderTable || isHeaderField) {
            input.style.fontSize = '16px'; // Header fields use 16px (like 16 GSM Kranti)
        }
        // Table cells keep their default 13px (don't override)
        
        input.style.fontWeight = '500'; // Slightly bolder text
        input.style.color = '#000000'; // Force black text color
        input.style.opacity = '1'; // Force full opacity
        input.title = 'This field is read-only';
        });
    }
    
    // Hide add/delete buttons and disable all editing in view mode (like 16 GSM Kranti)
    if (isViewMode) {
        const addRowsBtn = document.getElementById('addNewRowsBtn');
        const deleteRowsBtn = document.getElementById('deleteRowsBtn');
        const numRowsInput = document.getElementById('numRowsInput');
        
        if (addRowsBtn) addRowsBtn.style.display = 'none';
        if (deleteRowsBtn) deleteRowsBtn.style.display = 'none';
        if (numRowsInput) numRowsInput.style.display = 'none';
        

    }
    
    // Disable all buttons except navigation, verification, and approval buttons
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        const buttonId = button.id;
        const buttonClass = button.className;
        const buttonText = button.textContent.toLowerCase();
        
        // Skip navigation buttons, verification buttons, and approval buttons
        if (buttonId && (
            buttonId.includes('verification') || 
            buttonId.includes('approval') ||
            buttonId.includes('back') ||
            buttonId.includes('navigation') ||
            buttonId.includes('nav') ||
            buttonId.includes('home') ||
            buttonId.includes('return')
        )) {

            return;
        }
        
        // Skip buttons with navigation classes
        if (buttonClass && (
            buttonClass.includes('nav') ||
            buttonClass.includes('back') ||
            buttonClass.includes('navigation') ||
            buttonClass.includes('btn-back') ||
            buttonClass.includes('btn-nav')
        )) {

            return;
        }
        
        // Skip buttons with navigation text
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
    async function loadQCEquipmentDropdowns() {
        try {

        
        // Show loading state
        showEquipmentLoadingState();
            
            // Load equipment data directly from database

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
            
            // Populate dropdowns with fresh data

            populateEquipmentDropdowns(equipmentData);

            
        } catch (error) {
        console.error('🔧 [EQUIPMENT] Error loading QC equipment:', error);
            showEquipmentLoadingError();
        }
    }
    
    // Function to show loading state
    function showEquipmentLoadingState() {
        const allDropdownIds = [
        'film-weight-equipment', 'thickness-equipment',
        'cof-rr-equipment', 'cof-cc-equipment', 'tensile-break-equipment',
        'elongation-equipment', 'modulus-equipment',
        'tensile-break-equipment', 'elongation-equipment', 'modulus-equipment',
        'page3-colour-equipment', 'page3-base-film-equipment'
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
        

    
    // Equipment type to dropdown mapping (Page 1, 2 & 3) - Fixed to match actual HTML IDs
        const equipmentMappings = {
            'Weigh Scale': ['film-weight-equipment'],
            'Dial Gauge': ['thickness-equipment'], // For thickness measurement
            'X-RITE': ['page3-colour-equipment', 'page3-base-film-equipment'], // page3-colour-equipment (Page 3) and page3-base-film-equipment (Page 3 Base Film White)
            'Spectrophotometer': ['page2-opacity-equipment', 'page3-base-film-equipment'], // page2-opacity-equipment (Page 2) and page3-base-film-equipment (Page 3 Base Film White)
            'Instron': ['cof-rr-equipment', 'cof-cc-equipment', 'tensile-break-equipment', 'elongation-equipment', 'modulus-equipment', 'page2-tensile-break-equipment', 'page2-elongation-equipment', 'page2-modulus-equipment'], // UTM for mechanical testing
            'Tape Measure': [], // No longer used - measurements moved to Steel Ruler
            'Steel Ruler': ['page2-roll-width-equipment', 'page2-diameter-equipment'], // For Roll Cut Width and Diameter measurements (Page 2 only)
            'Glossmeter': [] // No longer used in new structure
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
                    
                    // Add equipment options
                    equipmentIds.forEach(equipmentId => {
                        // Check if this option already exists
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
                        dropdown.addEventListener('change', function() {
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
        'film-weight-equipment', 'thickness-equipment',
        'cof-rr-equipment', 'cof-cc-equipment', 'tensile-break-equipment',
        'elongation-equipment', 'modulus-equipment',
        'tensile-break-equipment', 'elongation-equipment', 'modulus-equipment',
        'page3-colour-equipment', 'page3-base-film-equipment'
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
           const testingTableBody3 = document.getElementById('testingTableBody3');
    return [testingTableBody, testingTableBody2, testingTableBody3];
}

// Get table body by page number (1-3)
function getTableBodyByPage(pageNumber) {
           switch(pageNumber) {
        case 1: return document.getElementById('testingTableBody');
        case 2: return document.getElementById('testingTableBody2');
        case 3: return document.getElementById('testingTableBody3');
               default: return null;
           }
}
       
       // Get column count for a specific table
function getTableColumnCount(tableBody) {
           if (tableBody.id === 'testingTableBody') return 11;     // Page 1: 11 columns (3 Sample No + 8 parameters)
           if (tableBody.id === 'testingTableBody2') return 9;     // Page 2: 9 columns (3 Sample No + 6 parameters)
           if (tableBody.id === 'testingTableBody3') return 8;     // Page 3: 8 columns (3 Sample No + 5 parameters)
           return 0;
}

// Get columns per row for each table
function getColumnsPerRow(tableBody) {
    if (tableBody.id === 'testingTableBody') return 11;      // Page 1: 11 columns (3 Sample No + 8 parameters)
    if (tableBody.id === 'testingTableBody2') return 9;      // Page 2: 9 columns (3 Sample No + 6 parameters)
    if (tableBody.id === 'testingTableBody3') return 8;      // Page 3: 8 columns (3 Sample No + 5 parameters)
    return 11; // Default fallback
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
function getHistoricalCellValue(historicalData, key, historicalRow) {
    if (!historicalData || !key) return undefined;
    let container = historicalData[key];
    if (!container) return undefined;
    // Parse JSON strings
    if (typeof container === 'string') {
        try {
            container = JSON.parse(container);
        } catch (e) {
            return undefined;
        }
    }
    const rowKey1 = String(historicalRow);
    const rowKey0 = String(historicalRow - 1);
    // Object with 1-based or 0-based keys
    if (typeof container === 'object' && !Array.isArray(container)) {
        return container[rowKey1] ?? container[rowKey0];
    }
    // Array-like
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
        'page1_basis_weight', 'page1_thickness', 'page1_wettability', 'page1_cof_rr', 'page1_cof_cc', 'page1_tensile_break', 'page1_elongation', 'page1_modulus',
        'page2_tensile_break', 'page2_cd_elongation', 'page2_modulus', 'page2_opacity', 'page2_roll_width', 'page2_diameter'
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
function loadHistoricalRowData(row, historicalData, historicalRow) {
    /* console.log('🔍 [HISTORICAL] loadHistoricalRowData CALLED for row:', {
        hasRow: !!row,
        hasHistoricalData: !!historicalData,
        historicalRow,
        rowInnerHTML: row?.innerHTML?.substring(0, 100)
    }); */

    if (!row || !historicalData) {
        
        return;
    }

    const inputs = row.querySelectorAll('input');
    
    const rowKey = String(historicalRow);

    // Load data based on table type
    

    if (row.closest('#testingTableBody')) {
        
        // Page 1 data
        const lotAndRollVal = getHistoricalCellValue(historicalData, 'lot_and_roll', historicalRow);
        if (inputs[0] && lotAndRollVal !== undefined && lotAndRollVal !== null && lotAndRollVal !== '') {
            inputs[0].value = lotAndRollVal;
        }
        const rollIdVal = getHistoricalCellValue(historicalData, 'roll_id', historicalRow);
        if (inputs[1] && rollIdVal !== undefined && rollIdVal !== null && rollIdVal !== '') {
            inputs[1].value = rollIdVal;
        }
        const lotTimeVal = getHistoricalCellValue(historicalData, 'lot_time', historicalRow);
        if (inputs[2] && lotTimeVal !== undefined && lotTimeVal !== null && lotTimeVal !== '') {
            inputs[2].value = lotTimeVal;
        }
        // Load Page 1 data - CORRECTED to match actual HTML structure (8 columns, not 9)
        const page1Data = [
            { key: 'page1_basis_weight', inputIndex: 3 }, // Film Weight
            { key: 'page1_thickness', inputIndex: 4 }, // Thickness
            { key: 'page1_wettability', inputIndex: 5 }, // Wettability
            { key: 'page1_cof_rr', inputIndex: 6 }, // COF (R-R)
            { key: 'page1_cof_cc', inputIndex: 7 }, // COF (C-C)
            { key: 'page1_tensile_break', inputIndex: 8 }, // Tensile Break
            { key: 'page1_elongation', inputIndex: 9 }, // MD Elongation Break
            { key: 'page1_modulus', inputIndex: 10 } // 10% Modulus
        ];
        
        page1Data.forEach(({ key, inputIndex }) => {
            const val = getHistoricalCellValue(historicalData, key, historicalRow);
            if (inputs[inputIndex] && val !== undefined && val !== null && val !== '') {
                inputs[inputIndex].value = val;
            }
        });
    } else if (row.closest('#testingTableBody2')) {
        // Page 2 data - Load lot_and_roll, roll_id, lot_time for all pages
        const lotAndRollVal2 = getHistoricalCellValue(historicalData, 'lot_and_roll', historicalRow);
        if (inputs[0] && lotAndRollVal2 !== undefined && lotAndRollVal2 !== null && lotAndRollVal2 !== '') {
            inputs[0].value = lotAndRollVal2;
        }
        const rollIdVal2 = getHistoricalCellValue(historicalData, 'roll_id', historicalRow);
        if (inputs[1] && rollIdVal2 !== undefined && rollIdVal2 !== null && rollIdVal2 !== '') {
            inputs[1].value = rollIdVal2;
        }
        const lotTimeVal2 = getHistoricalCellValue(historicalData, 'lot_time', historicalRow);
        if (inputs[2] && lotTimeVal2 !== undefined && lotTimeVal2 !== null && lotTimeVal2 !== '') {
            inputs[2].value = lotTimeVal2;
        }
        // Load Page 2 specific data
        const page2Data = [
            { key: 'page2_tensile_break', inputIndex: 3 },
            { key: 'page2_cd_elongation', inputIndex: 4 },
            { key: 'page2_modulus', inputIndex: 5 },
            { key: 'page2_opacity', inputIndex: 6 },
            { key: 'page2_roll_width', inputIndex: 7 },
            { key: 'page2_diameter', inputIndex: 8 }
        ];
        
        page2Data.forEach(({ key, inputIndex }) => {
            const val = getHistoricalCellValue(historicalData, key, historicalRow);
            if (inputs[inputIndex] && val !== undefined && val !== null && val !== '') {
                inputs[inputIndex].value = val;
            }
        });
    }
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

// Debounced save function to prevent duplicate saves
function debouncedSave() {

    
    if (isSaving) {

        return; // Prevent duplicate saves
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
        }
    }, 200); // 200ms delay for better responsiveness
}

// Main auto-save function
async function autoSaveToDatabase() {
    // Block saving in view mode
    if (isViewMode()) {
        return;
    }

    try {

        // Get form data
        const formData = await collectFormData();
        
        if (!formData) {

            return;
        }
        

        
        // Save to database
               if (currentFormId) {
            // Update existing form

            await updateFormInDatabase(formData);
               } else {
            // Create new form

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

// Get table data from all tables
function getTableDataFromAllTables() {

    
    const tableData = {};
    const allTables = getAllTableBodies();
    
    allTables.forEach(tableBody => {
        if (!tableBody) return;
        
        const tableId = tableBody.id;
        const data = getTableData(tableBody);
        
        if (tableId === 'testingTableBody') {
            // Page 1 data - Sample columns (Lot & Roll, Roll ID, Lot Time)
            tableData.lot_and_roll = convertColumnToJSONB(tableBody, 0);
            tableData.roll_id = convertColumnToJSONB(tableBody, 1);
            tableData.lot_time = convertColumnToJSONB(tableBody, 2);
            
            // Page 1 data - CORRECTED to match actual HTML structure
            tableData.page1_basis_weight = convertColumnToJSONB(tableBody, 3); // Film Weight
            tableData.page1_thickness = convertColumnToJSONB(tableBody, 4); // Thickness
            tableData.page1_wettability = convertColumnToJSONB(tableBody, 5); // Wettability
            tableData.page1_cof_rr = convertColumnToJSONB(tableBody, 6); // COF (R-R)
            tableData.page1_cof_cc = convertColumnToJSONB(tableBody, 7); // COF (C-C)
            tableData.page1_tensile_break = convertColumnToJSONB(tableBody, 8); // Tensile Break
            tableData.page1_elongation = convertColumnToJSONB(tableBody, 9); // MD Elongation Break
            tableData.page1_modulus = convertColumnToJSONB(tableBody, 10); // 10% Modulus
        } else if (tableId === 'testingTableBody2') {
            // Page 2 data - 6 columns (Mechanical Properties)
            tableData.page2_tensile_break = convertColumnToJSONB(tableBody, 3);
            tableData.page2_cd_elongation = convertColumnToJSONB(tableBody, 4);
            tableData.page2_modulus = convertColumnToJSONB(tableBody, 5);
            tableData.page2_opacity = convertColumnToJSONB(tableBody, 6);
            tableData.page2_roll_width = convertColumnToJSONB(tableBody, 7);
            tableData.page2_diameter = convertColumnToJSONB(tableBody, 8);
        } else if (tableId === 'testingTableBody3') {
            // Page 3 data - 5 columns (Color Measurements)
            tableData.page3_colour_l = convertColumnToJSONB(tableBody, 3);
            tableData.page3_colour_a = convertColumnToJSONB(tableBody, 4);
            tableData.page3_colour_b = convertColumnToJSONB(tableBody, 5);
            tableData.page3_delta_e = convertColumnToJSONB(tableBody, 6);
            tableData.page3_base_film_pink = convertColumnToJSONB(tableBody, 7);
        }
    });
    

    return tableData;
       }
       
       // Get table data (excluding summary rows)
       function getTableData(tableBody) {

    
           const rows = Array.from(tableBody.querySelectorAll('tr'));
           const dataRows = rows.filter(row => {
               const firstCell = row.querySelector('td');
               return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
           });
           
    const tableData = dataRows.map(row => {
               const inputs = row.querySelectorAll('input');
               return Array.from(inputs).map(input => input.value);
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
                   input.addEventListener('input', function() {
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

    
    input.addEventListener('input', function() {
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
    equipmentDropdowns.forEach(function(dropdown) {
        if (dropdown.value && dropdown.value !== '' && dropdown.value !== 'Select Equipment ▼') {
            dropdown.classList.add('equipment-selected');
        } else {
            dropdown.classList.remove('equipment-selected');
        }
    });
}

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
    
    // Apply red text formatting based on column type
    let shouldHighlight = false;
    
    switch(columnType) {
        // Page 1 parameters
        case 'filmWeight':
            // Film Weight: L-17.00 T-18.0 U-20.00 g/m2
            shouldHighlight = value < 17.00 || value > 20.00;
            break;
        case 'thickness':
            // Thickness: L-18 T-23 U-28 μm
            shouldHighlight = value < 18 || value > 28;
            break;
        case 'wettability':
            // Wettability: L-360 T-380 U-400 h/cm
            shouldHighlight = value < 360 || value > 400;
            break;
        case 'cofRR':
            // COF (R-R): L-0.30 T-0.45 U-0.60
            shouldHighlight = value < 0.30 || value > 0.60;
            break;
        case 'cofCC':
            // COF (C-C): L-0.60 T-0.80 U-1.40
            shouldHighlight = value < 0.60 || value > 1.40;
            break;
        case 'tensileBreak':
            // Check if this is Page 1 or Page 2 tensileBreak
            // We need to determine the page based on the input element's context
            const tableBody = input.closest('tbody');
            if (tableBody && tableBody.id === 'testingTableBody') {
                // Page 1: Tensile Break L-900 U-1200 g/25mm
                shouldHighlight = value < 900 || value > 1200;
            } else if (tableBody && tableBody.id === 'testingTableBody2') {
                // Page 2: Tensile Break L-700 U-1000 g/25mm (both limits)
                shouldHighlight = value < 700 || value > 1000;
            } else {
                // Default to Page 1 logic
                shouldHighlight = value < 900 || value > 1200;
            }
            break;
        case 'elongation':
            // MD Elongation Break: L-350 %
            shouldHighlight = value < 350;
            break;
        case 'cdElongation':
            // CD Elongation Break: L-400 % (only lower limit)
            shouldHighlight = value < 400;
            break;
        case 'modulus10':
            // 10% Modulus: L-300 g/25mm (only lower limit)
            shouldHighlight = value < 300;
            break;
        case 'opacity':
            // Opacity: L-45.0 T-50.0 U-55.0 (full range)
            shouldHighlight = value < 45.0 || value > 55.0;
            break;
        case 'rollWidth':
            // Roll Cut Width: T-250 U-253 mm (target and upper limit)
            shouldHighlight = value < 250 || value > 253;
            break;
        case 'diameter':
            // Diameter: L-410 T-430 U-450 mm (full range)
            shouldHighlight = value < 410 || value > 450;
            break;
        // Page 3 parameters
        case 'colourL':
            // Colour L: L-57.50 T-61.50 U-65.50 (Colour units-H)
            shouldHighlight = value < 57.50 || value > 65.50;
            break;
        case 'colourA':
            // Colour A: L-46.00 T-51.00 U-56.00 (Colour units-H)
            shouldHighlight = value < 46.00 || value > 56.00;
            break;
        case 'colourB':
            // Colour B: L-(-14.00) T-(-11.00) U-(-8.00) (Colour units-H)
            shouldHighlight = value < -14.00 || value > -8.00;
            break;
        case 'deltaE':
            // Delta E: T-0.00 U-4.00 (Colour Units-Delta E) - only upper limit
            shouldHighlight = value > 4.00;
            break;
        case 'baseFilmPink':
            // Base Film White: T-0.00 U-5.00 (Colour Units-Delta E) - only upper limit
            shouldHighlight = value > 5.00;
            break;
    }
    
    if (shouldHighlight) {
        // Apply red text only
        input.classList.add('text-red-600');
    }
}

// Apply OOS validation to all existing inputs in Page 1, Page 2, and Page 3
function applyOOSValidationToAllInputs() {
    // Page 1 validation
    const testingTableBody = document.getElementById('testingTableBody');
    if (testingTableBody) {
        const rows = testingTableBody.querySelectorAll('tr');

        rows.forEach((row, rowIndex) => {
            const firstCell = row.querySelector('td');
            if (firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim())) {
                const inputs = row.querySelectorAll('input');

                inputs.forEach((input, columnIndex) => {
                    if (columnIndex > 2) { // Data columns only
                        let columnType = '';
                        if (columnIndex === 3) {
                            columnType = 'filmWeight';
                        } else if (columnIndex === 4) {
                            columnType = 'thickness';
                        } else if (columnIndex === 5) {
                            columnType = 'wettability';
                        } else if (columnIndex === 6) {
                            columnType = 'cofRR';
                        } else if (columnIndex === 7) {
                            columnType = 'cofCC';
                        } else if (columnIndex === 8) {
                            columnType = 'tensileBreak';
                        } else if (columnIndex === 9) {
                            columnType = 'elongation';
                        } else if (columnIndex === 10) {
                            columnType = 'modulus10';
                        }

                        if (columnType) {
                            // Apply validation to current value
                            applyOOSValidation(input, columnType);

                            // Add real-time validation event listener (only if not already added)
                            if (!input.hasAttribute('data-oos-listener')) {
                                input.addEventListener('input', function() {
                                    applyOOSValidation(this, columnType);
                                });
                                input.setAttribute('data-oos-listener', 'true');
                            }
                        }
                    }
                });
            }
        });
    }

    // Page 2 validation
    const testingTableBody2 = document.getElementById('testingTableBody2');
    if (testingTableBody2) {
        const rows = testingTableBody2.querySelectorAll('tr');

        rows.forEach((row, rowIndex) => {
            const firstCell = row.querySelector('td');
            if (firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim())) {
                const inputs = row.querySelectorAll('input');

                inputs.forEach((input, columnIndex) => {
                    if (columnIndex > 2) { // Data columns only
                        let columnType = '';
                        if (columnIndex === 3) {
                            columnType = 'tensileBreak';
                        } else if (columnIndex === 4) {
                            columnType = 'cdElongation';
                        } else if (columnIndex === 5) {
                            columnType = 'modulus10';
                        } else if (columnIndex === 6) {
                            columnType = 'opacity';
                        } else if (columnIndex === 7) {
                            columnType = 'rollWidth';
                        } else if (columnIndex === 8) {
                            columnType = 'diameter';
                        }
                        if (columnType) {
                            // Apply validation to current value
                            applyOOSValidation(input, columnType);

                            // Add real-time validation event listener
                            input.addEventListener('input', function() {
                                applyOOSValidation(this, columnType);

                                // Trigger Page 2 calculation for real-time summary updates
                                if (this.closest('#testingTableBody2')) {
                                    const inputIndex = Array.from(this.closest('tr').querySelectorAll('input')).indexOf(this);
                                    calculatePage2ColumnStats(document.getElementById('testingTableBody2'), inputIndex);
                                }
                            });
                        }
                    }
                });
            }
        });
    }

    // Page 3 validation
    const testingTableBody3 = document.getElementById('testingTableBody3');
    if (testingTableBody3) {
        const rows = testingTableBody3.querySelectorAll('tr');

        rows.forEach((row, rowIndex) => {
            const firstCell = row.querySelector('td');
            if (firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim())) {
                const inputs = row.querySelectorAll('input');

                inputs.forEach((input, columnIndex) => {
                    if (columnIndex > 2) { // Data columns only
                        let columnType = '';
                        if (columnIndex === 3) {
                            columnType = 'colourL';
                        } else if (columnIndex === 4) {
                            columnType = 'colourA';
                        } else if (columnIndex === 5) {
                            columnType = 'colourB';
                        } else if (columnIndex === 6) {
                            columnType = 'deltaE';
                        } else if (columnIndex === 7) {
                            columnType = 'baseFilmPink';
                        }

                        if (columnType) {
                            // Apply validation to current value
                            applyOOSValidation(input, columnType);

                            // Add real-time validation event listener (only if not already added)
                            if (!input.hasAttribute('data-oos-listener')) {
                                input.addEventListener('input', function() {
                                    applyOOSValidation(this, columnType);

                                    // Trigger Page 3 calculation for real-time summary updates
                                    if (this.closest('#testingTableBody3')) {
                                        const inputIndex = Array.from(this.closest('tr').querySelectorAll('input')).indexOf(this);
                                        calculatePage2ColumnStats(document.getElementById('testingTableBody3'), inputIndex);
                                    }
                                });
                                input.setAttribute('data-oos-listener', 'true');
                            }
                        }
                    }
                });
            }
        });
    }
}

// Get equipment selections
function getEquipmentSelections() {

    
    const equipmentData = {
        page1: {
            film_weight: document.getElementById('film-weight-equipment')?.value || '',
            thickness: document.getElementById('thickness-equipment')?.value || '',
            cof_rr: document.getElementById('cof-rr-equipment')?.value || '',
            cof_cc: document.getElementById('cof-cc-equipment')?.value || '',
            tensile_break: document.getElementById('tensile-break-equipment')?.value || '',
            elongation: document.getElementById('elongation-equipment')?.value || '',
            modulus_10: document.getElementById('modulus-equipment')?.value || ''
        },
        page2: {
            tensile_break: document.getElementById('tensile-break-equipment')?.value || '',
            elongation: document.getElementById('elongation-equipment')?.value || '',
            modulus_10: document.getElementById('modulus-equipment')?.value || '',
            opacity: document.getElementById('page2-opacity-equipment')?.value || '',
            roll_width: document.getElementById('page2-roll-width-equipment')?.value || '',
            diameter: document.getElementById('page2-diameter-equipment')?.value || ''
        },
        page3: {
            colour: document.getElementById('page3-colour-equipment')?.value || '',
            baseFilm: document.getElementById('page3-base-film-equipment')?.value || ''
        }
    };
    

    return equipmentData;
}

// Convert a table column to JSONB format
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
            .from('uc-18gsm-250w-bfqr')
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
        
        const { data, error } = await supabase
            .from('uc-18gsm-250w-bfqr')
            .update(updateData)
            .eq('form_id', currentFormId)
            .select();
        
        if (error) {
            console.error('💾 [AUTO-SAVE] Error updating form:', error);
            return;
        }
        

        
    } catch (error) {
        console.error('💾 [AUTO-SAVE] Error updating form:', error);
    }
}

// ===== INPUT VALIDATION FUNCTIONS =====
// Validation functions for different decimal formats

function validateThreeDigits(input) {
    let value = input.value;
    
    // Remove any non-numeric characters (no decimal point allowed)
    value = value.replace(/[^0-9]/g, '');
    
    // Limit to 3 digits maximum
    if (value.length > 3) {
        value = value.substring(0, 3);
    }
    
    // Update input value with validated format
    input.value = value;
}

function validateFourDigits(input) {
    let value = input.value;

    // If empty, keep it empty
    if (value === '') {
        input.value = '';
        return;
    }

    // Remove any non-numeric characters (no decimal point allowed)
    value = value.replace(/[^0-9]/g, '');

    // If no numeric characters remain, keep empty
    if (value === '') {
        input.value = '';
        return;
    }

    // Limit to 4 digits maximum
    if (value.length > 4) {
        value = value.substring(0, 4);
    }

    // Special handling: if exactly 3 digits and all are zeros, pad to 4 digits
    // Otherwise, keep as is (don't pad with leading zeros)
    if (value.length === 3 && value === '000') {
        input.value = '0000';
    } else {
        input.value = value;
    }
}

function validateSimpleNumeric(input) {
    let value = input.value;

    // Remove any non-numeric characters (allow negative sign for some cases)
    value = value.replace(/[^0-9-]/g, '');

    // Handle negative sign - only at the beginning
    if (value.indexOf('-') > 0) {
        value = value.replace(/-/g, ''); // Remove all minus signs
    } else if (value.startsWith('-')) {
        value = '-' + value.substring(1).replace(/-/g, ''); // Keep only the first minus sign
    }

    // Update input value with validated format
    input.value = value;
}

function formatSimpleNumericOnEnter(input) {
    let value = input.value.trim();

    // If empty, keep it empty
    if (value === '') {
        input.value = '';
        return;
    }

    // Parse as number
    const numValue = parseFloat(value);

    // If not a valid number, keep empty
    if (isNaN(numValue)) {
        input.value = '';
        return;
    }

    // Format as simple number (no padding, no forced decimals)
    input.value = numValue.toString();
}

function validateTwoDigitOneDecimal(input) {
    let value = input.value;

    // Remove any non-numeric characters except decimal point
    value = value.replace(/[^0-9.]/g, '');

    // Ensure only one decimal point
    const parts = value.split('.');
    if (parts.length > 2) {
        value = parts[0] + '.' + parts.slice(1).join('');
    }

    // Allow up to 2 digits before decimal for typing (Colour L range is 52-64)
    if (parts.length === 2) {
        // Before decimal: allow up to 2 digits for typing
        if (parts[0].length > 2) {
            parts[0] = parts[0].substring(0, 2);
        }
        // After decimal: allow up to 2 digits (don't force exactly 1)
        if (parts[1].length > 2) {
            parts[1] = parts[1].substring(0, 2);
        }
        value = parts[0] + '.' + parts[1];
    } else if (parts.length === 1) {
        // No decimal point yet, allow up to 2 digits for typing (Colour L range is 52-64)
        if (parts[0].length > 2) {
            parts[0] = parts[0].substring(0, 2);
            value = parts[0];
        }
    }

    // Update input value with validated format
    input.value = value;
}

function validateOneDigitOneDecimal(input) {
    let value = input.value;

    // Remove any non-numeric characters except decimal point and minus sign
    value = value.replace(/[^0-9.-]/g, '');

    // Handle negative sign - only at the beginning
    if (value.indexOf('-') > 0) {
        value = value.replace(/-/g, ''); // Remove all minus signs
    } else if (value.startsWith('-')) {
        value = '-' + value.substring(1).replace(/-/g, ''); // Keep only the first minus sign
    }

    // Ensure only one decimal point
    const parts = value.split('.');
    if (parts.length > 2) {
        value = parts[0] + '.' + parts.slice(1).join('');
    }

    // Allow up to 3 digits before decimal for typing (Colour B range is -12.50 to -4.50)
    if (parts.length === 2) {
        let beforeDecimal = parts[0];
        let afterDecimal = parts[1];

        // Handle negative numbers
        if (beforeDecimal.startsWith('-')) {
            if (beforeDecimal.length > 3) { // -XX format, so max 3 chars (-12)
                beforeDecimal = beforeDecimal.substring(0, 3);
            }
        } else {
            if (beforeDecimal.length > 2) { // XX format, so max 2 chars (49, 59)
                beforeDecimal = beforeDecimal.substring(0, 2);
            }
        }

        // After decimal: allow up to 2 digits (don't force exactly 1)
        if (afterDecimal.length > 2) {
            afterDecimal = afterDecimal.substring(0, 2);
        }
        // Ensure at least 1 digit after decimal if there are digits before
        if (afterDecimal.length === 0 && beforeDecimal !== '' && beforeDecimal !== '-') {
            afterDecimal = '0';
        }
        value = beforeDecimal + '.' + afterDecimal;
    } else if (parts.length === 1) {
        // No decimal point yet
        if (value.startsWith('-')) {
            if (value.length > 3) { // -XX format
                value = value.substring(0, 3);
            }
        } else {
            if (value.length > 2) { // XX format
                value = value.substring(0, 2);
            }
        }
    }

    // Update input value with validated format
    input.value = value;
}

function validateTwoDigitTwoDecimal(input) {
    let value = input.value;
    
    // Remove any non-numeric characters except decimal point
    value = value.replace(/[^0-9.]/g, '');
    
    // Ensure only one decimal point
    const parts = value.split('.');
    if (parts.length > 2) {
        value = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Allow up to 2 digits before decimal for typing
    if (parts.length === 2) {
        // Before decimal: allow up to 2 digits
        if (parts[0].length > 2) {
            parts[0] = parts[0].substring(0, 2);
        }
        // After decimal: max 2 digits
        if (parts[1].length > 2) {
            parts[1] = parts[1].substring(0, 2);
        }
        value = parts[0] + '.' + parts[1];
    } else if (parts.length === 1) {
        // No decimal point yet, allow up to 2 digits for typing
        if (parts[0].length > 2) {
            parts[0] = parts[0].substring(0, 2);
            value = parts[0];
        }
    }
    
    // Update input value with validated format
    input.value = value;
}

function validateOneDigitTwoDecimal(input) {
    let value = input.value;

    // Remove any non-numeric characters except decimal point and minus sign
    value = value.replace(/[^0-9.-]/g, '');

    // Ensure only one decimal point
    const parts = value.split('.');
    if (parts.length > 2) {
        value = parts[0] + '.' + parts.slice(1).join('');
    }

    // Handle negative sign - only at the beginning
    if (value.indexOf('-') > 0) {
        value = value.replace(/-/g, ''); // Remove all minus signs
    } else if (value.startsWith('-')) {
        value = '-' + value.substring(1).replace(/-/g, ''); // Keep only the first minus sign
    }

    // Allow up to 1 digit before decimal for typing (Delta E and Base Film Pink range is 0.00-4.00)
    if (parts.length === 2) {
        let beforeDecimal = parts[0];
        let afterDecimal = parts[1];

        // Handle negative numbers
        if (beforeDecimal.startsWith('-')) {
            if (beforeDecimal.length > 2) { // -X format, so max 2 chars (-4)
                beforeDecimal = beforeDecimal.substring(0, 2);
            }
        } else {
            if (beforeDecimal.length > 1) { // X format, so max 1 char (4)
                beforeDecimal = beforeDecimal.substring(0, 1);
            }
        }

        // After decimal: max 2 digits
        if (afterDecimal.length > 2) {
            afterDecimal = afterDecimal.substring(0, 2);
        }
        value = beforeDecimal + '.' + afterDecimal;
    } else if (parts.length === 1) {
        // No decimal point yet
        if (value.startsWith('-')) {
            if (value.length > 2) { // -X format
                value = value.substring(0, 2);
            }
        } else {
            if (value.length > 1) { // X format
                value = value.substring(0, 1);
            }
        }
    }

    // Update input value with validated format
    input.value = value;
}

function validateFlexibleTwoDecimal(input, options = {}) {
    const maxBeforeDecimal = options.maxBeforeDecimal || 2;
    const maxAfterDecimal = options.maxAfterDecimal || 2;

    let value = input.value;

    // Remove any non-numeric characters except decimal point
    value = value.replace(/[^0-9.]/g, '');

    // Ensure only one decimal point
    const parts = value.split('.');
    if (parts.length > 2) {
        value = parts[0] + '.' + parts.slice(1).join('');
    }

    // Allow up to specified digits before decimal
    if (parts.length === 2) {
        let beforeDecimal = parts[0];
        let afterDecimal = parts[1];

        // Before decimal: allow up to specified digits
        if (beforeDecimal.length > maxBeforeDecimal) {
            beforeDecimal = beforeDecimal.substring(0, maxBeforeDecimal);
        }

        // After decimal: max specified digits
        if (afterDecimal.length > maxAfterDecimal) {
            afterDecimal = afterDecimal.substring(0, maxAfterDecimal);
        }
        value = beforeDecimal + '.' + afterDecimal;
    } else if (parts.length === 1) {
        // No decimal point yet, allow up to specified digits for typing
        if (parts[0].length > maxBeforeDecimal) {
            parts[0] = parts[0].substring(0, maxBeforeDecimal);
            value = parts[0];
        }
    }

    // Update input value with validated format
    input.value = value;
}

function validateFlexibleTwoDecimalWithNegative(input) {
    let value = input.value;

    // Remove any non-numeric characters except decimal point and minus sign
    value = value.replace(/[^0-9.-]/g, '');

    // Handle negative sign - only at the beginning
    if (value.indexOf('-') > 0) {
        value = value.replace(/-/g, ''); // Remove all minus signs
    } else if (value.startsWith('-')) {
        value = '-' + value.substring(1).replace(/-/g, ''); // Keep only the first minus sign
    }

    // Ensure only one decimal point
    const parts = value.split('.');
    if (parts.length > 2) {
        const beforeDecimal = parts[0];
        const afterDecimal = parts.slice(1).join('');
        value = beforeDecimal + '.' + afterDecimal;
    }

    // Allow up to 2 digits before decimal for typing (flexible: -12 or 12)
    if (parts.length === 2) {
        let beforeDecimal = parts[0];
        let afterDecimal = parts[1];

        // Handle negative numbers
        if (beforeDecimal.startsWith('-')) {
            if (beforeDecimal.length > 3) { // -XX format, so max 3 chars (-12)
                beforeDecimal = beforeDecimal.substring(0, 3);
            }
        } else {
            if (beforeDecimal.length > 2) { // XX format, so max 2 chars (12)
                beforeDecimal = beforeDecimal.substring(0, 2);
            }
        }

        // After decimal: max 2 digits
        if (afterDecimal.length > 2) {
            afterDecimal = afterDecimal.substring(0, 2);
        }
        value = beforeDecimal + '.' + afterDecimal;
    } else if (parts.length === 1) {
        // No decimal point yet
        if (value.startsWith('-')) {
            if (value.length > 3) { // -XX format
                value = value.substring(0, 3);
            }
        } else {
            if (value.length > 2) { // XX format
                value = value.substring(0, 2);
            }
        }
    }

    // Update input value with validated format
    input.value = value;
}

function validateFlexibleOneDecimal(input) {
    let value = input.value;
    
    // Remove any non-numeric characters except decimal point
    value = value.replace(/[^0-9.]/g, '');
    
    // Ensure only one decimal point
    const parts = value.split('.');
    if (parts.length > 2) {
        value = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Allow up to 2 digits before decimal for typing (flexible: 9 or 10)
    if (parts.length === 2) {
        let beforeDecimal = parts[0];
        let afterDecimal = parts[1];
        
        // Before decimal: allow up to 2 digits (no leading zero forcing)
        if (beforeDecimal.length > 2) {
            beforeDecimal = beforeDecimal.substring(0, 2);
        }
        
        // After decimal: max 1 digit
        if (afterDecimal.length > 1) {
            afterDecimal = afterDecimal.substring(0, 1);
        }
        value = beforeDecimal + '.' + afterDecimal;
    } else if (parts.length === 1) {
        // No decimal point yet, allow up to 2 digits for typing
        if (parts[0].length > 2) {
            parts[0] = parts[0].substring(0, 2);
            value = parts[0];
        }
    }
    
    // Update input value with validated format
    input.value = value;
}

function validateCOF(input) {
    let value = input.value;
    
    // Remove any non-numeric characters except decimal point
    value = value.replace(/[^0-9.]/g, '');
    
    // If empty, allow it
    if (value === '') {
        input.value = '';
        return;
    }
    
    // Ensure only one decimal point
    const parts = value.split('.');
    if (parts.length > 2) {
        value = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Allow up to 2 digits before decimal for typing
    if (parts.length === 2) {
        // Before decimal: allow up to 2 digits
        if (parts[0].length > 2) {
            parts[0] = parts[0].substring(0, 2);
        }
        // After decimal: max 2 digits
        if (parts[1].length > 2) {
            parts[1] = parts[1].substring(0, 2);
        }
        value = parts[0] + '.' + parts[1];
    } else if (parts.length === 1) {
        // No decimal point yet, allow up to 2 digits for typing
        if (parts[0].length > 2) {
            parts[0] = parts[0].substring(0, 2);
            value = parts[0];
        }
    }
    
    // Update input value with validated format
    input.value = value;
}

// Auto-formatting functions for different decimal formats
function formatTwoDigitTwoDecimalOnEnter(input) {
    let value = input.value.trim();
    
    // If empty, keep it empty
    if (value === '') {
        input.value = '';
        return;
    }
    
    // Parse as number
    const numValue = parseFloat(value);
    
    // If not a valid number, keep empty
    if (isNaN(numValue)) {
        input.value = '';
        return;
    }
    
    // Format to 2 decimal places and ensure 2 digits before decimal
    const formatted = numValue.toFixed(2);
    const parts = formatted.split('.');
    
    // Ensure 2 digits before decimal
    if (parts[0].length === 1) {
        parts[0] = '0' + parts[0];
    }
    
    input.value = parts[0] + '.' + parts[1];
}


function formatFlexibleTwoDecimalOnEnter(input, options = {}) {
    const decimalPlaces = options.maxAfterDecimal || options.decimalPlaces || 2;

    let value = input.value.trim();

    // If empty, keep it empty
    if (value === '') {
        input.value = '';
        return;
    }

    // Parse as number
    const numValue = parseFloat(value);

    // If not a valid number, keep empty
    if (isNaN(numValue)) {
        input.value = '';
        return;
    }

    // Format to specified decimal places WITHOUT forcing leading zeros
    input.value = numValue.toFixed(decimalPlaces);
}

function formatFlexibleTwoDecimalWithNegativeOnEnter(input) {
    let value = input.value.trim();

    // If empty, keep it empty
    if (value === '') {
        input.value = '';
        return;
    }

    // Parse as number
    const numValue = parseFloat(value);

    // If not a valid number, keep empty
    if (isNaN(numValue)) {
        input.value = '';
        return;
    }

    // Format to 2 decimal places WITHOUT forcing leading zeros
    // -12.50 stays -12.50, 12.56 becomes 12.56
    input.value = numValue.toFixed(2);
}

function formatFlexibleOneDecimalOnEnter(input) {
    let value = input.value.trim();
    
    // If empty, keep it empty
    if (value === '') {
        input.value = '';
        return;
    }
    
    // Parse as number
    const numValue = parseFloat(value);
    
    // If not a valid number, keep empty
    if (isNaN(numValue)) {
        input.value = '';
        return;
    }
    
    // Format to 1 decimal place WITHOUT forcing leading zeros
    // 9 becomes 9.0, 10 becomes 10.0
    input.value = numValue.toFixed(1);
}

function formatCOFOnEnter(input) {
    let value = input.value.trim();
    
    // If empty, keep it empty
    if (value === '') {
        input.value = '';
        return;
    }
    
    // Parse as number
    const numValue = parseFloat(value);
    
    // If not a valid number, keep empty
    if (isNaN(numValue)) {
        input.value = '';
        return;
    }
    
    // For COF: if user types 30, it should become 0.30 (divide by 100)
    // But if user types 0.30, keep it as 0.30
    let formattedValue;
    if (numValue >= 1) {
        // If value is >= 1, divide by 100 (user typed 30, make it 0.30)
        formattedValue = (numValue / 100).toFixed(2);
    } else {
        // If value is < 1, keep as is (user already typed 0.30)
        formattedValue = numValue.toFixed(2);
    }
    
    input.value = formattedValue;
}

function formatThreeDigitsOnEnter(input) {
    let value = input.value.trim();
    
    // If empty, keep it empty
    if (value === '') {
        input.value = '';
        return;
    }
    
    // Parse as number
    const numValue = parseInt(value);
    
    // If not a valid number, keep empty
    if (isNaN(numValue)) {
        input.value = '';
        return;
    }
    
    // Format to 3 digits with leading zeros
    input.value = numValue.toString().padStart(3, '0');
}

function formatFourDigitsOnEnter(input) {
    let value = input.value.trim();

    // If empty, keep it empty
    if (value === '') {
        input.value = '';
        return;
    }

    // Remove any non-numeric characters
    value = value.replace(/[^0-9]/g, '');

    // If no numeric characters remain, keep empty
    if (value === '') {
        input.value = '';
        return;
    }

    // Parse as number
    const numValue = parseInt(value, 10);

    // If not a valid number, keep empty
    if (isNaN(numValue)) {
        input.value = '';
        return;
    }

    // Special handling: if exactly 3 digits and all are zeros, pad to 4 digits
    // Otherwise, keep as is (don't pad with leading zeros)
    if (value.length === 3 && value === '000') {
        input.value = '0000';
    } else {
        input.value = value;
    }
}

// Apply validation functions to inputs
function applyThreeDigitValidation(input) {
    // Ensure input is not read-only
    input.readOnly = false;
    input.style.backgroundColor = 'transparent';
    input.style.color = 'black';

    input.addEventListener('input', function() {
        validateThreeDigits(this);
        // Auto-save to database after each change (debounced)
        debouncedSave();

        // Trigger Page 2 calculation if this is a Page 2 input
        if (this.closest('#testingTableBody2')) {
            const inputIndex = Array.from(this.closest('tr').querySelectorAll('input')).indexOf(this);
            calculatePage2ColumnStats(document.getElementById('testingTableBody2'), inputIndex);
        }

        // Trigger Page 3 calculation if this is a Page 3 input
        if (this.closest('#testingTableBody3')) {
            const inputIndex = Array.from(this.closest('tr').querySelectorAll('input')).indexOf(this);
            calculatePage2ColumnStats(document.getElementById('testingTableBody3'), inputIndex);
        }
    });

    // Add Enter key formatting
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            formatThreeDigitsOnEnter(this);
            // Auto-save to database after formatting
            debouncedSave();
        }
    });

    // Add blur formatting (when user clicks away)
    input.addEventListener('blur', function() {
        formatThreeDigitsOnEnter(this);
        // Auto-save to database after formatting
        debouncedSave();
    });
}

function applySimpleNumericValidation(input) {
    // Ensure input is not read-only
    input.readOnly = false;
    input.style.backgroundColor = 'transparent';
    input.style.color = 'black';

    input.addEventListener('input', function() {
        validateSimpleNumeric(this);
        // Auto-save to database after each change (debounced)
        debouncedSave();

        // Trigger Page 2 calculation if this is a Page 2 input
        if (this.closest('#testingTableBody2')) {
            const inputIndex = Array.from(this.closest('tr').querySelectorAll('input')).indexOf(this);
            calculatePage2ColumnStats(document.getElementById('testingTableBody2'), inputIndex);
        }

        // Trigger Page 3 calculation if this is a Page 3 input
        if (this.closest('#testingTableBody3')) {
            const inputIndex = Array.from(this.closest('tr').querySelectorAll('input')).indexOf(this);
            calculatePage2ColumnStats(document.getElementById('testingTableBody3'), inputIndex);
        }
    });

    // Add Enter key formatting
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            formatSimpleNumericOnEnter(this);
            // Auto-save to database after formatting
            debouncedSave();
        }
    });

    // Add blur formatting (when user clicks away)
    input.addEventListener('blur', function() {
        formatSimpleNumericOnEnter(this);
        // Auto-save to database after formatting
        debouncedSave();
    });
}

function applyFourDigitValidation(input) {
    // Ensure input is not read-only
    input.readOnly = false;
    input.style.backgroundColor = 'transparent';
    input.style.color = 'black';

    input.addEventListener('input', function() {
        validateFourDigits(this);
        // Auto-save to database after each change (debounced)
        debouncedSave();

        // Trigger Page 2 calculation if this is a Page 2 input
        if (this.closest('#testingTableBody2')) {
            const inputIndex = Array.from(this.closest('tr').querySelectorAll('input')).indexOf(this);
            calculatePage2ColumnStats(document.getElementById('testingTableBody2'), inputIndex);
        }

        // Trigger Page 3 calculation if this is a Page 3 input
        if (this.closest('#testingTableBody3')) {
            const inputIndex = Array.from(this.closest('tr').querySelectorAll('input')).indexOf(this);
            calculatePage2ColumnStats(document.getElementById('testingTableBody3'), inputIndex);
        }
    });

    // Add Enter key formatting
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            formatFourDigitsOnEnter(this);
            // Auto-save to database after formatting
            debouncedSave();
        }
    });

    // Add blur formatting (when user clicks away)
    input.addEventListener('blur', function() {
        formatFourDigitsOnEnter(this);
        // Auto-save to database after formatting
        debouncedSave();
    });
}

function applyNoDecimalValidation(input) {
    // Determine if this is 3-digit or 4-digit based on context
    // For now, use 3-digit validation as most cases are 3 digits
    // Tensile Break (4 digits) should use applyFourDigitValidation
    applyThreeDigitValidation(input);
}

function applyTwoDigitOneDecimalValidation(input) {
    input.addEventListener('input', function() {
        validateFlexibleTwoDecimal(this);
        // Auto-save to database after each change (debounced)
        debouncedSave();

        // Trigger Page 2 calculation if this is a Page 2 input
        if (this.closest('#testingTableBody2')) {
            const inputIndex = Array.from(this.closest('tr').querySelectorAll('input')).indexOf(this);
            calculatePage2ColumnStats(document.getElementById('testingTableBody2'), inputIndex);
        }

        // Trigger Page 3 calculation if this is a Page 3 input
        if (this.closest('#testingTableBody3')) {
            const inputIndex = Array.from(this.closest('tr').querySelectorAll('input')).indexOf(this);
            calculatePage2ColumnStats(document.getElementById('testingTableBody3'), inputIndex);
        }
    });

    // Add Enter key formatting
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            formatFlexibleTwoDecimalOnEnter(this);
            // Auto-save to database after formatting
            debouncedSave();
        }
    });

    // Add blur formatting (when user clicks away)
    input.addEventListener('blur', function() {
        formatFlexibleTwoDecimalOnEnter(this);
        // Auto-save to database after formatting
        debouncedSave();

        // Trigger Page 2 calculation if this is a Page 2 input
        if (this.closest('#testingTableBody2')) {
            const inputIndex = Array.from(this.closest('tr').querySelectorAll('input')).indexOf(this);
            calculatePage2ColumnStats(document.getElementById('testingTableBody2'), inputIndex);
        }

        // Trigger Page 3 calculation if this is a Page 3 input
        if (this.closest('#testingTableBody3')) {
            const inputIndex = Array.from(this.closest('tr').querySelectorAll('input')).indexOf(this);
            calculatePage2ColumnStats(document.getElementById('testingTableBody3'), inputIndex);
        }
    });
}


function applyFlexibleTwoDecimalValidation(input, options = {}) {
    input.addEventListener('input', function() {
        validateFlexibleTwoDecimal(this, options);
        // Auto-save to database after each change (debounced)
        debouncedSave();

        // Trigger Page 2 calculation if this is a Page 2 input
        if (this.closest('#testingTableBody2')) {
            const inputIndex = Array.from(this.closest('tr').querySelectorAll('input')).indexOf(this);
            calculatePage2ColumnStats(document.getElementById('testingTableBody2'), inputIndex);
        }

        // Trigger Page 3 calculation if this is a Page 3 input
        if (this.closest('#testingTableBody3')) {
            const inputIndex = Array.from(this.closest('tr').querySelectorAll('input')).indexOf(this);
            calculatePage2ColumnStats(document.getElementById('testingTableBody3'), inputIndex);
        }
    });

    // Add Enter key formatting
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            formatFlexibleTwoDecimalOnEnter(this, options);
            // Auto-save to database after formatting
            debouncedSave();

            // Trigger Page 3 calculation if this is a Page 3 input
            if (this.closest('#testingTableBody3')) {
                const inputIndex = Array.from(this.closest('tr').querySelectorAll('input')).indexOf(this);
                calculatePage2ColumnStats(document.getElementById('testingTableBody3'), inputIndex);
            }
        }
    });

    // Add blur formatting (when user clicks away)
    input.addEventListener('blur', function() {
        formatFlexibleTwoDecimalOnEnter(this, options);
        // Auto-save to database after formatting
        debouncedSave();

        // Trigger Page 2 calculation if this is a Page 2 input
        if (this.closest('#testingTableBody2')) {
            const inputIndex = Array.from(this.closest('tr').querySelectorAll('input')).indexOf(this);
            calculatePage2ColumnStats(document.getElementById('testingTableBody2'), inputIndex);
        }

        // Trigger Page 3 calculation if this is a Page 3 input
        if (this.closest('#testingTableBody3')) {
            const inputIndex = Array.from(this.closest('tr').querySelectorAll('input')).indexOf(this);
            calculatePage2ColumnStats(document.getElementById('testingTableBody3'), inputIndex);
        }
    });
}

function applyFlexibleTwoDecimalWithNegativeValidation(input) {
    input.addEventListener('input', function() {
        validateFlexibleTwoDecimalWithNegative(this);
        // Auto-save to database after each change (debounced)
        debouncedSave();

        // Trigger Page 3 calculation if this is a Page 3 input
        if (this.closest('#testingTableBody3')) {
            const inputIndex = Array.from(this.closest('tr').querySelectorAll('input')).indexOf(this);
            calculatePage2ColumnStats(document.getElementById('testingTableBody3'), inputIndex);
        }
    });

    // Add Enter key formatting
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            formatFlexibleTwoDecimalWithNegativeOnEnter(this);
            // Auto-save to database after formatting
            debouncedSave();

            // Trigger Page 3 calculation if this is a Page 3 input
            if (this.closest('#testingTableBody3')) {
                const inputIndex = Array.from(this.closest('tr').querySelectorAll('input')).indexOf(this);
                calculatePage2ColumnStats(document.getElementById('testingTableBody3'), inputIndex);
            }
        }
    });

    // Add blur formatting (when user clicks away)
    input.addEventListener('blur', function() {
        formatFlexibleTwoDecimalWithNegativeOnEnter(this);
        // Auto-save to database after formatting
        debouncedSave();

        // Trigger Page 3 calculation if this is a Page 3 input
        if (this.closest('#testingTableBody3')) {
            const inputIndex = Array.from(this.closest('tr').querySelectorAll('input')).indexOf(this);
            calculatePage2ColumnStats(document.getElementById('testingTableBody3'), inputIndex);
        }
    });
}

function applyFlexibleOneDecimalValidation(input) {
    // Prevent duplicate validation setup
    if (input.hasAttribute('data-flexible-validation-applied')) {
        return;
    }
    input.setAttribute('data-flexible-validation-applied', 'true');
    
    input.addEventListener('input', function() {
        validateFlexibleOneDecimal(this);
        debouncedSave();
    });
    
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            formatFlexibleOneDecimalOnEnter(this);
            debouncedSave();
        }
    });
    
    input.addEventListener('blur', function() {
        formatFlexibleOneDecimalOnEnter(this);
        debouncedSave();
    });
}

function applyTwoDigitTwoDecimalValidation(input) {
    input.addEventListener('input', function() {
        validateTwoDigitTwoDecimal(this);
        // Auto-save to database after each change (debounced)
        debouncedSave();
        
        // Trigger Page 2 calculation if this is a Page 2 input
        if (this.closest('#testingTableBody2')) {
            const inputIndex = Array.from(this.closest('tr').querySelectorAll('input')).indexOf(this);
            calculatePage2ColumnStats(document.getElementById('testingTableBody2'), inputIndex);
        }

        // Trigger Page 3 calculation if this is a Page 3 input
        if (this.closest('#testingTableBody3')) {
            const inputIndex = Array.from(this.closest('tr').querySelectorAll('input')).indexOf(this);
            calculatePage2ColumnStats(document.getElementById('testingTableBody3'), inputIndex);
        }
    });
    
    // Add Enter key formatting
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            formatTwoDigitTwoDecimalOnEnter(this);
            // Auto-save to database after formatting
            debouncedSave();
        }
    });
    
    // Add blur formatting (when user clicks away)
    input.addEventListener('blur', function() {
        formatTwoDigitTwoDecimalOnEnter(this);
        // Auto-save to database after formatting
        debouncedSave();
        
        // Trigger Page 2 calculation if this is a Page 2 input
        if (this.closest('#testingTableBody2')) {
            const inputIndex = Array.from(this.closest('tr').querySelectorAll('input')).indexOf(this);
            calculatePage2ColumnStats(document.getElementById('testingTableBody2'), inputIndex);
        }

        // Trigger Page 3 calculation if this is a Page 3 input
        if (this.closest('#testingTableBody3')) {
            const inputIndex = Array.from(this.closest('tr').querySelectorAll('input')).indexOf(this);
            calculatePage2ColumnStats(document.getElementById('testingTableBody3'), inputIndex);
        }
    });
}

function applyCOFValidation(input) {
    input.addEventListener('input', function() {
        validateCOF(this);
        // Apply real-time OOS validation
        const row = this.closest('tr');
        const inputs = row.querySelectorAll('input');
        const columnIndex = Array.from(inputs).indexOf(this);
        if (columnIndex === 6) {
            applyOOSValidation(this, 'cofRR');
        } else if (columnIndex === 7) {
            applyOOSValidation(this, 'cofCC');
        }
        // Auto-save to database after each change (debounced)
        debouncedSave();
    });
    
    // Add Enter key formatting
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            formatCOFOnEnter(this);
            // Apply real-time OOS validation
            const row = this.closest('tr');
            const inputs = row.querySelectorAll('input');
            const columnIndex = Array.from(inputs).indexOf(this);
            if (columnIndex === 4) {
                applyOOSValidation(this, 'cofRR');
            } else if (columnIndex === 5) {
                applyOOSValidation(this, 'cofRS');
            }
            // Auto-save to database after formatting
            debouncedSave();
        }
    });
    
    // Add blur formatting (when user clicks away)
    input.addEventListener('blur', function() {
        formatCOFOnEnter(this);
        // Apply real-time OOS validation
        const row = this.closest('tr');
        const inputs = row.querySelectorAll('input');
        const columnIndex = Array.from(inputs).indexOf(this);
        if (columnIndex === 6) {
            applyOOSValidation(this, 'cofRR');
        } else if (columnIndex === 7) {
            applyOOSValidation(this, 'cofCC');
        }
        // Auto-save to database after formatting
        debouncedSave();
    });
}

// Apply validation to existing inputs on form load
function applyValidationToExistingInputs() {
    // Page 1 validation
    const testingTableBody = document.getElementById('testingTableBody');
    if (testingTableBody) {
        const rows = testingTableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const firstCell = row.querySelector('td');
            if (firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim())) {
                const inputs = row.querySelectorAll('input');

                // Film Weight column (index 3) - 00.00 format (2 decimals)
                if (inputs[3]) applyFlexibleTwoDecimalValidation(inputs[3], { maxBeforeDecimal: 2, maxAfterDecimal: 2 });
                // Thickness column (index 4) - simple numeric format (no forced padding)
                if (inputs[4]) applySimpleNumericValidation(inputs[4]);
                // Wettability column (index 5) - 000 format (3 digits, no decimal)
                if (inputs[5]) applyThreeDigitValidation(inputs[5]);
                // COF-RR column (index 6) - COF format (30 → 0.30)
                if (inputs[6]) applyCOFValidation(inputs[6]);
                // COF-CC column (index 7) - COF format (30 → 0.30)
                if (inputs[7]) applyCOFValidation(inputs[7]);
                // Tensile Break column (index 8) - 0000 format (4 digits, no decimal)
                if (inputs[8]) applyFourDigitValidation(inputs[8]);
                // MD Elongation Break column (index 9) - 000 format (3 digits, no decimal)
                if (inputs[9]) applyThreeDigitValidation(inputs[9]);
                // 10% Modulus column (index 10) - 000 format (3 digits, no decimal)
                if (inputs[10]) applyThreeDigitValidation(inputs[10]);
            }
        });
    }

    // Page 2 validation
    const testingTableBody2 = document.getElementById('testingTableBody2');
    if (testingTableBody2) {
        const rows = testingTableBody2.querySelectorAll('tr');
        rows.forEach(row => {
            const firstCell = row.querySelector('td');
            if (firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim())) {
                const inputs = row.querySelectorAll('input');
                
                // Tensile Break column (index 3) - 0000 format (4 digits, no decimal)
                if (inputs[3]) applyFourDigitValidation(inputs[3]);
                // CD Elongation Break column (index 4) - 000 format (3 digits, no decimal)
                if (inputs[4]) applyThreeDigitValidation(inputs[4]);
                // 10% Modulus column (index 5) - 000 format (3 digits, no decimal)
                if (inputs[5]) applyThreeDigitValidation(inputs[5]);
                // Opacity column (index 6) - 00.0 format (1 decimal)
                if (inputs[6]) applyFlexibleTwoDecimalValidation(inputs[6], { maxBeforeDecimal: 2, maxAfterDecimal: 1 });
                // Roll Cut Width column (index 7) - 000 format (3 digits, no decimal)
                if (inputs[7]) applyThreeDigitValidation(inputs[7]);
                // Diameter column (index 8) - 000 format (3 digits, no decimal)
                if (inputs[8]) applyThreeDigitValidation(inputs[8]);

                // Calculate summary statistics for existing data on page load
                calculatePage2ColumnStats(testingTableBody2);
            }
        });

        // Page 3 validation - handled in first section (lines 652-686) to avoid conflicts
    }
}

// ===== CELL HIGHLIGHTING =====
       // Track currently highlighted cell
       let highlightedCell = null;
       
       // Function to clear cell highlighting
       function clearCellHighlighting() {

    
           if (highlightedCell) {
               highlightedCell.classList.remove('highlighted');
               highlightedCell = null;

           }
       }
       
       // Function to highlight a cell
       function highlightCell(cell) {

    
           // Remove previous highlight
           if (highlightedCell) {
               highlightedCell.classList.remove('highlighted');

           }
           
           // Add new highlight
           if (cell) {
               cell.classList.add('highlighted');
               highlightedCell = cell;

               
               // Focus the input inside the cell for keyboard navigation
               const input = cell.querySelector('input');
               if (input) {
                   input.focus();

               }
           }
       }
       
       // Function to add click highlighting to all cells (excluding summary rows)
       function addCellHighlighting() {

    
    const allTables = getAllTableBodies();
           
           allTables.forEach((tableBody, tableIndex) => {

        
               const cells = tableBody.querySelectorAll('td');

               
               cells.forEach((cell, cellIndex) => {
                   // Check if this cell is in a summary row (Average, Min, Max)
                   const row = cell.closest('tr');
                   const firstCellInRow = row.querySelector('td');
                   const isSummaryRow = firstCellInRow && ['Average', 'Minimum', 'Maximum'].includes(firstCellInRow.textContent.trim());
                   
                   // Skip summary rows - no highlighting or events
                   if (isSummaryRow) {

                       return;
                   }
                   
                   // Remove any existing event listeners
                   cell.replaceWith(cell.cloneNode(true));
                   
                   // Get the fresh cell reference
                   const freshCell = tableBody.querySelectorAll('td')[cellIndex];
                   
                   // Add click event
                   freshCell.addEventListener('click', function(e) {

                       e.preventDefault();
                       highlightCell(this);
                   });
                   
                   // Add keyboard navigation to inputs
                   const input = freshCell.querySelector('input');
                   if (input) {
                       input.addEventListener('keydown', function(e) {

                           // Block keyboard navigation in view mode
                    if (isViewMode()) {

                               return;
                           }
                           
                           handleKeyboardNavigation(e, freshCell);
                       });
                   }
               });
        

           });
    

       }
       
       // Function to handle keyboard navigation
       function handleKeyboardNavigation(e, currentCell) {

    
    const allTables = getAllTableBodies();
           let allCells = [];
           
           // Collect all cells from all tables (excluding summary rows)
           allTables.forEach(tableBody => {
               const cells = Array.from(tableBody.querySelectorAll('td'));
               // Filter out cells in summary rows
               const dataCells = cells.filter(cell => {
                   const row = cell.closest('tr');
                   const firstCellInRow = row.querySelector('td');
                   return !firstCellInRow || !['Average', 'Minimum', 'Maximum'].includes(firstCellInRow.textContent.trim());
               });
               allCells = allCells.concat(dataCells);
           });
    

           
           const currentIndex = allCells.indexOf(currentCell);
           let nextCell = null;
           
           // Define columns per row for each table type
           const getColumnsPerRow = (tableBody) => {
               if (tableBody.id === 'testingTableBody') return 11;      // Page 1: 11 columns (3 Sample No + 8 parameters)
               if (tableBody.id === 'testingTableBody2') return 9;      // Page 2: 9 columns (3 Sample No + 6 parameters)
               if (tableBody.id === 'testingTableBody3') return 8;      // Page 3: 8 columns (3 Sample No + 5 parameters)
               return 11; // Default fallback
           };
           
           // Get the current table and its column count
           const currentTable = currentCell.closest('tbody');
           const columnsPerRow = getColumnsPerRow(currentTable);
    

           
           switch(e.key) {
               case 'Tab':

                   e.preventDefault();
                   // Stay within current page for Tab navigation
                   const tabTable = currentCell.closest('tbody');
                   const tabTableCells = Array.from(tabTable.querySelectorAll('td')).filter(cell => {
                       const row = cell.closest('tr');
                       const firstCellInRow = row.querySelector('td');
                       return !firstCellInRow || !['Average', 'Minimum', 'Maximum'].includes(firstCellInRow.textContent.trim());
                   });
                   
                   const tabTableIndex = tabTableCells.indexOf(currentCell);
                   
                   if (e.shiftKey) {
                       // Shift + Tab: move to previous cell within current page
                       nextCell = tabTableIndex > 0 ? tabTableCells[tabTableIndex - 1] : tabTableCells[tabTableCells.length - 1];

                   } else {
                       // Tab: move to next cell within current page
                       nextCell = tabTableIndex < tabTableCells.length - 1 ? tabTableCells[tabTableIndex + 1] : tabTableCells[0];

                   }
                   break;
                   
               case 'ArrowUp':

                   e.preventDefault();
                   // Find cell above (move up by columns per row) but stay within current page
                   const upTable = currentCell.closest('tbody');
                   const upTableCells = Array.from(upTable.querySelectorAll('td')).filter(cell => {
                       const row = cell.closest('tr');
                       const firstCellInRow = row.querySelector('td');
                       return !firstCellInRow || !['Average', 'Minimum', 'Maximum'].includes(firstCellInRow.textContent.trim());
                   });
                   
                   const upTableIndex = upTableCells.indexOf(currentCell);
                   const upColumnsPerRow = getColumnsPerRow(upTable);
                   
                   // Move to row above within the same table
                   const upRowIndex = upTableIndex - upColumnsPerRow;
                   if (upRowIndex >= 0) {
                       nextCell = upTableCells[upRowIndex];

                   } else {
                       // If at first row of current table, stay in the same cell
                       nextCell = currentCell;

                   }
                   break;
                   
               case 'ArrowDown':

                   e.preventDefault();
                   // Find cell below (move down by columns per row) but stay within current page
                   const downTable = currentCell.closest('tbody');
                   const downTableCells = Array.from(downTable.querySelectorAll('td')).filter(cell => {
                       const row = cell.closest('tr');
                       const firstCellInRow = row.querySelector('td');
                       return !firstCellInRow || !['Average', 'Minimum', 'Maximum'].includes(firstCellInRow.textContent.trim());
                   });
                   
                   const downTableIndex = downTableCells.indexOf(currentCell);
                   const downColumnsPerRow = getColumnsPerRow(downTable);
                   
                   // Move to row below within the same table
                   const downRowIndex = downTableIndex + downColumnsPerRow;
                   if (downRowIndex < downTableCells.length) {
                       nextCell = downTableCells[downRowIndex];

                   } else {
                       // If at last row of current table, stay in the same cell
                       nextCell = currentCell;

                   }
                   break;
                   
               case 'ArrowLeft':

                   e.preventDefault();
                   // Move to previous cell but stay within current page
                   const leftTable = currentCell.closest('tbody');
                   const leftTableCells = Array.from(leftTable.querySelectorAll('td')).filter(cell => {
                       const row = cell.closest('tr');
                       const firstCellInRow = row.querySelector('td');
                       return !firstCellInRow || !['Average', 'Minimum', 'Maximum'].includes(firstCellInRow.textContent.trim());
                   });
                   
                   const leftTableIndex = leftTableCells.indexOf(currentCell);
                   
                   // Move to previous cell within the same table
                   if (leftTableIndex > 0) {
                       nextCell = leftTableCells[leftTableIndex - 1];

                   } else {
                       // If at first cell of current table, stay in the same cell
                       nextCell = currentCell;

                   }
                   break;
                   
               case 'ArrowRight':

                   e.preventDefault();
                   // Move to next cell but stay within current page
                   const rightTable = currentCell.closest('tbody');
                   const rightTableCells = Array.from(rightTable.querySelectorAll('td')).filter(cell => {
                       const row = cell.closest('tr');
                       const firstCellInRow = row.querySelector('td');
                       return !firstCellInRow || !['Average', 'Minimum', 'Maximum'].includes(firstCellInRow.textContent.trim());
                   });
                   
                   const rightTableIndex = rightTableCells.indexOf(currentCell);
                   
                   // Move to next cell within the same table
                   if (rightTableIndex < rightTableCells.length - 1) {
                       nextCell = rightTableCells[rightTableIndex + 1];

                   } else {
                       // If at last cell of current table, stay in the same cell
                       nextCell = currentCell;

                   }
                   break;
                   
               case 'Enter':

                   e.preventDefault();
                   // Move to cell below (next row) but stay within current page
                   const enterTable = currentCell.closest('tbody');
                   const enterTableCells = Array.from(enterTable.querySelectorAll('td')).filter(cell => {
                       const row = cell.closest('tr');
                       const firstCellInRow = row.querySelector('td');
                       return !firstCellInRow || !['Average', 'Minimum', 'Maximum'].includes(firstCellInRow.textContent.trim());
                   });
                   
                   const enterTableIndex = enterTableCells.indexOf(currentCell);
                   const enterColumnsPerRow = getColumnsPerRow(enterTable);
                   
                   // Move to next row within the same table
                   const nextRowIndex = enterTableIndex + enterColumnsPerRow;
                   if (nextRowIndex < enterTableCells.length) {
                       nextCell = enterTableCells[nextRowIndex];

                   } else {
                       // If at last row of current table, stay in the same cell
                       nextCell = currentCell;

                   }
                   break;
           }
           
           if (nextCell) {

               highlightCell(nextCell);
           }
       }
       
       // Function to add highlighting to new rows (excluding summary rows)
       function addHighlightingToRow(row) {

    
           // Check if this row is a summary row (Average, Min, Max)
           const firstCellInRow = row.querySelector('td');
           const isSummaryRow = firstCellInRow && ['Average', 'Minimum', 'Maximum'].includes(firstCellInRow.textContent.trim());
           
           // Skip summary rows - no highlighting or events
           if (isSummaryRow) {

               return;
           }
           
           const cells = row.querySelectorAll('td');

    
           cells.forEach(cell => {
               cell.addEventListener('click', function() {

                   highlightCell(this);
               });
               
               // Add keyboard navigation to inputs
               const input = cell.querySelector('input');
               if (input) {
                   input.addEventListener('keydown', function(e) {

                // Block keyboard navigation in view mode
                if (isViewMode()) {

                    return;
                }
                
                       handleKeyboardNavigation(e, cell);
                   });
               }
           });
    

}

// ===== VALIDATION & FORMATTING =====
// Thickness validation function - exactly 0.000 format
function applyThicknessValidation(input) {

    
    input.addEventListener('input', function() {

        validateThickness(this);
        
        // Auto-save to database after each change (debounced)
        debouncedSave();
        
        // Also handle calculations (to avoid duplicate event listeners)
        const tr = this.closest('tr');
        const tableBody = tr.closest('tbody');
        
        // Calculate individual column stats for Page 1 (only the changed column)
        if (tableBody.id === 'testingTableBody') {
            const inputIndex = Array.from(tr.querySelectorAll('input')).indexOf(input);
            calculatePage1ColumnStats(tableBody, inputIndex);
        }
        
        // Force immediate recalculation of ALL summary statistics for instant sync
        triggerSummaryRecalculation(); // Small delay to ensure current calculations complete first
    });
}

// Opacity validation function - exactly 00.0 format
function applyOpacityValidation(input) {

    
    input.addEventListener('input', function() {

        validateOpacity(this);
        
        // Auto-save to database after each change (debounced)
        debouncedSave();
        
        // Also handle calculations (to avoid duplicate event listeners)
        const tr = this.closest('tr');
        const tableBody = tr.closest('tbody');
        
        // Calculate individual column stats for Page 1 (only the changed column)
        if (tableBody.id === 'testingTableBody') {
            const inputIndex = Array.from(tr.querySelectorAll('input')).indexOf(input);
            calculatePage1ColumnStats(tableBody, inputIndex);
        }
        
        // Force immediate recalculation of ALL summary statistics for instant sync
        triggerSummaryRecalculation(); // Small delay to ensure current calculations complete first
    });
}

// Note: Conditional formatting functions removed - using applyOOSValidation system only

// Function to calculate averages for each row
function calculateRowAverages(row, tableBody) {

    
    const cells = row.querySelectorAll('td');
    const inputs = row.querySelectorAll('input');
    
    // Only process Pages 2, 3, 4 (Page 1 doesn't have subgroups)
    if (tableBody.id === 'testingTableBody') {

        return; // Page 1 doesn't have subgroups
    }
    
    // Determine which table we're working with based on tableBody ID
    if (tableBody.id === 'testingTableBody2') {

        // Page 2: Elongation@ Break(%) MD, Force~Tensile Strength@Break(N)MD, Force~Tensile Strength@Break 5% (N)MD
        // Columns: Sample No (3 cols), Elongation MD (4 cols), Force MD (4 cols), Force 5% MD (4 cols)
        calculateSubgroupAverage(inputs, 3, 6, 'testingTableBody2'); // Elongation MD: cols 3,4,5 -> Ave at 6
        calculateSubgroupAverage(inputs, 7, 10, 'testingTableBody2'); // Force MD: cols 7,8,9 -> Ave at 10
        calculateSubgroupAverage(inputs, 11, 14, 'testingTableBody2'); // Force 5% MD: cols 11,12,13 -> Ave at 14
    }
    

}

// Function to calculate summary statistics (Average, Min, Max) for vertical Ave columns
// Calculate summary statistics for Page 1 columns
function calculateSummaryStatistics(tableBody) {
    if (tableBody.id !== 'testingTableBody') {
        return;
    }
    
    const rows = tableBody.querySelectorAll('tr');
    const dataRows = Array.from(rows).filter(row => {
        const firstCell = row.querySelector('td');
        return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
    });
    
    if (dataRows.length === 0) {
        return;
    }
    
    // Page 1 columns: Film Weight (3), Thickness (4), Wettability (5), COF-RR (6), COF-CC (7), Tensile Break (8), Elongation (9), 10% Modulus (10)
    const summaryColumnIndices = [1, 2, 3, 4, 5, 6, 7, 8]; // Summary row column positions
    const inputColumnIndices = [3, 4, 5, 6, 7, 8, 9, 10]; // Input columns in data rows (after Sample No colspan=3)
    
    // Calculate statistics for each column
    inputColumnIndices.forEach((inputColIndex, index) => {
        const summaryColIndex = summaryColumnIndices[index];
        const values = [];
        
        // Collect values from this input column
        dataRows.forEach(row => {
            const inputs = row.querySelectorAll('input');
            if (inputs[inputColIndex] && inputs[inputColIndex].value.trim() !== '') {
                const value = parseFloat(inputs[inputColIndex].value);
                if (!isNaN(value)) {
                    values.push(value);
                }
            }
        });
        
        // Calculate statistics
        if (values.length > 0) {
            const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
            const min = Math.min(...values);
            const max = Math.max(...values);
            
            // Format based on column specifications for Page 1
            let avgFormatted, minFormatted, maxFormatted;

            if (summaryColIndex === 1) { // Film Weight - 2 decimals
                avgFormatted = avg.toFixed(2);
                minFormatted = min.toFixed(2);
                maxFormatted = max.toFixed(2);
            } else if (summaryColIndex === 2) { // Thickness - 0 decimals
                avgFormatted = avg.toFixed(0);
                minFormatted = min.toFixed(0);
                maxFormatted = max.toFixed(0);
            } else if (summaryColIndex === 3) { // Wettability - 0 decimals
                avgFormatted = avg.toFixed(0);
                minFormatted = min.toFixed(0);
                maxFormatted = max.toFixed(0);
            } else if (summaryColIndex === 4) { // COF-RR - 2 decimals
                avgFormatted = avg.toFixed(2);
                minFormatted = min.toFixed(2);
                maxFormatted = max.toFixed(2);
            } else if (summaryColIndex === 5) { // COF-CC - 2 decimals
                avgFormatted = avg.toFixed(2);
                minFormatted = min.toFixed(2);
                maxFormatted = max.toFixed(2);
            } else if (summaryColIndex === 6) { // Tensile Break - 0 decimals
                avgFormatted = avg.toFixed(0);
                minFormatted = min.toFixed(0);
                maxFormatted = max.toFixed(0);
            } else if (summaryColIndex === 7) { // MD Elongation Break - 0 decimals
                avgFormatted = avg.toFixed(0);
                minFormatted = min.toFixed(0);
                maxFormatted = max.toFixed(0);
            } else if (summaryColIndex === 8) { // 10% Modulus - 0 decimals
                avgFormatted = avg.toFixed(0);
                minFormatted = min.toFixed(0);
                maxFormatted = max.toFixed(0);
            } else { // Default fallback
                avgFormatted = avg.toFixed(2);
                minFormatted = min.toFixed(2);
                maxFormatted = max.toFixed(2);
            }

            // Update summary rows
            updatePage1SummaryRow(tableBody, 'Average', summaryColIndex, avgFormatted);
            updatePage1SummaryRow(tableBody, 'Minimum', summaryColIndex, minFormatted);
            updatePage1SummaryRow(tableBody, 'Maximum', summaryColIndex, maxFormatted);
        } else {
            // No data, set to 0 with appropriate formatting
            let zeroFormatted;
                if (summaryColIndex === 1) { // Film Weight - 2 decimals
                    zeroFormatted = '0.00';
            } else if (summaryColIndex === 2) { // Thickness - 0 decimals
                zeroFormatted = '0';
            } else if (summaryColIndex === 3) { // Wettability - 0 decimals
                zeroFormatted = '0';
            } else if (summaryColIndex === 4 || summaryColIndex === 5) { // COF-RR, COF-CC - 2 decimals
                zeroFormatted = '0.00';
            } else if (summaryColIndex >= 6) { // Tensile Break, MD Elongation Break, 10% Modulus - 0 decimals
                zeroFormatted = '0';
            } else { // Default fallback
                zeroFormatted = '0.00';
            }
            
            updatePage1SummaryRow(tableBody, 'Average', summaryColIndex, zeroFormatted);
            updatePage1SummaryRow(tableBody, 'Minimum', summaryColIndex, zeroFormatted);
            updatePage1SummaryRow(tableBody, 'Maximum', summaryColIndex, zeroFormatted);
        }
    });
}

// Helper function to update Page 1 summary rows
function updatePage1SummaryRow(tableBody, rowType, columnIndex, value) {
    const rows = tableBody.querySelectorAll('tr');
    const summaryRow = Array.from(rows).find(row => {
        const firstCell = row.querySelector('td');
        return firstCell && firstCell.textContent.trim() === rowType;
    });
    
    if (summaryRow) {
        const cells = summaryRow.querySelectorAll('td');
        if (cells[columnIndex]) {
            cells[columnIndex].textContent = value;
        }
    }
}

// Function to calculate individual column statistics for Page 1
function calculatePage1ColumnStats(tableBody, changedColumnIndex = null) {
    if (tableBody.id !== 'testingTableBody') {
        return;
    }

    const rows = tableBody.querySelectorAll('tr');
    const dataRows = Array.from(rows).filter(row => {
        const firstCell = row.querySelector('td');
        return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
    });

    if (dataRows.length === 0) return;

    // Page 1 columns: Film Weight (3), Thickness (4), Wettability (5), COF-RR (6), COF-CC (7), Tensile Break (8), MD Elongation Break (9), 10% Modulus (10)
    const summaryColumnIndices = [1, 2, 3, 4, 5, 6, 7, 8]; // Summary row column positions
    const inputColumnIndices = [3, 4, 5, 6, 7, 8, 9, 10]; // Input columns in data rows (after Sample No colspan=3)
    
    // If a specific column changed, only update that column
    if (changedColumnIndex !== null) {
        const columnIndex = inputColumnIndices.indexOf(changedColumnIndex);
        if (columnIndex !== -1) {
            const inputColIndex = inputColumnIndices[columnIndex];
            const summaryColIndex = summaryColumnIndices[columnIndex];
            const values = [];
            
            // Collect values from this input column
            dataRows.forEach(row => {
                const inputs = row.querySelectorAll('input');
                if (inputs[inputColIndex] && inputs[inputColIndex].value.trim() !== '') {
                    const value = parseFloat(inputs[inputColIndex].value);
                    if (!isNaN(value)) {
                        values.push(value);
                    }
                }
            });
            
            // Calculate statistics
            if (values.length > 0) {
                const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
                const min = Math.min(...values);
                const max = Math.max(...values);
                
                // Format based on column specifications for Page 1
                let avgFormatted, minFormatted, maxFormatted;

                if (summaryColIndex === 1) { // Film Weight - 2 decimals
                    avgFormatted = avg.toFixed(2);
                    minFormatted = min.toFixed(2);
                    maxFormatted = max.toFixed(2);
                } else if (summaryColIndex === 2) { // Thickness - 0 decimals
                    avgFormatted = avg.toFixed(0);
                    minFormatted = min.toFixed(0);
                    maxFormatted = max.toFixed(0);
                } else if (summaryColIndex === 3) { // Wettability - 0 decimals
                    avgFormatted = avg.toFixed(0);
                    minFormatted = min.toFixed(0);
                    maxFormatted = max.toFixed(0);
                } else if (summaryColIndex === 4) { // COF-RR - 2 decimals
                    avgFormatted = avg.toFixed(2);
                    minFormatted = min.toFixed(2);
                    maxFormatted = max.toFixed(2);
                } else if (summaryColIndex === 5) { // COF-CC - 2 decimals
                    avgFormatted = avg.toFixed(2);
                    minFormatted = min.toFixed(2);
                    maxFormatted = max.toFixed(2);
                } else if (summaryColIndex === 6) { // Tensile Break - 0 decimals
                    avgFormatted = avg.toFixed(0);
                    minFormatted = min.toFixed(0);
                    maxFormatted = max.toFixed(0);
                } else if (summaryColIndex === 7) { // MD Elongation Break - 0 decimals
                    avgFormatted = avg.toFixed(0);
                    minFormatted = min.toFixed(0);
                    maxFormatted = max.toFixed(0);
                } else if (summaryColIndex === 8) { // 10% Modulus - 0 decimals
                    avgFormatted = avg.toFixed(0);
                    minFormatted = min.toFixed(0);
                    maxFormatted = max.toFixed(0);
                } else { // Default fallback
                    avgFormatted = avg.toFixed(2);
                    minFormatted = min.toFixed(2);
                    maxFormatted = max.toFixed(2);
                }

                // Update summary rows
                updatePage1SummaryRow(tableBody, 'Average', summaryColIndex, avgFormatted);
                updatePage1SummaryRow(tableBody, 'Minimum', summaryColIndex, minFormatted);
                updatePage1SummaryRow(tableBody, 'Maximum', summaryColIndex, maxFormatted);
            } else {
                // No data, set to 0 with appropriate formatting
                let zeroFormatted;
                if (summaryColIndex === 1) { // Film Weight - 2 decimals
                    zeroFormatted = '0.00';
                } else if (summaryColIndex === 2) { // Thickness - 0 decimals
                    zeroFormatted = '0';
                } else if (summaryColIndex === 3) { // Wettability - 0 decimals
                    zeroFormatted = '0';
                } else if (summaryColIndex === 4 || summaryColIndex === 5) { // COF-RR, COF-CC - 2 decimals
                    zeroFormatted = '0.00';
                } else if (summaryColIndex >= 6) { // Tensile Break, MD Elongation Break, 10% Modulus - 0 decimals
                    zeroFormatted = '0';
                } else { // Default fallback
                    zeroFormatted = '0.00';
                }
                
                updatePage1SummaryRow(tableBody, 'Average', summaryColIndex, zeroFormatted);
                updatePage1SummaryRow(tableBody, 'Minimum', summaryColIndex, zeroFormatted);
                updatePage1SummaryRow(tableBody, 'Maximum', summaryColIndex, zeroFormatted);
            }
        }
        return;
    } else {
        // Calculate all columns initially
        calculateSummaryStatistics(tableBody);
    }
}

// Function to calculate individual column statistics for Page 2 and 3
function calculatePage2ColumnStats(tableBody, changedColumnIndex = null) {
    if (tableBody.id !== 'testingTableBody2' && tableBody.id !== 'testingTableBody3') {
        return;
    }

    const isPage3 = tableBody.id === 'testingTableBody3';

    const rows = tableBody.querySelectorAll('tr');
    const dataRows = Array.from(rows).filter(row => {
        const firstCell = row.querySelector('td');
        return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
    });

    if (dataRows.length === 0) return;

    // Column configuration based on page
    let summaryColumnIndices, inputColumnIndices, columnDescriptions;
    if (isPage3) {
        // Page 3 columns: Colour L (3), Colour A (4), Colour B (5), Delta E (6), Base Film Pink (7)
        summaryColumnIndices = [1, 2, 3, 4, 5]; // Summary row column positions (5 data columns)
        inputColumnIndices = [3, 4, 5, 6, 7]; // Input columns in data rows (after Sample No colspan=3)
        columnDescriptions = ['Colour L', 'Colour A', 'Colour B', 'Delta E', 'Base Film Pink'];
    } else {
        // Page 2 columns: Tensile Break (3), CD Elongation Break (4), 10% Modulus (5), Opacity (6), Roll Cut Width (7), Diameter (8)
        summaryColumnIndices = [1, 2, 3, 4, 5, 6]; // Summary row column positions (6 data columns)
        inputColumnIndices = [3, 4, 5, 6, 7, 8]; // Input columns in data rows (after Sample No colspan=3) - 6 columns total
        columnDescriptions = ['Tensile Break', 'CD Elongation Break', '10% Modulus', 'Opacity', 'Roll Cut Width', 'Diameter'];
    }
    
    // If a specific column changed, only update that column
    if (changedColumnIndex !== null) {
        const columnIndex = inputColumnIndices.indexOf(changedColumnIndex);
        if (columnIndex !== -1) {
            const inputColIndex = inputColumnIndices[columnIndex];
            const summaryColIndex = summaryColumnIndices[columnIndex];
            const values = [];
            
            // Collect values from this input column
            dataRows.forEach(row => {
                const inputs = row.querySelectorAll('input');
                if (inputs[inputColIndex] && inputs[inputColIndex].value.trim() !== '') {
                    const value = parseFloat(inputs[inputColIndex].value);
                    if (!isNaN(value)) {
                        values.push(value);
                    }
                }
            });
            
            // Calculate statistics
            if (values.length > 0) {
                const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
                const min = Math.min(...values);
                const max = Math.max(...values);
                
                // Format based on column specifications
                let avgFormatted, minFormatted, maxFormatted;

                if (isPage3) {
                    // Page 3 column formatting
                    if (summaryColIndex === 1) { // Colour L - 2 decimals
                        avgFormatted = avg.toFixed(2);
                        minFormatted = min.toFixed(2);
                        maxFormatted = max.toFixed(2);
                    } else if (summaryColIndex === 2) { // Colour A - 2 decimals
                        avgFormatted = avg.toFixed(2);
                        minFormatted = min.toFixed(2);
                        maxFormatted = max.toFixed(2);
                    } else if (summaryColIndex === 3) { // Colour B - 2 decimals
                        avgFormatted = avg.toFixed(2);
                        minFormatted = min.toFixed(2);
                        maxFormatted = max.toFixed(2);
                    } else if (summaryColIndex === 4) { // Delta E - 2 decimals
                        avgFormatted = avg.toFixed(2);
                        minFormatted = min.toFixed(2);
                        maxFormatted = max.toFixed(2);
                    } else if (summaryColIndex === 5) { // Base Film Pink - 2 decimals
                        avgFormatted = avg.toFixed(2);
                        minFormatted = min.toFixed(2);
                        maxFormatted = max.toFixed(2);
                    } else { // Default fallback
                        avgFormatted = avg.toFixed(2);
                        minFormatted = min.toFixed(2);
                        maxFormatted = max.toFixed(2);
                    }
                } else {
                    // Page 2 column formatting
                    if (summaryColIndex === 1) { // Tensile Break - 0 decimals
                        avgFormatted = avg.toFixed(0);
                        minFormatted = min.toFixed(0);
                        maxFormatted = max.toFixed(0);
                    } else if (summaryColIndex === 2) { // CD Elongation Break - 0 decimals
                        avgFormatted = avg.toFixed(0);
                        minFormatted = min.toFixed(0);
                        maxFormatted = max.toFixed(0);
                    } else if (summaryColIndex === 3) { // 10% Modulus - 0 decimals
                        avgFormatted = avg.toFixed(0);
                        minFormatted = min.toFixed(0);
                        maxFormatted = max.toFixed(0);
                    } else if (summaryColIndex === 4) { // Opacity - 1 decimal
                        avgFormatted = avg.toFixed(1);
                        minFormatted = min.toFixed(1);
                        maxFormatted = max.toFixed(1);
                    } else if (summaryColIndex === 5) { // Roll Cut Width - 0 decimals
                        avgFormatted = avg.toFixed(0);
                        minFormatted = min.toFixed(0);
                        maxFormatted = max.toFixed(0);
                    } else if (summaryColIndex === 6) { // Diameter - 0 decimals
                        avgFormatted = avg.toFixed(0);
                        minFormatted = min.toFixed(0);
                        maxFormatted = max.toFixed(0);
                    } else { // Default fallback
                        avgFormatted = avg.toFixed(2);
                        minFormatted = min.toFixed(2);
                        maxFormatted = max.toFixed(2);
                    }
                }
                
                // Update summary rows
                updatePageSummaryRow(tableBody, 'Average', summaryColIndex, avgFormatted);
                updatePageSummaryRow(tableBody, 'Minimum', summaryColIndex, minFormatted);
                updatePageSummaryRow(tableBody, 'Maximum', summaryColIndex, maxFormatted);
            } else {
                // No data - show zeros
                const zeroFormatted = summaryColIndex <= 4 || summaryColIndex === 8 ? '0.00' : '0.0';
                updatePageSummaryRow(tableBody, 'Average', summaryColIndex, zeroFormatted);
                updatePageSummaryRow(tableBody, 'Minimum', summaryColIndex, zeroFormatted);
                updatePageSummaryRow(tableBody, 'Maximum', summaryColIndex, zeroFormatted);
            }
        }
        return;
    } else {
        // Calculate all columns initially
        calculatePage2SummaryStatistics(tableBody);
    }
}

// Function to calculate Page 2 summary statistics
function calculatePage2SummaryStatistics(tableBody) {
    if (tableBody.id !== 'testingTableBody2') {
        return;
    }
    
    const rows = tableBody.querySelectorAll('tr');
    const dataRows = Array.from(rows).filter(row => {
        const firstCell = row.querySelector('td');
        return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
    });
    
    if (dataRows.length === 0) return;
    
    // Page 2 columns: Tensile Break (3), CD Elongation Break (4), 10% Modulus (5), Opacity (6), Roll Cut Width (7), Diameter (8)
    const summaryColumnIndices = [1, 2, 3, 4, 5, 6]; // Summary row column positions (6 data columns)
    const inputColumnIndices = [3, 4, 5, 6, 7, 8]; // Input columns in data rows (after Sample No colspan=3)
    
    // Calculate statistics for each column
    inputColumnIndices.forEach((inputColIndex, index) => {
        const summaryColIndex = summaryColumnIndices[index];
        const values = [];
        
        // Collect values from this input column
        dataRows.forEach(row => {
            const inputs = row.querySelectorAll('input');
            if (inputs[inputColIndex] && inputs[inputColIndex].value.trim() !== '') {
                const value = parseFloat(inputs[inputColIndex].value);
                if (!isNaN(value)) {
                    values.push(value);
                }
            }
        });
        
        // Calculate statistics
        if (values.length > 0) {
            const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
            const min = Math.min(...values);
            const max = Math.max(...values);
            
            // Format based on column type
            let avgFormatted, minFormatted, maxFormatted;

            if (isPage3) {
                // Page 3 formatting
                if (summaryColIndex <= 3) { // Colour L, A, B (2 decimals)
                    avgFormatted = avg.toFixed(2);
                    minFormatted = min.toFixed(2);
                    maxFormatted = max.toFixed(2);
                } else { // Delta E and Base Film Pink (2 decimals)
                    avgFormatted = avg.toFixed(2);
                    minFormatted = min.toFixed(2);
                    maxFormatted = max.toFixed(2);
                }
            } else {
                // Page 2 formatting
                if (summaryColIndex <= 3) { // Tensile Break, CD Elongation Break, 10% Modulus (no decimal)
                    avgFormatted = avg.toFixed(0);
                    minFormatted = min.toFixed(0);
                    maxFormatted = max.toFixed(0);
                } else if (summaryColIndex === 4) { // Opacity (1 decimal)
                    avgFormatted = avg.toFixed(1);
                    minFormatted = min.toFixed(1);
                    maxFormatted = max.toFixed(1);
                } else { // Roll Cut Width, Diameter (no decimal)
                    avgFormatted = avg.toFixed(0);
                    minFormatted = min.toFixed(0);
                    maxFormatted = max.toFixed(0);
                }
            }
            
            // Update summary rows
            updatePageSummaryRow(tableBody, 'Average', summaryColIndex, avgFormatted);
            updatePageSummaryRow(tableBody, 'Minimum', summaryColIndex, minFormatted);
            updatePageSummaryRow(tableBody, 'Maximum', summaryColIndex, maxFormatted);
        } else {
            // No data - show zeros
            let zeroFormatted;
            if (tableBody.id === 'testingTableBody3') {
                // Page 3 formatting
                if (summaryColIndex <= 3) { // Colour L, A, B (2 decimals)
                    zeroFormatted = '0.00';
                } else { // Delta E, Base Film Pink (2 decimals)
                    zeroFormatted = '0.00';
                }
            } else {
                // Page 2 formatting
                if (summaryColIndex <= 3) { // Tensile Break, CD Elongation Break, 10% Modulus (no decimal)
                    zeroFormatted = '0';
                } else if (summaryColIndex === 4) { // Opacity (1 decimal)
                    zeroFormatted = '0.0';
                } else { // Roll Cut Width, Diameter (no decimal)
                    zeroFormatted = '0';
                }
            }
            updatePageSummaryRow(tableBody, 'Average', summaryColIndex, zeroFormatted);
            updatePageSummaryRow(tableBody, 'Minimum', summaryColIndex, zeroFormatted);
            updatePageSummaryRow(tableBody, 'Maximum', summaryColIndex, zeroFormatted);
        }
    });
}

// Function to calculate Page 3 summary statistics
function calculatePage3SummaryStatistics(tableBody) {
    if (tableBody.id !== 'testingTableBody3') {
        return;
    }

    const rows = tableBody.querySelectorAll('tr');
    const dataRows = Array.from(rows).filter(row => {
        const firstCell = row.querySelector('td');
        return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
    });

    if (dataRows.length === 0) return;

    // Page 3 columns: Colour L (3), Colour A (4), Colour B (5), Delta E (6), Base Film Pink (7)
    const summaryColumnIndices = [1, 2, 3, 4, 5]; // Summary row column positions (5 data columns)
    const inputColumnIndices = [3, 4, 5, 6, 7]; // Input columns in data rows (after Sample No colspan=3)

    // Calculate statistics for each column
    inputColumnIndices.forEach((inputColIndex, index) => {
        const summaryColIndex = summaryColumnIndices[index];
        const values = [];

        // Collect values from this input column
        dataRows.forEach(row => {
            const inputs = row.querySelectorAll('input');
            if (inputs[inputColIndex] && inputs[inputColIndex].value.trim() !== '') {
                const value = parseFloat(inputs[inputColIndex].value);
                if (!isNaN(value)) {
                    values.push(value);
                }
            }
        });

        // Calculate statistics
        if (values.length > 0) {
            const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
            const min = Math.min(...values);
            const max = Math.max(...values);

            // Format based on column type
            let avgFormatted, minFormatted, maxFormatted;

            // Page 3 formatting
            if (summaryColIndex <= 3) { // Colour L, A, B (2 decimals)
                avgFormatted = avg.toFixed(2);
                minFormatted = min.toFixed(2);
                maxFormatted = max.toFixed(2);
            } else { // Delta E, Base Film Pink (2 decimals)
                avgFormatted = avg.toFixed(2);
                minFormatted = min.toFixed(2);
                maxFormatted = max.toFixed(2);
            }

            // Update summary rows
            updatePageSummaryRow(tableBody, 'Average', summaryColIndex, avgFormatted);
            updatePageSummaryRow(tableBody, 'Minimum', summaryColIndex, minFormatted);
            updatePageSummaryRow(tableBody, 'Maximum', summaryColIndex, maxFormatted);
        } else {
            // No data - show zeros
            let zeroFormatted;
            // Page 3 formatting
            if (summaryColIndex <= 3) { // Colour L, A, B (2 decimals)
                zeroFormatted = '0.00';
            } else { // Delta E, Base Film Pink (2 decimals)
                zeroFormatted = '0.00';
            }
            updatePageSummaryRow(tableBody, 'Average', summaryColIndex, zeroFormatted);
            updatePageSummaryRow(tableBody, 'Minimum', summaryColIndex, zeroFormatted);
            updatePageSummaryRow(tableBody, 'Maximum', summaryColIndex, zeroFormatted);
        }
    });

}

// Helper function to update Page 2 and 3 summary row
function updatePageSummaryRow(tableBody, rowType, columnIndex, value) {
    const rows = tableBody.querySelectorAll('tr');
    const summaryRow = Array.from(rows).find(row => {
        const firstCell = row.querySelector('td');
        return firstCell && firstCell.textContent.trim() === rowType;
    });

    if (summaryRow) {
        const cells = summaryRow.querySelectorAll('td');
        if (cells[columnIndex]) {
            cells[columnIndex].textContent = value;
        }
    }
}

// Helper function to calculate subgroup average
function calculateSubgroupAverage(inputs, startIndex, aveIndex, tableBodyId) {

    
    const values = [];
    for (let i = startIndex; i < aveIndex; i++) {
        const input = inputs[i];
        if (input) {
            const value = parseFloat(input.value);
            if (!isNaN(value)) {
                values.push(value);
            }
        }
    }
    
    if (values.length > 0) {
        const average = values.reduce((sum, val) => sum + val, 0) / values.length;
        const aveInput = inputs[aveIndex];
        if (aveInput) {
            aveInput.value = average.toFixed(2);

        }
    }
}

// Helper function to update summary row
function updateSummaryRow(tableBody, columnIndex, average, minimum, maximum) {

    
    const summaryRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
                     const firstCell = row.querySelector('td');
        return firstCell && ['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
    });
    
    summaryRows.forEach(row => {
        const firstCell = row.querySelector('td');
        const rowType = firstCell.textContent.trim();
                         const inputs = row.querySelectorAll('input');
        const input = inputs[columnIndex];
        
        if (input) {
            let value = 0;
            switch (rowType) {
                case 'Average':
                    value = average;
                    break;
                case 'Minimum':
                    value = minimum;
                    break;
                case 'Maximum':
                    value = maximum;
                    break;
            }
            
            input.value = value.toFixed(2);

        }
    });
}

// Helper function to trigger summary recalculation
function triggerSummaryRecalculation() {

    
    setTimeout(() => {
        forceRecalculateAllSummaryStatistics();
    }, 50);
}

// Force recalculation of all summary statistics
         function forceRecalculateAllSummaryStatistics() {


    const allTables = getAllTableBodies();
    allTables.forEach(tableBody => {
        // Page 2 has NO Ave columns - all columns are individual data collectors
        // No summary statistics calculation needed for Page 2
        if (tableBody.id === 'testingTableBody2') {
            // Skip Page 2 - no summary statistics needed
            return;
        }

        // Calculate summary statistics for Page 3
        if (tableBody.id === 'testingTableBody3') {
            calculatePage3SummaryStatistics(tableBody);
        }
    });


}

// Recalculate averages for all rows on Page 1 (compat with calls in historical loader)
function recalculateAllRowAverages() {
    try {
        const tableBody = document.getElementById('testingTableBody');
        if (!tableBody) return;
        // Recalculate all page 1 column stats, which also updates summary rows
        calculatePage1ColumnStats(tableBody);
    } catch (error) {
        console.warn('⚠️  recalculateAllRowAverages fallback failed:', error);
    }
}

// ===== FORM INITIALIZATION =====
// Function to update tab order for all rows in a table
function updateTabOrderForAllRows(tableBody) {

    
                 const dataRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
                     const firstCell = row.querySelector('td');
                     return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
                 });
                 

    
    // Determine column count based on table
    let columnCount;
    if (tableBody.id === 'testingTableBody') {
        columnCount = 11; // Page 1: 3 Sample No + 8 data columns (Film Weight, Thickness, Wettability, COF-RR, COF-CC, Tensile Break, Elongation, 10% Modulus) = 11 columns

    } else if (tableBody.id === 'testingTableBody2') {
        columnCount = 9; // Page 2: 3 Sample No + 6 data columns (Tensile Break, CD Elongation Break, 10% Modulus, Opacity, Roll Cut Width, Diameter) = 9 columns

    } else if (tableBody.id === 'testingTableBody3') {
        columnCount = 8; // Page 3: 3 Sample No + 5 data columns (Colour L, Colour A, Colour B, Delta E, Base Film Pink) = 8 columns

    } else {
        columnCount = 7; // Default fallback

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

    
           // Remove summary rows temporarily
           const summaryRows = [];
           const rows = Array.from(tableBody.querySelectorAll('tr'));
           rows.forEach(row => {
               const firstCell = row.querySelector('td');
               if (firstCell && ['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim())) {
                   summaryRows.push(row);
                   row.remove();
               }
           });

           // Get existing data rows for tab order calculation
           const existingDataRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
               const firstCell = row.querySelector('td');
               return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
           });

           // Pre-calculate table properties for performance
           const isPage1 = tableBody.id === 'testingTableBody';
           const isPage2 = tableBody.id === 'testingTableBody2';
           const isPage3 = tableBody.id === 'testingTableBody3';
           
           let columnCount;
    if (isPage1) {
               columnCount = 11; // Page 1: 3 Sample No + 8 data columns (Film Weight, Thickness, Wettability, COF-RR, COF-CC, Tensile Break, Elongation, 10% Modulus) = 11 columns
           } else if (isPage2) {
               columnCount = 9; // Page 2: 3 Sample No + 6 data columns (Tensile Break, CD Elongation Break, 10% Modulus, Opacity, Roll Cut Width, Diameter) = 9 columns
           } else if (isPage3) {
               columnCount = 8; // Page 3: 3 Sample No + 5 data columns (Colour L, Colour A, Colour B, Delta E, Base Film Pink) = 8 columns
           } else {
        columnCount = 11; // Default fallback
           }

           // Use DocumentFragment for better performance
           const fragment = document.createDocumentFragment();

           // Calculate the starting row index for tab order (existing rows)
    const startRowIndex = existingDataRows.length;

            for (let i = 0; i < n; i++) {
                const tr = document.createElement('tr');
        tr.className = 'border border-gray-800 px-3 py-2 text-center';
                
                for (let j = 0; j < columnCount; j++) {
                    const td = document.createElement('td');
                   td.className = 'testing-table-cell';
                    td.style.fontSize = '13px';
                    
                    const input = document.createElement('input');
                    input.type = 'text';
                       input.className = 'testing-input';
            
            // Set default values and apply conditional formatting (like 16 GSM Kranti)
            if (j === 0) {
                // First column: Lot & Roll - make it an input field instead of auto-generated
                input.value = '';
                input.placeholder = '';

                // Apply Lot & Roll validation (00-00 format) only on Page 1
                if (tableBody.id === 'testingTableBody') {
                    applyLotRollValidation(input);
                } else if (tableBody.id === 'testingTableBody2') {
                    // Make read-only on Page 2 (like 16 GSM Kranti)
                    input.readOnly = true;
                    input.style.backgroundColor = 'transparent';
                    input.style.color = '#000000';
                } else if (tableBody.id === 'testingTableBody3') {
                    // Page 3: First column should be auto-populated with sample number
                    const rowNumber = startRowIndex + i + 1;
                    input.value = rowNumber.toString();
                    input.readOnly = true;
                    input.style.backgroundColor = 'transparent';
                    input.style.color = '#000000';
                    input.style.textAlign = 'center';
                }
            } else if (j === 1) {
                // Second column: Roll ID - make it an input field instead of auto-generated
                input.value = '';
                input.placeholder = '';

                // Apply Roll ID validation (00000000 format) only on Page 1
                if (tableBody.id === 'testingTableBody') {
                    applyRollIDValidation(input);
                } else if (tableBody.id === 'testingTableBody2') {
                    // Make read-only on Page 2 (like 16 GSM Kranti)
                    input.readOnly = true;
                    input.style.backgroundColor = 'transparent';
                    input.style.color = '#000000';
                } else if (tableBody.id === 'testingTableBody3') {
                    // Page 3: Second column should be auto-populated with sample number
                    const rowNumber = startRowIndex + i + 1;
                    input.value = rowNumber.toString();
                    input.readOnly = true;
                    input.style.backgroundColor = 'transparent';
                    input.style.color = '#000000';
                    input.style.textAlign = 'center';
                }
            } else if (j === 2) {
                // Third column: Lot Time - make it an input field
                input.value = '';
                input.placeholder = '';

                // Apply Lot Time validation (00:00 format) only on Page 1
                if (tableBody.id === 'testingTableBody') {
                    applyLotTimeValidation(input);
                } else if (tableBody.id === 'testingTableBody2') {
                    // Make read-only on Page 2 (like 16 GSM Kranti)
                    input.readOnly = true;
                    input.style.backgroundColor = 'transparent';
                    input.style.color = '#000000';
                } else if (tableBody.id === 'testingTableBody3') {
                    // Page 3: Third column should be auto-populated with sample number
                    const rowNumber = startRowIndex + i + 1;
                    input.value = rowNumber.toString();
                    input.readOnly = true;
                    input.style.backgroundColor = 'transparent';
                    input.style.color = '#000000';
                    input.style.textAlign = 'center';
                }
            } else {
                // All other columns - empty by default
                input.value = '';
                
                // Apply validation based on column and page
                if (isPage1) {
                    // Page 1 validation
                    if (j === 3) {
                        // Film Weight column - 2 digit 2 decimal (00.00 format)
                        applyFlexibleTwoDecimalValidation(input, { maxBeforeDecimal: 2, maxAfterDecimal: 2 });
                        // Apply OOS validation
                        applyOOSValidation(input, 'filmWeight');
                        // Add real-time OOS validation
                        input.addEventListener('input', function() {
                            applyOOSValidation(this, 'filmWeight');
                        });
                    } else if (j === 4) {
                        // Thickness column - simple numeric format (no forced padding)
                        applySimpleNumericValidation(input);
                        // Apply OOS validation
                        applyOOSValidation(input, 'thickness');
                        // Add real-time OOS validation
                        input.addEventListener('input', function() {
                            applyOOSValidation(this, 'thickness');
                        });
                    } else if (j === 5) {
                        // Wettability column - flexible format for manual entry
                        // Apply OOS validation
                        applyOOSValidation(input, 'wettability');
                        // Add real-time OOS validation
                        input.addEventListener('input', function() {
                            applyOOSValidation(this, 'wettability');
                        });
                    } else if (j === 6) {
                        // COF-RR column - COF format (30 → 0.30)
                        applyCOFValidation(input);
                        // Apply OOS validation
                        applyOOSValidation(input, 'cofRR');
                        // Add real-time OOS validation
                        input.addEventListener('input', function() {
                            applyOOSValidation(this, 'cofRR');
                        });
                    } else if (j === 7) {
                        // COF-CC column - COF format (30 → 0.30)
                        applyCOFValidation(input);
                        // Apply OOS validation
                        applyOOSValidation(input, 'cofCC');
                        // Add real-time OOS validation
                        input.addEventListener('input', function() {
                            applyOOSValidation(this, 'cofCC');
                        });
                    } else if (j === 8) {
                        // Tensile Break column - 4 digit format (0000)
                        applyFourDigitValidation(input);
                        // Apply OOS validation
                        applyOOSValidation(input, 'tensileBreak');
                        // Add real-time OOS validation
                        input.addEventListener('input', function() {
                            applyOOSValidation(this, 'tensileBreak');
                        });
                    } else if (j === 9) {
                        // Elongation column - 3 digit format (000)
                        applyThreeDigitValidation(input);
                        // Apply OOS validation
                        applyOOSValidation(input, 'elongation');
                        // Add real-time OOS validation
                        input.addEventListener('input', function() {
                            applyOOSValidation(this, 'elongation');
                        });
                    } else if (j === 10) {
                        // 10% Modulus column - 3 digit format (000)
                        applyThreeDigitValidation(input);
                        // Apply OOS validation
                        applyOOSValidation(input, 'modulus10');
                        // Add real-time OOS validation
                        input.addEventListener('input', function() {
                            applyOOSValidation(this, 'modulus10');
                        });
                    }
                } else if (isPage2) {
                    // Page 2 validation
                    if (j === 3) {
                        // Tensile Break column - 0000 format (4 digits, no decimal)
                        applyFourDigitValidation(input);
                    } else if (j === 4) {
                        // CD Elongation Break column - 000 format (3 digits, no decimal)
                        applyThreeDigitValidation(input);
                    } else if (j === 5) {
                        // 10% Modulus column - 000 format (3 digits, no decimal)
                        applyThreeDigitValidation(input);
                    } else if (j === 6) {
                        // Opacity column - 00.0 format (1 decimal place)
                        applyFlexibleTwoDecimalValidation(input, { maxBeforeDecimal: 2, maxAfterDecimal: 1 });
                    } else if (j === 7) {
                        // Roll Cut Width column - 000 format (3 digits, no decimal)
                        applyThreeDigitValidation(input);
                    } else if (j === 8) {
                        // Diameter column - 000 format (3 digits, no decimal)
                        applyThreeDigitValidation(input);
                    }
                } else if (isPage3) {
                    // Page 3 validation
                    if (j === 3) {
                        // Colour L column - flexible decimal format
                        applyFlexibleTwoDecimalValidation(input);
                    } else if (j === 4) {
                        // Colour A column - flexible decimal format (negative values)
                        applyFlexibleTwoDecimalValidation(input);
                    } else if (j === 5) {
                        // Colour B column - flexible decimal format (negative values)
                        applyFlexibleTwoDecimalWithNegativeValidation(input);
                    } else if (j === 6) {
                        // Delta E column - 1 digit before decimal (range 0.00-4.00)
                        applyFlexibleTwoDecimalValidation(input, { maxBeforeDecimal: 1, maxAfterDecimal: 2 });
                    } else if (j === 7) {
                        // Base Film Pink column - 1 digit before decimal (range 0.00-4.00)
                        applyFlexibleTwoDecimalValidation(input, { maxBeforeDecimal: 1, maxAfterDecimal: 2 });
                    }
                }
            }
            
            // Add event listeners
            input.addEventListener('input', function() {
                // Block input in view mode
                if (isViewMode()) {
                    return;
                }
                
                            // Auto-save to database after each change (debounced)
                            debouncedSave();
                            
                // Calculate row averages for pages with Ave columns (not Page 1 or Page 2)
                            if (tableBody.id !== 'testingTableBody' && tableBody.id !== 'testingTableBody2') {
                                calculateRowAverages(tr, tableBody);
                            }
                
                // Page 2 has NO Ave columns - all columns are individual data collectors
                // No summary statistics calculation needed for Page 2
                
                            // Calculate individual column stats for Page 1 (only the changed column)
                            if (tableBody.id === 'testingTableBody') {
                                const inputIndex = Array.from(tr.querySelectorAll('input')).indexOf(input);
                                calculatePage1ColumnStats(tableBody, inputIndex);
                            }
                        });
                        
                        // Add blur event listener for real-time calculation
                        input.addEventListener('blur', function() {
                            // Block input in view mode
                            if (isViewMode()) {
                                return;
                            }
                            
                            // Calculate individual column stats for Page 1 (only the changed column)
                            if (tableBody.id === 'testingTableBody') {
                                const inputIndex = Array.from(tr.querySelectorAll('input')).indexOf(input);
                                calculatePage1ColumnStats(tableBody, inputIndex);
                            }
                        });
                    
                    td.appendChild(input);
                    tr.appendChild(td);
                }
                
        // Add highlighting functionality to the new row
        addHighlightingToRow(tr);
                
                // Add to fragment instead of directly to table for better performance
                fragment.appendChild(tr);
            }

           // Add all new rows to table at once (much faster)
           tableBody.appendChild(fragment);

           // Update tab order for all existing rows to ensure proper navigation
           updateTabOrderForAllRows(tableBody);

           // Re-add summary rows
           summaryRows.forEach(row => {
               tableBody.appendChild(row);
           });
           

    
    // Reload data from database if we have existing form data
    if (currentFormId) {

        reloadDataForTable(tableBody);
    }

    // Re-apply view mode styling to newly added rows
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
            .from('uc-18gsm-250w-bfqr')
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
        

        
        // Reload sample data for Page 1
        if (tableBody.id === 'testingTableBody') {
            if (data.lot_and_roll) {
                loadColumnDataToTable(tableBody, 0, data.lot_and_roll);
            }
            if (data.roll_id) {
                loadColumnDataToTable(tableBody, 1, data.roll_id);
            }
            if (data.lot_time) {
                loadColumnDataToTable(tableBody, 2, data.lot_time);
            }
            if (data.page1_basis_weight) {
                loadColumnDataToTable(tableBody, 3, data.page1_basis_weight);
            }
            if (data.page1_thickness) {
                loadColumnDataToTable(tableBody, 4, data.page1_thickness);
            }
            if (data.page1_wettability) {
                loadColumnDataToTable(tableBody, 5, data.page1_wettability);
            }
            if (data.page1_cof_rr) {
                loadColumnDataToTable(tableBody, 6, data.page1_cof_rr);
            }
            if (data.page1_cof_cc) {
                loadColumnDataToTable(tableBody, 7, data.page1_cof_cc);
            }
            if (data.page1_tensile_break) {
                loadColumnDataToTable(tableBody, 8, data.page1_tensile_break);
            }
            if (data.page1_elongation) {
                loadColumnDataToTable(tableBody, 9, data.page1_elongation);
            }
            if (data.page1_modulus) {
                loadColumnDataToTable(tableBody, 10, data.page1_modulus);
            }
            
            // Calculate summary statistics after all data is loaded
            calculatePage1ColumnStats(tableBody);
        }
        
        // Reload sample data for Page 2
        if (tableBody.id === 'testingTableBody2') {
            if (data.lot_and_roll) {
                loadColumnDataToTable(tableBody, 0, data.lot_and_roll);
            }
            if (data.roll_id) {
                loadColumnDataToTable(tableBody, 1, data.roll_id);
            }
            if (data.lot_time) {
                loadColumnDataToTable(tableBody, 2, data.lot_time);
            }
            if (data.page2_tensile_break) {
                loadColumnDataToTable(tableBody, 3, data.page2_tensile_break);
            }
            if (data.page2_cd_elongation) {
                loadColumnDataToTable(tableBody, 4, data.page2_cd_elongation);
            }
            if (data.page2_modulus) {
                loadColumnDataToTable(tableBody, 5, data.page2_modulus);
            }
            if (data.page2_opacity) {
                loadColumnDataToTable(tableBody, 6, data.page2_opacity);
            }
            if (data.page2_roll_width) {
                loadColumnDataToTable(tableBody, 7, data.page2_roll_width);
            }
            if (data.page2_diameter) {
                loadColumnDataToTable(tableBody, 8, data.page2_diameter);
            }
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
    if (tableBody.id === 'testingTableBody2' || tableBody.id === 'testingTableBody3' || tableBody.id === 'testingTableBody4') {
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
        // Check if we have a current form session
        if (currentFormId) {

            
            // Load form data directly - no timeout needed
            const { data, error } = await supabase
                .from('uc-18gsm-250w-bfqr')
                .select('*')
                .eq('form_id', currentFormId)
                .single();
            
            if (error) {

                return;
            }
            
            if (data) {

                
                // Set session variables from loaded data
                currentFormId = data.form_id;
                currentLotNo = data.lot_no;
                
                // Load form header data
                loadFormHeaderData(data);
                
        // Load table data
        loadTableDataFromDatabase(data);
        
        // Load row count and add rows if needed
        loadRowCountFromDatabase(data);
        
        // Load equipment selections AFTER dropdowns are populated
        setTimeout(() => {
            loadEquipmentSelections(data);
            // Apply equipment highlighting after loading
            updateEquipmentHighlighting();
            // Apply OOS validation to all existing inputs (at the same time as equipment loading)
            applyOOSValidationToAllInputs();
        }, 500);
        
        // Load pre-store data
        loadPreStoreData(data);
            }
                    } else {

        }
    } catch (error) {
        console.error('💾 [DATABASE] Error loading data from database:', error);
    }
}

// Load form header data
function loadFormHeaderData(data) {


    
    // Load header form data
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
    
    
    if (productCodeInput && data.product_code) {
        productCodeInput.value = data.product_code;

    }
    
    // Also populate view elements for view mode
    const viewProductCode = document.getElementById('view-product-code');
    if (viewProductCode && data.product_code) {
        viewProductCode.textContent = data.product_code;
    }

    // Update form title when data is loaded
    setFormTitle();
    
    if (productionOrderInput && data.production_order) {
        productionOrderInput.value = data.production_order;

    }
    
    // View element for production order
    const viewProductionOrder = document.getElementById('view-production-order');
    if (viewProductionOrder && data.production_order) {
        viewProductionOrder.textContent = data.production_order;

    }
    
    if (machineInput && data.machine_no) {
        machineInput.value = data.machine_no;

    }
    
    // View element for machine
    const viewMachineNo = document.getElementById('view-machine-no');
    if (viewMachineNo && data.machine_no) {
        viewMachineNo.textContent = data.machine_no;

    }
    
    if (productionDateInput && data.production_date) {
        productionDateInput.value = data.production_date;

    }
    
    // View element for production date
    const viewProductionDate = document.getElementById('view-production-date');
    if (viewProductionDate && data.production_date) {
        viewProductionDate.textContent = data.production_date;

    }
    
    if (inspectionDateInput && data.inspection_date) {
        // Handle date format conversion if needed
        let dateValue = data.inspection_date;
        if (typeof dateValue === 'string' && dateValue.includes('/')) {
            // Convert DD/MM/YYYY to YYYY-MM-DD
            const parts = dateValue.split('/');
            if (parts.length === 3) {
                dateValue = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }
        inspectionDateInput.value = dateValue;

                   } else {
        console.log('📋 [HEADER] Inspection date input not found or no data:', {
            inputFound: !!inspectionDateInput,
            hasData: !!data.inspection_date,
            dataValue: data.inspection_date,
            allDateInputs: document.querySelectorAll('input[type="date"]').length
        });
    }
    
    // View element for inspection date
    const viewInspectionDate = document.getElementById('view-inspection-date');
    if (viewInspectionDate && data.inspection_date) {
        viewInspectionDate.textContent = data.inspection_date;

    }
    
    if (specificationInput && data.specification) {
        specificationInput.value = data.specification;

    }
    
    // View element for specification
    const viewSpecification = document.getElementById('view-specification');
    if (viewSpecification && data.specification) {
        viewSpecification.textContent = data.specification;

    }
    
    if (poInput && data.purchase_order) {
        poInput.value = data.purchase_order;

    }
    
    if (quantityInput && data.quantity) {
        quantityInput.value = data.quantity;

    }
    
    // View element for quantity
    const viewQuantity = document.getElementById('view-quantity');
    if (viewQuantity && data.quantity) {
        viewQuantity.textContent = data.quantity;

    }
    

}

// Load table data from database
function loadTableDataFromDatabase(data) {

    // Get table body references
    const testingTableBody = document.getElementById('testingTableBody');
    const testingTableBody2 = document.getElementById('testingTableBody2');
    const testingTableBody3 = document.getElementById('testingTableBody3');

    // Get input elements
    const productCodeInput = document.querySelector('input[placeholder="Enter Product Code"]');
    const productionOrderInput = document.querySelector('input[placeholder="Enter Prod. Order"]');
    const machineInput = document.querySelector('input[placeholder="Enter Machine"]');
    const productionDateInput = document.querySelector('input[type="date"]:nth-of-type(1)');
    const inspectionDateInput = Array.from(document.querySelectorAll('input[type="date"]')).find(input => {
        const td = input.closest('td');
        const prevTd = td?.previousElementSibling;
        return prevTd && prevTd.textContent.includes('Inspection Date');
    });
    const specificationInput = document.querySelector('input[placeholder="Enter Specification"]');
    const poInput = document.querySelector('input[placeholder="Enter PO"]');
    const quantityInput = document.querySelector('input[placeholder="Enter Quantity"]');
    
    // Load header data into input fields (like 16 GSM Kranti)
    if (data.product_code && productCodeInput) productCodeInput.value = data.product_code;
    if (data.production_order && productionOrderInput) productionOrderInput.value = data.production_order;
    if (data.machine_no && machineInput) machineInput.value = data.machine_no;
    if (data.production_date && productionDateInput) {
        // Convert ISO date to yyyy-MM-dd format for HTML date input
        const date = new Date(data.production_date);
        const formattedDate = date.toISOString().split('T')[0]; // yyyy-MM-dd format
        productionDateInput.value = formattedDate;
    }
    if (data.specification && specificationInput) specificationInput.value = data.specification;
    if (data.purchase_order && poInput) poInput.value = data.purchase_order;
    if (data.quantity && quantityInput) quantityInput.value = data.quantity;
    if (data.inspection_date && inspectionDateInput) {
        // Convert ISO date to yyyy-MM-dd format for HTML date input
        const date = new Date(data.inspection_date);
        const formattedDate = date.toISOString().split('T')[0]; // yyyy-MM-dd format
        inspectionDateInput.value = formattedDate;
    }
    
    // Load header data into view elements (like 16 GSM Kranti)
    if (data.production_order) {
        const element = document.getElementById('view-production-order');
        if (element) element.textContent = data.production_order;
    }
    
    if (data.product_code) {
        const element = document.getElementById('view-product-code');
        if (element) element.textContent = data.product_code;
    }
    
    if (data.specification) {
        const element = document.getElementById('view-specification');
        if (element) element.textContent = data.specification;
    }
    
    if (data.pallet_size) {
        const element = document.getElementById('view-pallet-size');
        if (element) element.textContent = data.pallet_size;
    }
    
    if (data.customer) {
        const element = document.getElementById('view-customer');
        if (element) element.textContent = data.customer;
    }
    
    if (data.location) {
        const element = document.getElementById('view-location');
        if (element) element.textContent = data.location;
    }
    
    if (data.machine_no) {
        const element = document.getElementById('view-machine-no');
        if (element) element.textContent = data.machine_no;
    }
    
    if (data.quantity) {
        const element = document.getElementById('view-quantity');
        if (element) element.textContent = data.quantity;
    }
    
    if (data.production_date) {
        const element = document.getElementById('view-production-date');
        if (element) element.textContent = new Date(data.production_date).toLocaleDateString('en-GB');
    }
    
    if (data.inspection_date) {
        const element = document.getElementById('view-inspection-date');
        if (element) element.textContent = new Date(data.inspection_date).toLocaleDateString('en-GB');
    }
    
    if (data.standard_packing) {
        const element = document.getElementById('view-standard-packing');
        if (element) element.textContent = data.standard_packing;
    }
    
    if (data.batch) {
        const element = document.getElementById('view-batch');
        if (element) element.textContent = data.batch;
    }
    
    if (data.prestore_ref_no) {
        const element = document.getElementById('view-ref-no');
        if (element) element.textContent = data.prestore_ref_no;
    }
    
    if (data.prestore_done_by) {
        const element = document.getElementById('view-prestore-done-by');
        if (element) element.textContent = data.prestore_done_by;
    }
    
    // Load sample data (Lot & Roll, Roll ID, Lot Time)
    if (data.lot_and_roll) {
        loadColumnDataToTable(testingTableBody, 0, data.lot_and_roll);

    }

    if (data.roll_id) {
        loadColumnDataToTable(testingTableBody, 1, data.roll_id);

    }

    if (data.lot_time) {
        loadColumnDataToTable(testingTableBody, 2, data.lot_time);

    }

    // Load Page 1 data
    if (data.page1_basis_weight) {
        loadColumnDataToTable(testingTableBody, 3, data.page1_basis_weight);
    }

    if (data.page1_thickness) {
        loadColumnDataToTable(testingTableBody, 4, data.page1_thickness);
    }

    if (data.page1_wettability) {
        loadColumnDataToTable(testingTableBody, 5, data.page1_wettability);
    }

    if (data.page1_cof_rr) {
        loadColumnDataToTable(testingTableBody, 6, data.page1_cof_rr);
    }

    if (data.page1_cof_cc) {
        loadColumnDataToTable(testingTableBody, 7, data.page1_cof_cc);
    }
    
    if (data.page1_tensile_break) {
        loadColumnDataToTable(testingTableBody, 8, data.page1_tensile_break);
    }

    if (data.page1_elongation) {
        loadColumnDataToTable(testingTableBody, 9, data.page1_elongation);
    }

    if (data.page1_modulus) {
        loadColumnDataToTable(testingTableBody, 10, data.page1_modulus);
    }
    
    // Load Page 2 data
    if (data.page2_tensile_break) {
        loadColumnDataToTable(testingTableBody2, 3, data.page2_tensile_break);
    }
    
    if (data.page2_cd_elongation) {
        loadColumnDataToTable(testingTableBody2, 4, data.page2_cd_elongation);
    }
    
    if (data.page2_modulus) {
        loadColumnDataToTable(testingTableBody2, 5, data.page2_modulus);
    }
    
    if (data.page2_opacity) {
        loadColumnDataToTable(testingTableBody2, 6, data.page2_opacity);
    }
    
    if (data.page2_roll_width) {
        loadColumnDataToTable(testingTableBody2, 7, data.page2_roll_width);
    }

    if (data.page2_diameter) {
        loadColumnDataToTable(testingTableBody2, 8, data.page2_diameter);
    }

    // Load Page 3 data with delay to ensure DOM is ready
    setTimeout(() => {
        // Load Page 3 sample data from Page 1
        if (data.lot_and_roll) {
            loadColumnDataToTable(testingTableBody3, 0, data.lot_and_roll);
        }

        if (data.roll_id) {
            loadColumnDataToTable(testingTableBody3, 1, data.roll_id);
        }

        if (data.lot_time) {
            loadColumnDataToTable(testingTableBody3, 2, data.lot_time);
        }

        // Load Page 3 color measurement data
        if (data.page3_colour_l) {
            loadColumnDataToTable(testingTableBody3, 3, data.page3_colour_l);
        }

        if (data.page3_colour_a) {
            loadColumnDataToTable(testingTableBody3, 4, data.page3_colour_a);
        }

        if (data.page3_colour_b) {
            loadColumnDataToTable(testingTableBody3, 5, data.page3_colour_b);
        }

        if (data.page3_delta_e) {
            loadColumnDataToTable(testingTableBody3, 6, data.page3_delta_e);
        }

        if (data.page3_base_film_pink) {
            loadColumnDataToTable(testingTableBody3, 7, data.page3_base_film_pink);
        }
    }, 100);


}

// Load row count from database and add rows if needed
function loadRowCountFromDatabase(data) {

    // Get table references
    const testingTableBody = document.getElementById('testingTableBody');
    const testingTableBody2 = document.getElementById('testingTableBody2');
    const testingTableBody3 = document.getElementById('testingTableBody3');

    // Calculate how many rows we need based on the data
    let page1RowsNeeded = 0;
    let page2RowsNeeded = 0;
    let page3RowsNeeded = 0;
    
    // Check Page 1 data to determine row count - CORRECTED field names
    if (data.page1_basis_weight) {
        const basisWeightData = data.page1_basis_weight;
        const maxRow = Math.max(...Object.keys(basisWeightData).map(key => parseInt(key)).filter(num => !isNaN(num)));
        page1RowsNeeded = Math.max(page1RowsNeeded, maxRow);
    }

    if (data.page1_thickness) {
        const thicknessData = data.page1_thickness;
        const maxRow = Math.max(...Object.keys(thicknessData).map(key => parseInt(key)).filter(num => !isNaN(num)));
        page1RowsNeeded = Math.max(page1RowsNeeded, maxRow);
    }
    
    if (data.page1_cof_rr) {
        const cofData = data.page1_cof_rr;
        const maxRow = Math.max(...Object.keys(cofData).map(key => parseInt(key)).filter(num => !isNaN(num)));
        page1RowsNeeded = Math.max(page1RowsNeeded, maxRow);
    }
    
    // Check Page 2 data to determine row count
    if (data.page2_tensile_break) {
        const tensileData = data.page2_tensile_break;
        const maxRow = Math.max(...Object.keys(tensileData).map(key => parseInt(key)).filter(num => !isNaN(num)));
        page2RowsNeeded = Math.max(page2RowsNeeded, maxRow);
    }

    if (data.page2_cd_elongation) {
        const cdElongationData = data.page2_cd_elongation;
        const maxRow = Math.max(...Object.keys(cdElongationData).map(key => parseInt(key)).filter(num => !isNaN(num)));
        page2RowsNeeded = Math.max(page2RowsNeeded, maxRow);
    }

    if (data.page2_modulus) {
        const modulusData = data.page2_modulus;
        const maxRow = Math.max(...Object.keys(modulusData).map(key => parseInt(key)).filter(num => !isNaN(num)));
        page2RowsNeeded = Math.max(page2RowsNeeded, maxRow);
    }

    if (data.page2_opacity) {
        const opacityData = data.page2_opacity;
        const maxRow = Math.max(...Object.keys(opacityData).map(key => parseInt(key)).filter(num => !isNaN(num)));
        page2RowsNeeded = Math.max(page2RowsNeeded, maxRow);
    }

    if (data.page2_roll_width) {
        const rollWidthData = data.page2_roll_width;
        const maxRow = Math.max(...Object.keys(rollWidthData).map(key => parseInt(key)).filter(num => !isNaN(num)));
        page2RowsNeeded = Math.max(page2RowsNeeded, maxRow);
    }

    if (data.page2_diameter) {
        const diameterData = data.page2_diameter;
        const maxRow = Math.max(...Object.keys(diameterData).map(key => parseInt(key)).filter(num => !isNaN(num)));
        page2RowsNeeded = Math.max(page2RowsNeeded, maxRow);
    }

    // Check Page 3 data to determine row count
    if (data.page3_colour_l) {
        const colourLData = data.page3_colour_l;
        const maxRow = Math.max(...Object.keys(colourLData).map(key => parseInt(key)).filter(num => !isNaN(num)));
        page3RowsNeeded = Math.max(page3RowsNeeded, maxRow);
    }

    if (data.page3_colour_a) {
        const colourAData = data.page3_colour_a;
        const maxRow = Math.max(...Object.keys(colourAData).map(key => parseInt(key)).filter(num => !isNaN(num)));
        page3RowsNeeded = Math.max(page3RowsNeeded, maxRow);
    }

    if (data.page3_colour_b) {
        const colourBData = data.page3_colour_b;
        const maxRow = Math.max(...Object.keys(colourBData).map(key => parseInt(key)).filter(num => !isNaN(num)));
        page3RowsNeeded = Math.max(page3RowsNeeded, maxRow);
    }

    if (data.page3_delta_e) {
        const deltaEData = data.page3_delta_e;
        const maxRow = Math.max(...Object.keys(deltaEData).map(key => parseInt(key)).filter(num => !isNaN(num)));
        page3RowsNeeded = Math.max(page3RowsNeeded, maxRow);
    }

    if (data.page3_base_film_pink) {
        const baseFilmData = data.page3_base_film_pink;
        const maxRow = Math.max(...Object.keys(baseFilmData).map(key => parseInt(key)).filter(num => !isNaN(num)));
        page3RowsNeeded = Math.max(page3RowsNeeded, maxRow);
    }
    

    
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

    // Add rows to Page 3 if needed
    if (page3RowsNeeded > 0) {
        const currentPage3Rows = getCurrentDataRowCount(testingTableBody3);
        const rowsToAddPage3 = Math.max(0, page3RowsNeeded - currentPage3Rows);

        if (rowsToAddPage3 > 0) {
            addRowsToTable(testingTableBody3, rowsToAddPage3);
        }
    }
    
    // Update row count displays
    updateAllRowCounts();
    

}

// Function to sync sample data changes from Page 1 to Page 2 and Page 3 in real-time (like 16 GSM Kranti)
function syncSampleDataToOtherPages(rowIndex, columnIndex, newValue) {
    // Get Page 2 and Page 3 table bodies for syncing
    const otherTableBodies = [testingTableBody2, testingTableBody3];

    otherTableBodies.forEach(tableBody => {
        // Get current data rows (excluding summary rows)
        let dataRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
            const firstCell = row.querySelector('td');
            return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
        });

        // If the required row doesn't exist yet, add additional rows so that indices match
        if (rowIndex >= dataRows.length) {
            const rowsToAdd = rowIndex + 1 - dataRows.length; // +1 because rowIndex is 0-based
            if (rowsToAdd > 0) {
                addRowsToTable(tableBody, rowsToAdd);
            }
            // Refresh the reference after adding rows
            dataRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
                const firstCell = row.querySelector('td');
                return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
            });
        }

        // Update the corresponding row and column, now guaranteed to exist
        if (dataRows[rowIndex]) {
            const inputs = dataRows[rowIndex].querySelectorAll('input');

            if (tableBody.id === 'testingTableBody2') {
                // Page 2 has the same sample column structure as Page 1 (0-Lot&Roll, 1-RollID, 2-LotTime)
                let targetColumnIndex = columnIndex;

                if (columnIndex <= 2) {
                    targetColumnIndex = columnIndex; // Direct mapping: 0→0, 1→1, 2→2
                }

                if (inputs[targetColumnIndex]) {
                    inputs[targetColumnIndex].value = newValue;
                }
            } else if (tableBody.id === 'testingTableBody3') {
                // Page 3: Sample columns should map directly from Page 1
                if (columnIndex <= 2) {
                    // Direct mapping: Page 1 column 0→Page 3 column 0, 1→1, 2→2
                    if (inputs[columnIndex]) {
                        inputs[columnIndex].value = newValue;
                    }
                }
            }
        }
    });
}

// Load column data from JSONB into table inputs
function loadColumnDataToTable(tableBody, inputIndex, jsonbData) {

    if (!jsonbData || typeof jsonbData !== 'object') {
        return;
    }

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

                // Apply OOS validation to the loaded value if it's a data column
                if (inputIndex > 2) {
                    let columnType = '';

                    // Determine column type based on table and input index
                    if (tableBody.id === 'testingTableBody') {
                        // Page 1 columns
                        if (inputIndex === 3) columnType = 'filmWeight';
                        else if (inputIndex === 4) columnType = 'thickness';
                        else if (inputIndex === 5) columnType = 'wettability';
                        else if (inputIndex === 6) columnType = 'cofRR';
                        else if (inputIndex === 7) columnType = 'cofCC';
                        else if (inputIndex === 8) columnType = 'tensileBreak';
                        else if (inputIndex === 9) columnType = 'elongation';
                        else if (inputIndex === 10) columnType = 'modulus10';
                    } else if (tableBody.id === 'testingTableBody2') {
                        // Page 2 columns
                        if (inputIndex === 3) columnType = 'tensileBreak';
                        else if (inputIndex === 4) columnType = 'cdElongation';
                        else if (inputIndex === 5) columnType = 'modulus10';
                        else if (inputIndex === 6) columnType = 'opacity';
                        else if (inputIndex === 7) columnType = 'rollWidth';
                        else if (inputIndex === 8) columnType = 'diameter';
                    } else if (tableBody.id === 'testingTableBody3') {
                        // Page 3 columns
                        if (inputIndex === 3) columnType = 'colourL';
                        else if (inputIndex === 4) columnType = 'colourA';
                        else if (inputIndex === 5) columnType = 'colourB';
                        else if (inputIndex === 6) columnType = 'deltaE';
                        else if (inputIndex === 7) columnType = 'baseFilmPink';
                    }

                    // Apply OOS validation if we have a valid column type
                    if (columnType) {
                        applyOOSValidation(input, columnType);
                    }
                }

                // Calculate summary statistics for Page 1 when data is loaded
                if (tableBody.id === 'testingTableBody') {
                    calculatePage1ColumnStats(tableBody, inputIndex);
                }

                // Calculate summary statistics for Page 2 when data is loaded
                if (tableBody.id === 'testingTableBody2') {
                    calculatePage2ColumnStats(tableBody, inputIndex);
                }

                // Calculate summary statistics for Page 3 when data is loaded
                if (tableBody.id === 'testingTableBody3') {
                    calculatePage2ColumnStats(tableBody, inputIndex);
                }
            }
        }
    });
}

// Load equipment selections from database
function loadEquipmentSelections(data) {

    
    
    if (data.equipment_used && typeof data.equipment_used === 'object') {
        const equipment = data.equipment_used;
        
        // Load Page 1 equipment
        if (equipment.page1) {
            if (equipment.page1.film_weight) {
                const dropdown = document.getElementById('film-weight-equipment');
                if (dropdown) {
                    dropdown.value = equipment.page1.film_weight;
                }
            }

            if (equipment.page1.thickness) {
                const dropdown = document.getElementById('thickness-equipment');
                if (dropdown) {
                    dropdown.value = equipment.page1.thickness;
                }
            }


            if (equipment.page1.cof_rr) {
                const dropdown = document.getElementById('cof-rr-equipment');
                if (dropdown) {
                    dropdown.value = equipment.page1.cof_rr;
                }
            }

            if (equipment.page1.cof_cc) {
                const dropdown = document.getElementById('cof-cc-equipment');
                if (dropdown) {
                    dropdown.value = equipment.page1.cof_cc;
                }
            }

            if (equipment.page1.tensile_break) {
                const dropdown = document.getElementById('tensile-break-equipment');
                if (dropdown) {
                    dropdown.value = equipment.page1.tensile_break;
                }
            }

            if (equipment.page1.elongation) {
                const dropdown = document.getElementById('elongation-equipment');
                if (dropdown) {
                    dropdown.value = equipment.page1.elongation;
                }
            }

            if (equipment.page1.modulus_10) {
                const dropdown = document.getElementById('modulus-equipment');
                if (dropdown) {
                    dropdown.value = equipment.page1.modulus_10;
                }
            }
        }
        
        // Load Page 2 equipment
        if (equipment.page2) {
            if (equipment.page2.tensile_break) {
                const dropdown = document.getElementById('page2-tensile-break-equipment');
                if (dropdown) {
                    dropdown.value = equipment.page2.tensile_break;
                }
            }

            if (equipment.page2.elongation) {
                const dropdown = document.getElementById('page2-elongation-equipment');
                if (dropdown) {
                    dropdown.value = equipment.page2.elongation;
                }
            }

            if (equipment.page2.modulus_10) {
                const dropdown = document.getElementById('page2-modulus-equipment');
                if (dropdown) {
                    dropdown.value = equipment.page2.modulus_10;
                }
            }

            if (equipment.page2.opacity) {
                const dropdown = document.getElementById('page2-opacity-equipment');
                if (dropdown) {
                    dropdown.value = equipment.page2.opacity;
                }
            }

            if (equipment.page2.roll_width) {
                const dropdown = document.getElementById('page2-roll-width-equipment');
                if (dropdown) {
                    dropdown.value = equipment.page2.roll_width;
                }
            }

            if (equipment.page2.diameter) {
                const dropdown = document.getElementById('page2-diameter-equipment');
                if (dropdown) {
                    dropdown.value = equipment.page2.diameter;
                }
            }
        }

        // Load Page 3 equipment
        if (equipment.page3) {
            if (equipment.page3.colour) {
                const colourDropdown = document.getElementById('page3-colour-equipment');
                if (colourDropdown) {
                    colourDropdown.value = equipment.page3.colour;
                }
            }
            if (equipment.page3.baseFilm) {
                const baseFilmDropdown = document.getElementById('page3-base-film-equipment');
                if (baseFilmDropdown) {
                    baseFilmDropdown.value = equipment.page3.baseFilm;
                }
            }
        }
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
        { dbField: 'prestore_ref_no', viewId: 'view-ref-no' },
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
            .from('uc-18gsm-250w-bfqr')
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
                .from('uc-18gsm-250w-bfqr')
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
async function loadHistoricalDataIntoForm(historicalData) {
    console.log('🔍 [HISTORICAL] loadHistoricalDataIntoForm CALLED with data:', {
        hasHistoricalData: !!historicalData,
        historicalDataKeys: historicalData ? Object.keys(historicalData) : []
    });

    try {
        console.log('🔍 [HISTORICAL] Loading historical data into form...');

        // Get requested rows for fresh data (from user input)
        const numRowsInput = document.getElementById('numRowsInput');
        const requestedRows = parseInt(numRowsInput?.value, 10) || 12;
        const availableForHistorical = 30 - requestedRows;

        console.log(`Loading historical data: ${availableForHistorical} rows for historical, ${requestedRows} rows for fresh data`);

        // Load historical data into top rows (1 to availableForHistorical)
        loadHistoricalDataIntoTopRows(historicalData, availableForHistorical);

        // Clear bottom rows for fresh data entry
        clearBottomRowsForFreshData(requestedRows);

        // Calculate statistics immediately after loading historical data
        console.log('Calculating statistics for historical data...');
        calculatePage1ColumnStats(testingTableBody);
        calculatePage2ColumnStats(testingTableBody2);
        calculatePage2ColumnStats(testingTableBody3);
        recalculateAllRowAverages();
        forceRecalculateAllSummaryStatistics();

        // Apply OOS/red-text validation immediately after data population
        applyOOSValidationToAllInputs();
        applyValidationToExistingInputs();

        // Auto-save the form with historical data loaded
        console.log('Auto-saving form with historical data...');
        await autoSaveToDatabase();
        

        
    } catch (error) {
        console.error('📚 [HISTORICAL] Error loading historical data into form:', error);
    }
}

// Function to add event listeners to existing input fields for real-time calculation
function addAverageCalculationListeners() {
    // Add listeners to all existing input fields in Page 1 table
    const testingTableBody = document.getElementById('testingTableBody');
    
    if (testingTableBody) {
        const rows = testingTableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const inputs = row.querySelectorAll('input');
            inputs.forEach(input => {
                input.addEventListener('input', function() {
                    // Auto-save to database after each change (debounced)
                    debouncedSave();
                    
                    // Calculate individual column stats for Page 1 (only the changed column)
                    const inputIndex = Array.from(row.querySelectorAll('input')).indexOf(input);
                    calculatePage1ColumnStats(testingTableBody, inputIndex);
                });
                
                input.addEventListener('blur', function() {
                    // Calculate individual column stats for Page 1 (only the changed column)
                    const inputIndex = Array.from(row.querySelectorAll('input')).indexOf(input);
                    calculatePage1ColumnStats(testingTableBody, inputIndex);
                });
                
                input.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        // Calculate individual column stats for Page 1 (only the changed column)
                        const inputIndex = Array.from(row.querySelectorAll('input')).indexOf(input);
                        calculatePage1ColumnStats(testingTableBody, inputIndex);
                    }
                });
            });
        });
    }
}

// Missing validation functions (placeholders)

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

// Update row count for Page 1
function updateRowCount() {
    const rowCountDisplay = document.getElementById('rowCountDisplay');
    if (rowCountDisplay) {
        const dataRows = getCurrentDataRowCount(testingTableBody);
        rowCountDisplay.textContent = `Rows: ${dataRows}`;

    }
}

// Update row count for a specific page
function updateRowCountByPage(pageNumber) {
    const tableBody = getTableBodyByPage(pageNumber);
    const rowCountDisplay = document.getElementById(`rowCountDisplay${pageNumber > 1 ? pageNumber : ''}`);
    if (tableBody && rowCountDisplay) {
        const dataRows = getCurrentDataRowCount(tableBody);
        rowCountDisplay.textContent = `Rows: ${dataRows}`;

    }
}

// Update row count for all pages
function updateAllRowCounts() {
    for (let i = 1; i <= 3; i++) {
        updateRowCountByPage(i);
    }
}

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
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🎯 [DEBUG] DOMContentLoaded event fired!');

    
    // Initialize global table body references FIRST
    testingTableBody = document.getElementById('testingTableBody');
    testingTableBody2 = document.getElementById('testingTableBody2');
    testingTableBody3 = document.getElementById('testingTableBody3');
    
    
    // Initialize session variables
    initializeSession();

    // Setup view mode
    setupViewMode();

    // Set form title
    setFormTitle();

    // Setup historical data loading triggers
    console.log('🔍 [HISTORICAL] Setting up historical data triggers in DOMContentLoaded...');
    console.log('🔍 [HISTORICAL] About to call setupHistoricalDataTrigger()...');
    setupHistoricalDataTrigger();
    console.log('🔍 [HISTORICAL] setupHistoricalDataTrigger() called successfully!');
    
    // Debug: Check if modern-header-table class is applied
    const headerTable = document.querySelector('.modern-header-table');
    if (headerTable) {
        
        // Handle header table inputs like 16 GSM Kranti
        const productCodeInput = document.querySelector('input[placeholder="Enter Product Code"]');
        const productionOrderInput = document.querySelector('input[placeholder="Enter Prod. Order"]');
        const machineInput = document.querySelector('input[placeholder="Enter Machine"]');
        const productionDateInput = document.querySelector('input[type="date"]:nth-of-type(1)');
        const specificationInput = document.querySelector('input[placeholder="Enter Specification"]');
        const poInput = document.querySelector('input[placeholder="Enter PO"]');
        const quantityInput = document.querySelector('input[placeholder="Enter Quantity"]');
        
        // Try multiple selectors for inspection date
        let inspectionDateInput = document.querySelector('input[type="date"]:nth-of-type(2)');
        if (!inspectionDateInput) {
            inspectionDateInput = document.querySelector('input[placeholder*="Inspection"]');
        }
        if (!inspectionDateInput) {
            inspectionDateInput = document.querySelector('input[placeholder*="inspection"]');
        }
        if (!inspectionDateInput) {
            const allDateInputs = document.querySelectorAll('input[type="date"]');
            inspectionDateInput = allDateInputs[1] || null;
        }
        
        // Make header form fields read-only (like 16 GSM Kranti)
        const headerFields = [
            productCodeInput,
            productionOrderInput,
            machineInput,
            productionDateInput,
            specificationInput,
            poInput,
            quantityInput,
            inspectionDateInput
        ];
        

        
        headerFields.forEach(field => {
            if (field) {

                field.readOnly = true;
                field.style.cursor = 'default'; // Normal cursor instead of not-allowed
                field.style.fontSize = '16px'; // Header fields use 16px (like 16 GSM Kranti)
                field.style.fontWeight = '500'; // Slightly bolder text
                field.style.color = '#000000'; // Force black text color
                field.style.opacity = '1'; // Force full opacity
                field.title = 'This field is read-only';
            }
        });
        

    } else {
        console.warn('🎨 [DEBUG] Header table with modern-header-table class not found');
    }
    
    // Load QC equipment dropdowns
    loadQCEquipmentDropdowns();

    // Note: Historical data trigger is already set up in DOMContentLoaded
    
    // Initialize verification functionality
    initializeVerification();
    
    // Initialize approval functionality
    initializeApproval();
    
    // Add cell highlighting functionality to existing cells
    addCellHighlighting();
    
    // Update tab order for all tables
    const allTables = getAllTableBodies();
    allTables.forEach(tableBody => {
        if (tableBody) {
            updateTabOrderForAllRows(tableBody);
        }
    });
    
    // Get button elements
    const addRowsBtn = document.getElementById('addNewRowsBtn');
    const deleteRowsBtn = document.getElementById('deleteRowsBtn');
    const numRowsInput = document.getElementById('numRowsInput');
    
    
    // Add rows button event listener
    if (addRowsBtn) {
        addRowsBtn.addEventListener('click', async function() {

            
            // Block in view mode
            if (isViewMode()) {

                return;
            }
            
            // Get requested rows for fresh data (from user input)
            const requestedRows = parseInt(numRowsInput?.value, 10) || 12;

            
            // Ensure we have exactly 30 rows (like clicking the + button)
            const currentRows = getCurrentDataRowCount(testingTableBody);
            const rowsToAdd = 30 - currentRows;

            
            if (rowsToAdd > 0) {

                
                // Add rows to all tables to reach 30 total (Pages 1, 2 & 3 for UC-18gsm-250W-BFQR)
                addRowsToTable(testingTableBody, rowsToAdd);
                addRowsToTable(testingTableBody2, rowsToAdd);
                addRowsToTable(testingTableBody3, rowsToAdd);

                // Update row counts for all pages
                updateRowCount();
                updateRowCountByPage(2);
                updateRowCountByPage(3);
            }
            
            // Load historical data if available
            await loadHistoricalDataForNewForm();
            
            // Clear bottom rows for fresh data entry
            clearBottomRowsForFreshData(requestedRows);
            
            // Auto-save the form after loading historical data
            await autoSaveToDatabase();
            

        });
    }
    
    // Delete rows button event listener
    if (deleteRowsBtn) {
        deleteRowsBtn.addEventListener('click', function() {
            // Block in view mode
            if (isViewMode()) {
                return;
            }
            
            // Get all table bodies
            const testingTableBody = document.getElementById('testingTableBody');
            const testingTableBody2 = document.getElementById('testingTableBody2');
            const testingTableBody3 = document.getElementById('testingTableBody3');
            
            // Get number of rows to delete
            const rowsToDelete = parseInt(numRowsInput?.value, 10) || 1;
            
            // Simultaneously delete rows from all tables
            if (testingTableBody && testingTableBody2 && testingTableBody3) {
                // Get data rows for all tables
                const page1Rows = Array.from(testingTableBody.querySelectorAll('tr')).filter(row => {
                    const firstCell = row.querySelector('td');
                    return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
                });

                const page2Rows = Array.from(testingTableBody2.querySelectorAll('tr')).filter(row => {
                    const firstCell = row.querySelector('td');
                    return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
                });

                const page3Rows = Array.from(testingTableBody3.querySelectorAll('tr')).filter(row => {
                    const firstCell = row.querySelector('td');
                    return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
                });

                // Delete rows from all tables simultaneously
                const rowsToDeleteCount = Math.min(rowsToDelete, page1Rows.length, page2Rows.length, page3Rows.length);
                
                for (let i = 0; i < rowsToDeleteCount; i++) {
                    // Remove last row from each table
                    page1Rows[page1Rows.length - 1 - i].remove();
                    page2Rows[page2Rows.length - 1 - i].remove();
                    page3Rows[page3Rows.length - 1 - i].remove();
                }
                
                // Save changes and update UI
                debouncedSave();
                clearTableCache(testingTableBody);
                clearTableCache(testingTableBody2);
                clearTableCache(testingTableBody3);

                // Update row counts
                updateRowCount();
                updateRowCountByPage(2);
                updateRowCountByPage(3);
                
                // Recalculate summary statistics
                forceRecalculateAllSummaryStatistics();
            }
        });
    }
    
    // Load data from database if we have a current form ID (both view and edit mode)
    if (currentFormId) {

        await loadDataFromDatabase();
                } else {


    }

    // Apply view mode styling after data is loaded (this is when table inputs exist)
    setTimeout(() => {
        synchronizeViewModeAcrossPages();
    }, 100);

    // Also apply view mode styling for forms without existing data (after initial row setup)
    setTimeout(() => {
        synchronizeViewModeAcrossPages();
    }, 500);

    // Initialize row counts
    updateRowCount();
    updateAllRowCounts();
    
    // Make summary rows uneditable
    makeSummaryRowsUneditable();
    
    // Apply validation to existing inputs
    applyValidationToExistingInputs();
    
    // Add event listeners to existing input fields for real-time calculation
    addAverageCalculationListeners();
    
    // Calculate initial summary statistics immediately
    calculatePage1ColumnStats(document.getElementById('testingTableBody'));
    calculatePage2ColumnStats(document.getElementById('testingTableBody2'));
    calculatePage2ColumnStats(document.getElementById('testingTableBody3'));
    
    // Add click outside functionality to remove highlighting
    document.addEventListener('click', function(e) {

        // Check if click is outside any table cell
        const isTableCell = e.target.closest('td') || e.target.closest('th');
        const isTableInput = e.target.classList.contains('testing-input');
        
        // If click is outside table cells and not on table inputs, remove highlighting
        if (!isTableCell && !isTableInput) {

            clearCellHighlighting();
        }
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
    if (tableBody.id === 'testingTableBody2' || 
        tableBody.id === 'testingTableBody3' || 
        tableBody.id === 'testingTableBody4') {
        calculateSummaryStatistics(tableBody);
    }
}
