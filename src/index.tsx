// WebRTC diagnostics MUST be installed before any Trystero code loads
import { installWebRTCDiagnostics } from './lib/webrtc-diagnostics';
installWebRTCDiagnostics();

import { render } from 'solid-js/web';
import App from './App';
import './app.css';
import './sw-register';
import { startVersionCheck } from './lib/version-check';
import { notifyUpdate } from './components/UpdateToast';

startVersionCheck(notifyUpdate);

render(() => <App />, document.getElementById('root')!);
