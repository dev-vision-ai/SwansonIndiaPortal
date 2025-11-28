import { supabase } from '../supabase-config.js';

// ===== CONFIGURATION =====
const MAX_FORMS_DISPLAY = 6; // Maximum number of forms to display

// ===== IST TIMESTAMP UTILITY =====
function getISTTimestamp() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    const istTime = new Date(now.getTime() + istOffset);
    return istTime.toISOString();
}

// ===== CLOCK FUNCTIONALITY =====
let clockInterval = null;

function updateClock() {
    try {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        const timeString = `Time: ${hours}:${minutes}:${seconds}`;
        
        const timeElement = document.getElementById('currentTime');
        if (timeElement) {
            timeElement.textContent = timeString;
        }
    } catch (error) {
        console.error('Error updating clock:', error);
    }
}

function startClock() {
    try {
        // Clear existing interval if any
        if (clockInterval) {
            clearInterval(clockInterval);
        }
        
        // Update immediately
        updateClock();
        
        // Update every second
        clockInterval = setInterval(updateClock, 1000);
        intervals.add(clockInterval);
        
        // Clock started successfully
    } catch (error) {
        console.error('❌ Error starting clock:', error);
    }
}

function stopClock() {
    try {
        if (clockInterval) {
            clearInterval(clockInterval);
            clockInterval = null;
        }
        // Clock stopped successfully
    } catch (error) {
        console.error('❌ Error stopping clock:', error);
    }
}

// ===== MEMORY LEAK PREVENTION =====
// Track all intervals and timeouts for cleanup
const intervals = new Set();
const timeouts = new Set();
const eventListeners = new Map();

// Cleanup function to prevent memory leaks
function cleanupResources() {
    try {
        // Stop the clock
        stopClock();
        
        // Clear all intervals
        intervals.forEach(interval => {
            try {
                clearInterval(interval);
            } catch (e) {
                console.warn('Failed to clear interval:', e);
            }
        });
        intervals.clear();
        
        // Clear all timeouts
        timeouts.forEach(timeout => {
            try {
                clearTimeout(timeout);
            } catch (e) {
                console.warn('Failed to clear timeout:', e);
            }
        });
        timeouts.clear();
        
        // Remove all tracked event listeners
        eventListeners.forEach((listener, element) => {
            try {
                if (element && element.removeEventListener) {
                    element.removeEventListener('input', listener);
                    element.removeEventListener('change', listener);
                    element.removeEventListener('click', listener);
                    element.removeEventListener('blur', listener);
                }
            } catch (e) {
                console.warn('Failed to remove event listener:', e);
            }
        });
        eventListeners.clear();
        
        // Cleanup completed successfully
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    }
}

// Enhanced session management
let sessionCheckInterval = null;
let lastSessionCheck = Date.now();

// Session validation function
    async function validateSession() {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user) {
                window.location.replace('auth.html');
                return false;
            }
            lastSessionCheck = Date.now();
            return true;
        } catch (error) {
            console.error('Session validation error:', error);
            return false;
        }
    }

// Enhanced cleanup function that's more robust
function enhancedCleanup() {
    try {
        // Clear all intervals
        intervals.forEach(interval => {
            try {
                clearInterval(interval);
            } catch (e) {
                console.warn('Failed to clear interval:', e);
            }
        });
        intervals.clear();
        
        // Clear all timeouts
        timeouts.forEach(timeout => {
            try {
                clearTimeout(timeout);
            } catch (e) {
                console.warn('Failed to clear timeout:', e);
            }
        });
        timeouts.clear();
        
        // Remove all tracked event listeners
        eventListeners.forEach((listener, element) => {
            try {
                if (element && element.removeEventListener) {
                    element.removeEventListener('input', listener);
                    element.removeEventListener('change', listener);
                    element.removeEventListener('click', listener);
                    element.removeEventListener('blur', listener);
                }
            } catch (e) {
                console.warn('Failed to remove event listener:', e);
            }
        });
        eventListeners.clear();
        
        // Enhanced cleanup completed successfully
    } catch (error) {
        console.error('❌ Error during enhanced cleanup:', error);
    }
}

// Periodic session check
function startSessionMonitoring() {
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
    }
    
    sessionCheckInterval = setInterval(async () => {
        const isValid = await validateSession();
        if (!isValid) {
            cleanupResources();
        }
    }, 5 * 60 * 1000); // Check every 5 minutes
    
    intervals.add(sessionCheckInterval);
}

// Enhanced client-side keep-alive ping to prevent cold starts
// Multiple intervals for maximum reliability
const keepAliveInterval1 = setInterval(async () => {
  try {
    const basePath = window.location.pathname.includes('/public/') ? '/public' : '';
    const response = await fetch(`${basePath}/ping`);
    if (!response.ok) {
      console.warn('⚠️ Client keep-alive ping failed');
    }
  } catch (error) {
    console.warn('⚠️ Client keep-alive ping error:', error);
  }
}, 4 * 60 * 1000); // Every 4 minutes (more aggressive for cold start prevention)

intervals.add(keepAliveInterval1);

// Secondary client-side keep-alive for redundancy
const keepAliveInterval2 = setInterval(async () => {
  try {
    const basePath = window.location.pathname.includes('/public/') ? '/public' : '';
    const response = await fetch(`${basePath}/health`);
    if (!response.ok) {
      console.warn('⚠️ Client health check failed');
    }
  } catch (error) {
    console.warn('⚠️ Client health check error:', error);
  }
}, 6 * 60 * 1000); // Every 6 minutes

intervals.add(keepAliveInterval2);

// Back button and mutually exclusive checkboxes logic
window.addEventListener('DOMContentLoaded', async function() {
  // Start session monitoring
  startSessionMonitoring();
  
  // Start the clock
  startClock();
  
  // Auth check: redirect to login if not authenticated (only for shift-a/b/c users)
  let isShiftUser = false;
  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    if (user && user.email) {
      const username = user.email.split('@')[0].toLowerCase();
      if (username.includes('shift-a') || username.includes('shift-b') || username.includes('shift-c')) {
        isShiftUser = true;
      }
    }
  } catch (e) {}
  
  // Check if user is authenticated
  if (isShiftUser && !user) {
    // Clear any remaining session data
    localStorage.removeItem('supabase.auth.session');
    sessionStorage.removeItem('supabase.auth.session');
    cleanupResources();
    window.location.replace('auth.html');
    return;
  }
  
  // FORCE REDIRECT ON BACK BUTTON
  window.onpopstate = function() {
    // Immediately redirect to login if back button is pressed
    window.location.replace('auth.html');
  };
  // Back button and mutually exclusive checkboxes logic
  const backBtn = document.querySelector('.header-back-button');
  if (backBtn) {
    if (isShiftUser) {
      backBtn.textContent = 'Logout';
      backBtn.onclick = async function() {
        // Add confirmation dialog for shift users
        if (window.confirm("Are you sure you want to log out?")) {
          try {
        await supabase.auth.signOut();
            
            // Cleanup all resources before logout
            cleanupResources();
            
            // Remove session from both storages
            localStorage.removeItem('supabase.auth.session');
            sessionStorage.removeItem('supabase.auth.session');
            
            // FORCE IMMEDIATE REDIRECT - NO HISTORY MANIPULATION
            // Clear all storage first
            localStorage.clear();
            sessionStorage.clear();
            
            // Force immediate redirect
            window.location.replace('auth.html');
            
            // Force immediate redirect
            window.location.replace('auth.html');
          } catch (err) {
            console.error('Exception during logout:', err);
            alert('An unexpected error occurred during logout.');
          }
        } else {
          // Logout cancelled by user
        }
      };
      // Add shift label after the Logout button
      let shiftLabel = '';
      if (user && user.email) {
        const username = user.email.split('@')[0].toLowerCase();
        if (username.includes('shift-a')) shiftLabel = 'Shift A';
        else if (username.includes('shift-b')) shiftLabel = 'Shift B';
        else if (username.includes('shift-c')) shiftLabel = 'Shift C';
      }
      if (shiftLabel) {
        const shiftSpan = document.createElement('span');
        shiftSpan.textContent = shiftLabel;
        shiftSpan.style.fontSize = '1.15rem';
        shiftSpan.style.fontWeight = 'bold';
        shiftSpan.style.color = '#fff';
        shiftSpan.style.marginLeft = '18px';
        backBtn.parentNode.insertBefore(shiftSpan, backBtn.nextSibling);
      }
    } else {
      backBtn.addEventListener('click', function() {
        window.location.href = 'employee-dashboard.html';
      });
    }
  }
  // Mutually exclusive Printed/Non-Printed checkboxes
  const printed = document.querySelector('input[name="printed"]');
  const nonPrinted = document.querySelector('input[name="non_printed"]');
  if (printed && nonPrinted) {
    printed.addEventListener('change', function() {
      if (printed.checked) nonPrinted.checked = false;
    });
    nonPrinted.addEventListener('change', function() {
      if (nonPrinted.checked) printed.checked = false;
    });
  }
  
  // Auto-capitalization for Team section input fields
  const teamInputs = [
    'supervisor', 'supervisor2', 
    'operator', 'operator2', 
    'qc_inspector', 'qc_inspector2'
  ];
  
  teamInputs.forEach(inputName => {
    const input = document.querySelector(`input[name="${inputName}"]`);
    if (input) {
      input.addEventListener('input', function(e) {
        const value = e.target.value;
        if (value.length > 0) {
          // Capitalize first letter and keep rest as typed
          const capitalized = value.charAt(0).toUpperCase() + value.slice(1);
          if (capitalized !== value) {
            e.target.value = capitalized;
          }
        }
      });
    }
  });
  
  // Filter functionality
  setupFilterHandlers();
});

// ===== FILTER FUNCTIONALITY =====

let allForms = []; // Store all forms for filtering
let filteredForms = []; // Store filtered forms
let currentFilters = {}; // Store current filter state

function setupFilterHandlers() {
  const clearFilterBtn = document.getElementById('clearFilter');
  
  if (clearFilterBtn) {
    clearFilterBtn.addEventListener('click', clearFilters);
  }
  
  // Add event listeners for cascading filters
  document.getElementById('filterFromDate')?.addEventListener('change', onDateChange);
  document.getElementById('filterToDate')?.addEventListener('change', onDateChange);
  document.getElementById('filterMachine')?.addEventListener('change', onMachineChange);
  document.getElementById('filterProduct')?.addEventListener('change', onProductChange);
  document.getElementById('filterShift')?.addEventListener('change', onShiftChange);
  
  // Add event listeners for non-cascading filters
  const nonCascadingFilters = [
    'filterOperator', 'filterSupervisor', 'filterQCInspector'
  ];
  
  nonCascadingFilters.forEach(inputId => {
    const input = document.getElementById(inputId);
    if (input) {
      input.addEventListener('change', applyFilters);
    }
  });
}

