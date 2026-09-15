import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { getEntry, listDatesForMember } from '../lib/dataModel.js'
import { DIARY_WORD } from '../config.js'
import EntryCard from './EntryCard.jsx'
import Avatar from './Avatar.jsx'

function cleanTag(t) {
  if (!t) return ''
  return String(t).replace(/^#+/, '').trim()
}

function getLatestActivityTimestamp(entry, fallbackDate) {
  const times = [
    new Date(entry.createdAt || fallbackDate).getTime(),
    new Date(entry.updatedAt || fallbackDate).getTime(),
  ]
  if (entry.comments && entry.comments.length > 0) {
    entry.comments.forEach((c) => {
      if (c.createdAt) times.push(new Date(c.createdAt).getTime())
    })
  }
  return Math.max(...times.filter((t) => !isNaN(t)))
}

export default function UserFeedView({ memberId }) {
  const auth = useAuth()
  const member = auth.members.find((m) => m.id === memberId)
  const [dates, setDates] = useState([])
  const [entriesByDate, setEntriesByDate] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedTag, setSelectedTag] = useState(null)
  const [sortBy, setSortBy] = useState('activity')

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

  const allTags = useMemo(() => {
    const set = new Set()
    Object.values(entriesByDate).forEach((slot) => {
      if (!slot?.json) return
      const list = slot.json.subEntries && slot.json.subEntries.length > 0
        ? slot.json.subEntries
        : [slot.json]

      list.forEach((sub) => {
        (sub.moodTags || []).forEach((t) => {
          const c = cleanTag(t)
          if (c) set.add(c)
        })
      })
    })
    return Array.from(set)
  }, [entriesByDate])

  const displayedEntries = useMemo(() => {
    const result = []
    dates.forEach((d) => {
      const slot = entriesByDate[d]
      if (!slot?.json) return

      const list = slot.json.subEntries && slot.json.subEntries.length > 0
        ? slot.json.subEntries
        : [slot.json]

      list.forEach((sub) => {
        const tags = (sub.moodTags || []).map(cleanTag)
        if (!selectedTag || tags.includes(selectedTag)) {
          const originalIdx = slot.json.subEntries
            ? slot.json.subEntries.findIndex((e) => e.id === sub.id)
            : 0

          result.push({
            date: d,
            entry: sub,
            subIndex: originalIdx >= 0 ? originalIdx : 0,
            parentEntry: slot.json,
            sha: slot.sha,
            createdTimestamp: new Date(sub.createdAt || d).getTime(),
            activityTimestamp: getLatestActivityTimestamp(sub, d),
          })
        }
      })
    })

    return result.sort((a, b) =>
      sortBy === 'activity'
        ? b.activityTimestamp - a.activityTimestamp
        : b.createdTimestamp - a.createdTimestamp
    )
  }, [dates, entriesByDate, selectedTag, sortBy])

  if (!member) return null

  return (
    <div className="user-feed-view" style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.3rem', width: '100%' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.2rem',
          padding: '1.2rem 1.4rem',
          background: 'rgba(255, 255, 255, 0.75)',
          borderRadius: '20px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ width: '70px', height: '70px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
          <Avatar member={member} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>
            {member.displayName}님의 {DIARY_WORD}
          </h2>
          <span style={{ color: '#777', fontSize: '0.85rem' }}>
            기록한 날: <strong>{dates.length}</strong>일
          </span>
        </div>
      </header>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#666' }}>🏷️ 태그:</span>
          <button
            type="button"
            onClick={() => setSelectedTag(null)}
            style={{
              padding: '0.25rem 0.65rem',
              borderRadius: '16px',
              border: selectedTag === null ? '1.5px solid var(--accent, #7da0fa)' : '1px solid rgba(0,0,0,0.12)',
              background: selectedTag === null ? 'var(--accent, #7da0fa)' : '#fff',
              color: selectedTag === null ? '#fff' : '#444',
              fontSize: '0.8rem',
              fontWeight: selectedTag === null ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            전체
          </button>
          {allTags.map((tag) => {
            const active = selectedTag === tag
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(active ? null : tag)}
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: '16px',
                  border: active ? '1.5px solid var(--accent, #7da0fa)' : '1px solid rgba(0,0,0,0.12)',
                  background: active ? 'var(--accent, #7da0fa)' : '#fff',
                  color: active ? '#fff' : '#444',
                  fontSize: '0.8rem',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                #{tag}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: '0.3rem', background: 'rgba(0,0,0,0.05)', padding: '0.25rem', borderRadius: '12px' }}>
          <button
            type="button"
            onClick={() => setSortBy('activity')}
            style={{
              padding: '0.3rem 0.6rem',
              borderRadius: '8px',
              border: 'none',
              background: sortBy === 'activity' ? '#fff' : 'transparent',
              fontWeight: sortBy === 'activity' ? 700 : 500,
              color: sortBy === 'activity' ? 'var(--accent, #2b56cc)' : '#666',
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            🔥 최신 활동순
          </button>
          <button
            type="button"
            onClick={() => setSortBy('created')}
            style={{
              padding: '0.3rem 0.6rem',
              borderRadius: '8px',
              border: 'none',
              background: sortBy === 'created' ? '#fff' : 'transparent',
              fontWeight: sortBy === 'created' ? 700 : 500,
              color: sortBy === 'created' ? 'var(--accent, #2b56cc)' : '#666',
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            ⏱️ 최초 작성순
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card skeleton-card" />
          <div className="card skeleton-card" />
        </div>
      ) : displayedEntries.length === 0 ? (
        <div className="card empty-slot">
          <p>{selectedTag ? `#${selectedTag} 태그가 달린 글이 없어요.` : `작성된 ${DIARY_WORD}가 없어요.`}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {displayedEntries.map((item, idx) => (
            <EntryCard
              key={item.entry.id || `${item.date}-${idx}`}
              entry={item.entry}
              subIndex={item.subIndex}
              parentEntry={item.parentEntry}
              sha={item.sha}
              date={item.date}
              memberId={memberId}
              showDate={true}
              onTagClick={(t) => setSelectedTag(cleanTag(t))}
              onUpdated={reloadData}
              onDeleted={reloadData}
            />
          ))}
        </div>
      )}
    </div>
  )
}