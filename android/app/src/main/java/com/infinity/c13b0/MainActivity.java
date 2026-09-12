package com.infinity.c13b0;

import android.app.PictureInPictureParams;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

/**
 * Infinity Android host.
 *
 * Channel pages call window.InfinityAndroid.enterPictureInPicture() immediately
 * before opening Android's Share sheet. The Activity then stays visible as a
 * system PiP window while X/Twitter or another sharing app is in front.
 */
public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView = getBridge().getWebView();
        webView.addJavascriptInterface(new InfinityAndroidBridge(), "InfinityAndroid");
    }

    public final class InfinityAndroidBridge {
        @JavascriptInterface
        public boolean enterPictureInPicture() {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                return false;
            }
            runOnUiThread(() -> {
                PictureInPictureParams params = new PictureInPictureParams.Builder()
                    .setAspectRatio(new Rational(16, 9))
                    .build();
                MainActivity.this.enterPictureInPictureMode(params);
            });
            return true;
        }

        @JavascriptInterface
        public boolean isPictureInPictureAvailable() {
            return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && getPackageManager().hasSystemFeature("android.software.picture_in_picture");
        }
    }
}
