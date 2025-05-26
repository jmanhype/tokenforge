import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Post a new comment
export const postComment = mutation({
  args: {
    tokenId: v.id("memeCoins"),
    content: v.string(),
    parentId: v.optional(v.id("comments")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Validate content
    const content = args.content.trim();
    if (content.length === 0) {
      throw new Error("Comment cannot be empty");
    }
    if (content.length > 500) {
      throw new Error("Comment must be less than 500 characters");
    }

    // Check if parent comment exists
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent || parent.isDeleted) {
        throw new Error("Parent comment not found");
      }
    }

    // Create comment
    const commentId = await ctx.db.insert("comments", {
      tokenId: args.tokenId,
      userId,
      content,
      timestamp: Date.now(),
      likes: 0,
      parentId: args.parentId,
    });

    // Add to activity feed
    await ctx.db.insert("activityFeed", {
      userId,
      type: "comment_posted",
      tokenId: args.tokenId,
      data: { commentId, content: content.substring(0, 100) },
      timestamp: Date.now(),
    });

    return commentId;
  },
});

// Get comments for a token
export const getComments = query({
  args: {
    tokenId: v.id("memeCoins"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    const cursor = args.cursor || Date.now();

    // Get top-level comments
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_token_timestamp", (q) =>
        q.eq("tokenId", args.tokenId).lt("timestamp", cursor)
      )
      .filter((q) => q.eq(q.field("parentId"), undefined))
      .order("desc")
      .take(limit);

    // Get user info and likes for each comment
    const commentsWithDetails = await Promise.all(
      comments.map(async (comment) => {
        const user = await ctx.db.get(comment.userId);
        const currentUserId = await getAuthUserId(ctx);
        
        let hasLiked = false;
        if (currentUserId) {
          const like = await ctx.db
            .query("commentLikes")
            .withIndex("by_comment_user", (q) =>
              q.eq("commentId", comment._id).eq("userId", currentUserId)
            )
            .first();
          hasLiked = !!like;
        }

        // Get reply count
        const replies = await ctx.db
          .query("comments")
          .withIndex("by_parent", (q) => q.eq("parentId", comment._id))
          .collect();
        const replyCount = replies.filter(r => !r.isDeleted).length;

        return {
          ...comment,
          userName: user?.name || user?.email || "Anonymous",
          userImage: user?.image,
          hasLiked,
          replyCount,
        };
      })
    );

    return {
      comments: commentsWithDetails,
      hasMore: comments.length === limit,
      nextCursor: comments.length > 0 ? comments[comments.length - 1].timestamp : undefined,
    };
  },
});

// Get replies to a comment
export const getReplies = query({
  args: {
    parentId: v.id("comments"),
  },
  handler: async (ctx, args) => {
    const replies = await ctx.db
      .query("comments")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .order("asc")
      .collect();

    const repliesWithDetails = await Promise.all(
      replies.map(async (reply) => {
        const user = await ctx.db.get(reply.userId);
        const currentUserId = await getAuthUserId(ctx);
        
        let hasLiked = false;
        if (currentUserId) {
          const like = await ctx.db
            .query("commentLikes")
            .withIndex("by_comment_user", (q) =>
              q.eq("commentId", reply._id).eq("userId", currentUserId)
            )
            .first();
          hasLiked = !!like;
        }

        return {
          ...reply,
          userName: user?.name || user?.email || "Anonymous",
          userImage: user?.image,
          hasLiked,
        };
      })
    );

    return repliesWithDetails.filter(r => !r.isDeleted);
  },
});

// Like/unlike a comment
export const toggleCommentLike = mutation({
  args: {
    commentId: v.id("comments"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const comment = await ctx.db.get(args.commentId);
    if (!comment || comment.isDeleted) {
      throw new Error("Comment not found");
    }

    // Check if already liked
    const existingLike = await ctx.db
      .query("commentLikes")
      .withIndex("by_comment_user", (q) =>
        q.eq("commentId", args.commentId).eq("userId", userId)
      )
      .first();

    if (existingLike) {
      // Unlike
      await ctx.db.delete(existingLike._id);
      await ctx.db.patch(args.commentId, {
        likes: Math.max(0, comment.likes - 1),
      });
      return { liked: false };
    } else {
      // Like
      await ctx.db.insert("commentLikes", {
        commentId: args.commentId,
        userId,
        timestamp: Date.now(),
      });
      await ctx.db.patch(args.commentId, {
        likes: comment.likes + 1,
      });
      return { liked: true };
    }
  },
});

// Edit a comment
export const editComment = mutation({
  args: {
    commentId: v.id("comments"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const comment = await ctx.db.get(args.commentId);
    if (!comment || comment.isDeleted) {
      throw new Error("Comment not found");
    }

    if (comment.userId !== userId) {
      throw new Error("Not authorized to edit this comment");
    }

    // Validate content
    const content = args.content.trim();
    if (content.length === 0) {
      throw new Error("Comment cannot be empty");
    }
    if (content.length > 500) {
      throw new Error("Comment must be less than 500 characters");
    }

    await ctx.db.patch(args.commentId, {
      content,
      editedAt: Date.now(),
    });
  },
});

// Delete a comment (soft delete)
export const deleteComment = mutation({
  args: {
    commentId: v.id("comments"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const comment = await ctx.db.get(args.commentId);
    if (!comment || comment.isDeleted) {
      throw new Error("Comment not found");
    }

    if (comment.userId !== userId) {
      throw new Error("Not authorized to delete this comment");
    }

    await ctx.db.patch(args.commentId, {
      isDeleted: true,
      content: "[deleted]",
    });
  },
});

// Get comment count for a token
export const getCommentCount = query({
  args: {
    tokenId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .collect();

    return comments.filter(c => !c.isDeleted).length;
  },
});