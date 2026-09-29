'use client';

import { Button, Modal } from 'antd';
import { DEMO_MODE } from '@/lib/demo/config';
import { useI18nStore } from '@/lib/i18n';

export default function DemoBanner() {
  const locale = useI18nStore((state) => state.locale);
  if (!DEMO_MODE) return null;
  const text = locale === 'zh'
    ? { label: '演示预览 · 虚构数据 · 仅保存在此浏览器 · 不收款、不发送订单', reset: '重置演示', confirm: '清除本机演示操作并恢复示例数据？', cancel: '取消' }
    : locale === 'fr'
      ? { label: 'DÉMO · Données fictives dans ce navigateur · Aucun paiement ni envoi de commande', reset: 'Réinitialiser', confirm: 'Effacer vos essais et restaurer les données fictives ?', cancel: 'Annuler' }
      : { label: 'DEMO · Fictional data in this browser · No payments or orders sent', reset: 'Reset demo', confirm: 'Clear your demo changes and restore the sample data?', cancel: 'Cancel' };
  return <div role="status" style={{ padding: '8px 20px', background: '#e6f4ff', color: '#0958d9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', fontSize: 13 }}>
    <strong>{text.label}</strong>
    <Button size="small" onClick={() => Modal.confirm({ title: text.confirm, okText: text.reset, cancelText: text.cancel, onOk: async () => {
      const { resetDemo } = await import('@/lib/demo/api');
      resetDemo();
      window.location.reload();
    } })}>{text.reset}</Button>
  </div>;
}
