import { beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/http/errors";
const mocks = vi.hoisted(() => ({ rpc:vi.fn(),limit:vi.fn() }));
vi.mock("@/lib/supabase/admin",() => ({ createAdminClient:() => ({ rpc:mocks.rpc }) }));
vi.mock("@/lib/services/rate-limit.service",() => ({ rateLimit:mocks.limit }));
import { verifyPass } from "@/lib/services/verification.service";
beforeEach(() => { vi.resetAllMocks(); mocks.limit.mockResolvedValue(undefined); });
it("fails closed with 503 when storage or rate limiting is unavailable",async () => {
  mocks.rpc.mockResolvedValue({ error:{ message:"private database detail" } });
  await expect(verifyPass("a".repeat(43))).rejects.toMatchObject({ status:503,code:"UNAVAILABLE" });
  mocks.limit.mockRejectedValue(new Error("offline"));
  await expect(verifyPass("a".repeat(43))).rejects.toMatchObject({ status:503 });
});
it("keeps rate limiting distinct from not found",async () => {
  mocks.limit.mockRejectedValue(new ApiError("RATE_LIMITED","Too many requests."));
  await expect(verifyPass("a".repeat(43))).rejects.toMatchObject({ status:429 });
  expect(await verifyPass("bad")).toEqual({ valid:false,status:"not_found" });
  expect(mocks.rpc).not.toHaveBeenCalled();
});
