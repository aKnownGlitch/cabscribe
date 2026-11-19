import { describe, expect, it } from "vitest";
import { COMMAND_DEFINITIONS, getCommandsByCategory, ParameterType } from "./command-definitions";
import { previewCommand } from "./command-preview";

const readCv = COMMAND_DEFINITIONS["read-cv-service-mode"];
const example = {
  ...readCv,
  syntax: "<TEST {mode} {ratio} {enabled} {label} {suffix}>",
  parameters: [
    { id: "mode", type: ParameterType.Enumerated, choices: [{ value: "MAIN", label: "Main" }], required: true },
    { id: "ratio", type: ParameterType.Numeric, range: [0, 1] as [number, number], required: true },
    { id: "enabled", type: ParameterType.Boolean, required: true },
    { id: "label", type: ParameterType.String, required: false },
    { id: "suffix", type: ParameterType.String, required: false },
  ].map((parameter) => ({ ...parameter, label: parameter.id, description: "" })),
};
const values = { mode: "MAIN", ratio: "0.50", enabled: false };

describe("DCC command previews", () => {
  it.each([
    ["query-loco-capacity", {}, "<#>"],
    ["query-turnout-details", { id: "17" }, "<T 17 X>"],
    ["list-sensors-q-format", {}, "<S>"],
    ["list-sensors-uppercase-q-format", {}, "<Q>"],
    ["list-outputs", {}, "<Z>"],
    ["query-fast-clock", {}, "<J C>"],
    ["list-roster", {}, "<J R>"],
    ["query-roster-entry", { locoid: "42" }, "<J R 42>"],
    ["query-jmri-turnout", { id: "17" }, "<J T 17>"],
    ["query-jmri-turntable-positions", { id: "5" }, "<J P 5>"],
    ["list-turntables", {}, "<I>"],
    ["query-turntable", { id: "5" }, "<I 5>"],
    ["list-consists", {}, "<^>"],
  ] as const)("previews %s with exact protocol syntax", (id, fields, command) => {
    expect(previewCommand(COMMAND_DEFINITIONS[id], fields)).toEqual({ kind: "ready", command });
  });

  it("requires a whole turnout ID before previewing turnout details", () => {
    const definition = COMMAND_DEFINITIONS["query-turnout-details"];
    expect(previewCommand(definition, {})).toMatchObject({ kind: "invalid", errors: { id: "Required" } });
    expect(previewCommand(definition, { id: "17.5" })).toMatchObject({ kind: "invalid", errors: { id: "Enter a whole number" } });
  });

  it("keeps new operational queries off Configuration and shares the existing CV form", () => {
    const category = "Turnouts, sensors, and outputs";
    expect(getCommandsByCategory(category, "operations").map(({ id }) => id))
      .toContain("query-turnout-details");
    expect(getCommandsByCategory(category, "configuration").map(({ id }) => id))
      .not.toContain("query-turnout-details");
    expect(getCommandsByCategory("DCC accessory and programming commands", "operations")).toContain(readCv);
    expect(getCommandsByCategory("Track power and track configuration", "configuration")).toContain(readCv);
  });

  it("serializes literal commands and both valid CV bounds exactly", () => {
    expect(previewCommand(COMMAND_DEFINITIONS["status-query"], {})).toEqual({ kind: "ready", command: "<s>" });
    for (const cv of [1, 1024]) {
      expect(previewCommand(readCv, { cv })).toEqual({ kind: "ready", command: `<R ${cv}>` });
    }
  });

  it.each([undefined, "", " 4", "4\n", "1e2", "0x10", "4.5", true, 0, 1025, NaN, Infinity])(
    "rejects invalid CV input %s",
    (cv) => expect(previewCommand(readCv, { cv })).toMatchObject({
      kind: "invalid", errors: { cv: expect.any(String) },
    }),
  );

  it("preserves quoted spaces and decimal spelling, and omits trailing optional tokens", () => {
    expect(previewCommand(example, { ...values, label: "Yard engine" })).toEqual({
      kind: "ready", command: '<TEST MAIN 0.50 0 "Yard engine">',
    });
    expect(previewCommand(example, values)).toEqual({
      kind: "ready", command: "<TEST MAIN 0.50 0>",
    });
  });

  it("reports invalid keywords, numbers, booleans, strings, and skipped positional arguments", () => {
    expect(previewCommand(example, { mode: "main", ratio: "1.5", enabled: "false", label: 'a" >' }))
      .toMatchObject({ kind: "invalid", errors: {
        mode: expect.any(String), ratio: expect.any(String), enabled: expect.any(String), label: expect.any(String),
      } });
    expect(previewCommand(example, { ...values, suffix: "second" }))
      .toMatchObject({ kind: "invalid", errors: { suffix: expect.any(String) } });
  });

  it("rejects malformed catalog templates instead of previewing unresolved tokens", () => {
    expect(previewCommand({ ...readCv, syntax: "<R {other}>" }, { cv: 4 }))
      .toMatchObject({ kind: "unsupported" });
  });

  it("redacts both Wi-Fi credentials without returning a sendable command", () => {
    const wifi = COMMAND_DEFINITIONS["set-wifi-station"];
    expect(previewCommand(wifi, { ssid: "Sample Network", password: "example password" }))
      .toEqual({ kind: "redacted", display: '<C WIFI "[redacted]" "[redacted]">' });
    expect(previewCommand(wifi, { ssid: "Sample Network", password: 'bad"argument' }))
      .toMatchObject({ kind: "invalid", errors: { password: expect.any(String) } });
  });

  it("formats raw packets without coercing bytes or filling skipped positions", () => {
    const packet = COMMAND_DEFINITIONS["raw-packet-main"];
    expect(previewCommand(packet, { d0: "0", d1: "255" }))
      .toEqual({ kind: "ready", command: "<M 0 0 255>" });
    expect(previewCommand(packet, { d0: "256", d1: "12", d3: "1" }))
      .toMatchObject({ kind: "invalid", errors: { d0: expect.any(String), d3: expect.any(String) } });
  });

  it("rejects network group IDs outside the documented bounds", () => {
    const group = COMMAND_DEFINITIONS["set-node-group"];
    expect(previewCommand(group, { group: "254" }))
      .toEqual({ kind: "ready", command: "<C NODEGROUP 254>" });
    for (const value of ["0", "255"]) {
      expect(previewCommand(group, { group: value })).toMatchObject({ kind: "invalid" });
    }
  });
});
