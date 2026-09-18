import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Quote,
  RemoveFormatting,
  Palette,
  Undo,
  Redo,
  ChevronDown
} from 'lucide-react';

export interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  language?: 'en' | 'fr' | 'ar';
  id?: string;
}

const COLOR_SWATCHES = [
  { name: 'Default Dark', color: '#1F2937' },
  { name: 'Pine Green', color: '#284939' },
  { name: 'Cedar Olive', color: '#3A5A40' },
  { name: 'Terracotta', color: '#A84B2E' },
  { name: 'Deep Indigo', color: '#1E3A8A' },
  { name: 'Warm Amber', color: '#B45309' },
  { name: 'Crimson', color: '#991B1B' },
  { name: 'Muted Slate', color: '#64748B' },
];

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write content here...',
  minHeight = '220px',
  className = '',
  language = 'en',
  id = 'rich-text-editor',
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'p' | 'h1' | 'h2' | 'h3'>('p');
  const isUpdatingFromProps = useRef(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Close color picker on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync editor content with external value
  useEffect(() => {
    if (!editorRef.current) return;
    const currentHtml = editorRef.current.innerHTML;
    // Only update innerHTML if it's different and not actively typing
    if (value !== currentHtml && !isUpdatingFromProps.current) {
      if (!value) {
        editorRef.current.innerHTML = '';
      } else if (!/<[a-z][\s\S]*>/i.test(value)) {
        // Plain text: convert newlines to paragraph blocks
        const paragraphs = value.split(/\n\s*\n/);
        editorRef.current.innerHTML = paragraphs
          .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
          .join('');
      } else {
        editorRef.current.innerHTML = value;
      }
    }
  }, [value]);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    isUpdatingFromProps.current = true;
    let html = editorRef.current.innerHTML;

    // Treat empty content like <p><br></p> as empty string
    if (html === '<p><br></p>' || html === '<br>' || html.trim() === '') {
      html = '';
    }
    onChange(html);
    setTimeout(() => {
      isUpdatingFromProps.current = false;
    }, 50);
  }, [onChange]);

  // Execute standard formatting commands while preventing loss of selection
  const executeCommand = (command: string, arg?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, arg);
    handleInput();
  };

  const handleFormatBlock = (tag: 'p' | 'h1' | 'h2' | 'h3') => {
    setSelectedFormat(tag);
    executeCommand('formatBlock', `<${tag}>`);
  };

  const handleColorSelect = (color: string) => {
    executeCommand('foreColor', color);
    setShowColorPicker(false);
  };

  const isRtl = language === 'ar';

  return (
    <div
      id={id}
      className={`border border-[#D9D1C3] bg-white rounded-2xl overflow-hidden focus-within:border-[#284939] focus-within:ring-2 focus-within:ring-[#284939]/15 transition-all shadow-xs flex flex-col ${className}`}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-[#F9F6F0] border-b border-[#E8E1D5] select-none text-xs sm:text-sm text-[#3E5246]">
        {/* Headings / Block Style Selector */}
        <div className="relative inline-block me-1">
          <select
            value={selectedFormat}
            onChange={(e) => handleFormatBlock(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg bg-white border border-[#D5CDC0] text-xs font-semibold text-[#23352B] focus:outline-none cursor-pointer hover:bg-[#F2ECE1] transition-colors"
            title={language === 'ar' ? 'نمط النص' : language === 'fr' ? 'Style de texte' : 'Text Style'}
          >
            <option value="p">{language === 'ar' ? 'فقرة عادية' : language === 'fr' ? 'Paragraphe' : 'Paragraph'}</option>
            <option value="h1">{language === 'ar' ? 'عنوان رئيسي 1' : language === 'fr' ? 'Titre 1 (Grand)' : 'Heading 1'}</option>
            <option value="h2">{language === 'ar' ? 'عنوان فرعي 2' : language === 'fr' ? 'Titre 2 (Moyen)' : 'Heading 2'}</option>
            <option value="h3">{language === 'ar' ? 'عنوان فرعي 3' : language === 'fr' ? 'Titre 3 (Petit)' : 'Heading 3'}</option>
          </select>
        </div>

        <div className="w-[1px] h-5 bg-[#DED6C8] mx-0.5" />

        {/* Bold */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand('bold');
          }}
          className="p-1.5 rounded-lg hover:bg-[#ECE4D8] text-[#293F33] cursor-pointer transition-colors"
          title={language === 'ar' ? 'عريض (Ctrl+B)' : language === 'fr' ? 'Gras (Ctrl+B)' : 'Bold (Ctrl+B)'}
        >
          <Bold className="w-4 h-4" />
        </button>

        {/* Italic */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand('italic');
          }}
          className="p-1.5 rounded-lg hover:bg-[#ECE4D8] text-[#293F33] cursor-pointer transition-colors"
          title={language === 'ar' ? 'مائل (Ctrl+I)' : language === 'fr' ? 'Italique (Ctrl+I)' : 'Italic (Ctrl+I)'}
        >
          <Italic className="w-4 h-4" />
        </button>

        {/* Underline */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand('underline');
          }}
          className="p-1.5 rounded-lg hover:bg-[#ECE4D8] text-[#293F33] cursor-pointer transition-colors"
          title={language === 'ar' ? 'تسطير (Ctrl+U)' : language === 'fr' ? 'Souligné (Ctrl+U)' : 'Underline (Ctrl+U)'}
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-5 bg-[#DED6C8] mx-0.5" />

        {/* Text Color Dropdown */}
        <div className="relative" ref={colorPickerRef}>
          <button
            type="button"
            onClick={() => setShowColorPicker((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-[#ECE4D8] text-[#293F33] cursor-pointer transition-colors"
            title={language === 'ar' ? 'لون النص' : language === 'fr' ? 'Couleur du texte' : 'Text Color'}
          >
            <Palette className="w-4 h-4 text-[#284939]" />
            <ChevronDown className="w-3 h-3 text-[#7B8D82]" />
          </button>

          {showColorPicker && (
            <div className="absolute top-full start-0 mt-1 z-30 bg-white border border-[#DDD5C7] rounded-xl shadow-lg p-2.5 min-w-[200px] animate-fade-in">
              <div className="text-[11px] font-bold text-[#55695D] mb-2 uppercase tracking-wider">
                {language === 'ar' ? 'اختر لون النص' : language === 'fr' ? 'Couleur de texte' : 'Text Color'}
              </div>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.color}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleColorSelect(swatch.color);
                    }}
                    className="w-7 h-7 rounded-lg border border-black/10 hover:scale-110 transition-transform cursor-pointer relative group flex items-center justify-center shadow-2xs"
                    style={{ backgroundColor: swatch.color }}
                    title={swatch.name}
                  />
                ))}
              </div>
              <div className="pt-2 border-t border-[#F0ECE3] flex items-center justify-between gap-2">
                <span className="text-[11px] text-[#697B71]">
                  {language === 'ar' ? 'لون مخصص:' : language === 'fr' ? 'Personnalisé :' : 'Custom:'}
                </span>
                <input
                  type="color"
                  onChange={(e) => handleColorSelect(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                  title="Custom Color"
                />
              </div>
            </div>
          )}
        </div>

        <div className="w-[1px] h-5 bg-[#DED6C8] mx-0.5" />

        {/* Bullet List */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand('insertUnorderedList');
          }}
          className="p-1.5 rounded-lg hover:bg-[#ECE4D8] text-[#293F33] cursor-pointer transition-colors"
          title={language === 'ar' ? 'قائمة نقطية' : language === 'fr' ? 'Liste à puces' : 'Bulleted List'}
        >
          <List className="w-4 h-4" />
        </button>

        {/* Numbered List */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand('insertOrderedList');
          }}
          className="p-1.5 rounded-lg hover:bg-[#ECE4D8] text-[#293F33] cursor-pointer transition-colors"
          title={language === 'ar' ? 'قائمة مرقمة' : language === 'fr' ? 'Liste numérotée' : 'Numbered List'}
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        {/* Blockquote */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand('formatBlock', '<blockquote>');
          }}
          className="p-1.5 rounded-lg hover:bg-[#ECE4D8] text-[#293F33] cursor-pointer transition-colors"
          title={language === 'ar' ? 'اقتباس' : language === 'fr' ? 'Citation' : 'Quote'}
        >
          <Quote className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-5 bg-[#DED6C8] mx-0.5" />

        {/* Clear formatting */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand('removeFormat');
          }}
          className="p-1.5 rounded-lg hover:bg-[#ECE4D8] text-[#697B71] hover:text-[#293F33] cursor-pointer transition-colors"
          title={language === 'ar' ? 'إزالة التنسيق' : language === 'fr' ? 'Effacer la mise en forme' : 'Clear Formatting'}
        >
          <RemoveFormatting className="w-4 h-4" />
        </button>

        {/* Undo */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand('undo');
          }}
          className="p-1.5 rounded-lg hover:bg-[#ECE4D8] text-[#697B71] hover:text-[#293F33] cursor-pointer transition-colors"
          title={language === 'ar' ? 'تراجع (Ctrl+Z)' : language === 'fr' ? 'Annuler (Ctrl+Z)' : 'Undo (Ctrl+Z)'}
        >
          <Undo className="w-3.5 h-3.5" />
        </button>

        {/* Redo */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand('redo');
          }}
          className="p-1.5 rounded-lg hover:bg-[#ECE4D8] text-[#697B71] hover:text-[#293F33] cursor-pointer transition-colors"
          title={language === 'ar' ? 'إعادة (Ctrl+Y)' : language === 'fr' ? 'Rétablir (Ctrl+Y)' : 'Redo (Ctrl+Y)'}
        >
          <Redo className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Editable Canvas */}
      <div className="relative flex-1 p-4 sm:p-5">
        <div
          ref={editorRef}
          contentEditable
          dir={isRtl ? 'rtl' : 'ltr'}
          onInput={handleInput}
          onBlur={handleInput}
          style={{ minHeight }}
          className="rich-text-content outline-none text-[#1F3327] text-sm sm:text-base leading-relaxed font-sans focus:outline-none"
        />

        {/* Simulated Placeholder when completely empty */}
        {(!value || value === '<p><br></p>' || value === '<br>') && (
          <div
            onClick={() => editorRef.current?.focus()}
            className={`absolute top-4 sm:top-5 ${isRtl ? 'end-4 sm:end-5' : 'start-4 sm:start-5'} text-[#9CAEA4] pointer-events-none text-sm select-none`}
          >
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
};
