// Initialize Supabase client directly
async function initializeSupabase() {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    return createClient(
        "https://ufczydnvscaicygwlmhz.supabase.co",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmY3p5ZG52c2NhaWN5Z3dsbWh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTg5NDYsImV4cCI6MjA1OTc5NDk0Nn0.0TUriXYvPuml-Jzr9v1jvcuzKjh-cZgnZhYKkQEj3t0"
    );
}

let supabase = null;

// Wait for Supabase to initialize
async function getSupabase() {
    if (!supabase) {
        supabase = await initializeSupabase();
    }
    return supabase;
}

let quillEditor = null;
let currentDocument = null;
let isEditMode = false;

// Initialize Quill Editor
function initializeQuill() {
    if (!quillEditor) {
        quillEditor = new Quill('#editor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ 'header': 1 }, { 'header': 2 }],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['link', 'image'],
                    ['clean']
                ]
            },
            placeholder: 'Edit your document here...'
        });
    }
}

// File Upload Handler
function setupFileUpload() {
    document.getElementById('uploadArea').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            await uploadDocument(file);
        }
    });
}

// Upload Document to Supabase
async function uploadDocument(file) {
    try {
        const sb = await getSupabase();
        const fileName = `${Date.now()}_${file.name}`;
        
        // Upload to storage
        const { data, error } = await sb.storage
            .from('dcn-documents')
            .upload(`documents/${fileName}`, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        // Get current user (may be null if not authenticated)
        const { data: authData } = await sb.auth.getUser();
        const userId = authData?.user?.id;

        // Save metadata to database
        const { error: insertError } = await sb.from('dcn_documents').insert({
            file_name: file.name,
            file_path: data.path,
            file_type: file.type,
            file_size: file.size,
            created_by: userId || null,
            created_at: new Date().toISOString()
        });

        if (insertError) throw insertError;

        alert('Document uploaded successfully!');
        loadDocuments();
    } catch (error) {
        console.error('Upload error:', error);
        alert('Failed to upload document: ' + error.message);
    }
}

// Load Documents
async function loadDocuments() {
    try {
        const sb = await getSupabase();
        const { data, error } = await sb
            .from('dcn_documents')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        renderDocumentCards(data || []);
    } catch (error) {
        console.error('Load error:', error);
    }
}

// Render Document Cards
function renderDocumentCards(documents) {
    const grid = document.getElementById('documentsGrid');
    // Render using data-* attributes and attach listeners to avoid inline JS and quote-escaping issues
    grid.innerHTML = documents.map(doc => {
        const safeName = encodeURIComponent(doc.file_name || '');
        const safePath = encodeURIComponent(doc.file_path || '');
        return (`
        <div class="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition cursor-pointer document-card" data-id="${doc.id}" data-name="${safeName}" data-path="${safePath}">
            <div class="doc-card-body">
                <svg class="w-12 h-12 text-blue-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <h3 class="font-semibold text-gray-800 truncate doc-title">${escapeHtml(doc.file_name || '')}</h3>
                <p class="text-xs text-gray-500">${new Date(doc.created_at).toLocaleDateString()}</p>
            </div>
            <div class="mt-3 flex space-x-2">
                <button class="view-btn flex-1 px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600" data-id="${doc.id}" data-name="${safeName}" data-path="${safePath}">View</button>
                <button class="delete-btn flex-1 px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600" data-id="${doc.id}">Delete</button>
            </div>
        </div>
    `);
    }).join('');

    // Attach listeners after injecting HTML
    grid.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const name = decodeURIComponent(btn.dataset.name || '');
            const path = decodeURIComponent(btn.dataset.path || '');
            console.log('View button clicked ->', { id, name, path });
            window.openDocument(id, name, path);
        });
    });

    grid.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            console.log('Delete button clicked ->', id);
            await window.deleteDocument(id);
        });
    });
}

// small helper to escape HTML when injecting file names
function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
}

// Open Document
window.openDocument = async function(docId, fileName, filePath) {
    try {
        console.log('openDocument called with:', { docId, fileName, filePath });
        const sb = await getSupabase();

        currentDocument = { id: docId, name: fileName, path: filePath };
        document.getElementById('documentTitle').textContent = fileName;
        document.getElementById('documentOverlay').classList.remove('hidden');
        
        // Load file content
        const { data, error } = await sb.storage
            .from('dcn-documents')
            .download(filePath);

        if (error) throw error;

        // Preview based on file type
        if (fileName.endsWith('.docx')) {
            try {
                // Use Mammoth to convert DOCX to HTML in-browser (works with private storage download)
                if (typeof window.mammoth !== 'undefined') {
                    const arrayBuffer = await data.arrayBuffer();
                    const result = await window.mammoth.convertToHtml({ arrayBuffer });
                    document.getElementById('documentContent').innerHTML = result.value || '<p>Document loaded but content is empty</p>';
                } else {
                    document.getElementById('documentContent').innerHTML = '<p>Mammoth library not available. Try refreshing the page.</p>';
                }
            } catch (e) {
                console.error('DOCX conversion error:', e);
                document.getElementById('documentContent').innerHTML = '<p>Error converting DOCX: ' + e.message + '</p>';
            }
        } else if (fileName.endsWith('.txt')) {
            const text = await data.text();
            document.getElementById('documentContent').innerHTML = `<pre>${text}</pre>`;
        } else {
            document.getElementById('documentContent').innerHTML = '<p>File type not directly previewable</p>';
        }

        isEditMode = false;
        switchTab('view');
    } catch (error) {
        console.error('Open document error:', error);
        alert('Failed to open document: ' + error.message);
    }
};

