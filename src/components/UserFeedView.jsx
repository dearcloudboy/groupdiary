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
    <div className="user-feed-view" style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header className="user-feed-header" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '1rem 0' }}>
        <Avatar member={member} size="large" />
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{member.displayName}님의 {DIARY_WORD}</h2>
          <p style={{ margin: '0.2rem 0 0', color: 'var(--muted, #666)', fontSize: '0.9rem' }}>
            기록한 날: {dates.length}일
          </p>
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

            // subEntries가 있으면 모든 서브 글을 다 풀어서 렌더링
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