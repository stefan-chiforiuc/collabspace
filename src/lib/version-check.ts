let currentBuildTime: number | null = null;
let checking = false;

async function fetchVersion(): Promise<number | null> {
  try {
    const res = await fetch('./version.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.buildTime ?? null;
  } catch {
    return null;
  }
}

async function checkForUpdate(onUpdateAvailable: () => void) {
  if (checking) return;
  checking = true;
  try {
    const latest = await fetchVersion();
    if (latest && currentBuildTime && latest !== currentBuildTime) {
      onUpdateAvailable();
    }
  } finally {
    checking = false;
  }
}

export function startVersionCheck(onUpdateAvailable: () => void) {
  // Capture the build version on first load
  fetchVersion().then((v) => {
    currentBuildTime = v;
  });

  // Check when user returns to the tab
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForUpdate(onUpdateAvailable);
    }
  });

  // Also poll every 5 minutes as a safety net
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      checkForUpdate(onUpdateAvailable);
    }
  }, 5 * 60 * 1000);
}
