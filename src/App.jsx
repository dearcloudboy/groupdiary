import React, { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Setup from './components/Setup.jsx'
import Layout from './components/Layout.jsx'
import DualEntryView from './components/DualEntryView.jsx'
import UserFeedView from './components/UserFeedView.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import NotificationBell from './components/NotificationBell.jsx'
import { todayStr } from './lib/dataModel.js'
import './app.css'

const DEFAULT_BG_GRADIENT = 'linear-gradient(165deg, #fdf1f3 0%, #fbeef1 45%, #f7e9ee 100%)'

function Shell() {
  const auth = useAuth()
  const [activeMemberId, setActiveMemberId] = useState(null) // null = 메인 피드 보기
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    if (auth.currentMember?.color) {
      document.documentElement.style.setProperty('--accent', auth.currentMember.color)
      document.documentElement.style.setProperty('--accent-soft', `${auth.currentMember.color}22`)
    }
    document.documentElement.style.setProperty('--bg-gradient', auth.currentMember?.bgColor || DEFAULT_BG_GRADIENT)
  }, [auth.currentMember?.color, auth.currentMember?.bgColor])

  // 멤버가 삭제되는 등으로 더 이상 존재하지 않으면 메인 피드로 되돌립니다.
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
        <NotificationBell onSelectDate={() => {
          setActiveMemberId(null) // 알림 클릭 시 메인 피드로 이동
        }} />
      </div>

      <Layout activeMemberId={activeMemberId} onSelectMember={setActiveMemberId} onOpenSettings={() => setSettingsOpen(true)}>
        {/* 캘린더 컴포넌트를 지우고, 기본 화면에 DualEntryView(메인 피드)를 노출 */}
        {activeMemberId ? (
          <UserFeedView memberId={activeMemberId} />
        ) : (
          <DualEntryView date={todayStr()} onChanged={() => {}} />
        )}
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