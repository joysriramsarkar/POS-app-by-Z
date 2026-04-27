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
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      toast({
        variant: "destructive",
        title: "Backup Failed",
        description: errorMessage,
      });
    } finally {
      setIsBackuping(false);
    }
  };

  const handleRestoreClick = () => {
    if (
      confirm(
        "সতর্কতা: রিস্টোর করলে বর্তমান ডাটা মুছে যাবে! আপনি কি নিশ্চিত? (Warning: Restoring will overwrite existing data! Are you sure?)",
      )
    ) {
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
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      toast({
        variant: "destructive",
        title: "Restore Failed",
        description: errorMessage,
      });
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>ডাটা ব্যাকআপ ও রিস্টোর (Backup & Restore)</CardTitle>
        <CardDescription>
          Securely backup or restore all your database records.
        </CardDescription>
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
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleRestoreClick}
              disabled={isRestoring}
            >
              {isRestoring ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              রিস্টোর করুন
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
