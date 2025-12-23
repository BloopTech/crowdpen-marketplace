"use client";
import React, { useState, useActionState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  Star,
  Send,
  List,
  ListOrdered,
  Bold as BoldIcon,
  Italic as ItalicIcon,
  LoaderCircle,
  CheckCircle,
  MessageSquare,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";
import { upsertProductReview } from "./action";
import { useProductItemContext } from "./context";
import { useHome } from "../../../context";
import parser from "html-react-parser";
import { sanitizeHtml } from "../../../lib/sanitizeHtml";

export default function ReviewBox() {
  const { reviewsData, refetchReviews, refetchProductItem } = useProductItemContext();
  const { openLoginDialog } = useHome();
  const { data: session } = useSession();
  const params = useParams();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [content, setContent] = useState("");
  // Removed disabled state, deriving it during render instead
  const [open, setOpen] = useState(false);
  const [lastIntent, setLastIntent] = useState(null);
  const [promptToWrite, setPromptToWrite] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [initialRating, setInitialRating] = useState(0);
  const [initialTitle, setInitialTitle] = useState("");
  const [initialContent, setInitialContent] = useState("");
  const [state, formAction, isPending] = useActionState(upsertProductReview, {
    success: false,
    message: "",
    errors: {},
  });

  // Memoized sanitized content for safe submission
  const safeContent = React.useMemo(() => sanitizeHtml(content || ""), [content]);

  // Derive disabled state from content
  const htmlParser = content && typeof content === "string" && parser(content);
  const isContent = Array.isArray(htmlParser)
    ? htmlParser.some((item) => item.props?.children)
    : htmlParser?.props?.children;
  const disabled = !(content && isContent);

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
    content,
    onUpdate: async ({ editor }) => {
      const json = editor.getHTML();
      setContent(json);
    },
    parseOptions: {
      preserveWhitespace: "full",
    },
    editorProps: {
      attributes: {
        spellcheck: true,
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-[120px] p-3 border rounded-md",
      },
    },
    immediatelyRender: false,
  });

  // Current user's review from API (returned on first page)
  const currentUserReview = reviewsData?.pages?.[0]?.data?.currentUserReview || null;

  // Seed form/editor from existing review so user can edit
  useEffect(() => {
    if (!editor) return;
    if (currentUserReview) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsEditing(true);
      setRating(currentUserReview.rating || 0);
      setTitle(currentUserReview.title || "");
      const existing = currentUserReview.content || "";
      setContent(existing);
      editor.commands.setContent(existing || "");
      setShowEditor(!!existing);
      setInitialRating(currentUserReview.rating || 0);
      setInitialTitle(currentUserReview.title || "");
      setInitialContent(existing || "");
    } else {
      setIsEditing(false);
      setInitialRating(0);
      setInitialTitle("");
      setInitialContent("");
    }
  }, [currentUserReview, editor]);

  // When dialog opens, re-seed state from currentUserReview to avoid stale resets
  useEffect(() => {
    if (!open || !editor) return;
    if (currentUserReview) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsEditing(true);
      setRating(currentUserReview.rating || 0);
      setTitle(currentUserReview.title || "");
      const existing = currentUserReview.content || "";
      setContent(existing);
      editor.commands.setContent(existing || "");
      setShowEditor(!!existing);
      setInitialRating(currentUserReview.rating || 0);
      setInitialTitle(currentUserReview.title || "");
      setInitialContent(existing || "");
    } else {
      setIsEditing(false);
      setRating(0);
      setTitle("");
      setContent("");
      editor.commands.clearContent();
      setShowEditor(false);
      setInitialRating(0);
      setInitialTitle("");
      setInitialContent("");
    }
  }, [open, currentUserReview, editor]);

  // Clear transient intent/prompt when dialog closes
  // Moved to handleOpenChange
  // useEffect(() => {
  //   if (!open) {
  //     setPromptToWrite(false);
  //     setLastIntent(null);
  //   }
  // }, [open]);

  // Derived disabled state replaced useEffect
  // useEffect(() => {
  //   const htmlParser =
  //     content && typeof content === "string" && parser(content);
  //   const isContent = Array.isArray(htmlParser)
  //     ? htmlParser.some((item) => item.props?.children)
  //     : htmlParser?.props?.children;
  //
  //   if (content && isContent) {
  //     setDisabled(false);
  //   } else {
  //     setDisabled(true);
  //   }
  // }, [content]);

  // Guard closing the dialog if there are unsaved changes
  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) {
      setPromptToWrite(false);
      setLastIntent(null);
      if (isPending) return;
      const isDirty =
        rating !== initialRating ||
        title !== initialTitle ||
        content !== initialContent;
      // If user just saved a rating and we are prompting to write, allow close without confirm
      if (isDirty && !promptToWrite) {
        const discard = typeof window !== 'undefined' && window.confirm("Discard your unsaved changes?");
        if (!discard) return;
      }
    }
    setOpen(nextOpen);
  };

  // Handle successful submission
  useEffect(() => {
    if (state.success) {
      toast.success(state.message || (isEditing ? "Review updated successfully!" : "Review submitted successfully!"));
      // Refresh reviews to update statistics and user review state
      refetchReviews();
      refetchProductItem?.();

      if (lastIntent === 'rating_only') {
        // Keep dialog open and prompt to write a full review
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPromptToWrite(true);
      } else {
        // Full review publish or edit — reset and close
        setTitle("");
        editor?.commands.clearContent();
        setShowEditor(false);
        setOpen(false);
        setPromptToWrite(false);
      }
      // clear last intent
      setLastIntent(null);
    } else if (state.message && !state.success) {
      toast.error(state.message);
    }
  }, [state, editor, refetchReviews, refetchProductItem, lastIntent, isEditing]);

  const handleCancel = () => {
    setShowEditor(false);
    setRating(0);
    setTitle("");
    editor?.commands.clearContent();
    setOpen(false);
    setPromptToWrite(false);
    setLastIntent(null);
  };

  if (!session) {
    return (
      <div className="flex justify-center">
        <Button 
          onClick={openLoginDialog}
          className="bg-tertiary hover:bg-tertiary/90 text-white font-medium px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          size="lg"
        >
          <MessageSquare className="h-5 w-5 mr-2" />
          Sign in to Write a Review
        </Button>
      </div>
    );
  }

  if (!editor) {
    return null;
  }

  return (
    <div className="flex justify-center">
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button 
            className="bg-tertiary hover:bg-tertiary/90 text-white font-medium px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            size="lg"
          >
            <MessageSquare className="h-5 w-5 mr-2" />
            {(isEditing || !!currentUserReview) ? 'Edit your review' : 'Rate this product'}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white border-0 shadow-2xl">
          <DialogHeader className="space-y-3 pb-6 border-b border-gray-100 relative">
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-8 w-8 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
            <DialogTitle className="text-2xl font-bold text-primary flex items-center gap-3 pr-10">
              <div className="p-2 bg-tertiary rounded-full">
                <Star className="h-6 w-6 text-white" />
              </div>
              {isEditing ? 'Edit your review' : 'Rate & Review this product'}
            </DialogTitle>
            <DialogDescription className="text-gray-600 text-base leading-relaxed">
              Help other customers by sharing your honest review of this product. Your feedback matters!
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-8 py-6">
            {/* Context Banners and Stepper */}
            {isEditing && (
              <div className="rounded-lg bg-amber-50 text-amber-700 text-sm px-3 py-2 border border-amber-200">
                You&apos;re editing your existing review. Saving will replace your previous review.
              </div>
            )}
            <div className="flex items-center justify-center gap-3 text-xs sm:text-sm text-gray-600">
              <div className={`px-3 py-1 rounded-full border ${rating > 0 ? 'bg-tertiary text-white border-tertiary' : 'bg-gray-100'}`}>
                <span className="font-medium">Step 1</span> • Rate
              </div>
              <span className="text-gray-400">→</span>
              <div className={`px-3 py-1 rounded-full border ${showEditor ? 'bg-tertiary text-white border-tertiary' : 'bg-gray-100'}`}>
                <span className="font-medium">Step 2</span> • Write
              </div>
            </div>
            {/* Rating Selection */}
            <div className="space-y-4">
              <Label className="text-lg font-semibold text-gray-800">How would you rate this product? *</Label>
              <p className="text-sm text-gray-500">You can submit just a rating now and optionally write a review later.</p>
              <div className="flex flex-col items-center gap-4 p-6 bg-white/60 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className="p-2 hover:scale-125 transition-all duration-200 rounded-full hover:bg-yellow-50"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                    >
                      <Star
                        className={`h-8 w-8 transition-all duration-200 ${
                          star <= (hoverRating || rating)
                            ? "fill-yellow-400 text-yellow-400 drop-shadow-sm"
                            : "text-gray-300 hover:text-yellow-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-tertiary">
                      {rating === 1 && "Poor"}
                      {rating === 2 && "Fair"}
                      {rating === 3 && "Good"}
                      {rating === 4 && "Very Good"}
                      {rating === 5 && "Excellent"}
                    </span>
                    <span className="text-sm text-gray-500">({rating}/5 stars)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick submit for rating-only */}
            {rating > 0 && !showEditor && (
              <div className="flex items-center gap-3">
                <form
                  action={session?.user?.id ? formAction : openLoginDialog}
                >
                  <input type="hidden" name="productId" value={params?.id} />
                  <input type="hidden" name="rating" value={rating} />
                  <input type="hidden" name="title" value="" />
                  <input type="hidden" name="content" value="" />
                  <Button
                    type="submit"
                    onClick={() => setLastIntent('rating_only')}
                    disabled={isPending}
                    className="bg-tertiary hover:bg-tertiary/90 text-white"
                  >
                    {isPending ? 'Saving rating...' : (isEditing ? 'Update rating' : 'Submit rating')}
                  </Button>
                </form>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setShowEditor(true); setPromptToWrite(false); }}
                >
                  Write a review
                </Button>
              </div>
            )}

            {/* Prompt to optionally write after rating-only */}
            {promptToWrite && !showEditor && (
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 text-gray-700">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Thanks! Your rating has been saved. Would you like to add a written review?
                  </p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" disabled={isPending} onClick={() => { setShowEditor(true); setPromptToWrite(false); }}>
                      Write now
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setPromptToWrite(false); }}>
                      Not now
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {showEditor && (
              <div className="space-y-4">
                {/* Title Input */}
                <div className="space-y-3">
                  <Label htmlFor="review-title" className="text-lg font-semibold text-gray-800">
                    Give your review a title (Optional)
                  </Label>
                  <Input
                    id="review-title"
                    placeholder="What&apos;s the most important thing to know?"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={100}
                    className="h-12 text-base border-2 border-gray-200 rounded-xl focus:border-tertiary focus:ring-2 focus:ring-tertiary/20 transition-all duration-200 bg-white/80"
                  />
                </div>
                {/* Editor Toolbar */}
                <div className="flex items-center gap-2 p-3 bg-white/80 rounded-xl border-2 border-gray-100 shadow-sm">
                  <span className="text-sm font-medium text-gray-600 mr-2">Format:</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor?.chain().focus().toggleBold().run()}
                    className={`rounded-lg transition-all duration-200 ${
                      editor?.isActive("bold") 
                        ? "bg-tertiary text-white shadow-sm" 
                        : "hover:bg-tertiary/10 hover:text-tertiary"
                    }`}
                  >
                    <BoldIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor?.chain().focus().toggleItalic().run()}
                    className={`rounded-lg transition-all duration-200 ${
                      editor?.isActive("italic") 
                        ? "bg-tertiary text-white shadow-sm" 
                        : "hover:bg-tertiary/10 hover:text-tertiary"
                    }`}
                  >
                    <ItalicIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      editor?.chain().focus().toggleBulletList().run()
                    }
                    className={`rounded-lg transition-all duration-200 ${
                      editor?.isActive("bulletList") 
                        ? "bg-tertiary text-white shadow-sm" 
                        : "hover:bg-tertiary/10 hover:text-tertiary"
                    }`}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      editor?.chain().focus().toggleOrderedList().run()
                    }
                    className={`rounded-lg transition-all duration-200 ${
                      editor?.isActive("orderedList") 
                        ? "bg-tertiary text-white shadow-sm" 
                        : "hover:bg-tertiary/10 hover:text-tertiary"
                    }`}
                  >
                    <ListOrdered className="h-4 w-4" />
                  </Button>
                </div>

                {/* Editor Content */}
                <div className="bg-white/80 border-2 border-gray-200 rounded-xl focus-within:border-tertiary focus-within:ring-2 focus-within:ring-tertiary/20 transition-all duration-200 shadow-sm">
                  <EditorContent
                    editor={editor}
                    className="min-h-[150px] p-4"
                    placeholder="Share your experience with this product..."
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            {showEditor && (
              <form
                action={session?.user?.id ? formAction : openLoginDialog}
                className="space-y-6 pt-6 border-t border-gray-100"
              >
                <div className="flex items-center gap-4">
                  <Button
                    type="submit"
                    onClick={() => setLastIntent('full_review')}
                    disabled={rating === 0 || isPending || disabled}
                    className="flex-1 bg-tertiary hover:bg-tertiary/90 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    size="lg"
                  >
                    {isPending ? (
                      <>
                        <LoaderCircle className="h-5 w-5 animate-spin mr-2" />
                        {isEditing ? 'Saving Changes...' : 'Publishing Review...'}
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5 mr-2" />
                        {isEditing ? 'Save Changes' : 'Publish Review'}
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    className="border-2 border-gray-300 text-gray-600 hover:bg-gray-50 font-medium py-3 px-6 rounded-xl transition-all duration-200"
                    size="lg"
                  >
                    Cancel
                  </Button>
                </div>
                <input type="hidden" name="productId" value={params?.id} />
                <input type="hidden" name="rating" value={rating} />
                <input type="hidden" name="title" value={title} />
                <input type="hidden" name="content" value={safeContent} />
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
