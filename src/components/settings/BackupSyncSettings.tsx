"use client";

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Upload,
  Server,
  Check,
  X,
  Loader2,
  HardDrive,
  Cloud,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useHaptic } from "@/lib/hooks/useHaptic";
import {
  createBackupZip,
  parseBackupZip,
  downloadBackup,
} from "@/lib/backup/export-import";
import {
  testWebDavConnection,
  uploadWebDavBackup,
  downloadWebDavBackup,
  type WebDAVCredentials,
} from "@/lib/backup/webdav-sync";
import { mockStore } from "@/lib/mock/mock-store";
import type { BackupData } from "@/lib/backup/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/components/AuthProvider";
import { useAccountData } from "@/lib/hooks/useAccountData";
import { ImportDialog } from "./ImportDialog";

const WEBDAV_STORAGE_KEY = "kanso_webdav_credentials";

export function BackupSyncSettings() {
  const { trigger } = useHaptic();
  const { isGuestMode } = useAuth();
  const { exportData, importData } = useAccountData();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export/Import state
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showExternalImport, setShowExternalImport] = useState(false);

  // WebDAV state
  const [webdavCredentials, setWebdavCredentials] = useState<WebDAVCredentials>(
    () => {
      if (typeof window === "undefined")
        return { serverUrl: "", username: "", password: "" };
      const stored = localStorage.getItem(WEBDAV_STORAGE_KEY);
      return stored
        ? JSON.parse(stored)
        : { serverUrl: "", username: "", password: "" };
    },
  );
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [isSyncing, setIsSyncing] = useState(false);

  const invalidateGuestDataQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["task"] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["project"] }),
      queryClient.invalidateQueries({ queryKey: ["habits"] }),
      queryClient.invalidateQueries({ queryKey: ["habit"] }),
      queryClient.invalidateQueries({ queryKey: ["subtasks"] }),
      queryClient.invalidateQueries({ queryKey: ["inbox-project"] }),
      queryClient.invalidateQueries({ queryKey: ["stats-dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["heatmap-data"] }),
    ]);
  };

  // --- Export/Import Functions ---

  const handleExport = async () => {
    trigger("toggle");

    if (!isGuestMode) {
      await exportData();
      return;
    }

    setIsExporting(true);
    try {
      const backupData: BackupData = {
        metadata: {
          version: 1,
          appVersion: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
          exportedAt: new Date().toISOString(),
        },
        tasks: mockStore.getTasks(),
        projects: mockStore.getProjects(),
        habits: mockStore.getHabits(),
        habit_entries: mockStore.getHabitEntries(),
        focus_logs: mockStore.getFocusLogs(),
        events: mockStore.getEvents(),
      };

      const blob = await createBackupZip(backupData);
      downloadBackup(blob);

      // Update last backup date for weekly prompt
      localStorage.setItem("kanso_last_backup_date", new Date().toISOString());

      toast.success("Backup downloaded successfully");
      trigger("success");
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Failed to create backup");
      trigger("thud");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    trigger("toggle");
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isGuestMode) {
      await importData(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setIsImporting(true);
    trigger("toggle");
    const loadingToastId = toast.loading(`Importing ${file.name}...`);

    try {
      const backupData = await parseBackupZip(file);

      // Replace the guest snapshot in one write so large restores do not
      // repeatedly stringify an ever-growing payload.
      mockStore.restoreBackup(backupData);

      // Mark guest-data queries stale so all visible screens refresh from the
      // updated local snapshot without a full page reload.
      await invalidateGuestDataQueries();

      toast.success(
        `Restored ${backupData.tasks.length} tasks, ${backupData.projects.length} projects`,
        {
          id: loadingToastId,
        },
      );
      trigger("success");
    } catch (err) {
      console.error("Import failed:", err);
      toast.error("Failed to import backup", { id: loadingToastId });
      trigger("thud");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // --- WebDAV Functions ---

  const saveCredentials = (creds: WebDAVCredentials) => {
    setWebdavCredentials(creds);
    if (typeof window !== "undefined") {
      localStorage.setItem(WEBDAV_STORAGE_KEY, JSON.stringify(creds));
    }
  };

  const clearCredentials = () => {
    trigger("toggle");
    if (typeof window !== "undefined") {
      localStorage.removeItem(WEBDAV_STORAGE_KEY);
      setWebdavCredentials({ serverUrl: "", username: "", password: "" });
      setConnectionStatus("idle");
      toast.success("Credentials cleared");
    }
  };

  const handleTestConnection = async () => {
    if (
      !webdavCredentials.serverUrl ||
      !webdavCredentials.username ||
      !webdavCredentials.password
    ) {
      toast.error("Please fill in all WebDAV fields");
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus("idle");
    trigger("toggle");

    try {
      const result = await testWebDavConnection(webdavCredentials);

      if (result.success) {
        setConnectionStatus("success");
        saveCredentials(webdavCredentials);
        toast.success("Connected successfully");
        trigger("success");
      } else {
        setConnectionStatus("error");
        toast.error(result.error || "Connection failed");
        trigger("thud");
      }
    } catch {
      setConnectionStatus("error");
      toast.error("Connection test failed");
      trigger("thud");
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSyncUpload = async () => {
    if (!webdavCredentials.serverUrl) {
      toast.error("Configure WebDAV settings first");
      return;
    }

    setIsSyncing(true);
    trigger("toggle");

    try {
      const backupData: BackupData = {
        metadata: {
          version: 1,
          appVersion: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
          exportedAt: new Date().toISOString(),
        },
        tasks: mockStore.getTasks(),
        projects: mockStore.getProjects(),
        habits: mockStore.getHabits(),
        habit_entries: mockStore.getHabitEntries(),
        focus_logs: mockStore.getFocusLogs(),
        events: mockStore.getEvents(),
      };

      const result = await uploadWebDavBackup(
        webdavCredentials,
        JSON.stringify(backupData, null, 2),
      );

      if (result.success) {
        localStorage.setItem(
          "kanso_last_backup_date",
          new Date().toISOString(),
        );
        toast.success("Data synced to server");
        trigger("success");
      } else {
        toast.error(result.error || "Sync failed");
        trigger("thud");
      }
    } catch {
      toast.error("Sync failed");
      trigger("thud");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncDownload = async () => {
    if (!webdavCredentials.serverUrl) {
      toast.error("Configure WebDAV settings first");
      return;
    }

    setIsSyncing(true);
    trigger("toggle");

    try {
      const result = await downloadWebDavBackup(webdavCredentials);

      if (result.success && result.data) {
        // Apply the downloaded snapshot atomically.
        mockStore.restoreBackup(result.data);

        await invalidateGuestDataQueries();

        toast.success("Data restored from server");
        trigger("success");
      } else {
        toast.error(result.error || "Download failed");
        trigger("thud");
      }
    } catch {
      toast.error("Download failed");
      trigger("thud");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Import backup file"
      />

      <Tabs defaultValue="local" className="space-y-4">
        <TabsList className="grid grid-cols-2 bg-secondary/10 p-1 rounded-lg h-11 border border-border/40 shadow-none">
          <TabsTrigger
            value="local"
            onClick={() => trigger("toggle")}
            className="rounded-md gap-2 text-[13px] font-medium tracking-tight data-[state=active]:bg-brand data-[state=active]:text-brand-foreground data-[state=active]:shadow-none transition-all h-9 border border-transparent data-[state=active]:border-brand/20"
          >
            <HardDrive className="h-3.5 w-3.5" />
            Local Storage
          </TabsTrigger>
          <TabsTrigger
            value="cloud"
            onClick={() => trigger("toggle")}
            className="rounded-md gap-2 text-[13px] font-medium tracking-tight data-[state=active]:bg-brand data-[state=active]:text-brand-foreground data-[state=active]:shadow-none transition-all h-9 border border-transparent data-[state=active]:border-brand/20"
          >
            <Cloud className="h-3.5 w-3.5" />
            Cloud Sync
          </TabsTrigger>
        </TabsList>

        <TabsContent value="local" className="mt-0 outline-none">
          {/* Local Backup Section */}
          <Card className="border-border/50 shadow-none bg-background/50">
            <CardHeader className="pb-3 px-4 pt-5">
              <CardTitle className="flex items-center gap-2 text-base font-medium tracking-tight">
                <HardDrive className="h-4 w-4 text-brand" strokeWidth={2.25} />
                Local Backup
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground/80 lowercase">
                Export your {isGuestMode ? "local" : "cloud"} data to a ZIP file
                or restore from a backup.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3 px-4 pb-5 pt-0">
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={isExporting}
                className="flex-1 gap-2 h-10 border-border/60 hover:bg-secondary/40 transition-all font-medium"
              >
                {isExporting ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    strokeWidth={2.25}
                  />
                ) : (
                  <Download className="h-4 w-4" strokeWidth={2.25} />
                )}
                Export
              </Button>
              <Button
                variant="outline"
                onClick={handleImportClick}
                disabled={isImporting}
                className="flex-1 gap-2 h-10 border-border/60 hover:bg-secondary/40 transition-all font-medium"
              >
                {isImporting ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    strokeWidth={2.25}
                  />
                ) : (
                  <Upload className="h-4 w-4" strokeWidth={2.25} />
                )}
                Import
              </Button>
            </CardContent>
            <Separator className="bg-border/20 mx-4" />
            <div className="px-4 pb-4 pt-4">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground hover:text-brand transition-colors h-8"
                onClick={() => {
                  trigger("toggle");
                  setShowExternalImport(true);
                }}
              >
                Import from other apps
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="cloud" className="mt-0 outline-none">
          {/* WebDAV Sync Section */}
          <Card className="border-border/50 shadow-none bg-background/50">
            <CardHeader className="pb-3 px-4 pt-5">
              <CardTitle className="flex items-center gap-2 text-base font-medium tracking-tight">
                <Cloud className="h-4 w-4 text-brand" strokeWidth={2.25} />
                WebDAV Sync
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground/80 lowercase">
                Sync across devices using your own cloud server.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 px-4 pb-5 pt-0">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="webdav-url"
                    className="text-[11px] uppercase tracking-wider text-muted-foreground/60"
                  >
                    Server URL
                  </Label>
                  <Input
                    id="webdav-url"
                    placeholder="https://cloud.example.com/remote.php/dav/files/..."
                    value={webdavCredentials.serverUrl}
                    onChange={(e) =>
                      setWebdavCredentials((prev) => ({
                        ...prev,
                        serverUrl: e.target.value,
                      }))
                    }
                    className="h-10 bg-background/30 border-border/40 focus:border-brand/50 focus:ring-0 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="webdav-user"
                      className="text-[11px] uppercase tracking-wider text-muted-foreground/60"
                    >
                      Username
                    </Label>
                    <Input
                      id="webdav-user"
                      placeholder="name"
                      value={webdavCredentials.username}
                      onChange={(e) =>
                        setWebdavCredentials((prev) => ({
                          ...prev,
                          username: e.target.value,
                        }))
                      }
                      className="h-10 bg-background/30 border-border/40 focus:border-brand/50 focus:ring-0 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="webdav-pass"
                      className="text-[11px] uppercase tracking-wider text-muted-foreground/60"
                    >
                      Password
                    </Label>
                    <Input
                      id="webdav-pass"
                      type="password"
                      placeholder="••••••••"
                      value={webdavCredentials.password}
                      onChange={(e) =>
                        setWebdavCredentials((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      className="h-10 bg-background/30 border-border/40 focus:border-brand/50 focus:ring-0 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={isTestingConnection}
                  className="gap-2 h-9 text-xs border-border/50 hover:bg-secondary/30 transition-all"
                >
                  {isTestingConnection ? (
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin"
                      strokeWidth={2.25}
                    />
                  ) : connectionStatus === "success" ? (
                    <Check
                      className="h-3.5 w-3.5 text-green-500"
                      strokeWidth={3}
                    />
                  ) : connectionStatus === "error" ? (
                    <X className="h-3.5 w-3.5 text-red-500" strokeWidth={3} />
                  ) : (
                    <Server className="h-3.5 w-3.5" strokeWidth={2.25} />
                  )}
                  Test Connection
                </Button>
                {(webdavCredentials.serverUrl ||
                  webdavCredentials.username) && (
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={clearCredentials}
                    className="h-9 w-9"
                    title="Forget credentials"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <Separator className="bg-border/30" />

              <div className="flex gap-3">
                <Button
                  variant="default"
                  onClick={handleSyncUpload}
                  disabled={isSyncing || !webdavCredentials.serverUrl}
                  className="flex-1 gap-2 h-10 bg-brand hover:bg-brand/90 text-white transition-all active:scale-[0.98] font-semibold"
                >
                  {isSyncing ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      strokeWidth={2.25}
                    />
                  ) : (
                    <Upload className="h-4 w-4" strokeWidth={2.25} />
                  )}
                  Push
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSyncDownload}
                  disabled={isSyncing || !webdavCredentials.serverUrl}
                  className="flex-1 gap-2 h-10 border-border/60 hover:bg-secondary/40 transition-all font-medium"
                >
                  {isSyncing ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      strokeWidth={2.25}
                    />
                  ) : (
                    <Download className="h-4 w-4" strokeWidth={2.25} />
                  )}
                  Pull
                </Button>
              </div>

              <p className="text-[10px] text-muted-foreground/50 text-center leading-relaxed">
                Your credentials are stored locally via{" "}
                <span className="font-mono">localStorage</span> and never sent
                to Kanso servers.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ImportDialog
        open={showExternalImport}
        onOpenChange={setShowExternalImport}
      />
    </div>
  );
}
