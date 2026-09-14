import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { getEntry, listDatesForMember } from '../lib/dataModel.js'
import { DIARY_WORD } from '../config.js'
import EntryCard from './EntryCard.jsx'
import Avatar from './Avatar.jsx'

export default function UserFeedView({ memberId }) {
  const auth = useAuth()
  const member = auth.members.find((m) => m.id === memberId)
  const [dates, setDates] = useState([])
  const [entriesByDate, setEntriesByDate] = useState({})
  const [loading, setLoading] = useState(true)

  const reloadData = () => {
    let cancelled = false
    setLoading(true)
    listDatesForMember(auth.client, memberId).then(async (dList) => {
      if (cancelled) return
      setDates(dList)
      const map = {}
      for (const d of dList) {
        const res = await getEntry(auth.client, d, memberId)
        if (res) map[d] = res
      }
      if (cancelled) return
      setEntriesByDate(map)
      setLoading(false)
    })
    return () => { cancelled = true }
  }

  useEffect(() => {
    return reloadData()
  }, [memberId, auth.client])

  if (!member) return null

  return (
    <div className="user-feed-view" style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      <header
        className="user-feed-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.2rem',
          padding: '1.2rem 1.4rem',
          background: 'rgba(255, 255, 255, 0.7)',
          borderRadius: '20px',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        }}
      >
        <div
          className="user-feed-avatar-wrap"
          style={{
            width: '80px',
            height: '80px',
            minWidth: '80px',
            minHeight: '80px',
            borderRadius: '50%',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          {/* Avatar 내부 엘리먼트와 이미지가 80px에 무조건 꽉 차도록 강제 스타일 주입 */}
          <style>{`
            .user-feed-avatar-wrap .avatar,
            .user-feed-avatar-wrap .avatar img,
            .user-feed-avatar-wrap img {
              width: 80px !important;
              height: 80px !important;
              min-width: 80px !important;
              min-height: 80px !important;
              font-size: 2rem !important;
              line-height: 80px !important;
              object-fit: cover !important;
              border-radius: 50% !important;
            }
          `}</style>
          <Avatar member={member} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#222' }}>
            {member.displayName}님의 {DIARY_WORD}
          </h2>
          <span style={{ color: 'var(--muted, #777)', fontSize: '0.9rem' }}>
            기록한 날: <strong>{dates.length}</strong>일
          </span>
        </div>
      </header>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card skeleton-card" />
          <div className="card skeleton-card" />
        </div>
      ) : dates.length === 0 ? (
        <div className="card empty-slot">
          <p>아직 작성한 {DIARY_WORD}가 없어요.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {dates.map((d) => {
            const slot = entriesByDate[d]
            if (!slot?.json) return null

            const entryList = slot.json.subEntries && slot.json.subEntries.length > 0
              ? slot.json.subEntries
              : [slot.json]

            return (
              <div key={d} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {entryList.map((sub, idx) => (
                  <EntryCard
                    key={sub.id || `${d}-${idx}`}
                    entry={sub}
                    subIndex={idx}
                    parentEntry={slot.json}
                    sha={slot.sha}
                    date={d}
                    memberId={memberId}
                    showDate={true}
                    onUpdated={reloadData}
                    onDeleted={reloadData}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}