// Cascading filter functions
async function onDateChange() {
  const fromDate = document.getElementById('filterFromDate').value;
  const toDate = document.getElementById('filterToDate').value;
  
  // Update current filters
  currentFilters.fromDate = fromDate;
  currentFilters.toDate = toDate;
  
  // Reset dependent dropdowns
  resetDropdown('filterMachine');
  resetDropdown('filterProduct');
  resetDropdown('filterShift');
  
  if (fromDate || toDate) {
    await populateMachineDropdown(fromDate, toDate);
    await populateNonCascadingDropdowns(fromDate, toDate);
  }
  
  // Save filter state
  saveFilterState();
  
  // Apply filters
  applyFilters();
}

async function onMachineChange() {
  const fromDate = document.getElementById('filterFromDate').value;
  const toDate = document.getElementById('filterToDate').value;
  const machine = document.getElementById('filterMachine').value;
  
  // Update current filters
  currentFilters.machine = machine;
  
  // Reset dependent dropdowns
  resetDropdown('filterProduct');
  resetDropdown('filterShift');
  
  if (machine) {
    await populateProductDropdown(fromDate, toDate, machine);
  }
  
  // Save filter state
  saveFilterState();
  
  // Apply filters
  applyFilters();
}

async function onProductChange() {
  const fromDate = document.getElementById('filterFromDate').value;
  const toDate = document.getElementById('filterToDate').value;
  const machine = document.getElementById('filterMachine').value;
  const product = document.getElementById('filterProduct').value;
  
  // Update current filters
  currentFilters.product = product;
  
  // Reset dependent dropdowns
  resetDropdown('filterShift');
  
  if (product) {
    await populateShiftDropdown(fromDate, toDate, machine, product);
  }
  
  // Save filter state
  saveFilterState();
  
  // Apply filters
  applyFilters();
}

function onShiftChange() {
  const shift = document.getElementById('filterShift').value;
  
  // Update current filters
  currentFilters.shift = shift;
  
  // Save filter state
  saveFilterState();
  
  // Apply filters
  applyFilters();
}

// Reset dropdown to "All" option only
function resetDropdown(dropdownId) {
  const dropdown = document.getElementById(dropdownId);
  if (dropdown) {
    dropdown.innerHTML = '<option value="">All</option>';
  }
}

// Populate machine dropdown based on date range
async function populateMachineDropdown(fromDate, toDate) {
  let dataToUse = allForms;
  
  // If date filters are applied, load historical data from database
  if (fromDate || toDate) {
    try {
      // Query all three tables and combine results
      const allHistoricalData = [];
      const tables = ['inline_inspection_form_master_1', 'inline_inspection_form_master_2', 'inline_inspection_form_master_3'];
      
      for (const table of tables) {
        let query = supabase
          .from(table)
          .select('mc_no, production_date')
          .not('customer', 'is', null)
          .neq('customer', '');
        
        if (fromDate) {
          query = query.gte('production_date', fromDate);
        }
        if (toDate) {
          query = query.lte('production_date', toDate);
        }
        
        const { data, error } = await query;
        
        if (error) {
          console.error(`Error loading historical data from ${table}:`, error);
        } else if (data) {
          allHistoricalData.push(...data);
        }
      }
      
      dataToUse = allHistoricalData || [];
    } catch (error) {
      console.error('Error in populateMachineDropdown:', error);
      return;
    }
  }
  
  if (!dataToUse || dataToUse.length === 0) return;
  
  const machines = [...new Set(dataToUse.map(form => form.mc_no).filter(Boolean))].sort();
  populateSelect('filterMachine', machines);
}

// Populate product dropdown based on date range and machine
async function populateProductDropdown(fromDate, toDate, machine) {
  let dataToUse = allForms;
  
  // If date filters are applied, load historical data from database
  if (fromDate || toDate) {
    try {
      // Query all three tables and combine results
      const allHistoricalData = [];
      const tables = ['inline_inspection_form_master_1', 'inline_inspection_form_master_2', 'inline_inspection_form_master_3'];
      
      for (const table of tables) {
        let query = supabase
          .from(table)
          .select('prod_code, mc_no, production_date')
          .not('customer', 'is', null)
          .neq('customer', '');
        
        if (fromDate) {
          query = query.gte('production_date', fromDate);
        }
        if (toDate) {
          query = query.lte('production_date', toDate);
        }
        
        const { data, error } = await query;
        
        if (error) {
          console.error(`Error loading historical data from ${table}:`, error);
        } else if (data) {
          allHistoricalData.push(...data);
        }
      }
      
      dataToUse = allHistoricalData || [];
    } catch (error) {
      console.error('Error in populateProductDropdown:', error);
      return;
    }
  }
  
  if (!dataToUse || dataToUse.length === 0) return;
  
  // Filter by machine if provided
  if (machine) {
    dataToUse = dataToUse.filter(form => form.mc_no === machine);
  }
  
  const products = [...new Set(dataToUse.map(form => form.prod_code).filter(Boolean))].sort();
  populateSelect('filterProduct', products);
}

// Populate shift dropdown based on date range, machine, and product
async function populateShiftDropdown(fromDate, toDate, machine, product) {
  let dataToUse = allForms;
  
  // If date filters are applied, load historical data from database
  if (fromDate || toDate) {
    try {
      // Query all three tables and combine results
      const allHistoricalData = [];
      const tables = ['inline_inspection_form_master_1', 'inline_inspection_form_master_2', 'inline_inspection_form_master_3'];
      
      for (const table of tables) {
        let query = supabase
          .from(table)
          .select('shift, mc_no, prod_code, production_date')
          .not('customer', 'is', null)
          .neq('customer', '');
        
        if (fromDate) {
          query = query.gte('production_date', fromDate);
        }
        if (toDate) {
          query = query.lte('production_date', toDate);
        }
        
        const { data, error } = await query;
        
        if (error) {
          console.error(`Error loading historical data from ${table}:`, error);
        } else if (data) {
          allHistoricalData.push(...data);
        }
      }
      
      dataToUse = allHistoricalData || [];
    } catch (error) {
      console.error('Error in populateShiftDropdown:', error);
      return;
    }
  }
  
  if (!dataToUse || dataToUse.length === 0) return;
  
  // Filter by machine if provided
  if (machine) {
    dataToUse = dataToUse.filter(form => form.mc_no === machine);
  }
  
  // Filter by product if provided
  if (product) {
    dataToUse = dataToUse.filter(form => form.prod_code === product);
  }
  
  const shifts = [...new Set(dataToUse.map(form => form.shift).filter(Boolean))].sort();
  populateSelect('filterShift', shifts);
}

// Populate filter dropdowns with unique values
async function populateFilterDropdowns() {
  if (!allForms || allForms.length === 0) return;
  
  // Get unique values for non-cascading filters from current data
  const operators = [...new Set(allForms.flatMap(form => [form.operator, form.operator2]).filter(Boolean))].sort();
  const supervisors = [...new Set(allForms.flatMap(form => [form.supervisor, form.supervisor2]).filter(Boolean))].sort();
  const qcInspectors = [...new Set(allForms.flatMap(form => [form.qc_inspector, form.qc_inspector2]).filter(Boolean))].sort();
  
  // Populate non-cascading dropdowns
  populateSelect('filterOperator', operators);
  populateSelect('filterSupervisor', supervisors);
  populateSelect('filterQCInspector', qcInspectors);
  
  // Initialize cascading dropdowns with all available values
  const machines = [...new Set(allForms.map(form => form.mc_no).filter(Boolean))].sort();
  const products = [...new Set(allForms.map(form => form.prod_code).filter(Boolean))].sort();
  const shifts = [...new Set(allForms.map(form => form.shift).filter(Boolean))].sort();
  
  populateSelect('filterMachine', machines);
  populateSelect('filterProduct', products);
  populateSelect('filterShift', shifts);
  
  // Restore previous filter state if exists
  await restoreFilterState();
}

// Populate non-cascading filter dropdowns with historical data
async function populateNonCascadingDropdowns(fromDate, toDate) {
  if (!fromDate && !toDate) return;
  
  try {
    // Query all three tables and combine results
    const allHistoricalData = [];
    const tables = ['inline_inspection_form_master_1', 'inline_inspection_form_master_2', 'inline_inspection_form_master_3'];
    
    for (const table of tables) {
      let query = supabase
        .from(table)
        .select('operator, operator2, supervisor, supervisor2, qc_inspector, qc_inspector2')
        .not('customer', 'is', null)
        .neq('customer', '');
      
      if (fromDate) {
        query = query.gte('production_date', fromDate);
      }
      if (toDate) {
        query = query.lte('production_date', toDate);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error(`Error loading historical data from ${table}:`, error);
      } else if (data) {
        allHistoricalData.push(...data);
      }
    }
    
    if (allHistoricalData && allHistoricalData.length > 0) {
      // Get unique values for non-cascading filters from historical data
      const operators = [...new Set(allHistoricalData.flatMap(form => [form.operator, form.operator2]).filter(Boolean))].sort();
      const supervisors = [...new Set(allHistoricalData.flatMap(form => [form.supervisor, form.supervisor2]).filter(Boolean))].sort();
      const qcInspectors = [...new Set(allHistoricalData.flatMap(form => [form.qc_inspector, form.qc_inspector2]).filter(Boolean))].sort();
      
      // Populate non-cascading dropdowns with historical data
      populateSelect('filterOperator', operators);
      populateSelect('filterSupervisor', supervisors);
      populateSelect('filterQCInspector', qcInspectors);
    }
  } catch (error) {
    console.error('Error in populateNonCascadingDropdowns:', error);
  }
}

// Helper function to populate datalist options
function populateDatalist(datalistId, options) {
  const datalist = document.getElementById(datalistId);
  if (!datalist) return;
  
  // Clear existing options except "All"
  datalist.innerHTML = '<option value="">All</option>';
  
  // Add new options
  options.forEach(option => {
    const optionElement = document.createElement('option');
    optionElement.value = option;
    datalist.appendChild(optionElement);
  });
}

// Helper function to populate select dropdown
function populateSelect(selectId, options) {
  const select = document.getElementById(selectId);
  if (!select) return;
  
  // Clear existing options except "All"
  select.innerHTML = '<option value="">All</option>';
  
  // Add new options
  options.forEach(option => {
    const optionElement = document.createElement('option');
    optionElement.value = option;
    optionElement.textContent = option;
    select.appendChild(optionElement);
  });
}

