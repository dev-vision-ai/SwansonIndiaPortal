// Import the Supabase client from the config file
import { supabase } from '../supabase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const categoryTitleElement = document.getElementById('category-title');
    const albumListElement = document.getElementById('album-list');

    // --- 1. Get Category from URL --- 
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category');

    if (!category) {
        console.error('Category not found in URL');
        if (categoryTitleElement) categoryTitleElement.textContent = 'Error: Category Not Specified';
        if (albumListElement) albumListElement.innerHTML = '<p class="error-message">No category was specified in the URL.</p>';
        return; // Stop execution if no category
    }

    // Decode the category name (replace %20 with spaces, etc.)
    const decodedCategory = decodeURIComponent(category);

    // --- 2. Update Page Title and Heading --- 
    document.title = `${decodedCategory} - Gallery - Swanson Plastics India`;
    if (categoryTitleElement) {
        categoryTitleElement.textContent = decodedCategory;
    }

    // --- 3. Fetch and Display Albums --- 
    loadAlbumsByCategory(decodedCategory);
});

async function loadAlbumsByCategory(category) {
    const albumListElement = document.getElementById('album-list');
    if (!albumListElement) {
        console.error('Album list element not found!');
        return;
    }

    albumListElement.innerHTML = '<p>Loading albums...</p>'; // Show loading message

    try {
        // No need to check if supabase is undefined anymore, 
        // the import will handle it or throw an error earlier.
        /* 
        if (typeof supabase === 'undefined') {
            throw new Error('Supabase client is not defined. Check supabase-config.js');
        }
        */

        const { data: albums, error } = await supabase // Now using the imported client
            .from('gallery_albums')
            .select('id, album_name, album_description, category') // Select necessary fields
            .eq('category', category) // Filter by the category
            .order('created_at', { ascending: false }); // Optional: order albums

        if (error) {
            throw error;
        }

        albumListElement.innerHTML = ''; // Clear loading message

        if (albums && albums.length > 0) {
            albums.forEach(album => {
                const albumElement = document.createElement('div');
                albumElement.classList.add('album-item'); // Add a class for styling
                
                // Basic structure - just the album name for now
                // We can enhance this later to include thumbnails or descriptions
                albumElement.innerHTML = `
                    <h3>${escapeHTML(album.album_name)}</h3>
                    ${album.album_description ? `<p>${escapeHTML(album.album_description)}</p>` : ''}
                    <!-- Add link to view images later -->
                    <!-- <a href="view_album.html?id=${album.id}">View Images</a> -->
                `;
                albumListElement.appendChild(albumElement);
            });
        } else {
            albumListElement.innerHTML = '<p>No albums found in this category.</p>';
        }

    } catch (error) {
        console.error('Error loading albums:', error.message);
        if (albumListElement) {
            albumListElement.innerHTML = `<p class="error-message">Error loading albums: ${error.message}</p>`;
        }
    }
}

// Simple HTML escaping function (reuse from gallery_admin.js or define here)
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}