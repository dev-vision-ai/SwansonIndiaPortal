// Import the Supabase client
import { supabase } from '../supabase-config.js';

// DOM elements
const categoryTitleElement = document.getElementById('category-title');
const categorySubtitleElement = document.getElementById('category-subtitle');
const albumListElement = document.getElementById('album-list');
const urlParams = new URLSearchParams(window.location.search);

// Category data: titles and subtitles
const categories = {
    'Life At Swanson': {
        title: 'Life At <span class="highlight">Swanson</span>',
        subtitle: 'Where innovation meets passion. Explore the vibrant culture and shared moments of our Swanson family.'
    },
    'Our Achievements': {
        title: 'Our <span class="highlight">Achievements</span>',
        subtitle: 'Celebrating milestones of excellence. A tribute to our journey of innovation and global recognition.'
    },
    'Machinery': {
        title: '<span class="highlight">Machinery</span>',
        subtitle: 'The heartbeat of our production. Discover the precision technology driving our high-performance solutions.'
    },
    'Infrastructure': {
        title: '<span class="highlight">Infrastructure</span>',
        subtitle: 'Built for excellence. Step inside our world-class facilities designed for sustainable growth.'
    },
    'Testing & Quality Labs': {
        title: 'Testing & <span class="highlight">Quality</span> Labs',
        subtitle: 'The standard of perfection. Where every film is engineered to exceed global quality benchmarks.'
    },
    'Corporate Events & Visits': {
        title: 'Corporate <span class="highlight">Events</span> & Visits',
        subtitle: 'Connecting with the world. Highlights from our global partnerships and corporate milestones.'
    },
    'Environment & Safety': {
        title: 'Environment & <span class="highlight">Safety</span>',
        subtitle: 'Committed to a greener future. Our dedication to safety standards and environmental responsibility.'
    }
};

const albumId = urlParams.get('albumId');
const category = urlParams.get('category');

document.addEventListener('DOMContentLoaded', initGallery);

// Escape HTML to prevent XSS
function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function initGallery() {
    const hero = document.querySelector('.hero-mini');
    
    if (albumId) {
        await loadImagesByAlbum(albumId);
    } else if (category) {
        if (hero) hero.classList.remove('album-view');
        
        const decodedCategory = decodeURIComponent(category);
        document.title = `${decodedCategory} | Gallery | Swanson Plastics India`;
        
        if (categoryTitleElement) {
            const categoryData = categories[decodedCategory];
            categoryTitleElement.innerHTML = categoryData?.title || escapeHTML(decodedCategory);
        }
        
        if (categorySubtitleElement && categories[decodedCategory]) {
            categorySubtitleElement.textContent = categories[decodedCategory].subtitle;
        }
        
        await loadAlbumsByCategory(decodedCategory);
    } else {
        if (categoryTitleElement) categoryTitleElement.textContent = 'Gallery';
        showError('Discovery Needed', 'Please select a gallery category to explore our visual journey.');
    }
}

async function loadAlbumsByCategory(categoryName) {
    if (!albumListElement) return;
    
    showLoading('Discovering albums...');
    
    try {
        const { data: albums, error } = await supabase
            .from('gallery_albums')
            .select('id, album_name, album_description, category, gallery_images(count)')
            .eq('category', categoryName)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        albumListElement.innerHTML = '';
        albumListElement.classList.remove('image-grid');
        albumListElement.classList.add('album-grid');
        
        if (albums?.length > 0) {
            const cards = await Promise.all(
                albums.map(album => createAlbumCard(album))
            );
            cards.forEach(card => albumListElement.appendChild(card));
        } else {
            showError('No Albums Found', `We haven't added any albums to "${categoryName}" yet. Please check back later.`);
        }
    } catch (error) {
        console.error('Error loading albums:', error);
        showError('Fetch Failed', 'We encountered an error while retrieving the gallery. Please try again.');
    }
}

