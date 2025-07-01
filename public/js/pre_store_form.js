import { supabase } from '../supabase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const preStoreForm = document.getElementById('preStoreForm');
    let formId = null; // To store the ID if we are editing

    // Function to pre-populate form fields
    function prePopulateForm(data) {
        console.log('Pre-populating form with data:', data);
        for (const key in data) {
            const targetId = key.replace(/_/g, '-');
            const input = document.getElementById(targetId);

            if (input) {
                // Handle non-radio inputs
                input.value = data[key];
                console.log(`Populated input '${targetId}' with value: '${data[key]}'`);
            } else {
                // Handle radio button groups
                const radioGroupNames = ['pallet-list', 'product-label', 'wrapping', 'layer-pad', 'contamination', 'kraft-paper'];
                if (radioGroupNames.includes(targetId)) {
                    const radioValue = data[key];
                    console.log(`Attempting to set radio group '${targetId}' with value '${radioValue}'`);
                    if (radioValue) {
                        const radioButtons = document.querySelectorAll(`input[name="${targetId}"]`);
                        radioButtons.forEach(radio => {
                            if (radio.value.toLowerCase() === radioValue.toLowerCase()) {
                                radio.checked = true;
                                console.log(`  Checked radio button: '${radio.id}' with value '${radio.value}'`);
                            }
                        });
                    }
                }
            }
        }
    }

    // Function to get URL parameters
    function getUrlParameter(name) {
        name = name.replace(/[[\]]/g, '\$&');
        var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
            results = regex.exec(window.location.href);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, ' '));
    }

    // Check if there's an ID in the URL (for editing)
    formId = getUrlParameter('id');

    if (formId) {
        // Fetch existing data for the form
        async function fetchFormData() {
            const { data, error } = await supabase
                .from('prestore_and_film_inspection_form')
                .select('*')
                .eq('id', formId)
                .single();

            if (error) {
                console.error('Error fetching form data:', error.message);
                alert('Error loading data for editing: ' + error.message);
                return;
            }

            if (data) {
                prePopulateForm(data);
            }
        }
        fetchFormData();
    } else {
        // Check for film inspection data in sessionStorage for new entries
        const filmInspectionData = JSON.parse(sessionStorage.getItem('filmInspectionData'));
        console.log('Film Inspection Data from sessionStorage:', filmInspectionData);

        if (filmInspectionData) {
            prePopulateForm(filmInspectionData);
            // Optionally clear sessionStorage after use if data is only needed once
            // sessionStorage.removeItem('filmInspectionData');
        }
    }

    preStoreForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const formData = new FormData(preStoreForm);
        const preStoreFormData = {
            production_order: formData.get('production_order'),
            product_code: formData.get('product-code'),
            quantity: formData.get('quantity'),
            customer: formData.get('customer'),
            location: formData.get('location'),
            specification: formData.get('specification'),
            batch: formData.get('batch'),
            ref_no: formData.get('ref_no'),
            standard_packing: formData.get('standard-packing'),
            production_date: formData.get('production-date'),
            inspection_date_prestore: formData.get('inspection-date'),
            pallet_size: formData.get('pallet-size'),
            machine_no: formData.get('machine_no'),
            purchase_order: formData.get('purchase_order'),
            lot_no: formData.get('lot_no'),
            pallet_list: formData.get('pallet-list'),
            product_label: formData.get('product-label'),
            wrapping: formData.get('wrapping'),
            layer_pad: formData.get('layer-pad'),
            contamination: formData.get('contamination'),
            kraft_paper: formData.get('kraft-paper'),
        };

        // Add 'SWIN' prefix to lot_no if it doesn't already have it
        if (preStoreFormData.lot_no && !preStoreFormData.lot_no.startsWith('SWIN')) {
            preStoreFormData.lot_no = 'SWIN' + preStoreFormData.lot_no;
        }

        // Merge filmInspectionData with preStoreFormData if it exists and we are not editing
        let finalData = { ...preStoreFormData };
        if (!formId) { // Only merge from sessionStorage if it's a new entry
            const filmInspectionDataFromSession = JSON.parse(sessionStorage.getItem('filmInspectionData'));
            if (filmInspectionDataFromSession) {
                finalData = { ...filmInspectionDataFromSession, ...preStoreFormData };
            }
        }

        // Get the logged-in user's email
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) {
            console.error('Error fetching user:', userError.message);
            alert('Could not retrieve user information. Please try again.');
            return;
        }
        
        // Add the user's email to the finalData object
        if (user && user.id) {
            finalData.prepared_by = user.id;
        } else {
            finalData.prepared_by = 'unknown'; // Fallback if user email is not available
        }

        console.log('Submitting data:', finalData);

        let upsertError = null;
        if (formId) {
            // Update existing record
            const { error } = await supabase
                .from('prestore_and_film_inspection_form')
                .update(finalData)
                .eq('id', formId);
            upsertError = error;
        } else {
            // Insert new record
            const { error } = await supabase
                .from('prestore_and_film_inspection_form')
                .insert([finalData]);
            upsertError = error;
        }

        if (upsertError) {
            console.error('Error saving data:', upsertError.message);
            alert('Error saving data: ' + upsertError.message);
        } else {
            alert('Data saved successfully!');
            if (!formId) { // Only clear sessionStorage and reset form if it was a new entry
                preStoreForm.reset();
                sessionStorage.removeItem('filmInspectionData');
            }
            // Optionally redirect after successful save/update
            // window.location.href = 'film_inspection_forms_list.html';
        }
    });
});