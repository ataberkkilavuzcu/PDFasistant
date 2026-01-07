'use client';

/**
 * Tooltip that appears when text is selected in the PDF
 * Allows users to add selected text to chat
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

interface TextSelectionTooltipProps {
  containerRef: React.RefObject<HTMLElement | null>;
  onAddToChat: (text: string) => void;
}

export function TextSelectionTooltip({ containerRef, onAddToChat }: TextSelectionTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = useCallback(() => {
    // Small delay to ensure selection is complete
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();

      if (text && text.length > 0 && containerRef.current) {
        // Check if selection is within our container
        const range = selection?.getRangeAt(0);
        if (range && containerRef.current.contains(range.commonAncestorContainer)) {
          const rect = range.getBoundingClientRect();
          const containerRect = containerRef.current.getBoundingClientRect();

          // Position tooltip above the selection
          setPosition({
            x: rect.left + rect.width / 2 - containerRect.left,
            y: rect.top - containerRect.top - 10,
          });
          setSelectedText(text);
          setIsVisible(true);
        }
      }
    }, 10);
  }, [containerRef]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    // Hide tooltip when clicking anywhere except on the tooltip itself
    if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
      setIsVisible(false);
      setSelectedText('');
    }
  }, []);

  const handleAddToChat = useCallback(() => {
    if (selectedText) {
      onAddToChat(selectedText);
      setIsVisible(false);
      setSelectedText('');
      // Clear the selection
      window.getSelection()?.removeAllRanges();
    }
  }, [selectedText, onAddToChat]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      container.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [containerRef, handleMouseUp, handleMouseDown]);

  if (!isVisible || !containerRef.current) return null;

  return createPortal(
    <div
      ref={tooltipRef}
      className="absolute z-50 transform -translate-x-1/2 -translate-y-full animate-fade-in"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className="flex items-center gap-1 bg-gradient-to-br from-[#0f1419] to-[#0a0a0b] rounded-lg p-1 border border-white/10 shadow-xl shadow-black/20">
        <button
          onClick={handleAddToChat}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-md transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Add to Chat
        </button>
        <button
          onClick={() => {
            navigator.clipboard.writeText(selectedText);
            setIsVisible(false);
            setSelectedText('');
            window.getSelection()?.removeAllRanges();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-300 hover:bg-white/10 rounded-md transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </button>
      </div>
      {/* Arrow */}
      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#0f1419]" />
    </div>,
    containerRef.current
  );
}

