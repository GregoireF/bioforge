import { registerSW } from 'virtual:pwa-register';

registerSW({
    immediate: true,
    onRegisteredSW(swScriptUrl) {
        console.log('Service Worker registered at:', swScriptUrl);
    },
    onOfflineReady() {
        console.log('App is ready to work offline');
    }
})