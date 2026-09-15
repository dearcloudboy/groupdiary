import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { loadIndex, getEntry } from '../lib/dataModel.js'

export default function NotificationBell({ onSelectDate }) {
  const auth = useAuth()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [lastReadTime, setLastReadTime] = useState(() => {
    return localStorage.getItem(`noti_last_read_${auth.currentMember?.id}`) || '1970-01-01T00:00:00.000Z'
  })
  const popoverRef = useRef(null)

  const myId = auth.currentMember?.id

  // 내 글에 달린 댓글 + 내가 참여(댓글)한 글에 달린 새 댓글 탐색
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

            // 내 글이거나 내가 댓글을 단 적이 있는 글인 경우만 알림 대상
            if (isMyPost || haveICommented) {
              comments.forEach((c) => {
                // 본인이 작성한 댓글은 알림 제외
                if (c.author !== myId) {
                  const postAuthorMember = auth.members.find((m) => m.id === authorId)
                  const postAuthorName = postAuthorMember?.displayName || authorId

                  newNotis.push({
                    id: c.id,
                    date: d,
                    author: c.author,
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

      // 최신 댓글순 정렬
      newNotis.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      setNotifications(newNotis)
    } catch (e) {
      console.error('알림 로드 실패:', e)
    }
  }

  useEffect(() => {
    checkNotifications()
  }, [myId, auth.client])

  // 외부 클릭 시 닫기
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

  // 안 읽은 알림 개수
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

  function handleItemClick(date) {
    setOpen(false)
    onSelectDate?.(date)
  }

  if (!myId) return null

  return (
    <div ref={popoverRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={handleToggle}
        title="새 알림"
        style={{
          background: 'none',
          border: 'none',
          fontSize: '1.25rem',
          cursor: 'pointer',
          position: 'relative',
          padding: '0.3rem 0.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              background: '#ff4d4f',
              color: '#fff',
              fontSize: '0.65rem',
              fontWeight: 700,
              borderRadius: '10px',
              padding: '0.1rem 0.35rem',
              minWidth: '14px',
              textAlign: 'center',
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '290px',
            maxHeight: '380px',
            overflowY: 'auto',
            background: '#ffffff',
            borderRadius: '14px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            zIndex: 1000,
            padding: '0.6rem 0',
          }}
        >
          <div
            style={{
              padding: '0.4rem 0.9rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#444',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>새 댓글 알림</span>
            <span style={{ fontSize: '0.75rem', color: '#999' }}>{notifications.length}건</span>
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#999', fontSize: '0.85rem' }}>
              새로운 알림이 없어요.
            </div>
          ) : (
            notifications.slice(0, 20).map((n) => {
              const authorMember = auth.members.find((m) => m.id === n.author)
              const authorName = authorMember?.displayName || n.author

              return (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n.date)}
                  style={{
                    padding: '0.6rem 0.9rem',
                    borderBottom: '1px solid #fafafa',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.03)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#888' }}>
                    <span style={{ fontWeight: 600, color: '#333' }}>
                      {authorName}님의 댓글
                      <span style={{ fontWeight: 400, color: '#999', marginLeft: '4px', fontSize: '0.7rem' }}>
                        ({n.targetPostDesc})
                      </span>
                    </span>
                    <span>{n.date.slice(5)}</span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      color: '#444',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    "{n.text}"
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