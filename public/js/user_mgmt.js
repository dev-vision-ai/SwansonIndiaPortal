import { supabase } from '../supabase-config.js';
// Remove the createClient() initialization

async function loadUsers() {
  const tbody = document.querySelector('#users-table tbody');
  tbody.innerHTML = '<tr><td colspan="5">Loading users...</td></tr>';

  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  // Error message
  if (error) {
    tbody.innerHTML = `<tr><td colspan="5">Error loading users: ${error.message}</td></tr>`;
    return;
  }
  
  // Loading message
  tbody.innerHTML = ''; // Clear loading message AFTER fetch completes
  users.forEach((user, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${user.full_name || 'N/A'}</td>
      <td>${user.employee_code?.toUpperCase() || 'Pending'}</td>
      <td>${user.department || 'General'}</td>
      <td>
        <button class="btn btn-edit" data-id="${user.id}">Edit</button>
        <button class="btn btn-delete" data-id="${user.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Initial load
document.addEventListener('DOMContentLoaded', loadUsers);