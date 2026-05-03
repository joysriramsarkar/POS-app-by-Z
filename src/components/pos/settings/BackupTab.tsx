import { useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, Loader2 } from "lucide-react";

export default function BackupTab() {
  const { toast } = useToast();
  const [isBackuping, setIsBackuping] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBackup = async () => {
    setIsBackuping(true);
    try {
      const response = await fetch("/api/backup");
      const data = await response.json();

      if (data.error) throw new Error(data.error);

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lakhan-bhandar-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Backup Successful",
        description: "Your data has been downloaded.",
      });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Backup Failed",
        description: (error instanceof Error ? error.message : "Unknown error"),
      });
    } finally {
      setIsBackuping(false);
    }
  };

  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [restoreConfirmText, setRestoreConfirmText] = useState("");

  const handleRestoreClick = async () => {
    // Force a backup first
    await handleBackup();
    setShowRestorePrompt(true);
  };

  const confirmRestore = () => {
    if (restoreConfirmText === "RESTORE") {
      setShowRestorePrompt(false);
      setRestoreConfirmText("");
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      toast({
        variant: "destructive",
        title: "Invalid File",
        description: "Please upload a valid JSON backup file.",
      });
      return;
    }

    setIsRestoring(true);
    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      const response = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backupData),
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Restore Successful",
          description: "Database restored successfully. Please reload the app.",
        });
        setTimeout(() => window.location.reload(), 2000);
      } else {
        throw new Error(data.error || "Failed to restore");
      }
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Restore Failed",
        description: (error instanceof Error ? error.message : "Unknown error"),
      });
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>ডাটা ব্যাকআপ ও রিস্টোর</CardTitle>
        <CardDescription>সমস্ত ডাটাবেস রেকর্ড সুরক্ষিতভাবে ব্যাকআপ বা রিস্টোর করুন।</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Backup Card */}
          <div className="rounded-lg border p-4 space-y-4 bg-muted/20">
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Download className="w-5 h-5 text-primary" /> ব্যাকআপ (Backup)
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                আপনার সমস্ত ডাটা JSON ফাইলে এক্সপোর্ট করুন
              </p>
            </div>
            <Button
              className="w-full"
              onClick={handleBackup}
              disabled={isBackuping}
            >
              {isBackuping ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              ব্যাকআপ ডাউনলোড করুন
            </Button>
          </div>

          {/* Restore Card */}
          <div className="rounded-lg border p-4 space-y-4 bg-muted/20">
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Upload className="w-5 h-5 text-destructive" /> রিস্টোর
                (Restore)
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                পূর্ববর্তী ব্যাকআপ থেকে ডাটা রিস্টোর করুন
              </p>
            </div>

            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-xs">
                সতর্কতা: রিস্টোর করলে বর্তমান ডাটা মুছে যাবে!
              </AlertDescription>
            </Alert>

            <input
              type="file"
              accept=".json"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            {showRestorePrompt ? (
              <div className="space-y-2 mt-4 p-4 border border-destructive/50 rounded-md bg-destructive/10">
                <p className="text-sm font-bold text-destructive">
                  To confirm, type "RESTORE" below:
                </p>
                <input
                  type="text"
                  className="w-full p-2 text-sm border rounded-md bg-background"
                  value={restoreConfirmText}
                  onChange={(e) => setRestoreConfirmText(e.target.value)}
                  placeholder="RESTORE"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowRestorePrompt(false);
                      setRestoreConfirmText("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={confirmRestore}
                    disabled={restoreConfirmText !== "RESTORE"}
                  >
                    Confirm
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleRestoreClick}
                disabled={isRestoring || isBackuping}
              >
                {isRestoring ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                রিস্টোর করুন
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
