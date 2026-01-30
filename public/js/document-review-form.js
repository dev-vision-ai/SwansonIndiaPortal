import { supabase } from '../supabase-config.js';
import { showToast, storePendingToast } from './toast.js';

/**
 * DCC Review Form Logic (form-only)
 * Handles DCN form submission for DCN reviews.
 * Table rendering and list operations are in document-review-form-list.js.
 */

// Use shared showToast from ./toast.js for consistent notifications

// --- Document Viewer Functions ---
async function loadDocumentForReview(dcnNo) {
    try {

        if (!dcnNo) {
            showDocumentPlaceholder('No DCN number available');
            return;
        }

        // Show loading indicator
        showDocumentLoading();

        // List files in dcn-documents bucket with DCN prefix
        const prefix = `${dcnNo}_`;
        const { data: files, error } = await supabase.storage
            .from('dcn-documents')
            .list('', { limit: 1000 });

        if (error) {
            console.error('Error listing documents:', error);
            showDocumentPlaceholder('Error loading document');
            return;
        }

        // Filter files by DCN prefix and find the most recent one
        const dcnFiles = (files || []).filter(f => f.name && f.name.startsWith(prefix));

        if (dcnFiles.length === 0) {
            showDocumentPlaceholder('No document uploaded for this DCN');
            return;
        }

        // Sort by last modified date (most recent first) and get the first one
        dcnFiles.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
        const documentFile = dcnFiles[0];


        // Get public URL for the document
        const { data: urlData } = supabase.storage
            .from('dcn-documents')
            .getPublicUrl(documentFile.name);

        if (urlData?.publicUrl) {
            displayDocument(urlData.publicUrl, documentFile.name);
        } else {
            showDocumentPlaceholder('Unable to load document');
        }

    } catch (err) {
        console.error('Error loading document:', err);
        showDocumentPlaceholder('Error loading document');
    }
}

function showDocumentPlaceholder(message) {
    const placeholder = document.getElementById('documentViewerPlaceholder');
    const iframe = document.getElementById('documentViewer');

    if (placeholder && iframe) {
        placeholder.style.display = 'flex';
        iframe.style.display = 'none';

        // Update placeholder message
        const messageElement = placeholder.querySelector('p:nth-child(2)');
        if (messageElement) {
            messageElement.textContent = message;
        }
        // Disable open button when showing a placeholder
        if (typeof setOpenButtonState === 'function') setOpenButtonState(false);
    }
}

function showDocumentLoading() {
    const placeholder = document.getElementById('documentViewerPlaceholder');
    const iframe = document.getElementById('documentViewer');

    if (placeholder && iframe) {
        placeholder.style.display = 'flex';
        iframe.style.display = 'none';

        // Show loading message
        placeholder.innerHTML = `
            <div class="document-placeholder-content">
                <svg style="width:64px; height:64px; margin:0 auto 1rem; color:#3b82f6;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                <p style="font-weight:500; margin-bottom:0.5rem; color:#3b82f6;">Loading document...</p>
                <div style="display:flex; justify-content:center; margin-top:1rem;">
                    <div style="width:32px; height:32px; border:3px solid #e5e7eb; border-top:3px solid #3b82f6; border-radius:50%; animation:spin 1s linear infinite;"></div>
                </div>
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            </div>
        `;
        // While loading, disable open button until we know the URL is viewable
        if (typeof setOpenButtonState === 'function') setOpenButtonState(false);
    }
}

function displayDocument(url, filename) {
    const placeholder = document.getElementById('documentViewerPlaceholder');
    const iframe = document.getElementById('documentViewer');

    if (placeholder && iframe) {
        placeholder.style.display = 'none';
        iframe.style.display = 'block';

        // Remember current document URL so other controls (open in new window) can use it
        try {
            window.currentDocumentUrl = url;
            window.currentDocumentFilename = filename;
            // reset viewer url; specific viewers will set this when they load
            window.currentDocumentViewerUrl = null;
            if (typeof setOpenButtonState === 'function') setOpenButtonState(true);
        } catch (e) {
            console.warn('Could not set currentDocumentUrl', e);
        }

        // Add error handling for iframe
        iframe.onerror = function() {
            console.warn('Failed to load document in iframe, showing download option');
            showDocumentDownloadOption(url, filename);
        };

        // Handle different file types
        const fileExtension = filename.split('.').pop().toLowerCase();

        if (fileExtension === 'pdf') {
            // For PDFs, try multiple viewing methods for better compatibility
            displayPDF(url, filename);
            // prefer Google Docs viewer when opening externally
            window.currentDocumentViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
        } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(fileExtension)) {
            // For Office documents, try multiple viewers in order of preference
            tryOfficeViewers(url, fileExtension, iframe);
        } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExtension)) {
            // For images, create an image viewer
            iframe.srcdoc = `
                <html>
                <head>
                    <style>
                        body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; }
                        img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
                    </style>
                </head>
                <body>
                    <img src="${url}" alt="${filename}" onload="this.style.display='block'" style="display:none;" onerror="window.parent.postMessage('iframe-error', '*')" />
                </body>
                </html>
            `;
            // For images, viewer url is the raw file url
            window.currentDocumentViewerUrl = url;
        } else {
            // For other file types, show download link
            showDocumentDownloadOption(url, filename);
            return;
        }

    }
}

