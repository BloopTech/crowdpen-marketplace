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
import { Input } from "../../../components/ui/input";
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
  const [wishlistShareUrl, setWishlistShareUrl] = useState("");

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

  useEffect(() => {
    if (!profile?.pen_name) return;
    const origin =
      (typeof window !== "undefined" && window.location?.origin) ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      "";
    if (!origin) return;
    setWishlistShareUrl(`${origin}/wishlist/${profile.pen_name}`);
  }, [profile?.pen_name]);

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
      <Card data-testid="account-settings-card">
        <CardHeader data-testid="account-settings-header">
          <CardTitle className="flex items-center gap-2" data-testid="account-settings-title">
            <Settings className="h-5 w-5" />
            Account Settings
            {saving && (
              <Loader2
                className="h-4 w-4 animate-spin ml-2"
                data-testid="account-settings-saving"
              />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6" data-testid="account-settings-content">
          <div data-testid="settings-email-section">
            <h3 className="font-semibold mb-3" data-testid="settings-email-title">
              Email Preferences
            </h3>
            <div className="space-y-4" data-testid="settings-email-list">
              <div className="flex items-center justify-between" data-testid="settings-email-row-new-products">
                <span className="text-sm">New product notifications</span>
                <Switch
                  checked={settings.newProductNotifications}
                  onCheckedChange={(checked) => handleSettingChange('newProductNotifications', checked)}
                  disabled={saving}
                  data-testid="settings-new-product-notifications"
                />
              </div>
              <div className="flex items-center justify-between" data-testid="settings-email-row-weekly">
                <span className="text-sm">Weekly newsletter</span>
                <Switch
                  checked={settings.weeklyNewsletter}
                  onCheckedChange={(checked) => handleSettingChange('weeklyNewsletter', checked)}
                  disabled={saving}
                  data-testid="settings-weekly-newsletter"
                />
              </div>
              <div className="flex items-center justify-between" data-testid="settings-email-row-marketing">
                <span className="text-sm">Marketing emails</span>
                <Switch
                  checked={settings.marketingEmails}
                  onCheckedChange={(checked) => handleSettingChange('marketingEmails', checked)}
                  disabled={saving}
                  data-testid="settings-marketing-emails"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div data-testid="settings-privacy-section">
            <h3 className="font-semibold mb-3" data-testid="settings-privacy-title">
              Privacy Settings
            </h3>
            <div className="space-y-4" data-testid="settings-privacy-list">
              <div className="flex items-center justify-between" data-testid="settings-privacy-row-purchases">
                <span className="text-sm">Make my purchases public</span>
                <Switch
                  checked={settings.publicPurchases}
                  onCheckedChange={(checked) => handleSettingChange('publicPurchases', checked)}
                  disabled={saving}
                  data-testid="settings-public-purchases"
                />
              </div>
              <div className="flex items-center justify-between" data-testid="settings-privacy-row-wishlist">
                <span className="text-sm">Allow others to see my wishlist</span>
                <Switch
                  checked={settings.publicWishlist}
                  onCheckedChange={(checked) => handleSettingChange('publicWishlist', checked)}
                  disabled={saving}
                  data-testid="settings-public-wishlist"
                />
              </div>

              {settings.publicWishlist && wishlistShareUrl ? (
                <div className="space-y-2" data-testid="settings-wishlist-share">
                  <div className="text-xs text-muted-foreground" data-testid="settings-wishlist-share-label">
                    Share this link:
                  </div>
                  <div className="flex gap-2" data-testid="settings-wishlist-share-actions">
                    <Input value={wishlistShareUrl} readOnly data-testid="settings-wishlist-url" />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(wishlistShareUrl);
                          toast.success("Wishlist link copied");
                        } catch (e) {
                          toast.error("Failed to copy link");
                        }
                      }}
                      data-testid="settings-wishlist-copy"
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <Separator />

          <div data-testid="settings-danger-zone">
            <h3 className="font-semibold mb-3 text-red-600" data-testid="settings-danger-title">
              Danger Zone
            </h3>
            <Button variant="destructive" size="sm" data-testid="settings-delete-account">
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
