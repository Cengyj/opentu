import React from 'react';
import { History, Layers3, Trash2, X } from 'lucide-react';
import type { Task } from '../../../types/task.types';
import type {
  PsdHistoryEntry,
  PsdHistoryStatus,
} from '../../../services/psd-history/psd-history-types';
import { usePsdHistory } from './usePsdHistory';

interface PsdHistoryDrawerProps {
  uiLanguage: 'zh' | 'en';
  open: boolean;
  tasks: Task[];
  activeSessionId: string | null;
  onClose: () => void;
  onRestore: (entry: PsdHistoryEntry) => void;
}

const STATUS_LABEL: Record<PsdHistoryStatus, { zh: string; en: string }> = {
  reviewing: { zh: '待生成', en: 'Reviewing' },
  generating: { zh: '生成中', en: 'Generating' },
  completed: { zh: '已完成', en: 'Completed' },
  partial: { zh: '部分完成', en: 'Partial' },
  failed: { zh: '失败', en: 'Failed' },
};

function formatTime(timestamp: number, uiLanguage: 'zh' | 'en'): string {
  try {
    return new Date(timestamp).toLocaleString(
      uiLanguage === 'zh' ? 'zh-CN' : 'en-US',
      { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    );
  } catch {
    return '';
  }
}

export function PsdHistoryDrawer({
  uiLanguage,
  open,
  tasks,
  activeSessionId,
  onClose,
  onRestore,
}: PsdHistoryDrawerProps) {
  const { items, loading, removeEntry, clearAll } = usePsdHistory({
    open,
    tasks,
  });

  if (!open) return null;

  return (
    <div
      className="psd-history-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={uiLanguage === 'zh' ? 'PSD 历史记录' : 'PSD history'}
      onClick={onClose}
    >
      <aside
        className="psd-history-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="psd-history-panel__head">
          <span className="psd-history-panel__title">
            <History size={18} />
            {uiLanguage === 'zh' ? 'PSD 历史记录' : 'PSD history'}
            {items.length > 0 ? (
              <em className="psd-history-panel__count">{items.length}</em>
            ) : null}
          </span>
          <div className="psd-history-panel__head-actions">
            {items.length > 0 ? (
              <button
                type="button"
                className="psd-history-panel__clear"
                onClick={() => void clearAll()}
              >
                {uiLanguage === 'zh' ? '清空' : 'Clear all'}
              </button>
            ) : null}
            <button
              type="button"
              className="psd-history-panel__close"
              onClick={onClose}
              aria-label={uiLanguage === 'zh' ? '关闭' : 'Close'}
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="psd-history-panel__body">
          {loading && items.length === 0 ? (
            <div className="psd-history-panel__empty">
              {uiLanguage === 'zh' ? '加载中…' : 'Loading…'}
            </div>
          ) : items.length === 0 ? (
            <div className="psd-history-panel__empty">
              <Layers3 size={32} />
              <span>
                {uiLanguage === 'zh'
                  ? '还没有 PSD 会话历史。分析并生成后会自动记录在这里。'
                  : 'No PSD sessions yet. They are recorded here once you analyze and generate.'}
              </span>
            </div>
          ) : (
            <ul className="psd-history-grid">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`psd-history-tile ${
                    item.id === activeSessionId
                      ? 'psd-history-tile--active'
                      : ''
                  }`}
                >
                  <button
                    type="button"
                    className="psd-history-tile__main"
                    onClick={() => onRestore(item)}
                  >
                    <span className="psd-history-tile__preview">
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Layers3 size={28} />
                      )}
                      <span
                        className={`psd-history-tile__badge psd-history-tile__badge--${item.liveStatus}`}
                      >
                        {STATUS_LABEL[item.liveStatus][uiLanguage]}
                      </span>
                    </span>
                    <span className="psd-history-tile__info">
                      <strong title={item.title}>{item.title}</strong>
                      <small>
                        {uiLanguage === 'zh'
                          ? `${item.totalLayers} 层 · 已出 ${item.readyCount}`
                          : `${item.totalLayers} layers · ${item.readyCount} ready`}
                      </small>
                      <small className="psd-history-tile__time">
                        {formatTime(item.updatedAt, uiLanguage)}
                      </small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="psd-history-tile__delete"
                    onClick={(event) => {
                      event.stopPropagation();
                      void removeEntry(item.id);
                    }}
                    aria-label={uiLanguage === 'zh' ? '删除' : 'Delete'}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
