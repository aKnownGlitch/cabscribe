import { Routes } from "@angular/router";
import { CvEditorPage } from "./cv-editor.page";
import { CvTablePage } from "./cv-table.page";
import { DebugPage } from "./debug.page";

export const CV_TABLE_PATH = "cv-table";
export const DEBUG_PATH = "debug";
export const CONFIGURATION_PATH = "configuration";
export const OPERATIONS_PATH = "operations";

export const routes: Routes = [
  { path: "", component: CvEditorPage, pathMatch: "full" },
  { path: CV_TABLE_PATH, component: CvTablePage },
  { path: DEBUG_PATH, component: DebugPage },
  {
    path: CONFIGURATION_PATH,
    loadComponent: () =>
      import("./configuration.page").then((m) => m.ConfigurationPage),
  },
  {
    path: OPERATIONS_PATH,
    loadComponent: () =>
      import("./operations.page").then((m) => m.OperationsPage),
  },
  { path: "**", redirectTo: "" },
];
