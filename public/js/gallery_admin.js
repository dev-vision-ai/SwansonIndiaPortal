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
            .list(`${albumId}/`, { // Path is the album ID followed by a slash
                limit: 1000 // Use a high limit to get all files
            });

        if (listError) {
            console.error('Error listing files for deletion:', listError.message);
            // Decide if you want to proceed with DB deletion even if listing fails
            // For now, we'll throw the error to stop the process
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
                console.error('Error deleting files from storage:', removeError.message);
                // Decide if you want to proceed with DB deletion even if storage deletion fails
                // For now, we'll throw the error to stop the process
                throw new Error(`Could not delete associated files: ${removeError.message}`);
            }
            console.log('Successfully deleted associated files from storage.');
        } else {
            console.log('No associated files found in storage to delete.');
        }

        // --- Step 3: Delete the album record from the database --- 
        console.log(`Deleting album record ${albumId} from database...`);
        const { error: deleteDbError } = await supabase
            .from('gallery_albums')
            .delete()
            .eq('id', albumId);

        if (deleteDbError) {
            throw deleteDbError; // Throw the database error
        }

        alert('Album and associated images deleted successfully!');
        loadExistingAlbums(); // Refresh the list after deletion

    } catch (error) {
        console.error('Error during album deletion process:', error.message);
        // Provide a more consolidated error message
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
        // List files in the album's folder within the bucket
        const { data: files, error: listError } = await supabase
            .storage
            .from(BUCKET_NAME)
            .list(`${albumId}/`, { // Path is the album ID followed by a slash
                limit: 100, // Adjust limit as needed
                offset: 0,
                sortBy: { column: 'name', order: 'asc' },
            });

        if (listError) { throw listError; }

        existingImagesListDiv.innerHTML = ''; // Clear loading message

        if (!files || files.length === 0) {
            existingImagesListDiv.innerHTML = '<p>No images found for this album.</p>';
            return;
        }

        // Filter out potential placeholder files if Supabase adds them (like .emptyFolderPlaceholder)
        const imageFiles = files.filter(file => !file.name.startsWith('.')); 

        if (imageFiles.length === 0) {
             existingImagesListDiv.innerHTML = '<p>No images found for this album.</p>';
            return;
        }

        imageFiles.forEach(file => {
            const imagePath = `${albumId}/${file.name}`;
            // Get public URL for the image
            const { data: { publicUrl } } = supabase
                .storage
                .from(BUCKET_NAME)
                .getPublicUrl(imagePath);

            if (publicUrl) {
                const imageItem = document.createElement('div');
                imageItem.classList.add('image-item');
                imageItem.innerHTML = `
                    <img src="${publicUrl}" alt="${escapeHTML(file.name)}" loading="lazy">
                    <button class="btn-delete-image" data-image-path="${escapeHTML(imagePath)}">Delete</button>
                `;
                existingImagesListDiv.appendChild(imageItem);
            }
        });

        // Add event listeners for the delete buttons
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
    try {
        const { error } = await supabase
            .storage
            .from(BUCKET_NAME)
            .remove([imagePath]); // Pass path in an array

        if (error) { throw error; }

        alert('Image deleted successfully!');
        // Reload the image list for the current album
        const currentAlbumId = imageManagementSection.dataset.currentAlbumId;
        if (currentAlbumId) {
            loadImageList(currentAlbumId);
        } else {
            console.warn('Could not determine current album ID to reload image list.');
        }

    } catch (error) {
        console.error('Error deleting image:', error.message);
        alert(`Error deleting image: ${error.message}`);
    }
}


