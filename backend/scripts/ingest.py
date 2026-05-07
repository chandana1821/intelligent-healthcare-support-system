from pathlib import Path
import pickle
import sys

import numpy as np


BACKEND_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = BACKEND_ROOT / "data"
VECTORSTORE_DIR = BACKEND_ROOT / "vectorstore"
INDEX_PATH = VECTORSTORE_DIR / "index.faiss"
CHUNKS_PATH = VECTORSTORE_DIR / "chunks.pkl"
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
SUPPORTED_EXTENSIONS = {".txt", ".md", ".csv"}


def read_documents() -> list[str]:
    if not DATA_DIR.exists():
        raise FileNotFoundError(f"Data folder not found: {DATA_DIR}")

    documents: list[str] = []
    for path in sorted(DATA_DIR.rglob("*")):
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS:
            text = path.read_text(encoding="utf-8", errors="ignore").strip()
            if text:
                documents.append(text)
    if not documents:
        raise RuntimeError(f"No supported documents found in {DATA_DIR}")
    return documents


def chunk_text(text: str, chunk_size: int = 900, overlap: int = 150) -> list[str]:
    paragraphs = [part.strip() for part in text.split("\n\n") if part.strip()]
    chunks: list[str] = []
    for paragraph in paragraphs:
        if len(paragraph) <= chunk_size:
            chunks.append(paragraph)
            continue
        start = 0
        while start < len(paragraph):
            chunk = paragraph[start:start + chunk_size].strip()
            if chunk:
                chunks.append(chunk)
            start += chunk_size - overlap
    return chunks


def build_vectorstore() -> None:
    try:
        import faiss
        from sentence_transformers import SentenceTransformer
    except Exception as exc:
        raise RuntimeError("Install faiss-cpu and sentence-transformers before running ingestion.") from exc

    chunks: list[str] = []
    for document in read_documents():
        chunks.extend(chunk_text(document))
    if not chunks:
        raise RuntimeError("No text chunks were created from backend/data.")

    encoder = SentenceTransformer(EMBEDDING_MODEL)
    embeddings = np.asarray(encoder.encode(chunks, normalize_embeddings=True), dtype="float32")
    index = faiss.IndexFlatIP(embeddings.shape[1])
    index.add(embeddings)

    VECTORSTORE_DIR.mkdir(parents=True, exist_ok=True)
    faiss.write_index(index, str(INDEX_PATH))
    with CHUNKS_PATH.open("wb") as file:
        pickle.dump(chunks, file)

    print(f"Saved FAISS index: {INDEX_PATH}")
    print(f"Saved chunks: {CHUNKS_PATH}")
    print(f"Chunks indexed: {len(chunks)}")


if __name__ == "__main__":
    try:
        build_vectorstore()
    except Exception as exc:
        print(f"Ingestion failed: {exc}", file=sys.stderr)
        raise
