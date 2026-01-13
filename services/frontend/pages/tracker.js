import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Tracker() {
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [filterDate, setFilterDate] = useState('');
  const [stats, setStats] = useState({ total: 0, applied: 0, interviewing: 0, rejected: 0 });
  const [todayCount, setTodayCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const API_URL = "http://localhost:8000";

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    if (!filterDate) {
      setFilteredJobs(jobs);
    } else {
      const filtered = jobs.filter(job => {
        const jobDate = new Date(job.applied_at).toISOString().split('T')[0];
        return jobDate === filterDate;
      });
      setFilteredJobs(filtered);
    }
  }, [filterDate, jobs]);

  const fetchJobs = async () => {
    try {
      const response = await fetch(`${API_URL}/tracker/all`);
      const data = await response.json();
      const jobsArray = Array.isArray(data) ? data : [];
      setJobs(jobsArray);
      
      const todayStr = new Date().toISOString().split('T')[0];
      setTodayCount(jobsArray.filter(j => new Date(j.applied_at).toISOString().split('T')[0] === todayStr).length);
      setStats({
        total: jobsArray.length,
        applied: jobsArray.filter(j => j.status === 'Applied').length,
        interviewing: jobsArray.filter(j => j.status === 'Interviewing').length,
        rejected: jobsArray.filter(j => j.status === 'Rejected').length,
      });
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Navbar to match dashboard.js */}
      <nav style={styles.navbar}>
        <div style={styles.navBrand}>🚀 CareerFlow<span style={{color: '#6366f1'}}>AI</span></div>
        <div style={styles.navLinks}>
          <Link href="/" style={styles.navItem}>Dashboard</Link>
          <Link href="/resumes" style={styles.navItem}>Resume Vault</Link>
          <div style={styles.userCircle}>AD</div>
        </div>
      </nav>

      <main style={styles.mainContent}>
        <header style={styles.header}>
          <h1 style={styles.mainTitle}>Application <span style={styles.gradientText}>Tracker</span></h1>
          <p style={styles.subtitle}>Track your progress and manage your job search funnel.</p>
        </header>

        {/* Daily Banner Card */}
        <div style={styles.todayBanner}>
          <div style={styles.bannerInfo}>
             <span style={styles.bannerIcon}>📊</span>
             <div>
               <h3 style={{margin: 0, fontSize: '18px'}}>Daily Momentum</h3>
               <p style={{margin: 0, color: '#64748b', fontSize: '14px'}}>You've tracked <strong>{todayCount}</strong> new roles today.</p>
             </div>
          </div>
          <div style={styles.filterGroup}>
             <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={styles.dateInput} />
             {filterDate && <button onClick={() => setFilterDate('')} style={styles.clearBtn}>Clear</button>}
          </div>
        </div>

        {/* Stats Grid */}
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <span style={styles.statLabel}>Total Apps</span>
            <span style={styles.statValue}>{stats.total}</span>
          </div>
          <div style={{...styles.statCard, borderBottom: '3px solid #6366f1'}}>
            <span style={styles.statLabel}>Active</span>
            <span style={styles.statValue}>{stats.applied}</span>
          </div>
          <div style={{...styles.statCard, borderBottom: '3px solid #10b981'}}>
            <span style={styles.statLabel}>Interviews</span>
            <span style={styles.statValue}>{stats.interviewing}</span>
          </div>
          <div style={{...styles.statCard, borderBottom: '3px solid #ef4444'}}>
            <span style={styles.statLabel}>Declined</span>
            <span style={styles.statValue}>{stats.rejected}</span>
          </div>
        </div>

        {/* Modern Table */}
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeadRow}>
                <th style={styles.th}>Company</th>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>Applied Date</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                 <tr><td colSpan="4" style={styles.emptyMsg}>Syncing with your Gmail...</td></tr>
              ) : filteredJobs.length > 0 ? filteredJobs.map(job => (
                <tr key={job.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={styles.companyWrapper}>
                      <div style={styles.companyCircle}>{job.company[0]}</div>
                      <strong>{job.company}</strong>
                    </div>
                  </td>
                  <td style={styles.td}>{job.role}</td>
                  <td style={styles.td}>{new Date(job.applied_at).toLocaleDateString()}</td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.statusBadge,
                      backgroundColor: job.status === 'Applied' ? '#eef2ff' : job.status === 'Interviewing' ? '#ecfdf5' : '#fff1f2',
                      color: job.status === 'Applied' ? '#4f46e5' : job.status === 'Interviewing' ? '#059669' : '#e11d48'
                    }}>
                      {job.status}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="4" style={styles.emptyMsg}>No records found for this view.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

const styles = {
  container: { backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Inter", sans-serif', color: '#1e293b' },
  navbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 60px', backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 100 },
  navBrand: { fontSize: '22px', fontWeight: '800', letterSpacing: '-0.5px' },
  navLinks: { display: 'flex', alignItems: 'center', gap: '25px' },
  navItem: { textDecoration: 'none', color: '#64748b', fontWeight: '600', fontSize: '14px' },
  userCircle: { width: '35px', height: '35px', backgroundColor: '#6366f1', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' },
  
  mainContent: { maxWidth: '1100px', margin: '0 auto', padding: '40px 20px' },
  header: { marginBottom: '30px' },
  mainTitle: { fontSize: '36px', fontWeight: '900', letterSpacing: '-1px', margin: 0 },
  gradientText: { background: 'linear-gradient(90deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  subtitle: { color: '#64748b', fontSize: '16px', marginTop: '8px' },

  todayBanner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '20px 25px', borderRadius: '20px', border: '1px solid #e2e8f0', marginBottom: '30px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' },
  bannerInfo: { display: 'flex', alignItems: 'center', gap: '15px' },
  bannerIcon: { fontSize: '24px' },
  
  filterGroup: { display: 'flex', gap: '10px' },
  dateInput: { border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 12px', fontSize: '14px', outline: 'none' },
  clearBtn: { background: '#f1f5f9', border: 'none', borderRadius: '10px', padding: '8px 15px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },

  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '40px' },
  statCard: { backgroundColor: '#fff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', textAlign: 'center' },
  statLabel: { display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' },
  statValue: { fontSize: '32px', fontWeight: '800', color: '#1e293b' },

  tableWrapper: { backgroundColor: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '16px 24px', textAlign: 'left', backgroundColor: '#f8fafc', fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' },
  td: { padding: '20px 24px', fontSize: '14px', borderBottom: '1px solid #f1f5f9' },
  tr: { ':hover': { backgroundColor: '#f8fafc' } },
  companyWrapper: { display: 'flex', alignItems: 'center', gap: '12px' },
  companyCircle: { width: '32px', height: '32px', backgroundColor: '#f1f5f9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#6366f1' },
  statusBadge: { padding: '6px 14px', borderRadius: '10px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' },
  emptyMsg: { textAlign: 'center', padding: '60px', color: '#94a3b8' }
};