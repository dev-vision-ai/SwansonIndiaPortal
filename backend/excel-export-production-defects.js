const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

// Constants
const INSPECTION_TABLES = [
  'inline_inspection_form_master_1',
  'inline_inspection_form_master_2',
  'inline_inspection_form_master_3'
];

const CONFIG = {
  CHUNK_SIZE: 2000,
  BATCH_SIZE: 50,
  DATA_START_ROW: 5,
  MAX_ROWS: 70,
  ROLL_POSITIONS: 21,
  ROLL_COLUMNS: ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W'],
  TEMPLATE_PATHS: [
    'templates/total-production-defects.xlsx',
    'templates/total-production-defects/total-production-defects.xlsx'
  ]
};

/**
 * Find template file from candidate paths
 */
function findTemplatePath() {
  for (const relativePath of CONFIG.TEMPLATE_PATHS) {
    const fullPath = path.join(__dirname, relativePath);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

/**
 * Load and validate Excel template
 */
async function loadTemplate(templatePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('No worksheet found in template');
  return { workbook, worksheet };
}

/**
 * Extract filters from query parameters
 */
function parseFilters(query) {
  return {
    fromDate: query.fromDate || null,
    toDate: query.toDate || null,
    productionType: query.productionType || null,
    machine: query.machine || null,
    product: query.product && query.product !== 'all' ? query.product : null,
    shift: query.shift && query.shift !== '' ? query.shift : null
  };
}

/**
 * Extract filters from query parameters for advanced filter
 */
function parseAdvancedFilters(query) {
  return {
    fromDate: query.fromDate || null,
    toDate: query.toDate || null,
    productionType: query.productionType || null,
    machines: query.machines ? query.machines.split(',').map(m => m.trim()) : [], // Array of machines
    product: query.product && query.product !== 'all' ? query.product : null,
    shift: query.shift && query.shift !== '' ? query.shift : null,
    defect: query.defect && query.defect !== '' ? query.defect : null
  };
}

/**
 * Fetch inspection records from all master tables with date/machine filters
 */
async function fetchInspectionRecords(supabase, filters) {
  let allRecords = [];

  for (const table of INSPECTION_TABLES) {
    let offset = 0;
    let hasMore = true;
    let tableRowCount = 0;

    while (hasMore) {
      let query = supabase.from(table).select('*');

      if (filters.fromDate) query = query.gte('production_date', filters.fromDate);
      if (filters.toDate) query = query.lte('production_date', filters.toDate);
      if (filters.machine) query = query.eq('mc_no', filters.machine);

      query = query.range(offset, offset + CONFIG.CHUNK_SIZE - 1);

      const { data: rows, error: err } = await query;

      if (err) {
        // Error fetching records, continue to next table
        hasMore = false;
      } else if (rows?.length > 0) {
        tableRowCount += rows.length;
        rows.forEach(r => { r.table_name = table; });
        allRecords = allRecords.concat(rows);
        hasMore = rows.length === CONFIG.CHUNK_SIZE;
        offset += CONFIG.CHUNK_SIZE;
      } else {
        hasMore = false;
      }
    }
  }

  return allRecords;
}

/**
 * Fetch inspection records from all master tables with date/machine filters (advanced - multiple machines)
 */
async function fetchInspectionRecordsAdvanced(supabase, filters) {
  let allRecords = [];

  for (const table of INSPECTION_TABLES) {
    let offset = 0;
    let hasMore = true;
    let tableRowCount = 0;

    while (hasMore) {
      let query = supabase.from(table).select('*');

      if (filters.fromDate) query = query.gte('production_date', filters.fromDate);
      if (filters.toDate) query = query.lte('production_date', filters.toDate);
      if (filters.machines.length > 0) query = query.in('mc_no', filters.machines); // Multiple machines

      query = query.range(offset, offset + CONFIG.CHUNK_SIZE - 1);

      const { data: rows, error: err } = await query;

      if (err) {
        // Error fetching records, continue to next table
        hasMore = false;
      } else if (rows?.length > 0) {
        tableRowCount += rows.length;
        rows.forEach(r => { r.table_name = table; });
        allRecords = allRecords.concat(rows);
        hasMore = rows.length === CONFIG.CHUNK_SIZE;
        offset += CONFIG.CHUNK_SIZE;
      } else {
        hasMore = false;
      }
    }
  }

  return allRecords;
}

/**
 * Filter records by product, production type, and shift
 */
function filterRecordsByCriteria(records, filters) {
  return records.filter(form => {
    if (filters.product && String(form.prod_code) !== String(filters.product)) return false;
    if (filters.machine && String(form.mc_no) !== String(filters.machine)) return false;
    if (filters.productionType) {
      // Treat NULL as 'Commercial'
      const formProductionType = form.production_type || 'Commercial';
      if (String(formProductionType) !== String(filters.productionType)) return false;
    }
    if (filters.shift && String(form.shift) !== String(filters.shift)) return false;
    return true;
  });
}

/**
 * Filter records by product, production type, shift, and defect (advanced filter)
 */
function filterRecordsByCriteriaAdvanced(records, filters) {
  return records.filter(form => {
    if (filters.product && String(form.prod_code) !== String(filters.product)) return false;
    if (filters.machines.length > 0 && !filters.machines.includes(String(form.mc_no))) return false; // Multiple machines
    if (filters.productionType) {
      // Treat NULL as 'Commercial'
      const formProductionType = form.production_type || 'Commercial';
      if (String(formProductionType) !== String(filters.productionType)) return false;
    }
    if (filters.shift && String(form.shift) !== String(filters.shift)) return false;
    if (filters.defect) {
      // Check if this record has the selected defect in defect_names object
      if (form.defect_names && typeof form.defect_names === 'object') {
        const defectValues = Object.values(form.defect_names);
        const hasDefect = defectValues.some(d => d && String(d).trim() === String(filters.defect).trim());
        if (!hasDefect) return false;
      } else {
        return false; // No defect_names object, can't match defect filter
      }
    }
    return true;
  });
}

/**
 * Fetch all lot records matching the traceability pairs from master records
 */
async function fetchAllLotRecords(supabase, masterRecords) {
  const traceabilityKeys = [...new Set(
    masterRecords.map(f => `${f.traceability_code}-${f.lot_letter}`)
  )];

  let filteredData = [];

  for (let batchStart = 0; batchStart < traceabilityKeys.length; batchStart += CONFIG.BATCH_SIZE) {
    const batchKeys = traceabilityKeys.slice(batchStart, batchStart + CONFIG.BATCH_SIZE);
    const batchNum = Math.ceil((batchStart + 1) / CONFIG.BATCH_SIZE);

    for (const table of INSPECTION_TABLES) {
      const orConditions = batchKeys.map(key => {
        const [tc, ll] = key.split('-');
        return `and(traceability_code.eq.${tc},lot_letter.eq.${ll})`;
      });

      if (orConditions.length === 0) continue;

      const { data: rows, error: err } = await supabase
        .from(table)
        .select('*')
        .or(orConditions.join(','));

      if (err) {
        // Error fetching batch, skip silently
      } else if (rows?.length > 0) {
        filteredData = filteredData.concat(rows);
      }
    }
  }

  return filteredData;
}

/**
 * Aggregate defect data from inspection records
 */
function aggregateDefects(records) {
  const defectMap = {};

  records.forEach(form => {
    if (!form.defect_names || typeof form.defect_names !== 'object') return;

    Object.entries(form.defect_names).forEach(([pos, defectName]) => {
      if (!defectName || !String(defectName).trim()) return;

      const normalizedName = String(defectName).trim();

      if (!defectMap[normalizedName]) {
        defectMap[normalizedName] = {
          totalQty: 0,
          occurrences: Array(CONFIG.ROLL_POSITIONS).fill(0)
        };
      }

      defectMap[normalizedName].totalQty += 1;

      const posNum = parseInt(pos, 10);
      if (!isNaN(posNum) && posNum >= 1 && posNum <= CONFIG.ROLL_POSITIONS) {
        defectMap[normalizedName].occurrences[posNum - 1] += 1;
      }
    });
  });

  return Object.entries(defectMap)
    .filter(([, data]) => data.totalQty > 0)
    .sort(([, a], [, b]) => b.totalQty - a.totalQty);
}

/**
 * Write defect data to worksheet cells
 */
function populateDefectsInWorksheet(worksheet, defectsWithData) {
  for (let i = 0; i < Math.min(defectsWithData.length, CONFIG.MAX_ROWS); i++) {
    const row = CONFIG.DATA_START_ROW + i;
    const [defectName, data] = defectsWithData[i];

    worksheet.getCell(`A${row}`).value = defectName;
    worksheet.getCell(`B${row}`).value = data.totalQty;

    for (let j = 0; j < CONFIG.ROLL_POSITIONS; j++) {
      const col = CONFIG.ROLL_COLUMNS[j];
      worksheet.getCell(`${col}${row}`).value = data.occurrences[j];
    }
  }
}

module.exports = function(app, createAuthenticatedSupabaseClient) {
  app.get('/export-production-defects', async (req, res) => {
    try {
      const supabase = createAuthenticatedSupabaseClient?.(req);
      if (!supabase) {
        return res.status(500).send('Database client not available');
      }

      const filters = parseFilters(req.query || {});

      // 1) Load template
      const templatePath = findTemplatePath();
      if (!templatePath) {
        console.error('Template not found. Checked:', CONFIG.TEMPLATE_PATHS);
        return res.status(500).send('Excel template not found');
      }

      let workbook, worksheet;
      try {
        ({ workbook, worksheet } = await loadTemplate(templatePath));
      } catch (err) {
        console.error('Template load error:', err.message);
        return res.status(500).send('Failed to load template');
      }

      // Write machine label into cell C1 if a specific machine filter is provided
      try {
        if (filters.machine) {
          // Pad machine number to two digits (e.g., '1' -> '01')
          const mcLabel = String(filters.machine).padStart(2, '0');
          // Determine year: prefer fromDate's year if provided, otherwise current year
          let year = new Date().getFullYear();
          if (filters.fromDate) {
            try {
              const d = new Date(filters.fromDate);
              if (!isNaN(d.getTime())) year = d.getFullYear();
            } catch (e) { /* ignore and use current year */ }
          }
          worksheet.getCell('C1').value = `MC#${mcLabel} - ${year}`;
        } else {
          // Clear cell if no machine filter
          worksheet.getCell('C1').value = '';
        }
      } catch (err) {
        // Ignore label write errors
      }

      // Write product label into cell C2: product name or 'All Products'
      try {
        const productLabel = filters.product ? String(filters.product).trim() : 'All Products';
        worksheet.getCell('C2').value = productLabel;
      } catch (err) {
        // Ignore label write errors
      }

      // 2) Fetch inspection records
      const allRecords = await fetchInspectionRecords(supabase, filters);

      // 3) Filter by product/shift
      const masterRecords = filterRecordsByCriteria(allRecords, filters);

      // 4) Fetch ALL lot records for matching traceability pairs
      const filteredData = await fetchAllLotRecords(supabase, masterRecords);

      // 5) Aggregate defects
      const defectsWithData = aggregateDefects(filteredData);

      // 6) Compute totals (match frontend logic) and populate worksheet
      // Compute total produced rolls using same logic as front-end: accepted + rejected + rework + kiv
      let totalProduced = 0;
      let totalRejected = 0;
      filteredData.forEach(form => {
        const acceptedRolls = parseInt(form.accepted_rolls) || 0;
        const rejectedRolls = parseInt(form.rejected_rolls) || 0;
        const reworkRolls = parseInt(form.rework_rolls) || 0;
        const kivRolls = parseInt(form.kiv_rolls) || 0;

        const formTotal = acceptedRolls + rejectedRolls + reworkRolls + kivRolls;
        totalProduced += formTotal;
        totalRejected += (rejectedRolls + reworkRolls + kivRolls);
      });

      try {
        // write total produced rolls to cell B77 as requested
        worksheet.getCell('B77').value = totalProduced;
      } catch (err) {
        // Ignore total write errors
      }

      // 7) Populate defects grid
      populateDefectsInWorksheet(worksheet, defectsWithData);

      // 7) Send response
      const excelBuffer = await workbook.xlsx.writeBuffer();

      // Build dynamic filename based on date range
      const mcPart = filters.machine ? String(filters.machine).padStart(2, '0') : 'All';
      
      // Helper function to format date as dd.mm.yyyy
      const formatDateForFilename = (dateStr) => {
        try {
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return null;
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = d.getFullYear();
          return `${day}.${month}.${year}`;
        } catch (e) {
          return null;
        }
      };

      // Determine year
      let year = new Date().getFullYear();
      if (filters.fromDate) {
        try {
          const d = new Date(filters.fromDate);
          if (!isNaN(d.getTime())) year = d.getFullYear();
        } catch (e) { /* ignore */ }
      }

      // Build date/month part of filename
      let dateRangePart = '';
      if (filters.fromDate && filters.toDate) {
        const fromDate = new Date(filters.fromDate);
        const toDate = new Date(filters.toDate);
        
        // Check if it's a single month (both dates in same month and year)
        if (fromDate.getFullYear() === toDate.getFullYear() && 
            fromDate.getMonth() === toDate.getMonth()) {
          // Single month format: {month name}
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                             'July', 'August', 'September', 'October', 'November', 'December'];
          dateRangePart = monthNames[fromDate.getMonth()];
        } else {
          // Date range format: dd.mm.yyyy to dd.mm.yyyy
          const formattedFrom = formatDateForFilename(filters.fromDate);
          const formattedTo = formatDateForFilename(filters.toDate);
          if (formattedFrom && formattedTo) {
            dateRangePart = `${formattedFrom} to ${formattedTo}`;
          }
        }
      }

      // Sanitize filename components to avoid illegal chars
      const sanitize = s => s.replace(/[\\/:*?"<>|\n\r]/g, '-').trim();
      
      // Build filename: {year}-Total Defects Analysis-MC#{machine}-{date/month}
      const filenameBase = dateRangePart 
        ? `${year}-Total Defects Analysis-MC#${sanitize(mcPart)}-${sanitize(dateRangePart)}`
        : `${year}-Total Defects Analysis-MC#${sanitize(mcPart)}`;
      const filename = `${filenameBase}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      // Expose Content-Disposition so front-end fetch can read the filename
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(Buffer.from(excelBuffer));

    } catch (err) {
      console.error('❌ Unexpected error:', err);
      return res.status(500).send('Internal server error');
    }
  });

  // Advanced filter export route
  app.get('/export-production-defects-advanced', async (req, res) => {
    try {
      const supabase = createAuthenticatedSupabaseClient?.(req);
      if (!supabase) {
        return res.status(500).send('Database client not available');
      }

      const filters = parseAdvancedFilters(req.query || {});

      // 1) Load template
      const templatePath = findTemplatePath();
      if (!templatePath) {
        console.error('Template not found. Checked:', CONFIG.TEMPLATE_PATHS);
        return res.status(500).send('Excel template not found');
      }

      let workbook, worksheet;
      try {
        ({ workbook, worksheet } = await loadTemplate(templatePath));
      } catch (err) {
        console.error('Template load error:', err.message);
        return res.status(500).send('Failed to load template');
      }

      // Write machine label into cell C1 for advanced filters (multiple machines)
      try {
        if (filters.machines.length > 0) {
          if (filters.machines.length === 1) {
            // Single machine - pad to two digits
            const mcLabel = String(filters.machines[0]).padStart(2, '0');
            let year = new Date().getFullYear();
            if (filters.fromDate) {
              try {
                const d = new Date(filters.fromDate);
                if (!isNaN(d.getTime())) year = d.getFullYear();
              } catch (e) { /* ignore and use current year */ }
            }
            worksheet.getCell('C1').value = `MC#${mcLabel} - ${year}`;
          } else {
            // Multiple machines - show as MC#01 + MC#02 + MC#03 - {year} format
            const sortedMachines = filters.machines.map(m => parseInt(m)).sort((a, b) => a - b);
            const machineLabels = sortedMachines.map(m => `MC#${String(m).padStart(2, '0')}`);
            let year = new Date().getFullYear();
            if (filters.fromDate) {
              try {
                const d = new Date(filters.fromDate);
                if (!isNaN(d.getTime())) year = d.getFullYear();
              } catch (e) { /* ignore and use current year */ }
            }
            worksheet.getCell('C1').value = `${machineLabels.join(' + ')} - ${year}`;
          }
        } else {
          // Clear cell if no machine filter
          worksheet.getCell('C1').value = '';
        }
      } catch (err) {
        // Ignore label write errors
      }

      // Write product label into cell C2: product name or 'All Products'
      try {
        const productLabel = filters.product ? String(filters.product).trim() : 'All Products';
        worksheet.getCell('C2').value = productLabel;
      } catch (err) {
        // Ignore label write errors
      }

      // 2) Fetch inspection records (advanced - multiple machines)
      const allRecords = await fetchInspectionRecordsAdvanced(supabase, filters);

      // 3) Filter by product/shift/defect
      const masterRecords = filterRecordsByCriteriaAdvanced(allRecords, filters);

      // 4) Fetch ALL lot records for matching traceability pairs
      const filteredData = await fetchAllLotRecords(supabase, masterRecords);

      // 5) Aggregate defects
      const defectsWithData = aggregateDefects(filteredData);

      // 6) Compute totals (match frontend logic) and populate worksheet
      // Compute total produced rolls using same logic as front-end: accepted + rejected + rework + kiv
      let totalProduced = 0;
      let totalRejected = 0;
      filteredData.forEach(form => {
        const acceptedRolls = parseInt(form.accepted_rolls) || 0;
        const rejectedRolls = parseInt(form.rejected_rolls) || 0;
        const reworkRolls = parseInt(form.rework_rolls) || 0;
        const kivRolls = parseInt(form.kiv_rolls) || 0;

        const formTotal = acceptedRolls + rejectedRolls + reworkRolls + kivRolls;
        totalProduced += formTotal;
        totalRejected += (rejectedRolls + reworkRolls + kivRolls);
      });

      try {
        // write total produced rolls to cell B77 as requested
        worksheet.getCell('B77').value = totalProduced;
      } catch (err) {
        // Ignore total write errors
      }

      // 7) Populate defects grid
      populateDefectsInWorksheet(worksheet, defectsWithData);

      // 8) Send response
      const excelBuffer = await workbook.xlsx.writeBuffer();

      // Build dynamic filename based on date range for advanced filters
      const mcPart = filters.machines.length > 0
        ? (filters.machines.length === 1
           ? String(filters.machines[0]).padStart(2, '0')
           : filters.machines.map(m => String(m).padStart(2, '0')).sort().join('-'))
        : 'All';

      // Helper function to format date as dd.mm.yyyy
      const formatDateForFilename = (dateStr) => {
        try {
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return null;
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = d.getFullYear();
          return `${day}.${month}.${year}`;
        } catch (e) {
          return null;
        }
      };

      // Determine year
      let year = new Date().getFullYear();
      if (filters.fromDate) {
        try {
          const d = new Date(filters.fromDate);
          if (!isNaN(d.getTime())) year = d.getFullYear();
        } catch (e) { /* ignore */ }
      }

      // Build date/month part of filename
      let dateRangePart = '';
      if (filters.fromDate && filters.toDate) {
        const fromDate = new Date(filters.fromDate);
        const toDate = new Date(filters.toDate);

        // Check if it's a single month (both dates in same month and year)
        if (fromDate.getFullYear() === toDate.getFullYear() &&
            fromDate.getMonth() === toDate.getMonth()) {
          // Single month format: {month name}
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                             'July', 'August', 'September', 'October', 'November', 'December'];
          dateRangePart = monthNames[fromDate.getMonth()];
        } else {
          // Date range format: dd.mm.yyyy to dd.mm.yyyy
          const formattedFrom = formatDateForFilename(filters.fromDate);
          const formattedTo = formatDateForFilename(filters.toDate);
          if (formattedFrom && formattedTo) {
            dateRangePart = `${formattedFrom} to ${formattedTo}`;
          }
        }
      }

      // Add defect info to filename if defect filter is applied
      let defectPart = '';
      if (filters.defect) {
        defectPart = `-Defect_${filters.defect.replace(/[^a-zA-Z0-9]/g, '_')}`;
      }

      // Sanitize filename components to avoid illegal chars
      const sanitize = s => s.replace(/[\\/:*?"<>|\n\r]/g, '-').trim();

      // Build filename: {year}-Total Defects Analysis-MC#{machine}{defect}-{date/month}
      const filenameBase = dateRangePart
        ? `${year}-Total Defects Analysis-MC#${sanitize(mcPart)}${defectPart}-${sanitize(dateRangePart)}`
        : `${year}-Total Defects Analysis-MC#${sanitize(mcPart)}${defectPart}`;
      const filename = `${filenameBase}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      // Expose Content-Disposition so front-end fetch can read the filename
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(Buffer.from(excelBuffer));

    } catch (err) {
      console.error('❌ Unexpected error in advanced export:', err);
      return res.status(500).send('Internal server error');
    }
  });
};
