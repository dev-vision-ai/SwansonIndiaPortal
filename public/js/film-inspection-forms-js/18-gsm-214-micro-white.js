// Supabase integration for auto-saving to database
import { supabase } from '../../supabase-config.js';

// ===== VERIFICATION FUNCTIONALITY =====
const VERIFICATION_PASSWORD = "QC-2256"; // Verification password for form verification

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
        
        if (data && data.length > 0) {
            // Verification data saved successfully
        } else {
            console.error('No data returned from update');
            alert('Error: Verification data not saved. Please try again.');
        }
        
    } catch (error) {
        console.error('Error updating verification in database:', error);
        alert('Error saving verification data. Please try again.');
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
        const data = JSON.parse(storedData);
        return data.form_id;
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
        
        // Check if the form is already verified
        const { data, error } = await supabase
            .from('214_18_micro_white')
            .select('verified_by, verified_date')
            .eq('form_id', formId)
            .single();
        
        if (error) {
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
    document.getElementById('confirmVerificationBtn').onclick = async () => {
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
            
        } catch (error) {
            console.error('Error during verification:', error);
            alert('Error during verification. Please try again.');
        }
    };
    
    // Handle cancel button click
    document.getElementById('cancelVerificationBtn').onclick = () => {
        document.getElementById('verificationConfirmPopup').style.display = 'none';
    };
}

