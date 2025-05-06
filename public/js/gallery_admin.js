// JavaScript for Gallery Admin Page

import { supabase } from '../supabase-config.js';

// --- DOM Elements ---
const createAlbumForm = document.getElementById('create-album-form');
const existingAlbumsListDiv = document.getElementById('existing-albums-list');
// Add references to other elements as needed

console.log('Gallery Admin JS loaded');

// --- Utility function to escape HTML (Good practice if displaying user input later) ---
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return str.toString()
         .replace(/&/g, '&amp;')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;')
         .replace(/"/g, '&quot;')
         .replace(/'/g, '&#039;');
}

// --- Authentication & Profile Loading --- 
async function loadUserProfile() {
    console.time('loadUserProfile');
    try {
        console.time('getUser');
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        console.timeEnd('getUser');

        if (userError) {
            console.error('Error getting user session:', userError.message);
            // Consider if you need to redirect or show an error message on the page
            // For now, just log and stop if we can't get the user
            return;
        }

        if (user) {
            console.log('User is authenticated:', user.email);
            // User is authenticated, proceed to initialize the app
            initializeApp();
        } else {
            // Handle case where user is not logged in
            console.log('No active session found. Redirecting to login.');
            window.location.href = '../html/auth.html';
        }
    } catch (error) {
        // Catch any unexpected errors during the process
        console.error('Unexpected error loading user profile:', error);
        // Consider redirecting or showing a generic error message
    }
    console.timeEnd('loadUserProfile');
}


// --- Album Management Functions (Keep as they are) ---
async function createAlbum(category, albumName, description) { // <<< KEEP THIS VERSION
    try {
        const { data, error } = await supabase
            .from('gallery_albums')
            .insert([
                { 
                    category: category,
                    album_name: albumName, 
                    album_description: description 
                }
            ])
            .select();

        if (error) {
            throw error;
        }

        console.log('Album created successfully:', data);
        alert('Album created successfully!');
        createAlbumForm.reset();
        loadExistingAlbums();

    } catch (error) {
        console.error('Error creating album:', error.message);
        alert(`Error creating album: ${error.message}`);
    }
}

// Function to handle the submission of the create album form
function handleCreateAlbumSubmit(event) {
    event.preventDefault();
    
    const category = document.getElementById('album-category').value.trim();
    const albumName = document.getElementById('album-name').value.trim();
    const description = document.getElementById('album-description').value.trim();

    if (!category || !albumName) {
        alert('Category and Album Name are required.');
        return;
    }

    createAlbum(category, albumName, description);
}

// --- Function to load existing albums --- 
async function loadExistingAlbums() {
    console.log('Loading existing albums...');
    if (!existingAlbumsListDiv) {
        console.error('Existing albums list div not found!');
        return;
    }

    existingAlbumsListDiv.innerHTML = '<p>Loading albums...</p>';

    try {
        // --- MODIFICATION: Select 'is_featured_news' --- 
        const { data: albums, error } = await supabase
            .from('gallery_albums')
            .select('*, is_featured_news') // <<< ADD is_featured_news HERE
            .order('created_at', { ascending: false });

        if (error) { throw error; }

        existingAlbumsListDiv.innerHTML = '';

        if (!albums || albums.length === 0) {
            existingAlbumsListDiv.innerHTML = '<p>No albums found. Create one above!</p>';
            return;
        }

        albums.forEach(album => {
            const albumElement = document.createElement('div');
            albumElement.classList.add('album-item');
            // --- REMOVE THE COMMENT FROM THIS LINE --- 
            albumElement.innerHTML = `
                <h4>${escapeHTML(album.album_name)}</h4>
                <p><strong>Category:</strong> ${escapeHTML(album.category)}</p>
                ${album.album_description ? `<p><strong>Description:</strong> ${escapeHTML(album.album_description)}</p>` : ''}
                <div class="album-actions">
                    <button class="btn btn-info edit-album-btn" 
                            data-album-id="${album.id}" 
                            data-album-name="${escapeHTML(album.album_name)}" 
                            data-album-category="${escapeHTML(album.category)}" 
                            data-album-description="${escapeHTML(album.album_description || '')}"
                            data-is-featured-news="${album.is_featured_news}">Edit Album</button> 
                    <button class="btn btn-secondary manage-images-btn" data-album-id="${album.id}" data-album-name="${escapeHTML(album.album_name)}">Manage Images</button>
                    <button class="btn btn-danger delete-album-btn" data-album-id="${album.id}">Delete Album</button>
                </div>
            `;
            existingAlbumsListDiv.appendChild(albumElement);
        });

        // Add event listeners AFTER all buttons are added to the DOM
        addAlbumActionListeners(); 

    } catch (error) {
        console.error('Error loading albums:', error.message);
        existingAlbumsListDiv.innerHTML = `<p class="error-message">Error loading albums: ${error.message}</p>`;
    }
}

// --- Function to Add Event Listeners to Album Buttons (Modify) ---
function addAlbumActionListeners() {
    // --- Delete Buttons --- 
    document.querySelectorAll('.delete-album-btn').forEach(button => {
        // Prevent adding multiple listeners if called again
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        newButton.addEventListener('click', async (event) => {
            const albumId = event.target.dataset.albumId;
            // Updated confirmation message
            if (confirm('Are you sure you want to delete this album and ALL its images? This action cannot be undone.')) { 
                await deleteAlbum(albumId);
            }
        });
    });

    // --- Manage Images Buttons --- 
    document.querySelectorAll('.manage-images-btn').forEach(button => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        newButton.addEventListener('click', (event) => {
            const albumId = event.target.dataset.albumId;
            const albumName = event.target.dataset.albumName;
            showImageManagement(albumId, albumName);
        });
    });

    // --- Edit Album Buttons (MODIFIED LOGIC) ---
    document.querySelectorAll('.edit-album-btn').forEach(button => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        newButton.addEventListener('click', (event) => {
            const albumId = event.target.dataset.albumId;
            const name = event.target.dataset.albumName;
            const category = event.target.dataset.albumCategory;
            const description = event.target.dataset.albumDescription;
            // --- MODIFICATION: Get is_featured_news from data attribute --- 
            const isFeaturedNews = event.target.dataset.isFeaturedNews === 'true'; // Convert string to boolean
            // Call the function to show the modal
            showEditAlbumModal(albumId, category, name, description, isFeaturedNews); // <<< Pass isFeaturedNews
        });
    });
}

