'use client';

import { useState } from 'react';
import { Modal, Form, Input, Select } from 'antd';
import { apiCreateDictionary, apiCheckDictionaryKeyExists } from '@/api/dictionary';
import { globalMessage } from '@/lib/message-bridge';
import { useT } from '@/lib/i18n';

interface CreateDictionaryDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateDictionaryDialog({
  open,
  onClose,
  onSuccess,
}: CreateDictionaryDialogProps) {
  const t = useT();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await apiCreateDictionary({
        key: values.key,
        value: values.value ?? [],
        category: values.category || undefined,
      });
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
          label={t.dictionary.key}
          name="key"
          validateTrigger="onChange"
          rules={[
            { required: true, message: t.dictionary.key_required },
            {
              validator: async (_, value) => {
                if (!value) return;
                const { exists } = await apiCheckDictionaryKeyExists(value);
                if (exists) return Promise.reject(new Error(t.dictionary.key_already_exists));
              },
            },
          ]}
        >
          <Input placeholder={t.dictionary.key} />
        </Form.Item>
        <Form.Item
          label={t.dictionary.value}
          name="value"
        >
          <Select
            mode="tags"
            placeholder={t.dictionary.value_placeholder}
            tokenSeparators={[',']}
          />
        </Form.Item>
        <Form.Item
          label={t.dictionary.category}
          name="category"
        >
          <Input placeholder={t.dictionary.category_placeholder} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
