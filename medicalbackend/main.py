import json
import hashlib
import hmac
import os
import secrets
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import jwt
from google.auth.exceptions import GoogleAuthError
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import id_token
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, field_validator
from ml_predictor import get_predictor


BASE_DIR = Path(__file__).resolve().parent
configured_database_path = os.getenv("DATABASE_PATH", "medical_records.db")
DATABASE_PATH = Path(configured_database_path)
if not DATABASE_PATH.is_absolute():
    DATABASE_PATH = BASE_DIR / DATABASE_PATH
UPLOAD_DIR = BASE_DIR / "uploads"
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_UPLOAD_TYPES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
}
JWT_SECRET = os.getenv("JWT_SECRET", "development-only-change-this-secret")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "30"))
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@example.com").strip().lower()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "ChangeMe123!")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
ALLOWED_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,https://medical-misdiagnosis-risk-detector-seven.vercel.app",
    ).split(",")
    if origin.strip()
]

app = FastAPI(
    title="Medical Misdiagnosis Risk Detector API",
    description="Backend API for the Medical Misdiagnosis Risk Detector",
    version="1.0.0"
)

# Allow React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https://medical-misdiagnosis-risk-detector-[a-z0-9-]+\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=False,
#     allow_methods=["*"],

#     allow_headers=["*"],
# )

@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


class PatientAssessment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    age: int = Field(ge=0, le=150)
    gender: str = Field(min_length=1, max_length=50)
    payload: dict[str, Any] = Field(default_factory=dict, max_length=100)
    risk: str = Field(pattern="^(Low|Medium|High)$")
    riskScore: int = Field(ge=0, le=100)
    riskFactors: list[str] = Field(default_factory=list, max_length=50)

    @field_validator("name", "gender")
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
        return value


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class RegisterRequest(LoginRequest):
    pass


class GoogleLoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    credential: str = Field(min_length=1, max_length=10000)


# Medical Prediction Models
class MedicalPredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    age: int = Field(ge=18, le=120)
    fever_temp: float = Field(ge=95, le=106)
    cough_days: int = Field(ge=0, le=30)
    shortness_of_breath: int = Field(ge=0, le=1)
    chest_pain: int = Field(ge=0, le=10)
    fatigue: int = Field(ge=0, le=1)
    oxygen_saturation: float = Field(ge=50, le=100)
    respiratory_rate: int = Field(ge=8, le=50)
    heart_rate: int = Field(ge=30, le=200)
    blood_pressure_systolic: int = Field(ge=60, le=250)
    smoker: int = Field(ge=0, le=1)
    diabetes: int = Field(ge=0, le=1)
    hypertension: int = Field(ge=0, le=1)
    previous_infections: int = Field(ge=0, le=10)


class DiagnosisProbability(BaseModel):
    diagnosis: str
    probability: float


class FactorImportance(BaseModel):
    factor: str
    importance: float


class MedicalPredictionResponse(BaseModel):
    primary_diagnosis: str
    risk_score: int
    confidence: float
    all_diagnoses: list[DiagnosisProbability]
    top_factors: list[FactorImportance]
    recommendation: str


security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived_key = hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=64
    )
    return f"scrypt${salt.hex()}${derived_key.hex()}"


def verify_password(password: str, encoded_hash: str) -> bool:
    try:
        algorithm, salt_hex, key_hex = encoded_hash.split("$", 2)
        if algorithm != "scrypt":
            return False
        derived_key = hashlib.scrypt(
            password.encode("utf-8"), salt=bytes.fromhex(salt_hex),
            n=2**14, r=8, p=1, dklen=64
        )
        return hmac.compare_digest(derived_key.hex(), key_hex)
    except (ValueError, TypeError):
        return False


