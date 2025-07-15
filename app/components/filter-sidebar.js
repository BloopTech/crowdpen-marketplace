"use client"

import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Checkbox } from "../components/ui/checkbox"
import { Label } from "../components/ui/label"
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group"
import { Slider } from "../components/ui/slider"
import { Star } from "lucide-react"
import { categories } from "../lib/data"

import Link from "next/link"



export default function FilterSidebar({ filters, onFiltersChange, onClearFilters }) {
  return (
    <div className="space-y-6">
      {/* Clear Filters */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Filters</h3>
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          Clear All
        </Button>
      </div>

      {/* Categories */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Category</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {categories.map((category) => (
            <div key={category.name}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={category.name}
                    checked={filters.category === category.name}
                    onCheckedChange={(checked) =>
                      onFiltersChange({
                        ...filters,
                        category: checked ? category.name : "All",
                      })
                    }
                  />
                  <Label htmlFor={category.name} className="text-sm font-normal">
                    {category.name}
                  </Label>
                </div>
                <Link href={`/category/${category.name.toLowerCase().replace(/\s+/g, "-")}`}>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-xs">
                    →
                  </Button>
                </Link>
              </div>
              {filters.category === category.name && (
                <div className="ml-6 mt-2 space-y-1">
                  {category.subcategories.map((sub) => (
                    <div key={sub} className="flex items-center space-x-2">
                      <Checkbox id={sub} />
                      <Label htmlFor={sub} className="text-xs text-muted-foreground">
                        {sub}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Price Range */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Price Range</CardTitle>
        </CardHeader>
        <CardContent>
          <Slider
            value={filters?.priceRange}
            onValueChange={(value) => onFiltersChange({ ...filters, priceRange: value })}
            max={200}
            min={0}
            step={5}
            className="w-full"
            defaultValue={[filters?.priceRange?.length ? filters?.priceRange[0] : 0, filters?.priceRange?.length ? filters?.priceRange[1] : 200]}
          />
          <div className="flex justify-between text-xs mt-2">
            <span>${filters?.priceRange?.length ? filters?.priceRange[0] : 0}</span>
            <span>${filters?.priceRange?.length ? filters?.priceRange[1] : 200}</span>
          </div>
        </CardContent>
      </Card>

      {/* Customer Rating */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Customer Rating</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={filters.rating.toString()}
            onValueChange={(value) => onFiltersChange({ ...filters, rating: Number.parseFloat(value) })}
          >
            {[4, 3, 2, 1].map((rating) => (
              <div key={rating} className="flex items-center space-x-2">
                <RadioGroupItem value={rating.toString()} id={`rating-${rating}`} />
                <Label htmlFor={`rating-${rating}`} className="flex items-center gap-1">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3 w-3 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                      />
                    ))}
                  </div>
                  <span className="text-sm">& Up</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* File Format */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">File Format</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {["PDF", "DOCX", "EPUB", "Notion Template", "Google Sheets"].map((format) => (
            <div key={format} className="flex items-center space-x-2">
              <Checkbox
                id={format}
                checked={filters.license === format}
                onCheckedChange={(checked) =>
                  onFiltersChange({
                    ...filters,
                    license: checked ? format : "",
                  })
                }
              />
              <Label htmlFor={format} className="text-sm font-normal">
                {format}
              </Label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Content Length */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Content Length</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {["Quick Read (< 30 min)", "Medium Read (30-60 min)", "Long Read (1+ hours)", "Comprehensive Guide"].map(
            (length) => (
              <div key={length} className="flex items-center space-x-2">
                <Checkbox
                  id={length}
                  checked={filters.deliveryTime === length}
                  onCheckedChange={(checked) =>
                    onFiltersChange({
                      ...filters,
                      deliveryTime: checked ? length : "",
                    })
                  }
                />
                <Label htmlFor={length} className="text-sm font-normal">
                  {length}
                </Label>
              </div>
            ),
          )}
        </CardContent>
      </Card>
    </div>
  )
}
