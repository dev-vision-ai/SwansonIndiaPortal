import { supabase } from '../supabase-config.js';
import { showToast } from './toast.js';

// Global variables
let currentUser = null;
let currentSection = null;

function showSection(sectionName) {
    // Hide all sections first
    const sections = document.querySelectorAll('.utility-card');
    sections.forEach(section => {
        section.classList.add('js-hide');
    });

    // Show the selected section
    const selectedSection = document.getElementById(`${sectionName}-section`);
    if (selectedSection) {
        selectedSection.classList.remove('js-hide');
        currentSection = sectionName;

        // Update header title based on section
        const headerTitle = document.querySelector('.header-title');
        if (headerTitle) {
            if (sectionName === 'specifications') {
                headerTitle.textContent = 'Product & Specification';
            } else if (sectionName === 'calibration') {
                headerTitle.textContent = 'Equipment Calibration';
            }
        }

        // Update back button to show quick cards
        const backButton = document.querySelector('.header-back-button');
        if (backButton) {
            backButton.setAttribute('onclick', 'showQuickCards()');
        }

        // Load data for the selected section
        loadSectionData(sectionName);
    }

    // Show the utility sections container
    const utilitySections = document.getElementById('utility-sections');
    if (utilitySections) {
        utilitySections.classList.remove('js-hide');
    }
}

function showEquipmentPage() {
    // Hide quick cards and other sections
    document.querySelector('.quick-action-grid').classList.add('js-hide');
    document.getElementById('utility-sections').classList.add('js-hide');
    document.getElementById('specifications-full-page').classList.add('js-hide');

    // Show equipment full page
    document.getElementById('equipment-full-page').classList.remove('js-hide');

    // Update header back button to go back to utilities (keep text as "Back")
    const backButton = document.querySelector('.header-back-button');
    if (backButton) {
        backButton.setAttribute('onclick', 'showQuickCards()');
    }

    // Update header title
    const headerTitle = document.querySelector('.header-title');
    if (headerTitle) {
        headerTitle.textContent = 'QC Equipment Management';
    }

    // Setup filter event listeners
    setupEquipmentFilterListeners();

    // Setup pagination
    setupPagination();

    // Load equipment data
    loadEquipmentData();
}

function showProductPage() {
    // Hide quick cards and other sections
    document.querySelector('.quick-action-grid').classList.add('js-hide');
    document.getElementById('utility-sections').classList.add('js-hide');
    document.getElementById('equipment-full-page').classList.add('js-hide');

    // Show specifications full page
    document.getElementById('specifications-full-page').classList.remove('js-hide');

    const url = new URL(window.location);
    url.searchParams.set('view', 'products');
    window.history.replaceState({}, '', url);

    // Update header back button
    const backButton = document.querySelector('.header-back-button');
    if (backButton) {
        backButton.setAttribute('onclick', 'showQuickCards()');
    }

    // Update header title
    const headerTitle = document.querySelector('.header-title');
    if (headerTitle) {
        headerTitle.textContent = 'Product & Specification';
    }

    // Setup filter event listeners
    setupProductFilterListeners();

    // Setup pagination
    setupProductPagination();

    // Load product data
    loadProductData();
}

function showQuickCards() {
    // Hide all full pages
    document.getElementById('equipment-full-page').classList.add('js-hide');
    document.getElementById('specifications-full-page').classList.add('js-hide');
    document.getElementById('utility-sections').classList.add('js-hide');

    // Show quick cards
    document.querySelector('.quick-action-grid').classList.remove('js-hide');

    // Update URL to remove view parameter completely
    const url = new URL(window.location);
    url.searchParams.delete('view');
    window.history.replaceState({}, '', url.toString());

    // Reset header back button to go to employee dashboard
    const backButton = document.querySelector('.header-back-button');
    if (backButton) {
        backButton.setAttribute('onclick', "window.location.href='employee-dashboard.html'");
    }

    // Reset header title
    const headerTitle = document.querySelector('.header-title');
    if (headerTitle) {
        headerTitle.textContent = 'QC Utilities';
    }
}

