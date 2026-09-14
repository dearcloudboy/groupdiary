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

export default function DualEntryView({ date, onChanged }) {
  const auth = useAuth()
  const [slots, setSlots] = useState({})
  const [addingFor, setAddingFor] = useState(null)
  
  const [selectedTag, setSelectedTag] = useState(null)
  const [allEntriesMap, setAllEntriesMap] = useState({})

  // 현재 날짜 로드
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

  // 전체 날짜 히스토리 로드 (태그 모아보기용)
  const loadAllHistory = useCallback(async () => {
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

  // 수집된 모든 고유 태그 목록
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

  // 선택된 태그 기준: 멤버 구분 없이 전체 시간순(최신순) 리스트 생성
  const timelineTaggedEntries = useMemo(() => {
    if (!selectedTag) return []
    const list = []

    const sortedDates = Object.keys(allEntriesMap).sort((a, b) => (a < b ? 1 : -1))
    sortedDates.forEach((d) => {
      auth.members.forEach((m) => {
        const slot = allEntriesMap[d]?.[m.id]
        if (!slot?.json) return

        const subList = slot.json.subEntries && slot.json.subEntries.length > 0
          ? slot.json.subEntries
          : [slot.json]

        subList.forEach((sub, idx) => {
          const tags = (sub.moodTags || []).map(cleanTag)
          if (tags.includes(selectedTag)) {
            list.push({
              date: d,
              memberId: m.id,
              entry: sub,
              subIndex: idx,
              parentEntry: slot.json,
              sha: slot.sha,
              timestamp: new Date(sub.createdAt || sub.updatedAt || d).getTime(),
            })
          }
        })
      })
    })

    return list.sort((a, b) => b.timestamp - a.timestamp)
  }, [selectedTag, allEntriesMap, auth.members])

  // 홈(날짜별 보기)에서 멤버 구분 없이 해당 날짜에 작성된 모든 개별 글들을 시간순(최신순)으로 평탄화
  const todayTimelineItems = useMemo(() => {
    const items = []
    auth.members.forEach((m) => {
      const slot = slots[m.id]
      if (!slot?.json) return

      const subList = slot.json.subEntries && slot.json.subEntries.length > 0
        ? slot.json.subEntries
        : [slot.json]

      subList.forEach((sub, idx) => {
        const originalIdx = slot.json.subEntries
          ? slot.json.subEntries.findIndex((e) => e.id === sub.id)
          : 0

        items.push({
          memberId: m.id,
          entry: sub,
          subIndex: originalIdx >= 0 ? originalIdx : 0,
          parentEntry: slot.json,
          sha: slot.sha,
          timestamp: new Date(sub.createdAt || sub.updatedAt || date).getTime(),
        })
      })
    })

    // 최신 작성 시간순 정렬
    return items.sort((a, b) => b.timestamp - a.timestamp)
  }, [slots, auth.members, date])

  const handleTagClick = (rawTag) => {
    const target = cleanTag(rawTag)
    setSelectedTag((prev) => (prev === target ? null : target))
  }

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
              padding: '0.35rem 0.85rem',
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
                onClick={() => handleTagClick(tag)}
                style={{
                  padding: '0.35rem 0.85rem',
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

      {/* 1) 태그 모아보기 활성화 시 */}
      {selectedTag ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', maxWidth: '680px', margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.2rem' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent, #2b56cc)' }}>
              #{selectedTag} 모아보기 ({timelineTaggedEntries.length}개)
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

          {timelineTaggedEntries.length === 0 ? (
            <div className="card empty-slot" style={{ padding: '2rem 1rem' }}>
              <p style={{ color: '#888', margin: 0 }}>이 태그가 달린 글이 없어요.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {timelineTaggedEntries.map((item, idx) => (
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
            </div>
          )}
        </div>
      ) : (
        /* 2) 홈(날짜별 보기): 작성 시간순 타임라인 피드 + 아직 안 쓴 멤버 슬롯 하단 배치 */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '680px', margin: '0 auto', width: '100%' }}>
          {/* 이미 작성된 글들의 최신순 타임라인 */}
          {todayTimelineItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', width: '100%' }}>
              {todayTimelineItems.map((item, idx) => (
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
            </div>
          )}

          {/* 아직 글을 쓰지 않았거나 편집/추가할 수 있는 멤버별 슬롯 (하단 배치) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
            {auth.members.map((m) => {
              const slot = slots[m.id]
              const isMine = auth.currentMember?.id === m.id
              const isAdding = addingFor === m.id

              // 데이터 로딩 중인 경우
              if (slot === undefined) {
                return <div key={m.id} className="card skeleton-card" />
              }

              // 아직 아무 글도 안 쓴 멤버 슬롯
              if (slot === null && !isAdding) {
                return (
                  <EmptySlot
                    key={m.id}
                    member={m}
                    date={date}
                    onCreated={(newEntry, newSha) => {
                      setSlots((prev) => ({ ...prev, [m.id]: { json: newEntry, sha: newSha } }))
                      loadAllHistory()
                      onChanged?.()
                    }}
                  />
                )
              }

              // 이미 글을 썼지만 본인이 추가(새 서브엔트리) 버튼을 눌렀을 때
              if (isAdding) {
                return (
                  <div key={m.id} className="card" style={{ padding: '1.5rem', background: '#ffffff', borderRadius: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
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
                )
              }

              // 본인 글이 이미 있고 추가 버튼을 띄워야 하는 경우
              if (isMine && !isAdding) {
                return (
                  <button
                    key={m.id}
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
                    <span>+</span> {m.displayName}님 새 {DIARY_WORD} 추가하기
                  </button>
                )
              }

              return null
            })}
          </div>
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