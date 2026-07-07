'use client';

import { useEffect, useState } from 'react';
import { apiGetRoles } from '@/api/roles';
import LoginForm, { RoleWithPermissions } from './login-form';

export default function LoginPage() {
  const [rolesWithPermissions, setRolesWithPermissions] = useState<RoleWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiGetRoles()
      .then((roles) => {
        console.log('✓ Loaded roles:', roles);
        setRolesWithPermissions(roles.map((r) => ({ role: r.name, permissions: [] })));
        setError(null);
      })
      .catch((err) => {
        console.error('✗ Failed to load roles:', err);
        setError(err instanceof Error ? err.message : 'Failed to load roles');
      })
      .finally(() => setLoading(false));
  }, []);

  return <LoginForm rolesWithPermissions={rolesWithPermissions} isLoadingRoles={loading} rolesError={error} />;
}
