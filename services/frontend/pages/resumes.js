import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ResumeManager() {
  const [resumes, setResumes] = useState([]);
  const [selectedResume, setSelectedResume] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Base URL for your FastAPI backend
  const API_URL = "http://localhost:8000";

  useEffect(() => {
    fetchResumes();
  }, []);

  const fetchResumes = async () => {
    try {
      const res = await fetch(`${API_URL}/resumes`);
      const data = await res.json();
      const resumeList = Array.isArray(data) ? data : [];
      setResumes(resumeList);
      
      // Auto-select the first resume if it exists
      if (resumeList.length > 0) {
        setSelectedResume(resumeList[0]);
      }
    } catch (err) {
      console.error("Connection error to backend");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* PROFESSIONAL NAVBAR */}
      <nav style={styles.navbar}>
        <div style={styles.navBrand}>🚀 CareerFlow<span style={{color: '#6366f1'}}>AI</span></div>
        <div style={styles.navLinks}>
          <Link href="/" style={styles.navItem}>Dashboard</Link>
          <Link href="/tracker" style={styles.navItem}>Applications</Link>
          <div style={styles.userCircle}>JD</div>
        </div>
      </nav>

      <div style={styles.mainWrapper}>
        {/* SIDE PANEL: RESUME LIST */}
        <aside style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <h2 style={styles.sidebarTitle}>Your Vault</h2>
            <span style={styles.countBadge}>{resumes.length}</span>
          </div>
          
          <div style={styles.listContainer}>
            {resumes.map((resume) => (
              <div 
                key={resume.id} 
                onClick={() => setSelectedResume(resume)}
                style={{
                  ...styles.resumeListItem,
                  backgroundColor: selectedResume?.id === resume.id ? '#6366f1' : 'transparent',
                  color: selectedResume?.id === resume.id ? '#fff' : '#1e293b'
                }}
              >
                <span style={{marginRight: '12px', opacity: 0.8}}>📄</span>
                <div style={styles.itemText}>
                  <div style={{fontWeight: '600', fontSize: '14px'}}>{resume.name}</div>
                  <div style={{fontSize: '11px', opacity: 0.7}}>PDF Document</div>
                </div>
              </div>
            ))}
            
            {!loading && resumes.length === 0 && (
              <p style={styles.emptyText}>No resumes found.</p>
            )}
          </div>
        </aside>

        {/* DOCUMENT DISPLAY AREA (Standard Viewer) */}
        <main style={styles.displayArea}>
          {selectedResume ? (
            <div style={styles.documentContainer}>
              {/* VIEWER TOOLBAR */}
              <div style={styles.viewerToolbar}>
                <div style={styles.toolbarInfo}>
                  <h3 style={styles.docTitle}>{selectedResume.name}</h3>
                  <span style={styles.fileBadge}>NATIVE PDF VIEWER</span>
                </div>
                <div style={styles.toolbarActions}>
                  {/* Link to open original file in a new tab */}
                  <a 
                    href={`${API_URL}/${selectedResume.file_url}`} 
                    target="_blank" 
                    rel="noreferrer"
                    style={styles.btnSecondary}
                  >
                    Open Original
                  </a>
                </div>
              </div>

              {/* THE IFRAME VIEW: Uses the browser's native PDF engine */}
              <div style={styles.pdfFrameContainer}>
                <iframe
                  src={`${API_URL}/${selectedResume.file_url}#toolbar=1&navpanes=0`}
                  style={styles.pdfIframe}
                  title="Resume Viewer"
                />
              </div>
            </div>
          ) : (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>📂</div>
              <h3>Select a resume to view</h3>
              <p>Your document content will appear here using the standard viewer.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const styles = {
  container: { height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fff', overflow: 'hidden' },
  navbar: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: '0 40px', 
    height: '60px', 
    borderBottom: '1px solid #e2e8f0', 
    flexShrink: 0,
    zIndex: 10
  },
  navBrand: { fontSize: '18px', fontWeight: '800', letterSpacing: '-0.5px' },
  navLinks: { display: 'flex', alignItems: 'center', gap: '20px' },
  navItem: { textDecoration: 'none', color: '#64748b', fontWeight: '600', fontSize: '13px' },
  userCircle: { width: '30px', height: '30px', backgroundColor: '#6366f1', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' },
  
  mainWrapper: { display: 'flex', flex: 1, overflow: 'hidden' },
  
  sidebar: { 
    width: '280px', 
    borderRight: '1px solid #e2e8f0', 
    display: 'flex', 
    flexDirection: 'column', 
    backgroundColor: '#fff' 
  },
  sidebarHeader: { padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' },
  sidebarTitle: { fontSize: '15px', fontWeight: '700', margin: 0, color: '#475569' },
  countBadge: { backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', color: '#64748b' },
  listContainer: { flex: 1, overflowY: 'auto', padding: '10px' },
  resumeListItem: { 
    display: 'flex', 
    alignItems: 'center', 
    padding: '12px 15px', 
    borderRadius: '10px', 
    cursor: 'pointer', 
    marginBottom: '4px', 
    transition: 'background 0.2s' 
  },
  itemText: { flex: 1 },
  emptyText: { textAlign: 'center', color: '#94a3b8', fontSize: '13px', marginTop: '20px' },

  displayArea: { 
    flex: 1, 
    backgroundColor: '#525659', // Dark gray standard PDF viewer background
    display: 'flex', 
    flexDirection: 'column',
    overflow: 'hidden'
  },
  documentContainer: { 
    display: 'flex', 
    flexDirection: 'column', 
    height: '100%' 
  },
  viewerToolbar: { 
    backgroundColor: '#fff', 
    padding: '12px 30px', 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
    zIndex: 5
  },
  toolbarInfo: { display: 'flex', alignItems: 'center', gap: '12px' },
  docTitle: { fontSize: '16px', fontWeight: '700', margin: 0 },
  fileBadge: { fontSize: '10px', fontWeight: '800', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '4px' },
  toolbarActions: { display: 'flex', gap: '10px' },
  
  pdfFrameContainer: { 
    flex: 1, 
    width: '100%', 
    height: '100%', 
    display: 'flex', 
    justifyContent: 'center',
    backgroundColor: '#525659'
  },
  pdfIframe: { 
    width: '100%', 
    height: '100%', 
    border: 'none'
  },

  btnSecondary: { 
    padding: '8px 16px', 
    backgroundColor: '#6366f1', 
    color: '#fff', 
    border: 'none', 
    borderRadius: '6px', 
    fontWeight: '600', 
    fontSize: '13px', 
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block'
  },
  
  emptyState: { 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    justifyContent: 'center', 
    height: '100%', 
    color: '#cbd5e1' 
  },
  emptyIcon: { fontSize: '40px', marginBottom: '10px' }
};