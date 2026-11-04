package com.hewers.workforce;
import org.junit.Test;
import static org.junit.Assert.*;
public class AppPolicyTest {
 @Test public void onlyTheHewersHttpsOriginStaysInTheApp(){assertTrue(AppPolicy.isAppUrl("https://hewers-system.vercel.app/login"));assertTrue(AppPolicy.isAppUrl("https://hewers-system.vercel.app:443/"));for(String raw:new String[]{"http://hewers-system.vercel.app/","https://hewers-system.vercel.app.evil.test/","https://hewers-system.vercel.app@evil.test/","https://hewers-system.vercel.app:444/","javascript:alert(1)","file:///etc/passwd"})assertFalse(raw,AppPolicy.isAppUrl(raw));}
 @Test public void cameraNeverGrantsMicrophone(){assertTrue(AppPolicy.cameraOnly(new String[]{"android.webkit.resource.VIDEO_CAPTURE"}));assertFalse(AppPolicy.cameraOnly(new String[]{"android.webkit.resource.VIDEO_CAPTURE","android.webkit.resource.AUDIO_CAPTURE"}));}
 @Test public void downloadsCannotUseDirectoryPaths(){assertEquals(".._secret.txt",AppPolicy.downloadName("../secret.txt"));assertEquals("Hewers-export.txt",AppPolicy.downloadName("app.apk"));assertFalse(AppPolicy.isExternalHttps("intent://test"));}
}
