// DCC List page helper functions
import { supabase } from '../supabase-config.js';
import { showToast } from './toast.js';

let dcnListData = []; // Global data store
let currentSort = { column: 'dcn_no', direction: 'asc' };
let currentUserDept = ''; // Store current user's department
let currentUserIsAdmin = false; // Store current user's admin status
let currentUserName = ''; // Store current user's full name
let currentUserId = ''; // Store current user's ID

async function fetchDCNList() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error("User not logged in");
            window.location.href = '../html/auth.html';
            return;
        }

        // Determine user department and admin status
        const { data: profile } = await supabase.from('users').select('department,is_admin,full_name').eq('id', user.id).single();
        const dept = profile?.department || '';
        const isAdmin = profile?.is_admin === true;
        const fullName = profile?.full_name || '';
        
        // Store for use in renderDCNTable
        currentUserDept = dept;
        currentUserIsAdmin = isAdmin;
        currentUserName = fullName;
        currentUserId = user.id;

        // allow both 'Human Resource' and 'Human Resources' as well as Administration
        const isHRorAdmin = isAdmin || /Human Resource(s)?/i.test(dept) || /Administration/i.test(dept);

        // Fetch DCNs --- if HR/Admin show all, otherwise show user's own DCNs + ones where they are the requestor
        let data, error;
        if (isHRorAdmin) {
            // HR/Admin see all DCNs
            const result = await supabase.from('dcc_master_table').select('*').order('issued_date', { ascending: false });
            data = result.data;
            error = result.error;
        } else {
            // Regular users: fetch DCNs created by them OR where they are listed as requestor
            const result1 = await supabase.from('dcc_master_table').select('*').eq('created_by', user.id);
            const result2 = await supabase.from('dcc_master_table').select('*').eq('requestor_name', fullName);
            
            if (result1.error || result2.error) {
                error = result1.error || result2.error;
            } else {
                // Combine both results and remove duplicates
                const combined = [...(result1.data || []), ...(result2.data || [])];
                const uniqueData = Array.from(new Map(combined.map(item => [item.id, item])).values());
                data = uniqueData.sort((a, b) => new Date(b.issued_date) - new Date(a.issued_date));
                error = null;
            }
        }

        if (error) {
            console.error('Error fetching DCN list:', error);
        showToast('Error loading DCNs. Please try again.', 'error');
            return;
        }

        dcnListData = data || [];
        renderDCNTable(dcnListData);
    } catch (err) {
        console.error('Exception in fetchDCNList:', err);
        showToast('An error occurred while loading DCNs.', 'error');
    }
}

