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
    <Tabs defaultValue="description" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="description">Description</TabsTrigger>
        <TabsTrigger value="contents">What&apos;s Included</TabsTrigger>
        <TabsTrigger value="reviews">
          Reviews ({productItemData?.reviewCount})
        </TabsTrigger>
        <TabsTrigger value="author">About Author</TabsTrigger>
      </TabsList>

      <TabsContent value="description" className="mt-6">
        <Card>
          <CardContent className="p-6">
            <div className="prose max-w-none">
              <p className="text-lg mb-4">{productItemData?.description}</p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="contents" className="mt-6">
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium">{productItemData?.fileType}</div>
                  <div className="text-sm text-muted-foreground">
                    200 pages of comprehensive content
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-green-600" />
                <div>
                  <div className="font-medium">Bonus Templates</div>
                  <div className="text-sm text-muted-foreground">
                    15 ready-to-use templates
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-purple-600" />
                <div>
                  <div className="font-medium">Checklists & Worksheets</div>
                  <div className="text-sm text-muted-foreground">
                    Step-by-step action items
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Award className="h-5 w-5 text-orange-600" />
                <div>
                  <div className="font-medium">Bonus Resources</div>
                  <div className="text-sm text-muted-foreground">
                    Exclusive tools and resources
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="reviews" className="mt-6">
        <div className="space-y-6">
          {/* {reviews?.map((review) => (
            <Card key={review.id}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Avatar color="bg-red-500">
                    <AvatarFallback>{review.userName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium">{review.userName}</span>
                      {review.verified && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Verified Purchase
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${
                              i < review.rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {review.date}
                      </span>
                    </div>
                    <p className="text-sm">{review.comment}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))} */}

          <ProductReviews />
        </div>
      </TabsContent>

      <TabsContent value="author" className="mt-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Avatar
                className="h-16 w-16"
                color={productItemData?.User?.color}
                imageUrl={productItemData?.User?.image}
                initials={productItemData?.User?.name.charAt(0)}
              >
                <AvatarFallback className="text-lg">
                  {productItemData?.User?.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">
                  {productItemData?.User?.name}
                </h3>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm">
                      {Number(productItemData?.authorRating) === 1
                        ? `${Number(productItemData?.authorRating)} rating`
                        : `${Number(productItemData?.authorRating)} ratings`}
                    </span>
                  </div>
                  <span className="text-sm">
                    {Number(productItemData?.authorSales) === 1
                      ? `${Number(productItemData?.authorSales)} sale`
                      : `${Number(productItemData?.authorSales)} sales`}
                  </span>
                </div>
                <p className="text-muted-foreground mb-4">
                  {productItemData?.User?.description_other}
                </p>
                <p className="text-muted-foreground mb-4">
                  {productItemData?.User?.description}
                </p>
                <Link href={`/author/${productItemData?.User?.pen_name}`}>
                  <Button
                    variant="outline"
                    className="hover:bg-primary hover:text-white"
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
  );}
