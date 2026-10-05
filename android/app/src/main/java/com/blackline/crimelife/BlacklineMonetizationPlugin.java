package com.blackline.crimelife;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import androidx.annotation.NonNull;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.RequestConfiguration;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;
import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;
import java.util.function.BooleanSupplier;

/** Official Google SDK integration. There is deliberately no JS entitlement setter. */
@CapacitorPlugin(name = "BlacklineMonetization")
public class BlacklineMonetizationPlugin extends Plugin {
    private static final String PRODUCT = "remove_ads";
    private static final String ADS_UNAVAILABLE = "Ads are temporarily unavailable. Your game can continue offline.";
    private static final long AD_LIFETIME = 55 * 60 * 1000L;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService adsExecutor = Executors.newSingleThreadExecutor();
    private final ConsentRetryPolicy consentRetry = new ConsentRetryPolicy();
    private SharedPreferences entitlementPrefs;
    private ConsentInformation consent;
    private BillingClient billing;
    private AdPolicy policy;
    private boolean initialized, foreground, destroyed, removeAds;
    private boolean consentFormPending, consentBusy;
    private boolean adsStarting, adsStarted, rewardLoading, interstitialLoading;
    private boolean bannerWanted, bannerLoaded, fullscreenBusy, billingBusy;
    private boolean billingConnecting, billingEverConnected, ownershipQuery, initialOwnershipSettled;
    private int adGeneration, ownershipEpoch, entitlementRevision;
    private long rewardLoadedAt, interstitialLoadedAt;
    private long nextRewardLoad, nextInterstitialLoad, nextBannerLoad, nextAdsStart;
    private String price, error;
    private AdView banner;
    private FrameLayout bannerContainer;
    private RewardedAd rewarded;
    private InterstitialAd interstitial;
    private Object fullscreenToken, adsInitializationToken;
    private PluginCall fullscreenCall, purchaseCall, privacyCall, restoreCall;
    private RewardSession rewardSession;
    private String rewardRequestId;
    private boolean interstitialWasShown;
    private final List<Consumer<Boolean>> ownershipCallbacks = new ArrayList<>();
    private final Runnable retryAds = () -> { if (!destroyed && foreground && adsAllowed()) pumpAds(); };

    @Override public void load() {
        entitlementPrefs = getContext().getSharedPreferences("blackline_native_entitlement", Context.MODE_PRIVATE);
        consent = UserMessagingPlatform.getConsentInformation(getContext());
        policy = new AdPolicy(SystemClock.elapsedRealtime(), entitlementPrefs.getInt("last_interstitial_day", -1));
        // Revalidate the saved signature. A boolean from an imported game save
        // or a JS preference write cannot establish a purchase.
        try {
            Purchase cached = new Purchase(entitlementPrefs.getString("receipt", ""), entitlementPrefs.getString("signature", ""));
            removeAds = entitlementPrefs.getBoolean("established", false) && validPurchase(cached);
        } catch (Exception invalidCache) { removeAds = false; }
    }

