import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Initialize Telegram Mini App
const telegram = window.Telegram?.WebApp;
if (telegram) {
  telegram.ready();
  telegram.expand();
  telegram.disableVerticalSwipes();

  // Apply Telegram theme colors
  if (telegram.themeParams.bg_color) {
    document.documentElement.style.setProperty('--tg-theme-bg-color', telegram.themeParams.bg_color);
  }
  if (telegram.themeParams.text_color) {
    document.documentElement.style.setProperty('--tg-theme-text-color', telegram.themeParams.text_color);
  }
  if (telegram.themeParams.hint_color) {
    document.documentElement.style.setProperty('--tg-theme-hint-color', telegram.themeParams.hint_color);
  }
  if (telegram.themeParams.link_color) {
    document.documentElement.style.setProperty('--tg-theme-link-color', telegram.themeParams.link_color);
  }
  if (telegram.themeParams.button_color) {
    document.documentElement.style.setProperty('--tg-theme-button-color', telegram.themeParams.button_color);
  }
  if (telegram.themeParams.button_text_color) {
    document.documentElement.style.setProperty('--tg-theme-button-text-color', telegram.themeParams.button_text_color);
  }
  if (telegram.themeParams.secondary_bg_color) {
    document.documentElement.style.setProperty('--tg-theme-secondary-bg-color', telegram.themeParams.secondary_bg_color);
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
