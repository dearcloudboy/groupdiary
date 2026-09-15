import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { getEntry, loadIndex, todayStr } from '../lib/dataModel.js'
import { DIARY_WORD } from '../config.js'
import EntryCard from './EntryCard.jsx'
import EntryEditor from './EntryEditor.jsx'
import Avatar from './Avatar.jsx'

function cleanTag(t) {
  if (!t) return ''
  return String(t).replace(/^#+/, '').trim()
}

// 글 작성, 수정, 마지막 댓글 시간 중 가장 최근 시간을 타임스탬프로 계산 (끌어올림용)
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

export default function DualEntryView({ date, isDateFiltered = false, onClearDateFilter, onChanged }) {
  const auth = useAuth()
  const [slots, setSlots] = useState({})
  const [addingFor, setAddingFor] = useState(null)
  const [sortBy, setSortBy] = useState('activity') // 'activity': 최신활동순(끌올), 'created': 작성시간순
  
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

  // 태그 필터링 시 표시할 목록
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

  // 홈 전체 기본 피드
  const homeFeedEntries = useMemo(() => {
    const list = [...flattenedAllEntries]
    return list.sort((a, b) =>
      sortBy === 'activity'
        ? b.activityTimestamp - a.activityTimestamp
        : b.createdTimestamp - a.createdTimestamp
    )
  }, [flattenedAllEntries, sortBy])

  // 특정 날짜를 선택했을 때의 해당 날짜 글 목록
  const dateSpecificEntries = useMemo(() => {
    const list = []
    auth.members.forEach((m) => {
      const slot = slots[m.id]
      if (!slot?.json) return

      const subList = slot.json.subEntries && slot.json.subEntries.length > 0
        ? slot.json.subEntries
        : [slot.json]

      subList.forEach((sub) => {
        const originalIdx = slot.json.subEntries
          ? slot.json.subEntries.findIndex((e) => e.id === sub.id)
          : 0

        list.push({
          date: date,
          memberId: m.id,
          entry: sub,
          subIndex: originalIdx >= 0 ? originalIdx : 0,
          parentEntry: slot.json,
          sha: slot.sha,
          createdTimestamp: new Date(sub.createdAt || date).getTime(),
          activityTimestamp: getLatestActivityTimestamp(sub, date),
        })
      })
    })

    return list.sort((a, b) =>
      sortBy === 'activity'
        ? b.activityTimestamp - a.activityTimestamp
        : b.createdTimestamp - a.createdTimestamp
    )
  }, [slots, auth.members, date, sortBy])

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', width: '100%' }}>
      {/* 상단 컨트롤 바: 태그 + 정렬 전환 버튼 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
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
              ⏱️ 최초 작성순
            </button>
          </div>
        </div>
      </div>

      {selectedTag ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', maxWidth: '680px', margin: '0 auto', width: '100%' }}>
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
                />
              ))}
            </div>
          )}
        </div>
      ) : isDateFiltered ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '680px', margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.2rem' }}>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#333' }}>
              📅 {date} 일기 목록
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={onClearDateFilter}
              style={{ cursor: 'pointer', fontSize: '0.8rem' }}
            >
              전체 최신 피드로 보기 ↩
            </button>
          </div>

          {dateSpecificEntries.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', width: '100%' }}>
              {dateSpecificEntries.map((item, idx) => (
                <EntryCard
                  key={item.entry.id || `${item.memberId}-${idx}`}
                  entry={item.entry}
                  subIndex={item.subIndex}
                  parentEntry={item.parentEntry}
                  sha={item.sha}
                  date={date}
                  memberId={item.memberId}
                  showDate={false}
                  onTagClick={handleTagClick}
                  onUpdated={reloadAll}
                  onDeleted={reloadAll}
                />
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
            {auth.members.map((m) => {
              const slot = slots[m.id]
              const isMine = auth.currentMember?.id === m.id
              const isAdding = addingFor === m.id

              if (slot === undefined) return <div key={m.id} className="card skeleton-card" />

              if (slot === null && !isAdding) {
                return (
                  <EmptySlot
                    key={m.id}
                    member={m}
                    date={date}
                    onCreated={(newEntry, newSha) => {
                      setSlots((prev) => ({ ...prev, [m.id]: { json: newEntry, sha: newSha } }))
                      reloadAll()
                    }}
                  />
                )
              }

              if (isAdding) {
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
              }

              if (isMine && !isAdding) {
                return (
                  <button
                    key={m.id}
                    type="button"
                    style={{
                      width: '100%',
                      padding: '0.85rem',
                      borderRadius: '14px',
                      border: '2px dashed var(--accent, #aaa)',
                      background: 'rgba(255, 255, 255, 0.8)',
                      color: 'var(--accent, #333)',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.9rem',
                    }}
                    onClick={() => setAddingFor(m.id)}
                  >
                    + {m.displayName}님 새 {DIARY_WORD} 추가하기
                  </button>
                )
              }

              return null
            })}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', maxWidth: '680px', margin: '0 auto', width: '100%' }}>
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
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function EmptySlot({ member, date, onCreated }) {
  const auth = useAuth()
  const isMine = auth.currentMember?.id === member.id

  if (!isMine) {
    return (
      <div className="card empty-slot" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.2rem' }}>
        <Avatar member={member} />
        <p style={{ margin: 0, color: '#777' }}>{member.displayName}님이 아직 이 날의 {DIARY_WORD}를 쓰지 않았어요.</p>
      </div>
    )
  }

  return (
    <div className="card empty-slot mine" style={{ padding: '1.5rem' }}>
      <div className="entry-card-who" style={{ marginBottom: '1rem' }}>
        <Avatar member={member} />
        <div className="entry-card-name">{member.displayName}</div>
      </div>
      <EntryEditor
        date={date}
        memberId={member.id}
        initialEntry={null}
        initialSha={undefined}
        onSaved={onCreated}
      />
    </div>
  )
}