    private void ui(Runnable action) {
        main.post(() -> { if (!destroyed && !getActivity().isFinishing()) action.run(); });
    }
    private boolean busy() { return fullscreenBusy || billingBusy || consentBusy; }
    private boolean adsAllowed() { return !destroyed && initialOwnershipSettled && !removeAds && consentRetry.wasRequested() && consent.canRequestAds() && !consentBusy; }
    private boolean validPurchase(Purchase purchase) {
        return purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED
            && getContext().getPackageName().equals(purchase.getPackageName())
            && purchase.getProducts().contains(PRODUCT)
            && !purchase.getPurchaseToken().isEmpty()
            && ReceiptVerifier.verify(BuildConfig.PLAY_BILLING_PUBLIC_KEY, purchase.getOriginalJson(), purchase.getSignature());
    }
    private boolean fresh(long loadedAt) { return SystemClock.elapsedRealtime() - loadedAt < AD_LIFETIME; }
    private JSObject snapshot() {
        boolean allowed = adsAllowed();
        boolean visible = bannerContainer != null && bannerContainer.getVisibility() == View.VISIBLE && bannerLoaded;
        float density = getContext().getResources().getDisplayMetrics().density;
        JSObject result = new JSObject();
        result.put("nativeSupported", true);
        result.put("initialized", initialized);
        result.put("removeAds", removeAds);
        result.put("price", price == null ? JSONObject.NULL : price);
        result.put("canRequestAds", allowed);
        result.put("bannerVisible", visible);
        result.put("bannerHeight", visible ? bannerContainer.getHeight() / density : 0);
        result.put("rewardedReady", allowed && rewarded != null && fresh(rewardLoadedAt));
        result.put("interstitialReady", allowed && interstitial != null && fresh(interstitialLoadedAt));
        result.put("privacyRequired", consent.getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED);
        result.put("busy", busy());
        result.put("error", error == null ? JSONObject.NULL : error);
        return result;
    }
    private void publish() { if (!destroyed) notifyListeners("stateChanged", snapshot()); }
    private void resolvePurchase(PluginCall call, boolean purchased) {
        JSObject result = new JSObject();
        result.put("purchased", purchased);
        result.put("snapshot", snapshot());
        call.resolve(result);
    }

    @PluginMethod public void getSnapshot(PluginCall call) { ui(() -> call.resolve(snapshot())); }
    @PluginMethod public void initialize(PluginCall call) {
        ui(() -> {
            if (!initialized) {
                initialized = true;
                // Give startup restoration a bounded chance to remove all ads
                // before a banner appears on a freshly installed purchaser's app.
                main.postDelayed(() -> { if (!destroyed && !initialOwnershipSettled) { initialOwnershipSettled = true; pumpAds(); publish(); } }, 15000);
                connectBilling();
                if (foreground) requestConsent();
            }
            call.resolve(snapshot());
            publish();
        });
    }
    @PluginMethod public void setBannerVisible(PluginCall call) {
        ui(() -> {
            boolean visible = call.getBoolean("visible", false);
            boolean placementOpened = visible && !bannerWanted;
            bannerWanted = visible;
            // Opening an unobscured gameplay screen can recover an offline
            // launch. Repeated visibility updates do not trigger consent work.
            if (placementOpened && initialized && !removeAds) requestConsent();
            syncBanner();
            pumpAds();
            call.resolve(snapshot());
        });
    }

    private void requestConsent() {
        if (destroyed || !foreground || consentBusy
                || !consentRetry.start(SystemClock.elapsedRealtime(), consent.canRequestAds())) return;
        // No debug geography or forced consent: demo AdMob IDs may have no
        // privacy message configured. The real app must configure one in AdMob.
        ConsentRequestParameters parameters = new ConsentRequestParameters.Builder().build();
        consent.requestConsentInfoUpdate(getActivity(), parameters,
            () -> ui(() -> {
                consentRetry.finish();
                consentFormPending = !removeAds;
                tryConsentForm();
                pumpAds();
                publish();
            }),
            failure -> ui(() -> {
                consentRetry.finish();
                // UMP may still permit valid prior-session consent. Never invent it.
                pumpAds();
                syncBanner();
                publish();
            }));
        pumpAds();
    }
    private void tryConsentForm() {
        if (!consentFormPending || destroyed || !foreground || busy() || removeAds) return;
        consentFormPending = false;
        consentBusy = true;
        syncBanner();
        publish();
        UserMessagingPlatform.loadAndShowConsentFormIfRequired(getActivity(), failure -> ui(() -> {
            consentBusy = false;
            if (failure != null && !consent.canRequestAds()) error = "Ads are unavailable until privacy choices can be checked.";
            pumpAds();
            syncBanner();
            publish();
        }));
    }
    @PluginMethod public void openPrivacy(PluginCall call) {
        ui(() -> {
            if (busy() || !foreground || consent.getPrivacyOptionsRequirementStatus() != ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED) {
                call.resolve(snapshot());
                return;
            }
            privacyCall = call;
            consentBusy = true;
            error = null;
            clearAds();
            publish();
            UserMessagingPlatform.showPrivacyOptionsForm(getActivity(), failure -> ui(() -> {
                if (privacyCall != call) return;
                privacyCall = null;
                consentBusy = false;
                if (failure != null) error = "Privacy options could not load. Please reconnect and try again.";
                pumpAds();
                syncBanner();
                call.resolve(snapshot());
                publish();
            }));
        });
    }

