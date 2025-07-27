# Swanson Backend API

This is the backend server for the Swanson India Portal, handling Excel file generation and data processing.

## Features

- Excel file generation from Supabase data
- CORS support for frontend integration
- Environment variable configuration
- Health check endpoint

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables (create `.env` file):
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
FRONTEND_URL=http://localhost:3000
PORT=3000
```

3. Run the server:
```bash
npm start
```

## Render Deployment

1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Configure the following settings:

**Build Command:**
```bash
npm install
```

**Start Command:**
```bash
npm start
```

**Environment Variables:**
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `FRONTEND_URL`: Your Vercel frontend URL (e.g., https://your-app.vercel.app)

## API Endpoints

- `GET /health` - Health check
- `GET /export?traceability_code=...&lot_letter=...` - Export Excel file

## File Structure

```
backend/
├── server.js          # Main server file
├── package.json       # Dependencies
├── templates/         # Excel templates
│   └── Inline_inspection_form.xlsx
└── README.md         # This file
``` 