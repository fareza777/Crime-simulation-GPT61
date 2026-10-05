package com.blackline.crimelife;

final class ConsentRetryPolicy {
    private static final long RETRY_INTERVAL_MS = 30000;
    private boolean requested, inFlight;
    private long lastAttemptAt;

    boolean start(long now, boolean adsAvailable) {
        if (inFlight || (requested && (adsAvailable || now - lastAttemptAt < RETRY_INTERVAL_MS))) return false;
        requested = true;
        inFlight = true;
        lastAttemptAt = now;
        return true;
    }
    boolean wasRequested() { return requested; }
    void finish() { inFlight = false; }
}
