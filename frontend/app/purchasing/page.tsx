'use client';
import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Input,
  InputNumber,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  getOrders,
  PurchaseOrder,
  receiveOrder,
  setOrderStatus,
} from '@/api/operations';
import { apiGeneratePurchaseOrders } from '@/api/insights';
import { useI18nStore } from '@/lib/i18n';
import {
  csvCell,
  downloadText,
  errorText,
  OpsError,
  useOpsText,
  useRequestId,
} from '@/components/store/operations-common';
type ReceiptRow = {
  orderItemId: number;
  quantity: number;
  lotCode: string;
  expirationDate: string;
  unitCost: string;
  name: string;
  outstanding: number;
  tracked: boolean;
};
export default function PurchasingPage() {
  const text = useOpsText();
  const requestId = useRequestId();
  const locale = useI18nStore((s) => s.locale);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [mode, setMode] = useState<
    'sent' | 'cancelled' | 'receive' | 'history' | null
  >(null);
  const [reference, setReference] = useState('');
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [receiptSession, setReceiptSession] = useState('');
  const load = () =>
    getOrders()
      .then(setOrders)
      .catch((e) => setError(errorText(e)));
  useEffect(() => {
    void load();
  }, []);
  const statusText = (status: string) =>
    ({
      draft: text('Draft', 'Brouillon', '草稿'),
      sent: text('Sent', 'Envoyée', '已下单'),
      partially_received: text(
        'Partly received',
        'Réception partielle',
        '部分收货',
      ),
      received: text('Received', 'Reçue', '全部收货'),
      cancelled: text('Cancelled', 'Annulée', '已取消'),
    })[status] ?? status;
  const open = (order: PurchaseOrder, action: typeof mode) => {
    setSelected(order);
    setMode(action);
    setReference('');
    setError('');
    setReceiptSession(crypto.randomUUID());
    setRows(
      order.items
        .filter((i) => i.quantity > i.receivedQuantity)
        .map((i) => ({
          orderItemId: i.id,
          quantity: 0,
          lotCode: '',
          expirationDate: '',
          unitCost: i.unitCost,
          name: i.productName,
          outstanding: i.quantity - i.receivedQuantity,
          tracked: i.product.expirationTracked,
        })),
    );
  };
  const save = async () => {
    if (!selected || !mode || mode === 'history') return;
    setBusy(true);
    setError('');
    try {
      if (mode === 'receive') {
        const items = rows
          .filter((r) => r.quantity > 0)
          .map(
            ({ orderItemId, quantity, lotCode, expirationDate, unitCost }) => ({
              orderItemId,
              quantity,
              lotCode,
              expirationDate,
              unitCost,
            }),
          );
        if (!items.length)
          throw new Error(
            text(
              'Enter a received quantity',
              'Saisissez une quantité reçue',
              '请填写本次到货数量',
            ),
          );
        const payload = { reference, items };
        await receiveOrder(selected.id, {
          ...payload,
          requestId: requestId({ id: selected.id, receiptSession, ...payload }),
        });
      } else await setOrderStatus(selected.id, mode, reference);
      setMode(null);
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const update = (id: number, data: Partial<ReceiptRow>) =>
    setRows((old) =>
      old.map((r) => (r.orderItemId === id ? { ...r, ...data } : r)),
    );
  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={2}>
        {text('Purchasing & receiving', 'Achats et réception', '采购与收货')}
      </Typography.Title>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title={text(
          'Download the order and send it through your supplier’s usual channel. “Mark sent” records that action; this app sends no email. Receive one lot per line at a time; use another receipt for another lot.',
          'Téléchargez la commande et transmettez-la au fournisseur. « Marquer envoyée » enregistre votre action sans envoyer de courriel. Un lot par ligne et par réception.',
          '下载采购单后通过现有渠道联系供应商。“标记已下单”只登记操作，不会发送邮件。每行本次录入一个批次；不同批次可分次收货。',
        )}
      />
      <OpsError error={mode ? '' : error} />
      <Space style={{ marginBottom: 16 }}>
        <Button onClick={load}>{text('Refresh', 'Actualiser', '刷新')}</Button>
        <Button
          type="primary"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await apiGeneratePurchaseOrders(locale);
              await load();
            } catch (e) {
              setError(errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {text(
            'Generate reorder drafts',
            'Générer les brouillons',
            '生成补货草稿',
          )}
        </Button>
      </Space>
      <Table
        rowKey="id"
        dataSource={orders}
        scroll={{ x: 900 }}
        columns={[
          {
            title: text('Order', 'Commande', '采购单'),
            dataIndex: 'orderNumber',
          },
          {
            title: text('Supplier', 'Fournisseur', '供应商'),
            render: (_, o) => o.supplier?.name ?? '—',
          },
          {
            title: text('Status', 'Statut', '状态'),
            render: (_, o) => <Tag>{statusText(o.status)}</Tag>,
          },
          { title: 'CAD', dataIndex: 'estimatedTotal' },
          {
            title: text('Actions', 'Actions', '操作'),
            render: (_, o) => (
              <Space wrap>
                <Button
                  size="small"
                  onClick={() =>
                    downloadText(
                      `${o.orderNumber}.csv`,
                      [
                        [
                          'Order',
                          'Supplier',
                          'Product',
                          'Ordered',
                          'Received',
                          'Unit cost',
                        ]
                          .map(csvCell)
                          .join(','),
                        ...o.items.map((i) =>
                          [
                            o.orderNumber,
                            o.supplier?.name,
                            i.productName,
                            i.quantity,
                            i.receivedQuantity,
                            i.unitCost,
                          ]
                            .map(csvCell)
                            .join(','),
                        ),
                      ].join('\n'),
                    )
                  }
                >
                  {text('Download', 'Télécharger', '下载')}
                </Button>
                {o.status === 'draft' && (
                  <Button size="small" onClick={() => open(o, 'sent')}>
                    {text('Mark sent', 'Marquer envoyée', '标记已下单')}
                  </Button>
                )}
                {['sent', 'partially_received'].includes(o.status) && (
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => open(o, 'receive')}
                  >
                    {text('Receive', 'Réceptionner', '收货')}
                  </Button>
                )}
                {['draft', 'sent'].includes(o.status) && (
                  <Button
                    danger
                    size="small"
                    onClick={() => open(o, 'cancelled')}
                  >
                    {text('Cancel', 'Annuler', '取消采购')}
                  </Button>
                )}
                <Button size="small" onClick={() => open(o, 'history')}>
                  {text('Details', 'Détails', '明细')}
                </Button>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        width={1000}
        open={!!mode}
        title={selected?.orderNumber}
        onCancel={() => !busy && setMode(null)}
        onOk={save}
        confirmLoading={busy}
        footer={mode === 'history' ? null : undefined}
        okText={text('Confirm', 'Confirmer', '确认')}
        cancelText={text('Back', 'Retour', '返回')}
      >
        <OpsError error={error} />
        {mode === 'sent' && (
          <Typography.Paragraph>
            {text(
              'After contacting the supplier, enter the order confirmation or sending reference.',
              'Après avoir contacté le fournisseur, saisissez la référence de confirmation.',
              '联系供应商后，填写订单确认号或下单方式。',
            )}
          </Typography.Paragraph>
        )}
        {mode === 'cancelled' && (
          <Alert
            type="warning"
            title={text(
              'Cancel this unreceived order?',
              'Annuler cette commande non reçue ?',
              '确认取消尚未收货的采购单？',
            )}
          />
        )}
        {(mode === 'sent' || mode === 'receive') && (
          <Input
            style={{ marginBottom: 16 }}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={text(
              'Supplier confirmation / delivery reference',
              'Confirmation / référence de livraison',
              '供应商确认号 / 送货单号',
            )}
          />
        )}
        {mode === 'receive' && (
          <Table
            rowKey="orderItemId"
            dataSource={rows}
            pagination={false}
            scroll={{ x: 850 }}
            columns={[
              { title: text('Product', 'Produit', '商品'), dataIndex: 'name' },
              {
                title: text('Outstanding', 'Restant', '待收'),
                dataIndex: 'outstanding',
              },
              {
                title: text('Received now', 'Reçu maintenant', '本次收货'),
                render: (_, r) => (
                  <InputNumber
                    min={0}
                    max={r.outstanding}
                    precision={0}
                    value={r.quantity}
                    onChange={(v) =>
                      update(r.orderItemId, { quantity: Number(v) })
                    }
                  />
                ),
              },
              {
                title: text('Lot', 'Lot', '批号'),
                render: (_, r) => (
                  <Input
                    value={r.lotCode}
                    onChange={(e) =>
                      update(r.orderItemId, { lotCode: e.target.value })
                    }
                  />
                ),
              },
              {
                title: text('Expiry', 'Expiration', '有效期'),
                render: (_, r) => (
                  <>
                    <Input
                      type="date"
                      value={r.expirationDate}
                      onChange={(e) =>
                        update(r.orderItemId, {
                          expirationDate: e.target.value,
                        })
                      }
                    />
                    {r.tracked && (
                      <small>{text('Required', 'Obligatoire', '必填')}</small>
                    )}
                  </>
                ),
              },
              {
                title: text('Unit cost', 'Coût unitaire', '单位成本'),
                render: (_, r) => (
                  <InputNumber
                    min="0"
                    precision={2}
                    stringMode
                    value={r.unitCost}
                    onChange={(v) =>
                      update(r.orderItemId, { unitCost: String(v ?? '') })
                    }
                  />
                ),
              },
            ]}
          />
        )}
        {mode === 'history' && selected && (
          <>
            <Table
              rowKey="id"
              dataSource={selected.items}
              pagination={false}
              columns={[
                {
                  title: text('Product', 'Produit', '商品'),
                  dataIndex: 'productName',
                },
                {
                  title: text('Ordered', 'Commandé', '订购'),
                  dataIndex: 'quantity',
                },
                {
                  title: text('Received', 'Reçu', '已收货'),
                  dataIndex: 'receivedQuantity',
                },
              ]}
            />
            {selected.receipts.map((r) => (
              <div key={r.id} style={{ marginTop: 16 }}>
                <strong>
                  #{r.id} · {new Date(r.receivedAt).toLocaleString()} ·{' '}
                  {r.receivedBy.email} · {r.reference}
                </strong>
                <ul>
                  {r.lines.map((l) => (
                    <li key={l.id}>
                      {l.batch.lotCode} · {l.quantity} ·{' '}
                      {l.batch.expirationDate?.slice(0, 10) ?? '—'}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}
      </Modal>
    </div>
  );
}
