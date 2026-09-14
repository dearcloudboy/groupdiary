import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { getEntriesForMember, emptyEntry } from '../lib/dataModel.js'
import { DIARY_WORD } from '../config.js'
import EntryCard from './EntryCard.jsx'
import EntryEditor from './EntryEditor.jsx'
import Avatar from './Avatar.jsx'

export default function DualEntryView({ date, onChanged }) {
  const auth = useAuth()
  const [memberEntries, setMemberEntries] = useState({})
  const [addingForMember, setAddingForMember] = useState(null)

  const fetchEntries = () => {
    let cancelled = false
    setMemberEntries({})
    setAddingForMember(null)

    auth.members.forEach((m) => {
      getEntriesForMember(auth.client, date, m.id).then((list) => {
        if (cancelled) return
        setMemberEntries((prev) => ({ ...prev, [m.id]: list }))
      })
    })
    return () => { cancelled = true }
  }

  useEffect(() => {
    return fetchEntries()
  }, [date, auth.members.length])

  return (
    <div className="dual-view">
      {auth.members.map((m) => {
        const list = memberEntries[m.id]
        const isMine = auth.currentMember?.id === m.id
        const isAdding = addingForMember === m.id

        return (
          <div className="dual-column" key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {list === undefined ? (
              <div className="card skeleton-card" />
            ) : list.length === 0 && !isAdding ? (
              <EmptySlot
                member={m}
                date={date}
                onCreated={() => {
                  fetchEntries()
                  onChanged?.()
                }}
              />
            ) : (
              <>
                {list.map((item, idx) => (
                  <EntryCard
                    key={item.json?.id || item.path || idx}
                    entry={item.json}
                    sha={item.sha}
                    date={date}
                    memberId={m.id}
                    customPath={item.path}
                    onDeleted={() => {
                      fetchEntries()
                      onChanged?.()
                    }}
                  />
                ))}

                {isAdding && (
                  <div className="card empty-slot mine">
                    <div className="entry-card-who">
                      <Avatar member={m} />
                      <div className="entry-card-name">{m.displayName} (새 {DIARY_WORD})</div>
                    </div>
                    <EntryEditor
                      date={date}
                      memberId={m.id}
                      initialEntry={emptyEntry(date, m.id)}
                      initialSha={undefined}
                      customPath={null}
                      onSaved={() => {
                        setAddingForMember(null)
                        fetchEntries()
                        onChanged?.()
                      }}
                      onCancel={() => setAddingForMember(null)}
                    />
                  </div>
                )}

                {isMine && !isAdding && (
                  <button
                    type="button"
                    className="btn secondary"
                    style={{
                      padding: '0.6rem 1rem',
                      borderRadius: '12px',
                      border: '1px dashed var(--accent, #aaa)',
                      background: 'var(--accent-soft, #f8f8f8)',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                    onClick={() => setAddingForMember(m.id)}
                  >
                    + 새 {DIARY_WORD} 추가하기
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
        initialEntry={emptyEntry(date, member.id)}
        initialSha={undefined}
        customPath={null}
        onSaved={onCreated}
      />
    </div>
  )
}