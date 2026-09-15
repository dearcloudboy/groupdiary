import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { loadIndex, getEntry } from '../lib/dataModel.js'

export default function NotificationBell({ onSelectEntry, align = 'right' }) {
  const auth = useAuth()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [lastReadTime, setLastReadTime] = useState(() => {
    return localStorage.getItem(`noti_last_read_${auth.currentMember?.id}`) || '1970-01-01T00:00:00.000Z'
  })
  const popoverRef = useRef(null)

  const myId = auth.currentMember?.id

  const checkNotifications = async () => {
    if (!myId || !auth.client) return
    try {
      const { json: index } = await loadIndex(auth.client)
      const allDates = Object.keys(index || {})
      const newNotis = []

      for (const d of allDates) {
        const authorIds = index[d] || []
        for (const authorId of authorIds) {
          const res = await getEntry(auth.client, d, authorId)
          if (!res?.json) continue

          const entries = res.json.subEntries && res.json.subEntries.length > 0
            ? res.json.subEntries
            : [res.json]

          entries.forEach((entry) => {
            const comments = entry.comments || []
            if (comments.length === 0) return

            const isMyPost = authorId === myId
            const haveICommented = comments.some((c) => c.author === myId)

            if (isMyPost || haveICommented) {
              comments.forEach((c) => {
                if (c.author !== myId) {
                  const postAuthorMember = auth.members.find((m) => m.id === authorId)
                  const postAuthorName = postAuthorMember?.displayName || authorId

                  newNotis.push({
                    id: c.id,
                    date: d,
                    author: c.author,
                    postAuthorId: authorId, // 단독 뷰 이동을 위해 추가
                    entryId: entry.id,      // 단독 뷰 이동을 위해 추가
                    text: c.text,
                    createdAt: c.createdAt,
                    type: isMyPost ? 'my_post' : 'participated_post',
                    targetPostDesc: isMyPost ? '내 글' : `${postAuthorName}님의 글`,
                  })
                }
              })
            }
          })
        }
      }

      newNotis.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      setNotifications(newNotis)
    } catch (e) {
      console.error('알림 로드 실패:', e)
    }
  }

  useEffect(() => {
    checkNotifications()
  }, [myId, auth.client])

  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => new Date(n.createdAt) > new Date(lastReadTime)).length
  }, [notifications, lastReadTime])

  function handleToggle() {
    if (!open) {
      const nowIso = new Date().toISOString()
      setLastReadTime(nowIso)
      if (myId) {
        localStorage.setItem(`noti_last_read_${myId}`, nowIso)
      }
    }
    setOpen((prev) => !prev)
  }

  function handleItemClick(n) {
    setOpen(false)
    // 알림 클릭 시 해당 글의 단독 뷰로 이동하기 위한 정보 전달
    onSelectEntry?.({ date: n.date, memberId: n.postAuthorId, entryId: n.entryId })
  }

  if (!myId) return null

  return (
    <div ref={popoverRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={handleToggle}
        title="새 알림"
        style={{
          background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer',
          position: 'relative', padding: '0.3rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute', top: '2px', right: '2px', background: '#ff4d4f', color: '#fff',
              fontSize: '0.65rem', fontWeight: 700, borderRadius: '10px', padding: '0.1rem 0.35rem',
              minWidth: '14px', textAlign: 'center', lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 8px)',
            right: align === 'right' ? 0 : 'auto', left: align === 'left' ? 0 : 'auto',
            width: '290px', maxHeight: '380px', overflowY: 'auto', background: '#ffffff',
            borderRadius: '14px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)', border: '1px solid rgba(0, 0, 0, 0.08)',
            zIndex: 1000, padding: '0.6rem 0',
          }}
        >
          <div style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem', fontWeight: 700, color: '#444', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>새 댓글 알림</span>
            <span style={{ fontSize: '0.75rem', color: '#999' }}>{notifications.length}건</span>
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#999', fontSize: '0.85rem' }}>새로운 알림이 없어요.</div>
          ) : (
            notifications.slice(0, 20).map((n) => {
              const authorMember = auth.members.find((m) => m.id === n.author)
              const authorName = authorMember?.displayName || n.author

              return (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  style={{
                    padding: '0.6rem 0.9rem', borderBottom: '1px solid #fafafa', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: '0.2rem', transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.03)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#888' }}>
                    <span style={{ fontWeight: 600, color: '#333' }}>
                      {authorName}님의 댓글
                      <span style={{ fontWeight: 400, color: '#999', marginLeft: '4px', fontSize: '0.7rem' }}>({n.targetPostDesc})</span>
                    </span>
                    <span>{n.date.slice(5)}</span>
                  </div>
                  {/* 쌍따옴표 제거 완료 */}
                  <div style={{ fontSize: '0.85rem', color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.text}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}