import { test, expect } from "bun:test";
import { initializeApp } from "./express";

test("GET /ping returns pong", async () => {
  initializeApp();

  const response = await fetch("http://localhost:3000/ping");
  expect(response.status).toBe(200);
  const text = await response.text();
  expect(text).toBe("pong");
});
