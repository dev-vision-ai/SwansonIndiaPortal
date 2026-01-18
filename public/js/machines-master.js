import { supabase } from '../supabase-config.js';

let machinesData = [];
let filteredData = [];
let currentPage = 1;
const itemsPerPage = 10;
const filterStatusIndicator = document.getElementById('filterStatusIndicator');

// DOM Elements for Modal
const machinesTableBody = document.getElementById('machinesTableBody');
const addEquipmentBtn = document.getElementById('addEquipmentBtn');
const equipmentModal = document.getElementById('equipmentModal');
const equipmentForm = document.getElementById('equipmentForm');
const closeModalBtn = document.getElementById('closeModal');
const cancelModalBtn = document.getElementById('cancelModal');
const modalTitle = document.getElementById('modalTitle');
const equipmentIdInput = document.getElementById('equipmentId');

// DOM Elements for Delete Modal
const deleteModal = document.getElementById('deleteModal');
const confirmDeleteBtn = document.getElementById('confirmDelete');
const cancelDeleteBtn = document.getElementById('cancelDelete');
const deleteMachineNameSpan = document.getElementById('deleteMachineName');
let machineIdToDelete = null;

function formatDateToDDMMYYYY(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function setupModalListeners() {
    // Open modal for adding
    addEquipmentBtn?.addEventListener('click', () => {
        openModal();
    });

    // Close modal
    closeModalBtn?.addEventListener('click', closeModal);
    cancelModalBtn?.addEventListener('click', closeModal);

    // Close on outside click
    equipmentModal?.addEventListener('click', (e) => {
        if (e.target === equipmentModal) closeModal();
    });

    // Handle form submission
    equipmentForm?.addEventListener('submit', handleFormSubmit);

    // Auto-capitalize first letter of each word for Name and Area
    const capitalizeInput = (input) => {
        const start = input.selectionStart;
        const end = input.selectionEnd;
        input.value = input.value.replace(/\b\w/g, char => char.toUpperCase());
        input.setSelectionRange(start, end);
    };

    const nameInput = document.getElementById('modal_equipment_name');
    const areaInput = document.getElementById('modal_installation_area');

    nameInput?.addEventListener('input', () => capitalizeInput(nameInput));
    areaInput?.addEventListener('input', () => capitalizeInput(areaInput));

    // Delete Modal Listeners
    cancelDeleteBtn?.addEventListener('click', closeDeleteModal);
    confirmDeleteBtn?.addEventListener('click', async () => {
        if (machineIdToDelete) {
            await deleteMachine(machineIdToDelete);
            closeDeleteModal();
        }
    });
    deleteModal?.addEventListener('click', (e) => {
        if (e.target === deleteModal) closeDeleteModal();
    });

    // Handle Edit/Delete button clicks (event delegation)
    machinesTableBody?.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');

        if (editBtn) {
            const id = editBtn.getAttribute('data-id');
            const machine = machinesData.find(m => String(m.id) === String(id));
            if (machine) {
                openModal(machine);
            }
        }

        if (deleteBtn) {
            const id = deleteBtn.getAttribute('data-id');
            const machine = machinesData.find(m => String(m.id) === String(id));
            if (machine) {
                openDeleteModal(machine);
            }
        }
    });
}

function openDeleteModal(machine) {
    machineIdToDelete = machine.id;
    if (deleteMachineNameSpan) deleteMachineNameSpan.textContent = machine.equipment_name;
    if (deleteModal) {
        deleteModal.classList.remove('hidden');
        deleteModal.style.display = 'flex';
    }
}

function closeDeleteModal() {
    machineIdToDelete = null;
    if (deleteModal) {
        deleteModal.classList.add('hidden');
        deleteModal.style.display = 'none';
    }
}

async function deleteMachine(id) {
    try {
        const { error } = await supabase
            .from('mt_machines_and_equipments_masterdata')
            .delete()
            .eq('id', id);

        if (error) throw error;
        
        // Show success message (using simple alert for now, or toast if available)
        alert('Equipment deleted successfully!');
        
        // Refresh data
        await fetchMachines();
    } catch (error) {
        console.error('Error deleting equipment:', error);
        alert('Error deleting equipment: ' + error.message);
    }
}

