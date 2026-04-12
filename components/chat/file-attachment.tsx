"use client";

import { FileIcon, Download } from "lucide-react";
import { getMediaFileName, normalizeMediaUrl } from "@/lib/media-url";

interface FileAttachmentProps {
  fileUrl: string;
  fileName?: string;
}

export const FileAttachment = ({ fileUrl, fileName }: FileAttachmentProps) => {
  const safeFileUrl = normalizeMediaUrl(fileUrl);

  const displayName = fileName || getMediaFileName(fileUrl);
  const fileExtension = displayName.includes('.')
    ? displayName.split('.').pop()?.toLowerCase()
    : getMediaFileName(fileUrl).split('.').pop()?.toLowerCase();
  
  const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fileExtension || '');
  const isPDF = fileExtension === 'pdf';
  const isVideo = ['mp4', 'webm'].includes(fileExtension || '');
  const isAudio = ['mp3', 'wav'].includes(fileExtension || '');
  
  if (isImage) {
    return (
      <div className="relative mt-2 max-w-sm">
        <a 
          href={safeFileUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          title={`Open ${displayName}`}
          aria-label={`Open ${displayName}`}
          className="block rounded-lg overflow-hidden border border-zinc-200 hover:border-zinc-300 transition"
        >
          <img
            src={safeFileUrl}
            alt={displayName}
            className="w-full h-auto object-cover"
          />
        </a>
        <a
          href={safeFileUrl}
          download
          title={`Download ${displayName}`}
          aria-label={`Download ${displayName}`}
          className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition"
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="w-4 h-4" />
        </a>
      </div>
    );
  }
  
  if (isVideo) {
    return (
      <div className="mt-2 max-w-md">
        <video 
          controls 
          className="w-full rounded-lg border border-zinc-200"
        >
          <source src={safeFileUrl} type={`video/${fileExtension}`} />
          Your browser does not support video playback.
        </video>
      </div>
    );
  }
  
  if (isAudio) {
    return (
      <div className="mt-2 max-w-md">
        <audio 
          controls 
          className="w-full"
        >
          <source src={safeFileUrl} type={`audio/${fileExtension}`} />
          Your browser does not support audio playback.
        </audio>
      </div>
    );
  }
  
  // Generic file (PDF, DOC, etc.)
  return (
    <a
      href={safeFileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center mt-2 p-3 max-w-sm bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition group"
    >
      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-blue-100 dark:bg-blue-900 rounded-lg">
        <FileIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="ml-3 flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
          {displayName}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {isPDF ? 'PDF Document' : fileExtension?.toUpperCase() + ' File'}
        </p>
      </div>
      <Download className="w-5 h-5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition ml-2" />
    </a>
  );
};
