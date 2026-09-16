import React, { useEffect, useRef, useState } from 'react'
import { REACTIONS, addCustomReaction, makeCommentId, removeCustomReaction } from '../lib/dataModel.js'
import { resizeStickerToDataUrl } from '../lib/image.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function ReactionBar({ entry, onToggle }) {
  const auth = useAuth()
  const myId = auth.currentMember?.id
  const wrapRef = useRef(null)

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

      <div className="reaction-add-wrap">
        <button
          type="button"
          className="reaction-add-btn"
          onClick={() => {
            // 기본 첫 번째 이모지를 바로 토글하거나 추가하는 심플한 동작으로 변경 (팝업 창 원천 차단)
            if (builtIn.length > 0) {
              onToggle(builtIn[0].key)
            }
          }}
          title="기본 반응 추가"
        >
          + 반응 추가
        </button>
      </div>
    </div>
  )
}
