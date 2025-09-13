import { supabase } from '../supabase-config.js';
import './rtcis_manager.js';

document.addEventListener('DOMContentLoaded', () => {
  // Logout button logic
  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', async (e) => {
      e.preventDefault();
      if (window.confirm('Are you sure you want to log out?')) {
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
            
            window.location.replace('../html/auth.html');
          }
        } catch (err) {
          console.error('Exception during logout:', err);
          alert('An unexpected error occurred during logout.');
        }
      }
    });
  }

  // Optionally, display user name if needed
  // (Assumes you have logic to fetch and display user info elsewhere)
}); 