function openEquipmentModal() {
    const modal = document.getElementById('equipmentModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('equipmentForm');

    // Reset form
    form.reset();
    document.getElementById('equipmentId').value = '';
    document.getElementById('modal_equipment_status').value = 'ACTIVE';

    // Set title for add mode
    modalTitle.textContent = 'Add New Equipment';

    // Ensure other modals are closed
    const prodModalToClose = document.getElementById('productModal');
    if (prodModalToClose) {
        prodModalToClose.classList.add('hidden');
        prodModalToClose.style.display = 'none';
    }

    // Ensure modal is attached to document.body
    if (modal.parentNode !== document.body) {
        document.body.appendChild(modal);
    }

    // Show modal
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.zIndex = '9999';
}

function editEquipment(id) {
    const modal = document.getElementById('equipmentModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('equipmentForm');

    // Find equipment data
    const equipment = window.allEquipmentData.find(item => String(item.id) === String(id));

    if (!equipment) {
        console.error('Equipment not found for id:', id);
        showToast('Equipment not found', 'error');
        return;
    }

    // Populate form
    document.getElementById('equipmentId').value = equipment.id;
    document.getElementById('modal_equipment_type').value = equipment.equipment_type || '';
    document.getElementById('modal_equipment_id').value = equipment.equipment_id || '';
    document.getElementById('modal_equipment_status').value = equipment.equipment_status ? 'ACTIVE' : 'INACTIVE';

    // Set title for edit mode
    modalTitle.textContent = 'Edit Equipment';

    // Ensure other modals are closed
    const prodModalToClose2 = document.getElementById('productModal');
    if (prodModalToClose2) {
        prodModalToClose2.classList.add('hidden');
        prodModalToClose2.style.display = 'none';
    }

    // Ensure modal is attached to document.body
    if (modal.parentNode !== document.body) {
        document.body.appendChild(modal);
    }

    // Show modal
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.zIndex = '9999';
}

function closeEquipmentModal() {
    const modal = document.getElementById('equipmentModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
}

function deleteEquipment(id) {
    try {
        if (!window.allEquipmentData || window.allEquipmentData.length === 0) {
            showToast('Equipment data not loaded. Please refresh the page.', 'error');
            return;
        }

        const equipment = window.allEquipmentData.find(item => String(item.id) === String(id));
        if (!equipment) {
            showToast('Equipment not found.', 'error');
            return;
        }

        // Store ID for deletion
        window.equipmentToDeleteId = id;

        // Set equipment name in modal
        const nameElement = document.getElementById('deleteEquipmentName');
        if (nameElement) {
            nameElement.textContent = equipment.equipment_id || 'this equipment';
        }

        // Show modal - robust approach
        const modal = document.getElementById('deleteModal');
        if (!modal) {
            console.error('Delete modal not found');
            return;
        }

        // Ensure modal is attached to document.body to avoid stacking context issues
        if (modal.parentNode !== document.body) document.body.appendChild(modal);

        modal.style.display = 'flex';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.zIndex = '999999';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        modal.style.pointerEvents = 'auto';

        // Attach listeners to modal buttons once (idempotent)
        if (!window._qc_delete_modal_listeners_attached) {
            const cancelBtn = document.getElementById('cancelDelete');
            const confirmBtn = document.getElementById('confirmDelete');
            if (cancelBtn) cancelBtn.addEventListener('click', closeDeleteModal);
            if (confirmBtn) confirmBtn.addEventListener('click', confirmDeleteEquipment);

            // Click outside to close
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeDeleteModal();
            });

            window._qc_delete_modal_listeners_attached = true;
        }

        // Focus the confirm button for keyboard users
        const confirmBtn = document.getElementById('confirmDelete');
        if (confirmBtn) confirmBtn.focus();

    } catch (error) {
        console.error('Error in deleteEquipment:', error);
        showToast('Error showing delete modal', 'error');
    }
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    modal.style.display = 'none';
    window.equipmentToDeleteId = null;
}

async function saveEquipment(event) {
    event.preventDefault();

    const equipmentId = document.getElementById('equipmentId').value;
    const equipmentType = document.getElementById('modal_equipment_type').value.trim();
    const equipmentIdValue = document.getElementById('modal_equipment_id').value.trim();
    const equipmentStatus = document.getElementById('modal_equipment_status').value;

    if (!equipmentType || !equipmentIdValue || !equipmentStatus) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    try {
        // Check for duplicate equipment_id when creating new equipment
        if (!equipmentId) {
            const { data: existingEquipment, error: checkError } = await supabase
                .from('qc_equipments')
                .select('id')
                .eq('equipment_id', equipmentIdValue);

            if (checkError) {
                console.error('Error checking for duplicates:', checkError);
                // Continue with save attempt - let the database constraint handle it
            } else if (existingEquipment && existingEquipment.length > 0) {
                showToast(`Equipment ID "${equipmentIdValue}" already exists. Please use a different ID.`, 'error');
                return;
            }
        }

        const equipmentData = {
            equipment_type: equipmentType,
            equipment_id: equipmentIdValue,
            equipment_status: equipmentStatus === 'ACTIVE' // Convert to boolean
        };

        let result;
        if (equipmentId) {
            // Update existing equipment
            result = await supabase
                .from('qc_equipments')
                .update(equipmentData)
                .eq('id', equipmentId);
        } else {
            // Create new equipment
            result = await supabase
                .from('qc_equipments')
                .insert(equipmentData);
        }

        if (result.error) throw result.error;

        showToast(`Equipment ${equipmentId ? 'updated' : 'created'} successfully`, 'success');
        closeEquipmentModal();
        loadEquipmentData();
    } catch (error) {
        console.error('Error saving equipment:', error);

        // Handle specific database errors with user-friendly messages
        if (error.code === '23505' && error.message.includes('equipment_id')) {
            showToast(`Equipment ID "${equipmentIdValue}" already exists. Please use a different ID.`, 'error');
        } else {
            showToast(`Failed to ${equipmentId ? 'update' : 'create'} equipment`, 'error');
        }
    }
}

async function confirmDeleteEquipment() {
    const id = window.equipmentToDeleteId;

    if (!id) {
        showToast('No equipment to delete', 'error');
        return;
    }

    const confirmBtn = document.getElementById('confirmDelete');
    if (confirmBtn) confirmBtn.disabled = true;

    try {
        const { error } = await supabase
            .from('qc_equipments')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showToast('Equipment deleted successfully', 'success');
        closeDeleteModal();
        await loadEquipmentData();
    } catch (error) {
        console.error('Delete error:', error);
        showToast('Failed to delete equipment', 'error');
    } finally {
        if (confirmBtn) confirmBtn.disabled = false;
    }
}

function openSpecificationModal() {
    showToast('Specification modal will be implemented here', 'info');
}

function editSpecification(id) {
    showToast(`Edit specification ${id} will be implemented here`, 'info');
}

// Export functions to window scope immediately
window.showSection = showSection;
window.showEquipmentPage = showEquipmentPage;
window.showProductPage = showProductPage;
window.showQuickCards = showQuickCards;
window.openEquipmentModal = openEquipmentModal;
window.openProductModal = openProductModal;
window.openSpecificationModal = openSpecificationModal;
window.editEquipment = editEquipment;
window.editProduct = editProduct;
window.editSpecification = editSpecification;
window.deleteEquipment = deleteEquipment;
window.deleteProduct = deleteProduct;
window.deleteSpecification = deleteSpecification;

// Initialize the page
document.addEventListener('DOMContentLoaded', function () {
    const productModal = document.getElementById('productModal');
    const equipmentModal = document.getElementById('equipmentModal');
    checkAuthentication();
});

// Product Pagination state
let currentProductPage = 1;
const productsPerPage = 10;
let totalProducts = 0;

// Setup product filter event listeners
function setupProductFilterListeners() {
    document.getElementById('filterCustomer')?.addEventListener('change', applyProductFilters);
    document.getElementById('filterProdCode')?.addEventListener('change', applyProductFilters);
    document.getElementById('filterGcasNo')?.addEventListener('change', applyProductFilters);
    document.getElementById('filterMaterialCode')?.addEventListener('change', applyProductFilters);
    document.getElementById('filterSpecNo')?.addEventListener('change', applyProductFilters);
    document.getElementById('clearProductFilter')?.addEventListener('click', clearProductFilters);

    const showProdBtn = document.getElementById('showProductModal');
    if (showProdBtn) {
        // Remove the inline onclick attribute to prevent conflicts
        showProdBtn.removeAttribute('onclick');

        // Remove any existing event listeners by cloning
        const newBtn = showProdBtn.cloneNode(true);
        showProdBtn.parentNode.replaceChild(newBtn, showProdBtn);

        // Attach the new secure event listener
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openProductModal();
        });
    }

    // 3. Modal Close Listeners
    const closeBtn = document.getElementById('closeProductModal');
    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener('click', closeProductModal);
    }

    const cancelBtn = document.getElementById('cancelProductModal');
    if (cancelBtn) {
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        newCancelBtn.addEventListener('click', closeProductModal);
    }

    const productForm = document.getElementById('productForm');
    if (productForm && !productForm.dataset.listenerAdded) {
        productForm.addEventListener('submit', saveProduct);
        productForm.dataset.listenerAdded = 'true';
    }

    // Delete modal listeners
    // 4. Delete Modal Listeners
    const cancelDeleteBtn = document.getElementById('cancelProductDelete');
    if (cancelDeleteBtn && !cancelDeleteBtn.dataset.listenerAdded) {
        cancelDeleteBtn.addEventListener('click', closeProductDeleteModal);
        cancelDeleteBtn.dataset.listenerAdded = 'true';
    }

    const confirmDeleteBtn = document.getElementById('confirmProductDelete');
    if (confirmDeleteBtn && !confirmDeleteBtn.dataset.listenerAdded) {
        confirmDeleteBtn.addEventListener('click', confirmDeleteProduct);
        confirmDeleteBtn.dataset.listenerAdded = 'true';
    }

    // Add backdrop click handler for product modal
    // 5. Backdrop Click Listener
    const productModal = document.getElementById('productModal');
    if (productModal && !productModal.dataset.backdropListenerAdded) {
        productModal.addEventListener('click', (e) => {
            // Only close if clicking on the backdrop (not the modal content)
            if (e.target.id === 'productModal') {
                closeProductModal();
            }
        });
        productModal.dataset.backdropListenerAdded = 'true';
    }
}

