document.addEventListener('DOMContentLoaded', async () => {
    const tableBody = document.getElementById('film-inspection-data-table-body');
    const urlParams = new URLSearchParams(window.location.search);
    const formId = urlParams.get('id');

    if (!formId) {
        console.warn('Form ID not found in URL. Proceeding without specific form data.');
        // No specific form data to load, proceed with default row additions.
        // return;
    }

    try {
        const { data, error } = await supabase
            .from('film_inspection_forms')
            .select('*')
            .eq('id', formId)
            .single();

        if (error) {
            console.error('Error fetching film inspection data:', error.message);
            // No specific form data to load, proceed with default row additions.
            // return;
        }

        if (data) {
            document.getElementById('product-code').textContent = data.product_code || 'N/A';
            document.getElementById('prod-order').textContent = data.production_order || 'N/A';
            document.getElementById('specification').textContent = data.specification || 'N/A';
            document.getElementById('machine').textContent = data.machine_number || 'N/A';
            document.getElementById('testing-equipment').textContent = data.testing_equipment_id || 'N/A';
            document.getElementById('quality').textContent = data.quality || 'N/A';
            document.getElementById('production-date').textContent = data.production_date || 'N/A';
            document.getElementById('inspection-date').textContent = data.inspection_date || 'N/A';

            tableBody.innerHTML = ''; // Clear existing content

            // Assuming data.samples is an array of objects, each representing a row
            if (data.samples && Array.isArray(data.samples)) {
                data.samples.forEach(sample => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="py-2 px-4 border-b">${sample.sample_no || 'N/A'}</td>
                        <td class="py-2 px-4 border-b">${sample.elongation_md || 'N/A'}</td>
                        <td class="py-2 px-4 border-b">${sample.force_tensile_md || 'N/A'}</td>
                        <td class="py-2 px-4 border-b">${sample.force_tensile_5_md || 'N/A'}</td>
                        <td class="py-2 px-4 border-b">${sample.elongation_cd || 'N/A'}</td>
                        <td class="py-2 px-4 border-b">${sample.force_tensile_cd || 'N/A'}</td>
                    `;
                    tableBody.appendChild(row);
                });
            }

        } else {
            document.getElementById('film-inspection-details').innerHTML = '<p>No data found for this form ID.</p>';
        }
    } catch (error) {
        console.error('An unexpected error occurred:', error.message);
        document.getElementById('film-inspection-details').innerHTML = `<p class="text-red-500">An unexpected error occurred: ${error.message}</p>`;
    }

    // Global elements and functions for row addition

    const addNewRowButton = document.getElementById('add-new-row-button');

    function addNewRow() {
            console.log('addNewRow function called');
            const row = document.createElement('tr');
            console.log('tableBody element:', tableBody);
        row.innerHTML = `
            <td class="px-4 py-2 border-r"><input type="text" class="w-full border rounded px-2 py-1" placeholder="ROLE ID"/></td>
            <td class="px-4 py-2 border-r"><input type="text" class="w-full border rounded px-2 py-1" placeholder="BATCH NO"/></td>
            <td class="px-4 py-2 border-r">New Row</td>
            <td class="px-4 py-2 border-r"><input type="text" class="w-full border rounded px-2 py-1"/></td>
            <td class="px-4 py-2 border-r"><input type="text" class="w-full border rounded px-2 py-1"/></td>
            <td class="px-4 py-2 border-r"><input type="text" class="w-full border rounded px-2 py-1"/></td>
            <td class="px-4 py-2 border-r"><input type="text" class="w-full border rounded px-2 py-1"/></td>
            <td class="px-4 py-2 border-r"><input type="text" class="w-full border rounded px-2 py-1"/></td>
            <td class="px-4 py-2 border-r"><input type="text" class="w-full border rounded px-2 py-1"/></td>
            <td class="px-4 py-2"><input type="text" class="w-full border rounded px-2 py-1"/></td>
        `;
        tableBody.appendChild(row);
    }

    // Event listener for adding a new row
    addNewRowButton.addEventListener('click', () => {
        addNewRow();
    });
});
