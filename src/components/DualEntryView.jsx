import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { getEntry, loadIndex } from '../lib/dataModel.js'
import { DIARY_WORD } from '../config.js'
import EntryCard from './EntryCard.jsx'
import EntryEditor from './EntryEditor.jsx'
import Avatar from './Avatar.jsx'

export default function DualEntryView({ date, onChanged }) {
  const auth = useAuth()
  const [slots, setSlots] = useState({})
  const [addingFor, setAddingFor] = useState(null)
  
  // 전체 태그 수집 및 태그 필터링 상태
  const [selectedTag, setSelectedTag] = useState(null)
  const [allEntriesMap, setAllEntriesMap] = useState({}) // date -> memberId -> slot
  const [loadingAll, setLoadingAll] = useState(false)

  // 1. 현재 날짜 데이터 로드
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

  // 2. 전체 날짜에서 태그 수집용 데이터 로드
  const loadAllHistory = useCallback(async () => {
    setLoadingAll(true)
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
      setLoadingAll(false)
    }
  }, [auth.client, auth.members])

  useEffect(() => {
    setSlots({})
    setAddingFor(null)
    loadData()
  }, [date, auth.members.length, loadData])

  useEffect(() => {
    loadAllHistory()
  }, [loadAllHistory])

  // 전체 태그 목록 추출
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
            const clean = t.startsWith('#') ? t : `#${t}`
            set.add(clean)
          })
        })
      })
    })
    return Array.from(set)
  }, [allEntriesMap])

  // 선택된 태그 기준 멤버별 전체 글 목록 추출
  const filteredEntriesByMember = useMemo(() => {
    if (!selectedTag) return null
    const result = {}
    auth.members.forEach((m) => { result[m.id] = [] })

    const sortedDates = Object.keys(allEntriesMap).sort((a, b) => (a < b ? 1 : -1))
    sortedDates.forEach((d) => {
      auth.members.forEach((m) => {
        const slot = allEntriesMap[d]?.[m.id]
        if (!slot?.json) return

        const list = slot.json.subEntries && slot.json.subEntries.length > 0
          ? slot.json.subEntries
          : [slot.json]

        list.forEach((sub, idx) => {
          const tags = (sub.moodTags || []).map((t) => (t.startsWith('#') ? t : `#${t}`))
          if (tags.includes(selectedTag)) {
            result[m.id].push({
              date: d,
              entry: sub,
              subIndex: idx,
              parentEntry: slot.json,
              sha: slot.sha,
            })
          }
        })
      })
    })
    return result
  }, [selectedTag, allEntriesMap, auth.members])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', width: '100%' }}>
      {/* 전체 태그 필터 바 */}
      {availableTags.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            padding: '0.8rem 1.2rem',
            background: 'rgba(255, 255, 255, 0.85)',
            borderRadius: '16px',
            alignItems: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          }}
        >
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#555', marginRight: '0.3rem' }}>
            🏷️ 전체 태그:
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
            날짜별 보기
          </button>
          {availableTags.map((tag) => {
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
                {tag}
              </button>
            )
          })}
        </div>
      )}

      {/* 태그 모아보기 활성화 시 안내 문구 */}
      {selectedTag && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.5rem' }}>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#333' }}>
            {selectedTag} 태그 모아보기
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => setSelectedTag(null)}
            style={{ cursor: 'pointer', fontSize: '0.85rem' }}
          >
            ✕ 필터 해제
          </button>
        </div>
      )}

      {/* 2단 그리드 본문 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem',
        alignItems: 'start',
        width: '100%',
      }}>
        {auth.members.map((m) => {
          // 태그 모아보기 상태인 경우
          if (selectedTag) {
            const taggedList = filteredEntriesByMember?.[m.id] || []
            return (
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', width: '100%', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.3rem', borderBottom: '2px solid rgba(0,0,0,0.05)' }}>
                  <Avatar member={m} />
                  <strong>{m.displayName} ({taggedList.length}개)</strong>
                </div>

                {taggedList.length === 0 ? (
                  <div className="card empty-slot" style={{ padding: '2rem 1rem' }}>
                    <p style={{ color: '#888', margin: 0 }}>이 태그로 작성한 글이 없어요.</p>
                  </div>
                ) : (
                  taggedList.map((item, idx) => (
                    <EntryCard
                      key={item.entry.id || `${item.date}-${idx}`}
                      entry={item.entry}
                      subIndex={item.subIndex}
                      parentEntry={item.parentEntry}
                      sha={item.sha}
                      date={item.date}
                      memberId={m.id}
                      showDate={true}
                      onTagClick={(t) => {
                        const clean = t.startsWith('#') ? t : `#${t}`
                        setSelectedTag(clean)
                      }}
                      onUpdated={() => {
                        loadData()
                        loadAllHistory()
                        onChanged?.()
                      }}
                      onDeleted={() => {
                        loadData()
                        loadAllHistory()
                        onChanged?.()
                      }}
                    />
                  ))
                )}
              </div>
            )
          }

          // 기본: 특정 날짜 2단 일기 뷰
          const slot = slots[m.id]
          const isMine = auth.currentMember?.id === m.id
          const isAdding = addingFor === m.id

          const entryList = slot?.json
            ? (slot.json.subEntries && slot.json.subEntries.length > 0
                ? slot.json.subEntries
                : [slot.json])
            : []

          return (
            <div
              key={m.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.2rem',
                width: '100%',
                minWidth: 0,
              }}
            >
              {slot === undefined ? (
                <div className="card skeleton-card" />
              ) : slot === null && !isAdding ? (
                <EmptySlot
                  member={m}
                  date={date}
                  onCreated={(newEntry, newSha) => {
                    setSlots((prev) => ({ ...prev, [m.id]: { json: newEntry, sha: newSha } }))
                    loadAllHistory()
                    onChanged?.()
                  }}
                />
              ) : (
                <>
                  {entryList.map((sub, idx) => (
                    <EntryCard
                      key={sub.id || idx}
                      entry={sub}
                      subIndex={idx}
                      parentEntry={slot.json}
                      sha={slot.sha}
                      date={date}
                      memberId={m.id}
                      onTagClick={(t) => {
                        const clean = t.startsWith('#') ? t : `#${t}`
                        setSelectedTag(clean)
                      }}
                      onUpdated={() => {
                        loadData()
                        loadAllHistory()
                        onChanged?.()
                      }}
                      onDeleted={() => {
                        loadData()
                        loadAllHistory()
                        onChanged?.()
                      }}
                    />
                  ))}

                  {isAdding && (
                    <div className="card" style={{ padding: '1.5rem', background: '#ffffff', borderRadius: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
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
                          setSlots((prev) => ({
                            ...prev,
                            [m.id]: { json: savedEntry, sha: savedSha },
                          }))
                          loadAllHistory()
                          onChanged?.()
                        }}
                        onCancel={() => setAddingFor(null)}
                      />
                    </div>
                  )}

                  {isMine && !isAdding && (
                    <button
                      type="button"
                      style={{
                        width: '100%',
                        padding: '0.9rem',
                        borderRadius: '14px',
                        border: '2px dashed var(--accent, #aaa)',
                        background: 'rgba(255, 255, 255, 0.8)',
                        color: 'var(--accent, #333)',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '0.95rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                      }}
                      onClick={() => setAddingFor(m.id)}
                    >
                      <span>+</span> 새 {DIARY_WORD} 추가하기
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EmptySlot({ member, date, onCreated }) {
  const auth = useAuth()
  const isMine = auth.currentMember?.id === member.id

  if (!isMine) {
    return (
      <div className="card empty-slot">
        <Avatar member={member} />
        <p>{member.displayName}님이 아직 이 날의 {DIARY_WORD}를 쓰지 않았어요.</p>
      </div>
    )
  }

  return (
    <div className="card empty-slot mine">
      <div className="entry-card-who">
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