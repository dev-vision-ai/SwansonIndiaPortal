import { supabase } from '../supabase-config.js';
// rtcis_manager.js - RTCIS Master Label Management

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('rtcisMasterForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = {
        irms_gcas: formData.get('irms_gcas')?.trim() || null,
        mrms_no: formData.get('mrms_no')?.trim() || null,
        standard_weight: formData.get('standard_weight')?.trim() || null,
        no_of_slits: formData.get('no_of_slits')?.trim() || null,
        material_description: formData.get('material_description')?.trim() || null,
        product_code: formData.get('product_code')?.trim() || null,
        basis_weight: formData.get('basis_weight')?.trim() || null,
        width: formData.get('width')?.trim() || null,
      };
      // Convert numeric fields to numbers if not empty
      if (data.standard_weight) data.standard_weight = parseFloat(data.standard_weight);
      if (data.basis_weight) data.basis_weight = parseFloat(data.basis_weight);
      if (data.width) data.width = parseFloat(data.width);
      if (data.no_of_slits) data.no_of_slits = parseInt(data.no_of_slits, 10);
      // Insert into Supabase
      const { error } = await supabase.from('rtcis_master_data').insert([data]);
      if (error) {
        alert('Error adding label: ' + error.message);
      } else {
        alert('Label added successfully!');
        form.reset();
      }
    });
  }

  // Modal logic
  const viewAllBtn = document.getElementById('viewAllLabelsBtn');
  const modal = document.getElementById('labelsModal');
  const closeModalBtn = document.getElementById('closeLabelsModal');
  const tableBody = document.getElementById('labelsTableBody');

  if (viewAllBtn && modal && closeModalBtn && tableBody) {
    viewAllBtn.addEventListener('click', async () => {
      modal.classList.remove('hidden');
      // Fetch all labels from Supabase
      tableBody.innerHTML = '<tr><td colspan="9" class="text-center p-4">Loading...</td></tr>';
      const { data, error } = await supabase.from('rtcis_master_data').select('*').order('created_at', { ascending: false });
      if (error) {
        tableBody.innerHTML = `<tr><td colspan="9" class="text-center text-red-600 p-4">Error: ${error.message}</td></tr>`;
        return;
      }
      if (!data || data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" class="text-center p-4">No labels found.</td></tr>';
        return;
      }
      tableBody.innerHTML = data.map(row => `
        <tr>
          <td class="border border-gray-400 px-2 py-1 text-center">${row.irms_gcas || ''}</td>
          <td class="border border-gray-400 px-2 py-1 text-center">${row.mrms_no || ''}</td>
          <td class="border border-gray-400 px-2 py-1 text-center">${row.standard_weight || ''}</td>
          <td class="border border-gray-400 px-2 py-1 text-center">${row.no_of_slits || ''}</td>
          <td class="border border-gray-400 px-2 py-1 text-center">${row.material_description || ''}</td>
          <td class="border border-gray-400 px-2 py-1 text-center">${row.product_code || ''}</td>
          <td class="border border-gray-400 px-2 py-1 text-center">${row.basis_weight || ''}</td>
          <td class="border border-gray-400 px-2 py-1 text-center">${row.width || ''}</td>
          <td class="border border-gray-400 px-2 py-1 text-center">
            <button class="edit-label-btn text-blue-600 hover:underline mr-2" data-id="${row.id}">Edit</button>
            <button class="delete-label-btn text-red-600 hover:underline" data-id="${row.id}">Delete</button>
          </td>
        </tr>
      `).join('');
      // TODO: Add event listeners for edit/delete buttons
      // Add event listeners for delete buttons
      tableBody.querySelectorAll('.delete-label-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = btn.getAttribute('data-id');
          if (!id) return;
          if (!confirm('Are you sure you want to delete this label?')) return;
          const { error } = await supabase.from('rtcis_master_data').delete().eq('id', id);
          if (error) {
            alert('Error deleting label: ' + error.message);
          } else {
            // Refresh the table
            btn.closest('tr').remove();
          }
        });
      });
      // Add event listeners for edit buttons
      tableBody.querySelectorAll('.edit-label-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = btn.getAttribute('data-id');
          if (!id) return;
          // Find the row data
          const row = data.find(r => r.id === id);
          if (!row) return;
          // Fill the edit modal fields
          document.getElementById('edit_label_id').value = row.id;
          document.getElementById('edit_irms_gcas').value = row.irms_gcas || '';
          document.getElementById('edit_mrms_no').value = row.mrms_no || '';
          document.getElementById('edit_standard_weight').value = row.standard_weight || '';
          document.getElementById('edit_no_of_slits').value = row.no_of_slits || '';
          document.getElementById('edit_material_description').value = row.material_description || '';
          document.getElementById('edit_product_code').value = row.product_code || '';
          document.getElementById('edit_basis_weight').value = row.basis_weight || '';
          document.getElementById('edit_width').value = row.width || '';
          // Show the modal
          document.getElementById('editLabelModal').classList.remove('hidden');
        });
      });
    });
    closeModalBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  // Edit modal logic
  const editModal = document.getElementById('editLabelModal');
  const closeEditModalBtn = document.getElementById('closeEditLabelModal');
  const cancelEditBtn = document.getElementById('cancelEditLabel');
  const editForm = document.getElementById('editLabelForm');
  if (editModal && closeEditModalBtn && cancelEditBtn && editForm) {
    const closeEditModal = () => editModal.classList.add('hidden');
    closeEditModalBtn.addEventListener('click', closeEditModal);
    cancelEditBtn.addEventListener('click', closeEditModal);
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit_label_id').value;
      const updated = {
        irms_gcas: document.getElementById('edit_irms_gcas').value.trim() || null,
        mrms_no: document.getElementById('edit_mrms_no').value.trim() || null,
        standard_weight: document.getElementById('edit_standard_weight').value.trim() || null,
        no_of_slits: document.getElementById('edit_no_of_slits').value.trim() || null,
        material_description: document.getElementById('edit_material_description').value.trim() || null,
        product_code: document.getElementById('edit_product_code').value.trim() || null,
        basis_weight: document.getElementById('edit_basis_weight').value.trim() || null,
        width: document.getElementById('edit_width').value.trim() || null,
      };
      // Convert numeric fields
      if (updated.standard_weight) updated.standard_weight = parseFloat(updated.standard_weight);
      if (updated.basis_weight) updated.basis_weight = parseFloat(updated.basis_weight);
      if (updated.width) updated.width = parseFloat(updated.width);
      if (updated.no_of_slits) updated.no_of_slits = parseInt(updated.no_of_slits, 10);
      // Update in Supabase
      const { error } = await supabase.from('rtcis_master_data').update(updated).eq('id', id);
      if (error) {
        alert('Error updating label: ' + error.message);
      } else {
        alert('Label updated successfully!');
        closeEditModal();
        // Optionally, refresh the table by re-triggering the viewAllBtn click
        viewAllBtn.click();
      }
    });
  }

  console.log('RTCIS Manager JS loaded. Ready for CRUD logic.');
}); 