import React, { useEffect, useRef, useState } from 'react'
import EmojiPicker from 'emoji-picker-react'
import { REACTIONS, addCustomReaction, makeCommentId, removeCustomReaction } from '../lib/dataModel.js'
import { resizeStickerToDataUrl } from '../lib/image.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function ReactionBar({ entry, onToggle }) {
  const auth = useAuth()
  const myId = auth.currentMember?.id
  const [open, setOpen] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [pending, setPending] = useState(null) // { file, preview, name }
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [removingCustomId, setRemovingCustomId] = useState(null)
  const wrapRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
        setShowEmojiPicker(false)
        setPending(null)
        setUploadError(null)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const builtIn = REACTIONS.map((r) => ({ key: r.emoji, label: r.label, type: 'emoji', value: r.emoji }))
  const custom = (auth.config?.customReactions || []).map((r) => ({
    key: `custom:${r.id}`, label: r.name, type: 'image', value: r.image,
  }))
  const allReactions = [...builtIn, ...custom]

  function namesFor(key) {
    const ids = entry.reactions?.[key] || []
    return ids
      .map((id) => auth.members.find((m) => m.id === id)?.displayName || id)
      .join(', ')
  }

  const activeReactions = allReactions.filter((r) => (entry.reactions?.[r.key]?.length || 0) > 0)

  function handleFilePicked(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPending({ file, preview: URL.createObjectURL(file), name: '' })
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleConfirmSticker(e) {
    e.preventDefault()
    if (!pending) return
    setUploading(true)
    setUploadError(null)
    try {
      const image = await resizeStickerToDataUrl(pending.file, 64)
      const reaction = { id: makeCommentId(), name: pending.name.trim() || '반응', image }
      const updated = await addCustomReaction(auth.client, auth.config, auth.configSha, reaction)
      auth.setConfig(updated)
      await auth.refreshConfig()
      onToggle(`custom:${reaction.id}`)
      setPending(null)
      setOpen(false)
    } catch (err) {
      setUploadError(err.message || '반응을 추가하지 못했어요.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteCustom(e, reactionId, label) {
    e.stopPropagation()
    if (!window.confirm(`"${label}" 반응을 삭제할까요?`)) return
    setRemovingCustomId(reactionId)
    try {
      const updated = await removeCustomReaction(auth.client, auth.config, auth.configSha, reactionId)
      auth.setConfig(updated)
      await auth.refreshConfig()
    } finally {
      setRemovingCustomId(null)
    }
  }

  return (
    <div className="reaction-bar" ref={wrapRef}>
      {activeReactions.map((r) => {
        const count = entry.reactions?.[r.key]?.length || 0
        const mine = entry.reactions?.[r.key]?.includes(myId)
        return (
          <button
            key={r.key}
            type="button"
            className={`reaction-btn ${mine ? 'active' : ''}`}
            onClick={() => onToggle(r.key)}
            title={`${r.label} · ${namesFor(r.key)}`}
          >
            {r.type === 'image' ? <img src={r.value} alt={r.label} className="reaction-img" /> : <span>{r.value}</span>}
            <span className="reaction-count">{count}</span>
          </button>
        )
      })}

      <div className="reaction-add-wrap" style={{ position: 'relative' }}>
        <button
          type="button"
          className="reaction-add-btn"
          onClick={() => {
            setOpen((v) => !v)
            setShowEmojiPicker(false)
            setPending(null)
          }}
        >
          + 반응 추가
        </button>
        {open && (
          <div
            className="reaction-picker"
            style={{
              position: 'absolute',
              zIndex: 100,
              background: 'var(--card-bg, #fff)',
              border: '1px solid var(--border, #ddd)',
              padding: '10px',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            {!showEmojiPicker && !pending ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  onClick={() => setShowEmojiPicker(true)}
                >
                  😀 이모지 피커로 추가하기
                </button>

                <div
                  className="reaction-picker-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: '4px',
                    maxHeight: '150px',
                    overflowY: 'auto',
                  }}
                >
                  {allReactions.map((r) => {
                    const reactionId = r.key.startsWith('custom:') ? r.key.slice('custom:'.length) : null
                    return (
                      <div key={r.key} className="reaction-picker-cell" style={{ position: 'relative' }}>
                        <button
                          type="button"
                          className="reaction-picker-item"
                          title={r.label}
                          onClick={() => {
                            onToggle(r.key)
                            setOpen(false)
                          }}
                        >
                          {r.type === 'image' ? <img src={r.value} alt={r.label} style={{ width: '20px', height: '20px' }} /> : r.value}
                        </button>
                        {reactionId && (
                          <button
                            type="button"
                            className="reaction-picker-delete"
                            title="이 반응 삭제"
                            onClick={(e) => handleDeleteCustom(e, reactionId, r.label)}
                            disabled={removingCustomId === reactionId}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>

                <label
                  className="reaction-upload-btn"
                  style={{ cursor: 'pointer', textAlign: 'center', padding: '6px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', fontSize: '0.85rem' }}
                >
                  + 이미지로 새 반응 만들기
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFilePicked} hidden />
                </label>
              </div>
            ) : showEmojiPicker ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <button type="button" className="btn btn-ghost btn-small" onClick={() => setShowEmojiPicker(false)}>
                    ← 뒤로
                  </button>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>이모지 선택</span>
                </div>
                <EmojiPicker
                  onEmojiClick={(emojiData) => {
                    onToggle(emojiData.emoji)
                    setOpen(false)
                    setShowEmojiPicker(false)
                  }}
                  width={300}
                  height={350}
                />
              </div>
            ) : (
              <form className="reaction-sticker-form" onSubmit={handleConfirmSticker}>
                <img src={pending.preview} alt="새 반응 미리보기" className="reaction-sticker-preview" style={{ width: '40px', height: '40px' }} />
                <input
                  type="text"
                  placeholder="반응 이름 (예: 최고)"
                  value={pending.name}
                  onChange={(e) => setPending((p) => ({ ...p, name: e.target.value }))}
                  autoFocus
                />
                {uploadError && <p className="setup-error">{uploadError}</p>}
                <div className="reaction-sticker-actions" style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                  <button type="button" className="btn btn-ghost btn-small" onClick={() => setPending(null)}>취소</button>
                  <button type="submit" className="btn btn-primary btn-small" disabled={uploading}>
                    {uploading ? '추가 중...' : '추가'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}