// Setup product pagination
function setupProductPagination() {
    const prevBtn = document.getElementById('prevProductPageBtn');
    const nextBtn = document.getElementById('nextProductPageBtn');

    if (prevBtn) {
        prevBtn.onclick = () => {
            if (currentProductPage > 1) {
                currentProductPage--;
                renderProductTable();
            }
        };
    }

    if (nextBtn) {
        nextBtn.onclick = () => {
            const totalPages = Math.ceil(totalProducts / productsPerPage);
            if (currentProductPage < totalPages) {
                currentProductPage++;
                renderProductTable();
            }
        };
    }
}

// Load product data from inline_products_master
async function loadProductData() {
    try {
        const { data, error } = await supabase
            .from('inline_products_master')
            .select('*')
            .order('customer', { ascending: true });

        if (error) throw error;

        window.allProductData = data || [];
        window.filteredProductData = [...window.allProductData];

        populateProductFilters();
        applyProductFilters();
    } catch (error) {
        console.error('Error loading product data:', error);
        showToast('Failed to load product data', 'error');
    }
}

function populateProductFilters() {
    const customers = [...new Set(window.allProductData.map(item => item.customer).filter(Boolean))].sort();
    const productCodes = [...new Set(window.allProductData.map(item => item.prod_code).filter(Boolean))].sort();
    const gcasNos = [...new Set(window.allProductData.map(item => item.gcas_no).filter(Boolean))].sort();
    const materialCodes = [...new Set(window.allProductData.map(item => item.material_code).filter(Boolean))].sort();
    const specNos = [...new Set(window.allProductData.map(item => item.spec_no).filter(Boolean))].sort();

    const filterCustomer = document.getElementById('filterCustomer');
    const filterProdCode = document.getElementById('filterProdCode');
    const filterGcasNo = document.getElementById('filterGcasNo');
    const filterMaterialCode = document.getElementById('filterMaterialCode');
    const filterSpecNo = document.getElementById('filterSpecNo');

    const populateSelect = (select, items) => {
        if (select) {
            select.innerHTML = '<option value="">All</option>';
            items.forEach(item => {
                const option = document.createElement('option');
                option.value = item;
                option.textContent = item;
                select.appendChild(option);
            });
        }
    };

    populateSelect(filterCustomer, customers);
    populateSelect(filterProdCode, productCodes);
    populateSelect(filterGcasNo, gcasNos);
    populateSelect(filterMaterialCode, materialCodes);
    populateSelect(filterSpecNo, specNos);
}

function applyProductFilters() {
    const customer = document.getElementById('filterCustomer')?.value || '';
    const prodCode = document.getElementById('filterProdCode')?.value || '';
    const gcasNo = document.getElementById('filterGcasNo')?.value || '';
    const materialCode = document.getElementById('filterMaterialCode')?.value || '';
    const specNo = document.getElementById('filterSpecNo')?.value || '';

    currentProductPage = 1;

    window.filteredProductData = window.allProductData.filter(item => {
        if (customer && item.customer !== customer) return false;
        if (prodCode && item.prod_code !== prodCode) return false;
        if (gcasNo && item.gcas_no !== gcasNo) return false;
        if (materialCode && item.material_code !== materialCode) return false;
        if (specNo && item.spec_no !== specNo) return false;
        return true;
    });

    updateProductFilterStatus(customer || prodCode || gcasNo || materialCode || specNo);
    renderProductTable();
}

function updateProductFilterStatus(hasFilter) {
    const indicator = document.getElementById('productFilterStatusIndicator');
    if (indicator) {
        if (hasFilter) {
            indicator.textContent = 'On';
            indicator.className = 'px-2 py-1 text-sm font-semibold rounded-full bg-green-200 text-green-800';
        } else {
            indicator.textContent = 'Off';
            indicator.className = 'px-2 py-1 text-sm font-semibold rounded-full bg-gray-200 text-gray-700';
        }
    }
}

function clearProductFilters() {
    const filterCust = document.getElementById('filterCustomer');
    const filterProd = document.getElementById('filterProdCode');
    const filterGcas = document.getElementById('filterGcasNo');
    const filterMat = document.getElementById('filterMaterialCode');
    const filterSpec = document.getElementById('filterSpecNo');

    if (filterCust) filterCust.value = '';
    if (filterProd) filterProd.value = '';
    if (filterGcas) filterGcas.value = '';
    if (filterMat) filterMat.value = '';
    if (filterSpec) filterSpec.value = '';

    applyProductFilters();
}

