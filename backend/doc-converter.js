// Document Converter Module (LibreOffice-based)
// Converts DOCX to PDF using LibreOffice command-line
// Perfect quality, preserves all images and formatting
// Keeps original files in bucket, converts on-the-fly for viewing

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { createClient } = require('@supabase/supabase-js');

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://ufczydnvscaicygwlmhz.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmY3p5ZG52c2NhaWN5Z3dsbWh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTg5NDYsImV4cCI6MjA1OTc5NDk0Nn0.0TUriXYvPuml-Jzr9v1jvcuzKjh-cZgnZhYKkQEj3t0'
);

const BUCKET_NAME = 'dcn-documents';

/**
 * Convert DOCX file to PDF using LibreOffice
 * @param {string} filePath - Path to file in bucket (e.g., 'public/doc.docx')
 * @returns {Promise<Buffer>} PDF buffer
 */
async function convertDocxToPdf(filePath) {
  return new Promise(async (resolve, reject) => {
    try {
      // Download file from Supabase bucket
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .download(filePath);

      if (error) {
        throw new Error(`Failed to download file: ${error.message}`);
      }

      // Create temporary files
      const tmpDir = os.tmpdir();
      const inputPath = path.join(tmpDir, `input_${Date.now()}.docx`);
      const outputDir = path.join(tmpDir, `output_${Date.now()}`);
      const outputPath = path.join(outputDir, `output.pdf`);

      // Create output directory
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Write input file
      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(inputPath, buffer);

      // Run LibreOffice conversion
      const libreoffice = spawn('libreoffice', [
        '--headless',
        '--convert-to', 'pdf',
        '--outdir', outputDir,
        inputPath
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000 // 30 second timeout
      });

      let stdoutData = '';
      let stderrData = '';

      libreoffice.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      libreoffice.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      libreoffice.on('close', (code) => {
        // Cleanup input file
        try {
          fs.unlinkSync(inputPath);
        } catch (e) {
          console.log('Warning: could not delete temp input file');
        }

        if (code !== 0) {
          // Cleanup output directory
          try {
            fs.rmSync(outputDir, { recursive: true });
          } catch (e) {
            console.log('Warning: could not delete temp output directory');
          }
          reject(new Error(`LibreOffice conversion failed (code ${code}): ${stderrData || stdoutData}`));
          return;
        }

        // Read PDF output
        try {
          if (!fs.existsSync(outputPath)) {
            throw new Error('PDF output file was not created');
          }

          const pdfBuffer = fs.readFileSync(outputPath);
          
          // Cleanup output directory
          try {
            fs.rmSync(outputDir, { recursive: true });
          } catch (e) {
            console.log('Warning: could not delete temp output directory');
          }

          resolve(pdfBuffer);
        } catch (err) {
          reject(new Error(`Failed to read PDF output: ${err.message}`));
        }
      });

      libreoffice.on('error', (err) => {
        reject(new Error(`Failed to spawn LibreOffice process: ${err.message}`));
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Register document converter routes on Express app
 * @param {Object} app - Express app instance
 */
function registerDocumentConverterRoutes(app) {
  /**
   * Convert and serve DOCX as PDF
   * GET /api/convert-to-pdf?file=path/to/document.docx
   */
  app.get('/api/convert-to-pdf', async (req, res) => {
    try {
      const { file } = req.query;

      if (!file) {
        return res.status(400).json({
          error: 'Missing file parameter',
          example: '/api/convert-to-pdf?file=public/document.docx'
        });
      }

      // Validate file extension is DOCX
      if (!file.toLowerCase().endsWith('.docx')) {
        return res.status(400).json({
          error: 'Only .docx files are supported for conversion'
        });
      }

      // Convert and stream PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${file.split('/').pop().replace('.docx', '.pdf')}"`
      );

      const pdfBuffer = await convertDocxToPdf(file);
      res.send(pdfBuffer);
    } catch (err) {
      console.error('Conversion endpoint error:', err);
      res.status(500).json({
        error: 'PDF conversion failed',
        message: err.message
      });
    }
  });

  console.log('✅ Document converter routes registered (/api/convert-to-pdf)');
}

module.exports = {
  convertDocxToPdf,
  registerDocumentConverterRoutes
};