async function createAlbumCard(album) {
    let thumbnailUrl = '../assets/logo.png';
    
    try {
        const { data: images } = await supabase
            .from('gallery_images')
            .select('image_url')
            .eq('album_id', album.id)
            .order('created_at', { ascending: true })
            .limit(1);
        
        if (images?.[0]) {
            const { data: urlData } = supabase
                .storage
                .from('gallery-images')
                .getPublicUrl(images[0].image_url);
            
            if (urlData?.publicUrl) thumbnailUrl = urlData.publicUrl;
        }
    } catch (error) {
        console.warn('Failed to load thumbnail:', error);
    }
    
    const imageCount = album.gallery_images?.[0]?.count || 0;
    const card = document.createElement('a');
    card.href = `gallery-category.html?albumId=${album.id}`;
    card.className = 'gallery-card';
    card.innerHTML = `
        <div class="card-img-wrapper">
            <img src="${escapeHTML(thumbnailUrl)}" alt="${escapeHTML(album.album_name)}" loading="lazy">
        </div>
        <div class="card-content">
            <div class="img-count"><i class="bi bi-images"></i> ${imageCount} Moments</div>
            <h3>${escapeHTML(album.album_name)}</h3>
            ${album.album_description ? `<p>${escapeHTML(album.album_description)}</p>` : ''}
        </div>
    `;
    return card;
}

async function loadImagesByAlbum(id) {
    if (!albumListElement || !categoryTitleElement) return;
    
    showLoading('Gathering moments...');
    
    const hero = document.querySelector('.hero-mini');
    if (hero) hero.classList.add('album-view');
    
    try {
        const { data: album, error } = await supabase
            .from('gallery_albums')
            .select('album_name, album_description, category')
            .eq('id', id)
            .single();
        
        if (error || !album) throw new Error('Album not found');
        
        document.title = `${album.album_name} | Gallery | Swanson Plastics India`;
        categoryTitleElement.innerHTML = `${album.album_name.split(' ').slice(0, -1).join(' ')} <span class="highlight">${album.album_name.split(' ').slice(-1)[0]}</span>`;
        
        if (categorySubtitleElement) {
            const desc = album.album_description?.trim() 
                ? album.album_description 
                : `A visual journey of ${album.album_name} at Swanson Plastics India.`;
            categorySubtitleElement.textContent = desc;
        }
        
        const { data: images, error: imagesError } = await supabase
            .from('gallery_images')
            .select('image_url')
            .eq('album_id', id)
            .order('created_at', { ascending: true });
        
        if (imagesError) throw imagesError;
        
        albumListElement.innerHTML = '';
        albumListElement.classList.remove('album-grid');
        albumListElement.classList.add('image-grid');
        
        if (images?.length > 0) {
            images.forEach(image => {
                const { data: urlData } = supabase
                    .storage
                    .from('gallery-images')
                    .getPublicUrl(image.image_url);
                
                if (urlData?.publicUrl) {
                    const item = document.createElement('div');
                    item.className = 'gallery-item';
                    item.innerHTML = `
                        <a href="${urlData.publicUrl}" class="glightbox" data-gallery="album-${id}">
                            <img src="${urlData.publicUrl}" alt="${album.album_name}" loading="lazy">
                        </a>
                    `;
                    albumListElement.appendChild(item);
                }
            });
            
            if (typeof GLightbox !== 'undefined') {
                GLightbox({ selector: '.glightbox' });
            }
        } else {
            showError('Empty Album', 'This album currently contains no images.');
        }
    } catch (error) {
        console.error('Error loading album:', error);
        showError('Album Not Found', 'The requested gallery album could not be loaded.');
    }
}

function showLoading(message) {
    albumListElement.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>${message}</p>
        </div>
    `;
}

function showError(title, message) {
    albumListElement.innerHTML = `
        <div class="error-message">
            <i class="bi bi-exclamation-circle"></i>
            <h3>${title}</h3>
            <p>${message}</p>
            <a href="aboutus.html" class="btn-main" style="margin-top: 1.5rem; display: inline-block;">Return to Company</a>
        </div>
    `;
}
