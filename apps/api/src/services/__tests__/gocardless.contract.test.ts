import { describe, it, expect } from "vitest";
import { getAccessToken, client } from "../gocardless";

describe("GoCardless contract test", () => {
  it("should retrieve an access token from the sandbox", async () => {
    const token = await getAccessToken();

    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("should inject the token into the client", async () => {
    await getAccessToken();

    expect(client.token).toBeDefined();
  });
});