function renderProductTable() {
    const tbody = document.getElementById('products-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (window.filteredProductData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="py-4 text-center text-gray-500">No product records found</td></tr>';
        document.getElementById('productPaginationControls')?.classList.add('hidden');
        return;
    }

    totalProducts = window.filteredProductData.length;
    const totalPages = Math.ceil(totalProducts / productsPerPage);
    const startIndex = (currentProductPage - 1) * productsPerPage;
    const endIndex = Math.min(startIndex + productsPerPage, totalProducts);
    const currentPageData = window.filteredProductData.slice(startIndex, endIndex);

    currentPageData.forEach((record, index) => {
        const srNo = startIndex + index + 1;
        const row = createProductRow(record, srNo);
        tbody.appendChild(row);
    });

    // Update display
    const display = document.getElementById('currentProductPageDisplay');
    const totalDisplay = document.getElementById('totalProductPagesDisplay');
    if (display) display.textContent = currentProductPage;
    if (totalDisplay) totalDisplay.textContent = totalPages;

    // Update buttons
    const prevBtn = document.getElementById('prevProductPageBtn');
    const nextBtn = document.getElementById('nextProductPageBtn');
    if (prevBtn) prevBtn.disabled = currentProductPage === 1;
    if (nextBtn) nextBtn.disabled = currentProductPage === totalPages;

    // Show/hide controls
    const controls = document.getElementById('productPaginationControls');
    if (controls) {
        if (totalProducts > productsPerPage) {
            controls.classList.remove('hidden');
        } else {
            controls.classList.add('hidden');
        }
    }
}

function createProductRow(data, srNo) {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50 text-center border-b border-gray-200';

    // Helper function to handle empty values
    const formatValue = (val) => (val === null || val === undefined || val.toString().trim() === '') ? 'NA' : val;

    row.innerHTML = `
        <td class="py-2 px-2 border border-gray-300">${srNo}</td>
        <td class="py-2 px-2 border border-gray-300">${formatValue(data.customer)}</td>
        <td class="py-2 px-2 border border-gray-300">${formatValue(data.prod_code)}</td>
        <td class="py-2 px-2 border border-gray-300">${formatValue(data.spec)}</td>
        <td class="py-2 px-2 border border-gray-300">${formatValue(data.gcas_no)}</td>
        <td class="py-2 px-2 border border-gray-300">${formatValue(data.material_code)}</td>
        <td class="py-2 px-2 border border-gray-300">${formatValue(data.spec_no)}</td>
        <td class="py-2 px-2 border border-gray-300">
            <div class="flex justify-center space-x-1 flex-nowrap max-w-full overflow-hidden">
                <button onclick="editProduct('${data.id}')" class="p-1 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-600 hover:text-purple-800 transition-all duration-200 border border-purple-200 hover:border-purple-300 flex-shrink-0 edit-details-button" title="Edit Product">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                    </svg>
                </button>
                <button onclick="deleteProduct('${data.id}')" class="p-1 rounded-md bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 transition-all duration-200 border border-red-200 hover:border-red-300 flex-shrink-0 delete-button" title="Delete Product">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        </td>
    `;
    return row;
}

function openProductModal() {
    const modal = document.getElementById('productModal');

    if (modal && modal.id !== 'productModal') {
        console.error('WRONG MODAL SELECTED! Got:', modal.id, 'Expected: productModal');
        return;
    }
    const form = document.getElementById('productForm');
    const title = document.getElementById('productModalTitle');

    if (!modal) {
        console.error('Product modal element not found!');
        return;
    }

    // Reset form if it exists
    if (form) {
        form.reset();
        const productIdInput = document.getElementById('productId');
        if (productIdInput) productIdInput.value = '';
    }

    // Set title if it exists
    if (title) {
        title.textContent = 'Add New Product & Spec';
    }

    // Ensure other modals are closed first
    const equipModalToClose = document.getElementById('equipmentModal');
    if (equipModalToClose) {
        equipModalToClose.classList.add('hidden');
        equipModalToClose.style.display = 'none';
    }

    // Ensure modal is attached to document.body to avoid stacking context issues
    if (modal.parentNode !== document.body) {
        document.body.appendChild(modal);
    }

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.zIndex = '9999';
}

