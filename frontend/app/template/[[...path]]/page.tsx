'use client';

import { useParams } from 'next/navigation';
import TemplateByUserClient from '../[id]/template-client';
import TemplateNewClient from '../new/template-new-client';
import TemplateEditListClient from '../edit/template-client';
import TemplateForm from '@/components/template/template-form';

export default function TemplateCatchAll() {
  const params = useParams();
  const path = params.path as string[] | undefined;

  if (!path || path.length === 0) {
    return null;
  }

  if (path[0] === 'new') {
    return <TemplateNewClient />;
  }

  if (path[0] === 'edit') {
    if (path.length === 1) {
      return <TemplateEditListClient />;
    }
    return <TemplateForm mode="edit" templateId={Number(path[1])} />;
  }

  if (path[0] === 'view' && path.length === 2) {
    return <TemplateForm mode="view" templateId={Number(path[1])} />;
  }

  // /template/[id] - user ID for viewing templates
  return <TemplateByUserClient userId={Number(path[0])} />;
}
