// Import Supabase configuration
import { supabase } from '../supabase-config.js';

function showMessage(message, isError = false) {
    const overlay = document.querySelector('.submission-message-overlay');
    const submissionMessage = document.querySelector('.submission-message');
    if (submissionMessage && overlay) {
        submissionMessage.textContent = message;
        submissionMessage.classList.remove('error', 'show');
        overlay.classList.remove('show');
        if (isError) submissionMessage.classList.add('error');
        submissionMessage.classList.add('show');
        overlay.classList.add('show');
        setTimeout(() => {
            submissionMessage.classList.remove('show');
            overlay.classList.remove('show');
        }, 3000);
    } else {
        console.warn('Submission message or overlay element not found.');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const userId = await getLoggedInUserId();
    if (!userId) {
        console.error("User not authenticated on Safety Incident Form.");
        window.location.href = '/';
        return;
    }
    
    // Check if we're loading a draft
    const urlParams = new URLSearchParams(window.location.search);
    const draftId = urlParams.get('draft_id');
    
    if (draftId) {
        await loadDraftData(draftId, userId);
    }
    
    setupFormEventListeners(userId);
    
    // Test bucket access
    testBucketAccess();
});

async function testBucketAccess() {
    try {
        console.log('Testing safety-incident-images bucket access...');
        
        // Try to list files in the bucket to test access
        const { data, error } = await supabase.storage
            .from('safety-incident-images')
            .list('', { limit: 1 });
            
        if (error) {
            console.error('Bucket access test failed:', error);
            showMessage('Warning: Cannot access image storage bucket. Image uploads may not work.', true);
        } else {
            console.log('Bucket access test successful');
        }
    } catch (error) {
        console.error('Bucket access test error:', error);
    }
}

async function getLoggedInUserId() {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
}

