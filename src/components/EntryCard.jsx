import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  deleteEntry, getChecklistFields, imagePath, makeCommentId, saveEntry, toggleReaction, withNewComment, withoutComment, withUpdatedComment,
} from '../lib/dataModel.js'
import { resizeImageFile } from '../lib/image.js'
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

export default function EntryCard({
  entry: initialEntry,
  sha: initialSha,
  date,
  memberId,
  subIndex = 0,
  parentEntry = null,
  showDate = false,
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

  // 💡 notifyParent를 추가하여, 리액션 등 사소한 인터랙션 시 부모 피드 전체가 새로고침되는 것을 방지
  async function persist(nextEntry, notifyParent = true) {
    let payload = null
    if (parentEntry && parentEntry.subEntries && parentEntry.subEntries.length > 0) {
      const list = [...parentEntry.subEntries]
      list[subIndex] = nextEntry
      payload = { ...parentEntry, subEntries: list, updatedAt: new Date().toISOString() }
    } else {
      payload = nextEntry
    }

    const { entry: saved, sha: nextSha } = await saveEntry(auth.client, date, memberId, payload, sha)
    setEntry(saved || nextEntry)
    setSha(nextSha)
    if (notifyParent) {
      onUpdated?.()
    }
  }

  // 💡 리액션 누를 때는 부모 피드를 리로드(새고)하지 않고 내 카드만 조용히 업데이트 후 백그라운드 저장
  async function handleToggleReaction(emoji) {
    if (busy) return
    const prev = entry
    const optimistic = toggleReaction(entry, emoji, auth.currentMember.id)
    setEntry(optimistic)
    try {
      await persist(optimistic, false)
    } catch (e) {
      setEntry(prev)
    }
  }

  async function handleAddComment({ text, imageFile }) {
    let imgPath = null
    if (imageFile) {
      const { base64, extension } = await resizeImageFile(imageFile)
      imgPath = imagePath(date, auth.currentMember.id, `comment.${extension}`)
      await auth.client.putBase64File(imgPath, base64, { message: `댓글 이미지 (${date})` })
    }
    const comment = {
      id: makeCommentId(),
      author: auth.currentMember.id,
      text,
      image: imgPath,
      createdAt: new Date().toISOString(),
    }
    const nextEntry = withNewComment(entry, comment)
    await persist(nextEntry, true)
  }

  async function handleDeleteComment(commentId) {
    if (busy) return
    if (!window.confirm('이 댓글을 삭제할까요?')) return
    setBusy(true)
    try {
      const nextEntry = withoutComment(entry, commentId)
      await persist(nextEntry, true)
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
      await persist(nextEntry, true)
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
          ...parentEntry,
          ...filtered[0],
          subEntries: filtered,
          updatedAt: new Date().toISOString(),
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
        {isMine && !editing && (
          <div className="entry-card-actions">
            <button className="btn btn-ghost btn-small" onClick={() => setEditing(true)}>수정</button>
            <button className="btn btn-ghost btn-small btn-danger" onClick={handleDelete} disabled={busy}>삭제</button>
          </div>
        )}
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
                title={`#${clean} 모아보기`}
                style={{
                  cursor: onTagClick ? 'pointer' : 'default',
                  background: 'rgba(125, 160, 250, 0.12)',
                  color: 'var(--accent, #4a75e6)',
                  border: '1px solid rgba(125, 160, 250, 0.25)',
                  borderRadius: '16px',
                  padding: '0.25rem 0.65rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
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
          date={date}
          memberId={memberId}
          initialEntry={entry}
          initialSha={sha}
          parentEntry={parentEntry}
          subIndex={subIndex}
          onSaved={() => {
            setEditing(false)
            onUpdated?.()
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <div className="checklist-row readonly">
            {getChecklistFields(author).map((f) => {
              const on = !!entry.checklist?.[f.key]
              return (
                <span key={f.key} className={`chip checklist-status ${on ? 'on' : 'off'}`}>
                  {f.label}:{on ? 'O' : 'X'}
                </span>
              )
            })}
            {sleepHours != null && <span className="chip checklist-status">{sleepHours}시간 수면</span>}
          </div>
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
                  onClick={() => setLightboxPath(path)}
                  aria-label="사진 크게 보기"
                >
                  <RemoteImage path={path} className="entry-image" />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <ReactionBar entry={entry} onToggle={handleToggleReaction} />

      <div className="comment-section">
        <CommentList comments={entry.comments} onDelete={handleDeleteComment} onUpdate={handleUpdateComment} />
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