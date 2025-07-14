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
    setupFormEventListeners(userId);
});

async function getLoggedInUserId() {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
}

function setupFormEventListeners(userId) {
    const form = document.getElementById('safetyIncidentForm');
    const chooseImageBtn = document.getElementById('chooseImageBtn');
    const imageUpload = document.getElementById('imageUpload');
    const imagePreviews = document.getElementById('imagePreviews');
    const saveAsDraftButton = document.querySelector('.draft-btn');

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

        for (const file of Array.from(files)) {
            try {
                const options = {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 1920,
                    useWebWorker: true,
                    fileType: 'image/jpeg'
                };
                const compressedFile = await imageCompression(file, options);
                compressedFiles.push(compressedFile);

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
                showMessage(`Error compressing image: ${file.name}`, true);
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
                if (compressedFiles.length > 0) {
                    uploadedImageUrls = await uploadImagesToSupabase(compressedFiles);
                }

                // Submit form data to Supabase
                const { data, error } = await supabase
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
                        image_urls: uploadedImageUrls
                    }]);

                if (error) {
                    console.error('Error submitting form:', error);
                    showMessage('Error submitting safety incident. Please try again.', true);
                } else {
                    showMessage('Safety incident submitted successfully!');
                    form.reset();
                    imagePreviews.innerHTML = '';
                    compressedFiles = [];
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
            const { data, error } = await supabase
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
                    investigation_level: document.getElementById('investigationLevel').value
                }]);

            if (error) {
                const message = error.message || "An error occurred. Please try again.";
                showMessage('Error saving draft: ' + message, true);
            } else {
                showMessage('Draft saved successfully!');
            }
        } catch (error) {
            console.error('Unexpected error saving draft:', error);
            showMessage('Unexpected error saving draft. Please try again.', true);
        } finally {
            saveAsDraftButton.disabled = false;
            saveAsDraftButton.textContent = "Save Draft";
        }
    });

    async function uploadImagesToSupabase(files) {
        const imageUrls = [];
        for (const file of files) {
            const { data, error } = await supabase.storage
                .from('safety-incident-images') // Safety incident bucket name
                .upload(`${Date.now()}_${file.name}`, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                console.error('Error uploading image:', error);
                showMessage(`Error uploading ${file.name}: ${error.message}`, true);
            } else {
                // Get public URL
                const { data: publicUrlData } = supabase.storage
                    .from('safety-incident-images')
                    .getPublicUrl(data.path);
                imageUrls.push(publicUrlData.publicUrl);
            }
        }
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