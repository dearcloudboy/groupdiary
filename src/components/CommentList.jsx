import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import Avatar from './Avatar.jsx'
import RemoteImage from './RemoteImage.jsx'

export default function CommentList({ comments = [], onDelete, onUpdate, onCommentClick, onImageClick }) {
  const auth = useAuth()
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [showAll, setShowAll] = useState(false)

  if (comments.length === 0) return null

  const totalCount = comments.length
  const displayedComments = showAll ? comments : comments.slice(-5)

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
      
      {/* 컴포넌트가 인라인 스타일을 무시하는 경우를 대비해 CSS로 강력하게 덮어버립니다! */}
      <style>{`
        .force-comment-thumb {
          width: 120px !important;
          height: 120px !important;
          object-fit: cover !important;
          border-radius: 8px !important;
          display: block !important;
          margin: 0 !important;
        }
      `}</style>

      {!showAll && totalCount > 5 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          style={{ background: 'none', border: 'none', color: 'var(--accent, #2b56cc)', fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left', padding: '0.2rem 0', marginBottom: '0.2rem' }}
        >
          💬 모든 댓글 보기 ({totalCount}개)
        </button>
      )}

      {displayedComments.map((c) => {
        const author = auth.members.find((m) => m.id === c.author)
        const isMyComment = auth.currentMember?.id === c.author
        const isEditing = editingId === c.id

        return (
          <div
            key={c.id}
            className="comment-item"
            style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.9rem', background: 'rgba(0, 0, 0, 0.02)', padding: '0.6rem 0.8rem', borderRadius: '12px' }}
          >
            <div className="comment-avatar-wrap" style={{ width: '30px', height: '30px', minWidth: '30px', minHeight: '30px', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <style>{`.comment-avatar-wrap .avatar, .comment-avatar-wrap .avatar img, .comment-avatar-wrap img { width: 30px !important; height: 30px !important; min-width: 30px !important; min-height: 30px !important; font-size: 1rem !important; line-height: 30px !important; object-fit: cover !important; border-radius: 50% !important; }`}</style>
              <Avatar member={author} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{author?.displayName || c.author}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#999' }}>{formatTime(c.createdAt)}</span>
                  {isMyComment && !isEditing && (
                    <div style={{ display: 'flex', gap: '0.3rem', marginLeft: '0.2rem' }}>
                      <button type="button" onClick={() => startEdit(c)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}>수정</button>
                      <button type="button" onClick={() => onDelete(c.id)} style={{ background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}>✕</button>
                    </div>
                  )}
                </div>
              </div>

              {isEditing ? (
                <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.4rem', flexDirection: 'column' }}>
                  <textarea rows={2} value={editText} onChange={(e) => setEditText(e.target.value)} style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #ccc', fontSize: '0.9rem', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.3rem' }}>
                    <button type="button" onClick={cancelEdit} className="btn btn-ghost btn-small" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>취소</button>
                    <button type="button" onClick={() => saveEdit(c.id)} className="btn btn-primary btn-small" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'var(--accent, #7da0fa)', color: '#fff', border: 'none', borderRadius: '4px' }}>저장</button>
                  </div>
                </div>
              ) : (
                <p 
                  style={{ 
                    margin: '0.2rem 0 0', 
                    wordBreak: 'break-all', 
                    whiteSpace: 'pre-wrap', /* 화면에 줄바꿈을 유지하도록 하는 핵심 속성! */
                    color: '#333', 
                    cursor: onCommentClick ? 'pointer' : 'default' 
                  }}
                  onClick={() => onCommentClick && onCommentClick()}
                  title={onCommentClick ? '클릭해서 단독 페이지로 보기' : ''}
                >
                  {c.text}
                </p>
              )}

              {c.image && !isEditing && (
                <div style={{ marginTop: '0.6rem' }}>
                  <button
                    type="button"
                    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'block' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onImageClick?.(c.image);
                    }}
                    title="사진 크게 보기"
                  >
                    {/* 바로 여기에 강력한 강제 CSS 클래스(force-comment-thumb)를 붙였습니다! */}
                    <RemoteImage 
                      path={c.image} 
                      className="force-comment-thumb" 
                    />
                  </button>
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
  return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}