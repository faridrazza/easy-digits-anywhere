# EasyRecord - Register-to-Excel Digitization Portal

A modern web application that helps small shopkeepers and business owners convert handwritten register entries into clean Excel tables using advanced OCR technology.

## 🚀 Features

### Authentication
- **Secure Registration & Login**: Email and password-based authentication using Supabase
- **User Profiles**: Name, email, and password required for account creation
- **Session Management**: Persistent login sessions with automatic token refresh

### OCR Processing
- **Advanced Text Recognition**: Uses Tesseract.js with support for English and Hindi text
- **Intelligent Data Parsing**: Automatically detects table structures and extracts data
- **Bulk Processing**: Process multiple images simultaneously
- **Confidence Scoring**: Shows accuracy confidence for each processed image

### Excel Generation
- **Multiple Export Options**: Create new Excel files or append to existing ones
- **Smart Column Detection**: Automatically organizes data into appropriate columns
- **Multi-sheet Support**: Combine multiple images into separate sheets
- **Professional Formatting**: Auto-sized columns and clean formatting

### User Interface
- **Bilingual Support**: Complete Hindi and English interface
- **Mobile Responsive**: Works seamlessly on all device sizes
- **Modern Design**: Beautiful gradient designs with smooth animations
- **Progress Tracking**: Real-time processing progress indicators

## 🛠️ Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Components**: Shadcn/ui + Tailwind CSS
- **Authentication**: Supabase Auth
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage
- **OCR**: Tesseract.js
- **Excel Processing**: xlsx + file-saver
- **Routing**: React Router v6

## 📦 Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd easy-digits-anywhere
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Create .env.local file with your Supabase credentials
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Start the development server:
```bash
npm run dev
```

## 🔧 Usage

### Getting Started
1. Visit the homepage and click "साइन अप करें / Sign Up"
2. Create an account with your name, email, and password
3. Login to access your personal dashboard

### Processing Images
1. **Upload for OCR Processing**:
   - Go to the OCR Processing section in your dashboard
   - Select one or more images of handwritten registers
   - Wait for processing to complete
   - Review extracted data in the results dialog
   - Download the generated Excel file

2. **Regular File Upload**:
   - Use the Regular Upload section to store files without processing
   - Files are saved to your personal storage for later use

### Excel Features
- **Single Image**: Creates one Excel file with extracted data
- **Multiple Images**: Creates separate sheets for each image
- **Data Validation**: Shows confidence scores and error handling
- **Column Auto-detection**: Automatically organizes data into Date, Item, Quantity, Rate, Amount columns

## 🎯 Key Benefits

- **Time Saving**: Convert weeks of handwritten data in minutes
- **Accuracy**: Advanced OCR with confidence scoring
- **User Friendly**: Simple interface designed for small business owners
- **Affordable**: Cost-effective digital transformation solution
- **Secure**: Private dashboards with encrypted data storage
- **Local Language Support**: Full Hindi and English support

## 🔐 Security Features

- Secure authentication with Supabase
- Individual user data isolation
- Encrypted file storage
- Session management with automatic refresh
- Password requirements and validation

## 📱 Mobile Support

- Fully responsive design
- Touch-friendly interface
- Camera capture support
- Optimized for small screens
- Works on iOS and Android browsers

## 🚀 Deployment

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## 📄 License

This project is licensed under the MIT License.

## 🤝 Support

For support and queries, please contact the development team.

---

**EasyRecord** - Making digital transformation accessible for small businesses across India.
