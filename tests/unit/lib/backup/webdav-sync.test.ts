import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  uploadWebDavBackup,
  testWebDavConnection,
} from "@/lib/backup/webdav-sync";

describe("webdav-sync", () => {
  const mockCredentials = {
    serverUrl: "https://dav.example.com",
    username: "testuser",
    password: "testpass",
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  describe("testWebDavConnection", () => {
    it("returns success for valid credentials", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await testWebDavConnection(mockCredentials);
      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/webdav/",
        expect.objectContaining({
          method: "OPTIONS",
          headers: expect.objectContaining({
            "X-WebDAV-URL": mockCredentials.serverUrl,
          }),
        }),
      );
    });

    it("returns error for invalid credentials", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await testWebDavConnection(mockCredentials);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid username or password");
    });
  });

  describe("uploadWebDavBackup", () => {
    it("uploads JSON to the correct path", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
      });

      await uploadWebDavBackup(mockCredentials, '{"test": true}');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/webdav/kanso-backup.json"),
        expect.objectContaining({
          method: "PUT",
          body: '{"test": true}',
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-WebDAV-URL": mockCredentials.serverUrl,
          }),
        }),
      );
    });
  });
});
