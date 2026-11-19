import "server-only";
import { headers } from "next/headers";
import { getServerEnv } from "@/lib/config/server";
import { assertMutationOrigin } from "@/lib/http/request";

export async function assertActionOrigin() {
  assertMutationOrigin(new Request(getServerEnv().APP_URL, { method: "POST", headers: await headers() }));
}
