import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  const [jobs, setJobs] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [results, setResults] = useState({});
  const [stats, setStats] = useState({ total: 0, today: 0 });
  const [jobForm, setJobForm] = useState({ company: '', title: '', url: '' });
  const [resumeName, setResumeName] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [selectedResumes, setSelectedResumes] = useState({});
  const [loadingId, setLoadingId] = useState(null);
  const [isScraping, setIsScraping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const API_URL = "http://localhost:8000";

  const fetchData = async () => {
    try {
      const [jobsRes, resumesRes, trackerRes] = await Promise.all([
        fetch(`${API_URL}/api/dashboard/jobs`),
        fetch(`${API_URL}/resumes`),
        fetch(`${API_URL}/tracker/all`)
      ]);

      const jobsData = await jobsRes.json();
      const resumesData = await resumesRes.json();
      const trackerData = await trackerRes.json();

      setJobs(Array.isArray(jobsData) ? jobsData : []);
      setResumes(Array.isArray(resumesData) ? resumesData : []);

      if (Array.isArray(trackerData)) {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayCount = trackerData.filter(j => 
          new Date(j.applied_at).toISOString().split('T')[0] === todayStr
        ).length;
        setStats({ total: trackerData.length, today: todayCount });
      }

      // Fetch existing analysis results for jobs
      if (Array.isArray(jobsData)) {
        jobsData.forEach(async (job) => {
          try {
            const res = await fetch(`${API_URL}/results/${job.id}`);
            const history = await res.json();
            if (Array.isArray(history) && history.length > 0) {
              setResults(prev => ({ ...prev, [job.id]: history[history.length - 1] }));
            }
          } catch (e) { console.warn(e); }
        });
      }
    } catch (err) { console.error("Backend offline."); }
  };

  useEffect(() => { fetchData(); }, []);

  // FIXED: Standard FormData upload to match backend Form(...) and File(...)
  const handleResumeUpload = async (e) => {
    e.preventDefault();
    if (!resumeFile || !resumeName) return alert("Please select a file and enter a label.");
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append("name", resumeName);
    formData.append("file", resumeFile);

    try {
      const res = await fetch(`${API_URL}/resumes/upload`, {
        method: 'POST', 
        body: formData, // Browser sets multipart/form-data boundary automatically
      });
      
      if (res.ok) {
        setResumeName(""); 
        setResumeFile(null); 
        e.target.reset();
        alert("Resume added to Vault!");
        fetchData();
      } else {
        const err = await res.json();
        alert(`Upload failed: ${err.detail}`);
      }
    } catch (err) { 
      console.error(err); 
      alert("Network error during upload.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleJobSubmit = async (e) => {
    e.preventDefault();
    setIsScraping(true);
    try {
      await fetch(`${API_URL}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobForm),
      });
      setJobForm({ company: '', title: '', url: '' });
      fetchData();
    } catch (err) { console.error(err); }
    finally { setIsScraping(false); }
  };

  const handleAnalyze = async (jobId) => {
    const resumeId = selectedResumes[jobId];
    if (!resumeId) return alert("Select a resume from your vault first!");
    setLoadingId(jobId);
    try {
      const res = await fetch(`${API_URL}/jobs/${jobId}/analyze/${resumeId}`, { method: 'POST' });
      const data = await res.json();
      setResults(prev => ({ ...prev, [jobId]: data.ai_response }));
    } catch (err) { console.error(err); } 
    finally { setLoadingId(null); }
  };

  return (
    <div style={styles.container}>
      <nav style={styles.navbar}>
        <div style={styles.navBrand}>🚀 CareerFlow<span style={{color: '#6366f1'}}>AI</span></div>
        <div style={styles.navLinks}>
          <Link href="/resumes" style={styles.navItem}>Resume Vault</Link>
          <Link href="/tracker" style={styles.navItem}>Applications</Link>
          <div style={styles.userCircle}>JD</div>
        </div>
      </nav>

      <div style={styles.contentWrapper}>
        <div style={styles.heroSection}>
          <div style={styles.heroText}>
            <h1 style={styles.mainTitle}>Master Your <span style={styles.gradientText}>Job Search</span></h1>
            <p style={styles.subtitle}>Upload your resumes once, analyze every job instantly.</p>
          </div>
          
          <Link href="/tracker" style={{ textDecoration: 'none', flex: 1 }}>
            <div style={styles.trackerHeroCard}>
              <div style={styles.heroHeader}>
                <div style={styles.pulseContainer}>
                  <div style={styles.pulseDot}></div>
                  <span style={styles.heroBadge}>Sync Active</span>
                </div>
                <span style={{fontSize: '24px'}}>📈</span>
              </div>
              <h2 style={styles.heroTitle}>Live Tracker</h2>
              <div style={styles.statsPreview}>
                <div style={styles.statMiniCard}>
                  <span style={styles.statMiniLabel}>Total</span>
                  <span style={styles.statMiniValue}>{stats.total}</span>
                </div>
                <div style={styles.statMiniCard}>
                  <span style={styles.statMiniLabel}>Today</span>
                  <span style={styles.statMiniValue}>{stats.today}</span>
                </div>
              </div>
            </div>
          </Link>
        </div>

        <div style={styles.gridMain}>
          <div style={styles.sidebar}>
            <section style={styles.glassCard}>
              <h3 style={styles.cardHeader}>📄 Resume Vault</h3>
              <form onSubmit={handleResumeUpload} style={styles.form}>
                <input 
                  style={styles.input} 
                  placeholder="Label (e.g. Product Manager v1)" 
                  value={resumeName} 
                  onChange={e => setResumeName(e.target.value)} 
                  required 
                />
                <div style={styles.fileUploadWrapper}>
                  <input 
                    type="file" 
                    accept=".pdf" 
                    onChange={e => setResumeFile(e.target.files[0])} 
                    required 
                  />
                </div>
                <button type="submit" style={styles.btnIndigo} disabled={isUploading}>
                  {isUploading ? "Uploading..." : "Add to Vault"}
                </button>
              </form>
              <div style={styles.resumeList}>
                <div style={{fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '5px'}}>Recent Uploads</div>
                {resumes.slice(0, 3).map(r => (
                    <div key={r.id} style={styles.resumeItem}>
                        <span>📄</span> {r.name}
                    </div>
                ))}
                <Link href="/resumes" style={{fontSize: '12px', color: '#6366f1', textDecoration: 'none', marginTop: '10px', fontWeight: '600'}}>
                    View All {resumes.length} Resumes →
                </Link>
              </div>
            </section>

            <section style={{...styles.glassCard, marginTop: '25px'}}>
              <h3 style={styles.cardHeader}>➕ Add New Role</h3>
              <form onSubmit={handleJobSubmit} style={styles.form}>
                <input style={styles.input} placeholder="Company" value={jobForm.company} onChange={e => setJobForm({...jobForm, company: e.target.value})} required />
                <input style={styles.input} placeholder="Job Title" value={jobForm.title} onChange={e => setJobForm({...jobForm, title: e.target.value})} required />
                <input style={styles.input} placeholder="LinkedIn/Indeed URL" value={jobForm.url} onChange={e => setJobForm({...jobForm, url: e.target.value})} />
                <button type="submit" style={styles.btnSlate} disabled={isScraping}>
                  {isScraping ? "Scraping..." : "Process Job"}
                </button>
              </form>
            </section>
          </div>

          <div style={styles.mainFeed}>
            <h3 style={{...styles.cardHeader, paddingLeft: '10px'}}>🎯 Analysis Pipeline</h3>
            <div style={styles.feedScroll}>
              {jobs.filter(j => !j.gmail_id).length === 0 && (
                  <div style={{textAlign: 'center', padding: '40px', color: '#94a3b8'}}>
                      No jobs added yet. Use the "Add New Role" form to start.
                  </div>
              )}
              {jobs.filter(j => !j.gmail_id).map(job => (
                <div key={job.id} style={styles.feedCard}>
                  <div style={styles.cardInfo}>
                    <h4 style={styles.jobTitle}>{job.title}</h4>
                    <p style={styles.jobCompany}>{job.company}</p>
                  </div>
                  <div style={styles.actionRow}>
                    <select 
                        style={styles.modernSelect} 
                        onChange={(e) => setSelectedResumes(p => ({...p, [job.id]: e.target.value}))} 
                        value={selectedResumes[job.id] || ""}
                    >
                      <option value="">Select Resume</option>
                      {resumes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <button 
                        onClick={() => handleAnalyze(job.id)} 
                        style={styles.btnAnalyze} 
                        disabled={loadingId === job.id}
                    >
                      {loadingId === job.id ? '...' : 'AI Analyze'}
                    </button>
                  </div>
                  {results[job.id] && (
                    <div style={styles.scoreBadge}>
                      Match Score: <span style={{fontWeight: '800'}}>{results[job.id].match_score}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ... styles remain the same as your provided code ...
const styles = {
    container: { backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif', color: '#1e293b' },
    navbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 60px', backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 100 },
    navBrand: { fontSize: '22px', fontWeight: '800', letterSpacing: '-0.5px' },
    navLinks: { display: 'flex', alignItems: 'center', gap: '25px' },
    navItem: { textDecoration: 'none', color: '#64748b', fontWeight: '600', fontSize: '14px' },
    userCircle: { width: '35px', height: '35px', backgroundColor: '#6366f1', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' },
    
    contentWrapper: { maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' },
    heroSection: { display: 'flex', alignItems: 'center', gap: '40px', marginBottom: '50px' },
    heroText: { flex: 1.5 },
    mainTitle: { fontSize: '52px', fontWeight: '900', letterSpacing: '-2px', lineHeight: 1.1, margin: 0 },
    gradientText: { background: 'linear-gradient(90deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
    subtitle: { fontSize: '18px', color: '#64748b', marginTop: '15px' },
    
    trackerHeroCard: { background: '#1e293b', color: '#fff', padding: '30px', borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', transition: 'transform 0.2s' },
    heroHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '20px' },
    pulseContainer: { display: 'flex', alignItems: 'center', gap: '8px' },
    pulseDot: { width: '8px', height: '8px', backgroundColor: '#22c55e', borderRadius: '50%', animation: 'pulse 2s infinite' },
    heroBadge: { fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: '#22c55e' },
    heroTitle: { fontSize: '24px', fontWeight: '700', marginBottom: '20px' },
    statsPreview: { display: 'flex', gap: '15px' },
    statMiniCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)' },
    statMiniLabel: { fontSize: '10px', color: '#94a3b8', display: 'block', marginBottom: '4px' },
    statMiniValue: { fontSize: '20px', fontWeight: '700' },
  
    gridMain: { display: 'grid', gridTemplateColumns: '380px 1fr', gap: '30px' },
    sidebar: { display: 'flex', flexDirection: 'column' },
    glassCard: { background: '#fff', padding: '25px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
    cardHeader: { fontSize: '18px', fontWeight: '700', margin: '0 0 20px 0', color: '#334155' },
    form: { display: 'flex', flexDirection: 'column', gap: '12px' },
    input: { padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' },
    btnIndigo: { padding: '12px', backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' },
    btnSlate: { padding: '12px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' },
    resumeList: { marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' },
    resumeItem: { fontSize: '13px', color: '#64748b', padding: '8px', background: '#f8fafc', borderRadius: '6px' },
  
    mainFeed: { display: 'flex', flexDirection: 'column' },
    feedScroll: { display: 'grid', gap: '15px' },
    feedCard: { background: '#fff', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    cardInfo: { flex: 1 },
    jobTitle: { fontSize: '17px', fontWeight: '700', margin: 0 },
    jobCompany: { fontSize: '14px', color: '#6366f1', fontWeight: '600', margin: '2px 0 0 0' },
    actionRow: { display: 'flex', gap: '10px', alignItems: 'center' },
    modernSelect: { padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff' },
    btnAnalyze: { padding: '10px 15px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
    scoreBadge: { marginLeft: '20px', padding: '8px 12px', background: '#f0f9ff', color: '#0369a1', borderRadius: '10px', fontSize: '13px', border: '1px solid #bae6fd' }
  };