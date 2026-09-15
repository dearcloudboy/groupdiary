import React, { useRef, useState } from 'react'
import { resizeStickerToDataUrl } from '../lib/image.js'

export default function CommentForm({ onSubmit }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  async function handleFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      // 이미지 자동 리사이즈 / 압축 적용
      const resizedDataUrl = await resizeStickerToDataUrl(f, 1200, 0.8)
      const resBlob = dataURItoBlob(resizedDataUrl)
      const resizedFile = new File([resBlob], f.name || 'comment-image.jpg', { type: 'image/jpeg' })
      setFile(resizedFile)
      setPreview(resizedDataUrl)
    } catch (err) {
      console.error('이미지 리사이즈 실패:', err)
      setFile(f)
      setPreview(URL.createObjectURL(f))
    }
  }

  function dataURItoBlob(dataURI) {
    const byteString = atob(dataURI.split(',')[1])
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i)
    }
    return new Blob([ab], { type: mimeString })
  }

  function clearFile() {
    setFile(null)
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim() && !file) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit({ text: text.trim(), imageFile: file })
      setText('')
      clearFile()
    } catch (err) {
      setError(err.message || '댓글을 남기지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="comment-form" onSubmit={handleSubmit}>
      {preview && (
        <div className="comment-form-preview">
          <img src={preview} alt="첨부 미리보기" />
          <button type="button" className="remove-preview" onClick={clearFile}>✕</button>
        </div>
      )}
      <div className="comment-form-row">
        <input
          type="text"
          placeholder="댓글을 남겨보세요..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <label className="attach-btn" title="사진 첨부">
          사진 추가
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} hidden />
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy || (!text.trim() && !file)}>
          {busy ? '올리는 중...' : '등록'}
        </button>
      </div>
      {error && <p className="setup-error">{error}</p>}
    </form>
  )
}