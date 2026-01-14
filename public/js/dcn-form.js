import { supabase } from '../supabase-config.js';
import { showToast } from './toast.js';

// DCN Request page helper functions
function openNewDCNModal() {
    showToast('New DCN Request modal - to be implemented', 'info');
}

function openSearchModal() {
    showToast('Advanced Search modal - to be implemented', 'info');
}

function clearFilters() {
    // Future: hook filter inputs if added
}

// --- Autocomplete for Requestor Name ---
let allUsers = [];
let autocompleteDropdown = null;

async function fetchAllUsers() {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, full_name, department')
            .order('full_name', { ascending: true });
        
        if (error) throw error;
        allUsers = data || [];
    } catch (err) {
        console.error('Error fetching users:', err);
    }
}

function createAutocompleteDropdown() {
    const dropdown = document.createElement('div');
    dropdown.className = 'autocomplete-dropdown';
    dropdown.style.cssText = `
        position: absolute;
        background: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        max-height: 200px;
        overflow-y: auto;
        z-index: 1000;
        display: none;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    `;
    document.body.appendChild(dropdown);
    return dropdown;
}

function showAutocompleteDropdown(input, matches) {
    if (!autocompleteDropdown) {
        autocompleteDropdown = createAutocompleteDropdown();
    }
    
    if (matches.length === 0) {
        autocompleteDropdown.style.display = 'none';
        return;
    }
    
    const rect = input.getBoundingClientRect();
    autocompleteDropdown.style.left = rect.left + 'px';
    autocompleteDropdown.style.top = (rect.bottom + 5) + 'px';
    autocompleteDropdown.style.width = rect.width + 'px';
    
    autocompleteDropdown.innerHTML = matches
        .slice(0, 10)
        .map((user, idx) => `
            <div class="autocomplete-item" data-idx="${idx}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #eee; font-size: 0.9rem;">
                <strong>${user.full_name}</strong><br/>
                <small style="color: #666;">${user.department || 'N/A'}</small>
            </div>
        `)
        .join('');
    
    autocompleteDropdown.style.display = 'block';
    
    autocompleteDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
            const idx = parseInt(item.getAttribute('data-idx'));
            const selected = matches[idx];
            input.value = selected.full_name;
            document.getElementById('requestor_dept').value = selected.department || '';
            autocompleteDropdown.style.display = 'none';
        });
    });
}

function initRequestorNameAutocomplete() {
    const input = document.getElementById('requestor_name');
    if (!input) return;
    
    input.addEventListener('input', (e) => {
        const value = e.target.value.toLowerCase().trim();
        
        if (value.length === 0) {
            if (autocompleteDropdown) autocompleteDropdown.style.display = 'none';
            return;
        }
        
        const matches = allUsers.filter(user => 
            user.full_name.toLowerCase().includes(value)
        );
        
        showAutocompleteDropdown(input, matches);
    });
    
    input.addEventListener('blur', () => {
        setTimeout(() => {
            if (autocompleteDropdown) autocompleteDropdown.style.display = 'none';
        }, 200);
    });
}

function initReviewParticipantsAutocomplete() {
    const table = document.getElementById('reviewParticipantsTable');
    if (!table) return;
    
    // Get all name cells (second column, contenteditable)
    const nameCells = table.querySelectorAll('tbody tr td:nth-child(2)[contenteditable]');
    
    nameCells.forEach(cell => {
        cell.addEventListener('input', function(e) {
            const value = this.textContent.toLowerCase().trim();
            
            if (value.length === 0) {
                hideReviewParticipantsDropdown();
                return;
            }
            
            const matches = allUsers.filter(user => 
                user.full_name.toLowerCase().includes(value)
            );
            
            showReviewParticipantsDropdown(this, matches);
        });
        
        cell.addEventListener('blur', () => {
            setTimeout(() => {
                hideReviewParticipantsDropdown();
            }, 200);
        });
        
        // Handle keyboard selection from dropdown
        cell.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                // Could add arrow key navigation here in future
            }
        });
    });
}

let reviewParticipantsDropdown = null;

function createReviewParticipantsDropdown() {
    const dropdown = document.createElement('div');
    dropdown.className = 'review-participants-autocomplete';
    dropdown.style.cssText = `
        position: fixed;
        background: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        max-height: 250px;
        overflow-y: auto;
        z-index: 2000;
        display: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        min-width: 300px;
    `;
    document.body.appendChild(dropdown);
    return dropdown;
}

function showReviewParticipantsDropdown(cell, matches) {
    if (!reviewParticipantsDropdown) {
        reviewParticipantsDropdown = createReviewParticipantsDropdown();
    }
    
    if (matches.length === 0) {
        reviewParticipantsDropdown.style.display = 'none';
        return;
    }
    
    const rect = cell.getBoundingClientRect();
    reviewParticipantsDropdown.style.left = rect.left + 'px';
    reviewParticipantsDropdown.style.top = (rect.bottom + 5) + 'px';
    reviewParticipantsDropdown.style.width = rect.width + 'px';
    
    reviewParticipantsDropdown.innerHTML = matches
        .slice(0, 10)
        .map((user, idx) => `
            <div class="review-participants-item" data-idx="${idx}" data-name="${user.full_name}" style="padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #eee; font-size: 0.9rem; hover: background: #f5f5f5;">
                <strong>${user.full_name}</strong><br/>
                <small style="color: #666;">${user.department || 'N/A'}</small>
            </div>
        `)
        .join('');
    
    reviewParticipantsDropdown.style.display = 'block';
    
    // Add click handlers to dropdown items
    reviewParticipantsDropdown.querySelectorAll('.review-participants-item').forEach(item => {
        item.addEventListener('click', () => {
            const name = item.getAttribute('data-name');
            cell.textContent = name;
            reviewParticipantsDropdown.style.display = 'none';
        });
        
        item.addEventListener('mouseenter', () => {
            item.style.background = '#f5f5f5';
        });
        
        item.addEventListener('mouseleave', () => {
            item.style.background = 'transparent';
        });
    });
}

function hideReviewParticipantsDropdown() {
    if (reviewParticipantsDropdown) {
        reviewParticipantsDropdown.style.display = 'none';
    }
}

// NOTE: initialization is handled in the main DOMContentLoaded block at the end of this file.

