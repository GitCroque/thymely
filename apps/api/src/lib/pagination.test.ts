import { describe, it, expect } from "vitest";
import { parsePagination } from "./pagination";

describe("parsePagination", () => {
  it("returns defaults for empty query", () => {
    const result = parsePagination({});
    expect(result).toEqual({ skip: 0, take: 50, page: 1, limit: 50 });
  });

  it("parses valid page and limit", () => {
    const result = parsePagination({ page: "3", limit: "20" });
    expect(result).toEqual({ skip: 40, take: 20, page: 3, limit: 20 });
  });

  it("clamps limit to max 100", () => {
    const result = parsePagination({ limit: "999" });
    expect(result.take).toBe(100);
    expect(result.limit).toBe(100);
  });

  it("clamps limit to min 1", () => {
    const result = parsePagination({ limit: "0" });
    expect(result.take).toBe(1);
  });

  it("clamps limit for negative values", () => {
    const result = parsePagination({ limit: "-5" });
    expect(result.take).toBe(1);
  });

  it("clamps page to min 1", () => {
    const result = parsePagination({ page: "0" });
    expect(result.page).toBe(1);
    expect(result.skip).toBe(0);
  });

  it("clamps page for negative values", () => {
    const result = parsePagination({ page: "-3" });
    expect(result.page).toBe(1);
  });

  it("handles non-numeric strings", () => {
    const result = parsePagination({ page: "abc", limit: "xyz" });
    expect(result).toEqual({ skip: 0, take: 50, page: 1, limit: 50 });
  });

  it("handles page 2 with custom limit", () => {
    const result = parsePagination({ page: "2", limit: "10" });
    expect(result.skip).toBe(10);
  });
});
