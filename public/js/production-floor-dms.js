import { supabase } from '../supabase-config.js';

/**
 * Production Floor DMS - Form Handling
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('Production Floor DMS loaded');

    const form = document.getElementById('production-inspection-form');

    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            try {
                // Get current user
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    alert('You must be logged in to submit an inspection.');
                    window.location.href = 'auth.html';
                    return;
                }

                const formData = new FormData(form);
                const inspectionData = {
                    user_id: user.id,
                    inspection_date: formData.get('inspection_date'),
                    inspection_time: formData.get('inspection_time'),
                    data: {}
                };

                // Collect radio button data
                for (let i = 1; i <= 14; i++) {
                    // Check for single row or MC specific rows
                    if (i === 2 || i === 4 || i === 5 || i === 6 || i === 7 || i === 8 || i === 9) {
                        inspectionData.data[`check${i}_mc1`] = formData.get(`check${i}_mc1`);
                        inspectionData.data[`check${i}_mc2`] = formData.get(`check${i}_mc2`);
                    } else {
                        inspectionData.data[`check${i}`] = formData.get(`check${i}`);
                    }
                }

                // Collect contenteditable data
                document.querySelectorAll('[contenteditable="true"]').forEach(el => {
                    const name = el.getAttribute('data-name');
                    if (name) {
                        inspectionData.data[name] = el.innerText.trim();
                    }
                });

                console.log('Submitting inspection data:', inspectionData);

                // Insert into Supabase (Assuming a table named 'production_floor_inspections')
                const { error } = await supabase
                    .from('production_floor_inspections')
                    .insert([inspectionData]);

                if (error) throw error;

                alert('Inspection submitted successfully!');
                window.location.href = 'dms.html';

            } catch (error) {
                console.error('Error submitting inspection:', error);
                alert('Error submitting inspection: ' + error.message);
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
