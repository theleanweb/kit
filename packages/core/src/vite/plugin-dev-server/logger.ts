import * as LogLevel from "effect/LogLevel";
import * as Logger from "effect/Logger";
import * as Cause from "effect/Cause";
import * as List from "effect/List";
import * as HashMap from "effect/HashMap";

import colors from "kleur";

const logLevelColors = {
  [LogLevel.Error._tag]: colors.red,
  [LogLevel.Info._tag]: colors.gray,
  [LogLevel.Fatal._tag]: colors.red,
  [LogLevel.Debug._tag]: colors.yellow,
  [LogLevel.Warning._tag]: colors.yellow,
};

export const PrettyLogger = Logger.make(
  ({ logLevel, message, date, annotations, cause, spans }) => {
    const nowMillis = date.getTime();

    let output = `${colors.gray(`[${date.toISOString()}]`)}`;

    if (cause != null && cause._tag !== "Empty") {
      output = output + " " + Cause.pretty(cause);
    }

    if (List.isCons(spans)) {
      output = output + " ";

      let first = true;

      for (const span of spans) {
        if (first) {
          first = false;
        } else {
          output = output + " ";
        }

        const label = span.label.replace(/[\s="]/g, "_");
        output = output + `[${label}:${nowMillis - span.startTime}ms]`;
      }
    }

    if (HashMap.size(annotations) > 0) {
      output = output + " ";

      let first = true;

      for (const [key, value] of annotations) {
        if (first) {
          first = false;
        } else {
          output = output + " ";
        }

        // output = output + filterKeyName(key);
        output = output + `[${key}:${value}]`;
      }
    }

    const color = logLevelColors[logLevel._tag];

    console.log(`${output} ${color(`[${logLevel.label}]`)} ${message}`);
  }
);
