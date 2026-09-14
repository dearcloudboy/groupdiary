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

export default function UserFeedView({ memberId }) {
  const auth = useAuth()
  const member = auth.members.find((m) => m.id === memberId)
  const [dates, setDates] = useState([])
  const [entriesByDate, setEntriesByDate] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedTag, setSelectedTag] = useState(null)

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

  // 전체 작성 글에서 등장하는 모든 고유 태그 목록 추출
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

  // 전체 글 평탄화 및 작성 시간순(최신순) 정렬
  const allFlattenedEntries = useMemo(() => {
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
            timestamp: new Date(sub.createdAt || sub.updatedAt || d).getTime(),
          })
        }
      })
    })

    // 최신 작성 시간순 정렬 (내림차순)
    return result.sort((a, b) => b.timestamp - a.timestamp)
  }, [dates, entriesByDate, selectedTag])

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

      {/* 전체 태그 필터 바 */}
      {allTags.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            padding: '0.8rem 1.0rem',
            background: 'rgba(255, 255, 255, 0.85)',
            borderRadius: '16px',
            alignItems: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          }}
        >
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#666', marginRight: '0.2rem' }}>
            🏷️ 태그 모아보기:
          </span>
          <button
            type="button"
            onClick={() => setSelectedTag(null)}
            style={{
              padding: '0.3rem 0.8rem',
              borderRadius: '20px',
              border: selectedTag === null ? '1.5px solid var(--accent, #7da0fa)' : '1px solid rgba(0,0,0,0.12)',
              background: selectedTag === null ? 'var(--accent, #7da0fa)' : '#fff',
              color: selectedTag === null ? '#fff' : '#444',
              fontSize: '0.85rem',
              fontWeight: selectedTag === null ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            전체 보기
          </button>
          {allTags.map((tag) => {
            const active = selectedTag === tag
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(active ? null : tag)}
                style={{
                  padding: '0.3rem 0.8rem',
                  borderRadius: '20px',
                  border: active ? '1.5px solid var(--accent, #7da0fa)' : '1px solid rgba(0,0,0,0.12)',
                  background: active ? 'var(--accent, #7da0fa)' : '#fff',
                  color: active ? '#fff' : '#444',
                  fontSize: '0.85rem',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                #{tag}
              </button>
            )
          })}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card skeleton-card" />
          <div className="card skeleton-card" />
        </div>
      ) : allFlattenedEntries.length === 0 ? (
        <div className="card empty-slot">
          <p>{selectedTag ? `${selectedTag} 태그가 달린 글이 없어요.` : `아직 작성한 ${DIARY_WORD}가 없어요.`}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {allFlattenedEntries.map((item, idx) => (
            <EntryCard
              key={item.entry.id || `${item.date}-${idx}`}
              entry={item.entry}
              subIndex={item.subIndex}
              parentEntry={item.parentEntry}
              sha={item.sha}
              date={item.date}
              memberId={memberId}
              showDate={true}
              onTagClick={(t) => {
                const clean = cleanTag(t)
                setSelectedTag(clean)
              }}
              onUpdated={reloadData}
              onDeleted={reloadData}
            />
          ))}
        </div>
      )}
    </div>
  )
}