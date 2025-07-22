"use client";
import React, { useState, useActionState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Star, Send, AlertCircle, List, ListOrdered, Bold as BoldIcon, Italic as ItalicIcon } from "lucide-react";
import { toast } from "sonner";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";
import { createProductReview } from "./action";

export default function ReviewBox({ onReviewSubmitted }) {
  const { data: session } = useSession();
  const params = useParams();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [state, formAction, isPending] = useActionState(createProductReview, {
    success: false,
    message: "",
    errors: {},
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Bold,
      Italic,
      BulletList.configure({
        HTMLAttributes: {
          class: "list-disc list-inside",
        },
      }),
      OrderedList.configure({
        HTMLAttributes: {
          class: "list-decimal list-inside",
        },
      }),
      ListItem,
    ],
    content: "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-[120px] p-3 border rounded-md",
      },
    },
    immediatelyRender:false
  });

  // Handle form submission with server action
  const handleSubmit = async (formData) => {
    if (!session) {
      toast.error("Please sign in to write a review");
      return;
    }

    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    const content = editor?.getHTML();
    if (!content || content.trim() === "<p></p>" || content.trim() === "") {
      toast.error("Please write your review");
      return;
    }

    // Add additional form data
    formData.append("productId", params.id);
    formData.append("rating", rating.toString());
    formData.append("title", title.trim());
    formData.append("content", content);

    // Call the server action
    await formAction(formData);
  };

  // Handle successful submission
  useEffect(() => {
    if (state.success) {
      toast.success(state.message || "Review submitted successfully!");
      // Reset form
      setRating(0);
      setTitle("");
      editor?.commands.clearContent();
      setShowEditor(false);
      // Refresh reviews
      if (onReviewSubmitted) {
        onReviewSubmitted();
      }
    } else if (state.message && !state.success) {
      toast.error(state.message);
    }
  }, [state, editor, onReviewSubmitted]);

  if (!session) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Sign in to write a review
          </h3>
          <p className="text-gray-500">
            Share your experience with other customers
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!editor) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5" />
          Write a Review
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Rating Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Rating *</Label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="p-1 hover:scale-110 transition-transform"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
              >
                <Star
                  className={`h-6 w-6 transition-colors ${
                    star <= (hoverRating || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300 hover:text-yellow-300"
                  }`}
                />
              </button>
            ))}
            {rating > 0 && (
              <span className="ml-2 text-sm text-gray-600">
                {rating === 1 && "Poor"}
                {rating === 2 && "Fair"}
                {rating === 3 && "Good"}
                {rating === 4 && "Very Good"}
                {rating === 5 && "Excellent"}
              </span>
            )}
          </div>
        </div>

        {/* Title Input */}
        <div className="space-y-2">
          <Label htmlFor="review-title" className="text-sm font-medium">
            Review Title (Optional)
          </Label>
          <Input
            id="review-title"
            placeholder="Summarize your review..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
          />
        </div>

        {/* Review Content */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Your Review *</Label>
            {!showEditor && (
              <Button
                type="button cursor-pointer"
                variant="outline"
                size="sm"
                onClick={() => setShowEditor(true)}
              >
                Start Writing
              </Button>
            )}
          </div>

          {showEditor && (
            <div className="space-y-3">
              {/* Editor Toolbar */}
              <div className="flex items-center gap-1 p-2 border rounded-md bg-gray-50">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  className={editor?.isActive("bold") ? "bg-gray-200" : ""}
                >
                  <BoldIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  className={editor?.isActive("italic") ? "bg-gray-200" : ""}
                >
                  <ItalicIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    editor?.chain().focus().toggleBulletList().run()
                  }
                  className={
                    editor?.isActive("bulletList") ? "bg-gray-200" : ""
                  }
                >
                  <List />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    editor?.chain().focus().toggleOrderedList().run()
                  }
                  className={
                    editor?.isActive("orderedList") ? "bg-gray-200" : ""
                  }
                >
                  <ListOrdered />
                </Button>
              </div>

              {/* Editor Content */}
              <div className="border rounded-md">
                <EditorContent
                  editor={editor}
                  className="min-h-[120px]"
                  placeholder="Share your experience with this product..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        {showEditor && (
          <form action={formAction} className="space-y-4">
            <div className="flex items-center gap-3">
              <Button
                type="submit"
                disabled={rating === 0}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Send className="h-4 w-4" />
                Submit Review
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowEditor(false);
                  setRating(0);
                  setTitle("");
                  editor?.commands.clearContent();
                }}
              >
                Cancel
              </Button>
            </div>
            <input type="hidden" name="productId" value={params?.id} />
            <input type="hidden" name="rating" value={rating} />
            <input type="hidden" name="title" value={title} />
            <input type="hidden" name="content" value={editor?.getHTML()} />
          </form>
        )}
      </CardContent>
    </Card>
  );
}
