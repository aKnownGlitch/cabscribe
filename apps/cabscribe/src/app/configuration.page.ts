import { Component, computed, inject, signal, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatTabsModule } from "@angular/material/tabs";
import { MatSelectModule } from "@angular/material/select";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatButtonModule } from "@angular/material/button";
import { MatInputModule } from "@angular/material/input";
import {
  CommandDefinition,
  DccCommandService,
  getCommandsByCategory,
} from "common";

/**
 * Extended Configuration page
 *
 * Displays configuration and diagnostics commands organized by domain tabs:
 * 1. Track power and track configuration
 * 2. Turnouts, sensors, and outputs
 * 3. JMRI-compatible information and roster
 * 4. Turntables
 * 5. Network configuration and diagnostics
 * 6. Configuration and diagnostics
 *
 * Phase 0: Display page shell and tabs. Actual command forms come in Phase 2.
 */
@Component({
  selector: "app-configuration",
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    MatInputModule,
  ],
  templateUrl: "./configuration.page.html",
  styleUrl: "./configuration.page.scss",
})
export class ConfigurationPage implements OnInit, OnDestroy {
  private readonly commandService = inject(DccCommandService);

  // Phase 0: Tabs are defined in the template but no commands are executed
  readonly tabs = [
    "Track power and track configuration",
    "Turnouts, sensors, and outputs",
    "JMRI-compatible information and roster",
    "Turntables",
    "Network configuration and diagnostics",
    "Configuration and diagnostics",
  ];

  readonly selectedTabIndex = signal(0);

  readonly selectedCategory = computed(
    () => this.tabs[this.selectedTabIndex()],
  );

  readonly categoryCommands = computed(() => {
    return getCommandsByCategory(this.selectedCategory());
  });

  ngOnInit(): void {
    // Clear command composition and results when entering this page
    this.commandService.clearComposition();
    this.commandService.clearResults();
  }

  ngOnDestroy(): void {
    // Clear results when leaving this page
    this.commandService.clearResults();
  }

  selectCommand(commandId: string): void {
    try {
      this.commandService.startComposing(commandId);
    } catch (error) {
      console.error("Failed to start composing command:", error);
    }
  }

  trackByTabIndex(index: number): number {
    return index;
  }

  trackByCommandId(index: number, cmd: CommandDefinition): string {
    return cmd.id;
  }
}
