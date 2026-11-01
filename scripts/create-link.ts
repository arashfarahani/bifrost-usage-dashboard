import { parseArgs } from "node:util";
import { getEnv } from "../src/config/env";
import { keyIdSchema, sealAccess } from "../src/lib/auth/tokens";
import { getVirtualKey } from "../src/lib/bifrost/governance";
import { AppError, safeError } from "../src/lib/errors";
try {
  const { values } = parseArgs({
    options: {
      name: { type: "string" },
      "virtual-key-id": { type: "string" },
      "expires-in": { type: "string", default: "30d" },
      help: { type: "boolean" },
    },
    strict: true,
  });
  if (values.help) {
    console.log(
      'pnpm link:create --name "Alex" --virtual-key-id "vk-example-id" --expires-in 30d (also: 1y, never)',
    );
  } else {
    const id = keyIdSchema.safeParse(values["virtual-key-id"]);
    const permanent = values["expires-in"] === "never";
    const duration = /^(\d+)(m|h|d|y)$/.exec(values["expires-in"]!);
    if (!id.success || !values.name?.trim() || (!duration && !permanent))
      throw new AppError("INVALID_INPUT");
    const seconds = permanent
      ? null
      : Number(duration![1]) *
        { m: 60, h: 3600, d: 86400, y: 365 * 86400 }[duration![2]]!;
    if (seconds !== null && (seconds < 1 || seconds > 365 * 86400))
      throw new AppError("INVALID_INPUT");
    await getVirtualKey(id.data);
    const token = await sealAccess(
      { displayName: values.name, virtualKeyId: id.data },
      seconds,
    );
    const url = new URL("/access", getEnv().APP_BASE_URL);
    url.hash = new URLSearchParams({ token }).toString();
    console.log(url.toString());
  }
} catch (error) {
  console.error(safeError(error).message);
  process.exitCode = 1;
}
