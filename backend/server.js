const express = require('express');
const XlsxPopulate = require('xlsx-populate');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');



const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration for frontend - production URLs and local development
app.use(cors({
  origin: [
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://localhost:3000',
    'https://swanson-india-portal.vercel.app',
    'https://swanson-india-portal-9achzdpnx.vercel.app',
    'https://swanson-ind-git-aaaf01-swanson-plastics-india-pvt-ltds-projects.vercel.app',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));

app.use(express.json());

// Supabase configuration from environment variables
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://ufczydnvscaicygwlmhz.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmY3p5ZG52c2NhaWN5Z3dsbWh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTg5NDYsImV4cCI6MjA1OTc5NDk0Nn0.0TUriXYvPuml-Jzr9v1jvcuzKjh-cZgnZhYKkQEj3t0'
);

// Keep-alive system to prevent cold starts
setInterval(() => {
  try {
    // Additional memory cleanup to prevent cold starts
    if (global.gc) {
      global.gc();
    }
  } catch (error) {
    console.log('Keep-alive error:', error.message);
  }
}, 5 * 60 * 1000); // Every 5 minutes

// Keep-alive endpoint to prevent cold starts
app.get('/ping', async (req, res) => {
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  
  // Perform a light database query to keep connections warm
  try {
    await supabase
      .from('inline_inspection_form_master_2')
      .select('id')
      .limit(1);
  } catch (dbError) {
    console.log('Ping database error:', dbError.message);
  }
  
  res.json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    uptimeFormatted: `${days} days, ${hours} hours, ${minutes} minutes`,
    server: 'Swanson India Portal Backend',
    version: '1.0.0',
    memory: process.memoryUsage(),
    platform: process.platform,
    nodeVersion: process.version,
    database: 'connected'
  });
});

