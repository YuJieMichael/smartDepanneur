'use client';
import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { Batch, getBatches, updateBatch } from '@/api/operations';
import { apiGetProductList, ProductRow } from '@/api/products';
import { apiStockIn, apiWasteStock } from '@/api/inventory';
import {
  errorText,
  OpsError,
  useOpsText,
} from '@/components/store/operations-common';
export default function BatchesPage() {
  const text = useOpsText();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'edit' | 'waste' | 'receive' | null>(null);
  const [selected, setSelected] = useState<Batch | null>(null);
  const [productId, setProductId] = useState<number>();
  const [quantity, setQuantity] = useState(1);
  const [lotCode, setLot] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cost, setCost] = useState('0.00');
  const [reason, setReason] = useState('');
  const load = () =>
    Promise.all([
      getBatches().then(setBatches),
      apiGetProductList({ pageSize: 500 }).then((r) => setProducts(r.list)),
    ]).catch((e) => setError(errorText(e)));
  useEffect(() => {
    void load();
  }, []);
  const open = (action: typeof mode, row: Batch | null = null) => {
    setMode(action);
    setSelected(row);
    setProductId(row?.productId);
    setQuantity(1);
    setLot(row?.lotCode ?? '');
    setExpiry(row?.expirationDate?.slice(0, 10) ?? '');
    setCost(row?.unitCost ?? '0.00');
    setReason('');
    setError('');
  };
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      if (mode === 'edit' && selected)
        await updateBatch(selected.id, {
          lotCode,
          expirationDate: expiry,
          reason,
        });
      if (mode === 'waste' && selected) {
        if (!reason.trim())
          throw new Error(
            text('Reason required', 'Motif obligatoire', '必须填写原因'),
          );
        await apiWasteStock({
          productId: selected.productId,
          batchId: selected.id,
          quantity,
          reason,
        });
      }
      if (mode === 'receive') {
        if (!productId)
          throw new Error(
            text('Select a product', 'Choisir un produit', '请选择商品'),
          );
        await apiStockIn({
          productId,
          quantity,
          lotCode,
          expirationDate: expiry || null,
          unitCost: cost,
          reason,
        });
      }
      setMode(null);
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={2}>
        {text(
          'Batch inventory & expiry',
          'Lots et dates d’expiration',
          '库存批次与有效期',
        )}
      </Typography.Title>
      <Alert
        showIcon
        type="info"
        style={{ marginBottom: 16 }}
        title={text(
          'Sales use the earliest eligible expiry first. Expired batches and tracked batches with unknown dates are blocked from sale. Each receipt keeps its own cost and expiry. Use Purchasing for order receipts.',
          'Les ventes utilisent les lots admissibles expirant en premier. Les lots expirés ou suivis sans date sont bloqués. Utilisez Achats pour réceptionner une commande.',
          '销售优先扣减最早到期的可售批次。过期批次及缺少日期的效期追踪批次禁止销售。每次入库独立保存成本和有效期；采购单到货请从采购页面收货。',
        )}
      />
      <OpsError error={mode ? '' : error} />
      <Space style={{ marginBottom: 16 }}>
        <Button onClick={load}>{text('Refresh', 'Actualiser', '刷新')}</Button>
        <Button type="primary" onClick={() => open('receive')}>
          {text(
            'Receive stock without PO',
            'Réception hors commande',
            '无采购单入库',
          )}
        </Button>
      </Space>
      <Table
        rowKey="id"
        dataSource={batches}
        scroll={{ x: 1000 }}
        columns={[
          {
            title: text('Product', 'Produit', '商品'),
            render: (_, r) => r.product.name,
          },
          { title: text('Lot', 'Lot', '批号'), dataIndex: 'lotCode' },
          {
            title: text('Remaining', 'Restant', '剩余数量'),
            dataIndex: 'quantityRemaining',
          },
          {
            title: text('Unit cost', 'Coût unitaire', '单位成本'),
            dataIndex: 'unitCost',
          },
          {
            title: text('Expiry', 'Expiration', '有效期'),
            render: (_, r) => (
              <Tag
                color={
                  r.expirationDate && r.expirationDate.slice(0, 10) < today
                    ? 'red'
                    : !r.expirationDate && r.product.expirationTracked
                      ? 'orange'
                      : 'blue'
                }
              >
                {r.expirationDate?.slice(0, 10) ??
                  text('Unknown / none', 'Inconnue / aucune', '未知 / 不适用')}
              </Tag>
            ),
          },
          {
            title: text('Actions', 'Actions', '操作'),
            render: (_, r) => (
              <Space>
                <Button size="small" onClick={() => open('edit', r)}>
                  {text('Correct lot', 'Corriger le lot', '修正批次')}
                </Button>
                <Button size="small" danger onClick={() => open('waste', r)}>
                  {text('Waste', 'Perte', '报损')}
                </Button>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        open={!!mode}
        title={
          selected?.product.name ??
          text('Receive stock', 'Réception de stock', '入库')
        }
        onOk={save}
        onCancel={() => !busy && setMode(null)}
        confirmLoading={busy}
        okText={text('Save', 'Enregistrer', '保存')}
        cancelText={text('Cancel', 'Annuler', '取消')}
      >
        <OpsError error={error} />
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
          {mode === 'receive' && (
            <Select
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="label"
              placeholder={text('Product', 'Produit', '商品')}
              value={productId}
              onChange={(v) => {
                setProductId(v);
                setCost(products.find((p) => p.id === v)?.costPrice ?? '0');
              }}
              options={products.map((p) => ({ value: p.id, label: p.name }))}
            />
          )}
          {mode !== 'edit' && (
            <label>
              {text('Quantity', 'Quantité', '数量')}{' '}
              <InputNumber
                min={1}
                max={mode === 'waste' ? selected?.quantityRemaining : undefined}
                precision={0}
                value={quantity}
                onChange={(v) => setQuantity(Number(v))}
              />
            </label>
          )}
          {mode !== 'waste' && (
            <>
              <Input
                placeholder={text('Lot code', 'Numéro de lot', '批号')}
                value={lotCode}
                onChange={(e) => setLot(e.target.value)}
              />
              <label>
                {text('Expiration date', 'Date d’expiration', '有效期')}
                <Input
                  type="date"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                />
              </label>
            </>
          )}
          {mode === 'receive' && (
            <label>
              {text('Unit cost', 'Coût unitaire', '单位成本')}{' '}
              <InputNumber
                min="0"
                precision={2}
                stringMode
                value={cost}
                onChange={(v) => setCost(String(v ?? ''))}
              />
            </label>
          )}
          <Input.TextArea
            placeholder={text('Reason / notes', 'Motif / notes', '原因 / 备注')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Space>
      </Modal>
    </div>
  );
}
