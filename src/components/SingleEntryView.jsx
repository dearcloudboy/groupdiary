import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { getEntry } from '../lib/dataModel.js'
import EntryCard from './EntryCard.jsx'

export default function SingleEntryView({ date, memberId, entryId, onBack }) {
  const auth = useAuth()
  const [entryData, setEntryData] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await getEntry(auth.client, date, memberId)
      setEntryData(res)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [date, memberId, auth.client])

  if (loading) {
    return <div className="card skeleton-card" style={{ maxWidth: '680px', margin: '0 auto', width: '100%' }} />
  }

  if (!entryData?.json) {
    return (
      <div style={{ maxWidth: '680px', margin: '0 auto', width: '100%' }}>
        <button onClick={onBack} className="btn btn-ghost" style={{ marginBottom: '1rem' }}>← 목록으로 돌아가기</button>
        <div className="card empty-slot"><p>글을 찾을 수 없습니다.</p></div>
      </div>
    )
  }

  const subList = entryData.json.subEntries && entryData.json.subEntries.length > 0 
    ? entryData.json.subEntries 
    : [entryData.json]
  
  const targetEntry = entryId ? subList.find((e) => e.id === entryId) : subList[0]
  const subIndex = entryId ? subList.findIndex((e) => e.id === entryId) : 0

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', width: '100%' }}>
      <button 
        onClick={onBack} 
        className="btn btn-ghost" 
        style={{ marginBottom: '1rem', padding: '0.5rem 0', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
      >
        ← 목록으로 돌아가기
      </button>
      {targetEntry && (
        <EntryCard
          entry={targetEntry}
          sha={entryData.sha}
          date={date}
          memberId={memberId}
          subIndex={subIndex >= 0 ? subIndex : 0}
          parentEntry={entryData.json}
          showDate={true}
          isDetailView={true}
          onUpdated={loadData}
          onDeleted={onBack}
        />
      )}
    </div>
  )
}