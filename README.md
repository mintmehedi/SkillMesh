# Intelligent Talent Matching Platform (SkillMesh)

An intelligent, two-sided recruitment platform designed to connect job seekers with employers using advanced recommendation algorithms. 

## 🚀 Tech Stack
* **Frontend:** React (Vite) 
* **Backend:** Python (Django + Django REST Framework)
* **Database:** PostgreSQL (Hosted on Supabase)
* **Architecture:** Decoupled Monorepo

## ✨ Core Features
* **Candidate Portal:** Profile creation, resume parsing/upload, and algorithmic Top-10 job recommendations based on skills and experience.
* **Employer Portal:** Job posting creation, applicant filtering, and algorithmic Top-10 candidate recommendations.
* **Intelligent Matching Engine:** Backend Python algorithms matching structured job descriptions with candidate profiles.
* **Secure Architecture:** Row Level Security (RLS) via Supabase and strict API authentication.

---

## 🛠️ Local Setup Guide for Developers

Follow these steps precisely to get the full-stack application running on your local machine.

### Prerequisites
Before you begin, ensure you have the following installed on your machine:
* **Git**
* **Node.js** (v18+ recommended)
* **Python** (v3.10+ recommended) & **Anaconda/Miniconda**

### 1. Clone the Repository
```bash
git clone [https://github.com/your-org/SkillMesh.git](https://github.com/your-org/SkillMesh.git)
cd SkillMesh

2. Environment Variables (CRITICAL)
Never commit .env files to GitHub. You will need to create two separate .env files—one for the frontend and one for the backend. Reach out to the Lead Developer to get the required Supabase URI and API keys.

Backend .env (Create this file inside the backend/ folder):
SUPABASE_DB_URI=your_provided_database_url
DJANGO_SECRET_KEY=your_provided_secret_key
DEBUG=True

Frontend .env (Create this file inside the frontend/ folder):
VITE_SUPABASE_URL=your_provided_supabase_url
VITE_SUPABASE_ANON_KEY=your_provided_anon_key

3. Backend Setup (Django)
Open a terminal in the root SkillMesh folder.
# 1. Navigate to the backend folder
cd backend

# 2. Create a dedicated conda environment
conda create -n skillmesh_env python=3.11 -y

# 3. Activate the environment
conda activate skillmesh_env

# 4. Install dependencies (assuming a requirements.txt exists, or install manually)
pip install django djangorestframework psycopg2-binary django-cors-headers pandas scikit-learn

# 5. Run database migrations (connects to Supabase)
python manage.py migrate

# 6. Start the development server
python manage.py runserver

4. Frontend Setup (React/Vite)
Open a new, separate terminal window, navigate to the root SkillMesh folder, and run:
# 1. Navigate to the frontend folder
cd frontend

# 2. Install Node dependencies
npm install

# 3. Start the Vite development server
npm run dev


Gemini said
Here is a comprehensive, professional README.md tailored specifically for your monorepo architecture.

As the lead developer, providing a clear setup guide is one of the best ways to ensure your team starts coding quickly instead of fighting with environment errors. I have heavily emphasized keeping environment variables secure, which is a critical practice to enforce from day one.

You can copy the raw markdown below and paste it directly into the README.md file in the root of your SkillMesh repository.

Markdown
# Intelligent Talent Matching Platform (SkillMesh)

An intelligent, two-sided recruitment platform designed to connect job seekers with employers using advanced recommendation algorithms. 

## 🚀 Tech Stack
* **Frontend:** React (Vite) 
* **Backend:** Python (Django + Django REST Framework)
* **Database:** PostgreSQL (Hosted on Supabase)
* **Architecture:** Decoupled Monorepo

## ✨ Core Features
* **Candidate Portal:** Profile creation, resume parsing/upload, and algorithmic Top-10 job recommendations based on skills and experience.
* **Employer Portal:** Job posting creation, applicant filtering, and algorithmic Top-10 candidate recommendations.
* **Intelligent Matching Engine:** Backend Python algorithms matching structured job descriptions with candidate profiles.
* **Secure Architecture:** Row Level Security (RLS) via Supabase and strict API authentication.

---

## 🛠️ Local Setup Guide for Developers

Follow these steps precisely to get the full-stack application running on your local machine.

### Prerequisites
Before you begin, ensure you have the following installed on your machine:
* **Git**
* **Node.js** (v18+ recommended)
* **Python** (v3.10+ recommended) & **Anaconda/Miniconda**

### 1. Clone the Repository
```bash
git clone [https://github.com/your-org/SkillMesh.git](https://github.com/your-org/SkillMesh.git)
cd SkillMesh
2. Environment Variables (CRITICAL)
Never commit .env files to GitHub. You will need to create two separate .env files—one for the frontend and one for the backend. Reach out to the Lead Developer to get the required Supabase URI and API keys.

Backend .env (Create this file inside the backend/ folder):

Plaintext
SUPABASE_DB_URI=your_provided_database_url
DJANGO_SECRET_KEY=your_provided_secret_key
DEBUG=True
Frontend .env (Create this file inside the frontend/ folder):

Plaintext
VITE_SUPABASE_URL=your_provided_supabase_url
VITE_SUPABASE_ANON_KEY=your_provided_anon_key
3. Backend Setup (Django)
Open a terminal in the root SkillMesh folder.

Bash
# 1. Navigate to the backend folder
cd backend

# 2. Create a dedicated conda environment
conda create -n skillmesh_env python=3.11 -y

# 3. Activate the environment
conda activate skillmesh_env

# 4. Install dependencies (assuming a requirements.txt exists, or install manually)
pip install django djangorestframework psycopg2-binary django-cors-headers pandas scikit-learn

# 5. Run database migrations (connects to Supabase)
python manage.py migrate

# 6. Start the development server
python manage.py runserver
The backend should now be running at http://127.0.0.1:8000/

4. Frontend Setup (React/Vite)
Open a new, separate terminal window, navigate to the root SkillMesh folder, and run:

Bash
# 1. Navigate to the frontend folder
cd frontend

# 2. Install Node dependencies
npm install

# 3. Start the Vite development server
npm run dev
The frontend should now be running at http://localhost:5173/ (or port 3000).

📁 Repository Structure
SkillMesh/
├── backend/                # Django Application
│   ├── manage.py
│   ├── mysite/             # Core settings and routing
│   └── api/                # Endpoints and recommendation logic
├── frontend/               # React Vite Application
│   ├── src/                # UI Components and pages
│   └── package.json
├── .gitignore              # Protects secrets and heavy node/python modules
└── README.md

🌿 Git Workflow Rules
Never push directly to main.

Create a new branch for your feature: git checkout -b feature/your-feature-name

Commit your changes: git commit -m "Add candidate profile form"

Push to your branch and open a Pull Request (PR) for code review.

graph TD
    subgraph "Client Layer (Frontend)"
        A[React App / Vite]
        B[State Management / Hooks]
    end

    subgraph "Logic Layer (Backend)"
        C[Django REST Framework]
        D[Authentication Middleware]
        E[Intelligent Matching Logic]
    end

    subgraph "Data Layer (Supabase)"
        F[PostgreSQL Database]
        G[Supabase Auth]
        H[Storage / Resumes]
    end

    %% Interactions
    A -- HTTP Requests/JSON --> C
    C -- Validates JWT --> G
    C -- SQL Queries --> F
    C -- Stores/Fetches PDFs --> H
    E -- Process Data --> C
    C -- Response Data --> A
