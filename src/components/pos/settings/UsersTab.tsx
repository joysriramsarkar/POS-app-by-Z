import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { signOut } from "next-auth/react";
import { Users, Loader2, LogOut, Eye, EyeOff } from "lucide-react";
import { Session } from "next-auth";

interface UsersTabProps {
  session: Session | null;
}

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const levels = [
    { score: 1, label: "দুর্বল", color: "bg-red-500" },
    { score: 2, label: "মাঝারি", color: "bg-orange-400" },
    { score: 3, label: "ভালো", color: "bg-yellow-400" },
    { score: 4, label: "শক্তিশালী", color: "bg-green-500" },
  ];
  return levels[Math.min(score, 4) - 1] ?? { score: 0, label: "", color: "" };
}

export default function UsersTab({ session }: UsersTabProps) {
  const { toast } = useToast();
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });

  const strength = getPasswordStrength(passwords.new);
  const passwordsMatch = passwords.confirm && passwords.new === passwords.confirm;

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      toast({ variant: "destructive", title: "ত্রুটি", description: "নতুন পাসওয়ার্ড মিলছে না।" });
      return;
    }
    setIsChangingPassword(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.new }),
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: "সফল", description: "পাসওয়ার্ড আপডেট হয়েছে।" });
        setPasswords({ current: "", new: "", confirm: "" });
      } else {
        throw new Error(data.error || "Failed to update password");
      }
    } catch (error: unknown) {
      toast({ variant: "destructive", title: "ত্রুটি", description: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const toggleShow = (field: keyof typeof showPasswords) =>
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));

  const username =
    session?.user?.name ||
    (session?.user as { username?: string })?.username ||
    "Admin";

  return (
    <Card>
      <CardHeader>
        <CardTitle>ইউজার ম্যানেজমেন্ট</CardTitle>
        <CardDescription>ইউজার ক্রেডেনশিয়াল ও অথেন্টিকেশন পরিচালনা করুন।</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current User */}
        <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-muted/20 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">লগইন করা ইউজার</p>
              <h3 className="font-semibold truncate">{username}</h3>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => signOut()} className="gap-2 shrink-0">
            <LogOut className="w-4 h-4" />
            লগ আউট
          </Button>
        </div>

        {/* Change Password */}
        <form onSubmit={handlePasswordChange} className="space-y-4 border rounded-lg p-4">
          <h4 className="font-medium text-sm">পাসওয়ার্ড পরিবর্তন করুন</h4>

          {(["current", "new", "confirm"] as const).map((field) => (
            <div key={field} className="space-y-1.5">
              <Label className="text-xs">
                {field === "current" ? "বর্তমান পাসওয়ার্ড" : field === "new" ? "নতুন পাসওয়ার্ড" : "নতুন পাসওয়ার্ড নিশ্চিত করুন"}
              </Label>
              <div className="relative">
                <Input
                  type={showPasswords[field] ? "text" : "password"}
                  required
                  value={passwords[field]}
                  onChange={(e) => setPasswords({ ...passwords, [field]: e.target.value })}
                  className={`pr-9 ${field === "confirm" && passwords.confirm ? (passwordsMatch ? "border-green-500" : "border-red-400") : ""}`}
                />
                <button
                  type="button"
                  onClick={() => toggleShow(field)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPasswords[field] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {field === "new" && passwords.new && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all ${i <= strength.score ? strength.color : "bg-muted"}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{strength.label}</p>
                </div>
              )}
              {field === "confirm" && passwords.confirm && !passwordsMatch && (
                <p className="text-xs text-red-500">পাসওয়ার্ড মিলছে না</p>
              )}
            </div>
          ))}

          <Button
            type="submit"
            disabled={isChangingPassword || !passwords.current || !passwords.new || !passwords.confirm || !passwordsMatch}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            পাসওয়ার্ড পরিবর্তন করুন
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