// --- Function to Delete an Album --- 
async function deleteAlbum(albumId) {
    console.log(`Attempting to delete album with ID: ${albumId}`);
    try {
        // --- Step 1: List files in the album's storage folder --- 
        console.log(`Listing files in storage for album ${albumId}...`);
        const { data: files, error: listError } = await supabase
            .storage
            .from(BUCKET_NAME)
            .list(`${albumId}/`, { 
                limit: 1000 
            });

        if (listError) {
            throw new Error(`Could not list files for deletion: ${listError.message}`);
        }

        // --- Step 2: Delete the files if any exist --- 
        if (files && files.length > 0) {
            const filePaths = files.map(file => `${albumId}/${file.name}`);
            console.log(`Found ${filePaths.length} files to delete:`, filePaths);
            
            const { error: removeError } = await supabase
                .storage
                .from(BUCKET_NAME)
                .remove(filePaths);

            if (removeError) {
                throw new Error(`Could not delete associated files: ${removeError.message}`);
            }
            console.log('Successfully deleted associated files from storage.');
        } else {
            console.log('No associated files found in storage to delete.');
        }

        // --- Step 3: Delete associated image records from gallery_images table --- 
        console.log(`Deleting image records for album ${albumId} from gallery_images table...`);
        const { error: deleteImageRecordsError } = await supabase
            .from('gallery_images')
            .delete()
            .eq('album_id', albumId);

        if (deleteImageRecordsError) {
            // Log the error, but we might still want to try deleting the album itself.
            // Or, you could choose to throw the error and stop.
            console.error('Error deleting image records from gallery_images:', deleteImageRecordsError.message);
            alert(`Error deleting associated image records from the database: ${deleteImageRecordsError.message}. Attempting to delete album entry anyway.`);
            // Not throwing here, to allow album deletion attempt to proceed
        }
        console.log('Successfully deleted associated image records from gallery_images.');

        // --- Step 4: Delete the album record from the gallery_albums database --- 
        console.log(`Deleting album record ${albumId} from gallery_albums database...`);
        const { error: deleteAlbumRecordError } = await supabase
            .from('gallery_albums')
            .delete()
            .eq('id', albumId);

        if (deleteAlbumRecordError) {
            throw deleteAlbumRecordError; 
        }

        alert('Album, associated images, and all related records deleted successfully!');
        loadExistingAlbums(); 

    } catch (error) {
        console.error('Error during album deletion process:', error.message);
        alert(`Error deleting album: ${error.message}. Please check the console for details.`);
    }
}