// --- Utility function to sanitize filenames --- 
function sanitizeFilename(filename) {
    // Replace spaces with underscores
    // Remove characters that are often problematic in URLs/paths
    // Keep the file extension
    const nameWithoutExtension = filename.substring(0, filename.lastIndexOf('.')) || filename;
    const extension = filename.substring(filename.lastIndexOf('.'));
    
    const sanitizedName = nameWithoutExtension
        .replace(/\s+/g, '_')        // Replace spaces with underscores
        .replace(/[^a-zA-Z0-9_\-\.]/g, '') // Remove invalid characters (allow letters, numbers, _, -, .)
        .replace(/_{2,}/g, '_')     // Replace multiple underscores with single
        .replace(/\_+$/, '')       // Remove trailing underscore
        .replace(/^_+/, '');        // Remove leading underscore
        
    // If sanitization results in an empty name, use a default
    const finalName = sanitizedName || 'uploaded_image';
    
    return finalName + extension;
}

// --- Function to Handle Image Upload --- 
async function handleImageUploadSubmit(event) {
    event.preventDefault(); // Prevent default form submission

    const imageFile = document.getElementById('image-file').files[0];
    const currentAlbumId = imageManagementSection.dataset.currentAlbumId;
    const uploadForm = document.getElementById('upload-image-form');
    const submitButton = uploadForm.querySelector('button[type="submit"]');

    if (!imageFile) {
        alert('Please select an image file to upload.');
        return;
    }

    if (!currentAlbumId) {
        alert('Could not determine the current album. Please go back and select an album again.');
        return;
    }

    if (!imageFile.type.startsWith('image/')) {
        alert('Please select a valid image file (e.g., JPG, PNG, GIF).');
        return;
    }

    // --- Compression Options --- 
    const options = {
        maxSizeMB: 1,          // Target max file size in MB
        maxWidthOrHeight: 1280, // Corresponds to 720p longest side
        useWebWorker: true,
        initialQuality: 0.8,   // Start with higher quality (0 to 1)
        // maxIteration: 10,   // Optional: Max attempts to reach maxSizeMB
        // fileType: 'image/jpeg', // Optional: Force output type
    }

    // Disable button and indicate progress
    submitButton.disabled = true;
    submitButton.textContent = 'Compressing...';

    let compressedFile = imageFile; // Default to original if compression fails

    try {
        console.log(`Original file size: ${(imageFile.size / 1024 / 1024).toFixed(2)} MB`);
        console.log('Compressing image with options:', options);
        
        // --- Perform Compression --- <<< RE-ADDED
        compressedFile = await imageCompression(imageFile, options);
        console.log(`Compressed file size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);

        submitButton.textContent = 'Uploading...';

        // --- Sanitize the filename --- 
        const originalName = imageFile.name;
        // Use the compressed file's name if available, otherwise sanitize original
        const nameToSanitize = compressedFile.name || originalName; 
        const sanitizedName = sanitizeFilename(nameToSanitize);
        console.log(`Original filename: ${originalName}, Sanitized filename: ${sanitizedName}`);

        // Construct the path using the SANITIZED name
        const filePath = `${currentAlbumId}/${sanitizedName}`;

        console.log(`Uploading ${sanitizedName} (originally ${originalName}) to ${filePath}...`);

        const { data, error: uploadError } = await supabase
            .storage
            .from(BUCKET_NAME)
            .upload(filePath, compressedFile, { // <<< Use compressedFile 
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error('Supabase upload error:', uploadError.message || JSON.stringify(uploadError)); 
            if (uploadError.message.includes('already exists') || (uploadError.error === 'Duplicate' && uploadError.statusCode === '409')) { 
                 alert(`Error: An image named "${sanitizedName}" already exists in this album. Please rename the file or delete the existing one.`);
            } else {
                throw uploadError;
            }
        } else {
            console.log('Upload successful:', data);
            alert('Image uploaded successfully!');
            uploadForm.reset();
            loadImageList(currentAlbumId);
        }

    } catch (error) {
        console.error('Error during compression or upload:', error.message || JSON.stringify(error)); 
        // Provide more specific feedback if compression failed vs. upload
        if (error.message.includes('imageCompression')) {
             alert(`Error during image compression: ${error.message || JSON.stringify(error)}`);
        } else {
             alert(`Error during upload: ${error.message || JSON.stringify(error)}`);
        }
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Upload Image';
    }
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