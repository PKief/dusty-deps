import { describe, it, expect } from "vitest";
import { formatAge, formatDate } from "../../src/core/format.js";

describe("formatAge", () => {
  it("formats days for small values", () => {
    expect(formatAge(0)).toBe("0 days");
    expect(formatAge(1)).toBe("1 days");
    expect(formatAge(29)).toBe("29 days");
  });

  it("formats months for values >= 30.44 days", () => {
    expect(formatAge(31)).toBe("1.0 months");
    expect(formatAge(91)).toBe("3.0 months");
    expect(formatAge(364)).toBe("12.0 months");
  });

  it("formats years for values >= 365.25 days", () => {
    expect(formatAge(366)).toBe("1.0 years");
    expect(formatAge(730)).toBe("2.0 years");
    expect(formatAge(1095)).toBe("3.0 years");
    expect(formatAge(1826)).toBe("5.0 years");
  });
});

describe("formatDate", () => {
  it("formats date as YYYY-MM-DD", () => {
    expect(formatDate(new Date("2024-06-15T10:30:00Z"))).toBe("2024-06-15");
  });

  it("handles start of year", () => {
    expect(formatDate(new Date("2025-01-01T00:00:00Z"))).toBe("2025-01-01");
  });
});
