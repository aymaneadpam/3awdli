import React, { useMemo } from 'react';

interface RichTextRendererProps {
  content: string;
  className?: string;
  id?: string;
}

/**
 * Sanitize basic HTML by allowing only safe text styling elements and attributes
 */
function sanitizeHtml(rawHtml: string): string {
  if (!rawHtml) return '';

  // Remove script tags, onerror/onclick and javascript: attributes
  let clean = rawHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\bon\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\bon\w+\s*=\s*[^>\s]+/gi, '')
    .replace(/href\s*=\s*(['"])javascript:.*?\1/gi, 'href="#"');

  return clean;
}

export const RichTextRenderer: React.FC<RichTextRendererProps> = ({
  content,
  className = '',
  id,
}) => {
  const isHtml = useMemo(() => {
    if (!content) return false;
    return /<[a-z][\s\S]*>/i.test(content);
  }, [content]);

  const sanitizedContent = useMemo(() => {
    if (!content) return '';
    if (isHtml) {
      return sanitizeHtml(content);
    }
    // If plain text, convert double newlines to paragraphs and single newlines to <br>
    const paragraphs = content.split(/\n\s*\n/);
    return paragraphs
      .map((para) => `<p>${para.replace(/\n/g, '<br/>')}</p>`)
      .join('');
  }, [content, isHtml]);

  if (!content) {
    return null;
  }

  return (
    <div
      id={id}
      className={`rich-text-content leading-relaxed text-[#2C3E34] ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
};
