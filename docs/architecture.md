# CareSphere AI Architecture

## Runtime

- React + Tailwind + Material UI renders role-based workflows.
- FastAPI exposes versioned APIs under `/api/v1`.
- MongoDB stores patients, users, appointments, predictions, and chat history.
- scikit-learn trains a Random Forest multi-output classifier for disease and urgency.
- RAG uses sentence-transformers embeddings and FAISS inner-product search when installed.
- The agent router dispatches requests to symptom, medical-info, or analytics agents.

## Production Notes

- Put the API behind HTTPS and a managed gateway.
- Replace the demo symptom CSV with a clinically reviewed dataset.
- Add audit logging, consent capture, retention policies, and PHI encryption.
- Use managed MongoDB with backups, private networking, and role-scoped credentials.
- Configure real Razorpay keys and verify webhooks before marking payments complete.
- Use OpenAI or Gemini through environment variables; keep the mock LLM only for local demos.
- Power BI can consume `/api/v1/analytics` through a scheduled connector or a MongoDB BI connector.
