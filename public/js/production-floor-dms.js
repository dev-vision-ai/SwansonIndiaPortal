import { supabase } from '../supabase-config.js';
import { showToast, storePendingToast } from './toast.js';

/**
 * Production Floor DMS - Form Handling
 * ✅ READY TO SAVE DATA TO DATABASE
 * Table: production_floor_inspections
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('Production Floor DMS loaded');

    // Check if we're editing an existing record
    const urlParams = new URLSearchParams(window.location.search);
    const recordId = urlParams.get('id');
    const isEditParam = urlParams.get('edit');
    let isEditMode = false;
    let isReadOnlyMode = false;
    let defaultCheckedByName = '';
    let defaultVerifiedByName = '';

    const formatDisplayDate = (dateString) => {
        if (!dateString) return '';
        const parsedDate = new Date(dateString);
        if (Number.isNaN(parsedDate.getTime())) return '';
        return parsedDate.toLocaleDateString('en-GB');
    };

    const setFooterPersonDisplay = (elementId, name, dateString) => {
        const container = document.getElementById(elementId);
        if (!container) return;
        container.innerHTML = '';

        if (!name) {
            return;
        }

        const nameEl = document.createElement('div');
        nameEl.textContent = name;
        container.appendChild(nameEl);

        const formattedDate = formatDisplayDate(dateString);
        if (formattedDate) {
            const dateEl = document.createElement('div');
            dateEl.textContent = `(${formattedDate})`;
            dateEl.classList.add('text-xs', 'text-gray-500');
            container.appendChild(dateEl);
        }
    };

/**
 * Make form read-only
 */
const makeFormReadOnly = () => {
    const form = document.getElementById('production-inspection-form');
    if (!form) return;

    // Disable all input fields, textareas, and selects
    form.querySelectorAll('input, textarea, select').forEach(element => {
        element.setAttribute('readonly', 'readonly');
        element.style.backgroundColor = '';
        element.style.cursor = 'default';
    });

    // Disable all contenteditable elements
    form.querySelectorAll('[contenteditable="true"]').forEach(element => {
        element.setAttribute('contenteditable', 'false');
        element.style.backgroundColor = '';
        element.style.cursor = 'default';
    });

    // Hide submit button
    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
    if (submitBtn) {
        submitBtn.style.display = 'none';
    }

    // Hide discard button
    const discardBtn = form.querySelector('.cancel-btn');
    if (discardBtn) {
        discardBtn.style.display = 'none';
    }

    // Add read-only indicator
    const header = document.querySelector('.inspection-form-header h2');
    if (header) {
        header.textContent = 'Production Floor DMS - Read Only';
    }
};

/**
 * Make form editable
 */
