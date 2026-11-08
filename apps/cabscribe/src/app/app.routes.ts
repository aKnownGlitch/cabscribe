import { Routes } from "@angular/router";
import { CvEditorPage } from "./cv-editor.page";
import { CvTablePage } from "./cv-table.page";
import { DebugPage } from "./debug.page";

export const CV_TABLE_PATH = "cv-table";
export const DEBUG_PATH = "debug";

export const routes: Routes = [
  { path: "", component: CvEditorPage, pathMatch: "full" },
  { path: CV_TABLE_PATH, component: CvTablePage },
  { path: DEBUG_PATH, component: DebugPage },
  { path: "**", redirectTo: "" },
];
