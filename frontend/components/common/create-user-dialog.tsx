'use client';

import { useState } from 'react';
import { Modal, Form, Input, Checkbox } from 'antd';
import { apiCreateUser, apiCheckEmailExists } from '@/api/auth';
import { globalMessage } from '@/lib/message-bridge';
import { useT } from '@/lib/i18n';

interface CreateUserDialogProps {
  open: boolean;
  roleOptions: { label: string; value: string }[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateUserDialog({
  open,
  roleOptions,
  onClose,
  onSuccess,
}: CreateUserDialogProps) {
  const t = useT();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await apiCreateUser(values.email, values.password, values.roles ?? []);
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
          label={t.common.email}
          name="email"
          validateTrigger="onChange"
          rules={[
            { required: true, message: t.auth.email_required },
            { type: 'email', message: t.auth.email_invalid },
            {
              validator: async (_, value) => {
                if (!value || !/\S+@\S+\.\S+/.test(value)) return;
                const { exists } = await apiCheckEmailExists(value);
                if (exists) return Promise.reject(new Error(t.auth.email_already_exists));
              },
            },
          ]}
        >
          <Input placeholder={t.auth.email_placeholder} />
        </Form.Item>
        <Form.Item
          label={t.common.password}
          name="password"
          rules={[{ required: true, message: t.auth.password_required }]}
        >
          <Input.Password placeholder={t.auth.password_placeholder} />
        </Form.Item>
        <Form.Item
          label={t.common.confirm_password}
          name="confirm_password"
          dependencies={['password']}
          rules={[
            { required: true, message: t.auth.confirm_password_required },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) return Promise.resolve();
                return Promise.reject(new Error(t.auth.password_mismatch));
              },
            }),
          ]}
        >
          <Input.Password placeholder={t.auth.confirm_password_placeholder} />
        </Form.Item>
        <Form.Item
          label={t.auth.roles_label}
          name="roles"
          rules={[{ required: true, message: t.auth.roles_required }]}
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
