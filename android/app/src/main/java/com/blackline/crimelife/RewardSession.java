package com.blackline.crimelife;

final class RewardSession {
    private boolean earned;
    private boolean completed;
    void earn() { if (!completed) earned = true; }
    /** null means this session has already resolved; callbacks cannot grant twice. */
    Boolean finish(boolean dismissed) {
        if (completed) return null;
        completed = true;
        return earned && dismissed;
    }
}
