import { supabase } from '../supabase-config.js';

// Global variables
let currentExtinguisherId = null;
let currentExtinguisherNo = null;

// DOM elements - These will be null since we're using a static HTML form
const form = null;
const extinguisherNo = null;
const extinguisherType = null;
const location = null;
const capacity = null;
const formDate = null;
const expiryDate = null;
const refilledDate = null;
const checkedBy = null;
const verifiedBy = null;
const inspectionDate = null;
const nextDueDate = null;
const inspector = null;
const remarks = null;

// Checkbox elements - These will be null since we're using a static HTML form
const pinSeal = null;
const pressure = null;
const hoseNozzle = null;
const handleKnob = null;
const dentRustLeak = null;
const easyAccess = null;

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    await loadUserProfile();
    setFormDefaults();
    await loadExistingFireExtinguisherData();
    setupEventListeners();
    
    // Additional security for public access
    setupPublicAccessSecurity();
    
    // Hide download QR button for public access (QR code access)
    hideDownloadQRButtonForPublicAccess();
});

// Load user profile
async function loadUserProfile() {
    const userNameElement = document.querySelector('.user-name');
    const backButton = document.getElementById('backButton');

    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
            // User is not authenticated - public access mode
            console.log('Public access mode - no authentication required');
            
            // Hide back button for public access
            if (backButton) {
                backButton.style.display = 'none';
            }
            
            // Remove user name display for public access
            if (userNameElement) {
                userNameElement.style.display = 'none';
            }
            
            return; // Don't redirect - allow public access
        }

        // User is authenticated - show back button and user info
        if (backButton) {
            backButton.style.display = 'block';
        }

        if (userNameElement) {
            try {
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('full_name')
                .eq('id', user.id)
                .single();

            if (profileError) throw profileError;

            if (profile && profile.full_name) {
                userNameElement.textContent = 'Hi, ' + profile.full_name;
            } else {
                userNameElement.textContent = 'Hi, ' + (user.email || 'Admin');
            }
            } catch (error) {
                console.error('Error loading user profile:', error);
                userNameElement.textContent = 'Hi, Admin';
            }
        }
    } catch (error) {
        console.error('Error checking authentication:', error);
        
        // On error, treat as public access
        if (backButton) {
            backButton.style.display = 'none';
        }
        if (userNameElement) {
            userNameElement.style.display = 'none';
        }
    }
}

// Set form defaults
function setFormDefaults() {
    // Since we're using a static HTML form, we don't need to set form defaults
    // The form will be populated when viewing existing data
    console.log('Form defaults set - using static HTML form');
}

// Load existing Fire Extinguisher data if accessed via View button
async function loadExistingFireExtinguisherData() {
    const urlParams = new URLSearchParams(window.location.search);
    const extinguisherId = urlParams.get('extinguisher_id');
    const extinguisherNo = urlParams.get('extinguisher_no');

    // Only try to load data if we have both parameters
    if (extinguisherId && extinguisherNo) {
        try {
            console.log('Loading fire extinguisher data for ID:', extinguisherId, 'No:', extinguisherNo);
            
            const { data: extinguisher, error } = await supabase
                .from('fire_extinguishers')
                .select('*')
                .eq('id', extinguisherId)
                .single();

            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }

            if (extinguisher) {
                console.log('Fire extinguisher data loaded successfully:', extinguisher);
                populateFormWithExistingData(extinguisher);
            } else {
                console.log('No fire extinguisher found with ID:', extinguisherId);
            }
        } catch (error) {
            console.error('Error loading existing Fire Extinguisher data:', error);
            
            // Don't show error message for public access (QR code access)
            const userNameElement = document.querySelector('.user-name');
            const backButton = document.getElementById('backButton');
            const isPublicAccess = (backButton && backButton.style.display === 'none') || 
                                  (userNameElement && userNameElement.style.display === 'none');
            
            if (!isPublicAccess) {
                showErrorMessage('Error loading Fire Extinguisher data. Please try again.');
            }
        }
    } else {
        console.log('No extinguisher ID or number provided in URL parameters');
    }
}

