import time
import requests
import schedule
import smtplib
import pytz
from datetime import datetime
from collections import Counter
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Configuration
TRACKER_API_URL = "http://gateway:8000/tracker/all"
GMAIL_USER = os.getenv("GMAIL_USER")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")
RECIPIENT_EMAIL = os.getenv("RECIPIENT_EMAIL")

def send_email(subject, body):
    try:
        msg = MIMEMultipart()
        msg['From'] = GMAIL_USER
        msg['To'] = RECIPIENT_EMAIL
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))

        # Standard Gmail SMTP settings
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls() # Secure the connection
        server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        server.send_message(msg)
        server.quit()
        print("✅ Email sent successfully!")
    except Exception as e:
        print(f"❌ Failed to send email: {e}")

def generate_and_send_report():
    chicago_tz = pytz.timezone('America/Chicago')
    now_chicago = datetime.now(chicago_tz)
    today = now_chicago.date()
    
    print(f"🕒 Generating daily report for Chicago Date: {today}...")
    
    try:
        response = requests.get(TRACKER_API_URL)
        if response.status_code != 200:
            print("Failed to fetch tracker data")
            return
            
        all_jobs = response.json()
        
        today_apps = []
        for job in all_jobs:
            # Match against Chicago's "Today"
            job_date = job['applied_at'].split('T')[0] 
            if job_date == str(today):
                today_apps.append(job)

        if not today_apps:
            print("No applications found for today. Skipping report.")
            return

        role_counts = Counter([j.get('role', 'Unknown') for j in today_apps])
        rejections = len([j for j in today_apps if j.get('status') == "Rejected"])
        
        # Build Email Content
        subject = f"CareerFlow Daily Summary - {today}"
        report_lines = [
            f"Daily Application Summary: {today}",
            f"----------------------------------",
            f"Total Applications Today: {len(today_apps)}",
            f"Total Rejections Today: {rejections}",
            f"\nBreakdown by Position:"
        ]
        
        for role, count in role_counts.items():
            report_lines.append(f"- {role}: {count} {'role' if count == 1 else 'roles'}")

        final_body = "\n".join(report_lines)
        
        # 5. SEND THE EMAIL
        send_email(subject, final_body)

    except Exception as e:
        print(f"❌ Error generating report: {e}")

# Set the schedule for 8:50 PM
schedule.every().day.at("20:50").do(generate_and_send_report)

if __name__ == "__main__":
    chicago_tz = pytz.timezone('America/Chicago')
    current_time = datetime.now(chicago_tz).strftime("%H:%M:%S")
    print(f"📅 Report Worker Active (Chicago Time: {current_time}). Waiting for 20:50...")
    while True:
        schedule.run_pending()
        time.sleep(60)