    private void pumpAds() {
        if (!initialized || !foreground || !adsAllowed() || busy()) return;
        if (!adsStarted) {
            startAds();
            return;
        }
        try { preloadAds(); }
        catch (RuntimeException | LinkageError unavailable) {
            clearAds();
            nextRewardLoad = nextInterstitialLoad = nextBannerLoad = SystemClock.elapsedRealtime() + 60000;
            error = ADS_UNAVAILABLE;
            scheduleAdRetry();
            publish();
        }
    }
    private void startAds() {
        if (adsStarting || SystemClock.elapsedRealtime() < nextAdsStart) return;
        final Object token = new Object();
        adsInitializationToken = token;
        adsStarting = true;
        try {
            MobileAds.setRequestConfiguration(new RequestConfiguration.Builder()
                .setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_T).build());
            adsExecutor.execute(() -> {
                try {
                    MobileAds.initialize(getContext(), status -> ui(() -> {
                        if (adsInitializationToken != token || !adsStarting) return;
                        try {
                            // SDK 25.5 requires initialization before audio settings.
                            // No load/display can proceed before both settings succeed.
                            muteAds();
                        } catch (RuntimeException | LinkageError unavailable) {
                            failAdInitialization(token);
                            return;
                        }
                        adsInitializationToken = null;
                        adsStarting = false;
                        adsStarted = true;
                        if (ADS_UNAVAILABLE.equals(error)) error = null;
                        pumpAds();
                        publish();
                    }));
                } catch (RuntimeException | LinkageError unavailable) {
                    ui(() -> failAdInitialization(token));
                }
            });
        } catch (RuntimeException | LinkageError unavailable) {
            failAdInitialization(token);
        }
    }
    private void failAdInitialization(Object token) {
        if (adsInitializationToken != token) return;
        adsInitializationToken = null;
        adsStarting = false;
        adsStarted = false;
        nextAdsStart = SystemClock.elapsedRealtime() + 60000;
        error = ADS_UNAVAILABLE;
        scheduleAdRetry();
        publish();
    }
    private void muteAds() {
        MobileAds.setAppMuted(true);
        MobileAds.setAppVolume(0f);
    }
    private void preloadAds() {
        if (rewarded != null && !fresh(rewardLoadedAt)) rewarded = null;
        if (interstitial != null && !fresh(interstitialLoadedAt)) interstitial = null;
        final int generation = adGeneration;
        final long now = SystemClock.elapsedRealtime();
        if (rewarded == null && !rewardLoading && now >= nextRewardLoad) {
            rewardLoading = true;
            RewardedAd.load(getContext(), BuildConfig.ADMOB_REWARDED_ID, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
                @Override public void onAdLoaded(@NonNull RewardedAd ad) {
                    if (generation != adGeneration || destroyed) return;
                    rewardLoading = false;
                    if (adsAllowed()) { rewarded = ad; rewardLoadedAt = SystemClock.elapsedRealtime(); }
                    publish();
                }
                @Override public void onAdFailedToLoad(@NonNull LoadAdError failure) {
                    if (generation != adGeneration || destroyed) return;
                    rewardLoading = false;
                    nextRewardLoad = SystemClock.elapsedRealtime() + 60000;
                    scheduleAdRetry();
                    publish();
                }
            });
        }
        if (interstitial == null && !interstitialLoading && now >= nextInterstitialLoad) {
            interstitialLoading = true;
            InterstitialAd.load(getContext(), BuildConfig.ADMOB_INTERSTITIAL_ID, new AdRequest.Builder().build(), new InterstitialAdLoadCallback() {
                @Override public void onAdLoaded(@NonNull InterstitialAd ad) {
                    if (generation != adGeneration || destroyed) return;
                    interstitialLoading = false;
                    if (adsAllowed()) { interstitial = ad; interstitialLoadedAt = SystemClock.elapsedRealtime(); }
                    publish();
                }
                @Override public void onAdFailedToLoad(@NonNull LoadAdError failure) {
                    if (generation != adGeneration || destroyed) return;
                    interstitialLoading = false;
                    nextInterstitialLoad = SystemClock.elapsedRealtime() + 60000;
                    scheduleAdRetry();
                    publish();
                }
            });
        }
        if (bannerWanted && banner == null && now >= nextBannerLoad) loadBanner();
        syncBanner();
    }
    private void scheduleAdRetry() {
        main.removeCallbacks(retryAds);
        if (!destroyed && foreground && !removeAds) main.postDelayed(retryAds, 60000);
    }
    private void loadBanner() {
        if (!adsAllowed() || !foreground || !bannerWanted || !adsStarted || busy()) return;
        bannerContainer = ((MainActivity) getActivity()).getAdContainer();
        if (bannerContainer.getTag() == null) {
            bannerContainer.setTag("blackline-banner");
            bannerContainer.addOnLayoutChangeListener((view, l, t, r, b, oldL, oldT, oldR, oldB) -> {
                if (b - t != oldB - oldT) publish();
            });
        }
        float density = getContext().getResources().getDisplayMetrics().density;
        int widthPx = getBridge().getWebView().getWidth();
        if (widthPx <= 0) widthPx = getContext().getResources().getDisplayMetrics().widthPixels;
        int widthDp = Math.max(1, (int) (widthPx / density));
        final AdView ad = new AdView(getActivity());
        final int generation = adGeneration;
        banner = ad;
        ad.setAdUnitId(BuildConfig.ADMOB_BANNER_ID);
        ad.setAdSize(AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(getActivity(), widthDp));
        FrameLayout.LayoutParams layout = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER_HORIZONTAL);
        bannerContainer.addView(ad, layout);
        ad.setAdListener(new AdListener() {
            @Override public void onAdLoaded() {
                if (generation != adGeneration || banner != ad || destroyed) return;
                bannerLoaded = true;
                syncBanner();
                publish();
            }
            @Override public void onAdFailedToLoad(@NonNull LoadAdError failure) {
                if (generation != adGeneration || banner != ad || destroyed) return;
                destroyBanner();
                nextBannerLoad = SystemClock.elapsedRealtime() + 60000;
                scheduleAdRetry();
                publish();
            }
        });
        ad.loadAd(new AdRequest.Builder().build());
    }
    private void syncBanner() {
        if (bannerContainer == null) return;
        boolean visible = bannerWanted && bannerLoaded && foreground && adsAllowed() && !busy();
        bannerContainer.setVisibility(visible ? View.VISIBLE : View.GONE);
        if (banner != null) {
            try { if (visible) banner.resume(); else banner.pause(); }
            catch (RuntimeException | LinkageError unavailable) {
                destroyBanner();
                nextBannerLoad = SystemClock.elapsedRealtime() + 60000;
                scheduleAdRetry();
            }
        }
        publish();
    }
    private void destroyBanner() {
        if (bannerContainer != null) { bannerContainer.setVisibility(View.GONE); bannerContainer.removeAllViews(); }
        if (banner != null) {
            try { banner.destroy(); } catch (RuntimeException | LinkageError unavailable) { /* Optional SDK cleanup. */ }
            banner = null;
        }
        bannerLoaded = false;
    }
    private void clearAds() {
        adGeneration++;
        rewarded = null;
        interstitial = null;
        rewardLoading = false;
        interstitialLoading = false;
        nextRewardLoad = 0; nextInterstitialLoad = 0; nextBannerLoad = 0;
        main.removeCallbacks(retryAds);
        destroyBanner();
    }

    @PluginMethod public void showRewarded(PluginCall call) {
        ui(() -> {
            String placement = call.getString("placement", "");
            String requestId = call.getString("requestId", "");
            if ((!"energy".equals(placement) && !"cash".equals(placement)) || requestId.isEmpty()
                || !foreground || !adsStarted || busy() || !adsAllowed() || rewarded == null || !fresh(rewardLoadedAt)) {
                JSObject result = new JSObject();
                result.put("earned", false); result.put("dismissed", false); result.put("requestId", requestId); result.put("snapshot", snapshot());
                call.resolve(result);
                pumpAds();
                return;
            }
            Object token = new Object();
            fullscreenToken = token;
            fullscreenCall = call;
            rewardRequestId = requestId;
            rewardSession = new RewardSession();
            fullscreenBusy = true;
            error = null;
            RewardedAd ad = rewarded;
            rewarded = null;
            syncBanner();
            publish();
            try {
                ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                    @Override public void onAdShowedFullScreenContent() { if (fullscreenToken == token) policy.recordFullscreen(SystemClock.elapsedRealtime()); }
                    @Override public void onAdDismissedFullScreenContent() { finishReward(token, true); }
                    @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError failure) { finishReward(token, false); }
                });
                muteAds();
                ad.show(getActivity(), reward -> { if (fullscreenToken == token && rewardSession != null) rewardSession.earn(); });
            } catch (RuntimeException | LinkageError unavailable) { finishReward(token, false); }
        });
    }
    private void finishReward(Object token, boolean dismissed) {
        if (fullscreenToken != token || rewardSession == null) return;
        Boolean earned = rewardSession.finish(dismissed);
        if (earned == null) return;
        PluginCall call = fullscreenCall;
        String requestId = rewardRequestId;
        fullscreenCall = null; fullscreenToken = null; rewardSession = null;
        fullscreenBusy = false;
        policy.recordFullscreen(SystemClock.elapsedRealtime());
        if (!dismissed) error = "The ad did not complete. No reward was claimed.";
        syncBanner();
        JSObject result = new JSObject();
        result.put("earned", earned); result.put("dismissed", dismissed); result.put("requestId", requestId); result.put("snapshot", snapshot());
        if (call != null) call.resolve(result);
        tryConsentForm();
        pumpAds();
        publish();
    }
    @PluginMethod public void onDayEnd(PluginCall call) {
        ui(() -> {
            int day = call.getInt("day", 0);
            boolean eligible = foreground && adsStarted && bannerWanted && !busy() && adsAllowed() && interstitial != null && fresh(interstitialLoadedAt);
            if (!policy.considerDay(day, SystemClock.elapsedRealtime(), eligible)) {
                JSObject result = new JSObject(); result.put("shown", false); result.put("snapshot", snapshot()); call.resolve(result);
                pumpAds();
                return;
            }
            Object token = new Object();
            fullscreenToken = token; fullscreenCall = call; fullscreenBusy = true; interstitialWasShown = false;
            InterstitialAd ad = interstitial; interstitial = null;
            syncBanner(); publish();
            try {
                ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                    @Override public void onAdShowedFullScreenContent() {
                        if (fullscreenToken != token) return;
                        interstitialWasShown = true;
                        policy.recordInterstitial(day, SystemClock.elapsedRealtime());
                        entitlementPrefs.edit().putInt("last_interstitial_day", day).apply();
                    }
                    @Override public void onAdDismissedFullScreenContent() { finishInterstitial(token); }
                    @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError failure) { finishInterstitial(token); }
                });
                muteAds();
                ad.show(getActivity());
            } catch (RuntimeException | LinkageError unavailable) { finishInterstitial(token); }
        });
    }
    private void finishInterstitial(Object token) {
        if (fullscreenToken != token) return;
        PluginCall call = fullscreenCall;
        fullscreenCall = null; fullscreenToken = null; fullscreenBusy = false;
        if (interstitialWasShown) policy.recordFullscreen(SystemClock.elapsedRealtime());
        syncBanner();
        JSObject result = new JSObject(); result.put("shown", interstitialWasShown); result.put("snapshot", snapshot());
        if (call != null) call.resolve(result);
        tryConsentForm(); pumpAds(); publish();
    }

    private void connectBilling() {
        if (destroyed || billingConnecting) return;
        if (billing == null) {
            billing = BillingClient.newBuilder(getContext())
                .setListener((result, purchases) -> ui(() -> purchasesUpdated(result, purchases)))
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection().build();
        }
        if (billing.isReady()) { refreshOwnership(null); queryProduct(null); return; }
        // Once connected, query methods use SDK automatic reconnection.
        if (billingEverConnected) { refreshOwnership(null); queryProduct(null); return; }
        billingConnecting = true;
        billing.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(@NonNull BillingResult result) {
                ui(() -> {
                    billingConnecting = false;
                    if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                        billingEverConnected = true;
                        refreshOwnership(null);
                        queryProduct(null);
                    } else { initialOwnershipSettled = true; pumpAds(); }
                    publish();
                });
            }
            @Override public void onBillingServiceDisconnected() { /* SDK reconnects on the next query. */ }
        });
    }
    /** Returns operation success, keeping cached ownership on connection failures. */
    private void refreshOwnership(Consumer<Boolean> callback) {
        if (callback != null) ownershipCallbacks.add(callback);
        if (ownershipQuery) return;
        if (billing == null || (!billing.isReady() && !billingEverConnected)) { finishOwnership(false); connectBilling(); return; }
        ownershipQuery = true;
        final int epoch = ++ownershipEpoch;
        final int revision = entitlementRevision;
        main.postDelayed(() -> {
            if (ownershipQuery && ownershipEpoch == epoch) { ownershipEpoch++; finishOwnership(false); }
        }, 12000);
        billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(), (result, purchases) -> ui(() -> {
            if (!ownershipQuery || ownershipEpoch != epoch) return;
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) { finishOwnership(false); return; }
            if (revision != entitlementRevision) { finishOwnership(true); return; }
            Purchase found = purchasedReceipt(purchases);
            if (found == null) {
                setEntitlement(null);
                finishOwnership(true);
                return;
            }
            acknowledge(found, () -> ownershipQuery && ownershipEpoch == epoch && revision == entitlementRevision,
                success -> { if (ownershipQuery && ownershipEpoch == epoch) finishOwnership(success); });
        }));
    }
    private void finishOwnership(boolean success) {
        ownershipQuery = false;
        initialOwnershipSettled = true;
        List<Consumer<Boolean>> callbacks = new ArrayList<>(ownershipCallbacks);
        ownershipCallbacks.clear();
        for (Consumer<Boolean> callback : callbacks) callback.accept(success);
        pumpAds();
        publish();
    }
    private Purchase purchasedReceipt(List<Purchase> purchases) {
        if (purchases == null) return null;
        for (Purchase purchase : purchases) if (validPurchase(purchase)) return purchase;
        return null;
    }
    private void acknowledge(Purchase purchase, BooleanSupplier stillCurrent, Consumer<Boolean> callback) {
        if (!validPurchase(purchase) || !stillCurrent.getAsBoolean()) { callback.accept(false); return; }
        if (purchase.isAcknowledged()) { setEntitlement(purchase); callback.accept(true); return; }
        billing.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.getPurchaseToken()).build(), result -> ui(() -> {
            boolean success = result.getResponseCode() == BillingClient.BillingResponseCode.OK && stillCurrent.getAsBoolean();
            if (success) setEntitlement(purchase);
            callback.accept(success);
        }));
    }
    private void setEntitlement(Purchase purchase) {
        boolean established = purchase != null;
        boolean wasOwned = removeAds;
        removeAds = established;
        if (!established) entitlementRevision++;
        SharedPreferences.Editor editor = entitlementPrefs.edit();
        if (established) editor.putBoolean("established", true).putString("receipt", purchase.getOriginalJson()).putString("signature", purchase.getSignature());
        else editor.remove("established").remove("receipt").remove("signature");
        editor.apply();
        if (established) clearAds();
        else if (initialized && foreground) { if (wasOwned || !consentRetry.wasRequested()) requestConsent(); else pumpAds(); }
        syncBanner(); publish();
    }
    private void queryProduct(Consumer<ProductDetails> callback) {
        if (billing == null) { if (callback != null) callback.accept(null); return; }
        final boolean[] delivered = {false};
        if (callback != null) main.postDelayed(() -> {
            if (!destroyed && !delivered[0]) { delivered[0] = true; callback.accept(null); }
        }, 12000);
        QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder().setProductId(PRODUCT).setProductType(BillingClient.ProductType.INAPP).build();
        billing.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(Collections.singletonList(product)).build(), (result, details) -> ui(() -> {
            if (delivered[0]) return;
            delivered[0] = true;
            ProductDetails found = null;
            if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                for (ProductDetails item : details.getProductDetailsList()) if (PRODUCT.equals(item.getProductId())) { found = item; break; }
            }
            ProductDetails.OneTimePurchaseOfferDetails offer = chooseOffer(found);
            price = offer == null ? null : offer.getFormattedPrice();
            publish();
            if (callback != null) callback.accept(found);
        }));
    }
    /** Only permanent buy offers; never a rent/preorder for a non-consumable. */
    private ProductDetails.OneTimePurchaseOfferDetails chooseOffer(ProductDetails details) {
        if (details == null) return null;
        List<ProductDetails.OneTimePurchaseOfferDetails> offers = details.getOneTimePurchaseOfferDetailsList();
        if (offers == null) return null;
        ProductDetails.OneTimePurchaseOfferDetails selected = null;
        for (ProductDetails.OneTimePurchaseOfferDetails offer : offers) {
            if (offer.getRentalDetails() != null || offer.getPreorderDetails() != null) continue;
            if (selected == null || (offer.getOfferId() == null && selected.getOfferId() != null)) selected = offer;
        }
        return selected;
    }
    @PluginMethod public void buyRemoveAds(PluginCall call) {
        ui(() -> {
            if (removeAds) { resolvePurchase(call, true); return; }
            if (!initialized || !foreground || busy()) { resolvePurchase(call, false); return; }
            if (!ReceiptVerifier.canVerify(BuildConfig.PLAY_BILLING_PUBLIC_KEY)) {
                error = "Purchases are not configured for this test build. No payment was started.";
                resolvePurchase(call, false); publish(); return;
            }
            if (billing == null || !billing.isReady()) {
                error = "Google Play is not ready. Please reconnect and try again.";
                connectBilling(); resolvePurchase(call, false); publish(); return;
            }
            billingBusy = true; purchaseCall = call; error = null;
            main.postDelayed(() -> {
                if (!destroyed && purchaseCall == call) {
                    error = "Google Play has not confirmed the payment. Restore purchases when connected.";
                    finishPurchase(false);
                }
            }, 180000);
            syncBanner(); publish();
            // Fresh ownership and ProductDetails avoid duplicate/stale purchase flows.
            refreshOwnership(success -> {
                if (purchaseCall != call) return;
                if (!success) { error = "Google Play could not check purchases. No payment was started."; finishPurchase(false); return; }
                if (removeAds) { finishPurchase(true); return; }
                queryProduct(details -> {
                    if (purchaseCall != call) return;
                    ProductDetails.OneTimePurchaseOfferDetails offer = chooseOffer(details);
                    if (offer == null) { error = "Remove Ads is unavailable in Google Play for this account."; finishPurchase(false); return; }
                    BillingFlowParams.ProductDetailsParams.Builder product = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details);
                    if (offer.getOfferToken() != null && !offer.getOfferToken().isEmpty()) product.setOfferToken(offer.getOfferToken());
                    BillingFlowParams parameters = BillingFlowParams.newBuilder().setProductDetailsParamsList(Collections.singletonList(product.build())).build();
                    BillingResult launch = billing.launchBillingFlow(getActivity(), parameters);
                    if (launch.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
                        refreshOwnership(restored -> { if (purchaseCall == call) finishPurchase(restored && removeAds); });
                    } else if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        error = "Google Play could not open the purchase. No payment was completed.";
                        finishPurchase(false);
                    }
                });
            });
        });
    }
    private void purchasesUpdated(BillingResult result, List<Purchase> purchases) {
        if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
            Purchase purchase = purchasedReceipt(purchases);
            if (purchase != null) {
                final int revision = ++entitlementRevision;
                acknowledge(purchase, () -> revision == entitlementRevision, success -> {
                    if (!success) error = "Purchase acknowledgement is pending. Reconnect and Restore purchases.";
                    if (purchaseCall != null) finishPurchase(success && removeAds);
                    publish();
                });
            } else {
                boolean pending = false;
                if (purchases != null) for (Purchase item : purchases) {
                    if (item.getProducts().contains(PRODUCT) && item.getPurchaseState() == Purchase.PurchaseState.PENDING) pending = true;
                }
                error = pending ? "Payment is pending. Ads remain until Google Play confirms payment." : "The purchase could not be verified. Restore purchases when connected.";
                if (purchaseCall != null) finishPurchase(false);
                publish();
            }
        } else if (result.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            refreshOwnership(success -> { if (purchaseCall != null) finishPurchase(success && removeAds); });
        } else {
            error = result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED ? null : "Google Play did not confirm ownership. Restore purchases when connected.";
            if (purchaseCall != null) finishPurchase(false);
            publish();
        }
    }
    private void finishPurchase(boolean purchased) {
        PluginCall call = purchaseCall;
        purchaseCall = null; billingBusy = false;
        syncBanner();
        if (call != null) resolvePurchase(call, purchased);
        tryConsentForm(); pumpAds(); publish();
    }
    @PluginMethod public void restorePurchases(PluginCall call) {
        ui(() -> {
            if (!initialized || busy()) { resolvePurchase(call, false); return; }
            billingBusy = true; restoreCall = call; error = null; syncBanner(); publish();
            refreshOwnership(success -> {
                if (restoreCall != call) return;
                restoreCall = null;
                billingBusy = false;
                if (!success) error = "Google Play could not check purchases. Existing offline ownership is preserved.";
                syncBanner(); resolvePurchase(call, success && removeAds);
                tryConsentForm(); pumpAds(); publish();
            });
        });
    }

    @Override protected void handleOnResume() {
        foreground = true;
        if (!initialized) return;
        connectBilling();
        // Retry only unavailable consent, at most once per 30 monotonic seconds.
        requestConsent();
        tryConsentForm(); pumpAds(); syncBanner(); publish();
        // Pause cancels scheduled retries; resume restores a bounded retry even
        // when a previous no-fill backoff has not elapsed yet.
        if (adsStarted && adsAllowed()) scheduleAdRetry();
    }
    @Override protected void handleOnPause() {
        foreground = false;
        main.removeCallbacks(retryAds);
        syncBanner();
    }
    @Override protected void handleOnDestroy() {
        foreground = false;
        fullscreenBusy = false; billingBusy = false; consentBusy = false;
        destroyed = true;
        adsInitializationToken = null;
        clearAds();
        // Dismissal is not inferred from destruction or from app resume.
        if (fullscreenCall != null) {
            JSObject result = new JSObject(); result.put("snapshot", snapshot());
            if (rewardSession != null) { rewardSession.finish(false); result.put("earned", false); result.put("dismissed", false); result.put("requestId", rewardRequestId); }
            else result.put("shown", false);
            fullscreenCall.resolve(result);
            fullscreenCall = null;
        }
        if (purchaseCall != null) resolvePurchase(purchaseCall, false);
        if (restoreCall != null) resolvePurchase(restoreCall, false);
        if (privacyCall != null) privacyCall.resolve(snapshot());
        fullscreenToken = null; purchaseCall = null; privacyCall = null; restoreCall = null;
        main.removeCallbacksAndMessages(null);
        ownershipCallbacks.clear();
        if (billing != null) billing.endConnection();
        adsExecutor.shutdownNow();
    }
}
