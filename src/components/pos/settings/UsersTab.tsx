import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { signOut } from "next-auth/react";
import { Users, Loader2, LogOut } from "lucide-react";
import { Session } from "next-auth";

interface UsersTabProps {
  session: Session | null;
}

export default function UsersTab({ session }: UsersTabProps) {
  const { toast } = useToast();
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      toast({ variant: "destructive", title: "Error", description: "New passwords do not match." });
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwords.current,
          newPassword: passwords.new
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast({ title: "Success", description: "Password updated successfully." });
        setPasswords({ current: "", new: "", confirm: "" });
      } else {
        throw new Error(data.error || "Failed to update password");
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: (error instanceof Error ? error.message : String(error)) });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>ইউজার ম্যানেজমেন্ট (User Management)</CardTitle>
        <CardDescription>Manage user credentials and authentication.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-muted/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current User</p>
              <h3 className="font-semibold text-lg">{session?.user?.name || (session?.user as { id?: string; role?: string; username?: string })?.username || "Admin"}</h3>
            </div>
          </div>
          <Button variant="outline" onClick={() => signOut()} className="gap-2">
            <LogOut className="w-4 h-4" />
            লগ আউট (Logout)
          </Button>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md border rounded-lg p-4">
          <h4 className="font-medium">পাসওয়ার্ড পরিবর্তন করুন (Change Password)</h4>

          <div className="space-y-2">
            <Label>বর্তমান পাসওয়ার্ড (Current Password)</Label>
            <Input
              type="password"
              required
              value={passwords.current}
              onChange={(e) => setPasswords({...passwords, current: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <Label>নতুন পাসওয়ার্ড (New Password)</Label>
            <Input
              type="password"
              required
              value={passwords.new}
              onChange={(e) => setPasswords({...passwords, new: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <Label>নতুন পাসওয়ার্ড নিশ্চিত করুন (Confirm New Password)</Label>
            <Input
              type="password"
              required
              value={passwords.confirm}
              onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
            />
          </div>

          <Button type="submit" disabled={isChangingPassword || !passwords.current || !passwords.new || !passwords.confirm} className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
            {isChangingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            পাসওয়ার্ড পরিবর্তন করুন
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
