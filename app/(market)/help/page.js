"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../components/ui/accordion";
import {
  HelpCircle,
  MessageCircle,
  Mail,
  Phone,
  Clock,
  Search,
  Download,
  CreditCard,
  Shield,
} from "lucide-react";
import MarketplaceHeader from "../../components/marketplace-header";
import Link from "next/link";
import { Checkbox } from "../../components/ui/checkbox";
import { submitContactForm } from "../contact/actions";
import { toast } from "sonner";

const initialState = {
  success: false,
  errors: {},
  values: {},
  message: "",
};

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [state, formAction, isPending] = useActionState(
    submitContactForm,
    initialState,
  );
  const hasNotifiedRef = useRef(false);

  useEffect(() => {
    if (!hasNotifiedRef.current) {
      hasNotifiedRef.current = true;
      return;
    }
    if (isPending) return;

    if (Object.keys(state?.errors || {}).length > 0) {
      toast.error(state.message);
    }
    if (Object.keys(state?.data || {}).length > 0) {
      toast.success(state.message);
    }
  }, [isPending, state]);

  const faqs = [
    {
      question: "How do I download my purchased resources?",
      answer:
        "After completing your purchase, you'll receive an email with download links. You can also access your downloads from your account dashboard under 'My Purchases'.",
    },
    {
      question: "What file formats are available?",
      answer:
        "Products on the marketplace come in various formats, including PDF, PSD, AI, Figma, ZIP, DOC, XLS, CSV and PPT. Each product page clearly shows the available formats.",
    },
    {
      question: "Can I share my purchased resources?",
      answer:
        "No, purchased resources are for your personal or business use only. Sharing or redistributing files violates our terms of service and the creator's copyright.",
    },
    {
      question: "How do I become a creator on CrowdPen Market?",
      answer:
        "Click the 'Join' button in the header to create an account or sign in using your Crowdpen account. Once you are signed in, fill out your KYC verification.  We'll review your application and guide you through setting up your creator profile.",
    },
    {
      question: "How do I get paid as a creator?",
      answer: (
        <div className="space-y-3">
          <p>Creators receive weekly payouts for completed sales.</p>
          <ol className="list-decimal space-y-1 pl-6">
            <li>Payouts are processed every Friday</li>
            <li>Minimum payout threshold is $10</li>
            <li>
              Payments are sent via your selected payout method (mobile money or
              bank)
            </li>
          </ol>
          <p>
            You can track earnings and payout history from your creator
            dashboard in the{" "}
            <Link href="/account" className="text-tertiary underline">
              account area
            </Link>
            .
          </p>
        </div>
      ),
    },
    {
      question: "How much does Crowdpen take from each sale?",
      answer: (
        <div className="space-y-3">
          <p>Crowdpen operates on an 80/20 revenue split.</p>
          <ol className="list-decimal space-y-1 pl-6">
            <li>You keep 80% of every sale</li>
            <li>
              Crowdpen takes 20% to cover payment processing, platform
              maintenance, creator support, and distribution
            </li>
          </ol>
          <p>There are no listing fees or hidden charges.</p>
        </div>
      ),
    },
    {
      question: "Do I need to upload my product as a file?",
      answer:
        "Yes, your digital product should be uploaded as a file in PDF, DOCX, XLSX, ZIP, or similar supported formats.",
    },
    {
      question: "Is there a limit to how many products I can sell?",
      answer:
        "No. You can publish as many products as you want, as long as they meet Marketplace guidelines.",
    },
    {
      question: "Can I update my product after it’s published?",
      answer: (
        <div className="space-y-2">
          <p>Yes.</p>
          <ol className="list-decimal space-y-1 pl-6">
            <li>You can update your product content or files</li>
            <li>
              Major changes should be clearly communicated in the product
              description
            </li>
          </ol>
        </div>
      ),
    },
    {
      question: "How long does it take for my product to go live?",
      answer:
        "Your product will go live as soon as your account is verified. KYC verification takes up to 24 hours, and once approved you can publish products anytime.",
    },
    {
      question: "Will Crowdpen help promote my product?",
      answer: (
        <div className="space-y-2">
          <p>Once your product resonates with us, we will distribute it!</p>
          <p>Products may be featured through:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Marketplace newsletters</li>
            <li>Social media highlights</li>
            <li>Creator spotlights</li>
          </ul>
          <p>
            Creators are also encouraged to share their product links with their
            own audiences.
          </p>
        </div>
      ),
    },
    {
      question: "Can I price my product in my local currency?",
      answer:
        "Yes. Products can be priced in supported local currencies, and buyers pay in their preferred currency where available.",
    },
    {
      question: "What happens if a buyer has an issue with my product?",
      answer: (
        <div className="space-y-1">
          <p>If a buyer reports an issue:</p>
          <ol className="list-decimal space-y-1 pl-6">
            <li>Crowdpen support reviews the request</li>
            <li>You may be contacted for clarification</li>
            <li>Refunds are handled fairly on a case-by-case basis</li>
          </ol>
          <p>We aim to protect both creators and buyers.</p>
        </div>
      ),
    },
    {
      question: "What kinds of products sell best on Crowdpen Marketplace?",
      answer: (
        <div className="space-y-2">
          <p>High-performing products usually:</p>
          <ol className="list-decimal space-y-1 pl-6">
            <li>Solve a clear problem</li>
            <li>Are simple and practical</li>
            <li>Are easy to understand and use</li>
          </ol>
          <p>Common categories include:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Writing templates and checklists</li>
            <li>Ebooks and guides</li>
            <li>Short stories and creative works</li>
          </ul>
        </div>
      ),
    },
    {
      question: "Who do I contact if I need help?",
      answer: (
        <div className="space-y-2">
          <p>If you need assistance:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              Email:{" "}
              <a
                href="mailto:rose@crowdpen.co"
                className="text-tertiary underline"
              >
                rose@crowdpen.co
              </a>
            </li>
            <li>Ask in the Creator WhatsApp support group or Discord</li>
          </ul>
          <p>You’ll always get a response.</p>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen">
      <MarketplaceHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearch={() => {}}
        cartItemCount={0}
      />

      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">Help & Support</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Find answers to common questions or get in touch with our support
            team
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
                  {state.success && (
                    <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                      {state.message ||
                        "Your message has been sent successfully! We'll get back to you soon."}
                    </div>
                  )}
                  {state.errors?.form && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {state.errors.form}
                    </div>
                  )}
                  <form action={formAction} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        name="name"
                        defaultValue={state.values?.name || ""}
                        required
                        disabled={isPending}
                      />
                      {state.errors?.name && (
                        <p className="mt-1 text-xs text-red-600">
                          {state.errors.name}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        name="email"
                        defaultValue={state.values?.email || ""}
                        required
                        disabled={isPending}
                      />
                      {state.errors?.email && (
                        <p className="mt-1 text-xs text-red-600">
                          {state.errors.email}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="subject">Subject</Label>
                      <Input
                        id="subject"
                        name="subject"
                        defaultValue={state.values?.subject || ""}
                        required
                        disabled={isPending}
                      />
                      {state.errors?.subject && (
                        <p className="mt-1 text-xs text-red-600">
                          {state.errors.subject}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="message">Message</Label>
                      <Textarea
                        id="message"
                        rows={4}
                        name="message"
                        defaultValue={state.values?.message || ""}
                        required
                        disabled={isPending}
                      />
                      {state.errors?.message && (
                        <p className="mt-1 text-xs text-red-600">
                          {state.errors.message}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="terms" required disabled={isPending} />
                      <Label htmlFor="terms" className="text-sm">
                        I agree to the{" "}
                        <Link
                          href="/terms"
                          className="text-tertiary hover:underline"
                        >
                          Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link
                          href="/privacy"
                          className="text-tertiary hover:underline"
                        >
                          Privacy Policy
                        </Link>
                      </Label>
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isPending}
                    >
                      {isPending ? "Sending..." : "Send Message"}
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
                        <div className="text-sm text-muted-foreground">
                          support@crowdpen.co
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-blue-600" />
                      <div>
                        <div className="font-medium">Support Hours</div>
                        <div className="text-sm text-muted-foreground">
                          Mon-Fri 9AM-6PM GMT
                        </div>
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
                  <p className="text-sm text-muted-foreground mb-4">
                    Manage your profile, purchases, and preferences
                  </p>
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
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-inherit rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="font-medium">
                        All Systems Operational
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Last updated: 2 minutes ago
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>Website</span>
                      <span className="text-green-600 text-sm">
                        Operational
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Payment Processing</span>
                      <span className="text-green-600 text-sm">
                        Operational
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Download Service</span>
                      <span className="text-green-600 text-sm">
                        Operational
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Email Delivery</span>
                      <span className="text-green-600 text-sm">
                        Operational
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