// Populate form with existing data
function populateFormWithExistingData(extinguisher) {
    // Convert FE number from database format (FE-001) to display format (1)
    let numericValue = extinguisher.extinguisher_no;
    if (extinguisher.extinguisher_no.includes('FE-')) {
        numericValue = extinguisher.extinguisher_no.replace('FE-', '').replace(/^0+/, '') || '0';
    } else if (extinguisher.extinguisher_no.match(/^\d+$/)) {
        numericValue = extinguisher.extinguisher_no.replace(/^0+/, '') || '0';
    }

    // Populate the top section fields
    populateTopSectionFields(extinguisher, numericValue);
    
    // Populate inspection history in the table
    populateInspectionTable(extinguisher);

    // Don't change the main header title - keep it as "Fire Extinguisher Inspection Form"

    // Store extinguisher ID for form submission
    currentExtinguisherId = extinguisher.id;
    currentExtinguisherNo = extinguisher.extinguisher_no;
}

// Populate the top section fields
function populateTopSectionFields(extinguisher, numericValue) {
    // Find the table cells in the top section and populate them
    const topTable = document.querySelector('table[style*="border: 1px solid #000"]');
    if (topTable) {
        const cells = topTable.querySelectorAll('td');
        
        // First row: Type, Number, Location, Capacity
        if (cells.length >= 8) {
            cells[1].textContent = extinguisher.type_of_extinguisher || '';
            cells[1].style.textAlign = 'center';
            cells[3].textContent = numericValue;
            cells[3].style.textAlign = 'center';
            cells[5].textContent = extinguisher.location || '';
            cells[5].style.textAlign = 'center';
            cells[7].textContent = (extinguisher.capacity || '') + ' Kgs';
            cells[7].style.textAlign = 'center';
        }
        
        // Second row: Date, Refilled Date, Expiry Date
        if (cells.length >= 14) {
            const today = new Date();
            const formattedToday = formatDate(today);
            cells[9].textContent = formattedToday;
            cells[9].style.textAlign = 'center';
            
            // Get refilled date and expiry date from the latest inspection
            let refilledDate = '';
            let expiryDate = '';
            
            if (extinguisher.inspection_data && extinguisher.inspection_data.inspections && 
                extinguisher.inspection_data.inspections.length > 0) {
                // Sort inspections by date (newest first) and get the latest one
                const sortedInspections = extinguisher.inspection_data.inspections
                    .filter(inspection => inspection.date)
                    .sort((a, b) => new Date(b.date) - new Date(a.date));
                
                if (sortedInspections.length > 0) {
                    const latestInspection = sortedInspections[0];
                    refilledDate = latestInspection.refilled_date || '';
                    expiryDate = latestInspection.expiry_date || '';
                }
            }
            
            // If not found in inspection data, try extinguisher data
            if (!refilledDate && extinguisher.refilled_date) {
                refilledDate = extinguisher.refilled_date;
            }
            if (!expiryDate && extinguisher.expiry_date) {
                expiryDate = extinguisher.expiry_date;
            }
            
            // Format and display the dates
            if (refilledDate) {
                const refilledDateObj = new Date(refilledDate);
                cells[11].textContent = formatDate(refilledDateObj);
            } else {
                cells[11].textContent = '';
            }
            cells[11].style.textAlign = 'center';
            
            if (expiryDate) {
                const expiryDateObj = new Date(expiryDate);
                cells[13].textContent = formatDate(expiryDateObj);
            } else {
                cells[13].textContent = '';
            }
            cells[13].style.textAlign = 'center';
        }
    }
}

