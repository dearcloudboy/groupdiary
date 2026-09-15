import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { getEntry, loadIndex } from '../lib/dataModel.js'
import { DIARY_WORD } from '../config.js'
import EntryCard from './EntryCard.jsx'
import EntryEditor from './EntryEditor.jsx'
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

export default function DualEntryView({ date, onChanged }) {
  const auth = useAuth()
  const [slots, setSlots] = useState({})
  const [addingFor, setAddingFor] = useState(null)
  const [sortBy, setSortBy] = useState('activity') 
  
  const [selectedTag, setSelectedTag] = useState(null)
  const [allEntriesMap, setAllEntriesMap] = useState({})
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    const newSlots = {}
    for (const m of auth.members) {
      try {
        const res = await getEntry(auth.client, date, m.id)
        newSlots[m.id] = res || null
      } catch (e) {
        newSlots[m.id] = null
      }
    }
    setSlots(newSlots)
  }, [auth.client, auth.members, date])

  const loadAllHistory = useCallback(async () => {
    setLoading(true)
    try {
      const { json: index } = await loadIndex(auth.client)
      const allDates = Object.keys(index || {})
      const fullMap = {}

      for (const d of allDates) {
        fullMap[d] = {}
        for (const m of auth.members) {
          if ((index[d] || []).includes(m.id)) {
            const res = await getEntry(auth.client, d, m.id)
            if (res) fullMap[d][m.id] = res
          }
        }
      }
      setAllEntriesMap(fullMap)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [auth.client, auth.members])

  useEffect(() => {
    loadData()
  }, [date, auth.members.length, loadData])

  useEffect(() => {
    loadAllHistory()
  }, [loadAllHistory])

  const availableTags = useMemo(() => {
    const set = new Set()
    Object.values(allEntriesMap).forEach((byMember) => {
      Object.values(byMember).forEach((slot) => {
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
    })
    return Array.from(set)
  }, [allEntriesMap])

  const flattenedAllEntries = useMemo(() => {
    const list = []
    Object.keys(allEntriesMap).forEach((d) => {
      auth.members.forEach((m) => {
        const slot = allEntriesMap[d]?.[m.id]
        if (!slot?.json) return

        const subList = slot.json.subEntries && slot.json.subEntries.length > 0
          ? slot.json.subEntries
          : [slot.json]

        subList.forEach((sub) => {
          const originalIdx = slot.json.subEntries
            ? slot.json.subEntries.findIndex((e) => e.id === sub.id)
            : 0

          list.push({
            date: d,
            memberId: m.id,
            entry: sub,
            subIndex: originalIdx >= 0 ? originalIdx : 0,
            parentEntry: slot.json,
            sha: slot.sha,
            createdTimestamp: new Date(sub.createdAt || d).getTime(),
            activityTimestamp: getLatestActivityTimestamp(sub, d),
          })
        })
      })
    })
    return list
  }, [allEntriesMap, auth.members])

  const displayedTaggedEntries = useMemo(() => {
    if (!selectedTag) return []
    const filtered = flattenedAllEntries.filter((item) => {
      const tags = (item.entry.moodTags || []).map(cleanTag)
      return tags.includes(selectedTag)
    })
    return filtered.sort((a, b) =>
      sortBy === 'activity'
        ? b.activityTimestamp - a.activityTimestamp
        : b.createdTimestamp - a.createdTimestamp
    )
  }, [selectedTag, flattenedAllEntries, sortBy])

  const homeFeedEntries = useMemo(() => {
    const list = [...flattenedAllEntries]
    return list.sort((a, b) =>
      sortBy === 'activity'
        ? b.activityTimestamp - a.activityTimestamp
        : b.createdTimestamp - a.createdTimestamp
    )
  }, [flattenedAllEntries, sortBy])

  const handleTagClick = (rawTag) => {
    const target = cleanTag(rawTag)
    setSelectedTag((prev) => (prev === target ? null : target))
  }

  const reloadAll = () => {
    loadData()
    loadAllHistory()
    onChanged?.()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', width: '100%', maxWidth: '680px', margin: '0 auto' }}>
      
      {/* 1. 최상단: 새 글 쓰기 영역 (항상 렌더링) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
        {auth.members.map((m) => {
          const isMine = auth.currentMember?.id === m.id
          if (!isMine) return null

          const slot = slots[m.id]
          const isAdding = addingFor === m.id

          if (slot === undefined) return <div key={m.id} className="card skeleton-card" style={{ padding: '1.5rem' }} />

          if (!isAdding) {
            return (
              <button
                key={m.id}
                type="button"
                style={{
                  width: '100%',
                  padding: '1rem',
                  borderRadius: '16px',
                  border: '2px dashed var(--accent, #7da0fa)',
                  background: 'rgba(255, 255, 255, 0.8)',
                  color: 'var(--accent, #2b56cc)',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setAddingFor(m.id)}
                onMouseEnter={(e) => (e.target.style.background = '#fff')}
                onMouseLeave={(e) => (e.target.style.background = 'rgba(255, 255, 255, 0.8)')}
              >
                ✍️ 새로운 {DIARY_WORD} 남기기
              </button>
            )
          }

          return (
            <div key={m.id} className="card" style={{ padding: '1.5rem', background: '#fff', borderRadius: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                <Avatar member={m} />
                <strong style={{ fontSize: '1rem' }}>{m.displayName}님의 새 {DIARY_WORD}</strong>
              </div>
              <EntryEditor
                date={date}
                memberId={m.id}
                initialEntry={null}
                initialSha={slot?.sha}
                parentEntry={slot?.json}
                onSaved={(savedEntry, savedSha) => {
                  setAddingFor(null)
                  setSlots((prev) => ({ ...prev, [m.id]: { json: savedEntry, sha: savedSha } }))
                  reloadAll()
                }}
                onCancel={() => setAddingFor(null)}
              />
            </div>
          )
        })}
      </div>

      {/* 2. 컨트롤 영역: 정렬 (위) -> 태그 (아래) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', background: 'rgba(255, 255, 255, 0.4)', padding: '1rem', borderRadius: '16px' }}>
        
        {/* 정렬 토글 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', gap: '0.3rem', background: 'rgba(0,0,0,0.05)', padding: '0.25rem', borderRadius: '12px' }}>
            <button
              type="button"
              onClick={() => setSortBy('activity')}
              style={{
                padding: '0.3rem 0.65rem',
                borderRadius: '8px',
                border: 'none',
                background: sortBy === 'activity' ? '#fff' : 'transparent',
                fontWeight: sortBy === 'activity' ? 700 : 500,
                color: sortBy === 'activity' ? 'var(--accent, #2b56cc)' : '#666',
                boxShadow: sortBy === 'activity' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              🔥 최신 활동순
            </button>
            <button
              type="button"
              onClick={() => setSortBy('created')}
              style={{
                padding: '0.3rem 0.65rem',
                borderRadius: '8px',
                border: 'none',
                background: sortBy === 'created' ? '#fff' : 'transparent',
                fontWeight: sortBy === 'created' ? 700 : 500,
                color: sortBy === 'created' ? 'var(--accent, #2b56cc)' : '#666',
                boxShadow: sortBy === 'created' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              ⏱️ 작성순
            </button>
          </div>
        </div>

        {/* 태그 리스트 */}
        {availableTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#666', marginRight: '0.2rem' }}>
              🏷️ 태그:
            </span>
            {availableTags.map((tag) => {
              const active = selectedTag === tag
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagClick(tag)}
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
        )}
      </div>

      {/* 3. 하단 메인 피드 영역 */}
      {selectedTag ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.2rem' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--accent, #2b56cc)' }}>
              #{selectedTag} 모아보기 ({displayedTaggedEntries.length}개)
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => setSelectedTag(null)}
              style={{ cursor: 'pointer', fontSize: '0.8rem' }}
            >
              ✕ 필터 해제
            </button>
          </div>

          {displayedTaggedEntries.length === 0 ? (
            <div className="card empty-slot" style={{ padding: '2rem 1rem' }}>
              <p style={{ color: '#888', margin: 0 }}>이 태그가 달린 글이 없어요.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {displayedTaggedEntries.map((item, idx) => (
                <EntryCard
                  key={item.entry.id || `${item.date}-${item.memberId}-${idx}`}
                  entry={item.entry}
                  subIndex={item.subIndex}
                  parentEntry={item.parentEntry}
                  sha={item.sha}
                  date={item.date}
                  memberId={item.memberId}
                  showDate={true}
                  onTagClick={handleTagClick}
                  onUpdated={reloadAll}
                  onDeleted={reloadAll}
                  onOpenDetail={(entryInfo) => onChanged?.(entryInfo)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', width: '100%' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card skeleton-card" />
              <div className="card skeleton-card" />
            </div>
          ) : homeFeedEntries.length === 0 ? (
            <div className="card empty-slot" style={{ padding: '2.5rem 1rem' }}>
              <p style={{ color: '#888', margin: 0 }}>아직 등록된 {DIARY_WORD}가 없어요.</p>
            </div>
          ) : (
            homeFeedEntries.map((item, idx) => (
              <EntryCard
                key={item.entry.id || `${item.date}-${item.memberId}-${idx}`}
                entry={item.entry}
                subIndex={item.subIndex}
                parentEntry={item.parentEntry}
                sha={item.sha}
                date={item.date}
                memberId={item.memberId}
                showDate={true}
                onTagClick={handleTagClick}
                onUpdated={reloadAll}
                onDeleted={reloadAll}
                onOpenDetail={(entryInfo) => onChanged?.(entryInfo)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}