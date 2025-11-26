import { supabase } from '../supabase-config.js';

/**
 * DCC Review Form Logic (copy for list page)
 * Handles DCN list table population and form submission for DCN reviews
 * This is a duplicate of document-review-form.js saved as document-review-form-list.js
 */

// --- Fetch and display all DCNs with "Under Review" status where current user is assigned as reviewer ---
async function fetchDCNsForReview() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error('User not logged in');
            return;
        }

        console.log('Current user ID:', user.id);

        // Fetch DCNs with "Under Review" status where current user is assigned as reviewer
        // We need to check the review_participants JSONB field for the current user's ID
        const { data: dcns, error } = await supabase
            .from('dcc_master_table')
            .select('*')
            .eq('status', 'Under Review')
            .order('issued_date', { ascending: false });

        if (error) {
            console.error('Error fetching DCNs:', error);
            return;
        }

        // Filter DCNs where current user is assigned as a reviewer
        const userAssignedDCNs = dcns?.filter(dcn => {
            if (!dcn.review_participants) {
                return false;
            }

            let participants = dcn.review_participants;
            let isAssigned = false;

            // Handle both array and object formats
            if (Array.isArray(participants)) {
                // Array format: check if any participant has matching user_id
                isAssigned = participants.some(participant => 
                    participant && participant.user_id === user.id
                );
            } else if (typeof participants === 'object') {
                // Object format: check if any department has participant with matching user_id
                for (const [dept, participant] of Object.entries(participants)) {
                    if (participant && participant.user_id === user.id) {
                        isAssigned = true;
                        break;
                    }
                }
            }

            return isAssigned;
        }) || [];

        renderDCNReviewTable(userAssignedDCNs);
    } catch (err) {
        console.error('Error in fetchDCNsForReview:', err);
    }
}