// --- Affected Documents table helpers (moved from inline HTML) ---
function addAffectedRow(){
    const tbody = document.querySelector('#affectedDocsTable tbody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td contenteditable="true" style="text-align:center;">&nbsp;</td>
        <td contenteditable="true">&nbsp;</td>
    `;
    tbody.appendChild(tr);
    attachAffectedRowFormattingListeners(tr);
}

function deleteAffectedRow(){
    const tbody = document.querySelector('#affectedDocsTable tbody');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr');
    if (rows.length > 0){
        rows[rows.length - 1].remove();
    }
}

function attachAffectedRowFormattingListeners(row){
    const cells = row.querySelectorAll('td[contenteditable]');
    cells.forEach(cell => {
        cell.addEventListener('mouseup', showFormattingToolbar);
        cell.addEventListener('keyup', showFormattingToolbar);
    });
}

function initAffectedDocsTable(){
    const tbody = document.querySelector('#affectedDocsTable tbody');
    if (!tbody) return;
    // Create 1 initial row
    for (let i = 0; i < 1; i++){
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td contenteditable="true" style="text-align:center;">&nbsp;</td>
            <td contenteditable="true">&nbsp;</td>
        `;
        tbody.appendChild(tr);
        attachAffectedRowFormattingListeners(tr);
    }
    // Attach add row button handler
    const addBtn = document.getElementById('addAffectedRowBtn');
    if (addBtn) addBtn.addEventListener('click', function(e){
        e.preventDefault();
        addAffectedRow();
    });
    // Attach delete row button handler
    const deleteBtn = document.getElementById('deleteAffectedRowBtn');
    if (deleteBtn) deleteBtn.addEventListener('click', function(e){
        e.preventDefault();
        deleteAffectedRow();
    });
}

// --- Submit / Save bindings ---
// submit & save bindings are attached after DOM is ready to guarantee elements exist

// --- Training & Radio helpers ---
function updateTrainingVisibility() {
    const yes = document.querySelector('input[name="training_required"][value="yes"]');
    const showYes = yes && yes.checked;
    const traineesEl = document.getElementById('training-yes');
    const noEl = document.getElementById('training-no');
    if (traineesEl) traineesEl.style.display = showYes ? 'block' : 'none';
    if (noEl) noEl.style.display = showYes ? 'none' : 'block';
    const instr = document.getElementById('training-instructions');
    if (instr) instr.style.display = showYes ? 'none' : 'block';
    // Recalculate autosize for trainees when showing
    if (showYes) {
        const t = document.getElementById('trainees');
        if (t) autoSizeTextarea(t);
    }
}

function updateRadioTiles(name) {
    const radios = document.querySelectorAll(`input[name="${name}"]`);
    radios.forEach(r => {
        const label = r.closest('label');
        if (!label) return;
        if (r.checked) label.classList.add('active'); else label.classList.remove('active');
    });
}

// Equalize radio tile widths for groups: measure max width and set all to that width
function equalizeRadioWidths(groupSelector) {
    const container = document.querySelector(groupSelector);
    if (!container) return;
    const items = Array.from(container.querySelectorAll('.radio-item'));
    if (!items.length) return;
    // Reset widths
    items.forEach(it => it.style.width = 'auto');
    // compute max width
    let max = 0;
    items.forEach(it => {
        const w = Math.ceil(it.getBoundingClientRect().width);
        if (w > max) max = w;
    });
    // add a small padding to avoid clipping
    const buffer = 6;
    items.forEach(it => it.style.width = (max + buffer) + 'px');
}

function equalizeAllRadioGroups() {
    equalizeRadioWidths('.affected-group');
    equalizeRadioWidths('.training-group');
}

let radioResizeTimer = null;
window.addEventListener('resize', function () {
    clearTimeout(radioResizeTimer);
    radioResizeTimer = setTimeout(equalizeAllRadioGroups, 120);
});

// --- Autosize helper for textareas ---
function autoSizeTextarea(el) {
    if (!el) return;
    // Reset height so scrollHeight can shrink when content reduces
    el.style.setProperty('height', 'auto', 'important');
    // Use scrollHeight to set the height (adds buffer to avoid clipping)
    const desired = Math.max(el.scrollHeight, 40);
    // Use setProperty with 'important' to override generic css rules that may have !important
    el.style.setProperty('height', desired + 'px', 'important');
}

function attachAutosize(selector = '.autosize') {
    const areas = Array.from(document.querySelectorAll(selector));
    if (!areas.length) return;
    // run once and attach input listeners
    areas.forEach(el => {
        autoSizeTextarea(el);
        el.addEventListener('input', function () { autoSizeTextarea(this); });
    });

    // single debounced resize handler for all autosize elements
    const onAutosizeResize = () => {
        if (window.__dcn_autosize_timer) clearTimeout(window.__dcn_autosize_timer);
        window.__dcn_autosize_timer = setTimeout(() => {
            areas.forEach(el => autoSizeTextarea(el));
        }, 120);
    };
    // replace any previous handler to avoid duplicates
    if (window.__dcn_autosize_handler) window.removeEventListener('resize', window.__dcn_autosize_handler);
    window.__dcn_autosize_handler = onAutosizeResize;
    window.addEventListener('resize', window.__dcn_autosize_handler);
}

// --- Permissions: only HR and Administration can edit Training & Acknowledgement ---
async function enforceTrainingAndAckPermissions() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return; // not logged in: keep fields disabled by default

        const { data: profile, error } = await supabase.from('users').select('department,is_admin').eq('id', user.id).single();
        if (error) {
            console.error('Error fetching user profile for permissions', error);
            return;
        }

        const dept = (profile && profile.department) || '';
        const allowed = dept === 'Human Resource' || dept === 'Administration';

        // Training section
        const trainingRadios = document.querySelectorAll('input[name="training_required"]');
        trainingRadios.forEach(r => r.disabled = !allowed);
        const trainees = document.getElementById('trainees');
        if (trainees) trainees.disabled = !allowed;
        const trainingJustification = document.getElementById('training_justification');
        if (trainingJustification) trainingJustification.disabled = !allowed;

        // Acknowledgement section
        const ackInputs = document.querySelectorAll('#ackTable input');
        ackInputs.forEach(i => i.disabled = !allowed);
        const ackButtons = document.querySelectorAll('#ackTable button');
        ackButtons.forEach(b => b.disabled = !allowed);

        if (!allowed) {
            setSectionDisabled('Training required?', true);
            setSectionDisabled('Acknowledgement', true);
        }

        // Show/hide Upload Document button for HR and Admin users
        const uploadBtn = document.getElementById('upload-document');
        if (uploadBtn) {
            uploadBtn.style.display = allowed ? 'inline-flex' : 'none';
        }
    } catch (err) {
        console.error('Permission check failed', err);
    }
}

