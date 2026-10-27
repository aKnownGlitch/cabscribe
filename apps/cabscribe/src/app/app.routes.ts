import { Routes } from '@angular/router';
import { CvEditorPage } from './cv-editor.page';
import { CvTablePage } from './cv-table.page';

export const CV_TABLE_PATH = 'cv-table';

export const routes: Routes = [
  { path: '', component: CvEditorPage, pathMatch: 'full' },
  { path: CV_TABLE_PATH, component: CvTablePage },
  { path: '**', redirectTo: '' },
];