function openModal(machine = null) {
    if (!equipmentForm || !equipmentModal || !modalTitle || !equipmentIdInput) return;
    
    equipmentForm.reset();
    if (machine) {
        modalTitle.textContent = 'Edit Equipment';
        equipmentIdInput.value = machine.id;
        document.getElementById('modal_equipment_name').value = machine.equipment_name || '';
        document.getElementById('modal_identification_no').value = machine.equipment_identification_no || '';
        document.getElementById('modal_installation_area').value = machine.installation_area || '';
        document.getElementById('modal_installation_date').value = machine.equipment_installation_date || '';
    } else {
        modalTitle.textContent = 'Add New Equipment';
        equipmentIdInput.value = '';
    }
    equipmentModal.classList.remove('hidden');
    equipmentModal.style.display = 'flex';
}

function closeModal() {
    if (equipmentModal) {
        equipmentModal.classList.add('hidden');
        equipmentModal.style.display = 'none';
    }
    equipmentForm?.reset();
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const saveBtn = document.getElementById('saveEquipmentBtn');
    const originalBtnText = saveBtn ? saveBtn.textContent : 'Save';
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
    }

    const id = equipmentIdInput.value;
    const machineData = {
        equipment_name: document.getElementById('modal_equipment_name').value,
        equipment_identification_no: document.getElementById('modal_identification_no').value,
        installation_area: document.getElementById('modal_installation_area').value,
        equipment_installation_date: document.getElementById('modal_installation_date').value,
    };

    try {
        if (id) {
            // Update
            const { error } = await supabase
                .from('mt_machines_and_equipments_masterdata')
                .update(machineData)
                .eq('id', id);
            if (error) throw error;
            alert('Equipment updated successfully!');
        } else {
            // Add
            const { error } = await supabase
                .from('mt_machines_and_equipments_masterdata')
                .insert([machineData]);
            if (error) throw error;
            alert('New equipment added successfully!');
        }
        
        closeModal();
        await fetchMachines(); // Refresh data and table
    } catch (error) {
        console.error('Error saving equipment:', error);
        alert('Error saving equipment: ' + error.message);
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = originalBtnText;
        }
    }
}

async function fetchMachines() {
    try {
        const { data, error } = await supabase
            .from('mt_machines_and_equipments_masterdata')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        machinesData = data || [];
        
        // Sort by Installation Date Descending (Latest first)
        machinesData.sort((a, b) => {
            const dateA = a.equipment_installation_date ? new Date(a.equipment_installation_date) : new Date(0);
            const dateB = b.equipment_installation_date ? new Date(b.equipment_installation_date) : new Date(0);
            return dateB - dateA;
        });

        filteredData = [...machinesData];
        
        // Populate area filter
        populateAreaFilter(machinesData);
        
        renderTable();
    } catch (error) {
        console.error('Error fetching machines:', error);
        alert('Failed to load machine data.');
    }
}

let isDropdownInitialized = false;

function populateAreaFilter(data) {
    const areaFilter = document.getElementById('areaFilter');
    const areaDropdownList = document.getElementById('areaDropdownList');
    const areaInput = document.getElementById('modal_installation_area');
    
    if (!areaFilter && !areaDropdownList) return;

    const areas = [...new Set(data.map(m => m.installation_area).filter(Boolean))].sort();
    
    // Update filter dropdown (top search bar)
    if (areaFilter) {
        areaFilter.innerHTML = '<option value="">All Areas</option>';
        areas.forEach(area => {
            const option = document.createElement('option');
            option.value = area;
            option.textContent = area;
            areaFilter.appendChild(option);
        });
    }

    // Update modal custom dropdown list
    if (areaDropdownList && areaInput) {
        updateCustomDropdownItems(areaInput, areaDropdownList, areas);
        
        if (!isDropdownInitialized) {
            setupCustomDropdownListeners(areaInput, areaDropdownList);
            isDropdownInitialized = true;
        }
    }
}

function updateCustomDropdownItems(input, list, items) {
    list.innerHTML = '';
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer text-gray-700 border-b border-gray-50 last:border-0';
        div.textContent = item;
        div.addEventListener('click', () => {
            input.value = item;
            list.classList.add('hidden');
        });
        list.appendChild(div);
    });
}

