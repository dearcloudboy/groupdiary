import React, { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Setup from './components/Setup.jsx'
import Layout from './components/Layout.jsx'
import DualEntryView from './components/DualEntryView.jsx'
import UserFeedView from './components/UserFeedView.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import SingleEntryView from './components/SingleEntryView.jsx'
import { todayStr } from './lib/dataModel.js'
import './app.css'

const DEFAULT_BG_GRADIENT = 'linear-gradient(165deg, #fdf1f3 0%, #fbeef1 45%, #f7e9ee 100%)'

function Shell() {
  const auth = useAuth()
  const [activeMemberId, setActiveMemberId] = useState(null)
  const [activeEntry, setActiveEntry] = useState(null) // 단독 페이지로 띄울 글 정보 상태
  const [settingsOpen, setSettingsOpen] = useState(false)

  // UserFeedView 등 하위 컴포넌트에서 쉽게 접근할 수 있게 auth 객체에 심어줌
  auth.onOpenDetail = setActiveEntry

  useEffect(() => {
    if (auth.currentMember?.color) {
      document.documentElement.style.setProperty('--accent', auth.currentMember.color)
      document.documentElement.style.setProperty('--accent-soft', `${auth.currentMember.color}22`)
    }
    document.documentElement.style.setProperty('--bg-gradient', auth.currentMember?.bgColor || DEFAULT_BG_GRADIENT)
  }, [auth.currentMember?.color, auth.currentMember?.bgColor])

  useEffect(() => {
    if (activeMemberId && !auth.members.some((m) => m.id === activeMemberId)) {
      setActiveMemberId(null)
    }
  }, [activeMemberId, auth.members])

  const ready = auth.status === 'ready' && auth.currentMember

  if (!ready) return <Setup />

  const handleGoHome = () => {
    setActiveMemberId(null)
    setActiveEntry(null) // 홈 버튼 누르면 단독 뷰 닫힘
  }

  return (
    <Layout 
      activeMemberId={activeMemberId} 
      onSelectMember={(id) => { setActiveMemberId(id); setActiveEntry(null); }} 
      onOpenSettings={() => setSettingsOpen(true)}
      onGoHome={handleGoHome}
      onSelectEntry={setActiveEntry}
    >
      {/* 1순위: 단독 페이지 뷰 / 2순위: 유저 피드 / 3순위: 전체 피드 */}
      {activeEntry ? (
        <SingleEntryView 
          date={activeEntry.date} 
          memberId={activeEntry.memberId} 
          entryId={activeEntry.entryId} 
          onBack={() => setActiveEntry(null)} 
        />
      ) : activeMemberId ? (
        <UserFeedView memberId={activeMemberId} />
      ) : (
        <DualEntryView date={todayStr()} onChanged={(info) => { if(info?.date) setActiveEntry(info) }} />
      )}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </Layout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}