function showDocumentDownloadOption(url, filename) {
    const placeholder = document.getElementById('documentViewerPlaceholder');
    const iframe = document.getElementById('documentViewer');

    if (placeholder && iframe) {
        iframe.style.display = 'none';
        placeholder.style.display = 'flex';

        // Update placeholder with download option
        placeholder.innerHTML = `
            <div class="document-placeholder-content">
                <svg style="width:64px; height:64px; margin:0 auto 1rem; color:#9ca3af;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <p style="font-weight:500; margin-bottom:0.5rem; color:#6b7280;">Document Preview Not Available</p>
                <p style="font-size:0.85rem; color:#9ca3af; margin-bottom:1rem;">${filename}</p>
                <a href="${url}" target="_blank" style="background:#3b82f6; color:white; padding:8px 16px; border-radius:6px; text-decoration:none; font-weight:500; display:inline-block;">Download Document</a>
            </div>
        `;
        // Disable open button when preview not available
        if (typeof setOpenButtonState === 'function') setOpenButtonState(false);
    }
}

// Enhanced PDF viewing with multiple fallback options
async function displayPDF(url, filename) {
    const placeholder = document.getElementById('documentViewerPlaceholder');
    const iframe = document.getElementById('documentViewer');

    if (!placeholder || !iframe) return;


    // First, check if the PDF is accessible
    try {

        const response = await fetch(url, { method: 'HEAD' });
        if (!response.ok) {
            throw new Error(`PDF not accessible: ${response.status}`);
        }

    } catch (error) {
        console.error('PDF accessibility check failed:', error);
        showDocumentDownloadOption(url, filename);
        return;
    }

    // Clear any existing timeout
    if (window.pdfLoadTimeout) clearTimeout(window.pdfLoadTimeout);

    // Show loading state
    placeholder.style.display = 'flex';
    iframe.style.display = 'none';
    placeholder.innerHTML = `
        <div class="document-placeholder-content">
            <svg style="width:64px; height:64px; margin:0 auto 1rem; color:#3b82f6;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <p style="font-weight:500; margin-bottom:0.5rem; color:#3b82f6;">Loading PDF...</p>
            <div style="display:flex; justify-content:center; margin-top:1rem;">
                <div style="width:32px; height:32px; border:3px solid #e5e7eb; border-top:3px solid #3b82f6; border-radius:50%; animation:spin 1s linear infinite;"></div>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        </div>
    `;

    // Set up error handling
    iframe.onerror = function() {
        console.warn('PDF iframe failed to load, trying alternative viewer');
        tryAlternativePDFViewer(url, filename);
    };

    // Set up timeout (15 seconds for PDF loading)
    window.pdfLoadTimeout = setTimeout(() => {
        console.warn('PDF loading timed out, trying alternative viewer');
        tryAlternativePDFViewer(url, filename);
    }, 15000);

    // Configure iframe for PDF viewing
    iframe.style.display = 'block';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute('loading', 'lazy');

    // Try direct iframe loading first
    iframe.src = url;
    // direct raw URL is also a valid viewer for PDFs in some browsers
    window.currentDocumentViewerUrl = url;

    // Listen for successful load
    iframe.onload = function() {
        clearTimeout(window.pdfLoadTimeout);
        placeholder.style.display = 'none';
        iframe.style.display = 'block';
    };
}

// Try alternative PDF viewers if direct iframe fails
function tryAlternativePDFViewer(url, filename) {
    const iframe = document.getElementById('documentViewer');
    const placeholder = document.getElementById('documentViewerPlaceholder');

    if (!iframe) return;


    // Clear any existing timeout
    if (window.pdfLoadTimeout) clearTimeout(window.pdfLoadTimeout);

    // Try Google Docs PDF viewer
    const googleDocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;

    iframe.onerror = function() {
        console.warn('Google Docs PDF viewer failed, showing enhanced download option');
        showPDFDownloadOption(url, filename);
    };

    // Set up timeout for alternative viewer
    window.pdfLoadTimeout = setTimeout(() => {
        console.warn('Alternative PDF viewer timed out, showing enhanced download option');
        showPDFDownloadOption(url, filename);
    }, 10000);

    iframe.onload = function() {

        clearTimeout(window.pdfLoadTimeout);
        placeholder.style.display = 'none';
        iframe.style.display = 'block';
    };

    // remember the alternative viewer url so the open button opens the viewer
    window.currentDocumentViewerUrl = googleDocsUrl;
    iframe.src = googleDocsUrl;
}

