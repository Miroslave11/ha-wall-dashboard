import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuth = vi.fn();
const createConnection = vi.fn();

vi.mock("home-assistant-js-websocket", () => ({
  getAuth: (...args: unknown[]) => getAuth(...args),
  createConnection: (...args: unknown[]) => createConnection(...args),
  createLongLivedTokenAuth: vi.fn(),
  subscribeEntities: vi.fn(),
  callService: vi.fn(),
  ERR_HASS_HOST_REQUIRED: "ERR_HASS_HOST_REQUIRED",
  ERR_INVALID_AUTH: "ERR_INVALID_AUTH",
}));

import { clearStoredTokens, connectHass } from "./realClient";

const cfg = { url: "http://ha.local:8123", auth: "oauth" as const };

function fakeConnection() {
  return { addEventListener: vi.fn(), connected: true, close: vi.fn() };
}

describe("connectHass – souběžné přihlášení", () => {
  beforeEach(() => {
    clearStoredTokens();
    getAuth.mockReset();
    createConnection.mockReset();
    createConnection.mockImplementation(() => Promise.resolve(fakeConnection()));
  });

  it("výměnu kódu za token provede jen jednou, i když se connectHass zavolá dvakrát (StrictMode)", async () => {
    getAuth.mockResolvedValue({ accessToken: "t" });
    await Promise.all([connectHass(cfg), connectHass(cfg)]);
    expect(getAuth).toHaveBeenCalledTimes(1);
    expect(createConnection).toHaveBeenCalledTimes(2);
  });

  it("po chybě přihlášení jde zkusit znovu", async () => {
    getAuth.mockRejectedValueOnce(new Error("síť"));
    await expect(connectHass(cfg)).rejects.toThrow("síť");
    getAuth.mockResolvedValue({ accessToken: "t" });
    await connectHass(cfg);
    expect(getAuth).toHaveBeenCalledTimes(2);
  });

  it("po smazání tokenů (odhlášení, změna adresy) se přihlašuje znovu", async () => {
    getAuth.mockResolvedValue({ accessToken: "t" });
    await connectHass(cfg);
    clearStoredTokens();
    await connectHass(cfg);
    expect(getAuth).toHaveBeenCalledTimes(2);
  });
});
