const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Load environment variables from .env file (only in development)
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

// Adobe PDF Services SDK
const {
    ServicePrincipalCredentials,
    PDFServices,
    MimeType,
    CreatePDFJob,
    CreatePDFResult
} = require("@adobe/pdfservices-node-sdk");

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for conversion uploads - use system temp dir to avoid triggering dev tool refreshes
const uploadDir = path.join(os.tmpdir(), 'swanson-uploads');
try {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log('Created upload directory:', uploadDir);
    }
} catch (error) {
    console.error('Failed to create upload directory:', error);
}
const upload = multer({ 
    dest: uploadDir,
    limits: {
        fileSize: 30 * 1024 * 1024 // 30MB limit
    }
});

// CORS configuration for frontend - production URLs and local development
app.use(cors({
  origin: [
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://127.0.0.1:5501',
    'http://localhost:5501',
    'http://127.0.0.1:5502',
    'http://localhost:5502',
    'http://127.0.0.1:5503',
    'http://localhost:5503',
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

// Helper function to create authenticated Supabase client from JWT
function createAuthenticatedSupabaseClient(req) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split('Bearer ')[1];

  if (!token) {
    // Fallback to anon client if no token
    return supabase;
  }

  // Create a new client with user's JWT token
  return createClient(
    process.env.SUPABASE_URL || 'https://ufczydnvscaicygwlmhz.supabase.co',
    process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmY3p5ZG52c2NhaWN5Z3dsbWh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTg5NDYsImV4cCI6MjA1OTc5NDk0Nn0.0TUriXYvPuml-Jzr9v1jvcuzKjh-cZgnZhYKkQEj3t0',
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    }
  );
}

// Endpoint to convert Word to PDF using Adobe PDF Services API
// Note: On Vercel, depending on routing/rewrites, the function may receive the path
// with or without the `/api` prefix. We register both to avoid 404s in production.
async function convertToPdfHandler(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  let readStream;
  try {
        // Load Adobe credentials from environment variables (required for both dev and prod)
        if (!process.env.ADOBE_CLIENT_ID || !process.env.ADOBE_CLIENT_SECRET) {
            return res.status(500).json({
                error: 'Adobe PDF Services configuration missing',
                details: 'ADOBE_CLIENT_ID and ADOBE_CLIENT_SECRET environment variables are required'
            });
        }

        const credentials = new ServicePrincipalCredentials({
            clientId: process.env.ADOBE_CLIENT_ID,
            clientSecret: process.env.ADOBE_CLIENT_SECRET
        });

        // Create PDF Services instance
        const pdfServices = new PDFServices({ credentials });

        // Validate file extension and set correct MIME type first
        const fileExt = path.extname(req.file.originalname).toLowerCase();
        let mimeType;
        if (fileExt === '.docx') {
            mimeType = MimeType.DOCX;
        } else if (fileExt === '.doc') {
            mimeType = MimeType.DOC;  // Use DOC for .doc files
        } else {
            return res.status(400).json({
                error: 'Unsupported file type',
                details: 'Only .doc and .docx files are supported for PDF conversion'
            });
        }

        // Read the uploaded Word file
        if (!fs.existsSync(req.file.path)) {
            throw new Error(`Uploaded file not found: ${req.file.path}`);
        }
        readStream = fs.createReadStream(req.file.path);
        
        // Create an Asset from the read stream
        const inputAsset = await pdfServices.upload({
            readStream,
            mimeType
        });

        // Create a new CreatePDF job
        const job = new CreatePDFJob({ inputAsset });

        // Submit the job and get polling URL
        const pollingURL = await pdfServices.submit({ job });
        
        // Get the job result
        const pdfServicesResponse = await pdfServices.getJobResult({
            pollingURL,
            resultType: CreatePDFResult
        });

        // Check if the job was successful
        if (pdfServicesResponse.result === null) {
            throw new Error('PDF conversion failed - no result returned from Adobe');
        }

        // Get the resulting PDF asset
        const resultAsset = pdfServicesResponse.result.asset;
        
        // Download the PDF from Adobe
        const outputPath = `${req.file.path}.pdf`;
        const streamAsset = await pdfServices.getContent({ asset: resultAsset });
        
        // The streamAsset has a readStream property (Adobe SDK pattern)
        console.log('Starting PDF file write from Adobe StreamAsset');
        
        return new Promise((resolve, reject) => {
            const outputStream = fs.createWriteStream(outputPath);
            
            // Pipe the Adobe stream asset to the output file
            streamAsset.readStream.pipe(outputStream);
            
            outputStream.on('finish', () => {
                console.log('Adobe PDF conversion completed successfully');
                
                // Send the converted PDF file
                res.sendFile(path.resolve(outputPath), (err) => {
                    if (err) {
                        console.error('Error sending file:', err);
                        reject(err);
                    }
                    // Cleanup: delete both input and output files
                    try {
                        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                    } catch (cleanupError) {
                        console.warn('Cleanup error:', cleanupError);
                    }
                    resolve();
                });
            });
            
            outputStream.on('error', (err) => {
                console.error('Write stream error:', err);
                res.status(500).json({
                    error: 'PDF conversion failed',
                    details: err.message
                });
                // Cleanup
                try {
                    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                } catch (cleanupError) {
                    console.warn('Cleanup error:', cleanupError);
                }
                reject(err);
            });
            
            streamAsset.readStream.on('error', (err) => {
                console.error('Source stream error:', err);
                res.status(500).json({
                    error: 'PDF conversion failed',
                    details: err.message
                });
                try {
                    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                } catch (cleanupError) {
                    console.warn('Cleanup error:', cleanupError);
                }
                reject(err);
            });
        });

    } catch (err) {
        console.error('Adobe PDF conversion error:', err);
        
        // Cleanup on error
        try {
            if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            if (readStream) readStream.destroy();
        } catch (cleanupError) {
            console.warn('Cleanup error:', cleanupError);
        }

        res.status(500).json({
            error: 'PDF conversion failed',
            details: err.message || 'Unknown error occurred'
        });
    }
}

app.post('/api/convert-to-pdf', upload.single('file'), convertToPdfHandler);
app.post('/convert-to-pdf', upload.single('file'), convertToPdfHandler);

// Export handler for Vercel API routes
module.exports.convertToPdfHandler = convertToPdfHandler;
module.exports.upload = upload;

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

// Import export modules
const inlineExportModule = require('./excel-export-inline-inspection-form');
const pgExportModule = require('./excel-export-film-inspection-form-P&G');
const ucExportModule = require('./excel-export-film-inspection-form-UC');
const mjrExportModule = require('./excel-export-MJR-form');
const qualityAlertExportModule = require('./excel-export-quality-alert-form');
const prestoreExportModule = require('./excel-export-prestore-form');
const productionDefectsExportModule = require('./excel-export-production-defects');
const controlDatapointsExportModule = require('./excel-export-control-datapoints');

// Initialize export modules with authenticated client creator
inlineExportModule(app, createAuthenticatedSupabaseClient);
pgExportModule(app, createAuthenticatedSupabaseClient);
ucExportModule(app, createAuthenticatedSupabaseClient);
mjrExportModule(app, createAuthenticatedSupabaseClient);
qualityAlertExportModule(app, createAuthenticatedSupabaseClient);
prestoreExportModule(app, createAuthenticatedSupabaseClient);
productionDefectsExportModule(app, createAuthenticatedSupabaseClient);
controlDatapointsExportModule(app, createAuthenticatedSupabaseClient);

// Export for Vercel serverless functions
module.exports = app;

// Only listen when running locally (not on Vercel)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
}
