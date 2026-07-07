'use client';

import { useEffect, useState } from 'react';
import { Checkbox, DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd';
import { apiGetAllCategories, CategoryRow } from '@/api/categories';
import { apiGetAllSuppliers, SupplierRow } from '@/api/suppliers';
import { apiCreateProduct } from '@/api/products';
import { globalMessage } from '@/lib/message-bridge';
import { useT } from '@/lib/i18n';

interface CreateProductDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateProductDialog({ open, onClose, onSuccess }: CreateProductDialogProps) {
  const t = useT();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [trackExpiration, setTrackExpiration] = useState(false);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);

  useEffect(() => {
    if (open) {
      apiGetAllCategories().then(setCategories).catch(() => {});
      apiGetAllSuppliers().then(setSuppliers).catch(() => {});
    }
  }, [open]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await apiCreateProduct({
        name: values.name,
        barcode: values.barcode || null,
        sku: values.sku || null,
        unit: values.unit || 'unit',
        costPrice: values.costPrice,
        sellingPrice: values.sellingPrice,
        currentStock: values.currentStock ?? 0,
        minStock: values.minStock ?? 0,
        expirationTracked: values.expirationTracked ?? false,
        expirationDate: values.expirationDate ? values.expirationDate.toISOString() : null,
        isActive: true,
        categoryId: values.categoryId ?? null,
        supplierId: values.supplierId ?? null,
      });
      globalMessage.success(t.common.create_success);
      form.resetFields();
      setTrackExpiration(false);
      onSuccess();
    } catch (err: any) {
      if (err?.errorFields) return;
      globalMessage.error(t.common.create_failed);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setTrackExpiration(false);
    onClose();
  };

  return (
    <Modal
      title={t.products.create_title}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText={t.common.submit}
      cancelText={t.common.cancel}
      destroyOnHidden
      width={560}
    >
      <Form form={form} layout="vertical" autoComplete="off">
        <Form.Item
          label={t.products.name}
          name="name"
          rules={[{ required: true, message: t.products.name_required }]}
        >
          <Input placeholder={t.products.name} />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Form.Item label={t.products.barcode} name="barcode">
            <Input placeholder={t.products.barcode} />
          </Form.Item>
          <Form.Item label={t.products.sku} name="sku">
            <Input placeholder={t.products.sku} />
          </Form.Item>

          <Form.Item
            label={t.products.cost_price}
            name="costPrice"
            rules={[{ required: true, message: t.products.cost_price_required }]}
          >
            <InputNumber min={0} precision={2} style={{ width: '100%' }} prefix="$" />
          </Form.Item>
          <Form.Item
            label={t.products.selling_price}
            name="sellingPrice"
            rules={[{ required: true, message: t.products.selling_price_required }]}
          >
            <InputNumber min={0} precision={2} style={{ width: '100%' }} prefix="$" />
          </Form.Item>

          <Form.Item label={t.products.current_stock} name="currentStock" initialValue={0}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={t.products.min_stock} name="minStock" initialValue={0}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label={t.products.category} name="categoryId">
            <Select
              allowClear
              placeholder={t.products.category}
              options={categories.map((c) => ({ label: c.name, value: c.id }))}
            />
          </Form.Item>
          <Form.Item label={t.products.supplier} name="supplierId">
            <Select
              allowClear
              placeholder={t.products.supplier}
              options={suppliers.map((s) => ({ label: s.name, value: s.id }))}
            />
          </Form.Item>

          <Form.Item label={t.products.unit} name="unit" initialValue="unit">
            <Input placeholder="unit / bottle / box" />
          </Form.Item>
        </div>

        <Form.Item name="expirationTracked" valuePropName="checked" style={{ marginBottom: 8 }}>
          <Checkbox onChange={(e) => setTrackExpiration(e.target.checked)}>
            {t.products.expiration_tracked}
          </Checkbox>
        </Form.Item>

        {trackExpiration && (
          <Form.Item label={t.products.expiration_date} name="expirationDate">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
