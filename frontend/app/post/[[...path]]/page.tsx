'use client';

import { useParams } from 'next/navigation';
import PostNewClient from '../new/post-new-client';
import PostDetailClient from '../detail/[id]/post-detail-client';

export default function PostCatchAll() {
  const params = useParams();
  const path = params.path as string[] | undefined;

  if (!path || path.length === 0) {
    return null;
  }

  if (path[0] === 'new') {
    return <PostNewClient />;
  }

  if (path[0] === 'detail' && path.length === 2) {
    return <PostDetailClient postId={Number(path[1])} />;
  }

  return null;
}
