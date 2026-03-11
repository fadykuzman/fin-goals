import { describe, it, expect } from "vitest";
import { getAccessToken, client } from "../../services/gocardless";

describe("Banks endpoint - contract test", () => {
  it("should return institutions for a valid country code", async () => {
    await getAccessToken();
    const institutions = await client.institution.getInstitutions({
      country: "GB",
    });

    expect(Array.isArray(institutions)).toBe(true);
    expect(institutions.length).toBeGreaterThan(0);

    const first = institutions[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("logo");
  });

  it("should return ING DiBa for Germany", async () => {
    await getAccessToken();
    const institutions = await client.institution.getInstitutions({
      country: "DE",
    });

    const ing = institutions.find(
      (inst: { name: string }) => inst.name.toLowerCase().includes("ing")
    );

    expect(ing).toBeDefined();
    expect(ing.name).toMatch(/ing/i);
  });
});
