package com.hewers.workforce;
import java.net.URI;
import java.util.Arrays;
final class AppPolicy {
    static final String ORIGIN = "https://hewers-system.vercel.app";
    static final String HOME = ORIGIN + "/";
    static boolean isAppUrl(String raw) {
        try { URI u = URI.create(raw); return "https".equals(u.getScheme()) && "hewers-system.vercel.app".equals(u.getHost()) && u.getUserInfo() == null && (u.getPort() == -1 || u.getPort() == 443); }
        catch (Exception e) { return false; }
    }
    static boolean isExternalHttps(String raw) {
        try { URI u = URI.create(raw); return "https".equals(u.getScheme()) && u.getHost() != null && u.getUserInfo() == null; } catch (Exception e) { return false; }
    }
    static boolean cameraOnly(String[] resources) { return resources != null && resources.length == 1 && Arrays.asList(resources).contains("android.webkit.resource.VIDEO_CAPTURE"); }
    static String downloadName(String raw) { String safe = raw == null ? "" : raw.replaceAll("[^a-zA-Z0-9._-]", "_"); return safe.length() > 0 && safe.length() <= 100 && (safe.endsWith(".csv") || safe.endsWith(".txt")) ? safe : "Hewers-export.txt"; }
}
