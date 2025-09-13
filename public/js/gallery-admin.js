// JavaScript for Gallery Admin Page

import { supabase } from '../supabase-config.js';

// --- DOM Elements ---
const createAlbumForm = document.getElementById('create-album-form');
const existingAlbumsListDiv = document.getElementById('existing-albums-list');
// Add references to other elements as needed

console.log('Gallery Admin JS loaded');
if (!createAlbumForm) {
    console.error('Create album form (create-album-form) not found!');
}
if (!existingAlbumsListDiv) {
    console.error('Existing albums list div (existing-albums-list) not found!');
}

// --- Constants ---
const BUCKET_NAME = 'gallery-images'; // IMPORTANT: Change if your bucket name is different

// --- Global Loading State Helper Functions ---
function showLoading(message = 'Loading...') {
    // Placeholder: Implement actual loading indicator display
    // e.g., document.getElementById('loading-spinner').style.display = 'flex';
    // if (document.getElementById('loading-message')) document.getElementById('loading-message').textContent = message;
    console.log(`SHOW_LOADING: ${message}`); // Simple console log for now
}

function hideLoading() {
    // Placeholder: Implement actual loading indicator hiding
    // e.g., document.getElementById('loading-spinner').style.display = 'none';
    console.log('HIDE_LOADING'); // Simple console log for now
}

// --- DOM Utilities ---
const DOMUtils = {
    getById: (id) => document.getElementById(id),
    show: (element) => { if (element) element.style.display = 'block'; },
    hide: (element) => { if (element) element.style.display = 'none'; },
    setText: (element, text) => { if (element) element.textContent = text; },
    setHtml: (element, html) => { if (element) element.innerHTML = html; },
    getValue: (element) => (element ? element.value.trim() : ''),
    getRawValue: (element) => (element ? element.value : ''),
    isChecked: (element) => (element ? element.checked : false),
    resetForm: (formElement) => { if (formElement) formElement.reset(); },
    disableButton: (button, text = 'Processing...') => {
        if (button) {
            button.disabled = true;
            button.textContent = text;
        }
    },
    enableButton: (button, text) => {
        if (button) {
            button.disabled = false;
            if (text) button.textContent = text;
        }
    }
};

// --- Event Listener Utility ---
function reattachEventListener(selector, eventType, callback, parent = document) {
    parent.querySelectorAll(selector).forEach(element => {
        const newElement = element.cloneNode(true);
        element.parentNode.replaceChild(newElement, element);
        newElement.addEventListener(eventType, callback);
    });
}

// --- Supabase Operation Helper ---
async function handleSupabaseOperation(
    operationPromise,
    {
        successMessage = null,
        errorMessagePrefix = 'Error',
        loadingMessage = null, // Pass a string to show loading, null/undefined to skip
        successCallback = null,
        errorCallback = null,
        finallyCallback = null,
        showAlertOnError = true,
        showAlertOnSuccess = false // true to alert, false to console.log successMessage
    } = {}
) {
    if (loadingMessage) showLoading(loadingMessage);
    try {
        const { data, error } = await operationPromise;
        if (error) {
            let detailedMessage = error.message;
            if (error.details) detailedMessage += ` Details: ${error.details}`;
            if (error.hint) detailedMessage += ` Hint: ${error.hint}`;
            const customError = new Error(detailedMessage);
            customError.originalError = error; // Attach original Supabase error
            throw customError;
        }

        if (showAlertOnSuccess && successMessage) alert(successMessage);
        else if (successMessage) console.log(successMessage); // Log if not alerting or no message

        if (successCallback) successCallback(data);
        return { data, error: null };
    } catch (error) {
        console.error(`${errorMessagePrefix}:`, error.message, error.originalError || error);
        if (showAlertOnError) alert(`${errorMessagePrefix}: ${error.message}`);
        if (errorCallback) errorCallback(error);
        return { data: null, error };
    } finally {
        if (loadingMessage) hideLoading();
        if (finallyCallback) finallyCallback();
    }
}

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
    const { data, error } = await handleSupabaseOperation(supabase.auth.getUser(), {
        loadingMessage: 'Loading user profile...',
        errorMessagePrefix: 'User Profile Error',
        showAlertOnError: false // Don't alert, just log and redirect if needed
    });

    if (error) {
        console.error('Error getting user session:', error.message);
        // Potentially redirect or show a message on the page
        // For now, if there's an error, we might not want to initialize the app
        // or redirect to login if it's an auth error.
        // window.location.href = '../html/auth.html'; // Example redirect
        console.timeEnd('loadUserProfile');
        return;
    }

    if (data && data.user) {
        console.log('User is authenticated:', data.user.email);
        initializeApp();
    } else {
        console.log('No active session found or user data missing. Redirecting to login.');
        window.location.href = '../html/auth.html';
    }
    console.timeEnd('loadUserProfile');
}


