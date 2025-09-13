-- =====================================================
-- GALLERY RLS POLICIES
-- Swanson India Portal - Row Level Security Implementation
-- =====================================================

-- =====================================================
-- DROP EXISTING POLICIES FIRST
-- =====================================================

-- Drop existing policies for gallery_albums table
DROP POLICY IF EXISTS "Users can view gallery albums" ON public.gallery_albums;
DROP POLICY IF EXISTS "Users can create gallery albums" ON public.gallery_albums;
DROP POLICY IF EXISTS "Users can update gallery albums" ON public.gallery_albums;
DROP POLICY IF EXISTS "Users can delete gallery albums" ON public.gallery_albums;
DROP POLICY IF EXISTS "Admins can view all gallery albums" ON public.gallery_albums;
DROP POLICY IF EXISTS "Admins can create gallery albums" ON public.gallery_albums;
DROP POLICY IF EXISTS "Admins can update gallery albums" ON public.gallery_albums;
DROP POLICY IF EXISTS "Admins can delete gallery albums" ON public.gallery_albums;

-- Drop existing policies for gallery_images table
DROP POLICY IF EXISTS "Users can view gallery images" ON public.gallery_images;
DROP POLICY IF EXISTS "Users can create gallery images" ON public.gallery_images;
DROP POLICY IF EXISTS "Users can update gallery images" ON public.gallery_images;
DROP POLICY IF EXISTS "Users can delete gallery images" ON public.gallery_images;
DROP POLICY IF EXISTS "Admins can view all gallery images" ON public.gallery_images;
DROP POLICY IF EXISTS "Admins can create gallery images" ON public.gallery_images;
DROP POLICY IF EXISTS "Admins can update gallery images" ON public.gallery_images;
DROP POLICY IF EXISTS "Admins can delete gallery images" ON public.gallery_images;

-- =====================================================
-- ENABLE RLS
-- =====================================================

-- Enable RLS on gallery_albums table
ALTER TABLE public.gallery_albums ENABLE ROW LEVEL SECURITY;

-- Enable RLS on gallery_images table
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- GALLERY_ALBUMS TABLE POLICIES
-- =====================================================

-- Policy 1: All authenticated users can view gallery albums (public gallery access)
CREATE POLICY "Users can view gallery albums" ON public.gallery_albums
FOR SELECT USING (
    auth.uid() IS NOT NULL
);

-- Policy 2: Only admins can create new gallery albums
CREATE POLICY "Admins can create gallery albums" ON public.gallery_albums
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
);

-- Policy 3: Only admins can update gallery albums
CREATE POLICY "Admins can update gallery albums" ON public.gallery_albums
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
);

-- Policy 4: Only admins can delete gallery albums
CREATE POLICY "Admins can delete gallery albums" ON public.gallery_albums
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
);

-- =====================================================
-- GALLERY_IMAGES TABLE POLICIES
-- =====================================================

-- Policy 1: All authenticated users can view gallery images (public gallery access)
CREATE POLICY "Users can view gallery images" ON public.gallery_images
FOR SELECT USING (
    auth.uid() IS NOT NULL
);

-- Policy 2: Only admins can create new gallery images
CREATE POLICY "Admins can create gallery images" ON public.gallery_images
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
);

-- Policy 3: Only admins can update gallery images
CREATE POLICY "Admins can update gallery images" ON public.gallery_images
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
);

-- Policy 4: Only admins can delete gallery images
CREATE POLICY "Admins can delete gallery images" ON public.gallery_images
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Create indexes for gallery_albums table
CREATE INDEX IF NOT EXISTS idx_gallery_albums_category ON public.gallery_albums(category);
CREATE INDEX IF NOT EXISTS idx_gallery_albums_created_at ON public.gallery_albums(created_at);

-- Create indexes for gallery_images table
CREATE INDEX IF NOT EXISTS idx_gallery_images_album_id ON public.gallery_images(album_id);
CREATE INDEX IF NOT EXISTS idx_gallery_images_featured ON public.gallery_images(featured_on_homepage);
CREATE INDEX IF NOT EXISTS idx_gallery_images_created_at ON public.gallery_images(created_at);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.gallery_albums IS 'Gallery albums with RLS enabled for admin-based access control';
COMMENT ON TABLE public.gallery_images IS 'Gallery images with RLS enabled for admin-based access control';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if RLS is enabled
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename IN ('gallery_albums', 'gallery_images');

-- Check policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual FROM pg_policies WHERE tablename IN ('gallery_albums', 'gallery_images');

-- =====================================================
-- END OF GALLERY RLS POLICIES
-- =====================================================
