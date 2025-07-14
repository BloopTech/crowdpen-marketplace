"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Separator } from "../../components/ui/separator"
import MarketplaceHeader from "../../components/marketplace-header"

export default function TermsPage() {
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <div className="min-h-screen bg-gray-50">
      <MarketplaceHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearch={() => {}}
        cartItemCount={0}
      />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Terms of Service</CardTitle>
            <p className="text-muted-foreground">Last updated: January 15, 2024</p>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <div className="space-y-6">
              <section>
                <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
                <p className="text-muted-foreground">
                  By accessing and using CrowdPen Market, you accept and agree to be bound by the terms and provision of
                  this agreement.
                </p>
              </section>

              <Separator />

              <section>
                <h2 className="text-xl font-semibold mb-3">2. Use License</h2>
                <p className="text-muted-foreground mb-3">
                  Permission is granted to temporarily download one copy of the materials on CrowdPen Market for
                  personal, non-commercial transitory viewing only.
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>This is the grant of a license, not a transfer of title</li>
                  <li>You may not modify or copy the materials</li>
                  <li>You may not use the materials for any commercial purpose</li>
                  <li>You may not attempt to decompile or reverse engineer any software</li>
                </ul>
              </section>

              <Separator />

              <section>
                <h2 className="text-xl font-semibold mb-3">3. Digital Products</h2>
                <p className="text-muted-foreground">
                  All products sold on CrowdPen Market are digital downloads. Upon successful payment, you will receive
                  access to download your purchased items.
                </p>
              </section>

              <Separator />

              <section>
                <h2 className="text-xl font-semibold mb-3">4. Refund Policy</h2>
                <p className="text-muted-foreground">
                  We offer a 30-day money-back guarantee on all purchases. Refunds will be processed within 5-7 business
                  days.
                </p>
              </section>

              <Separator />

              <section>
                <h2 className="text-xl font-semibold mb-3">5. Creator Responsibilities</h2>
                <p className="text-muted-foreground">
                  Creators are responsible for ensuring their content is original, properly licensed, and does not
                  infringe on any copyrights.
                </p>
              </section>

              <Separator />

              <section>
                <h2 className="text-xl font-semibold mb-3">6. Contact Information</h2>
                <p className="text-muted-foreground">
                  If you have any questions about these Terms of Service, please contact us at legal@crowdpen.co
                </p>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
