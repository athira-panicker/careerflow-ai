import { useState, useEffect } from 'react';

export default function Home() {
  // --- 1. STATE MANAGEMENT ---
  const [jobs, setJobs] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [results, setResults] = useState({}); 
  const [expandedJob, setExpandedJob] = useState(null);
  
  const [jobForm, setJobForm] = useState({ company: '', title: '', url: '' });
  const [resumeName, setResumeName] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [selectedResumes, setSelectedResumes] = useState({});
  const [loadingId, setLoadingId] = useState(null);

  const API_URL = "http://localhost:8000";

  // --- 2. DATA SYNCHRONIZATION ---
  const fetchData = async () => {
    try {
      // Aligned with main.py endpoints
      const [jobsRes, resumesRes] = await Promise.all([
        fetch(`${API_URL}/api/dashboard/jobs`),
        fetch(`${API_URL}/resumes`)
      ]);

      const jobsData = await jobsRes.json();
      const resumesData = await resumesRes.json();

      setJobs(Array.isArray(jobsData) ? jobsData : []);
      setResumes(Array.isArray(resumesData) ? resumesData : []);

      // Load matching history for each job
      if (Array.isArray(jobsData)) {
        jobsData.forEach(async (job) => {
          try {
            const res = await fetch(`${API_URL}/results/${job.id}`);
            const history = await res.json();
            if (Array.isArray(history) && history.length > 0) {
              // Store the most recent result for the dashboard
              setResults(prev => ({ ...prev, [job.id]: history[history.length - 1] }));
            }
          } catch (e) { console.warn(`No history for job ${job.id}`); }
        });
      }
    } catch (err) {
      console.error("Connection to backend failed. Check if FastAPI is running on port 8000.");
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- 3. EVENT HANDLERS ---
  const handleResumeUpload = async (e) => {
    e.preventDefault();
    if (!resumeFile || !resumeName) return alert("Select a file and provide a label.");

    const formData = new FormData();
    formData.append("file", resumeFile);

    try {
      // Matches your main.py: /resumes/upload?name=...
      const res = await fetch(`${API_URL}/resumes/upload?name=${encodeURIComponent(resumeName)}`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setResumeName("");
        setResumeFile(null);
        e.target.reset(); // Clear file input
        fetchData();
        alert("Resume Uploaded!");
      }
    } catch (err) { alert("Upload failed."); }
  };

  const handleJobSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${API_URL}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobForm),
      });
      setJobForm({ company: '', title: '', url: '' });
      fetchData();
    } catch (err) { alert("Job save failed."); }
  };

  const handleAnalyze = async (jobId) => {
    const resumeId = selectedResumes[jobId];
    if (!resumeId) return alert("Select a resume first!");
    
    setLoadingId(jobId);
    try {
      const res = await fetch(`${API_URL}/jobs/${jobId}/analyze/${resumeId}`, { method: 'POST' });
      const data = await res.json();
      setResults(prev => ({ ...prev, [jobId]: data.ai_response }));
    } catch (err) { alert("AI Analysis failed."); } 
    finally { setLoadingId(null); }
  };

  const handleDeleteJob = async (id) => {
    if (!confirm("Delete this job?")) return;
    await fetch(`${API_URL}/jobs/${id}`, { method: 'DELETE' });
    fetchData();
  };

  // --- 4. RENDER ---
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>🚀 CareerFlow AI</h1>
        <p>Your AI-powered resume match dashboard.</p>
      </header>

      <div style={styles.gridSplit}>
        {/* RESUME VAULT */}
        <section style={styles.section}>
          <h3>📄 Resume Vault</h3>
          <form onSubmit={handleResumeUpload} style={styles.form}>
            <input 
              style={styles.input} 
              placeholder="Label (e.g. Software Eng v1)" 
              value={resumeName} 
              onChange={e => setResumeName(e.target.value)} 
              required 
            />
            <input 
              type="file" 
              accept=".pdf" 
              onChange={e => setResumeFile(e.target.files[0])} 
              required 
            />
            <button type="submit" style={styles.btnPrimary}>Upload PDF</button>
          </form>
          <div style={styles.tagList}>
            {resumes.map(r => (
              <span key={r.id} style={styles.tag}>📎 {r.name}</span>
            ))}
          </div>
        </section>

        {/* JOB ENTRY */}
        <section style={styles.section}>
          <h3>💼 Add New Job</h3>
          <form onSubmit={handleJobSubmit} style={styles.form}>
            <input style={styles.input} placeholder="Company" value={jobForm.company} onChange={e => setJobForm({...jobForm, company: e.target.value})} required />
            <input style={styles.input} placeholder="Job Title" value={jobForm.title} onChange={e => setJobForm({...jobForm, title: e.target.value})} required />
            <input style={styles.input} placeholder="Job URL" value={jobForm.url} onChange={e => setJobForm({...jobForm, url: e.target.value})} />
            <button type="submit" style={styles.btnSecondary}>Add Job</button>
          </form>
        </section>
      </div>

      <hr style={styles.divider} />

      {/* JOB LISTINGS FEED */}
      <div style={styles.feed}>
        {jobs.length === 0 && <p style={{textAlign: 'center', color: '#999'}}>No jobs tracked yet. Add one above!</p>}
        {jobs.map(job => (
          <div key={job.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={{margin: 0}}>{job.title}</h2>
                <p style={{color: '#0070f3', fontWeight: 'bold', margin: '5px 0'}}>{job.company}</p>
                {job.url && <a href={job.url} target="_blank" style={styles.jobLink}>🔗 View Listing</a>}
              </div>
              <button onClick={() => handleDeleteJob(job.id)} style={styles.btnDelete}>Delete</button>
            </div>

            <div style={styles.actionRow}>
              <select 
                style={styles.select}
                onChange={(e) => setSelectedResumes(p => ({...p, [job.id]: e.target.value}))}
                value={selectedResumes[job.id] || ""}
              >
                <option value="">-- Choose Resume --</option>
                {resumes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button 
                onClick={() => handleAnalyze(job.id)} 
                style={styles.btnPrimary}
                disabled={loadingId === job.id}
              >
                {loadingId === job.id ? '🔄 Processing...' : 'AI Match'}
              </button>
            </div>

            {results[job.id] && (
              <div style={styles.resultBox}>
                <div style={styles.score}>Match Score: {results[job.id].match_score}%</div>
                <div style={styles.summary}>
                  {/* Safely display summary whether it's an object or string */}
                  {typeof results[job.id].summary === 'string' 
                    ? results[job.id].summary 
                    : JSON.stringify(results[job.id].summary)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// --- STYLES ---
const styles = {
  container: { maxWidth: '1100px', margin: '0 auto', padding: '40px 20px', fontFamily: 'system-ui, sans-serif', backgroundColor: '#f9f9f9', minHeight: '100vh' },
  header: { textAlign: 'center', marginBottom: '40px' },
  gridSplit: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '25px' },
  section: { background: '#fff', padding: '25px', borderRadius: '15px', border: '1px solid #eee' },
  form: { display: 'flex', flexDirection: 'column', gap: '12px' },
  input: { padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' },
  btnPrimary: { padding: '12px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  btnSecondary: { padding: '12px', background: '#111', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  tagList: { marginTop: '15px', display: 'flex', flexWrap: 'wrap', gap: '8px' },
  tag: { fontSize: '12px', padding: '5px 10px', background: '#f0f0f0', border: '1px solid #ddd', borderRadius: '5px' },
  divider: { margin: '40px 0', border: 'none', borderTop: '1px solid #eee' },
  feed: { display: 'grid', gap: '25px' },
  card: { background: '#fff', padding: '30px', borderRadius: '20px', border: '1px solid #eee', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  jobLink: { fontSize: '13px', color: '#0070f3', textDecoration: 'none' },
  btnDelete: { background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: '13px' },
  actionRow: { display: 'flex', gap: '15px', marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '10px' },
  select: { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd' },
  resultBox: { marginTop: '20px', padding: '20px', background: '#e6f3ff', borderRadius: '10px', borderLeft: '5px solid #0070f3' },
  score: { fontWeight: 'bold', fontSize: '18px', color: '#0070f3', marginBottom: '10px' },
  summary: { fontSize: '14px', lineHeight: '1.5', color: '#444' }
};