// Enhanced PDF download option with preview instructions
function showPDFDownloadOption(url, filename) {
    const placeholder = document.getElementById('documentViewerPlaceholder');
    const iframe = document.getElementById('documentViewer');

    if (placeholder && iframe) {
        iframe.style.display = 'none';
        placeholder.style.display = 'flex';

        // Update placeholder with enhanced PDF download option
        placeholder.innerHTML = `
            <div class="document-placeholder-content">
                <svg style="width:64px; height:64px; margin:0 auto 1rem; color:#ef4444;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <p style="font-weight:500; margin-bottom:0.5rem; color:#dc2626;">PDF Preview Not Supported</p>
                <p style="font-size:0.85rem; color:#9ca3af; margin-bottom:1rem;">${filename}</p>
                <p style="font-size:0.75rem; color:#6b7280; margin-bottom:1rem; text-align: center;">
                    Your browser doesn't support PDF preview in this viewer.<br>
                    Click below to open or download the PDF.
                </p>
                <div style="display: flex; gap: 0.5rem; justify-content: center;">
                    <a href="${url}" target="_blank" style="background:#3b82f6; color:white; padding:8px 16px; border-radius:6px; text-decoration:none; font-weight:500; display:inline-block;">Open PDF</a>
                    <a href="${url}" download="${filename}" style="background:#6b7280; color:white; padding:8px 16px; border-radius:6px; text-decoration:none; font-weight:500; display:inline-block;">Download</a>
                </div>
            </div>
        `;
    }
    // Disable open button when using download option
    if (typeof setOpenButtonState === 'function') setOpenButtonState(false);
}

// Try multiple viewers for Office documents (including Excel)
async function tryOfficeViewers(url, fileExtension, iframe) {

    // First, check if the file is accessible
    try {

        const response = await fetch(url, { method: 'HEAD' });
        if (!response.ok) {
            throw new Error(`File not accessible: ${response.status}`);
        }

    } catch (error) {
        console.error('File accessibility check failed:', error);
        showDocumentDownloadOption(url, `document.${fileExtension}`);
        return;
    }

    // Prioritize viewers based on file type
    let viewers;
    if (fileExtension === 'xls' || fileExtension === 'xlsx') {
        // For Excel files, prioritize Office Online viewer
        viewers = [
            {
                name: 'Office Online',
                url: `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`,
                timeout: 8000
            },
            {
                name: 'Google Docs',
                url: `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`,
                timeout: 5000
            },
            {
                name: 'Google Docs Alt',
                url: `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`,
                timeout: 3000
            }
        ];
    } else {
        // For other Office documents, use standard priority
        viewers = [
            {
                name: 'Google Docs',
                url: `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`,
                timeout: 5000
            },
            {
                name: 'Office Online',
                url: `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`,
                timeout: 8000
            },
            {
                name: 'Google Docs Alt',
                url: `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`,
                timeout: 3000
            }
        ];
    }

    let currentViewerIndex = 0;
    let timeoutId;

    function tryNextViewer() {
        if (currentViewerIndex >= viewers.length) {
            // All viewers failed, show download option
            console.warn('All document viewers failed, showing download option');
            showDocumentDownloadOption(url, `document.${fileExtension}`);
            return;
        }

        const viewer = viewers[currentViewerIndex];

        // Clear any existing timeout
        if (timeoutId) clearTimeout(timeoutId);

        // Set up error handling
        iframe.onerror = function() {
            console.warn(`${viewer.name} viewer failed, trying next viewer`);
            currentViewerIndex++;
            tryNextViewer();
        };

        // Set up timeout
        timeoutId = setTimeout(() => {
            console.warn(`${viewer.name} viewer timed out, trying next viewer`);
            currentViewerIndex++;
            tryNextViewer();
        }, viewer.timeout);

        // Listen for messages from iframe (for error detection)
        window.addEventListener('message', function(event) {
            if (event.data === 'iframe-error') {
                console.warn('Iframe reported error, trying next viewer');
                currentViewerIndex++;
                tryNextViewer();
            }
        });

        // Try loading the viewer
        iframe.src = viewer.url;

        // Listen for successful load
        iframe.onload = function() {
            console.log(`${viewer.name} viewer loaded successfully`);
            clearTimeout(timeoutId);
        };

        // remember which viewer URL we attempted — open button should prefer this
        try {
            window.currentDocumentViewerUrl = viewer.url;
        } catch (e) {
            /* ignore */
        }

        currentViewerIndex++;
    }

    // Start trying viewers
    tryNextViewer();
}

