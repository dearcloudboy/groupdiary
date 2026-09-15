import React, { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { todayStr } from './lib/dataModel.js'
import { APP_TITLE } from './config.js'
import SetupModal from './components/SetupModal.jsx'
import DualEntryView from './components/DualEntryView.jsx'
import UserFeedView from './components/UserFeedView.jsx'
import Avatar from './components/Avatar.jsx'
import NotificationBell from './components/NotificationBell.jsx'
import './app.css'

export default function App() {
  const auth = useAuth()
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [currentView, setCurrentView] = useState('dual') // 'dual' = 홈 피드, 'member' = 유저 피드
  const [selectedMemberId, setSelectedMemberId] = useState(null)
  const [editingMember, setEditingMember] = useState(null)

  if (auth.loading) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    )
  }

  if (auth.needsSetup) {
    return <SetupModal />
  }

  const goHome = () => {
    setCurrentView('dual')
    setSelectedMemberId(null)
  }

  const openMemberFeed = (mId) => {
    setSelectedMemberId(mId)
    setCurrentView('member')
  }

  return (
    <div className="app-layout">
      {/* 사이드바 네비게이션 */}
      <aside className="sidebar">
        <div className="brand" onClick={goHome} style={{ cursor: 'pointer' }}>
          <span className="brand-icon">📝</span>
          <span className="brand-title">{APP_TITLE}</span>
        </div>

        <nav className="nav-menu">
          <button
            type="button"
            className={`nav-item ${currentView === 'dual' ? 'active' : ''}`}
            onClick={goHome}
          >
            <span className="nav-icon">🏠</span>
            <span>홈 (피드)</span>
          </button>

          <div className="nav-members-list">
            {auth.members.map((m) => {
              const isMe = auth.currentMember?.id === m.id
              const isActive = currentView === 'member' && selectedMemberId === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`nav-item member-item ${isActive ? 'active' : ''}`}
                  onClick={() => openMemberFeed(m.id)}
                >
                  <Avatar member={m} size="small" />
                  <span className="nav-member-name">{m.displayName}</span>
                  {isMe && <span className="badge-me">나</span>}
                </button>
              )
            })}
          </div>
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-footer-btn"
            onClick={() => setEditingMember(auth.currentMember)}
          >
            설정
          </button>
          <button
            type="button"
            className="sidebar-footer-btn"
            onClick={() => auth.logout()}
          >
            로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 뷰 컨텐츠 */}
      <main className="main-content">
        {currentView === 'dual' && (
          <header className="main-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem' }}>
            <div className="date-picker-wrap" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#666' }}>작성 날짜:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="date-picker"
                title="이 날짜에 새 글 쓰기"
              />
              {selectedDate !== todayStr() && (
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  onClick={() => setSelectedDate(todayStr())}
                >
                  오늘
                </button>
              )}
            </div>

            {/* 댓글 알림 벨 */}
            <NotificationBell onSelectDate={(d) => {
              setSelectedDate(d)
              setCurrentView('dual')
            }} />
          </header>
        )}

        <div className="content-body" style={{ marginTop: currentView === 'dual' ? '1rem' : '0' }}>
          {currentView === 'dual' ? (
            <DualEntryView date={selectedDate} onChanged={() => {}} />
          ) : (
            <UserFeedView memberId={selectedMemberId} />
          )}
        </div>
      </main>

      {/* 설정/프로필 수정 모달 */}
      {editingMember && (
        <SetupModal
          initialMember={editingMember}
          onClose={() => setEditingMember(null)}
        />
      )}
    </div>
  )
}