function closeProductModal() {
    const modal = document.getElementById('productModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

function editProduct(id) {
    const product = window.allProductData.find(p => String(p.id) === String(id));
    if (!product) {
        console.error('Product not found for editing:', id);
        return;
    }

    const modal = document.getElementById('productModal');
    const title = document.getElementById('productModalTitle');

    if (!modal || !title) {
        console.error('Modal or title element not found');
        return;
    }

    title.textContent = 'Edit Product & Spec';

    // Ensure other modals are closed
    const equipModalToClose2 = document.getElementById('equipmentModal');
    if (equipModalToClose2) {
        equipModalToClose2.classList.add('hidden');
        equipModalToClose2.style.display = 'none';
    }

    // Ensure modal is attached to document.body to avoid stacking context issues
    if (modal.parentNode !== document.body) {
        document.body.appendChild(modal);
    }

    // Show modal
    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    // Ensure other modals are closed
    const equipModal = document.getElementById('equipmentModal');
    if (equipModal) {
        equipModal.classList.add('hidden');
        equipModal.style.display = 'none';
    }

    // Populate fields
    const productIdInput = document.getElementById('productId');
    if (productIdInput) productIdInput.value = product.id;
    document.getElementById('modal_customer').value = product.customer || '';
    document.getElementById('modal_prod_code').value = product.prod_code || '';
    document.getElementById('modal_spec').value = product.spec || '';
    document.getElementById('modal_location').value = product.location || '';
    document.getElementById('modal_gcas_no').value = product.gcas_no || '';
    document.getElementById('modal_material_code').value = product.material_code || '';
    document.getElementById('modal_spec_no').value = product.spec_no || '';

    // Specs
    document.getElementById('modal_lsl_width').value = product.lsl_width || '';
    document.getElementById('modal_tgt_width').value = product.tgt_width || '';
    document.getElementById('modal_usl_width').value = product.usl_width || '';
    document.getElementById('modal_lsl_weight').value = product.lsl_weight || '';
    document.getElementById('modal_tgt_weight').value = product.tgt_weight || '';
    document.getElementById('modal_usl_weight').value = product.usl_weight || '';
    document.getElementById('modal_lsl_roll_dia').value = product.lsl_roll_dia || '';
    document.getElementById('modal_tgt_roll_dia').value = product.tgt_roll_dia || '';
    document.getElementById('modal_usl_roll_dia').value = product.usl_roll_dia || '';
    document.getElementById('modal_lsl_gsm').value = product.lsl_gsm || '';
    document.getElementById('modal_tgt_gsm').value = product.tgt_gsm || '';
    document.getElementById('modal_usl_gsm').value = product.usl_gsm || '';
    document.getElementById('modal_lsl_thickness').value = product.lsl_thickness || '';
    document.getElementById('modal_tgt_thickness').value = product.tgt_thickness || '';
    document.getElementById('modal_usl_thickness').value = product.usl_thickness || '';
    document.getElementById('modal_lsl_ct').value = product.lsl_ct || '';
    document.getElementById('modal_tgt_ct').value = product.tgt_ct || '';
    document.getElementById('modal_usl_ct').value = product.usl_ct || '';
    document.getElementById('modal_lsl_paper_core_id').value = product.lsl_paper_core_id || '';
    document.getElementById('modal_tgt_paper_core_id').value = product.tgt_paper_core_id || '';
    document.getElementById('modal_usl_paper_core_id').value = product.usl_paper_core_id || '';
    document.getElementById('modal_lsl_paper_core_od').value = product.lsl_paper_core_od || '';
    document.getElementById('modal_tgt_paper_core_od').value = product.tgt_paper_core_od || '';
    document.getElementById('modal_usl_paper_core_od').value = product.usl_paper_core_od || '';
}

async function saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('productId').value;

    const productData = {
        customer: document.getElementById('modal_customer').value.trim(),
        prod_code: document.getElementById('modal_prod_code').value.trim(),
        spec: document.getElementById('modal_spec').value.trim(),
        location: document.getElementById('modal_location').value.trim() || null,
        gcas_no: document.getElementById('modal_gcas_no').value.trim() || null,
        material_code: document.getElementById('modal_material_code').value.trim() || null,
        spec_no: document.getElementById('modal_spec_no').value.trim() || null,

        lsl_width: parseFloat(document.getElementById('modal_lsl_width').value) || null,
        tgt_width: parseFloat(document.getElementById('modal_tgt_width').value) || null,
        usl_width: parseFloat(document.getElementById('modal_usl_width').value) || null,
        lsl_weight: parseFloat(document.getElementById('modal_lsl_weight').value) || null,
        tgt_weight: parseFloat(document.getElementById('modal_tgt_weight').value) || null,
        usl_weight: parseFloat(document.getElementById('modal_usl_weight').value) || null,
        lsl_roll_dia: parseFloat(document.getElementById('modal_lsl_roll_dia').value) || null,
        tgt_roll_dia: parseFloat(document.getElementById('modal_tgt_roll_dia').value) || null,
        usl_roll_dia: parseFloat(document.getElementById('modal_usl_roll_dia').value) || null,
        lsl_gsm: parseFloat(document.getElementById('modal_lsl_gsm').value) || null,
        tgt_gsm: parseFloat(document.getElementById('modal_tgt_gsm').value) || null,
        usl_gsm: parseFloat(document.getElementById('modal_usl_gsm').value) || null,
        lsl_thickness: parseFloat(document.getElementById('modal_lsl_thickness').value) || null,
        tgt_thickness: parseFloat(document.getElementById('modal_tgt_thickness').value) || null,
        usl_thickness: parseFloat(document.getElementById('modal_usl_thickness').value) || null,
        lsl_ct: parseFloat(document.getElementById('modal_lsl_ct').value) || null,
        tgt_ct: parseFloat(document.getElementById('modal_tgt_ct').value) || null,
        usl_ct: parseFloat(document.getElementById('modal_usl_ct').value) || null,
        lsl_paper_core_id: parseFloat(document.getElementById('modal_lsl_paper_core_id').value) || null,
        tgt_paper_core_id: parseFloat(document.getElementById('modal_tgt_paper_core_id').value) || null,
        usl_paper_core_id: parseFloat(document.getElementById('modal_usl_paper_core_id').value) || null,
        lsl_paper_core_od: parseFloat(document.getElementById('modal_lsl_paper_core_od').value) || null,
        tgt_paper_core_od: parseFloat(document.getElementById('modal_tgt_paper_core_od').value) || null,
        usl_paper_core_od: parseFloat(document.getElementById('modal_usl_paper_core_od').value) || null,
        updated_at: new Date().toISOString()
    };

    try {
        let result;
        if (id) {
            result = await supabase.from('inline_products_master').update(productData).eq('id', id);
        } else {
            result = await supabase.from('inline_products_master').insert([productData]);
        }

        if (result.error) throw result.error;

        showToast(`Product ${id ? 'updated' : 'added'} successfully`, 'success');
        closeProductModal();
        loadProductData();
    } catch (error) {
        console.error('Error saving product:', error);
        showToast('Error saving product: ' + error.message, 'error');
    }
}

function deleteProduct(id) {
    const product = window.allProductData.find(p => String(p.id) === String(id));
    if (!product) return;

    window.productToDeleteId = id;
    document.getElementById('deleteProductName').textContent = `${product.customer} - ${product.prod_code}`;

    const modal = document.getElementById('productDeleteModal');
    if (modal) {
        // Ensure modal is attached to document.body to avoid stacking context issues
        if (modal.parentNode !== document.body) {
            document.body.appendChild(modal);
        }
        modal.classList.remove('hidden');
    }
}

function closeProductDeleteModal() {
    document.getElementById('productDeleteModal').classList.add('hidden');
    window.productToDeleteId = null;
}

async function confirmDeleteProduct() {
    const id = window.productToDeleteId;
    if (!id) return;

    try {
        const { error } = await supabase.from('inline_products_master').delete().eq('id', id);
        if (error) throw error;

        showToast('Product deleted successfully', 'success');
        closeProductDeleteModal();
        loadProductData();
    } catch (error) {
        console.error('Error deleting product:', error);
        showToast('Error deleting product', 'error');
    }
}

// Check authentication status
async function checkAuthentication() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
            window.location.replace('../html/auth.html');
            return;
        }

        currentUser = user;
        await loadUserData();
        checkAdminAccess();
        showRelevantCards();
    } catch (err) {
        console.error('Authentication check failed:', err);
        window.location.replace('../html/auth.html');
    }
}

// Load user data from session storage
async function loadUserData() {
    const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');
    if (!userData || !userData.employee_code) {
        // If no user data in session, try to get it from database
        try {
            const { data, error } = await supabase
                .from('users')
                .select('is_admin, department, full_name, employee_code')
                .eq('id', currentUser.id)
                .single();

            if (data && !error) {
                sessionStorage.setItem('userData', JSON.stringify(data));
            } else {
                console.error('Error loading user data:', error);
            }
        } catch (err) {
            console.error('Failed to load user data:', err);
        }
    } else {
        // Use cached user data
    }
}

