// صورة شخصية محفوظة محلياً على جهاز المستخدم فقط (لا تُرفع إلى قاعدة البيانات)

const KEY_PREFIX = "local_avatar_";
export const LOCAL_AVATAR_EVENT = "local-avatar-changed";

export const getLocalAvatar = (userId: string): string | null => {
  if (!userId) return null;
  try {
    return localStorage.getItem(KEY_PREFIX + userId);
  } catch {
    return null;
  }
};

export const setLocalAvatar = (userId: string, dataUrl: string) => {
  if (!userId) return;
  try {
    localStorage.setItem(KEY_PREFIX + userId, dataUrl);
  } catch {
    /* ignore quota errors */
  }
  window.dispatchEvent(new CustomEvent(LOCAL_AVATAR_EVENT, { detail: { userId } }));
};

export const clearLocalAvatar = (userId: string) => {
  if (!userId) return;
  try {
    localStorage.removeItem(KEY_PREFIX + userId);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(LOCAL_AVATAR_EVENT, { detail: { userId } }));
};

// ضغط الصورة إلى مربع صغير حتى لا تمتلئ الذاكرة المحلية
export const compressImageToDataUrl = (file: File, size = 256): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read-error"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("image-error"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas-error"));
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
