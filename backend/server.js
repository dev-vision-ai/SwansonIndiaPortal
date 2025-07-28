const express = require('express');
const ExcelJS = require('exceljs');
const path = require('path');
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

// Server-side keep-alive scheduling (IST timezone - 90 min intervals)
let dailyPingCount = 0;
let lastPingDate = null;

function scheduleKeepAlive() {
  const now = new Date();
  const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000)); // Convert to IST (UTC+5:30)
  const istHour = istTime.getHours();
  const istMinute = istTime.getMinutes();
  
  // Custom ping windows (morning, afternoon, evening)
  const pingWindows = [
    { start: 5.5, end: 7, name: 'Morning' },    // 5:30 AM - 7:00 AM
    { start: 13.5, end: 15, name: 'Afternoon' }, // 1:30 PM - 3:00 PM  
    { start: 21.5, end: 23, name: 'Evening' }    // 9:30 PM - 11:00 PM
  ];
  
  // Check if current time is within any ping window
  for (const window of pingWindows) {
    if (istHour >= window.start && istHour < window.end) {
      console.log(`🟢 ${window.name} ping at ${istHour}:${istMinute} IST`);
      return true;
    }
  }
  
  console.log(`🔴 Outside ping windows (${istHour}:${istMinute} IST)`);
  return false;
}

// Check ping windows every 30 minutes
setInterval(() => {
  if (scheduleKeepAlive()) {
    console.log('✅ Server keeping warm during active window');
  }
}, 30 * 60 * 1000); // Every 30 minutes

// Initial check after 30 seconds
setTimeout(() => {
  if (scheduleKeepAlive()) {
    console.log('✅ Initial server warm-up');
  }
}, 30000); // Check after 30 seconds

