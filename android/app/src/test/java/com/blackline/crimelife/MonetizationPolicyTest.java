package com.blackline.crimelife;

import static org.junit.Assert.*;
import org.junit.Test;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.util.Base64;

public class MonetizationPolicyTest {
    @Test public void failedConsentRetriesHaveABoundAndCannotOverlap() {
        ConsentRetryPolicy policy = new ConsentRetryPolicy();
        assertTrue(policy.start(1000, false));
        // Even a much later foreground action must not duplicate an active update.
        assertFalse(policy.start(61000, false));
        policy.finish();
        assertFalse(policy.start(30999, false));
        assertTrue(policy.start(31000, false));
        policy.finish();
        assertFalse(policy.start(60999, false));
        assertTrue(policy.start(61000, false));
    }

    @Test public void consentIsCheckedAtLaunchButValidConsentNeedsNoResumeRetry() {
        ConsentRetryPolicy policy = new ConsentRetryPolicy();
        // Each new native session checks consent even when UMP has a valid cache.
        assertTrue(policy.start(5000, true));
        assertTrue(policy.wasRequested());
        policy.finish();
        assertFalse(policy.start(35000, true));
        assertFalse(policy.start(95000, true));
        // Skipped checks do not spend the retry interval if consent becomes unavailable.
        assertTrue(policy.start(95000, false));
        policy.finish();
        assertFalse(policy.start(94999, false));
    }

    @Test public void dayEndHasGraceDayAndTimeLimitsAndCannotReplayAMiss() {
        AdPolicy policy = new AdPolicy(0);
        assertFalse(policy.considerDay(4, 119999, true));
        assertFalse(policy.considerDay(4, 120000, true));
        assertTrue(policy.considerDay(5, 120000, true));
        policy.recordInterstitial(5, 120000);
        assertFalse(policy.considerDay(7, 240000, true));
        assertTrue(policy.considerDay(8, 240000, true));
        policy.recordInterstitial(8, 240000);
        assertFalse(policy.considerDay(11, 359999, true));
        assertFalse(policy.considerDay(12, 360000, false));
        assertFalse(policy.considerDay(12, 360000, true));
        assertTrue(policy.considerDay(13, 360000, true));
    }

    @Test public void rewardedFullscreenAlsoResetsTheTimedCooldown() {
        AdPolicy policy = new AdPolicy(0);
        policy.recordFullscreen(200000);
        assertFalse(policy.considerDay(4, 319999, true));
        assertTrue(policy.considerDay(5, 320000, true));
    }

    @Test public void earnedRewardNeedsDismissalAndCompletesOnlyOnce() {
        RewardSession reward = new RewardSession();
        reward.earn();
        reward.earn();
        assertEquals(Boolean.TRUE, reward.finish(true));
        assertNull(reward.finish(true));
        RewardSession skipped = new RewardSession();
        assertEquals(Boolean.FALSE, skipped.finish(true));
        skipped.earn();
        assertNull(skipped.finish(true));
        RewardSession failed = new RewardSession();
        failed.earn();
        assertEquals(Boolean.FALSE, failed.finish(false));
    }

    @Test public void receiptVerificationRejectsTamperingAndUnconfiguredKeys() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        KeyPair keys = generator.generateKeyPair();
        String receipt = "{\"packageName\":\"com.blackline.crimelife\",\"productId\":\"remove_ads\",\"purchaseState\":0}";
        Signature signer = Signature.getInstance("SHA1withRSA");
        signer.initSign(keys.getPrivate());
        signer.update(receipt.getBytes(StandardCharsets.UTF_8));
        String signature = Base64.getEncoder().encodeToString(signer.sign());
        String publicKey = Base64.getEncoder().encodeToString(keys.getPublic().getEncoded());
        assertTrue(ReceiptVerifier.canVerify(publicKey));
        assertFalse(ReceiptVerifier.canVerify(""));
        assertFalse(ReceiptVerifier.canVerify("invalid"));
        assertTrue(ReceiptVerifier.verify(publicKey, receipt, signature));
        assertFalse(ReceiptVerifier.verify(publicKey, receipt.replace("remove_ads", "forged"), signature));
        assertFalse(ReceiptVerifier.verify("", receipt, signature));
        assertFalse(ReceiptVerifier.verify("invalid", receipt, signature));
        assertFalse(ReceiptVerifier.verify(publicKey, receipt, "invalid"));
    }
}
