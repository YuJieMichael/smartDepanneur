import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { useAppStore } from './store';

dayjs.extend(utc);

export function checkPermissionCode(permissionCode: string = ''): boolean {
    const user = useAppStore.getState().currentUser;
    if (!user) return false;

    const isAdmin = user.roles.some((role) => role.name === 'Admin');
    if (isAdmin) return true;

    if (!permissionCode) return false;

    return user.roles.some((role) =>
        role.permissions.some((permission) => permission.name === permissionCode),
    );
}

export const DATE_FORMAT = 'DD-MM-YYYY';

export function formatDate(val: string): string {
    return dayjs.utc(val).format(DATE_FORMAT);
}

const microTaskQueue: Record<string, Promise<void>> = {};

export function enqueueMicroTask(
    table: string,
    id: string | number,
    update: () => Promise<void>,
): Promise<void> {
    const key = `${table}-${id}`;
    const prev = microTaskQueue[key] ?? Promise.resolve();
    const task = new Promise<void>((resolve, reject) => {
        prev.then(() => update().then(resolve, reject));
    });
    microTaskQueue[key] = task.catch(() => {});
    return task;
}
