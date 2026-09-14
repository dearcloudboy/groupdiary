import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { getEntry } from '../lib/dataModel.js'
import { DIARY_WORD } from '../config.js'
import EntryCard from './EntryCard.jsx'
import EntryEditor from './EntryEditor.jsx'
import Avatar from './Avatar.jsx'

export default function DualEntryView({ date, onChanged }) {
  const auth = useAuth()
  const [slots, setSlots] = useState({})
  const [addingFor, setAddingFor] = useState(null)

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

  useEffect(() => {
    setSlots({})
    setAddingFor(null)
    loadData()
  }, [date, auth.members.length, loadData])

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
      gap: '1.5rem',
      alignItems: 'start',
      width: '100%',
    }}>
      {auth.members.map((m) => {
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
                    onUpdated={() => {
                      loadData()
                      onChanged?.()
                    }}
                    onDeleted={() => {
                      loadData()
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