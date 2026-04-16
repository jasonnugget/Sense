const store = new Map();
const listeners = new Set();
function notify(cameraId) {
    listeners.forEach((fn) => fn(cameraId));
}
export function subscribe(fn) {
    listeners.add(fn);
}
export function unsubscribe(fn) {
    listeners.delete(fn);
}
export function getStream(cameraId) {
    return store.get(cameraId);
}
export function saveStream(cameraId, stream, deviceId) {
    store.set(cameraId, { stream, deviceId });
    notify(cameraId);
}
export function releaseStream(cameraId) {
    const entry = store.get(cameraId);
    if (entry) {
        entry.stream.getTracks().forEach((t) => t.stop());
        store.delete(cameraId);
        notify(cameraId);
    }
}
export function hasLiveStream(cameraId) {
    const entry = store.get(cameraId);
    if (!entry)
        return false;
    return entry.stream.getTracks().some((t) => t.readyState === 'live');
}