// --- Helper Functions ---
async function getDCNData(dcnId) {
    try {
        const { data, error } = await supabase
            .from('dcc_master_table')
            .select('dcn_no, document_title, document_no')
            .eq('id', dcnId)
            .single();

        if (error) {
            console.error('Error fetching DCN data:', error);
            return null;
        }

        return data;
    } catch (err) {
        console.error('Error in getDCNData:', err);
        return null;
    }
}

// --- Form Data Collection ---
async function collectDCCReviewFormData() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            showToast('You must be logged in to submit a DCC review.', 'error');
            window.location.href = '../html/auth.html';
            return null;
        }

        // Get DCN ID from URL to load existing data
        const urlParams = new URLSearchParams(window.location.search);
        const dcnId = urlParams.get('id');
        
        // Load existing DCN data to preserve user_id values
        let existingParticipants = {};
        if (dcnId) {
            try {
                const { data: existingData, error } = await supabase
                    .from('dcc_master_table')
                    .select('review_participants')
                    .eq('id', dcnId)
                    .single();
                
                if (!error && existingData && existingData.review_participants) {
                    // Convert to object format if it's an array
                    if (Array.isArray(existingData.review_participants)) {
                        const departments = ['QMR', 'PU', 'AD/GA', 'HR', 'PD/PC', 'WH', 'SA', 'MT/IT', 'QC', 'FN', 'QA', 'DCC'];
                        departments.forEach((dept, idx) => {
                            if (existingData.review_participants[idx]) {
                                existingParticipants[dept] = existingData.review_participants[idx];
                            }
                        });
                    } else {
                        existingParticipants = existingData.review_participants;
                    }
                }
            } catch (err) {
                console.warn('Could not load existing review participants:', err);
            }
        }

        // Collect basic document info
        const effectiveDate = document.getElementById('effective_date').value;
        const dcnNo = document.getElementById('dcn_no').value.trim();
        const documentNo = document.getElementById('document_no').value.trim();
        const revisionNo = document.getElementById('revision_no').value.trim();
        const reviewDate = document.getElementById('review_date').value;
        const documentTitle = document.getElementById('document_title').value.trim();

        // Collect purpose of review (checkboxes)
        const purposes = [];
        if (document.getElementById('purpose_new_doc').checked) purposes.push('New Establishment of a Document');
        if (document.getElementById('purpose_amendment_form').checked) purposes.push('Amendment on the Form (OPL, PPT)');
        if (document.getElementById('purpose_amendment_content').checked) purposes.push('Amendment on the Content');
        if (document.getElementById('purpose_obsolescence').checked) purposes.push('Obsolescence of a Document');
        if (document.getElementById('purpose_review_annual').checked) purposes.push('Review (Annual/ Validation/ SOP Review)');

        // Collect department sign-offs
        const departments = ['QMR', 'PU', 'AD/GA', 'HR', 'PD/PC', 'WH', 'SA', 'MT/IT', 'QC', 'FN', 'QA', 'DCC'];
        const signOffs = {};

        departments.forEach((dept, idx) => {
            const commentsInput = document.querySelectorAll('table tbody tr')[idx].cells[2].querySelector('[contenteditable]');
            signOffs[dept] = {
                comments: commentsInput ? commentsInput.textContent.trim() : ''
            };
        });

        // Helper: sanitize reviewer name (remove HTML tags, entities, collapse whitespace)
        function sanitizeName(raw) {
            if (!raw || typeof raw !== 'string') return '';
            // Replace common HTML entity for non-breaking space and unicode NBSP
            let s = raw.replace(/\u00A0/g, ' ').replace(/&nbsp;/gi, ' ');
            // Remove any HTML tags like <br>, <div>, etc.
            s = s.replace(/<[^>]*>/g, ' ');
            // Collapse whitespace and trim
            s = s.replace(/\s+/g, ' ').trim();
            return s;
        }

        // Collect review participants from the sign-off table, preserving existing user_id
        const reviewParticipants = {};
        const tableRows = document.querySelectorAll('table tbody tr');
        
        tableRows.forEach((row, idx) => {
            const deptCell = row.cells[0];
            const nameCell = row.cells[1];
            const commentsCell = row.cells[2];
            const dept = deptCell.textContent.trim();
            // Normalize name using sanitizer
            const rawName = nameCell ? nameCell.textContent : '';
            const name = sanitizeName(rawName);
            // Get comments from the contenteditable cell
            const comments = commentsCell ? commentsCell.textContent.trim() : '';

            // Preserve existing data if available, otherwise create new
            const existingData = existingParticipants[dept] || {};
            
            reviewParticipants[dept] = {
                name: name || existingData.name || '',
                user_id: existingData.user_id || null, // Preserve existing user_id
                comments: comments || '',
                assigned_at: existingData.assigned_at || new Date().toISOString(),
                review_status: existingData.review_status || null, // Preserve review status
                reviewed_at: existingData.reviewed_at || null // Preserve review timestamp
            };
        });

        const formData = {
            dcn_no: dcnNo,
            document_no: documentNo,
            revision_no: revisionNo,
            effective_date: effectiveDate,
            review_date: reviewDate,
            document_title: documentTitle,
            purpose: purposes,
            purpose_of_review: purposes,
            review_participants: reviewParticipants,
            updated_by: user.id,
            updated_at: new Date().toISOString()
        };

        return formData;
    } catch (err) {
        console.error('Error collecting DCC review form data:', err);
        showToast('Error preparing form data. Please check console.', 'error');
        return null;
    }
}

