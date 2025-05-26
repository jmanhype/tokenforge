import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { Send, Heart, Reply, Edit, Trash, MoreVertical } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CommentSectionProps {
  tokenId: Id<"memeCoins">;
}

interface Comment {
  _id: Id<"comments">;
  content: string;
  timestamp: number;
  likes: number;
  userName: string;
  userImage?: string;
  hasLiked: boolean;
  replyCount: number;
  parentId?: Id<"comments">;
  isDeleted?: boolean;
  editedAt?: number;
}

export default function CommentSection({ tokenId }: CommentSectionProps) {
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<Id<"comments"> | null>(null);
  const [editingId, setEditingId] = useState<Id<"comments"> | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showReplies, setShowReplies] = useState<Set<Id<"comments">>>(new Set());

  // Queries
  const commentsQuery = useQuery(api.social.comments.getComments, { tokenId });
  const user = useQuery(api.auth.loggedInUser);

  // Mutations
  const postComment = useMutation(api.social.comments.postComment);
  const toggleLike = useMutation(api.social.comments.toggleCommentLike);
  const editComment = useMutation(api.social.comments.editComment);
  const deleteComment = useMutation(api.social.comments.deleteComment);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await postComment({
        tokenId,
        content: newComment,
        parentId: replyTo || undefined,
      });
      setNewComment("");
      setReplyTo(null);
      toast.success("Comment posted!");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleLike = async (commentId: Id<"comments">) => {
    try {
      const result = await toggleLike({ commentId });
      if (result.liked) {
        toast("❤️ Liked");
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleEdit = async (commentId: Id<"comments">) => {
    if (!editContent.trim()) return;

    try {
      await editComment({
        commentId,
        content: editContent,
      });
      setEditingId(null);
      setEditContent("");
      toast.success("Comment updated");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (commentId: Id<"comments">) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    try {
      await deleteComment({ commentId });
      toast.success("Comment deleted");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (!commentsQuery) {
    return (
      <div className="animate-pulse">
        <div className="h-32 bg-gray-200 rounded-lg mb-4"></div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  const { comments, hasMore } = commentsQuery;

  return (
    <div className="space-y-6">
      {/* Comment Form */}
      {user && (
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={replyTo ? "Write a reply..." : "Share your thoughts..."}
            className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            rows={3}
          />
          {replyTo && (
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="absolute top-2 right-12 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel reply
            </button>
          )}
          <button
            type="submit"
            disabled={!newComment.trim()}
            className="absolute bottom-3 right-3 p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* Comments List */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No comments yet. Be the first to share your thoughts!</p>
          </div>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment._id}
              comment={comment}
              currentUserId={user?._id}
              onReply={() => setReplyTo(comment._id)}
              onEdit={(id, content) => {
                setEditingId(id);
                setEditContent(content);
              }}
              onLike={handleLike}
              onDelete={handleDelete}
              showReplies={showReplies}
              setShowReplies={setShowReplies}
              editingId={editingId}
              editContent={editContent}
              setEditContent={setEditContent}
              onSaveEdit={handleEdit}
              onCancelEdit={() => {
                setEditingId(null);
                setEditContent("");
              }}
            />
          ))
        )}
      </div>

      {hasMore && (
        <button className="w-full py-2 text-purple-600 hover:text-purple-700 font-medium">
          Load more comments
        </button>
      )}
    </div>
  );
}

interface CommentItemProps {
  comment: Comment;
  currentUserId?: Id<"users">;
  onReply: () => void;
  onEdit: (id: Id<"comments">, content: string) => void;
  onLike: (id: Id<"comments">) => void;
  onDelete: (id: Id<"comments">) => void;
  showReplies: Set<Id<"comments">>;
  setShowReplies: React.Dispatch<React.SetStateAction<Set<Id<"comments">>>>;
  editingId: Id<"comments"> | null;
  editContent: string;
  setEditContent: (content: string) => void;
  onSaveEdit: (id: Id<"comments">) => void;
  onCancelEdit: () => void;
}

function CommentItem({
  comment,
  currentUserId,
  onReply,
  onEdit,
  onLike,
  onDelete,
  showReplies,
  setShowReplies,
  editingId,
  editContent,
  setEditContent,
  onSaveEdit,
  onCancelEdit,
}: CommentItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const replies = useQuery(
    api.social.comments.getReplies,
    showReplies.has(comment._id) ? { parentId: comment._id } : "skip"
  );

  const isOwner = currentUserId === comment.userId;
  const isEditing = editingId === comment._id;

  return (
    <div className="group">
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center text-white font-bold">
            {comment.userName.charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="font-medium text-gray-900">{comment.userName}</span>
                <span className="mx-2 text-gray-400">·</span>
                <span className="text-sm text-gray-500">
                  {formatDistanceToNow(comment.timestamp)} ago
                </span>
                {comment.editedAt && (
                  <span className="text-sm text-gray-500 ml-2">(edited)</span>
                )}
              </div>
              
              {isOwner && !comment.isDeleted && (
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  
                  {showMenu && (
                    <div className="absolute right-0 mt-1 bg-white rounded-lg shadow-lg border py-1 z-10">
                      <button
                        onClick={() => {
                          onEdit(comment._id, comment.content);
                          setShowMenu(false);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          onDelete(comment._id);
                          setShowMenu(false);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-100 w-full text-left"
                      >
                        <Trash className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg resize-none focus:ring-2 focus:ring-purple-500"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => onSaveEdit(comment._id)}
                    className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={onCancelEdit}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-gray-800">{comment.content}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={() => onLike(comment._id)}
              className={`flex items-center gap-1 text-sm ${
                comment.hasLiked ? "text-red-600" : "text-gray-600 hover:text-red-600"
              }`}
            >
              <Heart className={`w-4 h-4 ${comment.hasLiked ? "fill-current" : ""}`} />
              {comment.likes > 0 && comment.likes}
            </button>
            
            {currentUserId && (
              <button
                onClick={onReply}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-purple-600"
              >
                <Reply className="w-4 h-4" />
                Reply
              </button>
            )}

            {comment.replyCount > 0 && (
              <button
                onClick={() => {
                  const newSet = new Set(showReplies);
                  if (newSet.has(comment._id)) {
                    newSet.delete(comment._id);
                  } else {
                    newSet.add(comment._id);
                  }
                  setShowReplies(newSet);
                }}
                className="text-sm text-purple-600 hover:text-purple-700"
              >
                {showReplies.has(comment._id) ? "Hide" : "Show"} {comment.replyCount}{" "}
                {comment.replyCount === 1 ? "reply" : "replies"}
              </button>
            )}
          </div>

          {/* Replies */}
          {showReplies.has(comment._id) && replies && (
            <div className="mt-4 ml-12 space-y-3">
              {replies.map((reply) => (
                <div key={reply._id} className="flex gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-300 to-blue-300 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {reply.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{reply.userName}</span>
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(reply.timestamp)} ago
                        </span>
                      </div>
                      <p className="text-sm text-gray-800">{reply.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}