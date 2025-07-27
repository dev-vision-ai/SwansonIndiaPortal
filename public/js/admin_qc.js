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