// --- DOM Elements (Add new ones (Add new ones for Edit Modal) ---
const editAlbumModal = document.getElementById('edit-album-modal');
const editAlbumForm = document.getElementById('edit-album-form'); // Form inside the modal
const editAlbumIdInput = document.getElementById('edit-album-id');
const editAlbumCategoryInput = document.getElementById('edit-album-category');
const editAlbumNameInput = document.getElementById('edit-album-name');
const editAlbumDescriptionInput = document.getElementById('edit-album-description');
const editAlbumIsFeaturedNewsInput = document.getElementById('edit-album-is-featured-news'); // <<< ADD THIS LINE
const createAlbumDescriptionInput = document.getElementById('album-description'); 
const cancelEditButton = document.getElementById('cancel-edit-album-btn'); // Button in modal
const imageManagementSection = document.getElementById('image-management');
const existingImagesListDiv = document.getElementById('existing-images-list');
const imageManagementAlbumNameSpan = document.getElementById('image-management-album-name');
const backToAlbumsButton = document.getElementById('back-to-albums');
const createAlbumContentSection = document.getElementById('create-album-content-section'); 
// const existingAlbumsContentSection = document.getElementById('existing-albums-content-section'); // We might not need this one
const existingAlbumsSection = document.getElementById('existing-albums-section'); // <<< ADD OR ENSURE THIS IS DEFINED

// Add upload form elements later if needed

// --- Constants ---
const BUCKET_NAME = 'gallery-images'; // <<< IMPORTANT: Change if your bucket name is different

// --- Functions to Show/Hide Image Management Section ---
function showImageManagement(albumId, albumName) {
    console.log(`Showing image management for album: ${albumName} (ID: ${albumId})`);

    // Check if all required elements exist before proceeding
    if (/* createAlbumContentSection && */ existingAlbumsSection && imageManagementSection && imageManagementAlbumNameSpan && backToAlbumsButton) { // Removed createAlbumContentSection check
        // createAlbumContentSection.style.display = 'none'; // <<< REMOVE THIS LINE
        existingAlbumsSection.style.display = 'none'; // <<< Hide the inner album list section
        
        imageManagementAlbumNameSpan.textContent = escapeHTML(albumName); 
        imageManagementSection.style.display = 'block'; // <<< Show the image management section
        imageManagementSection.dataset.currentAlbumId = albumId; 

        backToAlbumsButton.onclick = hideImageManagement; 

        loadImageList(albumId); 
    } else {
        console.error('Could not find necessary elements for image management view.');
        // Log which elements might be missing for debugging
        // if (!createAlbumContentSection) console.error('Missing: create-album-content-section'); // Removed log
        if (!existingAlbumsSection) console.error('Missing: existing-albums-section'); // Check this one
        if (!imageManagementSection) console.error('Missing: image-management');
        if (!imageManagementAlbumNameSpan) console.error('Missing: image-management-album-name');
        if (!backToAlbumsButton) console.error('Missing: back-to-albums');
    }
}

function hideImageManagement() {
    // Check if all required elements exist
    if (/* createAlbumContentSection && */ existingAlbumsSection && imageManagementSection) { // Removed createAlbumContentSection check
        imageManagementSection.style.display = 'none'; // Hide image management
        
        // createAlbumContentSection.style.display = 'block'; // <<< REMOVE THIS LINE
        existingAlbumsSection.style.display = 'block'; // <<< Show the inner album list section again
        
        if (imageManagementSection.dataset.currentAlbumId) {
            delete imageManagementSection.dataset.currentAlbumId; 
        }
    } else {
         console.error('Could not find necessary elements to hide image management view.');
    }
}