def create_access_token(email: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES)
    return jwt.encode({"sub": email, "exp": expires}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def user_summary(email: str) -> dict[str, str]:
    normalized_email = email.strip().lower()
    return {
        "email": normalized_email,
        "role": "admin" if normalized_email == ADMIN_EMAIL else "user",
    }


def require_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Authentication required", headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email = payload.get("sub")
        if not isinstance(email, str):
            raise ValueError
        return email
    except (jwt.InvalidTokenError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token", headers={"WWW-Authenticate": "Bearer"})


def require_admin(email: str = Depends(require_user)) -> str:
    if email.strip().lower() != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Administrator access required")
    return email


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialise_database() -> None:
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS patient_assessments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                age INTEGER NOT NULL,
                gender TEXT NOT NULL,
                payload TEXT NOT NULL,
                risk TEXT NOT NULL,
                risk_score INTEGER NOT NULL,
                risk_factors TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS medical_documents (
                id TEXT PRIMARY KEY,
                original_name TEXT NOT NULL,
                stored_name TEXT NOT NULL UNIQUE,
                content_type TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        if not connection.execute("SELECT id FROM users WHERE email = ?", (ADMIN_EMAIL,)).fetchone():
            connection.execute(
                "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
                (ADMIN_EMAIL, hash_password(ADMIN_PASSWORD), datetime.now(timezone.utc).isoformat()),
            )


def serialise_assessment(row: sqlite3.Row) -> dict[str, Any]:
    payload = json.loads(row["payload"])
    return {
        "id": row["id"],
        "name": row["name"],
        "age": row["age"],
        "gender": row["gender"],
        **payload,
        "risk": row["risk"],
        "riskScore": row["risk_score"],
        "riskFactors": json.loads(row["risk_factors"]),
        "createdAt": row["created_at"],
    }


initialise_database()


@app.get("/")
def home():
    return {
        "message": "Medical Misdiagnosis Risk Detector API is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


@app.post("/api/auth/login")
def login(credentials: LoginRequest):
    with get_connection() as connection:
        user = connection.execute(
            "SELECT email, password_hash FROM users WHERE email = ?",
            (credentials.email.strip().lower(),),
        ).fetchone()
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password", headers={"WWW-Authenticate": "Bearer"})
    return {"access_token": create_access_token(user["email"]), "token_type": "bearer", "user": user_summary(user["email"])}


@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register(credentials: RegisterRequest):
    email = credentials.email.strip().lower()
    created_at = datetime.now(timezone.utc).isoformat()

    try:
        with get_connection() as connection:
            connection.execute(
                "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
                (email, hash_password(credentials.password), created_at),
            )
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    return {"access_token": create_access_token(email), "token_type": "bearer", "user": user_summary(email)}


@app.post("/api/auth/google")
def google_login(credentials: GoogleLoginRequest):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")

    try:
        claims = id_token.verify_oauth2_token(
            credentials.credential, GoogleAuthRequest(), GOOGLE_CLIENT_ID
        )
    except (ValueError, GoogleAuthError):
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    email = claims.get("email")
    if not claims.get("email_verified") or not isinstance(email, str):
        raise HTTPException(status_code=401, detail="A verified Google email is required")
    email = email.strip().lower()
    if not email:
        raise HTTPException(status_code=401, detail="A verified Google email is required")

    with get_connection() as connection:
        connection.execute(
            "INSERT OR IGNORE INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
            (
                email,
                hash_password(secrets.token_urlsafe(32)),
                datetime.now(timezone.utc).isoformat(),
            ),
        )

    return {
        "access_token": create_access_token(email),
        "token_type": "bearer",
        "user": user_summary(email),
    }


@app.get("/api/admin/overview")
def get_admin_overview(_: str = Depends(require_admin)):
    with get_connection() as connection:
        users = connection.execute(
            "SELECT email, created_at FROM users ORDER BY created_at DESC"
        ).fetchall()
        assessment_count = connection.execute(
            "SELECT COUNT(*) AS count FROM patient_assessments"
        ).fetchone()["count"]
        document_count = connection.execute(
            "SELECT COUNT(*) AS count FROM medical_documents"
        ).fetchone()["count"]

    return {
        "userCount": len(users),
        "assessmentCount": assessment_count,
        "documentCount": document_count,
        "users": [
            {
                "email": row["email"],
                "role": user_summary(row["email"])["role"],
                "createdAt": row["created_at"],
            }
            for row in users
        ],
    }


@app.post("/api/documents", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    _: str = Depends(require_user),
):
    extension = ALLOWED_UPLOAD_TYPES.get(file.content_type or "")
    if not extension:
        raise HTTPException(status_code=415, detail="Only PDF, JPG, and PNG files are allowed")

    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File must be 10 MB or smaller")

    document_id = str(uuid.uuid4())
    stored_name = f"{document_id}{extension}"
    UPLOAD_DIR.mkdir(exist_ok=True)
    (UPLOAD_DIR / stored_name).write_bytes(content)
    created_at = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO medical_documents
                (id, original_name, stored_name, content_type, size_bytes, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (document_id, Path(file.filename or "medical-document").name[:255], stored_name, file.content_type, len(content), created_at),
        )

    return {
        "id": document_id,
        "filename": Path(file.filename or "medical-document").name[:255],
        "contentType": file.content_type,
        "sizeBytes": len(content),
        "uploadedAt": created_at,
        "analysisStatus": "Uploaded for clinician review; no automated diagnosis performed",
    }


@app.post("/api/patients", status_code=status.HTTP_201_CREATED)
def create_patient(assessment: PatientAssessment, _: str = Depends(require_user)):
    created_at = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO patient_assessments
                (name, age, gender, payload, risk, risk_score, risk_factors, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                assessment.name.strip(),
                assessment.age,
                assessment.gender,
                json.dumps(assessment.payload),
                assessment.risk,
                assessment.riskScore,
                json.dumps(assessment.riskFactors),
                created_at,
            ),
        )
        row = connection.execute(
            "SELECT * FROM patient_assessments WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()

    return serialise_assessment(row)


@app.get("/api/patients")
def list_patients(_: str = Depends(require_user)):
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM patient_assessments ORDER BY created_at DESC, id DESC"
        ).fetchall()

    return [serialise_assessment(row) for row in rows]


@app.get("/api/patients/{patient_id}")
def get_patient(patient_id: int, _: str = Depends(require_user)):
    with get_connection() as connection:
        row = connection.execute(
            "SELECT * FROM patient_assessments WHERE id = ?",
            (patient_id,),
        ).fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient assessment not found"
        )

    return serialise_assessment(row)


@app.put("/api/patients/{patient_id}")
def update_patient(patient_id: int, assessment: PatientAssessment, _: str = Depends(require_user)):
    with get_connection() as connection:
        # Check if patient exists
        existing = connection.execute(
            "SELECT id FROM patient_assessments WHERE id = ?",
            (patient_id,),
        ).fetchone()

        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient assessment not found"
            )

        connection.execute(
            """
            UPDATE patient_assessments
            SET name = ?, age = ?, gender = ?, payload = ?, risk = ?, risk_score = ?, risk_factors = ?
            WHERE id = ?
            """,
            (
                assessment.name.strip(),
                assessment.age,
                assessment.gender,
                json.dumps(assessment.payload),
                assessment.risk,
                assessment.riskScore,
                json.dumps(assessment.riskFactors),
                patient_id,
            ),
        )

        row = connection.execute(
            "SELECT * FROM patient_assessments WHERE id = ?",
            (patient_id,),
        ).fetchone()

    return serialise_assessment(row)


@app.delete("/api/patients/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(patient_id: int, _: str = Depends(require_user)):
    with get_connection() as connection:
        # Check if patient exists
        existing = connection.execute(
            "SELECT id FROM patient_assessments WHERE id = ?",
            (patient_id,),
        ).fetchone()

        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient assessment not found"
            )

        connection.execute(
            "DELETE FROM patient_assessments WHERE id = ?",
            (patient_id,),
        )


@app.get("/api/statistics")
def get_statistics(_: str = Depends(require_user)):
    with get_connection() as connection:
        total = connection.execute(
            "SELECT COUNT(*) as count FROM patient_assessments"
        ).fetchone()["count"]

        risk_counts = connection.execute(
            "SELECT risk, COUNT(*) as count FROM patient_assessments GROUP BY risk"
        ).fetchall()

        high_risk_count = next(
            (r["count"] for r in risk_counts if r["risk"] == "High"),
            0
        )

    return {
        "totalAssessments": total,
        "highRiskCount": high_risk_count,
        "statisticsByRisk": {row["risk"]: row["count"] for row in risk_counts}
    }


@app.post("/api/predict-risk", response_model=MedicalPredictionResponse)
def predict_medical_risk(request: MedicalPredictionRequest, _: str = Depends(require_user)):
    """
    Predict patient diagnosis and risk score using XGBoost model
    """
    predictor = get_predictor()
    patient_data = request.model_dump()
    result = predictor.predict(patient_data)
    return result


@app.get("/api/model-status")
def get_model_status():
    """
    Check if ML model is loaded and ready
    """
    predictor = get_predictor()
    return {
        "status": "ready" if predictor.is_loaded else "not_loaded",
        "model_loaded": predictor.is_loaded,
        "message": "ML model is operational" if predictor.is_loaded else "ML model needs training"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)