// Additional keep-alive endpoint for external services
app.get('/keep-alive', (req, res) => {
  res.json({ 
    status: 'awake', 
    message: 'Server is actively kept alive',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

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
        console.log('🧹 Cleaned product code from "Jeddah":', prodCodeToCheck, '→', cleanedProdCode);
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
                console.log('🧹 Cleaned product code from other forms: "Jeddah" removed:', otherProdCode, '→', prod_code);
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
      worksheet.getCell('F10').value = emboss_type === 'Random' ? '✔' : '';
      worksheet.getCell('I10').value = emboss_type === 'Matte' ? '✔' : '';
      worksheet.getCell('L10').value = emboss_type === 'Micro' ? '✔' : '';
      
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
      worksheet.getCell('F10').value = emboss_type === 'Random' ? '✔' : '';
      worksheet.getCell('I10').value = emboss_type === 'Matte' ? '✔' : '';
      worksheet.getCell('L10').value = emboss_type === 'Micro' ? '✔' : '';
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
    const DATA_START_ROW = 13; // First row for data
    const DATA_END_ROW = 82; // Last row for data
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
    worksheet.getCell('L84').value = parseFloat(page1Summary.accepted_rolls) || 0;
    worksheet.getCell('N84').value = parseFloat(page1Summary.accepted_weight) || 0;
    worksheet.getCell('L85').value = parseFloat(page1Summary.rejected_rolls) || 0;
    worksheet.getCell('N85').value = parseFloat(page1Summary.rejected_weight) || 0;
    worksheet.getCell('L86').value = parseFloat(page1Summary.rework_rolls) || 0;
    worksheet.getCell('N86').value = parseFloat(page1Summary.rework_weight) || 0;
    worksheet.getCell('L87').value = parseFloat(page1Summary.kiv_rolls) || 0;
    worksheet.getCell('N87').value = parseFloat(page1Summary.kiv_weight) || 0;
    worksheet.getCell('L88').value = parseFloat(page1Summary.accepted_rolls + page1Summary.rejected_rolls + page1Summary.rework_rolls + page1Summary.kiv_rolls) || 0;
    worksheet.getCell('N88').value = parseFloat(page1Summary.accepted_weight + page1Summary.rejected_weight + page1Summary.rework_weight + page1Summary.kiv_weight) || 0;

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
        page2Worksheet.getCell('L84').value = parseFloat(page2Summary.accepted_rolls) || 0;
        page2Worksheet.getCell('N84').value = parseFloat(page2Summary.accepted_weight) || 0;
        page2Worksheet.getCell('L85').value = parseFloat(page2Summary.rejected_rolls) || 0;
        page2Worksheet.getCell('N85').value = parseFloat(page2Summary.rejected_weight) || 0;
        page2Worksheet.getCell('L86').value = parseFloat(page2Summary.rework_rolls) || 0;
        page2Worksheet.getCell('N86').value = parseFloat(page2Summary.rework_weight) || 0;
        page2Worksheet.getCell('L87').value = parseFloat(page2Summary.kiv_rolls) || 0;
        page2Worksheet.getCell('N87').value = parseFloat(page2Summary.kiv_weight) || 0;
        page2Worksheet.getCell('L88').value = parseFloat(page2Summary.accepted_rolls + page2Summary.rejected_rolls + page2Summary.rework_rolls + page2Summary.kiv_rolls) || 0;
        page2Worksheet.getCell('N88').value = parseFloat(page2Summary.accepted_weight + page2Summary.rejected_weight + page2Summary.rework_weight + page2Summary.kiv_weight) || 0;

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
        page3Worksheet.getCell('L84').value = parseFloat(page3Summary.accepted_rolls) || 0;
        page3Worksheet.getCell('N84').value = parseFloat(page3Summary.accepted_weight) || 0;
        page3Worksheet.getCell('L85').value = parseFloat(page3Summary.rejected_rolls) || 0;
        page3Worksheet.getCell('N85').value = parseFloat(page3Summary.rejected_weight) || 0;
        page3Worksheet.getCell('L86').value = parseFloat(page3Summary.rework_rolls) || 0;
        page3Worksheet.getCell('N86').value = parseFloat(page3Summary.rework_weight) || 0;
        page3Worksheet.getCell('L87').value = parseFloat(page3Summary.kiv_rolls) || 0;
        page3Worksheet.getCell('N87').value = parseFloat(page3Summary.kiv_weight) || 0;
        page3Worksheet.getCell('L88').value = parseFloat(page3Summary.accepted_rolls + page3Summary.rejected_rolls + page3Summary.rework_rolls + page3Summary.kiv_rolls) || 0;
        page3Worksheet.getCell('N88').value = parseFloat(page3Summary.accepted_weight + page3Summary.rejected_weight + page3Summary.rework_weight + page3Summary.kiv_weight) || 0;

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
// 168-16CP Kranti Film Inspection Form Excel Export Endpoint
app.get('/export-168-16cp-kranti-form', async (req, res) => {
  try {
    // Get form_id parameter
    const { form_id } = req.query;
    
    if (!form_id) {
      return res.status(400).send('form_id parameter is required');
    }

    // 1. Fetch data from Supabase for the specific form
    const { data, error } = await supabase
      .from('168_16cp_kranti')
      .select('*')
      .eq('form_id', form_id)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).send('Error fetching data from database');
    }

    if (!data) {
      return res.status(404).send('Form not found');
    }


    // 2. Load the template
    const templatePath = path.join(__dirname, 'templates', '168-16cp-kranti.xlsx');
    
    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      console.error('Template file does not exist at:', templatePath);
      return res.status(500).send('Template file not found');
    }
    
    let workbook;
    let worksheet;
    
    // Load the template file
    try {
      workbook = await XlsxPopulate.fromFileAsync(templatePath);
      worksheet = workbook.sheet('Page1');
    } catch (error) {
      console.log('Error loading template:', error.message);
      workbook = await XlsxPopulate.fromBlankAsync();
      const page1Worksheet = workbook.addSheet('Page1');
      worksheet = page1Worksheet;
    }

    // 4. Map data to Excel cells
    
    // Product Code (C4)
    worksheet.cell('C4').value(data.product_code || '');
    
    // Specification (C5) 
    worksheet.cell('C5').value(data.specification || '');
    
    // Production Order (H4)
    worksheet.cell('H4').value(data.production_order || '');
    
    // Purchase Order (H5)
    worksheet.cell('H5').value(data.purchase_order || '');
    
    // Machine (K4)
    worksheet.cell('K4').value(data.machine_no || '');
    
    // Quantity (K5) - Add "Rolls" text like prestore form
    worksheet.cell('K5').value(data.quantity ? `${data.quantity} Rolls` : '');
    
    // Production Date (N4) - format as DD/MM/YYYY
    worksheet.cell('N4').value(data.production_date ? formatDateToDDMMYYYY(data.production_date) : '');
    
    // Inspection Date (N5) - format as DD/MM/YYYY  
    worksheet.cell('N5').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
    
    // Inspected By (B41)
    worksheet.cell('B41').value(data.prepared_by || 'Unknown User');

    // Inspection Date (B42) - format as DD/MM/YYYY
    worksheet.cell('B42').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Verified By (M41)
    worksheet.cell('M41').value(data.verified_by || 'Not Verified');

    // Verified Date (M42) - format as DD/MM/YYYY
    worksheet.cell('M42').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

    // Film Inspection Form Ref No (O3)
    worksheet.cell('O3').value(data.film_insp_form_ref_no || '');
    
    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;
      
      // Basic Weight Equipment (D6)
      worksheet.cell('D6').value(equipment.basic_weight || '');
      
      // Thickness Equipment (F6)
      worksheet.cell('F6').value(equipment.thickness || '');
      
      // Opacity Equipment (H6)
      worksheet.cell('H6').value(equipment.opacity || '');
      
      // COF Equipment (J6)
      worksheet.cell('J6').value(equipment.cof || '');
      
      // Cut Width Equipment (L6)
      worksheet.cell('L6').value(equipment.cut_width || '');
      
      // Color Equipment (N6) - Use unprinted equipment for both unprinted and printed
      // Since both use the same equipment type (X-RITE), use unprinted equipment ID
      worksheet.cell('N6').value(equipment.color_unprinted || '');
    }
    
    // Map sample data to the correct columns
    
    // Sample data should go in rows 8-37 (30 rows) - preserve HTML form structure
    // Top rows (8-25): Historical data, Bottom rows (26-37): Fresh data
    // Lot & Roll data to Sample No. column (A8-A37)
    if (data.lot_and_roll) {
      const lotAndRollData = data.lot_and_roll;
      const dataValues = Object.values(lotAndRollData).filter(value => value !== null && value !== undefined && value !== '');
      
      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.cell(`A${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`A${row}`).value(''); // Empty row
        }
      }
    }
    
    // Roll ID data to column B (B8-B37) - preserve HTML form structure
    if (data.roll_id) {
      const rollIdData = data.roll_id;
      const dataValues = Object.values(rollIdData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.cell(`B${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`B${row}`).value(''); // Empty row
        }
      }
    }

    // Lot Time data to column C (C8-C37) - preserve HTML form structure
    if (data.lot_time) {
      const lotTimeData = data.lot_time;
      const dataValues = Object.values(lotTimeData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.cell(`C${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`C${row}`).value(''); // Empty row
        }
      }
    }
    
    // Map page1 data to the measurement columns - preserve HTML form structure
    // Basic Weight data to column D (D8-D37)
    if (data.page1_basis_weight) {
      const basicWeightData = data.page1_basis_weight;
      const dataValues = Object.values(basicWeightData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`D${row}`).value('');
        }
      }
    }
    
    // Thickness data to column F (F8-F37)
    if (data.page1_thickness) {
      const thicknessData = data.page1_thickness;
      const dataValues = Object.values(thicknessData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`F${row}`).value('');
        }
      }
    }
    
    // Opacity data to column H (H8-H37)
    if (data.page1_opacity) {
      const opacityData = data.page1_opacity;
      const dataValues = Object.values(opacityData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`H${row}`).value('');
        }
      }
    }
    
    // COF data to column J (J8-J37)
    if (data.page1_cof_kinetic) {
      const cofData = data.page1_cof_kinetic;
      const dataValues = Object.values(cofData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`J${row}`).value('');
        }
      }
    }
    
    // Cut Width data to column L (L8-L37)
    if (data.page1_cut_width) {
      const cutWidthData = data.page1_cut_width;
      const dataValues = Object.values(cutWidthData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.cell(`L${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`L${row}`).value('');
        }
      }
    }
    
    // Color Unprinted data to column N (N8-N37)
    if (data.page1_color_delta_unprinted) {
      const colorUnprintedData = data.page1_color_delta_unprinted;
      const dataValues = Object.values(colorUnprintedData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.cell(`N${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`N${row}`).value('');
        }
      }
    }
    
    // Color-Delta E (Printed Film) data to column O (O8-O37)
    if (data.page1_color_delta_printed) {
      const colorPrintedData = data.page1_color_delta_printed;
      const dataValues = Object.values(colorPrintedData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.cell(`O${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`O${row}`).value('');
        }
      }
    }

    // Note: xlsx-populate doesn't support calcProperties like ExcelJS
    // Formulas will be calculated when the file is opened in Excel
    
    // Note: xlsx-populate handles formula calculation differently
    // No need for dummy cell manipulation
    

    // Map Page 2 data if Page2 worksheet exists
    const page2Worksheet = workbook.sheet('Page2');
    if (page2Worksheet) {
      // Inspected By (B42)
      page2Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');

      // Inspection Date (B43) - format as DD/MM/YYYY
      page2Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

      // Verified By (M42)
      page2Worksheet.cell('M42').value(data.verified_by || 'Not Verified');

      // Verified Date (M43) - format as DD/MM/YYYY
      page2Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

      // Film Inspection Form Ref No (O3)
      page2Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');
      
      // Equipment data for Page 2 (D6)
      if (data.equipment_used && data.equipment_used.page2) {
        page2Worksheet.cell('D6').value(data.equipment_used.page2.common || '');
      }
      
      // Page 2 data mapping - Elongation MD and Force MD data - fill from bottom up
      // Elongation MD 1 data to column D (D9-D38)
      if (data.page2_elongation_md_1) {
        const elongationData = data.page2_elongation_md_1;
        const dataValues = Object.values(elongationData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`D${row}`).value(''); // Preserve empty values
          }
          row--;
        }
      }
      
      // Elongation MD 2 data to column E (E9-E38) - fill from bottom up
      if (data.page2_elongation_md_2) {
        const elongationData = data.page2_elongation_md_2;
        const dataValues = Object.values(elongationData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`E${row}`).value(''); // Preserve empty values
          }
          row--;
        }
      }
      
      // Elongation MD 3 data to column F (F9-F38) - fill from bottom up
      if (data.page2_elongation_md_3) {
        const elongationData = data.page2_elongation_md_3;
        const dataValues = Object.values(elongationData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`F${row}`).value(''); // Preserve empty values
          }
          row--;
        }
      }
      
      // Force MD 1 data to column H (H9-H38) - fill from bottom up
      if (data.page2_force_md_1) {
        const forceData = data.page2_force_md_1;
        const dataValues = Object.values(forceData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`H${row}`).value(''); // Preserve empty values
          }
          row--;
        }
      }
      
      // Force MD 2 data to column I (I9-I38) - fill from bottom up
      if (data.page2_force_md_2) {
        const forceData = data.page2_force_md_2;
        const dataValues = Object.values(forceData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`I${row}`).value(''); // Preserve empty values
          }
          row--;
        }
      }
      
      // Force MD 3 data to column J (J9-J38) - fill from bottom up
      if (data.page2_force_md_3) {
        const forceData = data.page2_force_md_3;
        const dataValues = Object.values(forceData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`J${row}`).value(''); // Preserve empty values
          }
          row--;
        }
      }
      
      // Force 5% MD 1 data to column L (L9-L38) - fill from bottom up
      if (data.page2_force_5p_md_1) {
        const force5pData = data.page2_force_5p_md_1;
        const dataValues = Object.values(force5pData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`L${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`L${row}`).value(''); // Preserve empty values
          }
          row--;
        }
      }
      
      // Force 5% MD 2 data to column M (M9-M38) - fill from bottom up
      if (data.page2_force_5p_md_2) {
        const force5pData = data.page2_force_5p_md_2;
        const dataValues = Object.values(force5pData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`M${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`M${row}`).value(''); // Preserve empty values
          }
          row--;
        }
      }
      
      // Force 5% MD 3 data to column N (N9-N38) - fill from bottom up
      if (data.page2_force_5p_md_3) {
        const force5pData = data.page2_force_5p_md_3;
        const dataValues = Object.values(force5pData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`N${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`N${row}`).value(''); // Preserve empty values
          }
          row--;
        }
      }
      
    } else {
    }

    // Map Page 3 data if Page3 worksheet exists
    const page3Worksheet = workbook.sheet('Page3');
    if (page3Worksheet) {
      // Inspected By (B42)
      page3Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');

      // Inspection Date (B43) - format as DD/MM/YYYY
      page3Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

      // Verified By (M42)
      page3Worksheet.cell('M42').value(data.verified_by || 'Not Verified');

      // Verified Date (M43) - format as DD/MM/YYYY
      page3Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

      // Film Inspection Form Ref No (O3)
      page3Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');
      
      // Equipment data for Page 3 (D6)
      if (data.equipment_used && data.equipment_used.page3) {
        page3Worksheet.cell('D6').value(data.equipment_used.page3.common || '');
      }
      
      // Page 3 data mapping - Elongation CD, Force CD, and Modulus data - fill from bottom up
      // Elongation CD 1 data to column D (D9-D38)
      if (data.page3_elongation_cd_1) {
        const elongationData = data.page3_elongation_cd_1;
        const dataValues = Object.values(elongationData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page3Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
          row--;
        }
      }
      
      // Elongation CD 2 data to column E (E9-E38) - fill from bottom up
      if (data.page3_elongation_cd_2) {
        const elongationData = data.page3_elongation_cd_2;
        const dataValues = Object.values(elongationData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page3Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
          row--;
        }
      }
      
      // Elongation CD 3 data to column F (F9-F38) - fill from bottom up
      if (data.page3_elongation_cd_3) {
        const elongationData = data.page3_elongation_cd_3;
        const dataValues = Object.values(elongationData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page3Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
          row--;
        }
      }
      
      // Force CD 1 data to column H (H9-H38) - fill from bottom up
      if (data.page3_force_cd_1) {
        const forceData = data.page3_force_cd_1;
        const dataValues = Object.values(forceData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page3Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
          row--;
        }
      }
      
      // Force CD 2 data to column I (I9-I38) - fill from bottom up
      if (data.page3_force_cd_2) {
        const forceData = data.page3_force_cd_2;
        const dataValues = Object.values(forceData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page3Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
          row--;
        }
      }
      
      // Force CD 3 data to column J (J9-J38) - fill from bottom up
      if (data.page3_force_cd_3) {
        const forceData = data.page3_force_cd_3;
        const dataValues = Object.values(forceData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page3Worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
          row--;
        }
      }
      
      // Modulus 1 data to column L (L9-L38) - fill from bottom up
      if (data.page3_modulus_1) {
        const modulusData = data.page3_modulus_1;
        const dataValues = Object.values(modulusData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page3Worksheet.cell(`L${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
          row--;
        }
      }
      
      // Modulus 2 data to column M (M9-M38) - fill from bottom up
      if (data.page3_modulus_2) {
        const modulusData = data.page3_modulus_2;
        const dataValues = Object.values(modulusData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page3Worksheet.cell(`M${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
          row--;
        }
      }
      
      // Modulus 3 data to column N (N9-N38) - fill from bottom up
      if (data.page3_modulus_3) {
        const modulusData = data.page3_modulus_3;
        const dataValues = Object.values(modulusData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page3Worksheet.cell(`N${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
          row--;
        }
      }
      
    } else {
    }

    // Map Page 4 data if Page4 worksheet exists
    const page4Worksheet = workbook.sheet('Page4');
    if (page4Worksheet) {
      // Inspected By (B42)
      page4Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');

      // Inspection Date (B43) - format as DD/MM/YYYY
      page4Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

      // Verified By (M42)
      page4Worksheet.cell('M42').value(data.verified_by || 'Not Verified');

      // Verified Date (M43) - format as DD/MM/YYYY
      page4Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

      // Film Inspection Form Ref No (O3)
      page4Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');
      
      // Equipment data for Page 4 (D6)
      if (data.equipment_used && data.equipment_used.page4) {
        page4Worksheet.cell('D6').value(data.equipment_used.page4.gloss || '');
      }
      
      // Page 4 data mapping - Gloss and PG Quality data - fill from bottom up
      // Gloss 1 data to column D (D9-D38)
      if (data.page4_gloss_1) {
        const glossData = data.page4_gloss_1;
        const dataValues = Object.values(glossData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page4Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
          row--;
        }
      }
      
      // Gloss 2 data to column E (E9-E38) - fill from bottom up
      if (data.page4_gloss_2) {
        const glossData = data.page4_gloss_2;
        const dataValues = Object.values(glossData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page4Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
          row--;
        }
      }
      
      // Gloss 3 data to column F (F9-F38) - fill from bottom up
      if (data.page4_gloss_3) {
        const glossData = data.page4_gloss_3;
        const dataValues = Object.values(glossData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page4Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
          row--;
        }
      }
      
      // PG Quality data to column H (H9-H38) - fill from bottom up
      if (data.page4_pg_quality) {
        const pgQualityData = data.page4_pg_quality;
        const dataValues = Object.values(pgQualityData).filter(value => value !== null && value !== undefined && value !== '');
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page4Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
          row--;
        }
      }
      
    } else {
    }

    // 5. Set response headers for Excel download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    // Generate filename with standardized format: FIF-{product_code}-{batch_no}
    const productCode = data.product_code || 'UNKNOWN';
    const batchNo = data.batch || form_id;
    const filename = `FIF-${productCode}-${batchNo}.xlsx`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    // 6. Write the workbook to response
    const buffer = await workbook.outputAsync();
    res.send(buffer);

  } catch (error) {
    console.error('Error exporting 168-16CP Kranti form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting 168-16CP Kranti form: ${error.message}`);
  }
});
// APE-168(16)C White Film Inspection Form Excel Export Endpoint
app.get('/export-168-16c-white-form', async (req, res) => {
  try {
    // Get form_id parameter
    const { form_id } = req.query;

    if (!form_id) {
      return res.status(400).send('form_id parameter is required');
    }

    // 1. Fetch data from Supabase for the specific form
    const { data, error } = await supabase
      .from('168_16c_white')
      .select('*')
      .eq('form_id', form_id)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).send('Error fetching data from database');
    }

    if (!data) {
      return res.status(404).send('Form not found');
    }

    // 2. Load the template
    const templatePath = path.join(__dirname, 'templates', '168-16c-white.xlsx');

    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      console.error('Template file does not exist at:', templatePath);
      return res.status(500).send('Template file not found');
    }

    let workbook;
    let worksheet;

    // Load the template file
    try {
      workbook = await XlsxPopulate.fromFileAsync(templatePath);
      worksheet = workbook.sheet('Page1');
    } catch (error) {
      console.log('Error loading template:', error.message);
      workbook = await XlsxPopulate.fromBlankAsync();
      const page1Worksheet = workbook.addSheet('Page1');
      worksheet = page1Worksheet;
    }

    // 3. Map data to Excel cells

    // Product Code (B4)
    worksheet.cell('B4').value(data.product_code || '');

    // Specification (B5)
    worksheet.cell('B5').value(data.specification || '');

    // Production Order (G4)
    worksheet.cell('G4').value(data.production_order || '');

    // Purchase Order (G5)
    worksheet.cell('G5').value(data.purchase_order || '');

    // Machine (J4)
    worksheet.cell('J4').value(data.machine_no || '');

    // Quantity (J5) - Add "Rolls" text like prestore form
    worksheet.cell('J5').value(data.quantity ? `${data.quantity} Rolls` : '');

    // Production Date (N4) - format as DD/MM/YYYY
    worksheet.cell('N4').value(data.production_date ? formatDateToDDMMYYYY(data.production_date) : '');

    // Inspection Date (N5) - format as DD/MM/YYYY
    worksheet.cell('N5').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Inspected By (B41)
    worksheet.cell('B41').value(data.prepared_by || 'Unknown User');

    // Inspection Date (B42) - format as DD/MM/YYYY
    worksheet.cell('B42').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Verified By (L41)
    worksheet.cell('L41').value(data.verified_by || 'Not Verified');

    // Verified Date (L42) - format as DD/MM/YYYY
    worksheet.cell('L42').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

    // Film Inspection Form Ref No (O3)
    worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;

      // Basic Weight Equipment (D6)
      worksheet.cell('D6').value(equipment.basic_weight || '');

      // Thickness Equipment (G6)
      worksheet.cell('G6').value(equipment.thickness || '');

      // Opacity Equipment (J6)
      worksheet.cell('J6').value(equipment.opacity || '');

      // COF Equipment (M6)
      worksheet.cell('M6').value(equipment.cof || '');
    }

    // Map sample data to the correct columns

    // Sample data should go in rows 8-37 (30 rows) - preserve HTML form structure
    // Top rows (8-25): Historical data, Bottom rows (26-37): Fresh data
    // Lot & Roll data to Sample No. column (A8-A37)
    if (data.lot_and_roll) {
      const lotAndRollData = data.lot_and_roll;
      const dataValues = Object.values(lotAndRollData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.cell(`A${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`A${row}`).value(''); // Empty row
        }
      }
    }

    // Roll ID data to column B (B8-B37) - preserve HTML form structure
    if (data.roll_id) {
      const rollIdData = data.roll_id;
      const dataValues = Object.values(rollIdData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.cell(`B${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`B${row}`).value(''); // Empty row
        }
      }
    }

    // Lot Time data to column C (C8-C37) - preserve HTML form structure
    if (data.lot_time) {
      const lotTimeData = data.lot_time;
      const dataValues = Object.values(lotTimeData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.cell(`C${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`C${row}`).value(''); // Empty row
        }
      }
    }

    // Basic Weight data to column D (D8-D37)
    if (data.page1_basis_weight) {
      const basicWeightData = data.page1_basis_weight;
      const dataValues = Object.values(basicWeightData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`D${row}`).value('');
        }
      }
    }

    // Thickness data to column G (G8-G37)
    if (data.page1_thickness) {
      const thicknessData = data.page1_thickness;
      const dataValues = Object.values(thicknessData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`G${row}`).value('');
        }
      }
    }

    // Opacity data to column J (J8-J37)
    if (data.page1_opacity) {
      const opacityData = data.page1_opacity;
      const dataValues = Object.values(opacityData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`J${row}`).value('');
        }
      }
    }

    // COF data to column M (M8-M37)
    if (data.page1_cof_kinetic) {
      const cofData = data.page1_cof_kinetic;
      const dataValues = Object.values(cofData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.cell(`M${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`M${row}`).value('');
        }
      }
    }


    // Map Page 2 data if Page2 worksheet exists
    const page2Worksheet = workbook.sheet('Page2');
    if (page2Worksheet) {
      // Copy header info to Page 2
      page2Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page2Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page2Worksheet.cell('M42').value(data.verified_by || 'Not Verified');
      page2Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page2Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

      // Equipment data for Page 2 (D6)
      if (data.equipment_used && data.equipment_used.page2) {
        page2Worksheet.cell('D6').value(data.equipment_used.page2.common || '');
      }

      // Page 2 data mapping - Elongation MD and Force MD data - fill from bottom up
      // Elongation MD 1 data to column D (D9-D38)
      if (data.page2_elongation_md_1) {
        const elongationData = data.page2_elongation_md_1;
        const dataValues = Object.values(elongationData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`D${row}`).value('');
          }
          row--;
        }
      }

      // Elongation MD 2 data to column E (E9-E38)
      if (data.page2_elongation_md_2) {
        const elongationData = data.page2_elongation_md_2;
        const dataValues = Object.values(elongationData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`E${row}`).value('');
          }
          row--;
        }
      }

      // Elongation MD 3 data to column F (F9-F38)
      if (data.page2_elongation_md_3) {
        const elongationData = data.page2_elongation_md_3;
        const dataValues = Object.values(elongationData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`F${row}`).value('');
          }
          row--;
        }
      }

      // Force MD 1 data to column H (H9-H38)
      if (data.page2_force_md_1) {
        const forceData = data.page2_force_md_1;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`H${row}`).value('');
          }
          row--;
        }
      }

      // Force MD 2 data to column I (I9-I38)
      if (data.page2_force_md_2) {
        const forceData = data.page2_force_md_2;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`I${row}`).value('');
          }
          row--;
        }
      }

      // Force MD 3 data to column J (J9-J38)
      if (data.page2_force_md_3) {
        const forceData = data.page2_force_md_3;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`J${row}`).value('');
          }
          row--;
        }
      }

      // Force 5% MD 1 data to column L (L9-L38)
      if (data.page2_force_5p_md_1) {
        const forceData = data.page2_force_5p_md_1;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`L${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`L${row}`).value('');
          }
          row--;
        }
      }

      // Force 5% MD 2 data to column M (M9-M38)
      if (data.page2_force_5p_md_2) {
        const forceData = data.page2_force_5p_md_2;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`M${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`M${row}`).value('');
          }
          row--;
        }
      }

      // Force 5% MD 3 data to column N (N9-N38)
      if (data.page2_force_5p_md_3) {
        const forceData = data.page2_force_5p_md_3;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`N${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`N${row}`).value('');
          }
          row--;
        }
      }
    }

    // Map Page 3 data if Page3 worksheet exists
    const page3Worksheet = workbook.sheet('Page3');
    if (page3Worksheet) {
      // Copy header info to Page 3
      page3Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page3Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page3Worksheet.cell('M42').value(data.verified_by || 'Not Verified');
      page3Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page3Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

      // Equipment data for Page 3 (D6)
      if (data.equipment_used && data.equipment_used.page3) {
        page3Worksheet.cell('D6').value(data.equipment_used.page3.common || '');
      }

      // Page 3 data mapping - Elongation CD and Force CD data - fill from bottom up
      // Elongation CD 1 data to column D (D9-D38)
      if (data.page3_elongation_cd_1) {
        const elongationData = data.page3_elongation_cd_1;
        const dataValues = Object.values(elongationData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`D${row}`).value('');
          }
          row--;
        }
      }

      // Elongation CD 2 data to column E (E9-E38)
      if (data.page3_elongation_cd_2) {
        const elongationData = data.page3_elongation_cd_2;
        const dataValues = Object.values(elongationData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`E${row}`).value('');
          }
          row--;
        }
      }

      // Elongation CD 3 data to column F (F9-F38)
      if (data.page3_elongation_cd_3) {
        const elongationData = data.page3_elongation_cd_3;
        const dataValues = Object.values(elongationData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`F${row}`).value('');
          }
          row--;
        }
      }

      // Force CD 1 data to column H (H9-H38)
      if (data.page3_force_cd_1) {
        const forceData = data.page3_force_cd_1;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`H${row}`).value('');
          }
          row--;
        }
      }

      // Force CD 2 data to column I (I9-I38)
      if (data.page3_force_cd_2) {
        const forceData = data.page3_force_cd_2;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`I${row}`).value('');
          }
          row--;
        }
      }

      // Force CD 3 data to column J (J9-J38)
      if (data.page3_force_cd_3) {
        const forceData = data.page3_force_cd_3;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`J${row}`).value('');
          }
          row--;
        }
      }

      // Modulus 1 data to column L (L9-L38)
      if (data.page3_modulus_1) {
        const modulusData = data.page3_modulus_1;
        const dataValues = Object.values(modulusData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.cell(`L${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`L${row}`).value('');
          }
          row--;
        }
      }

      // Modulus 2 data to column M (M9-M38)
      if (data.page3_modulus_2) {
        const modulusData = data.page3_modulus_2;
        const dataValues = Object.values(modulusData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.cell(`M${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`M${row}`).value('');
          }
          row--;
        }
      }

      // Modulus 3 data to column N (N9-N38)
      if (data.page3_modulus_3) {
        const modulusData = data.page3_modulus_3;
        const dataValues = Object.values(modulusData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.cell(`N${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`N${row}`).value('');
          }
          row--;
        }
      }
    }

    // Map Page 4 data if Page4 worksheet exists
    const page4Worksheet = workbook.sheet('Page4');
    if (page4Worksheet) {
      // Copy header info to Page 4
      page4Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page4Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page4Worksheet.cell('M42').value(data.verified_by || 'Not Verified');
      page4Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page4Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

      // Equipment data for Page 4 (D6, L6)
      if (data.equipment_used && data.equipment_used.page4) {
        page4Worksheet.cell('D6').value(data.equipment_used.page4.color_common || '');
        page4Worksheet.cell('L6').value(data.equipment_used.page4.gloss || '');
      }

      // Page 4 data mapping - Color and Gloss data - fill from bottom up
      // Color L data to column D (D9-D38)
      if (data.page4_color_l) {
        const colorData = data.page4_color_l;
        const dataValues = Object.values(colorData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page4Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page4Worksheet.cell(`D${row}`).value('');
          }
          row--;
        }
      }

      // Color A data to column F (F9-F38)
      if (data.page4_color_a) {
        const colorData = data.page4_color_a;
        const dataValues = Object.values(colorData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page4Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page4Worksheet.cell(`F${row}`).value('');
          }
          row--;
        }
      }

      // Color B data to column H (H9-H38)
      if (data.page4_color_b) {
        const colorData = data.page4_color_b;
        const dataValues = Object.values(colorData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page4Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page4Worksheet.cell(`H${row}`).value('');
          }
          row--;
        }
      }

      // Color Delta E data to column J (J9-J38)
      if (data.page4_color_delta_e) {
        const colorData = data.page4_color_delta_e;
        const dataValues = Object.values(colorData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page4Worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page4Worksheet.cell(`J${row}`).value('');
          }
          row--;
        }
      }

      // Gloss 1 data to column L (L9-L38)
      if (data.page4_gloss_1) {
        const glossData = data.page4_gloss_1;
        const dataValues = Object.values(glossData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page4Worksheet.cell(`L${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page4Worksheet.cell(`L${row}`).value('');
          }
          row--;
        }
      }

      // Gloss 2 data to column M (M9-M38)
      if (data.page4_gloss_2) {
        const glossData = data.page4_gloss_2;
        const dataValues = Object.values(glossData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page4Worksheet.cell(`M${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page4Worksheet.cell(`M${row}`).value('');
          }
          row--;
        }
      }

      // Gloss 3 data to column N (N9-N38)
      if (data.page4_gloss_3) {
        const glossData = data.page4_gloss_3;
        const dataValues = Object.values(glossData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page4Worksheet.cell(`N${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page4Worksheet.cell(`N${row}`).value('');
          }
          row--;
        }
      }
    }

    // Map Page 5 data if Page5 worksheet exists
    const page5Worksheet = workbook.sheet('Page5');
    if (page5Worksheet) {
      // Copy header info to Page 5
      page5Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page5Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page5Worksheet.cell('M42').value(data.verified_by || 'Not Verified');
      page5Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page5Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

      // Equipment data for Page 5 (D6)
      if (data.equipment_used && data.equipment_used.page5) {
        page5Worksheet.cell('D6').value(data.equipment_used.page5.common || '');
      }

      // Page 5 data mapping - PG Quality data - fill from bottom up
      // PG Quality data to column D (D9-D38)
      if (data.page5_pg_quality) {
        const pgQualityData = data.page5_pg_quality;
        const dataValues = Object.values(pgQualityData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            page5Worksheet.cell(`D${row}`).value(value);
          } else {
            page5Worksheet.cell(`D${row}`).value('');
          }
          row--;
        }
      }
    }

    // 4. Generate filename with standardized format: FIF-{product_code}-{batch_no}
    const productCode = data.product_code || 'UNKNOWN';
    const batchNo = data.batch || form_id;
    const filename = `FIF-${productCode}-${batchNo}.xlsx`;

    // 5. Set response headers for Excel download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    // 6. Write the workbook to response
    const buffer = await workbook.outputAsync();
    res.send(buffer);

  } catch (error) {
    console.error('Error exporting APE-168(16)C White form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting APE-168(16)C White form: ${error.message}`);
  }
});
// APE-168(18)C (Jeddah) Film Inspection Form Excel Export Endpoint
app.get('/export-168-18c-white-jeddah-form', async (req, res) => {
  try {
    // Get form_id parameter
    const { form_id } = req.query;

    if (!form_id) {
      return res.status(400).send('form_id parameter is required');
    }

    // 1. Fetch data from Supabase for the specific form
    // First try the Jeddah table
    let { data, error } = await supabase
      .from('168_18c_white_jeddah')
      .select('*')
      .eq('form_id', form_id)
      .single();

    // If not found in Jeddah table, try the regular 168 table
    if (error && (error.code === 'PGRST116' || error.message?.includes('No rows found'))) {
      console.log(`Form ${form_id} not found in Jeddah table, trying regular 168 table...`);

      const { data: regularData, error: regularError } = await supabase
        .from('168_18c_white')
        .select('*')
        .eq('form_id', form_id)
        .single();

      if (regularError) {
        console.error('Supabase error in regular table:', regularError);
        return res.status(404).send('Form not found in either Jeddah or regular 168 table');
      }

      if (!regularData) {
        return res.status(404).send('Form not found');
      }

      // Check if this is actually a Jeddah form
      if (regularData.product_code && regularData.product_code.includes('Jeddah')) {
        console.log(`Found form ${form_id} in regular table but it appears to be a Jeddah form. Consider moving it to Jeddah table.`);
      }

      data = regularData;
      error = null;
    }

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).send('Error fetching data from database');
    }

    if (!data) {
      return res.status(404).send('Form not found');
    }

    console.log('=== APE-168(18)C (Jeddah) Export Starting ===');
    console.log('Form ID:', form_id);
    console.log('Product Code:', data.product_code);

    // 2. Load the template
    const templatePath = path.join(__dirname, 'templates', '168-18c-white-jeddah.xlsx');

    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      console.error('Template file does not exist at:', templatePath);
      return res.status(500).send('Template file not found');
    }

    let workbook;
    let worksheet;

    // Load the template file
    try {
      workbook = await XlsxPopulate.fromFileAsync(templatePath);
      worksheet = workbook.sheet('Page1');
      console.log('Template loaded successfully');
    } catch (error) {
      console.log('Error loading template:', error.message);
      console.log('Error stack:', error.stack);
      return res.status(500).send(`Error loading template: ${error.message}`);
    }

    // 3. Map data to Excel cells

    // Product Code (B4)
    worksheet.cell('B4').value(data.product_code || '');

    // Specification (B5)
    worksheet.cell('B5').value(data.specification || '');

    // Production Order (F4)
    worksheet.cell('F4').value(data.production_order || '');

    // Purchase Order (F5)
    worksheet.cell('F5').value(data.purchase_order || '');

    // Machine (J4)
    worksheet.cell('J4').value(data.machine_no || '');

    // Quantity (J5) - Add "Rolls" text like prestore form
    worksheet.cell('J5').value(data.quantity ? `${data.quantity} Rolls` : '');

    // Production Date (N4) - format as DD/MM/YYYY
    worksheet.cell('N4').value(data.production_date ? formatDateToDDMMYYYY(data.production_date) : '');

    // Inspection Date (N5) - format as DD/MM/YYYY
    worksheet.cell('N5').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Inspected By (B41)
    worksheet.cell('B41').value(data.prepared_by || 'Unknown User');

    // Inspection Date (B42) - format as DD/MM/YYYY
    worksheet.cell('B42').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Verified By (L41)
    worksheet.cell('L41').value(data.verified_by || 'Not Verified');

    // Verified Date (L42) - format as DD/MM/YYYY
    worksheet.cell('L42').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

    // Film Inspection Form Ref No (O3)
    worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;

      // Basic Weight Equipment (D6)
      worksheet.cell('D6').value(equipment.basic_weight || '');

      // Thickness Equipment (G6)
      worksheet.cell('G6').value(equipment.thickness || '');

      // Opacity Equipment (J6)
      worksheet.cell('J6').value(equipment.opacity || '');

      // COF Equipment (M6)
      worksheet.cell('M6').value(equipment.cof || '');
    }

    // Map sample data to the correct columns

    // Sample data should go in rows 8-37 (30 rows) - preserve HTML form structure
    // Top rows (8-25): Historical data, Bottom rows (26-37): Fresh data
    // Lot & Roll data to Sample No. column (A8-A37)
    if (data.lot_and_roll) {
      const lotAndRollData = data.lot_and_roll;
      const dataValues = Object.values(lotAndRollData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.cell(`A${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`A${row}`).value(''); // Empty row
        }
      }
    }

    // Roll ID data to column B (B8-B37) - preserve HTML form structure
    if (data.roll_id) {
      const rollIdData = data.roll_id;
      const dataValues = Object.values(rollIdData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.cell(`B${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`B${row}`).value(''); // Empty row
        }
      }
    }

    // Lot Time data to column C (C8-C37) - preserve HTML form structure
    if (data.lot_time) {
      const lotTimeData = data.lot_time;
      const dataValues = Object.values(lotTimeData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.cell(`C${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`C${row}`).value(''); // Empty row
        }
      }
    }

    // Basic Weight data to column D (D8-D37)
    if (data.page1_basis_weight) {
      const basicWeightData = data.page1_basis_weight;
      const dataValues = Object.values(basicWeightData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`D${row}`).value('');
        }
      }
    }

    // Thickness data to column G (G8-G37)
    if (data.page1_thickness) {
      const thicknessData = data.page1_thickness;
      const dataValues = Object.values(thicknessData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`G${row}`).value('');
        }
      }
    }

    // Opacity data to column J (J8-J37)
    if (data.page1_opacity) {
      const opacityData = data.page1_opacity;
      const dataValues = Object.values(opacityData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`J${row}`).value('');
        }
      }
    }

    // COF data to column M (M8-M37)
    if (data.page1_cof_kinetic) {
      const cofData = data.page1_cof_kinetic;
      const dataValues = Object.values(cofData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.cell(`M${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`M${row}`).value('');
        }
      }
    }

    // PAGE 2 DATA MAPPING - APE-168(18)C (Jeddah) Page 2 data (Elongation & Force MD)
    const hasPage2Data = data.page2_elongation_md_1 || data.page2_force_md_1 || data.page2_force_5p_md_1;

    if (hasPage2Data) {
      console.log('Page 2 data detected, mapping Elongation and Force MD measurements');

      // Create Page2 sheet if it doesn't exist
      try {
        page2Worksheet = workbook.sheet('Page2');
      } catch (error) {
        // Page2 sheet doesn't exist, create it
        page2Worksheet = workbook.addSheet('Page2');
        console.log('Created Page2 sheet for 168 Jeddah form');
      }

      // Equipment data for Page 2 (D6)
      if (data.equipment_used && data.equipment_used.page2) {
        page2Worksheet.cell('D6').value(data.equipment_used.page2.common || '');
      }

      // Elongation MD 1 data to column D (D9-D38)
      if (data.page2_elongation_md_1) {
        const elongationMD1Data = data.page2_elongation_md_1;
        console.log('Page 2 Elongation MD 1 Data:', elongationMD1Data);

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationMD1Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column D (rows 9-38) on Page2 sheet
        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9; // Convert to 0-based index
          page2Worksheet.cell(`D${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Elongation MD 2 data to column E (E9-E38)
      if (data.page2_elongation_md_2) {
        const elongationMD2Data = data.page2_elongation_md_2;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationMD2Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.cell(`E${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Elongation MD 3 data to column F (F9-F38)
      if (data.page2_elongation_md_3) {
        const elongationMD3Data = data.page2_elongation_md_3;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationMD3Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.cell(`F${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Force MD 1 data to column H (H9-H38)
      if (data.page2_force_md_1) {
        const forceMD1Data = data.page2_force_md_1;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceMD1Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.cell(`H${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Force MD 2 data to column I (I9-I38)
      if (data.page2_force_md_2) {
        const forceMD2Data = data.page2_force_md_2;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceMD2Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.cell(`I${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Force MD 3 data to column J (J9-J38)
      if (data.page2_force_md_3) {
        const forceMD3Data = data.page2_force_md_3;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceMD3Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Force 5% MD 1 data to column L (L9-L38)
      if (data.page2_force_5p_md_1) {
        const force5PMD1Data = data.page2_force_5p_md_1;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = force5PMD1Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.cell(`L${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Force 5% MD 2 data to column M (M9-M38)
      if (data.page2_force_5p_md_2) {
        const force5PMD2Data = data.page2_force_5p_md_2;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = force5PMD2Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.cell(`M${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Force 5% MD 3 data to column N (N9-N38)
      if (data.page2_force_5p_md_3) {
        const force5PMD3Data = data.page2_force_5p_md_3;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = force5PMD3Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.cell(`N${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }

        // Add personnel information to Page 2
        page2Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
        page2Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
        page2Worksheet.cell('L42').value(data.verified_by || 'Not Verified');
        page2Worksheet.cell('L43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
        page2Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');
      }
    }

    // PAGE 3 DATA MAPPING - APE-168(18)C (Jeddah) Page 3 data (Elongation & Force CD, Modulus)
    const hasPage3Data = data.page3_elongation_cd_1 || data.page3_force_cd_1 || data.page3_modulus_1;

    if (hasPage3Data) {
      console.log('Page 3 data detected, mapping Elongation and Force CD, Modulus measurements');

      // Create Page3 sheet if it doesn't exist
      let page3Worksheet;
      try {
        page3Worksheet = workbook.sheet('Page3');
      } catch (error) {
        // Page3 sheet doesn't exist, create it
        page3Worksheet = workbook.addSheet('Page3');
        console.log('Created Page3 sheet for 168 Jeddah form');
      }

      // Equipment data for Page 3 (D6)
      if (data.equipment_used && data.equipment_used.page3) {
        page3Worksheet.cell('D6').value(data.equipment_used.page3.common || '');
      }

      // Elongation CD 1 data to column D (D9-D38)
      if (data.page3_elongation_cd_1) {
        const elongationCD1Data = data.page3_elongation_cd_1;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationCD1Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.cell(`D${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Elongation CD 2 data to column E (E9-E38)
      if (data.page3_elongation_cd_2) {
        const elongationCD2Data = data.page3_elongation_cd_2;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationCD2Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.cell(`E${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Elongation CD 3 data to column F (F9-F38)
      if (data.page3_elongation_cd_3) {
        const elongationCD3Data = data.page3_elongation_cd_3;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationCD3Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.cell(`F${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Force CD 1 data to column H (H9-H38)
      if (data.page3_force_cd_1) {
        const forceCD1Data = data.page3_force_cd_1;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceCD1Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.cell(`H${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Force CD 2 data to column I (I9-I38)
      if (data.page3_force_cd_2) {
        const forceCD2Data = data.page3_force_cd_2;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceCD2Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.cell(`I${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Force CD 3 data to column J (J9-J38)
      if (data.page3_force_cd_3) {
        const forceCD3Data = data.page3_force_cd_3;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceCD3Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Modulus 1 data to column L (L9-L38)
      if (data.page3_modulus_1) {
        const modulus1Data = data.page3_modulus_1;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = modulus1Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.cell(`L${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Modulus 2 data to column M (M9-M38)
      if (data.page3_modulus_2) {
        const modulus2Data = data.page3_modulus_2;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = modulus2Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.cell(`M${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Modulus 3 data to column N (N8-N37)
      if (data.page3_modulus_3) {
        const modulus3Data = data.page3_modulus_3;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = modulus3Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.cell(`N${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }

        // Add personnel information to Page 3
        page3Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
        page3Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
        page3Worksheet.cell('L42').value(data.verified_by || 'Not Verified');
        page3Worksheet.cell('L43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
        page3Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');
      }
    }

    // PAGE 4 DATA MAPPING - APE-168(18)C (Jeddah) Page 4 data (Color & Gloss)
    const hasPage4Data = data.page4_color_l || data.page4_color_a || data.page4_color_b ||
                         data.page4_color_delta_e || data.page4_gloss_1 || data.page4_gloss_2 || data.page4_gloss_3;

    if (hasPage4Data) {
      console.log('Page 4 data detected, mapping Color and Gloss measurements');

      // Create Page4 sheet if it doesn't exist
      let page4Worksheet;
      try {
        page4Worksheet = workbook.sheet('Page4');
      } catch (error) {
        // Page4 sheet doesn't exist, create it
        page4Worksheet = workbook.addSheet('Page4');
        console.log('Created Page4 sheet for 168 Jeddah form');
      }

      // Equipment data for Page 4 (D6, L6)
      if (data.equipment_used && data.equipment_used.page4) {
        page4Worksheet.cell('D6').value(data.equipment_used.page4.color_common || '');
        page4Worksheet.cell('L6').value(data.equipment_used.page4.gloss || '');
      }

      // Color L data to column D (D9-D38)
      if (data.page4_color_l) {
        const colorLData = data.page4_color_l;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorLData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.cell(`D${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Color A data to column F (F9-F38)
      if (data.page4_color_a) {
        const colorAData = data.page4_color_a;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorAData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.cell(`F${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Color B data to column H (H9-H38)
      if (data.page4_color_b) {
        const colorBData = data.page4_color_b;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorBData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.cell(`H${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Color Delta E data to column J (J9-J38)
      if (data.page4_color_delta_e) {
        const colorDeltaEData = data.page4_color_delta_e;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorDeltaEData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Gloss 1 data to column L (L9-L38)
      if (data.page4_gloss_1) {
        const gloss1Data = data.page4_gloss_1;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = gloss1Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.cell(`L${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Gloss 2 data to column M (M9-M38)
      if (data.page4_gloss_2) {
        const gloss2Data = data.page4_gloss_2;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = gloss2Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.cell(`M${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Gloss 3 data to column N (N9-N38)
      if (data.page4_gloss_3) {
        const gloss3Data = data.page4_gloss_3;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = gloss3Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.cell(`N${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }

        // Add personnel information to Page 4
        page4Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
        page4Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
        page4Worksheet.cell('L42').value(data.verified_by || 'Not Verified');
        page4Worksheet.cell('L43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
        page4Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');
      }
    }

    // PAGE 5 DATA MAPPING - APE-168(18)C (Jeddah) Page 5 data (PG Quality)
    if (data.page5_pg_quality) {
      console.log('Page 5 data detected, mapping PG Quality measurements');

      // Create Page5 sheet if it doesn't exist
      let page5Worksheet;
      try {
        page5Worksheet = workbook.sheet('Page5');
      } catch (error) {
        // Page5 sheet doesn't exist, create it
        page5Worksheet = workbook.addSheet('Page5');
        console.log('Created Page5 sheet for 168 Jeddah form');
      }

      // PG Quality data to column D (D9-D38)
      const pgQualityData = data.page5_pg_quality;

      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = pgQualityData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push('');
        }
      }

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        page5Worksheet.cell(`D${row}`).value(dataValues[dataIndex] || '');
      }

      // Add personnel information to Page 5
      page5Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page5Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page5Worksheet.cell('L42').value(data.verified_by || 'Not Verified');
      page5Worksheet.cell('L43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page5Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');
    }

    // 4. Generate filename and set response headers
    const productCode = data.product_code || 'APE-168(18)C-Jeddah';
    const batchNo = data.film_insp_form_ref_no || form_id;

    // Clean product code for filename (remove "(Jeddah)" part)
    let cleanedProdCode = productCode;
    if (cleanedProdCode.toLowerCase().includes('jeddah')) {
      cleanedProdCode = cleanedProdCode.replace(/\s*\([^)]*jeddah[^)]*\)/gi, '').trim();
    }

    const filename = `FIF-${cleanedProdCode}-${batchNo}.xlsx`;

    // 5. Set response headers for Excel download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    // 6. Write the workbook to response
    try {
      const buffer = await workbook.outputAsync();
      res.send(buffer);
    } catch (excelError) {
      console.error('Error generating Excel file:', excelError);
      console.error('Error stack:', excelError.stack);
      res.status(500).send(`Error generating Excel file: ${excelError.message}`);
    }

  } catch (error) {
    console.error('Error exporting APE-168(18)C (Jeddah) form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting APE-168(18)C (Jeddah) form: ${error.message}`);
  }
});
// APE-176(18)CP(LCC+WW)BS Film Inspection Form Excel Export Endpoint
app.get('/export-176-18cp-ww-form', async (req, res) => {
  try {
    // Get form_id parameter
    const { form_id } = req.query;

    if (!form_id) {
      return res.status(400).send('form_id parameter is required');
    }

    const { data, error } = await supabase
      .from('176_18cp_ww')
      .select('*')
      .eq('form_id', form_id)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).send('Error fetching data from database');
    }

    if (!data) {
      return res.status(404).send('Form not found');
    }

    // 2. Load the template
    const templatePath = path.join(__dirname, 'templates', '176-18cp-ww.xlsx');

    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      console.error('Template file does not exist at:', templatePath);
      return res.status(500).send('Template file not found');
    }

    let workbook;
    let worksheet;

    // Load the template file
    try {
      workbook = await XlsxPopulate.fromFileAsync(templatePath);
      worksheet = workbook.sheet('Page1');
    } catch (error) {
      console.log('Error loading template:', error.message);
      workbook = await XlsxPopulate.fromBlankAsync();
      const page1Worksheet = workbook.addSheet('Page1');
      worksheet = page1Worksheet;
    }

    // 3. Map data to Excel cells

    // Product Code (B4)
    worksheet.cell('B4').value(data.product_code || '');

    // Specification (B5)
    worksheet.cell('B5').value(data.specification || '');

    // Production Order (G4)
    worksheet.cell('G4').value(data.production_order || '');

    // Purchase Order (G5)
    worksheet.cell('G5').value(data.purchase_order || '');

    // Machine (J4)
    worksheet.cell('J4').value(data.machine_no || '');

    // Quantity (J5) - Add "Rolls" text like prestore form
    worksheet.cell('J5').value(data.quantity ? `${data.quantity} Rolls` : '');

    // Production Date (N4) - format as DD/MM/YYYY
    worksheet.cell('N4').value(data.production_date ? formatDateToDDMMYYYY(data.production_date) : '');

    // Inspection Date (N5) - format as DD/MM/YYYY
    worksheet.cell('N5').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Inspected By (B41)
    worksheet.cell('B41').value(data.prepared_by || 'Unknown User');

    // Inspection Date (B42) - format as DD/MM/YYYY
    worksheet.cell('B42').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Verified By (M41)
    worksheet.cell('M41').value(data.verified_by || 'Not Verified');

    // Verified Date (M42) - format as DD/MM/YYYY
    worksheet.cell('M42').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

    // Film Inspection Form Ref No (O3)
    worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      // Parse JSON data if it's a string, otherwise use as is
      const equipment = typeof data.equipment_used.page1 === 'string'
        ? JSON.parse(data.equipment_used.page1)
        : data.equipment_used.page1;

      // Basic Weight Equipment (D6)
      worksheet.cell('D6').value(equipment.basic_weight || '');

      // Thickness Equipment (F6)
      worksheet.cell('F6').value(equipment.thickness || '');

      // Opacity Equipment (H6)
      worksheet.cell('H6').value(equipment.opacity || '');

      // COF Equipment (J6)
      worksheet.cell('J6').value(equipment.cof || '');

      // Cut Width Equipment (L6)
      worksheet.cell('L6').value(equipment.cut_width || '');

      // Color Equipment (N6)
      worksheet.cell('N6').value(equipment.color_unprinted || '');
    }

    // Map sample data to the correct columns

    // Sample data should go in rows 8-37 (30 rows) - preserve HTML form structure
    // Top rows (8-25): Historical data, Bottom rows (26-37): Fresh data
    // Lot & Roll data to Sample No. column (A8-A37)
    if (data.lot_and_roll) {
      const lotAndRollData = data.lot_and_roll;
      const dataValues = Object.values(lotAndRollData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.cell(`A${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`A${row}`).value(''); // Empty row
        }
      }
    }

    // Roll ID data to column B (B8-B37) - preserve HTML form structure
    if (data.roll_id) {
      const rollIdData = data.roll_id;
      const dataValues = Object.values(rollIdData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.cell(`B${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`B${row}`).value(''); // Empty row
        }
      }
    }

    // Lot Time data to column C (C8-C37) - preserve HTML form structure
    if (data.lot_time) {
      const lotTimeData = data.lot_time;
      const dataValues = Object.values(lotTimeData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.cell(`C${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`C${row}`).value(''); // Empty row
        }
      }
    }

    // Map page1 data to the measurement columns - preserve HTML form structure
    // Basic Weight data to column D (D8-D37)
    if (data.page1_basis_weight) {
      const basicWeightData = data.page1_basis_weight;
      const dataValues = Object.values(basicWeightData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`D${row}`).value('');
        }
      }
    }

    // Thickness data to column F (F8-F37)
    if (data.page1_thickness) {
      const thicknessData = data.page1_thickness;
      const dataValues = Object.values(thicknessData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`F${row}`).value('');
        }
      }
    }

    // Opacity data to column H (H8-H37)
    if (data.page1_opacity) {
      const opacityData = data.page1_opacity;
      const dataValues = Object.values(opacityData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`H${row}`).value('');
        }
      }
    }

    // COF Kinetic data to column J (J8-J37)
    if (data.page1_cof_kinetic) {
      const cofData = data.page1_cof_kinetic;
      const dataValues = Object.values(cofData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`J${row}`).value('');
        }
      }
    }

    // Cut Width data to column L (L8-L37)
    if (data.page1_cut_width) {
      const cutWidthData = data.page1_cut_width;
      const dataValues = Object.values(cutWidthData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.cell(`L${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`L${row}`).value('');
        }
      }
    }

    // Color Unprinted data to column N (N8-N37)
    if (data.page1_color_delta_unprinted) {
      const colorUnprintedData = data.page1_color_delta_unprinted;
      const dataValues = Object.values(colorUnprintedData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.cell(`N${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`N${row}`).value('');
        }
      }
    }

    // Color-Delta E (Printed Film) data to column O (O8-O37)
    if (data.page1_color_delta_printed) {
      const colorPrintedData = data.page1_color_delta_printed;
      const dataValues = Object.values(colorPrintedData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.cell(`O${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`O${row}`).value('');
        }
      }
    }

    // Map Page 2 data if Page2 worksheet exists
    const page2Worksheet = workbook.sheet('Page2');
    if (page2Worksheet) {
      // Copy header info to Page 2
      page2Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page2Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page2Worksheet.cell('M42').value(data.verified_by || 'Not Verified');
      page2Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page2Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

      // Equipment data for Page 2 (D6)
      if (data.equipment_used && data.equipment_used.page2) {
        page2Worksheet.cell('D6').value(data.equipment_used.page2.common || '');
      }

      // Page 2 data mapping - Elongation MD and Force MD data - fill from bottom up
      // Elongation MD 1 data to column D (D9-D38)
      if (data.page2_elongation_md_1) {
        const elongationData = data.page2_elongation_md_1;
        const dataValues = Object.values(elongationData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`D${row}`).value('');
          }
          row--;
        }
      }

      // Elongation MD 2 data to column E (E9-E38)
      if (data.page2_elongation_md_2) {
        const elongationData = data.page2_elongation_md_2;
        const dataValues = Object.values(elongationData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`E${row}`).value('');
          }
          row--;
        }
      }

      // Elongation MD 3 data to column F (F9-F38)
      if (data.page2_elongation_md_3) {
        const elongationData = data.page2_elongation_md_3;
        const dataValues = Object.values(elongationData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`F${row}`).value('');
          }
          row--;
        }
      }

      // Force MD 1 data to column H (H9-H38)
      if (data.page2_force_md_1) {
        const forceData = data.page2_force_md_1;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`H${row}`).value('');
          }
          row--;
        }
      }

      // Force MD 2 data to column I (I9-I38)
      if (data.page2_force_md_2) {
        const forceData = data.page2_force_md_2;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`I${row}`).value('');
          }
          row--;
        }
      }

      // Force MD 3 data to column J (J9-J38)
      if (data.page2_force_md_3) {
        const forceData = data.page2_force_md_3;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`J${row}`).value('');
          }
          row--;
        }
      }

      // Force 5% MD 1 data to column L (L9-L38)
      if (data.page2_force_5p_md_1) {
        const forceData = data.page2_force_5p_md_1;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`L${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`L${row}`).value('');
          }
          row--;
        }
      }

      // Force 5% MD 2 data to column M (M9-M38)
      if (data.page2_force_5p_md_2) {
        const forceData = data.page2_force_5p_md_2;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`M${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`M${row}`).value('');
          }
          row--;
        }
      }

      // Force 5% MD 3 data to column N (N9-N38)
      if (data.page2_force_5p_md_3) {
        const forceData = data.page2_force_5p_md_3;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.cell(`N${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`N${row}`).value('');
          }
          row--;
        }
      }
    }

    // Map Page 3 data if Page3 worksheet exists
    const page3Worksheet = workbook.sheet('Page3');
    if (page3Worksheet) {
      // Copy header info to Page 3
      page3Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page3Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page3Worksheet.cell('M42').value(data.verified_by || 'Not Verified');
      page3Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page3Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

      // Equipment data for Page 3 (D6)
      if (data.equipment_used && data.equipment_used.page3) {
        page3Worksheet.cell('D6').value(data.equipment_used.page3.common || '');
      }

      // Page 3 data mapping - Elongation CD and Force CD data - fill from bottom up
      // Elongation CD 1 data to column D (D9-D38)
      if (data.page3_elongation_cd_1) {
        const elongationData = data.page3_elongation_cd_1;
        const dataValues = Object.values(elongationData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`D${row}`).value('');
          }
          row--;
        }
      }

      // Elongation CD 2 data to column E (E9-E38)
      if (data.page3_elongation_cd_2) {
        const elongationData = data.page3_elongation_cd_2;
        const dataValues = Object.values(elongationData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`E${row}`).value('');
          }
          row--;
        }
      }

      // Elongation CD 3 data to column F (F9-F38)
      if (data.page3_elongation_cd_3) {
        const elongationData = data.page3_elongation_cd_3;
        const dataValues = Object.values(elongationData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`F${row}`).value('');
          }
          row--;
        }
      }

      // Force CD 1 data to column H (H9-H38)
      if (data.page3_force_cd_1) {
        const forceData = data.page3_force_cd_1;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`H${row}`).value('');
          }
          row--;
        }
      }

      // Force CD 2 data to column I (I9-I38)
      if (data.page3_force_cd_2) {
        const forceData = data.page3_force_cd_2;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`I${row}`).value('');
          }
          row--;
        }
      }

      // Force CD 3 data to column J (J9-J38)
      if (data.page3_force_cd_3) {
        const forceData = data.page3_force_cd_3;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`J${row}`).value('');
          }
          row--;
        }
      }

      // Modulus 1 data to column L (L9-L38)
      if (data.page3_modulus_1) {
        const modulusData = data.page3_modulus_1;
        const dataValues = Object.values(modulusData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.cell(`L${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`L${row}`).value('');
          }
          row--;
        }
      }

      // Modulus 2 data to column M (M9-M38)
      if (data.page3_modulus_2) {
        const modulusData = data.page3_modulus_2;
        const dataValues = Object.values(modulusData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.cell(`M${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`M${row}`).value('');
          }
          row--;
        }
      }

      // Modulus 3 data to column N (N9-N38)
      if (data.page3_modulus_3) {
        const modulusData = data.page3_modulus_3;
        const dataValues = Object.values(modulusData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.cell(`N${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`N${row}`).value('');
          }
          row--;
        }
      }
    }

    // Map Page 4 data if Page4 worksheet exists
    const page4Worksheet = workbook.sheet('Page4');
    if (page4Worksheet) {
      // Copy header info to Page 4
      page4Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page4Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page4Worksheet.cell('M42').value(data.verified_by || 'Not Verified');
      page4Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page4Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

      // Equipment data for Page 4 (D6)
      if (data.equipment_used && data.equipment_used.page4) {
        page4Worksheet.cell('D6').value(data.equipment_used.page4.gloss || '');
      }

      // Page 4 data mapping - Gloss data only - fill from bottom up
      // Gloss 1 data to column D (D9-D38)
      if (data.page4_gloss_1) {
        const glossData = data.page4_gloss_1;
        const dataValues = Object.values(glossData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page4Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page4Worksheet.cell(`D${row}`).value('');
          }
          row--;
        }
      }

      // Gloss 2 data to column E (E9-E38)
      if (data.page4_gloss_2) {
        const glossData = data.page4_gloss_2;
        const dataValues = Object.values(glossData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page4Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page4Worksheet.cell(`E${row}`).value('');
          }
          row--;
        }
      }

      // Gloss 3 data to column F (F9-F38)
      if (data.page4_gloss_3) {
        const glossData = data.page4_gloss_3;
        const dataValues = Object.values(glossData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page4Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page4Worksheet.cell(`F${row}`).value('');
          }
          row--;
        }
      }
    }

    // 4. Generate filename with standardized format: FIF-{product_code}-{batch_no}
    const productCode = data.product_code || 'UNKNOWN';
    const batchNo = data.batch || form_id;
    const filename = `FIF-${productCode}-${batchNo}.xlsx`;

    // 5. Set response headers for Excel download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    // 6. Write the workbook to response
    const buffer = await workbook.outputAsync();
    res.send(buffer);

  } catch (error) {
    console.error('Error exporting APE-176(18)CP(LCC+WW)BS form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting APE-176(18)CP(LCC+WW)BS form: ${error.message}`);
  }
});
// Export 234-18-micro-white form endpoint
app.get('/export-234-18-micro-white-form', async (req, res) => {
  try {
    // Get form_id parameter
    const { form_id } = req.query;

    if (!form_id) {
      return res.status(400).send('form_id parameter is required');
    }

    const { data, error } = await supabase
      .from('234_18_micro_white')
      .select('*')
      .eq('form_id', form_id)
      .single();

    if (error) {
      // Handle case where form doesn't exist in this table
      console.log('Supabase error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });

      if (error.code === 'PGRST116' || error.message?.includes('No rows found') || error.message?.includes('JSON object requested, multiple (or no) rows returned')) {
        console.log(`Form ${form_id} not found in 234_18_micro_white table`);
        return res.status(404).send('Form not found in 234 micro white table');
      }
      console.error('Supabase error:', error);
      return res.status(500).send('Error fetching data from database');
    }

    if (!data) {
      return res.status(404).send('Form not found');
    }

    console.log('=== WHITE-234(18) Export Starting ===');
    console.log('Form ID:', form_id);
    console.log('Product Code:', data.product_code);
    console.log('Data fields available:', Object.keys(data).length);
    console.log('Full data object:', JSON.stringify(data, null, 2));

    // 2. Load the template
    const templatePath = path.join(__dirname, 'templates', '234-18-micro-white.xlsx');

    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      console.error('Template file does not exist at:', templatePath);
      return res.status(500).send('Template file not found');
    }

    let workbook;
    let worksheet;
    let page2Worksheet;

    // Load the template file
    try {
      workbook = await XlsxPopulate.fromFileAsync(templatePath);
      worksheet = workbook.sheet('Page1');

      // Create or get Page2 sheet for Page 2 data
      try {
        page2Worksheet = workbook.sheet('Page2');
      } catch (error) {
        // Page2 sheet doesn't exist, create it by copying Page1 structure
        page2Worksheet = workbook.addSheet('Page2');
        console.log('Created Page2 sheet for 234 form');
      }
    } catch (error) {
      console.log('Error loading template:', error.message);
      workbook = await XlsxPopulate.fromBlankAsync();
      const page1Worksheet = workbook.addSheet('Page1');
      worksheet = page1Worksheet;
      page2Worksheet = workbook.addSheet('Page2');
      console.log('Created both Page1 and Page2 sheets');
    }

    // 3. Map data to Excel cells

    // Product Code (C4)
    worksheet.cell('C4').value(data.product_code || '');

    // Specification (C5)
    worksheet.cell('C5').value(data.specification || '');

    // Production Order (F4)
    worksheet.cell('F4').value(data.production_order || '');

    // Purchase Order (F5)
    worksheet.cell('F5').value(data.purchase_order || '');

    // Machine (H4)
    worksheet.cell('H4').value(data.machine_no || '');

    // Quantity (H5) - Add "Rolls" text like prestore form
    worksheet.cell('H5').value(data.quantity ? `${data.quantity} Rolls` : '');

    // Production Date (L4) - format as DD/MM/YYYY
    worksheet.cell('L4').value(data.production_date ? formatDateToDDMMYYYY(data.production_date) : '');

    // Inspection Date (L5) - format as DD/MM/YYYY
    worksheet.cell('L5').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Inspected By (B42)
    worksheet.cell('B42').value(data.prepared_by || 'Unknown User');

    // Inspection Date (B43) - format as DD/MM/YYYY (duplicate for verification)
    worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Verified By (I42)
    worksheet.cell('I42').value(data.verified_by || 'Not Verified');

    // Verified Date (I43) - format as DD/MM/YYYY
    worksheet.cell('I43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

    // Film Inspection Form Ref No (L3)
    worksheet.cell('L3').value(data.film_insp_form_ref_no || '');

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;

      // Basic Weight Equipment (D6)
      worksheet.cell('D6').value(equipment.basic_weight || '');

      // COF Equipment (E6) - Template shows COF in column E
      worksheet.cell('E6').value(equipment.cof_rr || equipment.cof_rs || '');

      // Opacity Equipment (G6) - Template shows Opacity in column G
      worksheet.cell('G6').value(equipment.opacity || '');

      // Modulus Equipment (H6) - Template shows Modulus in column H
      worksheet.cell('H6').value(equipment.modulus || '');

      // Gloss Equipment (L6) - Template shows Gloss in column L
      worksheet.cell('L6').value(equipment.gloss || '');
    }

    // Map sample data to the correct columns - WHITE-234(18) has only Page 1 and Page 2

    // Sample data should go in rows 9-38 (30 rows) - Updated to match template
    // Top rows (9-27): Historical data, Bottom rows (28-38): Fresh data
    // Lot & Roll data to Sample No. column (A9-A38)
    if (data.lot_and_roll) {
      const lotAndRollData = data.lot_and_roll;
      const dataValues = Object.values(lotAndRollData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.cell(`A${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`A${row}`).value(''); // Empty row
        }
      }
    }

    // Roll ID data to column B (B9-B38) - Updated to match template
    if (data.roll_id) {
      const rollIdData = data.roll_id;
      const dataValues = Object.values(rollIdData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.cell(`B${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`B${row}`).value(''); // Empty row
        }
      }
    }

    // Lot Time data to column C (C9-C38) - Updated to match template
    if (data.lot_time) {
      const lotTimeData = data.lot_time;
      const dataValues = Object.values(lotTimeData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.cell(`C${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`C${row}`).value(''); // Empty row
        }
      }
    }

    // PAGE 1 DATA MAPPING - WHITE-234(18) has different field structure
    // Basic Weight data to column D (D9-D38)
    if (data.page1_basis_weight) {
      const basicWeightData = data.page1_basis_weight;
      console.log('Basic Weight Data:', basicWeightData);

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = basicWeightData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column D (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.cell(`D${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
      }
    }


    // Opacity data to column G (G9-G38) - Template shows Opacity %
    if (data.page1_opacity) {
      const opacityData = data.page1_opacity;
      console.log('Opacity Data:', opacityData);

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = opacityData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column G (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.cell(`G${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
      }
    }

    // Modulus MD data - Separate columns for each modulus measurement
    // Modulus 1 data to column H (H9-H38)
    if (data.page1_modulus_1) {
      const modulus1Data = data.page1_modulus_1;
      console.log('Modulus 1 Data:', modulus1Data);

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = modulus1Data[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column H (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.cell(`H${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
      }
      console.log('Modulus 1 data mapped to column H');
    }

    // Modulus 2 data to column I (I9-I38)
    if (data.page1_modulus_2) {
      const modulus2Data = data.page1_modulus_2;
      console.log('Modulus 2 Data:', modulus2Data);

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = modulus2Data[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column I (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.cell(`I${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
      }
      console.log('Modulus 2 data mapped to column I');
    }

    // Modulus 3 data to column J (J9-J38)
    if (data.page1_modulus_3) {
      const modulus3Data = data.page1_modulus_3;
      console.log('Modulus 3 Data:', modulus3Data);

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = modulus3Data[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column J (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
      }
      console.log('Modulus 3 data mapped to column J');
    }

    // Gloss Level data to column L (L9-L38) - Template shows Gloss Level in column L
    if (data.page1_gloss) {
      const glossData = data.page1_gloss;
      console.log('Gloss Data:', glossData);

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = glossData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column L (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.cell(`L${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
      }
      console.log('Gloss data mapped to column L');
    }

    // COF RR data to column E (E9-E38) - COF-Kinetic(R-R)
    if (data.page1_cof_kinetic_r_r) {
      const cofRRData = data.page1_cof_kinetic_r_r;
      console.log('COF RR Data:', cofRRData);

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = cofRRData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column E (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.cell(`E${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
      }
      console.log('COF RR data mapped to column E');
    }

    // COF RS data to column F (F9-F38) - COF-Kinetic(R-S)
    if (data.page1_cof_kinetic_r_s) {
      const cofRSData = data.page1_cof_kinetic_r_s;
      console.log('COF RS Data:', cofRSData);

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = cofRSData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column F (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.cell(`F${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
      }
      console.log('COF RS data mapped to column F');
    }

    // PAGE 2 DATA MAPPING - WHITE-234(18) Page 2 data (Force & Color measurements)
    // Based on template structure, this appears to be Page 2 with Force and Color data
    const hasPage2Data = data.page2_force_elongation_md_5p || data.page2_force_tensile_md ||
                        data.page2_force_elongation_cd_5p || data.page2_force_tensile_cd ||
                        data.page2_color_l || data.page2_color_a || data.page2_color_b || data.page2_color_delta_e;

    if (hasPage2Data) {
      console.log('Page 2 data detected, mapping Force and Color measurements');

      // Create Page2 sheet if it doesn't exist
      try {
        page2Worksheet = workbook.sheet('Page2');
      } catch (error) {
        // Page2 sheet doesn't exist, create it
        page2Worksheet = workbook.addSheet('Page2');
        console.log('Created Page2 sheet for 234 form');
      }

      // Force Elongation MD 5% data to column D (D9-D38)
      if (data.page2_force_elongation_md_5p) {
        const forceElongationMD5PData = data.page2_force_elongation_md_5p;
        console.log('Page 2 Force Elongation MD 5% Data:', forceElongationMD5PData);

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceElongationMD5PData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column D (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.cell(`D${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Force Tensile MD data to column E (E8-E37)
      if (data.page2_force_tensile_md) {
        const forceTensileMDData = data.page2_force_tensile_md;
        console.log('Page 2 Force Tensile MD Data:', forceTensileMDData);

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceTensileMDData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column E (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.cell(`E${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Force Elongation CD 5% data to column F (F8-F37)
      if (data.page2_force_elongation_cd_5p) {
        const forceElongationCD5PData = data.page2_force_elongation_cd_5p;
        console.log('Page 2 Force Elongation CD 5% Data:', forceElongationCD5PData);

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceElongationCD5PData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column F (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.cell(`F${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Force Tensile CD data to column G (G8-G37)
      if (data.page2_force_tensile_cd) {
        const forceTensileCDData = data.page2_force_tensile_cd;
        console.log('Page 2 Force Tensile CD Data:', forceTensileCDData);

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceTensileCDData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column G (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.cell(`G${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Color L data to column H (H8-H37)
      if (data.page2_color_l) {
        const colorLData = data.page2_color_l;
        console.log('Page 2 Color L Data:', colorLData);

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorLData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column H (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.cell(`H${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Color A data to column I (I8-I37)
      if (data.page2_color_a) {
        const colorAData = data.page2_color_a;
        console.log('Page 2 Color A Data:', colorAData);

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorAData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column I (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.cell(`I${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Color B data to column J (J8-J37)
      if (data.page2_color_b) {
        const colorBData = data.page2_color_b;
        console.log('Page 2 Color B Data:', colorBData);

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorBData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column J (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Color Delta E data to column K (K8-K37)
      if (data.page2_color_delta_e) {
        const colorDeltaEData = data.page2_color_delta_e;
        console.log('Page 2 Color Delta E Data:', colorDeltaEData);

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorDeltaEData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column K (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.cell(`K${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Map Page 2 headers
      console.log('Mapping Page 2 headers');

    } else {
      console.log('No Page 2 data detected');
    }


    // PAGE 2 DATA MAPPING - WHITE-234(18) corrected mappings
    // Force-elongation-MD@5% data to column D (D8-D37) - WHITE-234(18) Page 2
    if (data.page2_force_elongation_md_5p) {
      const forceElongationMDData = data.page2_force_elongation_md_5p;
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        if (forceElongationMDData[key] && forceElongationMDData[key] !== '') {
          dataValues.push(forceElongationMDData[key]);
        } else {
          dataValues.push('');
        }
      }

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length && dataValues[dataIndex] !== '') {
          const numValue = parseFloat(dataValues[dataIndex]);
          page2Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page2Worksheet.cell(`D${row}`).value('');
        }
      }
    }

    // Force-Tensile Strength-MD-peak data to column E (E8-E37) - WHITE-234(18) Page 2
    if (data.page2_force_tensile_md) {
      const forceTensileMDData = data.page2_force_tensile_md;
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        if (forceTensileMDData[key] && forceTensileMDData[key] !== '') {
          dataValues.push(forceTensileMDData[key]);
        } else {
          dataValues.push('');
        }
      }

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length && dataValues[dataIndex] !== '') {
          const numValue = parseFloat(dataValues[dataIndex]);
          page2Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page2Worksheet.cell(`E${row}`).value('');
        }
      }
    }

    // Force-elongation-CD@5% data to column F (F8-F37) - WHITE-234(18) Page 2
    if (data.page2_force_elongation_cd_5p) {
      const forceElongationCDData = data.page2_force_elongation_cd_5p;
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        if (forceElongationCDData[key] && forceElongationCDData[key] !== '') {
          dataValues.push(forceElongationCDData[key]);
        } else {
          dataValues.push('');
        }
      }

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length && dataValues[dataIndex] !== '') {
          const numValue = parseFloat(dataValues[dataIndex]);
          page2Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page2Worksheet.cell(`F${row}`).value('');
        }
      }
    }

    // Force-Tensile Strength-CD-peak data to column G (G8-G37) - WHITE-234(18) Page 2
    if (data.page2_force_tensile_cd) {
      const forceTensileCDData = data.page2_force_tensile_cd;
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        if (forceTensileCDData[key] && forceTensileCDData[key] !== '') {
          dataValues.push(forceTensileCDData[key]);
        } else {
          dataValues.push('');
        }
      }

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length && dataValues[dataIndex] !== '') {
          const numValue = parseFloat(dataValues[dataIndex]);
          page2Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page2Worksheet.cell(`G${row}`).value('');
        }
      }
    }

    // Color L data to column H (H8-H37)
    if (data.page2_color_l) {
      const colorLData = data.page2_color_l;
      console.log('Page 2 Color L Data:', colorLData);

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = colorLData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column H (rows 8-37) on Page2 sheet
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        page2Worksheet.cell(`H${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
      }
    }

    // Color A data to column I (I8-I37)
    if (data.page2_color_a) {
      const colorAData = data.page2_color_a;
      console.log('Page 2 Color A Data:', colorAData);

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = colorAData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column I (rows 8-37) on Page2 sheet
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        page2Worksheet.cell(`I${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
      }
    }

    // Color B data to column J (J8-J37)
    if (data.page2_color_b) {
      const colorBData = data.page2_color_b;
      console.log('Page 2 Color B Data:', colorBData);

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = colorBData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column J (rows 8-37) on Page2 sheet
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        page2Worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
      }
    }

    // Color Delta E data to column K (K8-K37)
    if (data.page2_color_delta_e) {
      const colorDeltaEData = data.page2_color_delta_e;
      console.log('Page 2 Color Delta E Data:', colorDeltaEData);

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = colorDeltaEData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column K (rows 8-37) on Page2 sheet
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        page2Worksheet.cell(`K${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
      }
    } else {
      console.log('No Page 2 data detected');
    }
    // Map Page 2 headers if Page2 sheet exists
    if (page2Worksheet) {
      console.log('Mapping Page 2 headers');

      // Inspected By (B41)
      page2Worksheet.cell('B41').value(data.prepared_by || 'Unknown User');

      // Inspection Date (B42) - format as DD/MM/YYYY
      page2Worksheet.cell('B42').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

      // Verified By (I41)
      page2Worksheet.cell('I41').value(data.verified_by || 'Not Verified');

      // Verified Date (I42) - format as DD/MM/YYYY
      page2Worksheet.cell('I42').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

      // Film Inspection Form Ref No (K3)
      page2Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');

      console.log('Page 2 headers mapped successfully');
    }

    // Map Page 2 equipment data if Page2 sheet exists
    if (page2Worksheet && data.equipment_used && data.equipment_used.page2) {
      console.log('Mapping Page 2 equipment data');

      const page2Equipment = data.equipment_used.page2;

      // UTM Machine (D6) - For force measurements
      page2Worksheet.cell('D6').value(page2Equipment.force || '');

      // Spectro Photometer (H6) - For color measurements
      page2Worksheet.cell('H6').value(page2Equipment.colour || '');

      console.log('Page 2 equipment data mapped successfully');
    }

    // 5. Set filename and headers
    // Create filename with format: FIF-ProductCode-BatchNo.xlsx
    const productCode = data.product_code || '234-18-MICRO-WHITE';
    const batchNo = data.batch || data.production_order || form_id;
    const filename = `FIF-${productCode}-${batchNo}.xlsx`;

    console.log('=== WHITE-234(18) Export Completed ===');
    console.log('Filename:', filename);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    // 6. Write the workbook to response
    console.log('About to write workbook to buffer...');
    const buffer = await workbook.outputAsync();
    console.log('Workbook buffer created, size:', buffer.length);
    res.send(buffer);
    console.log('Response sent successfully');

  } catch (error) {
    console.error('Error exporting WHITE-234(18) form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting WHITE-234(18) form: ${error.message}`);
  }
});

// Export 214-18-micro-white form endpoint
app.get('/export-214-18-micro-white-form', async (req, res) => {
  try {
    // Get form_id parameter
    const { form_id } = req.query;

    if (!form_id) {
      return res.status(400).send('form_id parameter is required');
    }

    const { data, error } = await supabase
      .from('214_18_micro_white')
      .select('*')
      .eq('form_id', form_id)
      .single();

    if (error) {
      // Handle case where form doesn't exist in this table
      console.log('Supabase error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });

      if (error.code === 'PGRST116' || error.message?.includes('No rows found') || error.message?.includes('JSON object requested, multiple (or no) rows returned')) {
        console.log(`Form ${form_id} not found in 214_18_micro_white table`);
        return res.status(404).send('Form not found in 214 micro white table');
      }
      console.error('Supabase error:', error);
      return res.status(500).send('Error fetching data from database');
    }

    if (!data) {
      return res.status(404).send('Form not found');
    }

    console.log('=== WHITE-214(18) Export Starting ===');
    console.log('Form ID:', form_id);
    console.log('Product Code:', data.product_code);
    console.log('Data fields available:', Object.keys(data).length);
    console.log('Full data object:', JSON.stringify(data, null, 2));

    // 2. Load the template
    const templatePath = path.join(__dirname, 'templates', '214-18-micro-white.xlsx');

    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      console.error('Template file does not exist at:', templatePath);
      return res.status(500).send('Template file not found');
    }

    let workbook;
    let worksheet;
    let page2Worksheet;

    // Load the template file
    try {
      workbook = await XlsxPopulate.fromFileAsync(templatePath);
      worksheet = workbook.sheet('Page1');

      // Create or get Page2 sheet for Page 2 data
      try {
        page2Worksheet = workbook.sheet('Page2');
      } catch (error) {
        // Page2 sheet doesn't exist, create it by copying Page1 structure
        page2Worksheet = workbook.addSheet('Page2');
        console.log('Created Page2 sheet for 214 form');
      }
    } catch (error) {
      console.log('Error loading template:', error.message);
      workbook = await XlsxPopulate.fromBlankAsync();
      const page1Worksheet = workbook.addSheet('Page1');
      worksheet = page1Worksheet;
      page2Worksheet = workbook.addSheet('Page2');
      console.log('Created both Page1 and Page2 sheets');
    }

    // 3. Map data to Excel cells

    // Product Code (C4)
    worksheet.cell('C4').value(data.product_code || '');

    // Specification (C5)
    worksheet.cell('C5').value(data.specification || '');

    // Production Order (F4)
    worksheet.cell('F4').value(data.production_order || '');

    // Purchase Order (F5)
    worksheet.cell('F5').value(data.purchase_order || '');

    // Machine (H4)
    worksheet.cell('H4').value(data.machine_no || '');

    // Quantity (H5) - Add "Rolls" text like prestore form
    worksheet.cell('H5').value(data.quantity ? `${data.quantity} Rolls` : '');

    // Production Date (L4) - format as DD/MM/YYYY
    worksheet.cell('L4').value(data.production_date ? formatDateToDDMMYYYY(data.production_date) : '');

    // Inspection Date (L5) - format as DD/MM/YYYY
    worksheet.cell('L5').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Inspected By (B42)
    worksheet.cell('B42').value(data.prepared_by || 'Unknown User');

    // Inspection Date (B43) - format as DD/MM/YYYY (duplicate for verification)
    worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Verified By (I42)
    worksheet.cell('I42').value(data.verified_by || 'Not Verified');

    // Verified Date (I43) - format as DD/MM/YYYY
    worksheet.cell('I43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

    // Film Inspection Form Ref No (L3)
    worksheet.cell('L3').value(data.film_insp_form_ref_no || '');

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;

      // Basic Weight Equipment (D6)
      worksheet.cell('D6').value(equipment.basic_weight || '');

      // COF Equipment (E6) - Template shows COF in column E
      worksheet.cell('E6').value(equipment.cof_rr || equipment.cof_rs || '');

      // Opacity Equipment (G6) - Template shows Opacity in column G
      worksheet.cell('G6').value(equipment.opacity || '');

      // Modulus Equipment (H6) - Template shows Modulus in column H
      worksheet.cell('H6').value(equipment.modulus || '');

      // Gloss Equipment (L6) - Template shows Gloss in column L
      worksheet.cell('L6').value(equipment.gloss || '');
    }

    // Map sample data to the correct columns - WHITE-214(18) has only Page 1 and Page 2

    // Sample data should go in rows 9-38 (30 rows) - Updated to match template
    // Top rows (9-27): Historical data, Bottom rows (28-38): Fresh data
    // Lot & Roll data to Sample No. column (A9-A38)
    if (data.lot_and_roll) {
      const lotAndRollData = data.lot_and_roll;
      const dataValues = Object.values(lotAndRollData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.cell(`A${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`A${row}`).value(''); // Empty row
        }
      }
    }

    // Roll ID data to column B (B9-B38) - Updated to match template
    if (data.roll_id) {
      const rollIdData = data.roll_id;
      const dataValues = Object.values(rollIdData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.cell(`B${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`B${row}`).value(''); // Empty row
        }
      }
    }

    // Lot Time data to column C (C9-C38) - Updated to match template
    if (data.lot_time) {
      const lotTimeData = data.lot_time;
      const dataValues = Object.values(lotTimeData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.cell(`C${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`C${row}`).value(''); // Empty row
        }
      }
    }

    // PAGE 1 DATA MAPPING - WHITE-214(18) - Updated to match template structure
    // Basic Weight data to column D (D9-D38)
    if (data.page1_basis_weight) {
      const basicWeightData = data.page1_basis_weight;
      console.log('Basic Weight Data:', basicWeightData);

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = basicWeightData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column D (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.cell(`D${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
      }
    }


    // Opacity data to column G (G9-G38) - Template shows Opacity %
    if (data.page1_opacity) {
      const opacityData = data.page1_opacity;
      console.log('Opacity Data:', opacityData);

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = opacityData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column G (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.cell(`G${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
      }
    }

    // Modulus MD data - Separate columns for each modulus measurement
    // Modulus 1 data to column H (H9-H38)
    if (data.page1_modulus_1) {
      const modulus1Data = data.page1_modulus_1;
      console.log('Modulus 1 Data:', modulus1Data);

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = modulus1Data[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column H (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.cell(`H${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
      }
      console.log('Modulus 1 data mapped to column H');
    }

    // Modulus 2 data to column I (I9-I38)
    if (data.page1_modulus_2) {
      const modulus2Data = data.page1_modulus_2;
      console.log('Modulus 2 Data:', modulus2Data);

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = modulus2Data[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column I (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.cell(`I${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
      }
      console.log('Modulus 2 data mapped to column I');
    }

    // Modulus 3 data to column J (J9-J38)
    if (data.page1_modulus_3) {
      const modulus3Data = data.page1_modulus_3;
      console.log('Modulus 3 Data:', modulus3Data);

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = modulus3Data[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column J (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
      }
      console.log('Modulus 3 data mapped to column J');
    }

    // Gloss Level data to column L (L9-L38) - Template shows Gloss Level in column L
    if (data.page1_gloss) {
      const glossData = data.page1_gloss;
      console.log('Gloss Data:', glossData);

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = glossData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column L (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.cell(`L${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
      }
      console.log('Gloss data mapped to column L');
    }

    // PAGE 2 DATA MAPPING - WHITE-214(18) Page 2 data (Force & Color measurements)
    // Based on your screenshot, this appears to be Page 2 with Force and Color data
    const hasPage2Data = data.page2_force_elongation_md_5p || data.page2_force_tensile_md ||
                        data.page2_force_elongation_cd_5p || data.page2_force_tensile_cd ||
                        data.page2_color_l || data.page2_color_a || data.page2_color_b || data.page2_color_delta_e;

    if (hasPage2Data) {
      console.log('Page 2 data detected, mapping Force and Color measurements');

      // Force Elongation MD 5% data to column D (D8-D37)
      if (data.page2_force_elongation_md_5p) {
        const forceElongationMD5PData = data.page2_force_elongation_md_5p;
        console.log('Page 2 Force Elongation MD 5% Data:', forceElongationMD5PData);

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceElongationMD5PData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column D (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.cell(`D${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Force Tensile MD data to column E (E8-E37)
      if (data.page2_force_tensile_md) {
        const forceTensileMDData = data.page2_force_tensile_md;
        console.log('Page 2 Force Tensile MD Data:', forceTensileMDData);

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceTensileMDData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column E (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.cell(`E${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Force Elongation CD 5% data to column F (F8-F37)
      if (data.page2_force_elongation_cd_5p) {
        const forceElongationCD5PData = data.page2_force_elongation_cd_5p;
        console.log('Page 2 Force Elongation CD 5% Data:', forceElongationCD5PData);

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceElongationCD5PData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column F (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.cell(`F${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Force Tensile CD data to column G (G8-G37)
      if (data.page2_force_tensile_cd) {
        const forceTensileCDData = data.page2_force_tensile_cd;
        console.log('Page 2 Force Tensile CD Data:', forceTensileCDData);

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceTensileCDData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column G (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.cell(`G${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Color L data to column H (H8-H37)
      if (data.page2_color_l) {
        const colorLData = data.page2_color_l;
        console.log('Page 2 Color L Data:', colorLData);

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorLData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column H (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.cell(`H${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Color A data to column I (I8-I37)
      if (data.page2_color_a) {
        const colorAData = data.page2_color_a;
        console.log('Page 2 Color A Data:', colorAData);

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorAData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column I (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.cell(`I${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Color B data to column J (J8-J37)
      if (data.page2_color_b) {
        const colorBData = data.page2_color_b;
        console.log('Page 2 Color B Data:', colorBData);

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorBData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column J (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Color Delta E data to column K (K8-K37)
      if (data.page2_color_delta_e) {
        const colorDeltaEData = data.page2_color_delta_e;
        console.log('Page 2 Color Delta E Data:', colorDeltaEData);

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorDeltaEData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column K (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.cell(`K${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }
    } else {
      console.log('No Page 2 data detected');
    }

    // Map Page 2 headers if Page2 sheet exists
    if (page2Worksheet) {
      console.log('Mapping Page 2 headers');

      // Inspected By (B41)
      page2Worksheet.cell('B41').value(data.prepared_by || 'Unknown User');

      // Inspection Date (B42) - format as DD/MM/YYYY
      page2Worksheet.cell('B42').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

      // Verified By (I41)
      page2Worksheet.cell('I41').value(data.verified_by || 'Not Verified');

      // Verified Date (I42) - format as DD/MM/YYYY
      page2Worksheet.cell('I42').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

      // Film Inspection Form Ref No (K3)
      page2Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');

      console.log('Page 2 headers mapped successfully');
    }

    // Map Page 2 equipment data if Page2 sheet exists
    if (page2Worksheet && data.equipment_used && data.equipment_used.page2) {
      console.log('Mapping Page 2 equipment data');

      const page2Equipment = data.equipment_used.page2;

      // UTM Machine (D6) - For force measurements
      page2Worksheet.cell('D6').value(page2Equipment.force || '');

      // Spectro Photometer (H6) - For color measurements
      page2Worksheet.cell('H6').value(page2Equipment.colour || '');

      console.log('Page 2 equipment data mapped successfully');
    }

    // 5. Set filename and headers
    // Create filename with format: FIF-ProductCode-BatchNo.xlsx
    const productCode = data.product_code || '214-18-MICRO-WHITE';
    const batchNo = data.batch || data.production_order || form_id;
    const filename = `FIF-${productCode}-${batchNo}.xlsx`;

    console.log('=== WHITE-214(18) Export Completed ===');
    console.log('Filename:', filename);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    // 6. Write the workbook to response
    console.log('About to write workbook to buffer...');
    const buffer = await workbook.outputAsync();
    console.log('Workbook buffer created, size:', buffer.length);
    res.send(buffer);
    console.log('Response sent successfully');

  } catch (error) {
    console.error('Error exporting WHITE-214(18) form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting WHITE-214(18) form: ${error.message}`);
  }
});
// APE-102(18)C White Film Inspection Form Excel Export Endpoint
app.get('/export-102-18c-white-form', async (req, res) => {
  try {
    // Get form_id parameter
    const { form_id } = req.query;

    if (!form_id) {
      return res.status(400).send('form_id parameter is required');
    }

    const { data, error } = await supabase
      .from('102_18c_micro_white')
      .select('*')
      .eq('form_id', form_id)
      .single();

    if (error) {
      // Handle case where form doesn't exist in this table
      console.log('Supabase error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });

      if (error.code === 'PGRST116' || error.message?.includes('No rows found') || error.message?.includes('JSON object requested, multiple (or no) rows returned')) {
        console.log(`Form ${form_id} not found in 102_18c_micro_white table`);
        return res.status(404).send('Form not found in 102 micro white table');
      }
      console.error('Supabase error:', error);
      return res.status(500).send('Error fetching data from database');
    }

    if (!data) {
      return res.status(404).send('Form not found');
    }

    // 2. Load the template
    const templatePath = path.join(__dirname, 'templates', '102-18c-white.xlsx');

    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      console.error('Template file does not exist at:', templatePath);
      return res.status(500).send('Template file not found');
    }

    let workbook;
    let page1Worksheet;
    let page2Worksheet;
    let page3Worksheet;
    let page4Worksheet;

    // Load the template file
    try {
      workbook = await XlsxPopulate.fromFileAsync(templatePath);
      page1Worksheet = workbook.sheet('Page1');

      // Create or get Page2 sheet for Page 2 data
      try {
        page2Worksheet = workbook.sheet('Page2');
      } catch (error) {
        // Page2 sheet doesn't exist, create it by copying Page1 structure
        page2Worksheet = workbook.addSheet('Page2');
      }

      // Create or get Page3 sheet for Page 3 data
      try {
        page3Worksheet = workbook.sheet('Page3');
      } catch (error) {
        // Page3 sheet doesn't exist, create it
        page3Worksheet = workbook.addSheet('Page3');
      }

      // Create or get Page4 sheet for Page 4 data
      try {
        page4Worksheet = workbook.sheet('Page4');
      } catch (error) {
        // Page4 sheet doesn't exist, create it
        page4Worksheet = workbook.addSheet('Page4');
      }
    } catch (error) {
      console.log('Error loading template:', error.message);
      workbook = await XlsxPopulate.fromBlankAsync();
      page1Worksheet = workbook.addSheet('Page1');
      page2Worksheet = workbook.addSheet('Page2');
      page3Worksheet = workbook.addSheet('Page3');
      page4Worksheet = workbook.addSheet('Page4');
    }

    // 3. Map data to Excel cells for Page 1
    if (page1Worksheet) {
      // Product Code (B4)
      page1Worksheet.cell('B4').value(data.product_code || '');

      // Specification (B5)
      page1Worksheet.cell('B5').value(data.specification || '');

      // Production Order (F4)
      page1Worksheet.cell('F4').value(data.production_order || '');

      // Purchase Order (F5)
      page1Worksheet.cell('F5').value(data.purchase_order || '');

      // Machine (J4)
      page1Worksheet.cell('J4').value(data.machine_no || '');

      // Quantity (J5) - Add "Rolls" text like prestore form
      page1Worksheet.cell('J5').value(data.quantity ? `${data.quantity} Rolls` : '');

      // Production Date (N4) - format as DD/MM/YYYY
      page1Worksheet.cell('N4').value(data.production_date ? formatDateToDDMMYYYY(data.production_date) : '');

      // Inspection Date (N5) - format as DD/MM/YYYY
      page1Worksheet.cell('N5').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

      // Inspected By (B41)
      page1Worksheet.cell('B41').value(data.prepared_by || 'Unknown User');

      // Inspection Date (B42) - format as DD/MM/YYYY (duplicate for verification)
      page1Worksheet.cell('B42').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

      // Verified By (L41)
      page1Worksheet.cell('L41').value(data.verified_by || 'Not Verified');

      // Verified Date (L42) - format as DD/MM/YYYY
      page1Worksheet.cell('L42').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

      // Film Inspection Form Ref No (O3)
      page1Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

      // Map equipment data to Excel cells
      if (data.equipment_used && data.equipment_used.page1) {
        const equipment = data.equipment_used.page1;

        // Basic Weight Equipment (D6)
        page1Worksheet.cell('D6').value(equipment.basic_weight || '');

        // Thickness Equipment (G6)
        page1Worksheet.cell('G6').value(equipment.thickness || '');

        // Opacity Equipment (J6)
        page1Worksheet.cell('J6').value(equipment.opacity || '');

        // COF Equipment (M6)
        page1Worksheet.cell('M6').value(equipment.cof || '');
      }
    }

    // Map sample data to the correct columns - WHITE-102(18) has Page 1, Page 2, Page 3, and Page 4

    // Sample data should go in rows 8-37 (30 rows) - Updated to match template
    // Top rows (8-26): Historical data, Bottom rows (27-37): Fresh data
    // Lot & Roll data to Sample No. column (A8-A37)
    if (data.lot_and_roll) {
      const lotAndRollData = data.lot_and_roll;
      const dataValues = Object.values(lotAndRollData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          page1Worksheet.cell(`A${row}`).value(dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`A${row}`).value(''); // Empty row
        }
      }
    }

    // Roll ID data to column B (B8-B37) - Updated to match template
    if (data.roll_id) {
      const rollIdData = data.roll_id;
      const dataValues = Object.values(rollIdData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          page1Worksheet.cell(`B${row}`).value(dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`B${row}`).value(''); // Empty row
        }
      }
    }

    // Lot Time data to column C (C8-C37) - Updated to match template
    if (data.lot_time) {
      const lotTimeData = data.lot_time;
      const dataValues = Object.values(lotTimeData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          page1Worksheet.cell(`C${row}`).value(dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`C${row}`).value(''); // Empty row
        }
      }
    }

    // PAGE 1 DATA MAPPING - WHITE-102(18) - Updated to match template structure
    // Basic Weight data to column D (D8-D37)
    if (data.page1_basis_weight) {
      const basicWeightData = data.page1_basis_weight;

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = basicWeightData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column D (rows 8-37)
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        page1Worksheet.cell(`D${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
      }
    }

    // Thickness data to column G (G8-G37)
    if (data.page1_thickness) {
      const thicknessData = data.page1_thickness;

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = thicknessData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column G (rows 8-37)
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        page1Worksheet.cell(`G${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
      }
    }

    // Opacity data to column J (J8-J37)
    if (data.page1_opacity) {
      const opacityData = data.page1_opacity;

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = opacityData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column J (rows 8-37)
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        page1Worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
      }
    }

    // COF Kinetic data to column M (M8-M37)
    if (data.page1_cof_kinetic) {
      const cofKineticData = data.page1_cof_kinetic;

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = cofKineticData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column M (rows 8-37)
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        page1Worksheet.cell(`M${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
      }
    }

    // Now handle PAGE 2, 3, and 4 data mapping - WHITE-102(18) has 4 pages total

    // Map Page 2 data if Page2 worksheet exists
    if (page2Worksheet) {
      // Copy header info to Page 2
      page2Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page2Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page2Worksheet.cell('M42').value(data.verified_by || 'Not Verified');
      page2Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page2Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

      // Equipment data for Page 2 (D6)
      if (data.equipment_used && data.equipment_used.page2) {
        page2Worksheet.cell('D6').value(data.equipment_used.page2.common || '');
      }

      // Page 2 data mapping - Mechanical Properties MD - fill from top down (rows 9-38)
      // Elongation@ Break(%) MD 1 to column D (D9-D38)
      if (data.page2_elongation_md_1) {
        const elongationData = data.page2_elongation_md_1;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.cell(`D${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Elongation@ Break(%) MD 2 to column E (E9-E38)
      if (data.page2_elongation_md_2) {
        const elongationData = data.page2_elongation_md_2;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.cell(`E${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Elongation@ Break(%) MD 3 to column F (F9-F38)
      if (data.page2_elongation_md_3) {
        const elongationData = data.page2_elongation_md_3;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.cell(`F${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Continue with other Page 2 measurements...
      // Force Tensile Strength@Break(N)MD 1: H9-H38
      if (data.page2_force_md_1) {
        const forceData = data.page2_force_md_1;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.cell(`H${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Force Tensile Strength@Break(N)MD 2: I9-I38
      if (data.page2_force_md_2) {
        const forceData = data.page2_force_md_2;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.cell(`I${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Force Tensile Strength@Break(N)MD 3: J9-J38
      if (data.page2_force_md_3) {
        const forceData = data.page2_force_md_3;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Force Elongation 5% (N) MD 1: L9-L38
      if (data.page2_force_5p_md_1) {
        const forceData = data.page2_force_5p_md_1;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.cell(`L${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Force Elongation 5% (N) MD 2: M9-M38
      if (data.page2_force_5p_md_2) {
        const forceData = data.page2_force_5p_md_2;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.cell(`M${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Force Elongation 5% (N) MD 3: N9-N38
      if (data.page2_force_5p_md_3) {
        const forceData = data.page2_force_5p_md_3;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.cell(`N${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }
    }

    // Map Page 3 data if Page3 worksheet exists
    if (page3Worksheet) {
      // Copy header info to Page 3
      page3Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page3Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page3Worksheet.cell('M42').value(data.verified_by || 'Not Verified');
      page3Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page3Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

      // Equipment data for Page 3 (D6)
      if (data.equipment_used && data.equipment_used.page3) {
        page3Worksheet.cell('D6').value(data.equipment_used.page3.common || '');
      }

      // Page 3 data mapping - Mechanical Properties CD - fill from top down (rows 9-38)
      // Elongation@ Break (%) CD 1 to column D (D9-D38)
      if (data.page3_elongation_cd_1) {
        const elongationData = data.page3_elongation_cd_1;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.cell(`D${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Elongation@ Break (%) CD 2 to column E (E9-E38)
      if (data.page3_elongation_cd_2) {
        const elongationData = data.page3_elongation_cd_2;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.cell(`E${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Elongation@ Break (%) CD 3 to column F (F9-F38)
      if (data.page3_elongation_cd_3) {
        const elongationData = data.page3_elongation_cd_3;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.cell(`F${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Force-Tensile Strength@Break (N) CD 1: H9-H38
      if (data.page3_force_cd_1) {
        const forceData = data.page3_force_cd_1;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.cell(`H${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Force-Tensile Strength@Break (N) CD 2: I9-I38
      if (data.page3_force_cd_2) {
        const forceData = data.page3_force_cd_2;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.cell(`I${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Force-Tensile Strength@Break (N) CD 3: J9-J38
      if (data.page3_force_cd_3) {
        const forceData = data.page3_force_cd_3;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Modulus Web MD Fresh@2% 1: L9-L38
      if (data.page3_modulus_1) {
        const modulusData = data.page3_modulus_1;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = modulusData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.cell(`L${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Modulus Web MD Fresh@2% 2: M9-M38
      if (data.page3_modulus_2) {
        const modulusData = data.page3_modulus_2;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = modulusData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.cell(`M${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Modulus Web MD Fresh@2% 3: N9-N38
      if (data.page3_modulus_3) {
        const modulusData = data.page3_modulus_3;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = modulusData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.cell(`N${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }
    }
    // Map Page 4 data if Page4 worksheet exists
    if (page4Worksheet) {
      // Copy header info to Page 4
      page4Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page4Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page4Worksheet.cell('M42').value(data.verified_by || 'Not Verified');
      page4Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page4Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

      // Equipment data for Page 4 (D6, L6)
      if (data.equipment_used && data.equipment_used.page4) {
        page4Worksheet.cell('D6').value(data.equipment_used.page4.color_common || '');
        page4Worksheet.cell('L6').value(data.equipment_used.page4.gloss || '');
      }

      // Page 4 data mapping - Optical Properties - fill from top down (rows 9-38)
      // Color L to column D (D9-D38)
      if (data.page4_color_l) {
        const colorData = data.page4_color_l;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.cell(`D${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Color A to column F (F9-F38)
      if (data.page4_color_a) {
        const colorData = data.page4_color_a;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.cell(`F${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Color B to column H (H9-H38)
      if (data.page4_color_b) {
        const colorData = data.page4_color_b;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.cell(`H${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Color Delta E to column J (J9-J38)
      if (data.page4_color_delta_e) {
        const colorData = data.page4_color_delta_e;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Gloss 1 data to column L (L9-L38)
      if (data.page4_gloss_1) {
        const glossData = data.page4_gloss_1;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = glossData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.cell(`L${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Gloss 2 data to column M (M9-M38)
      if (data.page4_gloss_2) {
        const glossData = data.page4_gloss_2;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = glossData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.cell(`M${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Gloss 3 data to column N (N9-N38)
      if (data.page4_gloss_3) {
        const glossData = data.page4_gloss_3;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = glossData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.cell(`N${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Gloss Level 2 to column M (M9-M38)
      if (data.page4_gloss_2) {
        const glossData = data.page4_gloss_2;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = glossData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.cell(`M${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Gloss Level 3 to column N (N9-N38)
      if (data.page4_gloss_3) {
        const glossData = data.page4_gloss_3;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = glossData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.cell(`N${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }
    }

    // 4. Generate and send the Excel file
    const buffer = await workbook.outputAsync();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="FIF-APE-102(18)C-${form_id}.xlsx"`);
    res.send(buffer);

  } catch (error) {
    console.error('Error exporting WHITE-102(18) form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting WHITE-102(18) form: ${error.message}`);
  }
});

// UC-18gsm-250P-ABQR Film Inspection Form Excel Export Endpoint
app.get('/export-uc-18gsm-250p-abqr-form', async (req, res) => {
  try {
    // Get form_id parameter
    const { form_id } = req.query;

    if (!form_id) {
      return res.status(400).send('form_id parameter is required');
    }

    // 1. Fetch data from Supabase for the specific form
    const { data, error } = await supabase
      .from('uc-18gsm-250p-abqr')
      .select('*')
      .eq('form_id', form_id)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).send('Error fetching data from database');
    }

    if (!data) {
      return res.status(404).send('Form not found');
    }

    console.log('=== UC-18gsm-250P-ABQR Export Starting ===');
    console.log('Form ID:', form_id);
    console.log('Product Code:', data.product_code);

    // 2. Load the template
    const templatePath = path.join(__dirname, 'templates', 'UC-18gsm-250P-ABQR.xlsx');

    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      console.error('Template file does not exist at:', templatePath);
      return res.status(500).send('Template file not found');
    }

    let workbook;
    let page1Worksheet;
    let page2Worksheet;
    let page3Worksheet;
    let coaWorksheet;

    // Load the template file
    try {
      workbook = await XlsxPopulate.fromFileAsync(templatePath);
      page1Worksheet = workbook.sheet('Page1');

      // Create or get Page2 sheet for Page 2 data
      try {
        page2Worksheet = workbook.sheet('Page2');
      } catch (error) {
        page2Worksheet = workbook.addSheet('Page2');
      }

      // Create or get Page3 sheet for Page 3 data
      try {
        page3Worksheet = workbook.sheet('Page3');
      } catch (error) {
        page3Worksheet = workbook.addSheet('Page3');
      }

      // Create or get COA Form sheet for COA data
      try {
        coaWorksheet = workbook.sheet('COA Form');
      } catch (error) {
        coaWorksheet = workbook.addSheet('COA Form');
      }
    } catch (error) {
      console.log('Error loading template:', error.message);
      return res.status(500).send(`Error loading template: ${error.message}`);
    }

    // 3. Map data to Excel cells for Page 1

    // Product Code (C4)
    page1Worksheet.cell('C4').value(data.product_code || '');

    // Specification (C5)
    page1Worksheet.cell('C5').value(data.specification || '');

    // Production Order (F4)
    page1Worksheet.cell('F4').value(data.production_order || '');

    // Purchase Order (F5)
    page1Worksheet.cell('F5').value(data.purchase_order || '');

    // Machine (H4)
    page1Worksheet.cell('H4').value(data.machine_no || '');

    // Quantity (H5) - Add "Rolls" text like prestore form
    page1Worksheet.cell('H5').value(data.quantity ? `${data.quantity} Rolls` : '');

    // Production Date (J4) - format as DD/MM/YYYY
    page1Worksheet.cell('J4').value(data.production_date ? formatDateToDDMMYYYY(data.production_date) : '');

    // Inspection Date (J5) - format as DD/MM/YYYY
    page1Worksheet.cell('J5').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Equipment Data for Page 1
    if (data.equipment_used && data.equipment_used.page1) {
        page1Worksheet.cell('D6').value(data.equipment_used.page1.basic_weight || '');
        page1Worksheet.cell('E6').value(data.equipment_used.page1.dial_gauge || '');
        page1Worksheet.cell('F6').value('NA');
        page1Worksheet.cell('G6').value(data.equipment_used.page1.instron || '');
        page1Worksheet.cell('I6').value(data.equipment_used.page1.instron || '');
    }

    // Inspected By (B42)
    page1Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');

    // Inspection Date (B43) - format as DD/MM/YYYY
    page1Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Verified By (J42)
    page1Worksheet.cell('J42').value(data.verified_by || 'Not Verified');

    // Verified Date (J43) - format as DD/MM/YYYY
    page1Worksheet.cell('J43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

    // Film Inspection Form Ref No (K3)
    page1Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;

      // Film Weight Equipment (D6) - WHS
      page1Worksheet.cell('D6').value(equipment.film_weight || '');

      // Thickness Equipment (E6) - DTG
      page1Worksheet.cell('E6').value(equipment.thickness || '');

      // Tensile/COF Equipment (G6) - UTM
      page1Worksheet.cell('G6').value(equipment.tensile_break || equipment.cof_rr || '');

      // Elongation/Modulus Equipment (I6) - UTM
      page1Worksheet.cell('I6').value(equipment.elongation || equipment.modulus_10 || '');
    }

    // Map sample data to the correct columns for Page 1
    // Sample data should go in rows 8-37 (30 rows)

    // Lot & Roll data to Sample No. column (A9-A38)
    if (data.lot_and_roll) {
      const lotAndRollData = data.lot_and_roll;
      const dataValues = Object.values(lotAndRollData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          page1Worksheet.cell(`A${row}`).value(dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`A${row}`).value(''); // Empty row
        }
      }
    }

    // Roll ID data to column B (B9-B38)
    if (data.roll_id) {
      const rollIdData = data.roll_id;
      const dataValues = Object.values(rollIdData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          page1Worksheet.cell(`B${row}`).value(dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`B${row}`).value('');
        }
      }
    }

    // Lot Time data to column C (C9-C38)
    if (data.lot_time) {
      const lotTimeData = data.lot_time;
      const dataValues = Object.values(lotTimeData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          page1Worksheet.cell(`C${row}`).value(dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`C${row}`).value('');
        }
      }
    }

    // Page 1 Physical Properties data
    // Basis Weight data to column D (D9-D38)
    if (data.page1_basis_weight) {
      const basisWeightData = data.page1_basis_weight;
      const dataValues = Object.values(basisWeightData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`D${row}`).value('');
        }
      }
    }

    // Thickness data to column E (E9-E38)
    if (data.page1_thickness) {
      const thicknessData = data.page1_thickness;
      const dataValues = Object.values(thicknessData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`E${row}`).value('');
        }
      }
    }

    // Wettability data to column F (F9-F38)
    if (data.page1_wettability) {
      const wettabilityData = data.page1_wettability;
      const dataValues = Object.values(wettabilityData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`F${row}`).value('');
        }
      }
    }

    // COF RR data to column G (G9-G38)
    if (data.page1_cof_rr) {
      const cofRRData = data.page1_cof_rr;
      const dataValues = Object.values(cofRRData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`G${row}`).value('');
        }
      }
    }

    // COF CC data to column H (H9-H38)
    if (data.page1_cof_cc) {
      const cofCCData = data.page1_cof_cc;
      const dataValues = Object.values(cofCCData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`H${row}`).value('');
        }
      }
    }

    // Tensile Break data to column I (I9-I38)
    if (data.page1_tensile_break) {
      const tensileBreakData = data.page1_tensile_break;
      const dataValues = Object.values(tensileBreakData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`I${row}`).value('');
        }
      }
    }

    // Elongation data to column J (J9-J38)
    if (data.page1_elongation) {
      const elongationData = data.page1_elongation;
      const dataValues = Object.values(elongationData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`J${row}`).value('');
        }
      }
    }

    // Modulus data to column K (K9-K38)
    if (data.page1_modulus) {
      const modulusData = data.page1_modulus;
      const dataValues = Object.values(modulusData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`K${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`K${row}`).value('');
        }
      }
    }

    // PAGE 2 DATA MAPPING - UC-18gsm-250P-ABQR Page 2 data (Mechanical Properties)
    if (page2Worksheet && (data.page2_tensile_break || data.page2_cd_elongation || data.page2_modulus ||
                          data.page2_opacity || data.page2_roll_width || data.page2_diameter)) {
      console.log('Page 2 data detected, mapping Mechanical Properties measurements');

      // Equipment Data for Page 2
      if (data.equipment_used && data.equipment_used.page2) {
        const equipment = data.equipment_used.page2;

        // Tensile Break Equipment (D6) - INSTRON UTM
        page2Worksheet.cell('D6').value(equipment.tensile_break || '');

        // Opacity Equipment (G6) - SPECTROPHOTOMETER
        page2Worksheet.cell('G6').value(equipment.opacity || '');

        // Roll Width Equipment (I6) - STEEL RULER
        page2Worksheet.cell('I6').value(equipment.roll_width || '');

        // Diameter Equipment (K6) - STEEL RULER
        page2Worksheet.cell('K6').value(equipment.diameter || '');
      }

      // Tensile Break data to column D (D11-D40)
      if (data.page2_tensile_break) {
        const tensileBreakData = data.page2_tensile_break;
        const dataValues = Object.values(tensileBreakData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`D${row}`).value('');
          }
        }
      }

      // CD Elongation data to column E (E11-E40)
      if (data.page2_cd_elongation) {
        const cdElongationData = data.page2_cd_elongation;
        const dataValues = Object.values(cdElongationData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`E${row}`).value('');
          }
        }
      }

      // Modulus data to column F (F11-F40)
      if (data.page2_modulus) {
        const modulusData = data.page2_modulus;
        const dataValues = Object.values(modulusData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`F${row}`).value('');
          }
        }
      }

      // Opacity data to column G (G11-G38)
      if (data.page2_opacity) {
        const opacityData = data.page2_opacity;
        const dataValues = Object.values(opacityData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 38; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`G${row}`).value('');
          }
        }
      }

      // Roll Width data to column I (I11-I40)
      if (data.page2_roll_width) {
        const rollWidthData = data.page2_roll_width;
        const dataValues = Object.values(rollWidthData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`I${row}`).value('');
          }
        }
      }

      // Diameter data to column K (K11-K40)
      if (data.page2_diameter) {
        const diameterData = data.page2_diameter;
        const dataValues = Object.values(diameterData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`K${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`K${row}`).value('');
          }
        }
      }

      // Add personnel information to Page 2
      page2Worksheet.cell('B44').value(data.prepared_by || 'Unknown User');
      page2Worksheet.cell('B45').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page2Worksheet.cell('J44').value(data.verified_by || 'Not Verified');
      page2Worksheet.cell('J45').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page2Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');
    }

    // PAGE 3 DATA MAPPING - UC-18gsm-250P-ABQR Page 3 data (Color Measurements)
    if (page3Worksheet && (data.page3_colour_l || data.page3_colour_a || data.page3_colour_b ||
                          data.page3_delta_e || data.page3_base_film_pink)) {
      console.log('Page 3 data detected, mapping Color Measurements');

      // Equipment Data for Page 3
      if (data.equipment_used && data.equipment_used.page3) {
        const equipment = data.equipment_used.page3;

        // Color Equipment (D6) - XRITE/SPECTROPHOTOMETER
        page3Worksheet.cell('D6').value(equipment.colour || '');

        // Color Equipment (H6) - SPECTROPHOTOMETER
        page3Worksheet.cell('H6').value(equipment.colour || '');
      }

      // Color L data to column D (D10-D39)
      if (data.page3_colour_l) {
        const colorLData = data.page3_colour_l;
        const dataValues = Object.values(colorLData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`D${row}`).value('');
          }
        }
      }

      // Color A data to column E (E10-E39)
      if (data.page3_colour_a) {
        const colorAData = data.page3_colour_a;
        const dataValues = Object.values(colorAData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`E${row}`).value('');
          }
        }
      }

      // Color B data to column F (F10-F39)
      if (data.page3_colour_b) {
        const colorBData = data.page3_colour_b;
        const dataValues = Object.values(colorBData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`F${row}`).value('');
          }
        }
      }

      // Delta E data to column G (G10-G39)
      if (data.page3_delta_e) {
        const deltaEData = data.page3_delta_e;
        const dataValues = Object.values(deltaEData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`G${row}`).value('');
          }
        }
      }

      // Base Film Pink data to column H (H10-H39)
      if (data.page3_base_film_pink) {
        const baseFilmPinkData = data.page3_base_film_pink;
        const dataValues = Object.values(baseFilmPinkData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`H${row}`).value('');
          }
        }
      }

      // Add personnel information to Page 3
      page3Worksheet.cell('B43').value(data.prepared_by || 'Unknown User');
      page3Worksheet.cell('B44').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page3Worksheet.cell('J43').value(data.verified_by || 'Not Verified');
      page3Worksheet.cell('J44').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page3Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');
    }

    // COA FORM DATA MAPPING - UC-18gsm-250P-ABQR COA Form sheet
    if (coaWorksheet) {
      console.log('COA Form sheet detected, mapping COA data');

      // Inspected By (C41)
      coaWorksheet.cell('C41').value(data.prepared_by || 'Unknown User');

      // Add other COA fields as needed
      // You can add more COA-specific mappings here
    }

    // 4. Generate filename and set response headers
    const productCode = data.product_code || 'UC-18gsm-250P-ABQR';
    const batchNo = data.film_insp_form_ref_no || form_id;

    const filename = `FIF-${productCode}-${batchNo}.xlsx`;

    // 5. Set response headers for Excel download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    // 6. Write the workbook to response
    try {
      const buffer = await workbook.outputAsync();
      res.send(buffer);
    } catch (excelError) {
      console.error('Error generating Excel file:', excelError);
      console.error('Error stack:', excelError.stack);
      res.status(500).send(`Error generating Excel file: ${excelError.message}`);
    }

  } catch (error) {
    console.error('Error exporting UC-18gsm-250P-ABQR form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting UC-18gsm-250P-ABQR form: ${error.message}`);
  }
});

// UC-18gsm-290P-ABQR Film Inspection Form Excel Export Endpoint
app.get('/export-uc-18gsm-290p-abqr-form', async (req, res) => {
  try {
    // Get form_id parameter
    const { form_id } = req.query;

    if (!form_id) {
      return res.status(400).send('form_id parameter is required');
    }

    // 1. Fetch data from Supabase for the specific form
    const { data, error } = await supabase
      .from('uc-18gsm-290p-abqr')
      .select('*')
      .eq('form_id', form_id)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).send('Error fetching data from database');
    }

    if (!data) {
      return res.status(404).send('Form not found');
    }

    console.log('=== UC-18gsm-290P-ABQR Export Starting ===');
    console.log('Form ID:', form_id);
    console.log('Product Code:', data.product_code);

    // 2. Load the template
    const templatePath = path.join(__dirname, 'templates', 'UC-18gsm-290P-ABQR.xlsx');

    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      console.error('Template file does not exist at:', templatePath);
      return res.status(500).send('Template file not found');
    }

    let workbook;
    let page1Worksheet;
    let page2Worksheet;
    let page3Worksheet;
    let coaWorksheet;

    // Load the template file
    try {
      workbook = await XlsxPopulate.fromFileAsync(templatePath);
      page1Worksheet = workbook.sheet('Page1');

      // Create or get Page2 sheet for Page 2 data
      try {
        page2Worksheet = workbook.sheet('Page2');
      } catch (error) {
        page2Worksheet = workbook.addSheet('Page2');
      }

      // Create or get Page3 sheet for Page 3 data
      try {
        page3Worksheet = workbook.sheet('Page3');
      } catch (error) {
        page3Worksheet = workbook.addSheet('Page3');
      }

      // Create or get COA Form sheet for COA data
      try {
        coaWorksheet = workbook.sheet('COA Form');
      } catch (error) {
        coaWorksheet = workbook.addSheet('COA Form');
      }
    } catch (error) {
      console.log('Error loading template:', error.message);
      return res.status(500).send(`Error loading template: ${error.message}`);
    }

    // 3. Map data to Excel cells for Page 1

    // Product Code (C4)
    page1Worksheet.cell('C4').value(data.product_code || '');

    // Specification (C5)
    page1Worksheet.cell('C5').value(data.specification || '');

    // Production Order (F4)
    page1Worksheet.cell('F4').value(data.production_order || '');

    // Purchase Order (F5)
    page1Worksheet.cell('F5').value(data.purchase_order || '');

    // Machine (H4)
    page1Worksheet.cell('H4').value(data.machine_no || '');

    // Quantity (H5) - Add "Rolls" text like prestore form
    page1Worksheet.cell('H5').value(data.quantity ? `${data.quantity} Rolls` : '');

    // Production Date (J4) - format as DD/MM/YYYY
    page1Worksheet.cell('J4').value(data.production_date ? formatDateToDDMMYYYY(data.production_date) : '');

    // Inspection Date (J5) - format as DD/MM/YYYY
    page1Worksheet.cell('J5').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Equipment Data for Page 1
    if (data.equipment_used && data.equipment_used.page1) {
        page1Worksheet.cell('D6').value(data.equipment_used.page1.basic_weight || '');
        page1Worksheet.cell('E6').value(data.equipment_used.page1.dial_gauge || '');
        page1Worksheet.cell('F6').value('NA');
        page1Worksheet.cell('G6').value(data.equipment_used.page1.instron || '');
        page1Worksheet.cell('I6').value(data.equipment_used.page1.instron || '');
    }

    // Inspected By (B42)
    page1Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');

    // Inspection Date (B43) - format as DD/MM/YYYY
    page1Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Verified By (J42)
    page1Worksheet.cell('J42').value(data.verified_by || 'Not Verified');

    // Verified Date (J43) - format as DD/MM/YYYY
    page1Worksheet.cell('J43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

    // Film Inspection Form Ref No (K3)
    page1Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;

      // Film Weight Equipment (D6) - WHS
      page1Worksheet.cell('D6').value(equipment.film_weight || '');

      // Thickness Equipment (E6) - DTG
      page1Worksheet.cell('E6').value(equipment.thickness || '');

      // Tensile/COF Equipment (G6) - UTM
      page1Worksheet.cell('G6').value(equipment.tensile_break || equipment.cof_rr || '');

      // Elongation/Modulus Equipment (I6) - UTM
      page1Worksheet.cell('I6').value(equipment.elongation || equipment.modulus_10 || '');
    }

    // Map sample data to the correct columns for Page 1
    // Sample data should go in rows 8-37 (30 rows)

    // Lot & Roll data to Sample No. column (A9-A38)
    if (data.lot_and_roll) {
      const lotAndRollData = data.lot_and_roll;
      const dataValues = Object.values(lotAndRollData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          page1Worksheet.cell(`A${row}`).value(dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`A${row}`).value(''); // Empty row
        }
      }
    }

    // Roll ID data to column B (B9-B38)
    if (data.roll_id) {
      const rollIdData = data.roll_id;
      const dataValues = Object.values(rollIdData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          page1Worksheet.cell(`B${row}`).value(dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`B${row}`).value('');
        }
      }
    }

    // Lot Time data to column C (C9-C38)
    if (data.lot_time) {
      const lotTimeData = data.lot_time;
      const dataValues = Object.values(lotTimeData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          page1Worksheet.cell(`C${row}`).value(dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`C${row}`).value('');
        }
      }
    }

    // Page 1 Physical Properties data
    // Basis Weight data to column D (D9-D38)
    if (data.page1_basis_weight) {
      const basisWeightData = data.page1_basis_weight;
      const dataValues = Object.values(basisWeightData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`D${row}`).value('');
        }
      }
    }

    // Thickness data to column E (E9-E38)
    if (data.page1_thickness) {
      const thicknessData = data.page1_thickness;
      const dataValues = Object.values(thicknessData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`E${row}`).value('');
        }
      }
    }

    // Wettability data to column F (F9-F38)
    if (data.page1_wettability) {
      const wettabilityData = data.page1_wettability;
      const dataValues = Object.values(wettabilityData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`F${row}`).value('');
        }
      }
    }

    // COF RR data to column G (G9-G38)
    if (data.page1_cof_rr) {
      const cofRRData = data.page1_cof_rr;
      const dataValues = Object.values(cofRRData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`G${row}`).value('');
        }
      }
    }

    // COF CC data to column H (H9-H38)
    if (data.page1_cof_cc) {
      const cofCCData = data.page1_cof_cc;
      const dataValues = Object.values(cofCCData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`H${row}`).value('');
        }
      }
    }

    // Tensile Break data to column I (I9-I38)
    if (data.page1_tensile_break) {
      const tensileBreakData = data.page1_tensile_break;
      const dataValues = Object.values(tensileBreakData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`I${row}`).value('');
        }
      }
    }

    // Elongation data to column J (J9-J38)
    if (data.page1_elongation) {
      const elongationData = data.page1_elongation;
      const dataValues = Object.values(elongationData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`J${row}`).value('');
        }
      }
    }

    // Modulus data to column K (K9-K38)
    if (data.page1_modulus) {
      const modulusData = data.page1_modulus;
      const dataValues = Object.values(modulusData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`K${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`K${row}`).value('');
        }
      }
    }

    // PAGE 2 DATA MAPPING - UC-18gsm-290P-ABQR Page 2 data (Mechanical Properties)
    if (page2Worksheet && (data.page2_tensile_break || data.page2_cd_elongation || data.page2_modulus ||
                          data.page2_opacity || data.page2_roll_width || data.page2_diameter)) {
      console.log('Page 2 data detected, mapping Mechanical Properties measurements');

      // Equipment Data for Page 2
      if (data.equipment_used && data.equipment_used.page2) {
        const equipment = data.equipment_used.page2;

        // Tensile Break Equipment (D6) - INSTRON UTM
        page2Worksheet.cell('D6').value(equipment.tensile_break || '');

        // Opacity Equipment (G6) - SPECTROPHOTOMETER
        page2Worksheet.cell('G6').value(equipment.opacity || '');

        // Roll Width Equipment (I6) - STEEL RULER
        page2Worksheet.cell('I6').value(equipment.roll_width || '');

        // Diameter Equipment (K6) - STEEL RULER
        page2Worksheet.cell('K6').value(equipment.diameter || '');
      }

      // Tensile Break data to column D (D11-D40)
      if (data.page2_tensile_break) {
        const tensileBreakData = data.page2_tensile_break;
        const dataValues = Object.values(tensileBreakData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`D${row}`).value('');
          }
        }
      }

      // CD Elongation data to column E (E11-E40)
      if (data.page2_cd_elongation) {
        const cdElongationData = data.page2_cd_elongation;
        const dataValues = Object.values(cdElongationData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`E${row}`).value('');
          }
        }
      }

      // Modulus data to column F (F11-F40)
      if (data.page2_modulus) {
        const modulusData = data.page2_modulus;
        const dataValues = Object.values(modulusData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`F${row}`).value('');
          }
        }
      }

      // Opacity data to column G (G11-G38)
      if (data.page2_opacity) {
        const opacityData = data.page2_opacity;
        const dataValues = Object.values(opacityData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 38; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`G${row}`).value('');
          }
        }
      }

      // Roll Width data to column I (I11-I40)
      if (data.page2_roll_width) {
        const rollWidthData = data.page2_roll_width;
        const dataValues = Object.values(rollWidthData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`I${row}`).value('');
          }
        }
      }

      // Diameter data to column K (K11-K40)
      if (data.page2_diameter) {
        const diameterData = data.page2_diameter;
        const dataValues = Object.values(diameterData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`K${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`K${row}`).value('');
          }
        }
      }

      // Add personnel information to Page 2
      page2Worksheet.cell('B44').value(data.prepared_by || 'Unknown User');
      page2Worksheet.cell('B45').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page2Worksheet.cell('J44').value(data.verified_by || 'Not Verified');
      page2Worksheet.cell('J45').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page2Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');
    }

    // PAGE 3 DATA MAPPING - UC-18gsm-290P-ABQR Page 3 data (Color Measurements)
    if (page3Worksheet && (data.page3_colour_l || data.page3_colour_a || data.page3_colour_b ||
                          data.page3_delta_e || data.page3_base_film_pink)) {
      console.log('Page 3 data detected, mapping Color Measurements');

      // Equipment Data for Page 3
      if (data.equipment_used && data.equipment_used.page3) {
        const equipment = data.equipment_used.page3;

        // Color Equipment (D6) - XRITE/SPECTROPHOTOMETER
        page3Worksheet.cell('D6').value(equipment.colour || '');

        // Color Equipment (H6) - SPECTROPHOTOMETER
        page3Worksheet.cell('H6').value(equipment.colour || '');
      }

      // Color L data to column D (D10-D39)
      if (data.page3_colour_l) {
        const colorLData = data.page3_colour_l;
        const dataValues = Object.values(colorLData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`D${row}`).value('');
          }
        }
      }

      // Color A data to column E (E10-E39)
      if (data.page3_colour_a) {
        const colorAData = data.page3_colour_a;
        const dataValues = Object.values(colorAData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`E${row}`).value('');
          }
        }
      }

      // Color B data to column F (F10-F39)
      if (data.page3_colour_b) {
        const colorBData = data.page3_colour_b;
        const dataValues = Object.values(colorBData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`F${row}`).value('');
          }
        }
      }

      // Delta E data to column G (G10-G39)
      if (data.page3_delta_e) {
        const deltaEData = data.page3_delta_e;
        const dataValues = Object.values(deltaEData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`G${row}`).value('');
          }
        }
      }

      // Base Film Pink data to column H (H10-H39)
      if (data.page3_base_film_pink) {
        const baseFilmPinkData = data.page3_base_film_pink;
        const dataValues = Object.values(baseFilmPinkData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`H${row}`).value('');
          }
        }
      }

      // Add personnel information to Page 3
      page3Worksheet.cell('B43').value(data.prepared_by || 'Unknown User');
      page3Worksheet.cell('B44').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page3Worksheet.cell('J43').value(data.verified_by || 'Not Verified');
      page3Worksheet.cell('J44').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page3Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');
    }

    // COA FORM DATA MAPPING - UC-18gsm-290P-ABQR COA Form sheet
    if (coaWorksheet) {
      console.log('COA Form sheet detected, mapping COA data');

      // Inspected By (C41)
      coaWorksheet.cell('C41').value(data.prepared_by || 'Unknown User');

      // Add other COA fields as needed
      // You can add more COA-specific mappings here
    }

    // 4. Generate filename and set response headers
    const productCode = data.product_code || 'UC-18gsm-290P-ABQR';
    const batchNo = data.film_insp_form_ref_no || form_id;

    const filename = `FIF-${productCode}-${batchNo}.xlsx`;

    // 5. Set response headers for Excel download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    // 6. Write the workbook to response
    try {
      const buffer = await workbook.outputAsync();
      res.send(buffer);
    } catch (excelError) {
      console.error('Error generating Excel file:', excelError);
      console.error('Error stack:', excelError.stack);
      res.status(500).send(`Error generating Excel file: ${excelError.message}`);
    }

  } catch (error) {
    console.error('Error exporting UC-18gsm-290P-ABQR form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting UC-18gsm-290P-ABQR form: ${error.message}`);
  }
});

// Test endpoint to verify backend is working
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Backend server is running!',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/api/export-mjr-record/:id',
      '/api/export-machine-history-card',
      '/api/export-roller-history-card',
      '/api/test',
      '/health'
    ]
  });
});
// MT Job Requisition Excel Export Endpoint
app.get('/api/export-mjr-record/:requisitionId', async (req, res) => {
  try {
    const { requisitionId } = req.params;
    console.log('🔄 MJR Export Request - ID:', requisitionId);
    console.log('📋 Request headers:', Object.fromEntries(Object.entries(req.headers).slice(0, 5)));
    console.log('🌐 Request URL:', req.url);

    // 1. Get the MJR record from database
    const { data, error } = await supabase
      .from('mt_job_requisition_master')
      .select('*')
      .eq('id', requisitionId)
      .single();

    if (error) {
      console.error('❌ Database error:', error);
      return res.status(500).json({ error: 'Database error: ' + error.message });
    }

    if (!data) {
      console.error('❌ No data found for ID:', requisitionId);
      return res.status(404).json({ error: 'MJR record not found for ID: ' + requisitionId });
    }

    console.log('✅ Found MJR record:', data.id);
    console.log('📊 Record requisitionno:', data.requisitionno);

    // 2. Load the MJR template
    const templatePath = path.join(__dirname, 'templates', 'maintenance-job-requisition.xlsx');

    // Check if template file exists
    if (!fs.existsSync(templatePath)) {
      console.error('❌ MJR template file not found:', templatePath);
      return res.status(500).json({ error: 'Template file not found at: ' + templatePath });
    }

    console.log('📁 Template file found, loading...');

    // 3. Load and populate the template
    const workbook = await XlsxPopulate.fromFileAsync(templatePath);
    console.log('✅ Template loaded successfully');

    // 4. Map data to template fields (using your specific cell references)
    const sheet = workbook.sheet(0); // First sheet

    // Basic information
    sheet.cell('Q5').value(data.requisitionno || 'N/A'); // Requisition No.
    sheet.cell('D8').value(data.occurdate ? formatDateToDDMMYYYY(data.occurdate) : ''); // Date
    sheet.cell('F23').value(data.requestorname || ''); // Requestor Name
    sheet.cell('C5').value(data.reqdept || ''); // Department
    sheet.cell('Q23').value(data.reqdepthod || ''); // Department HOD
    sheet.cell('C6').value(data.equipmentname || ''); // Equipment Name
    sheet.cell('C7').value(data.equipmentno || ''); // Equipment No.
    sheet.cell('Q6').value(data.machineno || 'N/A'); // Machine No.
    sheet.cell('S34').value(data.purchasereqno || ''); // Purchase Req No.

    // Time information
    sheet.cell('H8').value(formatTimeToHHMM(data.occurtime)); // Occur Time (ensure HH:MM format)
    sheet.cell('V7').value(data.requirecompletiondate ? formatDateToDDMMYYYY(data.requirecompletiondate) : ''); // Required Completion Date
    sheet.cell('V8').value(formatTimeToHHMM(data.completiontime)); // Completion Time (ensure HH:MM format)
    sheet.cell('V42').value(formatTimeToHHMM(data.totalhours)); // Total Hours (ensure HH:MM format)

    // Condition and description
    sheet.cell('C17').value(data.existingcondition || ''); // Existing Condition

    // Action form specific fields (if applicable)
    if (data.form_type === 'action') {
      sheet.cell('C36').value(data.correction || ''); // Correction
      sheet.cell('C37').value(data.technicianname || ''); // Technician Name
      sheet.cell('C38').value(data.materialretrieval || ''); // Material Retrieval
      sheet.cell('C40').value(data.cleaninginspection || ''); // Cleaning Inspection

      // Schedule information
      if (data.schedulestartdate) {
        sheet.cell('D42').value(formatDateToDDMMYYYY(data.schedulestartdate)); // Schedule Start Date
      }
      if (data.schedulestarttime) {
        sheet.cell('H42').value(formatTimeToHHMM(data.schedulestarttime)); // Schedule Start Time (ensure HH:MM)
      }
      if (data.scheduleenddate) {
        sheet.cell('M42').value(formatDateToDDMMYYYY(data.scheduleenddate)); // Schedule End Date
      }
      if (data.scheduleendtime) {
        sheet.cell('Q42').value(formatTimeToHHMM(data.scheduleendtime)); // Schedule End Time (ensure HH:MM)
      }

      // Inspection results - put checkmark symbol based on database value
      if (data.inspectionresult === 'Accepted') {
        sheet.cell('F43').value('✓'); // Put checkmark for Accepted
        sheet.cell('F45').value(''); // Clear rejected field
      } else if (data.inspectionresult === 'Rejected') {
        sheet.cell('F45').value('✓'); // Put checkmark for Rejected
        sheet.cell('F43').value(''); // Clear accepted field
      }

      sheet.cell('C48').value(data.inspectionremarks || ''); // Inspection Remarks
      sheet.cell('E52').value(data.inspectioncheckedby || ''); // Inspected By
      sheet.cell('U39').value(data.cleanretrcheckedby || ''); // Cleaning Verified By
    }

    // Map checkbox and JSONB fields to Excel cells

    // Breakdown Codes
    if (data.breakdowncodes) {
      const breakdownMap = {
        'A': 'F11', 'B': 'I11', 'C': 'L11', 'D': 'O11', 'E': 'R11',
        'F': 'U11', 'G': 'X11', 'H': 'F14', 'I': 'I14', 'J': 'L14',
        'K': 'O14', 'L': 'R14', 'M': 'U14', 'N': 'X14'
      };

      // Handle both array format and object format
      if (Array.isArray(data.breakdowncodes)) {
        // Array format: ['A', 'B', 'C']
        data.breakdowncodes.forEach(code => {
          if (breakdownMap[code]) {
            sheet.cell(breakdownMap[code]).value('✓');
          }
        });
      } else if (typeof data.breakdowncodes === 'object' && data.breakdowncodes !== null) {
        // Object format: {'A': true, 'B': false, 'C': true}
        Object.entries(data.breakdowncodes).forEach(([code, isSelected]) => {
          if (isSelected && breakdownMap[code]) {
            sheet.cell(breakdownMap[code]).value('✓');
          }
        });
      }
    }

    // Power Options
    if (data.poweroptions) {
      const powerMap = {
        'switchOffPower': 'L25',
        'noSwitchPower': 'L28'
      };

      if (Array.isArray(data.poweroptions)) {
        // Array format: ['switchOffPower', 'noSwitchPower']
        data.poweroptions.forEach(option => {
          if (powerMap[option]) {
            sheet.cell(powerMap[option]).value('✓');
          }
        });
      } else if (typeof data.poweroptions === 'object' && data.poweroptions !== null) {
        // Object format: {'switchOffPower': true, 'noSwitchPower': false}
        Object.entries(data.poweroptions).forEach(([option, isSelected]) => {
          if (isSelected && powerMap[option]) {
            sheet.cell(powerMap[option]).value('✓');
          }
        });
      }
    }

    // Machine Options
    if (data.machineoptions) {
      const machineMap = {
        'stopMachine': 'X25',
        'noStopMachine': 'X28'
      };

      if (Array.isArray(data.machineoptions)) {
        // Array format: ['stopMachine', 'noStopMachine']
        data.machineoptions.forEach(option => {
          if (machineMap[option]) {
            sheet.cell(machineMap[option]).value('✓');
          }
        });
      } else if (typeof data.machineoptions === 'object' && data.machineoptions !== null) {
        // Object format: {'stopMachine': true, 'noStopMachine': false}
        Object.entries(data.machineoptions).forEach(([option, isSelected]) => {
          if (isSelected && machineMap[option]) {
            sheet.cell(machineMap[option]).value('✓');
          }
        });
      }
    }

    // Handle By Options
    if (data.handleby) {
      const handleByMap = {
        'MT': 'D32',
        'OTS': 'I32',
        'BT': 'L32'
      };

      if (Array.isArray(data.handleby)) {
        // Array format: ['MT', 'OTS', 'BT']
        data.handleby.forEach(option => {
          if (handleByMap[option]) {
            sheet.cell(handleByMap[option]).value('✓');
          }
        });
      } else if (typeof data.handleby === 'object' && data.handleby !== null) {
        // Object format: {'MT': true, 'OTS': false, 'BT': true}
        Object.entries(data.handleby).forEach(([option, isSelected]) => {
          if (isSelected && handleByMap[option]) {
            sheet.cell(handleByMap[option]).value('✓');
          }
        });
      }
    }

    // Materials Used
    if (data.materials_used && Array.isArray(data.materials_used)) {
      data.materials_used.forEach((material, index) => {
        const row = 45 + index; // Start from row 45
        if (row <= 53) { // Up to row 53 (8 rows total)
          sheet.cell(`I${row}`).value(material.material || '');
          sheet.cell(`O${row}`).value(material.specification || '');
          sheet.cell(`T${row}`).value(material.quantity_used || '');
          sheet.cell(`W${row}`).value(material.quantity_retrieved || '');
        }
      });
    }

    // 5. Generate filename
    const filename = `MJR-${data.requisitionno || data.id}-${new Date().toISOString().split('T')[0]}.xlsx`;
    console.log('📄 Generated filename:', filename);

    // 6. Save to buffer and send
    console.log('🔄 Generating Excel buffer...');
    const buffer = await workbook.outputAsync();
    console.log('✅ Buffer generated, size:', buffer.length, 'bytes');

    // Set headers for Excel file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    console.log('🚀 Sending MJR Excel file:', filename);
    res.send(buffer);
    console.log('✅ Response sent successfully');

  } catch (error) {
    console.error('Error exporting MJR record:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: `Error exporting MJR record: ${error.message}` });
  }
});

// Machine History Card Excel Export Endpoint
app.get('/api/export-machine-history-card', async (req, res) => {
  try {
    console.log('🔄 Machine History Card Export Request (GET)');
    console.log('📋 Request query params:', req.query);

    // 1. Get query parameters for filtering
    const { equipmentName, equipment, fromDate, toDate, status } = req.query;

    // 2. Build query for machine history data
    let query = supabase
      .from('mt_job_requisition_master')
      .select(`
        id,
        requisitionno,
        occurdate,
        occurtime,
        requestorname,
        reqdept,
        equipmentname,
        equipmentno,
        equipmentinstalldate,
        existingcondition,
        technicianname,
        rootcause,
        correction,
        costincurred,
        inspectioncheckedby,
        totalhours,
        completiontime,
        breakdowncodes,
        inspectionresult
      `)
      .order('occurdate', { ascending: false });

    // Apply filters if provided
    if (equipmentName) {
      query = query.eq('equipmentname', equipmentName);
    }
    if (equipment) {
      query = query.eq('equipmentno', equipment);
    }
    if (fromDate) {
      query = query.gte('occurdate', fromDate);
    }
    if (toDate) {
      query = query.lte('occurdate', toDate);
    }
    // Note: Status filtering will be handled in the frontend for now
    // to avoid complex Supabase query syntax issues

    const { data, error } = await query;

    if (error) {
      console.error('❌ Database error:', error);
      return res.status(500).json({ error: 'Database error: ' + error.message });
    }

    if (!data || data.length === 0) {
      console.error('❌ No data found for export');
      return res.status(404).json({ error: 'No machine history data found for export' });
    }

    console.log('✅ Found', data.length, 'records for export');

    // Process the data for export (existing logic continues below)
    await processAndExportData(data, res, 'GET', null, null, null);
  } catch (error) {
    console.error('❌ Error in GET export:', error);
    res.status(500).json({ error: `Error exporting machine history card: ${error.message}` });
  }
});

// POST endpoint for exporting filtered data from frontend
app.post('/api/export-machine-history-card', async (req, res) => {
  try {
    console.log('🔄 Machine History Card Export Request (POST)');
    console.log('📋 Request body:', req.body);

    const { data, filterSummary, selectedEquipmentName, selectedEquipmentId } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      console.error('❌ No filtered data provided for export');
      return res.status(400).json({ error: 'No filtered data provided for export' });
    }

    console.log('✅ Received', data.length, 'filtered records for export');
    if (filterSummary) {
      console.log('📊 Filter summary:', filterSummary);
    }
    if (selectedEquipmentName) {
      console.log('🏷️ Selected equipment name:', selectedEquipmentName);
    }

    // Use the filtered data directly
    await processAndExportData(data, res, 'POST', filterSummary, selectedEquipmentName, selectedEquipmentId);
  } catch (error) {
    console.error('❌ Error in POST export:', error);
    res.status(500).json({ error: `Error exporting machine history card: ${error.message}` });
  }
});

// Common function to process and export data (used by both GET and POST)
async function processAndExportData(data, res, method, filterSummary = null, selectedEquipmentName = null, selectedEquipmentId = null) {
  try {
    console.log('🔄 Processing export data for method:', method);
    if (selectedEquipmentName) {
      console.log('🏷️ Equipment name for header:', selectedEquipmentName);
    }

    // 3. Load the machine history card template
    const templatePath = path.join(__dirname, 'templates', 'machine-history-card.xlsx');

    // Check if template file exists
    if (!fs.existsSync(templatePath)) {
      console.error('❌ Machine history card template file not found:', templatePath);
      return res.status(500).json({ error: 'Template file not found at: ' + templatePath });
    }

    console.log('📁 Template file found, loading...');

    // 4. Load and populate the template
    const workbook = await XlsxPopulate.fromFileAsync(templatePath);
    console.log('✅ Template loaded successfully');

    // Get the first sheet (Page1) - try by name first, then by index
    let sheet;
    try {
      sheet = workbook.sheet('Page1');
      console.log('✅ Using sheet by name: Page1');
    } catch (error) {
      console.log('⚠️ Sheet name "Page1" not found, trying by index...');
      sheet = workbook.sheet(0); // Fallback to first sheet by index
      console.log('✅ Using sheet by index: 0');
    }

    // 4. Add equipment name to cell B5 (if provided, otherwise show "All Equipment")
    if (selectedEquipmentName && selectedEquipmentName.trim() !== '') {
      try {
        sheet.cell('B5').value(selectedEquipmentName);
        console.log('✅ Added equipment name to cell B5:', selectedEquipmentName);
      } catch (error) {
        console.error('❌ Error adding equipment name to B5:', error);
      }
    } else {
      try {
        sheet.cell('B5').value('All Equipment');
        console.log('✅ Added "All Equipment" to cell B5 (no specific equipment selected)');
      } catch (error) {
        console.error('❌ Error adding "All Equipment" to B5:', error);
      }
    }

    // 5. Map data to template (starting from row 9, assuming row 1 is headers)
    data.forEach((record, index) => {
      const rowNum = index + 9; // Start from row 9

      // Map the data fields to columns (based on the user's specifications)

      // Column A: Breakdown Date (occurdate)
      if (record.occurdate) {
        try {
        const date = new Date(record.occurdate);
          if (!isNaN(date.getTime())) {
        sheet.cell(`A${rowNum}`).value(date.toLocaleDateString('en-IN'));
          } else {
            sheet.cell(`A${rowNum}`).value('N/A');
          }
        } catch (error) {
          sheet.cell(`A${rowNum}`).value('N/A');
        }
      }

      // Column B: MJR# (requisitionno)
      if (record.requisitionno) {
        sheet.cell(`B${rowNum}`).value(record.requisitionno);
      }

      // Column C: BD CODE (breakdowncodes) - JSONB field
      if (record.breakdowncodes) {
        sheet.cell(`C${rowNum}`).value(extractBreakdownCodes(record.breakdowncodes));
      }

      // Column D: Equipment ID No. (equipmentno)
      if (record.equipmentno) {
        sheet.cell(`D${rowNum}`).value(record.equipmentno);
      }

      // Column E: Equipment Installation Date (equipmentinstalldate)
      if (record.equipmentinstalldate) {
        try {
        const installDate = new Date(record.equipmentinstalldate);
          if (!isNaN(installDate.getTime())) {
        sheet.cell(`E${rowNum}`).value(installDate.toLocaleDateString('en-IN'));
          } else {
            sheet.cell(`E${rowNum}`).value('N/A');
          }
        } catch (error) {
          sheet.cell(`E${rowNum}`).value('N/A');
        }
      }

      // Column F: Breakdown Description (existingcondition)
      if (record.existingcondition) {
        sheet.cell(`F${rowNum}`).value(record.existingcondition);
      }

      // Column G: M/C BD Start Time (occurtime) - format as HH:MM
      if (record.occurtime) {
        // Remove seconds if present (format as HH:MM only)
        const startTime = record.occurtime.length > 5 ? record.occurtime.substring(0, 5) : record.occurtime;
        sheet.cell(`G${rowNum}`).value(startTime);
      }

      // Column H: M/C BD Finish Time (completiontime) - format as HH:MM
      if (record.completiontime) {
        // Remove seconds if present (format as HH:MM only)
        const finishTime = record.completiontime.length > 5 ? record.completiontime.substring(0, 5) : record.completiontime;
        sheet.cell(`H${rowNum}`).value(finishTime);
      }

      // Column I: Total M/C BD Time (calculated field)
      if (record.occurtime && record.completiontime) {
        try {
          // Format times to HH:MM for calculation
          const startTime = record.occurtime.length > 5 ? record.occurtime.substring(0, 5) : record.occurtime;
          const finishTime = record.completiontime.length > 5 ? record.completiontime.substring(0, 5) : record.completiontime;

          // Debug logging
          console.log(`Calculating time for row ${rowNum}: ${startTime} to ${finishTime}`);

          const totalTime = calculateTotalBDTimeForExport(startTime, finishTime);
          console.log(`Total time calculated: ${totalTime}`);

          sheet.cell(`I${rowNum}`).value(totalTime);
        } catch (error) {
          console.error(`Error calculating total time for row ${rowNum}:`, error);
          sheet.cell(`I${rowNum}`).value('N/A');
        }
      }

      // Column J: Root Cause (rootcause)
      if (record.rootcause) {
        sheet.cell(`J${rowNum}`).value(record.rootcause);
      }

      // Column K: Corrective Action (correction) - Note: This field might not be in the current data structure
      // We'll need to add this field to the select query if it exists in the database
      if (record.correction) {
        sheet.cell(`K${rowNum}`).value(record.correction);
      }

      // Column L: Cost Incurred (costincurred) - format as ₹amount
      if (record.costincurred) {
        sheet.cell(`L${rowNum}`).value(`₹${record.costincurred}`);
      }

      // Column M: Done By (technicianname)
      if (record.technicianname) {
        sheet.cell(`M${rowNum}`).value(record.technicianname);
      }

      // Column N: Verify By (inspectioncheckedby)
      if (record.inspectioncheckedby) {
        sheet.cell(`N${rowNum}`).value(record.inspectioncheckedby);
      }

    });

    // 6. Generate Excel buffer
    const buffer = await workbook.outputAsync();
    console.log('✅ Buffer generated, size:', buffer.length, 'bytes');

    // 7. Set response headers for Excel download
    const timestamp = new Date().toISOString().slice(0, 10);
    const recordCount = data.length;
    const methodType = method === 'POST' ? 'Filtered' : 'Full';

    // Create filename with equipment name if available, otherwise "All-Equipment"
    let filename;
    if (selectedEquipmentName && selectedEquipmentName.trim() !== '') {
      // Sanitize equipment name for filename (remove special characters and spaces)
      const sanitizedEquipmentName = selectedEquipmentName.replace(/[^a-zA-Z0-9]/g, '_');
      filename = `Machine-History-Card-${sanitizedEquipmentName}-${timestamp}.xlsx`;
    } else {
      // No specific equipment selected, use "All-Equipment"
      filename = `Machine-History-Card-All-Equipment-${recordCount}-Records-${timestamp}.xlsx`;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    console.log('📤 Sending Excel file:', filename);
    if (filterSummary) {
      console.log('📊 Export Summary:', filterSummary);
    }
    res.send(buffer);

    console.log('✅ Machine history card export completed successfully');

  } catch (error) {
    console.error('❌ Error in processAndExportData:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: `Error exporting machine history card: ${error.message}` });
  }
}

// Helper function to extract breakdown codes from JSONB
function extractBreakdownCodes(breakdowncodes) {
  if (!breakdowncodes) return 'N/A';

  try {
    if (typeof breakdowncodes === 'object' && !Array.isArray(breakdowncodes)) {
      const selectedCodes = Object.keys(breakdowncodes).filter(key => breakdowncodes[key] === true);
      return selectedCodes.length > 0 ? selectedCodes.join(', ') : 'N/A';
    }

    if (Array.isArray(breakdowncodes)) {
      return breakdowncodes.join(', ');
    }

    return breakdowncodes || 'N/A';
  } catch (error) {
    console.error('Error extracting breakdown codes:', error);
    return 'N/A';
  }
}
// Helper function to calculate total breakdown time for export
function calculateTotalBDTimeForExport(startTime, finishTime) {
  if (!startTime || !finishTime) {
    console.log('Missing start or finish time:', { startTime, finishTime });
    return 'N/A';
  }

  try {
    console.log('Input times:', { startTime, finishTime });

    // Ensure times are in HH:MM format
    const startTimeFormatted = startTime.length === 5 ? startTime : startTime.substring(0, 5);
    const finishTimeFormatted = finishTime.length === 5 ? finishTime : finishTime.substring(0, 5);

    console.log('Formatted times:', { startTimeFormatted, finishTimeFormatted });

    const start = new Date(`1970-01-01T${startTimeFormatted}:00`);
    const finish = new Date(`1970-01-01T${finishTimeFormatted}:00`);

    console.log('Parsed dates:', { start, finish });

    if (isNaN(start.getTime()) || isNaN(finish.getTime())) {
      console.log('Invalid date conversion');
      return 'N/A';
    }

    let diffMs = finish.getTime() - start.getTime();
    console.log('Time difference (ms):', diffMs);

    // If finish time is earlier than start time, assume it spans midnight (next day)
    if (diffMs < 0) {
      // Add 24 hours (in milliseconds) to handle next day scenario
      diffMs += 24 * 60 * 60 * 1000;
      console.log('Added 24 hours, new diff (ms):', diffMs);
    }

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    console.log('Final result - Hours:', diffHours, 'Minutes:', diffMinutes);

    if (diffHours > 0 && diffMinutes > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else if (diffHours > 0) {
      return `${diffHours}h`;
    } else {
      return `${diffMinutes}m`;
    }
  } catch (error) {
    console.error('Error calculating total BD time for export:', error);
    return 'N/A';
  }
}

// Helper function to get status for export
function getStatusForExport(inspectionresult) {
  if (!inspectionresult) return 'Pending';

  if (inspectionresult.toLowerCase().includes('accepted') || inspectionresult.toLowerCase().includes('rejected')) {
    return 'Completed';
  }

  return inspectionresult || 'Pending';
}

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
// Pre-Store Form Excel Export Endpoint
app.get('/api/download-prestore-excel/:formId', async (req, res) => {
  try {
    const { formId } = req.params;
    
    
    if (!formId) {
      return res.status(400).send('formId parameter is required');
    }

    // 1. Determine which table this form belongs to and fetch the correct data
    let data, error, tableName;
    
    // Check 168_16c_white table
    const { data: whiteData, error: whiteError } = await supabase
      .from('168_16c_white')
      .select('*')
      .eq('form_id', formId)
      .single();
    
    if (!whiteError && whiteData) {
      data = whiteData;
      error = null;
      tableName = '168_16c_white';
    } else {
      // Check 168_16cp_kranti table
      const { data: krantiData, error: krantiError } = await supabase
        .from('168_16cp_kranti')
        .select('*')
        .eq('form_id', formId)
        .single();
      
      if (!krantiError && krantiData) {
        data = krantiData;
        error = null;
        tableName = '168_16cp_kranti';
        } else {
          // Check 176_18cp_ww table
          const { data: wwData, error: wwError } = await supabase
            .from('176_18cp_ww')
            .select('*')
            .eq('form_id', formId)
            .single();
          
          if (!wwError && wwData) {
            data = wwData;
            error = null;
            tableName = '176_18cp_ww';
          } else {
            // Check 168_18c_white_jeddah table
            const { data: jeddahData, error: jeddahError } = await supabase
              .from('168_18c_white_jeddah')
              .select('*')
              .eq('form_id', formId)
              .single();
            
            if (!jeddahError && jeddahData) {
              data = jeddahData;
              error = null;
              tableName = '168_18c_white_jeddah';
            } else {
              // Check 234_18_micro_white table
              const { data: microWhite234Data, error: microWhite234Error } = await supabase
                .from('234_18_micro_white')
                .select('*')
                .eq('form_id', formId)
                .single();

              if (!microWhite234Error && microWhite234Data) {
                data = microWhite234Data;
                error = null;
                tableName = '234_18_micro_white';
              } else {
                // Check 214_18_micro_white table (WHITE-214(18))
                const { data: microWhite214Data, error: microWhite214Error } = await supabase
                  .from('214_18_micro_white')
                  .select('*')
                  .eq('form_id', formId)
                  .single();

                if (!microWhite214Error && microWhite214Data) {
                  data = microWhite214Data;
                  error = null;
                  tableName = '214_18_micro_white';
                } else {
                  // Check 102_18c_micro_white table
                  const { data: microWhite102Data, error: microWhite102Error } = await supabase
                    .from('102_18c_micro_white')
                    .select('*')
                    .eq('form_id', formId)
                    .single();

                  if (!microWhite102Error && microWhite102Data) {
                    data = microWhite102Data;
                    error = null;
                    tableName = '102_18c_micro_white';
                  } else {
                    // Check 168_18c_white table (new 168 white product)
                    const { data: white168Data, error: white168Error } = await supabase
                      .from('168_18c_white')
                      .select('*')
                      .eq('form_id', formId)
                      .single();

                  if (!white168Error && white168Data) {
                    data = white168Data;
                    error = null;
                    tableName = '168_18c_white';
                  } else {
                    // Check uc-18gsm-250p-abqr table
                    const { data: uc250pData, error: uc250pError } = await supabase
                      .from('uc-18gsm-250p-abqr')
                      .select('*')
                      .eq('form_id', formId)
                      .single();

                    if (!uc250pError && uc250pData) {
                      data = uc250pData;
                      error = null;
                      tableName = 'uc-18gsm-250p-abqr';
                    } else {
                      // Check uc-18gsm-290p-abqr table
                      const { data: uc290pData, error: uc290pError } = await supabase
                        .from('uc-18gsm-290p-abqr')
                        .select('*')
                        .eq('form_id', formId)
                        .single();

                      if (!uc290pError && uc290pData) {
                        data = uc290pData;
                        error = null;
                        tableName = 'uc-18gsm-290p-abqr';
                      } else {
                        data = null;
                        error = new Error('Form not found in any table');
                        tableName = null;
                      }
                    }
                  }
                  }
                }
              }
            }
          }
        }
    }

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).send('Error fetching data from database');
    }

    if (!data) {
      return res.status(404).send('Form not found');
    }


    // 2. Load the pre-store template
    const templatePath = path.join(__dirname, 'templates', 'pre-store-form.xlsx');
    
    if (!fs.existsSync(templatePath)) {
      console.error('Pre-Store template file not found:', templatePath);
      return res.status(500).send('Pre-Store template file not found');
    }


    // 3. Load the workbook
    const workbook = await XlsxPopulate.fromFileAsync(templatePath);
    try {
    } catch (readError) {
      console.error('Error reading Pre-Store template file:', readError);
      return res.status(500).send('Error reading Pre-Store template file');
    }
    
    // Try to get the first worksheet (index 0) or by name
    let worksheet = workbook.sheet(1);
    if (!worksheet) {
      worksheet = workbook.sheet(0);
    }
    if (!worksheet) {
      worksheet = workbook.sheet('Sheet1');
    }
    if (!worksheet) {
      // Get the first available worksheet
      const worksheetNames = workbook.sheets().map(ws => ws.name());
      if (worksheetNames.length > 0) {
        worksheet = workbook.sheet(worksheetNames[0]);
      }
    }
    
    if (!worksheet) {
      console.error('No worksheet found in Pre-Store template');
      return res.status(500).send('No worksheet found in Pre-Store template');
    }
    

    // 4. Map pre-store data to Excel cells
    // Product and Production Information Section
    if (data.production_order) {
      worksheet.cell('B4').value(data.production_order);
    }

    // Handle customer field - may not exist in all tables
    if (data.customer) {
      // Add location in brackets if available
      let customerValue = data.customer;
      if (data.location) {
        customerValue = `${data.customer} (${data.location})`;
      }
      worksheet.cell('B5').value(customerValue);
    } else if (data.product_code) {
      // Fallback to product code if customer not available
      worksheet.cell('B5').value(data.product_code);
    }

    // Handle standard_packing field - may not exist in all tables
    if (data.standard_packing) {
      worksheet.cell('B6').value(data.standard_packing);
    }

    if (data.product_code) {
      worksheet.cell('G4').value(data.product_code);
    }

    if (data.specification) {
      worksheet.cell('G5').value(data.specification);
    }

    if (data.quantity) {
      worksheet.cell('O4').value(`${data.quantity} Rolls`);
    }

    // Handle batch field - may not exist in all tables
    if (data.batch) {
      worksheet.cell('O5').value(data.batch);
    }

    if (data.production_date) {
      // Format date to dd/mm/yyyy
      const prodDate = new Date(data.production_date);
      const formattedProdDate = `${String(prodDate.getDate()).padStart(2, '0')}/${String(prodDate.getMonth() + 1).padStart(2, '0')}/${prodDate.getFullYear()}`;
      worksheet.cell('T4').value(formattedProdDate);
    }

    if (data.inspection_date) {
      // Format date to dd/mm/yyyy
      const inspDate = new Date(data.inspection_date);
      const formattedInspDate = `${String(inspDate.getDate()).padStart(2, '0')}/${String(inspDate.getMonth() + 1).padStart(2, '0')}/${inspDate.getFullYear()}`;
      worksheet.cell('T5').value(formattedInspDate);
    }
    
    // Handle pallet_size field - may not exist in all tables
    if (data.pallet_size !== undefined) {
      worksheet.cell('P6').value(data.pallet_size || 'N/A');
    }
    
    // Palletized Finished Goods Status Section
    // Helper function to get status symbol
    const getStatusSymbol = (status) => {
      if (status === 'Accept' || status === 'accept' || status === 'Pass' || status === 'pass') {
        return '✓'; // Check symbol
      } else if (status === 'Reject' || status === 'reject' || status === 'Fail' || status === 'fail') {
        return '✗'; // Cross symbol
      } else if (status === 'NA' || status === 'na' || status === 'N/A' || status === 'n/a') {
        return 'N/A';
      }
      return status || 'N/A'; // Return original value if no match, or N/A if undefined
    };

    // Handle pre-store status fields - may not exist in all tables
    if (data.pallet_list !== undefined) {
      worksheet.cell('C9').value(getStatusSymbol(data.pallet_list));
    }

    if (data.product_label !== undefined) {
      worksheet.cell('P9').value(getStatusSymbol(data.product_label));
    }

    if (data.wrapping !== undefined) {
      worksheet.cell('C10').value(getStatusSymbol(data.wrapping));
    }

    if (data.layer_pad !== undefined) {
      worksheet.cell('P10').value(getStatusSymbol(data.layer_pad));
    }

    if (data.contamination !== undefined) {
      worksheet.cell('C11').value(getStatusSymbol(data.contamination));
    }

    if (data.kraft_paper !== undefined) {
      worksheet.cell('P11').value(getStatusSymbol(data.kraft_paper));
    }

    if (data.no_damage !== undefined) {
      worksheet.cell('C12').value(getStatusSymbol(data.no_damage));
    }

    if (data.pallet !== undefined) {
      worksheet.cell('P12').value(getStatusSymbol(data.pallet));
    }
    
    // Handle prestore fields - may not exist in all tables
    if (data.prestore_done_by !== undefined) {
      worksheet.cell('A29').value(data.prestore_done_by || 'N/A');
    }

    if (data.remarks !== undefined) {
      // Handle remarks - each row A14-V14, A15-V15, etc. is merged
      // Put text in A14, A15, A16, etc. and it will flow across the merged cells
      const maxRows = 9; // From row 14 to 22 (9 rows)
      const maxCharsPerRow = 200; // Approximate characters per merged row (A to V)

      // Remove newlines and create one continuous text
      const continuousText = (data.remarks || '').replace(/\n/g, ' ').trim();

      // Split text into chunks that fit in each merged row
      const words = continuousText.split(' ');
      let currentRowText = '';
      const rowTexts = [];

      words.forEach(word => {
        const testText = currentRowText + (currentRowText ? ' ' : '') + word;

        if (testText.length <= maxCharsPerRow) {
          currentRowText = testText;
        } else {
          if (currentRowText) {
            rowTexts.push(currentRowText);
            currentRowText = word;
          } else {
            // Single word is too long, force it
            rowTexts.push(word);
          }
        }
      });

      // Add remaining text
      if (currentRowText) {
        rowTexts.push(currentRowText);
      }

      // Map each row text to A13, A14, A15, etc. (merged cells)
      for (let i = 0; i < Math.min(rowTexts.length, maxRows); i++) {
        const rowNum = 14 + i;
        worksheet.cell(`A${rowNum}`).value(rowTexts[i].trim()); // Trim spaces at end
      }
    }

    if (data.prestore_ref_no !== undefined) {
      worksheet.cell('V3').value(data.prestore_ref_no || 'N/A');
    }

    // 5. Set response headers for file download
    // Generate filename with standardized format: Pre-Store-{product_code}-{batch_no}
    const productCode = data.product_code || 'UNKNOWN';
    const batchNo = data.batch || data.production_order || data.lot_no || formId;
    const filename = `Pre-Store-${productCode}-${batchNo}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    // 6. Write the workbook to response
    const buffer = await workbook.outputAsync();
    res.send(buffer);
    res.end();


  } catch (error) {
    console.error('Error generating Pre-Store Excel file:', error);
    res.status(500).send('Error generating Pre-Store Excel file');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Swanson India Portal Backend Server Started!`);
  console.log(`📡 Server listening on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Excel export: http://localhost:${PORT}/export`);
  console.log(`📊 Machine History Card export: http://localhost:${PORT}/api/export-machine-history-card`);
  console.log(`📊 Emboss/Rubber Roller History Card export: http://localhost:${PORT}/api/export-roller-history-card`);
});

// Emboss/Rubber Roller History Card Excel Export Endpoint
app.get('/api/export-roller-history-card', async (req, res) => {
  try {
    console.log('🔄 Emboss/Rubber Roller History Card Export Request (GET)');
    console.log('📋 Request query params:', req.query);

    // 1. Get query parameters for filtering
    const { equipmentName, equipment, fromDate, toDate, status } = req.query;

    // 2. Build query for roller history data
    let query = supabase
      .from('mt_job_requisition_master')
      .select(`
        id,
        requisitionno,
        occurdate,
        occurtime,
        requestorname,
        reqdept,
        equipmentname,
        equipmentno,
        equipmentinstalldate,
        existingcondition,
        technicianname,
        rootcause,
        correction,
        costincurred,
        inspectioncheckedby,
        totalhours,
        completiontime,
        breakdowncodes,
        inspectionresult,
        recoatingdate,
        regrindingdate
      `)
      .not('recoatingdate', 'is', null)
      .not('regrindingdate', 'is', null)
      .order('occurdate', { ascending: false });

    // Apply filters if provided
    if (equipmentName) {
      query = query.eq('equipmentname', equipmentName);
    }
    if (equipment) {
      query = query.eq('equipmentno', equipment);
    }
    if (fromDate) {
      query = query.gte('occurdate', fromDate);
    }
    if (toDate) {
      query = query.lte('occurdate', toDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Database error:', error);
      return res.status(500).json({ error: 'Database error: ' + error.message });
    }

    if (!data || data.length === 0) {
      console.error('❌ No roller history data found for export');
      return res.status(404).json({ error: 'No roller history data found for export' });
    }

    console.log('✅ Found', data.length, 'roller history records for export');

    // Process the data for export
    await processRollerHistoryData(data, res, 'GET', null, null, null);
  } catch (error) {
    console.error('❌ Error in GET roller export:', error);
    res.status(500).json({ error: `Error exporting roller history card: ${error.message}` });
  }
});

// POST endpoint for exporting filtered roller data from frontend
app.post('/api/export-roller-history-card', async (req, res) => {
  try {
    console.log('🔄 Emboss/Rubber Roller History Card Export Request (POST)');
    console.log('📋 Request body:', req.body);

    const { data, filterSummary, selectedEquipmentName, selectedEquipmentId } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      console.error('❌ No filtered roller data provided for export');
      return res.status(400).json({ error: 'No filtered roller data provided for export' });
    }

    console.log('✅ Received', data.length, 'filtered roller records for export');
    if (filterSummary) {
      console.log('📊 Filter summary:', filterSummary);
    }
    if (selectedEquipmentName) {
      console.log('🏷️ Selected equipment name:', selectedEquipmentName);
    }

    // Use the filtered data directly
    await processRollerHistoryData(data, res, 'POST', filterSummary, selectedEquipmentName, selectedEquipmentId);
  } catch (error) {
    console.error('❌ Error in POST roller export:', error);
    res.status(500).json({ error: `Error exporting roller history card: ${error.message}` });
  }
});

// Common function to process and export roller history data
async function processRollerHistoryData(data, res, method, filterSummary = null, selectedEquipmentName = null, selectedEquipmentId = null) {
  try {
    console.log('🔄 Processing roller history export data for method:', method);
    if (selectedEquipmentName) {
      console.log('🏷️ Equipment name for header:', selectedEquipmentName);
    }

    // 3. Load the roller history card template
    const templatePath = path.join(__dirname, 'templates', 'emboss-rubber-roller-history-card.xlsx');

    // Check if template file exists
    if (!fs.existsSync(templatePath)) {
      console.error('❌ Roller history card template file not found:', templatePath);
      return res.status(500).json({ error: 'Template file not found at: ' + templatePath });
    }

    console.log('📁 Template file found, loading...');

    // 4. Load and populate the template
    const workbook = await XlsxPopulate.fromFileAsync(templatePath);
    console.log('✅ Template loaded successfully');

    // Get the first sheet (Page1)
    let sheet;
    try {
      sheet = workbook.sheet('Page1');
      console.log('✅ Using sheet by name: Page1');
    } catch (error) {
      console.log('⚠️ Sheet name "Page1" not found, trying by index...');
      sheet = workbook.sheet(0); // Fallback to first sheet by index
      console.log('✅ Using sheet by index: 0');
    }

    // 5. Get equipment info directly from database records
    if (data.length > 0) {
      // Get equipment name and ID from the first record (all records should have same equipment for roller history)
      const firstRecord = data[0];
      const equipmentName = firstRecord.equipmentname;
      const equipmentId = firstRecord.equipmentno;

      if (equipmentName && equipmentName.trim() !== '') {
        try {
          sheet.cell('C5').value(equipmentName);
          console.log('✅ Added equipment name to cell C5:', equipmentName);
        } catch (error) {
          console.error('❌ Error adding equipment name to C5:', error);
        }
      }

      if (equipmentId && equipmentId.trim() !== '') {
        try {
          sheet.cell('C6').value(equipmentId);
          console.log('✅ Added equipment ID to cell C6:', equipmentId);
        } catch (error) {
          console.error('❌ Error adding equipment ID to C6:', error);
        }
      }
    }

    // 6. Map roller data to template (using specified cell ranges)
    data.forEach((record, index) => {
      const rowNum = index + 10; // Start from row 10 (a10, b10, etc.)

      // Column A: Date (breakdown_date) - a10 to a109
      if (record.occurdate) {
        try {
          const date = new Date(record.occurdate);
          if (!isNaN(date.getTime())) {
            sheet.cell(`A${rowNum}`).value(date.toLocaleDateString('en-IN'));
          } else {
            sheet.cell(`A${rowNum}`).value('N/A');
          }
        } catch (error) {
          sheet.cell(`A${rowNum}`).value('N/A');
        }
      }

      // Column B: MJR# No. (mjr_number) - b10 to b109
      if (record.requisitionno) {
        sheet.cell(`B${rowNum}`).value(record.requisitionno);
      }

      // Column C: Recoated Date (recoatingdate) - c10 to c109
      if (record.recoatingdate) {
        try {
          const recoatingDate = new Date(record.recoatingdate);
          if (!isNaN(recoatingDate.getTime())) {
            sheet.cell(`C${rowNum}`).value(recoatingDate.toLocaleDateString('en-IN'));
          } else {
            sheet.cell(`C${rowNum}`).value('N/A');
          }
        } catch (error) {
          sheet.cell(`C${rowNum}`).value('N/A');
        }
      }

      // Column D: Regrind date (regrindingdate) - d10 to d109
      if (record.regrindingdate) {
        try {
          const regrindingDate = new Date(record.regrindingdate);
          if (!isNaN(regrindingDate.getTime())) {
            sheet.cell(`D${rowNum}`).value(regrindingDate.toLocaleDateString('en-IN'));
          } else {
            sheet.cell(`D${rowNum}`).value('N/A');
          }
        } catch (error) {
          sheet.cell(`D${rowNum}`).value('N/A');
        }
      }

      // Column E: Work Description (breakdown_description) - e10 to e109
      if (record.existingcondition) {
        sheet.cell(`E${rowNum}`).value(record.existingcondition);
      }

      // Column F: Start Time (start_time) - f10 to f109
      if (record.occurtime) {
        const startTime = record.occurtime.length > 5 ? record.occurtime.substring(0, 5) : record.occurtime;
        sheet.cell(`F${rowNum}`).value(startTime);
      }

      // Column G: Finish Time (finish_time) - g10 to g109
      if (record.completiontime) {
        const finishTime = record.completiontime.length > 5 ? record.completiontime.substring(0, 5) : record.completiontime;
        sheet.cell(`G${rowNum}`).value(finishTime);
      }

      // Column H: Total BD Time (calculated) - h10 to h109
      if (record.occurtime && record.completiontime) {
        try {
          const startTime = record.occurtime.length > 5 ? record.occurtime.substring(0, 5) : record.occurtime;
          const finishTime = record.completiontime.length > 5 ? record.completiontime.substring(0, 5) : record.completiontime;

          const totalTime = calculateTotalBDTimeForExport(startTime, finishTime);
          sheet.cell(`H${rowNum}`).value(totalTime);
        } catch (error) {
          console.error(`Error calculating total time for row ${rowNum}:`, error);
          sheet.cell(`H${rowNum}`).value('N/A');
        }
      }

      // Column I: Reason for changeover (root_cause) - i10 to i109
      if (record.rootcause) {
        sheet.cell(`I${rowNum}`).value(record.rootcause);
      }

      // Column J: Corrective Action (corrective_action) - j10 to j109
      if (record.correction) {
        sheet.cell(`J${rowNum}`).value(record.correction);
      }

      // Column K: Cost Incurred (cost_incurred) - k10 to k109
      if (record.costincurred) {
        sheet.cell(`K${rowNum}`).value(`₹${record.costincurred}`);
      }

      // Column L: Done By (done_by) - l10 to l109
      if (record.technicianname) {
        sheet.cell(`L${rowNum}`).value(record.technicianname);
      }

      // Column M: Verify By (verified_by) - m10 to m109
      if (record.inspectioncheckedby) {
        sheet.cell(`M${rowNum}`).value(record.inspectioncheckedby);
      }

    });

    // 7. Generate Excel buffer
    const buffer = await workbook.outputAsync();
    console.log('✅ Buffer generated, size:', buffer.length, 'bytes');

    // 8. Set response headers for Excel download
    const timestamp = new Date().toISOString().slice(0, 10);
    const recordCount = data.length;
    const methodType = method === 'POST' ? 'Filtered' : 'Full';

    // Create filename with equipment name if available, otherwise "All-Rollers"
    let filename;
    if (selectedEquipmentName && selectedEquipmentName.trim() !== '') {
      const sanitizedEquipmentName = selectedEquipmentName.replace(/[^a-zA-Z0-9]/g, '_');
      filename = `Roller-History-Card-${sanitizedEquipmentName}-${timestamp}.xlsx`;
    } else {
      filename = `Roller-History-Card-All-Rollers-${recordCount}-Records-${timestamp}.xlsx`;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    console.log('📤 Sending Excel file:', filename);
    if (filterSummary) {
      console.log('📊 Export Summary:', filterSummary);
    }
    res.send(buffer);

    console.log('✅ Roller history card export completed successfully');

  } catch (error) {
    console.error('❌ Error in processRollerHistoryData:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: `Error exporting roller history card: ${error.message}` });
  }
}

