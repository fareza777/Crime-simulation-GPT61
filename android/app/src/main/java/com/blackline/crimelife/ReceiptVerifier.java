package com.blackline.crimelife;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

final class ReceiptVerifier {
    static boolean canVerify(String publicKey) {
        if (publicKey == null || publicKey.isEmpty()) return false;
        try {
            byte[] key = Base64.getDecoder().decode(publicKey.replaceAll("\\s", ""));
            KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(key));
            return true;
        } catch (Exception invalid) { return false; }
    }
    static boolean verify(String publicKey, String receipt, String signature) {
        if (publicKey == null || publicKey.isEmpty() || receipt == null || receipt.isEmpty() || signature == null || signature.isEmpty()) return false;
        try {
            byte[] key = Base64.getDecoder().decode(publicKey.replaceAll("\\s", ""));
            Signature verifier = Signature.getInstance("SHA1withRSA");
            verifier.initVerify(KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(key)));
            verifier.update(receipt.getBytes(StandardCharsets.UTF_8));
            return verifier.verify(Base64.getDecoder().decode(signature));
        } catch (Exception invalid) { return false; }
    }
}
