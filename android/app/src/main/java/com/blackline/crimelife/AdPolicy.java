package com.blackline.crimelife;

final class AdPolicy {
    private long lastFullscreenAt;
    private int lastInterstitialDay;
    private int seenDay;
    AdPolicy(long startedAt) { this(startedAt, -1); }
    AdPolicy(long startedAt, int lastDay) {
        lastFullscreenAt = startedAt;
        lastInterstitialDay = lastDay;
    }
    boolean considerDay(int day, long now, boolean eligible) {
        if (day <= seenDay) return false;
        seenDay = day;
        return eligible && day >= 4 && now - lastFullscreenAt >= 120000
            && (lastInterstitialDay < 0 || day - lastInterstitialDay >= 3);
    }
    void recordInterstitial(int day, long now) {
        lastInterstitialDay = day;
        recordFullscreen(now);
    }
    void recordFullscreen(long now) { lastFullscreenAt = now; }
}
