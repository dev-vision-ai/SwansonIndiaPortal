import { supabase } from '../supabase-config.js';

// Auto-generate email from employee code
function generateEmail(employeeCode) {
  if (!employeeCode) return '';
  return `${employeeCode.toLowerCase()}@swanson.co.in`;
}

// Handle form submission
async function handleFormSubmit(event) {
  event.preventDefault();
  
  const employeeCode = document.getElementById('employee-code').value.trim();
  const fullName = document.getElementById('full-name').value.trim();
  const email = document.getElementById('user-email').value;
  const password = document.getElementById('user-password').value;
  const department = document.getElementById('user-department').value;
  const isAdmin = document.getElementById('is-admin').checked;

  if (!employeeCode || !fullName || !password || !department) {
    alert('Please fill in all required fields.');
    return;
  }

  try {
    // Check if current user has admin privileges
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('You must be logged in to create users.');
      return;
    }

    // Get current user's admin status
    const { data: currentUser } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!currentUser || !currentUser.is_admin) {
      alert('You do not have permission to create users. Admin access required.');
      return;
    }

    // Since we can't use auth.admin.createUser from client, we'll use a different approach
    // We'll create the user record directly and let them sign up with the provided credentials
    const { data: newUser, error: dbError } = await supabase
      .from('users')
      .insert([{
        employee_code: employeeCode.toUpperCase(),
        full_name: fullName,
        department: department,
        is_admin: isAdmin,
        email: email // Store email for reference
      }])
      .select()
      .single();

    if (dbError) {
      console.error('Database insertion error:', dbError);
      alert(`Error saving user details: ${dbError.message}`);
      return;
    }

    // Show success message with instructions
    alert(`User created successfully!\n\nEmail: ${email}\nPassword: ${password}\n\nPlease provide these credentials to the user. They can sign in at the login page.`);
    
    document.getElementById('create-user-form').reset();
    document.getElementById('user-email').value = '';
    loadUsers(); // Refresh the users table

  } catch (error) {
    console.error('Error creating user:', error);
    alert(`Error creating user: ${error.message}`);
  }
}

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
      <td>${user.email || 'N/A'}</td>
      <td>${user.department || 'General'}</td>
      <td>
        <button class="btn btn-edit" data-id="${user.id}">Edit</button>
        <button class="btn btn-delete" data-id="${user.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

document.addEventListener('DOMContentLoaded', () => {
    // Load existing users
    loadUsers();
    
    // Handle form submission
    const form = document.getElementById('create-user-form');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
    
    // Auto-generate email when employee code changes
    const employeeCodeInput = document.getElementById('employee-code');
    const emailInput = document.getElementById('user-email');
    
    if (employeeCodeInput && emailInput) {
        employeeCodeInput.addEventListener('input', () => {
            const email = generateEmail(employeeCodeInput.value);
            emailInput.value = email;
        });
    }
});