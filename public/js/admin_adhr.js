import { supabase } from '../supabase-config.js'; // Make sure this path is correct

// Function to load user profile
async function loadUserProfile() {
    console.time('loadUserProfile');
    const userNameElement = document.querySelector('.user-name');
    if (!userNameElement) {
        console.error('User name element not found');
        return;
    }

    try {
        console.time('getUser');
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        console.timeEnd('getUser');

        if (userError) throw userError;

        if (user) {
            console.time('fetchProfile');
            const { data: profile, error: profileError } = await supabase
                .from('users') // Assuming your table is named 'users'
                .select('full_name') // Select the column with the user's full name
                .eq('id', user.id)
                .single();
            console.timeEnd('fetchProfile');

            if (profileError) throw profileError;

            if (profile && profile.full_name) {
                userNameElement.textContent = 'Hi, ' + profile.full_name;
            } else {
                userNameElement.textContent = 'Hi, ' + (user.email || 'Admin');
                console.warn('User profile or full_name not found, using email as fallback.');
            }
        } else {
            // Handle case where user is not logged in
            userNameElement.textContent = 'Not logged in';
            console.error('User not logged in.');
            // Optional: Redirect to login if not logged in
            window.location.href = '../html/auth.html'; 
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
        userNameElement.textContent = 'Error loading name';
    }
    console.timeEnd('loadUserProfile');
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadUserProfile(); 

    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', async (e) => { // Added async and event 'e'
            e.preventDefault(); // Prevent default button behavior

            // --- Add Confirmation --- 
            if (window.confirm("Are you sure you want to log out?")) {
                console.log('Logout confirmed, signing out...'); // Debug log
                try {
                    const { error } = await supabase.auth.signOut();
                    if (error) {
                        console.error('Error logging out:', error);
                        alert('Logout failed. Please try again.');
                    } else {
                        console.log('Logout successful, redirecting...'); // Debug log
                        // Redirect to login page after successful logout
                        window.location.href = '../html/auth.html'; // Adjust path if needed
                    }
                } catch (err) {
                    console.error('Exception during logout:', err);
                    alert('An unexpected error occurred during logout.');
                }
            } else {
                console.log('Logout cancelled by user.'); // Debug log (optional)
            }
        });
    } else {
        console.error('Logout button not found!');
    }
});