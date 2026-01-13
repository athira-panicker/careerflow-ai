import os
import json
from openai import OpenAI
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="CareerFlow AI Engine")

# --- SCHEMAS ---
class AnalysisRequest(BaseModel):
    resume_text: str
    job_description: str
    mock: bool = False

class EmailPayload(BaseModel):
    text: str

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# --- FEATURE 3: RESUME ANALYSIS ---
@app.post("/analyze")
def analyze_job(request: AnalysisRequest):
    if request.mock:
        return {
            "match_score": 78,
            "summary": "MOCK MODE: Strengths: Strong technical background. Gaps: Needs Cloud experience."
        }

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert recruiter. Output ONLY valid JSON."},
                {"role": "user", "content": f"Analyze resume: {request.resume_text} against JD: {request.job_description}. Return JSON with 'match_score' (0-100) and 'summary'."}
            ],
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- FEATURE 4: GMAIL TRACKER EXTRACTION ---
@app.post("/process")
async def process_email(payload: EmailPayload):
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OpenAI API Key is missing.")

    try:
        prompt = f"""
        Analyze this job application email snippet and extract tracking details.
        
        Email Snippet: {payload.text}
        
        Rules:
        1. 'status': If the email says "applied" or "received", use 'Applied'. If it mentions "interview", "chat", or "call", use 'Interview'. If it says "not moving forward" or "thank you for your interest but...", use 'Rejected'.
        2. 'skills': Extract 3 technical skills mentioned. If none, list 3 common skills for this role type.
        3. Output MUST be a JSON object.

        JSON structure:
        {{
            "company": "Company Name",
            "role": "Job Title",
            "status": "Applied | Interview | Rejected",
            "skills": "Skill 1, Skill 2, Skill 3"
        }}
        """

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a data extraction assistant. Output ONLY valid JSON."},
                {"role": "user", "content": prompt}
            ],
            response_format={ "type": "json_object" }
        )

        return json.loads(response.choices[0].message.content)

    except Exception as e:
        print(f"Error processing AI: {e}")
        raise HTTPException(status_code=500, detail="AI Extraction failed")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)