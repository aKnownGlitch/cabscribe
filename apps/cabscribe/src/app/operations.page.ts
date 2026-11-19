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
 * Operations page
 *
 * Displays operational commands organized by domain tabs:
 * 1. Station and throttle
 * 2. Track power and track configuration
 * 3. Turnouts, sensors, and outputs
 * 4. JMRI-compatible information and roster
 * 5. Turntables
 * 6. DCC accessory and programming commands
 * 7. Consists, momentum, and raw packets
 * 8. Pins, displays, sound, and peripherals
 * 9. EXRAIL automation
 *
 * Phase 0: Display page shell and tabs. Actual command forms come in Phase 2.
 */
@Component({
  selector: "app-operations",
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    MatInputModule,
  ],
  templateUrl: "./operations.page.html",
  styleUrl: "./operations.page.scss",
})
export class OperationsPage implements OnInit, OnDestroy {
  private readonly commandService = inject(DccCommandService);

  // Phase 0: Tabs are defined in the template but no commands are executed
  readonly tabs = [
    "Station and throttle",
    "Track power and track configuration",
    "Turnouts, sensors, and outputs",
    "JMRI-compatible information and roster",
    "Turntables",
    "DCC accessory and programming commands",
    "Consists, momentum, and raw packets",
    "Pins, displays, sound, and peripherals",
    "EXRAIL automation",
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

  selectCommand(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const commandId = target.value;
    if (!commandId) return;
    
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