// --- Function to Load Images for an Album ---
async function loadImageList(albumId) {
    console.log(`Loading images for album ID: ${albumId}`);
    if (!existingImagesListDiv) {
        console.error('Existing images list div not found!');
        return;
    }
    existingImagesListDiv.innerHTML = '<p>Loading images...</p>';

    try {
        // --- MODIFICATION: Fetch image data (including caption) from gallery_images table ---
        const { data: imageRecords, error: dbError } = await supabase
            .from('gallery_images')
            .select('image_url, caption') // Select image_url and caption
            .eq('album_id', albumId)
            .order('created_at', { ascending: true }); // Or order by name, etc.

        if (dbError) { throw dbError; }

        existingImagesListDiv.innerHTML = ''; // Clear loading message

        if (!imageRecords || imageRecords.length === 0) {
            existingImagesListDiv.innerHTML = '<p>No images found for this album.</p>';
            return;
        }

        imageRecords.forEach(record => {
            const imagePath = record.image_url; // This is the path like 'albumId/filename.jpg'
            const caption = record.caption;

            // Get public URL for the image
            const { data: { publicUrl } } = supabase
                .storage
                .from(BUCKET_NAME)
                .getPublicUrl(imagePath);

            if (publicUrl) {
                const imageItem = document.createElement('div');
                imageItem.classList.add('image-item', 'mb-3'); // Added mb-3 for spacing
                
                let captionHTML = '';
                if (caption) {
                    captionHTML = `<p class="image-caption">${escapeHTML(caption)}</p>`;
                }

                imageItem.innerHTML = `
                    <img src="${publicUrl}" alt="${escapeHTML(caption || imagePath.split('/').pop())}" loading="lazy" style="max-width: 200px; max-height: 200px; display: block;">
                    ${captionHTML}
                    <button class="btn btn-sm btn-danger btn-delete-image mt-1" data-image-path="${escapeHTML(imagePath)}">Delete</button>
                `;
                // TODO: Add edit caption button here if needed in the future
                existingImagesListDiv.appendChild(imageItem);
            }
        });

        addImageDeleteListeners();

    } catch (error) {
        console.error('Error loading images:', error.message);
        existingImagesListDiv.innerHTML = `<p class="error-message">Error loading images: ${error.message}</p>`;
    }
}

// --- Function to Add Listeners for Image Delete Buttons ---
function addImageDeleteListeners() {
    const deleteButtons = document.querySelectorAll('.btn-delete-image');
    deleteButtons.forEach(button => {
        // Remove existing listener to prevent duplicates if list is reloaded
        button.replaceWith(button.cloneNode(true)); 
    });
    // Re-select buttons after cloning
    document.querySelectorAll('.btn-delete-image').forEach(button => {
         button.addEventListener('click', async (event) => {
            const imagePath = event.target.dataset.imagePath;
            if (confirm(`Are you sure you want to delete this image (${imagePath.split('/').pop()})?`)) {
                await deleteImage(imagePath);
            }
        });
    });
}

// --- Function to Delete an Image --- 
async function deleteImage(imagePath) {
    console.log(`Attempting to delete image: ${imagePath}`);
    const currentAlbumId = imageManagementSection.dataset.currentAlbumId;

    if (!currentAlbumId) {
        console.error('Cannot delete image record: currentAlbumId is not set.');
        alert('Error: Could not determine the album for this image. Deletion aborted.');
        return;
    }

    try {
        // --- Step 1: Delete from Supabase Storage --- 
        const { error: storageError } = await supabase
            .storage
            .from(BUCKET_NAME) // BUCKET_NAME should be defined (e.g., 'gallery-images')
            .remove([imagePath]); // Pass path in an array

        if (storageError) {
            // If storage deletion fails, we might not want to delete the DB record yet.
            // Or, we could proceed but warn the user.
            console.error('Error deleting image from storage:', storageError.message);
            alert(`Error deleting image from storage: ${storageError.message}. Database record not deleted.`);
            return; // Stop if storage deletion fails
        }
        console.log('Image successfully deleted from storage.');

        // --- Step 2: Delete from gallery_images database table --- 
        // We need to match based on album_id AND the image_url (which is the imagePath)
        const { error: dbError } = await supabase
            .from('gallery_images')
            .delete()
            .eq('album_id', currentAlbumId) // Ensure we are deleting from the correct album
            .eq('image_url', imagePath);    // And the specific image path

        if (dbError) {
            console.error('Error deleting image record from database:', dbError.message);
            // At this point, the image is deleted from storage, but the DB record remains.
            // This is an inconsistency. Alert the user.
            alert(`Image deleted from storage, but failed to delete database record: ${dbError.message}. Please check database manually.`);
            // We won't throw an error here to prevent the UI from breaking further,
            // but the user is alerted to a data inconsistency.
        } else {
            console.log('Image record successfully deleted from database.');
            alert('Image deleted successfully from storage and database!');
        }

        // Reload the image list for the current album
        if (currentAlbumId) {
            loadImageList(currentAlbumId);
        } else {
            // This case should ideally be caught by the check at the beginning of the function
            console.warn('Could not determine current album ID to reload image list after deletion.');
        }

    } catch (error) {
        // Catch any other unexpected errors during the process
        console.error('Unexpected error during image deletion:', error.message);
        alert(`An unexpected error occurred while deleting the image: ${error.message}`);
    }
}


