import os
import io
import httpx
import requests
import trafilatura
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel 
from pypdf import PdfReader
import json

import models 
from database import SessionLocal, engine, DRY_RUN_MODE

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="CareerFlow AI Gateway")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATA MODELS ---
class JobCreate(BaseModel):
    company: str
    title: str
    url: str | None = None
    description: str | None = None

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- SCRAPER LOGIC ---
async def scrape_job_description(url: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            headers = {"User-Agent": "Mozilla/5.0"}
            response = await client.get(url, headers=headers)
            return trafilatura.extract(response.text) or "No text found."
    except Exception as e:
        return f"Scrape Error: {str(e)}"

# --- ENDPOINTS ---

@app.get("/jobs")
def get_all_jobs(db: Session = Depends(get_db)):
    return db.query(models.Job).all()

@app.post("/jobs")
async def create_job(job_data: JobCreate, db: Session = Depends(get_db)):
    desc = job_data.description
    if job_data.url and not desc:
        desc = await scrape_job_description(job_data.url)
    new_job = models.Job(company=job_data.company, title=job_data.title, description=desc)
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    return new_job

@app.delete("/jobs/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db)):
    # 1. Find the job
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # 2. DELETE THE HISTORY FIRST (Crucial Fix)
    # This removes the foreign key references so the DB is happy
    db.query(models.AnalysisResult).filter(models.AnalysisResult.job_id == job_id).delete()
    
    # 3. Now delete the job
    db.delete(job)
    db.commit()
    return {"message": "Job and history deleted successfully"}

@app.get("/resumes")
def get_resumes(db: Session = Depends(get_db)):
    return db.query(models.Resume).all()

@app.post("/resumes/upload")
async def upload_resume(name: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    contents = await file.read()
    reader = PdfReader(io.BytesIO(contents))
    text = "".join([p.extract_text() for p in reader.pages])
    new_resume = models.Resume(name=name, content=text)
    db.add(new_resume)
    db.commit()
    return {"message": "Uploaded"}

@app.get("/results/{job_id}")
def get_results(job_id: int, db: Session = Depends(get_db)):
    # LOGIC: Returns history for the specific job card
    return db.query(models.AnalysisResult)\
             .filter(models.AnalysisResult.job_id == job_id)\
             .order_by(models.AnalysisResult.id.asc())\
             .all()

@app.post("/jobs/{job_id}/analyze/{resume_id}")
def analyze(job_id: int, resume_id: int, db: Session = Depends(get_db)):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    resume = db.query(models.Resume).filter(models.Resume.id == resume_id).first()
    
    
    # NEW LOGIC: Injecting the "Expert Recruiter" instructions here
    enhanced_instruction = (
        "Analyze as an expert recruiter. Provide a score and a summary including: "
        "Top 3 missing keywords, strongest match point, and one resume improvement tip."
    )

    ai_url = "http://ai-engine:8000/analyze"
    res = requests.post(ai_url, json={
        "resume_text": resume.content,
        "job_description": job.description,
        "instruction": enhanced_instruction, # Passing the new 'Brain' logic
        "mock": DRY_RUN_MODE
    })
    
    ai_data = res.json()


    raw_summary = ai_data.get("summary", "")
    
    # If the AI sent back a dict (which it does now with our new prompt),
    # we turn it into a readable string for the database.
    if isinstance(raw_summary, dict):
        formatted_summary = (
            f"STRENGTH: {raw_summary.get('strongest_match_point', 'N/A')}\n\n"
            f"GAPS: {', '.join(raw_summary.get('top_3_missing_keywords', []))}\n\n"
            f"ACTION: {raw_summary.get('action_plan', 'N/A')}"
        )
    else:
        formatted_summary = str(raw_summary)

    # SAVE TO HISTORY
    new_res = models.AnalysisResult(
        job_id=job_id, 
        match_score=ai_data.get("match_score", 0),
        summary=formatted_summary # Now it's a string!
    )
    db.add(new_res)
    db.commit()
    
    return {"ai_response": ai_data}