function renderDCNReviewTable(dcns) {
    const tbody = document.getElementById('dccReviewTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (dcns.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 2rem; color: #6b7280;">
                    No DCNs awaiting review
                </td>
            </tr>
        `;
        return;
    }

    dcns.forEach((dcn, index) => {
        const srNo = index + 1;
        const dcnNo = dcn.dcn_no || '-';
        const requestorName = dcn.requestor_name || '-';
        const requestorDept = dcn.requestor_dept || '-';
        const documentTitle = dcn.document_title || '-';
        
        // Get purpose of review (prefer `purpose_of_review`, fall back to legacy `purpose`)
        let purposeOfReview = '-';
        const porRaw = dcn.purpose_of_review !== undefined ? dcn.purpose_of_review : dcn.purpose;
        if (porRaw) {
            // If already an array
            if (Array.isArray(porRaw)) {
                purposeOfReview = porRaw.slice(0, 2).join(', ');
            } else if (typeof porRaw === 'string') {
                // Could be a JSON string or a plain comma-separated string
                try {
                    const parsed = JSON.parse(porRaw);
                    if (Array.isArray(parsed)) purposeOfReview = parsed.slice(0,2).join(', ');
                    else purposeOfReview = String(parsed).slice(0,50);
                } catch (e) {
                    // Not JSON - use as-is (trim to reasonable length)
                    purposeOfReview = porRaw.split(',').slice(0,2).map(s=>s.trim()).join(', ');
                }
            }
        }
        
        // Get first document type if array
        let docType = '-';
        if (dcn.document_types && Array.isArray(dcn.document_types)) {
            docType = dcn.document_types.slice(0, 2).join(', ');
        }
        
        const status = dcn.status || 'Unknown';

        // Determine status color and display text based on review completion
        let statusClass = 'status-active';
        let displayStatus = status;
        
        // Check if all reviewers have submitted their reviews
        if (dcn.review_participants) {
            let allReviewsSubmitted = true;
            let participants = dcn.review_participants;
            
            // Handle both array and object formats
            if (Array.isArray(participants)) {
                // Array format: check if all participants have review_status
                allReviewsSubmitted = participants.every(participant => 
                    participant && participant.review_status && 
                    (participant.review_status === 'approved' || participant.review_status === 'rejected')
                );
            } else if (typeof participants === 'object') {
                // Object format: check if all participants have review_status
                for (const [dept, participant] of Object.entries(participants)) {
                    if (!participant || !participant.review_status || 
                        (participant.review_status !== 'approved' && participant.review_status !== 'rejected')) {
                        allReviewsSubmitted = false;
                        break;
                    }
                }
            }
            
            // If all reviews are submitted, show "Approved", otherwise show "Under Review"
            if (allReviewsSubmitted) {
                displayStatus = 'Approved';
                statusClass = 'status-active'; // Green color for approved
            } else {
                displayStatus = 'Under Review';
                statusClass = 'status-under-review'; // Yellow/orange color for under review
            }
        } else {
            // No participants assigned, keep original status
            if (status === 'Draft') statusClass = 'status-draft';
            else if (status === 'Under Review') statusClass = 'status-under-review';
            else if (status === 'Rejected' || status === 'Obsolete') statusClass = 'status-obsolete';
        }

        // Format reviewer status information
        let reviewerStatusText = '';
        if (dcn.review_participants) {
            const reviewers = [];
            let participants = dcn.review_participants;
            
            // Handle both array and object formats
            if (Array.isArray(participants)) {
                // Array format
                participants.forEach((participant, index) => {
                    if (participant && participant.name && participant.name.trim() !== '' && participant.name !== 'NA') {
                        const status = participant.review_status ? 
                            (participant.review_status === 'approved' ? 'Approved' : 
                             participant.review_status === 'rejected' ? 'Rejected' : 'Pending') : 'Pending';
                        const colorClass = status === 'Approved' ? 'text-green-600' : 
                                         status === 'Rejected' ? 'text-red-600' : 'text-orange-600';
                        reviewers.push(`<span class="${colorClass} font-medium">${participant.name.trim()} (${status})</span>`);
                    }
                });
            } else if (typeof participants === 'object') {
                // Object format
                for (const [dept, participant] of Object.entries(participants)) {
                    if (participant && participant.name && participant.name.trim() !== '' && participant.name !== 'NA') {
                        const status = participant.review_status ? 
                            (participant.review_status === 'approved' ? 'Approved' : 
                             participant.review_status === 'rejected' ? 'Rejected' : 'Pending') : 'Pending';
                        const colorClass = status === 'Approved' ? 'text-green-600' : 
                                         status === 'Rejected' ? 'text-red-600' : 'text-orange-600';
                        reviewers.push(`<span class="${colorClass} font-medium">${participant.name.trim()} (${status})</span>`);
                    }
                }
            }
            
            reviewerStatusText = reviewers.join(', ');
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${srNo}</td>
            <td>${dcnNo}</td>
            <td>${requestorName}</td>
            <td>${requestorDept}</td>
            <td style="text-align: left;">${documentTitle}</td>
            <td>${purposeOfReview}</td>
            <td>${docType}</td>
            <td><span class="${statusClass}">${displayStatus}</span></td>
            <td style="text-align: left; font-size: 0.7rem;">${reviewerStatusText || 'No reviewers assigned'}</td>
            <td>
                <div class="flex justify-center space-x-1 flex-nowrap max-w-full overflow-hidden">
                    <!-- Purple Review button -->
                    <button type="button" class="review-dcn-btn p-1 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-600 hover:text-purple-800 transition-all duration-200 border border-purple-200 hover:border-purple-300 flex-shrink-0" title="Review" data-dcn-id="${dcn.id}" data-dcn-no="${dcnNo}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                        </svg>
                    </button>
                    <!-- Green Approve button -->
                    <button type="button" class="approve-dcn-btn p-1 rounded-md bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-800 transition-all duration-200 border border-green-200 hover:border-green-300 flex-shrink-0" title="Approve" data-dcn-id="${dcn.id}" data-dcn-no="${dcnNo}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                    </button>
                    <!-- Red Reject button -->
                    <button type="button" class="reject-dcn-btn p-1 rounded-md bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 transition-all duration-200 border border-red-200 hover:border-red-300 flex-shrink-0" title="Reject" data-dcn-id="${dcn.id}" data-dcn-no="${dcnNo}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Attach event listeners to action buttons
    attachDCNTableEventListeners();
}

function attachDCNTableEventListeners() {
    // Review DCN button
    document.querySelectorAll('.review-dcn-btn').forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.preventDefault();
            const dcnId = this.getAttribute('data-dcn-id');
            const dcnNo = this.getAttribute('data-dcn-no');
            viewDCN(dcnId, dcnNo, false); // Edit mode for review
        });
    });

    // Approve DCN button
    document.querySelectorAll('.approve-dcn-btn').forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.preventDefault();
            const dcnId = this.getAttribute('data-dcn-id');
            const dcnNo = this.getAttribute('data-dcn-no');
            approveDCN(dcnId, dcnNo);
        });
    });

    // Reject DCN button
    document.querySelectorAll('.reject-dcn-btn').forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.preventDefault();
            const dcnId = this.getAttribute('data-dcn-id');
            const dcnNo = this.getAttribute('data-dcn-no');
            rejectDCN(dcnId, dcnNo);
        });
    });
}

async function viewDCN(dcnId, dcnNo, isViewOnly) {
    try {
        // Open form page with DCN ID - form will pre-fill with data and allow editing for reviewers
        window.location.href = `../html/document-review-form.html?id=${dcnId}&action=view`;
    } catch (err) {
        console.error('Error viewing DCN:', err);
        alert('Error opening DCN');
    }
}

async function approveDCN(dcnId, dcnNo) {
    // Show confirmation modal
    const modal = document.getElementById('dcnConfirmationModal');
    const message = document.getElementById('dcnConfirmationMessage');
    const confirmBtn = document.getElementById('dcnConfirmYes');
    const cancelBtn = document.getElementById('dcnConfirmNo');
    
    message.textContent = `Approve DCN ${dcnNo}?`;
    modal.style.display = 'flex';
    
    // Handle user response
    const confirmed = await new Promise(resolve => {
        const handleConfirm = () => {
            modal.style.display = 'none';
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            resolve(true);
        };
        const handleCancel = () => {
            modal.style.display = 'none';
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            resolve(false);
        };
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
    });
    
    if (!confirmed) return;

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not logged in');

        // Get current DCN data including review_participants
        const { data: dcn, error: dcnError } = await supabase
            .from('dcc_master_table')
            .select('review_participants, status')
            .eq('id', dcnId)
            .single();

        if (dcnError || !dcn) {
            alert('Error: Could not verify DCN assignment');
            return;
        }

        // Check if current user is assigned as reviewer and find ALL their occurrences
        let isAssigned = false;
        let userDepartments = []; // Store ALL occurrences, not just first one
        const participants = dcn.review_participants;

        if (Array.isArray(participants)) {
            // Array format - find ALL user occurrences and get their indices
            participants.forEach((participant, index) => {
                if (participant && participant.user_id === user.id) {
                    isAssigned = true;
                    userDepartments.push(index);
                }
            });
        } else if (typeof participants === 'object') {
            // Object format - find ALL user occurrences
            for (const [dept, participant] of Object.entries(participants)) {
                if (participant && participant.user_id === user.id) {
                    isAssigned = true;
                    userDepartments.push(dept);
                }
            }
        }

        if (!isAssigned) {
            alert('Error: You are not assigned to review this DCN');
            return;
        }

        // Update the review_participants with the user's approval for ALL occurrences
        const updatedParticipants = { ...participants };
        const currentTime = new Date().toISOString();

        if (Array.isArray(participants)) {
            // Array format - update all indices
            userDepartments.forEach(index => {
                if (updatedParticipants[index]) {
                    updatedParticipants[index] = {
                        ...updatedParticipants[index],
                        review_status: 'approved',
                        reviewed_at: currentTime
                    };
                }
            });
        } else {
            // Object format - update all departments
            userDepartments.forEach(dept => {
                if (updatedParticipants[dept]) {
                    updatedParticipants[dept] = {
                        ...updatedParticipants[dept],
                        review_status: 'approved',
                        reviewed_at: currentTime
                    };
                }
            });
        }

        const { error } = await supabase
            .from('dcc_master_table')
            .update({
                review_participants: updatedParticipants,
                updated_by: user.id,
                updated_at: currentTime
            })
            .eq('id', dcnId);

        if (error) throw error;

        // Show success message in the compact modal instead of browser alert
        await showModalMessage(`DCN ${dcnNo} approved successfully!`);
        // Refresh the table
        fetchDCNsForReview();
    } catch (err) {
        console.error('Error approving DCN:', err);
        alert(`Error approving DCN: ${err.message}`);
    }
}

async function rejectDCN(dcnId, dcnNo) {
    // Show confirmation modal
    const modal = document.getElementById('dcnConfirmationModal');
    const message = document.getElementById('dcnConfirmationMessage');
    const confirmBtn = document.getElementById('dcnConfirmYes');
    const cancelBtn = document.getElementById('dcnConfirmNo');
    
    message.textContent = `Reject DCN ${dcnNo}?`;
    modal.style.display = 'flex';
    
    // Handle user response
    const confirmed = await new Promise(resolve => {
        const handleConfirm = () => {
            modal.style.display = 'none';
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            resolve(true);
        };
        const handleCancel = () => {
            modal.style.display = 'none';
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            resolve(false);
        };
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
    });
    
    if (!confirmed) return;

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not logged in');

        // Get current DCN data including review_participants
        const { data: dcn, error: dcnError } = await supabase
            .from('dcc_master_table')
            .select('review_participants, status')
            .eq('id', dcnId)
            .single();

        if (dcnError || !dcn) {
            alert('Error: Could not verify DCN assignment');
            return;
        }

        // Check if current user is assigned as reviewer and find ALL their occurrences
        let isAssigned = false;
        let userDepartments = []; // Store ALL occurrences, not just first one
        const participants = dcn.review_participants;

        if (Array.isArray(participants)) {
            // Array format - find ALL user occurrences and get their indices
            participants.forEach((participant, index) => {
                if (participant && participant.user_id === user.id) {
                    isAssigned = true;
                    userDepartments.push(index);
                }
            });
        } else if (typeof participants === 'object') {
            // Object format - find ALL user occurrences
            for (const [dept, participant] of Object.entries(participants)) {
                if (participant && participant.user_id === user.id) {
                    isAssigned = true;
                    userDepartments.push(dept);
                }
            }
        }

        if (!isAssigned) {
            alert('Error: You are not assigned to review this DCN');
            return;
        }

        // Update the review_participants with the user's rejection for ALL occurrences
        const updatedParticipants = { ...participants };
        const currentTime = new Date().toISOString();

        if (Array.isArray(participants)) {
            // Array format - update all indices
            userDepartments.forEach(index => {
                if (updatedParticipants[index]) {
                    updatedParticipants[index] = {
                        ...updatedParticipants[index],
                        review_status: 'rejected',
                        reviewed_at: currentTime
                    };
                }
            });
        } else {
            // Object format - update all departments
            userDepartments.forEach(dept => {
                if (updatedParticipants[dept]) {
                    updatedParticipants[dept] = {
                        ...updatedParticipants[dept],
                        review_status: 'rejected',
                        reviewed_at: currentTime
                    };
                }
            });
        }

        const { error } = await supabase
            .from('dcc_master_table')
            .update({
                review_participants: updatedParticipants,
                updated_by: user.id,
                updated_at: currentTime
            })
            .eq('id', dcnId);

        if (error) throw error;

        await showModalMessage(`DCN ${dcnNo} rejected successfully!`);
        // Refresh the table
        fetchDCNsForReview();
    } catch (err) {
        console.error('Error rejecting DCN:', err);
        alert(`Error rejecting DCN: ${err.message}`);
    }
}

// --- Form Data Collection ---
// Form-related functionality removed for list-only page. The list page only renders the table
// and handles approve/view/reject actions. If you need to reintroduce form submission
// later, reuse `public/js/document-review-form.js` which contains the full form logic.

/**
 * Show a simple message-only modal using the existing compact confirmation modal.
 * Returns a Promise that resolves when the user clicks OK.
 */
function showModalMessage(message) {
    return new Promise((resolve) => {
        try {
            const modal = document.getElementById('dcnConfirmationModal');
            const messageEl = document.getElementById('dcnConfirmationMessage');
            const confirmBtn = document.getElementById('dcnConfirmYes');
            const cancelBtn = document.getElementById('dcnConfirmNo');

            if (!modal || !messageEl || !confirmBtn || !cancelBtn) {
                // Fallback to alert if modal elements are not available
                alert(message);
                resolve();
                return;
            }

            // Save original states to restore later
            const origCancelDisplay = cancelBtn.style.display || '';
            const origConfirmText = confirmBtn.textContent || '';
            const origConfirmMargin = confirmBtn.style.margin || '';

            // Configure modal for message-only display
            messageEl.textContent = message;
            cancelBtn.style.display = 'none';
            confirmBtn.textContent = 'OK';
            confirmBtn.style.margin = '0 auto';

            // Show modal
            modal.style.display = 'flex';

            const handleOk = () => {
                // Hide modal and restore original button states
                modal.style.display = 'none';
                confirmBtn.removeEventListener('click', handleOk);
                // restore
                cancelBtn.style.display = origCancelDisplay;
                confirmBtn.textContent = origConfirmText;
                confirmBtn.style.margin = origConfirmMargin;
                resolve();
            };

            confirmBtn.addEventListener('click', handleOk);
        } catch (err) {
            console.error('showModalMessage error:', err);
            alert(message);
            resolve();
        }
    });
}

// --- DOM Content Loaded ---
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DCC Review List page loaded');

    // Fetch and display DCNs awaiting review
    await fetchDCNsForReview();
});