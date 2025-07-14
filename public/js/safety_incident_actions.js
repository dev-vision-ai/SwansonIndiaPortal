import { supabase } from '../supabase-config.js';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const incidentId = urlParams.get('id');
    const action = urlParams.get('action');

    if (!incidentId) {
        showError('No incident ID provided');
        return;
    }

    await loadIncidentDetails(incidentId);
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
        const followUpRequired = document.getElementById('follow_up_required').value;
        const status = document.getElementById('status').value;
        const remarks = document.getElementById('remarks').value;

        // Update the incident with HR action data
        const { error } = await supabase
            .from('safety_incident_form')
            .update({
                hr_investigation: hrInvestigation,
                corrective_actions: correctiveActions,
                follow_up_required: followUpRequired,
                status: status,
                remarks: remarks,
                updated_at: new Date().toISOString()
            })
            .eq('id', incidentId);

        if (error) {
            throw error;
        }

        showSuccess('Changes saved successfully');
        
    } catch (error) {
        console.error('Error saving changes:', error);
        showError('Error saving changes: ' + error.message);
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = originalText;
    }
}

function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #d4edda;
        color: #155724;
        padding: 15px;
        border-radius: 5px;
        border: 1px solid #c3e6cb;
        z-index: 1000;
        max-width: 300px;
    `;
    successDiv.textContent = message;
    document.body.appendChild(successDiv);

    setTimeout(() => {
        document.body.removeChild(successDiv);
    }, 3000);
}

function showError(message) {
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
} 