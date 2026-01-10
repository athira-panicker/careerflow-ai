import os
import time
import requests
import psycopg2
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

# --- CONFIGURATION ---
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']
# Ensure this matches your AI Engine's port (usually 8000 or 5000)
AI_ENGINE_URL = os.getenv("AI_ENGINE_URL", "http://ai-engine:8000/process")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@db:5432/careerflow_db")

def get_gmail_service():
    creds = None
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            raise Exception("token.json missing! Run locally to generate it.")
    return build('gmail', 'v1', credentials=creds)

def save_to_db(job_data, gmail_id):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        # Using 'title' to match your Gateway/Models
        query = """
            INSERT INTO jobs (company, title, gmail_id, status, created_at)
            VALUES (%s, %s, %s, 'Applied', NOW())
            ON CONFLICT (gmail_id) DO NOTHING;
        """
        cur.execute(query, (job_data['company'], job_data.get('role', 'Job Applicant'), gmail_id))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ DB Error: {e}")

def run_agent_cycle():
    """Main logic to fetch emails and process them."""
    print("🕵️ Syncing with Gmail...")
    service = get_gmail_service()
    
    # Broad search for application emails
    query = 'subject:("application received" OR "thank you for applying" OR "applied")'
    results = service.users().messages().list(userId='me', q=query, maxResults=10).execute()
    messages = results.get('messages', [])

    if not messages:
        print("Empty handed: No job emails found.")
        return

    for msg in messages:
        details = service.users().messages().get(userId='me', id=msg['id']).execute()
        snippet = details.get('snippet')
        
        try:
            res = requests.post(AI_ENGINE_URL, json={"text": snippet})
            if res.status_code == 200:
                job_info = res.json()
                save_to_db(job_info, msg['id'])
                print(f"✅ Added: {job_info['company']}")
        except Exception as e:
            print(f"❌ AI-Engine call failed: {e}")

def setup_database():
    """Wait for DB to be ready and verify the table exists."""
    print("⏳ Attempting to connect to database...")
    while True:
        try:
            conn = psycopg2.connect(DATABASE_URL)
            cur = conn.cursor()
            cur.execute("""
                CREATE TABLE IF NOT EXISTS jobs (
                    id SERIAL PRIMARY KEY,
                    company VARCHAR(255),
                    title VARCHAR(255), 
                    gmail_id VARCHAR(255) UNIQUE,
                    description TEXT,
                    url VARCHAR(255),
                    status VARCHAR(50) DEFAULT 'Applied',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """)
            conn.commit()
            cur.close()
            conn.close()
            print("🚀 Database is ready and table is verified.")
            break
        except Exception as e:
            print(f"⏳ Waiting for DB to wake up... (Retry in 2s)")
            time.sleep(2)

if __name__ == "__main__":
    setup_database()
    print("[INFO] Gmail Agent Container Started")
    while True:
        try:
            run_agent_cycle()
        except Exception as e:
            print(f"[ERROR] Cycle failed: {e}")
        
        print("[IDLE] Sleeping for 30 minutes...")
        time.sleep(1800)