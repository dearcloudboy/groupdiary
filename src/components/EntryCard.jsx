import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  deleteEntry, getChecklistFields, imagePath, makeCommentId, saveEntry, toggleReaction, withNewComment, withoutComment, withUpdatedComment,
} from '../lib/dataModel.js'
import Avatar from './Avatar.jsx'
import RemoteImage from './RemoteImage.jsx'
import Lightbox from './Lightbox.jsx'
import ReactionBar from './ReactionBar.jsx'
import CommentList from './CommentList.jsx'
import CommentForm from './CommentForm.jsx'
import EntryEditor from './EntryEditor.jsx'

function cleanTag(t) {
  if (!t) return ''
  return String(t).replace(/^#+/, '').trim()
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function EntryCard({
  entry: initialEntry,
  sha: initialSha,
  date,
  memberId,
  subIndex = 0,
  parentEntry = null,
  showDate = false,
  isDetailView = false, // 단독 뷰 모드 여부
  onOpenDetail = null,  // 페이지 이동 함수
  onTagClick = null,
  onUpdated,
  onDeleted,
}) {
  const auth = useAuth()
  const [entry, setEntry] = useState(initialEntry)
  const [sha, setSha] = useState(initialSha)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [lightboxPath, setLightboxPath] = useState(null)

  const author = auth.members.find((m) => m.id === memberId)
  const isMine = auth.currentMember?.id === memberId
  const moodTags = entry.moodTags || []

  async function persist(nextEntry) {
    let payload = null
    if (parentEntry && parentEntry.subEntries && parentEntry.subEntries.length > 0) {
      const list = [...parentEntry.subEntries]
      list[subIndex] = nextEntry
      payload = { ...parentEntry, subEntries: list, updatedAt: new Date().toISOString() }
    } else {
      payload = nextEntry
    }

    const { entry: saved, sha: nextSha } = await saveEntry(auth.client, date, memberId, payload, sha)
    setEntry(nextEntry)
    setSha(nextSha)
    onUpdated?.()
  }

  async function handleToggleReaction(emoji) {
    if (busy) return
    setBusy(true)
    const prev = entry
    const optimistic = toggleReaction(entry, emoji, auth.currentMember.id)
    setEntry(optimistic)
    try {
      await persist(optimistic)
    } catch (e) {
      setEntry(prev)
    } finally {
      setBusy(false)
    }
  }

  async function handleAddComment({ text, imageFile }) {
    let imgPath = null
    if (imageFile) {
      const dataUrl = await fileToBase64(imageFile)
      const base64Data = dataUrl.split(',')[1]
      const extension = imageFile.name ? imageFile.name.split('.').pop() : 'jpg'
      
      imgPath = imagePath(date, auth.currentMember.id, `comment.${extension}`)
      await auth.client.putBase64File(imgPath, base64Data, { message: `댓글 이미지 (${date})` })
    }
    const comment = {
      id: makeCommentId(),
      author: auth.currentMember.id,
      text,
      image: imgPath,
      createdAt: new Date().toISOString(),
    }
    const nextEntry = withNewComment(entry, comment)
    await persist(nextEntry)
  }

  async function handleDeleteComment(commentId) {
    if (busy) return
    if (!window.confirm('이 댓글을 삭제할까요?')) return
    setBusy(true)
    try {
      const nextEntry = withoutComment(entry, commentId)
      await persist(nextEntry)
    } catch (e) {
      window.alert('댓글 삭제에 실패했어요.')
    } finally {
      setBusy(false)
    }
  }

  async function handleUpdateComment(commentId, newText) {
    if (busy) return
    setBusy(true)
    try {
      const nextEntry = withUpdatedComment(entry, commentId, newText)
      await persist(nextEntry)
    } catch (e) {
      window.alert('댓글 수정에 실패했어요.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (busy) return
    if (!window.confirm('정말 이 글을 삭제할까요?')) return
    setBusy(true)
    try {
      if (parentEntry && parentEntry.subEntries && parentEntry.subEntries.length > 1) {
        const filtered = parentEntry.subEntries.filter((_, i) => i !== subIndex)
        const updatedParent = {
          ...parentEntry, ...filtered[0], subEntries: filtered, updatedAt: new Date().toISOString(),
        }
        await saveEntry(auth.client, date, memberId, updatedParent, sha)
      } else {
        await deleteEntry(auth.client, date, memberId, sha)
      }
      onDeleted?.()
    } catch (e) {
      window.alert(e.message || '삭제에 실패했어요.')
      setBusy(false)
    }
  }

  const sleepHours = entry.checklist?.sleepHours
  const images = entry.images || (entry.image ? [entry.image] : [])

  const triggerDetailView = () => {
    if (!isDetailView && onOpenDetail) {
      onOpenDetail({ date, memberId, entryId: entry.id })
    }
  }

  return (
    <article className="entry-card card" style={{ '--author-color': author?.color || 'var(--accent)', breakInside: 'avoid' }}>
      <header className="entry-card-header">
        <div className="entry-card-who">
          <Avatar member={author} />
          <div>
            <div className="entry-card-name">{author?.displayName || memberId}</div>
            {showDate && <div className="entry-card-date">{formatDate(date)}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {isMine && !editing && (
            <div className="entry-card-actions">
              <button className="btn btn-ghost btn-small" onClick={() => setEditing(true)}>수정</button>
              <button className="btn btn-ghost btn-small btn-danger" onClick={handleDelete} disabled={busy}>삭제</button>
            </div>
          )}
        </div>
      </header>

      {moodTags.length > 0 && !editing && (
        <div className="entry-mood-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', margin: '0.6rem 0' }}>
          {moodTags.map((tag) => {
            const clean = cleanTag(tag)
            return (
              <button
                key={tag}
                type="button"
                className="entry-mood-tag"
                onClick={() => onTagClick?.(clean)}
                style={{
                  cursor: onTagClick ? 'pointer' : 'default', background: 'rgba(125, 160, 250, 0.12)',
                  color: 'var(--accent, #4a75e6)', border: '1px solid rgba(125, 160, 250, 0.25)',
                  borderRadius: '16px', padding: '0.25rem 0.65rem', fontSize: '0.85rem', fontWeight: 600,
                }}
              >
                #{clean}
              </button>
            )
          })}
        </div>
      )}

      {editing ? (
        <EntryEditor
          date={date} memberId={memberId} initialEntry={entry} initialSha={sha} parentEntry={parentEntry}
          subIndex={subIndex} onSaved={() => { setEditing(false); onUpdated?.(); }} onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <div className="checklist-row readonly">
            {getChecklistFields(author).map((f) => {
              const on = !!entry.checklist?.[f.key]
              return <span key={f.key} className={`chip checklist-status ${on ? 'on' : 'off'}`}>{f.label}:{on ? 'O' : 'X'}</span>
            })}
            {sleepHours != null && <span className="chip checklist-status">{sleepHours}시간 수면</span>}
          </div>

          <div
            onClick={triggerDetailView}
            style={{ cursor: !isDetailView ? 'pointer' : 'default' }}
            title={!isDetailView ? '클릭해서 단독 페이지로 보기' : ''}
          >
            {entry.content ? (
              <p className="entry-content">{entry.content}</p>
            ) : (
              <p className="entry-content empty">글 없이 체크리스트만 기록했어요.</p>
            )}
            {images.length > 0 && (
              <div className="entry-image-grid">
                {images.map((path) => (
                  <button
                    type="button"
                    key={path}
                    className="entry-image-btn"
                    onClick={(e) => { e.stopPropagation(); setLightboxPath(path); }}
                  >
                    <RemoteImage path={path} className="entry-image" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <ReactionBar entry={entry} onToggle={handleToggleReaction} />

      <div className="comment-section">
        <CommentList 
          comments={entry.comments} 
          onDelete={handleDeleteComment} 
          onUpdate={handleUpdateComment} 
          onCommentClick={triggerDetailView} 
        />
        <CommentForm onSubmit={handleAddComment} />
      </div>

      <Lightbox path={lightboxPath} onClose={() => setLightboxPath(null)} />
    </article>
  )
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-')
  return `${y}년 ${Number(m)}월 ${Number(d)}일`
}