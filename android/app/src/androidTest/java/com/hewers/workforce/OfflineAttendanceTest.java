package com.hewers.workforce;
import android.content.*;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.view.ViewGroup;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.*;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class OfflineAttendanceTest {
 @Test public void manualLogSurvivesWithoutSignalAndEncryptsQueue() throws Exception {
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  context.getSharedPreferences("offline-attendance",Context.MODE_PRIVATE).edit().clear().commit();
  UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
  device.executeShellCommand("svc wifi disable");device.executeShellCommand("svc data disable");
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   boolean launcher=device.wait(Until.hasObject(By.desc("Open offline attendance log")),30000);
   device.takeScreenshot(new File(context.getExternalFilesDir(null),"android-offline-launcher.png"));device.dumpWindowHierarchy(new File(context.getExternalFilesDir(null),"android-offline-launcher.xml"));
   assertTrue("Offline launcher button missing",launcher);
   scenario.onActivity(activity->{try{
    JSONObject schedule=new JSONObject().put("start","06:00").put("end","15:00").put("breakStart","12:00").put("breakEnd","13:00");
    JSONObject worker=new JSONObject().put("id","sample-worker").put("name","Offline Sample Worker").put("siteId","sample-site").put("site","Sample site").put("open",false).put("schedule",schedule);
    activity.offlineLog().cache(new JSONObject().put("owner","sample-owner").put("userId","sample-user").put("actor","Sample operator").put("role","auditor").put("workers",new JSONArray().put(worker)));
   }catch(Exception e){throw new RuntimeException(e);}});
   device.findObject(By.desc("Open offline attendance log")).click();
   device.takeScreenshot(new File(context.getExternalFilesDir(null),"android-offline-open.png"));
   device.dumpWindowHierarchy(new File(context.getExternalFilesDir(null),"android-offline-open.xml"));
   assertTrue(device.wait(Until.hasObject(By.textContains("HEWERS · Offline attendance")),15000));
   device.findObject(By.clazz("android.widget.EditText")).setText("No mobile signal at the sample site");
   device.findObject(By.text("Record time in")).click();
   assertTrue(device.wait(Until.hasObject(By.text(java.util.regex.Pattern.compile("Save on phone",java.util.regex.Pattern.CASE_INSENSITIVE))),5000));device.findObject(By.text(java.util.regex.Pattern.compile("Save on phone",java.util.regex.Pattern.CASE_INSENSITIVE))).click();
   assertTrue(device.wait(Until.hasObject(By.textContains("1 awaiting sync")),10000));
   String encrypted=context.getSharedPreferences("offline-attendance",Context.MODE_PRIVATE).getString("queue","");assertFalse(encrypted.isEmpty());assertFalse(encrypted.contains("sample-worker"));assertFalse(encrypted.contains("No mobile signal"));
   // Recreate the real Activity to exercise encrypted persistence and cold offline entry.
   scenario.recreate();
   assertTrue("Offline launcher missing after recreation",device.wait(Until.hasObject(By.desc("Open offline attendance log")),30000));
   device.findObject(By.desc("Open offline attendance log")).click();
   assertTrue(device.wait(Until.hasObject(By.textContains("1 awaiting sync")),10000));
   device.takeScreenshot(new File(context.getExternalFilesDir(null),"android-offline-encrypted-log.png"));
  }finally{device.executeShellCommand("svc wifi enable");device.executeShellCommand("svc data enable");context.getSharedPreferences("offline-attendance",Context.MODE_PRIVATE).edit().clear().commit();}
 }
}
