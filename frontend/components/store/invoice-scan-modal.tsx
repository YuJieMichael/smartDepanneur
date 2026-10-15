'use client';

import { useState } from 'react';
import { Alert, Button, Checkbox, Input, InputNumber, Modal, Select, Space, Table, Tag, Upload } from 'antd';
import { CameraOutlined } from '@ant-design/icons';
import { apiReceiveInvoice, apiScanInvoice, ScannedInvoice, ScannedInvoiceLine } from '@/api/invoices';
import type { ProductRow } from '@/api/products';
import { ApiError } from '@/lib/request';
import { Locale, useI18nStore } from '@/lib/i18n';
import { globalMessage } from '@/lib/message-bridge';

const labels: Record<Locale, Record<string, string>> = {
  en: {
    open: 'Scan invoice',
    title: 'Receive from a supplier invoice',
    hint: 'Take a photo or upload a PDF. Nothing is stocked until you check the lines and confirm.',
    choose: 'Choose photo or PDF',
    reading: 'Reading invoice...',
    supplier: 'Supplier',
    invoiceNumber: 'Invoice no.',
    receive: 'Receive into stock',
    cancel: 'Cancel',
    line: 'Invoice line',
    product: 'Product',
    quantity: 'Qty',
    unitCost: 'Unit cost',
    include: 'Include',
    unmatched: 'No match: pick a product or leave it out',
    bySku: 'SKU match',
    byName: 'Name match',
    priceUp: 'Cost up',
    priceDown: 'Cost down',
    duplicate: 'This invoice number was already received.',
    matched: 'lines matched',
    costChanges: 'cost changes to review',
    received: 'units received',
    needNumber: 'Enter the invoice number before receiving.',
  },
  fr: {
    open: 'Numériser une facture',
    title: 'Recevoir une facture fournisseur',
    hint: 'Prenez une photo ou téléversez un PDF. Rien n’entre en stock avant votre vérification.',
    choose: 'Choisir une photo ou un PDF',
    reading: 'Lecture de la facture...',
    supplier: 'Fournisseur',
    invoiceNumber: 'No de facture',
    receive: 'Recevoir en stock',
    cancel: 'Annuler',
    line: 'Ligne de facture',
    product: 'Produit',
    quantity: 'Qté',
    unitCost: 'Coût unitaire',
    include: 'Inclure',
    unmatched: 'Aucune correspondance : choisissez un produit ou excluez la ligne',
    bySku: 'SKU',
    byName: 'Nom',
    priceUp: 'Coût en hausse',
    priceDown: 'Coût en baisse',
    duplicate: 'Ce numéro de facture a déjà été reçu.',
    matched: 'lignes associées',
    costChanges: 'changements de coût à vérifier',
    received: 'unités reçues',
    needNumber: 'Entrez le numéro de facture avant de recevoir.',
  },
  zh: {
    open: '扫描发票',
    title: '按供应商发票入库',
    hint: '拍照或上传 PDF。核对并确认之前不会入库。',
    choose: '选择照片或 PDF',
    reading: '正在识别发票...',
    supplier: '供应商',
    invoiceNumber: '发票号',
    receive: '确认入库',
    cancel: '取消',
    line: '发票行',
    product: '商品',
    quantity: '数量',
    unitCost: '单价',
    include: '入库',
    unmatched: '未匹配：请选择商品或不入库',
    bySku: '编码匹配',
    byName: '名称匹配',
    priceUp: '进价上涨',
    priceDown: '进价下降',
    duplicate: '这张发票已经入过库。',
    matched: '行已匹配',
    costChanges: '处进价变化需核对',
    received: '件已入库',
    needNumber: '入库前请填写发票号。',
  },
};

interface DraftLine extends ScannedInvoiceLine {
  key: number;
  include: boolean;
  productId: number | null;
}

