import { supabase } from '../supabase-config.js';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const incidentId = urlParams.get('id');
    const mode = urlParams.get('mode'); // Get mode from URL

    if (!incidentId) {
        showError('No incident ID provided');
        return;
    }

    await loadIncidentDetails(incidentId);

    // --- MODE HANDLING ---
    const form = document.getElementById('incident-form');
    const saveButton = document.getElementById('saveButton');
    const deleteButton = document.getElementById('deleteButton');
    if (mode !== 'edit') {
        // Make all inputs, selects, textareas read-only/disabled
        if (form) {
            Array.from(form.elements).forEach(el => {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
                    el.setAttribute('readonly', 'readonly');
                    el.setAttribute('disabled', 'disabled');
                }
            });
        }
        if (saveButton) {
            saveButton.style.display = 'none';
            saveButton.classList.add('hidden');
        }
        if (deleteButton) {
            deleteButton.style.display = 'none';
            deleteButton.classList.add('hidden');
        }
    } else {
        // Enable editing
        if (form) {
            Array.from(form.elements).forEach(el => {
                el.removeAttribute('readonly');
                el.removeAttribute('disabled');
            });
        }
        if (saveButton) {
            saveButton.style.display = '';
            saveButton.classList.remove('hidden');
        }
        if (deleteButton) {
            deleteButton.style.display = '';
            deleteButton.classList.remove('hidden');
            deleteButton.onclick = async function() {
                if (confirm('Are you sure you want to delete this safety incident? This action cannot be undone.')) {
                    const incidentId = document.getElementById('incidentId').value;
                    const { error } = await supabase
                        .from('safety_incident_form')
                        .delete()
                        .eq('id', incidentId);
                    if (error) {
                        showError('Error deleting incident: ' + error.message);
                    } else {
                        alert('Incident deleted successfully.');
                        window.location.href = 'safety_incidents_table.html';
                    }
                }
            };
        }
        // --- Always disable these fields for integrity ---
        document.getElementById('user_name')?.setAttribute('readonly', 'readonly');
        document.getElementById('incident_date')?.setAttribute('readonly', 'readonly');
        document.getElementById('incident_time')?.setAttribute('readonly', 'readonly');
    }
    // --- END MODE HANDLING ---

    setupEventListeners();
});

// Helper to generate incident number in YYMM-serial format
async function getIncidentNo(incident) {
    if (!incident.incident_date) return incident.id;
    const date = new Date(incident.incident_date);
    const year = String(date.getFullYear() % 100).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const prefix = `${year}${month}`;
    // Query all incidents for this month to determine serial
    const { data, error } = await supabase
        .from('safety_incident_form')
        .select('id, incident_date')
        .gte('incident_date', `${date.getFullYear()}-${month}-01`)
        .lte('incident_date', `${date.getFullYear()}-${month}-31`);
    if (error || !data) return incident.id;
    // Sort by date, then by id for stable order
    const sorted = data.sort((a, b) => {
        const da = new Date(a.incident_date);
        const db = new Date(b.incident_date);
        if (da - db !== 0) return da - db;
        return a.id.localeCompare(b.id);
    });
    const serial = String(sorted.findIndex(i => i.id === incident.id) + 1).padStart(2, '0');
    return `${prefix}-${serial}`;
}

async function loadIncidentDetails(incidentId) {
    const loadingMessage = document.getElementById('loading-message');
    const errorMessage = document.getElementById('error-message');
    const form = document.getElementById('incident-form');

    try {
        // Hide form and show loading
        if (form) form.style.display = 'none';
        if (loadingMessage) loadingMessage.style.display = 'block';
        if (errorMessage) errorMessage.style.display = 'none';

        // Fetch incident data from safety_incident_form table
        const { data: incidentData, error: incidentError } = await supabase
            .from('safety_incident_form')
            .select(`
                *,
                users ( full_name )
            `)
            .eq('id', incidentId)
            .single();

        if (incidentError) {
            console.error('Error fetching incident:', incidentError);
            throw incidentError;
        }

        if (!incidentData) {
            throw new Error('Incident not found');
        }

        // Populate form fields
        await populateFormFields(incidentData);

        // Show form and hide loading
        if (form) form.style.display = 'block';
        if (loadingMessage) loadingMessage.style.display = 'none';

    } catch (error) {
        console.error('Error loading incident details:', error);
        if (loadingMessage) loadingMessage.style.display = 'none';
        showError('Error loading incident details: ' + error.message);
    }
}

