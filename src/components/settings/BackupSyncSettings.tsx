"use client";

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
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
  BellRing,
  AlertTriangle,
} from "lucide-react";
import { notify } from "@/lib/notify";
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
import { ToggleRow } from "@/components/settings/ToggleRow";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useUiStore } from "@/lib/store/uiStore";
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
import { useLocationHistoryStore } from "@/lib/store/locationHistoryStore";
import type { BackupData } from "@/lib/backup/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/components/AuthProvider";
import { useAccountData } from "@/lib/hooks/useAccountData";
import { createClient } from "@/lib/supabase/client";
import {
  collectCloudBackup,
  replaceCloudBackup,
} from "@/lib/backup/cloud-data";
import { DeleteConfirmationDialog } from "@/components/ui/DeleteConfirmationDialog";
import { ImportDialog } from "./ImportDialog";
import { SETTINGS_CARD_CLASS } from "@/components/settings/settingsCardClass";

// Every registered account is required to set a content passphrase
// (see EncryptionGate), so this only needs to skip guests, who have none.
function EnvelopeWarning() {
  return (
    <div
      role="alert"
      className="flex gap-2.5 text-xs text-destructive-surface-foreground bg-destructive-surface border border-destructive-surface-border rounded-lg p-3.5"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
      <p>
        This file is not covered by your content passphrase — it&apos;s plain,
        readable data. Store or share it as carefully as you would the data
        itself.
      </p>
    </div>
  );
}

interface CloudSyncCardProps {
  credentials: WebDAVCredentials;
  onCredentialsChange: (
    updater: (prev: WebDAVCredentials) => WebDAVCredentials,
  ) => void;
  isTestingConnection: boolean;
  connectionStatus: "idle" | "success" | "error";
  isSyncing: boolean;
  onTestConnection: () => void;
  onResetCredentials: () => void;
  onSyncUpload: () => void;
  onSyncDownload: () => void;
  showEnvelopeWarning: boolean;
}

