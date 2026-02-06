// Supabase integration for auto-saving to database
import { supabase } from '../../supabase-config.js';
import { showToast } from '../toast.js';

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

// ===== VERIFICATION & APPROVAL FUNCTIONALITY =====
// NOTE: Consolidated event listeners - initializeVerification() and initializeApproval() set up all handlers

// ===== GLOBAL CONFIGURATION =====
const CONFIG = {
    // Authentication
    VERIFICATION_PASSWORD: "QC-2256",
    APPROVAL_PASSWORD: "QA-2256",

    // Auto-save Settings
    DEBOUNCE_DELAY: 100, // ms

    // Validation Patterns
    VALIDATION_PATTERNS: {
        BASIC_WEIGHT: { beforeDecimal: 2, afterDecimal: 2 },
        THICKNESS: { beforeDecimal: 2, afterDecimal: 3 },
        OPACITY: { beforeDecimal: 2, afterDecimal: 1 },
        COF: { beforeDecimal: 1, afterDecimal: 2 },
        CUT_WIDTH: { beforeDecimal: 3, afterDecimal: 1 },
        COLOR_DELTA: { beforeDecimal: 1, afterDecimal: 2 },
        COLOR_LAB: { beforeDecimal: 2, afterDecimal: 2, allowNegative: true },
        GLOSS: { beforeDecimal: 3, afterDecimal: 1 },
        LOT_ROLL: { maxLength: 8 },
        ROLL_ID: { maxLength: 8 },
        LOT_TIME: { maxLength: 4 },
        THREE_DIGITS: { maxLength: 3 },
        TWO_DIGIT_ONE_DECIMAL: { beforeDecimal: 2, afterDecimal: 1 },
        ONE_DIGIT_ONE_DECIMAL: { beforeDecimal: 1, afterDecimal: 1 }
    },

    // Summary Calculation Delays
    SUMMARY_RECALCULATION_DELAY: 50, // ms

    // Date Formatting
    DATE_FORMATTING: {
        PAD_ZERO: '0',
        PAD_LENGTH: 2
    },

    // UI Messages
    UI_MESSAGES: {
        LOADING: 'Loading equipment...',
        SELECT_EQUIPMENT: 'Select Equipment ▼',
        LOADING_FAILED: 'Equipment loading failed - Please refresh'
    },

    // Equipment IDs
    EQUIPMENT_IDS: {
        // Page 1 Equipment
        BASIC_WEIGHT: 'basic-weight-equipment',
        THICKNESS: 'thickness-equipment',
        OPACITY: 'opacity-equipment',
        COF: 'cof-equipment',
        CUT_WIDTH: 'cut-width-equipment',
        COLOR_UNPRINTED: 'color-unprinted-equipment',
        COLOR_PRINTED: 'color-printed-equipment',
        
        // Page 2 Equipment
        PAGE2_COMMON: 'page2-common-equipment',
        
        // Page 3 Equipment
        PAGE3_COMMON: 'page3-common-equipment',
        
        // Page 4 Equipment
        COLOR_COMMON: 'color-common-equipment',
        GLOSS: 'gloss-equipment',
        
        // Page 5 Equipment
        PAGE5_COMMON: 'page5-common-equipment'
    },

    // Equipment Type Mappings
    EQUIPMENT_MAPPINGS: {
        'Weigh Scale': ['BASIC_WEIGHT'],
        'Dial Gauge': ['THICKNESS'],
        'X-RITE': ['COLOR_COMMON', 'COLOR_UNPRINTED', 'COLOR_PRINTED'],
        'Spectrophotometer': ['OPACITY', 'COLOR_COMMON'],
        'Instron': ['COF', 'PAGE2_COMMON', 'PAGE3_COMMON'],
        'Glossmeter': ['GLOSS']
    }
};

// ===== HELPER FUNCTIONS =====
const DOM_HELPERS = {
    setDropdownValue: function (dropdownId, value) {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) dropdown.value = value;
    },
    setDropdownLoading: function (dropdownId) {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            dropdown.innerHTML = `<option value="">${CONFIG.UI_MESSAGES.LOADING}</option>`;
        }
    },
    setDropdownError: function (dropdownId) {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            dropdown.innerHTML = `<option value="">${CONFIG.UI_MESSAGES.LOADING_FAILED}</option>`;
        }
    },
    // Clear input value and optionally focus
    clearInput: function (inputId, focus = false) {
        const input = document.getElementById(inputId);
        if (input) {
            input.value = '';
            if (focus) input.focus();
        }
    },
    // Focus input safely
    focusInput: function (inputId) {
        const input = document.getElementById(inputId);
        if (input) input.focus();
    },
    // Focus element safely
    focusElement: function (element) {
        if (element) element.focus();
    },
    // Batch set equipment dropdown values from equipment object
    setEquipmentValues: function (equipment) {
        if (!equipment) return;

        // Page 1 equipment
        if (equipment.page1) {
            this.setDropdownValue(CONFIG.EQUIPMENT_IDS.BASIC_WEIGHT, equipment.page1.basic_weight || '');
            this.setDropdownValue(CONFIG.EQUIPMENT_IDS.THICKNESS, equipment.page1.thickness || '');
            this.setDropdownValue(CONFIG.EQUIPMENT_IDS.OPACITY, equipment.page1.opacity || '');
            this.setDropdownValue(CONFIG.EQUIPMENT_IDS.COF, equipment.page1.cof || '');
            this.setDropdownValue(CONFIG.EQUIPMENT_IDS.CUT_WIDTH, equipment.page1.cut_width || '');
            this.setDropdownValue(CONFIG.EQUIPMENT_IDS.COLOR_UNPRINTED, equipment.page1.color_unprinted || '');
            this.setDropdownValue(CONFIG.EQUIPMENT_IDS.COLOR_PRINTED, equipment.page1.color_printed || '');
        }

        // Page 2 equipment
        if (equipment.page2) {
            this.setDropdownValue(CONFIG.EQUIPMENT_IDS.PAGE2_COMMON, equipment.page2.common || '');
        }

        // Page 3 equipment
        if (equipment.page3) {
            this.setDropdownValue(CONFIG.EQUIPMENT_IDS.PAGE3_COMMON, equipment.page3.common || '');
        }

        // Page 4 equipment
        if (equipment.page4) {
            this.setDropdownValue(CONFIG.EQUIPMENT_IDS.COLOR_COMMON, equipment.page4.color_common || '');
            this.setDropdownValue(CONFIG.EQUIPMENT_IDS.GLOSS, equipment.page4.gloss || '');
        }

        // Page 5 equipment
        if (equipment.page5) {
            this.setDropdownValue(CONFIG.EQUIPMENT_IDS.PAGE5_COMMON, equipment.page5.common || '');
        }
    }
};

// ===== SPECIFICATION CONFIGURATION =====
const SPEC_CONFIG = {
    // Page 1 Specifications
    basicWeight: { min: 14, max: 18, decimals: 2 },
    thickness: { min: 0.025, max: 0.035, decimals: 3 },
    opacity: { min: 45.0, max: 55.0, decimals: 1 },
    cof: { min: 0.20, max: 0.60, decimals: 2 },
    cutWidth: { decimals: 0 },
    colorDelta: { decimals: 2 },

    // Page 2 Specifications
    elongationMD: { min: 350, decimals: 0 },
    forceMD: { min: 9.0, decimals: 1 },
    force5pMD: { min: 2.5, max: 5.5, decimals: 1 },

    // Page 3 Specifications
    elongationCD: { min: 400, decimals: 0 },
    forceCD: { min: 6.0, decimals: 1 },
    modulus: { min: 20.0, max: 40.0, decimals: 1 },

    // Page 4 Specifications
    colorL: { min: 90.6, max: 98.6, decimals: 2 },
    colorA: { min: -5.1, max: 2.9, decimals: 2 },
    colorB: { min: -3.6, max: 4.4, decimals: 2 },
    colorDeltaE: { max: 5.00, decimals: 2 },
    gloss: { max: 11.0, decimals: 1 },

    // Page 5 Specifications
    pgQuality: { validValues: [0, 1] }
};

// Universal validation function that uses centralized configuration
function validateInput(input, fieldType) {
    let value = input.value;

    // Remove any non-numeric characters except decimal point
    value = value.replace(/[^0-9.]/g, '');

    // Ensure only one decimal point
    const parts = value.split('.');
    if (parts.length > 2) {
        value = parts[0] + '.' + parts.slice(1).join('');
    }

    const pattern = CONFIG.VALIDATION_PATTERNS[fieldType];
    if (!pattern) return value;

    // Handle maxLength validation
    if (pattern.maxLength !== undefined && value.length > pattern.maxLength) {
        value = value.substring(0, pattern.maxLength);
    }

    // Handle decimal validation
    if (pattern.beforeDecimal !== undefined || pattern.afterDecimal !== undefined) {
        if (parts.length === 2) {
            // Before decimal
            if (pattern.beforeDecimal !== undefined && parts[0].length > pattern.beforeDecimal) {
                parts[0] = parts[0].substring(0, pattern.beforeDecimal);
            }
            // After decimal
            if (pattern.afterDecimal !== undefined && parts[1].length > pattern.afterDecimal) {
                parts[1] = parts[1].substring(0, pattern.afterDecimal);
            }
            value = parts[0] + '.' + parts[1];
        } else if (parts.length === 1) {
            // No decimal point yet
            if (pattern.beforeDecimal !== undefined && parts[0].length > pattern.beforeDecimal) {
                parts[0] = parts[0].substring(0, pattern.beforeDecimal);
                value = parts[0];
            }
        }
    }

    // Update input value with validated format
    input.value = value;
    return value;
}

// Single debounced save function for database operations
let saveTimeout = null;
function debouncedSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(autoSaveToDatabase, CONFIG.DEBOUNCE_DELAY);
}

// Apply color formatting based on spec (OOS highlighting)
function applyColorFormatting(input, specType) {
    const value = parseFloat(input.value);
    
    // Remove existing color classes and inline styles
    input.classList.remove('text-red-600', 'bg-red-50', 'border-red-300', 'oos-highlight');
    input.style.color = '';
    input.style.backgroundColor = '';
    input.style.borderColor = '';
    input.style.borderWidth = '';
    input.style.borderStyle = '';
    
    // Apply red formatting based on spec type
    let shouldHighlight = false;
    const spec = SPEC_CONFIG[specType];
    
    if (spec) {
        if (specType === 'pgQuality') {
            // Pass=0, Fail=1 - highlight if value is 1 (Fail)
            shouldHighlight = !isNaN(value) && value === 1;
        } else {
            // Standard numeric checks
            if (!isNaN(value) && input.value.trim() !== '') {
                 if (spec.min !== undefined && value < spec.min) shouldHighlight = true;
                 if (spec.max !== undefined && value > spec.max) shouldHighlight = true;
            }
        }
    }

    if (shouldHighlight) {
        if (typeof viewMode !== 'undefined' && viewMode) {
            // In view mode: ONLY red text
            input.style.setProperty('color', '#dc2626', 'important');
        } else {
            // In edit mode: full highlighting
            input.classList.add('text-red-600', 'bg-red-50', 'border-red-300');
            // Add specific class for easy identification
            input.classList.add('oos-highlight');
        }
    }
}

// Validate PG Quality input (only 0 or 1 allowed)
function validatePGQuality(input) {
    let value = input.value.trim();
    // Only allow 0 or 1, but don't clear if user is still typing
    if (value === '0' || value === '1') {
        input.value = value;
    } else if (value === '') {
        input.value = '';
    } else if (value.length === 1 && (value === '0' || value === '1')) {
        input.value = value;
    } else if (value.length > 1) {
        const lastChar = value.slice(-1);
        if (lastChar === '0' || lastChar === '1') {
            input.value = lastChar;
        } else {
            input.value = input.value.slice(0, -1);
        }
    }
}





