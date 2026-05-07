from pathlib import Path
import pickle

import numpy as np
from openai import AzureOpenAI, OpenAIError

from app.core.config import get_settings


ROOT = Path(__file__).resolve().parents[2]
VECTORSTORE_DIR = ROOT / "vectorstore"
INDEX_PATH = VECTORSTORE_DIR / "index.faiss"
CHUNKS_PATH = VECTORSTORE_DIR / "chunks.pkl"
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


class RAGError(Exception):
    status_code = 500
    detail = "RAG chatbot error"


class MissingVectorStoreError(RAGError):
    status_code = 503
    detail = "FAISS index is missing. Run backend/scripts/ingest.py to build vectorstore/index.faiss and vectorstore/chunks.pkl."


class MissingAzureConfigError(RAGError):
    status_code = 500
    detail = "Azure OpenAI credentials are missing from backend .env."


class EmptyMessageError(RAGError):
    status_code = 400
    detail = "Message cannot be empty."


class AzureChatError(RAGError):
    status_code = 502
    detail = "Azure OpenAI request failed."


class RAGChatbot:
    def __init__(self) -> None:
        self.index = None
        self.chunks: list[str] = []
        self.encoder = None

    def answer(self, question: str) -> dict:
        question = question.strip()
        if not question:
            raise EmptyMessageError()

        self._load_vectorstore()
        contexts = self.retrieve(question)
        reply = self._ask_azure(question, contexts)
        return {"reply": reply, "answer": reply, "sources": contexts}

    def retrieve(self, question: str, k: int = 3) -> list[str]:
        self._load_vectorstore()
        encoder = self._get_encoder()
        query = np.asarray(encoder.encode([question], normalize_embeddings=True), dtype="float32")
        _, indices = self.index.search(query, min(k, len(self.chunks)))
        return [self.chunks[i] for i in indices[0] if 0 <= i < len(self.chunks)]

    def _load_vectorstore(self) -> None:
        if self.index is not None and self.chunks:
            return
        if not INDEX_PATH.exists() or not CHUNKS_PATH.exists():
            raise MissingVectorStoreError()

        try:
            import faiss
        except Exception as exc:
            raise MissingVectorStoreError() from exc

        self.index = faiss.read_index(str(INDEX_PATH))
        with CHUNKS_PATH.open("rb") as file:
            self.chunks = pickle.load(file)

        if not self.chunks:
            raise MissingVectorStoreError()

    def _get_encoder(self):
        if self.encoder is None:
            from sentence_transformers import SentenceTransformer

            self.encoder = SentenceTransformer(EMBEDDING_MODEL)
        return self.encoder

    def _ask_azure(self, question: str, contexts: list[str]) -> str:
        settings = get_settings()
        required = [
            settings.azure_openai_api_key,
            settings.azure_openai_endpoint,
            settings.azure_openai_api_version,
            settings.azure_openai_deployment_name,
        ]
        if not all(required):
            raise MissingAzureConfigError()

        client = AzureOpenAI(
            api_key=settings.azure_openai_api_key,
            azure_endpoint=settings.azure_openai_endpoint,
            api_version=settings.azure_openai_api_version,
        )
        context = "\n\n".join(contexts)
        try:
            response = client.chat.completions.create(
                model=settings.azure_openai_deployment_name,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a cautious healthcare education chatbot. "
                            "Use only the retrieved context when possible, do not diagnose, "
                            "and recommend urgent medical care for red flags or emergencies."
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"Retrieved context:\n{context}\n\nUser question: {question}",
                    },
                ],
                temperature=0.2,
            )
        except OpenAIError as exc:
            raise AzureChatError() from exc
        except Exception as exc:
            raise AzureChatError() from exc

        return response.choices[0].message.content or "I could not generate an answer."


rag_chatbot = RAGChatbot()
