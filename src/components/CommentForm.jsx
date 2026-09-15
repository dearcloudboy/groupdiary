import React, { useRef, useState } from 'react'

export default function CommentForm({ onSubmit }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  // 브라우저에서 이미지를 받아 최대 너비 1000px 기준 비율대로 깔끔하게 압축/리사이즈하는 함수
  function resizeImageFile(imageFile, maxWidth = 1000, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          let width = img.width
          let height = img.height

          // 원본이 지정된 최대 너비보다 크면 비율에 맞춰 줄임
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)

          // JPEG 형식의 데이터 URL로 변환
          const dataUrl = canvas.toDataURL('image/jpeg', quality)
          
          // DataUrl을 Blob/File로 변환
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
      // 업로드 전 자동 리사이즈 및 미리보기 갱신
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