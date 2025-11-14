// ES module for DCN Request page - uses Supabase to create a temporary signed URL
// and loads Microsoft Office Online viewer
import { supabase } from '../supabase-config.js';

// Set your bucket name here (from repo Supabase):
const BUCKET_NAME = 'dcn-documents';

// Backend API URL (adjust based on environment)
const BACKEND_API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : '/api'; // For production, use relative path

/**
 * Create Microsoft Office Online viewer URL for a Supabase signed URL
 * @param {string} filePathInBucket - e.g. 'public/my-document.docx'
 * @param {number} expires - seconds the signed URL should be valid (default 3600)
 * @returns {string|null}
 */
export async function getMicrosoftViewerUrl(filePathInBucket, expires = 3600) {
    try {
        const { data, error } = await supabase
            .storage
            .from(BUCKET_NAME)
            .createSignedUrl(filePathInBucket, expires);

        if (error) {
            console.error('Error creating signed URL:', error);
            return null;
        }

        const signedUrl = data.signedUrl;
        const encodedUrl = encodeURIComponent(signedUrl);
        return `https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`;
    } catch (err) {
        console.error('Unexpected error creating viewer URL:', err);
        return null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('dcn-file-path');
    const btn = document.getElementById('dcn-view-btn');
    const iframe = document.getElementById('ms-viewer');
    const listBtn = document.getElementById('dcn-list-btn');
    const listContainer = document.getElementById('dcn-list-container');
    const fileListEl = document.getElementById('dcn-file-list');
    const fileInput = document.getElementById('dcn-file-input');
    const uploadBtn = document.getElementById('dcn-upload-btn');
    const uploadStatus = document.getElementById('dcn-upload-status');

    if (!input || !btn || !iframe) return;

    btn.addEventListener('click', async () => {
        const path = input.value.trim();
        if (!path) {
            alert('Enter file path in bucket (e.g. public/my-document.docx)');
            return;
        }

        btn.disabled = true;
        const previousText = btn.textContent;
        btn.textContent = 'Loading...';

        // Check if file is DOCX — use backend conversion for high-quality PDF rendering
        if (path.toLowerCase().endsWith('.docx')) {
            iframe.src = `${BACKEND_API}/api/convert-to-pdf?file=${encodeURIComponent(path)}`;
        } else {
            // Use Microsoft Office Online viewer for other formats (.xlsx, .pptx, etc.)
            const viewerSrc = await getMicrosoftViewerUrl(path, 3600);
            if (viewerSrc) {
                iframe.src = viewerSrc;
            } else {
                alert('Could not generate viewer URL. Check console for details.');
            }
        }

        btn.disabled = false;
        btn.textContent = previousText;
    });

    // List files in the bucket and render clickable picker
    async function listFiles(prefix = '') {
        if (!fileListEl) return;
        fileListEl.innerHTML = '';
        const li = document.createElement('li');
        li.textContent = 'Loading...';
        li.className = 'text-gray-500 p-2';
        fileListEl.appendChild(li);

        try {
            const { data, error } = await supabase.storage.from(BUCKET_NAME).list(prefix, { limit: 200 });
            fileListEl.innerHTML = '';
            if (error) {
                console.error('Error listing files:', error);
                const e = document.createElement('li');
                e.textContent = 'Error listing files (see console)';
                e.className = 'text-red-600 p-2';
                fileListEl.appendChild(e);
                return;
            }

            if (!data || data.length === 0) {
                const none = document.createElement('li');
                none.textContent = 'No files found.';
                none.className = 'text-gray-600 p-2';
                fileListEl.appendChild(none);
                return;
            }

            data.forEach(item => {
                // item: { name, id?, updated_at?, metadata?, size?, last_modified? }
                const entry = document.createElement('li');
                entry.className = 'p-2 hover:bg-gray-100 cursor-pointer';
                
                if (!item.id) {
                    // Folder (id is null)
                    entry.textContent = `📁 ${item.name}/`;
                    entry.style.fontWeight = 'bold';
                    entry.addEventListener('click', () => {
                        // Navigate into folder
                        listFiles(item.name);
                    });
                } else {
                    // File
                    const path = prefix ? `${prefix}/${item.name}` : item.name;
                    entry.textContent = `📄 ${item.name}`;
                    entry.addEventListener('click', () => {
                        input.value = path;
                        // auto-view when selected
                        btn.click();
                    });
                }
                
                fileListEl.appendChild(entry);
            });
        } catch (err) {
            console.error('Unexpected error listing files:', err);
            fileListEl.innerHTML = '';
            const e = document.createElement('li');
            e.textContent = 'Unexpected error (see console)';
            e.className = 'text-red-600 p-2';
            fileListEl.appendChild(e);
        }
    }

    if (listBtn && listContainer) {
        listBtn.addEventListener('click', async () => {
            if (listContainer.classList.contains('hidden')) {
                listContainer.classList.remove('hidden');
                await listFiles('');
                listBtn.textContent = 'Hide List';
            } else {
                listContainer.classList.add('hidden');
                listBtn.textContent = 'List Files';
            }
        });
    }

    // Upload handler
    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', async () => {
            const files = fileInput.files;
            if (!files || files.length === 0) {
                alert('Select a file to upload');
                return;
            }

            const file = files[0];
            // Determine destination path: use input path if it looks like a folder or full path,
            // otherwise default to `public/<filename>`.
            let destPath = input.value && input.value.trim() !== '' ? input.value.trim() : `public/${file.name}`;
            // If destPath ends with '/', treat it as folder
            if (destPath.endsWith('/')) destPath = `${destPath}${file.name}`;

            uploadBtn.disabled = true;
            uploadStatus.textContent = 'Uploading...';

            try {
                const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(destPath, file, { upsert: true });
                if (error) {
                    console.error('Upload error:', error);
                    uploadStatus.textContent = `Upload failed: ${error.message || error}
`;
                    alert('Upload failed — see console for details');
                } else {
                    uploadStatus.textContent = 'Upload successful';
                    // update the path input to the uploaded path
                    input.value = destPath;
                    // refresh list if visible
                    if (listContainer && !listContainer.classList.contains('hidden')) await listFiles('');
                }
            } catch (err) {
                console.error('Unexpected upload error:', err);
                uploadStatus.textContent = 'Upload failed (see console)';
                alert('Upload failed — see console for details');
            }

            uploadBtn.disabled = false;
        });
    }

    // Auto-load if ?file=... query param present
    const params = new URLSearchParams(window.location.search);
    const q = params.get('file');
    if (q) {
        input.value = q;
        btn.click();
    }
});
