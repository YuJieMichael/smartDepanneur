'use client';

import { useEffect, useRef, useState } from 'react';
import { DatePicker, Input, InputNumber, Select, Skeleton, Tooltip } from 'antd';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { formatDate, DATE_FORMAT } from '@/lib/utils';
import { globalMessage } from '@/lib/message-bridge';
import NA from '@/components/common/na';
import type { ColumnType } from '@/components/table/data-table';

dayjs.extend(utc);

// Global record of last mousedown target
let lastMouseDownTarget: EventTarget | null = null;
if (typeof document !== 'undefined') {
  document.addEventListener(
    'mousedown',
    (e) => { lastMouseDownTarget = e.target; },
    { passive: true, capture: true },
  );
}

interface SmartDepanneurColumnProps {
  value: any;
  cellId: string;
  date?: boolean;
  editable?: boolean;
  type?: ColumnType;
  options?: { label: string; value: string }[];
  tooltip?: boolean;
  update?: (newValue: any) => Promise<void>;
  render?: (value: any) => React.ReactNode;
}

export default function SmartDepanneurColumn({
  value,
  cellId,
  date,
  editable,
  type: rawType = 'input',
  options = [],
  tooltip = true,
  update,
  render,
}: SmartDepanneurColumnProps) {
  const type = date ? 'datepicker' : rawType;
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [cellLoading, setCellLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const editValueRef = useRef(editValue);
  editValueRef.current = editValue;

  const handleBlur = () => {
    // Check if the last mousedown was still inside this cell
    // or inside an antd popup portal (datepicker panel, select dropdown, etc.)
    if (lastMouseDownTarget instanceof Node) {
      const inCell =
        containerRef.current?.contains(lastMouseDownTarget);
      const inPopup =
        (lastMouseDownTarget as Element).closest?.(
          '.ant-picker-dropdown, .ant-select-dropdown, .ant-cascader-dropdown',
        );
      if (inCell || inPopup) {
        const focusable = containerRef.current?.querySelector<HTMLElement>(
          'input, .ant-select-selector, .ant-picker-input input',
        );
        focusable?.focus();
        return;
      }
    }
    // Left the cell — compare value
    const current = editValueRef.current;
    setEditing(false);
    // Normalize original value for comparison (multipleSelection stores objects but edits as strings)
    let compareValue = value;
    if (type === 'multipleSelection' && Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
      compareValue = value.map((v: any) => v.value ?? v.name ?? v.label);
    }
    if (JSON.stringify(current) === JSON.stringify(compareValue)) return;
    if (!update) return;
    setCellLoading(true);
    update(current)
      .catch(() => globalMessage.error('Failed to update'))
      .finally(() => setCellLoading(false));
  };

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleEnterEdit = () => {
    if (!editable) return;
    let initialEdit = value;
    if (type === 'multipleSelection' && Array.isArray(value)) {
      const optionValues = new Set(options.map((o) => o.value));
      if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
        initialEdit = value
          .map((v: any) => v.value ?? v.name ?? v.label)
          .filter((v: any) => optionValues.has(v));
      }
    }
    setEditValue(initialEdit);
    setEditing(true);
  };

  if (editing && editable) {
    return (
      <div ref={containerRef} data-cell-id={cellId} onBlur={handleBlur}>
        {type === 'numberInput' ? (
          <InputNumber
            autoFocus
            size="small"
            value={editValue}
            onChange={(v) => setEditValue(v)}
            style={{ width: '100%' }}
          />
        ) : type === 'select' ? (
          <Select
            autoFocus
            size="small"
            value={editValue}
            onChange={(v) => setEditValue(v)}
            options={options}
            style={{ width: '100%' }}
          />
        ) : type === 'multipleSelection' ? (
          <Select
            autoFocus
            mode="multiple"
            size="small"
            value={editValue}
            onChange={(v) => setEditValue(v)}
            options={options}
            style={{ width: '100%' }}
          />
        ) : type === 'selectInput' ? (
          <Select
            autoFocus
            mode="tags"
            size="small"
            value={editValue}
            onChange={(v) => setEditValue(v)}
            options={options}
            tokenSeparators={[',']}
            style={{ width: '100%' }}
          />
        ) : type === 'datepicker' ? (
          <DatePicker
            autoFocus
            size="small"
            value={editValue ? dayjs.utc(editValue) : null}
            onChange={(d) => setEditValue(d ? d.utc().toISOString() : null)}
            format={DATE_FORMAT}
            style={{ width: '100%' }}
          />
        ) : (
          <Input
            autoFocus
            size="small"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
          />
        )}
      </div>
    );
  }

  if (cellLoading) {
    return <Skeleton.Input active size="small" style={{ width: '100%', minWidth: 60, height: 22 }} />;
  }

  const isEmpty = value === null || value === undefined || value === '';

  const displayContent = (() => {
    if (isEmpty) return <NA />;
    if (render) return render(value);
    if (date) return formatDate(String(value));
    return String(value);
  })();

  const tooltipText = (() => {
    if (isEmpty) return '';
    if (date) return formatDate(String(value));
    if (Array.isArray(value)) {
      return value.map((v: any) => (typeof v === 'object' ? v.name ?? v.label ?? v.value : v)).join(', ');
    }
    return String(value);
  })();

  const truncated = (
    <div style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {displayContent}
    </div>
  );

  const content = tooltip && tooltipText ? <Tooltip title={tooltipText}>{truncated}</Tooltip> : truncated;

  return editable ? (
    <div
      data-cell-id={cellId}
      onClick={handleEnterEdit}
      style={{ cursor: 'pointer', minHeight: 22 }}
    >
      {content}
    </div>
  ) : (
    <div style={{ cursor: 'not-allowed', minHeight: 22 }}>
      {content}
    </div>
  );
}
