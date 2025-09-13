// Import the Supabase client from the config file
import { supabase } from '../supabase-config.js';

// Add this at the beginning of your existing JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle
    const menuToggle = document.getElementById('menu-toggle');
    const mobileNav = document.getElementById('mobile-nav-links');
    
    if (menuToggle && mobileNav) {
        menuToggle.addEventListener('click', function() {
            mobileNav.classList.toggle('active');
            menuToggle.classList.toggle('active'); // ADDED for icon animation
        });

        // ADDED: Close mobile menu when a non-dropdown link is clicked
        mobileNav.querySelectorAll('a').forEach(link => {
            // Check if the link is NOT a dropdown toggle for the gallery
            if (!link.classList.contains('mobile-dropdown-toggle')) {
                link.addEventListener('click', () => {
                    // Only close if the main mobile nav is active
                    if (mobileNav.classList.contains('active')) {
                        mobileNav.classList.remove('active');
                        menuToggle.classList.remove('active');
                    }
                });
            }
        });
    }
    
    // Mobile dropdown toggle
    const mobileDropdownToggles = document.querySelectorAll('.mobile-dropdown-toggle');
    mobileDropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            const menu = this.nextElementSibling; // Should be .mobile-dropdown-menu
            // Toggle the .show class instead of .active to match CSS
            if (menu && menu.classList.contains('mobile-dropdown-menu')) {
                menu.classList.toggle('show');
                // Optionally, rotate arrow if one exists
                const arrow = this.querySelector('.fas.fa-caret-down');
                if (arrow) {
                    arrow.classList.toggle('rotated'); // Assumes a .rotated class for the arrow
                }
            }
        });
    });
});

const dropdownToggles = document.querySelectorAll('#desktop-header .dropdown-toggle'); // Target only desktop dropdown

dropdownToggles.forEach(toggle => {
    // Prevent default link behavior for dropdown toggles
    toggle.addEventListener('click', (event) => {
        event.preventDefault();
    });
});
// --- End Desktop Dropdown Logic ---

// --- Gallery Category/Album Specific Logic ---
const categoryTitleElement = document.getElementById('category-title');
const albumListElement = document.getElementById('album-list');
const urlParams = new URLSearchParams(window.location.search);

// <<< START CHANGE: Check for albumId OR category >>>
const albumId = urlParams.get('albumId');
const category = urlParams.get('category');

if (albumId) {
    // If albumId exists, load images for that album
    console.log(`Loading images for album ID: ${albumId}`);
    loadImagesByAlbum(albumId); 
} else if (category) {
    // If category exists (and albumId doesn't), load albums for that category
    const decodedCategory = decodeURIComponent(category);
    console.log(`Loading albums for category: ${decodedCategory}`);
    // Update Page Title and Heading for Category View
    document.title = `${decodedCategory} - Gallery - Swanson Plastics India`;
    if (categoryTitleElement) {
        categoryTitleElement.textContent = decodedCategory;
    }
    loadAlbumsByCategory(decodedCategory);
} else {
    // If neither albumId nor category exists, show an error
    console.error('No category or album ID found in URL');
    if (categoryTitleElement) categoryTitleElement.textContent = 'Error: Category/Album Not Specified';
    if (albumListElement) albumListElement.innerHTML = '<p class="error-message">No category or album was specified in the URL.</p>';
}