// --- Helper: Get DCN by number ---
async function getDCNByNumber(dcnNo) {
    try {
        const { data, error } = await supabase
            .from('dcc_master_table')
            .select('id')
            .eq('dcn_no', dcnNo)
            .single();

        if (error || !data) {
            console.error('DCN not found:', dcnNo);
            return null;
        }
        return data.id;
    } catch (err) {
        console.error('Error fetching DCN:', err);
        return null;
    }
}

// --- Form Submission ---
async function submitDCCReviewForm(status) {
    try {
        const formData = await collectDCCReviewFormData();
        if (!formData) return;

        const dcnNo = document.getElementById('dcn_no').value.trim();
        
        // Determine the actual status to save
        let dbStatus = status === 'Submitted' ? 'Under Review' : 'Draft';

        // Get DCN ID by number
        const dcnId = await getDCNByNumber(dcnNo);
        if (!dcnId && status === 'Submitted') {
            showToast && showToast('Error: Could not find DCN. Please try again.', 'error');
            return;
        }

        if (status === 'Submitted') {
                // Prepare update payload: DO NOT overwrite effective_date when submitting (keep existing)
                // Also do NOT overwrite purpose (from DCN form); only update purpose_of_review (from review form)
                const updatePayload = {
                    status: 'Under Review',
                    // Only include review_date if provided (non-empty)
                    // effective_date must NOT be overwritten on submit per requirement
                    purpose_of_review: formData.purpose_of_review,
                    review_participants: formData.review_participants,
                    updated_by: formData.updated_by,
                    updated_at: formData.updated_at
                };

                if (formData.review_date) {
                    updatePayload.review_date = formData.review_date;
                }

                const { error } = await supabase
                    .from('dcc_master_table')
                    .update(updatePayload)
                    .eq('id', dcnId);

            if (error) {
                throw error;
            }

            // Show success toast and then redirect so the user sees the notification
            showToast && showToast('Review submitted', 'success');
            // Keep the toast visible for slightly longer before redirecting
            setTimeout(() => { window.location.href = '../html/document-review-form-list.html'; }, 4500);
        } else {
            // Save as Draft - insert into a draft table or save locally
            showToast && showToast('Draft functionality not yet implemented for this page.', 'info');
        }
    } catch (err) {
        console.error('Error submitting DCC review:', err);
        showToast && showToast(`Error submitting DCC for review: ${err.message}`, 'error');
    }
}

