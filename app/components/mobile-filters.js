"use client"

import { Button } from "../components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../components/ui/sheet"
import { Filter } from "lucide-react"
import FilterSidebar from "./filter-sidebar"


export default function MobileFilters({ filters, onFiltersChange, onClearFilters }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden">
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </SheetTrigger> 
      <SheetContent side="left" className="w-80">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          <FilterSidebar filters={filters} onFiltersChange={onFiltersChange} onClearFilters={onClearFilters} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
