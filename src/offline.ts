type WorkerReply = { saved: boolean; error?: string };
let registration: Promise<ServiceWorkerRegistration> | undefined;
export function prepareOffline() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext || !import.meta.env.PROD) {
    return Promise.reject(new Error('Сохранение недоступно в этом браузере. Можно продолжать читать с интернетом.'));
  }
  registration ??= navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
    .catch(() => {
      registration = undefined;
      throw new Error('Не удалось подготовить сохранение. Проверьте соединение и попробуйте ещё раз.');
    });
  return registration;
}
export async function offlineRequest(type: 'STATUS' | 'DOWNLOAD'): Promise<boolean> {
  const workerRegistration = await prepareOffline();
  if (!workerRegistration.active && !workerRegistration.installing) await workerRegistration.update().catch(() => {});
  const ready = await new Promise<ServiceWorkerRegistration>((resolve, reject) => {
    const timer = setTimeout(() => {
      registration = undefined;
      reject(new Error('Не удалось подготовить сохранение. Проверьте связь и попробуйте ещё раз.'));
    }, 12000);
    navigator.serviceWorker.ready.then(value => { clearTimeout(timer); resolve(value); });
  });
  if (!ready.active) throw new Error('Сохранение пока недоступно. Попробуйте ещё раз.');
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error('Сохранение заняло слишком много времени. Проверьте связь и повторите.')); }, 45000);
    channel.port1.onmessage = ({ data }: MessageEvent<WorkerReply>) => {
      clearTimeout(timer); channel.port1.close();
      if (data.error) reject(new Error(data.error)); else resolve(data.saved);
    };
    ready.active!.postMessage({ type }, [channel.port2]);
  });
}

export function watchUpdates(onReady: (worker: ServiceWorker) => void, beforeReload: () => void) {
  if (!('serviceWorker' in navigator)) return () => {};
  let disposed = false;
  let controlled = !!navigator.serviceWorker.controller;
  let reloading = false;
  let current: ServiceWorkerRegistration | undefined;
  const inspect = () => {
    if (!disposed && current?.waiting && navigator.serviceWorker.controller) onReady(current.waiting);
  };
  const found = () => {
    const worker = current?.installing;
    worker?.addEventListener('statechange', inspect);
  };
  const attach = (value: ServiceWorkerRegistration) => {
    if (disposed) return;
    if (current !== value) {
      current?.removeEventListener('updatefound', found);
      current = value;
      current.addEventListener('updatefound', found);
      found();
    }
    inspect();
  };
  const check = () => {
    if (navigator.onLine && document.visibilityState === 'visible') current?.update().catch(() => {});
    inspect();
  };
  const changed = () => {
    if (controlled && !reloading) {
      reloading = true;
      beforeReload();
      window.location.reload();
    }
    controlled = true;
    navigator.serviceWorker.getRegistration().then(value => { if (value) attach(value); });
  };
  prepareOffline().then(attach).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', changed);
  window.addEventListener('online', check);
  document.addEventListener('visibilitychange', check);
  const interval = window.setInterval(check, 5 * 60 * 1000);
  return () => {
    disposed = true; clearInterval(interval);
    current?.removeEventListener('updatefound', found);
    navigator.serviceWorker.removeEventListener('controllerchange', changed);
    window.removeEventListener('online', check);
    document.removeEventListener('visibilitychange', check);
  };
}