// Switch between View and Edit tabs
function switchTab(tab) {
    if (tab === 'view') {
        document.getElementById('viewContent').classList.remove('hidden');
        document.getElementById('editContent').classList.add('hidden');
        document.getElementById('viewTab').classList.add('border-b-2', 'border-blue-600', 'text-blue-600');
        document.getElementById('viewTab').classList.remove('border-transparent', 'text-gray-600');
        document.getElementById('editTab').classList.remove('border-b-2', 'border-blue-600', 'text-blue-600');
        document.getElementById('editTab').classList.add('border-transparent', 'text-gray-600');
        document.getElementById('saveDocBtn').classList.add('hidden');
        document.getElementById('cancelEditBtn').classList.add('hidden');
        isEditMode = false;
    } else {
        initializeQuill();
        document.getElementById('viewContent').classList.add('hidden');
        document.getElementById('editContent').classList.remove('hidden');
        document.getElementById('editTab').classList.add('border-b-2', 'border-blue-600', 'text-blue-600');
        document.getElementById('editTab').classList.remove('border-transparent', 'text-gray-600');
        document.getElementById('viewTab').classList.remove('border-b-2', 'border-blue-600', 'text-blue-600');
        document.getElementById('viewTab').classList.add('border-transparent', 'text-gray-600');
        document.getElementById('saveDocBtn').classList.remove('hidden');
        document.getElementById('cancelEditBtn').classList.remove('hidden');
        
        // Load content into editor
        const htmlContent = document.getElementById('documentContent').innerHTML;
        quillEditor.root.innerHTML = htmlContent;
        isEditMode = true;
    }
}

// Save Changes
async function saveDocument() {
    if (!currentDocument) return;

    try {
        const sb = await getSupabase();
        const content = quillEditor.root.innerHTML;
        const blob = new Blob([content], { type: 'text/html' });
        
        // Update file in storage
        await sb.storage
            .from('dcn-documents')
            .update(currentDocument.path, blob, {
                upsert: true
            });

        // Update modified timestamp in database
        await sb
            .from('dcn_documents')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', currentDocument.id);

        alert('Document saved successfully!');
        switchTab('view');
    } catch (error) {
        console.error('Save error:', error);
        alert('Failed to save document: ' + error.message);
    }
}

// Delete Document
window.deleteDocument = async function(docId) {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
        const sb = await getSupabase();
        const { data, error: fetchError } = await sb
            .from('dcn_documents')
            .select('file_path')
            .eq('id', docId)
            .single();

        if (fetchError) throw fetchError;

        // Delete from storage
        await sb.storage
            .from('dcn-documents')
            .remove([data.file_path]);

        // Delete from database
        await sb.from('dcn_documents').delete().eq('id', docId);

        alert('Document deleted successfully!');
        if (currentDocument && currentDocument.id === docId) {
            document.getElementById('documentOverlay').classList.add('hidden');
        }
        loadDocuments();
    } catch (error) {
        console.error('Delete error:', error);
        alert('Failed to delete document: ' + error.message);
    }
};

// Setup Event Listeners
function setupEventListeners() {
    // Close Overlay
    document.getElementById('closeDocumentOverlay').addEventListener('click', () => {
        document.getElementById('documentOverlay').classList.add('hidden');
        currentDocument = null;
    });

    // Tab Handlers
    document.getElementById('viewTab').addEventListener('click', () => switchTab('view'));
    document.getElementById('editTab').addEventListener('click', () => switchTab('edit'));

    // Save/Cancel Buttons
    document.getElementById('saveDocBtn').addEventListener('click', saveDocument);
    document.getElementById('cancelEditBtn').addEventListener('click', () => switchTab('view'));
    
    document.getElementById('downloadDocBtn').addEventListener('click', async () => {
        if (currentDocument) {
            try {
                const sb = await getSupabase();
                const { data } = sb.storage
                    .from('dcn-documents')
                    .getPublicUrl(currentDocument.path);
                const link = document.createElement('a');
                link.href = data.publicUrl;
                link.download = currentDocument.name;
                link.click();
            } catch (error) {
                console.error('Download error:', error);
            }
        }
    });
    
    document.getElementById('deleteDocBtn').addEventListener('click', async () => {
        if (currentDocument) {
            await window.deleteDocument(currentDocument.id);
        }
    });
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    console.log('DCN Request page loaded');
    console.log('Mammoth available:', typeof window.mammoth !== 'undefined');
    console.log('Quill available:', typeof window.Quill !== 'undefined');
    
    // Give scripts time to load
    setTimeout(() => {
        console.log('After delay - Mammoth available:', typeof window.mammoth !== 'undefined');
        console.log('After delay - Quill available:', typeof window.Quill !== 'undefined');
        setupFileUpload();
        setupEventListeners();
        loadDocuments();
    }, 500);
});
