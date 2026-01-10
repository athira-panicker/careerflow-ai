from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func 
from database import Base

class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    company = Column(String)
    title = Column(String)  # This matches 'title' in your Gateway
    gmail_id = Column(String, unique=True, nullable=True)
    description = Column(Text, nullable=True)
    url = Column(String, nullable=True)
    status = Column(String, default="Applied")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Resume(Base):
    __tablename__ = "resumes"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    content = Column(Text)

class AnalysisResult(Base):
    __tablename__ = "analysis_results"
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"))
    match_score = Column(Integer)
    summary = Column(Text)