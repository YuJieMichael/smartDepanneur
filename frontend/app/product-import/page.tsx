'use client';
import { useState } from 'react';
import { Alert, Button, Card, Space, Table, Typography } from 'antd';
import { commitImport, previewImport, ImportPreview } from '@/api/operations';
import {
  downloadText,
  errorText,
  OpsError,
  useOpsText,
  useRequestId,
} from '@/components/store/operations-common';
const template =
  'name,sku,barcode,category,supplier,unit,costPrice,sellingPrice,currentStock,minStock,expirationTracked,expirationDate,lotCode\nEau 500 ml,EAU-500,001234567890,Drinks,Demo Supplier,unit,0.50,1.50,24,6,false,,OPENING-1\n';
export default function ProductImportPage() {
  const text = useOpsText();
  const requestId = useRequestId();
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const check = async () => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      setPreview(await previewImport(csv));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const submit = async () => {
    if (!preview?.canImport) return;
    setBusy(true);
    setError('');
    try {
      const result = await commitImport(
        csv,
        preview.fileHash,
        requestId({ csv }),
      );
      setSuccess(
        `${result.count} ${text('products imported', 'produits importés', '个商品已导入')}`,
      );
      setPreview(null);
      setCsv('');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={2}>
        {text(
          'CSV product import',
          'Importer des produits CSV',
          'CSV 商品导入',
        )}
      </Typography.Title>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title={text(
          'New products only. UTF-8 CSV, up to 500 rows / 1 MB. SKU or barcode required; keep leading zeros. Every row must pass before import. New category and supplier names are created.',
          'Nouveaux produits uniquement. CSV UTF-8, 500 lignes / 1 Mo maximum. SKU ou code-barres requis. Toutes les lignes doivent être valides. Les catégories et fournisseurs inconnus seront créés.',
          '仅新增商品。UTF-8 CSV，最多 500 行 / 1 MB。SKU 或条码至少填写一项，保留前导零；所有行通过后才会导入。不存在的分类和供应商名称会自动创建。',
        )}
      />
      <OpsError error={error} />
      {success && (
        <Alert type="success" title={success} style={{ marginBottom: 16 }} />
      )}
      <Card>
        <Space wrap>
          <Button
            onClick={() =>
              downloadText('smartdepanneur-products-template.csv', template)
            }
          >
            {text('Download template', 'Télécharger le modèle', '下载模板')}
          </Button>
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            aria-label={text('Choose CSV', 'Choisir un CSV', '选择 CSV 文件')}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              setPreview(null);
              setSuccess('');
              setError('');
              setCsv('');
              if (!file) return;
              if (file.size > 1024 * 1024) {
                setError('Maximum 1 MB');
                return;
              }
              try {
                setCsv(await file.text());
              } catch (err) {
                setError(errorText(err));
              }
            }}
          />
          <Button disabled={!csv} loading={busy} onClick={check}>
            {text(
              'Preview & validate',
              'Prévisualiser et valider',
              '预览并检查',
            )}
          </Button>
          <Button
            type="primary"
            disabled={!preview?.canImport || !csv}
            loading={busy}
            onClick={submit}
          >
            {text('Confirm import', 'Confirmer l’importation', '确认导入')}
          </Button>
        </Space>
      </Card>
      {preview && (
        <>
          <Typography.Paragraph style={{ marginTop: 16 }}>
            {preview.rowCount} {text('rows', 'lignes', '行')} ·{' '}
            {preview.errors.length} {text('errors', 'erreurs', '个错误')}
          </Typography.Paragraph>
          {!!preview.errors.length && (
            <Table
              rowKey={(r) => `${r.row}-${r.message}`}
              dataSource={preview.errors}
              columns={[
                {
                  title: text('CSV row', 'Ligne CSV', 'CSV 行'),
                  dataIndex: 'row',
                },
                {
                  title: text('Error', 'Erreur', '错误'),
                  dataIndex: 'message',
                },
              ]}
            />
          )}
          <Table
            rowKey="row"
            dataSource={preview.products}
            scroll={{ x: 700 }}
            columns={[
              { title: '#', dataIndex: 'row' },
              { title: text('Product', 'Produit', '商品'), dataIndex: 'name' },
              { title: 'SKU', dataIndex: 'sku' },
              {
                title: text('Barcode', 'Code-barres', '条码'),
                dataIndex: 'barcode',
              },
              {
                title: text('Opening stock', 'Stock initial', '期初库存'),
                dataIndex: 'currentStock',
              },
              {
                title: text('Price', 'Prix', '售价'),
                dataIndex: 'sellingPrice',
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
