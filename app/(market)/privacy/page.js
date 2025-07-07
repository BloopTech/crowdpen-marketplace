"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Separator } from "../../components/ui/separator"
import MarketplaceHeader from "../../components/marketplace-header"

export default function PrivacyPage() {
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <div className="min-h-screen bg-gray-50">
      <MarketplaceHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearch={() => {}}
        cartItemCount={0}
      />

      <div className="container mx-auto px-4 py-8 max-w-4xl mt-[4rem]">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Privacy Policy</CardTitle>
            <p className="text-muted-foreground">Last updated: January 15, 2024</p>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <div className="space-y-6">
              <section>
                <h2 className="text-xl font-semibold mb-3">Information We Collect</h2>
                <p className="text-muted-foreground">
                  We collect information you provide directly to us, such as when you create an account, make a
                  purchase, or contact us for support.
                </p>
              </section>

              <Separator />

              <section>
                <h2 className="text-xl font-semibold mb-3">How We Use Your Information</h2>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>To provide and maintain our services</li>
                  <li>To process transactions and send related information</li>
                  <li>To send you technical notices and support messages</li>
                  <li>To communicate with you about products, services, and events</li>
                </ul>
              </section>

              <Separator />

              <section>
                <h2 className="text-xl font-semibold mb-3">Information Sharing</h2>
                <p className="text-muted-foreground">
                  We do not sell, trade, or otherwise transfer your personal information to third parties without your
                  consent, except as described in this policy.
                </p>
              </section>

              <Separator />

              <section>
                <h2 className="text-xl font-semibold mb-3">Data Security</h2>
                <p className="text-muted-foreground">
                  We implement appropriate security measures to protect your personal information against unauthorized
                  access, alteration, disclosure, or destruction.
                </p>
              </section>

              <Separator />

              <section>
                <h2 className="text-xl font-semibold mb-3">Contact Us</h2>
                <p className="text-muted-foreground">
                  If you have questions about this Privacy Policy, please contact us at privacy@crowdpen.com
                </p>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
