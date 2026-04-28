import React, { useEffect, useState } from 'react';
import { X, Download, Maximize2, Minimize2 } from 'lucide-react';

interface MediaViewerProps {
  url: string;
  type: string;
  name?: string;
  onClose: () => void;
  onDownload: () => void;
}

const MediaViewer: React.FC<MediaViewerProps> = ({ url, type, name, onClose, onDownload }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // التحقق مما إذا كان ملف فيديو
  const isVideo = type.startsWith('video/');
  const isImage = type.startsWith('image/');
  const isPDF = type === 'application/pdf';

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // منع التمرير في الخلفية
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      {/* شريط التحكم العلوي */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center gap-2">
          {name && (
            <span className="text-white text-sm font-medium truncate max-w-[200px] sm:max-w-[300px]">
              {name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onDownload(); }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
            title="تحميل"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
            title={isFullscreen ? "إغلاق ملء الشاشة" : "ملء الشاشة"}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* خلفية قابلة للنقر للإغلاق - طبقة شفافة */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* المحتوى الأساسي */}
      <div
        className="relative z-10 max-w-[90vw] max-h-[90vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-4 border-white/30 border-t-white animate-spin" />
          </div>
        )}

        {isImage && (
          <img
            ref={imgRef}
            src={url}
            alt={name || 'media'}
            className={`max-w-full max-h-[90vh] object-contain rounded-lg transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
            onLoad={() => setIsLoading(false)}
            onError={() => setIsLoading(false)}
          />
        )}

        {isVideo && (
          <video
            ref={videoRef}
            src={url}
            controls
            autoPlay
            className={`max-w-full max-h-[90vh] rounded-lg ${isLoading ? 'opacity-0' : 'opacity-100'}`}
            onLoadedData={() => setIsLoading(false)}
            onError={() => setIsLoading(false)}
          />
        )}

        {isPDF && (
          <iframe
            src={`${url}#toolbar=0`}
            className="w-[90vw] h-[85vh] rounded-lg bg-white"
            title={name || 'PDF'}
            onLoad={() => setIsLoading(false)}
          />
        )}

        {!isImage && !isVideo && !isPDF && (
          <div className="flex flex-col items-center justify-center p-8 rounded-xl bg-white/10 backdrop-blur-sm text-white text-center">
            <div className="w-16 h-16 mb-4 rounded-full bg-white/20 flex items-center justify-center">
              <Download className="w-8 h-8" />
            </div>
            <p className="text-lg font-medium mb-2">لا يمكن معاينة هذا الملف</p>
            <p className="text-sm text-white/70 mb-4">{name || 'ملف'}</p>
            <button
              onClick={onDownload}
              className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-white flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              تحميل الملف
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaViewer;
