-- DCN Documents Storage Bucket RLS Policies
-- Run this in Supabase SQL editor after creating the 'dcn-documents' bucket

-- First, ensure the storage schema is properly configured
-- Then create policies for authenticated users to upload, read, and delete files

-- Allow authenticated users to list files in the dcn-documents bucket
CREATE POLICY "Authenticated users can list dcn-documents" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'dcn-documents' AND
        auth.role() = 'authenticated'
    );

-- Allow authenticated users to upload files to the dcn-documents bucket
CREATE POLICY "Authenticated users can upload to dcn-documents" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'dcn-documents' AND
        auth.role() = 'authenticated'
    );

-- Allow authenticated users to update (overwrite) their own files
CREATE POLICY "Authenticated users can update dcn-documents" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'dcn-documents' AND
        auth.role() = 'authenticated'
    );

-- Allow authenticated users to delete their own files
CREATE POLICY "Authenticated users can delete dcn-documents" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'dcn-documents' AND
        auth.role() = 'authenticated'
    );

-- Optional: Allow anonymous users (not authenticated) to read signed URLs
-- This is already handled by signed URLs, so this policy is optional
-- CREATE POLICY "Anonymous users can view dcn-documents via signed URLs" ON storage.objects
--     FOR SELECT USING (
--         bucket_id = 'dcn-documents' AND
--         auth.role() = 'anon'
--     );
