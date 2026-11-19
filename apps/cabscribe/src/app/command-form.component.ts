import { Component, computed, DestroyRef, inject, input } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import {
  CommandSafetyClass,
  DccCommandService,
  getCommandsByCategory,
  ParameterType,
} from "common";

@Component({
  selector: "app-command-form",
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  providers: [DccCommandService],
  templateUrl: "./command-form.component.html",
  styles: `
    :host, .command-fields {
      display: grid;
      gap: 1rem;
    }

    .command-fields {
      max-width: 32rem;
    }

    mat-form-field {
      width: 100%;
    }

    .command-preview {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .field-error {
      margin: 0;
      color: #a4262c;
    }
  `,
})
export class CommandFormComponent {
  readonly category = input.required<string>();
  protected readonly commandService = inject(DccCommandService);
  protected readonly commands = computed(() => getCommandsByCategory(this.category()));
  protected readonly parameterType = ParameterType;
  protected readonly safetyClass = CommandSafetyClass;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.commandService.clearComposition();
      this.commandService.clearResults();
    });
  }

  protected selectCommand(id: string): void {
    if (id) {
      this.commandService.startComposing(id);
    } else {
      this.commandService.clearComposition();
      this.commandService.clearResults();
    }
  }
}
