import { Component, signal } from "@angular/core";
import { MatTabsModule } from "@angular/material/tabs";
import { CommandFormComponent } from "./command-form.component";

/**
 * Operations page
 *
 * Displays operational commands organized by domain tabs.
 */
@Component({
  selector: "app-operations",
  standalone: true,
  imports: [MatTabsModule, CommandFormComponent],
  templateUrl: "./operations.page.html",
  styleUrl: "./operations.page.scss",
})
export class OperationsPage {
  readonly tabs = [
    { label: "Throttle", category: "Station and throttle" },
    { label: "Track", category: "Track power and track configuration" },
    { label: "Turnouts", category: "Turnouts, sensors, and outputs" },
    { label: "JMRI", category: "JMRI-compatible information and roster" },
    { label: "Turntables", category: "Turntables" },
    { label: "Consists", category: "Consists, momentum, and raw packets" },
  ];

  readonly selectedTabIndex = signal(0);
}
