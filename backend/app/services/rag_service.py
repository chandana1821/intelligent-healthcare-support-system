from app.services.rag import rag_chatbot


class RAGService:
    def answer(self, question: str) -> dict:
        return rag_chatbot.answer(question)


rag_service = RAGService()
