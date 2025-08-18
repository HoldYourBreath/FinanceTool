# 💸 FinanceTool

A personal finance dashboard built with **Flask** (Python backend) and **React** (Vite + Tailwind) frontend, designed to help you track monthly income, expenses, loan adjustments, and planned purchases.

## 🚀 Features

- ✅ Monthly income and expense tracking with categories
- ✅ Surplus/deficit visualization per month
- ✅ Interactive bar charts with `recharts`
- ✅ Planned purchases section with editable items, dates, and auto-saving
- ✅ PostgreSQL database integration
- ✅ Tailwind CSS styling
- ✅ Fully configurable via `.env`

---

## 📸 Screenshots

### Dashboard Overview  
![Monthly Overview Screenshot](./docs/images/monthly-overview.png)

### Spending Planner  
![Spending Planner Screenshot](./docs/images/spending-planner.png)

---

## 🛠 Technologies Used

- **Frontend**: React, Vite, Tailwind CSS, Recharts
- **Backend**: Flask, SQLAlchemy
- **Database**: PostgreSQL
- **Dev Tools**: dotenv, CORS, Python logging

---

## 📦 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/FinanceTool.git
cd FinanceTool

### 2. Configure Environment Variables
Create .env in the backend directory:

# Flask settings
FLASK_ENV=development
FLASK_DEBUG=True
CORS_ORIGIN=http://localhost:5173

# Database connection
DATABASE_URL=postgresql://postgres:admin@localhost:5432/financial_tracker

# Backend
cd backend
python -m venv venv
.\venv\Scripts\activate
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r requirements.txt

# Start backend server
python app.py

# Frontend
cd ../frontend

vite.config.js
target: "http://localhost:5000",

### 3. Create Python Virtual Environment
python -m venv venv
source venv/bin/activate   # or .\venv\Scripts\activate on Windows

### 6. Install Node.js dependencies
cd frontend
npm install

### 7. Start Frontend Dev Server
npm run dev

### Automatic Setup
.\setup_install.ps1

### Automatic Execution
.\run_dev.ps1

### Execute playwright tests
npx playwright test 

## 📄 License

This project is licensed under the [MIT License](LICENSE).

