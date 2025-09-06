const express = require('express');
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

// Enhanced 24/7 Keep-alive system to prevent cold starts
// Multiple ping intervals for maximum reliability
setInterval(() => {
  try {
    console.log('🔄 24/7 Keep-alive ping - Server staying warm');
    console.log(`⏰ Keep-alive at: ${new Date().toISOString()}`);
    console.log('✅ Server is active and responding');
    
    // Additional memory cleanup to prevent cold starts
    if (global.gc) {
      global.gc();
      console.log('🧹 Memory cleanup performed');
    }
  } catch (error) {
    console.log('❌ Keep-alive ping error:', error.message);
  }
}, 5 * 60 * 1000); // Every 5 minutes (more frequent for cold start prevention)

// Secondary keep-alive for redundancy
setInterval(() => {
  try {
    console.log('🔄 Secondary keep-alive ping');
    console.log(`⏰ Secondary ping at: ${new Date().toISOString()}`);
    
    // Warm up critical endpoints
    fetch(`http://localhost:${PORT}/ping`).catch(() => {});
    fetch(`http://localhost:${PORT}/health`).catch(() => {});
    
  } catch (error) {
    console.log('❌ Secondary keep-alive error:', error.message);
  }
}, 10 * 60 * 1000); // Every 10 minutes

