"use client"

import React, { useState, useRef }  from "react";

import { Search, TrendingUp, Zap } from "lucide-react"
import { Input } from "../components/ui/input"
import { Button } from "../components/ui/button"
import { trendingSearches, searchOperators } from "@/lib/data"

export default function GoogleSearchBar({
  value,
  onChange,
  onSearch,
  suggestions,
  showSuggestions,
  onSuggestionClick,
}) {
  const [showHelp, setShowHelp] = useState(false)
  const inputRef = useRef(null)

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      onSearch(value)
    }
    if (e.key === "Escape") {
      inputRef.current?.blur()
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto relative">
      {/* Main Search Bar */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search creator resources..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-12 pr-20 h-14 text-lg border-2 rounded-full shadow-sm focus:shadow-md transition-shadow"
          />
          <div className="absolute right-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHelp(!showHelp)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <Zap className="h-3 w-3 mr-1" />
              Tips
            </Button>
            <Button onClick={() => onSearch(value)} size="sm" className="rounded-full">
              Search
            </Button>
          </div>
        </div>

        {/* Search Help Tooltip */}
        {showHelp && (
          <div className="absolute top-full mt-2 right-0 bg-popover border rounded-lg shadow-lg p-4 w-80 z-50">
            <h4 className="font-semibold mb-2">Search Tips</h4>
            <div className="space-y-2 text-sm">
              {searchOperators.map((op) => (
                <div key={op.operator} className="flex justify-between">
                  <code className="bg-muted px-1 rounded text-xs">{op.example}</code>
                  <span className="text-muted-foreground">{op.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && (value.length > 0 || suggestions.length > 0) && (
        <div className="absolute top-full mt-2 w-full bg-popover border rounded-lg shadow-lg z-40 max-h-96 overflow-y-auto">
          {/* Auto-complete suggestions */}
          {suggestions.length > 0 && (
            <div className="p-2">
              <div className="text-xs text-muted-foreground mb-2 px-2">Suggestions</div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => onSuggestionClick(suggestion)}
                  className="w-full text-left px-3 py-2 hover:bg-muted rounded-md flex items-center gap-2"
                >
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <span>{suggestion}</span>
                </button>
              ))}
            </div>
          )}

          {/* Trending searches when no input */}
          {value.length === 0 && (
            <div className="p-2">
              <div className="text-xs text-muted-foreground mb-2 px-2 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Trending
              </div>
              {trendingSearches.map((trend, index) => (
                <button
                  key={index}
                  onClick={() => onSuggestionClick(trend)}
                  className="w-full text-left px-3 py-2 hover:bg-muted rounded-md flex items-center gap-2"
                >
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span>{trend}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
