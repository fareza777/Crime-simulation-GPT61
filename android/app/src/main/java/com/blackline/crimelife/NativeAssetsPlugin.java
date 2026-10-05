package com.blackline.crimelife;

import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

/** APK assets already work offline. Retire any browser cache left by v1.0. */
@CapacitorPlugin(name = "BlacklineAssets")
public class NativeAssetsPlugin extends Plugin {
    @Override public void load() {
        bridge.injectScriptBeforeLoad("native-bootstrap.js");
    }
}
