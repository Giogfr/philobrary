export interface AdSpec {
  key: string;
  width: number;
  height: number;
}

interface QueuedAd {
  container: HTMLElement;
  spec: AdSpec;
}

const queue: QueuedAd[] = [];
let active = false;

function loadNext() {
  if (active || queue.length === 0) return;
  active = true;
  const { container, spec } = queue.shift() as QueuedAd;

  (window as unknown as Record<string, unknown>).atOptions = {
    key: spec.key,
    format: 'iframe',
    height: spec.height,
    width: spec.width,
    params: {},
  };

  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.setAttribute('data-cfasync', 'false');
  const done = () => {
    script.onload = null;
    script.onerror = null;
    active = false;
    setTimeout(loadNext, 0);
  };
  script.onload = done;
  script.onerror = done;
  script.src = `https://www.highperformanceformat.com/${spec.key}/invoke.js`;
  container.appendChild(script);
}

export function mountAd(container: HTMLElement, spec: AdSpec) {
  if (container.dataset.adLoaded) return;
  container.dataset.adLoaded = '1';
  queue.push({ container, spec });
  loadNext();
}