// Check if user has access to this page
function checkAdminAccess() {
    const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');

    // Allow if user is admin OR if user is from Quality Control/Quality Assurance
    const allowedDepartments = ['Quality Control', 'Quality Assurance'];
    const isAllowedDept = userData.department && allowedDepartments.includes(userData.department);

    if (!userData.is_admin && !isAllowedDept) {
        showToast('You do not have permission to access QC Utilities.', 'error');
        setTimeout(() => {
            window.location.href = 'employee-dashboard.html';
        }, 2000);
        return false;
    }

    return true;
}

// Show relevant cards based on user department
function showRelevantCards() {
    const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');
    const cards = document.querySelectorAll('.action-card');

    cards.forEach(card => {
        // Admin logic: Admins see everything
        if (userData.is_admin) {
            card.classList.remove('js-hide');
            return;
        }

        const departmentAttr = card.getAttribute('data-department');
        const adminOnly = card.getAttribute('data-admin-only');

        if (adminOnly === 'true') {
            // Non-admins already checked for is_admin above, but just in case
            card.classList.add('js-hide');
        } else if (departmentAttr) {
            const departments = departmentAttr.split(',').map(d => d.trim());

            // Check if user's department matches any of the card's allowed departments
            let isUserAllowed = departments.includes('All');
            if (userData.department) {
                // Handle comma-separated departments for the user too if necessary
                const userDepts = userData.department.split(',').map(d => d.trim());
                if (departments.some(cardDept => userDepts.includes(cardDept))) {
                    isUserAllowed = true;
                }
            }

            if (isUserAllowed) {
                card.classList.remove('js-hide');
            } else {
                card.classList.add('js-hide');
            }
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    // No message modal event listeners needed - using toast notifications
}

// Check URL parameters on page load
document.addEventListener('DOMContentLoaded', () => {
    checkAuthentication();

    // Check if we should show equipment page based on URL
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view');

    if (view === 'equipment') {
        showEquipmentPage();
    } else if (view === 'products') {
        showProductPage();
    } else {
        // Check if pages are already visible
        const equipmentPage = document.getElementById('equipment-full-page');
        const productPage = document.getElementById('specifications-full-page');

        if (equipmentPage && !equipmentPage.classList.contains('js-hide')) {
            loadEquipmentData();
        } else if (productPage && !productPage.classList.contains('js-hide')) {
            loadProductData();
        }
    }

    // Attach modal event listeners (ensure elements exist)
    const cancelBtn = document.getElementById('cancelDelete');
    const confirmBtn = document.getElementById('confirmDelete');
    const deleteModal = document.getElementById('deleteModal');

    if (cancelBtn) cancelBtn.addEventListener('click', closeDeleteModal);
    if (confirmBtn) confirmBtn.addEventListener('click', confirmDeleteEquipment);
    if (deleteModal) deleteModal.addEventListener('click', (e) => { if (e.target.id === 'deleteModal') closeDeleteModal(); });
});

// Setup equipment filter event listeners
function setupEquipmentFilterListeners() {
    // Setup EQUIPMENT filter listeners
    // Date filters
    document.getElementById('filterFromDate')?.addEventListener('change', applyEquipmentFilters);
    document.getElementById('filterToDate')?.addEventListener('change', applyEquipmentFilters);

    // Dropdown filters
    document.getElementById('filterEquipmentType')?.addEventListener('change', applyEquipmentFilters);
    document.getElementById('filterStatus')?.addEventListener('change', applyEquipmentFilters);

    // Clear filter button
    document.getElementById('clearFilter')?.addEventListener('click', clearEquipmentFilters);

    // Create Equipment button (at bottom of page)
    const showEquipBtn = document.getElementById('showEquipmentModal');
    if (showEquipBtn && !showEquipBtn.dataset.equipmentListenerAdded) {
        // Remove any existing listeners first by cloning
        const newBtn = showEquipBtn.cloneNode(true);
        showEquipBtn.parentNode.replaceChild(newBtn, showEquipBtn);

        // Now add listener to the cloned button (which has the same ID)
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openEquipmentModal();
        });
        newBtn.dataset.equipmentListenerAdded = 'true';
    }

    // Modal event listeners
    const closeEquipBtn = document.getElementById('closeModal');
    if (closeEquipBtn && !closeEquipBtn.dataset.listenerAdded) {
        closeEquipBtn.addEventListener('click', closeEquipmentModal);
        closeEquipBtn.dataset.listenerAdded = 'true';
    }

    const cancelEquipBtn = document.getElementById('cancelModal');
    if (cancelEquipBtn && !cancelEquipBtn.dataset.listenerAdded) {
        cancelEquipBtn.addEventListener('click', closeEquipmentModal);
        cancelEquipBtn.dataset.listenerAdded = 'true';
    }

    const equipForm = document.getElementById('equipmentForm');
    if (equipForm && !equipForm.dataset.listenerAdded) {
        equipForm.addEventListener('submit', saveEquipment);
        equipForm.dataset.listenerAdded = 'true';
    }

    // Modal listeners are attached on DOMContentLoaded to ensure elements exist
}

// Pagination state
let currentPage = 1;
const itemsPerPage = 10;
let totalItems = 0;

// Setup pagination
function setupPagination() {
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderEquipmentTable();
                updatePaginationControls();
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(totalItems / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderEquipmentTable();
                updatePaginationControls();
            }
        });
    }
}

// Update pagination controls
function updatePaginationControls() {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const currentPageDisplay = document.getElementById('currentPageDisplay');
    const totalPagesDisplay = document.getElementById('totalPagesDisplay');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const paginationControls = document.getElementById('paginationControls');

    if (currentPageDisplay) currentPageDisplay.textContent = currentPage;
    if (totalPagesDisplay) totalPagesDisplay.textContent = totalPages;

    if (prevPageBtn) {
        prevPageBtn.disabled = currentPage === 1;
    }

    if (nextPageBtn) {
        nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
    }

    // Show pagination controls if there are items
    if (paginationControls && totalItems > itemsPerPage) {
        paginationControls.classList.remove('hidden');
    }
}

// Show quick cards (back button) - REMOVED DUPLICATE

// Show a specific utility section (for other cards) - REMOVED DUPLICATE