function CloudSyncCard({
  credentials,
  onCredentialsChange,
  isTestingConnection,
  connectionStatus,
  isSyncing,
  onTestConnection,
  onResetCredentials,
  onSyncUpload,
  onSyncDownload,
  showEnvelopeWarning,
}: CloudSyncCardProps) {
  return (
    <TabsContent value="cloud" className="mt-0 outline-none">
      <Card className={SETTINGS_CARD_CLASS}>
        <CardHeader className="pb-3 px-4 pt-5">
          <CardTitle className="flex items-center gap-2 text-base font-medium tracking-tight">
            <Cloud className="h-4 w-4 text-brand" strokeWidth={2.25} />
            WebDAV Backup
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground/80 lowercase">
            Keep a copy on a WebDAV server you control.
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
                value={credentials.serverUrl}
                onChange={(e) =>
                  onCredentialsChange((prev) => ({
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
                  value={credentials.username}
                  onChange={(e) =>
                    onCredentialsChange((prev) => ({
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
                  value={credentials.password}
                  onChange={(e) =>
                    onCredentialsChange((prev) => ({
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
              onClick={onTestConnection}
              disabled={isTestingConnection}
              className="gap-2 h-9 text-xs border-border/50 hover:bg-secondary/30 transition-all"
            >
              {isTestingConnection ? (
                <Loader2
                  className="h-3.5 w-3.5 animate-spin"
                  strokeWidth={2.25}
                />
              ) : connectionStatus === "success" ? (
                <Check className="h-3.5 w-3.5 text-green-500" strokeWidth={3} />
              ) : connectionStatus === "error" ? (
                <X className="h-3.5 w-3.5 text-red-500" strokeWidth={3} />
              ) : (
                <Server className="h-3.5 w-3.5" strokeWidth={2.25} />
              )}
              Test Connection
            </Button>
            {(credentials.serverUrl || credentials.username) && (
              <Button
                variant="destructive"
                size="icon"
                onClick={onResetCredentials}
                className="h-9 w-9"
                title="Forget credentials"
                aria-label="Forget credentials"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          <Separator className="bg-border/30" />

          <div className="flex gap-3">
            <Button
              variant="default"
              onClick={onSyncUpload}
              disabled={isSyncing || !credentials.serverUrl}
              className="flex-1 gap-2 h-10 bg-brand hover:bg-brand/90 text-white transition-all active:scale-[0.98] font-semibold"
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
              ) : (
                <Upload className="h-4 w-4" strokeWidth={2.25} />
              )}
              Back Up
            </Button>
            <Button
              variant="outline"
              onClick={onSyncDownload}
              disabled={isSyncing || !credentials.serverUrl}
              className="flex-1 gap-2 h-10 border-border/60 hover:bg-secondary/40 transition-all font-medium"
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
              ) : (
                <Download className="h-4 w-4" strokeWidth={2.25} />
              )}
              Restore
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            Your credentials are used only for this session — they aren&apos;t
            stored, and re-entering them is required after a reload.
          </p>

          {showEnvelopeWarning && <EnvelopeWarning />}
        </CardContent>
      </Card>
    </TabsContent>
  );
}

const BACKUP_REMINDER_FREQUENCY_OPTIONS = [
  { value: "7", label: "Weekly" },
  { value: "14", label: "Biweekly" },
  { value: "30", label: "Monthly" },
];

function BackupRemindersCard() {
  const { trigger } = useHaptic();
  const backupReminderEnabled = useUiStore((s) => s.backupReminderEnabled);
  const setBackupReminderEnabled = useUiStore(
    (s) => s.setBackupReminderEnabled,
  );
  const backupReminderFrequencyDays = useUiStore(
    (s) => s.backupReminderFrequencyDays,
  );
  const setBackupReminderFrequencyDays = useUiStore(
    (s) => s.setBackupReminderFrequencyDays,
  );

  return (
    <Card className={SETTINGS_CARD_CLASS}>
      <CardHeader className="pb-3 px-4 pt-5">
        <CardTitle className="flex items-center gap-2 text-base font-medium tracking-tight">
          <BellRing className="h-4 w-4 text-brand" strokeWidth={2.25} />
          Backup Reminders
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground/80 lowercase">
          Get nudged to export a backup, since your data is stored on this
          device only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-5 pt-0">
        <ToggleRow
          icon={BellRing}
          title="Remind me to back up"
          description="Periodic nudge to export your local data"
          checked={backupReminderEnabled}
          onChange={(checked) => {
            trigger("toggle");
            setBackupReminderEnabled(checked);
          }}
        />
        <Select
          value={String(backupReminderFrequencyDays)}
          onValueChange={(val) => {
            trigger("toggle");
            setBackupReminderFrequencyDays(Number(val));
          }}
          disabled={!backupReminderEnabled}
        >
          <SelectTrigger
            className="w-full h-10 bg-background/30 border-border/40"
            aria-label="Reminder frequency"
          >
            <SelectValue placeholder="Frequency" />
          </SelectTrigger>
          <SelectContent>
            {BACKUP_REMINDER_FREQUENCY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

function buildGuestBackupData(): BackupData {
  return {
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
    location_history: useLocationHistoryStore.getState().locations,
  };
}

function formatBackupDate(exportedAt: string): string {
  return format(new Date(exportedAt), "MMM d, yyyy 'at' h:mm a");
}

export function BackupSyncSettings() {
  const { trigger } = useHaptic();
  const { isGuestMode, user } = useAuth();
  const { exportData, importData } = useAccountData();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showExternalImport, setShowExternalImport] = useState(false);

  // Kept in memory only to avoid persisting credentials locally.
  const [webdavCredentials, setWebdavCredentials] = useState<WebDAVCredentials>(
    { serverUrl: "", username: "", password: "" },
  );
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [isSyncing, setIsSyncing] = useState(false);
  // Pre-fetched so the confirmation dialog can display the backup export timestamp.
  const [pendingRestore, setPendingRestore] = useState<BackupData | null>(null);

  const invalidateDataQueries = async () => {
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

  const handleExport = async () => {
    trigger("toggle");

    if (!isGuestMode) {
      await exportData();
      return;
    }

    setIsExporting(true);
    try {
      const blob = await createBackupZip(buildGuestBackupData());
      downloadBackup(blob);

      localStorage.setItem("kanso_last_backup_date", new Date().toISOString());

      notify.success("Backup downloaded successfully");
      trigger("success");
    } catch (err) {
      console.error("Export failed:", err);
      notify.error("Failed to create backup");
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
    const loadingToastId = notify.loading(`Importing ${file.name}...`);

    try {
      const backupData = await parseBackupZip(file);

      // Single write so large restores don't repeatedly stringify a growing payload.
      mockStore.restoreBackup(backupData);
      useLocationHistoryStore.setState({
        locations: backupData.location_history ?? [],
      });

      await invalidateDataQueries();

      notify.success(
        `Restored ${backupData.tasks.length} tasks, ${backupData.projects.length} projects`,
        {
          id: loadingToastId,
        },
      );
      trigger("success");
    } catch (err) {
      console.error("Import failed:", err);
      notify.error("Failed to import backup", { id: loadingToastId });
      trigger("thud");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const resetCredentials = () => {
    trigger("toggle");
    setWebdavCredentials({ serverUrl: "", username: "", password: "" });
    setConnectionStatus("idle");
    notify.success("Credentials cleared");
  };

  const handleTestConnection = async () => {
    if (
      !webdavCredentials.serverUrl ||
      !webdavCredentials.username ||
      !webdavCredentials.password
    ) {
      notify.error("Please fill in all WebDAV fields");
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus("idle");
    trigger("toggle");

    try {
      const result = await testWebDavConnection(webdavCredentials);

      if (result.success) {
        setConnectionStatus("success");
        notify.success("Connected successfully");
        trigger("success");
      } else {
        setConnectionStatus("error");
        notify.error(result.error || "Connection failed");
        trigger("thud");
      }
    } catch {
      setConnectionStatus("error");
      notify.error("Connection test failed");
      trigger("thud");
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSyncUpload = async () => {
    if (!webdavCredentials.serverUrl) {
      notify.error("Configure WebDAV settings first");
      return;
    }

    setIsSyncing(true);
    trigger("toggle");

    try {
      const backupData: BackupData = isGuestMode
        ? buildGuestBackupData()
        : await collectCloudBackup(supabase);

      const blob = await createBackupZip(backupData);
      const result = await uploadWebDavBackup(webdavCredentials, blob);

      if (result.success) {
        localStorage.setItem(
          "kanso_last_backup_date",
          new Date().toISOString(),
        );
        notify.success("Backed up to server");
        trigger("success");
      } else {
        notify.error(result.error || "Back up failed");
        trigger("thud");
      }
    } catch {
      notify.error("Back up failed");
      trigger("thud");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncDownload = async () => {
    if (!webdavCredentials.serverUrl) {
      notify.error("Configure WebDAV settings first");
      return;
    }

    trigger("toggle");
    setIsSyncing(true);

    try {
      const result = await downloadWebDavBackup(webdavCredentials);

      if (result.success && result.data) {
        setPendingRestore(result.data);
      } else {
        notify.error(result.error || "Download failed");
        trigger("thud");
      }
    } catch {
      notify.error("Download failed");
      trigger("thud");
    } finally {
      setIsSyncing(false);
    }
  };

  const runSyncDownload = async () => {
    const data = pendingRestore;
    if (!data) return;
    setPendingRestore(null);

    setIsSyncing(true);

    try {
      if (isGuestMode) {
        mockStore.restoreBackup(data);
      } else {
        if (!user) return;
        await replaceCloudBackup(supabase, user.id, data);
      }
      useLocationHistoryStore.setState({
        locations: data.location_history ?? [],
      });

      await invalidateDataQueries();

      notify.success("Data restored from server");
      trigger("success");
    } catch {
      notify.error("Restore failed");
      trigger("thud");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
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
            WebDAV
          </TabsTrigger>
        </TabsList>

        <TabsContent value="local" className="mt-0 outline-none">
          <div
            className={cn(
              isGuestMode && "flex flex-col gap-4 md:grid md:grid-cols-2",
            )}
          >
            <Card className={SETTINGS_CARD_CLASS}>
              <CardHeader className="pb-3 px-4 pt-5">
                <CardTitle className="flex items-center gap-2 text-base font-medium tracking-tight">
                  <HardDrive
                    className="h-4 w-4 text-brand"
                    strokeWidth={2.25}
                  />
                  Local Backup
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground/80 lowercase">
                  Export your {isGuestMode ? "local" : "cloud"} data to a ZIP
                  file or restore from a backup.
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
              {!isGuestMode && (
                <div className="px-4 pb-4">
                  <EnvelopeWarning />
                </div>
              )}
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
            {isGuestMode && <BackupRemindersCard />}
          </div>
        </TabsContent>

        <CloudSyncCard
          credentials={webdavCredentials}
          onCredentialsChange={setWebdavCredentials}
          isTestingConnection={isTestingConnection}
          connectionStatus={connectionStatus}
          isSyncing={isSyncing}
          onTestConnection={handleTestConnection}
          onResetCredentials={resetCredentials}
          onSyncUpload={handleSyncUpload}
          onSyncDownload={handleSyncDownload}
          showEnvelopeWarning={!isGuestMode}
        />
      </Tabs>

      <ImportDialog
        open={showExternalImport}
        onOpenChange={setShowExternalImport}
      />

      <DeleteConfirmationDialog
        isOpen={pendingRestore !== null}
        onClose={() => setPendingRestore(null)}
        onConfirm={runSyncDownload}
        title="Replace your data?"
        description={
          pendingRestore
            ? `This backup was taken ${formatBackupDate(pendingRestore.metadata.exportedAt)}. Restoring overwrites everything in your account with it — anything not in that backup is lost. This cannot be undone.`
            : "Restoring overwrites everything in your account with the backup on the server. Anything not in that backup is lost. This cannot be undone."
        }
        confirmLabel="Replace"
      />
    </div>
  );
}
