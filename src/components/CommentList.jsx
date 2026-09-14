import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import Avatar from './Avatar.jsx'
import RemoteImage from './RemoteImage.jsx'

export default function CommentList({ comments = [], onDelete, onUpdate }) {
  const auth = useAuth()
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')

  if (comments.length === 0) return null

  function startEdit(c) {
    setEditingId(c.id)
    setEditText(c.text)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditText('')
  }

  function saveEdit(cId) {
    if (!editText.trim()) return
    onUpdate?.(cId, editText.trim())
    setEditingId(null)
    setEditText('')
  }

  return (
    <div className="comment-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.8rem' }}>
      {comments.map((c) => {
        const author = auth.members.find((m) => m.id === c.author)
        const isMyComment = auth.currentMember?.id === c.author
        const isEditing = editingId === c.id

        return (
          <div
            key={c.id}
            className="comment-item"
            style={{
              display: 'flex',
              gap: '0.6rem',
              alignItems: 'flex-start',
              fontSize: '0.9rem',
              background: 'rgba(0, 0, 0, 0.02)',
              padding: '0.5rem 0.7rem',
              borderRadius: '10px',
            }}
          >
            <Avatar member={author} size="small" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{author?.displayName || c.author}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#999' }}>{formatTime(c.createdAt)}</span>
                  {isMyComment && !isEditing && (
                    <div style={{ display: 'flex', gap: '0.3rem', marginLeft: '0.2rem' }}>
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        title="댓글 수정"
                        style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(c.id)}
                        title="댓글 삭제"
                        style={{ background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
                        onMouseEnter={(e) => (e.target.style.color = '#ff4d4d')}
                        onMouseLeave={(e) => (e.target.style.color = '#bbb')}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {isEditing ? (
                <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.4rem', flexDirection: 'column' }}>
                  <textarea
                    rows={2}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #ccc', fontSize: '0.9rem', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.3rem' }}>
                    <button type="button" onClick={cancelEdit} className="btn btn-ghost btn-small" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>취소</button>
                    <button type="button" onClick={() => saveEdit(c.id)} className="btn btn-primary btn-small" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'var(--accent, #7da0fa)', color: '#fff', border: 'none', borderRadius: '4px' }}>저장</button>
                  </div>
                </div>
              ) : (
                <p style={{ margin: '0.2rem 0 0', wordBreak: 'break-all', color: '#333' }}>{c.text}</p>
              )}

              {c.image && !isEditing && (
                <div style={{ marginTop: '0.4rem', maxWidth: '160px' }}>
                  <RemoteImage path={c.image} style={{ width: '100%', borderRadius: '8px' }} />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function formatTime(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const m = d.getMonth() + 1
  const day = d.getDate()
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${m}.${day} ${h}:${min}`
}