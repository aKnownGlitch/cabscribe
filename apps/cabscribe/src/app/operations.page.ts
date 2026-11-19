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
 * Displays operational commands organized by domain tabs.
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

  readonly tabs = [
    { label: "Throttle", category: "Station and throttle" },
    { label: "Track", category: "Track power and track configuration" },
    { label: "Turnouts", category: "Turnouts, sensors, and outputs" },
    { label: "JMRI", category: "JMRI-compatible information and roster" },
    { label: "Turntables", category: "Turntables" },
    { label: "Accessories", category: "DCC accessory and programming commands" },
    { label: "Consists", category: "Consists, momentum, and raw packets" },
    { label: "Pins", category: "Pins, displays, sound, and peripherals" },
    { label: "Automation", category: "EXRAIL automation" },
  ];

  readonly selectedTabIndex = signal(0);

  readonly selectedCategory = computed(
    () => this.tabs[this.selectedTabIndex()].category,
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
