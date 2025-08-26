"use client";
import React from "react";
import { useProductItemContext } from "./context";
import { Card, CardContent } from "../../../components/ui/card";
import { Avatar, AvatarFallback } from "../../../components/ui/avatar";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Star, CheckCircle, ThumbsUp, MessageSquare, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import useInfiniteScroll from "react-infinite-scroll-hook";
import ReviewBox from "./reviewBox";

export default function ProductReviews() {
  const { 
    reviewsLoading, 
    reviewsError, 
    reviewsData, 
    refetchReviews,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
  } = useProductItemContext();

  // Infinite scroll hook
  const [sentryRef] = useInfiniteScroll({
    loading: isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    onLoadMore: fetchNextPage,
    disabled: !!reviewsError,
    rootMargin: '0px 0px 400px 0px',
  });

  if (reviewsLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-1/4"></div>
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-1/6"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (reviewsError) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 mb-4">Failed to load reviews</p>
        <Button onClick={() => refetchReviews()} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  // Flatten all reviews from all pages
  const allReviews = reviewsData?.pages?.flatMap(page => page?.data?.reviews || []) || [];
  // Get statistics from the first page (they're the same across all pages)
  const statistics = reviewsData?.pages?.[0]?.data?.statistics || {};

  return (
    <div className="space-y-6">
      {/* Review Statistics */}
      {statistics.totalReviews > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Customer Reviews</h3>
            <div className="flex items-center gap-2">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${
                      i < Math.round(statistics.averageRating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                ))}
              </div>
              <span className="text-lg font-medium">{statistics.averageRating}</span>
              <span className="text-sm text-muted-foreground">
                ({statistics.totalReviews} review{statistics.totalReviews !== 1 ? 's' : ''})
              </span>
            </div>
          </div>
          
          {/* Rating Distribution */}
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = statistics.ratingDistribution?.[rating] || 0;
              const percentage = statistics.totalReviews > 0 ? (count / statistics.totalReviews) * 100 : 0;
              
              return (
                <div key={rating} className="flex items-center gap-2 text-sm">
                  <span className="w-8">{rating}</span>
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-yellow-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <span className="w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Write Review Section */}
      <div className="flex justify-center">
        <ReviewBox />
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Reviews ({statistics.totalReviews || 0})
          </h3>
        </div>

        {allReviews.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No reviews yet</h4>
            <p className="text-gray-500 mb-4">Be the first to share your thoughts about this product!</p>
          </div>
        ) : (
          <>
            {allReviews.map((review) => (
              <Card key={review.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="bg-gradient-to-r from-blue-500 to-purple-500">
                      <AvatarFallback className="text-white font-medium">
                        {review.user.name?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-gray-900">{review.user.name || 'Anonymous'}</span>
                        {review.verifiedPurchase && (
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Verified Purchase
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < review.rating
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      {review.title && (
                        <h4 className="font-medium text-gray-900 mb-2">{review.title}</h4>
                      )}
                      <div 
                        className="text-gray-700 leading-relaxed prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: review.content }}
                      />
                      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
                        <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
                          <ThumbsUp className="h-4 w-4 mr-1" />
                          Helpful ({review.helpful})
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {/* Infinite scroll loading indicator and sentry */}
            {(hasNextPage || isFetchingNextPage) && (
              <div ref={sentryRef} className="flex justify-center py-8">
                {isFetchingNextPage ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading more reviews...</span>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    onClick={() => fetchNextPage()}
                    disabled={!hasNextPage}
                  >
                    Load More Reviews
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}