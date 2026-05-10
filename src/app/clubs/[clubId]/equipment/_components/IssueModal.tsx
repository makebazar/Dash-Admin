"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  MessageSquare,
  Send,
  Loader2,
  XCircle,
  Camera,
  AlertTriangle,
  Clock,
  CheckCircle2,
  X,
  History,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ImageViewer } from "@/components/ui/image-viewer";

interface Comment {
  id: string;
  content: string;
  user_id: string;
  author_name: string;
  author_role: string;
  is_system_message: boolean;
  photos?: string[];
  created_at: string;
}

interface IssueModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  issue: any;
  clubId: string;
  onUpdate: () => void;
}

export function IssueModal({
  isOpen,
  onOpenChange,
  issue,
  clubId,
  onUpdate,
}: IssueModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"info" | "chat">("info");

  // Image viewer state
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [viewerGroup, setViewerGroup] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && issue) {
      fetchComments();
      setPendingPhotos([]);
      setActiveTab("info");
    }
  }, [isOpen, issue]);

  const fetchComments = async () => {
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/equipment/issues/${issue.id}/comments`,
      );
      const data = await res.json();
      if (res.ok) {
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      setIsUploading(true);
      const uploadedUrls: string[] = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (res.ok && data.url) {
          uploadedUrls.push(data.url);
        }
      }

      setPendingPhotos((prev) => [...prev, ...uploadedUrls]);
    } catch (error) {
      console.error("Error uploading photos:", error);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newComment.trim() && pendingPhotos.length === 0) || isSending) return;

    try {
      setIsSending(true);
      const res = await fetch(
        `/api/clubs/${clubId}/equipment/issues/${issue.id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: newComment,
            photos: pendingPhotos,
          }),
        },
      );
      if (res.ok) {
        setNewComment("");
        setPendingPhotos([]);
        fetchComments();
      }
    } catch (error) {
      console.error("Error sending comment:", error);
    } finally {
      setIsSending(false);
    }
  };

  const updateStatus = async (status: string) => {
    try {
      setIsUpdatingStatus(true);
      const res = await fetch(
        `/api/clubs/${clubId}/equipment/issues/${issue.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (res.ok) {
        onUpdate();
        fetchComments();
      }
    } catch (error) {
      console.error("Error updating status:", error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (!issue) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden flex flex-col md:flex-row h-[100dvh] md:h-[600px] bg-[#0a0b10] border-white/5 rounded-none md:rounded-2xl">
          <div className="flex-1 flex flex-col min-w-0 border-r border-white/5 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-white/5 bg-[#0d0e15] shrink-0">
              <div className="flex items-center gap-3 mb-3">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-black px-2 py-0.5 rounded-md",
                    issue.severity === "CRITICAL"
                      ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                      : issue.severity === "HIGH"
                        ? "bg-orange-500/10 text-orange-500 border-orange-500/20"
                        : "bg-blue-500/10 text-blue-500 border-blue-500/20",
                  )}
                >
                  {issue.severity === "CRITICAL"
                    ? "КРИТИЧЕСКИЙ"
                    : issue.severity === "HIGH"
                      ? "ВЫСОКИЙ"
                      : "СРЕДНИЙ"}
                </Badge>
                <div className="h-1 w-1 rounded-full bg-slate-700" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {format(new Date(issue.created_at), "d MMMM, HH:mm", {
                    locale: ru,
                  })}
                </span>
              </div>
              <DialogTitle className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter leading-none mb-2">
                {issue.title}
              </DialogTitle>
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
                <span className="text-blue-500">{issue.equipment_name}</span>
                <span>•</span>
                <span>{issue.reported_by_name}</span>
              </div>
            </div>

            {/* Mobile Tab Switcher */}
            <div className="md:hidden flex border-b border-white/5 bg-[#0d0e15]">
              <button
                onClick={() => setActiveTab("info")}
                className={cn(
                  "flex-1 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all",
                  activeTab === "info"
                    ? "text-blue-500 border-blue-500 bg-blue-500/5"
                    : "text-slate-500 border-transparent",
                )}
              >
                Информация
              </button>
              <button
                onClick={() => setActiveTab("chat")}
                className={cn(
                  "flex-1 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all",
                  activeTab === "chat"
                    ? "text-blue-500 border-blue-500 bg-blue-500/5"
                    : "text-slate-500 border-transparent",
                )}
              >
                Обсуждение ({comments.length})
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#0a0b10] custom-scrollbar">
              <div
                className={cn(
                  "space-y-8",
                  activeTab !== "info" && "hidden md:block",
                )}
              >
                <section className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                    Описание проблемы
                  </h4>
                  <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 text-sm text-slate-300 leading-relaxed font-medium">
                    {issue.description || "Описание отсутствует"}
                  </div>
                </section>

                <section className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                    Управление статусом
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {issue.status === "OPEN" && (
                      <Button
                        onClick={() => updateStatus("IN_PROGRESS")}
                        disabled={isUpdatingStatus}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-6 text-[11px] font-black uppercase tracking-widest border-none shadow-lg shadow-blue-600/20"
                      >
                        <Clock className="w-4 h-4 mr-2" />
                        В работу
                      </Button>
                    )}
                    {issue.status === "IN_PROGRESS" && (
                      <Button
                        onClick={() => updateStatus("RESOLVED")}
                        disabled={isUpdatingStatus}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 px-6 text-[11px] font-black uppercase tracking-widest border-none shadow-lg shadow-emerald-600/20"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Исправлено
                      </Button>
                    )}
                    {(issue.status === "OPEN" ||
                      issue.status === "IN_PROGRESS") && (
                      <Button
                        variant="ghost"
                        onClick={() => updateStatus("CLOSED")}
                        disabled={isUpdatingStatus}
                        className="text-rose-500 hover:bg-rose-500/10 rounded-xl h-11 px-6 text-[11px] font-black uppercase tracking-widest"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Закрыть
                      </Button>
                    )}
                    {(issue.status === "RESOLVED" ||
                      issue.status === "CLOSED") && (
                      <Button
                        variant="outline"
                        onClick={() => updateStatus("OPEN")}
                        disabled={isUpdatingStatus}
                        className="border-white/10 text-slate-400 hover:bg-white/5 rounded-xl h-11 px-6 text-[11px] font-black uppercase tracking-widest"
                      >
                        <History className="w-4 h-4 mr-2" />
                        Переоткрыть
                      </Button>
                    )}
                  </div>
                </section>
              </div>

              {/* Mobile Chat View */}
              <div
                className={cn(
                  "space-y-4",
                  activeTab !== "chat" && "hidden md:hidden",
                )}
              >
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={cn(
                      "flex flex-col gap-2",
                      comment.is_system_message ? "items-center" : "items-start",
                    )}
                  >
                    {comment.is_system_message ? (
                      <div className="bg-white/5 px-4 py-1.5 rounded-full text-[8px] text-slate-500 font-black uppercase tracking-widest border border-white/5">
                        {comment.content}
                      </div>
                    ) : (
                      <div className="max-w-[100%] bg-[#161922] border border-white/5 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-6 mb-2">
                          <span className="text-[10px] font-black uppercase tracking-tight text-white/90">
                            {comment.author_name}
                          </span>
                          <span className="text-[9px] font-bold text-slate-600">
                            {format(new Date(comment.created_at), "HH:mm")}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 font-medium whitespace-pre-wrap leading-relaxed">
                          {comment.content}
                        </p>
                        {comment.photos && comment.photos.length > 0 && (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {comment.photos.map((photo, i) => (
                              <div
                                key={i}
                                onClick={() => {
                                  setViewerImage(photo);
                                  setViewerGroup(comment.photos || []);
                                }}
                                className="relative aspect-square rounded-xl overflow-hidden border border-white/5 bg-black/20 cursor-pointer hover:opacity-80 transition-opacity"
                              >
                                <img
                                  src={photo}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Side: Chat (Desktop) */}
          <div className="hidden md:flex w-[380px] flex-col bg-[#0d0e15] overflow-hidden shrink-0">
            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-[#11131a]">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-slate-400">
                <MessageSquare className="h-4 w-4 opacity-50" />
                Обсуждение
              </h4>
              <Badge
                variant="secondary"
                className="bg-white/5 text-slate-400 border-none font-black text-[10px] px-2"
              >
                {comments.length}
              </Badge>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {comments.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center opacity-20">
                  <MessageSquare className="h-10 w-10 mb-4" />
                  <p className="text-[9px] font-black uppercase tracking-[0.2em]">
                    Сообщений нет
                  </p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={cn(
                      "flex flex-col gap-2",
                      comment.is_system_message ? "items-center" : "items-start",
                    )}
                  >
                    {comment.is_system_message ? (
                      <div className="bg-white/5 px-4 py-1.5 rounded-full text-[8px] text-slate-500 font-black uppercase tracking-widest border border-white/5">
                        {comment.content}
                      </div>
                    ) : (
                      <div className="max-w-[100%] bg-[#161922] border border-white/5 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-6 mb-2">
                          <span className="text-[10px] font-black uppercase tracking-tight text-white/90">
                            {comment.author_name}
                          </span>
                          <span className="text-[9px] font-bold text-slate-600">
                            {format(new Date(comment.created_at), "HH:mm")}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 font-medium whitespace-pre-wrap leading-relaxed">
                          {comment.content}
                        </p>
                        {comment.photos && comment.photos.length > 0 && (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {comment.photos.map((photo, i) => (
                              <div
                                key={i}
                                onClick={() => {
                                  setViewerImage(photo);
                                  setViewerGroup(comment.photos || []);
                                }}
                                className="relative aspect-square rounded-xl overflow-hidden border border-white/5 bg-black/20 cursor-pointer hover:opacity-80 transition-opacity"
                              >
                                <img
                                  src={photo}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Input area */}
            <div className="p-6 border-t border-white/5 bg-[#11131a] space-y-4">
              {pendingPhotos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pendingPhotos.map((photo, i) => (
                    <div
                      key={i}
                      className="relative w-12 h-12 rounded-lg overflow-hidden border border-white/10 group"
                    >
                      <img
                        src={photo}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() =>
                          setPendingPhotos((prev) =>
                            prev.filter((_, idx) => idx !== i),
                          )
                        }
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                      >
                        <X className="h-4 w-4 text-white" />
                      </button>
                    </div>
                  ))}
                  {isUploading && (
                    <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleSendComment} className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="Написать..."
                    className="pr-12 bg-[#0a0b10] border-white/10 focus:border-blue-500/50 transition-all rounded-xl h-11 text-xs font-medium text-white placeholder:text-slate-600"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <input
                      type="file"
                      id="comment-photo-issue"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                    <label
                      htmlFor="comment-photo-issue"
                      className="p-1.5 text-slate-500 hover:text-white transition-colors cursor-pointer"
                    >
                      <Camera className="h-4 w-4" />
                    </label>
                  </div>
                </div>
                <Button
                  type="submit"
                  size="icon"
                  disabled={
                    (!newComment.trim() && pendingPhotos.length === 0) ||
                    isSending ||
                    isUploading
                  }
                  className="h-11 w-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 shrink-0"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ImageViewer
        src={viewerImage || ""}
        isOpen={!!viewerImage}
        onClose={() => setViewerImage(null)}
        images={viewerGroup}
        onNext={() => {
          const idx = viewerGroup.indexOf(viewerImage || "");
          if (idx < viewerGroup.length - 1)
            setViewerImage(viewerGroup[idx + 1]);
        }}
        onPrev={() => {
          const idx = viewerGroup.indexOf(viewerImage || "");
          if (idx > 0) setViewerImage(viewerGroup[idx - 1]);
        }}
      />
    </>
  );
}