async function loadAlbumsByCategory(category) {
    const albumListElement = document.getElementById('album-list');
    if (!albumListElement) {
        console.error('Album list element not found!');
        return;
    }

    albumListElement.innerHTML = '<p>Loading albums...</p>'; // Show loading message
    albumListElement.classList.remove('album-grid'); // Ensure album-grid class is removed for album listing view

    try {
        // Fetch albums for the category
        const { data: albums, error: albumsError } = await supabase
            .from('gallery_albums')
            .select('id, album_name, album_description, category')
            .eq('category', category)
            .order('created_at', { ascending: false });

        if (albumsError) {
            throw albumsError;
        }

        albumListElement.innerHTML = ''; // Clear loading message

        if (albums && albums.length > 0) {
            // Use Promise.all to fetch thumbnails concurrently
            const albumPromises = albums.map(async (album) => {
                let thumbnailUrl = '../assets/logo.png'; // Default placeholder image

                // Fetch the first image for this album to use as a thumbnail
                const { data: images, error: imagesError } = await supabase
                    .from('gallery_images')
                    .select('image_url') // <<< Changed from 'image_path' to 'image_url'
                    .eq('album_id', album.id)
                    .order('created_at', { ascending: true })
                    .limit(1); // Only need one image

                if (imagesError) {
                    console.error(`Error fetching thumbnail for album ${album.id}:`, imagesError.message);
                } else if (images && images.length > 0) {
                    // Get the public URL for the thumbnail
                    const { data: urlData } = supabase
                        .storage
                        .from('gallery-images') // Make sure 'gallery-images' is your bucket name
                        .getPublicUrl(images[0].image_url); // <<< Changed from 'image_path' to 'image_url'
                    
                    if (urlData && urlData.publicUrl) {
                        thumbnailUrl = urlData.publicUrl;
                    }
                }

                // Create the HTML element for the album
                const albumElement = document.createElement('div');
                albumElement.classList.add('album-item'); // Add a class for styling
                
                // <<< START CHANGE: Link back to gallery_category.html with albumId >>>
                albumElement.innerHTML = `
                    <a href="gallery-category.html?albumId=${album.id}" class="album-link">
                        <img src="${escapeHTML(thumbnailUrl)}" alt="${escapeHTML(album.album_name)} Thumbnail" class="album-thumbnail">
                        <h3>${escapeHTML(album.album_name)}</h3>
                        ${album.album_description ? `<p>${escapeHTML(album.album_description)}</p>` : ''}
                    </a>
                `;
                // <<< END CHANGE >>>
                
                return albumElement;
            });

            // Wait for all album elements (including thumbnail fetches) to be ready
            const albumElements = await Promise.all(albumPromises);
            // Append all elements to the list
            albumElements.forEach(element => albumListElement.appendChild(element));

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

// after the loadAlbumsByCategory function

async function loadImagesByAlbum(albumId) {
    const albumListElement = document.getElementById('album-list');
    const categoryTitleElement = document.getElementById('category-title');

    if (!albumListElement || !categoryTitleElement) {
        console.error('Required elements (album-list or category-title) not found!');
        return;
    }

    albumListElement.innerHTML = '<p>Loading images...</p>';
    categoryTitleElement.textContent = 'Loading Album...';
    albumListElement.classList.add('album-grid'); // Ensure album-grid class is added for image grid view

    try {
        // --- Step 1: Fetch Album Details --- 
        const { data: albumData, error: albumError } = await supabase
            .from('gallery_albums')
            .select('album_name')
            .eq('id', albumId)
            .single(); // We expect only one album

        if (albumError) {
            throw new Error(`Could not fetch album details: ${albumError.message}`);
        }
        if (!albumData) {
            throw new Error(`Album with ID ${albumId} not found.`);
        }

        const albumName = albumData.album_name;
        // Update page title and heading
        document.title = `${albumName} - Gallery - Swanson Plastics India`;
        categoryTitleElement.textContent = albumName;

        // --- Step 2: Fetch Image Records --- 
        const { data: images, error: imagesError } = await supabase
            .from('gallery_images')
            .select('image_url') // Assuming 'image_url' stores the path like 'albumId/filename.jpg'
            .eq('album_id', albumId)
            .order('created_at', { ascending: true });

        if (imagesError) {
            throw new Error(`Could not fetch images for album: ${imagesError.message}`);
        }

        albumListElement.innerHTML = ''; // Clear loading message
        // The 'album-grid' class is already on #album-list in the HTML.

        if (!images || images.length === 0) {
            albumListElement.innerHTML = '<p>No images found in this album.</p>';
            return;
        }

        // --- Step 3 & 4: Get URLs and Generate HTML --- 
        images.forEach(image => {
            const { data: urlData } = supabase
                .storage
                .from('gallery-images') // Your bucket name
                .getPublicUrl(image.image_url);

            if (urlData && urlData.publicUrl) {
                const imageUrl = escapeHTML(urlData.publicUrl);
                const albumNameEscaped = escapeHTML(albumName);

                const imgContainer = document.createElement('figure'); // Changed div to figure
                imgContainer.classList.add('gallery-item');
                
                // <<< START CHANGE: Use glightbox class >>>
                // The 'glightbox' class triggers the library
                // The 'data-gallery' attribute groups images
                imgContainer.innerHTML = `
                    <a href="${imageUrl}" class="glightbox" data-gallery="album-${albumId}">
                        <img src="${imageUrl}" alt="Image from ${albumNameEscaped}" loading="lazy">
                    </a>
                `; // REMOVED: <figcaption>${albumNameEscaped}</figcaption>
                // And added figcaption
                // <<< END CHANGE >>>
                
                albumListElement.appendChild(imgContainer);
            } else {
                console.warn(`Could not get public URL for image: ${image.image_url}`);
            }
        });

        // --- Step 5: Initialize GLightbox (AFTER images are added) --- 
        // <<< START CHANGE: Initialize GLightbox >>>
        if (typeof GLightbox !== 'undefined') {
            const lightbox = GLightbox({
                selector: '.glightbox', // Use the class we added to the links
                gallery: `album-${albumId}` // Optional: Match the data-gallery attribute for clarity
            });
        } else {
            console.warn('GLightbox is not defined. Make sure the script is included correctly.');
        }
        // <<< END CHANGE >>>

    } catch (error) {
        console.error('Error loading images for album:', error.message);
        albumListElement.innerHTML = `<p class="error-message">Error loading images: ${error.message}</p>`;
        categoryTitleElement.textContent = 'Error Loading Album';
        // The 'album-grid' class from HTML should persist on error.
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