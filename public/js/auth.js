import { supabase } from "../supabase-config.js";

document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const empCode = document.getElementById("empcode").value.trim().toUpperCase();
    const password = document.getElementById("password").value.trim();
    const message = document.getElementById("message");

    message.textContent = ""; // Clear previous errors

    if (!empCode || !password) {
        message.textContent = "Please enter both fields.";
        return;
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: `${empCode.toLowerCase()}@swanson.co.in`, // Updated domain
            password: password,
        });

        if (error) throw error;

        const user = data.user;

        // Fetch user role and department from the database
        const { data: userProfile, error: profileError } = await supabase
            .from('users') 
            .select('is_admin, department') 
            .eq('id', user.id)
            .single();

        if (profileError) {
             // Handle case where user exists in auth but not in users table
             console.error("Error fetching user profile:", profileError);
             message.textContent = "Login failed: User profile not found."; 
             // Optionally sign the user out again here if profile is mandatory
             // await supabase.auth.signOut(); 
             return; 
        }

        // Check if userProfile is null (shouldn't happen with .single() unless error, but good practice)
        if (!userProfile) {
            message.textContent = "Login failed: Could not retrieve user profile.";
            return;
        }

        const isAdmin = userProfile.is_admin; 
        const department = userProfile.department; 

        // ---- Debugging Logs ----
        console.log("Attempting redirection for user:", user.email);
        console.log("Fetched isAdmin:", isAdmin, "(Type:", typeof isAdmin, ")");
        console.log("Fetched department:", `"${department}"`, "(Type:", typeof department, ")"); // Log department with quotes to see spaces
        // ---- End Debugging Logs ----

        // Redirect based on role and department
        if (isAdmin === true) { 
            console.log("User is admin. Checking department..."); 
            // Update the string here to match the database value
            if (department === 'Human Resources') { 
                console.log("Department matches 'Human Resources'. Redirecting to admin_adhr."); 
                window.location.href = "../html/admin_adhr.html"; 
            } else if (department === 'Quality Assurance') {
                console.log("Department matches 'Quality Assurance'. Redirecting to admin_qa."); // Log successful match
                window.location.href = "../html/admin_qa.html";
            } else if (department === 'IQA') { // <-- Add this else if block
                console.log("Department matches 'IQA'. Redirecting to admin_iqa."); 
                window.location.href = "../html/admin_iqa.html";
            } else {
                // Fallback for admins with unexpected departments
                console.warn("Admin user has an unrecognized department:", department);
                message.textContent = "Login successful, but admin role is unclear."; // <-- This line is being executed
                // Maybe redirect to a generic admin landing page?
                // window.location.href = "../admins_dashboard/admin_default/index.html"; 
            }
        } else {
            // User is not an admin (is_admin is FALSE or null)
            console.log("User is not admin. Redirecting to dashboard."); // Log non-admin redirect
            window.location.href = "../html/employee_dashboard.html";
        }

    } catch (error) {
        console.error("Login failed:", error);
        message.textContent = "Login failed. Please check credentials.";
    }
});

// Logout logic
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        window.location.href = "auth.html";
    } catch (error) {
        console.error("Error logging out:", error);
        alert("Error logging out. Please try again.");
    }
});
