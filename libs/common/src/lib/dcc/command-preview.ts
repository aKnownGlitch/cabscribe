import { CommandDefinition, CommandParameter, ParameterType } from "./command-definitions";

export type CommandParameterValue = string | number | boolean | undefined;
export type CommandParameterValues = Readonly<Record<string, CommandParameterValue>>;

type CommandPreview =
  | { kind: "ready"; command: string }
  | { kind: "redacted"; display: string }
  | { kind: "invalid"; errors: Readonly<Record<string, string>> }
  | { kind: "unsupported"; reason: string };

export function previewCommand(
  definition: CommandDefinition,
  values: CommandParameterValues,
): CommandPreview {
  const { syntax, parameters } = definition;
  if (!/^<[^<>\s]+(?: [^<>\s]+)*>$/.test(syntax)) {
    return { kind: "unsupported", reason: "Invalid command template." };
  }

  const errors: Record<string, string> = {};
  const tokens: string[] = [];
  const seen = new Set<string>();
  let omitted = false;
  let redacted = false;
  for (const token of syntax.slice(1, -1).split(" ")) {
    const placeholder = /^\{([a-zA-Z][\w-]*)\}$/.exec(token);
    if (!placeholder) {
      if (/[{}]/.test(token) || omitted) {
        return { kind: "unsupported", reason: "Invalid command template." };
      }
      tokens.push(token);
      continue;
    }

    const id = placeholder[1];
    const parameter = parameters.find((candidate) => candidate.id === id);
    if (!parameter || seen.has(id)) {
      return { kind: "unsupported", reason: "Invalid command template." };
    }
    seen.add(id);
    const value = Object.prototype.hasOwnProperty.call(values, id) ? values[id] : undefined;
    if (value === undefined || value === "") {
      if (parameter.required) {
        errors[id] = "Required";
      } else {
        omitted = true;
      }
      continue;
    }

    const error = validateParameter(parameter, value);
    if (error || omitted) {
      errors[id] = error || "Fill in the preceding optional field first";
    } else if (parameter.sensitive) {
      redacted = true;
      tokens.push('"[redacted]"');
    } else {
      tokens.push(parameter.type === ParameterType.String
        ? `"${value}"`
        : typeof value === "boolean" ? (value ? "1" : "0") : String(value));
    }
  }
  if (seen.size !== parameters.length ||
      Object.keys(values).some((id) => !seen.has(id))) {
    return { kind: "unsupported", reason: "Unexpected command parameter." };
  }
  return Object.keys(errors).length
    ? { kind: "invalid", errors }
    : redacted
      ? { kind: "redacted", display: `<${tokens.join(" ")}>` }
      : { kind: "ready", command: `<${tokens.join(" ")}>` };
}

function validateParameter(
  parameter: CommandParameter,
  value: Exclude<CommandParameterValue, undefined>,
): string | undefined {
  switch (parameter.type) {
    case ParameterType.Integer:
    case ParameterType.Numeric: {
      const integer = parameter.type === ParameterType.Integer;
      const pattern = integer ? /^-?\d+$/ : /^-?\d+(?:\.\d+)?$/;
      const numeric = typeof value === "number" || typeof value === "string"
        ? Number(value)
        : NaN;
      if (!pattern.test(String(value)) || /\s/.test(String(value)) ||
          !Number.isFinite(numeric) || (integer && !Number.isSafeInteger(numeric))) {
        return integer ? "Enter a whole number" : "Enter a decimal number";
      }
      const [min, max] = parameter.range ?? [-Infinity, Infinity];
      return numeric < min || numeric > max ? `Enter a value from ${min} to ${max}` : undefined;
    }
    case ParameterType.Enumerated:
      return /^[A-Za-z0-9_+-]+$/.test(String(value)) && !/\s/.test(String(value)) &&
        parameter.choices?.some((choice) => choice.value === value)
        ? undefined : "Select an available option";
    case ParameterType.Boolean:
      return typeof value === "boolean" ? undefined : "Select On or Off";
    case ParameterType.String:
      if (typeof value !== "string" || !value.trim() ||
          [...value].some((char) => char < " " || char > "~" || '"<>\\'.includes(char))) {
        return "Use printable ASCII text without quotes, backslashes, or angle brackets";
      }
      if (parameter.maxLength !== undefined && value.length > parameter.maxLength) {
        return `Use ${parameter.maxLength} characters or fewer`;
      }
      return parameter.pattern && !new RegExp(`^(?:${parameter.pattern})$`).test(value)
        ? "Invalid format" : undefined;
  }
}
