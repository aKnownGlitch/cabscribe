import { TestBed, ComponentFixture } from "@angular/core/testing";
import { TestbedHarnessEnvironment } from "@angular/cdk/testing/testbed";
import { MatSelectHarness } from "@angular/material/select/testing";
import { MatTabGroupHarness } from "@angular/material/tabs/testing";
import { By } from "@angular/platform-browser";
import { provideRouter, Router } from "@angular/router";
import { App } from "./app";
import { routes } from "./app.routes";
import { CvEditorPage } from "./cv-editor.page";
import { CvTablePage } from "./cv-table.page";
import {
  CvScanService,
  DCC_TRANSPORT,
  DccSessionService,
  SerialLogMessage,
  UnavailableDccTransport,
} from "common";

describe("App", () => {
  const editorOf = (fixture: ComponentFixture<App>) =>
    fixture.debugElement.query(By.directive(CvEditorPage))
      .componentInstance as CvEditorPage;
  const originalShowModal = Object.getOwnPropertyDescriptor(
    HTMLDialogElement.prototype,
    "showModal",
  );
  const originalClose = Object.getOwnPropertyDescriptor(
    HTMLDialogElement.prototype,
    "close",
  );
  beforeEach(async () => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.open = true;
      }),
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.open = false;
      }),
    });
    window.localStorage.removeItem("cabscribe.selectedSerialPort");
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        DccSessionService,
        CvScanService,
        {
          provide: DCC_TRANSPORT,
          useClass: UnavailableDccTransport,
        },
      ],
    }).compileComponents();
  });

  const showEditor = async (fixture: ComponentFixture<App>) => {
    await TestBed.inject(Router).navigateByUrl("/");
    fixture.detectChanges();
    await fixture.whenStable();
    return editorOf(fixture);
  };

  afterEach(() => {
    vi.restoreAllMocks();
    for (const [name, descriptor] of [
      ["showModal", originalShowModal],
      ["close", originalClose],
    ] as const) {
      if (descriptor) {
        Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
      } else {
        Reflect.deleteProperty(HTMLDialogElement.prototype, name);
      }
    }
  });

  it("requires a successful connection before dismissal and reopens after connection loss", async () => {
    const transport = {
      listPorts: vi.fn().mockResolvedValue([{ id: "test", label: "DCC-EX" }]),
      connect: vi
        .fn()
        .mockRejectedValueOnce(new Error("Port busy"))
        .mockResolvedValue({
          capabilities: { serviceModeRead: false, serviceModeWrite: false },
        }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      readCv: vi.fn(),
      writeCv: vi.fn(),
    };
    TestBed.overrideProvider(DCC_TRANSPORT, { useValue: transport });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const app = fixture.componentInstance;
    const element = fixture.nativeElement as HTMLElement;
    const dialog =
      element.querySelector<HTMLDialogElement>("#connectionDialog");
    expect(dialog?.open).toBe(true);
    expect(element.querySelector(".continue-button")).toBeNull();
    app.closeConnectionDialog();
    expect(dialog?.open).toBe(true);
    const cancel = new Event("cancel", { cancelable: true });
    dialog?.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    app.selectPort("missing");
    app.closeConnectionDialog();
    expect(dialog?.open).toBe(true);
    app.selectPort("test");
    fixture.detectChanges();
    app.closeConnectionDialog();
    expect(dialog?.open).toBe(true);
    await app.connect();
    expect(dialog?.open).toBe(true);
    expect(app.isConnected()).toBe(false);
    await app.connect();
    expect(dialog?.open).toBe(false);
    const allowedCancel = new Event("cancel", { cancelable: true });
    dialog?.dispatchEvent(allowedCancel);
    expect(allowedCancel.defaultPrevented).toBe(false);
    app.session.connection.set({ status: "error", message: "Device removed" });
    await fixture.whenStable();
    expect(dialog?.open).toBe(true);
  });

  it("explains that serial communication is not configured", async () => {
    const fixture = TestBed.createComponent(App);
    await showEditor(fixture);
    const compiled = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(compiled.textContent).toContain(
        "Serial communication is not configured",
      );
    });
    expect(compiled.querySelector("header")?.textContent).not.toContain("Disconnected");
    expect(
      compiled
        .querySelector<HTMLButtonElement>(".connection-settings-button")
        ?.getAttribute("aria-label"),
    ).toBe("Serial connection settings");
    expect(compiled.querySelector("#connectionDialog")).not.toBeNull();
    expect(
      compiled.querySelector("#connection-dialog-title")?.textContent,
    ).toBe("Serial connection");
    const welcomeLogo = compiled.querySelector<HTMLImageElement>(
      "#connectionDialog .welcome-logo",
    );
    expect(welcomeLogo?.getAttribute("src")).toBe("cabscribe-logo.png");
    expect(welcomeLogo?.alt).toContain("CABSCRIBE");
    expect(compiled.querySelector(".welcome-message")?.textContent).toContain(
      "free, open-source",
    );
    expect(
      compiled.querySelector(".welcome-disclaimer")?.textContent,
    ).toContain("without warranty");
    expect(
      compiled.querySelector(".welcome-disclaimer")?.textContent,
    ).toContain("not liable");
    expect(
      compiled
        .querySelector(".welcome-disclaimer")
        ?.textContent?.replace(/\s+/g, " "),
    ).toContain(
      `Check your setup before programming a decoder. Version ${fixture.componentInstance.version}, October 27, 2026.`,
    );
    expect(compiled.textContent).not.toContain("HARDWARE CONNECTION");
    expect(compiled.textContent).toContain("Locomotive or Accessory ID");
    expect(compiled.querySelector("#serial-debug-output")).toBeNull();
    expect(compiled.querySelector(".debug-toggle-button")).not.toBeNull();
    expect(compiled.textContent).not.toContain("Hardware connection");
    expect(compiled.querySelector("h1")?.textContent).toBe(
      "Read or write a configuration variable",
    );
    expect(compiled.querySelector(".page-heading .intro")).toBeNull();
    expect(
      compiled.querySelector(
        ".operation-card .card-description, .operation-card mat-hint, .verification-note",
      ),
    ).toBeNull();
    expect(compiled.textContent).not.toContain("DECODER CONFIGURATION");
    expect(compiled.textContent).not.toContain("No operation history is saved");
    expect(
      compiled.querySelector(
        ".address-card .card-heading #address-confirmation-help",
      ),
    ).not.toBeNull();
    expect(compiled.textContent).not.toContain("SERIAL MONITOR");
    expect(compiled.querySelector(".app-footer")?.textContent).toContain(
      "Copyright © 2026 Larry Weinheimer",
    );
    expect(compiled.querySelector(".app-footer")?.textContent).not.toContain(
      "No cloud account required",
    );
    const github = compiled.querySelector<HTMLAnchorElement>(".github-button");
    expect(github?.href).toBe("https://github.com/aKnownGlitch/cabscribe");
    expect(github?.target).toBe("_blank");
    expect(github?.rel).toBe("noopener noreferrer");
    expect(github?.textContent?.trim()).toBe("");
    expect(github?.getAttribute("aria-label")).toContain("GitHub");
    expect(github?.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(compiled.textContent).toContain(
      "Serial communication is not configured in this build.",
    );
    expect(
      compiled.querySelector<HTMLButtonElement>(".operation-button")?.disabled,
    ).toBe(true);
  });

  it("connects the selected serial port without showing a mode chip in the app bar", async () => {
    const transport = {
      listPorts: vi
        .fn()
        .mockResolvedValue([{ id: "/dev/ttyUSB0", label: "DCC-EX" }]),
      connect: vi.fn().mockResolvedValue({
        capabilities: {
          serviceModeRead: false,
          serviceModeWrite: false,
        },
      }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      readCv: vi.fn(),
      writeCv: vi.fn(),
    };
    TestBed.overrideProvider(DCC_TRANSPORT, { useValue: transport });

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.componentInstance.selectPort("/dev/ttyUSB0");
    const dialog = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLDialogElement>("#connectionDialog");
    if (!dialog) {
      throw new Error("Connection settings dialog was not rendered.");
    }
    const closeDialog = vi.fn();
    Object.defineProperty(dialog, "close", { value: closeDialog });

    await fixture.componentInstance.connect();
    fixture.detectChanges();

    expect(transport.connect).toHaveBeenCalledWith("/dev/ttyUSB0");
    expect(closeDialog).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.isConnected()).toBe(true);
    expect(fixture.nativeElement.querySelector("header")?.textContent).not.toContain("Service Mode");
  });

  it("confirms from the target section, shows errors and clears the result when the address changes", async () => {
    let incoming!: (message: {
      direction: "incoming";
      message: string;
    }) => void;
    const transport = {
      listPorts: vi.fn().mockResolvedValue([{ id: "test", label: "DCC-EX" }]),
      connect: vi.fn().mockResolvedValue({
        capabilities: { serviceModeRead: false, serviceModeWrite: false },
      }),
      requestLocomotiveAddress: vi.fn().mockResolvedValue(undefined),
      onSerialMessage: (listener: typeof incoming) => {
        incoming = listener;
        return vi.fn();
      },
      disconnect: vi.fn().mockResolvedValue(undefined),
      readCv: vi.fn(),
      writeCv: vi.fn(),
    };
    TestBed.overrideProvider(DCC_TRANSPORT, { useValue: transport });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const app = fixture.componentInstance;
    app.selectPort("test");
    await app.session.connect("test");
    app.updateTargetAddress(3);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const button = element.querySelector<HTMLButtonElement>(
      ".confirm-address-button",
    );
    expect(button?.disabled).toBe(false);
    button?.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(
        element.querySelector<HTMLInputElement>(".address-field input")
          ?.disabled,
      ).toBe(true);
    });
    expect(app.operationInProgress()).toBe(true);
    incoming({ direction: "incoming", message: "<r LOCOID 3>" });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      element.querySelector(".address-confirmation-status")?.textContent,
    ).toContain("Address 3 confirmed");
    app.updateTargetAddress(7);
    fixture.detectChanges();
    expect(element.querySelector(".address-confirmation-status")).toBeNull();
    const retry = app.confirmAddress();
    incoming({ direction: "incoming", message: "<r LOCOID 3>" });
    await retry;
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      "Address mismatch",
    );
  });

  it("disables programming controls until connected and preserves entered values", async () => {
    const transport = {
      listPorts: vi.fn().mockResolvedValue([{ id: "test", label: "DCC-EX" }]),
      connect: vi.fn().mockResolvedValue({
        capabilities: { serviceModeRead: false, serviceModeWrite: false },
      }),
      disconnect: vi.fn(),
      readCv: vi.fn(),
      writeCv: vi.fn(),
    };
    TestBed.overrideProvider(DCC_TRANSPORT, { useValue: transport });
    window.localStorage.setItem("cabscribe.selectedSerialPort", "missing");
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const app = fixture.componentInstance;
    const element = fixture.nativeElement as HTMLElement;
    app.targetAddress.set("3");
    const editor = await showEditor(fixture);
    editor.cvAddress.set("29");
    editor.cvValue.set("77");
    const expectInputsDisabled = async (disabled: boolean) => {
      await vi.waitFor(() => {
        fixture.detectChanges();
        const inputs = element.querySelectorAll<HTMLInputElement>(
          ".operation-card input",
        );
        expect(inputs).toHaveLength(3);
        for (const input of inputs) {
          expect(input.disabled).toBe(disabled);
        }
        expect(
          element
            .querySelector(".cv-function-field mat-select")
            ?.getAttribute("aria-disabled"),
        ).toBe(String(disabled));
      });
    };
    await expectInputsDisabled(true);
    app.selectPort("test");
    await expectInputsDisabled(true);
    await app.connect();
    await expectInputsDisabled(false);
    for (const button of element.querySelectorAll<HTMLButtonElement>(
      ".operation-card button",
    )) {
      expect(button.disabled).toBe(true);
    }
    app.selectPort("");
    await app.session.disconnect();
    await expectInputsDisabled(true);
    expect(app.targetAddress()).toBe("3");
    expect(editor.cvAddress()).toBe("29");
    expect(editor.cvValue()).toBe("77");
    expect(
      element.querySelector<HTMLButtonElement>(".connection-settings-button")
        ?.disabled,
    ).toBe(false);
    expect(
      element.querySelector<HTMLButtonElement>(".debug-toggle-button")
        ?.disabled,
    ).toBe(false);
  });

  it("persists the selected serial port and restores it without reconnecting", async () => {
    const transport = {
      listPorts: vi
        .fn()
        .mockResolvedValue([{ id: "/dev/ttyUSB0", label: "DCC-EX" }]),
      connect: vi.fn().mockResolvedValue({
        capabilities: {
          serviceModeRead: false,
          serviceModeWrite: false,
        },
      }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      readCv: vi.fn(),
      writeCv: vi.fn(),
    };
    TestBed.overrideProvider(DCC_TRANSPORT, { useValue: transport });

    const firstFixture = TestBed.createComponent(App);
    await firstFixture.whenStable();
    firstFixture.componentInstance.selectPort("/dev/ttyUSB0");
    expect(window.localStorage.getItem("cabscribe.selectedSerialPort")).toBe(
      "/dev/ttyUSB0",
    );
    firstFixture.destroy();

    const secondFixture = TestBed.createComponent(App);
    await secondFixture.whenStable();

    expect(secondFixture.componentInstance.selectedPortId()).toBe(
      "/dev/ttyUSB0",
    );
    expect(secondFixture.componentInstance.isConnected()).toBe(false);
    expect(transport.connect).not.toHaveBeenCalled();
  });

  it("puts a successful read in the editable value used for the write review", async () => {
    const transport = {
      listPorts: vi
        .fn()
        .mockResolvedValue([{ id: "/dev/ttyUSB0", label: "DCC-EX" }]),
      connect: vi.fn().mockResolvedValue({
        capabilities: {
          serviceModeRead: true,
          serviceModeWrite: true,
        },
      }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      readCv: vi
        .fn()
        .mockResolvedValueOnce(42)
        .mockRejectedValueOnce(new Error("Read failed."))
        .mockResolvedValueOnce(77),
      writeCv: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.overrideProvider(DCC_TRANSPORT, { useValue: transport });

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.componentInstance.selectPort("/dev/ttyUSB0");
    const connectionDialog = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLDialogElement>("#connectionDialog");
    if (!connectionDialog) {
      throw new Error("Connection settings dialog was not rendered.");
    }
    Object.defineProperty(connectionDialog, "close", { value: vi.fn() });
    await fixture.componentInstance.connect();

    const editor = await showEditor(fixture);
    fixture.componentInstance.targetAddress.set("3");
    editor.cvAddress.set("29");
    await editor.read();
    expect(editor.cvValue()).toBe("42");
    expect(transport.readCv).toHaveBeenCalledWith(3, 29);

    editor.cvValue.set("99");
    await editor.read();
    expect(editor.cvValue()).toBe("");

    editor.cvValue.set("77");
    const writeDialog = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLDialogElement>(".write-dialog");
    if (!writeDialog) {
      throw new Error("Write confirmation dialog was not rendered.");
    }
    const showWriteDialog = vi.fn();
    const closeWriteDialog = vi.fn();
    Object.defineProperty(writeDialog, "showModal", {
      value: showWriteDialog,
    });
    Object.defineProperty(writeDialog, "close", {
      value: closeWriteDialog,
    });
    editor.requestWrite();

    expect(showWriteDialog).toHaveBeenCalledOnce();
    expect(editor.pendingWrite()).toEqual({
      address: 3,
      cv: 29,
      value: 77,
    });

    await editor.confirmWrite();
    expect(transport.writeCv).toHaveBeenCalledWith(3, 29, 77);
    expect(transport.readCv).toHaveBeenLastCalledWith(3, 29);
  });

  it("shows CV 8 manufacturer hints after reading and editing without changing the write value", async () => {
    const transport = {
      listPorts: vi.fn().mockResolvedValue([{ id: "test", label: "DCC-EX" }]),
      connect: vi.fn().mockResolvedValue({
        capabilities: { serviceModeRead: true, serviceModeWrite: true },
      }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      readCv: vi.fn().mockResolvedValue(101),
      writeCv: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.overrideProvider(DCC_TRANSPORT, { useValue: transport });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.componentInstance.selectPort("test");
    await fixture.componentInstance.connect();
    const editor = await showEditor(fixture);
    fixture.componentInstance.targetAddress.set("3");
    editor.cvAddress.set("8");
    await editor.read();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const hint = () => element.querySelector(".cv-fields mat-hint");
    const input = element.querySelector<HTMLInputElement>(
      'input[placeholder="Read or enter a value"]',
    );
    if (!input) {
      throw new Error("CV value input was not rendered.");
    }
    expect(hint()?.textContent?.trim()).toBe("101 = Bachmann Trains");
    expect(input.value).toBe("101");
    expect(input.disabled).toBe(false);
    expect(input.readOnly).toBe(false);

    input.value = "129";
    input.dispatchEvent(new Event("input"));
    await fixture.whenStable();
    expect(hint()?.textContent?.trim()).toBe("129 = Digitrax");
    editor.requestWrite();
    expect(editor.pendingWrite()).toEqual({ address: 3, cv: 8, value: 129 });
    editor.cancelWrite();

    input.value = "255";
    input.dispatchEvent(new Event("input"));
    await fixture.whenStable();
    expect(hint()?.textContent?.trim()).toBe("255 = Unknown manufacturer");
    expect(editor.canWrite()).toBe(true);

    input.value = "";
    input.dispatchEvent(new Event("input"));
    await fixture.whenStable();
    expect(hint()).toBeNull();

    editor.cvValue.set("101");
    editor.cvAddress.set("7");
    await fixture.whenStable();
    expect(hint()).toBeNull();
  });

  it("formats and clears incoming and outgoing serial data on the debug page", async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    await TestBed.inject(Router).navigateByUrl("/debug");
    fixture.componentInstance.session.serialLog.set([
      { direction: "outgoing", message: "<READ 29>" },
      { direction: "incoming", message: "<r 29|42>\r\n" },
    ]);
    fixture.detectChanges();

    const debugOutput = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLTextAreaElement>("#serial-debug-output");
    expect(debugOutput?.value).toBe("CS> <READ 29>\nDC< <r 29|42>");

    const clearButton = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLButtonElement>(".clear-debug-button");
    expect(clearButton?.disabled).toBe(false);
    const connectionBeforeClear =
      fixture.componentInstance.session.connection();
    clearButton?.click();
    fixture.detectChanges();
    expect(debugOutput?.value).toBe("");
    expect(fixture.componentInstance.session.serialLog()).toEqual([]);
    expect(fixture.componentInstance.session.connection()).toEqual(
      connectionBeforeClear,
    );
    expect(clearButton?.disabled).toBe(true);

    fixture.componentInstance.session.serialLog.set([
      { direction: "incoming", message: "<r LOCOID 3>" },
    ]);
    fixture.detectChanges();
    expect(debugOutput?.value).toBe("DC< <r LOCOID 3>");
    expect(clearButton?.disabled).toBe(false);

    expect(debugOutput?.readOnly).toBe(true);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(".debug-panel"),
    ).not.toBeNull();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(".address-card"),
    ).toBeNull();
  });

  it("shows a browser chooser and selects the authorized port without connecting", async () => {
    const port = { id: "web-serial:chosen", label: "Authorized port" };
    const transport = {
      listPorts: vi.fn().mockResolvedValue([]),
      requestPort: vi.fn().mockResolvedValue(port),
      connect: vi.fn(),
      disconnect: vi.fn(),
      readCv: vi.fn(),
      writeCv: vi.fn(),
    };
    TestBed.overrideProvider(DCC_TRANSPORT, { useValue: transport });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const chooseButton = [...element.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Choose device",
    );
    expect(chooseButton).toBeDefined();
    chooseButton?.click();
    await fixture.whenStable();
    expect(transport.requestPort).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.selectedPortId()).toBe(port.id);
    expect(fixture.componentInstance.canConnect()).toBe(true);
    expect(transport.connect).not.toHaveBeenCalled();
  });

  it("uses one address for function selection and manual CV entry", async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const app = await showEditor(fixture);
    app.cvValue.set("77");
    app.selectCvDefinition(29);
    expect(app.cvAddress()).toBe("29");
    expect(app.selectedCvDefinition()).toBe(29);
    expect(app.cvValue()).toBe("77");

    app.cvAddress.set("3");
    expect(app.selectedCvDefinition()).toBe(3);
    app.cvAddress.set("250");
    expect(app.selectedCvDefinition()).toBe(250);
    expect(app.isCustomCvAddress()).toBe(true);
    expect(app.cvAddress()).toBe("250");
    expect(app.selectedCvLabel()).toBe("CV 250 — Manual address");
    app.cvAddress.set("29");
    expect(app.isCustomCvAddress()).toBe(false);
    expect(app.selectedCvLabel()).toBe("CV 29 — Decoder configuration 1");
    app.selectCvDefinition(null);
    expect(app.cvAddress()).toBe("");
    expect(app.selectedCvDefinition()).toBeNull();
  });

  it("enables range reads when ready and displays the returned values", async () => {
    let finishFirst!: (value: number) => void;
    const transport = {
      listPorts: vi.fn().mockResolvedValue([{ id: "test", label: "DCC-EX" }]),
      connect: vi.fn().mockResolvedValue({
        capabilities: { serviceModeRead: true, serviceModeWrite: false },
      }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      readCv: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<number>((resolve) => {
              finishFirst = resolve;
            }),
        )
        .mockResolvedValueOnce(42),
      writeCv: vi.fn(),
    };
    TestBed.overrideProvider(DCC_TRANSPORT, { useValue: transport });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const app = fixture.componentInstance;
    await TestBed.inject(Router).navigateByUrl("/cv-table");
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const page = fixture.debugElement.query(By.directive(CvTablePage))
      .componentInstance as CvTablePage;
    const button = element.querySelector<HTMLButtonElement>(".scan-button")!;
    expect(button.disabled).toBe(true);
    expect(element.textContent).toContain(
      "Connect to a command station to read CVs.",
    );
    await app.session.connect("test");
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
    expect(element.textContent).toContain(
      "Enter a target address to read CVs.",
    );
    app.updateTargetAddress(3);
    page.lastCv.set("2");
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
    button.click();
    fixture.detectChanges();
    expect(transport.readCv).toHaveBeenCalledWith(3, 1);
    expect(button.textContent).toContain("Cancel");
    expect(
      element.querySelector<HTMLInputElement>(".first-cv-input")?.disabled,
    ).toBe(true);
    finishFirst(3);
    await vi.waitFor(() => expect(page.scan.scanning()).toBe(false));
    fixture.detectChanges();
    expect(transport.readCv.mock.calls).toEqual([
      [3, 1],
      [3, 2],
    ]);
    expect(page.scan.rows().map((row) => [row.cv, row.value])).toEqual([
      [1, 3],
      [2, 42],
    ]);
    expect(element.querySelectorAll('tr[data-status="value"]')).toHaveLength(2);
    expect(button.textContent).toContain("Read");
    page.firstCv.set("3");
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
    expect(element.textContent).toContain(
      "The first CV must not be greater than the last CV.",
    );
  });

  it("navigates between all five pages from the header without losing the serial session", async () => {
    const transport = {
      listPorts: vi.fn().mockResolvedValue([{ id: "test", label: "DCC-EX" }]),
      connect: vi.fn().mockResolvedValue({
        capabilities: { serviceModeRead: true, serviceModeWrite: false },
      }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      readCv: vi.fn(),
      writeCv: vi.fn(),
    };
    TestBed.overrideProvider(DCC_TRANSPORT, { useValue: transport });
    const fixture = TestBed.createComponent(App);
    await showEditor(fixture);
    const app = fixture.componentInstance;
    await app.session.connect("test");
    app.updateTargetAddress(3);
    const element = fixture.nativeElement as HTMLElement;
    const tableButton = element.querySelector<HTMLButtonElement>(
      ".table-toggle-button",
    );
    const editorButton = element.querySelector<HTMLButtonElement>(
      ".editor-toggle-button",
    );
    const debugButton = element.querySelector<HTMLButtonElement>(
      ".debug-toggle-button",
    );
    const configurationButton = element.querySelector<HTMLButtonElement>(
      'button[aria-label="Extended Configuration"]',
    );
    const operationsButton = element.querySelector<HTMLButtonElement>(
      'button[aria-label="Operations"]',
    );
    expect(editorButton?.getAttribute("aria-label")).toBe("Single CV editor");
    expect(editorButton?.getAttribute("aria-current")).toBe("page");
    expect(tableButton?.getAttribute("aria-label")).toBe("Read CV table");
    expect(tableButton?.getAttribute("aria-current")).toBeNull();
    tableButton?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector("app-cv-table-page")).not.toBeNull();
    expect(tableButton?.getAttribute("aria-current")).toBe("page");
    expect(element.querySelector(".scan-button")).not.toBeNull();
    for (const [button, routeComponent] of [
      [configurationButton, "app-configuration"],
      [operationsButton, "app-operations"],
    ] as const) {
      button?.click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(element.querySelector(routeComponent)).not.toBeNull();
      expect(element.querySelector(".address-card")).toBeNull();
      expect(element.querySelectorAll('header [aria-current="page"]')).toHaveLength(1);
      expect(button?.getAttribute("aria-current")).toBe("page");
      const tabLabels = Array.from(
        element.querySelectorAll(`${routeComponent} [role="tab"]`),
        (tab) => tab.textContent?.trim(),
      );
      if (routeComponent === "app-configuration") {
        expect(tabLabels).toEqual(["Power", "Turnouts", "Network", "Diagnostics"]);
      } else {
        expect(tabLabels).toEqual(expect.arrayContaining(["JMRI", "Turntables"]));
      }
    }
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const operationsTabs = await loader.getHarness(MatTabGroupHarness);
    await operationsTabs.selectTab({ label: "Turnouts" });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.querySelector("app-operations mat-select")).not.toBeNull();
    });
    const commandPicker = await loader.getHarness(MatSelectHarness.with({
      ancestor: "app-operations",
    }));
    await commandPicker.clickOptions({ text: "Query turnout details" });
    const turnoutId = element.querySelector<HTMLInputElement>("#command-field-id")!;
    expect(turnoutId.required).toBe(true);
    turnoutId.value = "17";
    turnoutId.dispatchEvent(new Event("input"));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector(".command-preview")?.textContent).toBe("<T 17 X>");
    expect(
      element.querySelector<HTMLButtonElement>('app-command-form button[type="button"]')?.disabled,
    ).toBe(true);
    debugButton?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector("app-debug-page")).not.toBeNull();
    expect(debugButton?.getAttribute("aria-current")).toBe("page");
    editorButton?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector("app-cv-table-page")).toBeNull();
    expect(element.querySelector("app-debug-page")).toBeNull();
    expect(element.querySelector("app-cv-editor-page")).not.toBeNull();
    expect(editorButton?.getAttribute("aria-current")).toBe("page");
    expect(tableButton?.getAttribute("aria-current")).toBeNull();
    expect(app.session.connection()).toMatchObject({
      status: "connected",
      port: { id: "test" },
    });
    expect(app.targetAddress()).toBe("3");
    expect(transport.connect).toHaveBeenCalledOnce();
    expect(transport.disconnect).not.toHaveBeenCalled();
  });

  it("reads the command-station version from Extended Configuration", async () => {
    let receive: ((message: SerialLogMessage) => void) | undefined;
    const transport = {
      listPorts: vi.fn().mockResolvedValue([{ id: "test", label: "DCC-EX" }]),
      connect: vi.fn().mockResolvedValue({
        capabilities: { serviceModeRead: true, serviceModeWrite: false, stationStatus: true },
      }),
      disconnect: vi.fn(),
      readCv: vi.fn(),
      writeCv: vi.fn(),
      sendRawCommand: vi.fn(),
      onSerialMessage: (listener: (message: SerialLogMessage) => void) => {
        receive = listener;
        return () => { receive = undefined; };
      },
      requestStationStatus: vi.fn(async () => {
        receive?.({
          direction: "incoming",
          message: "<iDCC-EX V-5.6.6 / MEGA / EX8874 G-master-202609231425Z><p0 A>",
        });
      }),
    };
    TestBed.overrideProvider(DCC_TRANSPORT, { useValue: transport });
    const fixture = TestBed.createComponent(App);
    const editor = await showEditor(fixture);
    await fixture.componentInstance.session.connect("test");
    fixture.componentInstance.updateTargetAddress(3);
    editor.selectCvDefinition(29);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const editorRead = element.querySelector<HTMLButtonElement>("app-cv-editor-page .read-button")!;
    expect(editorRead.disabled).toBe(false);
    const { backgroundColor, color } = getComputedStyle(editorRead);
    await TestBed.inject(Router).navigateByUrl("/configuration");
    const loader = TestbedHarnessEnvironment.loader(fixture);
    await (await loader.getHarness(MatTabGroupHarness)).selectTab({ label: "Diagnostics" });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.querySelector("app-configuration mat-select")).not.toBeNull();
    });
    const picker = await loader.getHarness(MatSelectHarness.with({ ancestor: "app-configuration" }));
    await picker.clickOptions({ text: "Query command-station version" });
    const read = element.querySelector<HTMLButtonElement>('app-command-form button[type="button"]')!;
    expect(read.textContent?.trim()).toBe("Read");
    expect(read.disabled).toBe(false);
    expect(read.classList.contains("read-button")).toBe(true);
    expect(getComputedStyle(read).backgroundColor).toBe(backgroundColor);
    expect(getComputedStyle(read).color).toBe(color);
    expect(transport.requestStationStatus).not.toHaveBeenCalled();
    read.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.querySelector('app-command-form [role="status"]')?.textContent)
        .toContain("Firmware 5.6.6");
    });
    expect(transport.requestStationStatus).toHaveBeenCalledExactlyOnceWith();
    expect(transport.sendRawCommand).not.toHaveBeenCalled();
  });

  it("shows the Wi-Fi network name and can reveal the password without exposing either in the preview", async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl("/configuration");
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const tabs = await loader.getHarness(MatTabGroupHarness);
    await tabs.selectTab({ label: "Network" });
    const element = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.querySelector("app-configuration mat-select")).not.toBeNull();
    });
    const picker = await loader.getHarness(MatSelectHarness.with({ ancestor: "app-configuration" }));
    await picker.clickOptions({ text: "Set Wi-Fi station credentials" });

    const network = element.querySelector<HTMLInputElement>("#command-field-ssid")!;
    const password = element.querySelector<HTMLInputElement>("#command-field-password")!;
    const toggle = element.querySelector<HTMLButtonElement>('button[aria-label="Show password"]')!;
    const passwordField = password.closest("mat-form-field");
    expect(passwordField?.querySelector(".mat-mdc-form-field-icon-suffix button")).toBe(toggle);
    expect(network.closest("mat-form-field")?.querySelector(".mat-mdc-form-field-icon-suffix")).toBeNull();
    const icon = toggle.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(toggle.textContent?.trim()).toBe("");
    expect(network.type).toBe("text");
    expect(password.type).toBe("password");
    for (const [field, value] of [[network, "Example network"], [password, "sample password"]] as const) {
      field.value = value;
      field.dispatchEvent(new Event("input"));
    }

    toggle.click();
    fixture.detectChanges();
    expect(password.type).toBe("text");
    expect(password.value).toBe("sample password");
    expect(toggle.getAttribute("aria-label")).toBe("Hide password");
    expect(toggle.querySelector("svg")).toBe(icon);
    const preview = element.querySelector(".command-preview")?.textContent;
    expect(preview).toContain("<C WIFI");
    expect(preview).not.toContain("Example network");
    expect(preview).not.toContain("sample password");

    toggle.click();
    fixture.detectChanges();
    expect(password.type).toBe("password");
    expect(password.value).toBe("sample password");

    toggle.click();
    await picker.clickOptions({ text: "Set network node group" });
    await picker.clickOptions({ text: "Set Wi-Fi station credentials" });
    expect(element.querySelector<HTMLInputElement>("#command-field-password")?.type).toBe("password");
  });
});