async function populateFormFields(data) {
    // Basic incident information
    document.getElementById('incidentId').value = data.id;
    // Generate and display formatted incident number
    const incidentNo = await getIncidentNo(data);
    document.getElementById('incidentIdDisplay').value = incidentNo;
    document.getElementById('user_name').value = data.users ? data.users.full_name : 'Unknown';
    document.getElementById('incident_date').value = data.incident_date || '';
    document.getElementById('incident_time').value = data.incident_time || '';
    document.getElementById('incident_type').value = data.incident_type || '';
    document.getElementById('severity').value = data.severity || '';
    document.getElementById('department').value = data.department || '';
    document.getElementById('location').value = data.location || '';
    document.getElementById('hazard_type').value = data.hazard_type || '';
    document.getElementById('ppe_used').value = data.ppe_used || '';
    document.getElementById('injury_type').value = data.injury_type || '';
    document.getElementById('investigation_level').value = data.investigation_level || '';
    document.getElementById('description').value = data.description || '';

    // Immediate action fields
    document.getElementById('immediate_action').value = data.immediate_action || '';
    document.getElementById('who_action').value = data.who_action || '';
    document.getElementById('when_action_date').value = data.when_action_date || '';
    document.getElementById('status_action').value = data.status_action || '';

    // HR/ADHR action fields
    document.getElementById('hr_investigation').value = data.hr_investigation || '';
    document.getElementById('corrective_actions').value = data.corrective_actions || '';
    document.getElementById('follow_up_required').value = data.follow_up_required || '';
    document.getElementById('status').value = data.status || '';
    document.getElementById('remarks').value = data.remarks || '';
    // Add these for corrective action who/when/status
    document.getElementById('corrective_who').value = data.corrective_action_who || '';
    document.getElementById('corrective_when').value = data.corrective_action_when || '';
    document.getElementById('corrective_status').value = data.corrective_action_status || '';

    // Display images if any
    displayImages(data.image_urls);
}

function displayImages(imageUrls) {
    const imageContainer = document.getElementById('imageDisplayContainer');
    if (!imageContainer) return;

    if (!imageUrls || imageUrls.length === 0) {
        imageContainer.innerHTML = '<p>No images uploaded</p>';
        return;
    }

    const imageHTML = imageUrls.map(url => `
        <div style="display: inline-block; margin: 10px;">
            <img src="${url}" alt="Incident Image" style="max-width: 200px; max-height: 150px; border-radius: 4px; border: 1px solid #ddd;">
        </div>
    `).join('');

    imageContainer.innerHTML = imageHTML;
}

function setupEventListeners() {
    const redirectToHRButton = document.getElementById('redirectToHRButton');
    const saveButton = document.getElementById('saveButton');
    const form = document.getElementById('incident-form');

    if (redirectToHRButton) {
        redirectToHRButton.addEventListener('click', () => {
            redirectToHRAdmin();
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveChanges();
        });
    }
}

function redirectToHRAdmin() {
    const incidentId = document.getElementById('incidentId').value;
    
    // Redirect to admin_adhr with the incident ID
    const redirectUrl = `admin_adhr.html?incident_id=${incidentId}&type=safety_incident`;
    
    // Show confirmation dialog
    if (confirm('Redirect this safety incident to HR Admin dashboard for investigation?')) {
        window.location.href = redirectUrl;
    }
}

async function saveChanges() {
    const saveButton = document.getElementById('saveButton');
    const originalText = saveButton.textContent;
    
    try {
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';

        const incidentId = document.getElementById('incidentId').value;
        const hrInvestigation = document.getElementById('hr_investigation').value;
        const correctiveActions = document.getElementById('corrective_actions').value;
        const correctiveActionWho = document.getElementById('corrective_who').value;
        const correctiveActionWhen = document.getElementById('corrective_when').value;
        const correctiveActionStatus = document.getElementById('corrective_status').value;
        const followUpRequired = document.getElementById('follow_up_required').value;
        const status = document.getElementById('status').value;
        const remarks = document.getElementById('remarks').value;

        // Update the incident with HR action data
        const { error } = await supabase
            .from('safety_incident_form')
            .update({
                hr_investigation: hrInvestigation,
                corrective_actions: correctiveActions,
                corrective_action_who: correctiveActionWho,
                corrective_action_when: correctiveActionWhen,
                corrective_action_status: correctiveActionStatus,
                follow_up_required: followUpRequired,
                status: status,
                remarks: remarks,
                updated_at: new Date().toISOString()
            })
            .eq('id', incidentId);

        if (error) {
            throw error;
        }

        alert('Changes saved successfully');
        // Reload the latest data
        await loadIncidentDetails(incidentId);
        
    } catch (error) {
        console.error('Error saving changes:', error);
        showError('Error saving changes: ' + error.message);
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = originalText;
    }
}

function showError(message) {
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
} 