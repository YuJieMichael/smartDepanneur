'use client';

import { useState } from 'react';
import { Modal, Form, Input, Checkbox } from 'antd';
import { apiCreateRole, apiCheckRoleNameExists } from '@/api/roles';
import { globalMessage } from '@/lib/message-bridge';
import { useT } from '@/lib/i18n';

interface CreateRoleDialogProps {
  open: boolean;
  permissionOptions: { label: string; value: string }[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateRoleDialog({
  open,
  permissionOptions,
  onClose,
  onSuccess,
}: CreateRoleDialogProps) {
  const t = useT();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await apiCreateRole({ name: values.name, permissionNames: values.permissions ?? [] });
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
          label={t.roles.name}
          name="name"
          validateTrigger="onChange"
          rules={[
            { required: true, message: t.roles.name_required },
            {
              validator: async (_, value) => {
                if (!value) return;
                const { exists } = await apiCheckRoleNameExists(value);
                if (exists) return Promise.reject(new Error(t.roles.name_already_exists));
              },
            },
          ]}
        >
          <Input placeholder={t.roles.name} />
        </Form.Item>
        <Form.Item
          label={t.roles.related_permissions}
          name="permissions"
        >
          <Checkbox.Group>
            <div className="flex flex-col gap-2">
              {permissionOptions.map((opt) => (
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