const makeFormEditable = () => {
    const form = document.getElementById('production-inspection-form');
    if (!form) return;

    // Enable all input fields, textareas, and selects
    form.querySelectorAll('input, textarea, select').forEach(element => {
        element.removeAttribute('readonly');
        element.removeAttribute('disabled');
    });

    // Enable all contenteditable elements
    form.querySelectorAll('[contenteditable="true"]').forEach(element => {
        element.setAttribute('contenteditable', 'true');
        element.style.backgroundColor = '';
        element.style.cursor = '';
    });

    // Show submit button
    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
    if (submitBtn) {
        submitBtn.style.display = '';
    }

    // Show discard button
    const discardBtn = form.querySelector('.cancel-btn');
    if (discardBtn) {
        discardBtn.style.display = '';
    }

    // Update header
    const header = document.querySelector('.inspection-form-header h2');
    if (header) {
        header.textContent = 'Production Floor DMS';
    }
};

    // Load existing record for editing
    const loadRecordForEditing = async (id) => {
        try {
            const { data: record, error } = await supabase
                .from('production_floor_inspections')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            if (!record) {
                showToast('Record not found.', 'error');
                window.location.href = 'dms.html?view=list';
                return;
            }

            // Determine mode based on URL parameters
            isReadOnlyMode = isEditParam !== 'true';
            isEditMode = isEditParam === 'true';

            // Populate form fields
            const form = document.getElementById('production-inspection-form');
            if (form) {
                // Basic fields
                const dateField = form.querySelector('input[name="inspection_date"]');
                const timeField = form.querySelector('input[name="inspection_time"]');

                if (dateField) dateField.value = record.inspection_date || '';
                if (timeField) timeField.value = record.inspection_time || '';

                // Populate display fields
                defaultCheckedByName = record.checked_by || '';
                defaultVerifiedByName = record.verified_by || '';

                setFooterPersonDisplay('checked-by-display', defaultCheckedByName, record.inspection_date);
                setFooterPersonDisplay('verified-by-display', defaultVerifiedByName, record.verification_date);

                // Populate radio buttons
                if (record.data) {
                    // Set radio button values
                    for (let i = 1; i <= 14; i++) {
                        // Check for single row or MC specific rows
                        if (i === 2 || i === 4 || i === 5 || i === 6 || i === 7 || i === 8 || i === 9) {
                            // Merged rows - check both MC1 and MC2
                            const mc1Value = record.data[`check${i}_mc1`];
                            const mc2Value = record.data[`check${i}_mc2`];
                            
                            if (mc1Value) {
                                const radio = document.querySelector(`#production-inspection-form input[name="check${i}_mc1"][value="${mc1Value}"]`);
                                if (radio) radio.checked = true;
                            }
                            
                            if (mc2Value) {
                                const radio = document.querySelector(`#production-inspection-form input[name="check${i}_mc2"][value="${mc2Value}"]`);
                                if (radio) radio.checked = true;
                            }
                        } else {
                            // Single rows
                            const value = record.data[`check${i}`];
                            if (value) {
                                const radio = document.querySelector(`#production-inspection-form input[name="check${i}"][value="${value}"]`);
                                if (radio) radio.checked = true;
                            }
                        }
                    }

                    // Populate contenteditable fields
                    Object.keys(record.data).forEach(key => {
                        if (key.startsWith('obs') || key.startsWith('action') || key.startsWith('who') || 
                            key.startsWith('when') || key.startsWith('status')) {
                            const element = document.querySelector(`[data-name="${key}"]`);
                            if (element && record.data[key]) {
                                element.innerText = record.data[key];
                            }
                        }
                    });
                }

                // Change form to edit mode
                const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
                if (submitBtn) {
                    if (submitBtn.tagName === 'BUTTON') {
                        submitBtn.textContent = 'Update Inspection';
                    } else {
                        submitBtn.value = 'Update Inspection';
                    }
                }

                // Store record ID for update
                form.dataset.recordId = id;
                isEditMode = true;
            }

            // Apply read-only or editable mode based on URL parameter
            if (isReadOnlyMode) {
                makeFormReadOnly();
            } else {
                makeFormEditable();
            }

        } catch (error) {
            console.error('Error loading record:', error);
            showToast('Error loading record: ' + error.message, 'error');
        }
    };

    // Load record if ID is provided, otherwise populate user info
    if (recordId) {
        loadRecordForEditing(recordId);
    }

    const form = document.getElementById('production-inspection-form');

    // Populate checked_by display for new records
    if (form && !recordId) {
        // For new records, show current user's name
        const populateUserInfo = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: userProfile } = await supabase
                        .from('users')
                        .select('full_name')
                        .eq('id', user.id)
                        .single();
                    
                    defaultCheckedByName = userProfile?.full_name || user.email.split('@')[0] || '';
                    const currentDateValue = form.querySelector('input[name="inspection_date"]')?.value;
                    setFooterPersonDisplay('checked-by-display', defaultCheckedByName, currentDateValue);
                }
            } catch (error) {
                console.error('Error populating user info:', error);
            }
        };
        populateUserInfo();
    }

    if (form) {
        const inspectionDateInput = form.querySelector('input[name="inspection_date"]');
        if (inspectionDateInput) {
            inspectionDateInput.addEventListener('change', () => {
                if (!recordId) {
                    setFooterPersonDisplay('checked-by-display', defaultCheckedByName, inspectionDateInput.value);
                }
            });
        }

        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            
            try {
                // Get current user
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    showToast('You must be logged in to submit an inspection.', 'error');
                    window.location.href = 'auth.html';
                    return;
                }

                // Get current user info for checked_by
                const { data: userProfile, error: userError } = await supabase
                    .from('users')
                    .select('full_name')
                    .eq('id', user.id)
                    .single();

                if (userError) {
                    console.error('Error fetching user profile:', userError);
                    showToast('Error fetching user information.', 'error');
                    return;
                }

                const inspectionData = {
                    user_id: user.id,
                    inspection_date: formData.get('inspection_date'),
                    inspection_time: formData.get('inspection_time'),
                    checked_by: userProfile.full_name || user.email.split('@')[0], // Use full_name or email prefix from auth
                    data: {}
                };

                // Collect radio button data (only save non-null values)
                for (let i = 1; i <= 14; i++) {
                    // Check for single row or MC specific rows
                    if (i === 2 || i === 4 || i === 5 || i === 6 || i === 7 || i === 8 || i === 9) {
                        // Merged rows - check both MC1 and MC2
                        const mc1Radio = form.querySelector(`input[name="check${i}_mc1"]:checked`);
                        const mc2Radio = form.querySelector(`input[name="check${i}_mc2"]:checked`);
                        
                        if (mc1Radio) inspectionData.data[`check${i}_mc1`] = mc1Radio.value;
                        if (mc2Radio) inspectionData.data[`check${i}_mc2`] = mc2Radio.value;
                    } else {
                        // Single rows
                        const radio = form.querySelector(`input[name="check${i}"]:checked`);
                        if (radio) inspectionData.data[`check${i}`] = radio.value;
                    }
                }

                // Collect contenteditable data
                document.querySelectorAll('[contenteditable="true"]').forEach(el => {
                    const name = el.getAttribute('data-name');
                    if (name) {
                        const value = el.innerText.trim();
                        if (value) inspectionData.data[name] = value;
                    }
                });

                // Collect verified_by if it exists (checked_by is auto-populated)
                const verifiedByValue = formData.get('verified_by');
                if (verifiedByValue) inspectionData.verified_by = verifiedByValue;

                // Validate required fields
                if (!inspectionData.inspection_date || !inspectionData.inspection_time) {
                    showToast('Please fill in the inspection date and time.', 'warning');
                    return;
                }

                // Show loading state
                const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
                const originalBtnText = submitBtn ? submitBtn.textContent || submitBtn.value : null;
                if (submitBtn) {
                    submitBtn.disabled = true;
                    if (submitBtn.tagName === 'BUTTON') {
                        submitBtn.textContent = isEditMode ? 'Updating...' : 'Submitting...';
                    } else {
                        submitBtn.value = isEditMode ? 'Updating...' : 'Submitting...';
                    }
                }

                console.log(`${isEditMode ? 'Updating' : 'Submitting'} inspection data:`, inspectionData);

                let result;
                if (isEditMode && form.dataset.recordId) {
                    // Update existing record
                    result = await supabase
                        .from('production_floor_inspections')
                        .update(inspectionData)
                        .eq('id', form.dataset.recordId)
                        .select();
                } else {
                    // Insert new record
                    result = await supabase
                        .from('production_floor_inspections')
                        .insert([inspectionData])
                        .select();
                }

                const { data, error } = result;
                if (error) throw error;

                console.log(`Inspection ${isEditMode ? 'updated' : 'saved'} successfully:`, data);

                // Reset loading state
                if (submitBtn) {
                    submitBtn.disabled = false;
                    if (submitBtn.tagName === 'BUTTON') {
                        submitBtn.textContent = originalBtnText || (isEditMode ? 'Update Inspection' : 'Submit Inspection');
                    } else {
                        submitBtn.value = originalBtnText || (isEditMode ? 'Update Inspection' : 'Submit Inspection');
                    }
                }

                showToast(`Inspection ${isEditMode ? 'updated' : 'submitted'} successfully!`, 'success');
                window.location.href = 'dms.html?view=list';

            } catch (error) {
                console.error('Error submitting inspection:', error);
                
                // Reset loading state on error
                if (submitBtn) {
                    submitBtn.disabled = false;
                    if (submitBtn.tagName === 'BUTTON') {
                        submitBtn.textContent = originalBtnText || 'Submit Inspection';
                    } else {
                        submitBtn.value = originalBtnText || 'Submit Inspection';
                    }
                }
                
                showToast('Error submitting inspection: ' + error.message, 'error');
            }
        });
    }

    // Disable Enter key in Product and Lot No input fields
    document.querySelectorAll('[data-name^="obs8_prod_"], [data-name^="obs8_lot_"]').forEach(el => {
        el.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
            }
        });
    });

    // Auto-fill logic for radio button selections
    document.querySelectorAll('input[type="radio"][name^="check"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const value = this.value;
            const name = this.name;
            const id = name.replace('check', ''); // Extract id like "1" or "2_mc1"
            const isRow8 = id.startsWith('8');
            
            // Find fields in the same row
            const obsField = document.querySelector(`[data-name="obs${id}"]`);
            const actionField = document.querySelector(`[data-name="action${id}"]`);
            const whoField = document.querySelector(`[data-name="who${id}"]`);
            const whenField = document.querySelector(`[data-name="when${id}"]`);
            const statusField = document.querySelector(`[data-name="status${id}"]`);

            // Special fields for Row 8
            let prodField, lotField;
            if (isRow8) {
                const suffix = id.replace('8', ''); // _mc1 or _mc2
                prodField = document.querySelector(`[data-name="obs8_prod${suffix}"]`);
                lotField = document.querySelector(`[data-name="obs8_lot${suffix}"]`);
            }

            // Reset Row 8 fields editability if switching away from NA
            if (isRow8 && prodField && lotField) {
                prodField.setAttribute('contenteditable', 'true');
                lotField.setAttribute('contenteditable', 'true');
                prodField.classList.remove('bg-gray-100', 'cursor-not-allowed');
                lotField.classList.remove('bg-gray-100', 'cursor-not-allowed');
            }
            
            if (value === 'OK') {
                if (obsField && !isRow8) obsField.innerText = 'OK';
                if (obsField && isRow8) obsField.innerText = ''; // Don't auto-fill OK for Row 8
                if (actionField) actionField.innerText = 'NA';
                if (whoField) whoField.innerText = 'NA';
                if (whenField) whenField.innerText = 'NA';
                if (statusField) statusField.innerText = 'NA';
            } else if (value === 'NOT OK') {
                if (obsField) obsField.innerText = '';
                if (actionField) actionField.innerText = '';
                if (whoField) whoField.innerText = '';
                if (whenField) whenField.innerText = '';
                if (statusField) statusField.innerText = '';
                
                // Special case for Row 8 Product/Lot - clear if it was auto-filled
                if (isRow8 && prodField && lotField) {
                    if (prodField.innerText === 'NA') prodField.innerText = '';
                    if (lotField.innerText === 'NA') lotField.innerText = '';
                }
            } else if (value === 'NA') {
                if (obsField) obsField.innerText = 'NA';
                if (actionField) actionField.innerText = 'NA';
                if (whoField) whoField.innerText = 'NA';
                if (whenField) whenField.innerText = 'NA';
                if (statusField) statusField.innerText = 'NA';
                
                // Special case for Row 8 Product/Lot - disable entry
                if (isRow8 && prodField && lotField) {
                    prodField.innerText = '';
                    lotField.innerText = '';
                    prodField.setAttribute('contenteditable', 'false');
                    lotField.setAttribute('contenteditable', 'false');
                    prodField.classList.add('bg-gray-100', 'cursor-not-allowed');
                    lotField.classList.add('bg-gray-100', 'cursor-not-allowed');
                }
            }
        });
    });
});
