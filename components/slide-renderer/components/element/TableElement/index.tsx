'use client';

import { useCallback } from 'react';
import type { PPTTableElement } from '@/lib/types/slides';
import { useCanvasOperations } from '@/lib/hooks/use-canvas-operations';
import { useHistorySnapshot } from '@/lib/hooks/use-history-snapshot';
import { StaticTable } from './StaticTable';

export { BaseTableElement } from './BaseTableElement';

export interface TableElementProps {
  elementInfo: PPTTableElement;
  selectElement?: (
    e: React.MouseEvent | React.TouchEvent,
    element: PPTTableElement,
    canMove?: boolean,
  ) => void;
}

/**
 * Editable table element component.
 * Supports selection/drag/resize via selectElement callback and in-cell text editing.
 */
export function TableElement({ elementInfo, selectElement }: TableElementProps) {
  const { updateElement } = useCanvasOperations();
  const { addHistorySnapshot } = useHistorySnapshot();

  const handleSelectElement = (e: React.MouseEvent | React.TouchEvent) => {
    if (elementInfo.lock) return;
    e.stopPropagation();
    selectElement?.(e, elementInfo);
  };

  const handleCellTextCommit = useCallback(
    (rowIdx: number, colIdx: number, text: string) => {
      const row = elementInfo.data[rowIdx];
      if (!row || !row[colIdx]) return;
      if (row[colIdx].text === text) return;
      const newData = elementInfo.data.map((r, ri) =>
        r.map((c, ci) => (ri === rowIdx && ci === colIdx ? { ...c, text } : c)),
      );
      updateElement({
        id: elementInfo.id,
        props: { data: newData },
      });
      addHistorySnapshot();
    },
    [addHistorySnapshot, elementInfo.data, elementInfo.id, updateElement],
  );

  const handleEditPointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (elementInfo.lock) return;
      selectElement?.(e, elementInfo, false);
    },
    [elementInfo, selectElement],
  );

  return (
    <div
      className={`editable-element-table absolute ${elementInfo.lock ? 'lock' : ''}`}
      style={{
        top: `${elementInfo.top}px`,
        left: `${elementInfo.left}px`,
        width: `${elementInfo.width}px`,
        height: `${elementInfo.height}px`,
      }}
    >
      <div
        className="rotate-wrapper w-full h-full"
        style={{ transform: `rotate(${elementInfo.rotate}deg)` }}
      >
        <div
          className={`element-content relative w-full h-full overflow-hidden ${
            elementInfo.lock ? 'cursor-default' : 'cursor-move'
          }`}
          onMouseDown={handleSelectElement}
          onTouchStart={handleSelectElement}
        >
          <StaticTable
            elementInfo={elementInfo}
            editable={!elementInfo.lock}
            onEditPointerDown={handleEditPointerDown}
            onCellTextCommit={handleCellTextCommit}
          />
        </div>
      </div>
    </div>
  );
}