const VERIFICATION_PASSWORD = CONFIG.VERIFICATION_PASSWORD; // Verification password for form verification
const APPROVAL_PASSWORD = CONFIG.APPROVAL_PASSWORD; // Approval password for form approval

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
            .from('168_16c_white')
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
            .from('168_16c_white')
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
    // Try to get form ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const formId = urlParams.get('form_id');
    if (formId) {
        return formId;
    }
    
    // Try to get from session storage
    const storedData = sessionStorage.getItem('filmInspectionData');
    if (storedData) {
        try {
            const data = JSON.parse(storedData);
            if (data && data.form_id) {
                return data.form_id;
            }
        } catch (e) {
            console.error('Error parsing stored data:', e);
        }
    }
    
    // Try to get from sessionStorage currentFormId
    const sessionFormId = sessionStorage.getItem('currentFormId');
    if (sessionFormId) {
        return sessionFormId;
    }
    
    // Try to get from global variable if available
    if (typeof currentFormId !== 'undefined' && currentFormId) {
        return currentFormId;
    }
    
    // Try to get from window.currentFormId
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
            console.log('No form ID found, showing verification form');
            showVerificationForm();
            return;
        }
        
        // Check if the form is already verified - use .maybeSingle() to handle no results gracefully
        const { data, error } = await supabase
            .from('168_16c_white')
            .select('verified_by, verified_date')
            .eq('form_id', formId)
            .maybeSingle();

        if (error) {
            console.error('Error checking verification status:', error);
            // If it's a PGRST116 error (no rows), that's expected for new forms
            if (error.code === 'PGRST116') {
                console.log('No verification record found - this is normal for new forms');
                showVerificationForm();
                return;
            }
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
                
                // Check approval status immediately to show approval section
                checkApprovalStatus().catch(error => {
                    console.error('Error checking approval status:', error);
                });
                
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

// ===== APPROVAL FUNCTIONS =====
// Check if form is verified in database before allowing approval
async function checkApprovalStatus() {
    try {
        // Get the current form ID
        const formId = getCurrentFormId();
        if (!formId) {
            hideApprovalSection();
            return;
        }
        
        // Check if the form is already verified and approved
        const { data, error } = await supabase
            .from('168_16c_white')
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
        
        // Only show approval section if form is verified
        if (data && data.verified_by) {
            // Form is verified, so show approval section
            showApprovalSection();
            setApprovalFormState(true);
            
            // If already approved, show approval status instead of form
            if (data.approved_by) {
                showApprovalStatus();
                document.getElementById('approvedByDisplay').textContent = 'Approved by: ' + data.approved_by;
                document.getElementById('approvedDateDisplay').textContent = 'Date: ' + formatDateToDDMMYYYY(data.approved_date);
            } else {
                showApprovalForm();
            }
        } else {
            // Form is not verified, hide approval section
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
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                document.getElementById('approvalPassword').value = '';
                document.getElementById('approvalDate').value = '';
            });
        }
        
        if (togglePasswordBtn) {
            togglePasswordBtn.addEventListener('click', function() {
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

document.addEventListener('DOMContentLoaded', function() {
    // ===== VIEW MODE DETECTION =====
    // Get URL parameters first
    const urlParams = new URLSearchParams(window.location.search);
    const viewModeFromStorage = sessionStorage.getItem('viewMode') === 'true';
    const viewMode = urlParams.get('mode') === 'view' || viewModeFromStorage;
    
    
    // Clear view mode flag from sessionStorage after detection
    if (viewModeFromStorage) {
        sessionStorage.removeItem('viewMode');
    }
    
    // ===== SESSION INITIALIZATION =====
    // Load session variables from sessionStorage (set by film_inspection_list.js)
    const sessionFormId = sessionStorage.getItem('currentFormId');
    const sessionLotNo = sessionStorage.getItem('currentLotNo');
    const sessionProductCode = sessionStorage.getItem('currentProductCode');
    
    if (sessionFormId && sessionLotNo) {
        // Set these as current session variables
        window.currentFormId = sessionFormId;
        window.currentLotNo = sessionLotNo;
    }
    
    // ===== VIEW MODE SETUP =====
    const prestoreSection = document.getElementById('prestore-section');
    if (prestoreSection) {
        prestoreSection.style.display = viewMode ? 'block' : 'none';
    }

    // Verified/Approved blocks should be visible ONLY in view mode
    const verificationApprovalContainer = document.getElementById('verificationApprovalContainer');
    if (verificationApprovalContainer) {
        verificationApprovalContainer.style.display = viewMode ? 'flex' : 'none';
    }
    
    // Show/hide verification sections based on mode
    const verificationSection = document.getElementById('verificationSection');
    const approvalSection = document.getElementById('approvalSection');
    
    if (verificationSection) {
        verificationSection.style.display = viewMode ? 'block' : 'none';
    }
    if (approvalSection) {
        approvalSection.style.display = viewMode ? 'block' : 'none';
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
                throw new Error(`Database error: ${error.message}`);
            }
            
            if (!equipmentData || equipmentData.length === 0) {
                throw new Error('No equipment data found');
            }
            
            // Populate dropdowns with fresh data
            populateEquipmentDropdowns(equipmentData);
            
        } catch (error) {
            console.error('Error loading QC equipment:', error);
            showEquipmentLoadingError();
        }
    }
    
    // Function to show loading state
    function showEquipmentLoadingState() {
        Object.values(CONFIG.EQUIPMENT_IDS).forEach(dropdownId => {
            DOM_HELPERS.setDropdownLoading(dropdownId);
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
        
        // Populate dropdowns
        Object.keys(CONFIG.EQUIPMENT_MAPPINGS).forEach(equipmentType => {
            const mappingKeys = CONFIG.EQUIPMENT_MAPPINGS[equipmentType];
            const dropdownIds = mappingKeys.map(key => CONFIG.EQUIPMENT_IDS[key]);
            const equipmentIds = equipmentByType[equipmentType] || [];
            
            dropdownIds.forEach(dropdownId => {
                const dropdown = document.getElementById(dropdownId);
                if (dropdown) {
                    // Remove 'Loading equipment...' option if present
                    Array.from(dropdown.options).forEach(opt => {
                        if (opt.textContent === CONFIG.UI_MESSAGES.LOADING) {
                            dropdown.removeChild(opt);
                        }
                    });

                    // Always ensure 'Select Equipment ▼' is present as the first option
                    const selectOptionExists = Array.from(dropdown.options).some(opt => opt.textContent === CONFIG.UI_MESSAGES.SELECT_EQUIPMENT);
                    if (!selectOptionExists) {
                        const selectOption = document.createElement('option');
                        selectOption.value = '';
                        selectOption.textContent = CONFIG.UI_MESSAGES.SELECT_EQUIPMENT;
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
                        dropdown.addEventListener('change', function() {
                            if (!viewMode) {
                                autoSaveToDatabase();
                            }
                        });
                        dropdown.setAttribute('data-listener-added', 'true');
                    }
                }
            });
        });
    }
    
    // Function to show equipment loading error
    function showEquipmentLoadingError() {
        Object.values(CONFIG.EQUIPMENT_IDS).forEach(dropdownId => {
            DOM_HELPERS.setDropdownError(dropdownId);
        });
    }
    
    // Load equipment dropdowns on page load - SIMPLE AND DIRECT
    loadQCEquipmentDropdowns().then(() => {
        // Equipment dropdowns loaded, now load form data if in view mode
        if (viewMode && currentFormId) {
            loadDataFromDatabase().then(() => {
                // Apply conditional formatting in view mode (red text only)
                setTimeout(() => {
                    applyConditionalFormattingToAllColumns();
                }, 100);
            });
        }
        
        // Setup historical data loading trigger
        setupHistoricalDataTrigger();
    });

    // Page 1 elements
    const addRowsBtn = document.getElementById('addNewRowsBtn');
    const deleteRowsBtn = document.getElementById('deleteRowsBtn');
    const numRowsInput = document.getElementById('numRowsInput');
    const testingTableBody = document.getElementById('testingTableBody');
    const rowCountDisplay = document.getElementById('rowCountDisplay');

               // Page 2 elements
           const testingTableBody2 = document.getElementById('testingTableBody2');
           const rowCountDisplay2 = document.getElementById('rowCountDisplay2');
           
           // Page 3 elements
           const testingTableBody3 = document.getElementById('testingTableBody3');
           const rowCountDisplay3 = document.getElementById('rowCountDisplay3');
           
           // Page 4 elements
           const testingTableBody4 = document.getElementById('testingTableBody4');
           const rowCountDisplay4 = document.getElementById('rowCountDisplay4');

           if (!addRowsBtn || !deleteRowsBtn || !numRowsInput || !testingTableBody || !testingTableBody2 || !testingTableBody3 || !testingTableBody4) {
           return;
       }

       // ===== HELPER FUNCTIONS FOR TABLE OPERATIONS =====
       // Get all table bodies as an array for easier iteration
       const getAllTableBodies = () => [testingTableBody, testingTableBody2, testingTableBody3, testingTableBody4];
       
       // Get table body by page number (1-4)
       const getTableBodyByPage = (pageNumber) => {
           switch(pageNumber) {
               case 1: return testingTableBody;
               case 2: return testingTableBody2;
               case 3: return testingTableBody3;
               case 4: return testingTableBody4;
               default: return null;
           }
       };
       
       // Get column count for a specific table
       const getTableColumnCount = (tableBody) => {
           if (tableBody.id === 'testingTableBody') return 7;      // Page 1: 7 columns (3 for Sample No + 4 parameters)
           if (tableBody.id === 'testingTableBody2') return 15;     // Page 2: 15 columns  
           if (tableBody.id === 'testingTableBody3') return 15;     // Page 3: 15 columns
           if (tableBody.id === 'testingTableBody4') return 11;     // Page 4: 11 columns (3 for Sample No + 4 Color + 4 Gloss columns)
           if (tableBody.id === 'testingTableBody5') return 5;      // Page 5: 5 columns (3 for Sample No + 1 PG Quality + 1 blank column)
           return 0;
       };
       
       // Header form elements
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
           // Try to find by looking for the second date input after production date
           const allDateInputs = document.querySelectorAll('input[type="date"]');
           inspectionDateInput = allDateInputs[1] || null;
       }
       
       // Make header form fields read-only
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
               // field.style.backgroundColor = '#f3f4f6'; // Light gray background - REMOVED for normal appearance
               field.style.cursor = 'default'; // Normal cursor instead of not-allowed
               field.style.fontSize = '16px'; // Bigger font size for better readability
               field.style.fontWeight = '500'; // Slightly bolder text
               field.style.color = '#000000'; // Force black text color
               field.style.opacity = '1'; // Force full opacity
               field.title = 'This field is read-only';
           }
       });
       
       // In view mode, hide add/delete buttons and disable all editing
       if (viewMode) {
           if (addRowsBtn) addRowsBtn.style.display = 'none';
           if (deleteRowsBtn) deleteRowsBtn.style.display = 'none';
           if (numRowsInput) numRowsInput.style.display = 'none';
           
           // Disable all input fields in tables and equipment dropdowns
           setTimeout(() => {
               const allInputs = document.querySelectorAll('input, textarea, select');
               allInputs.forEach(input => {
                   // Skip verification inputs - they should always be enabled
                   if (input.id === 'verificationPassword' || 
                       input.id === 'verificationDate' || 
                       input.id === 'toggleVerificationPassword' ||
                       input.id === 'verifyFormBtn' ||
                       input.id === 'cancelVerificationBtn' ||
                       input.id === 'approvalPassword' ||
                       input.id === 'approvalDate' ||
                       input.id === 'approveFormBtn' ||
                       input.id === 'cancelApprovalBtn' ||
                       input.id === 'toggleApprovalPassword') {
                       return; // Skip disabling verification and approval inputs
                   }
                   input.readOnly = true;
                   input.disabled = true;
                   // input.style.backgroundColor = '#f9fafb'; // REMOVED for normal appearance
                   input.style.cursor = 'default';
                   input.style.color = '#000000'; // Force black text color
                   input.style.opacity = '1'; // Force full opacity
               });
               
               // Apply conditional formatting in view mode (red text only)
               applyConditionalFormattingToAllColumns();
           }, 1000);
       }
       


       // ===== HISTORICAL DATA LOADING TRIGGER =====
       // Load historical data when user enters required fields
       function setupHistoricalDataTrigger() {
           if (productCodeInput) {
               productCodeInput.addEventListener('blur', checkAndLoadHistoricalData);
           }
           if (machineInput) {
               machineInput.addEventListener('blur', checkAndLoadHistoricalData);
           }
           if (productionDateInput) {
               productionDateInput.addEventListener('change', checkAndLoadHistoricalData);
           }
       }

       // Check if all required fields are filled and load historical data
       async function checkAndLoadHistoricalData() {
           const productCode = productCodeInput ? productCodeInput.value.trim() : '';
           const machineNo = machineInput ? machineInput.value.trim() : '';
           const productionDate = productionDateInput ? productionDateInput.value : '';

           // Only load historical data if all three fields are filled and we don't have a current form ID
           if (productCode && machineNo && productionDate && !currentFormId) {
               await loadHistoricalDataForNewForm();
           }
       }

       // ===== AUTO-SAVE TO DATABASE (LIKE INLINE INSPECTION FORM) =====
       
       // Track current form session to prevent multiple rows
       // Use global variables set from sessionStorage
       let currentFormId = sessionFormId || null; // Store current form_id (UUID) for updates
       let currentLotNo = sessionLotNo || null;  // Store current lot_no for updates
       let isInitialLoading = true; // Flag to prevent auto-save during initial data loading
       

       
       // Get equipment selections from all dropdowns
       function getEquipmentSelections() {
           const equipmentData = {
               page1: {
                   basic_weight: document.getElementById(CONFIG.EQUIPMENT_IDS.BASIC_WEIGHT)?.value || '',
                   thickness: document.getElementById(CONFIG.EQUIPMENT_IDS.THICKNESS)?.value || '',
                   opacity: document.getElementById(CONFIG.EQUIPMENT_IDS.OPACITY)?.value || '',
                   cof: document.getElementById(CONFIG.EQUIPMENT_IDS.COF)?.value || '',
                   cut_width: document.getElementById(CONFIG.EQUIPMENT_IDS.CUT_WIDTH)?.value || '',
                   color_unprinted: document.getElementById(CONFIG.EQUIPMENT_IDS.COLOR_UNPRINTED)?.value || '',
                   color_printed: document.getElementById(CONFIG.EQUIPMENT_IDS.COLOR_PRINTED)?.value || ''
               },
               page2: {
                   common: document.getElementById(CONFIG.EQUIPMENT_IDS.PAGE2_COMMON)?.value || ''
               },
               page3: {
                   common: document.getElementById(CONFIG.EQUIPMENT_IDS.PAGE3_COMMON)?.value || ''
               },
               page4: {
                   color_common: document.getElementById(CONFIG.EQUIPMENT_IDS.COLOR_COMMON)?.value || '',
                   gloss: document.getElementById(CONFIG.EQUIPMENT_IDS.GLOSS)?.value || ''
               },
               page5: {
                   common: document.getElementById(CONFIG.EQUIPMENT_IDS.PAGE5_COMMON)?.value || ''
               }
           };
           
           // Only return equipment data if at least one equipment is selected
        // const hasEquipment = Object.values(equipmentData).some(page => 
        //     Object.values(page).some(equipment => equipment && equipment !== '')
        // );
        
        return equipmentData;
    }
       
       // Load equipment selections from database
       function loadEquipmentSelections(data) {
           if (data.equipment_used) {
               DOM_HELPERS.setEquipmentValues(data.equipment_used);
           }
       }
       
       // Auto-save all form data to database (debounced)
       async function autoSaveToDatabase() {
           // Block saving in view mode or during initial loading
           if (viewMode || isInitialLoading) {
               return;
           }
           
           
           try {
               // Get header form data
               const headerData = {
                   product_code: productCodeInput?.value || '',
                   production_order: productionOrderInput?.value || '',
                   machine_no: machineInput?.value || '',
                   production_date: productionDateInput?.value || null,
                   inspection_date: inspectionDateInput?.value || null,
                   specification: specificationInput?.value || '',
                   purchase_order: 'N/A',
                   quantity: quantityInput?.value ? parseInt(quantityInput.value) : null,
                   lot_no: currentLotNo || null, // Only use existing lot_no, don't generate new ones
                   // Don't overwrite ref_no and prepared_by if updating existing form
                   ...(currentFormId ? {} : {
                       ref_no: generateRefNumber(),
                       prepared_by: 'User'
                   })
               };
               
               // Get table data and convert to JSONB format
               const tableData = {
                   // Sample Identification: Convert to JSONB arrays for each column
                   // These are the 3 columns under Sample No. header
                   lot_and_roll: convertColumnToJSONB(testingTableBody, 0),      // Lot & Roll (HTML column 0)
                   roll_id: convertColumnToJSONB(testingTableBody, 1),           // Roll ID (HTML column 1)
                   lot_time: convertColumnToJSONB(testingTableBody, 2),          // Lot Time (HTML column 2)
                   
                   // Page 1: Convert to JSONB arrays for each column
                   // HTML: Sample No (colspan="3"), Basic Weight (GSM), Thickness, Opacity, COF, Cut Width, Color Delta Unprinted, Color Delta Printed
                   // HTML columns: 0(Sample No), 1(Basic Weight), 2(Thickness), 3(Opacity), 4(COF), 5(Cut Width), 6(Color Unprinted), 7(Color Printed)
                   page1_basis_weight: convertColumnToJSONB(testingTableBody, 3), // Basic Weight (GSM) - HTML column 3
                   page1_thickness: convertColumnToJSONB(testingTableBody, 4),   // Thickness - HTML column 4
                   page1_opacity: convertColumnToJSONB(testingTableBody, 5),     // Opacity - HTML column 5
                   page1_cof_kinetic: convertColumnToJSONB(testingTableBody, 6), // COF Kinetic - HTML column 6
                   
                   // Page 2: Convert to JSONB arrays for each column
                   // HTML: Sample No (colspan="3"), Elongation MD (colspan="4"), Force MD (colspan="4"), Force 5% MD (colspan="4")
                   // HTML columns: 0(Sample No), 1(Elongation1), 2(Elongation2), 3(Elongation3), 4(ElongationAve), 5(Force1), 6(Force2), 7(Force3), 8(ForceAve), 9(Force5%1), 10(Force5%2), 11(Force5%3), 12(Force5%Ave)
                   page2_elongation_md_1: convertColumnToJSONB(testingTableBody2, 3),     // Elongation MD 1 - HTML column 3
                   page2_elongation_md_2: convertColumnToJSONB(testingTableBody2, 4),     // Elongation MD 2 - HTML column 4
                   page2_elongation_md_3: convertColumnToJSONB(testingTableBody2, 5),     // Elongation MD 3 - HTML column 5
                   page2_force_md_1: convertColumnToJSONB(testingTableBody2, 7),          // Force MD 1 - HTML column 7
                   page2_force_md_2: convertColumnToJSONB(testingTableBody2, 8),          // Force MD 2 - HTML column 8
                   page2_force_md_3: convertColumnToJSONB(testingTableBody2, 9),          // Force MD 3 - HTML column 9
                   page2_force_5p_md_1: convertColumnToJSONB(testingTableBody2, 11),     // Force 5% MD 1 - HTML column 11
                   page2_force_5p_md_2: convertColumnToJSONB(testingTableBody2, 12),     // Force 5% MD 2 - HTML column 12
                   page2_force_5p_md_3: convertColumnToJSONB(testingTableBody2, 13),     // Force 5% MD 3 - HTML column 13
                   
                   // Page 3: Convert to JSONB arrays for each column
                   // HTML: Sample No (colspan="3"), Elongation CD (colspan="4"), Force CD (colspan="4"), Modulus (colspan="3")
                   // HTML columns: 0(Sample No), 1(Elongation1), 2(Elongation2), 3(Elongation3), 4(ElongationAve), 5(Force1), 6(Force2), 7(Force3), 8(ForceAve), 9(Modulus1), 10(Modulus2), 11(Modulus3)
                   page3_elongation_cd_1: convertColumnToJSONB(testingTableBody3, 3),     // Elongation CD 1 - HTML column 3
                   page3_elongation_cd_2: convertColumnToJSONB(testingTableBody3, 4),     // Elongation CD 2 - HTML column 4
                   page3_elongation_cd_3: convertColumnToJSONB(testingTableBody3, 5),     // Elongation CD 3 - HTML column 5
                   page3_force_cd_1: convertColumnToJSONB(testingTableBody3, 7),          // Force CD 1 - HTML column 7
                   page3_force_cd_2: convertColumnToJSONB(testingTableBody3, 8),          // Force CD 2 - HTML column 8
                   page3_force_cd_3: convertColumnToJSONB(testingTableBody3, 9),          // Force CD 3 - HTML column 9
                   page3_modulus_1: convertColumnToJSONB(testingTableBody3, 11),          // Modulus 1 - HTML column 11
                   page3_modulus_2: convertColumnToJSONB(testingTableBody3, 12),          // Modulus 2 - HTML column 12
                   page3_modulus_3: convertColumnToJSONB(testingTableBody3, 13),          // Modulus 3 - HTML column 13
                   
                   // Page 4: Convert to JSONB arrays for each column
                   // HTML: Sample No (colspan="3"), Color L, Color A, Color B, Color~Delta E, Gloss (colspan="4")
                   // HTML columns: 0-2(Sample No), 3(Color L), 4(Color A), 5(Color B), 6(Color~Delta E), 7(Gloss1), 8(Gloss2), 9(Gloss3), 10(GlossAve)
                   page4_color_l: convertColumnToJSONB(testingTableBody4, 3),            // Color L - HTML column 3
                   page4_color_a: convertColumnToJSONB(testingTableBody4, 4),            // Color A - HTML column 4
                   page4_color_b: convertColumnToJSONB(testingTableBody4, 5),            // Color B - HTML column 5
                   page4_color_delta_e: convertColumnToJSONB(testingTableBody4, 6),     // Color~Delta E - HTML column 6
                   page4_gloss_1: convertColumnToJSONB(testingTableBody4, 7),            // Gloss 1 - HTML column 7
                   page4_gloss_2: convertColumnToJSONB(testingTableBody4, 8),            // Gloss 2 - HTML column 8
                   page4_gloss_3: convertColumnToJSONB(testingTableBody4, 9),            // Gloss 3 - HTML column 9
                   // page4_gloss_ave is calculated automatically and not saved to database
                   
                   // Page 5 - PG Quality System Requirements
                   page5_pg_quality: convertColumnToJSONB(testingTableBody5, 3)          // PG Quality - HTML column 3
               };
               
               // Get equipment selections
               const equipmentData = getEquipmentSelections();
               
               // Combine header, table data, and equipment data (only if equipment data exists)
               const completeData = { ...headerData, ...tableData };
               if (equipmentData) {
                   completeData.equipment_used = equipmentData;
               }
               

               
               // Upsert data into Supabase (update if exists, insert if new)
               let result;
               if (currentFormId) {
                   // Update existing record (DO NOT update prepared_by to preserve original author)
                   const updateData = { ...completeData };
                   delete updateData.prepared_by; // Remove prepared_by from update to preserve original author
                   
                   result = await supabase
                       .from('168_16c_white')
                       .update(updateData)
                       .eq('form_id', currentFormId)
                       .select('form_id');
               } else {
                   // Insert new record
                   result = await supabase
                       .from('168_16c_white')
                       .insert([completeData])
                       .select('form_id');
               }
               
               const { data, error } = result;
               
               if (error) {
                   console.error('Supabase error:', error);
                   return;
               }
               
               
               // Store form_id and lot_no for future updates
               if (data && data.length > 0) {
                   currentFormId = data[0].form_id; // Now stores UUID
                   currentLotNo = headerData.lot_no;
               }
               

           } catch (error) {
               console.error('Error auto-saving to Supabase:', error);
           }
       }
       
       // Single debounced save function for database operations
let isSaving = false; // Flag to prevent duplicate saves
let savePending = false; // Flag to track if a save was requested while saving
let saveTimeout = null; // Moved here for better scoping

function debouncedSave() {
    // If a save is currently happening, just mark that we need another one later
    if (isSaving) {
        savePending = true;
        return;
    }
    
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        isSaving = true;
        
        try {
            await autoSaveToDatabase();
        } catch (error) {
            console.error('Error during auto-save:', error);
        } finally {
            isSaving = false;
            // If changes happened while we were saving, run it again
            if (savePending) {
                savePending = false;
                debouncedSave(); 
            }
        }
    }, 100); // 100ms delay for better responsiveness
}