async function enforceReviewParticipantsPermissions() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            // Not logged in: hide section by default
            hideReviewParticipantsSection();
            hideReviewDetailsSection();
            return;
        }

        const { data: profile, error } = await supabase.from('users').select('department,is_admin').eq('id', user.id).single();
        if (error) {
            console.error('Error fetching user profile for review participants permissions', error);
            hideReviewParticipantsSection();
            hideReviewDetailsSection();
            return;
        }

        const dept = (profile && profile.department) || '';
        const isHRAdmin = dept === 'Human Resource' || dept === 'Human Resources' || dept === 'Administration' || profile.is_admin === true;

        if (!isHRAdmin) {
            hideReviewParticipantsSection();
            hideReviewDetailsSection();
        }
    } catch (err) {
        console.error('Review participants permission check failed', err);
        hideReviewParticipantsSection();
        hideReviewDetailsSection();
    }
}

function hideReviewParticipantsSection() {
    // Hide the ENTIRE second section container (maintenance-form-section with margin-top)
    const allSections = document.querySelectorAll('section.maintenance-form-section');
    if (allSections.length >= 2) {
        // Hide the second section (index 1)
        allSections[1].style.display = 'none';
    }
}

function hideReviewDetailsSection() {
    // This function is no longer needed since we're hiding the entire section above
    return;
}

// Insert a small note under matching section headers
function addPermissionNote(titleText, message) {
    const headers = Array.from(document.querySelectorAll('.dcn-details-container .section-header'));
    const header = headers.find(h => h.textContent.trim().startsWith(titleText));
    if (!header) return;
    const note = document.createElement('div');
    note.className = 'dcn-small';
    note.style.color = '#6b7280';
    note.style.marginTop = '0.4rem';
    note.textContent = message;
    header.parentElement.insertBefore(note, header.nextSibling);
}

function setSectionDisabled(titleText, disabled) {
    const headers = Array.from(document.querySelectorAll('.dcn-details-container .section-header'));
    const header = headers.find(h => h.textContent.trim().startsWith(titleText));
    if (!header) return;
    const container = header.parentElement;
    if (disabled) container.classList.add('dcn-disabled');
    else container.classList.remove('dcn-disabled');
}

// --- Acknowledgement table helpers ---
function addAckRow() {
    const tbody = document.querySelector('#ackTable tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input class="dcn-input" name="ack_name[]" placeholder="Name"></td>
        <td><input class="dcn-input" name="ack_date[]" type="date"></td>
        <td><input class="dcn-input" name="ack_remarks[]" placeholder="Signature"></td>
        <td style="text-align:center"><button type="button" class="dcn-btn dcn-btn-secondary ack-clear-btn" type="button">Clear</button></td>
    `;
    tbody.appendChild(tr);
}

// Clear row inputs instead of removing the row
function clearAckRow(btn) {
    const tr = btn.closest('tr');
    if (!tr) return;
    const inputs = tr.querySelectorAll('input');
    inputs.forEach(i => {
        if (i.type === 'date') i.value = '';
        else i.value = '';
    });
}

// Acknowledgement handlers are invoked via delegated listeners; no globals

// --- Summary of Change table helpers ---
function addSummaryRow(){
    const tbody = document.querySelector('#summaryTable tbody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td contenteditable="true">&nbsp;</td>
        <td contenteditable="true" style="text-align:center;">&nbsp;</td>
        <td contenteditable="true">&nbsp;</td>
    `;
    tbody.appendChild(tr);
    attachSummaryRowEnterHandler(tr);
    attachSummaryRowFormattingListeners(tr);
    // Scroll page down to give space below the button
    setTimeout(() => {
        window.scrollBy({ top: 200, behavior: 'smooth' });
    }, 100);
}

function deleteSummaryRow(){
    const tbody = document.querySelector('#summaryTable tbody');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr');
    if (rows.length > 0){
        rows[rows.length - 1].remove();
    }
}

function attachSummaryRowFormattingListeners(row){
    const cells = row.querySelectorAll('td[contenteditable]');
    cells.forEach(cell => {
        cell.addEventListener('mouseup', showFormattingToolbar);
        cell.addEventListener('keyup', showFormattingToolbar);
    });
}

let currentEditingCell = null;
let savedSelection = null;

function showFormattingToolbar(){
    const selection = window.getSelection();
    const toolbar = document.getElementById('floatingToolbar');
    if (!toolbar) return;
    
    if (selection.toString().length > 0){
        // Store the cell being edited
        const range = selection.getRangeAt(0);
        currentEditingCell = range.commonAncestorContainer.parentElement;
        while (currentEditingCell && !currentEditingCell.hasAttribute('contenteditable')){
            currentEditingCell = currentEditingCell.parentElement;
        }
        
        // Save the selection range
        savedSelection = range.cloneRange();
        
        const rect = range.getBoundingClientRect();
        toolbar.style.left = (rect.left + rect.width / 2 - 50) + 'px';
        toolbar.style.top = (rect.top - 40) + 'px';
        toolbar.classList.add('visible');
        // Update button states (active) depending on current selection
        try{
            const underlineBtn = document.getElementById('underlineBtn');
            const strikethroughBtn = document.getElementById('strikethroughBtn');
            if (underlineBtn) {
                if (isSelectionFullyWrappedByTag(range, 'u')) underlineBtn.classList.add('active'); else underlineBtn.classList.remove('active');
            }
            if (strikethroughBtn) {
                if (isSelectionFullyWrappedByTag(range, 's')) strikethroughBtn.classList.add('active'); else strikethroughBtn.classList.remove('active');
            }
        } catch (err) { /* ignore */ }
    } else {
        toolbar.classList.remove('visible');
    }
}

function applyFormatting(command){
    if (!savedSelection) return;
    
    // Restore the selection
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedSelection);
    
    const range = selection.getRangeAt(0);
    // Convert the selected range to a document fragment so that any nested
    // HTML (including previously applied underline/strike) is preserved.
    const fragment = range.cloneContents();
    
    let wrapper;
    if (command === 'underline'){
        wrapper = document.createElement('u');
    } else if (command === 'strikethrough'){
        wrapper = document.createElement('s');
    }
    
    if (wrapper){
        // Append the cloned nodes into the wrapper. This keeps inner HTML
        // (e.g., <u>, <s>) intact rather than converting it to plain text.
        // Toggle behavior: if selection is already wrapped fully with the same tag,
        // unwrap instead of adding a nested tag. For partial selections we fallback
        // to browser execCommand which handles complex cases.
        const tagName = wrapper.tagName.toLowerCase();
        const fullyWrapped = isSelectionFullyWrappedByTag(range, tagName);
        if (fullyWrapped) {
            // Remove the tag surrounding selected nodes
            unwrapTagFromRange(range, tagName);
        } else {
            wrapper.appendChild(fragment);
            range.deleteContents();
            range.insertNode(wrapper);
        }
    }
    
    // Update savedSelection to the current selection so next toggle works
    try {
        const updatedSelection = window.getSelection();
        if (updatedSelection.rangeCount > 0) {
            savedSelection = updatedSelection.getRangeAt(0).cloneRange();
        }
    } catch (err) { /* ignore */ }
    
    // Hide toolbar
    const toolbar = document.getElementById('floatingToolbar');
    if (toolbar) toolbar.classList.remove('visible');
}

