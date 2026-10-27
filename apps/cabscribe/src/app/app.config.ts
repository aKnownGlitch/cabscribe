import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { CvScanService, DCC_TRANSPORT, DccSessionService } from 'common';
import { routes } from './app.routes';
import { createDccTransport } from './electron-dcc.transport';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Hash routing works for both the web build and Electron's file:// origin.
    provideRouter(routes, withHashLocation()),
    DccSessionService,
    CvScanService,
    { provide: DCC_TRANSPORT, useFactory: createDccTransport },
  ]
};