// Format date as dd/mm/yyyy
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// Populate inspection history in the table
function populateInspectionTable(extinguisher) {
    if (!extinguisher.inspection_data || !extinguisher.inspection_data.inspections) {
        return;
    }

    const inspections = extinguisher.inspection_data.inspections;
    const tableBody = document.querySelector('table[style*="border: 2px solid #000"] tbody');
    
    if (!tableBody) return;

    // Clear existing data rows
    const existingRows = tableBody.querySelectorAll('tr:not(:first-child):not(:nth-child(2))');
    existingRows.forEach(row => row.remove());

    // Add inspection history rows
    inspections.forEach((inspection, index) => {
        if (index >= 12) return; // Limit to 12 rows
        
        // Format dates
        const inspectionDate = inspection.date ? formatDate(new Date(inspection.date)) : '';
        const nextDueDate = inspection.next_due_date ? formatDate(new Date(inspection.next_due_date)) : '';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="border: 1px solid #000; padding: 8px; text-align: center; height: 40px;">${inspectionDate}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; height: 40px;">${nextDueDate}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; height: 40px;">${inspection.inspector || ''}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; height: 40px;">${inspection.pin_seal ? '✔' : '✕'}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; height: 40px;">${inspection.pressure ? '✔' : '✕'}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; height: 40px;">${inspection.hose_nozzle ? '✔' : '✕'}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; height: 40px;">${inspection.handle_knob ? '✔' : '✕'}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; height: 40px;">${inspection.dent_rust_leak ? '✔' : '✕'}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; height: 40px;">${inspection.easy_access ? '✔' : '✕'}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; height: 40px;">${inspection.remarks || ''}</td>
        `;
        tableBody.appendChild(row);
    });

    // Fill remaining rows with empty cells if needed
    const remainingRows = 12 - inspections.length;
    for (let i = 0; i < remainingRows; i++) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="border: 1px solid #000; padding: 8px; text-align: center; height: 40px;"></td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; height: 40px;"></td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; height: 40px;"></td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; height: 40px;"></td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; height: 40px;"></td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; height: 40px;"></td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; height: 40px;"></td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; height: 40px;"></td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; height: 40px;"></td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; height: 40px;"></td>
        `;
        tableBody.appendChild(row);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Since we're using a static HTML form for viewing, we don't need form submission listeners
    console.log('Event listeners set up - using static HTML form for viewing');
}

// Handle form submission
async function handleFormSubmit(event) {
    event.preventDefault();
    
    // Validate required fields
    const requiredFields = [
        'extinguisherNo', 'extinguisherType', 'location', 'capacity', 
        'formDate', 'expiryDate', 'inspectionDate', 'nextDueDate', 'inspector'
    ];

    const missingFields = [];
    requiredFields.forEach(fieldName => {
        const field = document.getElementById(fieldName);
        if (!field || !field.value.trim()) {
            missingFields.push(fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()));
        }
    });

    if (missingFields.length > 0) {
        showErrorMessage(`Please fill in all required fields:\n\n${missingFields.join('\n')}`);
        return;
    }
    
    // Validate at least one checkbox is selected
    const checkboxes = [pinSeal, pressure, hoseNozzle, handleKnob, dentRustLeak, easyAccess];
    const isAnyCheckboxSelected = checkboxes.some(checkbox => checkbox && checkbox.checked);

    if (!isAnyCheckboxSelected) {
        showErrorMessage('Please select at least one inspection checklist item.');
        return;
    }

    try {
        // Prepare inspection data
        const inspectionData = {
            extinguisher_no: extinguisherNo.value.trim(),
            type: extinguisherType.value,
            location: location.value.trim(),
            capacity: capacity.value,
            form_date: formDate.value,
            expiry_date: expiryDate.value,
            refilled_date: refilledDate.value || null,
            checked_by: checkedBy.value.trim() || null,
            verified_by: verifiedBy.value.trim() || null,
            inspection_date: inspectionDate.value,
            next_due_date: nextDueDate.value,
            inspector: inspector.value.trim(),
            remarks: remarks.value.trim() || null,
            pin_seal: pinSeal.checked,
            pressure: pressure.checked,
            hose_nozzle: hoseNozzle.checked,
            handle_knob: handleKnob.checked,
            dent_rust_leak: dentRustLeak.checked,
            easy_access: easyAccess.checked
        };

        // Save inspection
        await saveInspection(inspectionData);

        showSuccessMessage('Inspection saved successfully!');
        
        // Redirect back to management page
        setTimeout(() => {
            window.location.href = 'fire_extinguisher_mgmt.html';
        }, 1500);

    } catch (error) {
        console.error('Error saving inspection:', error);
        showErrorMessage('Error saving inspection. Please try again.');
    }
}

// Save inspection to database
async function saveInspection(inspectionData) {
    const numericValue = inspectionData.extinguisher_no.trim();
    const databaseFormat = `FE-${numericValue.padStart(3, '0')}`;

    let extinguisherId = currentExtinguisherId;

    // If no existing extinguisher ID, find or create the extinguisher
    if (!extinguisherId) {
        try {
            // Try to find existing extinguisher
            const { data: existingExtinguisher, error: findError } = await supabase
                .from('fire_extinguishers')
                .select('id')
                .eq('extinguisher_no', databaseFormat)
                .single();

            if (findError && findError.code !== 'PGRST116') { // PGRST116 = not found
                throw findError;
            }

            if (existingExtinguisher) {
                extinguisherId = existingExtinguisher.id;
            } else {
                // Create new extinguisher
                const newExtinguisherData = {
                    extinguisher_no: databaseFormat,
                    type_of_extinguisher: inspectionData.type,
                    location: inspectionData.location,
                    capacity: inspectionData.capacity,
                    inspection_data: { inspections: [] }
                };

                const { data: newExtinguisher, error: createError } = await supabase
                    .from('fire_extinguishers')
                    .insert([newExtinguisherData])
                    .select()
                    .single();

                if (createError) throw createError;
                extinguisherId = newExtinguisher.id;
            }
        } catch (error) {
            throw new Error(`Failed to find or create Fire Extinguisher: ${error.message}`);
        }
    }

    // Get current inspection data
    const { data: currentData, error: fetchError } = await supabase
        .from('fire_extinguishers')
        .select('inspection_data')
        .eq('id', extinguisherId)
        .single();

    if (fetchError) throw fetchError;

    // Prepare new inspection record
    const newInspection = {
        date: inspectionData.inspection_date,
        inspector: inspectionData.inspector,
        next_due_date: inspectionData.next_due_date,
        form_date: inspectionData.form_date,
        expiry_date: inspectionData.expiry_date,
        refilled_date: inspectionData.refilled_date,
        checked_by: inspectionData.checked_by,
        verified_by: inspectionData.verified_by,
        capacity: inspectionData.capacity,
        pin_seal: inspectionData.pin_seal,
        pressure: inspectionData.pressure,
        hose_nozzle: inspectionData.hose_nozzle,
        handle_knob: inspectionData.handle_knob,
        dent_rust_leak: inspectionData.dent_rust_leak,
        easy_access: inspectionData.easy_access,
        remarks: inspectionData.remarks,
        status: getInspectionStatus(inspectionData.next_due_date)
    };

    // Update inspection data
    const updatedInspectionData = currentData.inspection_data || { inspections: [] };
    updatedInspectionData.inspections = updatedInspectionData.inspections || [];
    updatedInspectionData.inspections.push(newInspection);

    // Update database
    const { error: updateError } = await supabase
        .from('fire_extinguishers')
        .update({ 
            inspection_data: updatedInspectionData,
            type_of_extinguisher: inspectionData.type,
            location: inspectionData.location,
            capacity: inspectionData.capacity
        })
        .eq('id', extinguisherId);

    if (updateError) throw updateError;
}

// Get inspection status based on next due date
function getInspectionStatus(nextDueDate) {
    const today = new Date();
    const dueDate = new Date(nextDueDate);
    const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) {
        return 'Expired';
    } else if (daysUntilDue <= 30) {
        return 'Service Due';
    } else {
        return 'Active';
    }
}

