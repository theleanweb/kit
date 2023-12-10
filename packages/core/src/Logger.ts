import * as LogLevel from "effect/LogLevel";
import * as Logger from "effect/Logger";

import colors from "kleur";

const logLevelColors = {
  [LogLevel.Error._tag]: colors.red,
  [LogLevel.Info._tag]: colors.gray,
  [LogLevel.Fatal._tag]: colors.red,
  [LogLevel.Debug._tag]: colors.yellow,
  [LogLevel.Warning._tag]: colors.yellow,
};

const SimpleLogger = Logger.make(({ logLevel, message, date, annotations }) => {
  const color = logLevelColors[logLevel._tag];
  console.log(
    `${colors.gray(`[${date.toISOString()}]`)} ${color(
      `[${logLevel.label}]`
    )} ${message}`
  );
});

export { SimpleLogger as Logger };
