from app.core.database import get_db


async def get_analytics() -> dict:
    db = get_db()
    top_diseases = await db.predictions.aggregate([
        {"$group": {"_id": "$disease", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
        {"$project": {"_id": 0, "disease": "$_id", "count": 1}},
    ]).to_list(10)
    urgency_distribution = await db.predictions.aggregate([
        {"$group": {"_id": "$urgency", "count": {"$sum": 1}}},
        {"$project": {"_id": 0, "urgency": "$_id", "count": 1}},
    ]).to_list(10)
    patient_inflow = await db.patients.aggregate([
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
        {"$project": {"_id": 0, "date": "$_id", "count": 1}},
    ]).to_list(30)
    symptom_trends = await db.predictions.aggregate([
        {"$unwind": "$symptoms"},
        {"$group": {"_id": "$symptoms", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 12},
        {"$project": {"_id": 0, "symptom": "$_id", "count": 1}},
    ]).to_list(12)
    return {
        "top_diseases": top_diseases,
        "urgency_distribution": urgency_distribution,
        "patient_inflow": patient_inflow,
        "symptom_trends": symptom_trends,
    }