// Enhanced keep-alive endpoint to prevent cold starts
app.get('/ping', async (req, res) => {
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  
  // Log the ping request for monitoring
  console.log(`📡 Ping request received at: ${new Date().toISOString()}`);
  
  // Perform a light database query to keep connections warm
  try {
    const { data, error } = await supabase
      .from('inline_inspection_form_master_2')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log('⚠️ Ping database check failed:', error.message);
    } else {
      console.log('✅ Ping database connection warm');
    }
  } catch (dbError) {
    console.log('⚠️ Ping database error:', dbError.message);
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
  console.log(`🔋 Keep-alive request received at: ${new Date().toISOString()}`);
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
    
    console.log('Export request received:', { traceability_code, lot_letter });
    
    // 1. Fetch data from Supabase - filter by specific form if parameters provided
    let query = supabase.from('inline_inspection_form_master_2').select('*');
    
    if (traceability_code && lot_letter) {
      // Export specific form
      query = query.eq('traceability_code', traceability_code).eq('lot_letter', lot_letter);
      console.log('Filtering by traceability_code and lot_letter:', { traceability_code, lot_letter });
    }
    // If no parameters, export all forms (existing behavior)
    
    const { data, error } = await query;
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).send('Error fetching data');
    }

    console.log('Data fetched:', data ? data.length : 0, 'records');
    if (data && data.length > 0) {
      console.log('First record keys:', Object.keys(data[0]));
      console.log('First record lot_letter:', data[0].lot_letter);
    }

    if (!data || data.length === 0) {
      return res.status(404).send('No data found for the specified form');
    }

    // 2. Load the client's Excel template
    const templatePath = path.join(__dirname, 'templates', 'Inline_inspection_form.xlsx');
    console.log('Template path:', templatePath);
    
    // Check if template file exists
    if (!fs.existsSync(templatePath)) {
      console.error('Template file not found:', templatePath);
      return res.status(500).send('Excel template file not found');
    }
    
    const workbook = new ExcelJS.Workbook();
    try {
    await workbook.xlsx.readFile(templatePath);
      console.log('Template loaded successfully');
    } catch (templateError) {
      console.error('Error loading template:', templateError);
      console.error('Template error details:', templateError.message);
      return res.status(500).send(`Error loading Excel template: ${templateError.message}`);
    }

    // 3. Get the first worksheet (or specify by name if needed)
    console.log('Workbook worksheets count:', workbook.worksheets.length);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      console.error('No worksheets found in template');
      return res.status(500).send('Template worksheet not found');
    }
    console.log('Worksheet found:', worksheet.name);

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
    console.log('Looking for lot_letter:', lot_letter);
    console.log('Available lot_letters in data:', data.map(d => d.lot_letter));
    
    const targetLot = data.find(lot => lot.lot_letter === lot_letter) || data[0];
    
    console.log('Selected targetLot lot_letter:', targetLot?.lot_letter);
    
    // Debug: Log the target lot data to see what fields are available
    console.log('Target lot data:', JSON.stringify(targetLot, null, 2));
    console.log('Target lot prod_code:', targetLot?.prod_code);
    console.log('Target lot shift:', targetLot?.shift);
    console.log('Target lot traceability_code:', targetLot?.traceability_code);
    console.log('Target lot lot_letter:', targetLot?.lot_letter);
    console.log('Target lot inspected_by:', targetLot?.inspected_by);
    console.log('Target lot inspected_by type:', typeof targetLot?.inspected_by);
    
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
            
            console.log('  Found header data from other forms with same lot_letter:', {
              customer, production_no, prod_code, spec, shift, mc_no, emboss_type
            });
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
      
      // Debug: Log what header data we're using
      console.log('Header mapping debug:');
      console.log('  customer:', customer);
      console.log('  production_no:', production_no);
      console.log('  prod_code:', prod_code);
      console.log('  spec:', spec);
      console.log('  shift:', shift);
      console.log('  mc_no:', mc_no);
      console.log('  emboss_type:', emboss_type);
      console.log('  printed:', printed);
      console.log('  non_printed:', non_printed);
      console.log('  ct:', ct);
      console.log('  year:', year);
      console.log('  month:', month);
      console.log('  date:', date);
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
            console.log('Inspected by data:', lot.inspected_by);
            console.log('Split names:', names);
            console.log('First name:', names[0]?.trim());
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
            console.log('Second name:', names[1]?.trim());
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
          
          // Common fields for all rows
          worksheet.getCell(`F${currentRow}`).value = rollWeight;
          worksheet.getCell(`G${currentRow}`).value = rollWidth;
          worksheet.getCell(`H${currentRow}`).value = filmWeightGsm;
          worksheet.getCell(`I${currentRow}`).value = thickness;
          worksheet.getCell(`J${currentRow}`).value = rollDia;
          worksheet.getCell(`K${currentRow}`).value = paperCoreId;
          worksheet.getCell(`L${currentRow}`).value = paperCoreOd;
          
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

    // 8. Add Page1 summary
    worksheet.getCell('L84').value = page1Summary.accepted_rolls;
    worksheet.getCell('N84').value = page1Summary.accepted_weight;
    worksheet.getCell('L85').value = page1Summary.rejected_rolls;
    worksheet.getCell('N85').value = page1Summary.rejected_weight;
    worksheet.getCell('L86').value = page1Summary.rework_rolls;
    worksheet.getCell('N86').value = page1Summary.rework_weight;
    worksheet.getCell('L87').value = page1Summary.kiv_rolls;
    worksheet.getCell('N87').value = page1Summary.kiv_weight;
    worksheet.getCell('L88').value = page1Summary.accepted_rolls + page1Summary.rejected_rolls + page1Summary.rework_rolls + page1Summary.kiv_rolls;
    worksheet.getCell('N88').value = page1Summary.accepted_weight + page1Summary.rejected_weight + page1Summary.rework_weight + page1Summary.kiv_weight;

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
              
              // Common fields for all rows
              page2Worksheet.getCell(`F${page2CurrentRow}`).value = rollWeight;
              page2Worksheet.getCell(`G${page2CurrentRow}`).value = rollWidth;
              page2Worksheet.getCell(`H${page2CurrentRow}`).value = filmWeightGsm;
              page2Worksheet.getCell(`I${page2CurrentRow}`).value = thickness;
              page2Worksheet.getCell(`J${page2CurrentRow}`).value = rollDia;
              page2Worksheet.getCell(`K${page2CurrentRow}`).value = paperCoreId;
              page2Worksheet.getCell(`L${page2CurrentRow}`).value = paperCoreOd;
              
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
              
              // Inspected By - already handled above for first and second rows
              
              page2CurrentRow++;
            }
          });
          
          // Add empty row between lots (except after the last lot)
          if (lotIndex < page2Lots.length - 1 && page2CurrentRow <= DATA_END_ROW) {
            page2CurrentRow++;
          }
        });

        // Add Page2 summary
        page2Worksheet.getCell('L84').value = page2Summary.accepted_rolls;
        page2Worksheet.getCell('N84').value = page2Summary.accepted_weight;
        page2Worksheet.getCell('L85').value = page2Summary.rejected_rolls;
        page2Worksheet.getCell('N85').value = page2Summary.rejected_weight;
        page2Worksheet.getCell('L86').value = page2Summary.rework_rolls;
        page2Worksheet.getCell('N86').value = page2Summary.rework_weight;
        page2Worksheet.getCell('L87').value = page2Summary.kiv_rolls;
        page2Worksheet.getCell('N87').value = page2Summary.kiv_weight;
        page2Worksheet.getCell('L88').value = page2Summary.accepted_rolls + page2Summary.rejected_rolls + page2Summary.rework_rolls + page2Summary.kiv_rolls;
        page2Worksheet.getCell('N88').value = page2Summary.accepted_weight + page2Summary.rejected_weight + page2Summary.rework_weight + page2Summary.kiv_weight;

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
              
              // Common fields for all rows
              page3Worksheet.getCell(`F${page3CurrentRow}`).value = rollWeight;
              page3Worksheet.getCell(`G${page3CurrentRow}`).value = rollWidth;
              page3Worksheet.getCell(`H${page3CurrentRow}`).value = filmWeightGsm;
              page3Worksheet.getCell(`I${page3CurrentRow}`).value = thickness;
              page3Worksheet.getCell(`J${page3CurrentRow}`).value = rollDia;
              page3Worksheet.getCell(`K${page3CurrentRow}`).value = paperCoreId;
              page3Worksheet.getCell(`L${page3CurrentRow}`).value = paperCoreOd;
              
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

        // Add Page3 summary
        page3Worksheet.getCell('L84').value = page3Summary.accepted_rolls;
        page3Worksheet.getCell('N84').value = page3Summary.accepted_weight;
        page3Worksheet.getCell('L85').value = page3Summary.rejected_rolls;
        page3Worksheet.getCell('N85').value = page3Summary.rejected_weight;
        page3Worksheet.getCell('L86').value = page3Summary.rework_rolls;
        page3Worksheet.getCell('N86').value = page3Summary.rework_weight;
        page3Worksheet.getCell('L87').value = page3Summary.kiv_rolls;
        page3Worksheet.getCell('N87').value = page3Summary.kiv_weight;
        page3Worksheet.getCell('L88').value = page3Summary.accepted_rolls + page3Summary.rejected_rolls + page3Summary.rework_rolls + page3Summary.kiv_rolls;
        page3Worksheet.getCell('N88').value = page3Summary.accepted_weight + page3Summary.rejected_weight + page3Summary.rework_weight + page3Summary.kiv_weight;

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
    
    // Store original product code for filename (with Jeddah)
    let originalProdCodeForFilename = prodCode;
    
    // Remove extra spaces around "(Jeddah)" for filename (e.g., "APE-168(18)C (Jeddah)" → "APE-168(18)C(Jeddah)")
    if (originalProdCodeForFilename.toLowerCase().includes('jeddah')) {
      originalProdCodeForFilename = originalProdCodeForFilename.replace(/\s*\(([^)]*jeddah[^)]*)\)/gi, '($1)').trim();
      console.log('🧹 Cleaned filename product code spacing:', prodCode, '→', originalProdCodeForFilename);
    }
    
    // Clean product code by removing "(Jeddah)" part if present (for Excel content only)
    if (prodCode.toLowerCase().includes('jeddah')) {
      // Remove "(Jeddah)" or "(JEDDAH)" or any case variation
      prodCode = prodCode.replace(/\s*\([^)]*jeddah[^)]*\)/gi, '').trim();
      console.log('🧹 Cleaned product code from "Jeddah":', targetLot.prod_code || '', '→', prodCode);
    }
    
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
          console.log('  Found prod_code from other forms:', prodCode);
          
          // Update original product code for filename if we found it from other forms
          originalProdCodeForFilename = prodCode;
          
          // Remove extra spaces around "(Jeddah)" for filename from other forms too
          if (originalProdCodeForFilename.toLowerCase().includes('jeddah')) {
            originalProdCodeForFilename = originalProdCodeForFilename.replace(/\s*\(([^)]*jeddah[^)]*)\)/gi, '($1)').trim();
            console.log('🧹 Cleaned filename product code spacing from other forms:', prodCode, '→', originalProdCodeForFilename);
          }
          
          // Clean the retrieved product code by removing "(Jeddah)" part if present (for Excel content only)
          if (prodCode.toLowerCase().includes('jeddah')) {
            // Remove "(Jeddah)" or "(JEDDAH)" or any case variation
            const originalProdCode = prodCode;
            prodCode = prodCode.replace(/\s*\([^)]*jeddah[^)]*\)/gi, '').trim();
            console.log('🧹 Cleaned product code from other forms: "Jeddah" removed:', originalProdCode, '→', prodCode);
          }
        } else {
          prodCode = 'PROD-CODE'; // Default value
          console.log('  No prod_code found in other forms, using default');
        }
      } catch (err) {
        console.log('  Error searching for prod_code in other forms:', err.message);
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
          console.log('  Found shift from other forms:', shiftNumber);
        } else {
          shiftNumber = '1'; // Default to shift 1
          console.log('  No shift found in other forms, using default');
        }
      } catch (err) {
        console.log('  Error searching for shift in other forms:', err.message);
        shiftNumber = '1'; // Default value
      }
    }
    
    // Debug: Log the values being used for filename
    console.log('Filename generation debug:');
    console.log('  targetLot.traceability_code:', targetLot.traceability_code);
    console.log('  targetLot.lot_letter:', targetLot.lot_letter);
    console.log('  prodCode:', prodCode);
    console.log('  shiftNumber:', shiftNumber);
    console.log('  targetLot object keys:', Object.keys(targetLot));
    console.log('  header_data keys:', targetLot.header_data ? Object.keys(targetLot.header_data) : 'null');
    if (targetLot.header_data) {
      console.log('  header_data.prod_code:', targetLot.header_data.prod_code);
      console.log('  header_data.shift:', targetLot.header_data.shift);
    }
    
    // Convert shift number to letter
    let shiftLetter = '';
    if (shiftNumber === '1' || shiftNumber === 1) shiftLetter = 'A';
    else if (shiftNumber === '2' || shiftNumber === 2) shiftLetter = 'B';
    else if (shiftNumber === '3' || shiftNumber === 3) shiftLetter = 'C';
    else shiftLetter = shiftNumber; // Keep original if not 1, 2, or 3
    
    console.log('  shiftLetter:', shiftLetter);
    
    // Create filename with format: ILIF-trace code-prod code-Shift-A-B-C.xlsx
    // Use original product code (with Jeddah) for filename
    const filename = `ILIF-${targetLot.traceability_code}-${originalProdCodeForFilename}-Shift-${shiftLetter}.xlsx`;
    
    console.log('Generated filename:', filename); // Debug log
    
    // 12. Send the buffer as a response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    console.log('Content-Disposition header set:', `attachment; filename="${filename}"`); // Debug log
    res.send(buffer);

  } catch (error) {
    console.error('Error exporting inspection report:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting inspection report: ${error.message}`);
  }
});