// Warn user before leaving page if data is being saved
window.addEventListener('beforeunload', function (e) {
    if (isSaving || savePending) {
        // Cancel the event
        e.preventDefault(); 
        // Chrome requires returnValue to be set
        e.returnValue = 'Data is currently being saved. Are you sure you want to leave?';
    }
});
       

       
       // Helper function to trigger summary recalculation with delay
       function triggerSummaryRecalculation() {
           setTimeout(() => {
               forceRecalculateAllSummaryStatistics();
           }, 50);
       }
       
       // Get table data (excluding summary rows)
       function getTableData(tableBody) {
           const rows = Array.from(tableBody.querySelectorAll('tr'));
           const dataRows = rows.filter(row => {
               const firstCell = row.querySelector('td');
               return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
           });
           
           return dataRows.map(row => {
               const inputs = row.querySelectorAll('input');
               return Array.from(inputs).map(input => input.value);
           });
       }
       
              // Load table data
       function loadTableData(tableBody, data) {
           if (!data || data.length === 0) return;
           
           // Find the first summary row (Average row) to insert data rows before it
           const summaryRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
               const firstCell = row.querySelector('td');
               return firstCell && ['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
           });
           
           if (summaryRows.length === 0) return;
           
           const firstSummaryRow = summaryRows[0]; // Average row
           
           data.forEach(rowData => {
               const tr = document.createElement('tr');
               tr.className = 'border border-gray-800 px-3 py-2 text-center';
               
                               rowData.forEach((cellValue, j) => {
                    const td = document.createElement('td');
                    td.className = 'testing-table-cell';
                    td.style.fontSize = '13px';
                   
                   const input = document.createElement('input');
                   input.type = 'text';
                   input.className = 'testing-input';
                   input.value = cellValue;
                   
                   // Apply validation and listeners
                   if (tableBody.id === 'testingTableBody' && j === 0) {
                       applyLotRollValidation(input);
                   } else if (tableBody.id === 'testingTableBody' && j === 1) {
                       applyRollIDValidation(input);
                   } else if (tableBody.id === 'testingTableBody' && j === 2) {
                       applyLotTimeValidation(input);
                   } else {
                       applyValidationToInput(input, tableBody, j);
                   }
                   
                   td.appendChild(input);
                   tr.appendChild(td);
               });
               
               // Insert the row BEFORE the first summary row (Average row)
               tableBody.insertBefore(tr, firstSummaryRow);
               
               // Add highlighting functionality to the loaded row
               addHighlightingToRow(tr);
           });
           
           // Recalculate summary statistics for Pages 2, 3 and 4 after loading data
           if (tableBody.id === 'testingTableBody2' || tableBody.id === 'testingTableBody3' || tableBody.id === 'testingTableBody4') {
               calculateSummaryStatistics(tableBody);
           }
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
       
       // Show notification
       function showNotification(message, type = 'info') {
           // Create notification element
           const notification = document.createElement('div');
           notification.className = `fixed top-20 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm ${
               type === 'success' ? 'bg-green-500 text-white' :
               type === 'error' ? 'bg-red-500 text-white' :
               'bg-blue-500 text-white'
           }`;
           notification.textContent = message;
           
           // Add to page
           document.body.appendChild(notification);
           
           // Remove after 3 seconds
           setTimeout(() => {
               notification.remove();
           }, 3000);
       }
       

       
       // Convert a table column to JSONB format (exactly like screenshot)
       function convertColumnToJSONB(tableBody, columnIndex) {
           const rows = Array.from(tableBody.querySelectorAll('tr'));
           const dataRows = rows.filter(row => {
               const firstCell = row.querySelector('td');
               return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
           });
           

           
           const jsonbObject = {};
           // Create JSONB object with all row numbers (1, 2, 3, 4, 5, 6, 7, etc.)
           for (let i = 1; i <= dataRows.length; i++) {
               const rowIndex = i - 1;
               const row = dataRows[rowIndex];
               
               // Find the input element for this specific column based on table type
               let inputElement = null;
               
               if (tableBody.id === 'testingTableBody') {
                   // Page 1: Basic structure with 3 sample columns + 7 data columns
                   // DOM columns: 0(Sample1), 1(Sample2), 2(Sample3), 3(Basic Weight), 4(Thickness), 5(Opacity), 6(COF), 7(Cut Width), 8(Color Unprinted), 9(Color Printed)
                   // Input indices: 0(Sample1), 1(Sample2), 2(Sample3), 3(Basic Weight), 4(Thickness), 5(Opacity), 6(COF), 7(Cut Width), 8(Color Unprinted), 9(Color Printed)
                   if (columnIndex === 0) {
                       // Sample Number column - find input in first column
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[0] || null;
                   } else if (columnIndex === 1) {
                       // Lot Number column - find input in second column
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[1] || null;
                   } else if (columnIndex === 2) {
                       // Roll Number column - find input in third column
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[2] || null;
                   } else {
                       // Data columns - find input element (column index = input index)
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[columnIndex] || null;
                   }
               } else if (tableBody.id === 'testingTableBody2' || tableBody.id === 'testingTableBody3') {
                   // Page 2 & 3: 3 sample columns + 12 data columns
                   // DOM columns: 0(Sample1), 1(Sample2), 2(Sample3), 3(Elongation1), 4(Elongation2), 5(Elongation3), 6(ElongationAve), 7(Force1), 8(Force2), 9(Force3), 10(ForceAve), 11(Force5%1), 12(Force5%2), 13(Force5%3), 14(Force5%Ave)
                   // Input indices: 0(Sample1), 1(Sample2), 2(Sample3), 3(Elongation1), 4(Elongation2), 5(Elongation3), 6(ElongationAve), 7(Force1), 8(Force2), 9(Force3), 10(ForceAve), 11(Force5%1), 12(Force5%2), 13(Force5%3), 14(Force5%Ave)
                   if (columnIndex === 0) {
                       // Sample Number column - find input in first column
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[0] || null;
                   } else if (columnIndex === 1) {
                       // Lot Number column - find input in second column
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[1] || null;
                   } else if (columnIndex === 2) {
                       // Roll Number column - find input in third column
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[2] || null;
                   } else {
                       // Data columns - find input element (column index = input index)
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[columnIndex] || null;
                   }
               } else if (tableBody.id === 'testingTableBody5') {
                   // Page 5: 3 sample columns + 1 data column (PG Quality)
                   // DOM columns: 0(Sample1), 1(Sample2), 2(Sample3), 3(PG Quality)
                   // Input indices: 0(Sample1), 1(Sample2), 2(Sample3), 3(PG Quality)
                   if (columnIndex === 0) {
                       // Sample Number column - find input in first column
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[0] || null;
                   } else if (columnIndex === 1) {
                       // Lot Number column - find input in second column
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[1] || null;
                   } else if (columnIndex === 2) {
                       // Roll Number column - find input in third column
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[2] || null;
                   } else if (columnIndex === 3) {
                       // PG Quality column - find input in fourth column
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[3] || null;
                   }
               } else if (tableBody.id === 'testingTableBody4') {
                   // Page 4: 3 sample columns + 8 data columns
                   // DOM columns: 0(Sample1), 1(Sample2), 2(Sample3), 3(Color L), 4(Color A), 5(Color B), 6(Color~Delta E), 7(Gloss1), 8(Gloss2), 9(Gloss3), 10(GlossAve)
                   // Input indices: 0(Sample1), 1(Sample2), 2(Sample3), 3(Color L), 4(Color A), 5(Color B), 6(Color~Delta E), 7(Gloss1), 8(Gloss2), 9(Gloss3), 10(GlossAve)
                   if (columnIndex === 0) {
                       // Sample Number column - find input in first column
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[0] || null;
                   } else if (columnIndex === 1) {
                       // Lot Number column - find input in second column
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[1] || null;
                   } else if (columnIndex === 2) {
                       // Roll Number column - find input in third column
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[2] || null;
                   } else {
                       // Data columns - find input element (column index = input index)
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[columnIndex] || null;
                   }
               }
               
               if (inputElement && inputElement.value && inputElement.value.trim() !== '') {
                   // Apply formatting for specific Page 1 columns before saving to database
                   const formattedValue = formatValueForDatabase(inputElement.value.trim(), tableBody.id, columnIndex);
                   jsonbObject[String(i)] = formattedValue;
               } else {
                   jsonbObject[String(i)] = ""; // Empty string
               }
           }
           
                          return Object.keys(jsonbObject).length > 0 ? jsonbObject : null;
       }

       // Function to format values before saving to database (All pages)
       function formatValueForDatabase(value, tableBodyId, columnIndex) {
           // Page 1 formatting
           if (tableBodyId === 'testingTableBody') {
           
           // Page 1 column formatting
           if (columnIndex === 3) {
               // Basic Weight column - format to 2 decimal places (00.00)
               const numValue = parseFloat(value);
               if (!isNaN(numValue)) {
                   return numValue.toFixed(2);
               }
           } else if (columnIndex === 4) {
               // Thickness column - format to 3 decimal places (0.000)
               const numValue = parseFloat(value);
               if (!isNaN(numValue)) {
                   // Convert integer input to decimal format (e.g., 30 -> 0.030)
                   let finalValue;
                   if (Number.isInteger(numValue) && !value.includes('.')) {
                       // If it's an integer without decimal point, treat as thousandths
                       finalValue = numValue / 1000;
                   } else {
                       // Already has decimal point, use as-is
                       finalValue = numValue;
                   }
                   return finalValue.toFixed(3);
               }
           } else if (columnIndex === 5) {
               // Opacity column - format to 1 decimal place (00.0)
               const numValue = parseFloat(value);
               if (!isNaN(numValue)) {
                   return numValue.toFixed(1);
               }
           } else if (columnIndex === 6) {
               // COF Kinetic column - format to 2 decimal places (0.00)
               const numValue = parseFloat(value);
               if (!isNaN(numValue)) {
                   // Convert integer values to decimal format (e.g., 42 -> 0.42, 0 -> 0.0)
                   let finalValue;
                   if (Number.isInteger(numValue)) {
                       // If it's an integer, convert to decimal by dividing by 100
                       finalValue = numValue / 100;
                   } else {
                       // If it already has decimal places, use as-is
                       finalValue = numValue;
                   }
                   
                   // Ensure value is between 0 and 0.99 (since we're dividing by 100)
                   if (finalValue < 0) {
                       finalValue = 0;
                   }
                   if (finalValue > 0.99) {
                       finalValue = 0.99;
                   }
                   
                   return finalValue.toFixed(2);
               }
           } else if (columnIndex === 7) {
               // Cut Width column - format to whole number (000)
               const numValue = parseFloat(value);
               if (!isNaN(numValue)) {
                   return Math.round(numValue).toString().padStart(3, '0');
               }
           } else if (columnIndex === 8 || columnIndex === 9) {
               // Color Delta columns - format to 2 decimal places (0.00)
               const numValue = parseFloat(value);
               if (!isNaN(numValue)) {
                   return numValue.toFixed(2);
               }
           }
           
           // Page 2 formatting
           } else if (tableBodyId === 'testingTableBody2') {
               // Elongation MD columns (columns 3, 4, 5) - format to 3 digits (000)
               if (columnIndex === 3 || columnIndex === 4 || columnIndex === 5) {
                   const numValue = parseInt(value);
                   if (!isNaN(numValue)) {
                       // Ensure the value is preserved exactly as entered (no truncation)
                       // Only pad with leading zeros if the value is less than 3 digits
                       if (numValue >= 100) {
                           return numValue.toString(); // Keep values like 550, 999 as-is
                       } else {
                           return numValue.toString().padStart(3, '0'); // Pad smaller values like 5 -> 005
                       }
                   }
               }
               // Force MD columns (columns 7, 8, 9) - format to 00.0
               else if (columnIndex === 7 || columnIndex === 8 || columnIndex === 9) {
                   const numValue = parseFloat(value);
                   if (!isNaN(numValue)) {
                       return numValue.toFixed(1);
                   }
               }
               // Force 5% MD columns (columns 11, 12, 13) - format to 0.0
               else if (columnIndex === 11 || columnIndex === 12 || columnIndex === 13) {
                   const numValue = parseFloat(value);
                   if (!isNaN(numValue)) {
                       return numValue.toFixed(1);
                   }
               }
           
           // Page 3 formatting
           } else if (tableBodyId === 'testingTableBody3') {
               // Elongation CD columns (columns 3, 4, 5) - format to 3 digits (000)
               if (columnIndex === 3 || columnIndex === 4 || columnIndex === 5) {
                   const numValue = parseInt(value);
                   if (!isNaN(numValue)) {
                       return numValue.toString().padStart(3, '0');
                   }
               }
               // Force CD columns (columns 7, 8, 9) - format to 00.0
               else if (columnIndex === 7 || columnIndex === 8 || columnIndex === 9) {
                   const numValue = parseFloat(value);
                   if (!isNaN(numValue)) {
                       return numValue.toFixed(1);
                   }
               }
               // Modulus columns (columns 11, 12, 13) - format to 00.0
               else if (columnIndex === 11 || columnIndex === 12 || columnIndex === 13) {
                   const numValue = parseFloat(value);
                   if (!isNaN(numValue)) {
                       return numValue.toFixed(1);
                   }
               }
           
           // Page 4 formatting
           } else if (tableBodyId === 'testingTableBody4') {
               // Color L column (column 3) - format to 00.00
               if (columnIndex === 3) {
                   const numValue = parseFloat(value);
                   if (!isNaN(numValue)) {
                       return numValue.toFixed(2);
                   }
               }
               // Color A column (column 4) - format to 00.00
               else if (columnIndex === 4) {
                   const numValue = parseFloat(value);
                   if (!isNaN(numValue)) {
                       return numValue.toFixed(2);
                   }
               }
               // Color B column (column 5) - format to 00.00
               else if (columnIndex === 5) {
                   const numValue = parseFloat(value);
                   if (!isNaN(numValue)) {
                       return numValue.toFixed(2);
                   }
               }
               // Color Delta E column (column 6) - format to 0.00
               else if (columnIndex === 6) {
                   const numValue = parseFloat(value);
                   if (!isNaN(numValue)) {
                       return numValue.toFixed(2);
                   }
               }
               // Gloss columns (columns 7, 8, 9) - format to 00.0
               else if (columnIndex === 7 || columnIndex === 8 || columnIndex === 9) {
                   const numValue = parseFloat(value);
                   if (!isNaN(numValue)) {
                       return numValue.toFixed(1);
                   }
               }
           // Page 5 formatting
           } else if (tableBodyId === 'testingTableBody5') {
               // PG Quality column (column 3) - format to integer (0 or 1)
               if (columnIndex === 3) {
                   const numValue = parseInt(value);
                   if (!isNaN(numValue)) {
                       return numValue.toString();
                   }
               }
           }
           
           // Return original value if no formatting applies
           return value;
       }
       
       // Generate unique lot number
       function generateLotNumber() {
           const timestamp = new Date().getTime();
           const random = Math.floor(Math.random() * 1000);
           return `LOT_${timestamp}_${random}`;
       }
       
       // Generate unique reference number
       function generateRefNumber() {
           const timestamp = new Date().getTime();
           const random = Math.floor(Math.random() * 1000);
           return `REF_${timestamp}_${random}`;
       }
       
       // Clear current form session (for new form)
       function clearFormSession() {
           currentFormId = null; // Clear UUID
           currentLotNo = null;
       }
       
       // ===== CELL HIGHLIGHTING FUNCTIONALITY =====
       
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
           } else {
               highlightedCell = null;
           }
       }
       
       // Function to add click highlighting to all cells (excluding summary rows)
       function addCellHighlighting() {
           const allTables = [testingTableBody, testingTableBody2, testingTableBody3, testingTableBody4];
           
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
                           if (viewMode) {
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
           const allTables = [testingTableBody, testingTableBody2, testingTableBody3, testingTableBody4];
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
               if (tableBody.id === 'testingTableBody') return 7;       // Page 1: 7 columns (3 Sample No + 4 data columns)
               if (tableBody.id === 'testingTableBody2') return 15;     // Page 2: 15 columns  
               if (tableBody.id === 'testingTableBody3') return 15;     // Page 3: 15 columns
               if (tableBody.id === 'testingTableBody4') return 11;     // Page 4: 11 columns (3 for Sample No + 4 Color + 4 Gloss columns)
               if (tableBody.id === 'testingTableBody5') return 5;      // Page 5: 5 columns (3 for Sample No + 1 PG Quality + 1 blank column)
               return 7; // Default fallback
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
                   
                   const enterTable = currentCell.closest('tbody');
                   const tableId = enterTable.id;
                   
                   // Check for special horizontal navigation in Page 2 & 3 & 4
                   // Page 2 (testingTableBody2) and Page 3 (testingTableBody3)
                   // Subgroups: 
                   // 1. Elongation: cols 3, 4, 5 (indices)
                   // 2. Force: cols 7, 8, 9 (indices)
                   // 3. Force 5% / Modulus: cols 11, 12, 13 (indices)
                   // Page 4 (testingTableBody4)
                   // 1. Gloss: cols 7, 8, 9 (indices)
                   
                   const cellIndex = currentCell.cellIndex;
                   const isSpecialTable = (tableId === 'testingTableBody2' || tableId === 'testingTableBody3');
                   const isPage4 = (tableId === 'testingTableBody4');
                   
                   let isSpecialColumn = false;
                   let groupStart = 0;
                   let groupEnd = 0;
                   
                   if (isSpecialTable) {
                       if (cellIndex >= 3 && cellIndex <= 5) {
                           isSpecialColumn = true;
                           groupStart = 3;
                           groupEnd = 5;
                       } else if (cellIndex >= 7 && cellIndex <= 9) {
                           isSpecialColumn = true;
                           groupStart = 7;
                           groupEnd = 9;
                       } else if (cellIndex >= 11 && cellIndex <= 13) {
                           isSpecialColumn = true;
                           groupStart = 11;
                           groupEnd = 13;
                       }
                   } else if (isPage4) {
                       if (cellIndex >= 7 && cellIndex <= 9) {
                           isSpecialColumn = true;
                           groupStart = 7;
                           groupEnd = 9;
                       }
                   }

                   
                   if (isSpecialColumn) {
                       // Horizontal navigation logic within the subgroup
                       if (cellIndex < groupEnd) {
                           // Move to next column in same row
                           const currentRow = currentCell.closest('tr');
                           const nextColCell = currentRow.cells[cellIndex + 1];
                           if (nextColCell) {
                               nextCell = nextColCell;
                           }
                       } else {
                           // Move to first column of group in next row
                           const currentRow = currentCell.closest('tr');
                           const nextRow = currentRow.nextElementSibling;
                           
                           // Check if next row exists and is not a summary row
                           if (nextRow) {
                               const firstCell = nextRow.querySelector('td');
                               const isSummary = firstCell && ['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
                               
                               if (!isSummary) {
                                   const nextRowCell = nextRow.cells[groupStart];
                                   if (nextRowCell) {
                                       nextCell = nextRowCell;
                                   }
                               }
                           }
                       }
                   } else {
                       // Default vertical navigation behavior
                       // Move to cell below (next row) but stay within current page
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
                       handleKeyboardNavigation(e, cell);
                   });
               }
           });
       }
       
        // Debounced save timeout management
        // let saveTimeout = null; // Moved to line 1352

    // Update row count for Page 1
    // Get current data row count (excluding summary rows)
    function getCurrentDataRowCount(tableBody) {
        if (!tableBody) return 0;
        const dataRows = tableBody.querySelectorAll('tr').length - 3; // Subtract 3 for summary rows
        return Math.max(0, dataRows);
    }
    
    // Get current data row count for all tables
    const getAllTableRowCounts = () => {
        return getAllTableBodies().map(tableBody => getCurrentDataRowCount(tableBody));
    };

    // Update row count for Page 1 (original function)
    function updateRowCount() {
        const dataRows = getCurrentDataRowCount(testingTableBody);
        rowCountDisplay.textContent = `Rows: ${dataRows}`;
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
        for (let i = 1; i <= 4; i++) {
            updateRowCountByPage(i);
        }
    }

         // Load data from database when page loads (optimized for speed)
         async function loadDataFromDatabase() {
             try {
                 // Check if we have a current form session
                 if (currentFormId) {
                     // Load form data directly - no timeout needed
                     const { data, error } = await supabase
                         .from('168_16c_white')
                         .select('*')
                         .eq('form_id', currentFormId)
                         .single();
                     
                     if (error) {
                         // Mark initial loading as complete even if no data found
                         isInitialLoading = false;
                         return;
                     }
                     
                     if (data) {
                         // Set session variables from loaded data
                         currentFormId = data.form_id;
                         currentLotNo = data.lot_no;
                         loadTableDataFromDatabase(data);
                         
                         // Load equipment selections AFTER dropdowns are populated
                         setTimeout(() => {
                             loadEquipmentSelections(data);
                             // Update equipment dropdown styling after data is loaded
                             updateEquipmentDropdownStyling();
                         }, 500);
                         
                         loadPreStoreData(data);
                     }
                     
                     // Mark initial loading as complete
                     isInitialLoading = false;
                } else {
                    // No current form ID (new form), load historical data if available
                    await loadHistoricalDataForNewForm();
                    isInitialLoading = false;
                }
             } catch (error) {
                 console.error('Error loading data from database:', error);
             }
        }

        // Load historical data for new forms based on product_code + machine_no + production_date
        async function loadHistoricalDataForNewForm() {
            try {
                // Get current form details
                const productCode = productCodeInput ? productCodeInput.value.trim() : '';
                const machineNo = machineInput ? machineInput.value.trim() : '';
                const productionDate = productionDateInput ? productionDateInput.value : '';


                // Only proceed if we have the required criteria
                if (!productCode || !machineNo || !productionDate) {
                    return;
                }

                // Calculate previous date
                const currentDate = new Date(productionDate);
                const previousDate = new Date(currentDate);
                previousDate.setDate(previousDate.getDate() - 1);
                const previousDateStr = previousDate.toISOString().split('T')[0];


                // Search for previous form with matching criteria
                console.log('Searching for historical data:', { productCode, machineNo, previousDateStr });
                
                const { data: historicalData, error } = await supabase
                    .from('168_16c_white')
                    .select('*')
                    .eq('product_code', productCode)
                    .eq('machine_no', machineNo)
                    .eq('production_date', previousDateStr)
                    .order('created_at', { ascending: false })
                    .limit(1);
                
                if (error) {
                    console.error('Error fetching historical data:', error);
                }

                if (error || !historicalData || historicalData.length === 0) {
                    
                    // If no data for previous date, show alert
                    console.log('No historical data found for previous date:', previousDateStr);
                    const formattedPreviousDate = formatDateToDDMMYYYY(previousDateStr);
                    showToast(`No historical data found for previous date: ${formattedPreviousDate}`, 'warning');
                    return;
                } else {
                    // Load previous day's data
                    await loadHistoricalDataIntoForm(historicalData[0]);
                }

            } catch (error) {
                console.error('Error loading historical data:', error);
            }
        }

        // Load historical data into form with dynamic row allocation
        async function loadHistoricalDataIntoForm(historicalData) {
            try {

                // Get requested rows for fresh data (from user input)
                const requestedRows = parseInt(numRowsInput.value, 10) || 12;
                const availableForHistorical = 30 - requestedRows;
                

                // Load historical data into top rows (1 to availableForHistorical)
                loadHistoricalDataIntoTopRows(historicalData, availableForHistorical);
                
                // Clear bottom rows for fresh data entry
                clearBottomRowsForFreshData(requestedRows);

                // Calculate statistics immediately after loading historical data
                calculatePage1ColumnStats(testingTableBody);
                calculateSummaryStatistics(testingTableBody2);
                calculateSummaryStatistics(testingTableBody3);
                calculateSummaryStatistics(testingTableBody4);
                // Page 5: No statistics calculation needed (PG Quality uses dashes)
                recalculateAllRowAverages();
                forceRecalculateAllSummaryStatistics();

                // Auto-save the form with historical data loaded
                await autoSaveToDatabase();

            } catch (error) {
                console.error('Error loading historical data into form:', error);
            }
        }

        // Ensure 30 rows exist (like clicking the + button)
        async function ensure30RowsExist() {
            try {
                // Get current row count (excluding summary rows)
                const currentRows = getCurrentDataRowCount(testingTableBody);
                
                // Calculate how many rows to add to reach 30 total
                const rowsToAdd = 30 - currentRows;
                
                // Only add rows if we haven't reached 30 rows yet
                if (rowsToAdd > 0) {
                    
                    // Add rows to all tables to reach 30 total
                    addRowsToTable(testingTableBody, rowsToAdd);
                    addRowsToTable(testingTableBody2, rowsToAdd);
                    addRowsToTable(testingTableBody3, rowsToAdd);
                    addRowsToTable(testingTableBody4, rowsToAdd);
                    addRowsToTable(testingTableBody5, rowsToAdd);
                    
                    // Update row counts
                    updateRowCount();
                    updateAllRowCounts();
                }
            } catch (error) {
                console.error('Error ensuring 30 rows exist:', error);
            }
        }

        // Load historical data into top rows
        function loadHistoricalDataIntoTopRows(historicalData, availableForHistorical) {
            // Load historical data into top rows (1 to availableForHistorical)
            // This loads from rows (requestedRows+1) to 30 from historical form
            
            const requestedRows = 30 - availableForHistorical;
            const startFromRow = requestedRows + 1;
            

            // Load data into Page 1 (testingTableBody)
            loadHistoricalDataIntoTable(testingTableBody, historicalData, 1, availableForHistorical, startFromRow);
            
            // Load data into Page 2 (testingTableBody2)
            loadHistoricalDataIntoTable(testingTableBody2, historicalData, 1, availableForHistorical, startFromRow);
            
            // Load data into Page 3 (testingTableBody3)
            loadHistoricalDataIntoTable(testingTableBody3, historicalData, 1, availableForHistorical, startFromRow);
            
            // Load data into Page 4 (testingTableBody4)
            loadHistoricalDataIntoTable(testingTableBody4, historicalData, 1, availableForHistorical, startFromRow);
            
            // Load data into Page 5 (testingTableBody5)
            loadHistoricalDataIntoTable(testingTableBody5, historicalData, 1, availableForHistorical, startFromRow);
        }

        // Load historical data into specific table
        function loadHistoricalDataIntoTable(tableBody, historicalData, startRow, endRow, historicalStartRow) {
            if (!tableBody || !historicalData) return;

            const rows = Array.from(tableBody.querySelectorAll('tr'));
            let currentRow = startRow;
            let historicalRow = historicalStartRow;

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
        }

        // Load historical data for a specific row
        function loadHistoricalRowData(row, historicalData, historicalRow) {
            if (!row || !historicalData) return;

            const inputs = row.querySelectorAll('input');
            const rowKey = String(historicalRow);

            // Load data based on table type
            if (row.closest('#testingTableBody')) {
                // Page 1 data
                if (historicalData.lot_and_roll && historicalData.lot_and_roll[rowKey] && inputs[0]) {
                    inputs[0].value = historicalData.lot_and_roll[rowKey];
                }
                if (historicalData.roll_id && historicalData.roll_id[rowKey] && inputs[1]) {
                    inputs[1].value = historicalData.roll_id[rowKey];
                }
                if (historicalData.lot_time && historicalData.lot_time[rowKey] && inputs[2]) {
                    inputs[2].value = historicalData.lot_time[rowKey];
                }
                // Load Page 1 data with conditional formatting
                const page1Data = [
                    { key: 'page1_basis_weight', inputIndex: 3, columnType: 'basicWeight' },
                    { key: 'page1_thickness', inputIndex: 4, columnType: 'thickness' },
                    { key: 'page1_opacity', inputIndex: 5, columnType: 'opacity' },
                    { key: 'page1_cof_kinetic', inputIndex: 6, columnType: 'cof' }
                ];
                
                page1Data.forEach(({ key, inputIndex, columnType }) => {
                    if (historicalData[key] && historicalData[key][rowKey] && inputs[inputIndex]) {
                        inputs[inputIndex].value = historicalData[key][rowKey];
                        applyColorFormatting(inputs[inputIndex], columnType);
                    }
                });
            } else if (row.closest('#testingTableBody2')) {
                // Page 2 data - Load lot_and_roll, roll_id, lot_time for all pages
                if (historicalData.lot_and_roll && historicalData.lot_and_roll[rowKey] && inputs[0]) {
                    inputs[0].value = historicalData.lot_and_roll[rowKey];
                }
                if (historicalData.roll_id && historicalData.roll_id[rowKey] && inputs[1]) {
                    inputs[1].value = historicalData.roll_id[rowKey];
                }
                if (historicalData.lot_time && historicalData.lot_time[rowKey] && inputs[2]) {
                    inputs[2].value = historicalData.lot_time[rowKey];
                }
                // Page 2 specific data - Correct input indices based on HTML structure
                // HTML columns: 0(Sample No), 1(Roll ID), 2(Lot Time), 3(Elongation1), 4(Elongation2), 5(Elongation3), 6(ElongationAve), 7(Force1), 8(Force2), 9(Force3), 10(ForceAve), 11(Force5%1), 12(Force5%2), 13(Force5%3), 14(Force5%Ave)
                if (historicalData.page2_elongation_md_1 && historicalData.page2_elongation_md_1[rowKey] && inputs[3]) {
                    inputs[3].value = historicalData.page2_elongation_md_1[rowKey];
                }
                if (historicalData.page2_elongation_md_2 && historicalData.page2_elongation_md_2[rowKey] && inputs[4]) {
                    inputs[4].value = historicalData.page2_elongation_md_2[rowKey];
                }
                if (historicalData.page2_elongation_md_3 && historicalData.page2_elongation_md_3[rowKey] && inputs[5]) {
                    inputs[5].value = historicalData.page2_elongation_md_3[rowKey];
                }
                if (historicalData.page2_force_md_1 && historicalData.page2_force_md_1[rowKey] && inputs[7]) {
                    inputs[7].value = historicalData.page2_force_md_1[rowKey];
                }
                if (historicalData.page2_force_md_2 && historicalData.page2_force_md_2[rowKey] && inputs[8]) {
                    inputs[8].value = historicalData.page2_force_md_2[rowKey];
                }
                if (historicalData.page2_force_md_3 && historicalData.page2_force_md_3[rowKey] && inputs[9]) {
                    inputs[9].value = historicalData.page2_force_md_3[rowKey];
                }
                if (historicalData.page2_force_5p_md_1 && historicalData.page2_force_5p_md_1[rowKey] && inputs[11]) {
                    inputs[11].value = historicalData.page2_force_5p_md_1[rowKey];
                }
                if (historicalData.page2_force_5p_md_2 && historicalData.page2_force_5p_md_2[rowKey] && inputs[12]) {
                    inputs[12].value = historicalData.page2_force_5p_md_2[rowKey];
                }
                if (historicalData.page2_force_5p_md_3 && historicalData.page2_force_5p_md_3[rowKey] && inputs[13]) {
                    inputs[13].value = historicalData.page2_force_5p_md_3[rowKey];
                }
            } else if (row.closest('#testingTableBody3')) {
                // Page 3 data - Load lot_and_roll, roll_id, lot_time for all pages
                if (historicalData.lot_and_roll && historicalData.lot_and_roll[rowKey] && inputs[0]) {
                    inputs[0].value = historicalData.lot_and_roll[rowKey];
                }
                if (historicalData.roll_id && historicalData.roll_id[rowKey] && inputs[1]) {
                    inputs[1].value = historicalData.roll_id[rowKey];
                }
                if (historicalData.lot_time && historicalData.lot_time[rowKey] && inputs[2]) {
                    inputs[2].value = historicalData.lot_time[rowKey];
                }
                // Page 3 specific data - Correct input indices based on HTML structure
                // HTML columns: 0(Sample No), 1(Roll ID), 2(Lot Time), 3(Elongation1), 4(Elongation2), 5(Elongation3), 6(ElongationAve), 7(Force1), 8(Force2), 9(Force3), 10(ForceAve), 11(Modulus1), 12(Modulus2), 13(Modulus3), 14(ModulusAve)
                if (historicalData.page3_elongation_cd_1 && historicalData.page3_elongation_cd_1[rowKey] && inputs[3]) {
                    inputs[3].value = historicalData.page3_elongation_cd_1[rowKey];
                }
                if (historicalData.page3_elongation_cd_2 && historicalData.page3_elongation_cd_2[rowKey] && inputs[4]) {
                    inputs[4].value = historicalData.page3_elongation_cd_2[rowKey];
                }
                if (historicalData.page3_elongation_cd_3 && historicalData.page3_elongation_cd_3[rowKey] && inputs[5]) {
                    inputs[5].value = historicalData.page3_elongation_cd_3[rowKey];
                }
                if (historicalData.page3_force_cd_1 && historicalData.page3_force_cd_1[rowKey] && inputs[7]) {
                    inputs[7].value = historicalData.page3_force_cd_1[rowKey];
                }
                if (historicalData.page3_force_cd_2 && historicalData.page3_force_cd_2[rowKey] && inputs[8]) {
                    inputs[8].value = historicalData.page3_force_cd_2[rowKey];
                }
                if (historicalData.page3_force_cd_3 && historicalData.page3_force_cd_3[rowKey] && inputs[9]) {
                    inputs[9].value = historicalData.page3_force_cd_3[rowKey];
                }
                if (historicalData.page3_modulus_1 && historicalData.page3_modulus_1[rowKey] && inputs[11]) {
                    inputs[11].value = historicalData.page3_modulus_1[rowKey];
                }
                if (historicalData.page3_modulus_2 && historicalData.page3_modulus_2[rowKey] && inputs[12]) {
                    inputs[12].value = historicalData.page3_modulus_2[rowKey];
                }
                if (historicalData.page3_modulus_3 && historicalData.page3_modulus_3[rowKey] && inputs[13]) {
                    inputs[13].value = historicalData.page3_modulus_3[rowKey];
                }
            } else if (row.closest('#testingTableBody4')) {
                // Page 4 data - Load lot_and_roll, roll_id, lot_time for all pages
                if (historicalData.lot_and_roll && historicalData.lot_and_roll[rowKey] && inputs[0]) {
                    inputs[0].value = historicalData.lot_and_roll[rowKey];
                }
                if (historicalData.roll_id && historicalData.roll_id[rowKey] && inputs[1]) {
                    inputs[1].value = historicalData.roll_id[rowKey];
                }
                if (historicalData.lot_time && historicalData.lot_time[rowKey] && inputs[2]) {
                    inputs[2].value = historicalData.lot_time[rowKey];
                }
                // Page 4 specific data - Correct input indices based on HTML structure
                // HTML columns: 0(Sample No), 1(Roll ID), 2(Lot Time), 3(Color L), 4(Color A), 5(Color B), 6(Color Delta E), 7(Gloss1), 8(Gloss2), 9(Gloss3), 10(GlossAve)
                if (historicalData.page4_color_l && historicalData.page4_color_l[rowKey] && inputs[3]) {
                    inputs[3].value = historicalData.page4_color_l[rowKey];
                }
                if (historicalData.page4_color_a && historicalData.page4_color_a[rowKey] && inputs[4]) {
                    inputs[4].value = historicalData.page4_color_a[rowKey];
                }
                if (historicalData.page4_color_b && historicalData.page4_color_b[rowKey] && inputs[5]) {
                    inputs[5].value = historicalData.page4_color_b[rowKey];
                }
                if (historicalData.page4_color_delta_e && historicalData.page4_color_delta_e[rowKey] && inputs[6]) {
                    inputs[6].value = historicalData.page4_color_delta_e[rowKey];
                }
                if (historicalData.page4_gloss_1 && historicalData.page4_gloss_1[rowKey] && inputs[7]) {
                    inputs[7].value = historicalData.page4_gloss_1[rowKey];
                }
                if (historicalData.page4_gloss_2 && historicalData.page4_gloss_2[rowKey] && inputs[8]) {
                    inputs[8].value = historicalData.page4_gloss_2[rowKey];
                }
                if (historicalData.page4_gloss_3 && historicalData.page4_gloss_3[rowKey] && inputs[9]) {
                    inputs[9].value = historicalData.page4_gloss_3[rowKey];
                }
            } else if (row.closest('#testingTableBody5')) {
                // Page 5 data - Load lot_and_roll, roll_id, lot_time for all pages
                if (historicalData.lot_and_roll && historicalData.lot_and_roll[rowKey] && inputs[0]) {
                    inputs[0].value = historicalData.lot_and_roll[rowKey];
                }
                if (historicalData.roll_id && historicalData.roll_id[rowKey] && inputs[1]) {
                    inputs[1].value = historicalData.roll_id[rowKey];
                }
                if (historicalData.lot_time && historicalData.lot_time[rowKey] && inputs[2]) {
                    inputs[2].value = historicalData.lot_time[rowKey];
                }
                // Page 5 specific data - Correct input indices based on HTML structure
                // HTML columns: 0(Sample No), 1(Roll ID), 2(Lot Time), 3(PG Quality), 4(Blank)
                if (historicalData.page5_pg_quality && historicalData.page5_pg_quality[rowKey] && inputs[3]) {
                    inputs[3].value = historicalData.page5_pg_quality[rowKey];
                }
            }
        }

        // Clear bottom rows for fresh data entry
        function clearBottomRowsForFreshData(requestedRows) {
            const startRow = 30 - requestedRows + 1;
            const endRow = 30;


            // Clear data in all tables for bottom rows
            clearBottomRowsInTable(testingTableBody, startRow, endRow);
            clearBottomRowsInTable(testingTableBody2, startRow, endRow);
            clearBottomRowsInTable(testingTableBody3, startRow, endRow);
            clearBottomRowsInTable(testingTableBody4, startRow, endRow);
        }

        // Clear bottom rows in specific table
        function clearBottomRowsInTable(tableBody, startRow, endRow) {
            if (!tableBody) return;

            const rows = Array.from(tableBody.querySelectorAll('tr'));
            let currentRow = 1;

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const firstCell = row.querySelector('td');
                
                // Skip summary rows
                if (firstCell && ['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim())) {
                    continue;
                }

                // Clear data in bottom rows
                if (currentRow >= startRow && currentRow <= endRow) {
                    const inputs = row.querySelectorAll('input');
                    inputs.forEach(input => {
                        if (input.type !== 'number' || input.placeholder !== '') {
                            input.value = '';
                        }
                    });
                }

                currentRow++;
            }
        }
        
        // Load table data from database into the form
         function loadTableDataFromDatabase(dbData) {
             // Load header data
             if (dbData.product_code && productCodeInput) productCodeInput.value = dbData.product_code;
             if (dbData.production_order && productionOrderInput) productionOrderInput.value = dbData.production_order;
             if (dbData.machine_no && machineInput) machineInput.value = dbData.machine_no;
             if (dbData.production_date && productionDateInput) {
                 // Convert ISO date to yyyy-MM-dd format for HTML date input
                 const date = new Date(dbData.production_date);
                 const formattedDate = date.toISOString().split('T')[0]; // yyyy-MM-dd format
                 productionDateInput.value = formattedDate;
             }
             if (dbData.specification && specificationInput) specificationInput.value = dbData.specification;
             if (dbData.purchase_order && poInput) poInput.value = dbData.purchase_order;
             if (dbData.quantity && quantityInput) quantityInput.value = dbData.quantity;
             if (dbData.inspection_date && inspectionDateInput) {
                 // Convert ISO date to yyyy-MM-dd format for HTML date input
                 const date = new Date(dbData.inspection_date);
                 const formattedDate = date.toISOString().split('T')[0]; // yyyy-MM-dd format
                 inspectionDateInput.value = formattedDate;
             }
             
             // Load Sample Identification data (the 3 columns under Sample No. header)
             if (dbData.lot_and_roll) loadColumnDataToTable(testingTableBody, 0, dbData.lot_and_roll);
             if (dbData.roll_id) loadColumnDataToTable(testingTableBody, 1, dbData.roll_id);
             if (dbData.lot_time) loadColumnDataToTable(testingTableBody, 2, dbData.lot_time);
             
             // Load Page 1 data
             if (dbData.page1_basis_weight) loadColumnDataToTable(testingTableBody, 3, dbData.page1_basis_weight);
             if (dbData.page1_thickness) loadColumnDataToTable(testingTableBody, 4, dbData.page1_thickness);
             if (dbData.page1_opacity) loadColumnDataToTable(testingTableBody, 5, dbData.page1_opacity);
             if (dbData.page1_cof_kinetic) loadColumnDataToTable(testingTableBody, 6, dbData.page1_cof_kinetic);
             
             // Load Page 2 data
             if (dbData.page2_elongation_md_1) loadColumnDataToTable(testingTableBody2, 3, dbData.page2_elongation_md_1);
             if (dbData.page2_elongation_md_2) loadColumnDataToTable(testingTableBody2, 4, dbData.page2_elongation_md_2);
             if (dbData.page2_elongation_md_3) loadColumnDataToTable(testingTableBody2, 5, dbData.page2_elongation_md_3);
             if (dbData.page2_force_md_1) loadColumnDataToTable(testingTableBody2, 7, dbData.page2_force_md_1);
             if (dbData.page2_force_md_2) loadColumnDataToTable(testingTableBody2, 8, dbData.page2_force_md_2);
             if (dbData.page2_force_md_3) loadColumnDataToTable(testingTableBody2, 9, dbData.page2_force_md_3);
             if (dbData.page2_force_5p_md_1) loadColumnDataToTable(testingTableBody2, 11, dbData.page2_force_5p_md_1);
             if (dbData.page2_force_5p_md_2) loadColumnDataToTable(testingTableBody2, 12, dbData.page2_force_5p_md_2);
             if (dbData.page2_force_5p_md_3) loadColumnDataToTable(testingTableBody2, 13, dbData.page2_force_5p_md_3);
             
             // Load Page 3 data
             if (dbData.page3_elongation_cd_1) loadColumnDataToTable(testingTableBody3, 3, dbData.page3_elongation_cd_1);
             if (dbData.page3_elongation_cd_2) loadColumnDataToTable(testingTableBody3, 4, dbData.page3_elongation_cd_2);
             if (dbData.page3_elongation_cd_3) loadColumnDataToTable(testingTableBody3, 5, dbData.page3_elongation_cd_3);
             if (dbData.page3_force_cd_1) loadColumnDataToTable(testingTableBody3, 7, dbData.page3_force_cd_1);
             if (dbData.page3_force_cd_2) loadColumnDataToTable(testingTableBody3, 8, dbData.page3_force_cd_2);
             if (dbData.page3_force_cd_3) loadColumnDataToTable(testingTableBody3, 9, dbData.page3_force_cd_3);
             if (dbData.page3_modulus_1) loadColumnDataToTable(testingTableBody3, 11, dbData.page3_modulus_1);
             if (dbData.page3_modulus_2) loadColumnDataToTable(testingTableBody3, 12, dbData.page3_modulus_2);
             if (dbData.page3_modulus_3) loadColumnDataToTable(testingTableBody3, 13, dbData.page3_modulus_3);
             
             // Load Page 4 data
             if (dbData.page4_color_l) loadColumnDataToTable(testingTableBody4, 3, dbData.page4_color_l);
             if (dbData.page4_color_a) loadColumnDataToTable(testingTableBody4, 4, dbData.page4_color_a);
             if (dbData.page4_color_b) loadColumnDataToTable(testingTableBody4, 5, dbData.page4_color_b);
             if (dbData.page4_color_delta_e) loadColumnDataToTable(testingTableBody4, 6, dbData.page4_color_delta_e);
             if (dbData.page4_gloss_1) loadColumnDataToTable(testingTableBody4, 7, dbData.page4_gloss_1);
             if (dbData.page4_gloss_2) loadColumnDataToTable(testingTableBody4, 8, dbData.page4_gloss_2);
             if (dbData.page4_gloss_3) loadColumnDataToTable(testingTableBody4, 9, dbData.page4_gloss_3);
             
             // Load Page 5 data
             if (dbData.page5_pg_quality) loadColumnDataToTable(testingTableBody5, 3, dbData.page5_pg_quality);
             
             // Populate Sample Identification columns across ALL pages (Page 1 editable, others uneditable)
             populateSampleColumnsAcrossAllPages(dbData);
             
             // Add real-time sync listeners to Page 1 sample columns
             addRealTimeSyncListeners();
             
             // Update row counts and recalculate statistics
             updateRowCount();
             updateAllRowCounts();
             
             // Calculate statistics immediately - no delay needed
             calculatePage1ColumnStats(testingTableBody);
             calculateSummaryStatistics(testingTableBody2);
             calculateSummaryStatistics(testingTableBody3);
             calculateSummaryStatistics(testingTableBody4);
             // Page 5: No statistics calculation needed (PG Quality uses dashes)
             
             // Recalculate ALL row averages for Pages 2, 3, 4 after data loads
             recalculateAllRowAverages();
             
             // Force recalculation of summary statistics to populate Average/Min/Max rows
             forceRecalculateAllSummaryStatistics();
             
             // Ensure all summary rows remain uneditable after data loads
             makeSummaryRowsUneditable();
             

         }
         
         // Load pre-store data into view fields
         function loadPreStoreData(dbData) {
             try {
                 // Load basic information fields
                 if (dbData.production_order) {
                     const element = document.getElementById('view-production-order');
                     if (element) element.textContent = dbData.production_order;
                 }
                 
                 if (dbData.product_code) {
                     const element = document.getElementById('view-product-code');
                     if (element) element.textContent = dbData.product_code;
                 }
                 
                 if (dbData.specification) {
                     const element = document.getElementById('view-specification');
                     if (element) element.textContent = dbData.specification;
                 }
                 
                 if (dbData.pallet_size) {
                     const element = document.getElementById('view-pallet-size');
                     if (element) element.textContent = dbData.pallet_size;
                 }
                 
                 if (dbData.customer) {
                     const element = document.getElementById('view-customer');
                     if (element) element.textContent = dbData.customer;
                 }
                 
                 if (dbData.location) {
                     const element = document.getElementById('view-location');
                     if (element) element.textContent = dbData.location;
                 }
                 
                 if (dbData.machine_no) {
                     const element = document.getElementById('view-machine-no');
                     if (element) element.textContent = dbData.machine_no;
                 }
                 
                 if (dbData.quantity) {
                     const element = document.getElementById('view-quantity');
                     if (element) element.textContent = dbData.quantity;
                 }
                 
                 if (dbData.production_date) {
                     const element = document.getElementById('view-production-date');
                     if (element) element.textContent = new Date(dbData.production_date).toLocaleDateString('en-GB');
                 }
                 
                 if (dbData.inspection_date) {
                     const element = document.getElementById('view-inspection-date');
                     if (element) element.textContent = new Date(dbData.inspection_date).toLocaleDateString('en-GB');
                 }
                 
                 if (dbData.standard_packing) {
                     const element = document.getElementById('view-standard-packing');
                     if (element) element.textContent = dbData.standard_packing;
                 }
                 
                 if (dbData.batch) {
                     const element = document.getElementById('view-batch');
                     if (element) element.textContent = dbData.batch;
                 }
                 
                 if (dbData.ref_no) {
                     const element = document.getElementById('view-ref-no');
                     if (element) element.textContent = dbData.ref_no;
                 }
                 
                 if (dbData.prestore_done_by) {
                     const element = document.getElementById('view-prestore-done-by');
                     if (element) element.textContent = dbData.prestore_done_by;
                 }
                 
                 // Load palletized finished goods status
                 if (dbData.pallet_list) {
                     const element = document.getElementById('view-pallet-list');
                     if (element) {
                         element.textContent = dbData.pallet_list;
                         applyStatusStyling(element, dbData.pallet_list);
                     }
                 }
                 
                 if (dbData.product_label) {
                     const element = document.getElementById('view-product-label');
                     if (element) {
                         element.textContent = dbData.product_label;
                         applyStatusStyling(element, dbData.product_label);
                     }
                 }
                 
                 if (dbData.wrapping) {
                     const element = document.getElementById('view-wrapping');
                     if (element) {
                         element.textContent = dbData.wrapping;
                         applyStatusStyling(element, dbData.wrapping);
                     }
                 }
                 
                 if (dbData.layer_pad) {
                     const element = document.getElementById('view-layer-pad');
                     if (element) {
                         element.textContent = dbData.layer_pad;
                         applyStatusStyling(element, dbData.layer_pad);
                     }
                 }
                 
                 if (dbData.contamination) {
                     const element = document.getElementById('view-contamination');
                     if (element) {
                         element.textContent = dbData.contamination;
                         applyStatusStyling(element, dbData.contamination);
                     }
                 }
                 
                 if (dbData.kraft_paper) {
                     const element = document.getElementById('view-kraft-paper');
                     if (element) {
                         element.textContent = dbData.kraft_paper;
                         applyStatusStyling(element, dbData.kraft_paper);
                     }
                 }
                 
                 if (dbData.no_damage) {
                     const element = document.getElementById('view-no-damage');
                     if (element) {
                         element.textContent = dbData.no_damage;
                         applyStatusStyling(element, dbData.no_damage);
                     }
                 }
                 
                 if (dbData.pallet) {
                     const element = document.getElementById('view-pallet');
                     if (element) {
                         element.textContent = dbData.pallet;
                         applyStatusStyling(element, dbData.pallet);
                     }
                 }
                 
                 // Load remarks
                 if (dbData.remarks) {
                     const element = document.getElementById('view-remarks');
                     if (element) element.textContent = dbData.remarks;
                 }
                 
             } catch (error) {
                 console.error('Error loading pre-store data:', error);
             }
         }
         
         // Function to apply colored background styling to status values
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
         
         // Function to populate Sample Identification columns across ALL pages (Page 1 editable, others uneditable)
        function populateSampleColumnsAcrossAllPages(dbData) {
            // Get all table bodies
            const allTableBodies = [testingTableBody, testingTableBody2, testingTableBody3, testingTableBody4, testingTableBody5];
             
             allTableBodies.forEach((tableBody, tableIndex) => {
                 // Get data rows (excluding summary rows)
                 const dataRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
                     const firstCell = row.querySelector('td');
                     return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
                 });
                 
                 // Populate Sample Identification columns for each row
                 dataRows.forEach((row, rowIndex) => {
                     const inputs = row.querySelectorAll('input');
                     
                     // Column 0: Lot & Roll
                     if (inputs[0] && dbData.lot_and_roll && dbData.lot_and_roll[String(rowIndex + 1)]) {
                         inputs[0].value = dbData.lot_and_roll[String(rowIndex + 1)];
                         
                         // Only make uneditable for Pages 2, 3, 4, 5 (keep Page 1 editable)
                         if (tableIndex > 0) { // tableIndex 0 = Page 1, 1+ = Pages 2,3,4,5
                             inputs[0].readOnly = true; // Make uneditable
                             inputs[0].style.backgroundColor = 'transparent'; // Normal transparent background
                             inputs[0].style.color = '#000000'; // Normal black text
                         }
                     }
                     
                     // Column 1: Roll ID
                     if (inputs[1] && dbData.roll_id && dbData.roll_id[String(rowIndex + 1)]) {
                         inputs[1].value = dbData.roll_id[String(rowIndex + 1)];
                         
                         // Only make uneditable for Pages 2, 3, 4, 5 (keep Page 1 editable)
                         if (tableIndex > 0) { // tableIndex 0 = Page 1, 1+ = Pages 2,3,4,5
                             inputs[1].readOnly = true; // Make uneditable
                             inputs[1].style.backgroundColor = 'transparent'; // Normal transparent background
                             inputs[1].style.color = '#000000'; // Normal black text
                         }
                     }
                     
                     // Column 2: Lot Time
                     if (inputs[2] && dbData.lot_time && dbData.lot_time[String(rowIndex + 1)]) {
                         inputs[2].value = dbData.lot_time[String(rowIndex + 1)];
                         
                         // Only make uneditable for Pages 2, 3, 4, 5 (keep Page 1 editable)
                         if (tableIndex > 0) { // tableIndex 0 = Page 1, 1+ = Pages 2,3,4,5
                             inputs[2].readOnly = true; // Make uneditable
                             inputs[2].style.backgroundColor = 'transparent'; // Normal transparent background
                             inputs[2].style.color = '#000000'; // Normal black text
                         }
                     }
                 });
             });
         }
         
         // Function to sync sample data changes from Page 1 to all other pages in real-time
        function syncSampleDataToOtherPages(rowIndex, columnIndex, newValue) {
            // Get other table bodies (Pages 2, 3, 4, 5)
            const otherTableBodies = [testingTableBody2, testingTableBody3, testingTableBody4, testingTableBody5];
             
             otherTableBodies.forEach(tableBody => {
                 // Get data rows (excluding summary rows)
                 const dataRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
                     const firstCell = row.querySelector('td');
                     return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
                 });
                 
                 // Update the corresponding row and column
                 if (dataRows[rowIndex]) {
                     const inputs = dataRows[rowIndex].querySelectorAll('input');
                     if (inputs[columnIndex]) {
                         inputs[columnIndex].value = newValue;
                     }
                 }
             });
         }
         
         // Function to add real-time sync event listeners to Page 1 sample columns
         function addRealTimeSyncListeners() {
             // Get data rows from Page 1 (excluding summary rows)
             const dataRows = Array.from(testingTableBody.querySelectorAll('tr')).filter(row => {
                 const firstCell = row.querySelector('td');
                 return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
             });
             
             // Add event listeners to sample identification columns (0, 1, 2)
             dataRows.forEach((row, rowIndex) => {
                 const inputs = row.querySelectorAll('input');
                 
                 // Add listeners to first 3 columns (sample identification)
                 for (let colIndex = 0; colIndex < 3; colIndex++) {
                     if (inputs[colIndex]) {
                         // Remove existing listeners to avoid duplicates
                         if (inputs[colIndex]._syncHandler) {
                             inputs[colIndex].removeEventListener('input', inputs[colIndex]._syncHandler);
                         }
                         
                         // Create new sync handler
                         inputs[colIndex]._syncHandler = function() {
                             // Sync this change to all other pages immediately
                             syncSampleDataToOtherPages(rowIndex, colIndex, this.value);
                         };
                         
                         // Add the event listener
                         inputs[colIndex].addEventListener('input', inputs[colIndex]._syncHandler);
                     }
                 }
             });
         }
         
         // Function to update equipment dropdown styling
         function updateEquipmentDropdownStyling() {
             const equipmentDropdowns = document.querySelectorAll('.testing-table select');
             equipmentDropdowns.forEach(function(dropdown) {
                 if (dropdown.value && dropdown.value !== '' && dropdown.value !== 'Select Equipment ▼') {
                     dropdown.classList.add('equipment-selected');
                 } else {
                     dropdown.classList.remove('equipment-selected');
                 }
             });
         }

         // Function to make all summary rows (Average, Minimum, Maximum) and vertical Ave columns uneditable
         function makeSummaryRowsUneditable() {
             // Get all table bodies
             const allTableBodies = [testingTableBody, testingTableBody2, testingTableBody3, testingTableBody4];
             
             allTableBodies.forEach(tableBody => {
                 // Get all rows
                 const rows = tableBody.querySelectorAll('tr');
                 
                 rows.forEach(row => {
                     const firstCell = row.querySelector('td');
                     
                     // Check if this is a summary row (Average, Minimum, Maximum)
                     if (firstCell && ['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim())) {
                         // Get all inputs in this summary row
                         const inputs = row.querySelectorAll('input');
                         
                         // Make all inputs in summary row uneditable
                         inputs.forEach(input => {
                             input.readOnly = true;
                             input.style.backgroundColor = 'transparent'; // Normal background
                             input.style.color = '#000000'; // Normal black text
                             input.style.fontWeight = 'normal'; // Normal font weight for summary rows
                         });
                     } else {
                         // This is a data row - protect vertical Ave columns
                         const inputs = row.querySelectorAll('input');
                         
                         if (tableBody.id === 'testingTableBody2') {
                             // Page 2: Protect columns 6, 10, 14 (Elongation Ave, Force Ave, Force 5% Ave)
                             if (inputs[6]) makeInputUneditable(inputs[6]); // Elongation Ave
                             if (inputs[10]) makeInputUneditable(inputs[10]); // Force Ave
                             if (inputs[14]) makeInputUneditable(inputs[14]); // Force 5% Ave
                         } else if (tableBody.id === 'testingTableBody3') {
                             // Page 3: Protect columns 6, 10, 14 (Elongation Ave, Force Ave, Modulus Ave)
                             if (inputs[6]) makeInputUneditable(inputs[6]); // Elongation Ave
                             if (inputs[10]) makeInputUneditable(inputs[10]); // Force Ave
                             if (inputs[14]) makeInputUneditable(inputs[14]); // Modulus Ave
                         } else if (tableBody.id === 'testingTableBody4') {
                            // Page 4: Protect column 10 (Gloss Ave)
                            if (inputs[10]) makeInputUneditable(inputs[10]); // Gloss Ave
                        }
                     }
                 });
             });
         }
         
         // Helper function to make an input uneditable with consistent styling
         function makeInputUneditable(input) {
             input.readOnly = true;
             input.style.backgroundColor = 'transparent'; // Normal background
             input.style.color = '#000000'; // Normal black text
             input.style.fontWeight = 'normal'; // Normal font weight
         }
         
         // Function to force recalculation of all summary statistics to populate Average/Min/Max rows
         function forceRecalculateAllSummaryStatistics() {
             // Force recalculation for all pages that have summary statistics
             const tableBodies = [testingTableBody2, testingTableBody3, testingTableBody4, testingTableBody5];
             
             tableBodies.forEach(tableBody => {
                 // Get all data rows (excluding summary rows)
                 const dataRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
                     const firstCell = row.querySelector('td');
                     return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
                 });
                 
                 if (dataRows.length > 0) {
                     // Force recalculation of summary statistics
                     calculateSummaryStatistics(tableBody);
                     
                     // Also recalculate row averages to ensure Ave columns are populated
                     dataRows.forEach(row => {
                         calculateRowAverages(row, tableBody);
                     });
                 }
             });
             
             // Also recalculate Page 1 column statistics
             calculatePage1ColumnStats(testingTableBody);
         }
         
         // Function to recalculate ALL row averages for Pages 2, 3, 4 after data loads
         function recalculateAllRowAverages() {
             // Get all table bodies for Pages 2, 3, 4 (Page 5 excluded - no averages needed)
             const tableBodies = [testingTableBody2, testingTableBody3, testingTableBody4];
             
             tableBodies.forEach(tableBody => {
                 // Get all data rows (excluding summary rows)
                 const dataRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
                     const firstCell = row.querySelector('td');
                     return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
                 });
                 
                 // Recalculate averages for each row
                 dataRows.forEach(row => {
                     calculateRowAverages(row, tableBody);
                 });
             });
         }
         
         // Load column data from JSONB into table inputs
         function loadColumnDataToTable(tableBody, inputIndex, jsonbData) {
             if (!jsonbData || typeof jsonbData !== 'object') return;
             
             // Determine which table this is (Page 1, 2, 3, or 4)
             const isPage1 = tableBody === testingTableBody;
             const isPage2 = tableBody === testingTableBody2;
             const isPage3 = tableBody === testingTableBody3;
             const isPage4 = tableBody === testingTableBody4;
             const isNotPage1 = isPage2 || isPage3 || isPage4;
             
             // Get all data rows (excluding summary rows)
             const dataRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
                 const firstCell = row.querySelector('td');
                 return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
             });
             
             // Calculate how many rows we need based on the data
             const maxRowNumber = Math.max(...Object.keys(jsonbData).map(key => parseInt(key)));
             const rowsNeeded = maxRowNumber;
             
             // Add rows if we don't have enough
             while (dataRows.length < rowsNeeded) {
                 addRowsToTable(tableBody, 1);
                 // Re-get data rows after adding
                 const newDataRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
                     const firstCell = row.querySelector('td');
                     return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
                 });
                 // Update our reference
                 dataRows.length = 0;
                 dataRows.push(...newDataRows);
             }
             
             // Load data for each row
             Object.keys(jsonbData).forEach(rowKey => {
                 const rowIndex = parseInt(rowKey) - 1; // Convert "1", "2", "3" to 0, 1, 2
                 if (rowIndex >= 0 && rowIndex < dataRows.length) {
                     const row = dataRows[rowIndex];
                     
                     // Handle different column types based on table structure
                     if (inputIndex === 0) {
                         // Sample Number column - update input value
                         const inputs = row.querySelectorAll('input');
                         if (inputs[0]) {
                             inputs[0].value = jsonbData[rowKey];
                             // Make readonly on Pages 2, 3, 4 (sample identification columns)
                             if (isNotPage1) {
                                 inputs[0].readOnly = true;
                                 inputs[0].style.backgroundColor = 'transparent';
                                 inputs[0].style.color = '#000000';
                             }
                         }
                     } else if (inputIndex === 1) {
                         // Lot Number column - update input value
                         const inputs = row.querySelectorAll('input');
                         if (inputs[1]) {
                             inputs[1].value = jsonbData[rowKey];
                             // Make readonly on Pages 2, 3, 4 (sample identification columns)
                             if (isNotPage1) {
                                 inputs[1].readOnly = true;
                                 inputs[1].style.backgroundColor = 'transparent';
                                 inputs[1].style.color = '#000000';
                             }
                         }
                     } else if (inputIndex === 2) {
                         // Roll Number column - update input value
                         const inputs = row.querySelectorAll('input');
                         if (inputs[2]) {
                             inputs[2].value = jsonbData[rowKey];
                             // Make readonly on Pages 2, 3, 4 (sample identification columns)
                             if (isNotPage1) {
                                 inputs[2].readOnly = true;
                                 inputs[2].style.backgroundColor = 'transparent';
                                 inputs[2].style.color = '#000000';
                             }
                         }
                     } else {
                         // Input columns - find and update input value (column index = input index)
                         const inputs = row.querySelectorAll('input');
                         if (inputs[inputIndex]) {
                             inputs[inputIndex].value = jsonbData[rowKey];
                             
                             // Apply conditional formatting after loading data
                             let columnTypes = {};
                             
                             if (isPage1) {
                                 columnTypes = {
                                     3: 'basicWeight',
                                     4: 'thickness', 
                                     5: 'opacity',
                                     6: 'cof',
                                     7: 'cutWidth',
                                     8: 'colorDelta',
                                     9: 'colorDelta'
                                 };
                             } else if (isPage2) {
                                 columnTypes = {
                                     3: 'elongationMD', 4: 'elongationMD', 5: 'elongationMD',
                                     7: 'forceMD', 8: 'forceMD', 9: 'forceMD',
                                     11: 'force5pMD', 12: 'force5pMD', 13: 'force5pMD'
                                 };
                             } else if (isPage3) {
                                 columnTypes = {
                                     3: 'elongationCD', 4: 'elongationCD', 5: 'elongationCD',
                                     7: 'forceCD', 8: 'forceCD', 9: 'forceCD',
                                     11: 'modulus', 12: 'modulus', 13: 'modulus'
                                 };
                             } else if (isPage4) {
                                 columnTypes = {
                                     3: 'colorL', 4: 'colorA', 5: 'colorB', 6: 'colorDeltaE',
                                     7: 'gloss', 8: 'gloss', 9: 'gloss', 10: 'gloss',
                                 };
                             }
                             
                             if (columnTypes[inputIndex]) {
                                 applyColorFormatting(inputs[inputIndex], columnTypes[inputIndex]);
                             }
                         }
                     }
                 }
             });
       }

           // Initialize
       updateRowCount();
       updateAllRowCounts();
         
         // Make all summary rows uneditable from the start
         makeSummaryRowsUneditable();
         
                 // Load existing data from database if available
        loadDataFromDatabase();
        
        // Apply validation and formatting to all inputs (Sample No & Data Columns)
        initializeAllInputs();

       
       // Calculate initial summary statistics immediately
       calculateSummaryStatistics(testingTableBody2);
       calculateSummaryStatistics(testingTableBody3);
       calculatePage1ColumnStats(testingTableBody);
       
       // Form is ready - data will be auto-saved to database as user types
       
       // Add cell highlighting functionality to existing cells
       addCellHighlighting();
       
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

           // Add rows button for Page 1 (syncs with all pages) - ensures 30 rows with historical data
       addRowsBtn.addEventListener('click', async function() {
           // Block in view mode
           if (viewMode) {
               return;
           }
           
           // Get requested rows for fresh data (from user input)
           const requestedRows = parseInt(numRowsInput.value, 10) || 12;
           
           // Ensure we have exactly 30 rows (like clicking the + button)
           const currentRows = getCurrentDataRowCount(testingTableBody);
           const rowsToAdd = 30 - currentRows;
           
           if (rowsToAdd > 0) {
               
               // Add rows to all tables to reach 30 total
               addRowsToTable(testingTableBody, rowsToAdd);
               addRowsToTable(testingTableBody2, rowsToAdd);
               addRowsToTable(testingTableBody3, rowsToAdd);
               addRowsToTable(testingTableBody4, rowsToAdd);
               addRowsToTable(testingTableBody5, rowsToAdd);
               
               // Update row counts
               updateRowCount();
               updateAllRowCounts();
           }
           
           // Load historical data if available
           await loadHistoricalDataForNewForm();
           
           // Clear bottom rows for fresh data entry
           clearBottomRowsForFreshData(requestedRows);
           
           // Auto-save the form after loading historical data
           await autoSaveToDatabase();
       });
       


       // Delete rows button for Page 1 (syncs with all pages) - deletes one row at a time
       deleteRowsBtn.addEventListener('click', function() {
           // Block in view mode
           if (viewMode) {
               return;
           }
           
           deleteRowsFromTable(testingTableBody, 1);
           deleteRowsFromTable(testingTableBody2, 1);
           deleteRowsFromTable(testingTableBody3, 1);
           deleteRowsFromTable(testingTableBody4, 1);
           updateRowCount();
           updateAllRowCounts();
       });







           // Function to add rows to any table (like inline inspection form)
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

           // Get existing data rows to determine next lot number
           const existingDataRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
               const firstCell = row.querySelector('td');
               return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
           });
           
           // Determine lot number (like inline inspection form)
           let lotNumber = '01'; // Default for first lot
           if (existingDataRows.length > 0) {
               // Get the last lot number and increment
               const lastRow = existingDataRows[existingDataRows.length - 1];
               const lotCell = lastRow.querySelector('td:nth-child(2)'); // Second column is lot number
               if (lotCell && lotCell.textContent.trim()) {
                   const lastLotNum = parseInt(lotCell.textContent.trim());
                   if (!isNaN(lastLotNum)) {
                       lotNumber = String(lastLotNum + 1).padStart(2, '0');
                   }
               }
           }

           // Pre-calculate table properties for performance
           const isPage1 = tableBody.id === 'testingTableBody';
           const isPage2 = tableBody.id === 'testingTableBody2';
           const isPage3 = tableBody.id === 'testingTableBody3';
           const isPage4 = tableBody.id === 'testingTableBody4';
           const isPage5 = tableBody.id === 'testingTableBody5';
           
           let columnCount;
           if (isPage2 || isPage3) {
               columnCount = 15;
           } else if (isPage4) {
               columnCount = 11; // 3 Sample No + 4 Color + 4 Gloss
           } else if (isPage5) {
               columnCount = 5; // 3 Sample No + 1 PG Quality + 1 blank column
           } else {
               columnCount = 7; // Updated Page 1 column count after removing Cut Width and Color Delta columns
           }

           // Use DocumentFragment for better performance
           const fragment = document.createDocumentFragment();

           // Calculate the starting row index for tab order (existing rows)
           const existingRowsForTabOrder = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
               const firstCell = row.querySelector('td');
               return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
           });
           const startingRowIndex = existingRowsForTabOrder.length;
           
           // Add new empty rows
            for (let i = 0; i < n; i++) {
                const tr = document.createElement('tr');
                const rowIndex = startingRowIndex + i; // This is the index of the row being added
                
                for (let j = 0; j < columnCount; j++) {
                    const td = document.createElement('td');
                   td.className = 'testing-table-cell';
                    td.style.fontSize = '13px';
                    
                   if (j === 0) {
                       // First column: Lot & Roll - make it an input field instead of auto-generated
                    const input = document.createElement('input');
                    input.type = 'text';
                       input.className = 'testing-input';
                       input.value = '';
                       input.placeholder = '';
                       
                       // Check if this is Page 1 (editable) or Pages 2,3,4 (readonly)
                       if (!isPage1) {
                           // Make readonly on Pages 2, 3, 4
                           input.readOnly = true;
                           input.style.backgroundColor = 'transparent';
                           input.style.color = '#000000';
                       }
                       
                       // Apply Lot & Roll validation (00-00 format) only on Page 1
                       if (isPage1) {
                           applyLotRollValidation(input);
                       }
                       
                       td.appendChild(input);
                   } else if (j === 1) {
                       // Second column: Roll ID - make it an input field instead of auto-generated
                       const input = document.createElement('input');
                       input.type = 'text';
                       input.className = 'testing-input';
                       input.value = '';
                       input.placeholder = '';
                       
                       // Check if this is Page 1 (editable) or Pages 2,3,4 (readonly)
                       if (!isPage1) {
                           // Make readonly on Pages 2, 3, 4
                           input.readOnly = true;
                           input.style.backgroundColor = 'transparent';
                           input.style.color = '#000000';
                       }
                       
                       // Apply Roll ID validation (00000000 format) only on Page 1
                       if (isPage1) {
                           applyRollIDValidation(input);
                       }
                       
                       td.appendChild(input);
                   } else if (j === 2) {
                       // Third column: Lot Time - make it an input field
                       const input = document.createElement('input');
                       input.type = 'text';
                       input.className = 'testing-input';
                       input.value = '';
                       input.placeholder = '';
                       
                       // Check if this is Page 1 (editable) or Pages 2,3,4 (readonly)
                       if (!isPage1) {
                           // Make readonly on Pages 2, 3, 4
                           input.readOnly = true;
                           input.style.backgroundColor = 'transparent';
                           input.style.color = '#000000';
                       }
                       
                       // Apply Lot Time validation (00:00 format) only on Page 1
                       if (isPage1) {
                           applyLotTimeValidation(input);
                       }
                       
                       td.appendChild(input);
                    } else {
                        // Other columns: Input fields
                        const input = document.createElement('input');
                        input.type = 'text';
                        input.className = 'testing-input';
                        input.value = '';
                        input.placeholder = '';
                        
                        // Ensure input is always editable unless specifically made read-only
                        input.disabled = false;
                        input.readOnly = false;
                        
                    
                    // Apply unified validation to all input columns (Page 1-5)
                    applyValidationToInput(input, tableBody, j);

                    // Page 4 Special Handling
                    if (tableBody.id === 'testingTableBody4') {
                        if (j === 6) {
                            // Force Color Delta E input to be editable
                            input.disabled = false;
                            input.readOnly = false;
                            input.style.pointerEvents = 'auto';
                            input.style.backgroundColor = 'transparent';
                            input.style.color = 'black';
                            input.style.opacity = '1';
                            input.style.visibility = 'visible';
                            input.style.cursor = 'text';
                            
                            // Add event listener to ensure it stays editable
                            input.addEventListener('focus', function() {
                                this.disabled = false;
                                this.readOnly = false;
                                this.style.pointerEvents = 'auto';
                                this.style.backgroundColor = 'white';
                                this.style.color = 'black';
                            });
                        } else if (j === 10) {
                            // Gloss Ave column (read-only, calculated)
                            input.readOnly = true;
                            input.style.backgroundColor = '#f0f0f0';
                            input.style.color = '#000000';
                            input.placeholder = '';
                        }
                    }
                    
                    // Page 5 Special Handling
                    if (tableBody.id === 'testingTableBody5') {
                        if (j === 4) {
                            // Page 5 blank column (5th column) - no input, just empty cell
                            input.style.display = 'none';
                            td.style.backgroundColor = 'transparent';
                        }
                    }
                    
                    // Set tab order for proper navigation
                    input.tabIndex = rowIndex * columnCount + j;
                    
                    td.appendChild(input);
                   }
                   
                    tr.appendChild(td);
                }
                
                
                // Add to fragment instead of directly to table for better performance
                fragment.appendChild(tr);
               
               // Add highlighting functionality to the new row
               addHighlightingToRow(tr);
            }

           // Add all new rows to table at once (much faster)
           tableBody.appendChild(fragment);

           // Update tab order for all existing rows to ensure proper navigation
           updateTabOrderForAllRows(tableBody);

           // Re-add summary rows
           summaryRows.forEach(row => {
               tableBody.appendChild(row);
           });
           
           // Clear cache since table structure changed
           clearTableCache(tableBody);
           
           // Recalculate summary statistics for Pages 2, 3 and 4 after adding rows
           if (tableBody.id === 'testingTableBody2' || tableBody.id === 'testingTableBody3' || tableBody.id === 'testingTableBody4') {
               calculateSummaryStatistics(tableBody);
           }
           
           // Ensure summary rows remain uneditable after adding new rows
           makeSummaryRowsUneditable();
           
           // Force immediate recalculation of ALL summary statistics across all pages (Pages 2, 3, 4 and 5)
           forceRecalculateAllSummaryStatistics();
           
           // Save the updated table state to database after adding rows
           debouncedSave();
       }

       // Function to update tab order for all rows in a table
       function updateTabOrderForAllRows(tableBody) {
           const dataRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
               const firstCell = row.querySelector('td');
               return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
           });
           
           // Determine column count based on table
           let columnCount;
           if (tableBody.id === 'testingTableBody') {
               columnCount = 7; // Page 1: 3 Sample No + 4 data columns
           } else if (tableBody.id === 'testingTableBody2' || tableBody.id === 'testingTableBody3') {
               columnCount = 15; // Pages 2, 3: 3 Sample No + 12 data columns
           } else if (tableBody.id === 'testingTableBody4') {
               columnCount = 11; // Page 4: 3 Sample No + 4 Color + 4 Gloss
           }
           
           dataRows.forEach((row, rowIndex) => {
               const inputs = row.querySelectorAll('input');
               inputs.forEach((input, columnIndex) => {
                   input.tabIndex = rowIndex * columnCount + columnIndex;
               });
           });
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
           
           // Recalculate summary statistics for Pages 2, 3, 4 and 5 after deleting rows
           if (tableBody.id === 'testingTableBody2' || tableBody.id === 'testingTableBody3' || tableBody.id === 'testingTableBody4' || tableBody.id === 'testingTableBody5') {
               calculateSummaryStatistics(tableBody);
           }
           
           // Force immediate recalculation of ALL summary statistics across all pages
           forceRecalculateAllSummaryStatistics();
           
           // Also use debounced save for efficiency
           debouncedSave();
       }

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
           } else if (tableBody.id === 'testingTableBody3') {
               // Page 3: Elongation@ Break (%) CD, Force~Tensile Strength@Break (N) CD, Modulus Fresh @ 2%
               // Columns: Sample No (3 cols), Elongation CD (4 cols), Force CD (4 cols), Modulus (4 cols)
                   calculateSubgroupAverage(inputs, 3, 6, 'testingTableBody3'); // Elongation CD: cols 3,4,5 -> Ave at 6
                   calculateSubgroupAverage(inputs, 7, 10, 'testingTableBody3'); // Force CD: cols 7,8,9 -> Ave at 10
                   calculateSubgroupAverage(inputs, 11, 14, 'testingTableBody3'); // Modulus: cols 11,12,13 -> Ave at 14
           } else if (tableBody.id === 'testingTableBody4') {
               // Page 4: Color (4 cols), Gloss (4 cols: 1,2,3,Ave)
               // Columns: Sample No (3 cols), Color (4 cols), Gloss (4 cols)
                   calculateSubgroupAverage(inputs, 7, 10, 'testingTableBody4'); // Gloss: cols 7,8,9 -> Ave at 10
               // Color columns don't have average calculation
           }
       }

       // Function to calculate average for a subgroup of 3 columns
       function calculateSubgroupAverage(inputs, startIndex, aveIndex, tableBodyId) {
           if (aveIndex >= inputs.length) return;
           
           // Get values and track which ones have actual data
           const val1 = inputs[startIndex].value.trim();
           const val2 = inputs[startIndex + 1].value.trim();
           const val3 = inputs[startIndex + 2].value.trim();
           

           
           // Only calculate if at least one value is entered
           if (val1 !== '' || val2 !== '' || val3 !== '') {
               // Parse only non-empty values and count them
               let sum = 0;
               let count = 0;
               
               if (val1 !== '') {
                   sum += parseFloat(val1);
                   count++;
               }
               if (val2 !== '') {
                   sum += parseFloat(val2);
                   count++;
               }
               if (val3 !== '') {
                   sum += parseFloat(val3);
                   count++;
               }
               
               // Calculate average only of cells that have data
               const average = sum / count;
               
                               // Apply specific formatting based on column position for Page 2 and Page 3
                let formattedValue;
                if (tableBodyId === 'testingTableBody2') {
                    // Page 2: Specific formatting
                    if (aveIndex === 6) {
                        // Elongation@ Break(%) MD Ave: 3 digits, no decimals (000)
                        formattedValue = average.toFixed(0);
                    } else if (aveIndex === 10) {
                        // Force~Tensile Strength@Break(N)MD Ave: 2 digits + 1 decimal (00.0)
                        formattedValue = average.toFixed(1);
                    } else if (aveIndex === 14) {
                        // Force~Tensile Strength@Break 5% (N)MD Ave: 1 digit + 1 decimal (0.0)
                        formattedValue = average.toFixed(1);
                    } else {
                        formattedValue = average.toFixed(3);
                    }
                } else if (tableBodyId === 'testingTableBody3') {
                    // Page 3: Specific formatting
                    if (aveIndex === 6) {
                        // Elongation@ Break (%) CD Ave: 3 digits, no decimals (000)
                        formattedValue = average.toFixed(0);
                    } else if (aveIndex === 10) {
                        // Force~Tensile Strength@Break (N) CD Ave: 1 digit + 1 decimal (0.0)
                        formattedValue = average.toFixed(1);
                    } else if (aveIndex === 14) {
                        // Modulus Fresh @ 2% Ave: 2 digits + 1 decimal (00.0)
                        formattedValue = average.toFixed(1);
                    } else {
                        formattedValue = average.toFixed(3);
                    }
                } else if (tableBodyId === 'testingTableBody4') {
                    // Page 4: Specific formatting
                    if (aveIndex === 10) {
                        // Gloss Ave: 1 digit + 1 decimal (0.0)
                        formattedValue = average.toFixed(1);
                    } else {
                        formattedValue = average.toFixed(3);
                    }
                } else {
                    // Default formatting for other pages
                    formattedValue = average.toFixed(3);
                }
               
               inputs[aveIndex].value = formattedValue;
           } else {
               inputs[aveIndex].value = '';
           }
       }



       // Function to calculate summary statistics (Average, Min, Max) for vertical Ave columns
       // ONLY for Page 2, 3 & 4
       function calculateSummaryStatistics(tableBody) {
           // Only process Page 2, 3, 4, and 5
           if (tableBody.id !== 'testingTableBody2' && tableBody.id !== 'testingTableBody3' && tableBody.id !== 'testingTableBody4' && tableBody.id !== 'testingTableBody5') {
               return;
           }
           
           const rows = tableBody.querySelectorAll('tr');
           const dataRows = Array.from(rows).filter(row => {
               const firstCell = row.querySelector('td');
               return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
           });
           
           if (dataRows.length === 0) return;
           
           // Calculate for Ave columns based on table type
            if (tableBody.id === 'testingTableBody5') {
                // Page 5: Calculate PG Quality System Requirements summary (Pass=0, Fail=1)
                calculatePage5SummaryStats(dataRows, tableBody);
            } else if (tableBody.id === 'testingTableBody4') {
                // Page 4: Calculate summary for ALL data columns: Color L(3), A(4), B(5), Delta E(6), Gloss 1(7), 2(8), 3(9), Ave(10)
                calculatePage4SummaryStats(dataRows, tableBody);
            } else {
               // Page 2 & 3: 3 Ave columns (positions 6, 10, 14)
               // Page 2: Sample No (3 cols), Elongation MD (4 cols: 1,2,3,Ave), Force MD (4 cols: 1,2,3,Ave), Force 5% MD (4 cols: 1,2,3,Ave)
               // Page 3: Sample No (3 cols), Elongation CD (4 cols: 1,2,3,Ave), Force CD (4 cols: 1,2,3,Ave), Modulus (4 cols: 1,2,3,Ave)
           calculateVerticalAveStats(dataRows, [6, 10, 14], tableBody);
           }
        }

        // Function to calculate summary statistics for Page 5 (PG Quality System Requirements)
        function calculatePage5SummaryStats(dataRows, tableBody) {
            // Page 5: PG Quality column (Pass=0, Fail=1)
            // Input column index 3 contains PG Quality values
            // Summary row column index 1 (due to colspan=3 on label)
            const pgQualityValues = [];
            
            // Collect all PG Quality values from data rows
            dataRows.forEach(row => {
                const inputs = row.querySelectorAll('input');
                if (inputs[3] && inputs[3].value) {
                    const value = parseInt(inputs[3].value);
                    if (value === 0 || value === 1) {
                        pgQualityValues.push(value);
                    }
                }
            });
            
            if (pgQualityValues.length > 0) {
                // Calculate average with rounding: 0.5+ rounds to 1, <0.5 rounds to 0
                const average = pgQualityValues.reduce((sum, val) => sum + val, 0) / pgQualityValues.length;
                const averageRounded = average >= 0.5 ? 1 : 0;
                const minimum = Math.min(...pgQualityValues);
                const maximum = Math.max(...pgQualityValues);
                
                // Update summary row cells at column index 1 (due to colspan affecting td positions)
                updateSummaryRow(tableBody, 'Average', 1, averageRounded.toString());
                updateSummaryRow(tableBody, 'Minimum', 1, minimum.toString());
                updateSummaryRow(tableBody, 'Maximum', 1, maximum.toString());
            } else {
                // No valid values, clear summary
                updateSummaryRow(tableBody, 'Average', 1, '-');
                updateSummaryRow(tableBody, 'Minimum', 1, '-');
                updateSummaryRow(tableBody, 'Maximum', 1, '-');
            }
        }

        // Function to calculate individual column statistics for Page 4
        function calculatePage4ColumnStats(tableBody, changedColumnIndex = null) {
            if (tableBody.id !== 'testingTableBody4') {
                return;
            }
            
            const rows = tableBody.querySelectorAll('tr');
            const dataRows = Array.from(rows).filter(row => {
                const firstCell = row.querySelector('td');
                return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
            });
            
            if (dataRows.length === 0) return;
            
            // Page 4 data columns: Color L(3), A(4), B(5), Delta E(6), Gloss 1(7), 2(8), 3(9), Ave(10)
            // Page 4 summary rows: [Average/Min/Max label, Color L, A, B, Delta E, Gloss 1, 2, 3, Ave]
            const summaryColumnIndices = [1, 2, 3, 4, 5, 6, 7, 8]; // 8 data columns
            const inputColumnIndices = [3, 4, 5, 6, 7, 8, 9, 10]; // Input columns in data rows
            
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
                        if (inputs[inputColIndex] && inputs[inputColIndex].value) {
                            const value = parseFloat(inputs[inputColIndex].value);
                            if (!isNaN(value)) {
                                values.push(value);
                            }
                        }
                    });
                    
                    if (values.length > 0) {
                        const average = values.reduce((sum, val) => sum + val, 0) / values.length;
                        const minimum = Math.min(...values);
                        const maximum = Math.max(...values);
                        
                        // Format based on column type
                        let avgFormatted, minFormatted, maxFormatted;
                        if (inputColIndex === 10) {
                            // Gloss Ave: 1 decimal (0.0)
                            avgFormatted = average.toFixed(1);
                            minFormatted = minimum.toFixed(1);
                            maxFormatted = maximum.toFixed(1);
                        } else if (inputColIndex === 6) {
                            // Color Delta E: 2 decimals (0.00)
                            avgFormatted = average.toFixed(2);
                            minFormatted = minimum.toFixed(2);
                            maxFormatted = maximum.toFixed(2);
                        } else if (inputColIndex >= 7 && inputColIndex <= 9) {
                            // Gloss 1, 2, 3: 1 decimal (0.0)
                            avgFormatted = average.toFixed(1);
                            minFormatted = minimum.toFixed(1);
                            maxFormatted = maximum.toFixed(1);
                        } else if (inputColIndex >= 3 && inputColIndex <= 5) {
                            // Color L, A, B: 2 decimals (0.00)
                            avgFormatted = average.toFixed(2);
                            minFormatted = minimum.toFixed(2);
                            maxFormatted = maximum.toFixed(2);
                        } else {
                            // Other columns: 1 decimal (0.0)
                            avgFormatted = average.toFixed(1);
                            minFormatted = minimum.toFixed(1);
                            maxFormatted = maximum.toFixed(1);
                        }
                        
                        updateSummaryRow(tableBody, 'Average', summaryColIndex, avgFormatted);
                        updateSummaryRow(tableBody, 'Minimum', summaryColIndex, minFormatted);
                        updateSummaryRow(tableBody, 'Maximum', summaryColIndex, maxFormatted);
                    } else {
                        // Default values based on column type
                        let defaultValue;
                        if (inputColIndex >= 3 && inputColIndex <= 5) {
                            // Color L, A, B: 2 decimals (0.00)
                            defaultValue = '0.00';
                        } else {
                            // Color Delta E, Gloss: 1 decimal (0.0)
                            defaultValue = '0.0';
                        }
                        updateSummaryRow(tableBody, 'Average', summaryColIndex, defaultValue);
                        updateSummaryRow(tableBody, 'Minimum', summaryColIndex, defaultValue);
                        updateSummaryRow(tableBody, 'Maximum', summaryColIndex, defaultValue);
                    }
                }
            } else {
                // Update all columns
                calculatePage4SummaryStats(dataRows, tableBody);
            }
        }

        // Function to calculate summary statistics for Page 4 (all data columns)
        function calculatePage4SummaryStats(dataRows, tableBody) {
            // Page 4 input columns: Color L(3), A(4), B(5), Delta E(6), Gloss 1(7), 2(8), 3(9), Ave(10)
            // Page 4 summary columns: [Label(colspan=3), Color L(1), A(2), B(3), Delta E(4), Gloss merged(5-7), Ave(8)]
            // Process Color columns (3, 4, 5, 6) normally
            const colorInputColumns = [3, 4, 5, 6];
            const colorSummaryColumns = [1, 2, 3, 4];
            
            colorInputColumns.forEach((inputColIndex, arrayIndex) => {
                const summaryColIndex = colorSummaryColumns[arrayIndex];
                const values = [];
                
                // Collect all values from this input column across all data rows
                dataRows.forEach(row => {
                    const inputs = row.querySelectorAll('input');
                    if (inputs[inputColIndex] && inputs[inputColIndex].value) {
                        const value = parseFloat(inputs[inputColIndex].value);
                        if (!isNaN(value)) {
                            values.push(value);
                        }
                    }
                });
                
                if (values.length > 0) {
                    // Calculate Average, Min, Max
                    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
                    const minimum = Math.min(...values);
                    const maximum = Math.max(...values);
                    
                    // Format based on column type
                    let avgFormatted, minFormatted, maxFormatted;
                    
                    if (inputColIndex >= 3 && inputColIndex <= 5) {
                        // Color L, A, B: 2 decimals (0.00)
                        avgFormatted = average.toFixed(2);
                        minFormatted = minimum.toFixed(2);
                        maxFormatted = maximum.toFixed(2);
                    } else {
                        // Color Delta E: 2 decimals (0.00)
                        avgFormatted = average.toFixed(2);
                        minFormatted = minimum.toFixed(2);
                        maxFormatted = maximum.toFixed(2);
                    }
                    
                    updateSummaryRow(tableBody, 'Average', summaryColIndex, avgFormatted);
                    updateSummaryRow(tableBody, 'Minimum', summaryColIndex, minFormatted);
                    updateSummaryRow(tableBody, 'Maximum', summaryColIndex, maxFormatted);
                } else {
                    // Clear summary rows if no data
                    updateSummaryRow(tableBody, 'Average', summaryColIndex, '0.00');
                    updateSummaryRow(tableBody, 'Minimum', summaryColIndex, '0.00');
                    updateSummaryRow(tableBody, 'Maximum', summaryColIndex, '0.00');
                }
            });
            
            // Process Gloss Ave (column 10) - compute from Gloss 1, 2, 3 averages
            // Collect all row averages for Gloss (Gloss Ave = average of Gloss 1/2/3 for each row)
            const glossAveValues = [];
            dataRows.forEach(row => {
                const inputs = row.querySelectorAll('input');
                // Get Gloss 1, 2, 3 values
                const gloss1 = inputs[7] ? parseFloat(inputs[7].value) : NaN;
                const gloss2 = inputs[8] ? parseFloat(inputs[8].value) : NaN;
                const gloss3 = inputs[9] ? parseFloat(inputs[9].value) : NaN;
                
                // Calculate average of Gloss 1, 2, 3 for this row
                let count = 0;
                let sum = 0;
                
                if (!isNaN(gloss1)) { sum += gloss1; count++; }
                if (!isNaN(gloss2)) { sum += gloss2; count++; }
                if (!isNaN(gloss3)) { sum += gloss3; count++; }
                
                if (count > 0) {
                    glossAveValues.push(sum / count);
                }
            });
            
            // Calculate summary statistics for Gloss Ave
            if (glossAveValues.length > 0) {
                const glossAveAverage = glossAveValues.reduce((sum, val) => sum + val, 0) / glossAveValues.length;
                const glossAveMinimum = Math.min(...glossAveValues);
                const glossAveMaximum = Math.max(...glossAveValues);
                
                const avgFormatted = glossAveAverage.toFixed(1);
                const minFormatted = glossAveMinimum.toFixed(1);
                const maxFormatted = glossAveMaximum.toFixed(1);
                
                // After merged Gloss cell (colspan=3), Gloss Ave is at column index 6
                updateSummaryRow(tableBody, 'Average', 6, avgFormatted);
                updateSummaryRow(tableBody, 'Minimum', 6, minFormatted);
                updateSummaryRow(tableBody, 'Maximum', 6, maxFormatted);
            } else {
                // After merged Gloss cell (colspan=3), Gloss Ave is at column index 6
                updateSummaryRow(tableBody, 'Average', 6, '0.00');
                updateSummaryRow(tableBody, 'Minimum', 6, '0.00');
                updateSummaryRow(tableBody, 'Maximum', 6, '0.00');
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
           
           // Page 1 data rows: Sample No (3 cols), Basic Weight, Thickness, Opacity, COF Kinetic, Cut Width, Color-Delta E (Unprinted), Color-Delta E (Printed)
           // Page 1 summary rows: [Average/Min/Max label (colspan=3), Basic Weight, Thickness, Opacity, COF Kinetic, Cut Width, Color-Delta E (Unprinted), Color-Delta E (Printed)]
           // Summary row has 8 <td> elements: [0=label, 1=Basic Weight, 2=Thickness, 3=Opacity, 4=COF, 5=Cut Width, 6=Color1, 7=Color2]
           const summaryColumnIndices = [1, 2, 3, 4, 5, 6, 7];
           const inputColumnIndices = [3, 4, 5, 6, 7, 8, 9]; // Input columns in data rows (after Sample No colspan=3)
           
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
                       
                       // Format based on column type
                       let avgFormatted, minFormatted, maxFormatted;
                       
                       if (summaryColIndex === 1) { // Basic Weight
                           avgFormatted = avg.toFixed(2);
                           minFormatted = min.toFixed(2);
                           maxFormatted = max.toFixed(2);
                       } else if (summaryColIndex === 2) { // Thickness
                           avgFormatted = avg.toFixed(3);
                           minFormatted = min.toFixed(3);
                           maxFormatted = max.toFixed(3);
                       } else if (summaryColIndex === 3) { // Opacity
                           avgFormatted = avg.toFixed(1);
                           minFormatted = min.toFixed(1);
                           maxFormatted = max.toFixed(1);
                       } else if (summaryColIndex === 4) { // COF Kinetic
                           avgFormatted = avg.toFixed(2);
                           minFormatted = min.toFixed(2);
                           maxFormatted = max.toFixed(2);
                       } else if (summaryColIndex === 5) { // Cut Width
                           avgFormatted = avg.toFixed(0);
                           minFormatted = min.toFixed(0);
                           maxFormatted = max.toFixed(0);
                       } else { // Color-Delta E columns
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
                       if (summaryColIndex === 1) { // Basic Weight
                           zeroFormatted = '0.00';
                       } else if (summaryColIndex === 2) { // Thickness
                           zeroFormatted = '0.000';
                       } else if (summaryColIndex === 3) { // Opacity
                           zeroFormatted = '0.0';
                       } else if (summaryColIndex === 4) { // COF Kinetic
                           zeroFormatted = '0.00';
                       } else if (summaryColIndex === 5) { // Cut Width
                           zeroFormatted = '0';
                       } else { // Color-Delta E columns
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
                       
                       if (summaryColIndex === 1) { // Basic Weight
                           avgFormatted = avg.toFixed(2);
                           minFormatted = min.toFixed(2);
                           maxFormatted = max.toFixed(2);
                       } else if (summaryColIndex === 2) { // Thickness
                           avgFormatted = avg.toFixed(3);
                           minFormatted = min.toFixed(3);
                           maxFormatted = max.toFixed(3);
                       } else if (summaryColIndex === 3) { // Opacity
                           avgFormatted = avg.toFixed(1);
                           minFormatted = min.toFixed(1);
                           maxFormatted = max.toFixed(1);
                       } else if (summaryColIndex === 4) { // COF Kinetic
                           avgFormatted = avg.toFixed(2);
                           minFormatted = min.toFixed(2);
                           maxFormatted = max.toFixed(2);
                       } else if (summaryColIndex === 5) { // Cut Width
                           avgFormatted = avg.toFixed(0);
                           minFormatted = min.toFixed(0);
                           maxFormatted = max.toFixed(0);
                       } else { // Color-Delta E columns
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
                       if (summaryColIndex === 1) { // Basic Weight
                           zeroFormatted = '0.00';
                       } else if (summaryColIndex === 2) { // Thickness
                           zeroFormatted = '0.000';
                       } else if (summaryColIndex === 3) { // Opacity
                           zeroFormatted = '0.0';
                       } else if (summaryColIndex === 4) { // COF Kinetic
                           zeroFormatted = '0.00';
                       } else if (summaryColIndex === 5) { // Cut Width
                           zeroFormatted = '0';
                       } else { // Color-Delta E columns
                           zeroFormatted = '0.00';
                       }
                       
                       updatePage1SummaryRow(tableBody, 'Average', summaryColIndex, zeroFormatted);
                       updatePage1SummaryRow(tableBody, 'Minimum', summaryColIndex, zeroFormatted);
                       updatePage1SummaryRow(tableBody, 'Maximum', summaryColIndex, zeroFormatted);
                   }
               });
           }
           
           // If no specific column, calculate all columns (for initial load)
           for (let i = 0; i < summaryColumnIndices.length; i++) {
               const inputColIndex = inputColumnIndices[i];
               const summaryColIndex = summaryColumnIndices[i];
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
                   
                   if (summaryColIndex === 1) { // Basic Weight
                       avgFormatted = avg.toFixed(2);
                       minFormatted = min.toFixed(2);
                       maxFormatted = max.toFixed(2);
                   } else if (summaryColIndex === 2) { // Thickness
                       avgFormatted = avg.toFixed(3);
                       minFormatted = min.toFixed(3);
                       maxFormatted = max.toFixed(3);
                   } else if (summaryColIndex === 3) { // Opacity
                       avgFormatted = avg.toFixed(1);
                       minFormatted = min.toFixed(1);
                       maxFormatted = max.toFixed(1);
                   } else if (summaryColIndex === 4) { // COF Kinetic
                       avgFormatted = avg.toFixed(2);
                       minFormatted = min.toFixed(2);
                       maxFormatted = max.toFixed(2);
                   } else if (summaryColIndex === 5) { // Cut Width
                       avgFormatted = avg.toFixed(0);
                       minFormatted = min.toFixed(0);
                       maxFormatted = max.toFixed(0);
                   } else { // Color-Delta E columns
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
                   if (summaryColIndex === 1) { // Basic Weight
                       zeroFormatted = '0.00';
                   } else if (summaryColIndex === 2) { // Thickness
                       zeroFormatted = '0.000';
                   } else if (summaryColIndex === 3) { // Opacity
                       zeroFormatted = '0.0';
                   } else if (summaryColIndex === 4) { // COF Kinetic
                       zeroFormatted = '0.00';
                   } else if (summaryColIndex === 5) { // Cut Width
                       zeroFormatted = '0';
                   } else { // Color-Delta E columns
                       zeroFormatted = '0.00';
                   }
                   
                   updatePage1SummaryRow(tableBody, 'Average', summaryColIndex, zeroFormatted);
                   updatePage1SummaryRow(tableBody, 'Minimum', summaryColIndex, zeroFormatted);
                   updatePage1SummaryRow(tableBody, 'Maximum', summaryColIndex, zeroFormatted);
               }
           }
       }

       // Function to update Page 1 summary rows
       function updatePage1SummaryRow(tableBody, rowType, columnIndex, value) {
           const rows = tableBody.querySelectorAll('tr');
           rows.forEach(row => {
               const firstCell = row.querySelector('td');
               if (firstCell && firstCell.textContent.trim() === rowType) {
                   const cells = row.querySelectorAll('td');
                   if (cells[columnIndex]) {
                       cells[columnIndex].textContent = value;
                   }
               }
           });
       }

       // Function to calculate statistics for specific Ave column positions
       function calculateVerticalAveStats(dataRows, avePositions, tableBody) {
           avePositions.forEach(avePos => {
               const values = [];
               
               // Collect all values from this Ave column across all data rows
               dataRows.forEach(row => {
                   const inputs = row.querySelectorAll('input');
                   if (inputs[avePos] && inputs[avePos].value) {
                       const value = parseFloat(inputs[avePos].value);
                       if (!isNaN(value)) {
                           values.push(value);
                       }
                   }
               });
               
               if (values.length > 0) {
                   // Calculate Average, Min, Max
                   const average = values.reduce((sum, val) => sum + val, 0) / values.length;
                   const minimum = Math.min(...values);
                   const maximum = Math.max(...values);
                   
                   // Map data Ave column position to summary column position
                   let summaryColPos;
                   if (tableBody.id === 'testingTableBody4') {
                       // Page 4: Only one Ave column at position 10 -> Summary column 2 (after merged Gloss columns)
                       if (avePos === 10) summaryColPos = 2; // Gloss Ave
                   } else {
                       // Page 2 & 3: 3 Ave columns (positions 6, 10, 14) -> Summary columns: [2, 4, 6] (after merging)
                       // Column 6 (Elongation Ave) -> Summary column 2
                       // Column 10 (Force Ave) -> Summary column 4  
                       // Column 14 (Force 5% Ave) -> Summary column 6
                       if (avePos === 6) summaryColPos = 2;      // Elongation Ave
                       else if (avePos === 10) summaryColPos = 4; // Force Ave
                       else if (avePos === 14) summaryColPos = 6; // Force 5% Ave
                   }
                   
                   // Update the summary rows with proper formatting for Page 2
                   let avgFormatted, minFormatted, maxFormatted;
                   
                                        if (tableBody.id === 'testingTableBody2') {
                         // Page 2: Apply specific formatting
                         if (avePos === 6) {
                             // Elongation Ave: 3 digits, no decimals (000)
                             avgFormatted = average.toFixed(0);
                             minFormatted = minimum.toFixed(0);
                             maxFormatted = maximum.toFixed(0);
                         } else if (avePos === 10) {
                             // Force Ave: 2 digits + 1 decimal (00.0)
                             avgFormatted = average.toFixed(1);
                             minFormatted = minimum.toFixed(1);
                             maxFormatted = maximum.toFixed(1);
                         } else if (avePos === 14) {
                             // Force 5% Ave: 1 digit + 1 decimal (0.0)
                             avgFormatted = average.toFixed(1);
                             minFormatted = minimum.toFixed(1);
                             maxFormatted = maximum.toFixed(1);
                         } else {
                             // Default formatting
                             avgFormatted = average.toFixed(3);
                             minFormatted = minimum.toFixed(3);
                             maxFormatted = maximum.toFixed(3);
                         }
                                              } else if (tableBody.id === 'testingTableBody3') {
                             // Page 3: Apply specific formatting
                             if (avePos === 6) {
                                 // Elongation Ave: 3 digits, no decimals (000)
                                 avgFormatted = average.toFixed(0);
                                 minFormatted = minimum.toFixed(0);
                                 maxFormatted = maximum.toFixed(0);
                             } else if (avePos === 10) {
                                 // Force Ave: 1 digit + 1 decimal (0.0)
                                 avgFormatted = average.toFixed(1);
                                 minFormatted = minimum.toFixed(1);
                                 maxFormatted = maximum.toFixed(1);
                             } else if (avePos === 14) {
                                 // Modulus Ave: 2 digits + 1 decimal (00.0)
                                 avgFormatted = average.toFixed(1);
                                 minFormatted = minimum.toFixed(1);
                                 maxFormatted = maximum.toFixed(1);
                             } else {
                                 // Default formatting
                                 avgFormatted = average.toFixed(3);
                                 minFormatted = minimum.toFixed(3);
                                 maxFormatted = maximum.toFixed(3);
                             }
                         } else if (tableBody.id === 'testingTableBody4') {
                             // Page 4: Apply specific formatting
                             if (avePos === 6) {
                                 // Gloss Ave: 1 digit + 1 decimal (0.0)
                                 avgFormatted = average.toFixed(1);
                                 minFormatted = minimum.toFixed(1);
                                 maxFormatted = maximum.toFixed(1);
                             } else {
                                 // Default formatting
                                 avgFormatted = average.toFixed(3);
                                 minFormatted = minimum.toFixed(3);
                                 maxFormatted = maximum.toFixed(3);
                             }
                         } else if (tableBody.id === 'testingTableBody5') {
                             // Page 5: PG Quality - format as integers (0 or 1)
                             avgFormatted = average.toFixed(0);
                             minFormatted = minimum.toFixed(0);
                             maxFormatted = maximum.toFixed(0);
                         } else {
                             // Other pages: Default formatting
                             avgFormatted = average.toFixed(3);
                             minFormatted = minimum.toFixed(3);
                             maxFormatted = maximum.toFixed(3);
                         }
                   
                   updateSummaryRow(tableBody, 'Average', summaryColPos, avgFormatted);
                   updateSummaryRow(tableBody, 'Minimum', summaryColPos, minFormatted);
                   updateSummaryRow(tableBody, 'Maximum', summaryColPos, maxFormatted);
               } else {
                   // Clear summary rows if no data
                   let summaryColPos;
                   if (tableBody.id === 'testingTableBody4') {
                       // Page 4: Only one Ave column at position 10 -> Summary column 2 (after merged Gloss columns)
                       if (avePos === 10) summaryColPos = 2; // Gloss Ave
                   } else {
                       // Page 2 & 3: 3 Ave columns (positions 6, 10, 14) -> Summary columns: [2, 4, 6] (after merging)
                       // Column 6 (Elongation Ave) -> Summary column 2
                       // Column 10 (Force Ave) -> Summary column 4  
                       // Column 14 (Force 5% Ave) -> Summary column 6
                       if (avePos === 6) summaryColPos = 2;      // Elongation Ave
                       else if (avePos === 10) summaryColPos = 4; // Force Ave
                       else if (avePos === 14) summaryColPos = 6; // Force 5% Ave
                   }
                   // Set default values with proper formatting for Page 2
                   let defaultAvg, defaultMin, defaultMax;
                   
                                        if (tableBody.id === 'testingTableBody2') {
                         // Page 2: Apply specific formatting
                         if (avePos === 6) {
                             // Elongation Ave: 3 digits, no decimals (000)
                             defaultAvg = '0';
                             defaultMin = '0';
                             defaultMax = '0';
                         } else if (avePos === 10) {
                             // Force Ave: 2 digits + 1 decimal (00.0)
                             defaultAvg = '0.0';
                             defaultMin = '0.0';
                             defaultMax = '0.0';
                         } else if (avePos === 14) {
                             // Force 5% Ave: 1 digit + 1 decimal (0.0)
                             defaultAvg = '0.0';
                             defaultMin = '0.0';
                             defaultMax = '0.0';
                         } else {
                             // Default formatting
                             defaultAvg = '0.000';
                             defaultMin = '0.000';
                             defaultMax = '0.000';
                         }
                                              } else if (tableBody.id === 'testingTableBody3') {
                             // Page 3: Apply specific formatting
                             if (avePos === 6) {
                                 // Elongation Ave: 3 digits, no decimals (000)
                                 defaultAvg = '0';
                                 defaultMin = '0';
                                 defaultMax = '0';
                             } else if (avePos === 10) {
                                 // Force Ave: 1 digit + 1 decimal (0.0)
                                 defaultAvg = '0.0';
                                 defaultMin = '0.0';
                                 defaultMax = '0.0';
                             } else if (avePos === 14) {
                                 // Modulus Ave: 2 digits + 1 decimal (00.0)
                                 defaultAvg = '0.0';
                                 defaultMin = '0.0';
                                 defaultMax = '0.0';
                             } else {
                                 // Default formatting
                                 defaultAvg = '0.000';
                                 defaultMin = '0.000';
                                 defaultMax = '0.000';
                             }
                         } else if (tableBody.id === 'testingTableBody4') {
                             // Page 4: Apply specific formatting
                             if (avePos === 10) {
                                 // Gloss Ave: 1 digit + 1 decimal (0.0)
                                 defaultAvg = '0.0';
                                 defaultMin = '0.0';
                                 defaultMax = '0.0';
                             } else {
                                 // Default formatting
                                 defaultAvg = '0.000';
                                 defaultMin = '0.000';
                                 defaultMax = '0.000';
                             }
                         } else if (tableBody.id === 'testingTableBody5') {
                             // Page 5: PG Quality - format as integers (0 or 1)
                             defaultAvg = '0';
                             defaultMin = '0';
                             defaultMax = '0';
                         } else {
                             // Other pages: Default formatting
                             defaultAvg = '0.000';
                             defaultMin = '0.000';
                             defaultMax = '0.000';
                         }
                   
                   updateSummaryRow(tableBody, 'Average', summaryColPos, defaultAvg);
                   updateSummaryRow(tableBody, 'Minimum', summaryColPos, defaultMin);
                   updateSummaryRow(tableBody, 'Maximum', summaryColPos, defaultMax);
               }
           });
       }

       // Function to update a specific cell in summary rows
       function updateSummaryRow(tableBody, rowType, columnIndex, value) {
           const rows = tableBody.querySelectorAll('tr');
           rows.forEach(row => {
               const firstCell = row.querySelector('td');
               if (firstCell && firstCell.textContent.trim() === rowType) {
                   const cells = row.querySelectorAll('td');
                   if (cells[columnIndex]) {
                       cells[columnIndex].textContent = value;
                   }
               }
           });
       }


       

       
       // Clear form button DISABLED for safety - prevents accidental data deletion
       const clearBtn = document.querySelector('button[type="reset"]');
       if (clearBtn) {
           // Disable the button and hide it to prevent accidental clicks
           clearBtn.disabled = true;
           clearBtn.style.display = 'none'; // Hide the button completely
           clearBtn.style.visibility = 'hidden'; // Double safety - make it invisible
           
           // Remove any existing event listeners
           clearBtn.removeEventListener('click', function() {});
           
       }
       
       // Function to clear cached data rows when table structure changes
       function clearTableCache(tableBody) {
           if (tableBody._cachedDataRows) {
               delete tableBody._cachedDataRows;
           }
       }
       
       // Function to add rows to any table (like inline inspection form)

        // ===== SAMPLE VALIDATION FUNCTIONS (Lot, Roll, Time) =====

        function applyLotRollValidation(input) {
            if (input.dataset.validationAttached) return;
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

                    // Move to next input (standard navigation)
                    const nextRow = row.nextElementSibling;
                    if (nextRow) {
                        const firstCell = nextRow.querySelector('td');
                        if (firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim())) {
                            const nextInputs = nextRow.querySelectorAll('input');
                            // Lot Roll is index 0
                            if (nextInputs[0]) {
                                nextInputs[0].focus();
                            }
                        }
                    }
                }
            });
            input.dataset.validationAttached = 'true';
        }

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

        function applyRollIDValidation(input) {
            if (input.dataset.validationAttached) return;
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
                    // No specific format on Enter for Roll ID, but we should handle navigation or just prevent default
                    // Actually, Roll ID doesn't have a formatRollIDOnEnter function in the snippet, 
                    // but we should at least support navigation if needed. 
                    // However, to keep it simple and consistent with other functions that consume Enter:
                    
                    // Sync (redundant but safe)
                     const row = this.closest('tr');
                    const tableBody = row.closest('tbody');
                    if (tableBody && tableBody.id === 'testingTableBody') {
                        const rowIndex = Array.from(tableBody.querySelectorAll('tr')).filter(r => {
                            const firstCell = r.querySelector('td');
                            return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
                        }).indexOf(row);
                        syncSampleDataToOtherPages(rowIndex, 1, this.value);
                    }
                    
                    // Move to next input (standard navigation)
                     const nextRow = row.nextElementSibling;
                      if (nextRow) {
                           const firstCell = nextRow.querySelector('td');
                           if (firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim())) {
                               const nextInputs = nextRow.querySelectorAll('input');
                               // Roll ID is index 1
                               if (nextInputs[1]) {
                                   nextInputs[1].focus();
                               }
                           }
                      }
                }
            });
            input.dataset.validationAttached = 'true';
        }

        function validateRollID(input) {
            let value = input.value;
            value = value.replace(/[^0-9"]/g, '');
            if (value.length > 8) {
                value = value.substring(0, 8);
            }
            input.value = value;
        }

        function applyLotTimeValidation(input) {
            if (input.dataset.validationAttached) return;
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

                    // Move to next input (standard navigation)
                    const nextRow = row.nextElementSibling;
                    if (nextRow) {
                        const firstCell = nextRow.querySelector('td');
                        if (firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim())) {
                            const nextInputs = nextRow.querySelectorAll('input');
                            // Lot Time is index 2
                            if (nextInputs[2]) {
                                nextInputs[2].focus();
                            }
                        }
                    }
                }
            });
            input.dataset.validationAttached = 'true';
        }

        function validateLotTime(input) {
            let value = input.value;
            const previousValue = input.dataset.previousValue || '';
            const isDeleting = value.length < previousValue.length;
            
            value = value.replace(/[^0-9:]/g, '');
            if (value.length > 5) value = value.substring(0, 5);
            
            if (!isDeleting && value.length === 2 && !value.includes(':')) {
                value = value + ':';
            }
            input.value = value;
            input.dataset.previousValue = value;
        }

        function formatLotTimeOnEnter(input) {
            let value = input.value.trim();
            if (!value) return;
            
            if (!value.includes(':') && value.length <= 4) {
                value = value.padStart(4, '0');
                value = value.substring(0, 2) + ':' + value.substring(2);
            } else if (value.includes(':')) {
                const parts = value.split(':');
                const h = parts[0].padStart(2, '0');
                const m = parts[1].padStart(2, '0');
                value = h + ':' + m;
            }
            input.value = value;
        }

        // Global initialization function to setup all inputs
        function initializeAllInputs() {
            const tableBodies = [testingTableBody, testingTableBody2, testingTableBody3, testingTableBody4, testingTableBody5];
            
            tableBodies.forEach(tableBody => {
                if (!tableBody) return;
                
                const rows = tableBody.querySelectorAll('tr');
                rows.forEach(row => {
                    // Skip summary rows
                    if (row.classList.contains('summary-row') || row.querySelector('td')?.textContent === 'Average') return;
                    
                    const inputs = row.querySelectorAll('input.testing-input');
                    inputs.forEach((input, index) => {
                        if (index === 0 && tableBody.id === 'testingTableBody') {
                            applyLotRollValidation(input);
                        } else if (index === 1 && tableBody.id === 'testingTableBody') {
                            applyRollIDValidation(input);
                        } else if (index === 2 && tableBody.id === 'testingTableBody') {
                            applyLotTimeValidation(input);
                        } else {
                            applyValidationToInput(input, tableBody, index);
                        }
                    });
                });
            });
        }

        // Aliases for compatibility with legacy calls
        function applyConditionalFormattingToAllColumns() {
            initializeAllInputs();
        }

        function applyValidationToExistingSampleInputs() {
            initializeAllInputs();
        }

        function applyValidationToExistingThicknessInputs() { initializeAllInputs(); }
        function applyValidationToExistingOpacityInputs() { initializeAllInputs(); }
        function applyValidationToExistingCOFInputs() { initializeAllInputs(); }
        function applyValidationToExistingPage2Inputs() { initializeAllInputs(); }
        function applyValidationToExistingPage3Inputs() { initializeAllInputs(); }
        function applyValidationToExistingPage4Inputs() { initializeAllInputs(); }

        function applyValidationToInput(input, tableBody, columnIndex) {
             let fieldType = null;
             let specType = null;

             // Identify Field Type and Spec Type based on Table and Column
             if (tableBody.id === 'testingTableBody') {
                 // Page 1
                 switch (columnIndex) {
                     case 3: fieldType = 'BASIC_WEIGHT'; specType = 'basicWeight'; break;
                     case 4: fieldType = 'THICKNESS'; specType = 'thickness'; break;
                     case 5: fieldType = 'OPACITY'; specType = 'opacity'; break;
                     case 6: fieldType = 'COF'; specType = 'cof'; break;
                     case 7: fieldType = 'CUT_WIDTH'; specType = 'cutWidth'; break;
                     case 8: fieldType = 'COLOR_DELTA'; specType = 'colorDelta'; break;
                     case 9: fieldType = 'COLOR_DELTA'; specType = 'colorDelta'; break;
                 }
             } else if (tableBody.id === 'testingTableBody2') {
                 // Page 2
                 if (columnIndex >= 3 && columnIndex <= 5) { fieldType = 'THREE_DIGITS'; specType = 'elongationMD'; }
                 else if (columnIndex >= 7 && columnIndex <= 9) { fieldType = 'ONE_DIGIT_ONE_DECIMAL'; specType = 'forceMD'; }
                 else if (columnIndex >= 11 && columnIndex <= 13) { fieldType = 'ONE_DIGIT_ONE_DECIMAL'; specType = 'force5pMD'; }
             } else if (tableBody.id === 'testingTableBody3') {
                 // Page 3
                 if (columnIndex >= 3 && columnIndex <= 5) { fieldType = 'THREE_DIGITS'; specType = 'elongationCD'; }
                 else if (columnIndex >= 7 && columnIndex <= 9) { fieldType = 'ONE_DIGIT_ONE_DECIMAL'; specType = 'forceCD'; }
                 else if (columnIndex >= 11 && columnIndex <= 13) { fieldType = 'TWO_DIGIT_ONE_DECIMAL'; specType = 'modulus'; }
             } else if (tableBody.id === 'testingTableBody4') {
                 // Page 4
                 if (columnIndex === 3) { fieldType = 'COLOR_LAB'; specType = 'colorL'; }
                 else if (columnIndex === 4) { fieldType = 'COLOR_LAB'; specType = 'colorA'; }
                 else if (columnIndex === 5) { fieldType = 'COLOR_LAB'; specType = 'colorB'; }
                 else if (columnIndex === 6) { fieldType = 'COLOR_DELTA'; specType = 'colorDeltaE'; }
                 else if (columnIndex >= 7 && columnIndex <= 9) { fieldType = 'GLOSS'; specType = 'gloss'; }
             } else if (tableBody.id === 'testingTableBody5') {
                 // Page 5
                 if (columnIndex === 3) { fieldType = 'PG_QUALITY'; specType = 'pgQuality'; }
             }
             
             // Initial Formatting (apply even if listener exists, for View Mode or updates)
             if (specType && input.value) {
                 applyColorFormatting(input, specType);
             }

             // Attach Input Listener (only once)
             if (input.dataset.validationAttached) return;
             input.dataset.validationAttached = 'true';

             // Attach Input Listener
             input.addEventListener('input', function() {
                 if (typeof viewMode !== 'undefined' && viewMode) return;

                 // 1. Validation
                 if (fieldType === 'PG_QUALITY') {
                      validatePGQuality(this);
                 } else if (fieldType) {
                      validateInput(this, fieldType);
                 }

                 // 2. Color Highlighting (OOS)
                 if (specType) {
                     applyColorFormatting(this, specType);
                 }

                 // 3. Auto-Save
                 debouncedSave();

                 // 4. Calculations
                 if (tableBody.id === 'testingTableBody') {
                      calculatePage1ColumnStats(tableBody, columnIndex);
                      triggerSummaryRecalculation();
                 } else if (['testingTableBody2', 'testingTableBody3', 'testingTableBody4', 'testingTableBody5'].includes(tableBody.id)) {
                     // For Pages 2, 3, 4, 5 we calculate row averages and summary stats
                     const tr = this.closest('tr');
                     calculateRowAverages(tr, tableBody);
                     calculateSummaryStatistics(tableBody);
                }
             });

             // Attach Keydown Listener (Enter Key)
             input.addEventListener('keydown', function(e) {
                 if (e.key === 'Enter') {
                     e.preventDefault();

                     // Formatting on Enter
                      if (fieldType === 'PG_QUALITY') {
                          if (this.value === '0') this.value = '0';
                          else if (this.value === '1') this.value = '1';
                          else this.value = '';
                      } else if (fieldType) {
                          const pattern = CONFIG.VALIDATION_PATTERNS[fieldType];
                          if (pattern && pattern.afterDecimal !== undefined && this.value) {
                              const val = parseFloat(this.value);
                              if (!isNaN(val)) {
                                  this.value = val.toFixed(pattern.afterDecimal);
                              }
                          }
                          // Special Thickness handling
                          if (fieldType === 'THICKNESS' && this.value && !this.value.includes('.')) {
                               const val = parseFloat(this.value);
                               if (!isNaN(val) && Number.isInteger(val)) {
                                   this.value = (val / 1000).toFixed(3);
                               }
                          }
                      }
                      
                      // Re-apply validation/highlighting after formatting
                      if (specType) applyColorFormatting(this, specType);
                      
                      // Recalculate
                      if (tableBody.id === 'testingTableBody') {
                          calculatePage1ColumnStats(tableBody, columnIndex);
                          triggerSummaryRecalculation();
                      } else {
                          const tr = this.closest('tr');
                          calculateRowAverages(tr, tableBody);
                          calculateSummaryStatistics(tableBody);
                      }

                      // Move to next row
                      const row = this.closest('tr');
                      const nextRow = row.nextElementSibling;
                      if (nextRow) {
                           const firstCell = nextRow.querySelector('td');
                           if (firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim())) {
                               const nextInputs = nextRow.querySelectorAll('input');
                               // Find current input index in current row
                               const currentInputs = Array.from(row.querySelectorAll('input'));
                               const inputIndex = currentInputs.indexOf(this);
                               
                               if (nextInputs[inputIndex]) {
                                   nextInputs[inputIndex].focus();
                               }
                           }
                      }
                 }
             });
             
             // Initial Highlight Check (if value exists)
             if (specType && input.value) {
                 applyColorFormatting(input, specType);
             }
        }

         
    // Fix tab order for all existing rows on page load
    updateTabOrderForAllRows(testingTableBody);
    updateTabOrderForAllRows(testingTableBody2);
    updateTabOrderForAllRows(testingTableBody3);
    updateTabOrderForAllRows(testingTableBody4);
    
    // Initialize verification functionality
    initializeVerification();
    
    // Initialize approval functionality
    initializeApproval();
});
