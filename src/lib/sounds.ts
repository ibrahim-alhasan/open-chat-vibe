// Sound effects utility
const SEND_SOUND_URL = "data:audio/wav;base64,UklGRl4FAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YToFAAB/fwAAgH9/f4CAgICAgH9/f39/gICBgYGBgH9+fn5/gIGCgoKBgH5+fn+AgYKCgYB/fn5+f4GCg4KBf35+fn+AgYODgoB/fn1+f4GDg4OBf31+fn+BgoODgX9+fX5/gYOEg4F+fX1+gIKEhIN/fX19f4GDhISDf3x9fX+Bg4WEg398fH1/goSFhIN+fHx9gIKEhYSDfnx8fYCChYaEg3x8fH2AgoWGhYN8e3x9gIOGhoWCe3t8fYCDhoeFgnx7fH2Bg4eHhYF7e3x+gYSHh4WBent8foGEiIeFgHp7fH6ChYiIhX96e3x+goWIiIV/ent8foOGiYiFfnp7fX+DiImIhH16e32Ag4mKiIR8ent9gISKioiDe3p7foCFi4qIgnt6e36BhYuLiIF6ent+goaMi4iBenp7f4KHjIuHgHl6e3+DiI2Lh395ent/hImNi4d+eXp8gIWKjouGfXl6fIGGi4+Lhnt5enyCh4yPi4V7eXp8goiNj4uEenh6fYOJjo+Kg3h5en2Eio+QioJ4eHp9hYuQkImBeHh6foWMkZCJgHd4en6GjZGQiH93eHt/h46SkId+d3h7gIiPk5CHfXd4e4CJkJORhnx2eHuBipGUkYV7dnh8goqSlZGEenZ4fIOLk5WRg3l2eHyEjJSWkIJ4dnh9hY2Vlo+Bd3Z5fYaOlpePgHZ2eX6Hj5eXjn91dnn+iJCYl458dXZ5/4mRmZiNfHR2ef+KkpqZjHt0dnkAi5ObmYt6c3Z5AIyUnJmKeXN2egCNlZ2aiHhydnoBjpadm4d4cXZ6Ao+Xnp2Gd3F2ewORmaCdhXZxdnsDkpqhnIRzcXZ7BJOboZ2Dc3F3fAWUnKOdgnJxd3wGlaGqoHxucHd9CJqnsaV3bG54fQugtLmpa2lse34Pp77CrmRlannAAqzL0bVYWmR7yhjL/f/bOU9Nc3PVOMz+/+9AQ1BobbNaof3/9VQ7RmBplm6Z+//4YDQ+WmR/hn2Y/v38aTM5U150d4KQ8P38dDU1TFhsaXyI3f/+fzs0R1Nmam6C";

const getIsSoundEnabled = () => {
  const stored = localStorage.getItem("chat_sound_enabled");
  return stored === null ? true : stored === "true";
};

const setSoundEnabled = (enabled: boolean) => {
  localStorage.setItem("chat_sound_enabled", String(enabled));
};

const playSound = () => {
  if (!getIsSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.05);
    oscillator.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.15);
  } catch {}
};

export { getIsSoundEnabled, setSoundEnabled, playSound };