// Save current filter state
function saveFilterState() {
  currentFilters = {
    fromDate: document.getElementById('filterFromDate').value,
    toDate: document.getElementById('filterToDate').value,
    product: document.getElementById('filterProduct').value,
    machine: document.getElementById('filterMachine').value,
    shift: document.getElementById('filterShift').value,
    operator: document.getElementById('filterOperator').value,
    supervisor: document.getElementById('filterSupervisor').value,
    qcInspector: document.getElementById('filterQCInspector').value
  };
  localStorage.setItem('inlineInspectionFilters', JSON.stringify(currentFilters));
}

// Restore filter state from localStorage
async function restoreFilterState() {
  const savedFilters = localStorage.getItem('inlineInspectionFilters');
  if (savedFilters) {
    currentFilters = JSON.parse(savedFilters);
    
    // Restore date filters first
    document.getElementById('filterFromDate').value = currentFilters.fromDate || '';
    document.getElementById('filterToDate').value = currentFilters.toDate || '';
    
    // Restore non-cascading filters
    document.getElementById('filterOperator').value = currentFilters.operator || '';
    document.getElementById('filterSupervisor').value = currentFilters.supervisor || '';
    document.getElementById('filterQCInspector').value = currentFilters.qcInspector || '';
    
    // Restore cascading filters with proper population
    if (currentFilters.fromDate || currentFilters.toDate) {
      await populateMachineDropdown(currentFilters.fromDate, currentFilters.toDate);
      
      if (currentFilters.machine) {
        document.getElementById('filterMachine').value = currentFilters.machine;
        await populateProductDropdown(currentFilters.fromDate, currentFilters.toDate, currentFilters.machine);
        
        if (currentFilters.product) {
          document.getElementById('filterProduct').value = currentFilters.product;
          await populateShiftDropdown(currentFilters.fromDate, currentFilters.toDate, currentFilters.machine, currentFilters.product);
          
          if (currentFilters.shift !== undefined) {
            document.getElementById('filterShift').value = currentFilters.shift;
          }
        }
      }
      
      // Update filter status and apply filters
      updateFilterStatus();
      applyFilters();
    } else {
      // No date filters, restore directly
      if (currentFilters.machine) {
        document.getElementById('filterMachine').value = currentFilters.machine;
      }
      if (currentFilters.product) {
        document.getElementById('filterProduct').value = currentFilters.product;
      }
      if (currentFilters.shift !== undefined) {
        document.getElementById('filterShift').value = currentFilters.shift;
      }
      
      updateFilterStatus();
      applyFilters();
    }
  } else {
    // Update filter status to show Off if no saved filters
    updateFilterStatus();
  }
}

// Update filter status indicator
function updateFilterStatus() {
  const filterStatus = document.getElementById('filterStatus');
  const filterContainer = document.getElementById('filterContainer');
  if (!filterStatus || !filterContainer) return;
  
  const fromDate = document.getElementById('filterFromDate').value;
  const toDate = document.getElementById('filterToDate').value;
  const product = document.getElementById('filterProduct').value;
  const machine = document.getElementById('filterMachine').value;
  const shift = document.getElementById('filterShift').value;
  const operator = document.getElementById('filterOperator').value;
  const supervisor = document.getElementById('filterSupervisor').value;
  const qcInspector = document.getElementById('filterQCInspector').value;

  const hasFilters = fromDate || toDate || product || machine || shift || operator || supervisor || qcInspector;
  
  if (hasFilters) {
    filterStatus.textContent = 'On';
    filterStatus.className = 'px-2 py-1 text-xs font-semibold rounded-full bg-green-200 text-green-700';
    // Highlight filter section when active
    filterContainer.className = 'bg-green-50 border-2 border-green-300 rounded-lg shadow-md p-4';
  } else {
    filterStatus.textContent = 'Off';
    filterStatus.className = 'px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-700';
    // Remove highlighting when no filters
    filterContainer.className = 'bg-white rounded-lg shadow-md p-4';
  }
}

async function applyFilters() {
  const fromDate = document.getElementById('filterFromDate').value;
  const toDate = document.getElementById('filterToDate').value;
  const product = document.getElementById('filterProduct').value;
  const machine = document.getElementById('filterMachine').value;
  const shift = document.getElementById('filterShift').value;
  const operator = document.getElementById('filterOperator').value;
  const supervisor = document.getElementById('filterSupervisor').value;
  const qcInspector = document.getElementById('filterQCInspector').value;
  
  // Save current filter state
  saveFilterState();
  
  // Update filter status
  updateFilterStatus();
  
  // Check if date filters are applied
  const hasDateFilters = fromDate || toDate;
  
  // If date filters are applied, load historical data from database
  if (hasDateFilters) {
    try {
      // Query all three tables and combine results
      const allHistoricalData = [];
      const tables = ['inline_inspection_form_master_1', 'inline_inspection_form_master_2', 'inline_inspection_form_master_3'];
      
      for (const table of tables) {
        let query = supabase
          .from(table)
          .select(`
            id, traceability_code, lot_letter, customer, production_no, prod_code, spec,
            production_date, emboss_type, printed, non_printed, ct, year, month, date,
            mc_no, shift, supervisor, supervisor2,
            operator, operator2, qc_inspector, qc_inspector2, status,
            total_rolls, accepted_rolls, rejected_rolls, rework_rolls, kiv_rolls,
            created_at, updated_at
          `);
        
        // Apply date filters to database query
        if (fromDate) {
          query = query.gte('production_date', fromDate);
        }
        if (toDate) {
          query = query.lte('production_date', toDate);
        }
        
        // Add ordering
        query = query
          .order('production_date', { ascending: false })
          .order('created_at', { ascending: false })
          .order('mc_no', { ascending: true });
        
        const { data, error } = await query;
        
        if (error) {
          console.error(`Error loading historical data from ${table}:`, error);
        } else if (data) {
          allHistoricalData.push(...data);
        }
      }
      
      // Filter historical data with other filters
      const validHistoricalForms = allHistoricalData.filter(form => form.customer !== null && form.customer !== '');
      
      // Apply other filters to historical data
      filteredForms = validHistoricalForms.filter(form => {
        // Product filter
        if (product && form.prod_code) {
          if (form.prod_code !== product) return false;
        }
        
        // Machine filter
        if (machine && form.mc_no) {
          if (form.mc_no !== machine) return false;
        }
        
        // Shift filter
        if (shift && form.shift) {
          if (parseInt(form.shift) !== parseInt(shift)) return false;
        }
        
        // Operator filter
        if (operator && (form.operator || form.operator2)) {
          if (form.operator !== operator && form.operator2 !== operator) return false;
        }
        
        // Supervisor filter
        if (supervisor && (form.supervisor || form.supervisor2)) {
          if (form.supervisor !== supervisor && form.supervisor2 !== supervisor) return false;
        }
        
        
        // QC Inspector filter
        if (qcInspector && (form.qc_inspector || form.qc_inspector2)) {
          if (form.qc_inspector !== qcInspector && form.qc_inspector2 !== qcInspector) return false;
        }
        
        return true;
      });
      
    } catch (error) {
      console.error('Error in historical data filtering:', error);
      return;
    }
  } else {
    // No date filters - use existing allForms data
    filteredForms = allForms.filter(form => {
      // Product filter
      if (product && form.prod_code) {
        if (form.prod_code !== product) return false;
      }
      
      // Machine filter
      if (machine && form.mc_no) {
        if (form.mc_no !== machine) return false;
      }
      
      // Shift filter
      if (shift && form.shift) {
        if (parseInt(form.shift) !== parseInt(shift)) return false;
      }
      
      // Operator filter
      if (operator && (form.operator || form.operator2)) {
        if (form.operator !== operator && form.operator2 !== operator) return false;
      }
      
      // Supervisor filter
      if (supervisor && (form.supervisor || form.supervisor2)) {
        if (form.supervisor !== supervisor && form.supervisor2 !== supervisor) return false;
      }
      
      
      // QC Inspector filter
      if (qcInspector && (form.qc_inspector || form.qc_inspector2)) {
        if (form.qc_inspector !== qcInspector && form.qc_inspector2 !== qcInspector) return false;
      }
      
      return true;
    });
  }
  
  // Update the table with filtered results
  await updateFormsTable(filteredForms, hasDateFilters);
  
  // Check if filters are applied
  const hasFilters = fromDate || toDate || product || machine || shift || operator || supervisor || qcInspector;
  if (hasFilters) {
    // Filter applied successfully
  }
}

async function clearFilters() {
  // Clear all filter inputs
  document.getElementById('filterFromDate').value = '';
  document.getElementById('filterToDate').value = '';
  document.getElementById('filterOperator').value = '';
  document.getElementById('filterSupervisor').value = '';
  document.getElementById('filterQCInspector').value = '';
  
  // Reset cascading dropdowns
  resetDropdown('filterMachine');
  resetDropdown('filterProduct');
  resetDropdown('filterShift');
  
  // Clear saved filter state
  currentFilters = {};
  localStorage.removeItem('inlineInspectionFilters');
  
  // Update filter status
  updateFilterStatus();
  
  // Reload the table with current month's data (this will reset to default month view)
  await loadFormsTable();
  
  // Filters cleared successfully
}

// ===== STEP 1: FORM CREATION AND SAVING =====

