package com.wails.app;

import android.os.Bundle;
import android.os.Build;
import android.content.res.Configuration;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.view.RoundedCorner;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.graphics.Insets;

/** Keep the editor and its controls clear of Android's system bars and keyboard. */
public class OrbitalNoteActivity extends MainActivity {
    private static WorkspaceDocuments documents;
    public static void initializeDocuments(MainActivity activity) {
        documents = new WorkspaceDocuments(activity);
    }
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (documents != null && documents.result(requestCode, resultCode, data)) return;
        super.onActivityResult(requestCode, resultCode, data);
    }
    @Override
    protected void onDestroy() {
        if (documents != null) documents.cancelPicker();
        super.onDestroy();
    }
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView = findViewById(R.id.webview);
        webView.getSettings().setSupportZoom(false);
        webView.getSettings().setBuiltInZoomControls(false);
        webView.getSettings().setDisplayZoomControls(false);
        webView.addJavascriptInterface(new AndroidBridge(), "OrbitalNoteAndroid");
        boolean systemDark = (getResources().getConfiguration().uiMode
            & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        applyTheme(getPreferences(MODE_PRIVATE).getBoolean("dark", systemDark));
        View content = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(content, (view, windowInsets) -> {
            Insets insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime()
                    | WindowInsetsCompat.Type.displayCutout());
            int top = insets.top;
            int bottom = insets.bottom;
            // System bars alone can be smaller than the physical corner radius.
            // Keep full-width controls inside the straight portion of the display.
            if (Build.VERSION.SDK_INT >= 31) {
                WindowInsets nativeInsets = windowInsets.toWindowInsets();
                if (nativeInsets != null) {
                    for (int position : new int[] { RoundedCorner.POSITION_TOP_LEFT, RoundedCorner.POSITION_TOP_RIGHT }) {
                        RoundedCorner corner = nativeInsets.getRoundedCorner(position);
                        if (corner != null) top = Math.max(top, corner.getRadius());
                    }
                    for (int position : new int[] { RoundedCorner.POSITION_BOTTOM_LEFT, RoundedCorner.POSITION_BOTTOM_RIGHT }) {
                        RoundedCorner corner = nativeInsets.getRoundedCorner(position);
                        if (corner != null) bottom = Math.max(bottom, corner.getRadius());
                    }
                }
            }
            view.setPadding(insets.left, top, insets.right, bottom);
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(content);
    }

    private void applyTheme(boolean dark) {
        int color = dark ? Color.rgb(30, 30, 30) : Color.WHITE;
        findViewById(android.R.id.content).setBackgroundColor(color);
        getWindow().getDecorView().setBackgroundColor(color);
        ((WebView) findViewById(R.id.webview)).setBackgroundColor(color);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 29) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
        androidx.core.view.WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(!dark);
        controller.setAppearanceLightNavigationBars(!dark);
    }

    private final class AndroidBridge {
        @JavascriptInterface
        public String openURL(String raw) {
            Uri uri = Uri.parse(raw);
            String scheme = uri.getScheme();
            if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)
                    && !"mailto".equalsIgnoreCase(scheme)) {
                return "Unsupported link scheme";
            }
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri)
                    .addCategory(Intent.CATEGORY_BROWSABLE));
                return "";
            } catch (ActivityNotFoundException e) {
                return "No app is available to open this link";
            } catch (SecurityException e) {
                return "Android could not open this link";
            }
        }

        @JavascriptInterface
        public void setTheme(boolean dark) {
            runOnUiThread(() -> {
                getPreferences(MODE_PRIVATE).edit().putBoolean("dark", dark).apply();
                applyTheme(dark);
            });
        }
    }
}
