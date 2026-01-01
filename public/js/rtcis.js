import { supabase } from '../supabase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('rtcisForm');
    if (!form) return;

    // Disable autocomplete to prevent history pop-ups
    form.setAttribute('autocomplete', 'off');
    const inputs = form.querySelectorAll('input');
    inputs.forEach(input => {
        input.setAttribute('autocomplete', 'off');
    });

    // --- Configurable SSCC values ---
    const COMPANY_PREFIX = '0037000'; // Update as needed
    let serialReference = '000000001'; // Update logic as needed

    // Helper: Pad left with zeros
    function padLeft(str, len) {
        return str.toString().padStart(len, '0');
    }

    // Helper: Modulo 10 check digit (Luhn algorithm)
    function calculateModulo10(number) {
      let sum = 0;
      for (let i = number.length - 1; i >= 0; i--) {
        const digit = parseInt(number[i], 10);
        const weight = ((number.length - 1 - i) % 2 === 0) ? 3 : 1;
        sum += digit * weight;
      }
      return (10 - (sum % 10)) % 10;
    }
    
    // Helper: Generate SSCC (20 digits)
    function generateSSCC(companyPrefix, serialRef) {
        const extensionDigit = '1'; // Can be 0-9, use 1 for now
        const company = padLeft(companyPrefix, 7); // 7 digits
        const serial = padLeft(serialRef, 9); // 9 digits
        const base = extensionDigit + company + serial;
        const checkDigit = calculateModulo10(base);
        return base + checkDigit;
    }

// ✅ Fully GS1-128 compliant barcode generator using bwip-js
async function generateBarcodes(data) {
    try {
        // Ensure net weight is digits only for GS1-128 AI 37
        const netWeightClean = String(data.net_weight).replace(/[^0-9]/g, '');

        // GCAS / Net Wt. → JsBarcode (simple CODE128, decimal preserved)
try {
  const gcasText = `91${data.irms_gcas}37${data.net_weight}`;
  JsBarcode('#barcode-gcas', gcasText, {
    format: 'CODE128',
    width: 5,
    height: 40,
    displayValue: false,
  });
  // Move barcode up
        const barcodeGcasSvg = document.getElementById('barcode-gcas');
        if (barcodeGcasSvg) {
            barcodeGcasSvg.style.marginBottom = '5px';
            barcodeGcasSvg.style.marginTop = '-10px';
            barcodeGcasSvg.style.background = '#fff';
        }
        document.getElementById('barcode-gcas-text').textContent = `(91) ${data.irms_gcas}(37)${netWeightClean}`;
  // Human-readable text below
  document.getElementById('barcode-gcas-text').textContent =
    `(91) ${data.irms_gcas}(37)${data.net_weight}`;
} catch (err) {
  console.error('GCAS barcode generation failed:', err);
}

    // Lot Number: encode ONLY AI (10) in the barcode so (90) is NOT part of the scanned data.
    // Keep (90) visible in the human-readable text (with a '~' shown to indicate the group separator).
    bwipjs.toCanvas('barcode-lot', {
      bcid: 'gs1-128',
      // Only include the variable-length Lot (AI 10) in the machine data.
      text: `(10)${data.lot_number}`,
      scale: 5,
      height: 15,
      includetext: false,
      backgroundcolor: 'FFFFFF',
      paddingheight: 10
    });

    // Human-readable: show the tilde (~) as a visual marker for the GS1 group separator
    // and include the (90) value for users, but note (90) will NOT be encoded/scannable.
    document.getElementById('barcode-lot-text').textContent = `(10) ${data.lot_number}~(90)${data.pallet_type}`;

        // SSCC / Unit Load ID (AI 00)
        bwipjs.toCanvas('barcode-sscc', {
            bcid: 'gs1-128',
            text: `(00)${data.sscc}`,
            scale: 5,
            height: 15,
            includetext: false,
            backgroundcolor: 'FFFFFF',
            paddingheight: 10
        });
        const sscc = data.sscc;
        const hrSSCC = `(00) ${sscc[0]} ${sscc.slice(1,8)} ${sscc.slice(8,17)} ${sscc.slice(17)}`;
        document.getElementById('barcode-sscc-text').textContent = hrSSCC;
        // --- If PNGs are needed for PDF export or similar: ---
        // Return PNG data URLs for each barcode
        const barcodeGcasPng = document.getElementById('barcode-gcas').toDataURL('image/png');
        const barcodeLotPng = document.getElementById('barcode-lot').toDataURL('image/png');
        const barcodeSsccPng = document.getElementById('barcode-sscc').toDataURL('image/png');
        return { barcodeGcasPng, barcodeLotPng, barcodeSsccPng };
    } catch (err) {
        console.error('Barcode generation failed:', err);
        alert('Barcode generation failed — check console.');
        return false;
    }
}