// Global function for form submission
async function handleFormSubmit(e) {
          // Form submission triggered
    e.preventDefault();
  const form = document.getElementById('inlineInspectionEntryForm');
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
  const isEditMode = form.dataset.isEditMode === 'true';
  
  // Validate required fields
  const requiredFields = [
    'prod_code',
    'customer', 
    'spec',
    'production_date',
    'emboss_type',
    'year',
    'month',
    'date',
    'mc_no',
    'shift',
    'supervisor',
    'operator',
    'qc_inspector'
  ];
  
  // Validate checkboxes (at least one must be selected)
  const printedCheckbox = form.querySelector('input[name="printed"]');
  const nonPrintedCheckbox = form.querySelector('input[name="non_printed"]');
  const ctCheckbox = form.querySelector('input[name="ct"]');
  const checkboxGroup = form.querySelector('.flex.flex-row.items-center.gap-10.border.border-gray-200.bg-gray-50.rounded-lg.px-4.py-3.w-fit.mb-2');
  
  // More robust checkbox validation
  const isAnyCheckboxSelected = (printedCheckbox && printedCheckbox.checked) || 
                               (nonPrintedCheckbox && nonPrintedCheckbox.checked) || 
                               (ctCheckbox && ctCheckbox.checked);
  
  // console.log('Checkbox validation:', {
  //   printed: printedCheckbox?.checked,
  //   nonPrinted: nonPrintedCheckbox?.checked,
  //   ct: ctCheckbox?.checked,
  //   isAnySelected: isAnyCheckboxSelected
  // });
  
  const missingFields = [];
  
  // Clear previous validation styling
  form.querySelectorAll('input, select').forEach(field => {
    field.classList.remove('required-field');
  });
  
  // Clear checkbox group error styling
  if (checkboxGroup) {
    checkboxGroup.classList.remove('checkbox-group-error');
  }
  
  requiredFields.forEach(fieldName => {
    const field = form.querySelector(`[name="${fieldName}"]`);
    if (!field) {
      console.warn(`Field not found: ${fieldName}`);
      missingFields.push(fieldName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()));
    } else if (!field.value.trim()) {
      missingFields.push(fieldName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()));
      field.classList.add('required-field');
      if (missingFields.length === 1) { // Only focus on first missing field
        field.focus();
      }
    }
  });
  
  // Check if at least one checkbox is selected
  const productTypeError = document.getElementById('productTypeError');
  if (!isAnyCheckboxSelected) {
    // Don't add to missingFields array - only show inline error
    if (checkboxGroup) {
      checkboxGroup.classList.add('checkbox-group-error');
    }
    if (productTypeError) {
      productTypeError.classList.remove('hidden');
    }
    // Prevent form submission
    return;
  } else {
    if (productTypeError) {
      productTypeError.classList.add('hidden');
    }
  }
  
  if (missingFields.length > 0) {
    alert(`Please fill in all required fields marked with *:\n\n${missingFields.join('\n')}`);
    return;
  }
  
  // Form submission details logged
  
  submitBtn.textContent = isEditMode ? 'Updating...' : 'Creating...';
    submitBtn.disabled = true;
  
    try {
      const formData = new FormData(form);
      const year = formData.get('year') || '';
      const month = formData.get('month') || '';
      const date = formData.get('date') || '';
      const machine = formData.get('mc_no') || '';
      const shift = formData.get('shift') || '';
      const traceability_code = `${year}${month}${date}${machine}${shift}`;
      
      if (isEditMode) {
        // Update existing form using record ID (like the old working code)
        const editRecordId = form.dataset.editRecordId;
        
        // Get the lot_letter from the existing record for cache clearing
        let lot_letter = 'A'; // Default fallback
        
        // Find the record across all tables to determine which table it belongs to
        let foundRecord = null;
        let tableName = null;
        const tables = ['inline_inspection_form_master_1', 'inline_inspection_form_master_2', 'inline_inspection_form_master_3'];
        
        for (const table of tables) {
          const { data: record, error } = await supabase
            .from(table)
            .select(`
              id, traceability_code, lot_letter, customer, production_no, prod_code, spec,
              production_date, emboss_type, printed, non_printed, ct, year, month, date,
              mc_no, shift, supervisor, supervisor2,
              operator, operator2, qc_inspector, qc_inspector2, status,
              total_rolls, accepted_rolls, rejected_rolls, rework_rolls, kiv_rolls,
              created_at, updated_at
            `)
            .eq('id', editRecordId)
            .single();
            
          if (!error && record) {
            foundRecord = record;
            tableName = table;
            break;
          }
        }
        
        if (!foundRecord) {
          console.error('Record not found in any table for ID:', editRecordId);
          alert('Error: Record not found for editing.');
          return;
        }
        
        // Get lot_letter from the existing record
        lot_letter = foundRecord.lot_letter || 'A';
        
        const updateObject = {
          customer: formData.get('customer'),
          production_no: (formData.get('production_no') || '').toUpperCase(),
          prod_code: formData.get('prod_code'),
          spec: formData.get('spec'),
          production_date: formData.get('production_date'),
          emboss_type: formData.get('emboss_type'),
          printed: formData.get('printed') === 'on',
          non_printed: formData.get('non_printed') === 'on',
          ct: formData.get('ct') === 'on',
          year: formData.get('year'),
          month: formData.get('month'),
          date: formData.get('date'),
          mc_no: formData.get('mc_no'),
          shift: parseInt(formData.get('shift')),
          supervisor: formData.get('supervisor'),
          supervisor2: formData.get('supervisor2'),
          operator: formData.get('operator'),
          operator2: formData.get('operator2'),
          qc_inspector: formData.get('qc_inspector'),
          qc_inspector2: formData.get('qc_inspector2'),
          updated_at: getISTTimestamp()
        };
        
        // Update query prepared
        const { data, error } = await supabase
          .from(tableName)
          .update(updateObject)
          .eq('id', editRecordId)
          .select();
        
        // Update query executed
          
        if (error) {
          console.error('Error updating form:', error);
          alert('Error updating form: ' + error.message);
          return;
        }
        
        // Update completed
        
        // Show success message
        alert('✅ Form updated successfully!');
        
        // Clear cache for this form to ensure fresh data
        const cacheKey = `${traceability_code}_${lot_letter}`;
        formDataCache.delete(cacheKey);
      } else {
        // Create new form

      // --- Determine next available lot_letter based on same shift, machine, and date ---
      let lot_letter = 'A';
      try {
        const currentShift = parseInt(formData.get('shift'));
        const currentMachine = formData.get('mc_no');
        const currentDate = formData.get('production_date');
        
        // Get the correct table for this machine
        const tableName = getTableNameForMachine(currentMachine);
        
        // console.log('Checking for existing forms with:', {
        //   shift: currentShift,
        //   machine: currentMachine,
        //   date: currentDate,
        //   table: tableName
        // });
        
        const { data: existingForms, error: fetchError } = await supabase
          .from(tableName)
          .select('lot_letter, shift, mc_no, production_date')
          .eq('shift', currentShift)
          .eq('mc_no', currentMachine)
          .eq('production_date', currentDate);
          
        if (!fetchError && existingForms && existingForms.length > 0) {
          // console.log('Found existing forms for same shift/machine/date:', existingForms);
          
          // Collect used letters
          const usedLetters = existingForms
            .map(f => f.lot_letter)
            .filter(l => l && typeof l === 'string')
            .map(l => l.toUpperCase());
            
                      // console.log('Used lot letters:', usedLetters);
          
          // Find next available letter
          const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
          for (let i = 0; i < alphabet.length; i++) {
            if (!usedLetters.includes(alphabet[i])) {
              lot_letter = alphabet[i];
              break;
            }
          }
          
                      // console.log('Assigned lot letter:', lot_letter);
        } else {
          // console.log('No existing forms found for same shift/machine/date, using A');
        }
      } catch (err) {
        console.warn('Could not determine next lot_letter, defaulting to A.', err);
      }
      // --- End lot_letter logic ---

      const formObject = {
        traceability_code: traceability_code,
        lot_letter: lot_letter,
        customer: formData.get('customer'),
        production_no: (formData.get('production_no') || '').toUpperCase(),
        prod_code: formData.get('prod_code'),
        spec: formData.get('spec'),
        production_date: formData.get('production_date'),
        emboss_type: formData.get('emboss_type'),
        printed: formData.get('printed') === 'on',
        non_printed: formData.get('non_printed') === 'on',
        ct: formData.get('ct') === 'on',
        year: formData.get('year'),
        month: formData.get('month'),
        date: formData.get('date'),
        mc_no: formData.get('mc_no'),
        shift: parseInt(formData.get('shift')),
        supervisor: formData.get('supervisor'),
        supervisor2: formData.get('supervisor2'),
        operator: formData.get('operator'),
        operator2: formData.get('operator2'),
        qc_inspector: formData.get('qc_inspector'),
        qc_inspector2: formData.get('qc_inspector2'),
        status: 'draft',
        // inspection_data removed - using direct columns instead
        total_rolls: 0,
        accepted_rolls: 0,
        rejected_rolls: 0,
        rework_rolls: 0,
        kiv_rolls: 0,
        created_at: getISTTimestamp()
      };
        
      // Ensure Supabase generates the UUID instead of frontend
      delete formObject.form_id;
      
      // Get the correct table for this machine and insert
      const tableName = getTableNameForMachine(formData.get('mc_no'));
        
      const { data, error } = await supabase
        .from(tableName)
        .insert([formObject])
        .select();
          
      if (error) {
        console.error('Error saving form:', error);
        alert('Error creating form: ' + error.message);
        return;
      }
        
        // Success message removed for form creation
      }
      
      const overlay = document.getElementById('inspectionFormOverlay');
      overlay.style.display = 'none';
      overlay.classList.add('hidden');
      
      // Reset form completely
      form.reset();
      
      // Clear all validation styling
      form.querySelectorAll('input, select').forEach(field => {
        field.classList.remove('required-field');
      });
      
      // Clear checkbox group error styling
      const checkboxGroup = form.querySelector('.flex.flex-row.items-center.gap-10.border.border-gray-200.bg-gray-50.rounded-lg.px-4.py-3.w-fit.mb-2');
      if (checkboxGroup) {
        checkboxGroup.classList.remove('checkbox-group-error');
      }
      
      // Hide product type error
      const productTypeError = document.getElementById('productTypeError');
      if (productTypeError) {
        productTypeError.classList.add('hidden');
      }
      
      // Reset form mode and UI
      form.dataset.isEditMode = 'false';
      delete form.dataset.editRecordId;
      
      // Reset modal title and button
      const modalTitle = overlay.querySelector('h3');
      if (modalTitle) {
        modalTitle.textContent = 'Enter Inline Inspection Form Details';
      }
      if (submitBtn) {
        submitBtn.textContent = 'Create Inline Inspection Form';
      }
      
      // Reset warning message for create mode
      const warningMessage = overlay.querySelector('p.text-red-600');
      if (warningMessage) {
        warningMessage.textContent = '*Note : Please ensure all entered details are correct before creating form';
      }
      
      loadFormsTable();
    } catch (error) {
      console.error('Error:', error);
      alert('Error ' + (isEditMode ? 'updating' : 'creating') + ' form: ' + error.message);
    } finally {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  }

  // DOMContentLoaded event listener
  window.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('inlineInspectionEntryForm');
    const overlay = document.getElementById('inspectionFormOverlay');
    const createFormBtn = document.getElementById('showInspectionFormOverlay');
    const closeBtn = document.getElementById('closeInspectionFormOverlay');

  if (form) {
    // Remove the old addEventListener if present
    form.onsubmit = null;
  }

  if (createFormBtn) {
    createFormBtn.addEventListener('click', function() {
      // console.log('Create form button clicked');
      
      if (form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Create Inline Inspection Form';
        form.onsubmit = handleFormSubmit;
        
        // Reset form to clear any previous data
        form.reset();
        
        // Clear any validation styling
        form.querySelectorAll('input, select').forEach(field => {
          field.classList.remove('required-field');
        });
        
        // Clear checkbox group error styling
        const checkboxGroup = form.querySelector('.flex.flex-row.items-center.gap-10.border.border-gray-200.bg-gray-50.rounded-lg.px-4.py-3.w-fit.mb-2');
        if (checkboxGroup) {
          checkboxGroup.classList.remove('checkbox-group-error');
        }
        
        // Hide product type error
        const productTypeError = document.getElementById('productTypeError');
        if (productTypeError) {
          productTypeError.classList.add('hidden');
        }
      }
      
      // Reset warning message for create mode
      const warningMessage = overlay.querySelector('p.text-red-600');
      if (warningMessage) {
        warningMessage.textContent = '*Note : Please ensure all entered details are correct before creating form';
      }
      
      // Show modal
      overlay.style.display = 'flex';
      overlay.classList.remove('hidden');
      
      // Setup autocomplete for personnel and product fields
      setTimeout(() => {
        setupPersonnelAutocomplete();
        setupProductAutocomplete();
      }, 100);
    });
  }

  // Close button handler
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      // console.log('Close button clicked');
      overlay.style.display = 'none';
      overlay.classList.add('hidden');
      
      // Reset form
      if (form) {
        form.reset();
        form.querySelectorAll('input, select').forEach(field => {
          field.classList.remove('required-field');
        });
        
        // Clear checkbox group error styling
        const checkboxGroup = form.querySelector('.flex.flex-row.items-center.gap-10.border.border-gray-200.bg-gray-50.rounded-lg.px-4.py-3.w-fit.mb-2');
        if (checkboxGroup) {
          checkboxGroup.classList.remove('checkbox-group-error');
        }
        
        // Hide product type error
        const productTypeError = document.getElementById('productTypeError');
        if (productTypeError) {
          productTypeError.classList.add('hidden');
        }
      }
    });
  }
  
  // Close modal when clicking outside
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      closeBtn.click();
    }
  });
  
  // Production Report button
  const productionReportBtn = document.getElementById('openProductionReport');
  if (productionReportBtn) {
    productionReportBtn.addEventListener('click', function() {
      // Open production report in new tab
      window.open('production-report.html', '_blank');
    });
  }
  
  // Add real-time validation for required fields (without interfering with autocomplete)
  const requiredFields = ['prod_code', 'customer', 'spec', 'production_date', 'emboss_type', 'year', 'month', 'date', 'mc_no', 'shift', 'supervisor', 'operator', 'qc_inspector'];
  
  requiredFields.forEach(fieldName => {
    const field = document.querySelector(`[name="${fieldName}"]`);
    if (field) {
      // Use a debounced approach to avoid conflicts with autocomplete
      let validationTimeout;
      
      field.addEventListener('input', function() {
        clearTimeout(validationTimeout);
        validationTimeout = setTimeout(() => {
          if (this.value.trim()) {
            this.classList.remove('required-field');
          }
        }, 100);
      });
      
      field.addEventListener('change', function() {
        if (this.value.trim()) {
          this.classList.remove('required-field');
        }
      });
      
      // Also validate when autocomplete selection is made
      field.addEventListener('blur', function() {
        setTimeout(() => {
          if (this.value.trim()) {
            this.classList.remove('required-field');
          }
        }, 150);
      });
    }
  });
  
  // Add real-time validation for checkboxes
  const checkboxes = ['printed', 'non_printed', 'ct'];
  const checkboxGroup = document.querySelector('.flex.flex-row.items-center.gap-10.border.border-gray-200.bg-gray-50.rounded-lg.px-4.py-3.w-fit.mb-2');
  
  checkboxes.forEach(checkboxName => {
    const checkbox = document.querySelector(`input[name="${checkboxName}"]`);
    if (checkbox) {
      checkbox.addEventListener('change', function() {
        const isAnySelected = checkboxes.some(name => {
          const cb = document.querySelector(`input[name="${name}"]`);
          return cb && cb.checked;
        });
        
        if (isAnySelected && checkboxGroup) {
          checkboxGroup.classList.remove('checkbox-group-error');
          const productTypeError = document.getElementById('productTypeError');
          if (productTypeError) {
            productTypeError.classList.add('hidden');
          }
        }
      });
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      overlay.style.display = 'none';
    });
  }

  // Close overlay when clicking outside
  if (overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.style.display = 'none';
      }
    });
  }

  // Load forms table on page load
  loadFormsTable();
  
  // Add event listeners for delete confirmation overlays
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const cancelFinalDeleteBtn = document.getElementById('cancelFinalDeleteBtn');
  const confirmFinalDeleteBtn = document.getElementById('confirmFinalDeleteBtn');
  
  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', cancelDelete);
  }
  
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', confirmDelete);
  }
  
  if (cancelFinalDeleteBtn) {
    cancelFinalDeleteBtn.addEventListener('click', cancelFinalDelete);
  }
  
  if (confirmFinalDeleteBtn) {
    confirmFinalDeleteBtn.addEventListener('click', confirmFinalDelete);
  }
});

