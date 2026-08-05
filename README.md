# RDP Manager Backend API

Production-ready Node.js + Express backend service for the Windows PowerShell RDP Manager.

## Features
- **Framework**: Express.js
- **Database**: SQLite3 (Promise-based using `sqlite`)
- **Authentication**: JWT (JSON Web Tokens) with `bcrypt` password hashing
- **Security**: `helmet`, `cors`
- **Validation**: `zod` schema validation middleware
- **Logging**: HTTP request logging (`morgan`) and error handling
- **Architecture**: MVC folder structure

## Folder Structure

```
backend/
├── data/                  # SQLite database directory (auto-created)
├── src/
│   ├── config/            # DB configuration and initialization
│   │   └── db.js
│   ├── controllers/       # Business logic controllers
│   │   └── authController.js
│   ├── middlewares/       # Auth, validation, and error middlewares
│   │   ├── authMiddleware.js
│   │   ├── errorMiddleware.js
│   │   └── validateMiddleware.js
│   ├── models/            # Database models (SQLite queries)
│   │   └── adminModel.js
│   ├── routes/            # REST API endpoints
│   │   └── authRoutes.js
│   ├── app.js             # Express application setup
│   └── server.js          # Entry point
├── .env                   # Environment variables
├── .env.example           # Environment template
└── package.json
```

## Setup & Installation

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env` (or customize the existing `.env`):
   ```bash
   cp .env.example .env
   ```

4. **Start the server:**
   - Development mode (with auto-reload):
     ```bash
     npm run dev
     ```
   - Production mode:
     ```bash
     npm start
     ```

## Default Credentials

Upon initial startup, SQLite database `data/database.sqlite` is automatically initialized with a default admin account:
- **Username**: `admin`
- **Password**: `Admin@123456`

*(Configure via `DEFAULT_ADMIN_USER` and `DEFAULT_ADMIN_PASS` in `.env` before first run).*

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET`  | `/api/health` | Service health check | No |
| `POST` | `/api/auth/login` | Admin login & get JWT token | No |
| `GET`  | `/api/auth/me` | Fetch logged-in admin profile | Yes (`Bearer <token>`) |

### License Management (Client APIs)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/licenses/activate` | Activate license key on PC | No |
| `POST` | `/api/licenses/validate` | Validate license activation on PC | No |
| `POST` | `/api/licenses/deactivate` | Deactivate PC slot | No |

### License Management (Admin APIs)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/licenses` | Create a new license key | Yes (`Bearer <token>`) |
| `GET`  | `/api/licenses` | List all license keys | Yes (`Bearer <token>`) |
| `GET`  | `/api/licenses/:id` | Get license details & activations | Yes (`Bearer <token>`) |
| `PATCH`| `/api/licenses/:id/status` | Enable / Disable a license key | Yes (`Bearer <token>`) |
| `PUT`  | `/api/licenses/:id` | Update license details | Yes (`Bearer <token>`) |
| `DELETE`| `/api/licenses/:id` | Delete license & activations | Yes (`Bearer <token>`) |

### Request Examples

#### Client License Activation (`POST /api/licenses/activate`)
```json
{
  "key": "RDP-A1B2-C3D4-E5F6-7890",
  "hwid": "CPU-12345-GPU-67890-MAC-AA:BB:CC",
  "computer_name": "DESKTOP-CLIENT1",
  "ip_address": "192.168.1.50"
}
```

#### Admin Create License (`POST /api/licenses`)
```json
{
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "max_pcs": 3,
  "expires_in_days": 30,
  "notes": "Premium Plan License"
}
```
