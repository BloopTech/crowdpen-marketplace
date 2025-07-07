"use client"

import React from "react"

import { useState } from "react"
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Input } from "../../components/ui/input"
import { Textarea } from "../../components/ui/textarea"
import { Label } from "../../components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../components/ui/accordion"
import { HelpCircle, MessageCircle, Mail, Phone, Clock, Search, Download, CreditCard, Shield } from "lucide-react"
import MarketplaceHeader from "../../components/marketplace-header"
import Link from "next/link"
import { Checkbox } from "../../components/ui/checkbox"

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [supportForm, setSupportForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })

  const faqs = [
    {
      question: "How do I download my purchased resources?",
      answer:
        "After completing your purchase, you'll receive an email with download links. You can also access your downloads from your account dashboard under 'My Purchases'.",
    },
    {
      question: "What file formats are available?",
      answer:
        "Our resources come in various formats including PDF, DOCX, EPUB, Notion templates, Google Sheets, and more. Each product page clearly shows the available formats.",
    },
    {
      question: "Can I get a refund?",
      answer:
        "Yes! We offer a 30-day money-back guarantee on all purchases. If you're not satisfied with your purchase, contact our support team for a full refund.",
    },
    {
      question: "How do I use my resources commercially?",
      answer:
        "License terms vary by product. Check the product page for specific licensing information. Most resources include commercial use rights, but some may be for personal use only.",
    },
    {
      question: "Can I share my purchased resources?",
      answer:
        "No, purchased resources are for your personal or business use only. Sharing or redistributing files violates our terms of service and the creator's copyright.",
    },
    {
      question: "How do I become a creator on CrowdPen Market?",
      answer:
        "Click 'Become a Creator' in the header to start the application process. We'll review your application and guide you through setting up your creator profile.",
    },
  ]

  const handleFormSubmit = (e) => {
    e.preventDefault()
    console.log("Support form submitted:", supportForm)
    // Handle form submission
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MarketplaceHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearch={() => {}}
        cartItemCount={0}
      />

      <div className="container mx-auto px-4 py-8 mt-[4rem]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">Help & Support</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Find answers to common questions or get in touch with our support team
          </p>
        </div>

        <Tabs defaultValue="faq" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="faq">FAQ</TabsTrigger>
            <TabsTrigger value="contact">Contact Us</TabsTrigger>
            <TabsTrigger value="guides">Guides</TabsTrigger>
            <TabsTrigger value="status">System Status</TabsTrigger>
          </TabsList>

          <TabsContent value="faq" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  Frequently Asked Questions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input placeholder="Search FAQs..." className="pl-10" />
                  </div>
                </div>

                <Accordion type="single" collapsible className="w-full">
                  {faqs.map((faq, index) => (
                    <AccordionItem key={index} value={`item-${index}`}>
                      <AccordionTrigger>{faq.question}</AccordionTrigger>
                      <AccordionContent>{faq.answer}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contact" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    Send us a Message
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={supportForm.name}
                        onChange={(e) => setSupportForm((prev) => ({ ...prev, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={supportForm.email}
                        onChange={(e) => setSupportForm((prev) => ({ ...prev, email: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="subject">Subject</Label>
                      <Input
                        id="subject"
                        value={supportForm.subject}
                        onChange={(e) => setSupportForm((prev) => ({ ...prev, subject: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="message">Message</Label>
                      <Textarea
                        id="message"
                        rows={4}
                        value={supportForm.message}
                        onChange={(e) => setSupportForm((prev) => ({ ...prev, message: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="terms" required />
                      <Label htmlFor="terms" className="text-sm">
                        I agree to the{" "}
                        <Link href="/terms" className="text-purple-600 hover:underline">
                          Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link href="/privacy" className="text-purple-600 hover:underline">
                          Privacy Policy
                        </Link>
                      </Label>
                    </div>
                    <Button type="submit" className="w-full">
                      Send Message
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Other Ways to Reach Us</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-purple-600" />
                      <div>
                        <div className="font-medium">Email Support</div>
                        <div className="text-sm text-muted-foreground">support@crowdpen.com</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-green-600" />
                      <div>
                        <div className="font-medium">Phone Support</div>
                        <div className="text-sm text-muted-foreground">1-800-CROWDPEN</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-blue-600" />
                      <div>
                        <div className="font-medium">Support Hours</div>
                        <div className="text-sm text-muted-foreground">Mon-Fri 9AM-6PM EST</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Quick Links</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="ghost" className="w-full justify-start">
                      <Download className="h-4 w-4 mr-2" />
                      Download Issues
                    </Button>
                    <Button variant="ghost" className="w-full justify-start">
                      <CreditCard className="h-4 w-4 mr-2" />
                      Payment Problems
                    </Button>
                    <Button variant="ghost" className="w-full justify-start">
                      <Shield className="h-4 w-4 mr-2" />
                      Account Security
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="guides" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Getting Started</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Learn how to browse, purchase, and download resources
                  </p>
                  <Button variant="outline" size="sm">
                    Read Guide
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Account Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">Manage your profile, purchases, and preferences</p>
                  <Button variant="outline" size="sm">
                    Read Guide
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Creator Guidelines</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Learn how to sell your resources on CrowdPen Market
                  </p>
                  <Button variant="outline" size="sm">
                    Read Guide
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="status" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="font-medium">All Systems Operational</span>
                    </div>
                    <span className="text-sm text-muted-foreground">Last updated: 2 minutes ago</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>Website</span>
                      <span className="text-green-600 text-sm">Operational</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Payment Processing</span>
                      <span className="text-green-600 text-sm">Operational</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Download Service</span>
                      <span className="text-green-600 text-sm">Operational</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Email Delivery</span>
                      <span className="text-green-600 text-sm">Operational</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