export default function InvoiceScanModal({
  products,
  onReceived,
}: {
  products: ProductRow[];
  onReceived: () => void;
}) {
  const locale = useI18nStore((state) => state.locale);
  const text = labels[locale];
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [error, setError] = useState('');
  const [invoice, setInvoice] = useState<ScannedInvoice | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);

  const reset = () => {
    setInvoice(null);
    setLines([]);
    setError('');
    setInvoiceNumber('');
    setSupplierName('');
  };

  const scan = async (file: File) => {
    setScanning(true);
    setError('');
    try {
      const result = await apiScanInvoice(file);
      setInvoice(result);
      setInvoiceNumber(result.invoiceNumber ?? '');
      setSupplierName(result.supplierName ?? '');
      setLines(
        result.lines.map((line, index) => ({
          ...line,
          key: index,
          include: line.match !== null,
          productId: line.match?.productId ?? null,
          quantity: Math.round(line.quantity),
        })),
      );
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : String(scanError));
    } finally {
      setScanning(false);
    }
  };

  const updateLine = (key: number, change: Partial<DraftLine>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...change } : line)));

  const receive = async () => {
    if (!invoiceNumber.trim()) {
      setError(text.needNumber);
      return;
    }
    const selected = lines.filter((line) => line.include && line.productId !== null && line.quantity > 0);
    setReceiving(true);
    setError('');
    try {
      const result = await apiReceiveInvoice({
        invoiceNumber: invoiceNumber.trim(),
        supplierName: supplierName.trim() || null,
        lines: selected.map((line) => ({
          productId: line.productId as number,
          quantity: line.quantity,
          unitCost: line.unitCost,
        })),
      });
      globalMessage.success(`${result.receivedUnits} ${text.received}`);
      setOpen(false);
      reset();
      onReceived();
    } catch (receiveError) {
      setError(receiveError instanceof ApiError ? receiveError.message : String(receiveError));
    } finally {
      setReceiving(false);
    }
  };

  const productOptions = (line: DraftLine) => {
    const candidateIds = new Set(line.candidates.map((candidate) => candidate.productId));
    return [
      ...line.candidates.map((candidate) => ({
        value: candidate.productId,
        label: `${candidate.productName} (${Math.round(candidate.score * 100)}%)`,
      })),
      ...products
        .filter((product) => !candidateIds.has(product.id))
        .map((product) => ({ value: product.id, label: product.name })),
    ];
  };

  const columns = [
    {
      title: text.include,
      key: 'include',
      width: 70,
      render: (_: unknown, line: DraftLine) => (
        <Checkbox
          checked={line.include}
          disabled={line.productId === null}
          onChange={(event) => updateLine(line.key, { include: event.target.checked })}
        />
      ),
    },
    {
      title: text.line,
      key: 'description',
      render: (_: unknown, line: DraftLine) => (
        <Space direction="vertical" size={2}>
          <span>{line.description}</span>
          <Space size={4} wrap>
            {line.matchedBy === 'sku' || line.matchedBy === 'barcode' ? <Tag color="green">{text.bySku}</Tag> : null}
            {line.matchedBy === 'name' ? <Tag color="blue">{text.byName}</Tag> : null}
            {line.costChange ? (
              <Tag color={line.costChange.changePct > 0 ? 'red' : 'cyan'}>
                {line.costChange.changePct > 0 ? text.priceUp : text.priceDown} {line.costChange.changePct > 0 ? '+' : ''}
                {line.costChange.changePct}% (${line.costChange.catalogueCost.toFixed(2)} → ${line.costChange.invoiceCost.toFixed(2)})
              </Tag>
            ) : null}
          </Space>
        </Space>
      ),
    },
    {
      title: text.product,
      key: 'product',
      width: 260,
      render: (_: unknown, line: DraftLine) => (
        <Select
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
          value={line.productId ?? undefined}
          placeholder={text.unmatched}
          status={line.productId === null ? 'warning' : undefined}
          options={productOptions(line)}
          onChange={(productId: number) => updateLine(line.key, { productId, include: true })}
        />
      ),
    },
    {
      title: text.quantity,
      key: 'quantity',
      width: 90,
      render: (_: unknown, line: DraftLine) => (
        <InputNumber min={1} precision={0} value={line.quantity} onChange={(value) => updateLine(line.key, { quantity: value ?? 0 })} />
      ),
    },
    {
      title: text.unitCost,
      key: 'unitCost',
      width: 110,
      render: (_: unknown, line: DraftLine) => (
        <InputNumber min={0} step={0.01} prefix="$" value={line.unitCost ?? undefined} onChange={(value) => updateLine(line.key, { unitCost: value ?? null })} />
      ),
    },
  ];

  const selectedCount = lines.filter((line) => line.include && line.productId !== null).length;

  return (
    <>
      <Button icon={<CameraOutlined />} onClick={() => setOpen(true)}>
        {text.open}
      </Button>
      <Modal
        title={text.title}
        open={open}
        width={980}
        onCancel={() => {
          setOpen(false);
          reset();
        }}
        footer={
          <Space>
            <Button onClick={() => { setOpen(false); reset(); }}>{text.cancel}</Button>
            <Button type="primary" disabled={!invoice || selectedCount === 0} loading={receiving} onClick={receive}>
              {text.receive} ({selectedCount})
            </Button>
          </Space>
        }
      >
        <Alert type="info" message={text.hint} style={{ marginBottom: 12 }} />
        <Upload
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          capture="environment"
          showUploadList={false}
          beforeUpload={(file) => {
            void scan(file);
            return false;
          }}
        >
          <Button icon={<CameraOutlined />} loading={scanning}>
            {scanning ? text.reading : text.choose}
          </Button>
        </Upload>
        {error && <Alert type="error" message={error} style={{ marginTop: 12 }} closable onClose={() => setError('')} />}
        {invoice && (
          <>
            {invoice.alreadyReceived && <Alert type="warning" message={text.duplicate} style={{ marginTop: 12 }} />}
            <Space wrap style={{ margin: '12px 0' }}>
              <Input addonBefore={text.supplier} value={supplierName} onChange={(event) => setSupplierName(event.target.value)} />
              <Input addonBefore={text.invoiceNumber} value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} />
              <Tag>{invoice.matchedCount}/{invoice.lines.length} {text.matched}</Tag>
              {invoice.costChangeCount > 0 && <Tag color="red">{invoice.costChangeCount} {text.costChanges}</Tag>}
            </Space>
            <Table size="small" rowKey="key" dataSource={lines} columns={columns} pagination={false} scroll={{ x: 760 }} />
          </>
        )}
      </Modal>
    </>
  );
}
