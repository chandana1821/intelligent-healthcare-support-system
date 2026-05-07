from pathlib import Path

import numpy as np

from app.core.config import get_settings

ROOT = Path(__file__).resolve().parents[2]
KNOWLEDGE_PATH = ROOT / "data" / "medical_knowledge.txt"


class RAGService:
    def __init__(self) -> None:
        self.chunks: list[str] = []
        self.embeddings: np.ndarray | None = None
        self.index = None
        self.encoder = None

    def build_index(self) -> None:
        text = KNOWLEDGE_PATH.read_text(encoding="utf-8")
        self.chunks = [chunk.strip() for chunk in text.split("\n\n") if chunk.strip()]
        try:
            from sentence_transformers import SentenceTransformer

            self.encoder = SentenceTransformer("all-MiniLM-L6-v2")
            self.embeddings = np.asarray(self.encoder.encode(self.chunks, normalize_embeddings=True), dtype="float32")
            try:
                import faiss

                self.index = faiss.IndexFlatIP(self.embeddings.shape[1])
                self.index.add(self.embeddings)
            except Exception:
                self.index = None
        except Exception:
            self.encoder = None
            self.embeddings = None

    def answer(self, question: str) -> dict:
        if not self.chunks:
            self.build_index()
        contexts = self.retrieve(question)
        answer = self._generate(question, contexts)
        return {"answer": answer, "sources": contexts}

    def retrieve(self, question: str, k: int = 3) -> list[str]:
        if self.encoder is not None and self.embeddings is not None:
            query = np.asarray(self.encoder.encode([question], normalize_embeddings=True), dtype="float32")
            if self.index is not None:
                _, indices = self.index.search(query, k)
                return [self.chunks[i] for i in indices[0] if i >= 0]
            scores = self.embeddings @ query[0]
            indices = np.argsort(scores)[-k:][::-1]
            return [self.chunks[i] for i in indices]

        words = set(question.lower().split())
        scored = [(len(words.intersection(chunk.lower().split())), chunk) for chunk in self.chunks]
        return [chunk for _, chunk in sorted(scored, reverse=True)[:k]]

    def _generate(self, question: str, contexts: list[str]) -> str:
        settings = get_settings()
        context = "\n".join(contexts)
        if settings.llm_provider == "openai" and settings.openai_api_key:
            from openai import OpenAI

            client = OpenAI(api_key=settings.openai_api_key)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a cautious healthcare education assistant. Do not diagnose. Recommend emergency care for red flags."},
                    {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"},
                ],
            )
            return response.choices[0].message.content or ""

        if settings.llm_provider == "gemini" and settings.gemini_api_key:
            import google.generativeai as genai

            genai.configure(api_key=settings.gemini_api_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            return model.generate_content(f"Use this medical context cautiously:\n{context}\n\nQuestion: {question}").text

        return (
            f"Based on the clinic knowledge base: {context} "
            "This is educational information only and not a medical diagnosis. "
            "For severe, worsening, or emergency symptoms, contact local emergency services or a licensed clinician."
        )


rag_service = RAGService()
