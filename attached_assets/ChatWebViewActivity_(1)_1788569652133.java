package com.aqb.net;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.graphics.drawable.StateListDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;
import android.net.Uri;
import android.util.Log;
import androidx.core.content.FileProvider;
import com.onesignal.OneSignal;

/**
 * Native WebView Activity for the student chat / community page.
 *
 * Features
 * ────────
 * • Loading overlay ("جاري التحميل…" + spinner) shown immediately on open.
 *   It stays visible until the loaded website explicitly calls
 *   window.AppBridge.removeSplashScreen() via the JS bridge.
 * • Default browser error pages are shown as-is (no suppression).
 * • Back button: navigates back in WebView history, or closes the Activity.
 * • All UI built programmatically — no XML layouts needed.
 */
public class ChatWebViewActivity extends Activity {

    public static final String EXTRA_URL   = "chat_url";
    public static final String EXTRA_TITLE = "chat_title";
    public static final String EXTRA_THEME = "chat_theme"; // "dark" | "light"

    // ── Colours — resolved at runtime from the received theme ──────────────
    private String C_BG;
    private String C_TOOLBAR;
    private String C_ACCENT  = "#10B981";
    private String C_ACCENT2 = "#059669";
    private String C_ERROR   = "#EF4444";
    private String C_TEXT    = "#FFFFFF";
    private String C_MUTED;

    // ── Views ──────────────────────────────────────────────────────────────
    private WebView     webView;
    private View        loadingOverlay;
    private ProgressBar loadingSpinner;
    private TextView    loadingStatus;
    private TextView    loadingDetail;
    private View        loadingIndicatorDot;

    // ── State ──────────────────────────────────────────────────────────────
    private String  targetUrl;
    private String  pageTitle;
    private String  appTheme  = "dark";   // "dark" | "light"
    private boolean destroyed = false;

    // ── OneSignal subscription ID — read from Android Native SDK, injected into WebView ──
    private static final String TAG_OS        = "ChatWebView_OneSignal";
    private static final String PREF_NAME     = "aqb_onesignal";
    private static final String PREF_KEY_ID   = "subscription_id";
    private volatile String oneSignalSubscriptionId = null;

    // Tracks whether we already injected the ID into the current page load.
    // Reset to false on every onPageStarted so reloads re-inject correctly.
    private volatile boolean oneSignalIdInjected = false;
    private static final int OS_ID_MAX_ATTEMPTS = 3;   // initial + 2 retries (2 s, 5 s)
    private static final int FILE_CHOOSER_REQUEST_CODE = 4091;
    private static final int IMAGE_PICKER_REQUEST_CODE = 4092;
    private ValueCallback<Uri[]> fileChooserCallback;

    private final Handler handler = new Handler(Looper.getMainLooper());

    private static final String[] CHAT_LOADING_MESSAGES = {
        "نهيّئ مساحة الدردشة الخاصة بك…",
        "جاري تحميل الرسائل والميزات الجديدة…",
        "نرتب لك تجربة محادثة أكثر سلاسة…",
        "نتحقق من اتصال المجتمع الطلابي…",
        "لحظات قليلة ونكون جاهزين للبدء…"
    };
    private static final String[] COMPETITION_LOADING_MESSAGES = {
        "نجهّز تحدياتك التعليمية…",
        "جاري تحميل المسابقات والجوائز المتاحة…",
        "نتحقق من أحدث التحديات لهذا الأسبوع…",
        "نرتب لوحة النتائج ومزايا المسابقات…",
        "لحظات قليلة وتصبح ساحة التحدي جاهزة…"
    };
    private static final String[] NINTH_FEATURED_LOADING_MESSAGES = {
        "نرتّب لك الملفات المميزة بعناية…",
        "جاري تجهيز محتوى مختار للصف التاسع…",
        "نتحقق من أحدث الملفات المتاحة…",
        "نهيّئ تجربة تصفح منظمة وسلسة…",
        "لحظات قليلة وتصبح ملفاتك المميزة جاهزة…"
    };
    private int loadingMessageIndex = -1;
    private boolean loadingMessagesActive = false;
    private final Runnable loadingMessageRotator = new Runnable() {
        @Override
        public void run() {
            showNextLoadingMessage(false);
        }
    };

    // ── Lifecycle ──────────────────────────────────────────────────────────

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Remove title bar
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        super.onCreate(savedInstanceState);

        // Hide action bar
        if (getActionBar() != null) getActionBar().hide();

        targetUrl = getIntent().getStringExtra(EXTRA_URL);
        pageTitle = getIntent().getStringExtra(EXTRA_TITLE);
        appTheme  = getIntent().getStringExtra(EXTRA_THEME);
        if (targetUrl  == null || targetUrl.isEmpty())  targetUrl  = "";
        if (pageTitle  == null || pageTitle.isEmpty())  pageTitle  = "الدردشة";
        if (appTheme   == null || appTheme.isEmpty())   appTheme   = "dark";

        // ── Resolve palette from theme ─────────────────────────────────────
        boolean isDark = "dark".equals(appTheme);
        C_BG      = isDark ? "#0f0f2e" : "#f2f2f7";
        C_TOOLBAR = isDark ? "#12123a" : "#ffffff";
        C_TEXT    = isDark ? "#FFFFFF" : "#1c1c1e";
        C_MUTED   = isDark ? "#8888bb" : "#6e6e73";
        if (isNinthFeaturedPage()) {
            C_ACCENT  = "#A855F7";
            C_ACCENT2 = "#6D28D9";
        } else if (isCompetitionsPage()) {
            C_ACCENT  = "#F59E0B";
            C_ACCENT2 = "#D97706";
        }

