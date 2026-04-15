# SkillMesh - Intelligent Talent Matching Platform

## About
SkillMesh is a full-stack web application (Indeed/Seek style) with role-based candidate and employer workflows.

This web app is part of the University of Wollongong CSIT314 Autumn class project.

## Tech Stack
- **Frontend:** React (Vite)
- **Backend:** Python (Django + Django REST Framework)
- **Database:** PostgreSQL (Supabase)

## Instructions
1. Clone the repository and open the project root:
   ```bash
   git clone https://github.com/your-org/SkillMesh.git
   cd SkillMesh
   ```
2. Create the required `.env` files in `backend/` and `frontend/`.
3. Start the backend server.
4. Start the frontend server in a separate terminal.

## Setup Process
### 1) Environment Variables
**Never commit `.env` files to GitHub.** Create two separate `.env` files:

**Backend `.env`** (inside `backend/`):
```text
DATABASE_URL=your_provided_database_url
DJANGO_SECRET_KEY=your_provided_secret_key
DEBUG=True
```

**Frontend `.env`** (inside `frontend/`):
```text
VITE_SUPABASE_URL=your_provided_supabase_url
VITE_SUPABASE_ANON_KEY=your_provided_anon_key
```

### 2) Backend Setup
```bash
cd backend
python3 -m pip install -r requirements.txt
python3 manage.py makemigrations
python3 manage.py migrate
python3 manage.py runserver
```
Backend runs at `http://127.0.0.1:8000/`.

### 3) Frontend Setup
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at `http://localhost:5173/` (or port 3000).
Vercel hosting domain : https://skill-mesh.vercel.app/
