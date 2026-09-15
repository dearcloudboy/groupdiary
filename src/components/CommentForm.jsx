import React, { useRef, useState } from 'react'

export default function CommentForm({ onSubmit }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null) // textarea 높이 조절을 위한 ref 추가

  // 브라우저에서 이미지를 받아 최대 너비 1000px 기준 비율대로 깔끔하게 압축/리사이즈하는 함수
  function resizeImageFile(imageFile, maxWidth = 1000, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          let width = img.width
          let height = img.height

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)

          const dataUrl = canvas.toDataURL('image/jpeg', quality)
          
          const arr = dataUrl.split(',')
          const mime = arr[0].match(/:(.*?);/)[1]
          const bstr = atob(arr[1])
          let n = bstr.length
          const u8arr = new Uint8Array(n)
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n)
          }
          const compressedBlob = new Blob([u8arr], { type: mime })
          const compressedFile = new File([compressedBlob], imageFile.name || 'image.jpg', { type: mime })

          resolve({ file: compressedFile, previewUrl: dataUrl })
        }
        img.onerror = reject
        img.src = e.target.result
      }
      reader.onerror = reject
      reader.readAsDataURL(imageFile)
    })
  }

  async function handleFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const { file: compressedFile, previewUrl } = await resizeImageFile(f, 1000, 0.8)
      setFile(compressedFile)
      setPreview(previewUrl)
    } catch (err) {
      console.error('이미지 압축 실패, 원본 사용:', err)
      setFile(f)
      setPreview(URL.createObjectURL(f))
    }
  }

  function clearFile() {
    setFile(null)
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e) {
    if (e && e.preventDefault) e.preventDefault()
    if (!text.trim() && !file) return
    
    setBusy(true)
    setError(null)
    try {
      await onSubmit({ text: text.trim(), imageFile: file })
      setText('')
      clearFile()
      // 등록 성공 시 높이 초기화
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch (err) {
      setError(err.message || '댓글을 남기지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  // 키보드 입력 핸들러: Enter = 등록, Shift+Enter = 줄바꿈
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault() // 기본 줄바꿈 방지
      handleSubmit(e)
    }
  }

  // 텍스트가 길어지면 textarea 높이를 자동으로 늘려주는 함수
  const handleTextChange = (e) => {
    setText(e.target.value)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
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
      {/* 입력창이 늘어날 때 버튼들이 아래쪽에 맞춰지도록 alignItems를 flex-end로 조절 */}
      <div className="comment-form-row" style={{ alignItems: 'flex-end' }}>
        <textarea
          ref={textareaRef}
          placeholder="댓글을 남겨보세요..."
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          rows={1}
          style={{
            flex: 1,
            minWidth: 0,
            resize: 'none', /* 우측 하단 크기 조절 막기 */
            overflowY: 'auto',
            padding: '9px 12px',
            borderRadius: '8px',
            border: '1px solid var(--line)',
            background: 'var(--surface)',
            fontFamily: 'inherit',
            fontSize: '14px',
            lineHeight: '1.5',
            maxHeight: '150px', /* 너무 길어지면 내부 스크롤 생성 */
            boxSizing: 'border-box'
          }}
        />
        <label className="attach-btn" title="사진 첨부" style={{ marginBottom: '2px' }}>
          사진 추가
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} hidden />
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy || (!text.trim() && !file)} style={{ marginBottom: '2px' }}>
          {busy ? '올리는 중...' : '등록'}
        </button>
      </div>
      {error && <p className="setup-error">{error}</p>}
    </form>
  )
}