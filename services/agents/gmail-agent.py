import os
import time
import requests
import pickle
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

# Configuration
# NOTE: Use 'gateway' and 'ai-engine' for Docker networking. 
# If running locally for the first time to get the token, change these to 'localhost'
GATEWAY_URL = os.getenv("GATEWAY_URL", "http://gateway:8000/tracker")
AI_ENGINE_URL = os.getenv("AI_ENGINE_URL", "http://ai-engine:8000/process")
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

def get_gmail_service():
    creds = None
    # 1. Look for the "Passport" (token.pickle)
    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)

    # 2. If no valid credentials, we need to authenticate
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            # Check if credentials.json exists before creating the flow
            if not os.path.exists('credentials.json'):
                raise FileNotFoundError("credentials.json not found! Please download it from Google Cloud Console.")

            # FIX: Properly define the flow before calling run_local_server
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            
            try:
                # This opens the browser. MUST BE RUN LOCALLY FIRST.
                creds = flow.run_local_server(port=0)
            except Exception as e:
                print("❌ Could not open browser. If you are in Docker, generate token.pickle locally first.")
                raise e
        
        # 3. Save the token so we don't have to log in again
        with open('token.pickle', 'wb') as token:
            pickle.dump(creds, token)
    
    return build('gmail', 'v1', credentials=creds)

def run_active_sync():
    try:
        service = get_gmail_service()
        
        # Active search for application-related keywords
        query = 'subject:("application" OR "received" OR "update" OR "interview" OR "unfortunately")'
        results = service.users().messages().list(userId='me', q=query, maxResults=10).execute()
        messages = results.get('messages', [])

        if not messages:
            print("No new relevant emails found.")
            return

        for msg in messages:
            msg_id = msg['id']
            message = service.users().messages().get(userId='me', id=msg_id).execute()
            snippet = message.get('snippet', '')

            # 1. Active AI Extraction
            try:
                ai_res = requests.post(AI_ENGINE_URL, json={"text": snippet})
                if ai_res.status_code == 200:
                    data = ai_res.json()
                    
                    # 2. Push to Tracker Table
                    payload = {
                        "gmail_id": msg_id,
                        "company": data.get("company", "Unknown"),
                        "role": data.get("role", "Unknown"),
                        "status": data.get("status", "Applied"),
                        "required_skills": data.get("skills", "N/A")
                    }
                    
                    res = requests.post(GATEWAY_URL, json=payload)
                    if res.status_code == 200:
                        print(f"✅ Synced: {payload['company']} | Status: {payload['status']}")
                    else:
                        print(f"⚠️ Gateway rejected data: {res.status_code}")
            except Exception as e:
                print(f"❌ Error talking to AI Engine or Gateway: {e}")

    except Exception as e:
        print(f"❌ Gmail Sync Failed: {e}")

if __name__ == "__main__":
    print("🚀 Active Gmail Agent is starting...")
    while True:
        run_active_sync()
        print("😴 Sleeping for 15 minutes...")
        time.sleep(900)