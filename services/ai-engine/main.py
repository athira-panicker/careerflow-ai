import os
import json
from openai import OpenAI
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="CareerFlow AI Engine (OpenAI Edition)")

class AnalysisRequest(BaseModel):
    resume_text: str
    job_description: str
    mock: bool = False

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@app.post("/analyze")
def analyze_job(request: AnalysisRequest):
    print(f"Received request: mock={request.mock}")

    # --- MOCK LOGIC (Updated for Quality) ---
    if request.mock is True:
        return {
            "match_score": 78,
            "summary": "MOCK MODE: Strengths: Strong technical background. Gaps: Needs more Cloud experience. Action: Add AWS certification to your header."
        }

    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OpenAI API Key is missing.")

    try:
        # --- OPTION A: REFINED PROMPT ---
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system", 
                    "content": (
                        "You are an expert technical recruiter. Your task is to analyze resumes against job descriptions "
                        "with high precision. You must output ONLY valid JSON."
                    )
                },
                {
                    "role": "user", 
                    "content": f"""
                        Analyze this resume against the job description.
                        
                        Return a JSON object with exactly these two keys:
                        1. "match_score": A number between 0 and 100.
                        2. "summary": A concise analysis including:
                           - Strongest match point.
                           - Top 3 missing keywords/skills.
                           - One specific 'Action Plan' sentence to improve the resume for this role.

                        RESUME:
                        {request.resume_text}

                        JOB DESCRIPTION:
                        {request.job_description}
                    """
                }
            ],
            response_format={"type": "json_object"}
        )

        return json.loads(response.choices[0].message.content)

    except Exception as e:
        print(f"ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=f"OpenAI Error: {str(e)}")