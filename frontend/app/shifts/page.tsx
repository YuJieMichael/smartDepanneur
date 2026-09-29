'use client';
import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Input,
  InputNumber,
  Modal,
  Space,
  Table,
  Typography,
} from 'antd';
import {
  addShiftCash,
  closeShift,
  getShifts,
  openShift,
  Shift,
} from '@/api/operations';
import { useAppStore } from '@/lib/store';
import {
  csvCell,
  downloadText,
  errorText,
  OpsError,
  useOpsText,
  useRequestId,
} from '@/components/store/operations-common';
export default function ShiftsPage() {
  const text = useOpsText();
  const requestId = useRequestId();
  const user = useAppStore((s) => s.currentUser);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'open' | 'close' | 'cash' | null>(null);
  const [selected, setSelected] = useState<Shift | null>(null);
  const [drawer, setDrawer] = useState('MAIN');
  const [opening, setOpening] = useState('0.00');
  const [notes, setNotes] = useState('');
  const [cash, setCash] = useState('0.00');
  const [nonce, setNonce] = useState('');
  const [counts, setCounts] = useState({
    cash: '0.00',
    debit: '0.00',
    credit: '0.00',
    other: '0.00',
  });
  const load = () =>
    getShifts()
      .then(setShifts)
      .catch((e) => setError(errorText(e)));
  useEffect(() => {
    void load();
  }, []);
  const active = shifts.find((s) => s.cashierId === user?.id && !s.closedAt);
  const names: Record<string, string> = {
    cash: text('Cash', 'Espèces', '现金'),
    debit: text('Debit', 'Débit', '借记卡'),
    credit: text('Credit', 'Crédit', '信用卡'),
    other: text('Other', 'Autre', '其他'),
  };
  const begin = (action: typeof mode) => {
    setMode(action);
    setError('');
    setNotes('');
    setCash('0.00');
    setCounts({ cash: '0.00', debit: '0.00', credit: '0.00', other: '0.00' });
    setNonce(crypto.randomUUID());
  };
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      if (mode === 'open') await openShift(opening, drawer);
      if (mode === 'close' && active)
        await closeShift(active.id, {
          countedCash: counts.cash,
          countedDebit: counts.debit,
          countedCredit: counts.credit,
          countedOther: counts.other,
          notes,
        });
      if (mode === 'cash' && active)
        await addShiftCash(
          active.id,
          cash,
          notes,
          requestId({ id: active.id, cash, notes, nonce }),
        );
      setMode(null);
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const reportRows = (shift: Shift) =>
    Object.keys(names).map((key) => ({
      key,
      name: names[key],
      expected: shift.reconciliation.expected[key],
      counted: shift.reconciliation.counted?.[key] ?? '—',
      variance: shift.reconciliation.variance?.[key] ?? '—',
    }));
  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={2}>
        {text('Shifts & reconciliation', 'Quarts et rapprochement', '交班对账')}
      </Typography.Title>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title={text(
          'One open shift per cashier and drawer. Expected cash = opening float + cash sales − voids + signed cash movements. Enter terminal totals separately. Closed reports are locked.',
          'Un quart ouvert par caissier et caisse. Espèces attendues = fonds initial + ventes nettes + mouvements d’espèces. Saisissez les totaux du terminal séparément. Les clôtures sont verrouillées.',
          '每位收银员和每个钱箱只能有一个未关闭班次。应有现金 = 备用金 + 现金销售 − 已作废销售 + 现金出入。刷卡按终端汇总单分别填报；交班后报表锁定。',
        )}
      />
      <OpsError error={mode ? '' : error} />
      <Space style={{ marginBottom: 16 }}>
        <Button onClick={load}>{text('Refresh', 'Actualiser', '刷新')}</Button>
        {!active ? (
          <Button type="primary" onClick={() => begin('open')}>
            {text('Open shift', 'Ouvrir un quart', '开班')}
          </Button>
        ) : (
          <>
            <Button onClick={() => begin('cash')}>
              {text('Cash in / out', 'Entrée / sortie espèces', '现金出入')}
            </Button>
            <Button type="primary" onClick={() => begin('close')}>
              {text('Count & close', 'Compter et fermer', '清点并交班')}
            </Button>
            <Button href="/sales">
              {text('Go to checkout', 'Aller à la caisse', '前往收银')}
            </Button>
          </>
        )}
      </Space>
      {active && (
        <Card
          title={`${text('Current shift', 'Quart actuel', '当前班次')} #${active.id} · ${active.drawer}`}
          style={{ marginBottom: 16 }}
        >
          <Space wrap>
            {Object.entries(active.reconciliation.expected).map(
              ([key, value]) => (
                <span key={key}>
                  {names[key]}: CAD {value}
                </span>
              ),
            )}
          </Space>
        </Card>
      )}
      <Table
        rowKey="id"
        dataSource={shifts}
        scroll={{ x: 850 }}
        columns={[
          { title: '#', dataIndex: 'id' },
          {
            title: text('Cashier', 'Caissier', '收银员'),
            render: (_, s) => s.cashier.email,
          },
          { title: text('Drawer', 'Caisse', '钱箱'), dataIndex: 'drawer' },
          {
            title: text('Opened', 'Ouvert', '开班时间'),
            render: (_, s) => new Date(s.openedAt).toLocaleString(),
          },
          {
            title: text('Closed', 'Fermé', '交班时间'),
            render: (_, s) =>
              s.closedAt
                ? new Date(s.closedAt).toLocaleString()
                : text('Open', 'Ouvert', '未交班'),
          },
          {
            title: text('Report', 'Rapport', '报表'),
            render: (_, s) => (
              <Button onClick={() => setSelected(s)}>
                {text('View', 'Voir', '查看')}
              </Button>
            ),
          },
        ]}
      />
      <Modal
        open={!!mode}
        onCancel={() => !busy && setMode(null)}
        onOk={save}
        confirmLoading={busy}
        title={text('Register shift', 'Quart de caisse', '收银班次')}
        okText={text('Confirm', 'Confirmer', '确认')}
        cancelText={text('Cancel', 'Annuler', '取消')}
      >
        <OpsError error={error} />
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
          {mode === 'open' && (
            <>
              <label>
                {text('Drawer', 'Caisse', '钱箱名称')}
                <Input
                  value={drawer}
                  onChange={(e) => setDrawer(e.target.value)}
                />
              </label>
              <label>
                {text('Opening float', 'Fonds initial', '期初备用金')}{' '}
                <InputNumber
                  stringMode
                  precision={2}
                  min="0"
                  value={opening}
                  onChange={(v) => setOpening(String(v ?? ''))}
                />
              </label>
            </>
          )}
          {mode === 'cash' && (
            <>
              <Alert
                type="info"
                title={text(
                  'Positive = cash added; negative = cash removed. A reason is required.',
                  'Positif = entrée, négatif = sortie. Motif obligatoire.',
                  '正数表示放入现金，负数表示取出现金。必须填写原因。',
                )}
              />
              <InputNumber
                stringMode
                precision={2}
                value={cash}
                onChange={(v) => setCash(String(v ?? ''))}
              />
            </>
          )}
          {mode === 'close' &&
            Object.keys(counts).map((key) => (
              <label
                key={key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                {names[key]} ·{' '}
                {text('Actual total', 'Total réel', '实点 / 实收金额')}
                <InputNumber
                  stringMode
                  min="0"
                  precision={2}
                  value={counts[key as keyof typeof counts]}
                  onChange={(v) =>
                    setCounts((old) => ({ ...old, [key]: String(v ?? '') }))
                  }
                />
              </label>
            ))}
          {mode !== 'open' && (
            <Input.TextArea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={text(
                'Reason / explanation of difference',
                'Motif / explication de l’écart',
                '原因 / 差异说明',
              )}
            />
          )}
        </Space>
      </Modal>
      <Modal
        width={800}
        open={!!selected}
        onCancel={() => setSelected(null)}
        footer={null}
        title={`${text('Shift report', 'Rapport de quart', '交班报表')} #${selected?.id}`}
      >
        {selected && (
          <>
            <Typography.Paragraph>
              {selected.cashier.email} · {selected.drawer} · {selected.notes}
            </Typography.Paragraph>
            <Table
              pagination={false}
              rowKey="key"
              dataSource={reportRows(selected)}
              columns={[
                {
                  title: text('Payment', 'Paiement', '方式'),
                  dataIndex: 'name',
                },
                {
                  title: text('Expected', 'Attendu', '应有'),
                  dataIndex: 'expected',
                },
                {
                  title: text('Counted', 'Compté', '实点 / 实收'),
                  dataIndex: 'counted',
                },
                {
                  title: text('Difference', 'Écart', '差额'),
                  dataIndex: 'variance',
                },
              ]}
            />
            <Button
              style={{ marginTop: 16 }}
              onClick={() =>
                downloadText(
                  `shift-${selected.id}.csv`,
                  [
                    [
                      'Shift',
                      'Cashier',
                      'Drawer',
                      'Payment',
                      'Expected',
                      'Counted',
                      'Difference',
                    ]
                      .map(csvCell)
                      .join(','),
                    ...reportRows(selected).map((r) =>
                      [
                        selected.id,
                        selected.cashier.email,
                        selected.drawer,
                        r.name,
                        r.expected,
                        r.counted,
                        r.variance,
                      ]
                        .map(csvCell)
                        .join(','),
                    ),
                  ].join('\n'),
                )
              }
            >
              {text('Export report', 'Exporter le rapport', '导出报表')}
            </Button>
            <ul>
              {selected.cashMovements.map((m) => (
                <li key={m.id}>
                  CAD {m.amount} · {m.reason} ·{' '}
                  {new Date(m.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </>
        )}
      </Modal>
    </div>
  );
}
