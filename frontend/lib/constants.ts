import type { PostField } from '@/api/job-post-template';

export const FIELD_TYPES = [
  { label: 'Text', value: 'text' },
  { label: 'Number', value: 'number' },
  { label: 'Textarea', value: 'textarea' },
  { label: 'Select', value: 'select' },
  { label: 'File', value: 'file' },
] as const;

export const DEFAULT_FIELDS: PostField[] = [
  { title: 'Email', type: 'text', required: true },
  { title: 'Phone', type: 'text', required: true },
  { title: 'Nickname', type: 'text', required: true },
  { title: 'Country', type: 'select', required: true, options: [] },
  { title: 'State', type: 'select', required: true, options: [] },
  { title: 'Address', type: 'text', required: true },
  { title: 'Postcode', type: 'text', required: true },
  { title: 'Resume', type: 'file', required: true },
];

export const DEFAULT_FIELD_COUNT = DEFAULT_FIELDS.length;
