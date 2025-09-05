"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import {
  User,
  Download,
  Heart,
  CreditCard,
  Settings,
  Calendar,
  DollarSign,
  Loader2,
} from "lucide-react";
import MarketplaceHeader from "../../components/marketplace-header";
import { useAccount } from "./context";

export default function AccountContentPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { profile, purchases = [], wishlist = [], accountQuery } = useAccount();

  // Local editable draft for the Profile tab
  const [draftProfile, setDraftProfile] = useState(null);
  useEffect(() => {
    if (profile) {
      setDraftProfile({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        email: profile.email || "",
        bio: profile.bio || "",
        image: profile.image || null,
        name: profile.name || "",
      });
    }
  }, [profile]);

  const memberSinceText = useMemo(() => {
    if (!profile?.memberSince) return null;
    try {
      return new Date(profile.memberSince).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      });
    } catch (_) {
      return null;
    }
  }, [profile?.memberSince]);

  const displayFirstName = draftProfile?.firstName || profile?.firstName || "";
  const displayLastName = draftProfile?.lastName || profile?.lastName || "";
  const displayName = useMemo(() => {
    const combined = `${displayFirstName} ${displayLastName}`.trim();
    return profile?.name || combined;
  }, [displayFirstName, displayLastName, profile?.name]);

  if (accountQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-6 w-6 animate-spin" />
          Loading your account...
        </div>
      </div>
    );
  }

  if (accountQuery.isError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-slate-700">Failed to load your account.</p>
          <Button onClick={() => accountQuery.refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MarketplaceHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearch={() => {}}
        cartItemCount={0}
      />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Avatar className="w-16 h-16 ring-4 ring-white shadow-xl">
            <AvatarImage
              src={profile?.image || "/default-avatar.png"}
              alt={displayName}
              className="object-cover"
            />
            <AvatarFallback className="text-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
              {displayName?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">
              {displayFirstName || displayLastName
                ? `${displayFirstName} ${displayLastName}`.trim()
                : displayName}
            </h1>
            <p className="text-muted-foreground">
              {memberSinceText ? `Member since ${memberSinceText}` : null}
            </p>
          </div>
        </div>

        <Tabs defaultValue="purchases" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="purchases">My Purchases</TabsTrigger>
            <TabsTrigger value="wishlist">Wishlist</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="purchases" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  My Purchases ({purchases.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {purchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="flex items-center justify-between p-4 border border-slate-300 rounded-lg"
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold">{purchase.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          by {purchase.author}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>Purchased {purchase.purchaseDate}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            <span>${purchase.price}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {purchase.status === "completed"
                            ? "✓ Complete"
                            : "Processing"}
                        </Badge>
                        <Button size="sm">
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wishlist" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  My Wishlist ({wishlist.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {wishlist.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          by {item.author}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="font-bold">${item.price}</span>
                          {item.originalPrice && (
                            <span className="text-sm text-muted-foreground line-through">
                              ${item.originalPrice}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          Remove
                        </Button>
                        <Button size="sm">Add to Cart</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={draftProfile?.firstName || ""}
                      onChange={(e) =>
                        setDraftProfile((prev) => ({
                          ...(prev || {}),
                          firstName: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={draftProfile?.lastName || ""}
                      onChange={(e) =>
                        setDraftProfile((prev) => ({
                          ...(prev || {}),
                          lastName: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={draftProfile?.email || ""}
                    onChange={(e) =>
                      setDraftProfile((prev) => ({
                        ...(prev || {}),
                        email: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="bio">Bio</Label>
                  <textarea
                    id="bio"
                    className="w-full p-2 border rounded-md"
                    rows={3}
                    value={draftProfile?.bio || ""}
                    onChange={(e) =>
                      setDraftProfile((prev) => ({
                        ...(prev || {}),
                        bio: e.target.value,
                      }))
                    }
                  />
                </div>
                <Button>Save Changes</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Billing & Payment Methods
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5" />
                      <div>
                        <div className="font-medium">•••• •••• •••• 4242</div>
                        <div className="text-sm text-muted-foreground">
                          Expires 12/25
                        </div>
                      </div>
                    </div>
                    <Badge>Default</Badge>
                  </div>
                </div>
                <Button variant="outline">Add Payment Method</Button>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-3">Recent Transactions</h3>
                  <div className="space-y-2">
                    {purchases.map((purchase) => (
                      <div
                        key={purchase.id}
                        className="flex justify-between text-sm"
                      >
                        <span>{purchase.title}</span>
                        <span>${purchase.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Account Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3">Email Preferences</h3>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" defaultChecked />
                      <span className="text-sm">New product notifications</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" defaultChecked />
                      <span className="text-sm">Weekly newsletter</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" />
                      <span className="text-sm">Marketing emails</span>
                    </label>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-3">Privacy Settings</h3>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" defaultChecked />
                      <span className="text-sm">Make my purchases public</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" />
                      <span className="text-sm">
                        Allow others to see my wishlist
                      </span>
                    </label>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-3 text-red-600">
                    Danger Zone
                  </h3>
                  <Button variant="destructive" size="sm">
                    Delete Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
