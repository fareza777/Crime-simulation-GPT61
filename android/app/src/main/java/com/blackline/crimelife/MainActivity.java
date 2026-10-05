package com.blackline.crimelife;

import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private FrameLayout adContainer;

    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeAssetsPlugin.class);
        registerPlugin(BlacklineMonetizationPlugin.class);
        super.onCreate(savedInstanceState);
    }

    /** A weighted WebView above a sibling banner: ad pixels cannot cover game controls. */
    FrameLayout getAdContainer() {
        if (adContainer != null) return adContainer;
        View webView = getBridge().getWebView();
        ViewGroup parent = (ViewGroup) webView.getParent();
        ViewGroup.LayoutParams outer = webView.getLayoutParams();
        int index = parent.indexOfChild(webView);
        parent.removeView(webView);
        LinearLayout column = new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);
        column.setBackgroundColor(0xff101213);
        column.addView(webView, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        adContainer = new FrameLayout(this);
        adContainer.setVisibility(View.GONE);
        column.addView(adContainer, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        parent.addView(column, index, outer);
        // Capacitor's CSS insets continue on the WebView. Only the native ad
        // container needs its own navigation-bar padding while visible.
        ViewCompat.setOnApplyWindowInsetsListener(adContainer, (view, insets) -> {
            int bottom = insets.getInsets(WindowInsetsCompat.Type.systemBars()).bottom;
            view.setPadding(0, 0, 0, bottom);
            return insets;
        });
        ViewCompat.requestApplyInsets(adContainer);
        return adContainer;
    }
}
