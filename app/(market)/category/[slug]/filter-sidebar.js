"use client";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Checkbox } from "../../../components/ui/checkbox";
import { Label } from "../../../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../../../components/ui/radio-group";
import { Slider } from "../../../components/ui/slider";
import { Star } from "lucide-react";
import Link from "next/link";
import { useCategoryContext } from "./context";

export default function FilterCategorySidebar(props) {
  const { filters, onFiltersChange, onClearFilters } = props;
  const { category, tags } = useCategoryContext();
  // Category and tags are already the arrays from the API
  return (
    <div className="space-y-6">
      {/* Clear Filters */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Filters</h3>
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          Clear All
        </Button>
      </div>

      {/* Category */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Category</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {category ? (
            <div key={category.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={category.name}
                    checked={filters.category === category.name}
                    onCheckedChange={(checked) =>
                      onFiltersChange({
                        category: checked ? category.name : "All",
                        subcategory: "" // Clear subcategory when category changes
                      })
                    }
                  />
                  <Label htmlFor={category.name} className="text-sm font-normal">
                    {category.name}
                  </Label>
                </div>
                
              </div>
              {filters.category === category.name && category.MarketplaceSubCategories && (
                <div className="ml-6 mt-2 space-y-1">
                  {category.MarketplaceSubCategories.map((sub) => (
                    <div key={sub.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={sub.name}
                        checked={filters.subcategory === sub.name}
                        onCheckedChange={(checked) =>
                          onFiltersChange({
                            subcategory: checked ? sub.name : ""
                          })
                        }
                      />
                      <Label htmlFor={sub.name} className="text-xs text-muted-foreground">
                        {sub.name}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ): null}
        </CardContent>
      </Card>

      {/* Price Range */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Price Range</CardTitle>
        </CardHeader>
        <CardContent>
          <Slider
            value={[filters.minPrice || 0, filters.maxPrice || 1000]}
            onValueChange={(value) => onFiltersChange({ 
              minPrice: value[0], 
              maxPrice: value[1] 
            })}
            max={1000}
            min={0}
            step={5}
            className="w-full"
          />
          <div className="flex justify-between text-xs mt-2">
            <span>${filters.minPrice || 0}</span>
            <span>${filters.maxPrice || 1000}</span>
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
            value={filters.rating?.toString() || "0"}
            onValueChange={(value) => onFiltersChange({ rating: Number.parseFloat(value) })}
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
          {["PDF", "DOCX", "EPUB", "Notion Template", "Google Sheets", "Video", "Audio", "ZIP"].map((format) => (
            <div key={format} className="flex items-center space-x-2">
              <Checkbox
                id={format}
                checked={filters.fileType === format}
                onCheckedChange={(checked) =>
                  onFiltersChange({
                    fileType: checked ? format : "",
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

      {/* Tags */}
      {tags && tags.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Tags</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-48 overflow-y-auto">
            {tags.slice(0, 10).map((tag) => (
              <div key={tag.id} className="flex items-center space-x-2">
                <Checkbox
                  id={tag.name}
                  checked={filters.tag === tag.name}
                  onCheckedChange={(checked) =>
                    onFiltersChange({
                      tag: checked ? tag.name : "",
                    })
                  }
                />
                <Label htmlFor={tag.name} className="text-sm font-normal">
                  {tag.name}
                </Label>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
