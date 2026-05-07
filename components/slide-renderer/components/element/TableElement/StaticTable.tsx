'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { PPTTableElement, TableCell } from '@/lib/types/slides';
import { getTableSubThemeColor } from '@/lib/utils/element';
import { getTextStyle, formatText, getHiddenCells, readPlainFromEditableCell } from './tableUtils';

export interface StaticTableProps {
  elementInfo: PPTTableElement;
  /** When true, cells are contenteditable and commit plain text on blur. */
  editable?: boolean;
  /** Called on cell mousedown/touchstart (before edit); use to select table without starting drag. */
  onEditPointerDown?: (e: React.MouseEvent | React.TouchEvent) => void;
  /** Persist updated cell text (row/col index in the logical `data` matrix). */
  onCellTextCommit?: (rowIdx: number, colIdx: number, text: string) => void;
}

interface TableBodyCellProps {
  cell: TableCell;
  rowIdx: number;
  colIdx: number;
  editable: boolean;
  borderStyle: string;
  cellStyle: CSSProperties;
  onEditPointerDown?: (e: React.MouseEvent | React.TouchEvent) => void;
  onCellTextCommit?: (rowIdx: number, colIdx: number, text: string) => void;
}

function TableBodyCell({
  cell,
  rowIdx,
  colIdx,
  editable,
  borderStyle,
  cellStyle,
  onEditPointerDown,
  onCellTextCommit,
}: TableBodyCellProps) {
  const tdRef = useRef<HTMLTableCellElement>(null);

  useLayoutEffect(() => {
    if (!editable) return;
    const el = tdRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    el.innerHTML = formatText(cell.text);
  }, [cell.text, cell.id, editable]);

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    onEditPointerDown?.(e);
  };

  if (!editable) {
    return (
      <td
        colSpan={cell.colspan > 1 ? cell.colspan : undefined}
        rowSpan={cell.rowspan > 1 ? cell.rowspan : undefined}
        style={{
          border: borderStyle,
          padding: '5px',
          verticalAlign: 'middle',
          wordBreak: 'break-word',
          ...cellStyle,
        }}
        dangerouslySetInnerHTML={{ __html: formatText(cell.text) }}
      />
    );
  }

  return (
    <td
      ref={tdRef}
      contentEditable
      suppressContentEditableWarning
      colSpan={cell.colspan > 1 ? cell.colspan : undefined}
      rowSpan={cell.rowspan > 1 ? cell.rowspan : undefined}
      className="outline-none focus-visible:ring-2 focus-visible:ring-violet-400/80 focus-visible:ring-offset-0 cursor-text"
      style={{
        border: borderStyle,
        padding: '5px',
        verticalAlign: 'middle',
        wordBreak: 'break-word',
        ...cellStyle,
      }}
      onMouseDown={handlePointerDown}
      onTouchStart={handlePointerDown}
      onBlur={(e) => {
        const plain = readPlainFromEditableCell(e.currentTarget);
        if (plain !== cell.text) {
          onCellTextCommit?.(rowIdx, colIdx, plain);
        }
      }}
    />
  );
}

/**
 * Static table rendering component, ported from PPTist StaticTable.vue.
 * Renders table data with theme colors, outline borders, and merged cells.
 * Optional `editable` enables in-cell text editing on the canvas.
 */
export function StaticTable({
  elementInfo,
  editable = false,
  onEditPointerDown,
  onCellTextCommit,
}: StaticTableProps) {
  const { width, data, colWidths, cellMinHeight, outline, theme } = elementInfo;

  const hiddenCells = useMemo(() => getHiddenCells(data), [data]);

  const [subThemeDark, subThemeLight] = useMemo(() => {
    if (!theme) return ['', ''];
    return getTableSubThemeColor(theme.color);
  }, [theme]);

  const borderStyle = useMemo(() => {
    if (!outline) return 'none';
    const w = outline.width ?? 1;
    const c = outline.color ?? '#000';
    const s = outline.style === 'dashed' ? 'dashed' : 'solid';
    return `${w}px ${s} ${c}`;
  }, [outline]);

  /**
   * Get background color for a cell based on theme and position
   */
  const getCellBg = (
    rowIdx: number,
    colIdx: number,
    cellBackcolor?: string,
  ): string | undefined => {
    if (cellBackcolor) return cellBackcolor;
    if (!theme) return undefined;

    const rowCount = data.length;
    const colCount = data[0]?.length ?? 0;

    // Row header (first row) gets theme color
    if (theme.rowHeader && rowIdx === 0) return theme.color;
    // Row footer (last row) gets theme color
    if (theme.rowFooter && rowIdx === rowCount - 1) return theme.color;
    // Col header (first col) gets dark sub-theme
    if (theme.colHeader && colIdx === 0) return subThemeDark;
    // Col footer (last col) gets dark sub-theme
    if (theme.colFooter && colIdx === colCount - 1) return subThemeDark;

    // Alternating row colors (skip header row for counting)
    const effectiveRow = theme.rowHeader ? rowIdx - 1 : rowIdx;
    if (effectiveRow >= 0 && effectiveRow % 2 === 0) return subThemeLight;

    return undefined;
  };

  /**
   * Get text color for header/footer rows (white text on dark bg)
   */
  const getHeaderTextColor = (rowIdx: number): string | undefined => {
    if (!theme) return undefined;
    const rowCount = data.length;
    if (theme.rowHeader && rowIdx === 0) return '#fff';
    if (theme.rowFooter && rowIdx === rowCount - 1) return '#fff';
    return undefined;
  };

  return (
    <table
      className="w-full h-full"
      style={{
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
      }}
    >
      <colgroup>
        {colWidths.map((w, i) => (
          <col key={i} style={{ width: `${w * width}px` }} />
        ))}
      </colgroup>
      <tbody>
        {data.map((row, rowIdx) => (
          <tr key={rowIdx} style={{ height: `${cellMinHeight}px` }}>
            {row.map((cell, colIdx) => {
              if (hiddenCells.has(`${rowIdx}_${colIdx}`)) return null;

              const bgColor = getCellBg(rowIdx, colIdx, cell.style?.backcolor);
              const headerColor = getHeaderTextColor(rowIdx);
              const textStyle = getTextStyle(cell.style);

              // Header text color should be overridden only if cell doesn't have its own color
              if (headerColor && !cell.style?.color) {
                textStyle.color = headerColor;
              }

              return (
                <TableBodyCell
                  key={cell.id}
                  cell={cell}
                  rowIdx={rowIdx}
                  colIdx={colIdx}
                  editable={editable}
                  borderStyle={borderStyle}
                  cellStyle={{
                    backgroundColor: bgColor,
                    ...textStyle,
                  }}
                  onEditPointerDown={onEditPointerDown}
                  onCellTextCommit={onCellTextCommit}
                />
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
