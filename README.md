# CareSphere AI

Full-stack AI-powered healthcare assistant with React, FastAPI, MongoDB, scikit-learn, FAISS RAG, LLM integration, role-based access, appointments, Razorpay order creation, and analytics dashboards.

## Structure

- `backend/` FastAPI API, MongoDB integration, ML model, RAG, agent orchestration.
- `frontend/` React + Tailwind + Material UI application.
- `docs/architecture.md` production architecture and company-level hardening notes.

## Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python scripts/train_model.py
uvicorn app.main:app --reload
```

Start MongoDB locally or use Docker. The API runs at `http://localhost:8000`.

## Frontend Setup

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

The app runs at `http://localhost:5173`.

## Docker

```bash
copy backend\.env.example backend\.env
docker compose up --build
```

## Roles

- Patients can register with any email.
- Doctors and admins must use the configured company domain from `STAFF_EMAIL_DOMAIN`.
- Default example domain: `caresphere.health`.

## API Highlights

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/predict`
- `POST /api/v1/chat`
- `POST /api/v1/upload`
- `GET /api/v1/analytics`
- `POST /api/v1/appointments`

## Important Safety Note

This project is an engineering foundation and education assistant. It does not provide diagnosis or replace licensed medical care. Before production use, validate datasets, prompts, workflows, consent, privacy, payment, and clinical escalation paths with qualified medical, security, and legal reviewers.
