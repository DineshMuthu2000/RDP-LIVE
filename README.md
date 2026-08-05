# Windows PowerShell RDP Manager with Enterprise License Suite

A production-ready enterprise Remote Desktop Protocol (RDP) management solution consisting of a **Windows PowerShell GUI Client**, a **Node.js + Express + SQLite Backend**, and a modern **React + Vite Web Admin Dashboard**.

---

## 🌟 Suite Overview

| Module | Technology | Description |
|--------|------------|-------------|
| **PowerShell RDP Client** | Windows PowerShell 5.1+, WinForms, UIAutomation | Multi-window auto-grid alignment, password auto-paste, HWID fingerprinting & license check |
| **Backend REST API** | Node.js, Express.js, SQLite, JWT | MVC architecture, admin authentication, SQLite auto-migration, input validation, error handling |
| **Web Admin Dashboard** | React 18, Vite, Lucide Icons, Modern CSS | Real-time metric stats, license generation, device allocation audit, remote enable/disable, search & filter |

---

## 📁 Repository Structure

```
RDP-Manager-Suite/
├── backend/                  # Node.js + Express REST API
│   ├── data/                 # SQLite database storage (database.sqlite)
│   ├── src/
│   │   ├── config/           # SQLite connection pool & table schemas
│   │   ├── controllers/      # Admin Auth & License business logic
│   │   ├── middlewares/      # JWT auth, Zod validation, error handler
│   │   ├── models/           # Database models & SQL queries
│   │   ├── routes/           # Auth and License REST endpoints
│   │   └── utils/            # License key generator & date helpers
│   ├── .env.example          # Backend environment template
│   ├── package.json
│   └── README.md
├── dashboard/                # React 18 + Vite Web Admin Dashboard
│   ├── src/
│   │   ├── components/       # Navbar, StatCard, LicenseTable, LicenseModal, DevicesModal
│   │   ├── context/          # JWT Session & AuthContext
│   │   ├── pages/            # LoginPage & DashboardPage
│   │   ├── services/         # API fetch service
│   │   └── index.css         # Dark glassmorphic design system
│   ├── package.json
│   └── vite.config.js        # Vite dev server with /api backend proxy
├── RDP_Ultimate.ps1          # Enterprise Windows PowerShell GUI Application
├── Launch_RDP_Ultimate.bat   # Batch launcher for PowerShell client
├── package.json              # Root project convenience scripts
├── .gitignore                # Git ignore rules
└── README.md                 # Complete documentation
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **PowerShell**: Windows PowerShell 5.1 or PowerShell 7+

---

### Step 1: Start the Backend REST API

1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create environment file:
   ```bash
   cp .env.example .env
   ```
4. Start the backend server:
   ```bash
   npm start
   # Or for development with auto-reload:
   npm run dev
   ```
   *The backend will initialize `data/database.sqlite` with a default admin (`admin` / `Admin@123456`) and run on `http://localhost:5000`.*

---

### Step 2: Start the Web Admin Dashboard

1. Open a new terminal and navigate to `dashboard`:
   ```bash
   cd dashboard
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```
5. Log in using default credentials:
   - **Username**: `admin`
   - **Password**: `Admin@123456`

---

### Step 3: Run the PowerShell RDP Manager Client

1. Open PowerShell on Windows and navigate to the project root directory.
2. Launch the script:
   ```powershell
   .\RDP_Ultimate.ps1
   ```
   *(Or double-click `Launch_RDP_Ultimate.bat`)*

3. **License Activation**:
   - On first startup, the client will generate a hardware fingerprint (`HWID`) and prompt for a License Key (`RDP-XXXX-XXXX-XXXX-XXXX`).
   - Create a License Key from the Web Admin Dashboard (`http://localhost:3000`) and paste it into the prompt.
   - Upon successful activation, credentials are saved locally (`license.dat`), and the main RDP manager interface launches.

---

## 🔐 Key Features & Security

- **Hardware ID Binding**: Prevents unauthorized key sharing by binding activations to unique CPU + BaseBoard serial fingerprints.
- **PC Slot Enforcement**: Limits activations per key according to configured `max_pcs`.
- **Subscription Expiry**: Supports time-limited (e.g. 30 days) and lifetime licenses.
- **Offline Grace Period**: Allows client execution for up to 48 hours if the backend license server is temporarily unreachable.
- **Remote Revocation**: Admins can instantly disable keys or delete activations from the Web Dashboard.

---

## 📡 REST API Reference

### Authentication
- `POST /api/auth/login`: Admin login & returns JWT token.
- `GET /api/auth/me`: Validates session & returns admin profile.

### Client Endpoints (Unprotected)
- `POST /api/licenses/activate`: Activates license key on a hardware device (`hwid`, `computer_name`, `ip_address`).
- `POST /api/licenses/validate`: Validates an active device session (`hwid`, `key`).
- `POST /api/licenses/deactivate`: Deactivates a device slot.

### Admin Endpoints (Requires `Bearer <JWT_TOKEN>`)
- `POST /api/licenses`: Generate a new license key.
- `GET /api/licenses`: List all keys (supports `search` & `status` filters).
- `GET /api/licenses/:id`: Get detailed license metadata and activation history.
- `PATCH /api/licenses/:id/status`: Toggle license status (`active` / `disabled`).
- `PUT /api/licenses/:id`: Update license details (customer name, email, PC limit, expiry date).
- `DELETE /api/licenses/:id`: Remove license and its activation records.

---

## ⚙️ Environment Variables (`backend/.env`)

```env
PORT=5000
NODE_ENV=development
JWT_SECRET=super_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=24h
DB_PATH=./data/database.sqlite
DEFAULT_ADMIN_USER=admin
DEFAULT_ADMIN_PASS=Admin@123456
```

---

## 📜 License & Copyright

Designed for enterprise RDP management and administration.
