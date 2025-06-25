"use client"

import React from "react"

import { useState } from "react"
import { Button } from "../../../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import { Textarea } from "../../../components/ui/textarea"
import { Checkbox } from "../../../components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select"
import { Badge } from "../../../components/ui/badge"
import { Separator } from "../../../components/ui/separator"
import { Star, DollarSign, Users, TrendingUp, CheckCircle } from "lucide-react"
import MarketplaceHeader from "../../../components/marketplace-header"

export default function CreatorApplicationPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    bio: "",
    experience: "",
    specialties: [],
    portfolio: "",
    socialMedia: "",
    expectedEarnings: "",
  })

  const specialtyOptions = [
    "Writing Guides",
    "Ebook Creation",
    "Content Planning",
    "Book Marketing",
    "Publishing",
    "Design Templates",
    "Educational Content",
    "Business Resources",
  ]

  const benefits = [
    {
      icon: DollarSign,
      title: "Earn 70% Commission",
      description: "Keep the majority of your sales with our creator-friendly revenue split",
    },
    {
      icon: Users,
      title: "Built-in Audience",
      description: "Access thousands of writers, readers, and content creators",
    },
    {
      icon: TrendingUp,
      title: "Marketing Support",
      description: "We help promote your products through our channels",
    },
    {
      icon: Star,
      title: "Creator Tools",
      description: "Analytics, customer management, and promotional tools",
    },
  ]

  const handleSpecialtyToggle = (specialty) => {
    setFormData((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter((s) => s !== specialty)
        : [...prev.specialties, specialty],
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    console.log("Creator application submitted:", formData)
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

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-4">Become a Creator</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Join thousands of creators earning money by sharing their knowledge and resources with our community
            </p>
          </div>

          {/* Benefits */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {benefits.map((benefit) => (
              <Card key={benefit.title}>
                <CardContent className="p-6 text-center">
                  <benefit.icon className="h-8 w-8 mx-auto mb-3 text-purple-600" />
                  <h3 className="font-semibold mb-2">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Application Form */}
          <Card>
            <CardHeader>
              <CardTitle>Creator Application</CardTitle>
              <p className="text-muted-foreground">Tell us about yourself and what you&apos;d like to create</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      rows={3}
                      placeholder="Tell us about yourself and your background..."
                      value={formData.bio}
                      onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <Separator />

                {/* Experience & Specialties */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Experience & Expertise</h3>
                  <div>
                    <Label htmlFor="experience">Experience Level</Label>
                    <Select
                      value={formData.experience}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, experience: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select your experience level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner (0-2 years)</SelectItem>
                        <SelectItem value="intermediate">Intermediate (2-5 years)</SelectItem>
                        <SelectItem value="advanced">Advanced (5-10 years)</SelectItem>
                        <SelectItem value="expert">Expert (10+ years)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Specialties (Select all that apply)</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                      {specialtyOptions.map((specialty) => (
                        <div key={specialty} className="flex items-center space-x-2">
                          <Checkbox
                            id={specialty}
                            checked={formData.specialties.includes(specialty)}
                            onCheckedChange={() => handleSpecialtyToggle(specialty)}
                          />
                          <Label htmlFor={specialty} className="text-sm">
                            {specialty}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {formData.specialties.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {formData.specialties.map((specialty) => (
                          <Badge key={specialty} variant="secondary">
                            {specialty}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Portfolio & Social */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Portfolio & Social Presence</h3>
                  <div>
                    <Label htmlFor="portfolio">Portfolio/Website URL</Label>
                    <Input
                      id="portfolio"
                      type="url"
                      placeholder="https://your-website.com"
                      value={formData.portfolio}
                      onChange={(e) => setFormData((prev) => ({ ...prev, portfolio: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="socialMedia">Social Media Profile</Label>
                    <Input
                      id="socialMedia"
                      placeholder="Twitter, LinkedIn, or other professional profile"
                      value={formData.socialMedia}
                      onChange={(e) => setFormData((prev) => ({ ...prev, socialMedia: e.target.value }))}
                    />
                  </div>
                </div>

                <Separator />

                {/* Goals */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Goals & Expectations</h3>
                  <div>
                    <Label htmlFor="expectedEarnings">Expected Monthly Earnings Goal</Label>
                    <Select
                      value={formData.expectedEarnings}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, expectedEarnings: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select your earnings goal" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0-500">$0 - $500</SelectItem>
                        <SelectItem value="500-1000">$500 - $1,000</SelectItem>
                        <SelectItem value="1000-2500">$1,000 - $2,500</SelectItem>
                        <SelectItem value="2500-5000">$2,500 - $5,000</SelectItem>
                        <SelectItem value="5000+">$5,000+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Terms */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="terms" required />
                    <Label htmlFor="terms" className="text-sm">
                      I agree to the Creator Terms of Service and understand the commission structure
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="marketing" />
                    <Label htmlFor="marketing" className="text-sm">
                      I&apos;d like to receive marketing tips and creator resources via email
                    </Label>
                  </div>
                </div>

                <Button type="submit" size="lg" className="w-full">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Submit Application
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Next Steps */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>What Happens Next?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-xs font-bold text-purple-600">
                    1
                  </div>
                  <span className="text-sm">We&apos;ll review your application within 2-3 business days</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-xs font-bold text-purple-600">
                    2
                  </div>
                  <span className="text-sm">If approved, you&apos;ll receive an email with next steps</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-xs font-bold text-purple-600">
                    3
                  </div>
                  <span className="text-sm">Complete your creator profile and start uploading products</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