function setupCustomDropdownListeners(input, list) {
    const filterItems = () => {
        const filter = input.value.toLowerCase();
        const options = list.querySelectorAll('div');
        let hasVisible = false;

        options.forEach(opt => {
            const text = opt.textContent.toLowerCase();
            if (text.includes(filter)) {
                opt.style.display = 'block';
                hasVisible = true;
            } else {
                opt.style.display = 'none';
            }
        });

        if (hasVisible) {
            list.classList.remove('hidden');
        } else {
            list.classList.add('hidden');
        }
    };

    // Show/Hide logic
    input.addEventListener('click', (e) => {
        e.stopPropagation();
        filterItems(); // Re-filter on click to show relevant options
    });

    input.addEventListener('focus', () => {
        filterItems(); // Re-filter on focus
    });

    input.addEventListener('input', filterItems);

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !list.contains(e.target)) {
            list.classList.add('hidden');
        }
    });
}

// Helper function to create SVG icons (same as MJR Table)
function createIcon(iconType) {
    const icons = {
        view: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
        </svg>`,
        edit: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
        </svg>`,
        delete: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
        </svg>`
    };
    return icons[iconType] || '';
}

function renderTable() {
    const tbody = document.getElementById('machinesTableBody');
    if (!tbody) return;

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4">No records found</td></tr>`;
        updatePaginationInfo();
        return;
    }

    // Calculate pagination slice
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredData.length);
    const paginatedData = filteredData.slice(startIndex, endIndex);

    tbody.innerHTML = paginatedData.map((machine, index) => `
        <tr>
            <td class="col-sr-no">${filteredData.length - (startIndex + index)}</td>
            <td class="col-name">${machine.equipment_name || 'N/A'}</td>
            <td class="col-id-no">${machine.equipment_identification_no || 'N/A'}</td>
            <td class="col-area">${machine.installation_area || 'N/A'}</td>
            <td class="col-date">${formatDateToDDMMYYYY(machine.equipment_installation_date)}</td>
            <td class="col-actions">
                <div class="actions-cell">
                    <button class="p-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200" onclick="alert('View coming soon')" title="View">
                        ${createIcon('view')}
                    </button>
                    <button class="p-1 rounded-md bg-yellow-50 text-yellow-600 hover:bg-yellow-100 border border-yellow-200 edit-btn" data-id="${machine.id}" title="Edit">
                        ${createIcon('edit')}
                    </button>
                    <button class="p-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 delete-btn" data-id="${machine.id}" title="Delete">
                        ${createIcon('delete')}
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    updatePaginationInfo();
}

function updatePaginationInfo() {
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

    const paginationInfo = document.getElementById('paginationInfo');
    if (paginationInfo) {
        paginationInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    }

    // Update pagination controls
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

// Global function for pagination buttons
function setupPaginationListeners() {
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredData.length / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderTable();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }
}

function filterTable() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const areaFilter = document.getElementById('areaFilter')?.value || '';

    filteredData = machinesData.filter(machine => {
        const matchesSearch = 
            (machine.equipment_name?.toLowerCase().includes(searchTerm)) ||
            (machine.equipment_identification_no?.toLowerCase().includes(searchTerm));
        
        const matchesArea = areaFilter === '' || machine.installation_area === areaFilter;

        return matchesSearch && matchesArea;
    });

    // Reset to first page on filter
    currentPage = 1;

    // Update filter status indicator
    if (filterStatusIndicator) {
        const isFiltered = searchTerm !== '' || areaFilter !== '';
        filterStatusIndicator.textContent = isFiltered ? 'On' : 'Off';
        filterStatusIndicator.className = `px-2 py-1 text-sm font-semibold rounded-full ${isFiltered ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`;
    }

    renderTable();
}

function clearFilters() {
    const searchInput = document.getElementById('searchInput');
    const areaFilter = document.getElementById('areaFilter');
    
    if (searchInput) searchInput.value = '';
    if (areaFilter) areaFilter.value = '';
    
    filterTable();
}

document.addEventListener('DOMContentLoaded', () => {
    fetchMachines();
    setupPaginationListeners();
    setupModalListeners();

    document.getElementById('searchInput')?.addEventListener('input', filterTable);
    document.getElementById('areaFilter')?.addEventListener('change', filterTable);
    document.getElementById('clearFilters')?.addEventListener('click', clearFilters);
});