async function checkIfUserIsAdmin() {
    try {
        const userId = await getLoggedInUserId();
        if (!userId) return false;
        
        const { data: user, error } = await supabase
            .from('users')
            .select('is_admin')
            .eq('id', userId)
            .single();
            
        if (error || !user) return false;
        
        return user.is_admin === true;
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}

async function loadDraftData(draftId, userId) {
    try {
        console.log('Loading draft data for ID:', draftId);
        
        const { data: draft, error } = await supabase
            .from('safety_incident_draft')
            .select('*')
            .eq('id', draftId)
            .eq('user_id', userId)
            .single();
            
        if (error) {
            console.error('Error loading draft:', error);
            showMessage('Error loading draft data. Please try again.', true);
            return;
        }
        
        if (!draft) {
            console.error('Draft not found or access denied');
            showMessage('Draft not found or access denied.', true);
            return;
        }
        
        // Pre-fill the form with draft data
        fillFormWithDraftData(draft);
        
        // Update the submit button to indicate we're editing a draft
        const submitBtn = document.querySelector('.submit-btn');
        const deleteDraftBtn = document.querySelector('.delete-draft-btn');
        if (submitBtn) {
            submitBtn.dataset.draftId = draftId;
        }
        if (deleteDraftBtn) {
            deleteDraftBtn.style.display = 'inline-block';
            deleteDraftBtn.dataset.draftId = draftId;
        }
        
        console.log('Draft data loaded successfully:', draft);
        
    } catch (error) {
        console.error('Error in loadDraftData:', error);
        showMessage('Error loading draft data. Please try again.', true);
    }
}

function fillFormWithDraftData(draft) {
    // Fill form fields with draft data
    const fields = {
        'incidentType': draft.incident_type,
        'incidentDate': draft.incident_date,
        'incidentTime': draft.incident_time,
        'description': draft.description,
        'hazardType': draft.hazard_type,
        'ppeUsed': draft.ppe_used,
        'location': draft.location,
        'department': draft.department,
        'severity': draft.severity,
        'injuryType': draft.injury_type,
        'immediateAction': draft.immediate_action,
        'whoAction': draft.who_action,
        'whenActionDate': draft.when_action_date,
        'statusAction': draft.status_action,
        'investigationLevel': draft.investigation_level
    };
    
    // Fill each field
    Object.entries(fields).forEach(([fieldId, value]) => {
        if (value) {
            const element = document.getElementById(fieldId);
            if (element) {
                if (element.tagName === 'SELECT') {
                    // For select elements, find the option with matching text
                    const options = Array.from(element.options);
                    const matchingOption = options.find(option => 
                        option.text.trim() === value.trim()
                    );
                    if (matchingOption) {
                        element.value = matchingOption.value;
                    }
                } else {
                    element.value = value;
                }
            }
        }
    });
    
         // Handle textarea elements specifically
     const textareas = ['description', 'immediateAction', 'whoAction', 'whenActionDate', 'statusAction'];
     textareas.forEach(fieldId => {
         const element = document.getElementById(fieldId);
         if (element && draft[fieldId]) {
             element.value = draft[fieldId];
         }
     });
     
     // Load existing images if any
     if (draft.image_urls && draft.image_urls.length > 0) {
         console.log('Loading existing images from draft:', draft.image_urls);
         const imagePreviews = document.getElementById('imagePreviews');
         if (imagePreviews) {
             imagePreviews.innerHTML = '';
             draft.image_urls.forEach(imageUrl => {
                 const img = document.createElement('img');
                 img.src = imageUrl;
                 img.style.maxWidth = '200px';
                 img.style.margin = '10px';
                 img.style.borderRadius = '4px';
                 imagePreviews.appendChild(img);
             });
         }
     }
}

function setupFormEventListeners(userId) {
    const form = document.getElementById('safetyIncidentForm');
    const chooseImageBtn = document.getElementById('chooseImageBtn');
    const imageUpload = document.getElementById('imageUpload');
    const imagePreviews = document.getElementById('imagePreviews');
    const saveAsDraftButton = document.querySelector('.draft-btn');
    const deleteDraftButton = document.querySelector('.delete-draft-btn');

    // Tooltip functionality for info icons
    const tooltips = document.querySelectorAll('.info-tooltip');
    
    tooltips.forEach(tooltip => {
        const icon = tooltip.querySelector('.fas.fa-info-circle');
        const tooltipText = tooltip.querySelector('.tooltip-text');
        
        // Desktop hover functionality
        icon.addEventListener('mouseenter', function() {
            tooltip.classList.add('show');
        });
        
        icon.addEventListener('mouseleave', function() {
            tooltip.classList.remove('show');
        });
        
        // Mobile touch functionality
        icon.addEventListener('touchstart', function(e) {
            e.preventDefault();
            // Hide any other open tooltips
            document.querySelectorAll('.info-tooltip.show').forEach(t => {
                if (t !== tooltip) {
                    t.classList.remove('show');
                }
            });
            
            // Toggle current tooltip
            tooltip.classList.toggle('show');
        });
        
        // Close tooltip when clicking outside
        document.addEventListener('click', function(e) {
            if (!tooltip.contains(e.target)) {
                tooltip.classList.remove('show');
            }
        });
        
        // Close tooltip on touch outside (mobile)
        document.addEventListener('touchend', function(e) {
            if (!tooltip.contains(e.target)) {
                tooltip.classList.remove('show');
            }
        });
    });

    // Image upload functionality
    chooseImageBtn.addEventListener('click', function() {
        imageUpload.click();
    });

    let compressedFiles = []; // Store compressed files globally

    // Spinner Overlay HTML Injection
    function showUploadOverlay(progress = 0, onCancel, message = 'uploading...') {
        let overlay = document.getElementById('image-upload-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'image-upload-overlay';
            document.body.appendChild(overlay);
        }
        overlay.innerHTML = `
            <div class="spinner-blur-bg"></div>
            <div class="spinner-content">
                <div class="spinner"></div>
                <div class="progress-text"><span id="upload-progress">${progress}</span>% ${message}</div>
                <button class="cancel-upload-btn" id="cancel-upload-btn" title="Cancel Upload">&times;</button>
            </div>
        `;
        overlay.style.display = 'flex';
        // Prevent scrolling/interactions
        document.body.style.overflow = 'hidden';
        // Cancel button
        const cancelBtn = document.getElementById('cancel-upload-btn');
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                if (onCancel) onCancel();
                hideUploadOverlay();
            };
        }
    }

    function updateUploadProgress(progress) {
        const progressElem = document.getElementById('upload-progress');
        if (progressElem) progressElem.textContent = progress;
    }

    function hideUploadOverlay() {
        const overlay = document.getElementById('image-upload-overlay');
        if (overlay) overlay.style.display = 'none';
        document.body.style.overflow = '';
    }

    // CSS for Spinner Overlay
    (function addSpinnerOverlayCSS() {
        if (document.getElementById('spinner-overlay-style')) return;
        const style = document.createElement('style');
        style.id = 'spinner-overlay-style';
        style.textContent = `
#image-upload-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 9999;
  display: none;
  align-items: center;
  justify-content: center;
}
.spinner-blur-bg {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255,255,255,0.7);
  backdrop-filter: blur(4px);
  z-index: 1;
}
.spinner-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(255,255,255,0.95);
  border-radius: 12px;
  padding: 32px 40px 24px 40px;
  box-shadow: 0 4px 32px rgba(0,0,0,0.12);
}
@media (max-width: 600px) {
  .spinner-content {
    padding: 18px 16px 14px 16px;
    min-width: 180px;
    max-width: 90vw;
  }
  .progress-text {
    font-size: 1rem;
  }
  .spinner {
    width: 32px;
    height: 32px;
    border-width: 4px;
  }
  .cancel-upload-btn {
    width: 32px;
    height: 32px;
    font-size: 1.5rem;
  }
}
.spinner {
  border: 6px solid #e4e4e4;
  border-top: 6px solid #002E7D;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  animation: spin 1s linear infinite;
  margin-bottom: 18px;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.progress-text {
  font-size: 1.2rem;
  color: #002E7D;
  margin-bottom: 18px;
}
.cancel-upload-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: #fff;
  border: none;
  font-size: 2rem;
  color: #d32f2f;
  cursor: pointer;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}
.cancel-upload-btn:hover {
  background: #ffeaea;
}
`;
        document.head.appendChild(style);
    })();

    // Image upload change handler
    imageUpload.addEventListener('change', async function(e) {
        const files = e.target.files;
        imagePreviews.innerHTML = '';
        compressedFiles = [];

        console.log('Image upload triggered, files:', files.length);

        for (const file of Array.from(files)) {
            try {
                console.log('Processing file:', file.name, 'Size:', file.size);
                
                // Check if imageCompression is available
                if (typeof imageCompression === 'undefined') {
                    console.error('Image compression library not loaded');
                    showMessage('Image compression library not available. Please refresh the page.', true);
                    return;
                }

                const options = {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 1920,
                    useWebWorker: true,
                    fileType: 'image/jpeg'
                };
                const compressedFile = await imageCompression(file, options);
                compressedFiles.push(compressedFile);

                console.log('File compressed successfully:', compressedFile.name, 'Size:', compressedFile.size);

                // Only preview the image, do not upload here
                const reader = new FileReader();
                reader.onload = function(event) {
                    const img = document.createElement('img');
                    img.src = event.target.result;
                    img.style.maxWidth = '200px';
                    img.style.margin = '10px';
                    img.style.borderRadius = '4px';
                    imagePreviews.appendChild(img);
                };
                reader.readAsDataURL(compressedFile);
            } catch (error) {
                console.error('Error compressing image:', error);
                showMessage(`Error compressing image: ${file.name} - ${error.message}`, true);
            }
        }
    });

    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (validateForm()) {
            showUploadOverlay(0, null, 'Submitting safety incident...');
            
            try {
                let uploadedImageUrls = [];
                
                // Upload images if any
                console.log('Compressed files to upload:', compressedFiles.length);
                if (compressedFiles.length > 0) {
                    uploadedImageUrls = await uploadImagesToSupabase(compressedFiles);
                    console.log('Uploaded image URLs:', uploadedImageUrls);
                } else {
                    console.log('No images to upload');
                }

                // Check if we're updating a draft
                const submitBtn = document.querySelector('.submit-btn');
                const draftId = submitBtn?.dataset?.draftId;
                
                let result;
                
                                 if (draftId) {
                     // First, fetch existing draft data to get current images
                     const { data: existingDraft, error: fetchError } = await supabase
                         .from('safety_incident_draft')
                         .select('image_urls')
                         .eq('id', draftId)
                         .eq('user_id', userId)
                         .single();
                         
                     if (fetchError) {
                         console.error('Error fetching draft data:', fetchError);
                     }
                     
                     // Combine existing images with new uploaded images
                     let allImageUrls = [];
                     
                     // Add existing images from draft
                     if (existingDraft && existingDraft.image_urls && existingDraft.image_urls.length > 0) {
                         allImageUrls = [...existingDraft.image_urls];
                         console.log('Existing draft images:', existingDraft.image_urls);
                     }
                     
                     // Add newly uploaded images
                     if (uploadedImageUrls.length > 0) {
                         allImageUrls = [...allImageUrls, ...uploadedImageUrls];
                         console.log('New uploaded images:', uploadedImageUrls);
                     }
                     
                     console.log('Combined image URLs for final submission:', allImageUrls);
                     
                     // Convert draft to final submission
                     const formData = {
                         user_id: userId,
                         incident_type: document.getElementById('incidentType').value,
                         incident_date: document.getElementById('incidentDate').value,
                         incident_time: document.getElementById('incidentTime').value,
                         description: document.getElementById('description').value.trim(),
                         hazard_type: document.getElementById('hazardType').value,
                         ppe_used: document.getElementById('ppeUsed').value,
                         location: document.getElementById('location').value.trim(),
                         department: document.getElementById('department').value,
                         severity: document.getElementById('severity').value,
                         injury_type: document.getElementById('injuryType').value,
                         immediate_action: document.getElementById('immediateAction').value.trim(),
                         who_action: document.getElementById('whoAction').value.trim(),
                         when_action_date: document.getElementById('whenActionDate').value.trim(),
                         status_action: document.getElementById('statusAction').value.trim(),
                         investigation_level: document.getElementById('investigationLevel').value,
                         image_urls: allImageUrls.length > 0 ? allImageUrls : null
                     };
                     
                     // First, insert as final submission
                     result = await supabase
                         .from('safety_incident_form')
                         .insert([formData]);
                         
                     if (result.error) {
                         console.error('Error submitting draft as final:', result.error);
                         showMessage('Error submitting draft. Please try again.', true);
                     } else {
                         // Then delete the draft
                         const { error: deleteError } = await supabase
                             .from('safety_incident_draft')
                             .delete()
                             .eq('id', draftId)
                             .eq('user_id', userId);
                             
                         if (deleteError) {
                             console.error('Error deleting draft after submission:', deleteError);
                             // Don't show error to user since submission was successful
                         }
                     }
                        
                                         if (result.error) {
                         console.error('Error submitting draft:', result.error);
                         showMessage('Error submitting draft. Please try again.', true);
                     } else {
                         showMessage('Safety incident submitted successfully!');
                         // Redirect back to the incidents table
                         setTimeout(async () => {
                             // Check if user is admin and redirect accordingly
                             const isAdmin = await checkIfUserIsAdmin();
                             if (isAdmin) {
                                 window.location.href = 'safety_incidents_table.html';
                             } else {
                                 window.location.href = 'emp_safety_incidents_table.html';
                             }
                         }, 2000);
                     }
                } else {
                    // Submit new incident
                    result = await supabase
                        .from('safety_incident_form')
                        .insert([{
                            user_id: userId,
                            incident_type: document.getElementById('incidentType').value,
                            incident_date: document.getElementById('incidentDate').value,
                            incident_time: document.getElementById('incidentTime').value,
                            description: document.getElementById('description').value.trim(),
                            hazard_type: document.getElementById('hazardType').value,
                            ppe_used: document.getElementById('ppeUsed').value,
                            location: document.getElementById('location').value.trim(),
                            department: document.getElementById('department').value,
                            severity: document.getElementById('severity').value,
                            injury_type: document.getElementById('injuryType').value,
                            immediate_action: document.getElementById('immediateAction').value.trim(),
                            who_action: document.getElementById('whoAction').value.trim(),
                            when_action_date: document.getElementById('whenActionDate').value.trim(),
                            status_action: document.getElementById('statusAction').value.trim(),
                            investigation_level: document.getElementById('investigationLevel').value,
                            image_urls: uploadedImageUrls.length > 0 ? uploadedImageUrls : null
                        }]);

                    if (result.error) {
                        console.error('Error submitting form:', result.error);
                        showMessage('Error submitting safety incident. Please try again.', true);
                    } else {
                        showMessage('Safety incident submitted successfully!');
                        form.reset();
                        imagePreviews.innerHTML = '';
                        compressedFiles = [];
                    }
                }
            } catch (error) {
                hideUploadOverlay();
                console.error('Unexpected error:', error);
                showMessage('Error submitting form. Please try again.', true);
            }
        } else {
            console.log("Validation failed, preventing submission.");
        }
        hideUploadOverlay();
    });

         // Save as draft functionality
     saveAsDraftButton.addEventListener('click', async function(event) {
         event.preventDefault();
 
         saveAsDraftButton.disabled = true;
         saveAsDraftButton.textContent = "Saving...";
 
         try {
             let uploadedImageUrls = [];
             
             // Upload images if any
             if (compressedFiles.length > 0) {
                 uploadedImageUrls = await uploadImagesToSupabase(compressedFiles);
             }
 
             // Check if we're editing an existing draft
             const submitBtn = document.querySelector('.submit-btn');
             const draftId = submitBtn?.dataset?.draftId;
             
             let result;
             
             if (draftId) {
                 // Update existing draft
                 result = await supabase
                     .from('safety_incident_draft')
                     .update({
                         incident_type: document.getElementById('incidentType').value,
                         incident_date: document.getElementById('incidentDate').value,
                         incident_time: document.getElementById('incidentTime').value,
                         description: document.getElementById('description').value.trim(),
                         hazard_type: document.getElementById('hazardType').value,
                         ppe_used: document.getElementById('ppeUsed').value,
                         location: document.getElementById('location').value.trim(),
                         department: document.getElementById('department').value,
                         severity: document.getElementById('severity').value,
                         injury_type: document.getElementById('injuryType').value,
                         immediate_action: document.getElementById('immediateAction').value.trim(),
                         who_action: document.getElementById('whoAction').value.trim(),
                         when_action_date: document.getElementById('whenActionDate').value.trim(),
                         status_action: document.getElementById('statusAction').value.trim(),
                         investigation_level: document.getElementById('investigationLevel').value,
                         image_urls: uploadedImageUrls.length > 0 ? uploadedImageUrls : null
                     })
                     .eq('id', draftId)
                     .eq('user_id', userId);
             } else {
                 // Create new draft
                 result = await supabase
                     .from('safety_incident_draft')
                     .insert([{
                         user_id: userId,
                         incident_type: document.getElementById('incidentType').value,
                         incident_date: document.getElementById('incidentDate').value,
                         incident_time: document.getElementById('incidentTime').value,
                         description: document.getElementById('description').value.trim(),
                         hazard_type: document.getElementById('hazardType').value,
                         ppe_used: document.getElementById('ppeUsed').value,
                         location: document.getElementById('location').value.trim(),
                         department: document.getElementById('department').value,
                         severity: document.getElementById('severity').value,
                         injury_type: document.getElementById('injuryType').value,
                         immediate_action: document.getElementById('immediateAction').value.trim(),
                         who_action: document.getElementById('whoAction').value.trim(),
                         when_action_date: document.getElementById('whenActionDate').value.trim(),
                         status_action: document.getElementById('statusAction').value.trim(),
                         investigation_level: document.getElementById('investigationLevel').value,
                         image_urls: uploadedImageUrls.length > 0 ? uploadedImageUrls : null
                     }]);
             }

             if (result.error) {
                 const message = result.error.message || "An error occurred. Please try again.";
                 showMessage('Error saving draft: ' + message, true);
             } else {
                 const message = draftId ? 'Draft updated successfully!' : 'Draft saved successfully!';
                 showMessage(message);
             }
        } catch (error) {
            console.error('Unexpected error saving draft:', error);
            showMessage('Unexpected error saving draft. Please try again.', true);
        } finally {
            saveAsDraftButton.disabled = false;
            saveAsDraftButton.textContent = "Save Draft";
        }
    });

    // Delete draft functionality
    if (deleteDraftButton) {
        deleteDraftButton.addEventListener('click', async function(event) {
            event.preventDefault();
            
            // Confirm deletion
            if (!confirm('Are you sure you want to delete this draft? This action cannot be undone.')) {
                return;
            }
            
            deleteDraftButton.disabled = true;
            deleteDraftButton.textContent = "Deleting...";
            
            try {
                const draftId = deleteDraftButton.dataset.draftId;
                
                if (!draftId) {
                    showMessage('No draft ID found. Please try again.', true);
                    return;
                }
                
                // First, fetch the draft data to get image URLs
                const { data: draftData, error: fetchError } = await supabase
                    .from('safety_incident_draft')
                    .select('image_urls')
                    .eq('id', draftId)
                    .eq('user_id', userId)
                    .single();
                    
                if (fetchError) {
                    console.error('Error fetching draft data:', fetchError);
                }
                
                // Delete images from storage if they exist
                if (draftData && draftData.image_urls && draftData.image_urls.length > 0) {
                    console.log('Deleting draft images from storage:', draftData.image_urls);
                    
                    for (const imageUrl of draftData.image_urls) {
                        try {
                            // Extract file path from URL
                            const urlParts = imageUrl.split('/');
                            const fileName = urlParts[urlParts.length - 1];
                            
                            // Delete from storage
                            const { error: deleteImageError } = await supabase.storage
                                .from('safety-incident-images')
                                .remove([fileName]);
                                
                            if (deleteImageError) {
                                console.error('Error deleting draft image:', fileName, deleteImageError);
                            } else {
                                console.log('Successfully deleted draft image:', fileName);
                            }
                        } catch (imageError) {
                            console.error('Error processing draft image deletion:', imageError);
                        }
                    }
                }
                
                // Now delete the draft from database
                const { error } = await supabase
                    .from('safety_incident_draft')
                    .delete()
                    .eq('id', draftId)
                    .eq('user_id', userId);
                    
                if (error) {
                    console.error('Error deleting draft:', error);
                    showMessage('Error deleting draft. Please try again.', true);
                                 } else {
                     showMessage('Draft deleted successfully!');
                     // Redirect back to the incidents table
                     setTimeout(async () => {
                         // Check if user is admin and redirect accordingly
                         const isAdmin = await checkIfUserIsAdmin();
                         if (isAdmin) {
                             window.location.href = 'safety_incidents_table.html';
                         } else {
                             window.location.href = 'emp_safety_incidents_table.html';
                         }
                     }, 2000);
                 }
            } catch (error) {
                console.error('Unexpected error deleting draft:', error);
                showMessage('Unexpected error deleting draft. Please try again.', true);
            } finally {
                deleteDraftButton.disabled = false;
                deleteDraftButton.textContent = "Delete Draft";
            }
        });
    }

    async function uploadImagesToSupabase(files) {
        const imageUrls = [];
        console.log('Starting image upload to Supabase, files:', files.length);
        
        for (const file of files) {
            try {
                console.log('Uploading file:', file.name, 'Size:', file.size);
                
                const { data, error } = await supabase.storage
                    .from('safety-incident-images') // Safety incident bucket name
                    .upload(`${Date.now()}_${file.name}`, file, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (error) {
                    console.error('Error uploading image:', error);
                    showMessage(`Error uploading ${file.name}: ${error.message}`, true);
                    throw error; // Re-throw to stop the process
                } else {
                    console.log('File uploaded successfully:', data.path);
                    
                    // Get public URL
                    const { data: publicUrlData } = supabase.storage
                        .from('safety-incident-images')
                        .getPublicUrl(data.path);
                    
                    console.log('Public URL generated:', publicUrlData.publicUrl);
                    imageUrls.push(publicUrlData.publicUrl);
                }
            } catch (error) {
                console.error('Unexpected error uploading file:', file.name, error);
                showMessage(`Failed to upload ${file.name}: ${error.message}`, true);
                throw error; // Re-throw to stop the process
            }
        }
        
        console.log('All images uploaded successfully, URLs:', imageUrls);
        return imageUrls;
    }

    function validateForm() {
        const incidentType = document.getElementById('incidentType').value;
        const incidentDate = document.getElementById('incidentDate').value;
        const incidentTime = document.getElementById('incidentTime').value;
        const description = document.getElementById('description').value.trim();
        const hazardType = document.getElementById('hazardType').value;
        const ppeUsed = document.getElementById('ppeUsed').value;
        const location = document.getElementById('location').value.trim();
        const department = document.getElementById('department').value;
        const severity = document.getElementById('severity').value;
        const injuryType = document.getElementById('injuryType').value;
        const immediateAction = document.getElementById('immediateAction').value.trim();
        const investigationLevel = document.getElementById('investigationLevel').value;

        // Basic required fields check
        if (!incidentType || !incidentDate || !incidentTime || !description || 
            !hazardType || !ppeUsed || !location || !department || 
            !severity || !injuryType || !immediateAction || !investigationLevel) {
            console.log("Validation failed: Required fields missing");
            showMessage('Please fill in all required fields.', true);
            return false;
        }

        console.log("Validation successful!");
        return true;
    }
}