// Helper: collect text nodes intersecting range
function getTextNodesInRange(range){
    const nodes = [];
    const root = range.commonAncestorContainer.nodeType === Node.TEXT_NODE 
        ? range.commonAncestorContainer.parentElement 
        : range.commonAncestorContainer;
    
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while(node = walker.nextNode()){
        if (range.intersectsNode(node) && node.textContent.trim().length > 0){
            nodes.push(node);
        }
    }
    return nodes;
}

// Helper: true if all selected text nodes are contained within an ancestor with tagName
function isSelectionFullyWrappedByTag(range, tagName){
    try{
        const textNodes = getTextNodesInRange(range);
        if (!textNodes.length) return false;
        for (const t of textNodes){
            let el = t.parentElement;
            let found = false;
            while (el){
                if (el.tagName && el.tagName.toLowerCase() === tagName){ found = true; break; }
                el = el.parentElement;
            }
            if (!found) return false;
        }
        return true;
    } catch (err) {
        console.error('isSelectionFullyWrappedByTag error', err);
        return false;
    }
}

// Helper: Unwrap tag elements encountered in selection
function unwrapTagFromRange(range, tagName){
    const textNodes = getTextNodesInRange(range);
    const seen = new Set();
    for (let i = 0; i < textNodes.length; i++){
        const node = textNodes[i];
        let el = node.parentElement;
        while (el && el.tagName && el.tagName.toLowerCase() !== tagName) el = el.parentElement;
        if (el && !seen.has(el)){
            seen.add(el);
            // If ancestor extends beyond the selection we cannot safely unwrap whole element
            // without splitting - in that case fallback to execCommand to toggle only the selection
            if (range.intersectsNode(el) && !isRangeContaining(range, el)){
                // Fallback to execCommand to handle partial cases
                try{ document.execCommand(tagName === 'u' ? 'underline' : 'strikeThrough'); } catch(e){}
                return; // stop processing further nodes
            }
            // Otherwise unwrap the element fully
            const parent = el.parentNode;
            while (el.firstChild) parent.insertBefore(el.firstChild, el);
            parent.removeChild(el);
        }
    }
    
    // After unwrapping, restore the selection so subsequent operations work
    try {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    } catch (err) { /* ignore */ }
}

// Helper: returns true if element is fully contained within range
function isRangeContaining(range, el){
    try{
        const elRange = document.createRange();
        elRange.selectNodeContents(el);
        return range.compareBoundaryPoints(Range.START_TO_START, elRange) <= 0 &&
               range.compareBoundaryPoints(Range.END_TO_END, elRange) >= 0;
    } catch (err){
        return false;
    }
}

function attachSummaryRowEnterHandler(row){
    const cells = row.querySelectorAll('td[contenteditable]');
    cells.forEach((cell, cellIndex) => {
        cell.addEventListener('keydown', function(e){
            if (e.key === 'Enter'){
                e.preventDefault();
                const nextRow = row.nextElementSibling;
                if (nextRow){
                    const nextCells = nextRow.querySelectorAll('td[contenteditable]');
                    if (nextCells[cellIndex]) nextCells[cellIndex].focus();
                } else {
                    // Add new row and move to same column in the new row
                    addSummaryRow();
                    const tbody = document.querySelector('#summaryTable tbody');
                    const newRow = tbody.lastElementChild;
                    const newCells = newRow.querySelectorAll('td[contenteditable]');
                    if (newCells[cellIndex]) newCells[cellIndex].focus();
                }
            }
        });
    });
}

