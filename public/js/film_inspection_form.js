import { supabase } from '../supabase-config.js';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const formId = urlParams.get('id');

    if (formId) {
        // Fetch existing data for the form
        const { data, error } = await supabase
            .from('prestore_and_film_inspection_form')
            .select('*')
            .eq('id', formId)
            .single();

        if (error) {
            console.error('Error fetching form data:', error.message);
            alert('Error loading form data for editing.');
            return;
        }

        if (data) {
            // Populate form fields with fetched data
            for (const key in data) {
                const input = document.getElementById(key);
                if (input) {
                    input.value = data[key];
                }
            }
        }
    }

    const form = document.getElementById('filmInspectionForm');
    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            const formData = new FormData(form);
            const data = {};
            for (let [key, value] of formData.entries()) {
                data[key] = value;
            }

            // Get the logged-in user's email
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) {
                console.error('Error fetching user:', userError.message);
                alert('Could not retrieve user information. Please try again.');
                return;
            }
            
            // Add the user's email to the data object
            if (user && user.id) {
                data.prepared_by = user.id;
            } else {
                data.prepared_by = 'unknown'; // Fallback if user ID is not available
            }

            // Convert specific fields to numbers if necessary
            // The 'PO' field (now 'purchase_order'), 'Prod. Order' (production_order), and 'Lot. No' (lot_no) are intended to be text.
            // No explicit conversion needed here as they are already strings from formData.get().
            // Convert specific fields to numbers if necessary
            // The 'PO' field (now 'purchase_order') and 'Prod. Order' (production_order) are intended to be numbers.
            // The 'Lot. No' field (lot_no) is also intended to be a number.
            // product_code and machine_no can be strings or numbers, no explicit conversion needed here.
            data.product_code = data.product_code;
            data.machine_no = data.machine_no;

            // Convert quantity to an integer
            if (data.quantity) {
                data.quantity = parseInt(data.quantity);
            }

            // Inside your form submission handler, before inserting data:
            let lotNo = formData.get('lot_no');
            // Add 'SWIN' prefix to lot_no if it doesn't already have it
            if (lotNo && !lotNo.startsWith('SWIN')) {
                lotNo = 'SWIN' + lotNo;
            }
            data.lot_no = lotNo;

            let dbOperation;
            if (formId) {
                // Update existing record
                dbOperation = supabase
                    .from('prestore_and_film_inspection_form')
                    .update(data)
                    .eq('id', formId);
            } else {
                // Check for uniqueness before submission (only for new entries)
                const { data: existingLots, error: checkError } = await supabase
                    .from('prestore_and_film_inspection_form')
                    .select('lot_no')
                    .eq('lot_no', lotNo)
                    .limit(1); // Use limit(1) instead of single()

                if (checkError) {
                    console.error('Error checking LOT NO uniqueness:', checkError.message);
                    alert('An error occurred while validating LOT NO. Please try again.');
                    return;
                }

                if (existingLots && existingLots.length > 0) { // Check if any lot was found
                    alert('Error: LOT NO already exists. Please enter a unique LOT NO.');
                    return; // Stop submission
                }

                // Insert new record
                // Add default values for pre-store form radio buttons
                data.pallet_list = 'n-a';
                 data.product_label = 'n-a';
                 data.wrapping = 'n-a';
                 data.layer_pad = 'n-a';
                 data.contamination = 'n-a';
                 data.kraft_paper = 'n-a';

                dbOperation = supabase
                    .from('prestore_and_film_inspection_form')
                    .insert([data])
                    .select('*');
            }

            const { data: resultData, error } = await dbOperation;
            if (error) {
                if (error.code === '23505') { // PostgreSQL unique violation error code
                    alert('Error: This LOT NO already exists. Please use a unique LOT NO.');
                } else {
                    console.error('Error inserting data:', error.message);
                    alert('An error occurred during form submission. Please try again.');
                }
                return;
            }
            console.log('Data inserted successfully:', resultData);
            console.log('Type of resultData:', typeof resultData);
            console.log('Length of resultData:', resultData ? resultData.length : 'N/A');
            if (resultData && resultData.length > 0) {
                const dataToStore = resultData[0];
                sessionStorage.setItem('filmInspectionData', JSON.stringify(dataToStore));
                console.log('Data stored in sessionStorage:', dataToStore);
            } else {
                sessionStorage.removeItem('filmInspectionData'); // Clear if no data was inserted
                console.log('No data inserted, sessionStorage cleared.');
            }
            alert(`Film Inspection Form ${formId ? 'updated' : 'submitted'} successfully!`);
            window.location.href = '../../html/pre_store_&_fif/film_inspection_forms_list.html';
        });
    }
});