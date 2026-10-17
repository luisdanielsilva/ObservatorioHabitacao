import { afterEach, describe, expect, it, vi } from "vitest";

const load = async (value: string | undefined) => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_BASE_PATH", value);
  return import("./basePath");
};

afterEach(() => vi.unstubAllEnvs());

describe("withBasePath", () => {
  it("leaves paths alone at the root", async () => {
    const { withBasePath } = await load(undefined);
    expect(withBasePath("/api/analyze")).toBe("/api/analyze");
    expect(withBasePath("/")).toBe("/");
  });

  it("prefixes paths under a base path", async () => {
    const { withBasePath } = await load("/observatorio-habitacao/");
    expect(withBasePath("/api/analyze")).toBe("/observatorio-habitacao/api/analyze");
    expect(withBasePath("/")).toBe("/observatorio-habitacao");
  });
});
