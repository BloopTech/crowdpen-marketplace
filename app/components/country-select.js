"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import countries from "world-countries";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";

const countryList = countries.map((c) => ({
  value: c.name.common,
  label: c.name.common,
  flag: c.flag,
})).sort((a, b) => a.label.localeCompare(b.label));

export function CountrySelect({
  value,
  onChange,
  placeholder = "Select country...",
  dataTestId,
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          data-testid={dataTestId}
        >
          {value ? (
            <span className="flex items-center gap-2 truncate">
              <span className="text-base">{countryList.find((c) => c.value === value)?.flag}</span>
              {value}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search country..." />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {countryList.map((country) => (
                <CommandItem
                  key={country.value}
                  value={country.value}
                  onSelect={(currentValue) => {
                    // cmdk lowercases values, so we find the original case from our list
                    // or just use the passed value if we are careful.
                    // However, CommandItem value should be unique.
                    // We'll trust the country.value which is the common name.
                    // But cmdk might use the text content for filtering.
                    // Let's explicitly pass the original value to onChange
                    onChange(country.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === country.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="mr-2 text-base">{country.flag}</span>
                  {country.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
