'use client';

import { useEffect, useState } from 'react';
import { Modal, Pagination, Spin, Timeline } from 'antd';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { apiGetAuditTrail, AuditTrailItem } from '@/api/audit-trail';
import { globalMessage } from '@/lib/message-bridge';
import { DATE_FORMAT } from '@/lib/utils';
import NA from '@/components/common/na';

dayjs.extend(utc);

interface AuditTrailDialogProps {
  open: boolean;
  table: string;
  recordId: number | string;
  onClose: () => void;
}

export default function AuditTrailDialog({
  open,
  table,
  recordId,
  onClose,
}: AuditTrailDialogProps) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AuditTrailItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  const fetchData = (p: number) => {
    setLoading(true);
    apiGetAuditTrail(table, recordId, p, pageSize)
      .then((res) => {
        setItems(res.list);
        setTotal(res.total);
        setPage(res.page);
      })
      .catch(() => globalMessage.error('Failed to load audit trail'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    setPage(1);
    fetchData(1);
  }, [open, table, recordId]);

  return (
    <Modal
      title="Audit Trail"
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
      styles={{ body: { maxHeight: 700, overflowY: 'auto' } }}
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
          <Spin />
        </div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <NA />
        </div>
      ) : (
        <>
        <Timeline
          style={{ marginTop: 16 }}
          items={items.map((item) => ({
            content: (
              <div key={item.id}>
                <div style={{ fontWeight: 500 }}>
                  {item.field}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
                  {dayjs.utc(item.createdAt).format(`${DATE_FORMAT} HH:mm:ss`)} by {item.userEmail}
                </div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ color: '#cf1322' }}>{item.oldValue ?? 'n/a'}</span>
                  {' → '}
                  <span style={{ color: '#389e0d' }}>{item.newValue ?? 'n/a'}</span>
                </div>
              </div>
            ),
          }))}
        />
        {total > pageSize && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Pagination
              size="small"
              current={page}
              pageSize={pageSize}
              total={total}
              onChange={fetchData}
              showSizeChanger={false}
            />
          </div>
        )}
        </>
      )}
    </Modal>
  );
}