// Show success message
function showSuccessMessage(message) {
    alert(message); // You can replace this with a better notification system
}

// Show error message
function showErrorMessage(message) {
    alert(message);
}

// Setup public access security
function setupPublicAccessSecurity() {
    // Prevent right-click context menu
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });
    
    // Prevent keyboard shortcuts for navigation
    document.addEventListener('keydown', function(e) {
        // Prevent F5 refresh
        if (e.key === 'F5') {
            e.preventDefault();
        }
        
        // Prevent Ctrl+R refresh
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
        }
        
        // Prevent Ctrl+Shift+R hard refresh
        if (e.ctrlKey && e.shiftKey && e.key === 'R') {
            e.preventDefault();
        }
        
        // Prevent backspace navigation
        if (e.key === 'Backspace' && !isInputField(e.target)) {
            e.preventDefault();
        }
    });
    
    // Prevent drag and drop
    document.addEventListener('dragstart', function(e) {
        e.preventDefault();
    });
    
    // Prevent text selection (optional - comment out if you want to allow text selection)
    // document.addEventListener('selectstart', function(e) {
    //     e.preventDefault();
    // });
}

// Hide download QR button for public access
function hideDownloadQRButtonForPublicAccess() {
    const downloadQRButton = document.getElementById('downloadQRButton');
    
    if (downloadQRButton) {
        // Check if user is not authenticated (public access)
        const userNameElement = document.querySelector('.user-name');
        const backButton = document.getElementById('backButton');
        
        // If back button is hidden and user name is hidden, it's public access
        const isPublicAccess = (backButton && backButton.style.display === 'none') || 
                              (userNameElement && userNameElement.style.display === 'none');
        
        if (isPublicAccess) {
            downloadQRButton.style.display = 'none';
            console.log('Download QR button hidden for public access');
        } else {
            downloadQRButton.style.display = 'block';
            console.log('Download QR button visible for authenticated users');
        }
    }
}

