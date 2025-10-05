// @ts-ignore - Deno module not recognized by TypeScript but works at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore - ESM module not recognized by TypeScript but works at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-ignore - ESM module not recognized by TypeScript but works at runtime
import ExcelJS from 'https://esm.sh/exceljs@4.3.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key for database access
    const supabaseClient = createClient(
      'https://ufczydnvscaicygwlmhz.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmY3p5ZG52c2NhaWN5Z3dsbWh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDIxODk0NiwiZXhwIjoyMDU5Nzk0OTQ2fQ.eD8z-UKZMoeBXv0nq8qCAIf7e-tsotP-DMJCgY_DNkM'
    )

    // Get query parameters
    const url = new URL(req.url)
    const traceability_code = url.searchParams.get('traceability_code')
    const lot_letter = url.searchParams.get('lot_letter')

    console.log('Export request:', { traceability_code, lot_letter })

    // Fetch data from Supabase
    let query = supabaseClient.from('inline_inspection_form_master_2').select('*')

    if (traceability_code && lot_letter) {
      query = query.eq('traceability_code', traceability_code).eq('lot_letter', lot_letter)
    }

    const { data, error } = await query
    if (error) {
      console.error('Supabase error:', error)
      return new Response(
        JSON.stringify({ error: 'Error fetching data' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No data found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook()

    // Create worksheet with headers
    const worksheet = workbook.addWorksheet('Inline Inspection Form')

    // Set up headers (matching your template structure)
    worksheet.mergeCells('A1:D1')
    worksheet.getCell('A1').value = 'INLINE INSPECTION FORM'
    worksheet.getCell('A1').font = { bold: true, size: 16 }

    // Add form data headers
    worksheet.getCell('A3').value = 'Customer:'
    worksheet.getCell('B3').value = 'Production No:'
    worksheet.getCell('C3').value = 'Product Code:'
    worksheet.getCell('D3').value = 'Specification:'

    worksheet.getCell('A4').value = 'Machine No:'
    worksheet.getCell('B4').value = 'Shift:'
    worksheet.getCell('C4').value = 'Date:'
    worksheet.getCell('D4').value = 'Time:'

    // Get the target lot (first one or specific one)
    const targetLot = data.find(lot => lot.lot_letter === lot_letter) || data[0]

    // Clean product code (do this outside the if block)
    const prodCodeToCheck = targetLot?.prod_code || ''
    let cleanedProdCode = prodCodeToCheck
    if (prodCodeToCheck.toLowerCase().includes('jeddah')) {
      cleanedProdCode = prodCodeToCheck.replace(/\s*\([^)]*jeddah[^)]*\)/gi, '').trim()
    }

    // Fill header data
    if (targetLot) {
      worksheet.getCell('A5').value = targetLot.customer || ''
      worksheet.getCell('B5').value = targetLot.production_no || ''
      worksheet.getCell('C5').value = cleanedProdCode
      worksheet.getCell('D5').value = targetLot.spec || ''

      worksheet.getCell('A6').value = targetLot.mc_no || ''
      worksheet.getCell('B6').value = targetLot.shift || ''
      worksheet.getCell('C6').value = targetLot.production_date || ''
      worksheet.getCell('D6').value = targetLot.production_time || ''
    }

    // Add inspection data table headers
    worksheet.getCell('A8').value = 'Roll No'
    worksheet.getCell('B8').value = 'Width (mm)'
    worksheet.getCell('C8').value = 'Thickness (micron)'
    worksheet.getCell('D8').value = 'Weight (kg)'
    worksheet.getCell('E8').value = 'Length (m)'
    worksheet.getCell('F8').value = 'Visual Inspection'
    worksheet.getCell('G8').value = 'Remarks'

    // Add inspection data rows
    let rowIndex = 9
    data.forEach((lot, index) => {
      const row = worksheet.getRow(rowIndex + index)

      // Parse inspection data
      let inspectionData = []
      try {
        inspectionData = typeof lot.inspection_data === 'string'
          ? JSON.parse(lot.inspection_data)
          : lot.inspection_data || []
      } catch (e) {
        console.log('Error parsing inspection data:', e)
        inspectionData = []
      }

      inspectionData.forEach((item: any, itemIndex: number) => {
        const itemRow = worksheet.getRow(rowIndex + index + itemIndex)
        itemRow.getCell('A').value = item.roll_no || ''
        itemRow.getCell('B').value = parseFloat(item.width) || 0
        itemRow.getCell('C').value = parseFloat(item.thickness) || 0
        itemRow.getCell('D').value = parseFloat(item.weight) || 0
        itemRow.getCell('E').value = parseFloat(item.length) || 0
        itemRow.getCell('F').value = item.visual_inspection || ''
        itemRow.getCell('G').value = item.remarks || ''
      })
    })

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 15
    })

    // Generate Excel buffer
    const buffer = await workbook.xlsx.writeBuffer()

    // Create filename
    const filename = `ILIF-${targetLot.traceability_code}-${cleanedProdCode}-Shift-${targetLot.shift || 'A'}.xlsx`

    return new Response(buffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })

  } catch (error) {
    console.error('Error in Edge Function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})