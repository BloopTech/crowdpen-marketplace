"use client";
import React, { useState, useEffect } from "react";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Separator } from "../../../components/ui/separator";
import { Switch } from "../../../components/ui/switch";
import { Settings, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAccount } from "../context";

export default function AccountSettings() {
  const { profile, refetchAccountQuery } = useAccount();
  
  // Settings state
  const [settings, setSettings] = useState({
    newProductNotifications: true,
    weeklyNewsletter: true,
    marketingEmails: false,
    publicPurchases: true,
    publicWishlist: false,
  });
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize settings from profile
  useEffect(() => {
    if (profile?.settings && !initialized) {
      setSettings({
        newProductNotifications: profile.settings.newProductNotifications ?? true,
        weeklyNewsletter: profile.settings.weeklyNewsletter ?? true,
        marketingEmails: profile.settings.marketingEmails ?? false,
        publicPurchases: profile.settings.publicPurchases ?? true,
        publicWishlist: profile.settings.publicWishlist ?? false,
      });
      setInitialized(true);
    }
  }, [profile?.settings, initialized]);

  const handleSettingChange = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setSaving(true);

    try {
      const res = await fetch('/api/marketplace/account/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });

      const data = await res.json();
      if (!res.ok || data?.status !== 'success') {
        // Revert on error
        setSettings(settings);
        toast.error(data?.message || 'Failed to save setting');
      } else {
        toast.success('Setting saved');
        refetchAccountQuery?.();
      }
    } catch (err) {
      setSettings(settings);
      toast.error('Failed to save setting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Account Settings
            {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-3">Email Preferences</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">New product notifications</span>
                <Switch
                  checked={settings.newProductNotifications}
                  onCheckedChange={(checked) => handleSettingChange('newProductNotifications', checked)}
                  disabled={saving}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Weekly newsletter</span>
                <Switch
                  checked={settings.weeklyNewsletter}
                  onCheckedChange={(checked) => handleSettingChange('weeklyNewsletter', checked)}
                  disabled={saving}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Marketing emails</span>
                <Switch
                  checked={settings.marketingEmails}
                  onCheckedChange={(checked) => handleSettingChange('marketingEmails', checked)}
                  disabled={saving}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-3">Privacy Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Make my purchases public</span>
                <Switch
                  checked={settings.publicPurchases}
                  onCheckedChange={(checked) => handleSettingChange('publicPurchases', checked)}
                  disabled={saving}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Allow others to see my wishlist</span>
                <Switch
                  checked={settings.publicWishlist}
                  onCheckedChange={(checked) => handleSettingChange('publicWishlist', checked)}
                  disabled={saving}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-3 text-red-600">Danger Zone</h3>
            <Button variant="destructive" size="sm">
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
