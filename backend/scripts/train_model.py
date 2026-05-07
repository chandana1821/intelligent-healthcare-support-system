import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.ml_service import symptom_model


if __name__ == "__main__":
    result = symptom_model.train()
    print(f"Saved model to {result['model_path']}")
    print(f"Validation accuracy: {result['accuracy']:.3f}")
