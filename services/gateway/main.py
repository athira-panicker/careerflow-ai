import os
import io
import httpx
import requests
import trafilatura
import json
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel 
from pypdf import PdfReader

# Local imports for Database configuration and ORM Models
import models 
from database import SessionLocal, engine, DRY_RUN_MODE

# Create database tables if they don't exist yet
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="CareerFlow AI Gateway")

# --- CORS CONFIGURATION ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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

# --- DATABASE DEPENDENCY ---
def get_db():
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

# --- ENDPOINTS ---

@app.get("/api/dashboard/jobs")
def get_all_jobs(db: Session = Depends(get_db)):
    """Retrieves all jobs for the main feed."""
    return db.query(models.Job).order_by(models.Job.created_at.desc()).all()

@app.post("/jobs")
async def create_job(job_data: JobCreate, db: Session = Depends(get_db)):
    """Creates a new job and scrapes the URL if description is missing."""
    desc = job_data.description
    if job_data.url and not desc:
        desc = await scrape_job_description(job_data.url)
        
    new_job = models.Job(
        company=job_data.company, 
        title=job_data.title, 
        url=job_data.url,
        description=desc,
        status="Manual"
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    return new_job

@app.delete("/jobs/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    db.query(models.AnalysisResult).filter(models.AnalysisResult.job_id == job_id).delete()
    db.delete(job)
    db.commit()
    return {"message": "Job deleted"}

# --- RESUME ENDPOINTS ---

@app.get("/resumes")
def get_resumes(db: Session = Depends(get_db)):
    """NEW: Fetches all resumes so they show up in the frontend list."""
    return db.query(models.Resume).all()

@app.post("/resumes/upload")
async def upload_resume(name: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Accepts PDF, extracts text, and saves to DB."""
    try:
        contents = await file.read()
        reader = PdfReader(io.BytesIO(contents))
        text = "".join([p.extract_text() for p in reader.pages])
        
        new_resume = models.Resume(name=name, content=text)
        db.add(new_resume)
        db.commit()
        db.refresh(new_resume)
        return {"message": "Upload successful", "id": new_resume.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF Processing Error: {str(e)}")

# --- ANALYSIS ENDPOINTS ---

@app.post("/jobs/{job_id}/analyze/{resume_id}")
def analyze(job_id: int, resume_id: int, db: Session = Depends(get_db)):
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
            summary=json.dumps(ai_data.get("summary", "")) # Store as string
        )
        db.add(new_res)
        db.commit()
        
        return {"ai_response": ai_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Engine error: {str(e)}")

@app.get("/results/{job_id}")
def get_results(job_id: int, db: Session = Depends(get_db)):
    return db.query(models.AnalysisResult)\
             .filter(models.AnalysisResult.job_id == job_id)\
             .order_by(models.AnalysisResult.id.asc())\
             .all()