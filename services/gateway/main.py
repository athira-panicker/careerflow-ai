import os
import io
import httpx
import requests
import trafilatura
import json
from typing import List  # <--- FIX: Added this for List[]
from fastapi import FastAPI, Form, File, UploadFile, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel 
from pypdf import PdfReader
import models 
from database import SessionLocal, engine, DRY_RUN_MODE, get_db
from datetime import datetime
from pypdf import PdfReader
from PyPDF2 import PdfReader
from fastapi.staticfiles import StaticFiles

# Create database tables if they don't exist yet
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="CareerFlow AI Gateway")

# --- CORS CONFIGURATION ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- PYDANTIC MODELS ---
class JobCreate(BaseModel):
    company: str
    title: str
    url: str | None = None
    description: str | None = None
    gmail_id: str | None = None

class TrackerCreate(BaseModel):
    gmail_id: str
    company: str
    role: str
    status: str
    required_skills: str

# Pydantic Schema for outgoing data
class TrackerResponse(TrackerCreate):
    id: int
    applied_at: datetime

    class Config:
        from_attributes = True

# --- DATABASE DEPENDENCY ---
# (Using the one imported from database.py or defined here)
def get_db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- UTILITY: WEB SCRAPER ---
async def scrape_job_description(url: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            headers = {"User-Agent": "Mozilla/5.0"}
            response = await client.get(url, headers=headers)
            return trafilatura.extract(response.text) or "No text found."
    except Exception as e:
        return f"Scrape Error: {str(e)}"

# --- JOB ENDPOINTS ---

@app.get("/api/dashboard/jobs")
def get_all_jobs(db: Session = Depends(get_db_session)):
    """Retrieves all jobs for the main feed."""
    return db.query(models.Job).order_by(models.Job.created_at.desc()).all()

@app.post("/jobs")
async def create_job(job_data: JobCreate, db: Session = Depends(get_db_session)):
    """Creates a new job and scrapes the URL if description is missing."""
    desc = job_data.description
    if job_data.url and not desc:
        desc = await scrape_job_description(job_data.url)
        
    new_job = models.Job(
        company=job_data.company, 
        title=job_data.title, 
        url=job_data.url,
        description=desc,
        gmail_id=job_data.gmail_id,
        status="Manual"
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    return new_job

@app.delete("/jobs/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db_session)):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    db.query(models.AnalysisResult).filter(models.AnalysisResult.job_id == job_id).delete()
    db.delete(job)
    db.commit()
    return {"message": "Job deleted"}

# --- RESUME ENDPOINTS ---

# 1. Setup Storage
UPLOAD_DIR = "uploads/resumes"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 2. Mount Static Files (Ensure this is only here once)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/resumes")
def get_resumes(db: Session = Depends(get_db_session)):
    return db.query(models.Resume).all()


@app.post("/resumes/upload")
async def upload_resume(
    name: str = Form(...), 
    file: UploadFile = File(...), 
    db: Session = Depends(get_db_session)
):
    try:
        # 1. Define filenames and paths
        safe_name = name.replace(" ", "_")
        filename = f"{safe_name}_{file.filename}"
        local_disk_path = os.path.join(UPLOAD_DIR, filename)
        
        # 2. Save file to disk
        file_content = await file.read()
        with open(local_disk_path, "wb") as buffer:
            buffer.write(file_content)
        
        # 3. Extract text for AI analysis
        # (Using PdfReader requires 'import io' and 'from PyPDF2 import PdfReader')
        from PyPDF2 import PdfReader
        import io
        
        reader = PdfReader(io.BytesIO(file_content))
        extracted_text = ""
        for page in reader.pages:
            extracted_text += page.extract_text() or ""

        # 4. Store the STATIC URL path in DB
        db_url = f"uploads/resumes/{filename}" 
        
        # 5. Create the Database Record
        # IMPORTANT: 'file_url' here MUST match 'file_url' in models.py
        new_resume = models.Resume(
            name=name, 
            content=extracted_text, 
            file_url=db_url  
        )
        
        db.add(new_resume)
        db.commit()
        db.refresh(new_resume)
        
        return {
            "message": "Upload successful", 
            "id": new_resume.id,
            "filename": filename
        }

    except Exception as e:
        db.rollback() # Rollback if DB fails
        print(f"ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Server Error: {str(e)}")

# --- ANALYSIS ENDPOINTS ---

@app.post("/jobs/{job_id}/analyze/{resume_id}")
def analyze(job_id: int, resume_id: int, db: Session = Depends(get_db_session)):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    resume = db.query(models.Resume).filter(models.Resume.id == resume_id).first()
    
    if not job or not resume:
        raise HTTPException(status_code=404, detail="Data not found")

    ai_url = "http://ai-engine:8000/analyze"
    try:
        res = requests.post(ai_url, json={
            "resume_text": resume.content,
            "job_description": job.description or "No description available.",
            "mock": DRY_RUN_MODE
        }, timeout=30)
        ai_data = res.json()

        new_res = models.AnalysisResult(
            job_id=job_id, 
            match_score=ai_data.get("match_score", 0),
            summary=json.dumps(ai_data.get("summary", ""))
        )
        db.add(new_res)
        db.commit()
        
        return {"ai_response": ai_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Engine error: {str(e)}")

@app.get("/results/{job_id}")
def get_results(job_id: int, db: Session = Depends(get_db_session)):
    return db.query(models.AnalysisResult)\
             .filter(models.AnalysisResult.job_id == job_id)\
             .order_by(models.AnalysisResult.id.asc())\
             .all()

# --- TRACKER ENDPOINTS ---

@app.get("/tracker/all", response_model=List[TrackerResponse])
def get_all_applications(db: Session = Depends(get_db)):
    """Fetches all tracked jobs from Gmail sync."""
    return db.query(models.TrackerJob).order_by(models.TrackerJob.applied_at.desc()).all()

@app.post("/tracker", response_model=TrackerResponse)
def create_application(application: TrackerCreate, db: Session = Depends(get_db)):
    """Creates a entry in the tracker table."""
    db_app = db.query(models.TrackerJob).filter(
        models.TrackerJob.gmail_id == application.gmail_id
    ).first()
    
    if db_app:
        return db_app
        
    new_app = models.TrackerJob(**application.model_dump())
    db.add(new_app)
    db.commit()
    db.refresh(new_app)
    return new_app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)