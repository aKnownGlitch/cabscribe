import { Component, signal } from "@angular/core";
import { MatTabsModule } from "@angular/material/tabs";
import { CommandFormComponent } from "./command-form.component";

/**
 * Extended Configuration page
 *
 * Displays configuration and diagnostics commands organized by domain tabs.
 */
@Component({
  selector: "app-configuration",
  standalone: true,
  imports: [MatTabsModule, CommandFormComponent],
  templateUrl: "./configuration.page.html",
  styleUrl: "./configuration.page.scss",
})
export class ConfigurationPage {
  readonly tabs = [
    { label: "Power", category: "Track power and track configuration" },
    { label: "Turnouts", category: "Turnouts, sensors, and outputs" },
    { label: "Network", category: "Network configuration and diagnostics" },
    { label: "Diagnostics", category: "Configuration and diagnostics" },
  ];

  readonly selectedTabIndex = signal(0);
}
