'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Table, Input, Tag, Typography, Button } from 'antd';
import { CloseCircleOutlined, FilterFilled, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType, TableProps } from 'antd/es/table';
import type { SorterResult } from 'antd/es/table/interface';
import FilterDropdown from '@/components/table/filter-dropdown';
import SmartDepanneurColumn from '@/components/table/partnerhub-column';
import { useT } from '@/lib/i18n';
import { checkPermissionCode, enqueueMicroTask, formatDate } from '@/lib/utils';
import { globalMessage } from '@/lib/message-bridge';

// -- Types --

export interface DataTableParams {
  search: string;
  filters: Record<string, string | undefined>;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface DataTableResult<T> {
  total: number;
  list: T[];
  page: number;
  pageSize: number;
}

export type ColumnType = 'input' | 'numberInput' | 'select' | 'multipleSelection' | 'selectInput' | 'datepicker';

export interface DataTableColumnConfig<T> {
  title: string;
  dataIndex: string;
  width?: number;
  sorter?: boolean;
  /** Column type for editing: input | numberInput | select | multipleSelection | datepicker. Default: input */
  type?: ColumnType;
  /** Options for select / multipleSelection types */
  options?: { label: string; value: string }[];
  /** Permission code; when provided, editable is determined by checkPermissionCode(accessCode) */
  accessCode?: string;
  /** Explicitly override editable. When set, takes precedence over accessCode permission check. */
  editable?: boolean;
  /** Key used in filters record, e.g. 'filterIds'. If set, the column gets a filter dropdown. */
  filterKey?: string;
  /** Field name passed to fetchFilterOptions, e.g. 'id'. Defaults to dataIndex. */
  filterField?: string;
  /** When true, render value as dd-mm-yy date format */
  date?: boolean;
  /** Whether to show tooltip on cell text overflow. Default: true */
  tooltip?: boolean;
  render?: (value: any, record: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  /** Page title */
  title: string;
  /** Unique row key field */
  rowKey: string;
  /** Column configs */
  columns: DataTableColumnConfig<T>[];
  /** Search input placeholder */
  searchPlaceholder?: string;
  /** Search param key sent in params.search */
  searchKey?: string;
  /** Default sort field */
  defaultSortField: string;
  /** Total label template, e.g. "Total {count} users" */
  totalLabel?: string;
  /** Fetch list data */
  fetchData: (params: DataTableParams) => Promise<DataTableResult<T>>;
  /** Fetch filter options for a column. field = filterField, context = current filters + search */
  fetchFilterOptions?: (
    field: string,
    context: Record<string, string | undefined>,
  ) => Promise<string[]>;
  /** Update a single cell value. Called with (rowId, dataIndex, newValue) */
  onCellUpdate?: (
    rowId: string | number,
    dataIndex: string,
    newValue: any,
  ) => Promise<void>;
  /** Fetch a single row by id after update to refresh its data */
  fetchRow?: (id: string | number) => Promise<T>;
  /** Extra content rendered in the header bar (right side, before search) */
  headerExtra?: React.ReactNode;
  /** Increment to trigger a data refresh from outside */
  refreshFlag?: number;
}

// -- Component --

export default function DataTable<T extends Record<string, any>>({
  title,
  rowKey,
  columns: columnConfigs,
  searchPlaceholder,
  defaultSortField,
  totalLabel,
  fetchData,
  fetchFilterOptions,
  onCellUpdate,
  fetchRow,
  headerExtra,
  refreshFlag,
}: DataTableProps<T>) {
  const t = useT();
  const [list, setList] = useState<T[]>([]);
  const [scrollY, setScrollY] = useState<number | undefined>(undefined);
  const [colWidths, setColWidths] = useState<number[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [params, setParams] = useState<DataTableParams>({
    search: '',
    filters: {},
    sortField: defaultSortField,
    sortOrder: 'asc',
    page: 1,
    pageSize: 20,
  });
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const calcScrollY = useCallback(() => {
    if (!containerRef.current) return;
    // Find the nearest scrollable parent container
    let scrollParent: HTMLElement | null = containerRef.current.parentElement;
    while (scrollParent && scrollParent !== document.body) {
      const overflow = getComputedStyle(scrollParent).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') break;
      scrollParent = scrollParent.parentElement;
    }
    const parentBottom = scrollParent?.getBoundingClientRect().bottom ?? window.innerHeight;
    // Measure from the actual table body top (accounts for title bar, filters, table header)
    const tableBody = containerRef.current.querySelector('.ant-table-body');
    if (tableBody) {
      const bodyTop = tableBody.getBoundingClientRect().top;
      const pagination = containerRef.current.querySelector('.ant-table-pagination');
      const paginationHeight = pagination
        ? pagination.getBoundingClientRect().height + parseFloat(getComputedStyle(pagination).marginTop || '0') + parseFloat(getComputedStyle(pagination).marginBottom || '0')
        : 0;
      // 24px = container bottom padding (p-6)
      setScrollY(Math.max(200, parentBottom - bodyTop - paginationHeight - 24));
      return;
    }
    // Fallback before table renders
    const containerTop = containerRef.current.getBoundingClientRect().top;
    setScrollY(Math.max(200, parentBottom - containerTop - 200));
  }, []);

  useEffect(() => {
    calcScrollY();
    window.addEventListener('resize', calcScrollY);
    return () => window.removeEventListener('resize', calcScrollY);
  }, [calcScrollY]);

  // Recalculate when table DOM changes (loading finished, filters toggled)
  useEffect(() => {
    requestAnimationFrame(calcScrollY);
  }, [loading, params.filters, calcScrollY]);

  // Measure column widths from rendered DOM
  const measureColWidths = useCallback(() => {
    if (!containerRef.current) return;
    const table = containerRef.current.querySelector('.data-table table');
    if (!table) return;
    const rows = table.querySelectorAll('tr');
    if (!rows.length) return;
    const colCount = columnConfigs.length;
    const maxWidths = new Array(colCount).fill(0);
    rows.forEach((row) => {
      const cells = row.querySelectorAll('th, td');
      cells.forEach((cell, i) => {
        if (i < colCount) {
          maxWidths[i] = Math.max(maxWidths[i], cell.scrollWidth);
        }
      });
    });
    setColWidths(maxWidths);
  }, [columnConfigs.length]);

  useEffect(() => {
    if (!loading && list.length > 0) {
      // Wait for DOM to paint
      requestAnimationFrame(measureColWidths);
    }
  }, [loading, list, measureColWidths]);

  useEffect(() => {
    setLoading(true);
    fetchData(params)
      .then((res) => {
        setList(res.list);
        setTotal(res.total);
      })
      .catch(() => globalMessage.error('Failed to load data'))
      .finally(() => setLoading(false));
  }, [params, fetchData, refreshFlag]);

  const handleSearch = (value: string) => {
    setSearchInput(value);
    setLoading(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setParams((prev) => ({ ...prev, search: value, page: 1 }));
    }, 400);
  };

  const handleTableChange: TableProps<T>['onChange'] = (pagination, _filters, sorter) => {
    const s = sorter as SorterResult<T>;
    setParams((prev) => ({
      ...prev,
      page: pagination.current ?? 1,
      pageSize: pagination.pageSize ?? prev.pageSize,
      sortField: s.order && s.field ? String(s.field) : defaultSortField,
      sortOrder: s.order === 'descend' ? 'desc' : 'asc',
    }));
  };

  // Derive applied filters: filterKey -> values[]
  const appliedMap: Record<string, string[]> = {};
  for (const col of columnConfigs) {
    if (col.filterKey) {
      appliedMap[col.filterKey] = params.filters[col.filterKey]?.split(',').filter(Boolean) ?? [];
    }
  }

  const handleFilterSave = (filterKey: string, values: string[]) => {
    setParams((prev) => ({
      ...prev,
      page: 1,
      filters: {
        ...prev.filters,
        [filterKey]: values.length ? values.join(',') : undefined,
      },
    }));
  };

  const handleClearAllFilters = () => {
    const cleared: Record<string, string | undefined> = {};
    for (const key of Object.keys(params.filters)) {
      cleared[key] = undefined;
    }
    setParams((prev) => ({ ...prev, page: 1, filters: cleared }));
  };

  const hasFilters = Object.values(appliedMap).some((arr) => arr.length > 0);

  // Build filter context for filter-options API
  const filterContext: Record<string, string | undefined> = {
    ...params.filters,
    search: params.search || undefined,
  };

  // Build label map for active filters bar
  const filterLabelMap: Record<string, string> = {};
  for (const col of columnConfigs) {
    if (col.filterKey) {
      filterLabelMap[col.filterKey] = col.title;
    }
  }

  // Build cell update function with micro-task queue
  const buildCellUpdate = useCallback(
    (record: T, dataIndex: string, newValue: any): Promise<void> => {
      const id = record[rowKey];
      return enqueueMicroTask(title, id, async () => {
        await onCellUpdate!(id, dataIndex, newValue);
        if (fetchRow) {
          const freshRow = await fetchRow(id);
          setList((prev) => prev.map((r) => (r[rowKey] === id ? freshRow : r)));
        }
      });
    },
    [title, rowKey, onCellUpdate, fetchRow],
  );

  // Build antd columns
  const columns: ColumnsType<T> = columnConfigs.map((col, colIndex) => {
    const editable = col.editable ?? checkPermissionCode(col.accessCode);
    const computedWidth = colWidths[colIndex] || col.width;
    const antdCol: any = {
      title: col.title,
      dataIndex: col.dataIndex,
      ...(computedWidth ? { width: computedWidth } : {}),
      ...(col.sorter ? { sorter: true } : {}),
      render: col.render
        ? (value: any, record: T, index: number) => (
            <SmartDepanneurColumn
              value={value}
              cellId={`${title}-${col.dataIndex}`}
              date={col.date}
              editable={editable}
              type={col.type}
              options={col.options}
              tooltip={col.tooltip}
              update={
                editable && onCellUpdate
                  ? (newValue) => buildCellUpdate(record, col.dataIndex, newValue)
                  : undefined
              }
              render={(v) => col.render!(v, record, index)}
            />
          )
        : (value: any, record: T) => (
            <SmartDepanneurColumn
              value={value}
              cellId={`${title}-${col.dataIndex}`}
              date={col.date}
              editable={editable}
              type={col.type}
              options={col.options}
              tooltip={col.tooltip}
              update={
                editable && onCellUpdate
                  ? (newValue) => buildCellUpdate(record, col.dataIndex, newValue)
                  : undefined
              }
            />
          ),
    };

    if (col.filterKey && fetchFilterOptions) {
      const filterKey = col.filterKey;
      const filterField = col.filterField ?? col.dataIndex;
      const applied = appliedMap[filterKey] ?? [];

      antdCol.filterDropdown = ({ visible, close }: { visible: boolean; close: () => void }) => (
        <FilterDropdown
          title={col.title}
          visible={visible}
          close={close}
          applied={applied}
          fetchOptions={() =>
            fetchFilterOptions(filterField, filterContext).catch(() => {
              globalMessage.error('Failed to load filter options');
              return [];
            })
          }
          onSave={(vals) => handleFilterSave(filterKey, vals)}
          onReset={() => handleFilterSave(filterKey, [])}
          date={col.date}
        />
      );
      antdCol.filterIcon = (filtered: boolean) => (
        <FilterFilled style={{ color: filtered ? '#1677ff' : undefined }} />
      );
      antdCol.filteredValue = applied.length ? applied : null;
    }

    return antdCol;
  });

  return (
    <div ref={containerRef} className="p-6 bg-white h-full flex flex-col">
      <style>{`
        .data-table .ant-table table {
          table-layout: auto !important;
        }
        .data-table .ant-table-thead th,
        .data-table .ant-table-tbody td {
          white-space: nowrap;
        }
        .data-table .ant-table-column-sorters {
          gap: 6px;
        }
        .data-table .ant-table-filter-trigger {
          margin-inline-start: 6px;
        }
      `}</style>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Typography.Title level={5} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          {headerExtra}
        </div>
        {searchPlaceholder && (
          <Input
            prefix={<SearchOutlined />}
            placeholder={searchPlaceholder}
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            allowClear
            onClear={() => handleSearch('')}
            style={{ width: 240 }}
          />
        )}
      </div>
      {hasFilters && (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <span className="text-gray-500 text-xs">{t.common.active_filters}:</span>
          {Object.entries(appliedMap).map(
            ([filterKey, values]) =>
              values.length > 0 && (
                <Tag
                  key={filterKey}
                  closable
                  onClose={() => handleFilterSave(filterKey, [])}
                  style={{ margin: 0 }}
                >
                  {filterLabelMap[filterKey]}: {values.join(', ')}
                </Tag>
              ),
          )}
          <Button
            type="link"
            size="small"
            icon={<CloseCircleOutlined />}
            onClick={handleClearAllFilters}
            style={{ padding: 0 }}
          >
            {t.common.clear_all}
          </Button>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <Table
          className="data-table"
          rowKey={rowKey}
          columns={columns}
          dataSource={list}
          loading={loading}
          onChange={handleTableChange}
          scroll={{ x: colWidths.length ? colWidths.reduce((a, b) => a + b, 0) : '100%', y: scrollY }}
          pagination={{
            current: params.page,
            pageSize: params.pageSize,
            total,
            showSizeChanger: true,
            showTotal: totalLabel
              ? () => totalLabel.replace('{count}', String(total))
              : undefined,
          }}
        />
      </div>
    </div>
  );
}
