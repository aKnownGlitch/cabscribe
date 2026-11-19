import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

if (window.cabscribeDesktop) {
  document.documentElement.classList.add('desktop');
} else {
  const fontStyles = document.createElement('link');
  fontStyles.rel = 'stylesheet';
  fontStyles.href = 'https://fonts.googleapis.com/css2?family=Fira+Code&display=swap';
  document.head.append(fontStyles);
}

bootstrapApplication(App, appConfig).catch((err) =>
  console.error(err)
);
