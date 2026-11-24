const deviceKey = (roomId: string) => `sorteo:device:${roomId}`;
const adminKey = (roomId: string) => `sorteo:admin:${roomId}`;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    return;
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    return;
  }
}

export const loadDeviceToken = (roomId: string) => read(deviceKey(roomId));
export const saveDeviceToken = (roomId: string, token: string) => write(deviceKey(roomId), token);
export const loadAdminSecret = (roomId: string) => read(adminKey(roomId));
export const saveAdminSecret = (roomId: string, secret: string) => write(adminKey(roomId), secret);
export const clearAdminSecret = (roomId: string) => remove(adminKey(roomId));