// Check if element is an input field
function isInputField(element) {
    return element.tagName === 'INPUT' || 
           element.tagName === 'TEXTAREA' || 
           element.tagName === 'SELECT' ||
           element.contentEditable === 'true';
}

// Download QR Code function
window.downloadQRCode = async function() {
    // Get the current page URL
    const currentURL = window.location.href;
    
    // Get extinguisher details from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const extinguisherNo = urlParams.get('extinguisher_no') || 'Unknown';
    const extinguisherId = urlParams.get('extinguisher_id');
    
    // Format extinguisher number (e.g., "FE-001" -> "01")
    let formattedExtinguisherNo = 'Unknown';
    if (extinguisherNo && extinguisherNo.startsWith('FE-')) {
        const numPart = extinguisherNo.substring(3); // Get "001" from "FE-001"
        const num = parseInt(numPart, 10); // Convert to integer: 1
        formattedExtinguisherNo = String(num).padStart(2, '0'); // Format as "01"
    }
    
    // Get location from database
    let location = 'Unknown Location';
    if (extinguisherId) {
        try {
            const { data: extinguisher, error } = await supabase
                .from('fire_extinguishers')
                .select('location')
                .eq('id', extinguisherId)
                .single();
            
            if (!error && extinguisher && extinguisher.location) {
                location = extinguisher.location;
            }
        } catch (error) {
            console.error('Error fetching location:', error);
        }
    }
    
    // Create QR code with text below it using a canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size (QR code + text space)
    canvas.width = 400;
    canvas.height = 550;
    
    // Fill background with white
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Create QR code image
    const qrImage = new Image();
    qrImage.crossOrigin = 'anonymous';
    
    qrImage.onload = function() {
        // Draw QR code in center
        const qrSize = 300;
        const qrX = (canvas.width - qrSize) / 2;
        const qrY = 20;
        ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
        
        // Add text below QR code
        ctx.fillStyle = 'black';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        
        // Add "Fire Extinguisher" text
        ctx.fillText('Fire Extinguisher', canvas.width / 2, qrY + qrSize + 40);
        
        // Add extinguisher number
        ctx.font = 'bold 20px Arial';
        ctx.fillText(`No. ${formattedExtinguisherNo}`, canvas.width / 2, qrY + qrSize + 70);
        
        // Add location
        ctx.font = 'bold 16px Arial';
        ctx.fillText(`Location: ${location}`, canvas.width / 2, qrY + qrSize + 100);
        
        // Convert canvas to blob and download
        canvas.toBlob(function(blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `fire-extinguisher-${formattedExtinguisherNo}-qr.png`;
            link.click();
            URL.revokeObjectURL(url);
        }, 'image/png');
    };
    
    // Handle QR code loading error
    qrImage.onerror = function() {
        alert('Error generating QR code. Please try again.');
    };
    
    // Load QR code image
    qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(currentURL)}`;
};