function initSummaryTable(){
    const tbody = document.querySelector('#summaryTable tbody');
    if (!tbody) return;
    // Create 8 initial rows
    for (let i = 0; i < 8; i++){
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td contenteditable="true" style="text-align:center;">&nbsp;</td>
            <td contenteditable="true" style="text-align:center;">&nbsp;</td>
            <td contenteditable="true">&nbsp;</td>
        `;
        tbody.appendChild(tr);
        attachSummaryRowEnterHandler(tr);
        attachSummaryRowFormattingListeners(tr);
    }
    // Attach add row button handler
    const addBtn = document.getElementById('addSummaryRowBtn');
    if (addBtn) addBtn.addEventListener('click', function(e){
        e.preventDefault();
        addSummaryRow();
    });
    // Attach delete row button handler
    const deleteBtn = document.getElementById('deleteSummaryRowBtn');
    if (deleteBtn) deleteBtn.addEventListener('click', function(e){
        e.preventDefault();
        deleteSummaryRow();
    });
    // Attach formatting toolbar button handlers
    const underlineBtn = document.getElementById('underlineBtn');
    const strikethroughBtn = document.getElementById('strikethroughBtn');
    const toolbar = document.getElementById('floatingToolbar');
    
    if (underlineBtn) underlineBtn.addEventListener('mousedown', function(e){
        e.preventDefault();
        e.stopPropagation();
        applyFormatting('underline');
    });
    if (strikethroughBtn) strikethroughBtn.addEventListener('mousedown', function(e){
        e.preventDefault();
        e.stopPropagation();
        applyFormatting('strikethrough');
    });
    
    // Prevent toolbar from triggering document mousedown hide
    if (toolbar) toolbar.addEventListener('mousedown', function(e){
        e.stopPropagation();
    });
    
    // Hide toolbar when clicking elsewhere
    document.addEventListener('mousedown', function(e){
        const toolbar = document.getElementById('floatingToolbar');
        if (toolbar && !toolbar.contains(e.target)) {
            toolbar.classList.remove('visible');
        }
    });
}

// Acknowledgement handlers are invoked via delegated listeners; no globals

// Modal message helper function for success/error notifications
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

            // Disable background interactions while modal is shown
            const body = document.body;
            const originalOverflow = body.style.overflow;
            const originalPointerEvents = body.style.pointerEvents;

            body.style.overflow = 'hidden'; // Prevent scrolling
            body.style.pointerEvents = 'none'; // Disable all interactions
            modal.style.pointerEvents = 'auto'; // Re-enable modal interactions

            // Show modal
            modal.style.display = 'flex';

            const handleOk = () => {
                // Hide modal and restore original button states
                modal.style.display = 'none';
                confirmBtn.removeEventListener('click', handleOk);

                // Restore background interactions
                body.style.overflow = originalOverflow;
                body.style.pointerEvents = originalPointerEvents;

                // restore modal button states
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

// Button loading state helper functions
function setButtonLoading(button, loading = true, originalText = null) {
    if (!button) return;

    if (loading) {
        // Store original text if not already stored
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.textContent;
        }

        button.disabled = true;
        button.innerHTML = `
            <svg class="animate-spin" style="width:16px; height:16px; margin-right:8px; display:inline;" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
        `;
        button.style.opacity = '0.8';
    } else {
        button.disabled = false;
        button.textContent = button.dataset.originalText || originalText || 'Submit';
        button.style.opacity = '1';
        delete button.dataset.originalText;
    }
}

function resetAllButtons() {
    const buttons = document.querySelectorAll('#submit-dcn, #save-draft, #upload-document');
    buttons.forEach(btn => setButtonLoading(btn, false));
}

document.addEventListener('DOMContentLoaded', async function() {
    attachAutosize();
    updateTrainingVisibility();
    updateRadioTiles('affected');
    updateRadioTiles('training_required');
    equalizeAllRadioGroups();
    // enforce permissions for Training and Acknowledgement sections
    enforceTrainingAndAckPermissions();
    // Check user department and hide Document Review Participants if not HR/Admin
    await enforceReviewParticipantsPermissions();
    // Initialize tables
    initAffectedDocsTable();
    initSummaryTable();
    
    // Fetch all users and initialize autocomplete
    await fetchAllUsers();
    initRequestorNameAutocomplete();
    initReviewParticipantsAutocomplete();

        // Delegated click handling for acknowledgement table (clear/add)
        const ackTable = document.getElementById('ackTable');
        if (ackTable) {
            ackTable.addEventListener('click', function (e) {
                const btn = e.target.closest('button');
                if (!btn) return;
                if (btn.classList.contains('ack-clear-btn')) {
                    clearAckRow(btn);
                }
            });
        }
    // keep radio tile checkbox state in sync on change
    document.querySelectorAll('input[type="radio"]').forEach(r => r.addEventListener('change', function(e) {
        if (this.name) updateRadioTiles(this.name);
    }));
    // training radio toggles 'Trainees' visibility
    document.querySelectorAll('input[name="training_required"]').forEach(r => r.addEventListener('change', updateTrainingVisibility));
    // --- Supabase submission handlers ---
    const submitBtn = document.getElementById('submit-dcn');
    if (submitBtn) submitBtn.addEventListener('click', async function(e){
        e.preventDefault();
        setButtonLoading(submitBtn, true);
        try {
            await submitDCNForm('Draft');  // DCC owner saves as Draft by default
        } finally {
            setButtonLoading(submitBtn, false);
        }
    });

    const saveDraft = document.getElementById('save-draft');
    if (saveDraft) saveDraft.addEventListener('click', async function(e){
        e.preventDefault();
        setButtonLoading(saveDraft, true);
        try {
            await submitDCNForm('Draft');
        } finally {
            setButtonLoading(saveDraft, false);
        }
    });

    const uploadDocument = document.getElementById('upload-document');
    if (uploadDocument) uploadDocument.addEventListener('click', async function(e){
        e.preventDefault();
        setButtonLoading(uploadDocument, true);
        try {
            await handleDocumentUpload();
        } finally {
            setButtonLoading(uploadDocument, false);
        }
    });

    // Load draft data if editing
    const urlParams = new URLSearchParams(window.location.search);
    const dcnId = urlParams.get('id');
    const action = urlParams.get('action');
    if (dcnId && (action === 'edit' || action === 'view')) {
        loadDCNData(dcnId, action === 'view');
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
        uploadConfirmBtn.addEventListener('click', confirmUploadDocument);
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

// --- Supabase Integration ---
async function loadDCNData(dcnId, isViewOnly = false) {
    try {
        const { data, error } = await supabase
            .from('dcc_master_table')
            .select('*')
            .eq('id', dcnId)
            .single();

        if (error || !data) {
            console.error('Error loading DCN:', error);
            await showModalMessage('Could not load DCN. Please try again.');
            return;
        }

        // Populate basic fields
        document.getElementById('dcn_no').value = data.dcn_no || '';
        document.getElementById('issued_date').value = data.issued_date || '';
        document.getElementById('document_title').value = data.document_title || '';
        document.getElementById('document_no').value = data.document_no || '';
        document.getElementById('custodian').value = data.custodian || '';
        document.getElementById('requestor_name').value = data.requestor_name || '';
        document.getElementById('requestor_dept').value = data.requestor_dept || '';

        // Restore purpose checkboxes
        if (data.purpose && Array.isArray(data.purpose)) {
            if (data.purpose.includes('New Establishment')) document.getElementById('purpose_new').checked = true;
            if (data.purpose.includes('Revision')) document.getElementById('purpose_revision').checked = true;
            if (data.purpose.includes('Obsolescence')) document.getElementById('purpose_obsolete').checked = true;
        }

        // Restore document types checkboxes
        if (data.document_types && Array.isArray(data.document_types)) {
            document.querySelectorAll('input[name="doc_type"]').forEach(cb => {
                cb.checked = data.document_types.includes(cb.value);
            });
        }

        // Restore affected documents
        if (data.affected_documents && Array.isArray(data.affected_documents)) {
            const tbody = document.querySelector('#affectedDocsTable tbody');
            tbody.innerHTML = ''; // Clear existing rows
            data.affected_documents.forEach(doc => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td contenteditable="true" style="text-align:center;">${doc.doc_no || ''}</td>
                    <td contenteditable="true">${doc.doc_title || ''}</td>
                `;
                tbody.appendChild(tr);
                attachAffectedRowFormattingListeners(tr);
            });
        }

        // Restore affected docs radio
        if (data.has_affected_docs !== null && data.has_affected_docs !== undefined) {
            document.querySelector(`input[name="affected"][value="${data.has_affected_docs ? 'yes' : 'no'}"]`).checked = true;
        }

        // Restore reason section
        if (data.reason && typeof data.reason === 'object') {
            if (data.reason.types && Array.isArray(data.reason.types)) {
                document.querySelectorAll('input[name="reason"]').forEach(cb => {
                    cb.checked = data.reason.types.includes(cb.value);
                });
            }
            if (data.reason.details) {
                document.getElementById('reason_details').value = data.reason.details;
            }
        }

        // Restore training section
        if (data.training && typeof data.training === 'object') {
            const trainingRequired = data.training.required === true || data.training.required === 'true';
            document.querySelector(`input[name="training_required"][value="${trainingRequired ? 'yes' : 'no'}"]`).checked = true;
            
            if (trainingRequired && data.training.trainees && Array.isArray(data.training.trainees)) {
                document.getElementById('trainees').value = data.training.trainees.join(', ');
            } else if (!trainingRequired && data.training.justification) {
                document.getElementById('training_justification').value = data.training.justification;
            }
        }

        // Restore acknowledgements
        if (data.acknowledgements) {
            let ackArray = data.acknowledgements;
            if (typeof ackArray === 'string') {
                try { ackArray = JSON.parse(ackArray); } catch (err) { ackArray = []; }
            }
            if (Array.isArray(ackArray)) {
                const tbody = document.querySelector('#ackTable tbody');
                tbody.innerHTML = ''; // Clear existing rows
                ackArray.forEach(ack => {
                    const nameVal = ack.name || ack.ack_name || ack.name_value || '';
                    const dateVal = ack.date || ack.ack_date || ack.date_value || '';
                    const signatureVal = ack.signature || ack.ack_remarks || ack.remarks || '';

                    const formattedDate = (function(d) {
                        if (!d) return '';
                        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
                        const parsed = new Date(d);
                        if (!isNaN(parsed)) {
                            const mm = String(parsed.getMonth()+1).padStart(2,'0');
                            const dd = String(parsed.getDate()).padStart(2,'0');
                            return `${parsed.getFullYear()}-${mm}-${dd}`;
                        }
                        return d;
                    })(dateVal);
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><input class="dcn-input" name="ack_name[]" placeholder="Name" value="${nameVal}" ${isViewOnly ? 'readonly' : ''}></td>
                        <td><input class="dcn-input" name="ack_date[]" type="date" value="${formattedDate}" ${isViewOnly ? 'readonly' : ''}></td>
                        <td><input class="dcn-input" name="ack_remarks[]" placeholder="Signature" value="${signatureVal}" ${isViewOnly ? 'readonly' : ''}></td>
                        <td style="text-align:center"><button type="button" class="dcn-btn dcn-btn-secondary ack-clear-btn" ${isViewOnly ? 'disabled' : ''}>Clear</button></td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }

        // Restore summary of changes
        if (data.summary_of_changes && Array.isArray(data.summary_of_changes)) {
            const tbody = document.querySelector('#summaryTable tbody');
            tbody.innerHTML = ''; // Clear existing rows
            data.summary_of_changes.forEach(change => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td contenteditable="${!isViewOnly}" style="text-align:center;">${change.clause || ''}</td>
                    <td contenteditable="${!isViewOnly}" style="text-align:center;">${change.type || ''}</td>
                    <td contenteditable="${!isViewOnly}">${change.amended_text || ''}</td>
                `;
                tbody.appendChild(tr);
                if (!isViewOnly) {
                    attachSummaryRowEnterHandler(tr);
                    attachSummaryRowFormattingListeners(tr);
                }
            });
        }

        // Restore review participants (3 fixed rows)
        if (data.review_participants) {
            const tbody = document.querySelector('#reviewParticipantsTable tbody');
            const rows = tbody.querySelectorAll('tr');
            
            // Handle both array and object formats
            let participantsArray = [];
            if (Array.isArray(data.review_participants)) {
                participantsArray = data.review_participants;
            } else if (typeof data.review_participants === 'object') {
                // Convert object format to array for dcn-form table
                const departments = ['QMR', 'PU', 'AD/GA', 'HR', 'PD/PC', 'WH', 'SA', 'MT/IT', 'QC', 'FN', 'QA', 'DCC'];
                departments.forEach(dept => {
                    if (data.review_participants[dept]) {
                        participantsArray.push({
                            department: dept,
                            name: data.review_participants[dept].name || '',
                            user_id: data.review_participants[dept].user_id || null
                        });
                    }
                });
            }
            
            // Populate the existing rows with data
            participantsArray.forEach((participant, idx) => {
                if (idx < rows.length) {
                    const cells = rows[idx].querySelectorAll('td');
                    if (cells.length >= 2) {
                        cells[1].innerHTML = participant.name || '';
                    }
                }
            });
        }

        // Populate second container fields (Effective Date, Revision No, Review Date, Purpose of Review)
        if (data.effective_date) {
            document.getElementById('effective_date_dcn').value = data.effective_date;
        }
        if (data.revision_no) {
            document.getElementById('revision_no_dcn').value = data.revision_no;
        }
        if (data.review_date) {
            document.getElementById('review_date_dcn').value = data.review_date;
        }

        // Restore purpose_of_review checkboxes
        if (data.purpose_of_review && Array.isArray(data.purpose_of_review)) {
            if (data.purpose_of_review.includes('New Establishment of a Document')) {
                document.getElementById('purpose_dcn_new_doc').checked = true;
            }
            if (data.purpose_of_review.includes('Amendment on the Form (OPL, PPT)')) {
                document.getElementById('purpose_dcn_amendment_form').checked = true;
            }
            if (data.purpose_of_review.includes('Amendment on the Content')) {
                document.getElementById('purpose_dcn_amendment_content').checked = true;
            }
            if (data.purpose_of_review.includes('Obsolescence of a Document')) {
                document.getElementById('purpose_dcn_obsolescence').checked = true;
            }
            if (data.purpose_of_review.includes('Review (Annual/ Validation/ SOP Review)')) {
                document.getElementById('purpose_dcn_review_annual').checked = true;
            }
        }

        // Update radio tile visual states
        updateRadioTiles('affected');
        updateRadioTiles('training_required');
        updateTrainingVisibility();
        autoSizeTextarea(document.getElementById('trainees'));

        // If view-only mode, disable all form inputs
        if (isViewOnly) {
            disableAllFormFields();
        }

        console.log('DCN data loaded successfully');
    } catch (err) {
        console.error('Error in loadDCNData:', err);
        await showModalMessage('Error loading DCN data.');
    }
}

function disableAllFormFields() {
    // Use a CSS class on the form container to make the form view-only.
    // This avoids setting `disabled` (which triggers browser-native greyed styling)
    // and avoids inline opacity styling which is harder to override.
    const container = document.querySelector('.dcn-container') || document.body;
    container.classList.add('view-only');

    // Hide action buttons (Submit, Save as Draft, Upload Document)
    const submit = document.querySelector('.dcn-container #submit-dcn');
    const save = document.querySelector('.dcn-container #save-draft');
    const upload = document.querySelector('.dcn-container #upload-document');
    if (submit) {
        submit.style.display = 'none';
        submit.setAttribute('aria-hidden', 'true');
    }
    if (save) {
        save.style.display = 'none';
        save.setAttribute('aria-hidden', 'true');
    }
    if (upload) {
        upload.style.display = 'none';
        upload.setAttribute('aria-hidden', 'true');
    }

    // Make inputs/read-only where possible without using `disabled` so appearance stays normal
    document.querySelectorAll('.dcn-container input, .dcn-container textarea, .dcn-container select, .dcn-container button').forEach(field => {
        if (field.classList.contains('header-back-button')) return;
        
        // Set ARIA attributes to indicate read-only state
        field.setAttribute('aria-readonly', 'true');
        field.setAttribute('tabindex', '-1');
        
        // For text-like inputs use readonly to preserve look; for checkboxes/radios remove focus/tab stops
        if (field.tagName === 'INPUT' && (field.type === 'checkbox' || field.type === 'radio')) {
            // keep checked state but prevent changes by absorbing events via container class
        } else if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA' || field.tagName === 'SELECT') {
            try { field.readOnly = true; } catch(e) {}
        }
    });

    // For contenteditable cells, set attribute but do NOT apply inline opacity
    document.querySelectorAll('.dcn-container [contenteditable]').forEach(el => {
        el.setAttribute('contenteditable', 'false');
        el.setAttribute('aria-readonly', 'true');
    });

    // Prevent pointer interactions inside the view-only container (scoped via CSS class).
    // We also add a capturing event listener that prevents changes as a fallback.
    const stopHandler = function(e) {
        const target = e.target;
        if (!container.contains(target)) return;
        // Allow clicking the header-back-button
        if (target.closest('.header-back-button')) return;
        // Prevent modifications
        if (['INPUT','TEXTAREA','SELECT','BUTTON'].includes(target.tagName)) {
            e.stopImmediatePropagation();
            e.preventDefault();
        }
    };
    // Remove existing to avoid duplicates
    container.removeEventListener('click', stopHandler, true);
    container.addEventListener('click', stopHandler, true);
}

async function collectFormData() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            await showModalMessage('You must be logged in to submit a DCN.');
            window.location.href = '../html/auth.html';
            return null;
        }

        // Collect Purpose checkboxes
        const purpose = [];
        if (document.getElementById('purpose_new').checked) purpose.push('New Establishment');
        if (document.getElementById('purpose_revision').checked) purpose.push('Revision');
        if (document.getElementById('purpose_obsolete').checked) purpose.push('Obsolescence');

        // Collect Document Type checkboxes
        const documentTypes = [];
        document.querySelectorAll('input[name="doc_type"]:checked').forEach(cb => {
            documentTypes.push(cb.value);
        });

        // Collect Affected Documents table
        const affectedDocs = [];
        document.querySelectorAll('#affectedDocsTable tbody tr').forEach(row => {
            const cells = row.querySelectorAll('td[contenteditable]');
            if (cells.length >= 2) {
                const docNo = cells[0].innerHTML.trim();
                    const docTitle = cells[1].innerHTML.trim();
                if (docNo || docTitle) {
                    affectedDocs.push({ doc_no: docNo, doc_title: docTitle });
                }
            }
        });

        // Collect Reason checkboxes
        const reasonTypes = [];
        document.querySelectorAll('input[name="reason"]:checked').forEach(cb => {
            reasonTypes.push(cb.value);
        });
        const reasonDetails = document.getElementById('reason_details').value.trim();

        // Collect Training data
        const trainingRequired = document.querySelector('input[name="training_required"]:checked')?.value === 'yes';
        let trainees = [];
        let trainingJustification = '';
        
        if (trainingRequired) {
            const traineesText = document.getElementById('trainees').value.trim();
            trainees = traineesText.split(',').map(t => t.trim()).filter(t => t);
        } else {
            trainingJustification = document.getElementById('training_justification').value.trim();
        }

        // Collect Acknowledgements table
        const acknowledgements = [];
        document.querySelectorAll('#ackTable tbody tr').forEach(row => {
            const cells = row.querySelectorAll('input');
            if (cells.length >= 3) {
                const name = cells[0].value.trim();
                const date = cells[1].value.trim() || null;
                const signature = cells[2].value.trim();
                if (name || date || signature) {
                    acknowledgements.push({ name, date, signature });
                }
            }
        });

        // Collect Summary of Change table
        const summaryOfChanges = [];
        document.querySelectorAll('#summaryTable tbody tr').forEach(row => {
            const cells = row.querySelectorAll('td[contenteditable]');
            if (cells.length >= 3) {
                const clause = cells[0].innerHTML.trim();
                const type = cells[1].innerHTML.trim();
                const amendedText = cells[2].innerHTML.trim();
                if (clause || type || amendedText) {
                    summaryOfChanges.push({ clause, type, amended_text: amendedText });
                }
            }
        });

        // Collect Document Review Participants table (12 fixed rows with UUID)
        const reviewParticipants = [];
        document.querySelectorAll('#reviewParticipantsTable tbody tr').forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
                const department = cells[0].innerHTML.trim();
                const name = cells[1].innerHTML.trim();
                if (department) {
                    // Find user UUID by matching full_name (case-insensitive and trimmed)
                    const user = allUsers.find(u => 
                        u.full_name && u.full_name.trim().toLowerCase() === name.toLowerCase()
                    );
                    reviewParticipants.push({ 
                        department, 
                        name,
                        user_id: user ? user.id : null
                    });
                }
            }
        });

        // Collect simple input fields
        const dcnNo = document.getElementById('dcn_no').value.trim();
        const issuedDate = document.getElementById('issued_date').value;
        const effectiveDate = document.getElementById('effective_date_dcn')?.value || null;
        const revisionNo = document.getElementById('revision_no_dcn')?.value || null;
        const reviewDate = document.getElementById('review_date_dcn')?.value || null;
        const documentTitle = document.getElementById('document_title').value.trim();
        const documentNo = document.getElementById('document_no').value.trim();
        const custodian = document.getElementById('custodian').value.trim();
        const requestorName = document.getElementById('requestor_name').value.trim();
        const requestorDept = document.getElementById('requestor_dept').value.trim();
        const hasAffectedDocs = document.querySelector('input[name="affected"]:checked')?.value === 'yes' || false;

        // Collect Purpose of Review checkboxes from DCN form
        const purposeOfReview = [];
        if (document.getElementById('purpose_dcn_new_doc')?.checked) purposeOfReview.push('New Establishment of a Document');
        if (document.getElementById('purpose_dcn_amendment_form')?.checked) purposeOfReview.push('Amendment on the Form (OPL, PPT)');
        if (document.getElementById('purpose_dcn_amendment_content')?.checked) purposeOfReview.push('Amendment on the Content');
        if (document.getElementById('purpose_dcn_obsolescence')?.checked) purposeOfReview.push('Obsolescence of a Document');
        if (document.getElementById('purpose_dcn_review_annual')?.checked) purposeOfReview.push('Review (Annual/ Validation/ SOP Review)');

        const formData = {
            dcn_no: dcnNo || `DCN-${Date.now()}`,
            issued_date: issuedDate,
            effective_date: effectiveDate,
            revision_no: revisionNo,
            review_date: reviewDate,
            purpose_of_review: purposeOfReview.length > 0 ? purposeOfReview : null,
            document_title: documentTitle,
            document_no: documentNo,
            custodian: custodian,
            requestor_name: requestorName,
            requestor_dept: requestorDept,
            purpose: purpose.length > 0 ? purpose : null,
            document_types: documentTypes.length > 0 ? documentTypes : null,
            affected_documents: affectedDocs.length > 0 ? affectedDocs : null,
            has_affected_docs: hasAffectedDocs,
            reason: {
                types: reasonTypes,
                details: reasonDetails
            },
            training_required: trainingRequired,
            training: {
                required: trainingRequired,
                trainees: trainees,
                justification: trainingJustification
            },
            acknowledgements: acknowledgements.length > 0 ? acknowledgements : null,
            review_participants: reviewParticipants.length > 0 ? reviewParticipants : null,
            summary_of_changes: summaryOfChanges.length > 0 ? summaryOfChanges : null,
            created_by: user.id
        };

        return formData;
    } catch (err) {
        console.error('Error collecting form data:', err);
        await showModalMessage('Error preparing form data. Please check console.');
        return null;
    }
}

async function submitDCNForm(status) {
    try {
        const formData = await collectFormData();
        if (!formData) return;

        // Get current user for updated_by
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            throw new Error('User not logged in');
        }
        formData.updated_by = user.id;

        // Check if DCN already exists (update draft) or create new
        const { data: existing, error: checkError } = await supabase
            .from('dcc_master_table')
            .select('id, created_by, status')
            .eq('dcn_no', formData.dcn_no)
            .maybeSingle(); // Use maybeSingle() instead of single() to avoid error when no record exists

        // Check if current user is HR/Admin
        const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('department,is_admin')
            .eq('id', user.id)
            .single();
        
        const isHRAdmin = userProfile && 
            (userProfile.department === 'Human Resource' || 
             userProfile.department === 'Human Resources' || 
             userProfile.department === 'Administration' || 
             userProfile.is_admin === true);

        let result;
        if (existing && !checkError) {
            // Update existing - PRESERVE original creator and status if HR/Admin is updating
            formData.created_by = existing.created_by; // Keep original creator
            
            // For HR/Admin updating existing DCN: preserve the current status
            // For non-admin: use the provided status
            if (isHRAdmin) {
                formData.status = existing.status; // Preserve current status
            } else {
                formData.status = status; // Non-admin cannot change status on update
            }
            
            result = await supabase
                .from('dcc_master_table')
                .update(formData)
                .eq('dcn_no', formData.dcn_no);
        } else {
            // Insert new - set status as provided
            formData.status = status;
            result = await supabase
                .from('dcc_master_table')
                .insert([formData]);
        }

        if (result.error) {
            throw result.error;
        }

        await showModalMessage(`DCN ${status === 'Draft' ? 'saved as draft' : 'submitted'} successfully!`);
        window.location.href = '../html/dcn-list.html';
    } catch (err) {
        console.error('Error submitting DCN:', err);
        await showModalMessage(`Error ${status === 'Draft' ? 'saving' : 'submitting'} DCN: ${err.message}`);
    }
}

async function handleDocumentUpload() {
    try {
        // Get DCN number for the modal
        const dcnNo = document.getElementById('dcn_no').value.trim() || `DCN-${Date.now()}`;
        
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
        // Clear status message
        document.getElementById('uploadStatusMessage').style.display = 'none';
        fileInfo.innerHTML = `
            <svg style="width:32px; height:32px; margin:0 auto 0.5rem; color:#9ca3af;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <p style="font-weight:500; margin-bottom:0.25rem; font-size:0.85rem;">Choose a file or drag it here</p>
            <p style="font-size:0.7rem;">Maximum file size: 30MB</p>
        `;

        // Handle file selection
        const handleFileSelect = (file) => {
            if (!file) return;

            // Validate file size (max 30MB)
            const maxSize = 30 * 1024 * 1024;
            if (file.size > maxSize) {
                showToast('File size exceeds 30MB limit.', 'error');
                return;
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
}

// Handle upload confirmation
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
        // Show initial uploading status
        showUploadStatus(`Uploading Document ....... 0%`, false);

        // First, get existing files for this DCN to replace (if any)
        const prefix = `${decodeURIComponent(dcnNo)}_`;
        const { data: files, error: listError } = await supabase.storage.from('dcn-documents').list('', { limit: 1000 });
        if (listError) throw listError;

        // Filter files by prefix
        const existingFiles = (files || []).filter(f => f.name && f.name.startsWith(prefix));

        // Delete existing files for this DCN (if any exist)
        for (const existingFile of existingFiles) {
            const { error: deleteError } = await supabase.storage.from('dcn-documents').remove([existingFile.name]);
            if (deleteError) {
                console.warn('Warning: Could not delete existing file:', existingFile.name, deleteError);
            }
        }

        // Upload new file with timestamp
        const timestamp = Date.now();
        const uploadFilename = `${decodeURIComponent(dcnNo)}_${timestamp}_${file.name}`;

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
            xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
            xhr.send(file);
        });

        // Show success after a brief delay
        setTimeout(() => {
            showUploadStatus('Document uploaded successfully!', true);
        }, 500);

        // Close modal after a short delay to show success message
        setTimeout(() => {
            document.getElementById('uploadDocModal').style.display = 'none';
            delete window.selectedUploadFile;
            delete window.currentUploadDCN;
        }, 2500);

    } catch (err) {
        console.error('Error uploading document:', err);
        // Clear any running progress interval
        if (window.uploadProgressInterval) {
            clearInterval(window.uploadProgressInterval);
            delete window.uploadProgressInterval;
        }
        showUploadStatus('Failed to upload: ' + err.message, false);
    }
}
