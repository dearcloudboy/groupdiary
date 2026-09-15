import React, { useEffect, useRef, useState } from 'react'
import { REACTIONS, addCustomReaction, makeCommentId, removeCustomReaction } from '../lib/dataModel.js'
import { resizeStickerToDataUrl } from '../lib/image.js'
import { useAuth } from '../context/AuthContext.jsx'
import EmojiPicker from 'emoji-picker-react' // 새로 설치한 이모지 키보드!

export default function ReactionBar({ entry, onToggle }) {
  const auth = useAuth()
  const myId = auth.currentMember?.id
  const [open, setOpen] = useState(false)
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
        setPending(null)
        setUploadError(null)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  // 커스텀 스티커 목록 가져오기
  const custom = (auth.config?.customReactions || []).map((r) => ({
    key: `custom:${r.id}`, label: r.name, type: 'image', value: r.image,
  }))

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
    if (!window.confirm(`"${label}" 반응을 삭제할까요? 이미 남긴 반응 기록에서는 사라지지 않고 빈 이미지로 보일 수 있어요.`)) return
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
    <div className="reaction-bar">
      {/* 1. 현재 달려있는 반응(이모지+커스텀스티커)들 보여주기 */}
      {Object.entries(entry.reactions || {}).map(([key, users]) => {
        if (!users || users.length === 0) return null
        const mine = users.includes(myId)
        const isCustom = key.startsWith('custom:')
        
        let imgSrc = null
        let label = key

        if (isCustom) {
          const customDef = custom.find((c) => c.key === key)
          imgSrc = customDef?.value
          label = customDef?.label || '커스텀 스티커'
        }

        const names = users.map((id) => auth.members.find((m) => m.id === id)?.displayName || id).join(', ')

        return (
          <button
            key={key}
            className={`reaction-btn ${mine ? 'active' : ''}`}
            onClick={() => onToggle(key)}
            title={`${label} · ${names}`}
          >
            {isCustom && imgSrc ? (
              <img src={imgSrc} alt={label} className="reaction-img" />
            ) : isCustom && !imgSrc ? (
              <span style={{ fontSize: '11px', color: '#999' }}>삭제됨</span>
            ) : (
              <span>{key}</span>
            )}
            <span className="reaction-count">{users.length}</span>
          </button>
        )
      })}

      {/* 2. 새 반응 추가 버튼 & 피커 팝업 */}
      <div className="reaction-add-wrap" ref={wrapRef}>
        <button type="button" className="reaction-add-btn" onClick={() => setOpen((v) => !v)}>
          + 반응 추가
        </button>

        {open && (
          <div className="reaction-picker" style={{ width: '310px', padding: '12px' }}>
            {!pending ? (
              <>
                {/* 2-1. 커스텀 스티커 영역 (기존 기능 완벽 유지) */}
                <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--ink-soft)', marginBottom: '8px' }}>
                    나만의 커스텀 스티커
                  </div>
                  {custom.length > 0 && (
                    <div className="reaction-picker-grid" style={{ marginBottom: '8px' }}>
                      {custom.map((r) => {
                        const reactionId = r.key.slice('custom:'.length)
                        return (
                          <div key={r.key} className="reaction-picker-cell">
                            <button
                              type="button"
                              className="reaction-picker-item"
                              title={r.label}
                              onClick={() => { onToggle(r.key); setOpen(false) }}
                            >
                              <img src={r.value} alt={r.label} />
                            </button>
                            <button
                              type="button"
                              className="reaction-picker-delete"
                              title="이 스티커 삭제"
                              onClick={(e) => handleDeleteCustom(e, reactionId, r.label)}
                              disabled={removingCustomId === reactionId}
                            >
                              ✕
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <label className="reaction-upload-btn" style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}>
                    + 이미지로 새 스티커 만들기
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFilePicked} hidden />
                  </label>
                </div>

                {/* 2-2. 기본 이모지 키보드 영역 (새로 추가됨) */}
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--ink-soft)', marginBottom: '8px' }}>
                  기본 이모지
                </div>
                <div style={{ width: '100%', overflow: 'hidden', borderRadius: '8px' }}>
                  <EmojiPicker 
                    onEmojiClick={(e) => {
                      onToggle(e.emoji)
                      setOpen(false)
                    }}
                    autoFocusSearch={false}
                    width="100%"
                    height={300}
                    searchPlaceHolder="이모지 검색..."
                  />
                </div>
              </>
            ) : (
              /* 2-3. 새 커스텀 스티커 업로드 폼 */
              <form className="reaction-sticker-form" onSubmit={handleConfirmSticker}>
                <img src={pending.preview} alt="새 반응 미리보기" className="reaction-sticker-preview" />
                <input
                  type="text" placeholder="반응 이름 (예: 최고)" value={pending.name}
                  onChange={(e) => setPending((p) => ({ ...p, name: e.target.value }))}
                  autoFocus
                />
                {uploadError && <p className="setup-error">{uploadError}</p>}
                <div className="reaction-sticker-actions">
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