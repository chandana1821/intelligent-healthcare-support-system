from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.multioutput import MultiOutputClassifier


ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "data" / "symptom_disease.csv"
MODEL_PATH = ROOT / "ml" / "model.pkl"


class SymptomModel:
    def __init__(self) -> None:
        self.pipeline: dict | None = None

    @property
    def symptoms(self) -> list[str]:
        self._ensure_loaded()
        return self.pipeline["features"]

    def train(self) -> dict:
        df = pd.read_csv(DATA_PATH).fillna(0)
        features = [c for c in df.columns if c not in {"disease", "urgency"}]
        x = df[features]
        y = df[["disease", "urgency"]]
        stratify = df["disease"] if df["disease"].value_counts().min() > 1 else None
        test_size = max(0.25, df["disease"].nunique() / len(df))
        x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=test_size, random_state=42, stratify=stratify)
        model = MultiOutputClassifier(RandomForestClassifier(n_estimators=160, random_state=42, class_weight="balanced"))
        model.fit(x_train, y_train)
        predicted = model.predict(x_test)
        accuracy = accuracy_score(y_test["disease"], predicted[:, 0])
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        self.pipeline = {"model": model, "features": features, "accuracy": float(accuracy)}
        joblib.dump(self.pipeline, MODEL_PATH)
        return {"accuracy": float(accuracy), "features": features, "model_path": str(MODEL_PATH)}

    def predict(self, symptoms: list[str]) -> dict:
        self._ensure_loaded()
        normalized = {s.strip().lower().replace(" ", "_") for s in symptoms}
        row = {feature: int(feature in normalized) for feature in self.pipeline["features"]}
        x = pd.DataFrame([row])
        disease, urgency = self.pipeline["model"].predict(x)[0]
        probabilities = self.pipeline["model"].estimators_[0].predict_proba(x)[0]
        confidence = float(probabilities.max())
        return {
            "disease": disease,
            "urgency": urgency,
            "confidence": round(confidence, 3),
            "recommendations": self._recommendations(urgency),
        }

    def _ensure_loaded(self) -> None:
        if self.pipeline:
            return
        if MODEL_PATH.exists():
            self.pipeline = joblib.load(MODEL_PATH)
            return
        self.train()

    @staticmethod
    def _recommendations(urgency: str) -> list[str]:
        base = ["This is not a diagnosis. Please consult a qualified clinician."]
        if urgency == "High":
            return ["Seek urgent medical care or emergency support if symptoms are severe."] + base
        if urgency == "Medium":
            return ["Book a doctor appointment soon and monitor symptom progression."] + base
        return ["Rest, hydrate, and schedule routine care if symptoms persist or worsen."] + base


symptom_model = SymptomModel()
