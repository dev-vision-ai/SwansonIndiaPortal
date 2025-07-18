// Back button and mutually exclusive checkboxes logic
window.addEventListener('DOMContentLoaded', function() {
  // Back button navigation
  const backBtn = document.querySelector('.header-back-button');
  if (backBtn) {
    backBtn.addEventListener('click', function() {
      window.location.href = 'employee_dashboard.html';
    });
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
});

// Show/hide overlay for Inline Inspection Form
window.addEventListener('DOMContentLoaded', function() {
  const overlay = document.getElementById('inspectionFormOverlay');
  const closeBtn = document.getElementById('closeInspectionFormOverlay');
  const createBtn = document.getElementById('showInspectionFormOverlay');

  if (createBtn && overlay) {
    createBtn.addEventListener('click', function(e) {
      e.preventDefault && e.preventDefault();
      overlay.classList.remove('hidden');
    });
  }
  if (closeBtn && overlay) {
    closeBtn.addEventListener('click', function() {
      overlay.classList.add('hidden');
    });
  }
});