function renderDCNTable(data) {
    const tbody = document.getElementById('dccListTableBody');
    if (!tbody) {
        console.error("Table body element #dccListTableBody not found!");
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4">No DCNs found. <a href="dcn-form.html">Create a new DCN</a></td></tr>';
        return;
    }

    // Check if current user is HR/Admin
    const isHRorAdmin = currentUserIsAdmin || /Human Resource(s)?/i.test(currentUserDept) || /Administration/i.test(currentUserDept);

    tbody.innerHTML = data.map((dcn, index) => {
        const issuedDate = dcn.issued_date ? new Date(dcn.issued_date).toLocaleDateString() : 'N/A';
        const currentRevision = dcn.current_revision || 'N/A';
        const status = dcn.status || 'Draft';
        const documentTypes = dcn.document_types ? dcn.document_types.join(', ') : 'N/A';

        const statusColor = status === 'Draft' ? '#d97706' : status === 'Under Review' ? '#9333ea' : status === 'Approved' ? '#059669' : '#dc2626';

        // Check if current user is the requestor
        const isRequestor = currentUserName === dcn.requestor_name;
        
        // Only show edit button to requestor or HR/Admin
        const canEdit = isRequestor || isHRorAdmin;

        // Action icons: view form (eye), edit form (pencil) for requestor/HR/Admin only, download documents (download arrow), upload document (upload arrow)
        const viewHref = `dcn-form.html?id=${dcn.id}&action=view`;
        let actionLinks = `
            <div class="flex justify-center space-x-1 flex-nowrap max-w-full overflow-hidden">
                <!-- Dark blue View button -->
                <a href="${viewHref}" class="p-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 hover:text-blue-900 transition-all duration-200 border border-blue-200 hover:border-blue-300 flex-shrink-0" title="View DCN Form" aria-label="View DCN Form">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                </a>
                ${canEdit ? `<a href="dcn-form.html?id=${dcn.id}&action=edit" class="p-1 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-600 hover:text-purple-800 transition-all duration-200 border border-purple-200 hover:border-purple-300 flex-shrink-0" title="Edit DCN Form" aria-label="Edit DCN Form">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                    </svg>
                </a>` : ''}
                <!-- Indigo Download Document button -->
                <button type="button" class="view-docs-btn p-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-800 transition-all duration-200 border border-indigo-200 hover:border-indigo-300 flex-shrink-0" data-dcn-no="${encodeURIComponent(dcn.dcn_no || '')}" title="Download Document" aria-label="Download Document">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                    </svg>
                </button>
                <!-- Green Upload Document button -->
                <button type="button" class="upload-doc-btn p-1 rounded-md bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-800 transition-all duration-200 border border-green-200 hover:border-green-300 flex-shrink-0" data-dcn-no="${encodeURIComponent(dcn.dcn_no || '')}" title="Upload Document" aria-label="Upload Document">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                    </svg>
                </button>
                ${isRequestor ? `<!-- Orange Submit for Review button - requestor only -->
                <button type="button" class="submit-review-btn p-1 rounded-md bg-orange-50 hover:bg-orange-100 text-orange-600 hover:text-orange-800 transition-all duration-200 border border-orange-200 hover:border-orange-300 flex-shrink-0" data-dcn-id="${dcn.id}" data-dcn-no="${encodeURIComponent(dcn.dcn_no || '')}" title="Submit for Review" aria-label="Submit for Review">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                    </svg>
                </button>` : ''}
                ${isHRorAdmin ? `<!-- Red Delete button -->
                <button type="button" class="delete-btn p-1 rounded-md bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 transition-all duration-200 border border-red-200 hover:border-red-300 flex-shrink-0" data-dcn-id="${dcn.id}" data-dcn-no="${encodeURIComponent(dcn.dcn_no || '')}" title="Delete" aria-label="Delete">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>` : ''}
        `;

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${dcn.dcn_no || 'N/A'}</td>
                <td>${dcn.requestor_name || 'Unknown'}</td>
                <td>${dcn.requestor_dept || 'N/A'}</td>
                <td>${dcn.document_title || 'No Title'}</td>
                <td>${documentTypes}</td>
                <td>${currentRevision}</td>
                <td style="color: ${statusColor}; font-weight: 600;">${status}</td>
                <td>${actionLinks}</td>
            </tr>
        `;
    }).join('');
}

function sortData(column) {
    if (!dcnListData.length) return;

    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort = { column, direction: 'asc' };
    }

    const sortedData = [...dcnListData].sort((a, b) => {
        const modifier = currentSort.direction === 'asc' ? 1 : -1;

        if (currentSort.column === 'issued_date') {
            const dateA = new Date(a.issued_date);
            const dateB = new Date(b.issued_date);
            return (dateA - dateB) * modifier;
        }

        const aValue = a[currentSort.column];
        const bValue = b[currentSort.column];

        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return -1 * modifier;
        if (bValue == null) return 1 * modifier;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
            return aValue.localeCompare(bValue) * modifier;
        }

        return (aValue - bValue) * modifier;
    });

    renderDCNTable(sortedData);
}

function openNewDCNModal() {
    window.location.href = 'dcn-form.html';
}

// Show toast notification instead of alert


// Add CSS animations if not already present
if (!document.getElementById('toast-animations')) {
    const style = document.createElement('style');
    style.id = 'toast-animations';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(400px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(400px); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

// Upload document for given DCN number
async function uploadDocumentForDCN(dcnNo) {
    if (!dcnNo) {
        showToast('No DCN number available to upload documents.', 'error');
        return;
    }

    try {
        // Check if user is HR/Admin - they can upload even if bucket is empty
        const isHRorAdmin = currentUserIsAdmin || /Human Resource(s)?/i.test(currentUserDept) || /Administration/i.test(currentUserDept);

        // Check if there are existing files for this DCN before allowing upload (unless user is HR/Admin)
        const prefix = `${decodeURIComponent(dcnNo)}_`;
        const { data: files, error: listError } = await supabase.storage.from('dcn-documents').list('', { limit: 1000 });
        if (listError) throw listError;

        // Filter files by prefix
        const existingFiles = (files || []).filter(f => f.name && f.name.startsWith(prefix));

        // Only require existing files if user is not HR/Admin
        if (!existingFiles.length && !isHRorAdmin) {
            showToast('Cannot upload document. No existing document found for this DCN to replace.', 'error');
            return;
        }

        // Store DCN number for modal
        window.currentUploadDCN = dcnNo;

        // Show modal
        const modal = document.getElementById('uploadDocModal');
        const dropZone = document.getElementById('uploadDropZone');
        const fileInput = document.getElementById('uploadFileInput');
        const fileInfo = document.getElementById('uploadFileInfo');
        const confirmBtn = document.getElementById('uploadDocConfirm');

        if (!modal || !dropZone || !fileInput || !fileInfo || !confirmBtn) {
            showToast('Upload modal not available.', 'error');
            return;
        }

        // Reset modal state
        fileInput.value = '';
        confirmBtn.disabled = true;
        
        // Hide word options by default
        const wordOptions = document.getElementById('wordFileOptions');
        if (wordOptions) wordOptions.style.display = 'none';

        // Clear status message
        document.getElementById('uploadStatusMessage').style.display = 'none';
        fileInfo.innerHTML = `
            <svg style="width:32px; height:32px; margin:0 auto 0.5rem; color:#9ca3af;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <p style="font-weight:500; margin-bottom:0.25rem; font-size:0.85rem;">Choose a file or drag it here</p>
            <p style="font-size:0.7rem;">Maximum file size: 10MB</p>
        `;

        // Handle file selection
        const handleFileSelect = (file) => {
            if (!file) return;

            // Validate file size (max 10MB)
            const maxSize = 10 * 1024 * 1024;
            if (file.size > maxSize) {
                showToast('File size exceeds 10MB limit.', 'error');
                return;
            }

            // Check if it's a word file to show options
            const isWord = file.name.toLowerCase().endsWith('.doc') || file.name.toLowerCase().endsWith('.docx');
            const wordOptions = document.getElementById('wordFileOptions');
            if (wordOptions) {
                wordOptions.style.display = isWord ? 'block' : 'none';
                if (isWord) {
                    const wordRadio = wordOptions.querySelector('input[value="word"]');
                    if (wordRadio) wordRadio.checked = true;
                }
            }

            // Show selected file info
            const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
            fileInfo.innerHTML = `
                <svg style="width:32px; height:32px; margin:0 auto 0.5rem; color:#10b981;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p style="font-weight:500; margin-bottom:0.25rem; color:#1f2937; font-size:0.85rem;">${file.name}</p>
                <p style="font-size:0.7rem; color:#6b7280;">${fileSizeMB} MB • Ready to upload</p>
            `;

            confirmBtn.disabled = false;
            window.selectedUploadFile = file;
        };

        // File input change
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            handleFileSelect(file);
        };

        // Click to open file picker
        dropZone.onclick = () => {
            fileInput.click();
        };

        // Drag and drop handlers
        dropZone.ondragover = (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#3b82f6';
            dropZone.style.backgroundColor = '#eff6ff';
        };

        dropZone.ondragleave = (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#d1d5db';
            dropZone.style.backgroundColor = '#fafafa';
        };

        dropZone.ondrop = (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#d1d5db';
            dropZone.style.backgroundColor = '#fafafa';

            const file = e.dataTransfer.files[0];
            handleFileSelect(file);
        };

        modal.style.display = 'flex';
    } catch (err) {
        console.error('Error checking for existing documents:', err);
        showToast('Error checking for existing documents.', 'error');
    }
}// Handle upload confirmation
function showUploadStatus(message, isSuccess = true) {
    const statusDiv = document.getElementById('uploadStatusMessage');
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    statusDiv.style.backgroundColor = isSuccess ? '#d1fae5' : '#fee2e2';
    statusDiv.style.color = isSuccess ? '#065f46' : '#991b1b';
    statusDiv.style.border = `1px solid ${isSuccess ? '#a7f3d0' : '#fecaca'}`;
}

async function confirmUploadDocument() {
    const file = window.selectedUploadFile;
    const dcnNo = window.currentUploadDCN;

    if (!file || !dcnNo) {
        showUploadStatus('No file selected or DCN number missing.', false);
        return;
    }

    try {
        // Determine backend URL
        const BACKEND_URL = window.BACKEND_URL || (['127.0.0.1', 'localhost'].includes(window.location.hostname)
            ? `${window.location.protocol}//${window.location.hostname}:3000`
            : `${window.location.protocol}//${window.location.hostname}`);

        // Check if conversion is requested for Word files
        const wordOptions = document.getElementById('wordFileOptions');
        const uploadFormat = wordOptions?.style.display === 'block' 
            ? wordOptions.querySelector('input[name="uploadFormat"]:checked')?.value 
            : 'word';
        
        let fileToUpload = file;
        let fileNameToUse = file.name;

        if (uploadFormat === 'pdf') {
            showUploadStatus('Converting Word to PDF (high fidelity) ...', false);
            
            const formData = new FormData();
            formData.append('file', file);
            
            // Call backend for conversion
            const response = await fetch(`${BACKEND_URL}/api/convert-to-pdf`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                let message = `Conversion failed (${response.status})`;
                try {
                    const contentType = response.headers.get('content-type') || '';
                    if (contentType.includes('application/json')) {
                        const errData = await response.json();
                        message = errData?.error || errData?.details || message;
                    } else {
                        const text = await response.text();
                        // Avoid dumping a full HTML page into the UI
                        message = text && text.length < 200 ? text : message;
                    }
                } catch (parseErr) {
                    // keep default message
                }
                throw new Error(message);
            }
            
            // Get the PDF blob
            const pdfBlob = await response.blob();
            // Create a new file object for the PDF
            const newFileName = file.name.replace(/\.(docx?)$/i, '.pdf');
            fileToUpload = new File([pdfBlob], newFileName, { type: 'application/pdf' });
            fileNameToUse = newFileName;
            
            showUploadStatus('Conversion successful! Starting upload...', false);
        }

        // Show initial uploading status
        showUploadStatus(`Uploading ${uploadFormat === 'pdf' ? 'PDF' : 'Document'} ....... 0%`, false);

        // Check if user is HR/Admin - they can upload even if bucket is empty
        const isHRorAdmin = currentUserIsAdmin || /Human Resource(s)?/i.test(currentUserDept) || /Administration/i.test(currentUserDept);

        // First, get existing files for this DCN to replace (if any)
        const prefix = `${decodeURIComponent(dcnNo)}_`;
        const { data: files, error: listError } = await supabase.storage.from('dcn-documents').list('', { limit: 1000 });
        if (listError) throw listError;

        // Filter files by prefix
        const existingFiles = (files || []).filter(f => f.name && f.name.startsWith(prefix));

        // Only require existing files if user is not HR/Admin
        if (!existingFiles.length && !isHRorAdmin) {
            showUploadStatus('Cannot upload: No existing document found for this DCN to replace.', false);
            return;
        }

        // Delete existing files for this DCN (if any exist)
        if (existingFiles.length > 0) {
            for (const existingFile of existingFiles) {
                const { error: deleteError } = await supabase.storage.from('dcn-documents').remove([existingFile.name]);
                if (deleteError) {
                    console.warn('Warning: Could not delete existing file:', existingFile.name, deleteError);
                }
            }
        }

        // Upload new file (might be converted PDF) with timestamp
        const timestamp = Date.now();
        const uploadFilename = `${decodeURIComponent(dcnNo)}_${timestamp}_${fileNameToUse}`;

        // Get signed URL for upload with real progress tracking
        const { data: uploadData, error: signedUrlError } = await supabase.storage
            .from('dcn-documents')
            .createSignedUploadUrl(uploadFilename);

        if (signedUrlError) throw signedUrlError;

        // Upload using XMLHttpRequest for real progress tracking
        await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const realProgress = Math.round((e.loaded / e.total) * 100);
                    showUploadStatus(`Uploading Document ....... ${realProgress}%`, false);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status === 200 || xhr.status === 201) {
                    resolve();
                } else {
                    reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Upload failed due to network error'));
            });

            xhr.addEventListener('abort', () => {
                reject(new Error('Upload was aborted'));
            });

            xhr.open('PUT', uploadData.signedUrl);
            xhr.setRequestHeader('Content-Type', fileToUpload.type || 'application/octet-stream');
            xhr.send(fileToUpload);
        });

        // Show success after a brief delay
        setTimeout(() => {
            showUploadStatus('Document uploaded successfully!', true);
        }, 500);

        // Close modal after a short delay to show success message
        setTimeout(() => {
            document.getElementById('uploadDocModal').style.display = 'none';
            // Hide word options for next time
            if (wordOptions) wordOptions.style.display = 'none';
            delete window.selectedUploadFile;
            delete window.currentUploadDCN;
        }, 2500);

    } catch (err) {
        console.error('Error uploading document:', err);
        showUploadStatus('Failed to upload: ' + err.message, false);
    }
}
async function downloadDocumentForDCN(dcnNo) {
    if (!dcnNo) {
        showToast('No DCN number available to download documents.', 'error');
        return;
    }

    try {
        // List objects in 'dcn-documents' bucket with prefix `${dcnNo}_`
        const prefix = `${decodeURIComponent(dcnNo)}_`;
        const { data: files, error } = await supabase.storage.from('dcn-documents').list('', { limit: 1000 });
        if (error) throw error;

        // Filter files by prefix
        const matched = (files || []).filter(f => f.name && f.name.startsWith(prefix));

        if (!matched.length) {
            showToast('No documents found for this DCN.', 'error');
            return;
        }

        // Download the first document
        const file = matched[0];
        const { data, error: downloadError } = await supabase.storage.from('dcn-documents').download(file.name);
        if (downloadError) throw downloadError;

        // Create a blob URL and trigger download
        const url = window.URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name.replace(prefix, ''); // Remove prefix for cleaner filename
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (err) {
        console.error('Error downloading document for DCN:', err);
        showToast('Error downloading document. Check console for details.', 'error');
    }
}

function openSearchModal() {
    showToast('Advanced Search modal - to be implemented', 'info');
}

function clearFilters() {
    renderDCNTable(dcnListData);
}

// Delete DCN or document function
async function deleteDCNOrDocument(dcnId, dcnNo) {
    if (!dcnId || !dcnNo) {
        showToast('Invalid DCN information.', 'error');
        return;
    }

    // Create a custom confirmation dialog
    const confirmDialog = document.createElement('div');
    confirmDialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    confirmDialog.innerHTML = `
        <div style="
            background: white;
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            max-width: 320px;
            width: 85%;
        ">
            <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #1f2937;">Delete Options</h3>
            <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 13px;">What would you like to delete?</p>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="deleteDCNBtn" style="
                    padding: 6px 12px;
                    background: #dc2626;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 1px 3px rgba(220, 38, 38, 0.3);
                " onmouseover="this.style.background='#b91c1c'; this.style.boxShadow='0 2px 8px rgba(220, 38, 38, 0.4)'" onmouseout="this.style.background='#dc2626'; this.style.boxShadow='0 1px 3px rgba(220, 38, 38, 0.3)'">Delete DCN Form</button>
                <button id="deleteDocBtn" style="
                    padding: 6px 12px;
                    background: #ea580c;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 1px 3px rgba(234, 88, 12, 0.3);
                " onmouseover="this.style.background='#c2410c'; this.style.boxShadow='0 2px 8px rgba(234, 88, 12, 0.4)'" onmouseout="this.style.background='#ea580c'; this.style.boxShadow='0 1px 3px rgba(234, 88, 12, 0.3)'">Delete Document File</button>
                <button id="cancelDeleteBtn" style="
                    padding: 6px 12px;
                    background: #6b7280;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 1px 3px rgba(107, 114, 128, 0.3);
                " onmouseover="this.style.background='#4b5563'; this.style.boxShadow='0 2px 8px rgba(107, 114, 128, 0.4)'" onmouseout="this.style.background='#6b7280'; this.style.boxShadow='0 1px 3px rgba(107, 114, 128, 0.3)'">Cancel</button>
            </div>
        </div>
    `;

    document.body.appendChild(confirmDialog);

    // Handle button clicks
    document.getElementById('deleteDCNBtn').onclick = async () => {
        confirmDialog.remove();
        await deleteDCNRecord(dcnId, dcnNo);
    };

    document.getElementById('deleteDocBtn').onclick = async () => {
        confirmDialog.remove();
        await deleteDocumentOnly(dcnNo);
    };

    document.getElementById('cancelDeleteBtn').onclick = () => {
        confirmDialog.remove();
    };

    // Close on background click
    confirmDialog.onclick = (e) => {
        if (e.target === confirmDialog) {
            confirmDialog.remove();
        }
    };
}

// Delete entire DCN record from database
async function deleteDCNRecord(dcnId, dcnNo) {
    try {
        // First delete associated documents from storage
        const prefix = `${decodeURIComponent(dcnNo)}_`;
        const { data: files, error: listError } = await supabase.storage.from('dcn-documents').list('', { limit: 1000 });
        if (!listError) {
            const existingFiles = (files || []).filter(f => f.name && f.name.startsWith(prefix));
            if (existingFiles.length > 0) {
                const fileNames = existingFiles.map(f => f.name);
                await supabase.storage.from('dcn-documents').remove(fileNames);
            }
        }

        // Delete DCN record from database
        const { error: deleteError } = await supabase
            .from('dcc_master_table')
            .delete()
            .eq('id', dcnId);

        if (deleteError) throw deleteError;

        showToast('DCN and associated documents deleted successfully.', 'success');

        // Refresh the list
        fetchDCNList();

    } catch (err) {
        console.error('Error deleting DCN:', err);
        showToast('Failed to delete DCN: ' + err.message, 'error');
    }
}

// Delete only the document from storage
async function deleteDocumentOnly(dcnNo) {
    try {
        const prefix = `${decodeURIComponent(dcnNo)}_`;
        const { data: files, error: listError } = await supabase.storage.from('dcn-documents').list('', { limit: 1000 });
        if (listError) throw listError;

        const existingFiles = (files || []).filter(f => f.name && f.name.startsWith(prefix));

        if (existingFiles.length === 0) {
            showToast('No documents found to delete.', 'error');
            return;
        }

        const fileNames = existingFiles.map(f => f.name);
        const { error: deleteError } = await supabase.storage.from('dcn-documents').remove(fileNames);

        if (deleteError) throw deleteError;

        showToast('Document deleted successfully.', 'success');

    } catch (err) {
        console.error('Error deleting document:', err);
        showToast('Failed to delete document: ' + err.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('DCN List page loaded');
    fetchDCNList();

    // Add sort listeners if table headers exist
    document.querySelectorAll('#dccListTableBody th[data-sort]').forEach(header => {
        header.addEventListener('click', () => sortData(header.dataset.sort));
    });
});

// Delegated handler for Submit for Review buttons
document.addEventListener('click', function (e) {
    const btn = e.target.closest('.submit-review-btn');
    if (!btn) return;
    const dcnId = btn.getAttribute('data-dcn-id') || '';
    const dcnNo = btn.getAttribute('data-dcn-no') || '';
    submitDCNForReview(dcnId, dcnNo);
});

// Submit DCN for Review
async function submitDCNForReview(dcnId, dcnNo) {
    if (!dcnId || !dcnNo) {
        showToast('Invalid DCN information.', 'error');
        return;
    }

    // Create a custom confirmation dialog with native date input
    const confirmDialog = document.createElement('div');
    confirmDialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    confirmDialog.innerHTML = `
        <div style="
            background: white;
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.2);
            max-width: 360px;
            width: min(360px, 90%);
        ">
            <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #1f2937;">Submit for Review</h3>
            <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 13px;">Select a review date for DCN: <strong>${decodeURIComponent(dcnNo)}</strong></p>

            <div style="margin-bottom: 16px;">
                <label for="reviewDatePicker" style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151; font-size: 13px;">Review Date:</label>
                <input type="date" id="reviewDatePicker" placeholder="Select review date" style="
                    width: 100%;
                    padding: 8px 10px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 13px;
                    background: white;
                    cursor: pointer;
                ">
            </div>

            <div style="display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap;">
                <button id="cancelSubmitBtn" style="
                    padding: 6px 14px;
                    background: #6b7280;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 160ms ease, box-shadow 160ms ease;
                    box-shadow: none;
                " onmouseenter="this.style.background='#4b5563'" onmouseleave="this.style.background='#6b7280'">Cancel</button>
                <button id="confirmSubmitBtn" style="
                    padding: 6px 14px;
                    background: #f97316;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 160ms ease, box-shadow 160ms ease;
                    box-shadow: none;
                " onmouseenter="this.style.background='#c2410c'" onmouseleave="this.style.background='#f97316'" disabled>Submit for Review</button>
            </div>
        </div>
    `;

    document.body.appendChild(confirmDialog);

    // Use native date input: set default to today and enable submit when selected
    const reviewInput = document.getElementById('reviewDatePicker');
    if (reviewInput) {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        reviewInput.value = `${y}-${m}-${d}`;
        document.getElementById('confirmSubmitBtn').disabled = !reviewInput.value;
        reviewInput.addEventListener('input', () => {
            document.getElementById('confirmSubmitBtn').disabled = !reviewInput.value;
        });
    }

    document.getElementById('confirmSubmitBtn').onclick = async () => {
        const selectedDateStr = document.getElementById('reviewDatePicker').value;
        if (!selectedDateStr) {
            showToast('Please select a review date.', 'error');
            return;
        }

        confirmDialog.remove();

        try {
            // reviewDate is already in YYYY-MM-DD format from native input
            const reviewDate = selectedDateStr;

            // Update DCN status to 'Under Review' and set review_date
            const { error } = await supabase
                .from('dcc_master_table')
                .update({
                    status: 'Under Review',
                    review_date: reviewDate
                })
                .eq('id', dcnId);

            if (error) throw error;

            showToast(`DCN submitted for review with review date: ${reviewDate}!`, 'success');
            // Refresh the list
            fetchDCNList();
        } catch (err) {
            console.error('Error submitting DCN for review:', err);
            showToast('Failed to submit DCN: ' + err.message, 'error');
        }
    };

    document.getElementById('cancelSubmitBtn').onclick = () => {
        confirmDialog.remove();
    };

    confirmDialog.onclick = (e) => {
        if (e.target === confirmDialog) {
            confirmDialog.remove();
        }
    };
}

// Delegated handler for Download Document buttons
document.addEventListener('click', function (e) {
    const btn = e.target.closest('.view-docs-btn');
    if (!btn) return;
    const dcnNo = btn.getAttribute('data-dcn-no') || '';
    downloadDocumentForDCN(dcnNo);
});

// Delegated handler for Upload Document buttons
document.addEventListener('click', function (e) {
    const btn = e.target.closest('.upload-doc-btn');
    if (!btn) return;
    const dcnNo = btn.getAttribute('data-dcn-no') || '';
    uploadDocumentForDCN(dcnNo);
});

// Delegated handler for Delete buttons
document.addEventListener('click', function (e) {
    const btn = e.target.closest('.delete-btn');
    if (!btn) return;
    const dcnId = btn.getAttribute('data-dcn-id') || '';
    const dcnNo = btn.getAttribute('data-dcn-no') || '';
    deleteDCNOrDocument(dcnId, dcnNo);
});

// Modal close handler
document.addEventListener('DOMContentLoaded', function () {
    const closeBtn = document.getElementById('dcnDocsModalClose');
    const modal = document.getElementById('dcnDocsModal');
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', function () { modal.style.display = 'none'; });
        modal.addEventListener('click', function (e) {
            if (e.target === modal) modal.style.display = 'none';
        });
    }

    // Upload modal handlers
    const uploadModal = document.getElementById('uploadDocModal');
    const uploadCloseBtn = document.getElementById('uploadDocModalClose');
    const uploadCancelBtn = document.getElementById('uploadDocCancel');
    const uploadConfirmBtn = document.getElementById('uploadDocConfirm');

    if (uploadCloseBtn && uploadModal) {
        uploadCloseBtn.addEventListener('click', function () {
            uploadModal.style.display = 'none';
            delete window.selectedUploadFile;
            delete window.currentUploadDCN;
            // Clear status message
            document.getElementById('uploadStatusMessage').style.display = 'none';
        });
    }

    if (uploadCancelBtn && uploadModal) {
        uploadCancelBtn.addEventListener('click', function () {
            uploadModal.style.display = 'none';
            delete window.selectedUploadFile;
            delete window.currentUploadDCN;
            // Clear status message
            document.getElementById('uploadStatusMessage').style.display = 'none';
        });
    }

    if (uploadConfirmBtn) {
        uploadConfirmBtn.addEventListener('click', function(e) {
            e.preventDefault();
            confirmUploadDocument();
        });
    }

    if (uploadModal) {
        uploadModal.addEventListener('click', function (e) {
            if (e.target === uploadModal) {
                uploadModal.style.display = 'none';
                delete window.selectedUploadFile;
                delete window.currentUploadDCN;
                // Clear status message
                document.getElementById('uploadStatusMessage').style.display = 'none';
            }
        });
    }
});