// ===== LOAD FORMS TABLE =====
  async function loadFormsTable() {
    try {
      // Check if there are saved filters that should override default behavior
      const savedFilters = localStorage.getItem('inlineInspectionFilters');
      let hasDateFilters = false;
      let startDate, endDate;
      
      if (savedFilters) {
        const filters = JSON.parse(savedFilters);
        if (filters.fromDate || filters.toDate) {
          hasDateFilters = true;
          startDate = filters.fromDate;
          endDate = filters.toDate;
        }
      }
      
      // If no date filters are saved, use default month logic
      if (!hasDateFilters) {
        // Get current date and time
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentDay = now.getDate();
        
        // Determine which month's data to show based on shift timing
        // If it's before 6:30 AM on the 1st of the month, show previous month's data
        // (because night shift of previous month ends at 6:30 AM)
        let targetYear = now.getFullYear();
        let targetMonth = now.getMonth() + 1; // getMonth() returns 0-11, so add 1
        
        if (currentDay === 1 && currentHour < 6 || (currentDay === 1 && currentHour === 6 && currentMinute < 30)) {
          // It's before 6:30 AM on the 1st, so show previous month's data
          if (targetMonth === 1) {
            // If it's January 1st before 6:30 AM, show December of previous year
            targetYear = targetYear - 1;
            targetMonth = 12;
          } else {
            targetMonth = targetMonth - 1;
          }
                  // Before 6:30 AM on 1st - showing previous month's data
        }
        
        // Calculate start and end dates for target month
        const startOfMonth = new Date(targetYear, targetMonth - 1, 1); // First day of target month
        const endOfMonth = new Date(targetYear, targetMonth, 0); // Last day of target month (this is correct)
        
        // Format dates for database query (YYYY-MM-DD)
        startDate = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-01`;
        endDate = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-${endOfMonth.getDate().toString().padStart(2, '0')}`;
      }
      
      // Loading forms for target date range
      
      // Query all three tables and combine results
      const allFormsData = [];
      const tables = ['inline_inspection_form_master_1', 'inline_inspection_form_master_2', 'inline_inspection_form_master_3'];
      
      for (const table of tables) {
        let query = supabase
          .from(table)
          .select(`
            id, traceability_code, lot_letter, customer, production_no, prod_code, spec,
            production_date, emboss_type, printed, non_printed, ct, year, month, date,
            mc_no, shift, supervisor, supervisor2,
            operator, operator2, qc_inspector, qc_inspector2, status,
            total_rolls, accepted_rolls, rejected_rolls, rework_rolls, kiv_rolls,
            created_at, updated_at
          `);
        
        // Apply date filters if they exist
        if (startDate) {
          query = query.gte('production_date', startDate);
        }
        if (endDate) {
          query = query.lte('production_date', endDate);
        }
        
        const { data, error } = await query
          .order('production_date', { ascending: false })
          .order('created_at', { ascending: false })
          .order('mc_no', { ascending: true });

        if (error) {
          console.error(`Error loading forms from ${table}:`, error);
        } else if (data) {
          allFormsData.push(...data);
        }
      }

      // Only show forms with a non-null and non-empty customer value
      const validForms = allFormsData.filter(form => form.customer !== null && form.customer !== '');
    

    
            // Found forms for target month
    
    // Additional client-side sorting to ensure proper date ordering with machine alternation
    const sortedForms = validForms.sort((a, b) => {
      // Primary sort by production_date (newest first)
      const aProdDate = new Date(a.production_date || 0);
      const bProdDate = new Date(b.production_date || 0);
      
      if (aProdDate.getTime() !== bProdDate.getTime()) {
        return bProdDate.getTime() - aProdDate.getTime();
      }
      
      // Secondary sort by created_at (newest first)
      const aCreated = new Date(a.created_at || 0);
      const bCreated = new Date(b.created_at || 0);
      
      if (aCreated.getTime() !== bCreated.getTime()) {
        return bCreated.getTime() - aCreated.getTime();
      }
      
      // Tertiary sort by machine number (ascending) to create alternating pattern
      const aMachine = parseInt(a.mc_no) || 0;
      const bMachine = parseInt(b.mc_no) || 0;
      
      return aMachine - bMachine;
    });
    
    allForms = sortedForms; // Store all forms for filtering
    filteredForms = sortedForms; // Initialize filtered forms with all valid forms
    await updateFormsTable(sortedForms, hasDateFilters); // Pass hasDateFilters to show all forms if date filters are applied
    await populateFilterDropdowns(); // Populate dropdowns after loading forms
  } catch (error) {
    console.error('Error:', error);
  }
}

// ===== AUTHORIZATION FUNCTIONS =====
async function getCurrentUserDepartment() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('department')
      .eq('id', user.id)
      .single();
    
    if (error || !userProfile) return null;
    return userProfile.department;
  } catch (error) {
    console.error('Error getting user department:', error);
    return null;
  }
}

function hasEditDeletePermission(userDepartment, formStatus) {
  if (!userDepartment) return false;
  
  const authorizedDepartments = ['Quality Assurance', 'Quality Control', 'Production'];
  
  // If form is submitted, only authorized departments can edit/delete
  if (formStatus === 'submit') {
    return authorizedDepartments.includes(userDepartment);
  }
  
  // If form is draft, all departments can edit/delete
  return true;
}

