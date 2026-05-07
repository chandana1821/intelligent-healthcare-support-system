from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, EmailStr, Field


class Role(str, Enum):
    patient = "patient"
    doctor = "doctor"
    admin = "admin"


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8)
    role: Role = Role.patient
    phone: str | None = None
    age: int | None = Field(default=None, ge=0, le=125)
    gender: str | None = None
    specialization: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: Role
    name: str


class PatientUpload(BaseModel):
    name: str
    email: EmailStr
    phone: str | None = None
    age: int | None = Field(default=None, ge=0, le=125)
    gender: str | None = None
    address: str | None = None
    medical_history: list[str] = []


class PredictRequest(BaseModel):
    symptoms: list[str] = Field(min_length=1)
    patient_id: str | None = None


class PredictResponse(BaseModel):
    disease: str
    urgency: str
    confidence: float
    recommendations: list[str]


class ChatRequest(BaseModel):
    message: str = Field(min_length=2, max_length=2000)
    patient_id: str | None = None


class ChatResponse(BaseModel):
    reply: str
    answer: str
    sources: list[str]


class AppointmentCreate(BaseModel):
    doctor_email: EmailStr
    date: str
    time: str
    reason: str = Field(min_length=2, max_length=500)
    amount_inr: int = Field(default=500, ge=1)


class AppointmentUpdate(BaseModel):
    status: str
    scheduled_for: datetime | None = None


class AppointmentPaymentVerify(BaseModel):
    appointment_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class AnalyticsResponse(BaseModel):
    top_diseases: list[dict[str, Any]]
    urgency_distribution: list[dict[str, Any]]
    patient_inflow: list[dict[str, Any]]
    symptom_trends: list[dict[str, Any]]