// --- GS1 Mod-10 check-digit calculation ---
function calculateGS1Mod10(number) {
  let sum = 0;
  for (let i = number.length - 1; i >= 0; i--) {
      const n = parseInt(number[i], 10);
      const weight = ((number.length - 1 - i) % 2 === 0) ? 3 : 1;
      sum += n * weight;
  }
  return (10 - (sum % 10)) % 10;
}

// --- Canvas spacing helper ---
function setBarcodeCanvasStyle(id) {
  const c = document.getElementById(id);
  if (c) {
      c.style.marginTop = '-5px';
      c.style.marginBottom = '0px';
      c.style.background = '#fff';
  }

        // Also render to canvas for PDF export and return base64
        function svgToCanvasBase64(svgSelector) {
            const svg = document.querySelector(svgSelector);
            if (!svg) return '';
            const xml = new XMLSerializer().serializeToString(svg);
            const svg64 = btoa(unescape(encodeURIComponent(xml)));
            const image64 = 'data:image/svg+xml;base64,' + svg64;
            return new Promise((resolve) => {
                const img = new window.Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.src = image64;
            });
        }
        return Promise.all([
            svgToCanvasBase64('#barcode-gcas'),
            svgToCanvasBase64('#barcode-lot'),
            svgToCanvasBase64('#barcode-sscc')
        ]);
    }

    // Helper: Format date from YYYY-MM-DD to DD-MMM-YYYY
    function formatDateToDDMMMYYYY(dateStr) {
        if (!dateStr) return '';
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const [year, month, day] = dateStr.split('-');
        return `${day}-${months[parseInt(month, 10) - 1]}-${year}`;
    }

    // Helper: Fill label layout
    function fillLabel(data) {
        document.getElementById('label-product').textContent = data.product_code;
        document.getElementById('label-gcas-head').textContent = data.irms_gcas;
        document.getElementById('label-prod-date').textContent = formatDateToDDMMMYYYY(data.production_date);
        document.getElementById('label-item').textContent = data.material_description;
        document.getElementById('label-width').textContent = data.width;
        document.getElementById('label-height').textContent = data.height;
        document.getElementById('label-gross').textContent = data.gross_weight;
        document.getElementById('label-net').textContent = data.net_weight;
        document.getElementById('label-gcas').textContent = data.irms_gcas;
        document.getElementById('label-lot').textContent = data.lot_number;
        document.getElementById('label-pi').textContent = data.pi_number;
        document.getElementById('label-palletnum').textContent = `${data.pallet_number} / (${data.quantity} Rolls)`;
        document.getElementById('label-qty').textContent = data.net_weight;
        document.getElementById('label-seq').textContent = data.sequence_number;
        document.getElementById('label-basis').textContent = data.basis_weight;
        document.getElementById('label-pallettype').textContent = data.pallet_type;
    }

    // --- Create label HTML structure in a hidden div ---
    function ensureLabelDiv() {
        let div = document.getElementById('label-print-area');
        if (!div) {
            div = document.createElement('div');
            div.id = 'label-print-area';
            div.style.position = 'absolute';
            div.style.left = '-9999px';
            // Inject improved CSS for label
            const style = document.createElement('style');
            style.textContent = `
              .rtcis-label-table {
                width: 185mm;
                border-collapse: collapse;
                font-family: 'Calibri', Arial, sans-serif;
                font-size: 12pt;
                background: #fff !important;
                table-layout: fixed;
                border: 2px solid #000 !important;
                transform: scale(0.9);
                transform-origin: top left;
              }
              .rtcis-label-table td, .rtcis-label-table th {
                border: 2px solid #000 !important;
                padding: 10px 18px 26px 18px !important;
                line-height: 1.3 !important;
                min-height: 32px !important;
                box-sizing: border-box !important;
                word-break: break-word;
                white-space: normal;
                overflow-wrap: break-word;
                background: #fff !important;
                text-align: left;
                vertical-align: middle;
              }
              /* Remove vertical border between width/height and gross/net cells */
              .rtcis-label-table .no-vertical-border {
                border-right: none !important;
              }
              .rtcis-label-table .no-vertical-border-next {
                border-left: none !important;
              }
              /* Barcode SVG and human text: center-center */
              .barcode {
                text-align: center !important;
                vertical-align: middle !important;
                margin-bottom: 15px !important;
              }
              .rtcis-barcode-human {
                text-align: center !important;
                vertical-align: middle !important;
                margin-top: 10px !important;
                padding-top: 5px !important;
                font-weight: bold !important;
              }
              /* Barcode label (e.g., 'GCAS/ Net wt.'): left-aligned */
              .rtcis-barcode-label {
                font-weight: bold;
                font-size: 15pt;
                margin-bottom: 8px;
                display: block;
                padding-left: 0;
                text-align: left !important;
                vertical-align: middle !important;
              }
              .rtcis-label-header {
                font-weight: bold;
                font-size: 12pt;
                text-align: left;
                vertical-align: middle;
              }
              .rtcis-label-supplier {
                font-size: 15pt;
                font-weight: normal;
                text-align: left;
                vertical-align: middle;
                word-break: break-word;
                max-width: 250px;
                max-height: 60px;
                overflow: hidden;
                text-overflow: ellipsis;
                line-height: 1.1;
              }
              .rtcis-label-item {
                font-size: 18pt;
                font-weight: bold;
                /* No text-transform: show as-is from Supabase */
                text-align: left;
                vertical-align: middle;
              }
              .rtcis-table-heading {
                font-size: 15pt;
                font-weight: bold;
                text-align: left;
                vertical-align: middle;
              }
              .rtcis-table-value {
                font-size: 15pt;
                font-weight: normal;
                text-align: left;
                vertical-align: middle;
              }
              .rtcis-barcode-section {
                padding: 12px 0 12px 0;
              }
              .rtcis-barcode-label {
                font-weight: bold;
                font-size: 15pt;
                margin-bottom: 4px;
                display: block;
                padding-left: 12px;
              }
              .rtcis-barcode-human {
                text-align: center;
                font-size: 14pt;
                font-family: 'Calibri', Arial, sans-serif;
                margin-top: 6px;
                vertical-align: middle;
              }
              /* Flex layout for merged cells with two columns, values under headings */
              .rtcis-flex-2col {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 32px;
                padding: 0;
              }
              .rtcis-flex-col {
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                min-width: 90px;
                padding: 0;
              }
              .a4-sheet {
                width: 155.448mm;
                height: 184.912mm;
                margin: 0;
                padding: 0;
                background: #fff;
                box-sizing: border-box;
                display: block;
                page-break-after: always;
              }
              .rtcis-label-table {
                transform: scale(0.9);
                transform-origin: center center;
                margin: 0;
              }
            `;
            div.appendChild(style);
            div.innerHTML += `
            <div class="a4-sheet" style="width:210mm;height:297mm;margin:0 auto;background:#fff;box-sizing:border-box;display:flex;align-items:center;justify-content:center;page-break-after:always;">
              <table class="rtcis-label-table">
                <tr>
                  <br>
                  <td colspan="2" class="rtcis-label-header" style="font-size:11pt;">Swanson Plastics (India) Private Limited, Bhuimpal, Goa</td>
                  <td colspan="2" class="rtcis-label-supplier">
                    <span class="label">Supplier Product:</span> <span class="value" id="label-product"></span><br>
                    <span class="label">IRMS GCAS:</span> <span class="value" id="label-gcas-head"></span><br>
                    <span class="label">Prod Date:</span> <span class="value" id="label-prod-date"></span>
                  </td>
                </tr>
                <tr>
                  <td colspan="4" class="rtcis-label-item"><span style='font-weight:bold;'>ITEM:</span> <span id="label-item"></span></td>
                </tr>
                <!-- Merged two-cell layout: WIDTH+HEIGHT and GROSS+NET, values under headings -->
                <tr>
                  <td class="rtcis-table-heading" colspan="2" style="width:50%;">
                    <div class="rtcis-flex-2col">
                      <div class="rtcis-flex-col">
                        <span>WIDTH (MM):</span>
                        <span class="rtcis-table-value" id="label-width"></span>
                      </div>
                      <div class="rtcis-flex-col">
                        <span>HEIGHT (MM):</span>
                        <span class="rtcis-table-value" id="label-height"></span>
                      </div>
                    </div>
                  </td>
                  <td class="rtcis-table-heading" colspan="2" style="width:50%;">
                    <div class="rtcis-flex-2col">
                      <div class="rtcis-flex-col">
                        <span>GROSS wt.(KG):</span>
                        <span class="rtcis-table-value" id="label-gross"></span>
                      </div>
                      <div class="rtcis-flex-col">
                        <span>NET wt.(KG):</span>
                        <span class="rtcis-table-value" id="label-net"></span>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="font-size:13pt;">IRMS GCAS#: <span class="value" id="label-gcas"></span></td>
                  <td colspan="2" style="font-size:13pt;">LOT#: <span class="value" id="label-lot"></span></td>
                </tr>
                <tr>
                  <td colspan="2" style="font-size:13pt;">PI Number: <span class="value" id="label-pi"></span></td>
                  <td colspan="2" style="font-size:13pt;">Pallet Number: <span class="value" id="label-palletnum"></span></td>
                </tr>
                <tr>
                  <td colspan="2" style="font-size:13pt;">QUANTITY (KG): <span class="value" id="label-qty"></span></td>
                  <td colspan="2" style="font-size:13pt;">Sequence Number: <span class="value" id="label-seq"></span></td>
                </tr>
                <tr>
                  <td colspan="2" style="font-size:13pt;">BASIS WEIGHT (GSM): <span class="value" id="label-basis"></span></td>
                  <td colspan="2" style="font-size:13pt;">PALLET TYPE : <span class="value" id="label-pallettype"></span></td>
                </tr>
                <tr>
                  <td colspan="4" class="rtcis-barcode-section">
                    <span class="rtcis-barcode-label">GCAS/ Net wt.</span>
                    <div class="barcode" style="text-align:center;height:27pt;line-height:27pt;"><canvas id="barcode-gcas"></canvas></div>
                    <div class="rtcis-barcode-human" id="barcode-gcas-text"></div>
                  </td>
                </tr>
                <tr>
                  <td colspan="4" class="rtcis-barcode-section">
                    <span class="rtcis-barcode-label">Lot No.</span>
                    <div class="barcode" style="text-align:center;height:54pt;line-height:54pt;"><canvas id="barcode-lot"></canvas></div>
                    <div class="rtcis-barcode-human" id="barcode-lot-text"></div>
                  </td>
                </tr>
                <tr>
                  <td colspan="4" class="rtcis-barcode-section">
                    <span class="rtcis-barcode-label">Unit Load ID</span>
                    <div class="barcode" style="text-align:center;height:54pt;line-height:54pt;"><canvas id="barcode-sscc"></canvas></div>
                    <div class="rtcis-barcode-human" id="barcode-sscc-text"></div>
                  </td>
                </tr>
              </table>
            </div>
            `;
            document.body.appendChild(div);
        }
        return div;
    }

    async function populateGCASDropdown() {
      const select = document.getElementById('irms_gcas');
      if (!select) return;
      select.innerHTML = '<option value="">Loading...</option>';

      // Fetch both GCAS and product code so we can display both in the option text
      const { data, error } = await supabase
        .from('rtcis_master_data')
        .select('irms_gcas, product_code')
        .order('irms_gcas', { ascending: true });

      if (error || !data) {
        select.innerHTML = '<option value="">Error loading GCAS</option>';
        return;
      }

      // Deduplicate by irms_gcas (keep first product_code encountered)
      const map = new Map();
      data.forEach(row => {
        const key = (row.irms_gcas || '').toString();
        if (!map.has(key)) map.set(key, row.product_code || '');
      });

      // Build options: value remains the GCAS identifier, text shows "GCAS - product_code"
      const options = Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([gcas, product]) => {
          const label = product ? `${gcas} - ${product}` : gcas;
          return `<option value="${gcas}">${label}</option>`;
        })
        .join('');

      select.innerHTML = '<option value="">Select IRMS/GCAS</option>' + options;
      
      // Add change listener to show only GCAS after selection (hide product code)
      select.addEventListener('change', function() {
        if (this.value) {
          const selectedOption = this.options[this.selectedIndex];
          const gcasValue = this.value;
          // Update the option text to show only GCAS
          selectedOption.textContent = gcasValue;
        }
      });
    }
    populateGCASDropdown();

    // Auto-fill LOT No (YYMMDD) and Sequence No (YYMM) when Production Date is selected
    const productionDateInput = document.getElementById('production_date');
    const lotNumberInput = document.getElementById('lot_number');
    const sequenceNumberInput = document.getElementById('sequence_number');
    
    if (productionDateInput) {
        productionDateInput.addEventListener('change', (e) => {
            const selectedDate = e.target.value; // Format: YYYY-MM-DD
            if (selectedDate) {
                // Parse the date
                const [year, month, day] = selectedDate.split('-');
                const yy = year.slice(-2);
                
                // Auto-fill LOT No (YYMMDD)
                if (lotNumberInput) {
                    lotNumberInput.value = yy + month + day;
                    clearFieldError(lotNumberInput);
                }
                
                // Auto-fill Sequence No (YYMM)
                if (sequenceNumberInput) {
                    sequenceNumberInput.value = yy + month;
                    clearFieldError(sequenceNumberInput);
                }
            }
            // Clear error for production_date field when user enters data
            clearFieldError(productionDateInput);
        });
    }

    // Add real-time error clearing for all required fields
    const requiredFields = ['irms_gcas', 'lot_number', 'quantity', 'production_date', 'height', 'gross_weight', 'sequence_number', 'pi_number', 'pallet_number', 'pallet_type'];
    requiredFields.forEach(fieldId => {
        const field = form.elements[fieldId];
        if (field) {
            // Listen for input and change events
            field.addEventListener('input', () => clearFieldError(field));
            field.addEventListener('change', () => clearFieldError(field));
        }
    });

    // Helper function to clear error styling and message for a field
    function clearFieldError(field) {
        if (!field) return;
        
        // Remove error border class
        field.classList.remove('field-error-border');
        
        // Remove error message element if it exists
        const errorMsg = field.parentNode.querySelector('.field-error-message');
        if (errorMsg) {
            errorMsg.remove();
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Get the submit button and store original content
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalContent = submitBtn ? submitBtn.innerHTML : 'Generate Label';

        // Clear previous error messages
        const existingErrors = form.querySelectorAll('.field-error-message');
        existingErrors.forEach(error => error.remove());
        const inputsWithErrors = form.querySelectorAll('.field-error-border');
        inputsWithErrors.forEach(input => input.classList.remove('field-error-border'));

        // Validate all required fields
        const requiredFields = ['irms_gcas', 'lot_number', 'quantity', 'production_date', 'height', 'gross_weight', 'sequence_number', 'pi_number', 'pallet_number', 'pallet_type'];
        let hasErrors = false;

        requiredFields.forEach(fieldId => {
            const field = form.elements[fieldId];
            const value = field ? field.value.trim() : '';
            if (!value) {
                hasErrors = true;
                // Add error class to field
                if (field) {
                    field.classList.add('field-error-border');
                    // Create and insert error message
                    const errorMsg = document.createElement('span');
                    errorMsg.className = 'field-error-message';
                    errorMsg.textContent = 'This field is required';
                    field.parentNode.appendChild(errorMsg);
                }
            }
        });

        // If any field is empty, don't proceed
        if (hasErrors) {
            return;
        }

        // Show loading animation
        if (submitBtn) {
            submitBtn.innerHTML = `
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
            `;
            submitBtn.disabled = true;
        }

        try {
            const irms_gcas = form.elements['irms_gcas'].value.trim();
            if (!irms_gcas) {
                alert('Please enter IRMS/GCAS number.');
                return;
            }
            // Fetch from Supabase
            const { data, error } = await supabase
                .from('rtcis_master_data')
                .select('*')
                .eq('irms_gcas', irms_gcas)
                .single();
            if (error || !data) {
                alert('No data found for the given IRMS/GCAS number.');
                return;
            }
    // ...existing code...
        // Gather all data for the label
        const labelData = {
            irms_gcas: data.irms_gcas || '',
            product_code: data.product_code || '',
            material_description: data.material_description || '',
            width: data.width || '',
            basis_weight: data.basis_weight || '',
            standard_weight: data.standard_weight || '',
            // Manual fields
            lot_number: (() => {
                let lot = form.elements['lot_number'].value.trim();
                return lot.startsWith('SWIN') ? lot : 'SWIN' + lot;
            })(),
            quantity: form.elements['quantity'].value.trim(), // No. of Rolls / Pallet
            production_date: form.elements['production_date'].value.trim(),
            height: form.elements['height'].value.trim(),
            gross_weight: form.elements['gross_weight'].value.trim(),
            sequence_number: form.elements['sequence_number'].value.trim(),
            pi_number: form.elements['pi_number'].value.trim().toUpperCase(),
            pallet_number: form.elements['pallet_number'].value.trim(),
            pallet_type: form.elements['pallet_type'].value.trim(),
        };
        // Calculate net weight
        let net_weight = '';
        if (labelData.quantity && labelData.standard_weight) {
            const rolls = parseFloat(labelData.quantity);
            const std_weight = parseFloat(labelData.standard_weight);
            if (!isNaN(rolls) && !isNaN(std_weight)) {
                net_weight = (rolls * std_weight).toFixed(2);
            }
        }
        labelData.net_weight = net_weight;
        // SSCC: Use company prefix 1534145 and sequence_number as serial reference
        labelData.sscc = generateSSCC('1534145', labelData.sequence_number);
        // Fill label
        ensureLabelDiv();
        fillLabel(labelData);
        const success = await generateBarcodes(labelData);
        
        // --- FIXED PAGE SIZE (6.18 x 7.75 inch) WITH FIXED MARGINS ---
        const labelDiv = document.getElementById('label-print-area');
        const table = labelDiv.querySelector('table');
        const tableRect = table.getBoundingClientRect();

        const mmToPt = mm => mm * 2.83465;
        const pxToMm = px => Math.ceil(px / 3.779528);

        // Fixed page size in mm (6.18 x 8.00 in)
        const pageWidthMM = 157.09;
        const pageHeightMM = 203.2;
        const pageWidthPT = mmToPt(pageWidthMM);
        const pageHeightPT = mmToPt(pageHeightMM);

        // Fixed margins
        const marginLeftPT = mmToPt(1.5); // 2mm left
        const marginRightPT = mmToPt(1.5); // 2mm right
        const marginTopPT = mmToPt(1.5); // 3mm top
        const marginBottomPT = mmToPt(1.5); // 3mm bottom

        const docDefinition = {
            pageSize: { width: pageWidthPT, height: pageHeightPT },
            pageMargins: [marginLeftPT, marginTopPT, marginRightPT, marginBottomPT],
            content: [
                {
                    table: {
                        widths: [104.5, 104.5, 104.5, 104.5],
                        body: [
                            // Header row
                            [
                                { text: 'Swanson Plastics (India) Private Limited, Bhuipal, Goa', colSpan: 2, style: 'headerLeft', alignment: 'left', border: [true, true, true, true], margin: [4, 5, 0, 5] }, {},
                                { text: `Supplier Product: ${labelData.product_code}\nIRMS GCAS: ${labelData.irms_gcas}\nProd Date: ${formatDateToDDMMMYYYY(labelData.production_date)}`, colSpan: 2, style: 'headerRight', alignment: 'left', border: [true, true, true, true], margin: [4, 5, 4, 5] }, {}
                            ],
                            // ITEM row
                            [
                                { text: `ITEM: ${labelData.material_description}`, colSpan: 4, style: 'item', alignment: 'left', border: [true, false, true, false], margin: [4, 6, 4, 6] }, {}, {}, {}
                            ],
                            // Dimension/weight row
                            [
                                { stack: [ { text: 'WIDTH (MM):', style: 'tableHeading', alignment: 'center' }, { text: labelData.width, style: 'tableValue', alignment: 'center' } ], alignment: 'center', border: [true, true, false, false], margin: [0, 4, 0, 4] },
                                { stack: [ { text: 'HEIGHT (MM):', style: 'tableHeading', alignment: 'center' }, { text: labelData.height, style: 'tableValue', alignment: 'center' } ], alignment: 'center', border: [false, true, true, false], margin: [0, 4, 0, 4] },
                                { stack: [ { text: 'GROSS wt.(KG):', style: 'tableHeading', alignment: 'center' }, { text: labelData.gross_weight, style: 'tableValue', alignment: 'center' } ], alignment: 'center', border: [true, true, false, false], margin: [0, 4, 0, 4] },
                                { stack: [ { text: 'NET wt.(KG):', style: 'tableHeading', alignment: 'center' }, { text: labelData.net_weight, style: 'tableValue', alignment: 'center' } ], alignment: 'center', border: [false, true, true, false], margin: [0, 4, 0, 4] }
                            ],
                            // Full-width line below dimension/weight row
                            [
                                { border: [true, false, false, true], text: '', margin: [0, 0, 0, 0] },
                                { border: [false, false, true, true], text: '', margin: [0, 0, 0, 0] },
                                { border: [true, false, false, true], text: '', margin: [0, 0, 0, 0] },
                                { border: [false, false, true, true], text: '', margin: [0, 0, 0, 0] }
                            ],
                            // Details rows
                            [
                                { colSpan: 2, style: 'tableValue', alignment: 'left', border: [true, false, true, false], margin: [4, 6, 4, 6], text: [ { text: 'IRMS GCAS#: ', bold: true }, { text: labelData.irms_gcas, bold: true } ] }, {},
                                { colSpan: 2, style: 'tableValue', alignment: 'left', border: [true, false, true, false], margin: [4, 6, 4, 6], text: [ { text: 'LOT#: ', bold: true }, { text: labelData.lot_number, bold: true } ] }, {}
                            ],
                            // Separator line after IRMS GCAS#/LOT#
                            [
                                { colSpan: 2, border: [true, false, true, true], text: '', margin: [0, 0, 0, 0], style: 'cell' }, {},
                                { colSpan: 2, border: [true, false, true, true], text: '', margin: [0, 0, 0, 0], style: 'cell' }, {}
                            ],
                            [
                                { colSpan: 2, style: 'tableValue', alignment: 'left', border: [true, false, true, false], margin: [4, 6, 4, 6], text: [ { text: 'PI Number: ', bold: true }, { text: labelData.pi_number, bold: true } ] }, {},
                                { colSpan: 2, style: 'tableValue', alignment: 'left', border: [true, false, true, false], margin: [4, 6, 4, 6], text: [ { text: 'Pallet Number: ', bold: true }, { text: `${labelData.pallet_number} / (${labelData.quantity} Rolls)`, bold: true } ] }, {}
                            ],
                            // Separator line after PI Number/Pallet Number
                            [
                                { colSpan: 2, border: [true, false, true, true], text: '', margin: [0, 0, 0, 0], style: 'cell' }, {},
                                { colSpan: 2, border: [true, false, true, true], text: '', margin: [0, 0, 0, 0], style: 'cell' }, {}
                            ],
                            [
                                { colSpan: 2, style: 'tableValue', alignment: 'left', border: [true, false, true, false], margin: [4, 6, 4, 6], text: [ { text: 'QUANTITY (KG): ', bold: true }, { text: labelData.net_weight, bold: true } ] }, {},
                                { colSpan: 2, style: 'tableValue', alignment: 'left', border: [true, false, true, false], margin: [4, 6, 4, 6], text: [ { text: 'Sequence Number: ', bold: true }, { text: labelData.sequence_number, bold: true } ] }, {}
                            ],
                            // Separator line after QUANTITY (KG)/Sequence Number
                            [
                                { colSpan: 2, border: [true, false, true, true], text: '', margin: [0, 0, 0, 0], style: 'cell' }, {},
                                { colSpan: 2, border: [true, false, true, true], text: '', margin: [0, 0, 0, 0], style: 'cell' }, {}
                            ],
                            [
                                { colSpan: 2, style: 'tableValue', alignment: 'left', border: [true, false, true, false], margin: [4, 6, 4, 6], text: [ { text: 'BASIS WEIGHT (GSM): ', bold: true }, { text: labelData.basis_weight, bold: true } ] }, {},
                                { colSpan: 2, style: 'tableValue', alignment: 'left', border: [true, false, true, false], margin: [4, 6, 4, 6], text: [ { text: 'PALLET TYPE : ', bold: true }, { text: labelData.pallet_type, bold: true } ] }, {}
                            ],
                            // Separator line after BASIS WEIGHT (GSM)/PALLET TYPE
                            [
                                { colSpan: 2, border: [true, false, true, true], text: '', margin: [0, 0, 0, 0], style: 'cell' }, {},
                                { colSpan: 2, border: [true, false, true, true], text: '', margin: [0, 0, 0, 0], style: 'cell' }, {}
                            ],
                            // Barcode sections with thick borders
                            [
                                { text: 'GCAS/ Net wt.', colSpan: 4, style: 'barcodeLabel', alignment: 'left', verticalAlignment: 'middle', border: [true, true, true, false], margin: [4, 0, 4, 0] }, {}, {}, {}
                            ],
                            [
                                { image: success.barcodeGcasPng, width: 227, height: 79, colSpan: 4, alignment: 'center', border: [true, false, true, false], margin: [4, -18, 4, -18] }, {}, {}, {}
                            ],
                            [
                                { text: document.getElementById('barcode-gcas-text').innerText, colSpan: 4, style: 'barcodeHuman', alignment: 'center', border: [true, false, true, false], margin: [4, mmToPt(1), 4, 0] }, {}, {}, {}
                            ],
                            [
                                { text: 'Lot No.', colSpan: 4, style: 'barcodeLabel', alignment: 'left', verticalAlignment: 'middle', border: [true, true, true, false], margin: [4, 0, 4, 0] }, {}, {}, {}
                            ],
                            [
                                { image: success.barcodeLotPng, width: 227, height: 79, colSpan: 4, alignment: 'center', border: [true, false, true, false], margin: [4, -18, 4, -18] }, {}, {}, {}
                            ],
                            [
                                { text: document.getElementById('barcode-lot-text').innerText, colSpan: 4, style: 'barcodeHuman', alignment: 'center', border: [true, false, true, false], margin: [4, mmToPt(1), 4, 0] }, {}, {}, {}
                            ],
                            [
                                { text: 'Unit Load ID', colSpan: 4, style: 'barcodeLabel', alignment: 'left', verticalAlignment: 'middle', border: [true, true, true, false], margin: [4, 0, 4, 0] }, {}, {}, {}
                            ],
                            [
                                { image: success.barcodeSsccPng, width: 227, height: 79, colSpan: 4, alignment: 'center', border: [true, false, true, false], margin: [4, -18, 4, -18] }, {}, {}, {}
                            ],
                            [
                                { text: document.getElementById('barcode-sscc-text').innerText, colSpan: 4, style: 'barcodeHuman', alignment: 'center', border: [true, false, true, true], margin: [4, mmToPt(1), 4, 5] }, {}, {}, {}
                            ]
                        ]
                    },
                    layout: {
                        hLineWidth: () => 1.5,
                        vLineWidth: () => 1.5,
                        hLineColor: () => 'black',
                        vLineColor: () => 'black',
                        paddingLeft: () => 1,
                        paddingRight: () => 1,
                        paddingTop: () => 1,
                        paddingBottom: () => 1,
                    }
                },
            ],
            alignment: 'center',
            defaultStyle: {
                fontSize: 10,
                font: 'Roboto'
            },
            styles: {
                headerLeft: { fontSize: 11, bold: true },
                headerRight: { fontSize: 12, bold: true },
                item: { fontSize: 12, bold: true },
                tableHeading: { fontSize: 12, bold: true },
                tableValue: { fontSize: 12, bold: true },
                barcodeLabel: { fontSize: 14, bold: true },
                barcodeHuman: { fontSize: 12, alignment: 'center', bold: true }
            },
            info: {
                title: 'RTCIS Label',
                author: 'Swanson Plastics (India) Private Limited',
            }
        };
        // Auto-generate filename: [LOT NO]-[PALLET NO]-[SEQUENCE NO].pdf
        const filename = `${labelData.lot_number}-${labelData.pallet_number}-${labelData.sequence_number}.pdf`;
        const pdfDoc = pdfMake.createPdf(docDefinition);
        pdfDoc.download(filename);

        // Restore button after PDF download
        if (submitBtn) {
            submitBtn.innerHTML = originalContent;
            submitBtn.disabled = false;
        }
        } catch (error) {
            console.error('Error generating label:', error);
            alert('An error occurred while generating the label. Please try again.');

            // Restore button on error
            if (submitBtn) {
                submitBtn.innerHTML = originalContent;
                submitBtn.disabled = false;
            }
        }
    });

    // Clear Data Button Functionality - Complete Form Reset
    const clearDataBtn = document.getElementById('clearRTCISData');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', () => {
            // Clear error messages and error styling
            const existingErrors = form.querySelectorAll('.field-error-message');
            existingErrors.forEach(error => error.remove());
            
            const errorFields = form.querySelectorAll('.field-error-border');
            errorFields.forEach(field => field.classList.remove('field-error-border'));

            // Complete form reset using native form.reset() method
            form.reset();

            // Explicitly clear checkboxes and radio buttons (extra safety)
            const checkboxesAndRadios = form.querySelectorAll('input[type="checkbox"], input[type="radio"]');
            checkboxesAndRadios.forEach(input => {
                input.checked = false;
            });

            // Reset dropdown to default state
            const irmsGcasSelect = document.getElementById('irms_gcas');
            if (irmsGcasSelect) {
                irmsGcasSelect.innerHTML = '<option value="">Select IRMS/GCAS</option>';
                // Re-populate the dropdown
                populateGCASDropdown();
            }

            // Reset production date max attribute
            const prodDateInput = document.getElementById('production_date');
            if (prodDateInput) {
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                const maxDate = `${yyyy}-${mm}-${dd}`;
                prodDateInput.setAttribute('max', maxDate);
            }

            // Clear any generated labels/barcodes completely
            const labelArea = document.getElementById('label-print-area');
            if (labelArea) {
                labelArea.remove(); // Completely remove the entire label area
            }

            // Clear static label print container
            const staticContainer = document.getElementById('staticLabelPrintContainer');
            if (staticContainer) {
                staticContainer.innerHTML = '';
            }

            // Clear barcode SVGs
            const barcodeElements = ['barcode-gcas', 'barcode-lot', 'barcode-sscc'];
            barcodeElements.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.innerHTML = '';
                }
            });

            // Clear barcode text elements
            const barcodeTextElements = ['barcode-gcas-text', 'barcode-lot-text', 'barcode-sscc-text'];
            barcodeTextElements.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = '';
                }
            });

            // Clear any error messages or validation states
            const errorElements = form.querySelectorAll('.error-message, .is-invalid, .text-red-500');
            errorElements.forEach(el => {
                el.remove();
            });

            // Reset any custom validation states
            const inputs = form.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                input.classList.remove('border-red-500', 'border-red-300');
                input.classList.add('border-gray-300');
            });

            // Clear any stored data in memory (if any)
            if (window.rtcisFormData) {
                window.rtcisFormData = null;
            }

            // Reset focus to first field for better UX
            const firstInput = form.querySelector('select, input, textarea');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }

            // Show basic confirmation feedback
            clearDataBtn.classList.add('bg-red-100', 'text-red-800', 'border-red-500');
            clearDataBtn.innerHTML = '<i class="fas fa-trash-alt mr-2"></i>Cleared!';

            setTimeout(() => {
                clearDataBtn.classList.remove('bg-red-100', 'text-red-800', 'border-red-500');
                clearDataBtn.innerHTML = '<i class="fas fa-trash-alt mr-2"></i>Clear Data';
            }, 800);
        });
    }
});