// --- Album Management Functions ---
async function createAlbum(category, albumName, description, isFeaturedNews) {
    const operation = supabase
        .from('gallery_albums')
        .insert([{ 
            category: category,
            album_name: albumName, 
            album_description: description,
            // is_featured_news: isFeaturedNews // Removed this line as the field might not be needed or will default in DB
        }])
        .select();

    const { error } = await handleSupabaseOperation(operation, {
        loadingMessage: 'Creating album...',
        successMessage: 'Album created successfully!',
        errorMessagePrefix: 'Album Creation Error',
        showAlertOnSuccess: true,
        successCallback: () => {
            if (createAlbumForm) DOMUtils.resetForm(createAlbumForm);
            loadExistingAlbums();
        }
    });

    // Error handling is done by handleSupabaseOperation
    // If specific actions are needed on error, they can be added to errorCallback
}

// Function to handle the submission of the create album form
async function handleCreateAlbumSubmit(event) {
    event.preventDefault();
    
    const category = DOMUtils.getValue(DOMUtils.getById('album-category'));
    const albumName = DOMUtils.getValue(DOMUtils.getById('album-name'));
    const description = DOMUtils.getValue(DOMUtils.getById('album-description'));
    // const isFeaturedNews = DOMUtils.isChecked(DOMUtils.getById('album-is-featured-news')); // Removed this line

    if (!category || !albumName) {
        alert('Category and Album Name are required.');
        console.warn('Category or Album Name missing in form submission.');
        return;
    }

    await createAlbum(category, albumName, description); // Removed isFeaturedNews from arguments
}

