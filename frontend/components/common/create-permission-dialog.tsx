'use client';

import { useState } from 'react';
import { Modal, Form, Input, Checkbox } from 'antd';
import { apiCreatePermission, apiCheckPermissionCodeExists } from '@/api/permissions';
import { globalMessage } from '@/lib/message-bridge';
import { useT } from '@/lib/i18n';

interface CreatePermissionDialogProps {
  open: boolean;
  roleOptions: { label: string; value: string }[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreatePermissionDialog({
  open,
  roleOptions,
  onClose,
  onSuccess,
}: CreatePermissionDialogProps) {
  const t = useT();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await apiCreatePermission({ name: values.code, roles: values.roles });
      globalMessage.success(t.common.create_success);
      form.resetFields();
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
    onClose();
  };

  return (
    <Modal
      title={t.common.create}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText={t.common.submit}
      cancelText={t.common.cancel}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" autoComplete="off">
        <Form.Item
          label={t.permissions.code}
          name="code"
          validateTrigger="onChange"
          rules={[
            { required: true, message: t.permissions.code_required },
            {
              validator: async (_, value) => {
                if (!value) return;
                const { exists } = await apiCheckPermissionCodeExists(value);
                if (exists) return Promise.reject(new Error(t.permissions.code_already_exists));
              },
            },
          ]}
        >
          <Input placeholder={t.permissions.code} />
        </Form.Item>
        <Form.Item
          label={t.permissions.related_roles}
          name="roles"
          rules={[{ required: true, message: t.permissions.roles_required }]}
        >
          <Checkbox.Group>
            <div className="flex flex-col gap-2">
              {roleOptions.map((opt) => (
                <Checkbox key={opt.value} value={opt.value}>
                  {opt.label}
                </Checkbox>
              ))}
            </div>
          </Checkbox.Group>
        </Form.Item>
      </Form>
    </Modal>
  );
}
