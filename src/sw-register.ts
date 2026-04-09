import { registerSW } from 'virtual:pwa-register';

const SW_UPDATE_INTERVAL = 60 * 1000; // Check for SW updates every 60s

const updateSW = registerSW({
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      setInterval(() => {
        registration.update();
      }, SW_UPDATE_INTERVAL);
    }
  },
  onRegisterError(error) {
    console.error('SW registration failed:', error);
  },
});

export { updateSW };