// --- Function to load existing albums --- 
async function loadExistingAlbums() {
    if (!existingAlbumsListDiv) {
        console.error('Existing albums list div (existing-albums-list) not found! Cannot load albums.');
        return;
    }
    DOMUtils.setHtml(existingAlbumsListDiv, '<p>Loading albums...</p>');

    const operation = supabase
        .from('gallery_albums')
        .select('*, is_featured_news')
        .order('created_at', { ascending: false });

    const { data: albums, error } = await handleSupabaseOperation(operation, {
        // loadingMessage is handled above
        errorMessagePrefix: 'Load Albums Error',
        successCallback: (fetchedAlbums) => {
            DOMUtils.setHtml(existingAlbumsListDiv, ''); // Clear loading
            if (!fetchedAlbums || fetchedAlbums.length === 0) {
                DOMUtils.setHtml(existingAlbumsListDiv, '<p>No albums found. Create one above!</p>');
                return;
            }

            fetchedAlbums.forEach(album => {
                const albumElement = document.createElement('div');
                albumElement.classList.add('album-item');
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
                                // data-is-featured-news="${album.is_featured_news}" // Removed this data attribute
                                >Edit Album</button> 
                        <button class="btn btn-secondary manage-images-btn" data-album-id="${album.id}" data-album-name="${escapeHTML(album.album_name)}">Manage Images</button>
                        <button class="btn btn-danger delete-album-btn" data-album-id="${album.id}">Delete Album</button>
                    </div>
                `;
                existingAlbumsListDiv.appendChild(albumElement);
            });
            addAlbumActionListeners();
        },
        errorCallback: (err) => {
            DOMUtils.setHtml(existingAlbumsListDiv, `<p class="error-message">Error loading albums: ${err.message}</p>`);
        }
    });
}

// --- Function to Add Event Listeners to Album Buttons ---
function addAlbumActionListeners() {
    reattachEventListener('.delete-album-btn', 'click', async (event) => {
        const albumId = event.target.dataset.albumId;
        if (confirm('Are you sure you want to delete this album and ALL its images? This action cannot be undone.')) {
            await deleteAlbum(albumId);
        }
    }, existingAlbumsListDiv); // Assuming buttons are within existingAlbumsListDiv

    reattachEventListener('.manage-images-btn', 'click', (event) => {
        const albumId = event.target.dataset.albumId;
        const albumName = event.target.dataset.albumName;
        showImageManagement(albumId, albumName);
    }, existingAlbumsListDiv);

    reattachEventListener('.edit-album-btn', 'click', (event) => {
        const button = event.target;
        const albumId = button.dataset.albumId;
        const name = button.dataset.albumName;
        const category = button.dataset.albumCategory;
        const description = button.dataset.albumDescription;
        // const isFeaturedNews = button.dataset.isFeaturedNews === 'true'; // Removed this line
        showEditAlbumModal(albumId, category, name, description); // Removed isFeaturedNews from arguments
    }, existingAlbumsListDiv);
}

// --- Function to Delete an Album ---
async function deleteAlbum(albumId) {
    showLoading('Deleting album...');
    try {
        // Step 1: List files in storage
        const listOp = supabase.storage.from(BUCKET_NAME).list(`${albumId}/`, { limit: 1000 });
        const { data: files, error: listError } = await handleSupabaseOperation(listOp, {
            errorMessagePrefix: 'Storage List Error',
            showAlertOnError: false // Handled in main catch
        });

        if (listError) throw listError; // Propagate to main catch

        // Step 2: Delete files from storage if they exist
        if (files && files.length > 0) {
            const filePaths = files.map(file => `${albumId}/${file.name}`);
            const removeOp = supabase.storage.from(BUCKET_NAME).remove(filePaths);
            const { error: removeError } = await handleSupabaseOperation(removeOp, {
                successMessage: 'Associated files deleted from storage.',
                errorMessagePrefix: 'Storage Remove Error',
                showAlertOnError: false // Handled in main catch
            });
            if (removeError) throw removeError;
        } else {
            console.log('No associated files found in storage to delete.');
        }

        // Step 3: Delete image records from gallery_images table
        const deleteImgRecordsOp = supabase.from('gallery_images').delete().eq('album_id', albumId);
        const { error: deleteImgRecordsError } = await handleSupabaseOperation(deleteImgRecordsOp, {
            successMessage: 'Associated image records deleted from database.',
            errorMessagePrefix: 'DB Image Record Deletion Error',
            showAlertOnError: false // Handled in main catch, or allow partial success
        });
        // Decide if this error is critical enough to stop album deletion
        if (deleteImgRecordsError) {
            console.warn('Error deleting image records, but proceeding with album deletion:', deleteImgRecordsError.message);
            // alert(`Warning: Could not delete all image records: ${deleteImgRecordsError.message}`);
        }

        // Step 4: Delete the album record from gallery_albums
        const deleteAlbumOp = supabase.from('gallery_albums').delete().eq('id', albumId);
        const { error: deleteAlbumError } = await handleSupabaseOperation(deleteAlbumOp, {
            successMessage: 'Album deleted successfully!',
            errorMessagePrefix: 'DB Album Deletion Error',
            showAlertOnSuccess: true,
            successCallback: () => loadExistingAlbums(),
            showAlertOnError: false // Handled in main catch
        });
        if (deleteAlbumError) throw deleteAlbumError;

    } catch (error) {
        console.error('Error during album deletion process:', error.message);
        alert(`Error deleting album: ${error.message}. Please check the console for details.`);
    } finally {
        hideLoading();
    }
}

// --- DOM Elements for Edit Modal ---
const editAlbumModal = DOMUtils.getById('edit-album-modal');
const editAlbumForm = DOMUtils.getById('edit-album-form');
// Note: editAlbumIdInput, editAlbumCategoryInput, etc., are defined later and used directly.
// Consider defining them here if they are consistently needed by multiple functions.

// --- Function to Show Edit Album Modal ---
function showEditAlbumModal(albumId, category, name, description, isFeatured) {
    if (!editAlbumModal || !editAlbumForm) {
        console.error('Edit album modal or form not found!');
        return;
    }
    // Populate the form using DOMUtils
    DOMUtils.getById('edit-album-id').value = albumId;
    DOMUtils.getById('edit-album-name').value = name;
    DOMUtils.getById('edit-album-description').value = description || '';
    DOMUtils.getById('edit-album-category').value = category;
    // DOMUtils.getById('edit-album-is-featured-news').checked = isFeatured || false; // Removed this line
    
    DOMUtils.show(editAlbumModal);
    // Trigger auto-resize for description textarea if it has content
    autoResizeTextarea(DOMUtils.getById('edit-album-description')); 
}



const editAlbumIdInput = document.getElementById('edit-album-id');
const editAlbumCategoryInput = document.getElementById('edit-album-category');
const editAlbumNameInput = document.getElementById('edit-album-name');
const editAlbumDescriptionInput = document.getElementById('edit-album-description');
// const editAlbumIsFeaturedNewsInput = document.getElementById('edit-album-is-featured-news'); // <<< This refers to the ID 'edit-album-is-featured-news' - REMOVED
const createAlbumDescriptionInput = document.getElementById('album-description'); 
const cancelEditButton = document.getElementById('cancel-edit-album-btn'); // Button in modal
const imageManagementSection = document.getElementById('image-management');
const existingImagesListDiv = document.getElementById('existing-images-list');
const imageManagementAlbumNameSpan = document.getElementById('image-management-album-name');
const backToAlbumsButton = document.getElementById('back-to-albums');
const createAlbumContentSection = document.getElementById('create-album-content-section'); 
// const existingAlbumsContentSection = document.getElementById('existing-albums-content-section'); // <<< REMOVED THIS LINE
const existingAlbumsSection = document.getElementById('existing-albums-section'); // <<< ADD OR ENSURE THIS IS DEFINED

// Add upload form elements later if needed



// --- Functions to Show/Hide Image Management Section ---
function showImageManagement(albumId, albumName) {
    console.log(`Showing image management for album: ${albumName} (ID: ${albumId})`);

    if (existingAlbumsSection && imageManagementSection && imageManagementAlbumNameSpan && backToAlbumsButton) {
        DOMUtils.hide(existingAlbumsSection);
        DOMUtils.setText(imageManagementAlbumNameSpan, escapeHTML(albumName));
        DOMUtils.show(imageManagementSection);
        imageManagementSection.dataset.currentAlbumId = albumId;

        // Ensure listener is fresh if this function can be called multiple times for different albums
        backToAlbumsButton.removeEventListener('click', hideImageManagement); // Remove old before adding new
        backToAlbumsButton.addEventListener('click', hideImageManagement);

        loadImageList(albumId);
    } else {
        console.error('Could not find necessary elements for image management view.');
        if (!existingAlbumsSection) console.error('Missing: existing-albums-section');
        if (!imageManagementSection) console.error('Missing: image-management');
        if (!imageManagementAlbumNameSpan) console.error('Missing: image-management-album-name');
        if (!backToAlbumsButton) console.error('Missing: back-to-albums');
    }
}

function hideImageManagement() {
    if (existingAlbumsSection && imageManagementSection) {
        DOMUtils.hide(imageManagementSection);
        DOMUtils.show(existingAlbumsSection);
        
        if (imageManagementSection.dataset.currentAlbumId) {
            delete imageManagementSection.dataset.currentAlbumId;
        }
    } else {
         console.error('Could not find necessary elements to hide image management view.');
    }
}

// --- Function to Load Images for an Album ---
async function loadImageList(albumId) {
    if (!existingImagesListDiv) {
        console.error('Existing images list div not found!');
        return;
    }
    DOMUtils.setHtml(existingImagesListDiv, '<p>Loading images...</p>');

    const imageRecordsOp = supabase
        .from('gallery_images')
        .select('id, image_url, caption, featured_on_homepage') // <-- Added id and featured_on_homepage
        .eq('album_id', albumId)
        .order('created_at', { ascending: true });

    const { data: imageRecords, error } = await handleSupabaseOperation(imageRecordsOp, {
        errorMessagePrefix: 'Load Images Error',
        successCallback: (records) => {
            DOMUtils.setHtml(existingImagesListDiv, ''); // Clear loading
            if (!records || records.length === 0) {
                DOMUtils.setHtml(existingImagesListDiv, '<p>No images found for this album.</p>');
                return;
            }

            records.forEach(record => {
                const imagePath = record.image_url;
                const caption = record.caption;
                const imageId = record.id; // <-- Get image ID
                const isFeatured = record.featured_on_homepage; // <-- Get featured status

                const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(imagePath);
                const publicUrl = urlData ? urlData.publicUrl : null;

                if (publicUrl) {
                    const imageItem = document.createElement('div');
                    imageItem.classList.add('image-item', 'mb-3');
                    let captionHTML = caption ? `<p class="image-caption">${escapeHTML(caption)}</p>` : '';
                    imageItem.innerHTML = `
                        <img src="${publicUrl}" alt="${escapeHTML(caption || imagePath.split('/').pop())}" loading="lazy" style="max-width: 200px; max-height: 200px; display: block;">
                        ${captionHTML}
                        <div class="image-actions mt-1">
                            <input type="checkbox" 
                                   class="feature-checkbox" 
                                   data-image-id="${imageId}" 
                                   ${isFeatured ? 'checked' : ''}>
                            <label for="feature-checkbox-${imageId}" style="margin-left: 5px;">Feature on Homepage News</label>
                        </div>
                        <button class="btn btn-sm btn-danger btn-delete-image mt-1" data-image-id="${imageId}" data-image-path="${escapeHTML(imagePath)}">Delete</button>
                    `;
                    // Note: I also added data-image-id to the delete button for consistency, you might need to update deleteImage function if it relied only on imagePath
                    existingImagesListDiv.appendChild(imageItem);
                }
            });
            addImageDeleteListeners(); 
            addImageFeatureToggleListeners(); // <-- Call the new function here
        },
        errorCallback: (err) => {
            DOMUtils.setHtml(existingImagesListDiv, `<p class="error-message">Error loading images: ${err.message}</p>`);
        }
    });
}

// --- Function to Add Listeners for Image Feature Toggles ---
function addImageFeatureToggleListeners() {
    reattachEventListener('.feature-checkbox', 'change', async (event) => {
        const checkbox = event.target;
        const imageId = checkbox.dataset.imageId;
        const isFeatured = checkbox.checked;

        console.log(`Toggling homepage feature for image ${imageId} to ${isFeatured}`);

        const operation = supabase
            .from('gallery_images')
            .update({ featured_on_homepage: isFeatured })
            .eq('id', imageId);

        await handleSupabaseOperation(operation, {
            loadingMessage: 'Updating image feature status...',
            successMessage: 'Image feature status updated successfully!',
            errorMessagePrefix: 'Image Feature Update Error',
            showAlertOnSuccess: false, // Set to true if you want an alert on success
            showAlertOnError: true
        });
    }, existingImagesListDiv); // Attach to the parent div where images are listed
}

// --- Function to Add Listeners for Image Delete Buttons ---
function addImageDeleteListeners() {
    reattachEventListener('.btn-delete-image', 'click', async (event) => {
        const button = event.target;
        const imageId = button.dataset.imageId; // <-- Get imageId
        const imagePath = button.dataset.imagePath;

        if (!imageId || !imagePath) {
            console.error('Missing imageId or imagePath for deletion.');
            alert('Could not delete image: data missing.');
            return;
        }

        if (confirm(`Are you sure you want to delete this image (${imagePath.split('/').pop()})?`)) {
            await deleteImage(imageId, imagePath); // <-- Pass both imageId and imagePath
        }
    }, existingImagesListDiv); // Assuming buttons are within existingImagesListDiv
}

// --- Function to Delete an Image --- 
async function deleteImage(imageId, imagePath) { // Signature already accepts imageId and imagePath
    const currentAlbumId = imageManagementSection.dataset.currentAlbumId;
    // currentAlbumId might still be useful for reloading the list, but not strictly for deletion if imageId is unique
    if (!currentAlbumId) { // Keep this check for context, e.g., reloading the list
        alert('Error: Could not determine the album context. Deletion aborted.');
        console.error('currentAlbumId not found in imageManagementSection.dataset');
        return;
    }

    showLoading('Deleting image...');
    try {
        // Step 1: Delete from Supabase Storage
        const storageOp = supabase.storage.from(BUCKET_NAME).remove([imagePath]);
        const { error: storageError } = await handleSupabaseOperation(storageOp, {
            errorMessagePrefix: 'Storage Deletion Error',
            showAlertOnError: false 
        });

        if (storageError) {
            alert(`Error deleting image from storage: ${storageError.message}. Database record not deleted.`);
            throw storageError; 
        }

        // Step 2: Delete from gallery_images database table using imageId
        const dbOp = supabase.from('gallery_images').delete()
            .eq('id', imageId); // <-- Use imageId for deletion
        
        const { error: dbError } = await handleSupabaseOperation(dbOp, {
            successMessage: 'Image deleted successfully from storage and database!',
            errorMessagePrefix: 'DB Image Record Deletion Error',
            showAlertOnSuccess: true,
            showAlertOnError: false, 
            successCallback: () => loadImageList(currentAlbumId) 
        });

        if (dbError) {
            alert(`Image deleted from storage, but failed to delete database record: ${dbError.message}. Please check database manually.`);
            loadImageList(currentAlbumId); // Still try to reload
            throw dbError; 
        }

    } catch (error) {
        console.error('Error during image deletion process:', error.message);
        // Generic alert can be added here if specific ones above don't cover all cases
        // alert(`An unexpected error occurred while deleting the image: ${error.message}`);
    } finally {
        hideLoading();
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

    const imageFiles = DOMUtils.getById('image-file').files;
    const currentAlbumId = imageManagementSection.dataset.currentAlbumId;
    const uploadForm = DOMUtils.getById('upload-image-form');
    const submitButton = uploadForm.querySelector('button[type="submit"]');
    const imageCaptionInput = DOMUtils.getById('image-caption');

    if (!imageFiles || imageFiles.length === 0) {
        alert('Please select one or more image files to upload.');
        return;
    }
    if (!currentAlbumId) {
        alert('Could not determine the current album. Please go back and select an album again.');
        return;
    }

    DOMUtils.disableButton(submitButton, 'Processing...');
    let successfulUploadCount = 0;
    const totalFiles = imageFiles.length;
    const errorMessages = [];

    for (let i = 0; i < totalFiles; i++) {
        const imageFile = imageFiles[i];
        const originalName = imageFile.name;
        DOMUtils.setText(submitButton, `Processing ${i + 1} of ${totalFiles}: ${escapeHTML(originalName).substring(0, 20)}...`);

        if (!imageFile.type.startsWith('image/')) {
            errorMessages.push(`Skipped non-image file: ${escapeHTML(originalName)}`);
            continue;
        }

        const compressionOptions = { maxSizeMB: 1, maxWidthOrHeight: 1280, useWebWorker: true, initialQuality: 0.90 };

        try {
            DOMUtils.setText(submitButton, `Compressing ${i + 1} of ${totalFiles}: ${escapeHTML(originalName).substring(0, 20)}...`);
            const compressedFile = await imageCompression(imageFile, compressionOptions);
            
            DOMUtils.setText(submitButton, `Uploading ${i + 1} of ${totalFiles}: ${escapeHTML(originalName).substring(0, 20)}...`);

            let originalExtension = '';
            const lastDot = originalName.lastIndexOf('.');
            if (lastDot > -1 && lastDot < originalName.length - 1) {
                originalExtension = originalName.substring(lastDot).toLowerCase();
            }
            const uniqueNamePart = Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
            const newFileName = uniqueNamePart + originalExtension;
            const filePath = `${currentAlbumId}/${newFileName}`;

            const uploadOp = supabase.storage.from(BUCKET_NAME).upload(filePath, compressedFile, { cacheControl: '3600', upsert: false });
            const { error: uploadError } = await handleSupabaseOperation(uploadOp, {
                errorMessagePrefix: `Upload Error (${escapeHTML(originalName)})`,
                showAlertOnError: false // Collect errors manually
            });

            if (uploadError) {
                if (uploadError.message.includes('already exists') || (uploadError.originalError && uploadError.originalError.error === 'Duplicate' && uploadError.originalError.statusCode === '409')) {
                    errorMessages.push(`Error for ${escapeHTML(originalName)}: An image named "${escapeHTML(newFileName)}" already exists.`);
                } else {
                    errorMessages.push(`Upload error for ${escapeHTML(originalName)}: ${uploadError.message}`);
                }
                continue;
            }

            const captionValue = DOMUtils.getValue(imageCaptionInput);
            const insertPayload = { album_id: currentAlbumId, image_url: filePath };
            if (captionValue) insertPayload.caption = captionValue;

            const insertOp = supabase.from('gallery_images').insert([insertPayload]).select();
            const { error: insertError } = await handleSupabaseOperation(insertOp, {
                errorMessagePrefix: `DB Insert Error (${escapeHTML(originalName)})`,
                showAlertOnError: false // Collect errors manually
            });

            if (insertError) {
                errorMessages.push(`DB insert error for ${escapeHTML(originalName)}: ${insertError.message}.`);
            } else {
                successfulUploadCount++;
            }

        } catch (error) { // Catch errors from imageCompression or other unexpected issues
            let errMsg = error.message || JSON.stringify(error);
            if (error.message && error.message.toLowerCase().includes('imagecompression')) {
                 errorMessages.push(`Compression error for ${escapeHTML(originalName)}: ${errMsg}`);
            } else {
                 errorMessages.push(`Processing error for ${escapeHTML(originalName)}: ${errMsg}`);
            }
        }
    }

    DOMUtils.enableButton(submitButton, 'Upload Image(s)');
    if (uploadForm) DOMUtils.resetForm(uploadForm);

    let finalMessage = '';
    if (successfulUploadCount > 0) finalMessage += `${successfulUploadCount} of ${totalFiles} image(s) uploaded successfully.\n`;
    if (errorMessages.length > 0) finalMessage += `\nEncountered ${errorMessages.length} error(s):\n- ${errorMessages.join('\n- ')}`;
    if (!finalMessage.trim()) finalMessage = 'No images processed or selected. Check file types or console.';
    
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
    // Inside your initializeApp or DOMContentLoaded
    if (editAlbumForm) {
    editAlbumForm.addEventListener('submit', handleEditAlbumSubmit);
    }

    // Listener for the cancel button in the edit modal
    if (cancelEditButton) {
        cancelEditButton.addEventListener('click', hideEditAlbumModal);
    }

    // Listener for a generic close button (e.g., "x" in the modal header) and clicking outside
    if (editAlbumModal) {
        const closeButton = editAlbumModal.querySelector('.close-button, .modal-header .close, [data-dismiss="modal"]');
        if (closeButton) {
            closeButton.addEventListener('click', hideEditAlbumModal);
        }

        // Listener for clicking outside the modal content to close
        editAlbumModal.addEventListener('click', (event) => {
            // If the click is directly on the modal backdrop (the modal element itself)
            if (event.target === editAlbumModal) {
                hideEditAlbumModal();
            }
        });
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




// --- Function to Hide Edit Album Modal (NEW) ---
function hideEditAlbumModal() {
    if (editAlbumModal && editAlbumForm) {
        editAlbumForm.reset(); // Clear the form fields
        editAlbumModal.style.display = 'none'; // Hide the modal
    }
}

// --- Function to Populate Edit Album Modal ---
async function populateEditAlbumModal(albumId) {
    if (!albumId) {
        alert('Error: Album ID is missing for editing.');
        return;
    }
    showLoading('Loading album details...');
    try {
        const { data: album, error } = await supabase
            .from('gallery_albums')
            .select('*') // Select all fields, including is_featured_news
            .eq('id', albumId)
            .single();

        if (error) throw error;
        if (!album) {
            alert('Album not found.');
            return;
        }

        document.getElementById('edit-album-id').value = album.id;
        document.getElementById('edit-album-name').value = album.album_name;
        document.getElementById('edit-album-description').value = album.album_description || '';
        
        // Ensure the category select element exists and then set its value
        const editAlbumCategorySelect = document.getElementById('edit-album-category');
        if (editAlbumCategorySelect) {
            editAlbumCategorySelect.value = album.category;
        } else {
            console.error('Edit album category select not found');
        }
        
        document.getElementById('edit-album-is-featured-news').checked = album.is_featured_news || false; // <<< MODIFIED: Correct ID and property

        showEditAlbumModal(); // This function should make the modal visible

    } catch (error) {
        console.error('Error fetching album for edit:', error);
        alert(`Error loading album details: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// --- Function to Handle Edit Album Submission ---
async function handleEditAlbumSubmit(event) {
    event.preventDefault();

    const albumId = document.getElementById('edit-album-id').value;
    const albumName = document.getElementById('edit-album-name').value.trim();
    const albumDescription = document.getElementById('edit-album-description').value.trim();
    const albumCategory = document.getElementById('edit-album-category').value;
    // Removed: const isFeaturedNews = document.getElementById('edit-album-is-featured-news').checked;

    // Validation
    if (!albumName) {
        alert('Album name cannot be empty.');
        return;
    }
    if (!albumId) {
        alert('Error: Album ID is missing. Cannot update.');
        return;
    }

    showLoading('Updating album...');
    try {
        const { data, error } = await supabase
            .from('gallery_albums')
            .update({
                album_name: albumName,
                album_description: albumDescription,
                category: albumCategory,
                // Removed: is_featured_news: isFeaturedNews
            })
            .eq('id', albumId)
            .select(); // .select() is crucial to get the updated row(s) back

        if (error) {
            // Assuming handleSupabaseError logs the error and alerts the user.
            // This function is expected to be available from previous refactoring steps.
            handleSupabaseError(error, 'updating album');
            return; // Exit after handling the error
        }

        if (data && data.length > 0) {
            alert('Album updated successfully!'); // Consider a success message helper
            hideEditAlbumModal();
            await loadExistingAlbums(); // Ensure loadExistingAlbums is awaited if it's async
        } else {
            // This means the query ran without a database error, but no rows were updated or returned.
            console.error(`Supabase update for album ID '${albumId}' returned no data. The album might not exist or no changes were made.`);
            alert('Failed to update album. The album may not exist, or no changes were detected.'); // Consider an error message helper
        }
    } catch (unexpectedError) {
        // This catch block handles errors not originating from the Supabase client call itself,
        // or if handleSupabaseError re-throws, or errors in subsequent logic like loadExistingAlbums.
        console.error('Unexpected error during album update process:', unexpectedError);
        alert(`An unexpected error occurred while updating the album: ${unexpectedError.message}`); // Consider an error message helper
    } finally {
        hideLoading();
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
