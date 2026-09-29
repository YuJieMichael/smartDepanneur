import ClientPage from './route-client';
import { DEMO_MODE } from '@/lib/demo/config';

export function generateStaticParams() {
  return DEMO_MODE ? [{ slug: ['preview-disabled'] }] : [];
}

export default function Page() {
  return DEMO_MODE ? <p>This section is not included in the store demo.</p> : <ClientPage />;
}