function initializeVerification() {
    // Check verification status when page loads
    checkVerificationStatus();
    
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
        const allDropdownIds = [
            'basic-weight-equipment', 'cof-rr-equipment', 'cof-rs-equipment', 'opacity-equipment',
            'modulus-equipment', 'gloss-equipment', 'page2-common-equipment'
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
        
        // Equipment type to dropdown mapping
        const equipmentMappings = {
            'Weigh Scale': ['basic-weight-equipment'],
            'Spectrophotometer': ['opacity-equipment'],
            'Instron': ['cof-rr-equipment', 'cof-rs-equipment', 'modulus-equipment', 'page2-common-equipment'],
            'Glossmeter': ['gloss-equipment']
        };
        
        // Populate dropdowns
        Object.keys(equipmentMappings).forEach(equipmentType => {
            const dropdownIds = equipmentMappings[equipmentType];
            const equipmentIds = equipmentByType[equipmentType] || [];
            
            dropdownIds.forEach(dropdownId => {
                const dropdown = document.getElementById(dropdownId);
                if (dropdown) {
                    // Clear existing options except the first one
                    dropdown.innerHTML = '<option value="">Select Equipment ▼</option>';
                    
                    // Add equipment options
                    equipmentIds.forEach(equipmentId => {
                        const option = document.createElement('option');
                        option.value = equipmentId;
                        option.textContent = equipmentId;
                        dropdown.appendChild(option);
                    });
                    
                    // Add change event listener for auto-save
                    dropdown.addEventListener('change', function() {
                        if (!viewMode) {
                            autoSaveToDatabase();
                        }
                    });
                }
            });
        });
    }
    
    // Function to show equipment loading error
    function showEquipmentLoadingError() {
        // Set default options for all dropdowns
        const allDropdownIds = [
            'basic-weight-equipment', 'cof-rr-equipment', 'cof-rs-equipment', 'opacity-equipment',
            'modulus-equipment', 'gloss-equipment', 'page2-common-equipment'
        ];
        
        allDropdownIds.forEach(dropdownId => {
            const dropdown = document.getElementById(dropdownId);
            if (dropdown) {
                dropdown.innerHTML = '<option value="">Equipment loading failed - Please refresh</option>';
            }
        });
    }
    
    // Load data from database when page loads (optimized for speed)
    async function loadDataFromDatabase() {
        try {
            // Check if we have a current form session
            if (currentFormId) {
                // Load form data directly - no timeout needed
                const { data, error } = await supabase
                    .from('214_18_micro_white')
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
                    loadEquipmentSelections(data);
                    loadPreStoreData(data);

                    // Update equipment dropdown styling after data is loaded
                    setTimeout(updateEquipmentDropdownStyling, 100);
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

    // Apply conditional formatting to ALL inputs in a column
    function applyConditionalFormattingToColumn(tableBody, columnIndex, columnType) {
        const inputs = tableBody.querySelectorAll(`tr td:nth-child(${columnIndex + 1}) input`);
        inputs.forEach(input => {
            applyConditionalFormatting(input, columnType);
        });
    }

    // Apply conditional formatting to ALL columns across ALL pages
    function applyConditionalFormattingToAllColumns() {
        // Page 1
        const page1Columns = [
            { tableBody: testingTableBody, columnIndex: 3, columnType: 'basicWeight' },
            { tableBody: testingTableBody, columnIndex: 4, columnType: 'thickness' },
            { tableBody: testingTableBody, columnIndex: 5, columnType: 'opacity' },
            { tableBody: testingTableBody, columnIndex: 6, columnType: 'cof' },
            { tableBody: testingTableBody, columnIndex: 7, columnType: 'cutWidth' },
            { tableBody: testingTableBody, columnIndex: 8, columnType: 'colorDelta' },
            { tableBody: testingTableBody, columnIndex: 9, columnType: 'colorDelta' }
        ];

        // Page 2
        const page2Columns = [
            { tableBody: testingTableBody2, columnIndex: 3, columnType: 'elongationMD' },
            { tableBody: testingTableBody2, columnIndex: 4, columnType: 'elongationMD' },
            { tableBody: testingTableBody2, columnIndex: 5, columnType: 'elongationMD' },
            { tableBody: testingTableBody2, columnIndex: 7, columnType: 'forceMD' },
            { tableBody: testingTableBody2, columnIndex: 8, columnType: 'forceMD' },
            { tableBody: testingTableBody2, columnIndex: 9, columnType: 'forceMD' },
            { tableBody: testingTableBody2, columnIndex: 11, columnType: 'force5pMD' },
            { tableBody: testingTableBody2, columnIndex: 12, columnType: 'force5pMD' },
            { tableBody: testingTableBody2, columnIndex: 13, columnType: 'force5pMD' }
        ];

        // Apply to all pages
        [...page1Columns, ...page2Columns].forEach(({ tableBody, columnIndex, columnType }) => {
            applyConditionalFormattingToColumn(tableBody, columnIndex, columnType);
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
           
           if (!addRowsBtn || !deleteRowsBtn || !numRowsInput || !testingTableBody || !testingTableBody2) {
           return;
       }

       // ===== HELPER FUNCTIONS FOR TABLE OPERATIONS =====
       // Get all table bodies as an array for easier iteration
       const getAllTableBodies = () => [testingTableBody, testingTableBody2];
       
       // Get table body by page number (1-2)
       const getTableBodyByPage = (pageNumber) => {
           switch(pageNumber) {
               case 1: return testingTableBody;
               case 2: return testingTableBody2;
               default: return null;
           }
       };
       
       // Get column count for a specific table
       const getTableColumnCount = (tableBody) => {
           if (tableBody.id === 'testingTableBody') return 12;     // Page 1: 12 columns (3 for Sample No + 9 parameters)
           if (tableBody.id === 'testingTableBody2') return 12;     // Page 2: 12 columns (3 for Sample No + 9 parameters)
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
                       input.id === 'cancelVerificationBtn') {
                       return; // Skip disabling verification inputs
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
                   basic_weight: document.getElementById('basic-weight-equipment')?.value || '',
                   cof_rr: document.getElementById('cof-rr-equipment')?.value || '',
                   cof_rs: document.getElementById('cof-rs-equipment')?.value || '',
                   opacity: document.getElementById('opacity-equipment')?.value || '',
                   modulus: document.getElementById('modulus-equipment')?.value || '',
                   gloss: document.getElementById('gloss-equipment')?.value || ''
               },
               page2: {
                   common: document.getElementById('page2-common-equipment')?.value || ''
               }
           };
           
           // Only return equipment data if at least one equipment is selected
           const hasEquipment = Object.values(equipmentData).some(page => 
               Object.values(page).some(equipment => equipment && equipment !== '')
           );
           
           return hasEquipment ? equipmentData : null;
       }
       
       // Load equipment selections from database
       function loadEquipmentSelections(data) {
           if (data.equipment_used) {
               const equipment = data.equipment_used;
               
               // Load Page 1 equipment
               if (equipment.page1) {
                   if (equipment.page1.basic_weight) {
                       const dropdown = document.getElementById('basic-weight-equipment');
                       if (dropdown) dropdown.value = equipment.page1.basic_weight;
                   }
                   if (equipment.page1.cof_rr) {
                       const dropdown = document.getElementById('cof-rr-equipment');
                       if (dropdown) dropdown.value = equipment.page1.cof_rr;
                   }
                   if (equipment.page1.cof_rs) {
                       const dropdown = document.getElementById('cof-rs-equipment');
                       if (dropdown) dropdown.value = equipment.page1.cof_rs;
                   }
                   if (equipment.page1.opacity) {
                       const dropdown = document.getElementById('opacity-equipment');
                       if (dropdown) dropdown.value = equipment.page1.opacity;
                   }
                   if (equipment.page1.modulus) {
                       const dropdown = document.getElementById('modulus-equipment');
                       if (dropdown) dropdown.value = equipment.page1.modulus;
                   }
                   if (equipment.page1.gloss) {
                       const dropdown = document.getElementById('gloss-equipment');
                       if (dropdown) dropdown.value = equipment.page1.gloss;
                   }
               }
               
               // Load Page 2 equipment
               if (equipment.page2 && equipment.page2.common) {
                   const dropdown = document.getElementById('page2-common-equipment');
                   if (dropdown) dropdown.value = equipment.page2.common;
               }
               
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
                   purchase_order: poInput?.value || '',
                   quantity: quantityInput?.value ? parseInt(quantityInput.value) : null,
                   lot_no: currentLotNo || null, // Only use existing lot_no, don't generate new ones
                   // Don't overwrite prestore_ref_no and prepared_by if updating existing form
                   ...(currentFormId ? {} : {
                       prestore_ref_no: generateRefNumber(),
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
                   // HTML: Sample No (colspan="3"), Basic Weight, COF-Kinetic(R-R), COF-Kinetic(R-S), Opacity, Modulus-MD-web@ 2% (1,2,3,Avg), Gloss Level
                   // HTML columns: 0(Sample No), 1(Basic Weight), 2(COF-RR), 3(COF-RS), 4(Opacity), 5(Modulus1), 6(Modulus2), 7(Modulus3), 8(ModulusAvg), 9(Gloss)
                   page1_basic_weight: convertColumnToJSONB(testingTableBody, 3), // Basic Weight - HTML column 3
                   page1_cof_rr: convertColumnToJSONB(testingTableBody, 4),       // COF-Kinetic(R-R) - HTML column 4
                   page1_cof_rs: convertColumnToJSONB(testingTableBody, 5),       // COF-Kinetic(R-S) - HTML column 5
                   page1_opacity: convertColumnToJSONB(testingTableBody, 6),     // Opacity - HTML column 6
                   page1_modulus_1: convertColumnToJSONB(testingTableBody, 7),   // Modulus 1 - HTML column 7
                   page1_modulus_2: convertColumnToJSONB(testingTableBody, 8),   // Modulus 2 - HTML column 8
                   page1_modulus_3: convertColumnToJSONB(testingTableBody, 9),   // Modulus 3 - HTML column 9
                   page1_gloss: convertColumnToJSONB(testingTableBody, 11),     // Gloss Level - HTML column 11
                   
                   // Page 2: Convert to JSONB arrays for each column
                   // HTML: Sample No (colspan="3"), Force-elongation-MD@5%, Force-Tensile Strength-MD-peak, Force-elongation-CD@5%, Force-Tensile Strength-CD-peak, Colour L, Colour A, Colour B, Delta E
                   // HTML columns: 0(Sample No), 1(Force-elongation-MD@5%), 2(Force-Tensile Strength-MD-peak), 3(Force-elongation-CD@5%), 4(Force-Tensile Strength-CD-peak), 5(Colour L), 6(Colour A), 7(Colour B), 8(Delta E)
                   page2_force_elongation_md_5p: convertColumnToJSONB(testingTableBody2, 3),     // Force-elongation-MD@5% - HTML column 3
                   page2_force_tensile_md_peak: convertColumnToJSONB(testingTableBody2, 4),     // Force-Tensile Strength-MD-peak - HTML column 4
                   page2_force_elongation_cd_5p: convertColumnToJSONB(testingTableBody2, 5),     // Force-elongation-CD@5% - HTML column 5
                   page2_force_tensile_cd_peak: convertColumnToJSONB(testingTableBody2, 6),     // Force-Tensile Strength-CD-peak - HTML column 6
                   page2_colour_l: convertColumnToJSONB(testingTableBody2, 7),          // Colour L - HTML column 7
                   page2_colour_a: convertColumnToJSONB(testingTableBody2, 8),          // Colour A - HTML column 8
                   page2_colour_b: convertColumnToJSONB(testingTableBody2, 9),          // Colour B - HTML column 9
                   page2_delta_e: convertColumnToJSONB(testingTableBody2, 10),          // Delta E - HTML column 10
                   
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
                       .from('214_18_micro_white')
                       .update(updateData)
                       .eq('form_id', currentFormId)
                       .select('form_id');
               } else {
                   // Insert new record
                   result = await supabase
                       .from('214_18_micro_white')
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
       
       function debouncedSave() {
           if (isSaving) {
               return; // Prevent duplicate saves
           }
           clearTimeout(saveTimeout);
           saveTimeout = setTimeout(async () => {
               isSaving = true;
               await autoSaveToDatabase();
               isSaving = false;
           }, 200); // 200ms delay for better responsiveness
       }
       
       // Helper function to add consolidated input event listener
       function addConsolidatedInputListener(input, tableBody, tr, columnIndex) {
           input.addEventListener('input', function() {
               // Block input in view mode
               if (viewMode) {
                   return;
               }
               
               // Auto-save to database after each change (debounced)
               debouncedSave();
               
               // Real-time sync for Page 1 sample columns
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
               
                               rowData.forEach(cellValue => {
                    const td = document.createElement('td');
                    td.className = 'testing-table-cell';
                    td.style.fontSize = '13px';
                   
                   const input = document.createElement('input');
                   input.type = 'text';
                   input.className = 'testing-input';
                   input.value = cellValue;
                   
                   // Add event listener for automatic average calculation
                   input.addEventListener('input', function() {
                       // Block input in view mode
                       if (viewMode) {
                           return;
                       }
                       
                       // Auto-save to database after each change (debounced)
                       debouncedSave();
                       
                       // Only calculate row averages for Pages 2, 3, 4 (not Page 1)
                       if (tableBody.id !== 'testingTableBody') {
                           calculateRowAverages(tr, tableBody);
                       }
                       // Also calculate summary statistics for vertical Ave columns (Page 2)
                       if (tableBody.id === 'testingTableBody2') {
                           calculateSummaryStatistics(tableBody);
                       }
                       // Calculate individual column stats for Page 1 (only the changed column)
                       if (tableBody.id === 'testingTableBody') {
                           const inputIndex = Array.from(tr.querySelectorAll('input')).indexOf(input);
                           calculatePage1ColumnStats(tableBody, inputIndex);
                       }
                   });
                   
                   td.appendChild(input);
                   tr.appendChild(td);
               });
               
               // Insert the row BEFORE the first summary row (Average row)
               tableBody.insertBefore(tr, firstSummaryRow);
               
               // Add highlighting functionality to the loaded row
               addHighlightingToRow(tr);
           });
           
           // Recalculate summary statistics for Page 2 after loading data
           if (tableBody.id === 'testingTableBody2') {
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
               } else if (tableBody.id === 'testingTableBody2') {
                   // Page 2: 3 sample columns + 9 data columns
                   // DOM columns: 0(Sample1), 1(Sample2), 2(Sample3), 3(Force-elongation-MD@5%), 4(Force-Tensile Strength-MD-peak), 5(Force-elongation-CD@5%), 6(Force-Tensile Strength-CD-peak), 7(Colour L), 8(Colour A), 9(Colour B), 10(Delta E)
                   // Input indices: 0(Sample1), 1(Sample2), 2(Sample3), 3(Force-elongation-MD@5%), 4(Force-Tensile Strength-MD-peak), 5(Force-elongation-CD@5%), 6(Force-Tensile Strength-CD-peak), 7(Colour L), 8(Colour A), 9(Colour B), 10(Delta E)
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
           const allTables = [testingTableBody, testingTableBody2];
           
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
           const allTables = [testingTableBody, testingTableBody2];
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
                       handleKeyboardNavigation(e, cell);
                   });
               }
           });
       }
       
       // Debounced save timeout management
       let saveTimeout = null;

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
                    .from('214_18_micro_white')
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
                    
                    // If no data for previous date, find most recent form with same product + machine
                    console.log('Searching for recent data:', { productCode, machineNo, productionDate });
                    
                    const { data: recentData, error: recentError } = await supabase
                        .from('214_18_micro_white')
                        .select('*')
                        .eq('product_code', productCode)
                        .eq('machine_no', machineNo)
                        .lt('production_date', productionDate)
                        .order('production_date', { ascending: false })
                        .limit(1);
                    
                    if (recentError) {
                        console.error('Error fetching recent data:', recentError);
                    }

                    if (recentError || !recentData || recentData.length === 0) {
                        console.log('No historical data found for this product/machine combination');
                        return;
                    }

                    // Load most recent historical data
                    await loadHistoricalDataIntoForm(recentData[0]);
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
        }

        // Clear bottom rows for fresh data entry
        function clearBottomRowsForFreshData(requestedRows) {
            const startRow = 30 - requestedRows + 1;
            const endRow = 30;


            // Clear data in all tables for bottom rows
            clearBottomRowsInTable(testingTableBody, startRow, endRow);
            clearBottomRowsInTable(testingTableBody2, startRow, endRow);
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

        // Recalculate ALL row averages for Page 2 after data loads
        recalculateAllRowAverages();

        // Force recalculation of summary statistics to populate Average/Min/Max rows
        forceRecalculateAllSummaryStatistics();

        // Ensure all summary rows remain uneditable after data loads
        makeSummaryRowsUneditable();
    }

       // Function to update tab order for all rows in a table
                 
                 if (dbData.prestore_ref_no) {
                     const element = document.getElementById('view-ref-no');
                     if (element) element.textContent = dbData.prestore_ref_no;
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
            const allTableBodies = [testingTableBody, testingTableBody2];
             
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
            const otherTableBodies = [testingTableBody2];
             
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
             const allTableBodies = [testingTableBody, testingTableBody2];
             
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
             const tableBodies = [testingTableBody2];
             
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
             // Get all table bodies for Page 2 (Page 1 excluded - no averages needed)
             const tableBodies = [testingTableBody2];
             
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
             const isNotPage1 = isPage2;
             
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
        
        // Apply validation to existing sample inputs after data is loaded
        applyValidationToExistingSampleInputs();
        
        // Apply validation to existing thickness inputs after data is loaded
        applyValidationToExistingThicknessInputs();
        
        // Apply conditional formatting to ALL columns across ALL pages after data is loaded
        applyConditionalFormattingToAllColumns();
        
        // Apply validation to existing opacity inputs after data is loaded
        applyValidationToExistingOpacityInputs();
        
        
        // Apply validation to existing COF inputs after data is loaded
        applyValidationToExistingCOFInputs();
        
        // Apply validation to existing Page 2, 3, 4 inputs after data is loaded
        applyValidationToExistingPage2Inputs();
        // Pages 3 and 4 removed for this product
       
       // Add event listeners to existing input fields for average calculation
       addAverageCalculationListeners();
       
       // Calculate initial summary statistics immediately
       calculateSummaryStatistics(testingTableBody2);
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
           
           let columnCount;
           if (isPage2) {
               columnCount = 15;
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
                           // Add consolidated input event listener only on Page 1
                           addConsolidatedInputListener(input, tableBody, tr, 0);
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
                           // Add consolidated input event listener only on Page 1
                           addConsolidatedInputListener(input, tableBody, tr, 1);
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
                           // Add consolidated input event listener only on Page 1
                           addConsolidatedInputListener(input, tableBody, tr, 2);
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
                        
                    
                    // Apply validation and conditional formatting to Page 1 columns
                    if (tableBody.id === 'testingTableBody') {
                        if (j === 3) {
                            applyValidationToInput(input, tableBody, j);
                            applyConditionalFormatting(input, 'basicWeight');
                        } else if (j === 4) {
                            applyThicknessValidation(input);
                            applyConditionalFormatting(input, 'thickness');
                        } else if (j === 5) {
                            applyOpacityValidation(input);
                            applyConditionalFormatting(input, 'opacity');
                        } else if (j === 6) {
                            applyCOFValidation(input);
                            applyConditionalFormatting(input, 'cof');
                        }
                    }
                    
                    // Page 2 validations and conditional formatting
                    if (isPage2) {
                        // Elongation MD columns (000 format)
                        if (j === 3 || j === 4 || j === 5) {
                            applyThreeDigitValidation(input);
                            applyConditionalFormatting(input, 'elongationMD');
                        }
                        // Force MD columns (00.0 format)
                        if (j === 7 || j === 8 || j === 9) {
                            applyTwoDigitOneDecimalValidation(input);
                            applyConditionalFormatting(input, 'forceMD');
                        }
                        // Force 5% MD columns (0.0 format)
                        if (j === 11 || j === 12 || j === 13) {
                            applyOneDigitOneDecimalValidation(input);
                            applyConditionalFormatting(input, 'force5pMD');
                        }
                    }
                    
                    
                        td.style.backgroundColor = 'transparent';
                    }
                    
                    // Add event listener for automatic average calculation
                    // Skip validated columns as they have their own comprehensive event listeners
                    const isPage1Validated = tableBody.id === 'testingTableBody' && (j === 0 || j === 1 || j === 2 || j === 4 || j === 5 || j === 6);
                    const isPage2Validated = tableBody.id === 'testingTableBody2' && (j === 3 || j === 4 || j === 5 || j === 7 || j === 8 || j === 9 || j === 11 || j === 12 || j === 13);
                    
                    if (!(isPage1Validated || isPage2Validated)) {
                        input.addEventListener('input', function() {
                            // Auto-save to database after each change (debounced)
                            debouncedSave();
                            
                            // Only calculate row averages for Pages 2, 3, 4 (not Page 1)
                            if (tableBody.id !== 'testingTableBody') {
                                calculateRowAverages(tr, tableBody);
                            }
                            // Also calculate summary statistics for vertical Ave columns (Page 2, 3 & 4)
                            if (tableBody.id === 'testingTableBody2') {
                                calculateSummaryStatistics(tableBody);
                            }
                            // Calculate individual column stats for Page 1 (only the changed column)
                            if (tableBody.id === 'testingTableBody') {
                                const inputIndex = Array.from(tr.querySelectorAll('input')).indexOf(input);
                                calculatePage1ColumnStats(tableBody, inputIndex);
                            }
                               
                               // Force immediate recalculation of ALL summary statistics for instant sync
                               triggerSummaryRecalculation();
                        });
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
           if (tableBody.id === 'testingTableBody2') {
               calculateSummaryStatistics(tableBody);
           }
           
           // Ensure summary rows remain uneditable after adding new rows
           makeSummaryRowsUneditable();
           
           // Force immediate recalculation of ALL summary statistics across all pages
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
           } else if (tableBody.id === 'testingTableBody2') {
               columnCount = 15; // Pages 2, 3: 3 Sample No + 12 data columns
           
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
           
           // Recalculate summary statistics for Pages 2, 3 and 4 after deleting rows
           if (tableBody.id === 'testingTableBody2') {
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
               
                let formattedValue;
                if (tableBodyId === 'testingTableBody2') {
                    // Page 2: Specific formatting
                    if (aveIndex === 6) {
                        // Elongation@ Break(%) MD Ave: 3 digits, no decimals (000)
                        formattedValue = Math.round(average).toString();
                    } else if (aveIndex === 10) {
                        // Force~Tensile Strength@Break(N)MD Ave: 2 digits + 1 decimal (00.0)
                        formattedValue = average.toFixed(1);
                    } else if (aveIndex === 14) {
                        // Force~Tensile Strength@Break 5% (N)MD Ave: 1 digit + 1 decimal (0.0)
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

       // Function to add event listeners to existing input fields
       function addAverageCalculationListeners() {
           // Add listeners to all existing input fields in all tables
           const allTables = [testingTableBody, testingTableBody2];
           
           allTables.forEach(tableBody => {
               const rows = tableBody.querySelectorAll('tr');
               rows.forEach(row => {
                   const inputs = row.querySelectorAll('input');
                   inputs.forEach(input => {
                       input.addEventListener('input', function() {
                           // Auto-save to database after each change (debounced)
                           debouncedSave();
                           
                           // Only calculate row averages for Page 2 (not Page 1)
                           if (tableBody.id === 'testingTableBody2') {
                               calculateRowAverages(row, tableBody);
                               calculateSummaryStatistics(tableBody);
                           }
                           // Calculate individual column stats for Page 1 (only the changed column)
                           if (tableBody.id === 'testingTableBody') {
                               const inputIndex = Array.from(row.querySelectorAll('input')).indexOf(input);
                               calculatePage1ColumnStats(tableBody, inputIndex);
                           }
                           
                           // Force immediate recalculation of ALL summary statistics for instant sync
                           triggerSummaryRecalculation();
                       });
                   });
               });
           });
       }

       // Function to calculate summary statistics (Average, Min, Max) for vertical Ave columns
       // ONLY for Page 2
       function calculateSummaryStatistics(tableBody) {
           // Only process Page 2
           if (tableBody.id !== 'testingTableBody2') {
               return;
           }
           
           const rows = tableBody.querySelectorAll('tr');
           const dataRows = Array.from(rows).filter(row => {
               const firstCell = row.querySelector('td');
               return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
           });
           
           if (dataRows.length === 0) return;
           
           // Page 2: 3 Ave columns (positions 6, 10, 14)
           calculateVerticalAveStats(dataRows, [6, 10, 14], tableBody);
        }

        // ===== COLOR VALIDATION FUNCTIONS =====
        // Color L validation function - allow decimal values
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
               dataRows.forEach(row => {
                   const inputs = row.querySelectorAll('input');
                   if (inputs[avePos] && inputs[avePos].value) {
                       const value = parseFloat(inputs[avePos].value);
                       if (!isNaN(value)) {
                           values.push(value);
                       }
                   }
               });
              let summaryColPos = null;
              if (avePos === 6) summaryColPos = 2;
              else if (avePos === 10) summaryColPos = 4;
              else if (avePos === 14) summaryColPos = 6;
              if (summaryColPos === null) return;
               if (values.length > 0) {
                   const average = values.reduce((sum, val) => sum + val, 0) / values.length;
                   const minimum = Math.min(...values);
                   const maximum = Math.max(...values);
                   let avgFormatted, minFormatted, maxFormatted;
                                        if (tableBody.id === 'testingTableBody2') {
                         if (avePos === 6) {
                             avgFormatted = Math.round(average).toString();
                             minFormatted = Math.round(minimum).toString();
                             maxFormatted = Math.round(maximum).toString();
                         } else {
                                 avgFormatted = average.toFixed(1);
                                 minFormatted = minimum.toFixed(1);
                                 maxFormatted = maximum.toFixed(1);
                      }
                             } else {
                                 avgFormatted = average.toFixed(3);
                                 minFormatted = minimum.toFixed(3);
                                 maxFormatted = maximum.toFixed(3);
                             }
                   updateSummaryRow(tableBody, 'Average', summaryColPos, avgFormatted);
                   updateSummaryRow(tableBody, 'Minimum', summaryColPos, minFormatted);
                   updateSummaryRow(tableBody, 'Maximum', summaryColPos, maxFormatted);
               } else {
                   let defaultAvg, defaultMin, defaultMax;
                                        if (tableBody.id === 'testingTableBody2') {
                         if (avePos === 6) {
                          defaultAvg = '0'; defaultMin = '0'; defaultMax = '0';
                         } else {
                          defaultAvg = '0.0'; defaultMin = '0.0'; defaultMax = '0.0';
                      }
                             } else {
                      defaultAvg = '0.000'; defaultMin = '0.000'; defaultMax = '0.000';
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

         // ===== CHARACTER VALIDATION FRAMEWORK =====
         // This will be built step by step based on your requirements
         
         // Base validation function - will be enhanced as needed
         function applyValidationToInput(input, tableBody, columnIndex) {
             // This function will be customized based on your specific validation needs
             // We'll implement validations one by one as you request them
             
             // Basic Weight column validation (Page 1, column 3)
             if (tableBody.id === 'testingTableBody' && columnIndex === 3) {
                 input.addEventListener('input', function() {
                     validateBasicWeight(this);
                     
                     // Auto-save to database after each change (debounced)
                     debouncedSave();
                 });
                 
                 // Add Enter key listener for auto-formatting
                 input.addEventListener('keydown', function(e) {
                     if (e.key === 'Enter') {
                         e.preventDefault();
                         formatBasicWeightOnEnter(this);
                         // Move to next row after formatting
                         const row = this.closest('tr');
                         const nextRow = row.nextElementSibling;
                         if (nextRow && !['Average', 'Minimum', 'Maximum'].includes(nextRow.querySelector('td').textContent.trim())) {
                             const nextInput = nextRow.querySelector('input');
                             if (nextInput) {
                                 nextInput.focus();
                             }
                         }
                     }
                 });
                 
                 return; // Exit early for Basic Weight column
             }
             
             // For now, just add a basic input event listener for other columns
             input.addEventListener('input', function() {
                 // Validation logic will be added here step by step
                 
                 // Auto-save to database after each change (debounced)
                 debouncedSave();
             });
         }
         
         // Basic Weight validation function - exactly 00.00 format (L-15.70 T-18.00 U-20.30)
         function validateBasicWeight(input) {
             let value = input.value;
             
             // Remove any non-numeric characters except decimal point
             value = value.replace(/[^0-9.]/g, '');
             
             // Ensure only one decimal point
             const parts = value.split('.');
             if (parts.length > 2) {
                 value = parts[0] + '.' + parts.slice(1).join('');
             }
             
             // Limit to 2 digits before decimal and 2 digits after
             if (parts.length === 2) {
                 // Before decimal: max 2 digits
                 if (parts[0].length > 2) {
                     parts[0] = parts[0].substring(0, 2);
                 }
                 // After decimal: max 2 digits
                 if (parts[1].length > 2) {
                     parts[1] = parts[1].substring(0, 2);
                 }
                 value = parts[0] + '.' + parts[1];
             } else if (parts.length === 1) {
                 // No decimal point yet, limit to 2 digits
                 if (parts[0].length > 2) {
                     parts[0] = parts[0].substring(0, 2);
                     value = parts[0];
                 }
             }
             
             // Update input value with validated format
             input.value = value;
         }
         
         // Function to format Basic Weight to 00.00 format on Enter key
         function formatBasicWeightOnEnter(input) {
             let value = input.value.trim();
             
             // If empty, do nothing
             if (value === '') return;
             
             // Parse the number
             const numValue = parseFloat(value);
             if (isNaN(numValue)) return;
             
             // Format to exactly 2 decimal places
             const formattedValue = numValue.toFixed(2);
             
             // Update input value with formatted result
             input.value = formattedValue;
                 }
        
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
            
            // Add Enter key listener for auto-formatting
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    formatThicknessOnEnter(this);
                    
                    // Recalculate summary statistics after formatting
                    const tr = this.closest('tr');
                    const tableBody = tr.closest('tbody');
                    
                    if (tableBody.id === 'testingTableBody') {
                        const inputIndex = Array.from(tr.querySelectorAll('input')).indexOf(input);
                        calculatePage1ColumnStats(tableBody, inputIndex);
                        
                        // Force immediate recalculation of ALL summary statistics after conversion
                        triggerSummaryRecalculation();
                    }
                    
                    // Move to next row after formatting
                    const row = this.closest('tr');
                    const nextRow = row.nextElementSibling;
                    if (nextRow) {
                        const nextInput = nextRow.querySelector('input');
                        if (nextInput) {
                            nextInput.focus();
                        }
                    }
                }
            });
        }
        
        // Thickness validation function - allow typing multiple digits, format on Enter
        function validateThickness(input) {
            let value = input.value;
            
            // Remove any non-numeric characters except decimal point
            value = value.replace(/[^0-9.]/g, '');
            
            // Ensure only one decimal point
            const parts = value.split('.');
            if (parts.length > 2) {
                value = parts[0] + '.' + parts.slice(1).join('');
            }
            
            // Allow up to 2 digits before decimal for typing (like 00, 30, 99, etc.)
            // Only limit if there's a decimal point
            if (parts.length === 2) {
                // Before decimal: allow up to 2 digits (for values like 00, 30, 99)
                if (parts[0].length > 2) {
                    parts[0] = parts[0].substring(0, 2);
                }
                // After decimal: max 3 digits
                if (parts[1].length > 3) {
                    parts[1] = parts[1].substring(0, 3);
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
        
        // Function to format Thickness to 0.000 format on Enter key
        function formatThicknessOnEnter(input) {
            let value = input.value.trim();
            
            // If empty, leave it empty (don't set default values)
            if (value === '') {
                return;
            }
            
            // Parse as number
            const numValue = parseFloat(value);
            
            // If not a valid number, set to 0.000
            if (isNaN(numValue)) {
                input.value = '0.000';
                return;
            }
            
            // Convert integer input to decimal format (e.g., 30 -> 0.030)
            let finalValue;
            if (Number.isInteger(numValue) && !value.includes('.')) {
                // If it's an integer without decimal point, treat as thousandths
                finalValue = numValue / 1000;
            } else {
                // If it already has decimal point, use as is
                finalValue = numValue;
            }
            
            // Ensure value is between 0 and 0.999 (since max input is 99)
            if (finalValue < 0) {
                input.value = '0.000';
                return;
            }
            if (finalValue > 0.999) {
                input.value = '0.999';
                return;
            }
            
            // Format to exactly 3 decimal places
            const formattedValue = finalValue.toFixed(3);
            
            // Update input value with formatted result
            input.value = formattedValue;
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
            
            // Add Enter key listener for auto-formatting
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    formatOpacityOnEnter(this);
                    
                    // Recalculate summary statistics after formatting
                    const tr = this.closest('tr');
                    const tableBody = tr.closest('tbody');
                    
                    if (tableBody.id === 'testingTableBody') {
                        const inputIndex = Array.from(tr.querySelectorAll('input')).indexOf(input);
                        calculatePage1ColumnStats(tableBody, inputIndex);
                        
                        // Force immediate recalculation of ALL summary statistics after conversion
                        triggerSummaryRecalculation();
                    }
                    
                    // Move to next row after formatting
                    const row = this.closest('tr');
                    const nextRow = row.nextElementSibling;
                    if (nextRow) {
                        const nextInput = nextRow.querySelector('input');
                        if (nextInput) {
                            nextInput.focus();
                        }
                    }
                }
            });
        }
        
        // Opacity validation function - allow typing up to 2 digits, format on Enter (L-57.0 T-60.0 U-63.0)
        function validateOpacity(input) {
            let value = input.value;
            
            // Remove any non-numeric characters except decimal point
            value = value.replace(/[^0-9.]/g, '');
            
            // Ensure only one decimal point
            const parts = value.split('.');
            if (parts.length > 2) {
                value = parts[0] + '.' + parts.slice(1).join('');
            }
            
            // Allow up to 2 digits before decimal for typing (like 00, 30, 99, etc.)
            // Only limit if there's a decimal point
            if (parts.length === 2) {
                // Before decimal: allow up to 2 digits (for values like 00, 30, 99)
                if (parts[0].length > 2) {
                    parts[0] = parts[0].substring(0, 2);
                }
                // After decimal: max 1 digit
                if (parts[1].length > 1) {
                    parts[1] = parts[1].substring(0, 1);
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
        
        // Function to format Opacity to 00.0 format on Enter key
        function formatOpacityOnEnter(input) {
            let value = input.value.trim();
            
            // If empty, leave it empty (don't set default values)
            if (value === '') {
                return;
            }
            
            // Parse as number
            const numValue = parseFloat(value);
            
            // If not a valid number, set to 00.0
            if (isNaN(numValue)) {
                input.value = '00.0';
                return;
            }
            
            // Convert integer input to decimal format (e.g., 30 -> 30.0)
            let finalValue;
            if (Number.isInteger(numValue) && !value.includes('.')) {
                // If it's an integer without decimal point, treat as whole number with 1 decimal
                finalValue = numValue;
            } else {
                // If it already has decimal point, use as is
                finalValue = numValue;
            }
            
            // Ensure value is between 0 and 99.9 (since max input is 99)
            if (finalValue < 0) {
                input.value = '00.0';
                return;
            }
            if (finalValue > 99.9) {
                input.value = '99.9';
                return;
            }
            
            // Format to exactly 1 decimal place with 2 digits before decimal
            const formattedValue = finalValue.toFixed(1);
            
            // Pad with leading zero if needed (e.g., 5.0 -> 05.0)
            if (formattedValue.length === 3) { // e.g., "5.0"
                const paddedValue = '0' + formattedValue; // "05.0"
                input.value = paddedValue;
            } else {
                input.value = formattedValue;
            }
        }
        
        // COF Kinetic validation function - exactly 0.00 format
        function applyCOFValidation(input) {
            input.addEventListener('input', function() {
                validateCOF(this);
                
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
                
                // Auto-save handled by consolidated input listener
            });
            
            // Add Enter key listener for auto-formatting
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    formatCOFOnEnter(this);
                    
                    // Recalculate summary statistics after formatting
                    const tr = this.closest('tr');
                    const tableBody = tr.closest('tbody');
                    
                    if (tableBody.id === 'testingTableBody') {
                        const inputIndex = Array.from(tr.querySelectorAll('input')).indexOf(input);
                        calculatePage1ColumnStats(tableBody, inputIndex);
                        
                        // Force immediate recalculation of ALL summary statistics after conversion
                        triggerSummaryRecalculation();
                    }
                    
                    // Move to next row after formatting
                    const row = this.closest('tr');
                    const nextRow = row.nextElementSibling;
                    if (nextRow) {
                        const nextInput = nextRow.querySelector('input');
                        if (nextInput) {
                            nextInput.focus();
                        }
                    }
                }
            });
        }
        
        // COF Kinetic validation function - allow typing up to 2 digits, format on Enter (L-0.30 T-0.40 U-0.50)
        function validateCOF(input) {
            let value = input.value;
            
            // Remove any non-numeric characters except decimal point
            value = value.replace(/[^0-9.]/g, '');
            
            // Ensure only one decimal point
            const parts = value.split('.');
            if (parts.length > 2) {
                value = parts[0] + '.' + parts.slice(1).join('');
            }
            
            // Allow up to 2 digits before decimal for typing (like 00, 30, 99, etc.)
            // Only limit if there's a decimal point
            if (parts.length === 2) {
                // Before decimal: allow up to 2 digits (for values like 00, 30, 99)
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
        
        // Function to format COF Kinetic to 0.00 format on Enter key
        function formatCOFOnEnter(input) {
            let value = input.value.trim();
            
            // If empty, leave it empty (don't set default values)
            if (value === '') {
                return;
            }
            
            // Parse as number
            const numValue = parseFloat(value);
            
            // If not a valid number, set to 0.00
            if (isNaN(numValue)) {
                input.value = '0.00';
                return;
            }
            
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
                input.value = '0.00';
                return;
            }
            if (finalValue > 0.99) {
                input.value = '0.99';
                return;
            }
            
            // Format to exactly 2 decimal places
            const formattedValue = finalValue.toFixed(2);
            
            // Update input value with formatted result
            input.value = formattedValue;
        }
        
            
        
        // Lot & Roll validation function - exactly 00-00 format
        function applyLotRollValidation(input) {
            input.addEventListener('input', function() {
                validateLotRoll(this);
                
                // Auto-save to database after each change (debounced)
                debouncedSave();
            });
            
            // Add Enter key listener for auto-formatting
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    formatLotRollOnEnter(this);
                    
                    // Move to next row after formatting
                    const row = this.closest('tr');
                    const nextRow = row.nextElementSibling;
                    if (nextRow) {
                        const nextInput = nextRow.querySelector('input');
                        if (nextInput) {
                            nextInput.focus();
                        }
                    }
                }
            });
        }
        
        // Roll ID validation function - exactly 00000000 format
        function applyRollIDValidation(input) {
            input.addEventListener('input', function() {
                validateRollID(this);
                
                // Auto-save to database after each change (debounced)
                debouncedSave();
            });
            
            // Add Enter key listener for auto-formatting
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    formatRollIDOnEnter(this);
                    
                    // Move to next row after formatting
                    const row = this.closest('tr');
                    const nextRow = row.nextElementSibling;
                    if (nextRow) {
                        const nextInput = nextRow.querySelector('input');
                        if (nextInput) {
                            nextInput.focus();
                        }
                    }
                }
            });
        }
        
        // Lot Time validation function - exactly 00:00 format
        function applyLotTimeValidation(input) {
            input.addEventListener('input', function() {
                validateLotTime(this);
                
                // Auto-save to database after each change (debounced)
                debouncedSave();
            });
            
            // Add Enter key listener for auto-formatting
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    formatLotTimeOnEnter(this);
                    
                    // Move to next row after formatting
                    const row = this.closest('tr');
                    const nextRow = row.nextElementSibling;
                    if (nextRow) {
                        const nextInput = nextRow.querySelector('input');
                        if (nextInput) {
                            nextInput.focus();
                        }
                    }
                }
            });
        }
        
        // COF Kinetic (R-S) validation function - allow typing up to 2 digits, format on Enter (L-0.10 T-0.20 U-0.35)
        function validateCOFRS(input) {
            let value = input.value;
            
            // Remove any non-numeric characters except decimal point
            value = value.replace(/[^0-9.]/g, '');
            
            // Ensure only one decimal point
            const decimalCount = (value.match(/\./g) || []).length;
            if (decimalCount > 1) {
                value = value.substring(0, value.lastIndexOf('.'));
            }
            
            // Limit to 2 digits before decimal and 2 after
            const parts = value.split('.');
            if (parts[0].length > 2) {
                parts[0] = parts[0].substring(0, 2);
            }
            if (parts[1] && parts[1].length > 2) {
                parts[1] = parts[1].substring(0, 2);
            }
            
            value = parts.join('.');
            
            // Update input value
            input.value = value;
        }
        
        // Modulus validation function - allow typing up to 2 digits, format on Enter (L-18.2 T-24.7 U-31.2)
        function validateModulus(input) {
            let value = input.value;
            
            // Remove any non-numeric characters except decimal point
            value = value.replace(/[^0-9.]/g, '');
            
            // Ensure only one decimal point
            const decimalCount = (value.match(/\./g) || []).length;
            if (decimalCount > 1) {
                value = value.substring(0, value.lastIndexOf('.'));
            }
            
            // Limit to 2 digits before decimal and 1 after
            const parts = value.split('.');
            if (parts[0].length > 2) {
                parts[0] = parts[0].substring(0, 2);
            }
            if (parts[1] && parts[1].length > 1) {
                parts[1] = parts[1].substring(0, 1);
            }
            
            value = parts.join('.');
            
            // Update input value
            input.value = value;
        }
        
        // Gloss Level validation function - allow typing up to 2 digits, format on Enter (T-7.0 U-10.0)
        function validateGlossLevel(input) {
            let value = input.value;
            
            // Remove any non-numeric characters except decimal point
            value = value.replace(/[^0-9.]/g, '');
            
            // Ensure only one decimal point
            const decimalCount = (value.match(/\./g) || []).length;
            if (decimalCount > 1) {
                value = value.substring(0, value.lastIndexOf('.'));
            }
            
            // Limit to 2 digits before decimal and 1 after
            const parts = value.split('.');
            if (parts[0].length > 2) {
                parts[0] = parts[0].substring(0, 2);
            }
            if (parts[1] && parts[1].length > 1) {
                parts[1] = parts[1].substring(0, 1);
            }
            
            value = parts.join('.');
            
            // Update input value
            input.value = value;
        }
        
        // Validation functions for sample columns
        function validateLotRoll(input) {
            let value = input.value;
            
            // Only allow numbers, dash, and double quote
            value = value.replace(/[^0-9-"]/g, '');
            
            // Ensure only one dash
            const parts = value.split('-');
            if (parts.length > 2) {
                value = parts[0] + '-' + parts.slice(1).join('');
            }
            
            // Limit to 2 digits before and after dash
            if (parts.length === 2) {
                // Before dash: max 2 digits
                if (parts[0].length > 2) {
                    parts[0] = parts[0].substring(0, 2);
                }
                // After dash: max 2 digits
                if (parts[1].length > 2) {
                    parts[1] = parts[1].substring(0, 2);
                }
                value = parts[0] + '-' + parts[1];
            } else if (parts.length === 1) {
                // No dash yet, limit to 2 digits
                if (parts[0].length > 2) {
                    parts[0] = parts[0].substring(0, 2);
                    value = parts[0];
                }
                
                // Auto-insert dash after 2 digits
                if (parts[0].length === 2 && !value.includes('-')) {
                    value = parts[0] + '-';
                }
            }
            
            // Update input value with validated format
            input.value = value;
        }
        
        function validateRollID(input) {
            let value = input.value;
            
            // Only allow numbers and double quote
            value = value.replace(/[^0-9"]/g, '');
            
            // Limit to 8 digits maximum
            if (value.length > 8) {
                value = value.substring(0, 8);
            }
            
            // Update input value with validated format
            input.value = value;
        }
        
        function validateLotTime(input) {
            let value = input.value;
            
            // Only allow numbers, colon, and double quote
            value = value.replace(/[^0-9:"]/g, '');
            
            // Ensure only one colon
            const parts = value.split(':');
            if (parts.length > 2) {
                value = parts[0] + ':' + parts.slice(1).join('');
            }
            
            // Limit to 2 digits before and after colon
            if (parts.length === 2) {
                // Before colon: max 2 digits
                if (parts[0].length > 2) {
                    parts[0] = parts[0].substring(0, 2);
                }
                // After colon: max 2 digits
                if (parts[1].length > 2) {
                    parts[1] = parts[1].substring(0, 2);
                }
                value = parts[0] + ':' + parts[1];
            } else if (parts.length === 1) {
                // No colon yet, limit to 2 digits
                if (parts[0].length > 2) {
                    parts[0] = parts[0].substring(0, 2);
                    value = parts[0];
                }
                
                // Auto-insert colon after 2 digits
                if (parts[0].length === 2 && !value.includes(':')) {
                    value = parts[0] + ':';
                }
            }
            
            // Update input value with validated format
            input.value = value;
        }
        
        // Format functions for sample columns
        function formatLotRollOnEnter(input) {
            let value = input.value.trim();
            
            // Don't auto-fill empty cells, leave them empty
            if (value === '') {
                return;
            }
            
            // Parse the value
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
        
        function formatRollIDOnEnter(input) {
            let value = input.value.trim();
            
            // Don't auto-fill empty cells, leave them empty
            if (value === '') {
                return;
            }
            
            // Parse as number
            const numValue = parseInt(value);
            
            // If not a valid number, don't format
            if (isNaN(numValue)) {
                return;
            }
            
            // Format to exactly 8 digits with leading zeros
            const formattedValue = numValue.toString().padStart(8, '0');
            
            // Update input value with formatted result
            input.value = formattedValue;
        }
        
        function formatLotTimeOnEnter(input) {
            let value = input.value.trim();
            
            // Don't auto-fill empty cells, leave them empty
            if (value === '') {
                return;
            }
            
            // Parse the value
            const parts = value.split(':');
            
            if (parts.length === 2) {
                // Format both parts to 2 digits with leading zeros
                const hours = parts[0].padStart(2, '0');
                const minutes = parts[1].padStart(2, '0');
                
                // Validate time range
                const h = parseInt(hours);
                const m = parseInt(minutes);
                
                if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
                    input.value = hours + ':' + minutes;
                } else {
                    input.value = '00:00';
                }
            } else if (parts.length === 1) {
                // Single number, treat as minutes or hours
                const num = parts[0].padStart(4, '0');
                const hours = num.substring(0, 2);
                const minutes = num.substring(2, 4);
                
                const h = parseInt(hours);
                const m = parseInt(minutes);
                
                if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
                    input.value = hours + ':' + minutes;
                } else {
                    input.value = '00:00';
                }
            } else {
                input.value = '00:00';
            }
        }
        
        // Three digit validation function - exactly 000 format (for Elongation columns)
        function applyThreeDigitValidation(input) {
            input.addEventListener('input', function() {
                validateThreeDigits(this);
                
                // Auto-save to database after each change (debounced)
                debouncedSave();
                
                // Also handle calculations (to avoid duplicate event listeners)
                const tr = this.closest('tr');
                const tableBody = tr.closest('tbody');
                
                // Calculate row averages for Pages 2, 3, 4
                if (tableBody.id !== 'testingTableBody') {
                    calculateRowAverages(tr, tableBody);
                }
                
                // Calculate summary statistics for vertical Ave columns (Page 2 & 3 only)
                if (tableBody.id === 'testingTableBody2') {
                    calculateSummaryStatistics(tableBody);
                }
                
                // Auto-save handled by consolidated input listener
            });
            
            // Add Enter key listener for auto-formatting
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    formatThreeDigitsOnEnter(this);
                    
                    // Move to next row after formatting
                    const row = this.closest('tr');
                    const nextRow = row.nextElementSibling;
                    if (nextRow) {
                        const nextInput = nextRow.querySelector('input');
                        if (nextInput) {
                            nextInput.focus();
                        }
                    }
                }
            });
        }
        
        // Two digit one decimal validation function - exactly 00.0 format (for Force and Modulus columns)
        function applyTwoDigitOneDecimalValidation(input) {
            input.addEventListener('input', function() {
                validateTwoDigitOneDecimal(this);
                
                // Auto-save to database after each change (debounced)
                debouncedSave();
                
                // Also handle calculations (to avoid duplicate event listeners)
                const tr = this.closest('tr');
                const tableBody = tr.closest('tbody');
                
                // Calculate row averages for Pages 2, 3, 4
                if (tableBody.id !== 'testingTableBody') {
                    calculateRowAverages(tr, tableBody);
                }
                
                // Calculate summary statistics for vertical Ave columns (Page 2 & 3 only)
                if (tableBody.id === 'testingTableBody2') {
                    calculateSummaryStatistics(tableBody);
                }
                
                // Auto-save handled by consolidated input listener
            });
            
            // Add Enter key listener for auto-formatting
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    formatTwoDigitOneDecimalOnEnter(this);
                    
                    // Move to next row after formatting
                    const row = this.closest('tr');
                    const nextRow = row.nextElementSibling;
                    if (nextRow) {
                        const nextInput = nextRow.querySelector('input');
                        if (nextInput) {
                            nextInput.focus();
                        }
                    }
                }
            });
        }
        
        // One digit one decimal validation function - exactly 0.0 format (for Force 5% columns)
        function applyOneDigitOneDecimalValidation(input) {
            input.addEventListener('input', function() {
                validateOneDigitOneDecimal(this);
                
                // Auto-save to database after each change (debounced)
                debouncedSave();
                
                // Also handle calculations (to avoid duplicate event listeners)
                const tr = this.closest('tr');
                const tableBody = tr.closest('tbody');
                
                // Calculate row averages for Pages 2, 3, 4
                if (tableBody.id !== 'testingTableBody') {
                    calculateRowAverages(tr, tableBody);
                }
                
                // Calculate summary statistics for vertical Ave columns (Page 2 & 3 only)
                if (tableBody.id === 'testingTableBody2') {
                    calculateSummaryStatistics(tableBody);
                }
                
                // Auto-save handled by consolidated input listener
            });
            
            // Add Enter key listener for auto-formatting
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    formatOneDigitOneDecimalOnEnter(this);
                    
                    // Move to next row after formatting
                    const row = this.closest('tr');
                    const nextRow = row.nextElementSibling;
                    if (nextRow) {
                        const nextInput = nextRow.querySelector('input');
                        if (nextInput) {
                            nextInput.focus();
                        }
                    }
                }
            });
        }
        
        // Validation functions for different formats
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
        
        function validateTwoDigitOneDecimal(input) {
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
                // After decimal: max 1 digit
                if (parts[1].length > 1) {
                    parts[1] = parts[1].substring(0, 1);
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
        
        function validateOneDigitOneDecimal(input) {
            let value = input.value;
            
            // Remove any non-numeric characters except decimal point
            value = value.replace(/[^0-9.]/g, '');
            
            // Ensure only one decimal point
            const parts = value.split('.');
            if (parts.length > 2) {
                value = parts[0] + '.' + parts.slice(1).join('');
            }
            
            // Allow up to 1 digit before decimal for typing
            if (parts.length === 2) {
                // Before decimal: allow up to 1 digit
                if (parts[0].length > 1) {
                    parts[0] = parts[0].substring(0, 1);
                }
                // After decimal: max 1 digit
                if (parts[1].length > 1) {
                    parts[1] = parts[1].substring(0, 1);
                }
                value = parts[0] + '.' + parts[1];
            } else if (parts.length === 1) {
                // No decimal point yet, allow up to 1 digit for typing
                if (parts[0].length > 1) {
                    parts[0] = parts[0].substring(0, 1);
                    value = parts[0];
                }
            }
            
            // Update input value with validated format
            input.value = value;
        }
        
        // Format functions for different formats
        function formatThreeDigitsOnEnter(input) {
            let value = input.value.trim();
            
            // If empty, leave it empty (don't set default values)
            if (value === '') {
                return;
            }
            
            // Parse as number
            const numValue = parseInt(value);
            
            // If not a valid number, set to 000
            if (isNaN(numValue)) {
                input.value = '000';
                return;
            }
            
            // Ensure value is between 0 and 999
            if (numValue < 0) {
                input.value = '000';
                return;
            }
            if (numValue > 999) {
                input.value = '999';
                return;
            }
            
            // Format to exactly 3 digits with leading zeros
            const formattedValue = numValue.toString().padStart(3, '0');
            
            // Update input value with formatted result
            input.value = formattedValue;
        }
        
        function formatTwoDigitOneDecimalOnEnter(input) {
            let value = input.value.trim();
            
            // If empty, leave it empty (don't set default values)
            if (value === '') {
                return;
            }
            
            // Parse as number
            const numValue = parseFloat(value);
            
            // If not a valid number, set to 00.0
            if (isNaN(numValue)) {
                input.value = '00.0';
                return;
            }
            
            // Ensure value is between 0 and 99.9
            if (numValue < 0) {
                input.value = '00.0';
                return;
            }
            if (numValue > 99.9) {
                input.value = '99.9';
                return;
            }
            
            // Format to exactly 1 decimal place
            const formattedValue = numValue.toFixed(1);
            
            // Don't add leading zeros - keep natural format (e.g., 9.9 stays 9.9, not 09.9)
            input.value = formattedValue;
        }
        
        function formatOneDigitOneDecimalOnEnter(input) {
            let value = input.value.trim();
            
            // If empty, leave it empty (don't set default values)
            if (value === '') {
                return;
            }
            
            // Parse as number
            const numValue = parseFloat(value);
            
            // If not a valid number, set to 0.0
            if (isNaN(numValue)) {
                input.value = '0.0';
                return;
            }
            
            // Ensure value is between 0 and 9.9
            if (numValue < 0) {
                input.value = '0.0';
                return;
            }
            if (numValue > 9.9) {
                input.value = '9.9';
                return;
            }
            
            // Format to exactly 1 decimal place
            const formattedValue = numValue.toFixed(1);
            
            // Update input value with formatted result
            input.value = formattedValue;
        }
        
        // Apply validation to existing sample inputs (Page 1, columns 0, 1, 2)
        function applyValidationToExistingSampleInputs() {
            // Lot & Roll inputs (column 1)
            const lotRollInputs = testingTableBody.querySelectorAll('tr td:nth-child(1) input');
            lotRollInputs.forEach(input => {
                applyLotRollValidation(input);
            });
            
            // Roll ID inputs (column 2)
            const rollIDInputs = testingTableBody.querySelectorAll('tr td:nth-child(2) input');
            rollIDInputs.forEach(input => {
                applyRollIDValidation(input);
            });
            
            // Lot Time inputs (column 3)
            const lotTimeInputs = testingTableBody.querySelectorAll('tr td:nth-child(3) input');
            lotTimeInputs.forEach(input => {
                applyLotTimeValidation(input);
            });
        }
        
        // Apply validation to existing thickness inputs (Page 1, column 4)
        function applyValidationToExistingThicknessInputs() {
            const thicknessInputs = testingTableBody.querySelectorAll('tr td:nth-child(5) input');
            thicknessInputs.forEach(input => {
                applyThicknessValidation(input);
            });
        }


        
        // Apply validation to existing opacity inputs (Page 1, column 5)
        function applyValidationToExistingOpacityInputs() {
            const opacityInputs = testingTableBody.querySelectorAll('tr td:nth-child(6) input');
            opacityInputs.forEach(input => {
                applyOpacityValidation(input);
            });
        }

        
        // Apply validation to existing COF inputs (Page 1, column 6)
        function applyValidationToExistingCOFInputs() {
            const cofInputs = testingTableBody.querySelectorAll('tr td:nth-child(7) input');
            cofInputs.forEach(input => {
                applyCOFValidation(input);
            });
        }
        
        // Color L validation function - allow decimal values
        function applyColorLValidation(input) {
            input.addEventListener('input', function() {
                validateColorL(this);
                
                // Auto-save to database after each change (debounced)
                debouncedSave();
                
                // Force immediate recalculation of ALL summary statistics for instant sync
                triggerSummaryRecalculation();
            });
        }
        
        // Color A validation function - allow decimal values
        function applyColorAValidation(input) {
            input.addEventListener('input', function() {
                validateColorA(this);
                
                // Auto-save to database after each change (debounced)
                debouncedSave();
                
                // Force immediate recalculation of ALL summary statistics for instant sync
                triggerSummaryRecalculation();
            });
        }
        
        // Color B validation function - allow decimal values
        function applyColorBValidation(input) {
            input.addEventListener('input', function() {
                validateColorB(this);
                
                // Auto-save to database after each change (debounced)
                debouncedSave();
                
                // Force immediate recalculation of ALL summary statistics for instant sync
                triggerSummaryRecalculation();
            });
        }
        
        // Color Delta E validation function - allow decimal values
        function applyColorDeltaEValidation(input) {
            input.addEventListener('input', function() {
                validateColorDeltaE(this);
                
                // Auto-save to database after each change (debounced)
                debouncedSave();
                
                // Force immediate recalculation of ALL summary statistics for instant sync
                triggerSummaryRecalculation();
            });
            
            // Add Enter key listener for auto-formatting
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    formatColorDeltaEOnEnter(this);
                    
                    // Move to next row after formatting
                    const row = this.closest('tr');
                    const nextRow = row.nextElementSibling;
                    if (nextRow) {
                        const nextInput = nextRow.querySelector('input');
                        if (nextInput) {
                            nextInput.focus();
                        }
                    }
                }
            });
        }
        
        // Color L validation - allow decimal values
        function validateColorL(input) {
            let value = input.value;
            
            // Remove any non-numeric characters except decimal point and minus sign
            value = value.replace(/[^0-9.-]/g, '');
            
            // Ensure only one decimal point
            const parts = value.split('.');
            if (parts.length > 2) {
                value = parts[0] + '.' + parts.slice(1).join('');
            }
            
            // Allow up to 3 digits before decimal and 1 after
            if (parts.length === 2) {
                if (parts[0].length > 3) {
                    parts[0] = parts[0].substring(0, 3);
                }
                if (parts[1].length > 1) {
                    parts[1] = parts[1].substring(0, 1);
                }
                value = parts[0] + '.' + parts[1];
            } else if (parts.length === 1) {
                if (parts[0].length > 3) {
                    parts[0] = parts[0].substring(0, 3);
                    value = parts[0];
                }
            }
            
            input.value = value;
        }
        
        // Color A validation - allow decimal values
        function validateColorA(input) {
            let value = input.value;
            
            // Remove any non-numeric characters except decimal point and minus sign
            value = value.replace(/[^0-9.-]/g, '');
            
            // Ensure only one decimal point
            const parts = value.split('.');
            if (parts.length > 2) {
                value = parts[0] + '.' + parts.slice(1).join('');
            }
            
            // Allow up to 2 digits before decimal and 1 after
            if (parts.length === 2) {
                if (parts[0].length > 2) {
                    parts[0] = parts[0].substring(0, 2);
                }
                if (parts[1].length > 1) {
                    parts[1] = parts[1].substring(0, 1);
                }
                value = parts[0] + '.' + parts[1];
            } else if (parts.length === 1) {
                if (parts[0].length > 2) {
                    parts[0] = parts[0].substring(0, 2);
                    value = parts[0];
                }
            }
            
            input.value = value;
        }
        
        // Color B validation - allow decimal values
        function validateColorB(input) {
            let value = input.value;
            
            // Remove any non-numeric characters except decimal point and minus sign
            value = value.replace(/[^0-9.-]/g, '');
            
            // Ensure only one decimal point
            const parts = value.split('.');
            if (parts.length > 2) {
                value = parts[0] + '.' + parts.slice(1).join('');
            }
            
            // Allow up to 2 digits before decimal and 1 after
            if (parts.length === 2) {
                if (parts[0].length > 2) {
                    parts[0] = parts[0].substring(0, 2);
                }
                if (parts[1].length > 1) {
                    parts[1] = parts[1].substring(0, 1);
                }
                value = parts[0] + '.' + parts[1];
            } else if (parts.length === 1) {
                if (parts[0].length > 2) {
                    parts[0] = parts[0].substring(0, 2);
                    value = parts[0];
                }
            }
            
            input.value = value;
        }
        
        // Color Delta E validation - allow decimal values
        function validateColorDeltaE(input) {
            let value = input.value;
            
            // Remove any non-numeric characters except decimal point
            value = value.replace(/[^0-9.]/g, '');
            
            // Ensure only one decimal point
            const parts = value.split('.');
            if (parts.length > 2) {
                value = parts[0] + '.' + parts.slice(1).join('');
            }
            
            // Allow up to 2 digits before decimal and 2 after
            if (parts.length === 2) {
                if (parts[0].length > 2) {
                    parts[0] = parts[0].substring(0, 2);
                }
                if (parts[1].length > 2) {
                    parts[1] = parts[1].substring(0, 2);
                }
                value = parts[0] + '.' + parts[1];
            } else if (parts.length === 1) {
                if (parts[0].length > 2) {
                    parts[0] = parts[0].substring(0, 2);
                    value = parts[0];
                }
            }
            
            input.value = value;
        }
        
        // Format Color Delta E to 0.00 format on Enter key
        function formatColorDeltaEOnEnter(input) {
            let value = input.value.trim();
            
            // If empty, leave it empty (don't set default values)
            if (value === '') {
                return;
            }
            
            // Parse as number
            const numValue = parseFloat(value);
            
            // If not a valid number, set to 0.00
            if (isNaN(numValue)) {
                input.value = '0.00';
                return;
            }
            
            // Ensure value is between 0 and 99.99
            if (numValue < 0) {
                input.value = '0.00';
                return;
            }
            if (numValue > 99.99) {
                input.value = '99.99';
                return;
            }
            
            // Format to exactly 2 decimal places (0.00 format)
            const formattedValue = numValue.toFixed(2);
            
            // Update input value with formatted result
            input.value = formattedValue;
        }
        
        
        // Apply validation to existing Page 2 inputs
        function applyValidationToExistingPage2Inputs() {
            // Elongation MD columns (000 format)
            const elongationInputs = testingTableBody2.querySelectorAll('tr td:nth-child(4) input, tr td:nth-child(5) input, tr td:nth-child(6) input');
            elongationInputs.forEach(input => {
                applyThreeDigitValidation(input);
            });
            
            // Force MD columns (00.0 format)
            const forceInputs = testingTableBody2.querySelectorAll('tr td:nth-child(8) input, tr td:nth-child(9) input, tr td:nth-child(10) input');
            forceInputs.forEach(input => {
                applyTwoDigitOneDecimalValidation(input);
            });
            
            // Force 5% MD columns (0.0 format)
            const force5pInputs = testingTableBody2.querySelectorAll('tr td:nth-child(12) input, tr td:nth-child(13) input, tr td:nth-child(14) input');
            force5pInputs.forEach(input => {
                applyOneDigitOneDecimalValidation(input);
            });
        }
        
        

        // PG Quality System Requirements validation (Pass=0, Fail=1)
        function applyPGQualityValidation(input) {
            input.addEventListener('input', function() {
                validatePGQuality(this);
                
                // Auto-save to database after each change (debounced)
                debouncedSave();
                
                // Force immediate recalculation of ALL summary statistics for instant sync
                triggerSummaryRecalculation();
            });
            
            // Add Enter key listener for auto-formatting
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    formatPGQualityOnEnter(this);
                    
                    // Move to next row after formatting
                    const row = this.closest('tr');
                    const nextRow = row.nextElementSibling;
                    if (nextRow) {
                        const nextInput = nextRow.querySelector('input');
                        if (nextInput) {
                            nextInput.focus();
                        }
                    }
                }
            });
        }

        // Validate PG Quality input (only 0 or 1 allowed)
        function validatePGQuality(input) {
            let value = input.value.trim();
            
            // Only allow 0 or 1, but don't clear if user is still typing
            if (value === '0' || value === '1') {
                input.value = value;
            } else if (value === '') {
                // Allow empty for now
                input.value = '';
            } else if (value.length === 1 && (value === '0' || value === '1')) {
                // Single character 0 or 1 is valid
                input.value = value;
            } else if (value.length > 1) {
                // If more than 1 character, keep only the last valid character
                const lastChar = value.slice(-1);
                if (lastChar === '0' || lastChar === '1') {
                    input.value = lastChar;
                } else {
                    // If last character is not valid, keep previous valid value
                    input.value = input.value.slice(0, -1);
                }
            }
        }

        // Format PG Quality on Enter (Pass=0, Fail=1)
        function formatPGQualityOnEnter(input) {
            let value = input.value.trim();
            
            if (value === '0') {
                input.value = '0'; // Pass
            } else if (value === '1') {
                input.value = '1'; // Fail
            } else if (value === '') {
                input.value = '';
            } else {
                // Clear invalid input
                input.value = '';
            }
        }


        function applyColorFormatting(input, columnType) {
            const value = parseFloat(input.value);
            
            // Remove existing color classes and inline styles
            input.classList.remove('text-red-600', 'bg-red-50', 'border-red-300');
            input.style.color = '';
            input.style.backgroundColor = '';
            input.style.borderColor = '';
            input.style.borderWidth = '';
            input.style.borderStyle = '';
            
        // Apply red formatting based on column type
        let shouldHighlight = false;
        
        
        switch(columnType) {
            // Page 1
            case 'basicWeight':
                shouldHighlight = !isNaN(value) && value !== 0 && value !== '' && (value < 14 || value > 18);
                break;
            case 'thickness':
                shouldHighlight = !isNaN(value) && value !== 0 && value !== '' && (value < 0.025 || value > 0.035);
                break;
            case 'opacity':
                shouldHighlight = !isNaN(value) && value !== 0 && value !== '' && (value < 45.0 || value > 55.0);
                break;
            case 'cof':
                shouldHighlight = !isNaN(value) && value !== 0 && value !== '' && (value < 0.20 || value > 0.60);
                break;
            // Page 2
            case 'elongationMD':
                // Only check lower limit (L-350), ignore upper limit (T-450)
                shouldHighlight = !isNaN(value) && value < 350;
                break;
            case 'forceMD':
                // Only check lower limit (L-9.0), ignore upper limit (T-12.0)
                shouldHighlight = !isNaN(value) && value < 9.0;
                break;
            case 'force5pMD':
                shouldHighlight = !isNaN(value) && (value < 2.5 || value > 5.5);
                break;
            case 'elongationCD':
                // Only check lower limit (L-400), ignore upper limit (T-500)
                shouldHighlight = !isNaN(value) && value < 400;
                break;
            case 'forceCD':
                // Only check lower limit (L-6.0), ignore upper limit (T-9.0)
                shouldHighlight = !isNaN(value) && value < 6.0;
                break;
            case 'modulus':
                shouldHighlight = !isNaN(value) && (value < 20.0 || value > 40.0);
                break;
            case 'colorL':
                shouldHighlight = !isNaN(value) && (value < 90.6 || value > 98.6);
                break;
            case 'colorA':
                // Only check lower limit (L-(-5.1)), ignore upper limit (T-(-1.1))
                // For negative values: red if value is ABOVE -5.1 (i.e., value > -5.1)
                shouldHighlight = !isNaN(value) && value > -5.1;
                break;
            case 'colorB':
                // Only check lower limit (L-(-3.6)), ignore upper limit (T-0.4)
                // For negative values: red if value is ABOVE -3.6 (i.e., value > -3.6)
                shouldHighlight = !isNaN(value) && value > -3.6;
                break;
            case 'colorDeltaE':
                // Only check upper limit (U-5.00), ignore target (T-0.00)
                shouldHighlight = !isNaN(value) && value > 5.00;
                break;
            case 'gloss':
                // Gloss specs: T=9.0, U=11.0 - ONLY highlight values above U (no lower limit)
                shouldHighlight = !isNaN(value) && value > 11.0;
                break;
            case 'pgQuality':
                // Pass=0, Fail=1 - highlight if value is 1 (Fail)
                shouldHighlight = !isNaN(value) && value === 1;
                break;
        }
        
        if (shouldHighlight) {
            if (viewMode) {
                // In view mode: ONLY red text, no boxes or borders
                input.style.setProperty('color', '#dc2626', 'important');
            } else {
                // In edit mode: full highlighting with boxes/borders
                if (columnType === 'colorDeltaE') {
                    input.classList.add('oos-highlight');
                } else {
                    // Use inline styles for disabled inputs to ensure visibility
                    if (input.disabled || input.readOnly) {
                        input.style.setProperty('color', '#dc2626', 'important');
                        input.style.setProperty('background-color', '#fef2f2', 'important');
                        input.style.setProperty('border-color', '#dc2626', 'important');
                        input.style.setProperty('border-width', '2px', 'important');
                        input.style.setProperty('border-style', 'solid', 'important');
                    } else {
                        input.classList.add('text-red-600', 'bg-red-50', 'border-red-300');
                    }
                }
            }
        } else {
            // Remove any existing highlighting
            input.classList.remove('oos-highlight', 'text-red-600', 'bg-red-50', 'border-red-300');
            input.style.color = '';
            input.style.backgroundColor = '';
            input.style.borderColor = '';
            input.style.borderWidth = '';
            input.style.borderStyle = '';
        }
    }

        
        // Clear all conditional formatting (for view mode)
        function clearAllConditionalFormatting() {
            const allInputs = document.querySelectorAll('input');
            allInputs.forEach(input => {
                // Remove all conditional formatting classes and styles
                input.classList.remove('oos-highlight', 'text-red-600', 'bg-red-50', 'border-red-300');
                input.style.color = '';
                input.style.backgroundColor = '';
                input.style.borderColor = '';
                input.style.borderWidth = '';
                input.style.borderStyle = '';
            });
        }
        
        // Placeholder for validation functions - will be implemented as needed
         // validateNumericInput()
         // validateDecimalInput() 
         // validatePercentageInput()
         // validateTimeInput()
         // validateAlphanumericInput()
         }
         
    // Fix tab order for all existing rows on page load
    updateTabOrderForAllRows(testingTableBody);
    updateTabOrderForAllRows(testingTableBody2);
    
    // Initialize verification functionality
    initializeVerification();
    }
       }
});
