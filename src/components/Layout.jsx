import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { SITE_TITLE } from '../config.js'
import Avatar from './Avatar.jsx'
import NotificationBell from './NotificationBell.jsx'

export default function Layout({ activeMemberId, onSelectMember, onOpenSettings, onGoHome, onSelectEntry, children }) {
  const auth = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  function handleMemberClick(id) {
    onSelectMember(activeMemberId === id ? null : id)
    setMobileOpen(false)
  }

  function handleHomeClick() {
    onGoHome()
    setMobileOpen(false)
  }

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
      <style>{`
        .mobile-header { display: none; }
        .pc-bell { display: block; }
        .mobile-overlay { display: none; }

        .sidebar { display: flex; flex-direction: column; align-items: flex-start !important; }
        .sidebar-top, .member-nav, .sidebar-bottom { width: 100% !important; display: flex; flex-direction: column; align-items: stretch !important; }
        .member-nav-item { width: 100% !important; justify-content: flex-start !important; padding-left: 1.5rem !important; }
        .sidebar-bottom .btn { width: 100% !important; justify-content: flex-start !important; text-align: left !important; padding-left: 1.5rem !important; }

        @media (max-width: 768px) {
          .app-shell { flex-direction: column !important; }
          .main-area { width: 100% !important; padding: 1rem !important; }
          .mobile-header { display: flex; justify-content: space-between; alignItems: center; padding: 0.8rem 1.2rem; background: rgba(255,255,255,0.85); backdrop-filter: blur(10px); box-shadow: 0 1px 8px rgba(0,0,0,0.05); position: sticky; top: 0; z-index: 900; }
          .sidebar { position: fixed !important; top: 0 !important; left: 0 !important; bottom: 0 !important; width: 260px !important; height: 100vh !important; z-index: 1000 !important; background: #fff !important; box-shadow: 2px 0 15px rgba(0,0,0,0.1); transform: translateX(${mobileOpen ? '0' : '-100%'}); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); padding: 1.5rem 0 !important; display: flex !important; flex-direction: column !important; }
          .logo { margin-left: 1.5rem !important; }
          .sidebar-top { flex: 1 !important; }
          .member-nav { gap: 0.3rem !important; }
          .sidebar-bottom { gap: 0.5rem !important; margin-top: auto !important; border-top: 1px solid #eee; padding-top: 1rem; }
          .pc-bell { display: none; }
          .mobile-overlay { display: ${mobileOpen ? 'block' : 'none'}; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); z-index: 999; }
        }
      `}</style>

      <header className="mobile-header">
        <button onClick={() => setMobileOpen(true)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--accent)' }}>☰</button>
        <strong style={{ fontSize: '1.2rem', color: '#333' }} onClick={handleHomeClick}>{SITE_TITLE}</strong>
        <NotificationBell onSelectEntry={(e) => { onSelectEntry(e); setMobileOpen(false); }} align="right" />
      </header>

      <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />

      <div style={{ display: 'flex', flex: 1 }}>
        <aside className="sidebar">
          <div className="sidebar-top">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', width: '100%', paddingRight: '1.5rem' }}>
              <button className="logo" onClick={handleHomeClick} title="홈으로 돌아가기" style={{ background: 'none', border: 'none', fontSize: '1.4rem', fontWeight: 800, cursor: 'pointer', color: '#333', padding: 0, whiteSpace: 'nowrap' }}>
                {SITE_TITLE}
              </button>
              <div className="pc-bell">
                <NotificationBell onSelectEntry={(e) => { onSelectEntry(e); setMobileOpen(false); }} align="left" />
              </div>
            </div>

            <nav className="member-nav">
              <button className={`member-nav-item home-nav-item ${activeMemberId === null ? 'active' : ''}`} onClick={handleHomeClick}>
                <span className="home-nav-icon" aria-hidden="true" style={{ marginRight: '0.4rem' }}>
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
                    <path d="M4 10.8 12 4l8 6.8V19a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-8.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="member-nav-name">홈</span>
              </button>
              {auth.members.map((m) => (
                <button key={m.id} className={`member-nav-item ${activeMemberId === m.id ? 'active' : ''}`} style={{ '--author-color': m.color }} onClick={() => handleMemberClick(m.id)} title={`${m.displayName}의 글 모아보기`}>
                  <Avatar member={m} size={30} />
                  <span className="member-nav-name" style={{ marginLeft: '0.4rem' }}>{m.displayName}</span>
                  {m.id === auth.currentMember?.id && <span className="me-badge" style={{ marginLeft: '0.4rem' }}>나</span>}
                </button>
              ))}
            </nav>
          </div>

          <div className="sidebar-bottom">
            <button className="btn btn-ghost" onClick={() => { onOpenSettings(); setMobileOpen(false); }}>설정</button>
            <button className="btn btn-ghost" onClick={auth.logout}>로그아웃</button>
          </div>
        </aside>

        <main className="main-area" style={{ flex: 1 }}>{children}</main>
      </div>
    </div>
  )
}