// --- Helper function to sanitize filenames (ADD THIS FUNCTION if not present) ---
function sanitizeFilename(filename) {
    let cleaned = filename.replace(/\s+/g, '_'); 
    cleaned = cleaned.replace(/[^a-zA-Z0-9_.-]/g, ''); 
    if (cleaned.match(/^\.+$/) || cleaned.startsWith('.')) {
        cleaned = '_' + cleaned;
    }
    const maxLength = 100;
    if (cleaned.length > maxLength) {
        const extMatch = cleaned.match(/\.[^.]*$/);
        const ext = extMatch ? extMatch[0] : '';
        cleaned = cleaned.substring(0, maxLength - ext.length) + ext;
    }
    return cleaned || 'untitled_image';
}

// --- Function to Handle Image Upload (for multiple files) --- 
async function handleImageUploadSubmit(event) {
    event.preventDefault(); 

    const imageFiles = document.getElementById('image-file').files;
    const currentAlbumId = imageManagementSection.dataset.currentAlbumId;
    const uploadForm = document.getElementById('upload-image-form');
    const submitButton = uploadForm.querySelector('button[type="submit"]');
    const imageCaptionInput = document.getElementById('image-caption'); // Get the caption input

    if (!imageFiles || imageFiles.length === 0) {
        alert('Please select one or more image files to upload.');
        return;
    }

    if (!currentAlbumId) {
        alert('Could not determine the current album. Please go back and select an album again.');
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Processing...';

    let successfulUploadCount = 0;
    const totalFiles = imageFiles.length;
    const errorMessages = [];

    for (let i = 0; i < totalFiles; i++) {
        const imageFile = imageFiles[i];
        const originalName = imageFile.name;
        submitButton.textContent = `Processing ${i + 1} of ${totalFiles}: ${escapeHTML(originalName).substring(0, 20)}...`;

        if (!imageFile.type.startsWith('image/')) {
            console.warn(`Skipping non-image file: ${escapeHTML(originalName)}`);
            errorMessages.push(`Skipped non-image file: ${escapeHTML(originalName)}`);
            continue; 
        }

        const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1280,
            useWebWorker: true,
            initialQuality: 0.90,
        };

        try {
            console.log(`Original file size (${escapeHTML(originalName)}): ${(imageFile.size / 1024 / 1024).toFixed(2)} MB`);
            submitButton.textContent = `Compressing ${i + 1} of ${totalFiles}: ${escapeHTML(originalName).substring(0, 20)}...`;
            const compressedFile = await imageCompression(imageFile, options);
            console.log(`Compressed file size (${escapeHTML(originalName)}): ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);
            
            submitButton.textContent = `Uploading ${i + 1} of ${totalFiles}: ${escapeHTML(originalName).substring(0, 20)}...`;

            // const nameToSanitize = compressedFile.name || originalName;
            // const sanitizedName = sanitizeFilename(nameToSanitize); 
            // const filePath = `${currentAlbumId}/${sanitizedName}`;

            // --- MODIFICATION: Generate a unique filename --- 
            let originalExtension = '';
            const lastDot = originalName.lastIndexOf('.');
            if (lastDot > -1 && lastDot < originalName.length - 1) {
                originalExtension = originalName.substring(lastDot).toLowerCase(); // e.g., .jpg, .png
            }

            // Generate a unique name part (timestamp + random string)
            const uniqueNamePart = Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
            const newFileName = uniqueNamePart + originalExtension; // e.g., "kxvzpr45_abc123de.jpg"
            
            const filePath = `${currentAlbumId}/${newFileName}`;
            // --- END MODIFICATION ---

            console.log(`Uploading ${escapeHTML(newFileName)} (originally ${escapeHTML(originalName)}) to ${filePath}...`);

            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from(BUCKET_NAME) 
                .upload(filePath, compressedFile, {
                    cacheControl: '3600',
                    upsert: false 
                });

            if (uploadError) {
                console.error(`Supabase upload error for ${escapeHTML(originalName)}:`, uploadError.message || JSON.stringify(uploadError));
                // --- MODIFICATION: Use newFileName in error message if relevant ---
                if (uploadError.message.includes('already exists') || (uploadError.error === 'Duplicate' && uploadError.statusCode === '409')) {
                    errorMessages.push(`Error for ${escapeHTML(originalName)}: An image named "${escapeHTML(newFileName)}" already exists in the album.`);
                } else {
                    errorMessages.push(`Upload error for ${escapeHTML(originalName)}: ${uploadError.message}`);
                }
                continue; 
            }
            console.log(`Storage Upload successful for ${escapeHTML(originalName)}:`, uploadData);

            const captionValue = imageCaptionInput ? imageCaptionInput.value.trim() : ''; // Get caption value

            // --- MODIFICATION: Include caption in the insert data --- 
            const insertPayload = {
                album_id: currentAlbumId,
                image_url: filePath,
            };
            if (captionValue) { // Only add caption if it's not empty
                insertPayload.caption = captionValue;
            }

            const { data: insertData, error: insertError } = await supabase
                .from('gallery_images')
                .insert([insertPayload]) // Use the payload with optional caption
                .select();
            // --- END MODIFICATION ---

            if (insertError) {
                console.error(`Error inserting image record for ${escapeHTML(originalName)}:`, insertError.message);
                errorMessages.push(`DB insert error for ${escapeHTML(originalName)}: ${insertError.message}.`);
            } else {
                console.log(`Database insert successful for ${escapeHTML(originalName)}:`, insertData);
                successfulUploadCount++;
            }

        } catch (error) {
            console.error(`Error processing ${escapeHTML(originalName)}:`, error.message || JSON.stringify(error));
            if (error.message && error.message.includes('imageCompression')) {
                errorMessages.push(`Compression error for ${escapeHTML(originalName)}: ${error.message}`);
            } else {
                errorMessages.push(`Processing error for ${escapeHTML(originalName)}: ${error.message}`);
            }
        }
    } 

    submitButton.disabled = false;
    submitButton.textContent = 'Upload Image(s)';
    if (uploadForm) uploadForm.reset(); // This will also clear the caption input

    let finalMessage = '';
    if (successfulUploadCount > 0) finalMessage += `${successfulUploadCount} of ${totalFiles} image(s) uploaded successfully.\n`;
    if (errorMessages.length > 0) finalMessage += `\nEncountered ${errorMessages.length} error(s):\n- ${errorMessages.join('\n- ')}`;
    if (!finalMessage) finalMessage = 'No images processed or selected. Check file types or console.';
    
    alert(finalMessage.trim());

    if (successfulUploadCount > 0 || errorMessages.length > 0) loadImageList(currentAlbumId);
}


// --- Initialization and Event Listeners (Modify) ---
function initializeApp() {
    console.log('Initializing Gallery Admin App');
    
    // Listener for Create Album form
    if (createAlbumForm) {
        createAlbumForm.addEventListener('submit', handleCreateAlbumSubmit);
    }

    // Listener for the EDIT form submission
    if (editAlbumForm) {
        editAlbumForm.addEventListener('submit', handleEditAlbumSubmit);
    }

    // Listener for the cancel button in the edit modal
    if (cancelEditButton) {
        cancelEditButton.addEventListener('click', hideEditAlbumModal);
    }

    // Listener for input changes on the EDIT description textarea
    if (editAlbumDescriptionInput) {
        editAlbumDescriptionInput.addEventListener('input', () => {
            autoResizeTextarea(editAlbumDescriptionInput);
        });
    }

    // --- ADD THIS LISTENER --- 
    // Listener for input changes on the CREATE description textarea
    if (createAlbumDescriptionInput) {
        createAlbumDescriptionInput.addEventListener('input', () => {
            autoResizeTextarea(createAlbumDescriptionInput);
        });
        // Optional: Call once initially to set correct starting height if needed
        // autoResizeTextarea(createAlbumDescriptionInput); 
    }
    // --- END ADD --- 

    // Load initial albums (this also calls addAlbumActionListeners)
    loadExistingAlbums(); 

    // Listener for Image Upload form
    const uploadForm = document.getElementById('upload-image-form');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleImageUploadSubmit);
    }
}

// --- Global Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    loadUserProfile(); 
});


// --- Function to Show Edit Album Modal (NEW) ---
function showEditAlbumModal(id, category, name, description) {
    if (!editAlbumModal || !editAlbumIdInput || !editAlbumCategoryInput || !editAlbumNameInput || !editAlbumDescriptionInput) {
        console.error('Edit album modal elements not found! Ensure the modal HTML exists and IDs are correct.');
        alert('Error: Could not open the edit form. Required elements are missing.');
        return;
    }
    console.log(`Editing album: ${name} (ID: ${id})`);
    editAlbumIdInput.value = id;
    editAlbumCategoryInput.value = category;
    editAlbumNameInput.value = name;
    editAlbumDescriptionInput.value = description || ''; // Handle null/undefined descriptions
    
    // --- ADD THIS LINE to set initial height --- 
    autoResizeTextarea(editAlbumDescriptionInput);
    // --- END ADD --- 

    editAlbumModal.style.display = 'block'; // Show the modal
}

// --- Function to Hide Edit Album Modal (NEW) ---
function hideEditAlbumModal() {
    if (editAlbumModal && editAlbumForm) {
        editAlbumForm.reset(); // Clear the form fields
        editAlbumModal.style.display = 'none'; // Hide the modal
    }
}

// --- Function to Handle Edit Album Form Submission (NEW) ---
async function handleEditAlbumSubmit(event) {
    event.preventDefault();
    // Ensure elements exist before accessing value
    if (!editAlbumIdInput || !editAlbumCategoryInput || !editAlbumNameInput || !editAlbumDescriptionInput) {
        console.error('Edit form inputs not found during submit.');
        alert('Error submitting edit form. Please check console.');
        return;
    }

    const id = editAlbumIdInput.value;
    const category = editAlbumCategoryInput.value.trim();
    const albumName = editAlbumNameInput.value.trim();
    const description = editAlbumDescriptionInput.value.trim();

    if (!category || !albumName) {
        alert('Category and Album Name cannot be empty.');
        return;
    }

    // Optional: Add loading state to submit button here
    const submitButton = editAlbumForm.querySelector('button[type="submit"]');
    if(submitButton) submitButton.disabled = true; // Disable button

    console.log(`Attempting to update album ID: ${id}`);
    try {
        const { data, error } = await supabase
            .from('gallery_albums')
            .update({ 
                category: category, 
                album_name: albumName, 
                album_description: description 
            })
            .eq('id', id)
            .select(); // Select the updated row

        if (error) {
            throw error;
        }

        console.log('Album updated successfully:', data);
        alert('Album updated successfully!');
        hideEditAlbumModal();
        loadExistingAlbums(); // Refresh the list to show changes

    } catch (error) {
        console.error('Error updating album:', error.message);
        alert(`Error updating album: ${error.message}`);
    } finally {
        // Optional: Remove loading state from submit button here
        if(submitButton) submitButton.disabled = false; // Re-enable button
    }
}


// --- Function to Auto-Resize Textarea Height --- (NEW)
function autoResizeTextarea(textarea) {
    if (!textarea) return;
    // Temporarily shrink height to calculate the true scrollHeight
    textarea.style.height = 'auto'; 
    // Set the height to the scroll height, which represents the content height
    textarea.style.height = textarea.scrollHeight + 'px';
}
