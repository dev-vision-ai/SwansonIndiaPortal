import { supabase } from '../supabase-config.js';

// Global variables
let currentExtinguisherId = null;

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    await loadExistingFireExtinguisherData();
    
    // Additional security for public access
    setupPublicAccessSecurity();
});

// Load existing Fire Extinguisher data if accessed via View button
async function loadExistingFireExtinguisherData() {
    const urlParams = new URLSearchParams(window.location.search);
    const extinguisherId = urlParams.get('extinguisher_id');
    const extinguisherNo = urlParams.get('extinguisher_no');

    if (extinguisherId && extinguisherNo) {
        try {
            const { data: extinguisher, error } = await supabase
                .from('fire_extinguishers')
                .select(`
                    *,
                    inspection_data
                `)
                .eq('id', extinguisherId)
                .single();

            if (error) throw error;

            if (extinguisher) {
                populateFormWithExistingData(extinguisher);
            }
        } catch (error) {
            console.error('Error loading existing Fire Extinguisher data:', error);
            showErrorMessage('Error loading Fire Extinguisher data. Please try again.');
        }
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
        
        // Populate dates in both rows
        if (cells.length >= 14) {
            const today = new Date();
            const formattedToday = formatDate(today);
            cells[9].textContent = formattedToday;
            cells[9].style.textAlign = 'center';

            // Get inspection data for both latest and previous dates
            let latestRefilledDate = '';
            let latestExpiryDate = '';
            let previousRefilledDate = '';
            let previousExpiryDate = '';

            if (extinguisher.inspection_data && extinguisher.inspection_data.inspections &&
                extinguisher.inspection_data.inspections.length > 0) {
                // Sort inspections by date (newest first)
                const sortedInspections = extinguisher.inspection_data.inspections
                    .filter(inspection => inspection.date)
                    .sort((a, b) => new Date(b.date) - new Date(a.date));

                // Latest inspection (first in sorted array)
                if (sortedInspections.length > 0) {
                    const latestInspection = sortedInspections[0];
                    latestRefilledDate = latestInspection.refilled_date || '';
                    latestExpiryDate = latestInspection.expiry_date || '';
                }

                // Previous inspection (second in sorted array)
                if (sortedInspections.length > 1) {
                    const previousInspection = sortedInspections[1];
                    previousRefilledDate = previousInspection.refilled_date || '';
                    previousExpiryDate = previousInspection.expiry_date || '';
                }
            }

            // If not found in inspection data, try extinguisher data
            if (!latestRefilledDate && extinguisher.refilled_date) {
                latestRefilledDate = extinguisher.refilled_date;
            }
            if (!latestExpiryDate && extinguisher.expiry_date) {
                latestExpiryDate = extinguisher.expiry_date;
            }

            // If still no data, use some test data for debugging
            if (!latestRefilledDate) {
                latestRefilledDate = '2024-09-01'; // Test data
            }
            if (!latestExpiryDate) {
                latestExpiryDate = '2025-09-01'; // Test data
            }

            // Populate Previous dates (Row 2 - cells 11 and 13)
            if (previousRefilledDate) {
                const prevRefilledDateObj = new Date(previousRefilledDate);
                cells[11].textContent = formatDate(prevRefilledDateObj);
            } else {
                cells[11].textContent = '';
            }
            cells[11].style.textAlign = 'center';

            if (previousExpiryDate) {
                const prevExpiryDateObj = new Date(previousExpiryDate);
                cells[13].textContent = formatDate(prevExpiryDateObj);
            } else {
                cells[13].textContent = '';
            }
            cells[13].style.textAlign = 'center';

            // Populate Latest dates (Row 3 - cells 17 and 19)
            if (cells.length >= 20) {
                if (latestRefilledDate) {
                    const latestRefilledDateObj = new Date(latestRefilledDate);
                    cells[17].textContent = formatDate(latestRefilledDateObj);
                } else {
                    cells[17].textContent = '';
                }
                cells[17].style.textAlign = 'center';

                if (latestExpiryDate) {
                    const latestExpiryDateObj = new Date(latestExpiryDate);
                    cells[19].textContent = formatDate(latestExpiryDateObj);
                } else {
                    cells[19].textContent = '';
                }
                cells[19].style.textAlign = 'center';
            }
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
            <td style="border: 1px solid #000; padding: 6px; text-align: center; height: 30px; font-size: 12px;">${inspectionDate}</td>
            <td style="border: 1px solid #000; padding: 6px; text-align: center; height: 30px; font-size: 12px;">${nextDueDate}</td>
            <td style="border: 1px solid #000; padding: 6px; text-align: center; height: 30px; font-size: 12px;">${inspection.inspector || ''}</td>
            <td style="border: 1px solid #000; padding: 6px; text-align: center; height: 30px; font-size: 12px;">${inspection.pin_seal ? '✔' : '✕'}</td>
            <td style="border: 1px solid #000; padding: 6px; text-align: center; height: 30px; font-size: 12px;">${inspection.pressure ? '✔' : '✕'}</td>
            <td style="border: 1px solid #000; padding: 6px; text-align: center; height: 30px; font-size: 12px;">${inspection.hose_nozzle ? '✔' : '✕'}</td>
            <td style="border: 1px solid #000; padding: 6px; text-align: center; height: 30px; font-size: 12px;">${inspection.handle_knob ? '✔' : '✕'}</td>
            <td style="border: 1px solid #000; padding: 6px; text-align: center; height: 30px; font-size: 12px;">${inspection.dent_rust_leak ? '✔' : '✕'}</td>
            <td style="border: 1px solid #000; padding: 6px; text-align: center; height: 30px; font-size: 12px;">${inspection.easy_access ? '✔' : '✕'}</td>
            <td style="border: 1px solid #000; padding: 6px; text-align: center; height: 30px; font-size: 12px;">${inspection.remarks || ''}</td>
        `;
        tableBody.appendChild(row);
    });

    // Fill remaining rows with empty cells if needed
    const remainingRows = 12 - inspections.length;
    for (let i = 0; i < remainingRows; i++) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="border: 1px solid #000; padding: 6px; text-align: center; height: 30px; font-size: 12px;"></td>
            <td style="border: 1px solid #000; padding: 6px; text-align: center; height: 30px; font-size: 12px;"></td>
            <td style="border: 1px solid #000; padding: 6px; text-align: center; height: 30px; font-size: 12px;"></td>
            <td style="border: 1px solid #000; padding: 6px; text-align: center; height: 30px; font-size: 12px;"></td>
            <td style="border: 1px solid #000; padding: 6px; text-align: center; height: 30px; font-size: 12px;"></td>
            <td style="border: 1px solid #000; padding: 6px; text-align: center; height: 30px; font-size: 12px;"></td>
            <td style="border: 1px solid #000; padding: 6px; text-align: center; height: 30px; font-size: 12px;"></td>
            <td style="border: 1px solid #000; padding: 6px; text-align: center; height: 30px; font-size: 12px;"></td>
            <td style="border: 1px solid #000; padding: 6px; text-align: center; height: 30px; font-size: 12px;"></td>
            <td style="border: 1px solid #000; padding: 6px; text-align: center; height: 30px; font-size: 12px;"></td>
        `;
        tableBody.appendChild(row);
    }
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
            window.location.href = 'fire-extinguisher-mgmt.html';
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
        id: Date.now() + Math.random().toString(36).substr(2, 9), // Unique ID for each inspection
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

// Check if element is an input field
function isInputField(element) {
    return element.tagName === 'INPUT' || 
           element.tagName === 'TEXTAREA' || 
           element.tagName === 'SELECT' ||
           element.contentEditable === 'true';
}
