-- Setup Warehouse User Script
-- This script helps set up a warehouse user in the database
-- Run this in your Supabase SQL editor

-- First, check if the user exists in auth.users (this is handled by Supabase Auth)
-- You'll need to know your user ID from the authentication system

-- Example: If you're logged in as warehouse user, run this to add your profile
-- Replace 'YOUR_USER_ID_HERE' with your actual Supabase auth user ID

-- You can find your user ID by checking the browser console when logged in:
-- Run: console.log((await supabase.auth.getUser()).data.user.id)

-- Insert warehouse user profile (replace with your actual details)
INSERT INTO users (
    id,
    employee_code,
    full_name,
    department,
    designation,
    email,
    phone,
    is_admin,
    created_at,
    updated_at
) VALUES (
    'YOUR_USER_ID_HERE',  -- Replace with your Supabase auth user ID
    'WH001',              -- Replace with actual employee code
    'Warehouse Manager',  -- Replace with actual full name
    'Warehouse',          -- This must be 'Warehouse' for GRN access
    'Manager',            -- Replace with actual designation
    'warehouse@swanson.co.in', -- Replace with actual email
    '+91-9876543210',     -- Replace with actual phone
    false,                -- Set to true if this user should be admin
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    department = EXCLUDED.department,
    updated_at = NOW();

-- Verify the user was added correctly
SELECT * FROM users WHERE department = 'Warehouse';

-- If you need to update an existing user to Warehouse department:
-- UPDATE users SET department = 'Warehouse', updated_at = NOW()
-- WHERE employee_code = 'YOUR_EMPLOYEE_CODE';

-- To see all current users and their departments:
-- SELECT employee_code, full_name, department, email FROM users ORDER BY department;
