export interface PostField {
  title: string;
  type: 'text' | 'select' | 'textarea' | 'number' | 'file';
  required: boolean;
  options?: string[];
}

export interface ApplicationAnswer {
  title: string;
  value: string;
}
