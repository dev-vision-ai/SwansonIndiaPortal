// Import the Supabase client instance
import { supabase } from '../supabase-config.js';

let editingJobId = null; // Variable to store the ID of the job being edited

// DOM Elements
const jobListTableContainer = document.getElementById('job-list-table-container');
const addJobForm = document.getElementById('add-job-form');
const clearFormButton = document.getElementById('clear-form-btn'); // Get clear button if it exists
const formTitle = document.querySelector('#add-job-section h2');
const submitButton = addJobForm.querySelector('button[type="submit"]');

// --- Utility function to escape HTML ---
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return str.toString()
         .replace(/&/g, '&amp;')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;')
         .replace(/"/g, '&quot;')
         .replace(/'/g, '&#039;');
}

// --- Function to Load and Display Job Postings --- (Combined fetch and display)
async function loadJobPostings() {
    console.log('Loading job postings...');
    jobListTableContainer.innerHTML = '<p>Loading jobs...</p>';

    try {
        const { data: jobs, error } = await supabase
            .from('job_postings')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        console.log('Fetched jobs:', jobs);

        if (!jobs || jobs.length === 0) {
            jobListTableContainer.innerHTML = '<p>No job postings found.</p>';
            return;
        }

        renderJobTable(jobs);

    } catch (error) {
        console.error('Error fetching job postings:', error);
        jobListTableContainer.innerHTML = `<p style="color: red;">Error loading jobs: ${error.message}</p>`;
    }
}

function renderJobTable(jobs) {
    let tableHTML = `
        <table class="job-table">
            <thead>
                <tr>
                    <th>Title</th>
                    <th>Location</th>
                    <th>Salary</th>
                    <th>Experience</th>
                    <th>Vacant Positions</th> 
                    <th>Enrollment Type</th> 
                    <th>Department</th> 
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Apply Before</th>
                    <th>Created At</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    jobs.forEach(job => {
        // Format apply_before date, show N/A if null/undefined
        const applyBeforeDate = job.apply_before
            ? new Date(job.apply_before).toLocaleDateString('en-CA') // en-CA gives YYYY-MM-DD
            : 'N/A';
        const createdAtDate = job.created_at
            ? new Date(job.created_at).toLocaleDateString()
            : 'N/A';

        tableHTML += `
            <tr data-id="${job.id}">
                <td>${escapeHTML(job.title)}</td>
                <td>${escapeHTML(job.location || '')}</td>
                <td>${escapeHTML(job.salary_range || '')}</td>
                <td>${escapeHTML(job.experience_needed || '')}</td>
                <td>${escapeHTML(job.num_positions || '')}</td> 
                <td>${escapeHTML(job.employment_type || '')}</td> 
                <td>${escapeHTML(job.department || '')}</td>
                <td>${escapeHTML(job.program_duration || '')}</td>
                <td>${escapeHTML(job.status)}</td>
                <td>${applyBeforeDate}</td>
                <td>${createdAtDate}</td>
                <td>
                    <button class="edit-btn btn btn-sm btn-warning" data-id="${job.id}">Edit</button>
                    <button class="delete-btn btn btn-sm btn-danger" data-id="${job.id}">Delete</button>
                </td>
            </tr>
        `;
    });

    tableHTML += `</tbody></table>`;
    jobListTableContainer.innerHTML = tableHTML;
    // Event listeners are handled by delegation in setupEventListeners
}

// --- Function to Auto-Resize Textarea ---
function autoResizeTextarea(textarea) {
    // Reset height to recalculate scrollHeight correctly
    textarea.style.height = 'auto'; 
    // Set height to scrollHeight (content height) + a small buffer if needed, or just scrollHeight
    textarea.style.height = textarea.scrollHeight + 'px'; 
}

// --- Populate Form for Editing (Called by event listener) ---
function populateFormForEdit(job) {
    document.getElementById('job-title').value = job.title || '';
    document.getElementById('job-description').value = job.description || '';
    document.getElementById('job-location').value = job.location || '';
    document.getElementById('job-salary').value = job.salary_range || '';
    document.getElementById('job-experience').value = job.experience_needed || '';
    // --- ADD NEW FIELDS --- 
    document.getElementById('num-positions').value = job.num_positions || '';
    document.getElementById('employment-type').value = job.employment_type || 'Full-time'; // Default if null
    document.getElementById('department').value = job.department || '';
    document.getElementById('program-duration').value = job.program_duration || '';
    // --- END NEW FIELDS --- 
    document.getElementById('job-status').value = job.status || 'active';
    document.getElementById('apply_before').value = job.apply_before ? job.apply_before.split('T')[0] : '';

    // Set editing ID and change UI state
    editingJobId = job.id; // Use the global variable
    addJobForm.dataset.editingId = job.id; // Also store on form for safety
    submitButton.textContent = 'Update Job Posting';
    formTitle.textContent = 'Edit Job Posting';
    showCancelButton(); // Show cancel button during edit
    window.scrollTo(0, 0);

    // Trigger resize after populating for edit
    const descriptionTextarea = document.getElementById('job-description');
    autoResizeTextarea(descriptionTextarea); 
}

// --- Clear Form Fields and Reset State ---
function clearForm() {
    addJobForm.reset(); // Resets most fields
    // Explicitly clear fields not reset by default or ensure defaults
    const descriptionTextarea = document.getElementById('job-description');
    descriptionTextarea.value = ''; 
    autoResizeTextarea(descriptionTextarea); 
    document.getElementById('apply_before').value = '';
    document.getElementById('num-positions').value = ''; // Clear number field
    document.getElementById('employment-type').value = 'Full-time'; // Reset select to default
    document.getElementById('department').value = '';
    document.getElementById('program-duration').value = '';

    // Reset editing state
    editingJobId = null;
    delete addJobForm.dataset.editingId;
    submitButton.textContent = 'Save Job Posting';
    formTitle.textContent = 'Add New Job Posting';
    hideCancelButton(); // Hide cancel button
}

// --- Handle Form Submission (Add/Update Job) ---
async function handleFormSubmit(event) {
    event.preventDefault();
    const currentEditingId = addJobForm.dataset.editingId;

    const jobData = {
        title: document.getElementById('job-title').value,
        description: document.getElementById('job-description').value,
        location: document.getElementById('job-location').value,
        salary_range: document.getElementById('job-salary').value,
        experience_needed: document.getElementById('job-experience').value,
        // --- ADD NEW FIELDS --- 
        num_positions: parseInt(document.getElementById('num-positions').value) || null, // Parse as integer or null
        employment_type: document.getElementById('employment-type').value,
        department: document.getElementById('department').value,
        program_duration: document.getElementById('program-duration').value,
        // --- END NEW FIELDS --- 
        status: document.getElementById('job-status').value,
        apply_before: document.getElementById('apply_before').value || null
    };

    // Validation (add validation for num_positions if needed)
    if (!jobData.title) {
        alert('Job Title is required.');
        return;
    }
    // Optional: Validate num_positions is a positive number if entered
    const numPosValue = document.getElementById('num-positions').value;
    if (numPosValue && (isNaN(parseInt(numPosValue)) || parseInt(numPosValue) <= 0)) {
         alert('Number of Vacant Positions must be a positive number.');
         return;
    }
    if (jobData.apply_before && isNaN(Date.parse(jobData.apply_before))) {
        alert('Invalid Apply Before date format.');
        return;
    }

    try {
        if (currentEditingId) {
            // Update existing job
            console.log(`Updating job with ID: ${currentEditingId}`);
            const { error } = await supabase
                .from('job_postings')
                .update(jobData)
                .eq('id', currentEditingId);
            if (error) throw error;
            alert('Job posting updated successfully!');
        } else {
            // Add new job
            console.log('Adding new job.');
            const { error } = await supabase
                .from('job_postings')
                .insert([jobData]);
            if (error) throw error;
            alert('Job posting added successfully!');
        }
        clearForm();
        loadJobPostings();
    } catch (error) {
        console.error('Error saving job posting:', error);
        alert(`Error saving job posting: ${error.message}`);
    }
}

// --- Handle Delete Job (Called by event listener) ---
async function handleDeleteJob(jobId) {
    console.log(`Attempting to delete job with ID: ${jobId}`);
    if (!confirm('Are you sure you want to delete this job posting?')) {
        return;
    }
    try {
        const { error } = await supabase
            .from('job_postings')
            .delete()
            .eq('id', jobId);
        if (error) throw error;
        console.log(`Job ${jobId} deleted successfully.`);
        alert('Job posting deleted successfully.');
        loadJobPostings(); // Refresh list
        // If the deleted job was being edited, clear the form
        if (editingJobId === jobId || addJobForm.dataset.editingId === jobId) {
            clearForm();
        }
    } catch (error) {
        console.error('Error deleting job:', error);
        alert(`Error deleting job: ${error.message}`);
    }
}

// --- Helper function to show the Cancel button ---
function showCancelButton() {
    let cancelButton = addJobForm.querySelector('.cancel-edit-btn');
    if (!cancelButton) {
        cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.textContent = 'Cancel Edit';
        cancelButton.classList.add('btn', 'btn-secondary', 'cancel-edit-btn'); // Use standard classes
        cancelButton.style.marginLeft = '10px';
        cancelButton.addEventListener('click', clearForm);
        // Insert into form actions div if it exists, otherwise after submit button
        const formActions = addJobForm.querySelector('.form-actions');
        if (formActions) {
            formActions.appendChild(cancelButton);
        } else {
            submitButton.after(cancelButton);
        }
    } else {
        cancelButton.style.display = 'inline-block';
    }
}

// --- Helper function to hide the Cancel button ---
function hideCancelButton() {
    const cancelButton = addJobForm.querySelector('.cancel-edit-btn');
    if (cancelButton) {
        cancelButton.style.display = 'none';
    }
}

// --- Setup Event Listeners ---
function setupEventListeners() {
    if (addJobForm) {
        addJobForm.addEventListener('submit', handleFormSubmit);
    } else {
        console.error('Add job form not found!');
    }

    // Use clearFormButton if defined
    if (clearFormButton) {
        clearFormButton.addEventListener('click', clearForm);
    } else {
         console.warn('Clear form button (#clear-form-btn) not found!');
    }

    // Event delegation for edit/delete buttons
    if (jobListTableContainer) {
        jobListTableContainer.addEventListener('click', async (event) => {
            const target = event.target;
            const jobId = target.closest('tr')?.dataset.id; // Get ID from parent row

            if (target.classList.contains('edit-btn') && jobId) {
                // Fetch the specific job details for editing
                try {
                    const { data: job, error } = await supabase
                        .from('job_postings')
                        .select('*')
                        .eq('id', jobId)
                        .single();
                    if (error) throw error;
                    if (job) {
                        populateFormForEdit(job);
                    } else {
                        alert('Job not found.');
                    }
                } catch (error) {
                    console.error('Error fetching job details for edit:', error);
                    alert(`Error loading job details: ${error.message}`);
                }
            } else if (target.classList.contains('delete-btn') && jobId) {
                handleDeleteJob(jobId);
            }
        });
    } else {
        console.error('Job list table container not found!');
    }

    // Add listener for textarea auto-resize
    const descriptionTextarea = document.getElementById('job-description');
    if (descriptionTextarea) {
        descriptionTextarea.addEventListener('input', () => {
            autoResizeTextarea(descriptionTextarea);
        });
    }
}

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed for job management.');
    // checkAuth(); // Ensure checkAuth is defined and imported if needed
    loadJobPostings(); // Use the correct function name
    setupEventListeners();
    hideCancelButton(); // Ensure cancel button is hidden initially
});
