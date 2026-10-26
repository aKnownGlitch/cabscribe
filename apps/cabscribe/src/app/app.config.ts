import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { DCC_TRANSPORT, DccSessionService } from 'common';
import { createDccTransport } from './electron-dcc.transport';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    DccSessionService,
    { provide: DCC_TRANSPORT, useFactory: createDccTransport },
  ]
};
