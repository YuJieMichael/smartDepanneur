'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { apiGetDictionaryByKey } from '@/api/dictionary';
import { apiGetPermissions } from '@/api/permissions';
import { apiGetRoles } from '@/api/roles';
import DictionaryClient from '../dictionary/dictionary-client';
import UsersClient from '../users/users-client';
import RolesClient from '../roles/roles-client';
import PermissionsClient from '../permissions/permissions-client';

export default function AdminCatchAll() {
  const pathname = usePathname();
  const [roleOptions, setRoleOptions] = useState<{ label: string; value: string }[]>([]);
  const [permissionOptions, setPermissionOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    if (pathname === '/admin/users') {
      apiGetDictionaryByKey('roleoptions').then((dict) => {
        if (dict?.value) {
          setRoleOptions(dict.value.map((r: string) => ({ label: r, value: r })));
        }
      }).catch(() => {});
    } else if (pathname === '/admin/roles') {
      apiGetPermissions().then((result) => {
        setPermissionOptions(result.list.map((p: { name: string }) => ({ label: p.name, value: p.name })));
      }).catch(() => {});
    } else if (pathname === '/admin/permissions') {
      apiGetRoles().then((roles) => {
        setRoleOptions(roles.map((r: { name: string }) => ({ label: r.name, value: r.name })));
      }).catch(() => {});
    }
  }, [pathname]);

  if (pathname === '/admin/dictionary') return <DictionaryClient />;
  if (pathname === '/admin/users') return <UsersClient roleOptions={roleOptions} />;
  if (pathname === '/admin/roles') return <RolesClient permissionOptions={permissionOptions} />;
  if (pathname === '/admin/permissions') return <PermissionsClient roleOptions={roleOptions} />;

  return null;
}