// Load equipment data from qc_equipments table
async function loadEquipmentData() {
    try {
        const { data, error } = await supabase
            .from('qc_equipments')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Store all data for filtering
        window.allEquipmentData = data || [];
        window.filteredEquipmentData = [...window.allEquipmentData];

        // Populate filter dropdowns
        populateEquipmentFilters();

        // Apply any active filters
        applyEquipmentFilters();

        // Render table
        renderEquipmentTable();
    } catch (error) {
        console.error('Error loading equipment data:', error);
        showToast('Failed to load equipment data', 'error');
    }
}

// Populate equipment filter dropdowns
function populateEquipmentFilters() {
    // Get unique equipment types
    const equipmentTypes = [...new Set(window.allEquipmentData.map(item => item.equipment_type).filter(Boolean))].sort();
    const filterEquipmentType = document.getElementById('filterEquipmentType');

    if (filterEquipmentType) {
        filterEquipmentType.innerHTML = '<option value="">All</option>';
        equipmentTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            filterEquipmentType.appendChild(option);
        });
    }
}

// Apply equipment filters
function applyEquipmentFilters() {
    const fromDate = document.getElementById('filterFromDate')?.value || '';
    const toDate = document.getElementById('filterToDate')?.value || '';
    const equipmentType = document.getElementById('filterEquipmentType')?.value || '';
    const status = document.getElementById('filterStatus')?.value || '';

    // Reset to first page when filtering
    currentPage = 1;

    window.filteredEquipmentData = window.allEquipmentData.filter(item => {
        // Date filter
        if (fromDate) {
            if (!item.created_at) return false;
            const itemDate = new Date(item.created_at).toISOString().split('T')[0];
            if (itemDate < fromDate) return false;
        }
        if (toDate) {
            if (!item.created_at) return false;
            const itemDate = new Date(item.created_at).toISOString().split('T')[0];
            if (itemDate > toDate) return false;
        }

        // Equipment type filter
        if (equipmentType && item.equipment_type !== equipmentType) return false;

        // Status filter
        if (status) {
            const statusBoolean = status === 'Active';
            if (item.equipment_status !== statusBoolean) return false;
        }

        return true;
    });

    // Update filter status indicator
    updateFilterStatus(fromDate || toDate || equipmentType || status);

    // Render table
    renderEquipmentTable();
}

// Update filter status indicator
function updateFilterStatus(hasActiveFilter) {
    const indicator = document.getElementById('filterStatusIndicator');
    if (indicator) {
        if (hasActiveFilter) {
            indicator.textContent = 'On';
            indicator.className = 'px-2 py-1 text-sm font-semibold rounded-full bg-green-200 text-green-800';
        } else {
            indicator.textContent = 'Off';
            indicator.className = 'px-2 py-1 text-sm font-semibold rounded-full bg-gray-200 text-gray-700';
        }
    }
}

// Render equipment table
function renderEquipmentTable() {
    const tbody = document.getElementById('equipment-tbody');
    tbody.innerHTML = '';

    if (window.filteredEquipmentData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-gray-500">No equipment records found</td></tr>';
        return;
    }

    // Update total items for pagination
    totalItems = window.filteredEquipmentData.length;

    // Calculate pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const currentPageData = window.filteredEquipmentData.slice(startIndex, endIndex);

    // Render current page data
    currentPageData.forEach((record, index) => {
        const srNo = startIndex + index + 1;
        const row = createEquipmentRow(record.id, record, srNo);
        tbody.appendChild(row);
    });

    // Update pagination controls
    updatePaginationControls();
}

// Clear filters
function clearEquipmentFilters() {
    document.getElementById('filterFromDate').value = '';
    document.getElementById('filterToDate').value = '';
    document.getElementById('filterEquipmentType').value = '';
    document.getElementById('filterStatus').value = '';

    applyEquipmentFilters();
}

// Create equipment table row
function createEquipmentRow(id, data, srNo) {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50 text-center border-b border-gray-200';

    row.innerHTML = `
        <td class="py-2 px-2 border border-gray-300">${srNo}</td>
        <td class="py-2 px-2 border border-gray-300">${data.equipment_type || ''}</td>
        <td class="py-2 px-2 border border-gray-300">${data.equipment_id || ''}</td>
        <td class="py-2 px-2 border border-gray-300">${formatDate(data.created_at) || ''}</td>
        <td class="py-2 px-2 border border-gray-300">
            <span class="px-2 py-1 text-xs font-semibold rounded-full ${data.equipment_status ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                ${data.equipment_status ? 'ACTIVE' : 'INACTIVE'}
            </span>
        </td>
        <td class="py-2 px-2 border border-gray-300">
            <div class="flex justify-center space-x-1 flex-nowrap max-w-full overflow-hidden">
                <button onclick="editEquipment('${id}')" class="p-1 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-600 hover:text-purple-800 transition-all duration-200 border border-purple-200 hover:border-purple-300 flex-shrink-0 edit-details-button" title="Edit Equipment">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                    </svg>
                </button>
                <button onclick="deleteEquipment('${id}')" class="p-1 rounded-md bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 transition-all duration-200 border border-red-200 hover:border-red-300 flex-shrink-0 delete-button" title="Delete Equipment">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        </td>
    `;

    return row;
}

// Load data for a specific section
async function loadSectionData(sectionName) {
    switch (sectionName) {
        case 'calibration':
            await loadCalibrationData();
            break;
        case 'specifications':
            await loadSpecificationData();
            break;
    }
}

// Load calibration data
async function loadCalibrationData() {
    try {
        // For now, show a message that tables need to be created
        const tbody = document.getElementById('calibration-tbody');
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">Database tables need to be created. Please contact your database administrator.</td></tr>';

        // TODO: Uncomment this when database tables are created
        /*
        const { data, error } = await supabase
            .from('qc_calibration')
            .select('*')
            .order('nextCalibrationDate', { ascending: true });
        
        if (error) throw error;
        
        tbody.innerHTML = '';
        
        if (data && data.length > 0) {
            data.forEach((record) => {
                const row = createCalibrationRow(record.id, record);
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">No calibration records found</td></tr>';
        }
        */
    } catch (error) {
        console.error('Error loading calibration data:', error);
        showToast('Failed to load calibration data', 'error');
    }
}

