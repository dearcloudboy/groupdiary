import React, { useRef, useState } from 'react'
import { emptyEntry, getChecklistFields, imagePath, saveEntry, makeCommentId } from '../lib/dataModel.js'
import { resizeImageFile } from '../lib/image.js'
import { useAuth } from '../context/AuthContext.jsx'
import { DIARY_WORD } from '../config.js'
import RemoteImage from './RemoteImage.jsx'
import HashtagInput from './HashtagInput.jsx'

function hasAnyContent(content, checklist, moodTags, imageCount) {
  const anyChecked = Object.entries(checklist).some(([key, value]) => key !== 'sleepHours' && value)
  return !!content.trim()
    || anyChecked
    || (checklist.sleepHours !== '' && checklist.sleepHours !== null)
    || moodTags.length > 0
    || imageCount > 0
}

export default function EntryEditor({
  date,
  memberId,
  initialEntry = null,
  initialSha = undefined,
  parentEntry = null,
  subIndex = null,
  onSaved,
  onCancel,
}) {
  const auth = useAuth()
  const base = initialEntry || emptyEntry(date, memberId)
  const fields = getChecklistFields(auth.members.find((m) => m.id === memberId))
  const [content, setContent] = useState(base.content || '')
  const [moodTags, setMoodTags] = useState(base.moodTags || [])
  const [checklist, setChecklist] = useState(() => {
    const initial = { sleepHours: base.checklist?.sleepHours ?? '' }
    fields.forEach((f) => { initial[f.key] = !!base.checklist?.[f.key] })
    return initial
  })
  const [existingImages, setExistingImages] = useState(base.images || (base.image ? [base.image] : []))
  const [newImages, setNewImages] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  function toggle(key) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function handleFiles(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setNewImages((prev) => [...prev, ...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeExisting(path) {
    setExistingImages((prev) => prev.filter((p) => p !== path))
  }

  function removeNew(index) {
    setNewImages((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const uploadedPaths = []
      for (const img of newImages) {
        const { base64, extension } = await resizeImageFile(img.file)
        const path = imagePath(date, memberId, `entry.${extension}`)
        await auth.client.putBase64File(path, base64, { message: `${DIARY_WORD} 이미지 (${date})` })
        uploadedPaths.push(path)
      }

      const thisItem = {
        ...base,
        id: base.id || makeCommentId(),
        content: content.trim(),
        moodTags,
        images: [...existingImages, ...uploadedPaths],
        checklist: {
          ...checklist,
          sleepHours: checklist.sleepHours === '' ? null : Number(checklist.sleepHours),
        },
        createdAt: base.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      delete thisItem.image
      delete thisItem.mood

      let payloadToSave = null

      if (parentEntry) {
        // 이미 해당 날짜에 글이 있는 경우 (새 글 추가 또는 기존 글 수정)
        const currentList = parentEntry.subEntries && parentEntry.subEntries.length > 0
          ? [...parentEntry.subEntries]
          : [{ ...parentEntry }]

        if (subIndex !== null && subIndex >= 0) {
          currentList[subIndex] = thisItem
        } else {
          currentList.push(thisItem)
        }
        payloadToSave = {
          ...parentEntry,
          ...currentList[0], // 하위 호환성 유지
          subEntries: currentList,
          updatedAt: new Date().toISOString(),
        }
      } else {
        // 해당 날짜에 첫 글을 작성하는 경우
        payloadToSave = {
          ...thisItem,
          subEntries: [thisItem],
        }
      }

      const { entry, sha } = await saveEntry(auth.client, date, memberId, payloadToSave, initialSha)
      onSaved(entry, sha)
    } catch (err) {
      setError(err.message || '저장에 실패했어요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="entry-editor" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      <div className="mood-row" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
        <span className="mood-row-label" style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>오늘 기분</span>
        <HashtagInput value={moodTags} onChange={setMoodTags} placeholder="#피곤 #설렘 처럼 적어보세요" />
      </div>

      <textarea
        className="entry-textarea"
        rows={6}
        placeholder="오늘 하루는 어땠나요?"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        style={{
          width: '100%',
          padding: '1rem',
          borderRadius: '12px',
          border: '1px solid rgba(0,0,0,0.12)',
          fontFamily: 'inherit',
          fontSize: '0.95rem',
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />

      <div className="image-upload-row">
        <label className="attach-btn" title="사진 첨부" style={{ cursor: 'pointer' }}>
          사진 추가
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFiles} hidden />
        </label>
        {(existingImages.length > 0 || newImages.length > 0) && (
          <div className="image-preview-grid">
            {existingImages.map((path) => (
              <div className="image-preview-item" key={path}>
                <RemoteImage path={path} className="image-preview-thumb" />
                <button type="button" className="remove-preview" onClick={() => removeExisting(path)}>✕</button>
              </div>
            ))}
            {newImages.map((img, i) => (
              <div className="image-preview-item" key={i}>
                <img src={img.preview} alt="첨부 미리보기" className="image-preview-thumb" />
                <button type="button" className="remove-preview" onClick={() => removeNew(i)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="checklist-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        {fields.map((f) => (
          <button
            type="button"
            key={f.key}
            className={`chip toggle ${checklist[f.key] ? 'active' : ''}`}
            onClick={() => toggle(f.key)}
          >
            <span>{f.icon}</span> {f.label}
          </button>
        ))}
        <label className="sleep-input" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <span>수면</span>
          <input
            type="number" min="0" max="24" step="0.5"
            placeholder="시간"
            value={checklist.sleepHours}
            onChange={(e) => setChecklist((prev) => ({ ...prev, sleepHours: e.target.value }))}
            style={{ width: '50px', padding: '0.2rem' }}
          />
          <span>시간</span>
        </label>
      </div>

      {error && <p className="setup-error" style={{ color: 'red', margin: 0 }}>{error}</p>}

      <div className="entry-editor-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
        {onCancel && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            style={{ padding: '0.6rem 1.2rem', cursor: 'pointer' }}
          >
            취소
          </button>
        )}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving || !hasAnyContent(content, checklist, moodTags, existingImages.length + newImages.length)}
          style={{
            padding: '0.6rem 1.4rem',
            borderRadius: '10px',
            backgroundColor: 'var(--accent, #7da0fa)',
            color: '#fff',
            border: 'none',
            fontWeight: 'bold',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? '저장하는 중...' : '저장하기'}
        </button>
      </div>
    </form>
  )
}