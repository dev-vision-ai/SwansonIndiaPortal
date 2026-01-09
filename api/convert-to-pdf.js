// Vercel API Route: /api/convert-to-pdf
// Serverless handler for Word-to-PDF conversion via Adobe PDF Services
const { convertToPdfHandler, upload } = require('../backend/server.js');

export const config = {
  api: {
    bodyParser: false, // multer handles body parsing
  },
};

module.exports = async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Use multer middleware to handle file upload
  return new Promise((resolve, reject) => {
    upload.single('file')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: 'File upload failed', details: err.message });
      }

      // Call the PDF conversion handler
      try {
        await convertToPdfHandler(req, res);
        resolve();
      } catch (error) {
        console.error('PDF conversion error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'PDF conversion failed', details: error.message });
        }
        reject(error);
      }
    });
  });
};