// Keep-alive endpoint to prevent cold starts
app.get('/ping', (req, res) => {
  res.json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
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
    let query = supabase.from('inline_inspection_form_master').select('*');
    
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
    const templatePath = path.join(__dirname, 'templates', 'Inline_inspection_form.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    // 3. Get the first worksheet (or specify by name if needed)
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
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
    // Map header data from the first lot (all lots share same header info)
    const firstLot = data[0];
    if (firstLot) {
      worksheet.getCell('D5').value = firstLot.customer || '';
      worksheet.getCell('D6').value = firstLot.production_no || '';
      worksheet.getCell('D7').value = firstLot.prod_code || '';
      worksheet.getCell('D8').value = firstLot.spec || '';
      worksheet.getCell('N7').value = firstLot.year || '';
      worksheet.getCell('P7').value = firstLot.month || '';
      worksheet.getCell('R7').value = firstLot.date || '';
      worksheet.getCell('T7').value = firstLot.mc_no || '';
      worksheet.getCell('V7').value = firstLot.shift || '';
      worksheet.getCell('AE6').value = firstLot.production_date ? formatDateToDDMMYYYY(firstLot.production_date) : '';
      worksheet.getCell('AE7').value = firstLot.shift || '';
      worksheet.getCell('AE8').value = firstLot.mc_no || '';
      worksheet.getCell('L6').value = firstLot.printed ? '✔' : '';
      worksheet.getCell('L7').value = firstLot.non_printed ? '✔' : '';
      worksheet.getCell('L8').value = firstLot.ct ? '✔' : '';
      worksheet.getCell('F10').value = firstLot.emboss_type === 'Random' ? '✔' : '';
      worksheet.getCell('I10').value = firstLot.emboss_type === 'Matte' ? '✔' : '';
      worksheet.getCell('L10').value = firstLot.emboss_type === 'Micro' ? '✔' : '';
    }
    
    // Sort lots by lot_no numerically before mapping
    data.sort((a, b) => {
      // Find the lot_no from the first roll in each lot
      const aNo = a.inspection_data && a.inspection_data.rolls && a.inspection_data.rolls[0] ? parseInt(a.inspection_data.rolls[0].lot_no, 10) : 0;
      const bNo = b.inspection_data && b.inspection_data.rolls && b.inspection_data.rolls[0] ? parseInt(b.inspection_data.rolls[0].lot_no, 10) : 0;
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
      if (lot.inspection_data && lot.inspection_data.rolls && Array.isArray(lot.inspection_data.rolls)) {
        const rollsInLot = lot.inspection_data.rolls.length;
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
      if (lot.inspection_data && lot.inspection_data.rolls && Array.isArray(lot.inspection_data.rolls)) {
        // Accumulate summary data for Page1
        if (lot.inspection_data.summary) {
          const summary = lot.inspection_data.summary;
          page1Summary.accepted_rolls += summary.accepted_rolls || 0;
          page1Summary.accepted_weight += summary.accepted_weight || 0;
          page1Summary.rejected_rolls += summary.rejected_rolls || 0;
          page1Summary.rejected_weight += summary.rejected_weight || 0;
          page1Summary.rework_rolls += summary.rework_rolls || 0;
          page1Summary.rework_weight += summary.rework_weight || 0;
          page1Summary.kiv_rolls += summary.kiv_rolls || 0;
          page1Summary.kiv_weight += summary.kiv_weight || 0;
        }
        
        // Map each roll in this lot
        lot.inspection_data.rolls.forEach((roll, rollIndex) => {
          if (currentRow <= DATA_END_ROW) {
            worksheet.getCell(`A${currentRow}`).value = roll.hour || '';
            worksheet.getCell(`B${currentRow}`).value = roll.minute || '';
            worksheet.getCell(`C${currentRow}`).value = roll.lot_no ? roll.lot_no.toString().padStart(2, '0') : '';
            worksheet.getCell(`D${currentRow}`).value = roll.roll_position || '';
            worksheet.getCell(`E${currentRow}`).value = roll.arm || '';
            worksheet.getCell(`F${currentRow}`).value = roll.roll_weight || '';
            worksheet.getCell(`G${currentRow}`).value = roll.roll_width_mm || '';
            worksheet.getCell(`H${currentRow}`).value = roll.film_weight_gsm || '';
            worksheet.getCell(`I${currentRow}`).value = roll.thickness || '';
            worksheet.getCell(`J${currentRow}`).value = roll.roll_dia || '';
            worksheet.getCell(`K${currentRow}`).value = roll.paper_core_dia_id || '';
            worksheet.getCell(`L${currentRow}`).value = roll.paper_core_dia_od || '';
            
            // Film Appearance
            worksheet.getCell(`M${currentRow}`).value = roll.lines_strips || '';
            worksheet.getCell(`N${currentRow}`).value = roll.glossy || '';
            worksheet.getCell(`O${currentRow}`).value = roll.film_color || '';
            worksheet.getCell(`P${currentRow}`).value = roll.pin_hole || '';
            worksheet.getCell(`Q${currentRow}`).value = roll.patch_mark || '';
            worksheet.getCell(`R${currentRow}`).value = roll.odour || '';
            
            // Printing
            worksheet.getCell(`S${currentRow}`).value = roll.ct_appearance || '';
            worksheet.getCell(`T${currentRow}`).value = roll.print_color || '';
            worksheet.getCell(`U${currentRow}`).value = roll.mis_print || '';
            worksheet.getCell(`V${currentRow}`).value = roll.dirty_print || '';
            worksheet.getCell(`W${currentRow}`).value = roll.tape_test || '';
            worksheet.getCell(`X${currentRow}`).value = roll.centralization || '';
            
            // Roll Appearance
            worksheet.getCell(`Y${currentRow}`).value = roll.wrinkles || '';
            worksheet.getCell(`Z${currentRow}`).value = roll.prs || '';
            worksheet.getCell(`AA${currentRow}`).value = roll.roll_curve || '';
            worksheet.getCell(`AB${currentRow}`).value = roll.core_misalignment || '';
            worksheet.getCell(`AC${currentRow}`).value = roll.others || '';
            
            // Accept/Reject
            worksheet.getCell(`AD${currentRow}`).value = roll.accept_reject === 'Accept' ? 'O' : (roll.accept_reject === 'Reject' || roll.accept_reject === 'Rework' ? 'X' : '');
            
            worksheet.getCell(`AE${currentRow}`).value = roll.defect_name || '';
            
            // Inspected By - populate for first roll of each lot
            if (rollIndex === 0) {
              worksheet.getCell(`AF${currentRow}`).value = lot.inspection_data?.inspected_by || lot.inspected_by || '';
            }
            
            currentRow++;
          }
        });
        
        // Add empty row between lots (except after the last lot)
        if (lotIndex < page1Lots.length - 1 && currentRow <= DATA_END_ROW) {
          currentRow++;
        }
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
        // Add header info to Page2
        page2Worksheet.getCell('D5').value = firstLot.customer || '';
        page2Worksheet.getCell('D6').value = firstLot.production_no || '';
        page2Worksheet.getCell('D7').value = firstLot.prod_code || '';
        page2Worksheet.getCell('D8').value = firstLot.spec || '';
        page2Worksheet.getCell('N7').value = firstLot.year || '';
        page2Worksheet.getCell('P7').value = firstLot.month || '';
        page2Worksheet.getCell('R7').value = firstLot.date || '';
        page2Worksheet.getCell('T7').value = firstLot.mc_no || '';
        page2Worksheet.getCell('V7').value = firstLot.shift || '';
        page2Worksheet.getCell('AE6').value = firstLot.production_date ? formatDateToDDMMYYYY(firstLot.production_date) : '';
        page2Worksheet.getCell('AE7').value = firstLot.shift || '';
        page2Worksheet.getCell('AE8').value = firstLot.mc_no || '';
        page2Worksheet.getCell('L6').value = firstLot.printed ? '✔' : '';
        page2Worksheet.getCell('L7').value = firstLot.non_printed ? '✔' : '';
        page2Worksheet.getCell('L8').value = firstLot.ct ? '✔' : '';
        page2Worksheet.getCell('F10').value = firstLot.emboss_type === 'Random' ? '✔' : '';
        page2Worksheet.getCell('I10').value = firstLot.emboss_type === 'Matte' ? '✔' : '';
        page2Worksheet.getCell('L10').value = firstLot.emboss_type === 'Micro' ? '✔' : '';

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
          if (lot.inspection_data && lot.inspection_data.rolls && Array.isArray(lot.inspection_data.rolls)) {
            // Accumulate summary data for Page2
            if (lot.inspection_data.summary) {
              const summary = lot.inspection_data.summary;
              page2Summary.accepted_rolls += summary.accepted_rolls || 0;
              page2Summary.accepted_weight += summary.accepted_weight || 0;
              page2Summary.rejected_rolls += summary.rejected_rolls || 0;
              page2Summary.rejected_weight += summary.rejected_weight || 0;
              page2Summary.rework_rolls += summary.rework_rolls || 0;
              page2Summary.rework_weight += summary.rework_weight || 0;
              page2Summary.kiv_rolls += summary.kiv_rolls || 0;
              page2Summary.kiv_weight += summary.kiv_weight || 0;
            }
            
            // Map each roll in this lot
            lot.inspection_data.rolls.forEach((roll, rollIndex) => {
              if (page2CurrentRow <= DATA_END_ROW) {
                page2Worksheet.getCell(`A${page2CurrentRow}`).value = roll.hour || '';
                page2Worksheet.getCell(`B${page2CurrentRow}`).value = roll.minute || '';
                page2Worksheet.getCell(`C${page2CurrentRow}`).value = roll.lot_no ? roll.lot_no.toString().padStart(2, '0') : '';
                page2Worksheet.getCell(`D${page2CurrentRow}`).value = roll.roll_position || '';
                page2Worksheet.getCell(`E${page2CurrentRow}`).value = roll.arm || '';
                page2Worksheet.getCell(`F${page2CurrentRow}`).value = roll.roll_weight || '';
                page2Worksheet.getCell(`G${page2CurrentRow}`).value = roll.roll_width_mm || '';
                page2Worksheet.getCell(`H${page2CurrentRow}`).value = roll.film_weight_gsm || '';
                page2Worksheet.getCell(`I${page2CurrentRow}`).value = roll.thickness || '';
                page2Worksheet.getCell(`J${page2CurrentRow}`).value = roll.roll_dia || '';
                page2Worksheet.getCell(`K${page2CurrentRow}`).value = roll.paper_core_dia_id || '';
                page2Worksheet.getCell(`L${page2CurrentRow}`).value = roll.paper_core_dia_od || '';
                
                // Film Appearance
                page2Worksheet.getCell(`M${page2CurrentRow}`).value = roll.lines_strips || '';
                page2Worksheet.getCell(`N${page2CurrentRow}`).value = roll.glossy || '';
                page2Worksheet.getCell(`O${page2CurrentRow}`).value = roll.film_color || '';
                page2Worksheet.getCell(`P${page2CurrentRow}`).value = roll.pin_hole || '';
                page2Worksheet.getCell(`Q${page2CurrentRow}`).value = roll.patch_mark || '';
                page2Worksheet.getCell(`R${page2CurrentRow}`).value = roll.odour || '';
                
                // Printing
                page2Worksheet.getCell(`S${page2CurrentRow}`).value = roll.ct_appearance || '';
                page2Worksheet.getCell(`T${page2CurrentRow}`).value = roll.print_color || '';
                page2Worksheet.getCell(`U${page2CurrentRow}`).value = roll.mis_print || '';
                page2Worksheet.getCell(`V${page2CurrentRow}`).value = roll.dirty_print || '';
                page2Worksheet.getCell(`W${page2CurrentRow}`).value = roll.tape_test || '';
                page2Worksheet.getCell(`X${page2CurrentRow}`).value = roll.centralization || '';
                
                // Roll Appearance
                page2Worksheet.getCell(`Y${page2CurrentRow}`).value = roll.wrinkles || '';
                page2Worksheet.getCell(`Z${page2CurrentRow}`).value = roll.prs || '';
                page2Worksheet.getCell(`AA${page2CurrentRow}`).value = roll.roll_curve || '';
                page2Worksheet.getCell(`AB${page2CurrentRow}`).value = roll.core_misalignment || '';
                page2Worksheet.getCell(`AC${page2CurrentRow}`).value = roll.others || '';
                
                // Accept/Reject
                page2Worksheet.getCell(`AD${page2CurrentRow}`).value = roll.accept_reject === 'Accept' ? 'O' : (roll.accept_reject === 'Reject' || roll.accept_reject === 'Rework' ? 'X' : '');
                
                page2Worksheet.getCell(`AE${page2CurrentRow}`).value = roll.defect_name || '';
                
                // Inspected By - populate for first roll of each lot
                if (rollIndex === 0) {
                  page2Worksheet.getCell(`AF${page2CurrentRow}`).value = lot.inspection_data?.inspected_by || lot.inspected_by || '';
                }
                
                page2CurrentRow++;
              }
            });
            
            // Add empty row between lots (except after the last lot)
            if (lotIndex < page2Lots.length - 1 && page2CurrentRow <= DATA_END_ROW) {
              page2CurrentRow++;
            }
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
        // Add header info to Page3
        page3Worksheet.getCell('D5').value = firstLot.customer || '';
        page3Worksheet.getCell('D6').value = firstLot.production_no || '';
        page3Worksheet.getCell('D7').value = firstLot.prod_code || '';
        page3Worksheet.getCell('D8').value = firstLot.spec || '';
        page3Worksheet.getCell('N7').value = firstLot.year || '';
        page3Worksheet.getCell('P7').value = firstLot.month || '';
        page3Worksheet.getCell('R7').value = firstLot.date || '';
        page3Worksheet.getCell('T7').value = firstLot.mc_no || '';
        page3Worksheet.getCell('V7').value = firstLot.shift || '';
        page3Worksheet.getCell('AE6').value = firstLot.production_date ? formatDateToDDMMYYYY(firstLot.production_date) : '';
        page3Worksheet.getCell('AE7').value = firstLot.shift || '';
        page3Worksheet.getCell('AE8').value = firstLot.mc_no || '';
        page3Worksheet.getCell('L6').value = firstLot.printed ? '✔' : '';
        page3Worksheet.getCell('L7').value = firstLot.non_printed ? '✔' : '';
        page3Worksheet.getCell('L8').value = firstLot.ct ? '✔' : '';
        page3Worksheet.getCell('F10').value = firstLot.emboss_type === 'Random' ? '✔' : '';
        page3Worksheet.getCell('I10').value = firstLot.emboss_type === 'Matte' ? '✔' : '';
        page3Worksheet.getCell('L10').value = firstLot.emboss_type === 'Micro' ? '✔' : '';

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
          if (lot.inspection_data && lot.inspection_data.rolls && Array.isArray(lot.inspection_data.rolls)) {
            // Accumulate summary data for Page3
            if (lot.inspection_data.summary) {
              const summary = lot.inspection_data.summary;
              page3Summary.accepted_rolls += summary.accepted_rolls || 0;
              page3Summary.accepted_weight += summary.accepted_weight || 0;
              page3Summary.rejected_rolls += summary.rejected_rolls || 0;
              page3Summary.rejected_weight += summary.rejected_weight || 0;
              page3Summary.rework_rolls += summary.rework_rolls || 0;
              page3Summary.rework_weight += summary.rework_weight || 0;
              page3Summary.kiv_rolls += summary.kiv_rolls || 0;
              page3Summary.kiv_weight += summary.kiv_weight || 0;
            }
            
            // Map each roll in this lot
            lot.inspection_data.rolls.forEach((roll, rollIndex) => {
              if (page3CurrentRow <= DATA_END_ROW) {
                page3Worksheet.getCell(`A${page3CurrentRow}`).value = roll.hour || '';
                page3Worksheet.getCell(`B${page3CurrentRow}`).value = roll.minute || '';
                page3Worksheet.getCell(`C${page3CurrentRow}`).value = roll.lot_no ? roll.lot_no.toString().padStart(2, '0') : '';
                page3Worksheet.getCell(`D${page3CurrentRow}`).value = roll.roll_position || '';
                page3Worksheet.getCell(`E${page3CurrentRow}`).value = roll.arm || '';
                page3Worksheet.getCell(`F${page3CurrentRow}`).value = roll.roll_weight || '';
                page3Worksheet.getCell(`G${page3CurrentRow}`).value = roll.roll_width_mm || '';
                page3Worksheet.getCell(`H${page3CurrentRow}`).value = roll.film_weight_gsm || '';
                page3Worksheet.getCell(`I${page3CurrentRow}`).value = roll.thickness || '';
                page3Worksheet.getCell(`J${page3CurrentRow}`).value = roll.roll_dia || '';
                page3Worksheet.getCell(`K${page3CurrentRow}`).value = roll.paper_core_dia_id || '';
                page3Worksheet.getCell(`L${page3CurrentRow}`).value = roll.paper_core_dia_od || '';
                
                // Film Appearance
                page3Worksheet.getCell(`M${page3CurrentRow}`).value = roll.lines_strips || '';
                page3Worksheet.getCell(`N${page3CurrentRow}`).value = roll.glossy || '';
                page3Worksheet.getCell(`O${page3CurrentRow}`).value = roll.film_color || '';
                page3Worksheet.getCell(`P${page3CurrentRow}`).value = roll.pin_hole || '';
                page3Worksheet.getCell(`Q${page3CurrentRow}`).value = roll.patch_mark || '';
                page3Worksheet.getCell(`R${page3CurrentRow}`).value = roll.odour || '';
                
                // Printing
                page3Worksheet.getCell(`S${page3CurrentRow}`).value = roll.ct_appearance || '';
                page3Worksheet.getCell(`T${page3CurrentRow}`).value = roll.print_color || '';
                page3Worksheet.getCell(`U${page3CurrentRow}`).value = roll.mis_print || '';
                page3Worksheet.getCell(`V${page3CurrentRow}`).value = roll.dirty_print || '';
                page3Worksheet.getCell(`W${page3CurrentRow}`).value = roll.tape_test || '';
                page3Worksheet.getCell(`X${page3CurrentRow}`).value = roll.centralization || '';
                
                // Roll Appearance
                page3Worksheet.getCell(`Y${page3CurrentRow}`).value = roll.wrinkles || '';
                page3Worksheet.getCell(`Z${page3CurrentRow}`).value = roll.prs || '';
                page3Worksheet.getCell(`AA${page3CurrentRow}`).value = roll.roll_curve || '';
                page3Worksheet.getCell(`AB${page3CurrentRow}`).value = roll.core_misalignment || '';
                page3Worksheet.getCell(`AC${page3CurrentRow}`).value = roll.others || '';
                
                // Accept/Reject
                page3Worksheet.getCell(`AD${page3CurrentRow}`).value = roll.accept_reject === 'Accept' ? 'O' : (roll.accept_reject === 'Reject' || roll.accept_reject === 'Rework' ? 'X' : '');
                
                page3Worksheet.getCell(`AE${page3CurrentRow}`).value = roll.defect_name || '';
                
                // Inspected By - populate for first roll of each lot
                if (rollIndex === 0) {
                  page3Worksheet.getCell(`AF${page3CurrentRow}`).value = lot.inspection_data?.inspected_by || lot.inspected_by || '';
                }
                
                page3CurrentRow++;
              }
            });
            
            // Add empty row between lots (except after the last lot)
            if (lotIndex < page3Lots.length - 1 && page3CurrentRow <= DATA_END_ROW) {
              page3CurrentRow++;
            }
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
    const productionDate = firstLot.production_date ? formatDateToDDMMYYYY(firstLot.production_date) : '';
    const prodCode = firstLot.prod_code || '';
    const shiftNumber = firstLot.shift || '';
    const customer = firstLot.customer || '';
    const mcNo = firstLot.mc_no || '';
    
    // Convert shift number to letter
    let shiftLetter = '';
    if (shiftNumber === '1') shiftLetter = 'A';
    else if (shiftNumber === '2') shiftLetter = 'B';
    else if (shiftNumber === '3') shiftLetter = 'C';
    else shiftLetter = shiftNumber; // Keep original if not 1, 2, or 3
    
    // Create a simple filename with traceability code and product code
    const filename = `In-Line_Inspection_Form_${firstLot.traceability_code}_${prodCode}.xlsx`;
    
    console.log('Generated filename:', filename); // Debug log
    
    // 12. Send the buffer as a response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    console.log('Content-Disposition header set:', `attachment; filename="${filename}"`); // Debug log
    res.send(buffer);

  } catch (error) {
    console.error('Error exporting inspection report:', error);
    res.status(500).send('Error exporting inspection report');
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
  console.log(`Server listening on port ${PORT}`);
}); 