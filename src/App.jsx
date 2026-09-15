import React, { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Setup from './components/Setup.jsx'
import Layout from './components/Layout.jsx'
import CalendarPage from './components/CalendarPage.jsx'
import UserFeedView from './components/UserFeedView.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import NotificationBell from './components/NotificationBell.jsx' // 추가된 알림벨 컴포넌트
import './app.css'

const DEFAULT_BG_GRADIENT = 'linear-gradient(165deg, #fdf1f3 0%, #fbeef1 45%, #f7e9ee 100%)'

function Shell() {
  const auth = useAuth()
  const [activeMemberId, setActiveMemberId] = useState(null) // null = 캘린더 보기
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [targetDate, setTargetDate] = useState(null) // 알림 클릭 시 이동할 날짜 상태 추가

  useEffect(() => {
    if (auth.currentMember?.color) {
      document.documentElement.style.setProperty('--accent', auth.currentMember.color)
      document.documentElement.style.setProperty('--accent-soft', `${auth.currentMember.color}22`)
    }
    document.documentElement.style.setProperty('--bg-gradient', auth.currentMember?.bgColor || DEFAULT_BG_GRADIENT)
  }, [auth.currentMember?.color, auth.currentMember?.bgColor])

  // 멤버가 삭제되는 등으로 더 이상 존재하지 않으면 캘린더 보기로 되돌립니다.
  useEffect(() => {
    if (activeMemberId && !auth.members.some((m) => m.id === activeMemberId)) {
      setActiveMemberId(null)
    }
  }, [activeMemberId, auth.members])

  const ready = auth.status === 'ready' && auth.currentMember

  if (!ready) return <Setup />

  return (
    <>
      {/* 우측 하단에 알림 벨을 고정으로 띄워 기존 레이아웃 충돌 방지 */}
      <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999 }}>
        <NotificationBell onSelectDate={(date) => {
          setActiveMemberId(null) // 캘린더 보기로 전환
          setTargetDate(date)     // 해당 날짜를 캘린더에 전달
        }} />
      </div>

      <Layout activeMemberId={activeMemberId} onSelectMember={setActiveMemberId} onOpenSettings={() => setSettingsOpen(true)}>
        {/* targetDate를 CalendarPage로 넘겨줌 */}
        {activeMemberId ? <UserFeedView memberId={activeMemberId} /> : <CalendarPage targetDate={targetDate} />}
        {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      </Layout>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}