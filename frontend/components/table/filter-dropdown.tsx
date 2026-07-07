'use client';

import { useEffect, useState } from 'react';
import { Button, Checkbox, Divider, Input, Spin } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useT } from '@/lib/i18n';
import { formatDate } from '@/lib/utils';
import NA from '@/components/common/na';

interface FilterDropdownProps {
  title: string;
  visible: boolean;
  close: () => void;
  applied: string[];
  fetchOptions: () => Promise<string[]>;
  onSave: (values: string[]) => void;
  onReset: () => void;
  /** When true, display option values in dd-mm-yy format */
  date?: boolean;
}

export default function FilterDropdown({
  title,
  visible,
  close,
  applied,
  fetchOptions,
  onSave,
  onReset,
  date,
}: FilterDropdownProps) {
  const t = useT();
  const [options, setOptions] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) return;
    // Sync checked with currently applied values every time dropdown opens
    setChecked(applied);
    setSearch('');
    // Fetch options every time the dropdown opens (context may have changed)
    setFetching(true);
    fetchOptions()
      .then(setOptions)
      .finally(() => setFetching(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const toggle = (val: string, isChecked: boolean) => {
    setChecked((prev) =>
      isChecked ? [...prev, val] : prev.filter((v) => v !== val),
    );
  };

  const handleReset = () => {
    setChecked([]);
    onReset();
    close();
  };

  const handleSave = () => {
    onSave(checked);
    close();
  };

  return (
    <div style={{ padding: 12, width: 300}}>
      <div style={{ fontWeight: 600, marginBottom: 12, color: 'rgba(0,0,0,0.88)' }}>{title}</div>
      {fetching ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
          <Spin size="small" />
        </div>
      ) : (
        <>
          <Input
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ marginBottom: 12 }}
          />
          <div style={{ maxHeight: 600, overflowY: 'auto' }}>
            {options
              .filter((opt) => opt.toLowerCase().includes(search.toLowerCase()))
              .map((opt) => (
                <div key={opt} style={{ padding: '6px 0' }}>
                  <Checkbox
                    checked={checked.includes(opt)}
                    onChange={(e) => toggle(opt, e.target.checked)}
                  >
                    {date ? formatDate(opt) : opt}
                  </Checkbox>
                </div>
              ))}
            {options.filter((opt) => opt.toLowerCase().includes(search.toLowerCase())).length === 0 && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <NA />
              </div>
            )}
          </div>
        </>
      )}
      <Divider style={{ margin: '12px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button size="small" onClick={handleReset}>
          {t.common.reset}
        </Button>
        <Button type="primary" size="small" onClick={handleSave}>
          {t.common.save}
        </Button>
      </div>
    </div>
  );
}
