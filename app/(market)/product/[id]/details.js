"use client";
import React from "react";
import { Avatar, AvatarFallback } from "../../../components/ui/avatar";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../../components/ui/tabs";
import { Award, CheckCircle, FileText, Star } from "lucide-react";
import Link from "next/link";
import { useProductItemContext } from "./context";
import ProductReviews from "./reviews";
import SafeHTML from "../../../components/SafeHTML";

export default function ProductDetails() {
  const { productItemData } = useProductItemContext();

  const reviews = [
    {
      id: "1",
      userName: "Sarah M.",
      rating: 5,
      comment:
        "Absolutely fantastic resource! This guide helped me launch my first book successfully. The templates are professional and easy to use.",
      date: "2024-01-10",
      verified: true,
    },
    {
      id: "2",
      userName: "Mike R.",
      rating: 4,
      comment:
        "Great content and very detailed. Would have liked more examples, but overall excellent value for money.",
      date: "2024-01-08",
      verified: true,
    },
    {
      id: "3",
      userName: "Emma L.",
      rating: 5,
      comment:
        "This is exactly what I needed to organize my content creation. The planner is beautifully designed and very practical.",
      date: "2024-01-05",
      verified: false,
    },
  ];

  return (
    <Tabs defaultValue="description" className="w-full" data-testid="product-details-tabs">
      <TabsList className="grid w-full grid-cols-4" data-testid="product-details-tabs-list">
        <TabsTrigger value="description" data-testid="product-details-tab-description">
          Description
        </TabsTrigger>
        <TabsTrigger value="contents" data-testid="product-details-tab-contents">
          What&apos;s Included
        </TabsTrigger>
        <TabsTrigger value="reviews" data-testid="product-details-tab-reviews">
          Reviews ({productItemData?.reviewCount})
        </TabsTrigger>
        <TabsTrigger value="author" data-testid="product-details-tab-author">
          About Author
        </TabsTrigger>
      </TabsList>

      <TabsContent value="description" className="mt-6" data-testid="product-details-content-description">
        <Card data-testid="product-details-description-card">
          <CardContent className="p-6" data-testid="product-details-description-content">
            <div className="prose max-w-none" data-testid="product-details-description-body">
              <SafeHTML
                html={productItemData?.description}
                className="text-lg mb-4 dark:text-white"
                data-testid="product-details-description-html"
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="contents" className="mt-6" data-testid="product-details-content-contents">
        <Card data-testid="product-details-contents-card">
          <CardContent className="p-6" data-testid="product-details-contents-content">
            <div className="flex items-center gap-3" data-testid="product-details-contents-row">
              <div className="font-medium" data-testid="product-details-contents-body">
                {productItemData?.what_included ? (
                  <SafeHTML html={productItemData.what_included} />
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="reviews" className="mt-6" data-testid="product-details-content-reviews">
        <div className="space-y-6" data-testid="product-details-reviews">
          <ProductReviews />
        </div>
      </TabsContent>

      <TabsContent value="author" className="mt-6" data-testid="product-details-content-author">
        <Card data-testid="product-details-author-card">
          <CardContent className="p-6" data-testid="product-details-author-content">
            <div className="flex items-start gap-4" data-testid="product-details-author-row">
              <Avatar
                className="h-16 w-16"
                color={productItemData?.User?.color}
                imageUrl={productItemData?.User?.image}
                initials={productItemData?.User?.name.charAt(0)}
                data-testid="product-details-author-avatar"
              >
                <AvatarFallback className="text-lg" data-testid="product-details-author-avatar-fallback">
                  {productItemData?.User?.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2" data-testid="product-details-author-name">
                  {productItemData?.User?.name}
                </h3>
                <div className="flex items-center gap-4 mb-4" data-testid="product-details-author-stats">
                  <div className="flex items-center gap-1" data-testid="product-details-author-rating">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm">
                      {Number(productItemData?.authorRating) === 1
                        ? `${Number(productItemData?.authorRating)} rating`
                        : `${Number(productItemData?.authorRating)} ratings`}
                    </span>
                  </div>
                  <span className="text-sm" data-testid="product-details-author-sales">
                    {Number(productItemData?.authorSales) === 1
                      ? `${Number(productItemData?.authorSales)} sale`
                      : `${Number(productItemData?.authorSales)} sales`}
                  </span>
                </div>
                <p className="text-muted-foreground mb-4" data-testid="product-details-author-description-other">
                  {productItemData?.User?.description_other}
                </p>
                <p className="text-muted-foreground mb-4" data-testid="product-details-author-description">
                  {productItemData?.User?.description}
                </p>
                <Link
                  href={`/author/${productItemData?.User?.pen_name}`}
                  data-testid="product-details-author-profile"
                >
                  <Button
                    variant="outline"
                    className="hover:bg-primary hover:text-white"
                    data-testid="product-details-author-profile-button"
                  >
                    View Profile
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
