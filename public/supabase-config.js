import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ✅ Your new project credentials
const supabaseUrl = "https://ufczydnvscaicygwlmhz.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmY3p5ZG52c2NhaWN5Z3dsbWh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTg5NDYsImV4cCI6MjA1OTc5NDk0Nn0.0TUriXYvPuml-Jzr9v1jvcuzKjh-cZgnZhYKkQEj3t0";

export const supabase = createClient(supabaseUrl, supabaseKey);

export const signIn = async (empCode, password) => {
    const email = `${empCode.toLowerCase()}@swanson.in`;
    return await supabase.auth.signInWithPassword({ email, password });
};

export const signOut = async () => {
    return await supabase.auth.signOut();
};

export const updatePassword = async (newPassword) => {
    return await supabase.auth.updateUser({ password: newPassword });
};