package com.hewers.workforce;
import android.content.Context;
import android.content.Intent;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.UiDevice;
import androidx.test.uiautomator.Until;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class AppLaunchTest {
 @Test public void opensLiveLoginAndHandlesBackAndRotation() throws Exception {
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
  Intent intent=context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
  assertNotNull(intent);intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TASK);context.startActivity(intent);
  assertTrue("Hewers sign-in entry did not load",device.wait(Until.hasObject(By.textContains("Sign in with username")),90000));
  device.findObject(By.textContains("Sign in with username")).click();
  assertTrue("Hewers login page did not load",device.wait(Until.hasObject(By.text("Sign in to Hewers")),90000));
  assertTrue(device.wait(Until.hasObject(By.text("Username")),10000));
  device.takeScreenshot(new File(context.getExternalFilesDir(null),"android-login-portrait.png"));
  device.setOrientationLeft();assertTrue("Login disappeared after rotation",device.wait(Until.hasObject(By.text("Sign in to Hewers")),30000));
  device.takeScreenshot(new File(context.getExternalFilesDir(null),"android-login-landscape.png"));
  device.setOrientationNatural();device.waitForIdle();device.pressBack();
  assertTrue("Back did not return to the app entry",device.wait(Until.hasObject(By.textContains("Sign in with username")),30000));
  device.takeScreenshot(new File(context.getExternalFilesDir(null),"android-entry-after-back.png"));
 }
}
