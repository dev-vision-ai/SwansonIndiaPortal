const XlsxPopulate = require('xlsx-populate');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration from environment variables
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://ufczydnvscaicygwlmhz.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmY3p5ZG52c2NhaWN5Z3dsbWh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTg5NDYsImV4cCI6MjA1OTc5NDk0Nn0.0TUriXYvPuml-Jzr9v1jvcuzKjh-cZgnZhYKkQEj3t0'
);

// Helper function to format date to DD/MM/YYYY
function formatDateToDDMMYYYY(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Helper function to format time to HH:MM (remove seconds if present)
function formatTimeToHHMM(timeString) {
  if (!timeString) return '';
  // If already in HH:MM format, return as is
  if (timeString.length === 5) return timeString;
  // Otherwise, split by : and take only hours and minutes
  return timeString.split(':').slice(0, 2).join(':');
}

// Helper function to convert value to number for Excel
function convertToNumber(value) {
  if (value === '' || value === null || value === undefined) return '';
  const numValue = parseFloat(value);
  return !isNaN(numValue) ? numValue : value;
}

module.exports = function(app) {
  // Inline Inspection Form Excel Export Endpoint
  app.get('/export', async (req, res) => {
    try {
      // Get query parameters for specific form
      const { traceability_code, lot_letter } = req.query;

      // 1. Fetch data from Supabase - filter by specific form if parameters provided
      let query = supabase.from('inline_inspection_form_master_2').select('*');

      if (traceability_code && lot_letter) {
        // Export specific form
        query = query.eq('traceability_code', traceability_code).eq('lot_letter', lot_letter);
      }
      // If no parameters, export all forms (existing behavior)

      const { data, error } = await query;
      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).send('Error fetching data');
      }


      if (!data || data.length === 0) {
        return res.status(404).send('No data found for the specified form');
      }

      // 2. Load the client's Excel template
      const templatePath = path.join(__dirname, 'templates', 'Inline-inspection-form.xlsx');

      // Check if template file exists
      if (!fs.existsSync(templatePath)) {
        console.error('Template file not found:', templatePath);
        return res.status(500).send('Excel template file not found');
      }

      const workbook = new ExcelJS.Workbook();
      try {
        await workbook.xlsx.readFile(templatePath);
      } catch (templateError) {
        console.error('Error loading template:', templateError);
        return res.status(500).send(`Error loading Excel template: ${templateError.message}`);
      }
      // 3. Get the first worksheet (or specify by name if needed)
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        console.error('No worksheets found in template');
        return res.status(500).send('Template worksheet not found');
      }

      // 4. Find the starting row for data insertion (you may need to adjust this based on template)
      // Let's assume data starts after headers, around row 10
      let dataStartRow = 10;

      // Find the first empty row or row with specific marker
      for (let row = 1; row <= 50; row++) {
        const cell = worksheet.getCell(`A${row}`);
        if (!cell.value || cell.value.toString().trim() === '') {
          dataStartRow = row;
          break;
        }
      }

      // 5. Insert data into the template (fine-tuned mapping for merged cells)
      // Map header data from the specific lot being exported (not just the first lot)
      const targetLot = data.find(lot => lot.lot_letter === lot_letter) || data[0];

      // Initialize header variables
      let customer = '';
      let production_no = '';
      let production_no_2 = '';
      let prod_code = '';
      let spec = '';
      let year = '';
      let month = '';
      let date = '';
      let mc_no = '';
      let shift = '';
      let production_date = '';
      let printed = false;
      let non_printed = false;
      let ct = false;
      let emboss_type = '';

      if (targetLot) {
        // Clean product code by removing "(Jeddah)" part if present
        const prodCodeToCheck = targetLot.prod_code || '';
        let cleanedProdCode = prodCodeToCheck;

        if (prodCodeToCheck.toLowerCase().includes('jeddah')) {
          // Remove "(Jeddah)" or "(JEDDAH)" or any case variation
          cleanedProdCode = prodCodeToCheck.replace(/\s*\([^)]*jeddah[^)]*\)/gi, '').trim();
        }

        // Try to get header data from main fields first, then fall back to inspection_data
        customer = targetLot.customer || '';
        production_no = targetLot.production_no || '';
        production_no_2 = targetLot.production_no_2 || '';
        prod_code = cleanedProdCode; // Use cleaned product code
        spec = targetLot.spec || '';
        year = targetLot.year || '';
        month = targetLot.month || '';
        date = targetLot.date || '';
        mc_no = targetLot.mc_no || '';
        shift = targetLot.shift || '';
        production_date = targetLot.production_date || '';
        printed = targetLot.printed || false;
        non_printed = targetLot.non_printed || false;
        ct = targetLot.ct || false;
        emboss_type = targetLot.emboss_type || '';

        // If main fields are null, try to find data from other forms with same traceability_code and lot_letter
        if (!customer || !production_no || !prod_code || !spec || !shift || !mc_no) {
          try {
            const { data: otherForms, error } = await supabase
              .from('inline_inspection_form_master_2')
              .select('customer, production_no, production_no_2, prod_code, spec, shift, mc_no, production_date, emboss_type, printed, non_printed, ct')
              .eq('traceability_code', targetLot.traceability_code)
              .eq('lot_letter', targetLot.lot_letter)
              .not('customer', 'is', null)
              .limit(1);

            if (!error && otherForms && otherForms.length > 0) {
              const otherForm = otherForms[0];
              if (!customer) customer = otherForm.customer || '';
              if (!production_no) production_no = otherForm.production_no || '';
              if (!production_no_2) production_no_2 = otherForm.production_no_2 || '';
              if (!prod_code) {
                // Clean product code from other forms too
                const otherProdCode = otherForm.prod_code || '';
                if (otherProdCode.toLowerCase().includes('jeddah')) {
                  prod_code = otherProdCode.replace(/\s*\([^)]*jeddah[^)]*\)/gi, '').trim();
                } else {
                  prod_code = otherProdCode;
                }
              }
              if (!spec) spec = otherForm.spec || '';
              if (!shift) shift = otherForm.shift || '';
              if (!mc_no) mc_no = otherForm.mc_no || '';
              if (!production_date) production_date = otherForm.production_date || '';
              if (!emboss_type) emboss_type = otherForm.emboss_type || '';
              if (!printed) printed = otherForm.printed || false;
              if (!non_printed) non_printed = otherForm.non_printed || false;
              if (!ct) ct = otherForm.ct || false;

            }
          } catch (err) {
            console.log('  Error searching for header data in other forms:', err.message);
          }
        }

        // Map to Excel cells
        worksheet.getCell('D5').value = customer;
        // Combine production_no and production_no_2 with comma separator
        const combinedProductionNo = [production_no, production_no_2].filter(Boolean).join(', ');
        worksheet.getCell('D6').value = combinedProductionNo;
        worksheet.getCell('D7').value = prod_code;
        worksheet.getCell('D8').value = spec;
        worksheet.getCell('N7').value = year;
        worksheet.getCell('P7').value = month;
        worksheet.getCell('R7').value = date;
        worksheet.getCell('T7').value = mc_no;
        worksheet.getCell('V7').value = shift;
        worksheet.getCell('AE6').value = production_date ? formatDateToDDMMYYYY(production_date) : '';
        worksheet.getCell('AE7').value = shift;
        worksheet.getCell('AE8').value = mc_no;
        worksheet.getCell('L6').value = printed ? '✔' : '';
        worksheet.getCell('L7').value = non_printed ? '✔' : '';
        worksheet.getCell('L8').value = ct ? '✔' : '';
        worksheet.getCell('F11').value = emboss_type === 'Random' ? '✔' : '';
        worksheet.getCell('I11').value = emboss_type === 'Matte' ? '✔' : '';
        worksheet.getCell('L11').value = emboss_type === 'Micro' ? '✔' : '';

        // Set default values if still empty
        if (!customer) customer = 'CUSTOMER';
        if (!production_no) production_no = 'PROD-NO';
        if (!prod_code) prod_code = 'PROD-CODE';
        if (!spec) spec = 'SPEC';
        if (!shift) shift = '1';
        if (!mc_no) mc_no = 'MC-NO';
        if (!emboss_type) emboss_type = '';

        // Set year, month, date from production_date or current date
        if (production_date) {
          const dateObj = new Date(production_date);
          year = dateObj.getFullYear().toString().slice(-2); // Get last 2 digits (25 instead of 2025)
          month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
          date = dateObj.getDate().toString().padStart(2, '0');
        } else {
          // Use current date as fallback
          const now = new Date();
          year = now.getFullYear().toString().slice(-2); // Get last 2 digits (25 instead of 2025)
          month = (now.getMonth() + 1).toString().padStart(2, '0');
          date = now.getDate().toString().padStart(2, '0');
        }

      }

      // Function to apply header mapping to any worksheet
      const applyHeaderMapping = (worksheet) => {
        worksheet.getCell('D5').value = customer;
        // Combine production_no and production_no_2 with comma separator
        const combinedProductionNo = [production_no, production_no_2].filter(Boolean).join(', ');
        worksheet.getCell('D6').value = combinedProductionNo;
        worksheet.getCell('D8').value = prod_code;
        worksheet.getCell('D9').value = spec;
        worksheet.getCell('N7').value = year;
        worksheet.getCell('P7').value = month;
        worksheet.getCell('R7').value = date;
        worksheet.getCell('T7').value = mc_no;
        worksheet.getCell('V7').value = shift;
        worksheet.getCell('AE6').value = production_date ? formatDateToDDMMYYYY(production_date) : '';
        worksheet.getCell('AE7').value = shift;
        worksheet.getCell('AE8').value = mc_no;
        worksheet.getCell('L6').value = printed ? '✔' : '';
        worksheet.getCell('L7').value = non_printed ? '✔' : '';
        worksheet.getCell('L8').value = ct ? '✔' : '';
        worksheet.getCell('F11').value = emboss_type === 'Random' ? '✔' : '';
        worksheet.getCell('I11').value = emboss_type === 'Matte' ? '✔' : '';
        worksheet.getCell('L11').value = emboss_type === 'Micro' ? '✔' : '';
      };

      // Apply header mapping to the first worksheet
      if (targetLot) {
        applyHeaderMapping(worksheet);
      }

      // Sort lots by lot_no numerically before mapping
      data.sort((a, b) => {
        // Use lot_no for sorting to get correct sequence (01, 02, 03, etc.)
        const aNo = a.lot_no ? parseInt(a.lot_no, 10) : 0;
        const bNo = b.lot_no ? parseInt(b.lot_no, 10) : 0;
        return aNo - bNo;
      });

      // 6. Calculate page capacity and split lots
      const PAGE_CAPACITY = 70; // Total rows per page including empty separation rows
      const DATA_START_ROW = 14; // First row for data
      const DATA_END_ROW = 83; // Last row for data
      const AVAILABLE_ROWS = DATA_END_ROW - DATA_START_ROW + 1; // 70 rows available

      // Calculate how many lots can fit on each page
      let page1Lots = [];
      let page2Lots = [];
      let page3Lots = [];
      let currentRowCount = 0;
      let page1RowCount = 0;
      let page2RowCount = 0;

      // First pass: determine how many lots fit on Page1
      for (let i = 0; i < data.length; i++) {
        const lot = data[i];
        // Count rolls using the new JSONB structure
        const rollKeys = Object.keys(lot.roll_weights || {});
        const rollsInLot = rollKeys.length;
        const emptyRowsNeeded = i < data.length - 1 ? 1 : 0; // Empty row after each lot except last

        if (page1RowCount + rollsInLot + emptyRowsNeeded <= AVAILABLE_ROWS) {
          page1Lots.push(lot);
          page1RowCount += rollsInLot + emptyRowsNeeded;
        } else {
          // Start filling Page2
          if (page2RowCount + rollsInLot + emptyRowsNeeded <= AVAILABLE_ROWS) {
            page2Lots.push(lot);
            page2RowCount += rollsInLot + emptyRowsNeeded;
          } else {
            // Remaining lots go to Page3
            page3Lots = data.slice(i);
            break;
          }
        }
      }

      // 7. Map data to Page1
      let currentRow = DATA_START_ROW;
      let page1Summary = {
        accepted_rolls: 0,
        rejected_rolls: 0,
        rework_rolls: 0,
        kiv_rolls: 0,
        accepted_weight: 0,
        rejected_weight: 0,
        rework_weight: 0,
        kiv_weight: 0
      };

      page1Lots.forEach((lot, lotIndex) => {
        // Use direct columns for summary data
        page1Summary.accepted_rolls += lot.accepted_rolls || 0;
        page1Summary.accepted_weight += lot.accepted_weight || 0;
        page1Summary.rejected_rolls += lot.rejected_rolls || 0;
        page1Summary.rejected_weight += lot.rejected_weight || 0;
        page1Summary.rework_rolls += lot.rework_rolls || 0;
        page1Summary.rework_weight += lot.rework_weight || 0;
        page1Summary.kiv_rolls += lot.kiv_rolls || 0;
        page1Summary.kiv_weight += lot.kiv_weight || 0;

        // Map each roll using the new JSONB structure
        const rollKeys = Object.keys(lot.roll_weights || {});
        rollKeys.forEach((rollPosition, rollIndex) => {
          if (currentRow <= DATA_END_ROW) {
            // Get time data
            const timeData = lot.time_data?.[rollPosition] || {};
            const hour = timeData.hour || '';
            const minute = timeData.minute || '';

            // Get roll data from individual JSONB columns
            const rollWeight = lot.roll_weights?.[rollPosition] || '';
            const rollWidth = lot.roll_widths?.[rollPosition] || '';
            const filmWeightGsm = lot.film_weights_gsm?.[rollPosition] || '';
            const thickness = lot.thickness_data?.[rollPosition] || '';
            const rollDia = lot.roll_diameters?.[rollPosition] || '';

            // Get paper core data
            const paperCoreData = lot.paper_core_data?.[rollPosition] || {};
            const paperCoreId = paperCoreData.id || '';
            const paperCoreOd = paperCoreData.od || '';

            // Get film appearance data
            const filmAppearance = lot.film_appearance?.[rollPosition] || {};
            const linesStrips = filmAppearance.lines_strips || '';
            const glossy = filmAppearance.glossy || '';
            const filmColor = filmAppearance.film_color || '';
            const pinHole = filmAppearance.pin_hole || '';
            const patchMark = filmAppearance.patch_mark || '';
            const odour = filmAppearance.odour || '';
            const ctAppearance = filmAppearance.ct_appearance || '';

            // Get printing quality data
            const printingQuality = lot.printing_quality?.[rollPosition] || {};
            const printColor = printingQuality.print_color || '';
            const misPrint = printingQuality.mis_print || '';
            const dirtyPrint = printingQuality.dirty_print || '';
            const tapeTest = printingQuality.tape_test || '';
            const centralization = printingQuality.centralization || '';

            // Get roll appearance data
            const rollAppearance = lot.roll_appearance?.[rollPosition] || {};
            const wrinkles = rollAppearance.wrinkles || '';
            const prs = rollAppearance.prs || '';
            const rollCurve = rollAppearance.roll_curve || '';
            const coreMisalignment = rollAppearance.core_misalignment || '';
            const others = rollAppearance.others || '';

            // Get accept/reject status
            const acceptRejectStatus = lot.accept_reject_status?.[rollPosition] || '';
            const defectName = lot.defect_names?.[rollPosition] || '';

            // Get remarks
            const remarks = lot.remarks_data?.[rollPosition] || '';

            // Map to Excel cells - Handle inspected_by for first and second rows
            if (rollIndex === 0) {
              // First row of the lot - include all lot-associated data
              worksheet.getCell(`A${currentRow}`).value = hour;
              worksheet.getCell(`B${currentRow}`).value = minute;
              worksheet.getCell(`C${currentRow}`).value = lot.lot_no ? lot.lot_no.toString().padStart(2, '0') : '';
              worksheet.getCell(`D${currentRow}`).value = rollPosition;
              worksheet.getCell(`E${currentRow}`).value = lot.arm || '';
              // First row: show first inspector name (before comma)
              const names = (lot.inspected_by || '').split(/[,\n\r]+/);
              worksheet.getCell(`AF${currentRow}`).value = names[0]?.trim() || '';
            } else if (rollIndex === 1) {
              // Second row of the lot - show second inspector name
              worksheet.getCell(`A${currentRow}`).value = '';
              worksheet.getCell(`B${currentRow}`).value = '';
              worksheet.getCell(`C${currentRow}`).value = '';
              worksheet.getCell(`D${currentRow}`).value = rollPosition;
              worksheet.getCell(`E${currentRow}`).value = '';
              // Second row: show second inspector name (after comma)
              const names = (lot.inspected_by || '').split(/[,\n\r]+/);
              worksheet.getCell(`AF${currentRow}`).value = names[1]?.trim() || '';
            } else {
              // Other rows of the lot - leave all lot-associated data empty
              worksheet.getCell(`A${currentRow}`).value = '';
              worksheet.getCell(`B${currentRow}`).value = '';
              worksheet.getCell(`C${currentRow}`).value = '';
              worksheet.getCell(`D${currentRow}`).value = rollPosition;
              worksheet.getCell(`E${currentRow}`).value = '';
              worksheet.getCell(`AF${currentRow}`).value = '';
            }

            // Common fields for all rows - convert numerical values to numbers
            worksheet.getCell(`F${currentRow}`).value = rollWeight ? parseFloat(rollWeight) : rollWeight;
            worksheet.getCell(`G${currentRow}`).value = rollWidth ? parseFloat(rollWidth) : rollWidth;
            worksheet.getCell(`H${currentRow}`).value = filmWeightGsm ? parseFloat(filmWeightGsm) : filmWeightGsm;
            worksheet.getCell(`I${currentRow}`).value = thickness ? parseFloat(thickness) : thickness;
            worksheet.getCell(`J${currentRow}`).value = rollDia ? parseFloat(rollDia) : rollDia;
            worksheet.getCell(`K${currentRow}`).value = paperCoreId;
            worksheet.getCell(`L${currentRow}`).value = paperCoreOd ? parseFloat(paperCoreOd) : paperCoreOd;

            // Film Appearance
            worksheet.getCell(`M${currentRow}`).value = linesStrips;
            worksheet.getCell(`N${currentRow}`).value = glossy;
            worksheet.getCell(`O${currentRow}`).value = filmColor;
            worksheet.getCell(`P${currentRow}`).value = pinHole;
            worksheet.getCell(`Q${currentRow}`).value = patchMark;
            worksheet.getCell(`R${currentRow}`).value = odour;

            // Printing
            worksheet.getCell(`S${currentRow}`).value = ctAppearance;
            worksheet.getCell(`T${currentRow}`).value = printColor;
            worksheet.getCell(`U${currentRow}`).value = misPrint;
            worksheet.getCell(`V${currentRow}`).value = dirtyPrint;
            worksheet.getCell(`W${currentRow}`).value = tapeTest;
            worksheet.getCell(`X${currentRow}`).value = centralization;

            // Roll Appearance
            worksheet.getCell(`Y${currentRow}`).value = wrinkles;
            worksheet.getCell(`Z${currentRow}`).value = prs;
            worksheet.getCell(`AA${currentRow}`).value = rollCurve;
            worksheet.getCell(`AB${currentRow}`).value = coreMisalignment;
            worksheet.getCell(`AC${currentRow}`).value = others;

            // Accept/Reject
            worksheet.getCell(`AD${currentRow}`).value = acceptRejectStatus === 'Accept' ? 'O' : (acceptRejectStatus === 'Reject' || acceptRejectStatus === 'Rework' ? 'X' : '');

            worksheet.getCell(`AE${currentRow}`).value = defectName;

            currentRow++;
          }
        });

        // Add empty row between lots (except after the last lot)
        if (lotIndex < page1Lots.length - 1 && currentRow <= DATA_END_ROW) {
          currentRow++;
        }
      });

      // 8. Add Page1 summary - convert to numbers
      worksheet.getCell('L85').value = parseFloat(page1Summary.accepted_rolls) || 0;
      worksheet.getCell('N85').value = parseFloat(page1Summary.accepted_weight) || 0;
      worksheet.getCell('L86').value = parseFloat(page1Summary.rejected_rolls) || 0;
      worksheet.getCell('N86').value = parseFloat(page1Summary.rejected_weight) || 0;
      worksheet.getCell('L87').value = parseFloat(page1Summary.rework_rolls) || 0;
      worksheet.getCell('N87').value = parseFloat(page1Summary.rework_weight) || 0;
      worksheet.getCell('L88').value = parseFloat(page1Summary.kiv_rolls) || 0;
      worksheet.getCell('N88').value = parseFloat(page1Summary.kiv_weight) || 0;
      worksheet.getCell('L89').value = parseFloat(page1Summary.accepted_rolls + page1Summary.rejected_rolls + page1Summary.rework_rolls + page1Summary.kiv_rolls) || 0;
      worksheet.getCell('N89').value = parseFloat(page1Summary.accepted_weight + page1Summary.rejected_weight + page1Summary.rework_weight + page1Summary.kiv_weight) || 0;

      // 9. Calculate total pages and add page indicator to Page1
      const totalPages = 1 + (page2Lots.length > 0 ? 1 : 0) + (page3Lots.length > 0 ? 1 : 0);
      if (totalPages > 1) {
        worksheet.getCell('A1').value = `Page 1 of ${totalPages}`;
      }

      // 10. If there are lots for Page2, create a separate file for Page2
      if (page2Lots.length > 0) {
        // Use the existing Page2 worksheet from the template
        const page2Worksheet = workbook.getWorksheet('Page2');

        if (page2Worksheet) {
          // Apply header mapping to Page2 using the same function
          applyHeaderMapping(page2Worksheet);

          // Map data to Page2
          let page2CurrentRow = DATA_START_ROW;
          let page2Summary = {
            accepted_rolls: 0,
            rejected_rolls: 0,
            rework_rolls: 0,
            kiv_rolls: 0,
            accepted_weight: 0,
            rejected_weight: 0,
            rework_weight: 0,
            kiv_weight: 0
          };

          page2Lots.forEach((lot, lotIndex) => {
            // Use direct columns for summary data
            page2Summary.accepted_rolls += lot.accepted_rolls || 0;
            page2Summary.accepted_weight += lot.accepted_weight || 0;
            page2Summary.rejected_rolls += lot.rejected_rolls || 0;
            page2Summary.rejected_weight += lot.rejected_weight || 0;
            page2Summary.rework_rolls += lot.rework_rolls || 0;
            page2Summary.rework_weight += lot.rework_weight || 0;
            page2Summary.kiv_rolls += lot.kiv_rolls || 0;
            page2Summary.kiv_weight += lot.kiv_weight || 0;

            // Map each roll using the new JSONB structure
            const rollKeys = Object.keys(lot.roll_weights || {});
            rollKeys.forEach((rollPosition, rollIndex) => {
              if (page2CurrentRow <= DATA_END_ROW) {
                // Get time data
                const timeData = lot.time_data?.[rollPosition] || {};
                const hour = timeData.hour || '';
                const minute = timeData.minute || '';

                // Get roll data from individual JSONB columns
                const rollWeight = lot.roll_weights?.[rollPosition] || '';
                const rollWidth = lot.roll_widths?.[rollPosition] || '';
                const filmWeightGsm = lot.film_weights_gsm?.[rollPosition] || '';
                const thickness = lot.thickness_data?.[rollPosition] || '';
                const rollDia = lot.roll_diameters?.[rollPosition] || '';

                // Get paper core data
                const paperCoreData = lot.paper_core_data?.[rollPosition] || {};
                const paperCoreId = paperCoreData.id || '';
                const paperCoreOd = paperCoreData.od || '';

                // Get film appearance data
                const filmAppearance = lot.film_appearance?.[rollPosition] || {};
                const linesStrips = filmAppearance.lines_strips || '';
                const glossy = filmAppearance.glossy || '';
                const filmColor = filmAppearance.film_color || '';
                const pinHole = filmAppearance.pin_hole || '';
                const patchMark = filmAppearance.patch_mark || '';
                const odour = filmAppearance.odour || '';
                const ctAppearance = filmAppearance.ct_appearance || '';

                // Get printing quality data
                const printingQuality = lot.printing_quality?.[rollPosition] || {};
                const printColor = printingQuality.print_color || '';
                const misPrint = printingQuality.mis_print || '';
                const dirtyPrint = printingQuality.dirty_print || '';
                const tapeTest = printingQuality.tape_test || '';
                const centralization = printingQuality.centralization || '';

                // Get roll appearance data
                const rollAppearance = lot.roll_appearance?.[rollPosition] || {};
                const wrinkles = rollAppearance.wrinkles || '';
                const prs = rollAppearance.prs || '';
                const rollCurve = rollAppearance.roll_curve || '';
                const coreMisalignment = rollAppearance.core_misalignment || '';
                const others = rollAppearance.others || '';

                // Get accept/reject status
                const acceptRejectStatus = lot.accept_reject_status?.[rollPosition] || '';
                const defectName = lot.defect_names?.[rollPosition] || '';

                // Map to Excel cells - Handle inspected_by for first and second rows
                if (rollIndex === 0) {
                  // First row of the lot - include all lot-associated data
                  page2Worksheet.getCell(`A${page2CurrentRow}`).value = hour;
                  page2Worksheet.getCell(`B${page2CurrentRow}`).value = minute;
                  page2Worksheet.getCell(`C${page2CurrentRow}`).value = lot.lot_no ? lot.lot_no.toString().padStart(2, '0') : '';
                  page2Worksheet.getCell(`D${page2CurrentRow}`).value = rollPosition;
                  page2Worksheet.getCell(`E${page2CurrentRow}`).value = lot.arm || '';
                  // First row: show first inspector name (before comma)
                  const names = (lot.inspected_by || '').split(/[,\n\r]+/);
                  page2Worksheet.getCell(`AF${page2CurrentRow}`).value = names[0]?.trim() || '';
                } else if (rollIndex === 1) {
                  // Second row of the lot - show second inspector name
                  page2Worksheet.getCell(`A${page2CurrentRow}`).value = '';
                  page2Worksheet.getCell(`B${page2CurrentRow}`).value = '';
                  page2Worksheet.getCell(`C${page2CurrentRow}`).value = '';
                  page2Worksheet.getCell(`D${page2CurrentRow}`).value = rollPosition;
                  page2Worksheet.getCell(`E${page2CurrentRow}`).value = '';
                  // Second row: show second inspector name (after comma)
                  const names = (lot.inspected_by || '').split(/[,\n\r]+/);
                  page2Worksheet.getCell(`AF${page2CurrentRow}`).value = names[1]?.trim() || '';
                } else {
                  // Other rows of the lot - leave all lot-associated data empty
                  page2Worksheet.getCell(`A${page2CurrentRow}`).value = '';
                  page2Worksheet.getCell(`B${page2CurrentRow}`).value = '';
                  page2Worksheet.getCell(`C${page2CurrentRow}`).value = '';
                  page2Worksheet.getCell(`D${page2CurrentRow}`).value = rollPosition;
                  page2Worksheet.getCell(`E${page2CurrentRow}`).value = '';
                  page2Worksheet.getCell(`AF${page2CurrentRow}`).value = '';
                }

                // Common fields for all rows - convert numerical values to numbers
                page2Worksheet.getCell(`F${page2CurrentRow}`).value = rollWeight ? parseFloat(rollWeight) : rollWeight;
                page2Worksheet.getCell(`G${page2CurrentRow}`).value = rollWidth ? parseFloat(rollWidth) : rollWidth;
                page2Worksheet.getCell(`H${page2CurrentRow}`).value = filmWeightGsm ? parseFloat(filmWeightGsm) : filmWeightGsm;
                page2Worksheet.getCell(`I${page2CurrentRow}`).value = thickness ? parseFloat(thickness) : thickness;
                page2Worksheet.getCell(`J${page2CurrentRow}`).value = rollDia ? parseFloat(rollDia) : rollDia;
                page2Worksheet.getCell(`K${page2CurrentRow}`).value = paperCoreId;
                page2Worksheet.getCell(`L${page2CurrentRow}`).value = paperCoreOd ? parseFloat(paperCoreOd) : paperCoreOd;

                // Film Appearance
                page2Worksheet.getCell(`M${page2CurrentRow}`).value = linesStrips;
                page2Worksheet.getCell(`N${page2CurrentRow}`).value = glossy;
                page2Worksheet.getCell(`O${page2CurrentRow}`).value = filmColor;
                page2Worksheet.getCell(`P${page2CurrentRow}`).value = pinHole;
                page2Worksheet.getCell(`Q${page2CurrentRow}`).value = patchMark;
                page2Worksheet.getCell(`R${page2CurrentRow}`).value = odour;

                // Printing
                page2Worksheet.getCell(`S${page2CurrentRow}`).value = ctAppearance;
                page2Worksheet.getCell(`T${page2CurrentRow}`).value = printColor;
                page2Worksheet.getCell(`U${page2CurrentRow}`).value = misPrint;
                page2Worksheet.getCell(`V${page2CurrentRow}`).value = dirtyPrint;
                page2Worksheet.getCell(`W${page2CurrentRow}`).value = tapeTest;
                page2Worksheet.getCell(`X${page2CurrentRow}`).value = centralization;

                // Roll Appearance
                page2Worksheet.getCell(`Y${page2CurrentRow}`).value = wrinkles;
                page2Worksheet.getCell(`Z${page2CurrentRow}`).value = prs;
                page2Worksheet.getCell(`AA${page2CurrentRow}`).value = rollCurve;
                page2Worksheet.getCell(`AB${page2CurrentRow}`).value = coreMisalignment;
                page2Worksheet.getCell(`AC${page2CurrentRow}`).value = others;

                // Accept/Reject
                page2Worksheet.getCell(`AD${page2CurrentRow}`).value = acceptRejectStatus === 'Accept' ? 'O' : (acceptRejectStatus === 'Reject' || acceptRejectStatus === 'Rework' ? 'X' : '');

                page2Worksheet.getCell(`AE${page2CurrentRow}`).value = defectName;

                page2CurrentRow++;
              }
            });

            // Add empty row between lots (except after the last lot)
            if (lotIndex < page2Lots.length - 1 && page2CurrentRow <= DATA_END_ROW) {
              page2CurrentRow++;
            }
          });

          // Add Page2 summary - convert to numbers
          page2Worksheet.getCell('L85').value = parseFloat(page2Summary.accepted_rolls) || 0;
          page2Worksheet.getCell('N85').value = parseFloat(page2Summary.accepted_weight) || 0;
          page2Worksheet.getCell('L86').value = parseFloat(page2Summary.rejected_rolls) || 0;
          page2Worksheet.getCell('N86').value = parseFloat(page2Summary.rejected_weight) || 0;
          page2Worksheet.getCell('L87').value = parseFloat(page2Summary.rework_rolls) || 0;
          page2Worksheet.getCell('N87').value = parseFloat(page2Summary.rework_weight) || 0;
          page2Worksheet.getCell('L88').value = parseFloat(page2Summary.kiv_rolls) || 0;
          page2Worksheet.getCell('N88').value = parseFloat(page2Summary.kiv_weight) || 0;
          page2Worksheet.getCell('L89').value = parseFloat(page2Summary.accepted_rolls + page2Summary.rejected_rolls + page2Summary.rework_rolls + page2Summary.kiv_rolls) || 0;
          page2Worksheet.getCell('N89').value = parseFloat(page2Summary.accepted_weight + page2Summary.rejected_weight + page2Summary.rework_weight + page2Summary.kiv_weight) || 0;

          // Add page indicator to Page2
          page2Worksheet.getCell('A1').value = `Page 2 of ${totalPages}`;

          // Page2 data mapped successfully
        } else {
          // Page2 worksheet not found in template
        }
      }
      // 11. If there are lots for Page3, map them to Page3
      if (page3Lots.length > 0) {
        // Use the existing Page3 worksheet from the template
        const page3Worksheet = workbook.getWorksheet('Page3');

        if (page3Worksheet) {
          // Apply header mapping to Page3 using the same function
          applyHeaderMapping(page3Worksheet);

          // Map data to Page3
          let page3CurrentRow = DATA_START_ROW;
          let page3Summary = {
            accepted_rolls: 0,
            rejected_rolls: 0,
            rework_rolls: 0,
            kiv_rolls: 0,
            accepted_weight: 0,
            rejected_weight: 0,
            rework_weight: 0,
            kiv_weight: 0
          };

          page3Lots.forEach((lot, lotIndex) => {
            // Use direct columns for summary data
            page3Summary.accepted_rolls += lot.accepted_rolls || 0;
            page3Summary.accepted_weight += lot.accepted_weight || 0;
            page3Summary.rejected_rolls += lot.rejected_rolls || 0;
            page3Summary.rejected_weight += lot.rejected_weight || 0;
            page3Summary.rework_rolls += lot.rework_rolls || 0;
            page3Summary.rework_weight += lot.rework_weight || 0;
            page3Summary.kiv_rolls += lot.kiv_rolls || 0;
            page3Summary.kiv_weight += lot.kiv_weight || 0;

            // Map each roll using the new JSONB structure
            const rollKeys = Object.keys(lot.roll_weights || {});
            rollKeys.forEach((rollPosition, rollIndex) => {
              if (page3CurrentRow <= DATA_END_ROW) {
                // Get time data
                const timeData = lot.time_data?.[rollPosition] || {};
                const hour = timeData.hour || '';
                const minute = timeData.minute || '';

                // Get roll data from individual JSONB columns
                const rollWeight = lot.roll_weights?.[rollPosition] || '';
                const rollWidth = lot.roll_widths?.[rollPosition] || '';
                const filmWeightGsm = lot.film_weights_gsm?.[rollPosition] || '';
                const thickness = lot.thickness_data?.[rollPosition] || '';
                const rollDia = lot.roll_diameters?.[rollPosition] || '';

                // Get paper core data
                const paperCoreData = lot.paper_core_data?.[rollPosition] || {};
                const paperCoreId = paperCoreData.id || '';
                const paperCoreOd = paperCoreData.od || '';

                // Get film appearance data
                const filmAppearance = lot.film_appearance?.[rollPosition] || {};
                const linesStrips = filmAppearance.lines_strips || '';
                const glossy = filmAppearance.glossy || '';
                const filmColor = filmAppearance.film_color || '';
                const pinHole = filmAppearance.pin_hole || '';
                const patchMark = filmAppearance.patch_mark || '';
                const odour = filmAppearance.odour || '';
                const ctAppearance = filmAppearance.ct_appearance || '';

                // Get printing quality data
                const printingQuality = lot.printing_quality?.[rollPosition] || {};
                const printColor = printingQuality.print_color || '';
                const misPrint = printingQuality.mis_print || '';
                const dirtyPrint = printingQuality.dirty_print || '';
                const tapeTest = printingQuality.tape_test || '';
                const centralization = printingQuality.centralization || '';

                // Get roll appearance data
                const rollAppearance = lot.roll_appearance?.[rollPosition] || {};
                const wrinkles = rollAppearance.wrinkles || '';
                const prs = rollAppearance.prs || '';
                const rollCurve = rollAppearance.roll_curve || '';
                const coreMisalignment = rollAppearance.core_misalignment || '';
                const others = rollAppearance.others || '';

                // Get accept/reject status
                const acceptRejectStatus = lot.accept_reject_status?.[rollPosition] || '';
                const defectName = lot.defect_names?.[rollPosition] || '';

                // Map to Excel cells - Handle inspected_by for first and second rows
                if (rollIndex === 0) {
                  // First row of the lot - include all lot-associated data
                  page3Worksheet.getCell(`A${page3CurrentRow}`).value = hour;
                  page3Worksheet.getCell(`B${page3CurrentRow}`).value = minute;
                  page3Worksheet.getCell(`C${page3CurrentRow}`).value = lot.lot_no ? lot.lot_no.toString().padStart(2, '0') : '';
                  page3Worksheet.getCell(`D${page3CurrentRow}`).value = rollPosition;
                  page3Worksheet.getCell(`E${page3CurrentRow}`).value = lot.arm || '';
                  // First row: show first inspector name (before comma)
                  const names = (lot.inspected_by || '').split(/[,\n\r]+/);
                  page3Worksheet.getCell(`AF${page3CurrentRow}`).value = names[0]?.trim() || '';
                } else if (rollIndex === 1) {
                  // Second row of the lot - show second inspector name
                  page3Worksheet.getCell(`A${page3CurrentRow}`).value = '';
                  page3Worksheet.getCell(`B${page3CurrentRow}`).value = '';
                  page3Worksheet.getCell(`C${page3CurrentRow}`).value = '';
                  page3Worksheet.getCell(`D${page3CurrentRow}`).value = rollPosition;
                  page3Worksheet.getCell(`E${page3CurrentRow}`).value = '';
                  // Second row: show second inspector name (after comma)
                  const names = (lot.inspected_by || '').split(/[,\n\r]+/);
                  page3Worksheet.getCell(`AF${page3CurrentRow}`).value = names[1]?.trim() || '';
                } else {
                  // Other rows of the lot - leave all lot-associated data empty
                  page3Worksheet.getCell(`A${page3CurrentRow}`).value = '';
                  page3Worksheet.getCell(`B${page3CurrentRow}`).value = '';
                  page3Worksheet.getCell(`C${page3CurrentRow}`).value = '';
                  page3Worksheet.getCell(`D${page3CurrentRow}`).value = rollPosition;
                  page3Worksheet.getCell(`E${page3CurrentRow}`).value = '';
                  page3Worksheet.getCell(`AF${page3CurrentRow}`).value = '';
                }

                // Common fields for all rows - convert numerical values to numbers
                page3Worksheet.getCell(`F${page3CurrentRow}`).value = rollWeight ? parseFloat(rollWeight) : rollWeight;
                page3Worksheet.getCell(`G${page3CurrentRow}`).value = rollWidth ? parseFloat(rollWidth) : rollWidth;
                page3Worksheet.getCell(`H${page3CurrentRow}`).value = filmWeightGsm ? parseFloat(filmWeightGsm) : filmWeightGsm;
                page3Worksheet.getCell(`I${page3CurrentRow}`).value = thickness ? parseFloat(thickness) : thickness;
                page3Worksheet.getCell(`J${page3CurrentRow}`).value = rollDia ? parseFloat(rollDia) : rollDia;
                page3Worksheet.getCell(`K${page3CurrentRow}`).value = paperCoreId;
                page3Worksheet.getCell(`L${page3CurrentRow}`).value = paperCoreOd ? parseFloat(paperCoreOd) : paperCoreOd;

                // Film Appearance
                page3Worksheet.getCell(`M${page3CurrentRow}`).value = linesStrips;
                page3Worksheet.getCell(`N${page3CurrentRow}`).value = glossy;
                page3Worksheet.getCell(`O${page3CurrentRow}`).value = filmColor;
                page3Worksheet.getCell(`P${page3CurrentRow}`).value = pinHole;
                page3Worksheet.getCell(`Q${page3CurrentRow}`).value = patchMark;
                page3Worksheet.getCell(`R${page3CurrentRow}`).value = odour;

                // Printing
                page3Worksheet.getCell(`S${page3CurrentRow}`).value = ctAppearance;
                page3Worksheet.getCell(`T${page3CurrentRow}`).value = printColor;
                page3Worksheet.getCell(`U${page3CurrentRow}`).value = misPrint;
                page3Worksheet.getCell(`V${page3CurrentRow}`).value = dirtyPrint;
                page3Worksheet.getCell(`W${page3CurrentRow}`).value = tapeTest;
                page3Worksheet.getCell(`X${page3CurrentRow}`).value = centralization;

                // Roll Appearance
                page3Worksheet.getCell(`Y${page3CurrentRow}`).value = wrinkles;
                page3Worksheet.getCell(`Z${page3CurrentRow}`).value = prs;
                page3Worksheet.getCell(`AA${page3CurrentRow}`).value = rollCurve;
                page3Worksheet.getCell(`AB${page3CurrentRow}`).value = coreMisalignment;
                page3Worksheet.getCell(`AC${page3CurrentRow}`).value = others;

                // Accept/Reject
                page3Worksheet.getCell(`AD${page3CurrentRow}`).value = acceptRejectStatus === 'Accept' ? 'O' : (acceptRejectStatus === 'Reject' || acceptRejectStatus === 'Rework' ? 'X' : '');

                page3Worksheet.getCell(`AE${page3CurrentRow}`).value = defectName;

                page3CurrentRow++;
              }
            });

            // Add empty row between lots (except after the last lot)
            if (lotIndex < page3Lots.length - 1 && page3CurrentRow <= DATA_END_ROW) {
              page3CurrentRow++;
            }
          });

          // Add Page3 summary - convert to numbers
          page3Worksheet.getCell('L85').value = parseFloat(page3Summary.accepted_rolls) || 0;
          page3Worksheet.getCell('N85').value = parseFloat(page3Summary.accepted_weight) || 0;
          page3Worksheet.getCell('L86').value = parseFloat(page3Summary.rejected_rolls) || 0;
          page3Worksheet.getCell('N86').value = parseFloat(page3Summary.rejected_weight) || 0;
          page3Worksheet.getCell('L87').value = parseFloat(page3Summary.rework_rolls) || 0;
          page3Worksheet.getCell('N87').value = parseFloat(page3Summary.rework_weight) || 0;
          page3Worksheet.getCell('L88').value = parseFloat(page3Summary.kiv_rolls) || 0;
          page3Worksheet.getCell('N88').value = parseFloat(page3Summary.kiv_weight) || 0;
          page3Worksheet.getCell('L89').value = parseFloat(page3Summary.accepted_rolls + page3Summary.rejected_rolls + page3Summary.rework_rolls + page3Summary.kiv_rolls) || 0;
          page3Worksheet.getCell('N89').value = parseFloat(page3Summary.accepted_weight + page3Summary.rejected_weight + page3Summary.rework_weight + page3Summary.kiv_weight) || 0;

          // Add page indicator to Page3
          page3Worksheet.getCell('A1').value = `Page 3 of ${totalPages}`;

          // Page3 data mapped successfully
        } else {
          // Page3 worksheet not found in template
        }
      }

      // 11. Remove empty pages from workbook (only keep pages with data)
      if (page2Lots.length === 0) {
        // Remove Page2 if it has no data
        const page2Worksheet = workbook.getWorksheet('Page2');
        if (page2Worksheet) {
          workbook.removeWorksheet('Page2');
        }
      }

      if (page3Lots.length === 0) {
        // Remove Page3 if it has no data
        const page3Worksheet = workbook.getWorksheet('Page3');
        if (page3Worksheet) {
          workbook.removeWorksheet('Page3');
        }
      }

      // 12. Add password protection to the workbook and protect all worksheets
      workbook.password = '2256';

      // Protect all worksheets with password
      workbook.worksheets.forEach(worksheet => {
        worksheet.protect('2256', {
          selectLockedCells: false,
          selectUnlockedCells: true,
          formatCells: false,
          formatColumns: false,
          formatRows: false,
          insertColumns: false,
          insertRows: false,
          insertHyperlinks: false,
          deleteColumns: false,
          deleteRows: false,
          sort: false,
          autoFilter: false,
          pivotTables: false
        });
      });

      // 13. Save the workbook to a buffer
      const buffer = await workbook.xlsx.writeBuffer();

      // Generate filename with all required information
      // Try to get data from main fields first, then fall back to header_data
      let productionDate = targetLot.production_date ? formatDateToDDMMYYYY(targetLot.production_date) : '';
      let prodCode = targetLot.prod_code || '';
      let shiftNumber = targetLot.shift || '';
      let mcNo = targetLot.mc_no || '';

      // If main fields are null, try to extract from header_data
      if (!prodCode && targetLot.header_data) {
        // Try to get from header_data
        prodCode = targetLot.header_data.prod_code || '';
      }

      if (!shiftNumber && targetLot.header_data) {
        // Try to get shift from header_data
        shiftNumber = targetLot.header_data.shift || '';
      }

      // If still no prod_code, try to find it from other forms with same traceability_code
      if (!prodCode) {
        try {
          const { data: otherForms, error } = await supabase
            .from('inline_inspection_form_master_2')
            .select('prod_code')
            .eq('traceability_code', targetLot.traceability_code)
            .eq('lot_letter', targetLot.lot_letter)
            .not('prod_code', 'is', null)
            .limit(1);

          if (!error && otherForms && otherForms.length > 0) {
            prodCode = otherForms[0].prod_code;

            // Update original product code for filename if we found it from other forms
            originalProdCodeForFilename = prodCode;

            // Remove extra spaces around "(Jeddah)" for filename from other forms too
            if (originalProdCodeForFilename.toLowerCase().includes('jeddah')) {
              originalProdCodeForFilename = originalProdCodeForFilename.replace(/\s*\(([^)]*jeddah[^)]*)\)/gi, '($1)').trim();
            }

            // Clean the retrieved product code by removing "(Jeddah)" part if present (for Excel content only)
            if (prodCode.toLowerCase().includes('jeddah')) {
              // Remove "(Jeddah)" or "(JEDDAH)" or any case variation
              const originalProdCode = prodCode;
              prodCode = prodCode.replace(/\s*\([^)]*jeddah[^)]*\)/gi, '').trim();
            }
          } else {
            prodCode = 'PROD-CODE'; // Default value
          }
        } catch (err) {
          prodCode = 'PROD-CODE'; // Default value
        }
      }

      // If still no shift, try to find it from other forms with same traceability_code
      if (!shiftNumber) {
        try {
          const { data: otherForms, error } = await supabase
            .from('inline_inspection_form_master_2')
            .select('shift')
            .eq('traceability_code', targetLot.traceability_code)
            .eq('lot_letter', targetLot.lot_letter)
            .not('shift', 'is', null)
            .limit(1);

          if (!error && otherForms && otherForms.length > 0) {
            shiftNumber = otherForms[0].shift;
          } else {
            shiftNumber = '1'; // Default to shift 1
          }
        } catch (err) {
          shiftNumber = '1'; // Default value
        }
      }


      // Convert shift number to letter
      let shiftLetter = '';
      if (shiftNumber === '1' || shiftNumber === 1) shiftLetter = 'A';
      else if (shiftNumber === '2' || shiftNumber === 2) shiftLetter = 'B';
      else if (shiftNumber === '3' || shiftNumber === 3) shiftLetter = 'C';
      else shiftLetter = shiftNumber; // Keep original if not 1, 2, or 3

      // Create filename with format: ILIF-trace code-prod code-Shift-A-B-C.xlsx
      const filename = `ILIF-${targetLot.traceability_code}-${prodCode}-Shift-${shiftLetter}.xlsx`;

      // 14. Send the buffer as a response
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      res.send(buffer);

    } catch (error) {
      res.status(500).send(`Error exporting inspection report: ${error.message}`);
    }
  });
};