// ===== UPDATE FORMS TABLE =====
async function updateFormsTable(forms, showAllForDateFilters = false) {
  const tbody = document.querySelector('table tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (forms.length === 0) {
    const isFiltered = filteredForms.length !== allForms.length;
    const message = isFiltered 
      ? 'No forms match the current filter criteria. Try adjusting your filters.'
      : 'No forms created yet. Click "Inline Film Inspection Form" to get started.';
    
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="py-4 text-center text-gray-500">
          ${message}
        </td>
      </tr>
    `;
    return;
  }

    // Limit to maximum entries (unless date filters are applied)
  const limitedForms = showAllForDateFilters ? forms : forms.slice(0, MAX_FORMS_DISPLAY);

  // Get user department once for all forms
  const userDepartment = await getCurrentUserDepartment();

  limitedForms.forEach((form, index) => {
    // Combine names with '/'
    const supervisorDisplay = [form.supervisor, form.supervisor2].filter(Boolean).join(' / ');
    const operatorDisplay = [form.operator, form.operator2].filter(Boolean).join(' / ');
    const qcInspectorDisplay = [form.qc_inspector, form.qc_inspector2].filter(Boolean).join(' / ');
    
    // Convert shift number to letter for display
    const shiftDisplay = form.shift ? 
      (form.shift === '1' || form.shift === 1 ? 'A' : 
       form.shift === '2' || form.shift === 2 ? 'B' : 
       form.shift === '3' || form.shift === 3 ? 'C' : form.shift) : '-';
    
    // Debug: Log the shift conversion
            // Shift conversion completed
    
    // Check if form status is "submit" - if so, only show eye icon
    const isSubmitted = form.status === 'submit';
    
    // Check permissions synchronously
    const hasPermission = hasEditDeletePermission(userDepartment, form.status);
    
    // Format status for display
    const statusDisplay = form.status ? 
      (form.status === 'submit' ? 'Submitted' : form.status.charAt(0).toUpperCase() + form.status.slice(1)) : '-';
    const statusColor = form.status === 'submit' ? 'text-green-600 font-semibold' : 'text-orange-600 font-semibold';
    
    // Add circle styling for M/C No
    const mcNo = form.mc_no || '-';
    let mcNoStyle = '';
    if (mcNo === '1' || mcNo === 1) {
      mcNoStyle = 'bg-red-500 text-white font-semibold rounded-full w-8 h-8 flex items-center justify-center mx-auto';
    } else if (mcNo === '2' || mcNo === 2) {
      mcNoStyle = 'bg-green-500 text-white font-semibold rounded-full w-8 h-8 flex items-center justify-center mx-auto';
    } else {
      mcNoStyle = 'bg-gray-500 text-white font-semibold rounded-full w-8 h-8 flex items-center justify-center mx-auto';
    }
    
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50 transition-colors';
    row.innerHTML = `
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">${showAllForDateFilters ? (forms.length - index) : (limitedForms.length - index)}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">${formatDate(form.production_date)}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">${form.prod_code || '-'}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">
        <div class="${mcNoStyle}">${mcNo}</div>
      </td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">${shiftDisplay}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">${operatorDisplay || '-'}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">${supervisorDisplay || '-'}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">${qcInspectorDisplay || '-'}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words ${statusColor}">${statusDisplay}</td>
      <td class="py-3 px-4 border-r border-gray-200 text-center whitespace-normal break-words">
        <div class="flex flex-col justify-center items-center space-y-1 max-w-full overflow-hidden">
          <div class="flex space-x-3">
            ${(!isSubmitted || hasPermission) ? `
              <!-- Sky blue Enter Data button - show if not submitted OR user has permission -->
              <button onclick="enterData('${form.traceability_code}', '${form.lot_letter}')" class="p-1.5 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-600 hover:text-sky-800 transition-all duration-200 border border-sky-200 hover:border-sky-300 flex-shrink-0" title="Enter Inspection Data">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
              </button>
              <!-- Green Edit button - show if not submitted OR user has permission -->
              <button onclick="editForm('${form.traceability_code}', '${form.lot_letter}')" class="p-1.5 rounded-md bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-800 transition-all duration-200 border border-green-200 hover:border-green-300 flex-shrink-0" title="Edit Form">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                </svg>
              </button>
            ` : ''}
          </div>
          <div class="flex space-x-3">
            <!-- Dark blue View button - always show -->
            <button onclick="viewForm('${form.traceability_code}', '${form.lot_letter}')" class="p-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 hover:text-blue-900 transition-all duration-200 border border-blue-200 hover:border-blue-300 flex-shrink-0" title="View Form">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
              </svg>
            </button>
            
            <!-- Red Delete button - show if not submitted OR user has permission -->
            ${(!isSubmitted || hasPermission) ? `
              <button onclick="deleteForm('${form.traceability_code}', '${form.lot_letter}')" class="p-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 transition-all duration-200 border border-red-200 hover:border-red-300 flex-shrink-0" title="Delete Form">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
              </button>
            ` : ''}
          </div>
        </div>
      </td>
      <td class="py-3 px-4 text-center whitespace-normal break-words">
        <button onclick="downloadFormExcel('${form.traceability_code}', '${form.lot_letter}', this)" class="p-1.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-800 transition-all duration-200 border border-indigo-200 hover:border-indigo-300 flex-shrink-0" title="Download Form Excel">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 10l5 5 5-5M12 15V3" />
          </svg>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Show message at bottom of table if there are more forms than the limit (only when not showing all for date filters)
  if (!showAllForDateFilters && forms.length > MAX_FORMS_DISPLAY) {
    const remainingCount = forms.length - MAX_FORMS_DISPLAY;
    const messageRow = document.createElement('tr');
    messageRow.innerHTML = `
      <td colspan="12" class="py-4 text-center text-sm text-gray-600 bg-gray-50 border-t border-gray-200">
        <div class="flex items-center justify-center space-x-2">
          <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span class="font-medium text-gray-700">Showing ${MAX_FORMS_DISPLAY} of ${forms.length} forms. Use filters above to find forms not listed here.</span>
        </div>
      </td>
    `;
    tbody.appendChild(messageRow);
  }
}

// ===== FORM ACTIONS =====
function enterData(traceability_code, lot_letter) {
  // Redirect to data entry page with traceability_code for entering data
  window.location.href = `inline-inspection-data.html?traceability_code=${traceability_code}&lot_letter=${lot_letter}`;
}

function viewForm(traceability_code, lot_letter) {
  // Redirect to data entry page in view-only mode
  window.location.href = `inline-inspection-data.html?traceability_code=${traceability_code}&lot_letter=${lot_letter}&mode=view`;
}

// Cache for form data to avoid repeated database calls
const formDataCache = new Map();

// Function to populate form with data (extracted for reuse)
function populateFormWithData(formData, form, submitButton) {
  // Store the record ID for update
  form.dataset.editRecordId = formData.id;
  form.dataset.isEditMode = 'true';
  
  // Use direct fields only - inspection_data column has been removed
  const dataToUse = {
    customer: formData.customer || '',
    production_no: formData.production_no || '',
    prod_code: formData.prod_code || '',
    spec: formData.spec || '',
    production_date: formData.production_date || '',
    emboss_type: formData.emboss_type || '',
    printed: formData.printed || false,
    non_printed: formData.non_printed || false,
    ct: formData.ct || false,
    year: formData.year || '',
    month: formData.month || '',
    date: formData.date || '',
    mc_no: formData.mc_no || '',
    shift: formData.shift || '',
    supervisor: formData.supervisor || '',
    supervisor2: formData.supervisor2 || '',
    operator: formData.operator || '',
    operator2: formData.operator2 || '',
    qc_inspector: formData.qc_inspector || '',
    qc_inspector2: formData.qc_inspector2 || ''
  };
  
  // Clear any existing validation styling before populating
  form.querySelectorAll('input, select').forEach(field => {
    field.classList.remove('required-field');
  });
  
  // Clear checkbox group error styling
  const checkboxGroup = form.querySelector('.flex.flex-row.items-center.gap-10.border.border-gray-200.bg-gray-50.rounded-lg.px-4.py-3.w-fit.mb-2');
  if (checkboxGroup) {
    checkboxGroup.classList.remove('checkbox-group-error');
  }
  
  // Hide product type error
  const productTypeError = document.getElementById('productTypeError');
  if (productTypeError) {
    productTypeError.classList.add('hidden');
  }
  
  // Filling form fields with data using proper field selectors
  try {
    const fields = {
      customer: form.querySelector('[name="customer"]'),
      production_no: form.querySelector('[name="production_no"]'),
      prod_code: form.querySelector('[name="prod_code"]'),
      spec: form.querySelector('[name="spec"]'),
      production_date: form.querySelector('[name="production_date"]'),
      emboss_type: form.querySelector('[name="emboss_type"]'),
      printed: form.querySelector('[name="printed"]'),
      non_printed: form.querySelector('[name="non_printed"]'),
      ct: form.querySelector('[name="ct"]'),
      year: form.querySelector('[name="year"]'),
      month: form.querySelector('[name="month"]'),
      date: form.querySelector('[name="date"]'),
      mc_no: form.querySelector('[name="mc_no"]'),
      shift: form.querySelector('[name="shift"]'),
      supervisor: form.querySelector('[name="supervisor"]'),
      supervisor2: form.querySelector('[name="supervisor2"]'),
      operator: form.querySelector('[name="operator"]'),
      operator2: form.querySelector('[name="operator2"]'),
      qc_inspector: form.querySelector('[name="qc_inspector"]'),
      qc_inspector2: form.querySelector('[name="qc_inspector2"]')
    };
    
    // Populate text and select fields
    Object.keys(fields).forEach(fieldName => {
      const field = fields[fieldName];
      if (field && fieldName !== 'printed' && fieldName !== 'non_printed' && fieldName !== 'ct') {
        field.value = dataToUse[fieldName] || '';
      }
    });
    
    // Populate checkboxes
    if (fields.printed) fields.printed.checked = !!dataToUse.printed;
    if (fields.non_printed) fields.non_printed.checked = !!dataToUse.non_printed;
    if (fields.ct) fields.ct.checked = !!dataToUse.ct;
    
            // console.log('Form populated successfully for editing');
  } catch (error) {
    console.error('Error populating form fields:', error);
    alert('Error loading form data. Please try again.');
    return;
  }
  
  // Setup autocomplete for edit mode
  setupPersonnelAutocomplete();
  setupProductAutocomplete();
  
  // Ensure form submission handler is attached
  if (form) {
    form.onsubmit = handleFormSubmit;
  }
  
  // Restore button state
  submitButton.textContent = 'Update Inline Inspection Form';
  submitButton.disabled = false;
}

async function editForm(traceability_code, lot_letter) {
      // console.log('EditForm called for:', { traceability_code, lot_letter });
  
  // Show modal immediately for better UX
  const overlay = document.getElementById('inspectionFormOverlay');
  const form = document.getElementById('inlineInspectionEntryForm');
  const modalTitle = overlay.querySelector('h3');
  const submitButton = form.querySelector('button[type="submit"]');
  
  if (!overlay || !form) {
    console.error('Overlay or form not found');
    return;
  }
  
  // Update modal title and button for edit mode immediately
  if (modalTitle) {
    modalTitle.textContent = 'Edit Inline Inspection Form Details';
  }
  if (submitButton) {
    submitButton.textContent = 'Update Inline Inspection Form';
  }
  
  // Update warning message for edit mode
  const warningMessage = overlay.querySelector('p.text-red-600');
  if (warningMessage) {
    warningMessage.textContent = '*Note : Please ensure all entered details are correct before updating form';
  }
  
  // Show the overlay immediately
  overlay.style.display = 'flex';
  overlay.classList.remove('hidden');
  
  // Always fetch fresh data from database (no cache check)
  submitButton.textContent = 'Loading...';
  submitButton.disabled = true;

  try {
    // Find the record across all tables
    let selectedFormData = null;
    const tables = ['inline_inspection_form_master_1', 'inline_inspection_form_master_2', 'inline_inspection_form_master_3'];
    
    for (const table of tables) {
      const { data: allData, error: listError } = await supabase
        .from(table)
        .select(`
          id, traceability_code, lot_letter, customer, production_no, prod_code, spec,
          production_date, emboss_type, printed, non_printed, ct, year, month, date,
          mc_no, shift, supervisor, supervisor2, line_leader, line_leader2,
          operator, operator2, qc_inspector, qc_inspector2, status,
          total_rolls, accepted_rolls, rejected_rolls, rework_rolls, kiv_rolls,
          created_at, updated_at
        `)
        .eq('traceability_code', traceability_code)
        .eq('lot_letter', lot_letter);

      if (!listError && allData && allData.length > 0) {
        // Prefer exact match by lot_letter (query already filters by it). Fallback to any record
        selectedFormData = allData.find(f => (f.customer || f.production_no || f.prod_code || f.spec)) || allData[0];
        break;
      }
    }

    if (!selectedFormData) {
      console.error('No form with data found for traceability_code and lot_letter:', traceability_code, lot_letter);
      alert('No form data found for editing.');
      // Reset button state
      submitButton.textContent = 'Update Inline Inspection Form';
      submitButton.disabled = false;
      return;
    }

    // Populate the form with the fetched data (no caching)
    populateFormWithData(selectedFormData, form, submitButton);

  } catch (error) {
    console.error('Error in editForm function:', error);
    alert('Error loading form for editing. Please try again.');
    // Reset button state on error
    submitButton.textContent = 'Update Inline Inspection Form';
    submitButton.disabled = false;
  }
}

async function deleteForm(traceability_code, lot_letter) {
  // Store the form details for deletion
  window.pendingDeleteForm = { traceability_code, lot_letter };
  
  // Show first confirmation overlay
  const deleteOverlay = document.getElementById('deleteConfirmationOverlay');
  const deleteMessage = document.getElementById('deleteConfirmationMessage');
  deleteMessage.textContent = 'Are you sure you want to delete this inline form?';
  deleteOverlay.style.display = 'flex';
}

async function confirmDelete() {
  // Hide first confirmation overlay
  const deleteOverlay = document.getElementById('deleteConfirmationOverlay');
  deleteOverlay.style.display = 'none';
  
  // Show final warning overlay
  const finalWarningOverlay = document.getElementById('finalDeleteWarningOverlay');
  finalWarningOverlay.style.display = 'flex';
}

async function confirmFinalDelete() {
  const { traceability_code, lot_letter } = window.pendingDeleteForm;
  
  try {
    // Find the record across all tables to determine which table it belongs to
    let tableName = null;
    const tables = ['inline_inspection_form_master_1', 'inline_inspection_form_master_2', 'inline_inspection_form_master_3'];
    
    for (const table of tables) {
      const { data: record, error } = await supabase
        .from(table)
        .select('id')
        .eq('traceability_code', traceability_code)
        .eq('lot_letter', lot_letter)
        .single();
        
      if (!error && record) {
        tableName = table;
        break;
      }
    }
    
    if (!tableName) {
      console.error('Record not found in any table for deletion:', traceability_code, lot_letter);
      alert('Error: Record not found for deletion.');
      return;
    }
    
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('traceability_code', traceability_code)
      .eq('lot_letter', lot_letter);
    
    if (error) {
      console.error('Error deleting form:', error);
      alert('Error deleting form: ' + error.message);
      return;
    }
    
    loadFormsTable();
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error deleting form: ' + error.message);
  } finally {
    // Hide final warning overlay
    const finalWarningOverlay = document.getElementById('finalDeleteWarningOverlay');
    finalWarningOverlay.style.display = 'none';
    
    // Clear pending delete data
    delete window.pendingDeleteForm;
  }
}

function cancelDelete() {
  // Hide first confirmation overlay
  const deleteOverlay = document.getElementById('deleteConfirmationOverlay');
  deleteOverlay.style.display = 'none';
  
  // Clear pending delete data
  delete window.pendingDeleteForm;
}

function cancelFinalDelete() {
  // Hide final warning overlay
  const finalWarningOverlay = document.getElementById('finalDeleteWarningOverlay');
  finalWarningOverlay.style.display = 'none';
  
  // Clear pending delete data
  delete window.pendingDeleteForm;
}

// Make form actions globally accessible for onclick handlers
window.enterData = enterData;
window.viewForm = viewForm;
window.editForm = editForm;
window.deleteForm = deleteForm;
window.confirmDelete = confirmDelete;
window.confirmFinalDelete = confirmFinalDelete;
window.cancelDelete = cancelDelete;
window.cancelFinalDelete = cancelFinalDelete;

// Add a placeholder for the download function
window.downloadFormExcel = async function(traceability_code, lot_letter, buttonElement) {
  // Show loading state
  const downloadBtn = buttonElement || document.querySelector('[onclick*="downloadFormExcel"]');
  const originalContent = downloadBtn ? downloadBtn.innerHTML : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>';
  const originalTitle = downloadBtn ? downloadBtn.title : '';

  if (downloadBtn) {
    downloadBtn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
    downloadBtn.title = 'Downloading...';
    downloadBtn.disabled = true;
  }

  try {

    // Call the Node.js export server with specific form parameters
    // Use localhost for IDE testing, Render URL for production
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const backendUrl = isLocalhost ? 'http://localhost:3000' : 'https://swanson-backend.onrender.com';
    const exportUrl = `${backendUrl}/export?traceability_code=${encodeURIComponent(traceability_code)}&lot_letter=${encodeURIComponent(lot_letter)}`;

    // Add timeout for slow connections
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 minute timeout

    // Get the current session for authentication
    const session = await supabase.auth.getSession();
    const headers = {
      'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    // Add authorization header if session exists
    if (session.data.session?.access_token) {
      headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
    }

    const response = await fetch(exportUrl, {
      method: 'GET',
      signal: controller.signal,
      credentials: 'include',
      headers: headers,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    
    // Get filename from Content-Disposition header if available
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `inspection_form_${traceability_code}_${lot_letter}.xlsx`;
    
            // console.log('Content-Disposition header:', contentDisposition); // Debug log
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
        // console.log('Extracted filename:', filename); // Debug log
      }
    }
    
    // Fallback: Create a simple filename if header is not available
    if (!contentDisposition || contentDisposition === 'null') {
      filename = `In-Line_Inspection_Form_${traceability_code}_${lot_letter}.xlsx`;
              // console.log('Using fallback filename:', filename); // Debug log
    }
    
            // console.log('Final filename:', filename); // Debug log
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    // Success message
    showSuccessMessage('Excel file downloaded successfully!');
    
  } catch (error) {
    console.error('Download failed:', error);
    
    if (error.name === 'AbortError') {
      showErrorMessage('Request timed out. Please try again or check your internet connection.');
    } else {
      showErrorMessage('Failed to download Excel file. Please try again.');
    }
  } finally {
    // Reset button state
    const downloadBtn = buttonElement || document.querySelector('[onclick*="downloadFormExcel"]');
    if (downloadBtn) {
      downloadBtn.innerHTML = originalContent;
      downloadBtn.title = originalTitle;
      downloadBtn.disabled = false;
    }
  }
};


function showSuccessMessage(message) {
  showMessage(message, 'success');
}

function showErrorMessage(message) {
  showMessage(message, 'error');
}

function showMessage(message, type) {
  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 5px;
    color: white;
    z-index: 10000;
    font-weight: bold;
    ${type === 'success' ? 'background: #28a745;' : 'background: #dc3545;'}
  `;
  messageDiv.textContent = message;
  document.body.appendChild(messageDiv);
  
  setTimeout(() => {
    messageDiv.remove();
  }, 5000);
}

// ===== UTILITY FUNCTIONS =====
function getTableNameForMachine(mcNo) {
  // Normalize machine number (handle both '1' and '01')
  const normalizedMcNo = String(mcNo).padStart(2, '0');
  if (normalizedMcNo === '01') return 'inline_inspection_form_master_1';
  if (normalizedMcNo === '02') return 'inline_inspection_form_master_2';
  if (normalizedMcNo === '03') return 'inline_inspection_form_master_3';
  // Default to table_2 for any other machine numbers
  return 'inline_inspection_form_master_2';
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB');
}

// ===== FIELD ERROR HANDLING =====
function showFieldError(input, message) {
            // console.log(`🚨 Showing error for field: ${input.name}, value: "${input.value}"`);
    
    // Remove any existing error message for this field
    clearFieldError(input);
    
    // Add error styling to input
    input.classList.add('required-field');
    
    // Create floating error tooltip
    const errorTooltip = document.createElement('div');
    errorTooltip.className = 'field-error-tooltip';
    errorTooltip.innerHTML = `
        <div class="field-error-tooltip-content">
            <div class="field-error-tooltip-arrow"></div>
            <div class="field-error-icon">!</div>
            <div class="field-error-tooltip-text">${message}</div>
        </div>
    `;
    
    // Add base styles for the floating tooltip
    errorTooltip.style.cssText = `
        position: absolute;
        z-index: 10000;
        pointer-events: none;
    `;
    
    // Add styles for tooltip content
    const tooltipContent = errorTooltip.querySelector('.field-error-tooltip-content');
    tooltipContent.style.cssText = `
        background: #f8f9fa;
        color: #495057;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        position: relative;
        max-width: 300px;
        border: 1px solid #dee2e6;
        display: flex;
        align-items: flex-start;
        gap: 8px;
        word-wrap: break-word;
        white-space: normal;
    `;
    

    
    // Add styles for exclamation icon
    const errorIcon = errorTooltip.querySelector('.field-error-icon');
    errorIcon.style.cssText = `
        background: #fd7e14;
        color: white;
        width: 16px;
        height: 16px;
        border-radius: 2px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: bold;
        flex-shrink: 0;
        margin-top: 1px;
    `;
    
    // Add styles for error text
    const errorText = errorTooltip.querySelector('.field-error-tooltip-text');
    errorText.style.cssText = `
        flex: 1;
        word-wrap: break-word;
        white-space: normal;
        line-height: 1.4;
    `;
    
    // Position tooltip relative to the input field itself
    const inputRect = input.getBoundingClientRect();
    const parentContainer = input.parentNode;
    parentContainer.style.position = 'relative';
    parentContainer.appendChild(errorTooltip);
    
    // Calculate position relative to the input field
    const fieldTop = input.offsetTop;
    const fieldHeight = input.offsetHeight;
    const fieldWidth = input.offsetWidth;
    
    // Position tooltip BELOW the field
    errorTooltip.style.position = 'absolute';
    errorTooltip.style.top = `${fieldTop + fieldHeight + 4}px`;
    errorTooltip.style.left = `${input.offsetLeft}px`;
    errorTooltip.style.width = `${fieldWidth}px`;
    errorTooltip.style.zIndex = '10000';
    
            // console.log(`📍 Field: ${input.name}, Top: ${fieldTop}, Height: ${fieldHeight}, Width: ${fieldWidth}`);
        // console.log(`📍 Tooltip positioned at: Top=${fieldTop + fieldHeight + 4}px, Left=${input.offsetLeft}px`);
    
    // Arrow points UP to the field
    const arrow = errorTooltip.querySelector('.field-error-tooltip-arrow');
    arrow.style.cssText = `
        position: absolute;
        top: -6px;
        left: 20px;
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-bottom: 6px solid #f8f9fa;
    `;
    
    // Store reference to tooltip on the input for easy removal
    input.errorTooltip = errorTooltip;
}

function clearFieldError(input) {
    // Remove error styling
    input.classList.remove('required-field');
    
    // Remove error tooltip if it exists
    if (input.errorTooltip) {
        input.errorTooltip.remove();
        input.errorTooltip = null;
    }
}

// ===== PAGE UNLOAD CLEANUP =====
// Use beforeunload for cleanup (more reliable than unload)
window.addEventListener('beforeunload', function() {
    cleanupResources();
});

// Use pagehide instead of unload for better browser compatibility
window.addEventListener('pagehide', function() {
    cleanupResources();
});

// Additional cleanup on visibility change (when user switches tabs)
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
        // Optional: cleanup when user switches away from the page
        // cleanupResources();
    }
});

// Add autocomplete functionality for personnel fields
async function setupPersonnelAutocomplete() {
            // Setting up personnel autocomplete
    
    // Fetch all users from the database
    const { data: users, error } = await supabase
        .from('users')
        .select('full_name, department')
        .order('full_name');
    
    if (error) {
        console.error('❌ Error fetching users:', error);
        return;
    }
    
            // Fetched users
    
    // Filter users by department
    const productionUsers = users.filter(user => 
        user.department === 'Production'
    );
    const qcUsers = users.filter(user => 
        user.department === 'Quality Control' || user.department === 'Quality Assurance'
    );
    
            // Production and QC users filtered
    
    // Setup autocomplete for each field
    const personnelFields = [
        { name: 'supervisor', users: productionUsers },
        { name: 'supervisor2', users: productionUsers },
        { name: 'operator', users: productionUsers },
        { name: 'operator2', users: productionUsers },
        { name: 'qc_inspector', users: qcUsers },
        { name: 'qc_inspector2', users: qcUsers }
    ];
    
    personnelFields.forEach(field => {
        const input = document.querySelector(`input[name="${field.name}"]`);
        // Looking for field
        if (input) {
            // Found field, setting up autocomplete
            setupAutocompleteForField(input, field.users);
        } else {
            // Field not found
        }
    });
}

async function setupProductAutocomplete() {
            // Setting up product autocomplete
    
    // Fetch all products from the database
    const { data: products, error } = await supabase
        .from('inline_products_master')
        .select('customer, prod_code, spec')
        .eq('is_active', true)
        .order('customer');
    
    if (error) {
        console.error('❌ Error fetching products:', error);
        return;
    }
    
            // Fetched products
    
    // Setup autocomplete for product fields
    const productFields = [
        { name: 'customer', field: 'customer', products: products },
        { name: 'prod_code', field: 'prod_code', products: products },
        { name: 'spec', field: 'spec', products: products }
    ];
    
    productFields.forEach(field => {
        const input = document.querySelector(`input[name="${field.name}"]`);
        // Looking for field
        if (input) {
            // Found field, setting up autocomplete
            setupProductAutocompleteForField(input, field.products, field.field);
        } else {
            // Field not found
        }
    });
}

function setupAutocompleteForField(input, users) {
            // Setting up autocomplete for field
    let dropdown = null;
    let originalValue = ''; // Store original value before typing
    
    // Store valid names for validation
    const validNames = users.map(user => user.full_name.toLowerCase());
    
    input.addEventListener('focus', function() {
        // Store the current value when focusing (in case user was editing)
        originalValue = this.value;
        
        // Clear any existing error when user starts typing again
        clearFieldError(input);
    });
    
    input.addEventListener('input', function() {
        const value = this.value.toLowerCase();
        
        // Remove existing dropdown
        if (dropdown) {
            dropdown.remove();
            dropdown = null;
        }
        
        if (value.length < 1) return;
        
        // Filter users based on input
        const matches = users.filter(user => 
            user.full_name.toLowerCase().includes(value)
        ).slice(0, 5); // Limit to 5 suggestions
        
        if (matches.length === 0) return;
        
        // Create dropdown
        dropdown = document.createElement('div');
        dropdown.className = 'absolute z-50 w-full border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto';
        dropdown.style.top = '100%';
        dropdown.style.left = '0';
        dropdown.style.background = '#eaf4fb'; // Light blue background
        
        matches.forEach(user => {
            const item = document.createElement('div');
            item.className = 'px-3 py-2 hover:bg-blue-200 cursor-pointer text-sm';
            item.textContent = user.full_name;
            item.addEventListener('click', function() {
                input.value = user.full_name;
                dropdown.remove();
                dropdown = null;
                // Selected user
                
                // Clear any existing error when valid option is selected
                clearFieldError(input);
            });
            dropdown.appendChild(item);
        });
        
        // Position dropdown
        const rect = input.getBoundingClientRect();
        dropdown.style.width = rect.width + 'px';
        
        // Add to DOM
        input.parentNode.style.position = 'relative';
        input.parentNode.appendChild(dropdown);
    });
    
    // Validate on blur - ensure only valid names are accepted
    input.addEventListener('blur', function() {
        setTimeout(() => {
            if (dropdown) {
                dropdown.remove();
                dropdown = null;
            }
            
            // Validate the current value
            const currentValue = this.value.toLowerCase();
            
            if (currentValue && !validNames.includes(currentValue)) {
                // Invalid name entered - revert to original or clear
                if (originalValue && validNames.includes(originalValue.toLowerCase())) {
                    this.value = originalValue;
                    // console.log(`⚠️ Reverted to original valid value: ${originalValue}`);
                } else {
                    this.value = '';
                    // console.log(`⚠️ Cleared invalid value: ${currentValue}`);
                }
                
                // Show field-specific error message
                showFieldError(input, 'Please select a valid name from the dropdown list.');
            } else {
                // Clear any existing error for this field
                clearFieldError(input);
            }
        }, 200); // Increased delay to allow dropdown selection
    });
    
    // Remove dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (dropdown && !input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.remove();
            dropdown = null;
        }
    });
    
    // Prevent form submission if invalid names are present
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            const currentValue = this.value.toLowerCase();
            if (currentValue && !validNames.includes(currentValue)) {
                e.preventDefault();
                showFieldError(input, 'Please select a valid name from the dropdown list.');
                this.focus();
            }
        }
    });
}

function setupProductAutocompleteForField(input, products, fieldType) {
    let dropdown = null;
    
    input.addEventListener('input', function() {
        const value = this.value.toLowerCase();
        
        // Remove existing dropdown
        if (dropdown) {
            dropdown.remove();
            dropdown = null;
        }
        
        if (value.length < 1) return;
        
        // Filter products based on input and field type
        let matches = products.filter(product => 
            product[fieldType].toLowerCase().includes(value)
        );
        
        // For customer field, show only unique customers
        if (fieldType === 'customer') {
            const uniqueCustomers = [...new Set(matches.map(product => product.customer))];
            matches = uniqueCustomers.map(customer => ({ customer }));
        }
        
        // No limit - show all matches since there aren't many products
        
        if (matches.length === 0) return;
        
        // Create dropdown
        dropdown = document.createElement('div');
        dropdown.className = 'absolute z-50 w-full border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto';
        dropdown.style.top = '100%';
        dropdown.style.left = '0';
        dropdown.style.background = '#eaf4fb'; // Light blue background
        
        matches.forEach(product => {
            const item = document.createElement('div');
            item.className = 'px-3 py-2 hover:bg-blue-200 cursor-pointer text-sm';
            
            // Show different information based on field type
            let displayText = '';
            if (fieldType === 'customer') {
                displayText = product.customer;
            } else if (fieldType === 'prod_code') {
                displayText = `${product.prod_code} (${product.customer})`;
            } else if (fieldType === 'spec') {
                displayText = `${product.spec} (${product.customer} - ${product.prod_code})`;
            }
            
            item.textContent = displayText;
            item.addEventListener('click', function() {
                input.value = product[fieldType];
                dropdown.remove();
                dropdown = null;
                // console.log(`✅ Selected: ${product[fieldType]}`);
                
                // Auto-fill related fields if they exist
                if (fieldType === 'customer') {
                    const prodCodeInput = document.querySelector('input[name="prod_code"]');
                    const specInput = document.querySelector('input[name="spec"]');
                    
                    // Find matching products for this customer
                    const customerProducts = products.filter(p => p.customer === product.customer);
                    if (customerProducts.length === 1) {
                        if (prodCodeInput) prodCodeInput.value = customerProducts[0].prod_code;
                        if (specInput) specInput.value = customerProducts[0].spec;
                    }
                } else if (fieldType === 'prod_code') {
                    const customerInput = document.querySelector('input[name="customer"]');
                    const specInput = document.querySelector('input[name="spec"]');
                    
                    if (customerInput) customerInput.value = product.customer;
                    if (specInput) specInput.value = product.spec;
                } else if (fieldType === 'spec') {
                    const customerInput = document.querySelector('input[name="customer"]');
                    const prodCodeInput = document.querySelector('input[name="prod_code"]');
                    
                    if (customerInput) customerInput.value = product.customer;
                    if (prodCodeInput) prodCodeInput.value = product.prod_code;
                }
            });
            dropdown.appendChild(item);
        });
        
        // Position dropdown
        const rect = input.getBoundingClientRect();
        dropdown.style.width = rect.width + 'px';
        
        // Add to DOM
        input.parentNode.style.position = 'relative';
        input.parentNode.appendChild(dropdown);
    });
    
    // Remove dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (dropdown && !input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.remove();
            dropdown = null;
        }
    });
    
    // Remove dropdown on blur
    input.addEventListener('blur', function() {
        setTimeout(() => {
            if (dropdown) {
                dropdown.remove();
                dropdown = null;
            }
        }, 150);
    });
}



