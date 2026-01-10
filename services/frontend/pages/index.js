import { useState, useEffect } from 'react';

export default function Home() {
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

  const fetchData = async () => {
    try {
      const [jobsRes, resumesRes] = await Promise.all([
        fetch(`${API_URL}/jobs`),
        fetch(`${API_URL}/resumes`)
      ]);
      const jobsData = await jobsRes.json();
      setJobs(jobsData);
      setResumes(await resumesRes.json());

      // Load History for each job
      jobsData.forEach(async (job) => {
        const res = await fetch(`${API_URL}/results/${job.id}`);
        const history = await res.json();
        if (history.length > 0) {
          // Take the most recent result
          setResults(prev => ({ ...prev, [job.id]: history[history.length - 1] }));
        }
      });
    } catch (err) { console.error("Sync Error", err); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAnalyze = async (jobId) => {
    const resumeId = selectedResumes[jobId];
    if (!resumeId) return alert("Please select a resume first!");
    setLoadingId(jobId);
    try {
      const res = await fetch(`${API_URL}/jobs/${jobId}/analyze/${resumeId}`, { method: 'POST' });
      const data = await res.json();
      setResults(prev => ({ ...prev, [jobId]: data.ai_response }));
    } catch (err) {
      alert("Analysis failed. Ensure AI-Engine is running.");
    } finally { setLoadingId(null); }
  };

  const handleDeleteJob = async (jobId) => {
    if(!confirm("Are you sure you want to delete this job and its history?")) return;
    await fetch(`${API_URL}/jobs/${jobId}`, { method: 'DELETE' });
    fetchData();
  };

  const handleJobSubmit = async (e) => {
    e.preventDefault();
    await fetch(`${API_URL}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobForm),
    });
    setJobForm({ company: '', title: '', url: '' });
    fetchData();
  };

  const handleResumeUpload = async (e) => {
    e.preventDefault();
    if (!resumeFile) return;
    const formData = new FormData();
    formData.append("file", resumeFile);
    await fetch(`${API_URL}/resumes/upload?name=${encodeURIComponent(resumeName)}`, { method: 'POST', body: formData });
    setResumeName(""); setResumeFile(null);
    fetchData();
  };

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <div style={{fontSize: '3rem'}}>🚀</div>
        <h1 style={{ margin: '10px 0' }}>CareerFlow AI</h1>
        <p style={{ color: '#666' }}>Optimize your resume with AI-driven checklists.</p>
      </header>

      <div style={gridSplit}>
        {/* SECTION 1: RESUME MANAGEMENT */}
        <section style={sectionStyle}>
          <h2 style={sectionTitle}>📄 Resume Vault</h2>
          <form onSubmit={handleResumeUpload} style={formCol}>
            <input style={inputStyle} placeholder="Resume Label (e.g. Data Science v1)" value={resumeName} onChange={e => setResumeName(e.target.value)} required />
            <input type="file" accept=".pdf" onChange={e => setResumeFile(e.target.files[0])} required />
            <button type="submit" style={btnPrimary}>Upload PDF</button>
          </form>
          <div style={tagContainer}>
            {resumes.map(r => <span key={r.id} style={tagStyle}>📎 {r.name}</span>)}
          </div>
        </section>

        {/* SECTION 2: JOB TRACKER */}
        <section style={sectionStyle}>
          <h2 style={sectionTitle}>💼 New Opportunity</h2>
          <form onSubmit={handleJobSubmit} style={formCol}>
            <input style={inputStyle} placeholder="Company Name" value={jobForm.company} onChange={e => setJobForm({...jobForm, company: e.target.value})} required />
            <input style={inputStyle} placeholder="Job Title" value={jobForm.title} onChange={e => setJobForm({...jobForm, title: e.target.value})} required />
            <input style={inputStyle} placeholder="Paste Job URL" value={jobForm.url} onChange={e => setJobForm({...jobForm, url: e.target.value})} required />
            <button type="submit" style={btnSecondary}>Add & Scrape</button>
          </form>
        </section>
      </div>

      <hr style={divider} />

      {/* SECTION 3: JOB CARDS & AI FEEDBACK */}
      <div style={{ display: 'grid', gap: '30px' }}>
        {jobs.map(job => (
          <div key={job.id} style={cardStyle}>
            <div style={cardHeader}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.5rem' }}>{job.title}</h3>
                <p style={{ color: '#0070f3', fontWeight: 'bold', fontSize: '1.1rem' }}>{job.company}</p>
                <button 
                  onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                  style={btnGhost}
                >
                  {expandedJob === job.id ? '🔼 Hide Scraped Text' : '👁️ View Scraped Text'}
                </button>
              </div>
              <button onClick={() => handleDeleteJob(job.id)} style={btnDelete}>Delete</button>
            </div>

            {expandedJob === job.id && (
              <div style={scrapedBox}>{job.description || "Scraper could not find text."}</div>
            )}
            
            <div style={actionRow}>
              <select 
                style={selectStyle} 
                onChange={(e) => setSelectedResumes(p => ({...p, [job.id]: e.target.value}))}
                value={selectedResumes[job.id] || ""}
              >
                <option value="">-- Choose a Resume --</option>
                {resumes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button 
                onClick={() => handleAnalyze(job.id)} 
                style={btnPrimary} 
                disabled={loadingId === job.id}
              >
                {loadingId === job.id ? '🔄 Analyzing...' : 'Analyze Match'}
              </button>
            </div>

            {results[job.id] && (
              <div style={resultBox}>
                <div style={resultHeader}>
                  <div style={scoreCircle}>
                    <span style={{fontSize: '0.8rem', color: '#666', display: 'block'}}>Score</span>
                    {results[job.id].match_score}%
                  </div>
                  <div style={{flex: 1, marginLeft: '20px'}}>
                    <span style={badgeStyle}>AI RECOMMENDATIONS</span>
                    <p style={{marginTop: '8px', fontWeight: '500'}}>{typeof results[job.id].summary === 'string' ? 'Previous Result' : 'Smart Analysis Ready'}</p>
                  </div>
                </div>

                {/* SPRINT 4: INTEGRATED CHECKLIST */}
                <div style={analysisGrid}>
                    <div style={analysisCol}>
                        <p><strong>🌟 Top Strength</strong></p>
                        <p style={{fontSize: '0.9rem'}}>{results[job.id].summary.strongest_match_point || results[job.id].summary}</p>
                    </div>

                    <div style={checklistCol}>
                        <p><strong>📋 Resume Edit Checklist</strong></p>
                        <div style={checklistContainer}>
                            {/* Skill Gaps Mapping */}
                            {(() => {
                                const gaps = results[job.id].summary.skill_gaps || 
                                             results[job.id].summary['top_3_missing_keywords/skills'] || 
                                             results[job.id].summary['top_3_missing_keywords'];
                                
                                if (!gaps) return <p style={{fontSize: '0.8rem'}}>No gaps found!</p>;
                                
                                const gapsArray = Array.isArray(gaps) ? gaps : [gaps];
                                
                                return gapsArray.map((gap, i) => (
                                    <label key={i} style={checkItem}>
                                        <input type="checkbox" style={{marginRight: '10px'}} />
                                        <span>Add keywords for: <strong>{gap}</strong></span>
                                    </label>
                                ));
                            })()}

                            {/* Action Plan Item */}
                            {results[job.id].summary.action_plan && (
                                <label style={checkItemHighlight}>
                                    <input type="checkbox" style={{marginRight: '10px'}} />
                                    <span>{results[job.id].summary.action_plan}</span>
                                </label>
                            )}
                        </div>
                    </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// STYLES - REFINED FOR SPRINT 4
const containerStyle = { maxWidth: '1200px', margin: '0 auto', padding: '50px 20px', fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif', backgroundColor: '#f4f7f9', minHeight: '100vh' };
const headerStyle = { textAlign: 'center', marginBottom: '60px' };
const betaBadge = { fontSize: '12px', verticalAlign: 'middle', background: '#000', color: '#fff', padding: '2px 8px', borderRadius: '4px', marginLeft: '10px' };
const gridSplit = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px' };
const sectionStyle = { background: '#fff', padding: '30px', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #e1e8ed' };
const sectionTitle = { fontSize: '1.2rem', marginBottom: '20px', color: '#333' };
const formCol = { display: 'flex', flexDirection: 'column', gap: '15px' };
const inputStyle = { padding: '15px', borderRadius: '12px', border: '1px solid #d1d9e0', fontSize: '14px', outline: 'none' };
const btnPrimary = { padding: '15px 25px', borderRadius: '12px', border: 'none', background: '#0070f3', color: 'white', fontWeight: 'bold', cursor: 'pointer' };
const btnSecondary = { padding: '15px 25px', borderRadius: '12px', border: 'none', background: '#1a1a1a', color: 'white', fontWeight: 'bold', cursor: 'pointer' };
const divider = { margin: '50px 0', borderColor: '#e1e8ed', opacity: 0.5 };
const tagContainer = { marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '8px' };
const tagStyle = { padding: '6px 12px', background: '#f0f4f8', borderRadius: '8px', fontSize: '12px', color: '#475569', border: '1px solid #cbd5e1' };
const cardStyle = { padding: '40px', borderRadius: '24px', border: '1px solid #e1e8ed', background: 'white', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' };
const cardHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' };
const btnDelete = { background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: '13px' };
const btnGhost = { background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', marginTop: '10px', color: '#64748b' };
const scrapedBox = { background: '#1e293b', padding: '20px', borderRadius: '15px', fontSize: '13px', color: '#e2e8f0', marginTop: '15px', maxHeight: '200px', overflowY: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace' };
const actionRow = { display: 'flex', alignItems: 'center', gap: '15px', marginTop: '30px', padding: '20px', background: '#f1f5f9', borderRadius: '15px' };
const selectStyle = { padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', flex: 1, fontSize: '14px' };
const resultBox = { marginTop: '30px', padding: '30px', background: '#fff', borderRadius: '20px', border: '2px solid #0070f3', boxShadow: '0 10px 30px rgba(0,112,243,0.1)' };
const resultHeader = { display: 'flex', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #eee', paddingBottom: '20px' };
const scoreCircle = { width: '80px', height: '80px', borderRadius: '50%', border: '4px solid #0070f3', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.5rem', color: '#0070f3' };
const badgeStyle = { fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', color: '#0070f3', background: '#e6f0ff', padding: '4px 8px', borderRadius: '4px' };
const analysisGrid = { display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '30px' };
const analysisCol = { padding: '15px', background: '#f8fafc', borderRadius: '12px' };
const checklistCol = { padding: '15px' };
const checklistContainer = { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' };
const checkItem = { display: 'flex', alignItems: 'center', padding: '10px', borderRadius: '8px', background: '#fff', border: '1px solid #e2e8f0', fontSize: '0.85rem', cursor: 'pointer' };
const checkItemHighlight = { ...checkItem, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' };