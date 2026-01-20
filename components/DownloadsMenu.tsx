'use client';

import { useState, useEffect, useRef } from 'react';

interface DownloadedFile {
  id: string;
  filename: string;
  mimeType: string;
  document: string; // base64 encoded
  createdAt: string;
  format: 'pdf' | 'docx' | 'ppt' | 'txt';
  size?: number;
}

const STORAGE_KEY = 'geogame_downloaded_files';

export function saveFileToDownloads(file: Omit<DownloadedFile, 'id' | 'createdAt'>) {
  const files = getDownloadedFiles();
  const newFile: DownloadedFile = {
    ...file,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };
  
  // Add to beginning of array (most recent first)
  files.unshift(newFile);
  
  // Keep only last 50 files
  const recentFiles = files.slice(0, 50);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recentFiles));
  
  return newFile;
}

export function getDownloadedFiles(): DownloadedFile[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function deleteDownloadedFile(fileId: string) {
  const files = getDownloadedFiles();
  const filtered = files.filter(f => f.id !== fileId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export default function DownloadsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<DownloadedFile[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load files from localStorage
    setFiles(getDownloadedFiles());

    // Listen for storage events (when files are added from other tabs/components)
    const handleStorageChange = () => {
      setFiles(getDownloadedFiles());
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events (same tab updates)
    window.addEventListener('fileDownloaded', handleStorageChange);

    // Close menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('fileDownloaded', handleStorageChange);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleDownload = (file: DownloadedFile) => {
    const byteCharacters = atob(file.document);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: file.mimeType });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDelete = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this file from your downloads list?')) {
      deleteDownloadedFile(fileId);
      setFiles(getDownloadedFiles());
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const getFileIcon = (format: string) => {
    switch (format) {
      case 'pdf':
        return (
          <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
      case 'docx':
        return (
          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
      case 'ppt':
        return (
          <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 right-4 z-50 p-3 bg-black text-white rounded-xl shadow-lg hover:bg-gray-800 transition-colors"
        aria-label="Downloads menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        {files.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {files.length > 9 ? '9+' : files.length}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="fixed top-16 right-4 z-50 w-96 max-h-[600px] bg-white border-2 border-black rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-black text-white p-4 flex items-center justify-between">
            <h3 className="text-lg font-bold">Downloads</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-gray-300 transition-colors"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Files List */}
          <div className="overflow-y-auto max-h-[500px]">
            {files.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm">No downloaded files yet</p>
                <p className="text-xs mt-2">Generated whitepapers will appear here</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => handleDownload(file)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getFileIcon(file.format)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-800 truncate" title={file.filename}>
                            {file.filename}
                          </p>
                          <button
                            onClick={(e) => handleDelete(file.id, e)}
                            className="flex-shrink-0 text-gray-400 hover:text-red-600 transition-colors p-1"
                            aria-label="Delete file"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-500 uppercase">{file.format}</span>
                          {file.size && (
                            <span className="text-xs text-gray-400">• {formatFileSize(file.size)}</span>
                          )}
                          <span className="text-xs text-gray-400">
                            • {new Date(file.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {files.length > 0 && (
            <div className="bg-gray-50 border-t border-gray-200 p-3 text-center">
              <p className="text-xs text-gray-500">
                {files.length} file{files.length !== 1 ? 's' : ''} stored locally
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
