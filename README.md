# Swanson India Portal

A comprehensive employee management and quality control system for Swanson Plastics India Pvt Ltd.

## 🌟 Features

- **Employee Dashboard**: Centralized employee management interface
- **Quality Control**: Film inspection forms and quality alerts
- **Safety Management**: Safety incident tracking and reporting
- **Production Reports**: Real-time production data and analytics
- **Document Management**: File upload and management system
- **Admin Panel**: Comprehensive administrative controls

## 🚀 Live Demo

**Production URL**: https://swanson-ind-git-aaaf01-swanson-plastics-india-pvt-ltds-projects.vercel.app

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript
- **Backend**: Node.js, Express.js
- **Database**: Supabase (Cloud Database)
- **Deployment**: Vercel
- **File Processing**: Multer, XLSX

## 📁 Project Structure

```
SwansonIndiaPortal/
├── backend/                 # Backend server files
│   ├── server.js           # Main server file
│   ├── package.json        # Backend dependencies
│   └── templates/          # Excel templates
├── public/                 # Frontend files
│   ├── assets/            # Images and media
│   ├── css/               # Stylesheets
│   ├── html/              # HTML pages
│   ├── js/                # JavaScript files
│   └── index.html         # Main entry point
├── documents/             # Project documents
├── templates/             # Additional templates
├── vercel.json           # Vercel configuration
├── package.json          # Root package.json
└── README.md             # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js (>= 18.0.0)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/dev-vision-ai/SwansonIndiaPortal.git
   cd SwansonIndiaPortal
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd backend && npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   ```
   http://localhost:3000
   ```

## 📦 Deployment

### Vercel Deployment

This project is configured for automatic deployment on Vercel. Any push to the main branch will trigger a new deployment.

**Deployment URL**: https://swanson-ind-git-aaaf01-swanson-plastics-india-pvt-ltds-projects.vercel.app

### Manual Deployment

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
NODE_ENV=production
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

### Vercel Configuration

The `vercel.json` file contains:
- Build configuration for Node.js backend
- Static file serving for frontend
- API route handling
- Environment variables

## 📋 Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run build` - Build the project
- `npm run vercel-build` - Vercel build script

## 🎯 Key Features

### Employee Management
- Employee registration and profiles
- Dashboard with personalized views
- Form submission and tracking

### Quality Control
- Film inspection forms
- Quality alerts and notifications
- Statistical reporting

### Safety Management
- Safety incident reporting
- Incident tracking and analysis
- Safety statistics

### Admin Features
- User management
- System configuration
- Data analytics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

**Swanson Plastics India Pvt Ltd**
- Development Team
- Quality Control Team
- Management Team

## 📞 Support

For support and questions, please contact the development team at Swanson Plastics India Pvt Ltd.

---

**Last Updated**: December 2024
**Version**: 1.0.0 