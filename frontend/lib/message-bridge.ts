import type { MessageInstance } from 'antd/es/message/interface';

let _message: MessageInstance | null = null;

export function setMessageInstance(instance: MessageInstance) {
  _message = instance;
}

export const globalMessage = {
  error: (msg: string) => _message?.error(msg),
  success: (msg: string) => _message?.success(msg),
  warning: (msg: string) => _message?.warning(msg),
};