// 16 GSM Kranti Excel Export Endpoint
app.get('/export-16gsm-kranti', async (req, res) => {
  try {
    // Get form_id parameter
    const { form_id } = req.query;
    
    console.log('16 GSM Kranti export request received:', { form_id });
    
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

    console.log('Data fetched successfully:', data);

    // 2. Load the 16 GSM Kranti Excel template
    const templatePath = path.join(__dirname, 'templates', 'APE-168(16)CP(KRANTI).xlsx');
    console.log('Template path:', templatePath);
    
    // Check if template file exists
    if (!fs.existsSync(templatePath)) {
      console.error('Template file not found:', templatePath);
      return res.status(500).send('Excel template file not found');
    }
    
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.readFile(templatePath);
      console.log('16 GSM Kranti template loaded successfully');
    } catch (templateError) {
      console.error('Error loading template:', templateError);
      return res.status(500).send(`Error loading Excel template: ${templateError.message}`);
    }

    // 3. Get the first worksheet
    const worksheet = workbook.worksheets[0];
    console.log('Worksheet name:', worksheet.name);

    // 4. Map the data to Excel cells - MANUAL COLUMN MAPPING
    console.log('Starting manual column mapping...');

    // Basic Information Section
    worksheet.getCell('B2').value = data.product_code || ''; // Product Code
    worksheet.getCell('B3').value = data.production_order || ''; // Production Order
    worksheet.getCell('B4').value = data.machine_no || ''; // Machine No
    worksheet.getCell('B5').value = formatDateToDDMMYYYY(data.production_date); // Production Date
    worksheet.getCell('B6').value = formatDateToDDMMYYYY(data.inspection_date); // Inspection Date
    worksheet.getCell('B7').value = data.specification || ''; // Specification
    worksheet.getCell('B8').value = data.purchase_order || ''; // PO
    worksheet.getCell('B9').value = data.quantity || ''; // Quantity
    worksheet.getCell('B10').value = data.lot_no || ''; // Lot No
    worksheet.getCell('B11').value = data.ref_no || ''; // Ref No
    worksheet.getCell('B12').value = data.customer || ''; // Customer
    worksheet.getCell('B13').value = data.prepared_by || ''; // Prepared By

    // Page 1 Data - Basic Weight, Thickness, Opacity, COF, Cut Width, Color-Delta E
    if (data.page1_basic_weight) {
      const basicWeightData = data.page1_basic_weight;
      let row = 20; // Starting row for data
      
      Object.keys(basicWeightData).forEach(key => {
        if (basicWeightData[key] && basicWeightData[key] !== '') {
          worksheet.getCell(`B${row}`).value = basicWeightData[key];
        }
        row++;
      });
    }

    if (data.page1_thickness) {
      const thicknessData = data.page1_thickness;
      let row = 20; // Starting row for data
      
      Object.keys(thicknessData).forEach(key => {
        if (thicknessData[key] && thicknessData[key] !== '') {
          worksheet.getCell(`C${row}`).value = thicknessData[key];
        }
        row++;
      });
    }

    if (data.page1_opacity) {
      const opacityData = data.page1_opacity;
      let row = 20; // Starting row for data
      
      Object.keys(opacityData).forEach(key => {
        if (opacityData[key] && opacityData[key] !== '') {
          worksheet.getCell(`D${row}`).value = opacityData[key];
        }
        row++;
      });
    }

    if (data.page1_cof_kinetic) {
      const cofData = data.page1_cof_kinetic;
      let row = 20; // Starting row for data
      
      Object.keys(cofData).forEach(key => {
        if (cofData[key] && cofData[key] !== '') {
          worksheet.getCell(`E${row}`).value = cofData[key];
        }
        row++;
      });
    }

    if (data.page1_cut_width) {
      const cutWidthData = data.page1_cut_width;
      let row = 20; // Starting row for data
      
      Object.keys(cutWidthData).forEach(key => {
        if (cutWidthData[key] && cutWidthData[key] !== '') {
          worksheet.getCell(`F${row}`).value = cutWidthData[key];
        }
        row++;
      });
    }

    if (data.page1_color_delta_unprinted) {
      const colorDeltaUnprintedData = data.page1_color_delta_unprinted;
      let row = 20; // Starting row for data
      
      Object.keys(colorDeltaUnprintedData).forEach(key => {
        if (colorDeltaUnprintedData[key] && colorDeltaUnprintedData[key] !== '') {
          worksheet.getCell(`G${row}`).value = colorDeltaUnprintedData[key];
        }
        row++;
      });
    }

    if (data.page1_color_delta_printed) {
      const colorDeltaPrintedData = data.page1_color_delta_printed;
      let row = 20; // Starting row for data
      
      Object.keys(colorDeltaPrintedData).forEach(key => {
        if (colorDeltaPrintedData[key] && colorDeltaPrintedData[key] !== '') {
          worksheet.getCell(`H${row}`).value = colorDeltaPrintedData[key];
        }
        row++;
      });
    }

    // Sheet 1 - Lot & Roll data mapping (A8 to A37)
    if (data.lot_and_roll) {
      const lotAndRollData = data.lot_and_roll;
      let row = 8; // Starting from A8
      
      Object.keys(lotAndRollData).forEach(key => {
        if (lotAndRollData[key] && lotAndRollData[key] !== '' && row <= 37) {
          worksheet.getCell(`A${row}`).value = lotAndRollData[key];
          row++;
        }
      });
    }

    // Sheet 1 - Roll ID data mapping (B8 to B37)
    if (data.roll_id) {
      const rollIdData = data.roll_id;
      let row = 8; // Starting from B8
      
      Object.keys(rollIdData).forEach(key => {
        if (rollIdData[key] && rollIdData[key] !== '' && row <= 37) {
          worksheet.getCell(`B${row}`).value = rollIdData[key];
          row++;
        }
      });
    }

    // Sheet 1 - Lot Time data mapping (C8 to C37)
    if (data.lot_time) {
      const lotTimeData = data.lot_time;
      let row = 8; // Starting from C8
      
      Object.keys(lotTimeData).forEach(key => {
        if (lotTimeData[key] && lotTimeData[key] !== '' && row <= 37) {
          worksheet.getCell(`C${row}`).value = lotTimeData[key];
          row++;
        }
      });
    }

    console.log('Data mapping completed successfully');

    // 5. Set response headers for Excel download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="16GSM-KRANTI-${data.lot_no || 'FORM'}.xlsx"`);

    // 6. Write the workbook to response
    await workbook.xlsx.write(res);
    console.log('16 GSM Kranti Excel file generated and sent successfully');

  } catch (error) {
    console.error('Error exporting 16 GSM Kranti report:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting 16 GSM Kranti report: ${error.message}`);
  }
});

// Helper function to format date to DD/MM/YYYY
function formatDateToDDMMYYYY(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

app.listen(PORT, () => {
  console.log(`🚀 Swanson India Portal Backend Server Started!`);
  console.log(`📡 Server listening on port ${PORT}`);
  console.log(`⏰ Enhanced keep-alive system active - preventing cold starts`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Ping endpoint: http://localhost:${PORT}/ping`);
  console.log(`🔋 Keep-alive endpoint: http://localhost:${PORT}/keep-alive`);
  console.log(`📊 Excel export: http://localhost:${PORT}/export`);
  console.log(`📊 16 GSM Kranti Excel export: http://localhost:${PORT}/export-16gsm-kranti`);
  console.log(`🔄 Client-side keep-alive also active for redundancy`);
  
  // Immediate warm-up to prevent cold starts
  setTimeout(() => {
    console.log('🔥 Immediate server warm-up initiated');
    // Warm up critical endpoints immediately
    fetch(`http://localhost:${PORT}/ping`).catch(() => {});
    fetch(`http://localhost:${PORT}/health`).catch(() => {});
    console.log('✅ Server warm-up completed');
  }, 1000);
}); 