// Create calibration table row
function createCalibrationRow(id, data) {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50 text-center border-b border-gray-200';
    const status = getCalibrationStatus(data.nextCalibrationDate);

    row.innerHTML = `
        <td class="px-4 py-2 text-sm border border-gray-300">${data.equipmentId || ''}</td>
        <td class="px-4 py-2 text-sm border border-gray-300">${data.equipmentName || ''}</td>
        <td class="px-4 py-2 text-sm border border-gray-300">${formatDate(data.lastCalibrationDate) || ''}</td>
        <td class="px-4 py-2 text-sm border border-gray-300">${formatDate(data.nextCalibrationDate) || ''}</td>
        <td class="px-4 py-2 text-sm border border-gray-300">
            <span class="status-badge ${status.class}">${status.text}</span>
        </td>
        <td class="px-4 py-2 text-sm border border-gray-300">
            <div class="flex justify-center space-x-1 flex-nowrap max-w-full overflow-hidden">
                <button onclick="editCalibration('${id}')" class="p-1 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-600 hover:text-purple-800 transition-all duration-200 border border-purple-200 hover:border-purple-300 flex-shrink-0 edit-details-button" title="Edit Calibration">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                    </svg>
                </button>
                <button onclick="deleteCalibration('${id}')" class="p-1 rounded-md bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 transition-all duration-200 border border-red-200 hover:border-red-300 flex-shrink-0 delete-button" title="Delete Calibration">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        </td>
    `;

    return row;
}

// Get calibration status
function getCalibrationStatus(nextCalibrationDate) {
    if (!nextCalibrationDate) {
        return { class: 'status-pending', text: 'Pending' };
    }

    const today = new Date();
    const nextDate = new Date(nextCalibrationDate);
    const daysUntilDue = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) {
        return { class: 'status-inactive', text: 'Overdue' };
    } else if (daysUntilDue <= 30) {
        return { class: 'status-pending', text: 'Due Soon' };
    } else {
        return { class: 'status-active', text: 'Active' };
    }
}

// SOP functions - REMOVED
// Test method functions - REMOVED
// Audit functions - REMOVED

// Load specification data
async function loadSpecificationData() {
    try {
        // For now, show a message that tables need to be created
        const tbody = document.getElementById('specifications-tbody');
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">Database tables need to be created. Please contact your database administrator.</td></tr>';

        // TODO: Uncomment this when database tables are created
        /*
        const { data, error } = await supabase
            .from('qc_specifications')
            .select('*')
            .order('specId', { ascending: true });
        
        if (error) throw error;
        
        tbody.innerHTML = '';
        
        if (data && data.length > 0) {
            data.forEach((record) => {
                const row = createSpecificationRow(record.id, record);
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">No specification records found</td></tr>';
        }
        */
    } catch (error) {
        console.error('Error loading specification data:', error);
        showToast('Failed to load specification data', 'error');
    }
}

// Create specification table row
function createSpecificationRow(id, data) {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50 text-center border-b border-gray-200';

    row.innerHTML = `
        <td class="px-4 py-2 text-sm border border-gray-300">${data.specId || ''}</td>
        <td class="px-4 py-2 text-sm border border-gray-300">${data.productMaterial || ''}</td>
        <td class="px-4 py-2 text-sm border border-gray-300">${data.version || ''}</td>
        <td class="px-4 py-2 text-sm border border-gray-300">${data.type || ''}</td>
        <td class="px-4 py-2 text-sm border border-gray-300">${formatDate(data.effectiveDate) || ''}</td>
        <td class="px-4 py-2 text-sm border border-gray-300">
            <div class="flex justify-center space-x-1 flex-nowrap max-w-full overflow-hidden">
                <button onclick="editSpecification('${id}')" class="p-1 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-600 hover:text-purple-800 transition-all duration-200 border border-purple-200 hover:border-purple-300 flex-shrink-0 edit-details-button" title="Edit Specification">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                    </svg>
                </button>
                <button onclick="deleteSpecification('${id}')" class="p-1 rounded-md bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 transition-all duration-200 border border-red-200 hover:border-red-300 flex-shrink-0 delete-button" title="Delete Specification">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        </td>
    `;

    return row;
}

// Load audit data
async function loadAuditData() {
    try {
        // For now, show a message that tables need to be created
        const tbody = document.getElementById('audit-tbody');
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">Database tables need to be created. Please contact your database administrator.</td></tr>';

        // TODO: Uncomment this when database tables are created
        /*
        const { data, error } = await supabase
            .from('qc_audit')
            .select('*')
            .order('scheduledDate', { ascending: true });
        
        if (error) throw error;
        
        tbody.innerHTML = '';
        
        if (data && data.length > 0) {
            data.forEach((record) => {
                const row = createAuditRow(record.id, record);
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">No audit records found</td></tr>';
        }
        */
    } catch (error) {
        console.error('Error loading audit data:', error);
        showToast('Failed to load audit data', 'error');
    }
}

// Create audit table row
function createAuditRow(id, data) {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50 text-center border-b border-gray-200';
    const statusClass = data.status === 'Completed' ? 'status-active' :
        data.status === 'In Progress' ? 'status-pending' : 'status-inactive';

    row.innerHTML = `
        <td class="px-4 py-2 text-sm border border-gray-300">${data.auditId || ''}</td>
        <td class="px-4 py-2 text-sm border border-gray-300">${data.auditType || ''}</td>
        <td class="px-4 py-2 text-sm border border-gray-300">${data.department || ''}</td>
        <td class="px-4 py-2 text-sm border border-gray-300">${formatDate(data.scheduledDate) || ''}</td>
        <td class="px-4 py-2 text-sm border border-gray-300">
            <span class="status-badge ${statusClass}">${data.status || 'Scheduled'}</span>
        </td>
        <td class="px-4 py-2 text-sm border border-gray-300">
            <div class="flex justify-center space-x-1 flex-nowrap max-w-full overflow-hidden">
                <button onclick="editAudit('${id}')" class="p-1 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-600 hover:text-purple-800 transition-all duration-200 border border-purple-200 hover:border-purple-300 flex-shrink-0 edit-details-button" title="Edit Audit">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                    </svg>
                </button>
                <button onclick="deleteAudit('${id}')" class="p-1 rounded-md bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 transition-all duration-200 border border-red-200 hover:border-red-300 flex-shrink-0 delete-button" title="Delete Audit">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        </td>
    `;

    return row;
}

// Modal functions - REMOVED DUPLICATES

async function deleteSpecification(id) {
    if (confirm('Are you sure you want to delete this specification?')) {
        try {
            const { error } = await supabase
                .from('qc_specifications')
                .delete()
                .eq('id', id);

            if (error) throw error;

            showToast('Specification deleted successfully', 'success');
            loadSpecificationData();
        } catch (error) {
            console.error('Error deleting specification:', error);
            showToast('Failed to delete specification', 'error');
        }
    }
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return '';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// Message modal functions
