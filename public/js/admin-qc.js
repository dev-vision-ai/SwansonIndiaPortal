import { supabase } from '../supabase-config.js';

function setupEventListeners() {
  document.addEventListener('DOMContentLoaded', async () => {
    // Load user profile
    await loadUserProfile();

    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
      logoutButton.addEventListener('click', async (e) => {
        e.preventDefault();
        console.log('Logout button clicked'); // Debug log

        if (window.confirm("Are you sure you want to log out?")) {
          console.log('Logout confirmed, signing out...'); // Debug log
          try {
            const { error } = await supabase.auth.signOut();
            if (error) {
              console.error('Error logging out:', error);
              alert('Logout failed. Please try again.');
            } else {
              // Remove session from both storages
              localStorage.removeItem('supabase.auth.session');
              sessionStorage.removeItem('supabase.auth.session');

              // Clear all browser history and prevent back navigation
              window.history.pushState(null, '', window.location.href);
              window.onpopstate = function() {
                window.history.pushState(null, '', window.location.href);
              };

              // Clear all session storage and local storage except essential items
              const essentialKeys = ['rememberedEmpCode', 'rememberedPassword'];
              for (let i = sessionStorage.length - 1; i >= 0; i--) {
                const key = sessionStorage.key(i);
                if (!essentialKeys.includes(key)) {
                  sessionStorage.removeItem(key);
                }
              }
              for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (!essentialKeys.includes(key)) {
                  localStorage.removeItem(key);
                }
              }

              console.log('Logout successful, redirecting...'); // Debug log
              window.location.replace('../html/auth.html');
            }
          } catch (err) {
            console.error('Exception during logout:', err);
            alert('An unexpected error occurred during logout.');
          }
        } else {
          console.log('Logout cancelled by user.');
        }
      });
    }
  });

  document.addEventListener('click', handleButtonActions);
}

async function loadUserProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('full_name, employee_code')
      .eq('id', user.id)
      .single();

    if (profile) {
      const userNameEl = document.querySelector('.user-name');
      if (userNameEl) userNameEl.textContent = 'Hi, ' + profile.full_name;
    } else if (profileError) {
      console.error("Error fetching profile:", profileError);
    }
  } else {
    console.error("User not logged in.");
    window.location.href = '../html/auth.html';
  }
}

function handleButtonActions(e) {
  // Handle any button actions if needed
}

setupEventListeners(); 