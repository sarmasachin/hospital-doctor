# LiveHospital - Hospital Doctor Availability System

Full-stack web application to check doctor availability at hospitals.

## Tech Stack
- **Frontend:** HTML/CSS/JS (Static) + React.js
- **Backend:** Node.js + Express.js
- **Database:** MySQL

## Project Structure
```
hospital-doctor-availability/
├── index.html              # Main Static Frontend
├── style.css               # Styling
├── script.js               # Frontend Logic
├── client/                 # React Frontend (Optional)
├── server/                 # Node.js Backend
│   ├── server.js           # API Server
│   ├── database.sql        # Database Schema
│   ├── .env                # Environment Variables
│   └── package.json
└── README.md
```

## Quick Setup

### Step 1: Setup MySQL Database

```bash
# Open MySQL and run:
mysql -u root -p < server/database.sql
```

### Step 2: Start Backend Server

```bash
cd server
npm install
npm start
```
Server: http://localhost:5006

### Step 3: Open Frontend

Just open `index.html` in browser!

---

## API Endpoints

### Hospitals
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/hospitals` | Get all hospitals |
| GET | `/api/hospitals/:id` | Get single hospital |
| POST | `/api/hospitals` | Add new hospital |
| PUT | `/api/hospitals/:id` | Update hospital |
| DELETE | `/api/hospitals/:id` | Delete hospital |

### Doctors
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/doctors` | Get all doctors |
| GET | `/api/hospitals/:id/doctors` | Get doctors by hospital |
| GET | `/api/doctors/status/:status` | Get doctors by status |
| POST | `/api/doctors` | Add new doctor |
| PUT | `/api/doctors/:id` | Update doctor |
| PATCH | `/api/doctors/:id/status` | Update doctor status |
| PATCH | `/api/doctors/bulk-status` | Update multiple doctors |
| DELETE | `/api/doctors/:id` | Delete doctor |

### Blood Requests
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/blood-requests` | Get active blood requests |
| GET | `/api/hospitals/:id/blood-requests` | Get blood requests by hospital |
| POST | `/api/blood-requests` | Add blood request |
| DELETE | `/api/blood-requests/:id` | Delete blood request |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/login` | Admin login |
| GET | `/api/admins` | Get all admins |
| POST | `/api/admins` | Add new admin |
| DELETE | `/api/admins/:id` | Delete admin |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search?q=term` | Search hospitals/doctors |
| GET | `/api/stats` | Dashboard statistics |

---

## Database Tables

| Table | Description |
|-------|-------------|
| `hospitals` | Hospital info with location |
| `doctors` | Doctor details with status |
| `blood_requests` | Blood donation requests (24hr expiry) |
| `admins` | Admin users for management |

---

## Default Admin Login
- **Username:** sharma.sachinctr@gmail.com
- **Password:** comingsoon@123

> Run `node setup-security.js` after first DB import to hash passwords and secure admin accounts.

---

## Features
- ✅ Hospital listing with doctor counts
- ✅ Doctor availability (Available/Busy/On Leave)
- ✅ Blood request management (24hr auto-expiry)
- ✅ Search hospitals and doctors
- ✅ Filter by specialty
- ✅ City-based filtering
- ✅ Admin login system
- ✅ Bulk status update
- ✅ Responsive dark theme UI
- ✅ WhatsApp share

---

## API Examples

### Get All Hospitals
```bash
curl http://localhost:5006/api/hospitals
```

### Add Blood Request
```bash
curl -X POST http://localhost:5006/api/blood-requests \
  -H "Content-Type: application/json" \
  -d '{"blood_type":"O+","hospital_id":1,"message":"Urgent","patient_name":"Test","contact":"9999999999"}'
```

### Admin Login
```bash
curl -X POST http://localhost:5006/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Update Multiple Doctors Status
```bash
curl -X PATCH http://localhost:5006/api/doctors/bulk-status \
  -H "Content-Type: application/json" \
  -d '{"doctor_ids":[1,2,3],"status":"busy"}'
```