// --- Load DCC Review Data (for viewing/editing) ---
async function loadDCCReviewData(dcnId, isViewOnly = false) {
    try {
        // Fetch DCN from dcc_master_table by ID
        const { data, error } = await supabase
            .from('dcc_master_table')
            .select('*')
            .eq('id', dcnId)
            .single();

        if (error || !data) {
            console.error('Error loading DCN:', error);
            showToast('Could not load DCN. Please try again.', 'error');
            return;
        }

        // Populate basic fields
        document.getElementById('effective_date').value = data.effective_date || '';
        document.getElementById('dcn_no').value = data.dcn_no || '';
        document.getElementById('document_no').value = data.document_no || '';
        document.getElementById('revision_no').value = data.revision_no || '';
        document.getElementById('review_date').value = data.review_date || data.issued_date || '';
        document.getElementById('document_title').value = data.document_title || '';

        // Populate purpose checkboxes from purpose_of_review array
        if (Array.isArray(data.purpose_of_review)) {
            if (data.purpose_of_review.includes('New Establishment of a Document')) document.getElementById('purpose_new_doc').checked = true;
            if (data.purpose_of_review.includes('Amendment on the Form (OPL, PPT)')) document.getElementById('purpose_amendment_form').checked = true;
            if (data.purpose_of_review.includes('Amendment on the Content')) document.getElementById('purpose_amendment_content').checked = true;
            if (data.purpose_of_review.includes('Obsolescence of a Document')) document.getElementById('purpose_obsolescence').checked = true;
            if (data.purpose_of_review.includes('Review (Annual/ Validation/ SOP Review)')) document.getElementById('purpose_review_annual').checked = true;
        }

        // Populate review participants names from review_participants JSONB
        if (data.review_participants) {
            const departments = ['QMR', 'PU', 'AD/GA', 'HR', 'PD/PC', 'WH', 'SA', 'MT/IT', 'QC', 'FN', 'QA', 'DCC'];
            
            // Handle both array and object formats
            let participantsMap = {};
            if (Array.isArray(data.review_participants)) {
                // If it's an array, convert to object with dept keys
                departments.forEach((dept, idx) => {
                    if (data.review_participants[idx]) {
                        participantsMap[dept] = data.review_participants[idx];
                    }
                });
            } else {
                // If it's already an object, use it directly
                participantsMap = data.review_participants;
            }
            
            departments.forEach((dept, idx) => {
                const row = document.querySelectorAll('table tbody tr')[idx];
                if (row) {
                    const nameCell = row.cells[1];
                    const commentsCell = row.cells[2];
                    
                    let participantName = '';
                    let participantComments = '';
                    
                    if (participantsMap[dept]) {
                        // sanitize any HTML or entities stored in DB for name
                        if (typeof participantsMap[dept].name === 'string') {
                            participantName = participantsMap[dept].name.replace(/\u00A0/g, ' ').replace(/&nbsp;/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                        }
                        // Get comments
                        if (typeof participantsMap[dept].comments === 'string') {
                            participantComments = participantsMap[dept].comments;
                        }
                    }
                    
                    // If no name present, show NA
                    if (!participantName) participantName = 'NA';
                    
                    if (nameCell) nameCell.textContent = participantName;
                    if (commentsCell) commentsCell.textContent = participantComments;
                }
            });
        }

        // If view-only mode, disable all form inputs
        if (isViewOnly) {
            disableAllFormFields();
        }

    } catch (err) {
        console.error('Error in loadDCCReviewData:', err);
        showToast('Error loading DCN data.', 'error');
    }
}

function disableAllFormFields() {
    // Make inputs read-only without greyed-out appearance
    document.querySelectorAll('#dccReviewForm input, #dccReviewForm textarea, #dccReviewForm select').forEach(field => {
        field.setAttribute('readonly', 'true');
    });

    // Make checkboxes uneditable without using 'disabled' (keep appearance intact)
    document.querySelectorAll('#dccReviewForm input[type="checkbox"]').forEach(cb => {
        cb.setAttribute('data-readonly', 'true');
        // Prevent any changes to checkbox state
        cb.setAttribute('readonly', 'true');
        // Prevent click events from toggling the checkbox
        cb.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        // Prevent keyboard changes (Space key)
        cb.addEventListener('keydown', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        cb.addEventListener('change', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    // Do NOT hide action buttons; keep them visible for all modes
}

// --- Setup Comment Editability (User-specific permissions) ---
async function setupCommentEditability() {
    try {
        // Get current logged-in user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.warn('No user logged in, making all comments read-only');
            makeAllCommentsReadOnly();
            return;
        }

        // Get DCN ID from URL to load existing data
        const urlParams = new URLSearchParams(window.location.search);
        const dcnId = urlParams.get('id');
        
        if (!dcnId) {
            console.warn('No DCN ID found, making all comments read-only');
            makeAllCommentsReadOnly();
            return;
        }

        // Load existing review participants to find which department belongs to current user
        const { data: existingData, error } = await supabase
            .from('dcc_master_table')
            .select('review_participants')
            .eq('id', dcnId)
            .single();
        
        if (error || !existingData || !existingData.review_participants) {
            console.warn('Could not load review participants, making all comments read-only');
            makeAllCommentsReadOnly();
            return;
        }

        // Find ALL departments where the current user is assigned as reviewer
        let userDepartments = [];
        const participants = existingData.review_participants;
        
        // Handle both array and object formats
        if (Array.isArray(participants)) {
            const departments = ['QMR', 'PU', 'AD/GA', 'HR', 'PD/PC', 'WH', 'SA', 'MT/IT', 'QC', 'FN', 'QA', 'DCC'];
            departments.forEach((dept, idx) => {
                if (participants[idx] && participants[idx].user_id === user.id) {
                    userDepartments.push(dept);
                }
            });
        } else {
            // Object format
            for (const [dept, participant] of Object.entries(participants)) {
                if (participant && participant.user_id === user.id) {
                    userDepartments.push(dept);
                }
            }
        }

        if (userDepartments.length === 0) {
            console.warn('Current user not found in review participants, making all comments read-only');
            makeAllCommentsReadOnly();
            return;
        }

        // Set up editability for each row
        const tableRows = document.querySelectorAll('table tbody tr');
        tableRows.forEach((row) => {
            const deptCell = row.cells[0];
            const commentsCell = row.cells[2];
            const dept = deptCell.textContent.trim();

            if (userDepartments.includes(dept)) {
                // Make current user's comments cells editable for ALL assigned departments
                commentsCell.setAttribute('contenteditable', 'true');
                commentsCell.classList.add('dcc-cell');
                commentsCell.style.cursor = 'text';
                commentsCell.style.backgroundColor = '#fafafa'; // Keep normal background
            } else {
                // Make other users' comments cells read-only
                commentsCell.setAttribute('contenteditable', 'false');
                commentsCell.style.cursor = 'default';
                commentsCell.style.backgroundColor = '#ffffff'; // Keep normal background, no grey
                // Prevent any editing attempts
                commentsCell.addEventListener('keydown', preventEditing);
                commentsCell.addEventListener('paste', preventEditing);
                commentsCell.addEventListener('cut', preventEditing);
                commentsCell.addEventListener('input', preventEditing);
            }
        });

    } catch (err) {
        console.error('Error setting up comment editability:', err);
        makeAllCommentsReadOnly();
    }
}

function makeAllCommentsReadOnly() {
    const tableRows = document.querySelectorAll('table tbody tr');
    tableRows.forEach((row) => {
        const commentsCell = row.cells[2];
        commentsCell.setAttribute('contenteditable', 'false');
        commentsCell.style.cursor = 'default';
        commentsCell.style.backgroundColor = '#ffffff'; // Keep normal background
        // Prevent any editing attempts
        commentsCell.addEventListener('keydown', preventEditing);
        commentsCell.addEventListener('paste', preventEditing);
        commentsCell.addEventListener('cut', preventEditing);
        commentsCell.addEventListener('input', preventEditing);
    });
}

function preventEditing(e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
}

// --- Test function for debugging Excel viewing ---
window.testExcelViewing = async function(excelUrl, filename = 'test.xlsx') {

    const iframe = document.getElementById('documentViewer');
    const placeholder = document.getElementById('documentViewerPlaceholder');

    if (placeholder && iframe) {
        placeholder.style.display = 'none';
        iframe.style.display = 'block';
        await tryOfficeViewers(excelUrl, 'xlsx', iframe);
    } else {
        console.error('Document viewer elements not found');
    }
};

// --- Test function for debugging PDF viewing ---
window.testPDFViewing = function(pdfUrl, filename = 'test.pdf') {

    displayPDF(pdfUrl, filename);
};

// --- Viewer Toggle Functionality ---
function initializeViewerToggle() {
    const toggleBtn = document.getElementById('toggleViewerSize');
    const viewerContainer = document.getElementById('documentViewerContainer');

    if (!toggleBtn || !viewerContainer) {
        console.warn('Viewer toggle elements not found');
        return;
    }

    toggleBtn.addEventListener('click', function() {
        const isExpanded = viewerContainer.classList.contains('expanded');

        if (isExpanded) {
            // Minimize the viewer
            viewerContainer.classList.remove('expanded');
            toggleBtn.classList.remove('expanded');
            toggleBtn.title = 'Expand Viewer';

        } else {
            // Expand the viewer
            viewerContainer.classList.add('expanded');
            toggleBtn.classList.add('expanded');
            toggleBtn.title = 'Minimize Viewer';

        }
    });

}

// Make function globally available for debugging
window.initializeViewerToggle = initializeViewerToggle;

// --- Open-in-New-Window Button Functionality ---
function setOpenButtonState(enabled) {
    const btn = document.getElementById('openViewerNewWindow');
    const dcnBtn = document.getElementById('openDCNForm');
    if (!btn) return;
    if (enabled) {
        btn.removeAttribute('disabled');
        btn.setAttribute('aria-disabled', 'false');
        if (dcnBtn) {
            dcnBtn.removeAttribute('disabled');
            dcnBtn.setAttribute('aria-disabled', 'false');
        }
    } else {
        btn.setAttribute('disabled', 'true');
        btn.setAttribute('aria-disabled', 'true');
        if (dcnBtn) {
            dcnBtn.setAttribute('disabled', 'true');
            dcnBtn.setAttribute('aria-disabled', 'true');
        }
    }
}

function initializeOpenButton() {
    const openBtn = document.getElementById('openViewerNewWindow');
    if (!openBtn) {
        console.warn('Open-in-new-window button not found');
        return;
    }

    openBtn.addEventListener('click', function(e) {
        e.preventDefault();
        // Prefer a viewer URL (Google Docs / Office viewer) if available,
        // otherwise fall back to the raw document URL.
        const viewerUrl = window.currentDocumentViewerUrl || window.currentDocumentUrl;
        if (!viewerUrl) {
            console.warn('No document URL available to open');
            return;
        }
        try {
            // Use noopener for security
            window.open(viewerUrl, '_blank', 'noopener');
        } catch (err) {
            console.warn('window.open failed, attempting fallback navigation', err);
            const newWin = window.open('', '_blank');
            if (newWin) newWin.location = viewerUrl;
        }
    });

    // Initially disabled until a document is loaded
    setOpenButtonState(false);

}

function initializeOpenDCNFormButton() {
    const dcnBtn = document.getElementById('openDCNForm');
    if (!dcnBtn) {
        console.warn('Open DCN Form button not found');
        return;
    }

    dcnBtn.addEventListener('click', function(e) {
        e.preventDefault();
        // Get the DCN ID from URL parameters or from the form data
        const urlParams = new URLSearchParams(window.location.search);
        const dcnId = urlParams.get('id');
        
        if (!dcnId) {
            console.warn('No DCN ID available');
            showToast('DCN ID not found', 'error');
            return;
        }

        try {
            // Navigate to the DCN form in view mode
            window.location.href = `dcn-form.html?id=${encodeURIComponent(dcnId)}&action=view`;
        } catch (err) {
            console.warn('Navigation failed', err);
            showToast('Failed to open DCN Form', 'error');
        }
    });

    // Initially disabled until a document is loaded
    setOpenButtonState(false);

}

window.setOpenButtonState = setOpenButtonState;
window.initializeOpenButton = initializeOpenButton;
window.initializeOpenDCNFormButton = initializeOpenDCNFormButton;
document.addEventListener('DOMContentLoaded', async function() {
    try {

        // Initialize viewer toggle functionality
        initializeViewerToggle();
        // Initialize open-in-new-window button
        if (typeof initializeOpenButton === 'function') initializeOpenButton();
        // Initialize open DCN form button
        if (typeof initializeOpenDCNFormButton === 'function') initializeOpenDCNFormButton();

        // Check if opening an existing DCN for viewing/editing
        const urlParams = new URLSearchParams(window.location.search);
        const dcnId = urlParams.get('id');
        const action = urlParams.get('action');
        

    if (dcnId) {
        // Load existing DCN data
        await loadDCCReviewData(dcnId, action === 'view');
        
        // Load document for viewing
        const dcnData = await getDCNData(dcnId);
        if (dcnData && dcnData.dcn_no) {
            await loadDocumentForReview(dcnData.dcn_no);
        }
        
        // Set up comment editability based on user permissions
        // Even in view mode, allow the logged-in user to edit their own comments if they're a reviewer
        await setupCommentEditability();
    } else {
        // New form, make all comments read-only until participants are assigned
        makeAllCommentsReadOnly();
        showDocumentPlaceholder('Document will be available after DCN is created');
    }

    // Form submission handlers - allow submission even in view mode for reviewers
    const submitBtn = document.getElementById('submit-dcc-review');
    if (submitBtn) {
        submitBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            const originalText = submitBtn.textContent;
            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Submitting...';
                await submitDCCReviewForm('Submitted');
                // If the function returns without redirect (edge case), show submitted state briefly
                submitBtn.textContent = 'Submitted';
            } catch (err) {
                console.error('Submit button handler error:', err);
                submitBtn.textContent = originalText || 'Submit Review';
                showToast && showToast('Failed to submit. See console for details.', 'error');
            } finally {
                // Re-enable after a short delay unless navigation occurred
                setTimeout(() => {
                    try { submitBtn.disabled = false; } catch (e) {}
                    try { submitBtn.textContent = originalText || 'Submit Review'; } catch (e) {}
                }, 1500);
            }
        });
    }

    const saveDraft = document.getElementById('save-draft');
    if (saveDraft) {
        saveDraft.addEventListener('click', async function(e) {
            e.preventDefault();
            await submitDCCReviewForm('Draft');
        });
    }
    } catch (error) {
        console.error('Error in DOMContentLoaded:', error);
    }
});
