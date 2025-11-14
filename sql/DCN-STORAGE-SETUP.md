# DCN Documents Storage Setup

## Prerequisite: Create the Bucket

Before applying RLS policies, you must create the `dcn-documents` bucket in Supabase:

1. Go to **Supabase Dashboard** → your project → **Storage**
2. Click **Create a new bucket**
3. Name: `dcn-documents`
4. Privacy: Choose **Private** (if you want signed URLs only) or **Public** (for direct access)
5. Click **Create bucket**

## Step 1: Apply RLS Policies

1. Go to **Supabase Dashboard** → your project → **SQL Editor**
2. Click **New query**
3. Copy and paste the contents of `sql/dcn-documents-bucket-rls.sql`
4. Click **Run**
5. You should see no errors; policies will be created

## Step 2: Verify Policies

1. In Supabase Dashboard, go to **Storage** → **dcn-documents** → **Policies** tab
2. You should see 4 policies:
   - `Authenticated users can list dcn-documents` (SELECT)
   - `Authenticated users can upload to dcn-documents` (INSERT)
   - `Authenticated users can update dcn-documents` (UPDATE)
   - `Authenticated users can delete dcn-documents` (DELETE)

## Step 3: Test Upload & Viewer

1. Start your frontend:
   ```powershell
   npx http-server public -p 5500
   # or use Python: python -m http.server 5500 (in public folder)
   ```

2. Open `http://localhost:5500/html/dcn-request.html`

3. Log in with a Swanson employee code (if your auth is working)

4. Use the **Upload** section:
   - Select a `.docx` or `.xlsx` file
   - Click **Upload**
   - Upload status should show "Upload successful"

5. Use the **List Files** button to see uploaded files, or enter the path manually

6. Click a file to preview it in the Microsoft Office viewer

## Troubleshooting

### Error: "row violates row-level security policy"
- **Cause**: RLS policies not yet created or the bucket doesn't exist
- **Fix**: Follow steps 1-2 above

### Error: "Access Denied" or "Forbidden"
- **Cause**: User is not authenticated or policies are too restrictive
- **Fix**: Ensure you're logged in; check policies allow `auth.role() = 'authenticated'`

### Error: "Bucket does not exist"
- **Cause**: The `dcn-documents` bucket hasn't been created yet
- **Fix**: Create it following Step 1 above

### Microsoft Viewer shows blank
- **Cause**: Signed URL expired or file is corrupted
- **Fix**: Upload a fresh file or extend the signed URL expiry time (default 3600 seconds)

## Optional: Adjust Privacy

- **Private bucket**: Users can only access files via signed URLs (most secure)
- **Public bucket**: Objects are directly accessible at `https://<project>.supabase.co/storage/v1/object/public/dcn-documents/<path>`

If you change the bucket to public, the viewer will still work via signed URLs (which is fine), but direct links will also work.

## Notes

- The policies use `auth.role() = 'authenticated'` which means any logged-in Supabase user can upload/delete. If you need more granular control (e.g., only QA team), modify the policies to check a department or admin flag.
- Signed URLs are created with a 1-hour expiry by default; this is configurable in `public/js/dcn-request.js` (third parameter to `getMicrosoftViewerUrl()`).
