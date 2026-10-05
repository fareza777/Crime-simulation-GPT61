import { Component, StrictMode } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';
import './fonts.css';
import App from './App';
import './styles.css';
import './ui/underworld.css';

class ErrorBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error:Error,_info:ErrorInfo){console.error('BLACKLINE could not render',error);}
  render(){return this.state.failed?<div className="splash-screen"><img src="/assets/icon-192.png" alt="BLACKLINE"/><h1>Let's get you back.</h1><p>Your local story is still on this device.</p><button className="button primary" onClick={()=>location.reload()}>Reload BLACKLINE</button></div>:this.props.children;}
}
async function start() {
  if (Capacitor.isNativePlatform()) {
    await (window as Window & { __blacklineNativeReady?: Promise<void> }).__blacklineNativeReady;
  } else {
    registerSW({ immediate: true });
  }
  createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><App/></ErrorBoundary></StrictMode>);
}
void start();
