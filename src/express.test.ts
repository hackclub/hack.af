import { beforeAll, expect, mock, test } from "bun:test";

mock.module("./db", () => ({
  client: { query: async () => ({ rows: [] }) },
}));

beforeAll(async () => {
  const { initializeApp } = await import("./express");
  initializeApp();
});

const get = (path: string) => fetch(`http://localhost:3000${path}`, { redirect: "manual" });

test("GET /ping returns pong", async () => {
  const response = await get("/ping");
  expect(response.status).toBe(200);
  const text = await response.text();
  expect(text).toBe("pong");
});