        // Apply window chrome colours
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        getWindow().setStatusBarColor(Color.parseColor(C_TOOLBAR));
        getWindow().setNavigationBarColor(Color.parseColor(C_BG));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            // Light status-bar icons for light mode, white icons for dark mode
            int flags = isDark ? 0 : View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            getWindow().getDecorView().setSystemUiVisibility(flags);
        }
        getWindow().getDecorView().setBackgroundColor(Color.parseColor(C_BG));

        buildUI();
        loadPage();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            finish();
        }
    }

    @Override
    protected void onDestroy() {
        destroyed = true;
        stopLoadingMessageRotation();
        handler.removeCallbacksAndMessages(null);
        if (fileChooserCallback != null) {
            fileChooserCallback.onReceiveValue(null);
            fileChooserCallback = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }

    // ── UI construction (fully programmatic, no XML) ───────────────────────

    private void buildUI() {
        // Root: vertical LinearLayout
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor(C_BG));
        root.setLayoutParams(new LinearLayout.LayoutParams(MATCH, MATCH));

        // ── Content area ───────────────────────────────────────────────────
        FrameLayout contentFrame = new FrameLayout(this);
        LinearLayout.LayoutParams cfLp = new LinearLayout.LayoutParams(MATCH, MATCH);
        contentFrame.setLayoutParams(cfLp);

        // WebView
        webView = new WebView(this);
        webView.setLayoutParams(new FrameLayout.LayoutParams(MATCH, MATCH));
        webView.setBackgroundColor(Color.parseColor(C_BG));
        configureWebView();
        contentFrame.addView(webView);

        // Loading overlay (above WebView) — hidden only when the site calls removeSplashScreen()
        loadingOverlay = buildLoadingOverlay();
        contentFrame.addView(loadingOverlay);

        root.addView(contentFrame);
        setContentView(root);
    }

    /** Draws the green chat-bubble icon in the toolbar. */
    private View buildIconCircle() {
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.RECTANGLE);
        bg.setCornerRadius(dp(9));
        bg.setColors(new int[]{
                Color.parseColor(C_ACCENT2),
                Color.parseColor(C_ACCENT)
        });
        bg.setOrientation(GradientDrawable.Orientation.TL_BR);

        FrameLayout frame = new FrameLayout(this);
        frame.setBackground(bg);

        // Simple speech-bubble dots (3 circles)
        TextView dots = new TextView(this);
        dots.setText("•••");
        dots.setTextColor(Color.WHITE);
        dots.setTextSize(8);
        dots.setGravity(Gravity.CENTER);
        dots.setLayoutParams(new FrameLayout.LayoutParams(MATCH, MATCH, Gravity.CENTER));
        frame.addView(dots);

        return frame;
    }

    private View buildLoadingOverlay() {
        FrameLayout overlay = new FrameLayout(this);
        overlay.setLayoutParams(new FrameLayout.LayoutParams(MATCH, MATCH));
        overlay.setBackgroundColor(Color.parseColor(C_BG));
        overlay.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);

        // Soft decorative glows give the waiting view depth without obscuring text.
        View topGlow = new View(this);
        GradientDrawable topGlowBg = new GradientDrawable();
        topGlowBg.setShape(GradientDrawable.OVAL);
        topGlowBg.setColor(Color.parseColor("#1F10B981"));
        topGlow.setBackground(topGlowBg);
        FrameLayout.LayoutParams topGlowLp = new FrameLayout.LayoutParams(dp(250), dp(250), Gravity.TOP | Gravity.END);
        topGlowLp.topMargin = dp(-92);
        topGlowLp.rightMargin = dp(-72);
        overlay.addView(topGlow, topGlowLp);

        View bottomGlow = new View(this);
        GradientDrawable bottomGlowBg = new GradientDrawable();
        bottomGlowBg.setShape(GradientDrawable.OVAL);
        bottomGlowBg.setColor(Color.parseColor("#1F6366F1"));
        bottomGlow.setBackground(bottomGlowBg);
        FrameLayout.LayoutParams bottomGlowLp = new FrameLayout.LayoutParams(dp(210), dp(210), Gravity.BOTTOM | Gravity.START);
        bottomGlowLp.bottomMargin = dp(-76);
        bottomGlowLp.leftMargin = dp(-68);
        overlay.addView(bottomGlow, bottomGlowLp);

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        content.setPadding(dp(28), dp(24), dp(28), dp(30));
        FrameLayout.LayoutParams contentLp = new FrameLayout.LayoutParams(MATCH, WRAP, Gravity.CENTER);
        overlay.addView(content, contentLp);

        FrameLayout emblem = new FrameLayout(this);
        GradientDrawable emblemBg = new GradientDrawable();
        emblemBg.setShape(GradientDrawable.RECTANGLE);
        emblemBg.setCornerRadius(dp(28));
        emblemBg.setColors(new int[]{ Color.parseColor(C_ACCENT2), Color.parseColor(C_ACCENT) });
        emblemBg.setOrientation(GradientDrawable.Orientation.TL_BR);
        emblem.setBackground(emblemBg);
        LinearLayout.LayoutParams emblemLp = new LinearLayout.LayoutParams(dp(88), dp(88));
        emblemLp.bottomMargin = dp(22);
        content.addView(emblem, emblemLp);

        TextView emblemMark = new TextView(this);
        emblemMark.setText("✦");
        emblemMark.setTextColor(Color.WHITE);
        emblemMark.setTextSize(38);
        emblemMark.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        emblemMark.setGravity(Gravity.CENTER);
        emblem.addView(emblemMark, new FrameLayout.LayoutParams(MATCH, MATCH));

        TextView title = new TextView(this);
        title.setText(getLoadingTitle());
        title.setTextColor(Color.parseColor(C_TEXT));
        title.setTextSize(22);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        content.addView(title, new LinearLayout.LayoutParams(MATCH, WRAP));

        TextView subtitle = new TextView(this);
        subtitle.setText(getLoadingSubtitle());
        subtitle.setTextColor(Color.parseColor(C_MUTED));
        subtitle.setTextSize(14);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setLineSpacing(dp(3), 1f);
        LinearLayout.LayoutParams subtitleLp = new LinearLayout.LayoutParams(MATCH, WRAP);
        subtitleLp.topMargin = dp(9);
        subtitleLp.bottomMargin = dp(26);
        content.addView(subtitle, subtitleLp);

        LinearLayout statusCard = new LinearLayout(this);
        statusCard.setOrientation(LinearLayout.VERTICAL);
        statusCard.setPadding(dp(18), dp(16), dp(18), dp(16));
        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setShape(GradientDrawable.RECTANGLE);
        cardBg.setCornerRadius(dp(22));
        cardBg.setColor(Color.parseColor("#1610B981"));
        cardBg.setStroke(dp(1), Color.parseColor("#3310B981"));
        statusCard.setBackground(cardBg);
        LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(MATCH, WRAP);
        cardLp.bottomMargin = dp(20);
        content.addView(statusCard, cardLp);

        LinearLayout statusHeader = new LinearLayout(this);
        statusHeader.setOrientation(LinearLayout.HORIZONTAL);
        statusHeader.setGravity(Gravity.CENTER_VERTICAL);
        statusCard.addView(statusHeader, new LinearLayout.LayoutParams(MATCH, WRAP));

        loadingIndicatorDot = new View(this);
        GradientDrawable dotBg = new GradientDrawable();
        dotBg.setShape(GradientDrawable.OVAL);
        dotBg.setColor(Color.parseColor(C_ACCENT));
        loadingIndicatorDot.setBackground(dotBg);
        LinearLayout.LayoutParams dotLp = new LinearLayout.LayoutParams(dp(9), dp(9));
        dotLp.leftMargin = dp(8);
        statusHeader.addView(loadingIndicatorDot, dotLp);

        TextView statusLabel = new TextView(this);
        statusLabel.setText("جاري التحضير");
        statusLabel.setTextColor(Color.parseColor(C_ACCENT));
        statusLabel.setTextSize(12);
        statusLabel.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        statusHeader.addView(statusLabel, new LinearLayout.LayoutParams(WRAP, WRAP));

        loadingStatus = new TextView(this);
        loadingStatus.setTextColor(Color.parseColor(C_TEXT));
        loadingStatus.setTextSize(16);
        loadingStatus.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        loadingStatus.setGravity(Gravity.START);
        loadingStatus.setLineSpacing(dp(3), 1f);
        LinearLayout.LayoutParams statusTextLp = new LinearLayout.LayoutParams(MATCH, WRAP);
        statusTextLp.topMargin = dp(10);
        statusCard.addView(loadingStatus, statusTextLp);

        loadingDetail = new TextView(this);
        loadingDetail.setText(getLoadingDetail());
        loadingDetail.setTextColor(Color.parseColor(C_MUTED));
        loadingDetail.setTextSize(12);
        loadingDetail.setGravity(Gravity.START);
        LinearLayout.LayoutParams detailLp = new LinearLayout.LayoutParams(MATCH, WRAP);
        detailLp.topMargin = dp(6);
        statusCard.addView(loadingDetail, detailLp);

        loadingSpinner = new ProgressBar(this);
        LinearLayout.LayoutParams spinnerLp = new LinearLayout.LayoutParams(dp(34), dp(34));
        spinnerLp.bottomMargin = dp(14);
        content.addView(loadingSpinner, spinnerLp);

        TextView footer = new TextView(this);
        footer.setText(getLoadingFooter());
        footer.setTextColor(Color.parseColor(C_MUTED));
        footer.setTextSize(12);
        footer.setGravity(Gravity.CENTER);
        content.addView(footer, new LinearLayout.LayoutParams(MATCH, WRAP));

        return overlay;
    }

    // ── WebView configuration ──────────────────────────────────────────────

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUserAgentString(
                "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36");

        // ── Register the native bridge so the chat website can call it ─────
        webView.addJavascriptInterface(new NativeBridge(), "AppBridge");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view,
                                             ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
                fileChooserCallback = callback;
                boolean allowMultiple = params.getMode()
                        == FileChooserParams.MODE_OPEN_MULTIPLE;
                if (acceptsImagesOnly(params.getAcceptTypes())) {
                    launchImageGallery(allowMultiple);
                } else {
                    launchFilePicker(params.getAcceptTypes(), allowMultiple);
                }
                return true;
            }
        });

        webView.setWebViewClient(new WebViewClient() {

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                // Reset injection flag so every fresh page load re-injects the ID.
                oneSignalIdInjected = false;
                showLoadingOverlay();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // Loading overlay stays visible — it will be hidden only when the
                // website explicitly calls window.AppBridge.removeSplashScreen().

                // ── Inject theme + bridge-ready signal into the page ──────────
                String theme = appTheme;
                String themeJs =
                    "(function() {" +
                    "  var t = '" + theme + "';" +
                    "  window.__APP_THEME__ = t;" +
                    "  document.documentElement.setAttribute('data-theme', t);" +
                    "  if (t === 'dark') {" +
                    "    document.documentElement.classList.add('dark');" +
                    "    document.documentElement.classList.remove('light');" +
                    "  } else {" +
                    "    document.documentElement.classList.add('light');" +
                    "    document.documentElement.classList.remove('dark');" +
                    "  }" +
                    "  window.dispatchEvent(new CustomEvent('theme-change', {detail:{theme:t,isDarkMode:t==='dark'}}));" +
                    "  window.postMessage({type:'THEME_CHANGE',theme:t,isDarkMode:t==='dark'},'*');" +
                    "})();";
                view.evaluateJavascript(themeJs, null);

                // ── Push OneSignal ID (Android Native SDK → WebView) ─────────
                // ID is read from the Android SDK, never from window.OneSignal.
                // Injection is deferred until here (onPageFinished) so the page
                // DOM is ready to receive it.
                injectOneSignalId(view, 0);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Let the WebView handle all URLs internally
                return false;
            }
        });
    }

    // ── OneSignal ID injection (Android Native SDK → WebView) ─────────────

    /**
     * Reads the OneSignal subscription ID from the Android Native SDK and
     * injects it into the WebView as:
     *   • window.NativeOneSignalId   — plain string, readable any time
     *   • window.AppBridge.getOneSignalId() — synchronous JS-bridge method
     *
     * If the SDK is not yet ready (ID is null/empty), the call is retried
     * at 2 s and 5 s (OS_ID_MAX_ATTEMPTS total attempts).
     *
     * @param view    the WebView to inject into
     * @param attempt 0-based attempt index (0 = immediate, 1 = 2 s, 2 = 5 s)
     */
    private void injectOneSignalId(WebView view, int attempt) {
        // Bail out if the activity is gone or we already succeeded.
        if (destroyed || oneSignalIdInjected) return;

        // ── Read from Android Native SDK ──────────────────────────────────
        String id = null;
        try {
            id = OneSignal.getUser().getPushSubscription().getId();
        } catch (Exception e) {
            Log.w(TAG_OS, "OneSignal not ready (attempt " + attempt + "): " + e.getMessage());
        }

        if (id != null && !id.trim().isEmpty()) {
            final String safeId = id.trim();

            // Persist for app-wide access and for getSubscriptionId() fallback.
            oneSignalSubscriptionId = safeId;
            getSharedPreferences(PREF_NAME, MODE_PRIVATE)
                .edit()
                .putString(PREF_KEY_ID, safeId)
                .apply();

            Log.d(TAG_OS, "✅ Injecting OneSignal ID into WebView (attempt " + attempt + "): " + safeId);

            // ── Inject into the page ──────────────────────────────────────
            // Escape the ID to prevent JS injection (IDs are UUIDs, but be safe).
            String escapedId = safeId.replace("\\", "\\\\").replace("'", "\\'");
            String js =
                "(function() {" +
                "  var id = '" + escapedId + "';" +
                // 1. Global variable — readable anytime
                "  window.NativeOneSignalId = id;" +
                // 2. Dispatch a custom event so React can react without polling
                "  try {" +
                "    window.dispatchEvent(" +
                "      new CustomEvent('native-onesignal-id', {detail:{id:id}})" +
                "    );" +
                "  } catch(e) {}" +
                // 3. Also postMessage for message-listener patterns
                "  try {" +
                "    window.postMessage({type:'NATIVE_ONESIGNAL_ID',id:id},'*');" +
                "  } catch(e) {}" +
                "})();";

            runOnUiThread(() -> {
                if (!destroyed && view != null) {
                    view.evaluateJavascript(js, null);
                    oneSignalIdInjected = true;
                }
            });

        } else if (attempt < OS_ID_MAX_ATTEMPTS - 1) {
            // SDK not ready yet — schedule a retry.
            long delayMs = (attempt == 0) ? 2000L : 5000L;
            Log.d(TAG_OS, "OneSignal ID not yet available, retry in " + delayMs + " ms");
            handler.postDelayed(() -> injectOneSignalId(view, attempt + 1), delayMs);
        } else {
            Log.w(TAG_OS, "OneSignal ID unavailable after " + OS_ID_MAX_ATTEMPTS + " attempts — skipping injection.");
        }
    }

    // ── Load logic ─────────────────────────────────────────────────────────

    private void loadPage() {
        showLoadingOverlay();
        if (targetUrl != null && !targetUrl.isEmpty()) {
            webView.loadUrl(targetUrl);
        }
    }

    // ── Overlay visibility ─────────────────────────────────────────────────

    private boolean isCompetitionsPage() {
        String pageHint = ((pageTitle == null ? "" : pageTitle) + " "
                + (targetUrl == null ? "" : targetUrl)).toLowerCase();
        return pageHint.contains("مسابق") || pageHint.contains("competition");
    }

    private boolean isNinthFeaturedPage() {
        String pageHint = ((pageTitle == null ? "" : pageTitle) + " "
                + (targetUrl == null ? "" : targetUrl)).toLowerCase();
        return pageHint.contains("ملفات مميزة")
                || pageHint.contains("ninth-featured")
                || pageHint.contains("ninth_featured");
    }

    private String getLoadingTitle() {
        if (isNinthFeaturedPage()) return "نجهّز ملفاتك المميزة";
        return isCompetitionsPage() ? "نجهّز ساحة المسابقات" : "نجهّز مساحة الدردشة";
    }

    private String getLoadingSubtitle() {
        if (isNinthFeaturedPage()) return "انتظر قليلاً حتى يتم تجهيز المحتوى المختار لك";
        return isCompetitionsPage()
                ? "انتظر قليلاً حتى يتم تجهيز التحديات والنتائج"
                : "انتظر قليلاً حتى يتم تهيئة الرسائل بأمان";
    }

    private String getLoadingDetail() {
        if (isNinthFeaturedPage()) return "ستفتح ملفات التاسع المميزة تلقائياً فور جاهزيتها";
        return isCompetitionsPage()
                ? "ستفتح المسابقات تلقائياً فور جاهزيتها"
                : "سيتم فتح الدردشة تلقائياً فور جاهزيتها";
    }

    private String getLoadingFooter() {
        if (isNinthFeaturedPage()) return "بنك الأسئلة الأكاديمي  •  ملفات التاسع المميزة";
        return isCompetitionsPage()
                ? "بنك الأسئلة الأكاديمي  •  تحديات الطلاب"
                : "بنك الأسئلة الأكاديمي  •  مجتمع الطلاب";
    }

    private void showLoadingOverlay() {
        runOnUiThread(() -> {
            if (loadingOverlay != null) loadingOverlay.setVisibility(View.VISIBLE);
            startLoadingMessageRotation();
        });
    }

    private void hideLoadingOverlay() {
        runOnUiThread(() -> {
            stopLoadingMessageRotation();
            if (loadingOverlay != null) loadingOverlay.setVisibility(View.GONE);
        });
    }

    private void startLoadingMessageRotation() {
        if (loadingMessagesActive) return;
        loadingMessagesActive = true;
        showNextLoadingMessage(true);
    }

    private void stopLoadingMessageRotation() {
        loadingMessagesActive = false;
        handler.removeCallbacks(loadingMessageRotator);
    }

    private void showNextLoadingMessage(boolean immediate) {
        if (!loadingMessagesActive || loadingStatus == null) return;
        final String[] messages = isNinthFeaturedPage()
                ? NINTH_FEATURED_LOADING_MESSAGES
                : (isCompetitionsPage() ? COMPETITION_LOADING_MESSAGES : CHAT_LOADING_MESSAGES);
        int nextIndex = (int) (Math.random() * messages.length);
        if (messages.length > 1 && nextIndex == loadingMessageIndex) {
            nextIndex = (nextIndex + 1) % messages.length;
        }
        loadingMessageIndex = nextIndex;
        final String message = messages[nextIndex];

        if (immediate) {
            loadingStatus.setAlpha(1f);
            loadingStatus.setText(message);
        } else {
            loadingStatus.animate().alpha(0f).setDuration(180).withEndAction(() -> {
                if (!loadingMessagesActive || loadingStatus == null) return;
                loadingStatus.setText(message);
                loadingStatus.animate().alpha(1f).setDuration(220).start();
            }).start();
        }

        if (loadingIndicatorDot != null) {
            loadingIndicatorDot.animate().alpha(0.35f).setDuration(650)
                    .withEndAction(() -> loadingIndicatorDot.animate().alpha(1f).setDuration(650).start())
                    .start();
        }
        handler.postDelayed(loadingMessageRotator, 2800L);
    }

    /**
     * Handles both normal HTML <input type="file"> controls and the explicit
     * AppBridge.pickFile() bridge. ACTION_OPEN_DOCUMENT keeps the selected URI
     * readable by the WebView without copying a potentially large upload into
     * app memory.
     */
    private void launchFilePicker(String[] acceptTypes, boolean allowMultiple) {
        Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        picker.addCategory(Intent.CATEGORY_OPENABLE);
        picker.setType(resolvePickerMimeType(acceptTypes));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT && acceptTypes != null) {
            ArrayList<String> mimeTypes = new ArrayList<>();
            for (String type : acceptTypes) {
                if (type != null && !type.trim().isEmpty()) mimeTypes.add(type.trim());
            }
            if (mimeTypes.size() > 1) {
                picker.putExtra(Intent.EXTRA_MIME_TYPES,
                        mimeTypes.toArray(new String[0]));
            }
        }
        picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, allowMultiple);
        picker.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        try {
            startActivityForResult(picker, FILE_CHOOSER_REQUEST_CODE);
        } catch (Exception error) {
            if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
            fileChooserCallback = null;
            Log.w("ChatWebView", "File picker unavailable: " + error.getMessage());
        }
    }

    /** Opens Android's visual media picker instead of the generic document picker. */
    private void launchImageGallery(boolean allowMultiple) {
        Intent picker;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            picker = new Intent(MediaStore.ACTION_PICK_IMAGES);
            picker.setType("image/*");
            if (allowMultiple) {
                picker.putExtra(MediaStore.EXTRA_PICK_IMAGES_MAX,
                        MediaStore.getPickImagesMaxLimit());
            }
        } else {
            // Gallery-specific fallback for older Android releases.
            picker = new Intent(Intent.ACTION_PICK,
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI);
            picker.setType("image/*");
            picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, allowMultiple);
        }
        picker.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            startActivityForResult(picker, IMAGE_PICKER_REQUEST_CODE);
        } catch (Exception error) {
            if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
            fileChooserCallback = null;
            Log.w("ChatWebView", "Image gallery unavailable: " + error.getMessage());
        }
    }

    private boolean acceptsImagesOnly(String[] acceptTypes) {
        if (acceptTypes == null || acceptTypes.length == 0) return false;
        boolean hasImage = false;
        for (String raw : acceptTypes) {
            if (raw == null || raw.trim().isEmpty()) continue;
            String type = raw.trim().toLowerCase();
            if (type.startsWith("image/")) hasImage = true;
            else if (!"*/*".equals(type)) return false;
        }
        return hasImage;
    }

    private String resolvePickerMimeType(String[] acceptTypes) {
        if (acceptTypes == null || acceptTypes.length == 0) return "*/*";
        String first = null;
        boolean hasDifferentTypes = false;
        for (String raw : acceptTypes) {
            if (raw == null || raw.trim().isEmpty()) continue;
            String type = raw.trim();
            if (first == null) first = type;
            else if (!first.equals(type)) hasDifferentTypes = true;
        }
        return first == null || hasDifferentTypes ? "*/*" : first;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST_CODE
                && requestCode != IMAGE_PICKER_REQUEST_CODE) return;

        ValueCallback<Uri[]> callback = fileChooserCallback;
        fileChooserCallback = null;
        if (callback == null) return;
        if (resultCode != RESULT_OK || data == null) {
            callback.onReceiveValue(null);
            return;
        }

        ArrayList<Uri> selected = new ArrayList<>();
        if (data.getClipData() != null) {
            for (int i = 0; i < data.getClipData().getItemCount(); i++) {
                selected.add(data.getClipData().getItemAt(i).getUri());
            }
        } else if (data.getData() != null) {
            selected.add(data.getData());
        }

        ArrayList<Uri> readable = new ArrayList<>();
        for (Uri uri : selected) {
            try {
                if (requestCode == FILE_CHOOSER_REQUEST_CODE
                        && Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT
                        && "content".equals(uri.getScheme())) {
                    getContentResolver().takePersistableUriPermission(uri,
                            Intent.FLAG_GRANT_READ_URI_PERMISSION);
                }
            } catch (Exception ignored) {}
            readable.add(uri);
        }
        callback.onReceiveValue(readable.toArray(new Uri[0]));
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private int dp(int dp) {
        return Math.round(dp * getResources().getDisplayMetrics().density);
    }

    /** White ✕ close icon (two crossed strokes on transparent bitmap). */
    private Drawable createCloseIcon(int sizePx) {
        Bitmap bmp = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(Color.WHITE);
        p.setStrokeWidth(sizePx * 0.13f);
        p.setStrokeCap(Paint.Cap.ROUND);
        float pad = sizePx * 0.22f;
        c.drawLine(pad, pad, sizePx - pad, sizePx - pad, p);
        c.drawLine(sizePx - pad, pad, pad, sizePx - pad, p);
        return new BitmapDrawable(getResources(), bmp);
    }

    /** Ripple drawable on API 21+, simple state-list below. */
    private Drawable makeRipple() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            android.content.res.ColorStateList csl =
                    android.content.res.ColorStateList.valueOf(
                            Color.argb(60, 255, 255, 255));
            return new RippleDrawable(csl, null, null);
        }
        StateListDrawable sld = new StateListDrawable();
        sld.addState(new int[]{ android.R.attr.state_pressed },
                new ColorDrawable(Color.argb(60, 255, 255, 255)));
        sld.addState(new int[]{}, new ColorDrawable(Color.TRANSPARENT));
        return sld;
    }

    private static final int MATCH = ViewGroup.LayoutParams.MATCH_PARENT;
    private static final int WRAP  = ViewGroup.LayoutParams.WRAP_CONTENT;

    // ── Native bridge exposed to the chat website ──────────────────────────
    /**
     * Methods callable from the chat website (window.AppBridge.*):
     *
     * ── Sharing ─────────────────────────────────────────────────────────────
     *   window.AppBridge.shareText("title", "text", "https://optional-url")
     *   window.AppBridge.shareImage("base64string", "title", "optional text")
     *   window.AppBridge.copyText("text to copy")
     *   window.AppBridge.pickFile("image/*", false)
     *     Opens the native picker; the selected file is delivered to the
     *     page's hidden HTML input so it can be uploaded with FormData.
     *   window.AppBridge.pickImages(false)
     *     Opens the device gallery directly. Pass true to choose multiple images.
     *
     * ── External links ──────────────────────────────────────────────────────
     *   window.AppBridge.openExternalUrl("https://example.com")
     *     Opens the URL in the user's default browser / external app.
     *
     * ── Remote config (no app update needed) ────────────────────────────────
     *   window.AppBridge.fetchRemoteConfig(url, callbackId)
     *     Fetches a JSON config from `url` asynchronously; result arrives via
     *     CustomEvent 'remote-config-result' and window.postMessage
     *     {type:'REMOTE_CONFIG_RESULT', callbackId, ok, data|error}.
     *
     *   window.AppBridge.setConfigValue(key, value)   → void
     *   window.AppBridge.getConfigValue(key)           → string
     *   window.AppBridge.getAllConfigValues()          → JSON string of {key:value,...}
     *   window.AppBridge.removeConfigValue(key)        → void
     *   window.AppBridge.clearAllConfigValues()        → void
     *     Persist/read string config values in SharedPreferences across restarts.
     *
     * ── Splash screen ────────────────────────────────────────────────────────
     *   window.AppBridge.removeSplashScreen()
     *     Hides the native loading overlay. Call this once the website is ready
     *     to be shown to the user (e.g. after data is fetched and the UI is
     *     rendered). The overlay stays visible until this is called.
     *
     * ── Theme / UI ───────────────────────────────────────────────────────────
     *   window.AppBridge.getTheme()          → "dark" | "light"
     *   window.AppBridge.getAndroidId()      → Android Secure ID for server-side device checks
     *   window.AppBridge.vibrate()
     *
     * ── OneSignal ────────────────────────────────────────────────────────────
     *   window.AppBridge.getOneSignalId()    → OneSignal subscription ID (Android Native SDK)
     *   window.AppBridge.getSubscriptionId() → same, kept for backward compatibility
     *
     * The OneSignal ID is ALSO set as window.NativeOneSignalId automatically
     * after onPageFinished fires — you usually don't need to call getOneSignalId().
     */
    private class NativeBridge {

        /** Share plain text / URL via Android share sheet */
        @JavascriptInterface
        public void shareText(String title, String text, String url) {
            runOnUiThread(() -> {
                Intent share = new Intent(Intent.ACTION_SEND);
                share.setType("text/plain");
                share.putExtra(Intent.EXTRA_SUBJECT, title != null ? title : "");
                String body = (text != null ? text : "");
                if (url != null && !url.isEmpty()) body = body + "\n" + url;
                share.putExtra(Intent.EXTRA_TEXT, body);
                startActivity(Intent.createChooser(share, title != null ? title : "مشاركة"));
            });
        }

        /** Share a base-64 PNG image via Android share sheet */
        @JavascriptInterface
        public void shareImage(String base64, String title, String text) {
            new Thread(() -> {
                try {
                    byte[] decoded = Base64.decode(
                        base64.contains(",") ? base64.split(",")[1] : base64,
                        Base64.DEFAULT
                    );
                    File dir  = new File(getCacheDir(), "bridge_share");
                    dir.mkdirs();
                    File file = new File(dir, "share_" + System.currentTimeMillis() + ".png");
                    FileOutputStream fos = new FileOutputStream(file);
                    fos.write(decoded);
                    fos.close();
                    // Use FileProvider for API 24+ to avoid FileUriExposedException
                    String authority = getPackageName() + ".bridge.fileprovider";
                    Uri uri = FileProvider.getUriForFile(
                        ChatWebViewActivity.this, authority, file);
                    runOnUiThread(() -> {
                        Intent share = new Intent(Intent.ACTION_SEND);
                        share.setType("image/png");
                        share.putExtra(Intent.EXTRA_STREAM, uri);
                        if (title != null) share.putExtra(Intent.EXTRA_SUBJECT, title);
                        if (text  != null) share.putExtra(Intent.EXTRA_TEXT, text);
                        share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(Intent.createChooser(share, title != null ? title : "مشاركة صورة"));
                    });
                } catch (Exception e) {
                    // Silently fail — no crash
                }
            }).start();
        }

        /** Copy text to system clipboard */
        @JavascriptInterface
        public void copyText(String text) {
            runOnUiThread(() -> {
                android.content.ClipboardManager cm =
                    (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                if (cm != null && text != null) {
                    cm.setPrimaryClip(
                        android.content.ClipData.newPlainText("copied", text)
                    );
                }
                // Notify the page
                if (webView != null) {
                    webView.evaluateJavascript(
                        "window.postMessage({type:'BRIDGE_COPY_ACK',ok:true},'*');", null
                    );
                }
            });
        }

        /**
         * Opens the same native file picker used by HTML file inputs.
         *
         * The bridge creates a temporary hidden input in the current page,
         * which means the website can read the selected file normally through
         * input.files and upload it with fetch/FormData without base64-copying
         * a large file through the Java bridge.
         *
         * JS usage:
         *   window.AppBridge.pickFile("image/*", false);
         *   window.AppBridge.pickFile("any file type", true);
         */
        @JavascriptInterface
        public void pickFile(String accept, boolean allowMultiple) {
            runOnUiThread(() -> {
                if (webView == null || destroyed) return;
                String safeAccept = jsonEscape(accept == null ? "*/*" : accept);
                String script =
                        "(function(){" +
                        "var old=document.getElementById('app-bridge-file-input');" +
                        "if(old)old.remove();" +
                        "var i=document.createElement('input');" +
                        "i.id='app-bridge-file-input';" +
                        "i.type='file';" +
                        "i.accept='" + safeAccept + "';" +
                        "i.multiple=" + (allowMultiple ? "true" : "false") + ";" +
                        "i.style.position='fixed';i.style.left='-10000px';" +
                        "document.body.appendChild(i);" +
                        "i.addEventListener('change',function(){" +
                        "i.dispatchEvent(new CustomEvent('native-file-picked'," +
                        "{detail:{count:i.files?i.files.length:0,input:i}}));" +
                        "});" +
                        "i.click();" +
                        "})();";
                webView.evaluateJavascript(script, null);
            });
        }

        /**
         * Opens the device gallery directly. Image URI(s) are returned through
         * the same hidden HTML input used by normal uploads, so the page can
         * send them with FormData without base64 conversion.
         *
         * JS usage: window.AppBridge.pickImages(false) // one image
         *           window.AppBridge.pickImages(true)  // multiple images
         */
        @JavascriptInterface
        public void pickImages(boolean allowMultiple) {
            pickFile("image/*", allowMultiple);
        }

        /**
         * Hides the native loading overlay.
         *
         * Call this once the website is fully ready to be displayed — for example
         * after initial data has loaded and the UI has rendered. The overlay shows
         * a spinner and "جاري التحميل…" and will NOT disappear on its own; it stays
         * visible until this method is called.
         *
         * JS usage:
         *   window.AppBridge.removeSplashScreen();
         */
        @JavascriptInterface
        public void removeSplashScreen() {
            hideLoadingOverlay();
        }

        /** Returns the current theme ("dark" or "light") */
        @JavascriptInterface
        public String getTheme() {
            return appTheme;
        }

        /**
         * Returns Android's Secure ANDROID_ID to the currently displayed site.
         * The site must send this value to its own server and enforce any
         * one-account-per-device rule there; the app intentionally does not
         * decide account eligibility on the client.
         *
         * JS usage: window.AppBridge.getAndroidId()
         */
        @JavascriptInterface
        public String getAndroidId() {
            try {
                String androidId = Settings.Secure.getString(
                        getContentResolver(), Settings.Secure.ANDROID_ID);
                return androidId == null ? "" : androidId;
            } catch (Exception error) {
                Log.w("ChatWebView", "Unable to read Android ID", error);
                return "";
            }
        }

        // ── External URL bridge ───────────────────────────────────────────
        /**
         * Opens a URL in the user's default external browser (or app that handles the scheme).
         * Safe to call for http/https/market/intent links.
         *
         * JS usage:
         *   window.AppBridge.openExternalUrl("https://example.com");
         */
        @JavascriptInterface
        public void openExternalUrl(String url) {
            if (url == null || url.trim().isEmpty()) return;
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url.trim()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception e) {
                    Log.w("ChatWebView", "openExternalUrl failed: " + e.getMessage());
                }
            });
        }

        // ── Remote config bridges (no app update needed) ──────────────────
        /**
         * Fetches a remote JSON config asynchronously and dispatches the result
         * back to the page via two channels:
         *   • CustomEvent  'remote-config-result'  (event.detail)
         *   • window.postMessage  {type:'REMOTE_CONFIG_RESULT'}
         *
         * On success:  { callbackId, ok: true,  data: <parsed JSON object> }
         * On failure:  { callbackId, ok: false, error: "<message>" }
         *
         * JS usage:
         *   window.AppBridge.fetchRemoteConfig("https://cdn.example.com/config.json", "cfg1");
         *   window.addEventListener('remote-config-result', e => {
         *     if (e.detail.callbackId === 'cfg1' && e.detail.ok) {
         *       const config = e.detail.data;  // already-parsed JS object
         *     }
         *   });
         */
        @JavascriptInterface
        public void fetchRemoteConfig(String configUrl, String callbackId) {
            if (configUrl == null || configUrl.trim().isEmpty()) return;
            final String safeCallbackId = (callbackId != null ? callbackId : "")
                    .replace("\\", "\\\\").replace("'", "\\'");
            new Thread(() -> {
                String result = null;
                String errorMsg = null;
                java.net.HttpURLConnection conn = null;
                try {
                    java.net.URL url = new java.net.URL(configUrl.trim());
                    conn = (java.net.HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("GET");
                    conn.setConnectTimeout(10000);
                    conn.setReadTimeout(10000);
                    conn.setRequestProperty("Accept", "application/json");
                    conn.setRequestProperty("Cache-Control", "no-cache");
                    int status = conn.getResponseCode();
                    if (status == 200) {
                        java.io.BufferedReader reader = new java.io.BufferedReader(
                            new java.io.InputStreamReader(conn.getInputStream(), "UTF-8"));
                        StringBuilder sb = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) sb.append(line);
                        reader.close();
                        result = sb.toString().trim();
                    } else {
                        errorMsg = "HTTP " + status;
                    }
                } catch (Exception e) {
                    errorMsg = e.getMessage() != null ? e.getMessage() : "network error";
                } finally {
                    if (conn != null) try { conn.disconnect(); } catch (Exception ignored) {}
                }

                final String finalResult = result;
                final String finalError  = errorMsg;
                runOnUiThread(() -> {
                    if (destroyed || webView == null) return;
                    String js;
                    if (finalResult != null) {
                        // Embed raw JSON directly so the page receives a proper JS object
                        js = "(function(){" +
                             "  var d={callbackId:'" + safeCallbackId + "',ok:true,data:" + finalResult + "};" +
                             "  try{window.dispatchEvent(new CustomEvent('remote-config-result',{detail:d}));}catch(e){}" +
                             "  try{window.postMessage(Object.assign({type:'REMOTE_CONFIG_RESULT'},d),'*');}catch(e){}" +
                             "})();";
                    } else {
                        String safeErr = (finalError != null ? finalError : "unknown")
                                .replace("\\", "\\\\").replace("'", "\\'");
                        js = "(function(){" +
                             "  var d={callbackId:'" + safeCallbackId + "',ok:false,error:'" + safeErr + "'};" +
                             "  try{window.dispatchEvent(new CustomEvent('remote-config-result',{detail:d}));}catch(e){}" +
                             "  try{window.postMessage(Object.assign({type:'REMOTE_CONFIG_RESULT'},d),'*');}catch(e){}" +
                             "})();";
                    }
                    webView.evaluateJavascript(js, null);
                });
            }).start();
        }

        /**
         * Persists a string config value in SharedPreferences.
         * Values survive app restarts and are readable via getConfigValue / getAllConfigValues.
         *
         * JS usage:
         *   window.AppBridge.setConfigValue("featureX", "true");
         *   window.AppBridge.setConfigValue("apiBase", "https://api.example.com");
         */
        @JavascriptInterface
        public void setConfigValue(String key, String value) {
            if (key == null || key.trim().isEmpty()) return;
            getSharedPreferences("aqb_config", MODE_PRIVATE).edit()
                .putString(key.trim(), value != null ? value : "")
                .apply();
        }

        /**
         * Reads a previously stored config value. Returns "" if the key doesn't exist.
         *
         * JS usage:
         *   const base = window.AppBridge.getConfigValue("apiBase");
         */
        @JavascriptInterface
        public String getConfigValue(String key) {
            if (key == null || key.trim().isEmpty()) return "";
            return getSharedPreferences("aqb_config", MODE_PRIVATE)
                .getString(key.trim(), "");
        }

        /**
         * Returns all stored config values as a JSON object string.
         *
         * JS usage:
         *   const cfg = JSON.parse(window.AppBridge.getAllConfigValues());
         *   // cfg = { "featureX": "true", "apiBase": "https://..." }
         */
        @JavascriptInterface
        public String getAllConfigValues() {
            try {
                java.util.Map<String, ?> all =
                    getSharedPreferences("aqb_config", MODE_PRIVATE).getAll();
                StringBuilder sb = new StringBuilder("{");
                boolean first = true;
                for (java.util.Map.Entry<String, ?> entry : all.entrySet()) {
                    if (!first) sb.append(",");
                    first = false;
                    String k = jsonEscape(entry.getKey());
                    String v = jsonEscape(String.valueOf(entry.getValue()));
                    sb.append("\"").append(k).append("\":\"").append(v).append("\"");
                }
                sb.append("}");
                return sb.toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        /**
         * Removes a single config value.
         *
         * JS usage:
         *   window.AppBridge.removeConfigValue("featureX");
         */
        @JavascriptInterface
        public void removeConfigValue(String key) {
            if (key == null || key.trim().isEmpty()) return;
            getSharedPreferences("aqb_config", MODE_PRIVATE).edit()
                .remove(key.trim())
                .apply();
        }

        /**
         * Clears all stored config values.
         *
         * JS usage:
         *   window.AppBridge.clearAllConfigValues();
         */
        @JavascriptInterface
        public void clearAllConfigValues() {
            getSharedPreferences("aqb_config", MODE_PRIVATE).edit().clear().apply();
        }

        /** Escapes a string for safe embedding inside a JSON string value. */
        private String jsonEscape(String s) {
            if (s == null) return "";
            return s.replace("\\", "\\\\")
                    .replace("'", "\\'")
                    .replace("\"", "\\\"")
                    .replace("\n", "\\n")
                    .replace("\r", "\\r")
                    .replace("\t", "\\t");
        }

        /**
         * [LEGACY — kept for backward compatibility]
         * Previously called by injected JS that read from window.OneSignal.
         * That approach has been replaced: the ID is now read from the Android
         * Native SDK in injectOneSignalId() and pushed INTO the page, not pulled
         * FROM it. This method is a no-op unless something calls it manually.
         */
        @JavascriptInterface
        public void receiveSubscriptionId(String id) {
            if (id == null || id.trim().isEmpty()) return;
            String trimmed = id.trim();
            // Accept it only if we don't already have an authoritative native ID.
            if (oneSignalSubscriptionId == null || oneSignalSubscriptionId.isEmpty()) {
                oneSignalSubscriptionId = trimmed;
                Log.d(TAG_OS, "receiveSubscriptionId (legacy fallback): " + trimmed);
                getSharedPreferences(PREF_NAME, MODE_PRIVATE)
                    .edit()
                    .putString(PREF_KEY_ID, trimmed)
                    .apply();
            }
        }

        /**
         * Returns the OneSignal subscription ID read directly from the Android
         * Native SDK. Falls back to the cached value if the SDK is not ready.
         * Returns "" if no ID is available yet.
         *
         * JS usage:
         *   const id = window.AppBridge.getOneSignalId();
         *
         * Prefer reading window.NativeOneSignalId (already set on page load)
         * over calling this method every time — it avoids a synchronous bridge call.
         */
        @JavascriptInterface
        public String getOneSignalId() {
            // 1. Try Android Native SDK first (most authoritative).
            try {
                String nativeId = OneSignal.getUser().getPushSubscription().getId();
                if (nativeId != null && !nativeId.trim().isEmpty()) {
                    // Keep our cache in sync.
                    oneSignalSubscriptionId = nativeId.trim();
                    return oneSignalSubscriptionId;
                }
            } catch (Exception e) {
                Log.w(TAG_OS, "getOneSignalId: SDK not ready — " + e.getMessage());
            }
            // 2. In-memory cache from a previous successful read.
            if (oneSignalSubscriptionId != null && !oneSignalSubscriptionId.isEmpty()) {
                return oneSignalSubscriptionId;
            }
            // 3. SharedPreferences — persisted from a previous session.
            return getSharedPreferences(PREF_NAME, MODE_PRIVATE)
                .getString(PREF_KEY_ID, "");
        }

        /**
         * Backward-compatible alias for getOneSignalId().
         *
         * JS usage:
         *   const id = window.AppBridge.getSubscriptionId();
         */
        @JavascriptInterface
        public String getSubscriptionId() {
            return getOneSignalId();
        }

        // ── Activity launchers ────────────────────────────────────────────

        /**
         * Opens PdfViewerActivity with the supplied URL and optional title.
         *
         * JS usage:
         *   window.AppBridge.openPdfViewer("https://example.com/file.pdf", "اسم الملف", true);
         *
         * URL and the screenshot-prevention flag are required; pass an empty string
         * for title to use the default.
         */
        @JavascriptInterface
        public void openPdfViewer(String url, String title, boolean preventScreenshots) {
            if (url == null || url.trim().isEmpty()) return;
            runOnUiThread(() -> {
                Intent intent = new Intent(ChatWebViewActivity.this, PdfViewerActivity.class);
                intent.putExtra(PdfViewerActivity.EXTRA_URL, url.trim());
                if (title != null && !title.trim().isEmpty()) {
                    intent.putExtra(PdfViewerActivity.EXTRA_TITLE, title.trim());
                }
                intent.putExtra(PdfViewerActivity.EXTRA_PREVENT_SCREENSHOTS, preventScreenshots);
                startActivity(intent);
            });
        }

        /**
         * Opens VideoViewerActivity with the supplied URL and optional title.
         *
         * JS usage:
         *   window.AppBridge.openVideoViewer("https://example.com/video.mp4", "اسم الفيديو");
         *
         * Both parameters are required; pass an empty string for title to use the default.
         */
        @JavascriptInterface
        public void openVideoViewer(String url, String title) {
            if (url == null || url.trim().isEmpty()) return;
            runOnUiThread(() -> {
                Intent intent = new Intent(ChatWebViewActivity.this, VideoViewerActivity.class);
                intent.putExtra(VideoViewerActivity.EXTRA_URL, url.trim());
                if (title != null && !title.trim().isEmpty()) {
                    intent.putExtra(VideoViewerActivity.EXTRA_TITLE, title.trim());
                }
                startActivity(intent);
            });
        }

        /**
         * Replaces any active ChatWebViewActivity with the supplied URL and keeps
         * only one native WebView viewer alive in the current task.
         *
         * JS usage:
         *   window.AppBridge.openChatWebView("https://example.com/page", "عنوان الصفحة");
         *
         * Pass an empty string for title to use the default label.
         */
        @JavascriptInterface
        public void openChatWebView(String url, String title) {
            if (url == null || url.trim().isEmpty()) return;
            runOnUiThread(() -> {
                Intent intent = new Intent(ChatWebViewActivity.this, ChatWebViewActivity.class);
                intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
                intent.putExtra(ChatWebViewActivity.EXTRA_URL, url.trim());
                if (title != null && !title.trim().isEmpty()) {
                    intent.putExtra(ChatWebViewActivity.EXTRA_TITLE, title.trim());
                }
                // Inherit the current theme so child window looks consistent
                intent.putExtra(ChatWebViewActivity.EXTRA_THEME, appTheme);
                startActivity(intent);
            });
        }

        /** Short vibration feedback */
        @JavascriptInterface
        public void vibrate() {
            try {
                android.os.Vibrator v =
                    (android.os.Vibrator) getSystemService(VIBRATOR_SERVICE);
                if (v != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        v.vibrate(android.os.VibrationEffect.createOneShot(
                            40, android.os.VibrationEffect.DEFAULT_AMPLITUDE));
                    } else {
                        v.vibrate(40);
                    }
                }
            } catch (Exception ignored) {}
        }
    }
}
